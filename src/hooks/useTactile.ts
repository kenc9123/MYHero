import { useEffect, useRef } from "react";

/**
 * useTactile — 鼠标动态光照系统
 *
 * 原理：监听元素上的 Pointer Events，计算光标相对元素中心的
 * 方向向量（-1 ~ 1），通过 rAF 直接写入 CSS 变量 --lx / --ly。
 * 阴影方向/长度全部由 CSS 变量计算，React 不发生重渲染。
 *
 * 降级：
 * - 粗指针（触屏）→ 不绑定监听，阴影保持静态向下
 * - prefers-reduced-motion → 不绑定监听
 */
export function useTactile<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fine = window.matchMedia("(pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduced.matches) return;

    let raf = 0;

    const reset = () => {
      el.style.setProperty("--lx", "0");
      el.style.setProperty("--ly", "0");
    };

    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        // 光标相对中心的位置，clamp 到 [-1, 1]
        const lx = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1);
        const ly = clamp(((e.clientY - rect.top) / rect.height) * 2 - 1);
        // 平滑系数：光标离中心越远响应越明显，但整体克制
        el.style.setProperty("--lx", (lx * 0.85).toFixed(3));
        el.style.setProperty("--ly", (ly * 0.85).toFixed(3));
      });
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerenter", onMove, { passive: true });
    el.addEventListener("pointerleave", reset, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerenter", onMove);
      el.removeEventListener("pointerleave", reset);
    };
  }, []);

  return ref;
}

function clamp(v: number, min = -1, max = 1): number {
  return Math.min(max, Math.max(min, v));
}
