/** 后台脚本 */

// 缓存全局信息
const option = {
  is_debug: false,
  is_bridge: true,
  app_port: "41667",
}

/** 监听内容脚本消息 */
chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
  if (request.action === "SEND_TO_APP") { // 只会捕获同一浏览器扩展的内容脚本发出的信息
    option = request.option;
    const app_server_url = `http://127.0.0.1:${option.app_port}/`;
    
    if (option.is_debug) {
      console.log('Received selection from content script:', request.payload);
    }

    // 后台脚本负责发起网络请求
    fetch(`${app_server_url}selection`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.payload)
    }).catch(err => {
      if (option.is_debug) console.log("Failed to send to app. Is it running?", err);
    });
  }
});

/** 初始化并建立 WebSocket 连接 */
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
// TODO
//   用户使用时，有可能先打开浏览器，后启动 AnyMenu 程序
//   或者用户有可能中途重启 AnyMenu 程序，需要添加断开重连逻辑
// connectToApp(); // 启动时自动连接
