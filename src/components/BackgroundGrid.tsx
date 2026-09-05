import { useEffect, useMemo, useRef, useState } from "react";

/**
 * BackgroundGrid —— 立体方块纹理背景（深色主题）。
 * - 全屏 canvas，绘制浅浮雕方块网格（静止时极淡，不抢内容）
 * - 鼠标轨迹影响：靠近光标的方块被「照亮」—— 面变亮并染玉绿，
 *   朝向光标的一侧边缘出现高光（方向性光照），并轻微放大
 * - 点击下压：点在背景空白处时，从点击点生成一圈向四周扩散的
 *   涟漪下压波 —— 波前经过的方块依次被压下（缩小、变暗、玉绿
 *   描边）再回弹；松开时被压的格子闪能量并再荡开一圈轻涟漪
 * - 音频涟漪（可选，右下角 AUDIO 开关开启后选择要监听的音频源）：
 *   通过 getDisplayMedia 捕获系统/标签页正在播放的声音（不是麦克风），
 *   音量 → 涟漪大小；声谱重心（低音/高音）→ 垂直方位（低音从
 *   底部、高音从顶部荡起）；左右声道平衡 → 水平方位；起音强度
 *   → 扩散速度。音频只在本地实时分析，不录制、不上传
 * - 光标离开后方块缓慢回落（能量按帧衰减），形成拖尾
 * - reduced-motion：只画一次静态纹理；触屏设备支持按压特效
 * - canvas 本体 pointer-events: none，纯背景
 */
const CELL = 44; // 网格间距（px）
const GAP = 7; // 方块之间的缝
const RADIUS = 170; // 光标影响半径（px）
const DECAY = 0.94; // 每帧能量衰减系数（越小拖尾越短）
const GROW = 0.06; // 满能量时方块放大比例
// 按压涟漪：从点击点向四周扩散的下压波
const RIPPLE_SPEED = 0.45; // 波前推进速度（px/ms）
const RIPPLE_BAND = 110; // 波前宽度（px）
const RIPPLE_LIFE = 1400; // 涟漪存活时长（ms）
// 音频涟漪参数
const AUDIO_MIN_INTERVAL = 130; // 两次音频涟漪最小间隔（ms）
const AUDIO_TRIGGER = 0.03; // 超过噪声底多少算一次「声音事件」
const AUDIO_FLOOR = 0.97; // 噪声底自适应系数（越接近 1 跟得越慢）

// 玉绿（强调色 #5DD98E）用于能量态染色与按压确认描边
const MINT = { r: 93, g: 217, b: 142 };

/** 点击落在这些元素上时不算「点背景」 */
const INTERACTIVE = "a, button, [role='button'], input, textarea, select, label, [data-cursor], .tactile";

type Ripple = { x: number; y: number; t0: number; amp: number; speed: number };

/** 音频引擎：立体声分离分析 + 频谱混合分析（全部本地实时） */
type AudioEngine = {
  ctx: AudioContext;
  stream: MediaStream;
  mix: AnalyserNode;
  left: AnalyserNode;
  right: AnalyserNode;
  freq: Uint8Array;
  waveMix: Uint8Array;
  waveL: Uint8Array;
  waveR: Uint8Array;
};

/** 时域数据 → RMS 音量（0..1 附近） */
function rmsOf(data: Uint8Array) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / data.length);
}

/** 采样一帧音频特征：整体音量、左右平衡（-1..1）、声谱重心（0=低音, 1=高音） */
function sampleAudio(e: AudioEngine) {
  e.mix.getByteTimeDomainData(e.waveMix);
  e.left.getByteTimeDomainData(e.waveL);
  e.right.getByteTimeDomainData(e.waveR);
  e.mix.getByteFrequencyData(e.freq);

  const vol = rmsOf(e.waveMix);
  const vl = rmsOf(e.waveL);
  const vr = rmsOf(e.waveR);
  const bal = vl + vr > 0.001 ? (vr - vl) / (vl + vr) : 0;

  let num = 0;
  let den = 0;
  for (let i = 0; i < e.freq.length; i++) {
    num += i * e.freq[i];
    den += e.freq[i];
  }
  const centroid = den > 0 ? num / den / e.freq.length : 0.5;

  return { vol, bal, centroid };
}

export function BackgroundGrid() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [audioOn, setAudioOn] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const reduced = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  // 捕获系统/标签页音频（非麦克风）：getDisplayMedia，
  // 用户选择「整个屏幕+系统声音」或「标签页+标签页音频」。本地分析不上传。
  useEffect(() => {
    if (!audioOn) return;
    let cancelled = false;
    let engine: AudioEngine | null = null;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true, // 浏览器要求：分享音频必须附带画面
          audio: true, // 关键：勾选「共享系统声音/标签页音频」才有音轨
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        // 只要声音不要画面：立刻停掉视频轨，省资源
        stream.getVideoTracks().forEach((t) => t.stop());
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          stream.getTracks().forEach((t) => t.stop());
          setAudioError("no-audio");
          setAudioOn(false);
          return;
        }
        // 用户点了浏览器的「停止共享」→ 同步关闭开关
        audioTracks[0].addEventListener("ended", () => {
          setAudioOn(false);
        });

        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const splitter = ctx.createChannelSplitter(2);
        const mk = (fft: number) => {
          const a = ctx.createAnalyser();
          a.fftSize = fft;
          a.smoothingTimeConstant = 0.55;
          return a;
        };
        const mix = mk(1024);
        const left = mk(512);
        const right = mk(512);
        source.connect(mix);
        source.connect(splitter);
        splitter.connect(left, 0);
        splitter.connect(right, 1);

        engine = {
          ctx,
          stream,
          mix,
          left,
          right,
          freq: new Uint8Array(mix.frequencyBinCount),
          waveMix: new Uint8Array(mix.fftSize),
          waveL: new Uint8Array(left.fftSize),
          waveR: new Uint8Array(right.fftSize),
        };
        audioRef.current = engine;
        setAudioError(null);
      } catch {
        // 用户取消选择器或浏览器不支持
        if (!cancelled) {
          setAudioError("denied");
          setAudioOn(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      audioRef.current = null;
      engine?.stream.getTracks().forEach((t) => t.stop());
      engine?.ctx.close().catch(() => {});
    };
  }, [audioOn]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = !reduced;

    let cols = 0;
    let rows = 0;
    let energy = new Float32Array(0);
    let press = new Float32Array(0);
    const pointer = { x: -9999, y: -9999, active: false };
    let heldCell = -1; // 当前被按住的格子索引
    let pressed = false;
    // 活跃涟漪列表：{x, y, t0, amp, speed}
    let ripples: Ripple[] = [];
    // 音频状态：自适应噪声底 + 上次涟漪时间 + 左右游走相位（错落分布）
    let noiseFloor = 0.008;
    let lastAudioRipple = 0;
    let lastSide = 0; // 上一次涟漪落在左(-1)还是右(1)，用于左右交替
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(window.innerWidth / CELL) + 1;
      rows = Math.ceil(window.innerHeight / CELL) + 1;
      energy = new Float32Array(cols * rows);
      press = new Float32Array(cols * rows);
    };

    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const half = (CELL - GAP) / 2;

      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const i = gy * cols + gx;
          const e = energy[i];
          const p = press[i];
          const cx = gx * CELL + CELL / 2;
          const cy = gy * CELL + CELL / 2;
          // 下压时块体缩小（按进表面）
          const s = half * 2 * (1 + GROW * e) * (1 - 0.1 * p);
          const x = cx - s / 2;
          const y = cy - s / 2;

          // 光照方向（光标即光源）：方块朝向光标的一侧边缘受光
          let lx = 0;
          let ly = 0;
          if (pointer.active) {
            lx = pointer.x - cx;
            ly = pointer.y - cy;
          }

          // 面：静止 3% 白 → 满能量增亮 + 玉绿染色；按压变暗
          const kt = 0.55 * e;
          const dark = 1 - 0.55 * p;
          const rr = Math.round((255 - (255 - MINT.r) * kt) * dark);
          const gg = Math.round((255 - (255 - MINT.g) * kt) * dark);
          const bb = Math.round((255 - (255 - MINT.b) * kt) * dark);
          const fa = (0.03 + 0.34 * e) * (1 - 0.4 * p);
          ctx.fillStyle = `rgba(${rr}, ${gg}, ${bb}, ${fa})`;
          ctx.fillRect(x, y, s, s);

          // 边缘：受光一侧高光，背光一侧留暗 → 方向性浮雕
          const hl = 0.07 + 0.5 * e;
          ctx.fillStyle = `rgba(255, 255, 255, ${hl})`;
          if (ly < 0) ctx.fillRect(x, y, s, 1); // 顶部受光
          if (lx < 0) ctx.fillRect(x, y, 1, s); // 左侧受光
          const dk = 0.4;
          ctx.fillStyle = `rgba(0, 0, 0, ${dk})`;
          if (ly > 0) ctx.fillRect(x + s - 1, y, 1, s); // 背光侧（右侧）
          if (lx > 0) ctx.fillRect(x, y + s - 1, s, 1); // 背光侧（底部）

          // 按压确认：块体描一圈玉绿边（绿色 = 交互信号）
          if (p > 0.004) {
            ctx.strokeStyle = `rgba(${MINT.r}, ${MINT.g}, ${MINT.b}, ${0.9 * p})`;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 0.75, y + 0.75, s - 1.5, s - 1.5);
          }
        }
      }
    };

    const tick = () => {
      const now = performance.now();

      if (pointer.active) {
        const gx0 = Math.max(0, Math.floor((pointer.x - RADIUS) / CELL));
        const gx1 = Math.min(cols - 1, Math.ceil((pointer.x + RADIUS) / CELL));
        const gy0 = Math.max(0, Math.floor((pointer.y - RADIUS) / CELL));
        const gy1 = Math.min(rows - 1, Math.ceil((pointer.y + RADIUS) / CELL));
        for (let gy = gy0; gy <= gy1; gy++) {
          for (let gx = gx0; gx <= gx1; gx++) {
            const cx = gx * CELL + CELL / 2;
            const cy = gy * CELL + CELL / 2;
            const d = Math.hypot(cx - pointer.x, cy - pointer.y);
            if (d < RADIUS) {
              const target = (1 - d / RADIUS) ** 1.5;
              const i = gy * cols + gx;
              if (target > energy[i]) energy[i] = target;
            }
          }
        }
      }
      for (let i = 0; i < energy.length; i++) {
        if (energy[i] > 0.001) energy[i] *= DECAY;
        else energy[i] = 0;
      }

      // ---- 音频涟漪：音量定大小，声谱重心定高低方位，
      //      左右声道定水平方位，起音强度定扩散速度 ----
      const engine = audioRef.current;
      if (engine) {
        const f = sampleAudio(engine);
        const isOnset =
          f.vol > noiseFloor + AUDIO_TRIGGER &&
          f.vol > 0.02 &&
          now - lastAudioRipple > AUDIO_MIN_INTERVAL;
        if (isOnset) {
          // 水平方位：立体声有信息时按声像走；单声道（系统音频常见）
          // 用左右交替 + 随机幅度游走，让涟漪错落分布不挤在中线
          let xN: number;
          if (Math.abs(f.bal) > 0.18) {
            xN = 0.5 + f.bal * 0.42;
            lastSide = Math.sign(f.bal);
          } else {
            const side = -lastSide || (Math.random() < 0.5 ? -1 : 1);
            lastSide = side;
            xN = 0.5 + side * (0.14 + Math.random() * 0.3);
          }
          // 垂直方位：低音底部、高音顶部，再加少量随机抖动形成纵深
          const yN =
            0.85 - 0.7 * Math.min(1, f.centroid * 2) + (Math.random() - 0.5) * 0.16;
          const x = window.innerWidth * Math.min(0.9, Math.max(0.1, xN));
          const y = window.innerHeight * Math.min(0.9, Math.max(0.1, yN));
          const amp = Math.min(1, 0.3 + f.vol * 2.2); // 响 → 大涟漪
          const speed = RIPPLE_SPEED * (0.6 + Math.min(1.6, f.vol * 3)); // 重音 → 快波
          ripples.push({ x, y, t0: now, amp, speed });
          lastAudioRipple = now;
          noiseFloor = f.vol; // onset 后重置噪声底，避免连发
        } else {
          noiseFloor = noiseFloor * AUDIO_FLOOR + f.vol * (1 - AUDIO_FLOOR);
        }
      }

      // 按压过渡：按住的中心格保持压下；涟漪波前经过的格子依次被压下再回弹
      for (let ri = ripples.length - 1; ri >= 0; ri--) {
        if (now - ripples[ri].t0 > RIPPLE_LIFE) ripples.splice(ri, 1);
      }
      const waves = ripples.map((rp) => ({ ...rp, age: now - rp.t0 }));
      for (let i = 0; i < press.length; i++) {
        let target = pressed && i === heldCell ? 1 : 0;
        if (waves.length > 0) {
          const cx = (i % cols) * CELL + CELL / 2;
          const cy = Math.floor(i / cols) * CELL + CELL / 2;
          for (const w of waves) {
            const r = w.age * w.speed; // 当前波前半径（各自速度）
            const off = Math.hypot(cx - w.x, cy - w.y) - r;
            if (off < 0 || off > RIPPLE_BAND) continue; // 波还没到 / 已经过去
            const bandT = 1 - off / RIPPLE_BAND; // 波前内更靠前的压得更深
            const fade = 1 - w.age / RIPPLE_LIFE; // 涟漪整体随时间衰减
            const v = w.amp * bandT ** 1.6 * fade;
            if (v > target) target = v;
          }
        }
        if (press[i] === target) continue;
        const k = target > press[i] ? 0.45 : 0.14; // 压下快（干脆），回弹慢（有肉感）
        press[i] += (target - press[i]) * k;
        if (Math.abs(target - press[i]) < 0.002) press[i] = target;
      }

      draw();
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      // 光照效果只跟随精确指针（鼠标）；触屏拖动不触发
      if (e.pointerType !== "mouse") return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
    };

    const onDown = (e: PointerEvent) => {
      // 点在交互元素上时，按压反馈归交互元素本身，不压背景
      const el = e.target as Element | null;
      if (el?.closest?.(INTERACTIVE)) return;
      const gx = Math.floor(e.clientX / CELL);
      const gy = Math.floor(e.clientY / CELL);
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return;
      heldCell = gy * cols + gx;
      pressed = true;
      // 按压涟漪：一圈下压波从点击点向四周扩散
      ripples.push({ x: e.clientX, y: e.clientY, t0: performance.now(), amp: 0.85, speed: RIPPLE_SPEED });
    };

    const release = () => {
      if (pressed && heldCell >= 0) {
        // 回弹：被压的格子闪一下能量，再从原点击点荡开一圈更轻的回弹涟漪
        energy[heldCell] = 1;
        const cx = (heldCell % cols) * CELL + CELL / 2;
        const cy = Math.floor(heldCell / cols) * CELL + CELL / 2;
        ripples.push({ x: cx, y: cy, t0: performance.now(), amp: 0.4, speed: RIPPLE_SPEED });
      }
      pressed = false;
      heldCell = -1;
    };

    resize();
    window.addEventListener("resize", resize);

    if (animate) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("mouseleave", onLeave);
      window.addEventListener("pointerdown", onDown, { passive: true });
      window.addEventListener("pointerup", release, { passive: true });
      window.addEventListener("pointercancel", release, { passive: true });
      raf = requestAnimationFrame(tick);
    } else {
      draw(); // 静态浅浮雕纹理
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [reduced]);

  return (
    <>
      <canvas
        ref={ref}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
      />
      {/* 音频涟漪开关 —— 捕获系统/标签页正在播放的声音；reduced-motion 下无动画不显示 */}
      {!reduced && (
        <button
          type="button"
          aria-pressed={audioOn}
          title={
            audioError === "no-audio"
              ? "没有捕获到音频：分享时请勾选「共享系统声音」（整个屏幕）或「共享标签页音频」（标签页）"
              : audioError === "denied"
                ? "未获得音频：已取消选择或浏览器不支持"
                : audioOn
                  ? "停止监听播放中的音频"
                  : "监听电脑正在播放的音频（选择「整个屏幕+系统声音」或「标签页+标签页音频」；本地实时分析，不上传）"
          }
          onClick={() => {
            setAudioError(null);
            setAudioOn((v) => !v);
          }}
          className={`glass fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full border px-4 py-2 font-display text-[11px] font-semibold tracking-[0.18em] transition-colors duration-300 ${
            audioOn
              ? "border-accent/50 text-ink"
              : "border-ink/15 text-mute hover:text-ink"
          }`}
        >
          <span
            aria-hidden="true"
            className={`size-2 rounded-full transition-colors duration-300 ${
              audioError
                ? "bg-red-400"
                : audioOn
                  ? "animate-pulse bg-accent"
                  : "bg-mute/60"
            }`}
          />
          AUDIO
        </button>
      )}
    </>
  );
}
