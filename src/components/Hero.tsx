import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { profile } from "../data/profile";
import { TactileButton } from "./TactileButton";

/**
 * Hero —— 整站门面：一屏之内同时呈现静态排版与动态物理语言。
 *
 * 结构（从 portfolio/Home.tsx 抽出，仅保留 Hero &lt;section&gt;）：
 * - 元信息行：年份 + 地点
 * - 大字姓名：实心 "KENC" + 描边 "Portfolio" 上下咬合
 * - 职业定位 + 一段 positioning 文案
 * - CTA：View Work（实心绿底）+ About Me（深色 ghost）
 * - 视觉：右侧抽象纸片 + 绿色信号块（"Design × Code"）
 *
 * 视觉与动画：
 * - 滚动驱动 decoY 视差（reduced-motion 时禁用）
 * - 大字姓名 stagger 入场（0.05s / 0.15s delay）
 * - 职业段落 / CTA 分别 0.3s / 0.5s delay 跟随
 *
 * 注：在 Hero 独立预览中，CTA 的 `to` 指向 portfolio 中的
 * `#/work` `#/about`。这里只是单页 Demo，点击不会真正跳转。
 */
export function Hero() {
  const reduced = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);
  // Hero 轻微视差：仅装饰元素，不影响阅读
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const decoY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : -60]);

  const rolesLine = profile.roles.join(" / ");

  return (
    <section
      ref={heroRef}
      aria-label="首页 Hero"
      className="mx-auto flex min-h-svh max-w-6xl flex-col justify-center px-5 pb-16 pt-28 md:px-8 md:pb-24 md:pt-36"
    >
      {/* 元信息行 */}
      <motion.div
        initial={reduced ? undefined : { opacity: 0, y: 12 }}
        animate={reduced ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-display text-xs tracking-[0.2em] text-mute uppercase"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2 rounded-full bg-accent-deep ring-1 ring-ink/20" />
          Portfolio — 2026
        </span>
        <span aria-hidden="true" className="hidden h-px w-10 bg-ink/20 md:block" />
        <span>{profile.location}</span>
      </motion.div>

      <div className="grid items-end gap-12 md:grid-cols-[1.4fr_1fr]">
        <div>
          {/* 姓名 —— 大字号排版 */}
          <h1 className="font-display leading-[0.85] font-bold tracking-[-0.04em]">
            <motion.span
              initial={reduced ? undefined : { opacity: 0, y: 40 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="block text-[clamp(4.5rem,14vw,11rem)] uppercase"
            >
              {profile.name}
            </motion.span>
            <motion.span
              initial={reduced ? undefined : { opacity: 0, y: 40 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="text-outline block text-[clamp(2.2rem,6.5vw,5.5rem)] uppercase"
            >
              Portfolio
            </motion.span>
          </h1>

          {/* 职业定位 */}
          <motion.p
            initial={reduced ? undefined : { opacity: 0, y: 16 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-6 font-display text-sm font-medium tracking-wide md:text-base"
          >
            {rolesLine}
          </motion.p>

          {/* 简短介绍 */}
          <motion.p
            initial={reduced ? undefined : { opacity: 0, y: 16 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-4 max-w-md text-sm leading-relaxed text-mute md:text-[15px]"
          >
            {profile.positioning}
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={reduced ? undefined : { opacity: 0, y: 16 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-10 flex flex-wrap gap-4"
          >
            <TactileButton to="#/work" cursor="OPEN">
              View Work
            </TactileButton>
            <TactileButton to="#/about" variant="ghost">
              About Me
            </TactileButton>
          </motion.div>
        </div>

        {/* Hero 视觉 —— 抽象的实体纸片构成 */}
        <motion.div
          aria-hidden="true"
          style={{ y: decoY }}
          initial={reduced ? undefined : { opacity: 0, y: 24, rotate: 2 }}
          animate={reduced ? undefined : { opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative hidden aspect-[4/5] md:block"
        >
          {/* 背层纸片 */}
          <div className="tactile tactile-card absolute right-0 top-4 h-[62%] w-[72%] rotate-[4deg] rounded-xl" />
          {/* 绿色信号块 */}
          <div className="absolute left-0 top-16 z-10 flex h-24 w-40 rotate-[-3deg] items-center justify-center rounded-2xl border-[1.5px] border-accent-deep bg-accent font-display text-xs font-bold tracking-[0.3em] text-[#04231a] uppercase shadow-[0_4px_0_0_var(--color-accent-deep)]">
            Design × Code
          </div>
          {/* 前层纸片 */}
          <div className="tactile tactile-card absolute bottom-0 left-[18%] z-20 flex h-[46%] w-[58%] rotate-[-2deg] flex-col justify-between rounded-xl p-4">
            <span className="font-display text-[10px] tracking-[0.25em] text-mute uppercase">
              Visual System
            </span>
            <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-6 rounded-sm ${i === 0 ? "bg-accent ring-1 ring-ink/20" : "bg-ink/8"}`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
