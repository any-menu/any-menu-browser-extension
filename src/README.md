## 目录说明

- src/
  - options/    | 配置页。或弹窗。只有在用户点击扩展图标或打开设置时才会临时加载
  - content/    | 内容脚本。注入到每个网页中运行。如果你打开了 10 个网页，就会有 10 个独立的内容脚本实例
  - background/ | 后台脚本。Background Script / Service Worker（后台脚本/服务工作线程），整个浏览器中只存在一个实例

```json
{
  // 配置页
  "options_ui": {
    "page": "src/options/options.html",
    "open_in_tab": false
  },

  // 后台脚本
  "background": {
    "service_worker": "src/background/background.js",  // Chrome 和 Firefox 121+
    "scripts": ["src/background/background.js"]        // 兼容Firefox 109 - 120 使用非持久的后台脚本
  },

  // 内容脚本
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/debug.js", "src/content/bridge.js", "src/content/main.js"]
    }
  ]
}
```
