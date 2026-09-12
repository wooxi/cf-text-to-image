/*
 * 在首帧之前把持久化的主题写进 <html data-theme>。
 * 必须是阻塞式的 <script src>（不能 async/defer），否则会闪一下另一种主题。
 * 默认浅色；只有用户明确选过深色才切过去。
 */
(() => {
  try {
    var theme = localStorage.getItem("theme");
    if (theme !== "dark") theme = "light";
    document.documentElement.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f4f4f2" : "#121413");
  } catch (e) {
    /* localStorage 不可用时保持默认浅色 */
  }
})();
