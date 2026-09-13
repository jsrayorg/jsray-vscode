# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning follows [SemVer](https://semver.org/).

> This repository tracks **JSRay for VS Code** versions only. [JSRay Core](https://github.com/jsrayorg/jsray)
> keeps its own version and changelog; the `bundledCore` field in `version.json`
> records which Core snapshot each release ships.

## [Unreleased]

## [0.0.2-beta] — 2026-09-13

Bundles JSRay Core 0.0.2-beta.5, the last beta of Core's 0.0.2 line. Still a
`.vsix` attached to the GitHub release: the Marketplace rejects a prerelease
suffix, and listing waits for `0.1.0`.

### Changed
- **Bundled Core is 0.0.2-beta.5**, up from 0.0.2-beta.1 — which is what
  0.0.1-beta shipped, although its entry below says 0.0.1-beta.4. In the
  Markdown preview:
  - A comment holding two quotes stays one comment, and a string holding `//`,
    `#` or `/* */` stays one string, in every grammar. 27 grammars used to cut
    a comment such as `// don't stop, won't stop` at its first apostrophe.
  - Heredocs in PHP, shell and Ruby, Ruby's `%w[]` family, Perl's `q{}` family
    and Elixir sigils render as literals instead of as code.
  - A JavaScript template nested inside a placeholder no longer ends the outer
    one early, and private class members such as `#count` are coloured.
- **Core drift is reported, not failed on.** CI warns while the bundled Core is
  behind the published one and stays green; the strict check lives in
  `npm run test:packaged`, because an integration syncs Core when it releases,
  not when Core does.
- The sync workflow retires what a newer Core makes obsolete — its own issues
  and `core/*` branches — instead of leaving one of each per Core release.
- The publishing decision is written where the old plan was: the version is not
  stripped of its suffix at publish time, because a Marketplace `0.0.1` that
  appears nowhere in this repository cannot be traced back to a commit.
- Install points at the `.vsix` on the release page, and every link names the
  `jsrayorg` organisation.

### Fixed
- Commit subjects are checked here and on pull requests, not only in Core and
  not only by the local hook.

## [0.0.1-beta] — 2026-08-01

First public beta. The extension bundles a JSRay Core snapshot because a vsix
has to work offline, and verifies that snapshot against the digests Core
published.

### Added
- **Extension-host tests** (`npm run test:editor`): a real VS Code loads the extension and asserts activation, theme application, command registration, and that the editor's own Markdown pipeline invokes the palette hook.
- **Core integrity verification.** `extension.js` hashes the bundled runtime, stylesheet, palettes and vocabulary against Core's published digests, warning on activation when they no longer match. **JSRay: Verify Bundled Core** reports on demand.
- **`jsray.customPalette`.** A Theme Studio palette restyles the Markdown preview through the markdown-it hook, so the preview follows the setting live. Only hex colors are accepted and keys are validated against the bundled vocabulary — a palette cannot inject CSS.

### Fixed
- The custom palette never reached the Markdown preview. It was delivered by wrapping `md.render`, which the editor does not call for previews; it is a markdown-it core rule now. Found only by running the suite inside a real VS Code — every node-level test had passed against a hand-made markdown-it stand-in shaped like the assumption being tested.
- A packaged install reported itself as tampered with: `core-integrity.json` listed the palettes, which `.vscodeignore` excludes, so the manifest described the repository rather than the artifact.
- The Marketplace rejects SVG images in a README, which blocked packaging outright.

### Changed
- Bundled Core is **0.0.1-beta.4**, which fixes a denial of service present in every earlier snapshot: an unterminated interpolating string sent four grammars into exponential backtracking. The Markdown preview renders on the extension host, so a half-written fenced block was enough to reach it. All eight themes regenerate from the palette sources that snapshot publishes.
- CI fails when the bundled Core is behind the published Core, and a scheduled workflow opens a sync pull request when Core moves. The previous drift check compared against a sibling checkout and skipped silently when Core was absent — every CI run.
- Manifest gained the Marketplace fields a public listing needs: `repository`, `bugs`, `qna`, and a `galleryBanner` matching the brand's dark base.
- Repository documentation matches the ecosystem baseline, with the shared brand header and a Simplified Chinese README.

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
