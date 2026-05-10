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
      // TODO 增加通信规范，AnyMenu 那边应该设计并编写一个 RPC 接口规范
      //   该规范应增强通用性。允许浏览器扩展、Obsidian插件、AI Agent、自动化脚本等多种控制途径
      // TODO 此处应该增加双向通信功能。
      //   当然，非双向能更好地方便多种不同类型的来源使用同一端口号通知 AnyMenu。
      //   改双向通信的话 AnyMenu 那应该弄两个端口分别与浏览器和 Obsidian 进行 websocket 通信
      const payload = {
        source: 'BROWSER_EXTENSION',
        text: selectionText,
        html: selectionHtml,
      }
      if (is_debug) console.log('Selected text, send to app:', payload);

      fetch(APP_SERVER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
      }).catch(err => {
        // App 可能没打开，忽略
      });
    }

    // --------------- 实践 ---------------

    // TODO 当选区从有清空时，需要触发清空事件，通知 App

    // 事件1 - 选择改变 (带防抖) (暂时不需要)
    // document.addEventListener("selectionchange", () => {
    //   clearTimeout(timeout);
    //   timeout = setTimeout(() => {
    //     if (updateSelectionInfo()) sendSelectionToApp();
    //   }, 300);
    // });

    // 事件2 - 按键状态 flag
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

    // 事件3 - 键盘方式结束选择
    document.addEventListener("keyup", (e) => {
      if (e.key === "Alt") alt_press_flag = false;
      if (e.key === "Control") ctrl_press_flag = false;
      if (e.key === "Shift") shift_press_flag = false;
      if (e.key === "Meta") meta_press_flag = false;

      // 仅限 Shift/Ctrl/Alt/Meta 组合键
      if (e.key !== "Shift" && e.key !== "Control" && e.key !== "Alt" && e.key !== "Meta") return;

      if (updateSelectionInfo()) sendSelectionToApp();
    });

    // 事件4 - 鼠标方式结束选择
    document.addEventListener("mouseup", (e) => {
      // 仅限鼠标左键，且没有按下 Shift/Ctrl/Alt/Meta 组合键
      if (e.button !== 0) return;
      if (alt_press_flag || ctrl_press_flag || shift_press_flag || meta_press_flag) return;

      if (updateSelectionInfo()) sendSelectionToApp();
    });

    // 事件5 - 鼠标双击方式结束选择
    // document.addEventListener("dblclick", (e) => {})

    console.log("[AnyMenu Bridge] App communication bridge initialized.");
  }
})();
