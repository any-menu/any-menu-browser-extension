/**
 * AnyMenu Helper Tauri Bridge
 * 负责主动/被动将页面数据（如选区）传递给 Tauri 应用程序
 * 
 * - 监听选择完毕事件，主动发送实践给 Tauri 后端
 * - 监听选取变化，主动发送事件给 Tauri 后端
 * - 被动暴露全局 API，供 Tauri 后端通过 execute_script 主动调用获取
 */

const option = {
  is_debug: false,
  is_bridge: true,
  app_port: "41667",
}

;(() => {
  // 是否注入/启用
  {
    if (window.__AnyMenuHelperBridgeInjected) return; // 避免重复注入

    if (typeof chrome !== 'undefined' && chrome.storage) { // 设置中是否启用
      chrome.storage.sync.get({
        is_debug: false,
        is_bridge: true,
        app_port: "41667",
      }, (res) => {
        option.is_debug = res.is_debug;
        option.is_bridge = res.is_bridge;
        option.app_port = res.app_port;
        if (res.is_bridge) run();
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
  function run() {
    const app_server_url = `http://127.0.0.1:${option.app_port}/`;
    let app_websocket = null;

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
      // 结构和规范详见:
      //   AnyMenu 的 src/Tauri/src-tauri/src/http_server.rs 中的定义
      // 
      // TODO 此处应该增加双向通信功能。
      //   当然，非双向能更好地方便多种不同类型的来源使用同一端口号通知 AnyMenu。
      //   改双向通信的话 AnyMenu 那应该弄两个端口分别与浏览器和 Obsidian 进行 websocket 通信。
      //   还有一种方案: 通过固定的端口去沟通一个临时端口用于通信 (将选用)
      const payload = {
        source: 'BROWSER_EXTENSION',
        text: selectionText,
        html: selectionHtml,
      }
      if (option.is_debug) console.log('Selected text, send to app:', payload);

      fetch(`${app_server_url}selection`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
      }).catch(err => {
        // App 可能没打开，忽略
      });
    }

    // TODO 这里的代码逻辑应该在 Background Script / Service Worker（后台脚本/服务工作线程）
    //   而非在 Content Scripts（内容脚本）
    //   不要让多个网页都与本地应用建立联系
    // 初始化并建立 WebSocket 连接
    const connectToApp = async () => {
      try {
        // 1. 向固定端口请求分配一个新的 WebSocket 临时通信端口
        const res = await fetch(`${app_server_url}new_websocket`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const wsPort = await res.json();
        if (option.is_debug) console.log("Negotiated WebSocket port:", wsPort);

        // 2. 使用返回的端口建立 WebSocket 连接
        app_websocket = new WebSocket(`ws://127.0.0.1:${wsPort}/`);

        // 3. 监听连接建立事件 (客户端主动发消息)
        app_websocket.onopen = () => {
          if (option.is_debug) console.log("WebSocket connected to AnyMenu app!");
          
          // 连接建立后，客户端主动向服务端发送一条验证消息
          app_websocket.send("Hello from Browser Extension!");
        };

        // 4. 监听服务端发来的消息
        app_websocket.onmessage = (event) => {
          if (option.is_debug) console.log("Received message from app:", event.data);
        };

        app_websocket.onclose = () => {
          if (option.is_debug) console.log("WebSocket connection closed.");
          app_websocket = null;
          // 可选：在这里添加断线重连逻辑
          // setTimeout(connectToApp, 5000); 
        };

        app_websocket.onerror = (err) => {
          if (option.is_debug) console.error("WebSocket error:", err);
        };

      } catch (err) {
        if (option.is_debug) console.log("App may not be running. Failed to setup WebSocket:", err);
      }
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

    if (option.is_debug) console.log("[AnyMenu Bridge] App communication bridge initialized.");
  }
})();
