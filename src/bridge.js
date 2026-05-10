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
      chrome.storage.sync.get({
        is_debug: false,
        is_bridge: true,
        app_port: "41667",
      }, (res) => {
        if (res.is_bridge) run(res.app_port, res.is_debug);
      });
    } else { // 兼容非浏览器扩展环境（例如直接通过 <script> 引入测试）
      run()
    }

    window.__AnyMenuHelperBridgeInjected = true;
  }

  /**
   * 启用
   * 当选中文本后，主动通过 HTTP POST 发送给本地的 Tauri 程序
   */
  function run(app_port = "41667", is_debug = false) {
    const APP_SERVER_URL = `http://127.0.0.1:${app_port}/selection`;

    // 选区信息
    let selectionText = "";
    let selectionHtml = "";
    const updateSelectionInfo = () => {
      const sel = window.getSelection();
      if (!sel) return false; // 如果没有选中文本，false

      selectionText = sel.toString();
      selectionHtml = "";
      if (sel.rangeCount > 0) {
        const div = document.createElement("div");
        div.appendChild(sel.getRangeAt(0).cloneContents());
        selectionHtml = div.innerHTML;
      }

      if (!selectionText.trim()) return false; // 如果没有选中文本，false
      return true;
    }

    // 主动通信。通过 HTTP POST 发送给本地的 App 程序
    const sendSelectionToApp = () => {
      if (is_debug) console.log('Selected text, send to app:', { selectionText, selectionHtml });

      fetch(APP_SERVER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: selectionText,
          html: selectionHtml
        })
      }).catch(err => {
        // App 可能没打开，忽略
      });
    }

    // 事件 - 选择改变 (暂时不需要，若需要使用最好加防抖)
    // document.addEventListener("selectionchange", () => {
    //   if (updateSelectionInfo()) sendSelectionToApp();
    // });

    // 事件 - 按键状态 flag
    let alt_press_flag = false;
    let ctrl_press_flag = false;
    let shift_press_flag = false;
    let meta_press_flag = false;
    document.addEventListener("keydown", (e) => {
      if (e.key === "Alt") alt_press_flag = true;
      if (e.key === "Control") ctrl_press_flag = true;
      if (e.key === "Shift") shift_press_flag = true;
      if (e.key === "Meta") meta_press_flag = true;
    });

    // 事件 - 键盘方式结束选择
    document.addEventListener("keyup", (e) => {
      if (e.key === "Alt") alt_press_flag = false;
      if (e.key === "Control") ctrl_press_flag = false;
      if (e.key === "Shift") shift_press_flag = false;
      if (e.key === "Meta") meta_press_flag = false;

      // 仅限 Shift/Ctrl/Alt/Meta 组合键
      if (e.key !== "Shift" && e.key !== "Control" && e.key !== "Alt" && e.key !== "Meta") return;

      if (updateSelectionInfo()) sendSelectionToApp();
    });

    // 事件 - 鼠标方式结束选择
    document.addEventListener("mouseup", (e) => {
      // 仅限鼠标左键，且没有按下 Shift/Ctrl/Alt/Meta 组合键
      if (e.button !== 0) return;
      if (alt_press_flag || ctrl_press_flag || shift_press_flag || meta_press_flag) return;

      if (updateSelectionInfo()) sendSelectionToApp();
    });

    console.log("[AnyMenu Bridge] App communication bridge initialized.");
  }

  /*
   * 启用
   * @deprecated 旧版，变化时通知，选择过程中也会通知
   
  function run2() {
    const APP_SERVER_URL = "http://127.0.0.1:41667/selection";

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

        // 【主动通信】通过 HTTP POST 发送给本地的 App 程序
        // console.log('Selected text, send to app:', { selectionText, selectionHtml });
        fetch(APP_SERVER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: selectionText,
            html: selectionHtml
          })
        }).catch(err => {
          // App 可能没打开，忽略
        });

      }, 300); // 300ms 防抖
    });

    console.log("[AnyMenu Bridge] App communication bridge initialized.");
  }
  */
})();
