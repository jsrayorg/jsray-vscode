// Exercises activate() itself, against a stand-in for the vscode API.
//
// Everything below only runs when the editor loads the extension, which is why
// none of it had ever executed: the integrity warning, the verify command, the
// markdown-it hook that carries a custom palette into the preview, and the
// refresh when the setting changes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Module from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

// Route require('vscode') to the stub, the way the editor would provide it.
const stubPath = resolve(ROOT, 'tests/stubs/vscode.js');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'vscode') return stubPath;
  return originalResolve.call(this, request, ...rest);
};

const vscode = require(stubPath);
const extension = require('../extension.js');

/**
 * A markdown-it shaped enough to run a core rule, which is how the extension
 * injects the palette. A bare { render } object passed this test while the real
 * preview got nothing.
 */
function fakeMarkdownIt() {
  const rules = [];
  return {
    core: { ruler: { push: (_name, fn) => rules.push(fn) } },
    render(text) {
      const state = { tokens: [], Token: class { constructor(t){ this.type=t; this.content=''; } } };
      for (const rule of rules) rule(state);
      return state.tokens.map((t) => t.content).join('') + `<p>${text}</p>`;
    },
  };
}

const activate = (config = {}, root = ROOT) => {
  vscode.__reset();
  Object.assign(vscode.__state.config, config);
  return extension.activate({ extensionPath: root, subscriptions: vscode.__state.subscriptions });
};

/**
 * A throwaway copy of everything core-integrity.json covers.
 *
 * Tampering with the tracked runtime works until a run is interrupted — and
 * then the repository is left holding a corrupted engine, which is exactly what
 * happened while this suite was being written.
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

test('activation on an intact install warns about nothing', () => {
  activate();
  assert.deepEqual(vscode.__state.errors, [], 'an official build must not raise an error');
  assert.ok(vscode.__state.commands.has('jsray.verifyCore'), 'the verify command must be registered');
  assert.ok(vscode.__state.subscriptions.length >= 2, 'command and config listener must be disposable');
});

test('activation on a modified install names the files', () => {
  const dir = tempExtensionRoot();
  appendFileSync(join(dir, 'media/jsray.js'), '\n// tampered\n');

  activate({}, dir);

  assert.equal(vscode.__state.errors.length, 1);
  assert.match(vscode.__state.errors[0], /media\/jsray\.js/);
  assert.match(vscode.__state.errors[0], /modified/i);

  activate();
  assert.deepEqual(vscode.__state.errors, [], 'the real install is untouched');
});

test('the verify command reports the result to the user', () => {
  activate();
  vscode.__state.commands.get('jsray.verifyCore')();
  assert.equal(vscode.__state.infos.length, 1);
  assert.match(vscode.__state.infos[0], /official build verified/);
  assert.match(vscode.__state.infos[0], /\d+ files/);
});

test('the markdown-it hook injects the configured palette into the preview', () => {
  const api = activate({
    'jsray.customPalette': {
      themes: { dark: { tokens: { keyword: { color: '#FF00AA', fontStyle: 'bold' } } } },
    },
  });

  const md = fakeMarkdownIt();
  api.extendMarkdownIt(md);
  const html = md.render('hi');

  assert.match(html, /<style data-jsray-custom-palette>/);
  assert.match(html, /--jr-keyword:#FF00AA/);
  assert.match(html, /\.tk-keyword\{font-weight:700/);
  assert.ok(html.endsWith('<p>hi</p>'), 'the original render output must be preserved');
});

test('no configured palette means no style block at all', () => {
  const api = activate();
  const md = fakeMarkdownIt();
  api.extendMarkdownIt(md);
  assert.equal(md.render('hi'), '<p>hi</p>');
});

test('an unusable palette degrades to no style rather than broken CSS', () => {
  const api = activate({
    'jsray.customPalette': { themes: { dark: { tokens: { keyword: { color: 'red;}body{x' } } } } },
  });
  const md = fakeMarkdownIt();
  api.extendMarkdownIt(md);
  const html = md.render('hi');
  assert.doesNotMatch(html, /body\{x/);
  assert.equal(html, '<p>hi</p>');
});

test('changing the palette setting refreshes the preview', () => {
  activate();
  const listener = vscode.__state.configListeners[0];
  assert.ok(listener, 'a configuration listener must be registered');

  listener({ affectsConfiguration: (s) => s === 'jsray.customPalette' });
  assert.deepEqual(vscode.__state.executed, ['markdown.preview.refresh']);

  vscode.__state.executed.length = 0;
  listener({ affectsConfiguration: () => false });
  assert.deepEqual(vscode.__state.executed, [], 'unrelated settings must not refresh');
});
