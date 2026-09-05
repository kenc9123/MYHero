import type { ReactNode } from "react";
import { useTactile } from "../hooks/useTactile";

type Variant = "cta" | "ghost";

interface TactileButtonProps {
  /** 内部 hash 链接，例如 '#/work'。Hero 独立预览下点击不离开当前预览页。 */
  to?: string;
  href?: string;
  onClick?: () => void;
  variant?: Variant;
  children: ReactNode;
  className?: string;
  /** 自定义光标悬停标签（如 'OPEN' / 'GO'），与 Cursor 组件联动 */
  cursor?: string;
  ariaLabel?: string;
}

/**
 * TactileButton —— 机械按键质感（绿底 CTA / 深色 ghost）。
 *
 * 位移与阴影方向由 useTactile + CSS 变量驱动，见 globals.css。
 *
 * 与 kenc-portfolio 版本的差别：
 * - 去掉了 router 依赖，Hero 是独立预览，不需要跳到其他页面
 * - `to` 参数仍然保留语义，渲染为 `<a href="#/...">`，
 *   让"按一下像在跳页"的体感成立，但不会真正离开 Hero 预览
 */
export function TactileButton({
  to,
  href,
  onClick,
  variant = "cta",
  children,
  className = "",
  cursor,
  ariaLabel,
}: TactileButtonProps) {
  const ref = useTactile<HTMLAnchorElement>();
  const base = `tactile ${variant === "cta" ? "tactile-cta" : "tactile-ghost"} inline-flex select-none items-center gap-2 rounded-full px-7 py-3 font-display text-sm font-semibold tracking-wide ${className}`;
  const inner = (
    <>
      {children}
      <svg
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="square"
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </>
  );

  // 优先外部 href（外链），其次内部 hash，最后退化为无操作的纯按钮
  if (href) {
    return (
      <a
        ref={ref}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className={base}
        data-cursor={cursor}
        aria-label={ariaLabel}
      >
        {inner}
      </a>
    );
  }

  if (to) {
    const hashHref = to.startsWith("#") ? to : `#${to.startsWith("/") ? to : `/${to}`}`;
    return (
      <a
        ref={ref}
        href={hashHref}
        className={base}
        data-cursor={cursor}
        aria-label={ariaLabel}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      onClick={onClick}
      className={base}
      aria-label={ariaLabel}
    >
      {inner}
    </button>
  );
}
