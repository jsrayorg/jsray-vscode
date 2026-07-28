// preview-adapter.js exercised in a node:vm sandbox with a fake DOM —
// theme syncing from VS Code body classes, re-render caching, and the
// live-editing invalidation path.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ADAPTER_SRC = readFileSync(resolve(ROOT, 'media/preview-adapter.js'), 'utf8');

function fakeCode(text) {
  return { textContent: text, dataset: {} };
}

function bootAdapter({ bodyClasses = ['vscode-dark'], codeEls = [] } = {}) {
  const classes = new Set(bodyClasses);
  const body = {
    classList: { contains: (c) => classes.has(c) },
    dataset: {},
  };
  const document = {
    readyState: 'complete',
    body,
    addEventListener() {},
    querySelectorAll: () => codeEls,
  };
  const jsray = {
    highlighted: [],
    highlightElement(el) {
      this.highlighted.push(el);
      el.dataset.jsrayLang = 'js'; // what core does on success
    },
  };
  const sandbox = { window: { JSRay: jsray }, document };
  vm.createContext(sandbox);
  new vm.Script(ADAPTER_SRC, { filename: 'preview-adapter.js' }).runInContext(sandbox);
  return { body, document, jsray, sandbox };
}

test('dark UI class maps to data-theme=dark; light maps to light', () => {
  const dark = bootAdapter({ bodyClasses: ['vscode-dark'] });
  assert.equal(dark.body.dataset.theme, 'dark');

  const hc = bootAdapter({ bodyClasses: ['vscode-high-contrast'] });
  assert.equal(hc.body.dataset.theme, 'dark');

  const light = bootAdapter({ bodyClasses: ['vscode-light'] });
  assert.equal(light.body.dataset.theme, 'light');
});

test('all code blocks are re-rendered through JSRay on boot', () => {
  const els = [fakeCode('const a = 1;'), fakeCode('SELECT 1;')];
  const { jsray } = bootAdapter({ codeEls: els });
  assert.equal(jsray.highlighted.length, 2);
  assert.equal(els[0].dataset.jsraySource, 'const a = 1;');
});

test('unchanged blocks are not re-rendered; edited blocks are', () => {
  const el = fakeCode('const a = 1;');
  const { jsray, sandbox } = bootAdapter({ codeEls: [el] });
  assert.equal(jsray.highlighted.length, 1);

  // Simulate a second mutation pass with unchanged content: rerender is
  // internal, so re-run the whole script against the same document — the
  // The jsraySource cache must prevent double work.
  new vm.Script(ADAPTER_SRC).runInContext(sandbox);
  assert.equal(jsray.highlighted.length, 1, 'unchanged block re-rendered');

  // Live edit: text changes → cache invalidates → re-rendered.
  el.textContent = 'const b = 2;';
  new vm.Script(ADAPTER_SRC).runInContext(sandbox);
  assert.equal(jsray.highlighted.length, 2, 'edited block not re-rendered');
});

test('missing JSRay global is a silent no-op', () => {
  const el = fakeCode('const a = 1;');
  const body = { classList: { contains: () => true }, dataset: {} };
  const document = {
    readyState: 'complete',
    body,
    addEventListener() {},
    querySelectorAll: () => [el],
  };
  const sandbox = { window: {}, document };
  vm.createContext(sandbox);
  new vm.Script(ADAPTER_SRC).runInContext(sandbox); // must not throw
  assert.equal(el.dataset.jsrayLang, undefined);
});
