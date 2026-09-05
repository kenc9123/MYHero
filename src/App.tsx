import { BackgroundGrid } from "./components/BackgroundGrid";
import { Cursor } from "./components/Cursor";
import { Hero } from "./components/Hero";

/**
 * App —— Hero 独立预览入口。
 *
 * 与 kenc-portfolio 版本的差别：
 * - 没有 RouterProvider / 路由切换 / Footer / Navbar
 * - 整页只渲染 Hero &lt;section&gt;
 * - BackgroundGrid 与 Cursor 作为全局背景层 + 自定义指针叠加在页面上
 *
 * 渲染层级（z-index 由下到上）：
 *   -10 : BackgroundGrid canvas（pointer-events: none）
 *     0 : Hero 内容
 *    40 : BackgroundGrid 右下角 AUDIO 开关
 *   100 : Cursor 圆点 + 外环（pointer-events: none）
 */
export default function App() {
  return (
    <>
      <BackgroundGrid />
      <Cursor />
      <Hero />
    </>
  );
}
