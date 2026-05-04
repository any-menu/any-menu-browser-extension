# 开发备注 (For Developer)

常用命令/备注:

## Firefox 调试页

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
