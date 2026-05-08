/**
 * AnyMenu Helper Tauri Bridge
 * 负责主动/被动将页面数据（如选区）传递给 Tauri 应用程序
 * 
 * - 监听选择完毕事件，主动发送实践给 Tauri 后端
 * - 监听选取变化，主动发送事件给 Tauri 后端
 * - 被动暴露全局 API，供 Tauri 后端通过 execute_script 主动调用获取
 */
(() => {
  // 是否注入/启用
  {
    if (window.__AnyMenuHelperBridgeInjected) return; // 避免重复注入

    if (typeof chrome !== 'undefined' && chrome.storage) { // 设置中是否启用
      chrome.storage.sync.get({ is_bridge: true }, (res) => {
        if (res.is_bridge) run()
      });
    } else { // 兼容非浏览器扩展环境（例如直接通过 <script> 引入测试）
      run()
    }

    window.__AnyMenuHelperBridgeInjected = true;
  }

  // 启用
  function run() {
    const TAURI_SERVER_URL = "http://127.0.0.1:14876/selection";

    const state = {
      selectionText: "",
      selectionHtml: ""
    };

    // 数据收集 (防抖处理，避免频繁通信)
    let timeout;
    document.addEventListener("selectionchange", () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel) return;
        
        const selectionText = sel.toString();
        let selectionHtml = "";
        
        if (sel.rangeCount > 0) {
          const div = document.createElement("div");
          div.appendChild(sel.getRangeAt(0).cloneContents());
          selectionHtml = div.innerHTML;
        }

        // 如果没有选中文本，可以选择不发送
        if (!selectionText.trim()) return;

        // 【主动通信】通过 HTTP POST 发送给本地的 Tauri 程序
        fetch(TAURI_SERVER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: selectionText,
            html: selectionHtml
          })
        }).catch(err => {
          // Tauri App 可能没打开，忽略报错或进行调试输出
          // console.debug("[AnyMenu] Failed to send to Tauri app:", err);
        });

      }, 300); // 300ms 防抖
    });

    console.log("[AnyMenu Bridge] Tauri communication bridge initialized.");
  }
})();
