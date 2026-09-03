// Theme generation correctness: run the generator, then verify the output
// against the palette sources.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

execFileSync('node', [resolve(ROOT, 'tools/build-themes.mjs')], { cwd: ROOT });

const paletteIds = readdirSync(resolve(ROOT, 'palettes'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

test('every palette produces a valid dark + light VS Code theme', () => {
  assert.ok(paletteIds.length >= 4, `expected ≥4 palettes, got ${paletteIds.length}`);
  for (const id of paletteIds) {
    const palette = JSON.parse(read(`palettes/${id}.json`));
    for (const mode of ['dark', 'light']) {
      const theme = JSON.parse(read(`themes/jsray-${id}-${mode}-color-theme.json`));
      assert.equal(theme.type, mode);
      assert.equal(theme.semanticHighlighting, true);
      assert.equal(theme.colors['editor.background'], palette.themes[mode].background);
      assert.equal(theme.colors['editor.foreground'], palette.themes[mode].foreground);
      assert.ok(Array.isArray(theme.tokenColors) && theme.tokenColors.length >= 20);
      assert.ok(Object.keys(theme.semanticTokenColors).length >= 20);
    }
  }
});

test('workbench colors never contain rgba() — hex8 conversion applied', () => {
  for (const id of paletteIds) {
    for (const mode of ['dark', 'light']) {
      const theme = JSON.parse(read(`themes/jsray-${id}-${mode}-color-theme.json`));
      for (const [key, value] of Object.entries(theme.colors)) {
        assert.match(value, /^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/, `${id} ${mode} ${key}: ${value}`);
      }
    }
  }
});

test('six-family separation survives the mapping (default dark)', () => {
  const palette = JSON.parse(read('palettes/default.json'));
  const theme = JSON.parse(read('themes/jsray-default-dark-color-theme.json'));
  const sem = theme.semanticTokenColors;
  const tok = palette.themes.dark.tokens;

  // declaration is a distinct, bold color vs plain function calls
  assert.equal(sem['function.declaration'].foreground, tok['function.declaration'].color);
  assert.equal(sem['function.declaration'].bold, true);
  assert.equal(sem['function'].foreground, tok['function'].color);
  assert.notEqual(sem['function.declaration'].foreground, sem['function'].foreground);

  // parameters italic amber, runtime builtins bold
  assert.equal(sem['parameter'].foreground, tok['variable.parameter'].color);
  assert.equal(sem['parameter'].italic, true);
  assert.equal(sem['variable.defaultLibrary'].bold, true);
  assert.equal(sem['variable.readonly'].foreground, tok['variable.constant'].color);

  // TextMate side carries keyword bold + parameter italic too
  const kwRule = theme.tokenColors.find((r) => r.name === 'JSRay · keyword');
  assert.equal(kwRule.settings.fontStyle, 'bold');
  const paramRule = theme.tokenColors.find((r) => r.name === 'JSRay · variable.parameter');
  assert.equal(paramRule.settings.fontStyle, 'italic');
});

test('a theme colours the editor and the workbench around it', () => {
  // Eight entries, all of them editor.*, was the whole of it — everything
  // else fell back to VS Code's defaults for the ui theme, and the default
  // light activity bar is dark. A JSRay Light theme gave a white editor
  // beside a black sidebar, which is the sort of thing only a person looking
  // at it notices.
  const surfaces = [
    'activityBar.background',
    'sideBar.background',
    'statusBar.background',
    'titleBar.activeBackground',
    'editorGroupHeader.tabsBackground',
  ];

  for (const file of readdirSync(resolve(ROOT, 'themes')).filter((f) => f.endsWith('.json'))) {
    const theme = JSON.parse(read(`themes/${file}`));

    for (const key of surfaces) {
      assert.ok(theme.colors[key], `${file} leaves ${key} to the editor's default`);
    }

    // And the surfaces have to belong to the same side of the palette as the
    // editor, or the fallback is simply replaced by a mismatch of our own.
    const luminance = (hex) => {
      const parts = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
      return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
    };

    const editor = luminance(theme.colors['editor.background']);
    for (const key of surfaces) {
      const surface = luminance(theme.colors[key]);
      assert.ok(
        Math.abs(surface - editor) < 0.25,
        `${file}: ${key} is ${surface.toFixed(2)} against an editor at ${editor.toFixed(2)}`
      );
    }
  }
});
