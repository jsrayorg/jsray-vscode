// Extension entry point: core verification and custom-palette validation.
// These are the two pieces of real code in the extension; the themes and the
// preview are contribution points. `require('vscode')` is deferred to
// activate(), so everything here runs under plain node.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, appendFileSync, existsSync } from 'node:fs';
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


const CORE = createRequire(import.meta.url)(resolve(ROOT, 'media/jsray.js'));
const VOCABULARY = JSON.parse(readFileSync(resolve(ROOT, 'vocabulary.json'), 'utf8'));
const DOC_FILES = ['README.md', 'README.zh-CN.md'];

test('documented counts match the bundled Core, not a remembered one', () => {
  // Every number here was copied from Core's README at some point, and Core's
  // numbers move: the identifier-family count read "six" against a table with
  // nine rows for as long as nobody checked. The bundled snapshot is the only
  // authority this repository has, so it is the one to check against.
  const grammars = new Set(Object.values(CORE.languages)).size;
  const tokens = Object.keys(VOCABULARY.tokens).length;

  for (const file of DOC_FILES) {
    const path = resolve(ROOT, file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8');

    for (const [claim, count, kind] of [...text.matchAll(/(\d+)\s*(language famil|token class|个 token|种语言)/gi)]
        .map((m) => [m[0], Number(m[1]), m[2].toLowerCase()])) {
      const expected = /language|种语言/.test(kind) ? grammars : tokens;
      assert.equal(count, expected, `${file} claims "${claim}" but the bundled Core has ${expected}`);
    }

    // The identifier families are a Core concept the docs restate in prose.
    assert.doesNotMatch(text, /\b(six|Six)[- ]family\b/, `${file} still says six-family`);
    assert.doesNotMatch(text, /六[- ]?族/, `${file} still says 六族`);
  }
});

test('every shipped theme resolves to a bundled palette', () => {
  // The preview's stylesheet is a static contribution — one file, and it was
  // default.css. Picking Ember gave a warm charcoal editor beside a
  // Default-coloured preview on the same screen. The palette now follows the
  // theme, which only works if every theme label maps to a palette that exists.
  const themes = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).contributes.themes;
  const NAME = /^JSRay\s+(\w+)/i;

  assert.ok(themes.length >= 8, 'expected the four palettes in dark and light');

  for (const theme of themes) {
    const match = NAME.exec(theme.label);
    assert.ok(match, `"${theme.label}" does not start with JSRay <palette>`);
    const id = match[1].toLowerCase();
    assert.ok(existsSync(resolve(ROOT, 'palettes', `${id}.json`)),
      `"${theme.label}" resolves to palettes/${id}.json, which does not exist`);
  }

  // A reader on someone else's theme has not asked for JSRay's colours in
  // their preview; the bundled stylesheet is the right answer there.
  for (const other of ['Monokai', 'Default Dark+', 'Solarized Light', '']) {
    assert.equal(NAME.exec(other), null, `"${other}" should not be treated as a JSRay theme`);
  }
});

test('a custom palette still wins over the theme palette', () => {
  // Both blocks target [data-theme] at the same specificity, so source order
  // decides. The rule unshifts, which reverses insertion — the custom block is
  // inserted first so it ends up behind, and therefore later in the document.
  const source = readFileSync(resolve(ROOT, 'extension.js'), 'utf8');
  const rule = source.slice(source.indexOf("md.core.ruler.push('jsray_palette'"));
  const order = rule.slice(0, rule.indexOf('});'));

  assert.ok(
    order.indexOf('currentPaletteStyle()') < order.indexOf('themePaletteStyle()'),
    'the custom palette must be unshifted first so it lands after the theme palette'
  );

  // Switching themes has to repaint, or the preview keeps the old palette.
  assert.match(source, /affectsConfiguration\('workbench\.colorTheme'\)/,
    'a theme change does not refresh the preview');
});

test("Core's own palettes keep every surface through validation", () => {
  // "A palette authored once works on every JSRay surface" was the promise,
  // and the same file kept lineHighlight in WordPress and lost it here —
  // rgba() is not hex, and hex was all this accepted. Core's lineHighlight is
  // rgba because a translucent overlay cannot be written any other way.
  const vocabulary = JSON.parse(readFileSync(resolve(ROOT, 'vocabulary.json'), 'utf8'));

  for (const file of ['default', 'aurora', 'ember', 'fjord']) {
    const palette = JSON.parse(readFileSync(resolve(ROOT, 'palettes', `${file}.json`), 'utf8'));
    const { themes } = validatePalette(palette, vocabulary);

    for (const mode of ['dark', 'light']) {
      for (const surface of Object.keys(palette.themes[mode]).filter((k) => k !== 'tokens')) {
        assert.ok(themes[mode][surface],
          `${file}.${mode}.${surface} = ${palette.themes[mode][surface]} was dropped`);
      }
    }
  }
});

test('the colour rule still refuses what cannot go in a style block', () => {
  // Widening from hex to rgb/hsl must not widen to url() or a stray semicolon:
  // these values are written straight into a <style> the preview loads.
  const vocabulary = JSON.parse(readFileSync(resolve(ROOT, 'vocabulary.json'), 'utf8'));

  for (const hostile of [
    'url(javascript:alert(1))',
    'var(--x)',
    'red;}body{display:none',
    'expression(alert(1))',
    '#fff</style><script>alert(1)</script>',
    'a'.repeat(200),
  ]) {
    const { themes } = validatePalette(
      { themes: { dark: { tokens: { keyword: { color: hostile } } } } },
      vocabulary
    );
    assert.equal(themes.dark.tokens.keyword, undefined, `accepted: ${hostile}`);
  }
});
