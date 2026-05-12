# 开发备注 (For Developer)

常用命令/备注:

## 使用

### 上架浏览器的扩展商店

详见对应平台 (Chrome / Edge / Firefox 等) 的文档

### 让用户通过扩展文件直接安装

未上架的情况下可以使用该方式安装

(但用户可能会对此产生担忧，害怕风险，此处仅供参考)

(*by GPT 5.4*)

Chrome 和 Firefox 的限制不一样

- Chrome / Edge（Chromium 系）
  - 普通用户想“直接安装”你打包好的扩展，基本不能靠一个 zip 让用户双击安装。
  - 非商店分发通常只有几种路：
    - 开发者模式手动加载解压目录（详见开发者方式，排除）
    - 企业/组织策略强制安装
    - 自建更新源 + .crx，但现代 Chrome 对个人分发限制很多，普通用户场景通常不实用
  - 所以对大众用户来说，**不上 Chrome Web Store 几乎没有顺滑安装方案**。

- Firefox
  - 比 Chrome 宽松一些，但也分情况：
    - 临时加载（详见开发者方式，排除）
    - 已签名扩展的 XPI 文件，用户可以下载安装
    - 未签名扩展通常只有开发版 / ESR 某些受控环境才可行，普通稳定版 Firefox 不适合
  - 所以 Firefox 想给普通用户安装，现实可行方案通常是：把扩展打包成 .xpi 并经过 Mozilla 签名，然后自行分发，不一定非要上 AMO 公开商店展示。

## 使用 (开发者方式)

### 利用 web-ext run

使用 `web-ext` 工具，运行 `web-ext run` 即可

### package.json 再简化 web-ext

我也将该方式封装成了一下 (方便未接触该工具者使用):

```json
"start": "web-ext run",       // 在 Firefox 中启动扩展进行测试
"lint": "web-ext lint",       // 检查扩展代码和 manifest.json 中的错误
"build": "web-ext build"      // 打包扩展为 .zip 文件，用于发布
```

### Firefox 调试页

url: `about:debugging`
此 Firefox -> 临时加载附加组建，然后选中 `manifest.json` 即可

首次使用是如此的，但后续只要点击一下 "重载" 按钮即可自动更新

## [打包](https://extensionworkshop.com/documentation/publish/package-your-extension/):

### 直接压缩

直接压缩即可。

> [!warning]
> 注意: ZIP 文件必须是扩展文件本身的 ZIP，而不是包含这些文件的目录。

压缩内容通常包括: `manifest.json, icons/, 相关的js文件`。

### web-ext

你也可以选择使用 [web-ext build](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-build) 工具，会自动排除不需要的文件。
安装好后直接运行 `web-ext run` 即可

### package.json 再简化 web-ext

我用 package.json 封装了一下 (方便未接触该工具者使用):

```json
"start": "web-ext run",       // 在 Firefox 中启动扩展进行测试
"lint": "web-ext lint",       // 检查扩展代码和 manifest.json 中的错误
"build": "web-ext build"      // 打包扩展为 .zip 文件，用于发布
```

所以你还可以执行这些命令

### 工作流

这里还添加了 github 工作流来自动打包和发布

(目前仅自动发布在 Github Release，关于发布到浏览器扩展的工作流还未完成)

## Manifest V3 和 V2 问题

V3 的兼容性与老浏览器支持：

- 不兼容旧浏览器：Manifest V3 不支持较老的浏览器。
  具体来说，Chrome 88 以下、Edge 88 以下、Firefox 109 以下、Safari 15.4 以下的版本都无法安装 V3 扩展。
- 现代浏览器强制要求：虽然不支持老浏览器，但这是必经之路。
  Chrome 和 Edge 已经彻底弃用 Manifest V2（2024年下半年开始强制下架/禁用 V2 扩展）。
  Firefox 虽然还在维护 V2，但也已全面转向 V3。因此，坚持使用 V3 是唯一正确的选择。

## 调试

不同类型的脚本的调试方法不同

- 内容脚本: 每个网页都会加载，其日志输出就在控制台中
- 选项页脚本: 进入选项设置页后才会加载，其日志也会输出到此页的控制台
- 后台脚本: 这个的日志输出不会出现在常规网页中，需要另行调试，详见下文

其中对于后台脚本的输出:

(1) 在 Chrome / Edge 中

- 在地址栏输入 chrome://extensions/（Edge 是 edge://extensions/）并回车。
- 确保右上角的 “开发者模式” (Developer mode) 是开启状态。
- 找到你的扩展卡片，你会看到一行字：“检查视图：Service Worker” (Inspect views: service worker)。
- 点击这蓝色的 service worker 字样，就会弹出一个全新的独立 F12 开发者工具窗口。
- 在这个新窗口的 Console 面板里，你就能看到 background.js 中打印的所有 console.log 了

(2) 在 Firefox 中

- 在地址栏输入 about:debugging 并回车。
- 点击左侧的 “此 Firefox” (This Firefox)。
- 找到你的扩展，点击旁边的 “检查” (Inspect) 按钮。
- 这会打开一个开发者工具窗口，切换到 控制台 (Console) 标签页，这里就是后台脚���的输出位置。
