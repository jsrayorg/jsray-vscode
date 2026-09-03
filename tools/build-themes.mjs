#!/usr/bin/env node
/**
 * Generate VS Code color themes from JSRay palette JSON.
 *
 * palettes/default.json (+ every other palettes/*.json) → for each of its
 * dark/light blocks, one themes/jsray-<id>-<mode>-color-theme.json.
 *
 * The 23 JSRay token semantics are mapped twice:
 *   - tokenColors (TextMate scopes): best-effort, works everywhere
 *   - semanticTokenColors: precise — this is where the six-family
 *     separation lands (function.declaration bold, parameter italic, ...)
 *
 * Usage:  node tools/build-themes.mjs
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PALETTES = resolve(ROOT, 'palettes');
const OUT = resolve(ROOT, 'themes');

// JSRay semantic key → TextMate scopes (best-effort approximation).
const TEXTMATE_MAP = {
  'keyword':              ['keyword', 'keyword.control', 'storage', 'storage.type', 'storage.modifier'],
  'function':             ['entity.name.function', 'variable.function', 'meta.function-call.generic'],
  'function.builtin':     ['support.function'],
  'variable':             ['variable', 'variable.other.readwrite'],
  'variable.parameter':   ['variable.parameter'],
  'variable.builtin':     ['variable.language', 'support.variable'],
  'variable.constant':    ['variable.other.constant', 'constant.other.caps'],
  'type':                 ['entity.name.type', 'entity.name.class', 'entity.other.inherited-class', 'support.type', 'support.class', 'support.type.property-name.json'],
  'property':             ['variable.other.property', 'variable.other.object.property', 'meta.object-literal.key'],
  'string':               ['string'],
  'string.regex':         ['string.regexp'],
  'number':               ['constant.numeric', 'constant.language'],
  'comment':              ['comment'],
  'comment.doc':          ['comment.block.documentation'],
  'decorator':            ['meta.decorator', 'entity.name.function.decorator', 'punctuation.decorator', 'meta.preprocessor'],
  'operator':             ['keyword.operator'],
  'punctuation':          ['punctuation', 'meta.brace'],
  'tag':                  ['entity.name.tag'],
  'attribute':            ['entity.other.attribute-name'],
  'selector':             ['entity.other.attribute-name.class.css', 'entity.other.attribute-name.id.css', 'meta.selector'],
  'css.property':         ['support.type.property-name.css', 'support.type.vendored.property-name.css'],
  'css.unit':             ['keyword.other.unit'],
};

// JSRay semantic key → VS Code semantic token selectors (the precise layer).
const SEMANTIC_MAP = {
  'keyword':              ['keyword'],
  'function':             ['function', 'method'],
  'function.declaration': ['function.declaration', 'method.declaration'],
  'function.builtin':     ['function.defaultLibrary', 'method.defaultLibrary', 'magicFunction'],
  'variable':             ['variable'],
  'variable.parameter':   ['parameter'],
  'variable.builtin':     ['variable.defaultLibrary', 'selfParameter', 'clsParameter'],
  'variable.constant':    ['variable.readonly', 'builtinConstant'],
  'type':                 ['type', 'class', 'interface', 'enum', 'struct', 'typeParameter', 'namespace'],
  'property':             ['property'],
  'string':               ['string'],
  'string.regex':         ['regexp'],
  'number':               ['number'],
  'comment':              ['comment'],
  'decorator':            ['decorator'],
  'operator':             ['operator'],
};

function hexify(color) {
  // VS Code workbench colors accept only #RGB[A] hex; palettes may use rgba().
  const m = String(color).match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (!m) return color;
  const [, r, g, b, a] = m;
  const h = (n) => Number(n).toString(16).padStart(2, '0');
  const alpha = a === undefined ? '' : h(Math.round(Number(a) * 255));
  return `#${h(r)}${h(g)}${h(b)}${alpha}`;
}

/**
 * Blend two colours, so the workbench chrome can be derived from the palette
 * rather than guessed at. Anything that is not a hex triple comes back
 * unchanged — a palette may legitimately carry rgba().
 */
function mix(base, other, percentOfBase) {
  const parse = (hex) => {
    const m = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const a = parse(base);
  const b = parse(other);
  if (!a || !b) return base;
  const w = Math.max(0, Math.min(1, percentOfBase / 100));
  return '#' + a
    .map((v, i) => Math.round(v * w + b[i] * (1 - w)).toString(16).padStart(2, '0'))
    .join('');
}


/**
 * The editor was the only thing these themes coloured — eight entries, all of
 * them `editor.*`. Everything around it fell back to VS Code's defaults for
 * the ui theme, and the default light activity bar is dark: a JSRay Light
 * theme gave a white editor beside a black sidebar.
 *
 * All of it is derived from the palette. `chrome` is the editor background
 * nudged towards the foreground, which reads as a surface behind the editor in
 * both modes without needing a second set of colours to keep in step.
 */
function workbenchColors(theme, tokens, get, mode) {
  const bg = hexify(theme.background);
  const fg = hexify(theme.foreground);
  const border = hexify(theme.border || (mode === 'dark' ? '#2C2C2E' : '#E5E5EA'));
  const gutter = hexify(theme.gutter || (mode === 'dark' ? '#48484A' : '#8E8E93'));

  const chrome = mix(bg, fg, mode === 'dark' ? 96 : 97);
  const sunken = mix(bg, fg, mode === 'dark' ? 92 : 94);
  const muted = mix(fg, bg, 62);
  // The declaration colour is the palette's most distinctive hue in every
  // theme, which makes it the one to point a badge or a focus ring with.
  const accent = hexify((get('function.declaration') || get('function') || {}).color || fg);

  return {
    'editor.background': bg,
    'editor.foreground': fg,
    'editorCursor.foreground': fg,
    'editorLineNumber.foreground': gutter,
    'editorLineNumber.activeForeground': fg,
    'editor.lineHighlightBackground': hexify(
      theme.lineHighlight || (mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)')
    ),
    'editorIndentGuide.background1': border,
    'editorWidget.background': chrome,
    'editorWidget.border': border,

    'editorGroupHeader.tabsBackground': sunken,
    'editorGroup.border': border,
    'tab.activeBackground': bg,
    'tab.activeForeground': fg,
    'tab.inactiveBackground': sunken,
    'tab.inactiveForeground': muted,
    'tab.border': border,
    'tab.activeBorderTop': accent,

    'activityBar.background': chrome,
    'activityBar.foreground': fg,
    'activityBar.inactiveForeground': muted,
    'activityBar.border': border,
    'activityBarBadge.background': accent,
    'activityBarBadge.foreground': bg,

    'sideBar.background': chrome,
    'sideBar.foreground': muted,
    'sideBar.border': border,
    'sideBarTitle.foreground': fg,
    'sideBarSectionHeader.background': chrome,
    'sideBarSectionHeader.border': border,

    'list.activeSelectionBackground': mix(bg, fg, 88),
    'list.activeSelectionForeground': fg,
    'list.hoverBackground': mix(bg, fg, 93),
    'list.inactiveSelectionBackground': sunken,

    'statusBar.background': chrome,
    'statusBar.foreground': muted,
    'statusBar.border': border,
    'statusBarItem.remoteBackground': accent,
    'statusBarItem.remoteForeground': bg,

    'titleBar.activeBackground': chrome,
    'titleBar.activeForeground': fg,
    'titleBar.inactiveBackground': chrome,
    'titleBar.inactiveForeground': muted,
    'titleBar.border': border,

    'panel.background': bg,
    'panel.border': border,
    'panelTitle.activeForeground': fg,
    'panelTitle.inactiveForeground': muted,

    'focusBorder': accent,
    'input.background': sunken,
    'input.border': border,
    'dropdown.background': sunken,
    'dropdown.border': border,
  };
}

function fontStyleOf(tok) {
  return tok.fontStyle || '';
}

function buildTheme(palette, id, mode) {
  const theme = palette.themes[mode];
  const tokens = theme.tokens;
  // Fallback chain: a refined key missing from the palette resolves through
  // its base (function.declaration → function), so older palettes keep
  // working when the token vocabulary grows in a minor version.
  const get = (key) => {
    let k = key;
    while (k) {
      const tok = tokens[k];
      if (tok) return tok;
      const dot = k.lastIndexOf('.');
      k = dot === -1 ? '' : k.slice(0, dot);
    }
    throw new Error(`palette "${id}" ${mode}: missing token "${key}" (and its fallback chain)`);
  };

  const tokenColors = Object.entries(TEXTMATE_MAP).map(([key, scopes]) => {
    const tok = get(key);
    const settings = { foreground: tok.color };
    const style = fontStyleOf(tok);
    if (style) settings.fontStyle = style;
    return { name: `JSRay · ${key}`, scope: scopes, settings };
  });

  const semanticTokenColors = {};
  for (const [key, selectors] of Object.entries(SEMANTIC_MAP)) {
    const tok = get(key); // get() walks the fallback chain itself
    for (const selector of selectors) {
      const entry = { foreground: tok.color };
      const style = fontStyleOf(tok);
      if (style === 'bold') entry.bold = true;
      if (style === 'italic') entry.italic = true;
      semanticTokenColors[selector] = entry;
    }
  }

  return {
    $schema: 'vscode://schemas/color-theme',
    name: `JSRay ${palette.name} ${mode === 'dark' ? 'Dark' : 'Light'}`,
    type: mode,
    semanticHighlighting: true,
    colors: workbenchColors(theme, tokens, get, mode),
    tokenColors,
    semanticTokenColors,
  };
}

function paletteFiles() {
  return readdirSync(PALETTES)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => resolve(PALETTES, f));
}

mkdirSync(OUT, { recursive: true });
let count = 0;
for (const file of paletteFiles()) {
  const palette = JSON.parse(readFileSync(file, 'utf8'));
  const id = basename(file, '.json');
  for (const mode of ['dark', 'light']) {
    if (!palette.themes?.[mode]) throw new Error(`${basename(file)} missing themes.${mode}`);
    const theme = buildTheme(palette, id, mode);
    const out = resolve(OUT, `jsray-${id}-${mode}-color-theme.json`);
    writeFileSync(out, JSON.stringify(theme, null, 2) + '\n');
    console.log(`generated ${out}`);
    count++;
  }
}
console.log(`${count} VS Code themes generated`);
