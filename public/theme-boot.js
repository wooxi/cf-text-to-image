/*
 * 在首帧之前把持久化的主题写进 <html data-theme>。
 * 必须是阻塞式的 <script src>（不能 async/defer），否则浅色用户会先看到深色闪烁。
 */
(() => {
  try {
    var theme = localStorage.getItem("theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.setAttribute("data-theme", theme);
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta)
        meta.setAttribute("content", theme === "light" ? "#f6f3ec" : "#0a0e0f");
    }
  } catch (e) {
    /* localStorage 不可用时保持默认深色 */
  }
})();
