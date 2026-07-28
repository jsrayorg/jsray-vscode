# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning follows [SemVer](https://semver.org/).

> This repository tracks **JSRay for VS Code** versions only. [JSRay Core](https://github.com/JSRayCore/JSRay)
> keeps its own version and changelog; the `bundledCore` field in `version.json`
> records which Core snapshot each release ships.

## [Unreleased]

### Fixed
- The custom palette never reached the Markdown preview. It was delivered by wrapping `md.render`, which the editor does not call for previews; it is a markdown-it core rule now. Found by running the suite inside a real VS Code — every node-level test had passed against a hand-made markdown-it stand-in.
- A packaged install reported itself as tampered with: `core-integrity.json` listed the palettes, which `.vscodeignore` excludes, so the manifest described the repository rather than the artifact.
- The Marketplace rejects SVG images in a README, which blocked packaging outright.

### Added
- **Extension-host tests** (`npm run test:editor`): a real VS Code loads the extension and asserts activation, theme application, command registration, and that the editor's own markdown pipeline invokes the palette hook.
- **Core integrity verification.** The extension now has an entry point (`extension.js`) that hashes the bundled runtime, stylesheet, palettes, and vocabulary against the digests JSRay Core published, warning on activation when they no longer match. **JSRay: Verify Bundled Core** reports on demand.
- **`jsray.customPalette`.** A Theme Studio palette restyles the Markdown preview, injected through the markdown-it hook so the preview follows the setting live. Only hex colors are accepted and keys are validated against the bundled vocabulary, so a palette cannot inject CSS.

### Changed
- Bundled Core snapshot advanced to **0.0.1-beta.1** (Core's first public beta); all eight themes regenerated from the updated palettes.
- Repository documentation aligned with Core: CHANGELOG, CONTRIBUTING, SECURITY, and Code of Conduct now match the ecosystem baseline, and the README carries the shared brand header and a Simplified Chinese translation.
- Manifest gained the Marketplace fields a public listing needs: `repository`, `bugs`, `qna`, and a `galleryBanner` matching the brand's dark base.

## [0.0.1-internal.2] — 2026-07-17

### Status
- Internal test build; not a public beta. Not yet published to the Marketplace.

### Added
- Marketplace icon (256px, from the final gradient mark).
- CI workflow with a Node matrix and a theme-regeneration determinism gate, so generated themes can never drift from their palette sources.

### Changed
- Core snapshots through 0.0.1-internal.2: grammar ordering fixes, `JSRay.version`, tokenizer caching, and the token fallback chain — a refined key such as `function.declaration` now resolves through its base when a palette does not define it.
- Core drift check is advisory day-to-day and strict at the packaging gate.
- Official project emails adopted; CI `GITHUB_TOKEN` pinned to read-only.

## [0.0.1-internal.1] — 2026-07-06

### Status
- Internal test build; not a public beta.

### Added
- Eight editor color themes — Default, Aurora, Ember, and Fjord in dark and light — generated from the Core palette JSON, carrying the six-family identifier separation into the editor through semantic tokens.
- JSRay-powered Markdown preview: fenced blocks are re-rendered by the bundled Core, unmarked blocks go through `JSRay.detectLanguage()`, and the preview follows the editor's light/dark UI.
- `tools/build-themes.mjs` (palettes → themes), `tools/sync-core.sh`, and `tools/check-versions.mjs` with contribution-integrity checks.
