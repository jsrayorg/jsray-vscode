// Extension entry point: core verification and custom-palette validation.
// These are the two pieces of real code in the extension; the themes and the
// preview are contribution points. `require('vscode')` is deferred to
// activate(), so everything here runs under plain node.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { verifyCore, validatePalette, paletteCss } = require('../extension.js');
const vocabulary = JSON.parse(readFileSync(resolve(ROOT, 'vocabulary.json'), 'utf8'));

/**
 * Build a throwaway copy of the files core-integrity.json covers.
 *
 * Tampering with the tracked runtime works until a run is interrupted, and then
 * the repository is left holding a corrupted engine. Verifying against a copy
 * keeps the test honest and the working tree clean — and lets the suite run
 * files in parallel without two of them fighting over the same bytes.
 */
function tempExtensionRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'jsray-ext-'));
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'core-integrity.json'), 'utf8'));
  writeFileSync(join(dir, 'core-integrity.json'), JSON.stringify(manifest));
  copyFileSync(resolve(ROOT, 'vocabulary.json'), join(dir, 'vocabulary.json'));
  for (const file of Object.keys(manifest.files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    copyFileSync(resolve(ROOT, file), join(dir, file));
  }
  return dir;
}


test('the bundled Core verifies against its official digests', () => {
  const report = verifyCore(ROOT);
  assert.equal(report.status, 'official', `mismatched: ${report.mismatched.join(', ')}`);
  assert.ok(report.checked >= 4, 'the runtime, its stylesheet, and the vocabulary must be covered');
});

test('every file the manifest verifies is actually shipped in the .vsix', () => {
  // A manifest entry for a file .vscodeignore excludes makes every install
  // report itself as tampered with — which is exactly what happened the first
  // time this extension was installed from a package.
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'core-integrity.json'), 'utf8'));
  const ignore = readFileSync(resolve(ROOT, '.vscodeignore'), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  for (const file of Object.keys(manifest.files)) {
    for (const pattern of ignore) {
      const prefix = pattern.replace(/\/\*\*$/, '/').replace(/\*$/, '');
      const excluded = pattern.endsWith('/**')
        ? file.startsWith(prefix)
        : file === pattern;
      assert.ok(!excluded, `core-integrity.json verifies ${file}, but .vscodeignore drops it (${pattern})`);
    }
  }
});

test('a modified runtime is detected', () => {
  const dir = tempExtensionRoot();
  assert.equal(verifyCore(dir).status, 'official', 'the copy starts intact');

  appendFileSync(join(dir, 'media/jsray.js'), '\n// tampered\n');
  const report = verifyCore(dir);

  assert.equal(report.status, 'modified');
  assert.deepEqual(report.mismatched, ['media/jsray.js']);
  assert.equal(verifyCore(ROOT).status, 'official', 'the real install is untouched');
});

test('a missing manifest reads as unverified, not as tampered', () => {
  const report = verifyCore('/nonexistent');
  assert.equal(report.status, 'unknown');
  assert.equal(report.checked, 0);
});

test('a custom palette produces scoped CSS', () => {
  const { themes, warnings } = validatePalette({
    themes: {
      dark: { background: '#0B0E14', tokens: { keyword: { color: '#FF00AA', fontStyle: 'bold italic' } } },
      light: { tokens: { string: '#006600' } },
    },
  }, vocabulary);

  assert.deepEqual(warnings, []);

  const css = paletteCss(themes, vocabulary);
  assert.match(css, /\[data-theme="dark"\]\{[^}]*--jr-bg:#0B0E14/);
  assert.match(css, /--jr-keyword:#FF00AA/);
  assert.match(css, /\[data-theme="dark"\] \.tk-keyword\{font-weight:700;font-style:italic\}/);
  assert.match(css, /\[data-theme="light"\]\{[^}]*--jr-string:#006600/);
});

test('a custom palette cannot inject CSS or unknown tokens', () => {
  const { themes, warnings } = validatePalette({
    themes: { dark: { tokens: {
      keyword: { color: '#FF00AA' },
      string: { color: 'red;}body{display:none}.x{color:red' },
      number: { color: 'url(javascript:alert(1))' },
      'lifetime.annotation': { color: '#123456' },
    } } },
  }, vocabulary);

  assert.deepEqual(Object.keys(themes.dark.tokens), ['keyword']);
  assert.equal(warnings.length, 3);

  const css = paletteCss(themes, vocabulary);
  assert.doesNotMatch(css, /display:none/);
  assert.doesNotMatch(css, /javascript:/);
});

test('the palette shape matches every other JSRay surface', () => {
  // A bare { dark, light } map works, same as in the CLI and the plugin.
  const { themes } = validatePalette({ dark: { tokens: { keyword: '#FF00AA' } } }, vocabulary);
  assert.equal(themes.dark.tokens.keyword.color, '#FF00AA');
});

test('the manifest declares the entry point the verification needs', () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.main, './extension.js');
  assert.ok(pkg.activationEvents?.includes('onStartupFinished'));
  assert.ok(pkg.contributes.commands.some((c) => c.command === 'jsray.verifyCore'));
  assert.ok(pkg.contributes.configuration.properties['jsray.customPalette']);
  assert.equal(pkg.contributes['markdown.markdownItPlugins'], true);
});
