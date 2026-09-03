// Extension manifest integrity: every contributed path must exist on disk
// and stay in step with the palettes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));

test('manifest declares a VS Code engine and both contribution surfaces', () => {
  assert.match(pkg.engines.vscode, /^\^?\d/);
  assert.ok(pkg.contributes.themes.length > 0);
  assert.ok(pkg.contributes['markdown.previewScripts'].length > 0);
  assert.ok(pkg.contributes['markdown.previewStyles'].length > 0);
});

test('every contributed file exists on disk', () => {
  const paths = [
    ...pkg.contributes.themes.map((t) => t.path),
    ...pkg.contributes['markdown.previewStyles'],
    ...pkg.contributes['markdown.previewScripts'],
  ];
  for (const rel of paths) {
    assert.ok(existsSync(resolve(ROOT, rel)), `missing contributed file: ${rel}`);
  }
});

test('contributed themes cover every palette in both modes, with correct uiTheme', () => {
  const paletteIds = readdirSync(resolve(ROOT, 'palettes'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
  assert.equal(pkg.contributes.themes.length, paletteIds.length * 2);

  for (const id of paletteIds) {
    for (const mode of ['dark', 'light']) {
      const path = `./themes/jsray-${id}-${mode}-color-theme.json`;
      const entry = pkg.contributes.themes.find((t) => t.path === path);
      assert.ok(entry, `manifest missing theme entry for ${path}`);
      assert.equal(entry.uiTheme, mode === 'dark' ? 'vs-dark' : 'vs', `${path} uiTheme`);
    }
  }
});

test('markdown preview loads core runtime before the adapter', () => {
  const scripts = pkg.contributes['markdown.previewScripts'];
  const core = scripts.findIndex((s) => s.includes('jsray.js'));
  const adapter = scripts.findIndex((s) => s.includes('preview-adapter'));
  assert.ok(core !== -1 && adapter !== -1 && core < adapter,
    'jsray.js must load before preview-adapter.js');
});

test('the READMEs render as HTML rather than swallowing themselves', () => {
  // A blank line inside an HTML comment ends the HTML block. The remainder
  // becomes an indented code fence, the comment never closes, and the browser
  // eats the rest of the document — the extension's DETAILS tab came up empty
  // with the file itself perfectly intact on disk, which is the sort of thing
  // that costs an afternoon.
  for (const doc of ['README.md', 'README.zh-CN.md']) {
    const text = readFileSync(resolve(ROOT, doc), 'utf8');

    for (const comment of text.match(/<!--[\s\S]*?-->/g) || []) {
      assert.doesNotMatch(
        comment,
        /\n[ \t]*\n/,
        `${doc} has a comment with a blank line in it, which ends the HTML block early`
      );
      assert.doesNotMatch(
        comment.slice(4, -3),
        /<!--|-->/,
        `${doc} has a comment quoting a comment marker, which does not nest`
      );
    }

    // Every comment that opens has to close.
    assert.equal(
      (text.match(/<!--/g) || []).length,
      (text.match(/-->/g) || []).length,
      `${doc} has an unbalanced HTML comment`
    );
  }
});
