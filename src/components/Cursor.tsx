import { useEffect, useRef, useState } from "react";

/**
 * 自定义 Cursor —— 极简圆点 + 外环。
 * - 仅 pointer:fine 且未开启 reduced-motion 时激活
 * - 悬停带 data-cursor 属性的元素时，外环展开并显示标签（VIEW / OPEN 等）
 * - 悬停按钮：中间圆点缩小；按下：圆点扩大（见 Prompt §5 Cursor）
 * - pointer-events: none，绝不影响点击
 * - rAF + lerp 平滑跟随，无 React 高频更新
 */
export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduced.matches) return;

    setEnabled(true);
    document.documentElement.classList.add("has-cursor");

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ring = { x: target.x, y: target.y };
    const dot = { x: target.x, y: target.y };
    let hovScale = 1; // 悬停按钮 → 缩小
    let pressScale = 1; // 按下 → 扩大
    let scale = 1;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
    };

    const loop = () => {
      // dot 快速跟随，ring 慢速跟随
      dot.x += (target.x - dot.x) * 0.55;
      dot.y += (target.y - dot.y) * 0.55;
      ring.x += (target.x - ring.x) * 0.16;
      ring.y += (target.y - ring.y) * 0.16;
      scale += (hovScale * pressScale - scale) * 0.22;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${dot.x}px, ${dot.y}px, 0) translate(-50%, -50%) scale(${scale})`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onOver = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("[data-cursor]") as HTMLElement | null;
      setLabel(el ? el.dataset.cursor || "" : null);
      // 悬停交互元素（按钮 / 链接 / 卡片）时圆点缩小
      const inter = (e.target as HTMLElement | null)?.closest?.(
        "button, a, [role='button'], [data-cursor]"
      ) as HTMLElement | null;
      hovScale = inter ? 0.55 : 1;
    };
    const onDown = () => {
      pressScale = 1.7;
    };
    const onUp = () => {
      pressScale = 1;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("has-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[100] size-1.5 rounded-full bg-ink"
      />
      <div
        ref={ringRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[100] flex items-center justify-center"
      >
        <div
          className={`flex items-center justify-center rounded-full border transition-[width,height,background-color,border-color] duration-300 ease-out ${
            label
              ? "size-[4.25rem] border-[2.5px] border-ink bg-accent shadow-[3px_3px_0_0_#000000]"
              : "size-8 border-[1.5px] border-ink/50 bg-transparent"
          }`}
        >
          {label && (
            <span className="font-display text-xs font-extrabold tracking-[0.18em] text-[#04231a]">
              {label}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
