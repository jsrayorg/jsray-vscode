<p align="center">
  <!-- PNG rather than SVG: the VS Code Marketplace rejects SVG images in a
       README, and this file is what the listing renders. -->
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://jsray.org/assets/brand/jsray-logo-dark.png">
    <img src="https://jsray.org/assets/brand/jsray-logo-light.png" alt="JSRay" width="420">
  </picture>
</p>

[English](README.md) · **简体中文**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.0.1--beta.1-lightgrey)](CHANGELOG.md)
[![Channel](https://img.shields.io/badge/channel-beta-blue)](CHANGELOG.md)
[![Core](https://img.shields.io/badge/JSRay%20Core-0.0.1--beta.1-success)](https://github.com/JSRayCore/JSRay)
[![VS Code](https://img.shields.io/badge/VS%20Code-%E2%89%A5%201.75-007acc)](package.json)

> 面向 VS Code 的 JSRay 代码渲染 · 8 款配色主题 · 由 JSRay 驱动的 Markdown 预览

<sub>内部测试版 · 尚未上架 Marketplace · 内置 JSRay Core 快照</sub>

---

当前仓库是围绕 [JSRay Core](https://github.com/JSRayCore/JSRay) 的独立 **VS Code 扩展**项目——JSRay 生态中的官方开源集成,拥有自己的版本号与更新日志。

它**内置 Core 的快照**,而不是在运行时依赖 Core。因此在你主动执行同步之前,扩展的行为与发布当天完全一致。

## 功能

**1. 八款编辑器配色主题**——JSRay 的四款调色板(Default、Aurora、Ember、Fjord)各含 dark 与 light 两个变体,全部由调色板 JSON 生成。九族标识符分离通过语义 token 落到编辑器里:参数是斜体暖琥珀,函数声明比调用更亮且加粗,运行时内置变量是加粗冷蓝,常量是哑金。

**2. 由 JSRay 驱动的 Markdown 预览**——内置 Markdown 预览中的围栏代码块由 JSRay Core 本体重新渲染(`media/jsray.js` 在预览页内运行)。没有标注语言的代码块会走 `JSRay.detectLanguage()`,预览还会自动跟随编辑器的明暗界面主题。

## 安装

在仓库根目录执行:

```sh
npx @vscode/vsce package   # 正式发布时版本号必须是纯 semver
code --install-extension jsray-vscode-*.vsix
```

开发方式:用 VS Code 打开本目录并按 `F5`(扩展开发宿主窗口)。

然后通过 **首选项: 颜色主题** 选择 `JSRay …`,打开任意 Markdown 预览即可看到 JSRay 渲染效果。

## 项目结构

```
jsray-vscode/
├── package.json        ← 扩展清单(themes + markdown 贡献点)
├── themes/             ← 生成的 VS Code 配色主题(8 个)—— 请勿手改
├── palettes/           ← 从 Core 同步的调色板 JSON —— 请勿手改
├── media/              ← Core 运行时快照 + 预览适配器
│   ├── jsray.js / jsray.css / themes/default.css   (从 Core dist/ 同步)
│   ├── preview-adapter.js
│   └── markdown-preview.css
├── tools/
│   ├── sync-core.sh          ← 拉取 Core dist 与调色板,并重建主题
│   ├── build-themes.mjs      ← palettes/*.json → themes/*.json
│   └── check-versions.mjs    ← 元数据 + 快照漂移 + 贡献点完整性校验
└── tests/              ← node --test 测试(生成器、清单、适配器)
```

## 同步 Core

修改 Core 项目后,先在 Core 中重建 `dist/`(执行 `sh build.sh`),然后:

```sh
npm run sync:core      # 默认在 ../jsray 寻找 Core,也可设置 JSRAY_CORE_DIR
```

该命令会刷新 `media/` 与 `palettes/`,重新生成全部主题,并更新 `bundledCore.version`。只要同级存在 Core 检出,`npm run check:versions` 就会在快照漂移时报错。

## 内核完整性校验

扩展内置 JSRay Core 的快照,因此真正在 Markdown 预览里渲染代码的那个文件就放在扩展目录下 —— 机器上任何进程都可能写它。`core-integrity.json` 钉住了 Core 为该快照发布的摘要,扩展在激活时逐个哈希校验。

- 不匹配会弹出错误通知,并列出具体文件。
- 命令面板里的 **JSRay: Verify Bundled Core** 可随时手动校验。

## 自定义配色

设置项 `jsray.customPalette` 接受[主题工作台](https://jsray.org/studio.html)导出的 JSON —— 与 WordPress 插件、终端 CLI 完全相同的调色板文件:

```json
"jsray.customPalette": {
  "themes": { "dark": { "tokens": {
    "keyword": { "color": "#FF6B9D", "fontStyle": "bold italic" }
  } } }
}
```

它作用于 **Markdown 预览**,改设置时预览会自动刷新。键名按内置的 `vocabulary.json` 校验,只接受十六进制颜色;来自更新版 Core 的 token 会被忽略而非拒绝。

要给**编辑器本身**换色,请选用内置的 8 款 JSRay 主题,再叠加 VS Code 原生的 `editor.tokenColorCustomizations` —— 那是 VS Code 为主题提供的机制,绕过它只会和编辑器打架。

## 渲染器边界

Markdown 预览默认使用 JSRay Core。适配器只依赖生态约定的渲染器形状(`highlightElement`、`detectLanguage`),因此宿主分支可以把 `media/jsray.js` 换成任意实现了该形状的渲染器。

## 开发

```sh
npm test               # 生成器 + 清单 + 适配器测试
npm run build          # 由调色板重新生成主题
npm run check:versions
```
