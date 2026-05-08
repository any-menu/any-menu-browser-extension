# 浏览器扩展与本地App通信

## 浏览器扩展部分

参考 src/bridge.js

## Tauri App 端部分

src-tauri/Cargo.toml

```toml
[dependencies]
tauri = { version = "2.0.0-rc", features = [] } # 或你当前的版本
tokio = { version = "1", features = ["full"] }
axum = "0.7"
tower-http = { version = "0.5", features = ["cors"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

后端, main.rs

```rust
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use axum::{
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tauri::{AppHandle, Manager, Emitter};
use tower_http::cors::{Any, CorsLayer};

#[derive(Debug, Deserialize, Serialize, Clone)]
struct SelectionPayload {
    text: String,
    html: String,
}

// Axum 的 handler，接收来自浏览器扩展的 POST 请求
async fn handle_selection(
    axum::extract::State(app_handle): axum::extract::State<AppHandle>,
    Json(payload): Json<SelectionPayload>,
) -> &'static str {
    // 接收到数据后，通过 Tauri 事件系统将其转发给 Tauri 的前端网页
    // 前端可以通过 listen("browser-selection-changed", ...) 来获取
    let _ = app_handle.emit("browser-selection-changed", payload);
    
    "OK"
}

// 启动本地 HTTP 服务器
async fn start_local_server(app_handle: AppHandle) {
    // 允许任意来源的跨域请求 (CORS)，因为 content script 是注入在各个网页中的
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/selection", post(handle_selection))
        .layer(cors)
        .with_state(app_handle);

    // 绑定本地端口 (需要与 bridge.js 中一致)
    let addr = SocketAddr::from(([127, 0, 0, 1], 14876));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    
    println!("Listening on {}", addr);
    axum::serve(listener, app).await.unwrap();
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();
            
            // 在后台单独的线程/任务中启动 HTTP 服务器，避免阻塞 Tauri 主线程
            tauri::async_runtime::spawn(async move {
                start_local_server(app_handle).await;
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

前端, xx.js

```js
import { listen } from '@tauri-apps/api/event';

// 监听来自 Rust 转发的浏览器扩展事件
listen('browser-selection-changed', (event) => {
  console.log("收到了来自浏览器扩展的选中文本:", event.payload.text);
  console.log("收到了来自浏览器扩展的选中HTML:", event.payload.html);
  
  // 在这里更新你的 Tauri UI 状态
});
```
