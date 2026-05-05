/**
 * AnyMenu Helper Tauri Bridge
 * 负责主动/被动将页面数据（如选区）传递给 Tauri 应用程序
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
    const state = {
      selectionText: "",
      selectionHtml: ""
    };

    // 1. 数据收集 (防抖处理，避免频繁通信)
    let timeout;
    document.addEventListener("selectionchange", () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel) return;
        
        state.selectionText = sel.toString();
        if (sel.rangeCount > 0) {
          const div = document.createElement("div");
          div.appendChild(sel.getRangeAt(0).cloneContents());
          state.selectionHtml = div.innerHTML;
        }

        // 【主动通信】如果处于 Tauri 环境，主动发送事件给 Rust 后端
        if (window.__TAURI__ && window.__TAURI__.event) {
          window.__TAURI__.event.emit("anymenu-selection-changed", {
            text: state.selectionText,
            html: state.selectionHtml
          }).catch(err => console.error("[Tauri Bridge] emit error:", err));
        }
      }, 300);
    });

    // 2. 【被动通信】暴露全局 API，供 Tauri 后端通过 execute_script 主动调用获取
    window.AnyMenuTauriAPI = {
      getSelection: () => {
        return {
          text: state.selectionText,
          html: state.selectionHtml
        };
      },
      // Tauri 后端可以通过评估 `window.AnyMenuTauriAPI.getSelectionJSON()` 来获取字符串
      getSelectionJSON: () => JSON.stringify({
        text: state.selectionText,
        html: state.selectionHtml
      })
    };

    console.log("[AnyMenu Bridge] Tauri communication bridge initialized.");
  }
})();
