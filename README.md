<p align="center">
  <!-- PNG rather than SVG: the Marketplace rejects SVG in a README. One image
       rather than a picture pair, because the viewer ignores
       prefers-color-scheme and serves the fallback anyway, and that fallback
       was the lockup with a white plate baked into it. This hero is
       transparent. No blank line inside this comment: a blank line ends the
       HTML block, the rest of it becomes a code fence, and the comment never
       closes. -->
  <img src="https://jsray.org/assets/brand/jsray-logo-hero-dark.png" alt="JSRay" width="380">
</p>

**English** · [简体中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.0.1--beta-blue)](CHANGELOG.md)
[![Channel](https://img.shields.io/badge/channel-public%20beta-blue)](CHANGELOG.md)
[![Core](https://img.shields.io/badge/JSRay%20Core-0.0.2--beta.1-success)](https://github.com/JSRayCore/JSRay)
[![VS Code](https://img.shields.io/badge/VS%20Code-%E2%89%A5%201.75-007acc)](package.json)

> JSRay code rendering for VS Code · 8 color themes · JSRay-powered Markdown preview

<sub>Public beta · not yet on the Marketplace · bundles a digest-verified JSRay Core snapshot</sub>

---

This repository is the standalone **VS Code extension** project around [JSRay Core](https://github.com/JSRayCore/JSRay) — an official open-source integration in the JSRay ecosystem, with its own version and release notes.

It **bundles a snapshot** of Core rather than depending on it at runtime, so the extension keeps working exactly as shipped until a sync deliberately advances it.

## What it does

**1. Eight editor color themes** — every JSRay palette (Default, Aurora, Ember, Fjord) in dark and light variants, generated from the palette JSON. The nine-family identifier separation lands in the editor through semantic tokens: parameters italic warm-amber, function declarations bold and brighter than calls, runtime builtins bold cool-blue, constants muted gold.

**2. JSRay-powered Markdown preview** — fenced code blocks in the built-in Markdown preview are re-rendered by JSRay Core itself (`media/jsray.js` runs inside the preview). Unmarked blocks go through `JSRay.detectLanguage()`, and the preview follows the editor's light/dark UI automatically.

## Install

From the repository root:

```sh
npx @vscode/vsce package   # requires a plain semver version at publish time
code --install-extension jsray-vscode-*.vsix
```

Or for development: open this folder in VS Code and press `F5` (Extension Development Host).

Then pick a theme via **Preferences: Color Theme** → `JSRay …`, and open any Markdown preview to see JSRay rendering.

## Project layout

```
jsray-vscode/
├── package.json        ← extension manifest (themes + markdown contributions)
├── themes/             ← generated VS Code color themes (8) — do not edit
├── palettes/           ← palette JSON synced from Core — do not edit
├── media/              ← Core runtime snapshot + preview adapter
│   ├── jsray.js / jsray.css / themes/default.css   (synced from Core dist/)
│   ├── preview-adapter.js
│   └── markdown-preview.css
├── tools/
│   ├── sync-core.sh          ← pull Core dist + palettes, regenerate themes
│   ├── build-themes.mjs      ← palettes/*.json → themes/*.json
│   └── check-versions.mjs    ← metadata + bundle drift + contribution integrity
└── tests/              ← node --test suites (generator, manifest, adapter)
```

## Sync Core

After changing the Core project, rebuild Core `dist/` (run `sh build.sh` there), then:

```sh
npm run sync:core      # expects Core at ../jsray, or set JSRAY_CORE_DIR
```

This refreshes `media/`, `palettes/`, regenerates all themes, and updates `bundledCore.version`. `npm run check:versions` fails if the bundle drifts from a sibling Core checkout.

## Core integrity

The extension bundles a snapshot of JSRay Core, so the file that renders code
inside the Markdown preview lives in your extensions folder — writable by
anything running on the machine. `core-integrity.json` pins the digests Core
published for this snapshot, and the extension hashes them on activation.

- A mismatch raises an error notification naming the affected files.
- **JSRay: Verify Bundled Core** in the Command Palette reports on demand.

## Custom colors

`jsray.customPalette` in settings takes the JSON the
[Theme Studio](https://jsray.org/studio.html) exports — the same palette file
the WordPress plugin and the terminal CLI accept:

```json
"jsray.customPalette": {
  "themes": { "dark": { "tokens": {
    "keyword": { "color": "#FF6B9D", "fontStyle": "bold italic" }
  } } }
}
```

It restyles the **Markdown preview**, and the preview refreshes as you edit the
setting. Keys are validated against the bundled `vocabulary.json`; only hex
colors are accepted, and tokens from a newer Core are ignored rather than
rejected.

To recolor **the editor itself**, pick one of the eight bundled JSRay themes and
layer VS Code's own `editor.tokenColorCustomizations` on top — that is the
mechanism VS Code gives themes, and going around it would fight the editor.

## Renderer boundary

The Markdown preview uses JSRay Core by default. The adapter only depends on the ecosystem renderer shape (`highlightElement`, `detectLanguage`), so a host fork can swap `media/jsray.js` for another renderer that implements it.

## Develop

```sh
npm test               # generator + manifest + adapter suites
npm run build          # regenerate themes from palettes
npm run check:versions
```
