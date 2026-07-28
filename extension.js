/**
 * JSRay for VS Code · extension entry point
 *
 * The colour themes and the Markdown preview are contribution points and need
 * no code. This module exists for the two things that do:
 *
 *   1. Verifying that the bundled JSRay Core is the official build. The
 *      extension ships a snapshot of the renderer, which means the file that
 *      renders code inside the preview webview sits on disk in the extensions
 *      folder — replaceable by anything with write access.
 *   2. Feeding the user's custom palette to the preview, validated against the
 *      token vocabulary bundled with that Core snapshot.
 */
const { createHash } = require('crypto');
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

// Required lazily inside activate(): the module only exists inside a running
// VS Code, and everything above it is pure enough to unit-test without one.

/**
 * Hash every bundled asset against the digests Core published.
 *
 * @param {string} root Extension install path.
 * @returns {{status: 'official'|'modified'|'unknown', version: string, mismatched: string[], checked: number}}
 */
function verifyCore(root) {
  const manifestPath = join(root, 'core-integrity.json');

  if (!existsSync(manifestPath)) {
    return { status: 'unknown', version: '', mismatched: [], checked: 0 };
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const mismatched = [];
  let checked = 0;

  for (const [file, expected] of Object.entries(manifest.files || {})) {
    const path = join(root, file);

    if (!existsSync(path)) {
      mismatched.push(file);
      continue;
    }

    const actual = 'sha256-' + createHash('sha256').update(readFileSync(path)).digest('base64');
    checked++;

    if (actual !== expected) mismatched.push(file);
  }

  return {
    status: mismatched.length ? 'modified' : 'official',
    version: manifest.version || '',
    mismatched,
    checked,
  };
}

const COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Validate a custom palette against the bundled vocabulary.
 *
 * Same contract as every other JSRay surface: unknown keys are dropped rather
 * than rejected, so a palette written for a newer Core still works here.
 *
 * @param {unknown} input Parsed palette object from settings.
 * @param {object} vocabulary Bundled vocabulary.json.
 * @returns {{themes: object, warnings: string[]}}
 */
function validatePalette(input, vocabulary) {
  const warnings = [];
  const themes = {};

  if (!input || typeof input !== 'object') return { themes, warnings };

  const source = input.themes && typeof input.themes === 'object' ? input.themes : input;

  for (const mode of ['dark', 'light']) {
    const block = source[mode];
    if (!block || typeof block !== 'object') continue;

    const theme = { tokens: {} };

    for (const surface of Object.keys(vocabulary.surfaces || {})) {
      if (typeof block[surface] === 'string' && COLOR_RE.test(block[surface])) {
        theme[surface] = block[surface];
      }
    }

    for (const [key, token] of Object.entries(block.tokens || {})) {
      if (!(key in (vocabulary.tokens || {}))) {
        warnings.push(`ignored "${key}" — not a JSRay token in Core ${vocabulary.version}`);
        continue;
      }

      const color = typeof token === 'string' ? token : token && token.color;

      if (typeof color !== 'string' || !COLOR_RE.test(color)) {
        warnings.push(`ignored "${key}" in ${mode} — not a hex color`);
        continue;
      }

      theme.tokens[key] = { color };

      if (token && typeof token === 'object' && typeof token.fontStyle === 'string') {
        theme.tokens[key].fontStyle = token.fontStyle;
      }
    }

    themes[mode] = theme;
  }

  return { themes, warnings };
}

/**
 * Turn a validated palette into CSS the preview webview can apply.
 *
 * @param {object} themes Validated themes.
 * @param {object} vocabulary Bundled vocabulary.json.
 * @returns {string}
 */
function paletteCss(themes, vocabulary) {
  let css = '';

  for (const [mode, theme] of Object.entries(themes)) {
    const variables = [];
    let rules = '';

    for (const [key, suffix] of Object.entries(vocabulary.surfaces || {})) {
      if (theme[key]) variables.push(`--jr-${suffix}:${theme[key]}`);
    }

    for (const [key, token] of Object.entries(theme.tokens || {})) {
      const suffix = vocabulary.tokens[key];
      variables.push(`--jr-${suffix}:${token.color}`);

      // Weight and slant live on the .tk-* classes in jsray.css, not in a
      // custom property, so overriding them takes a real rule.
      if (token.fontStyle) {
        rules += `[data-theme="${mode}"] .tk-${suffix}{`
          + `font-weight:${token.fontStyle.includes('bold') ? '700' : '400'};`
          + `font-style:${token.fontStyle.includes('italic') ? 'italic' : 'normal'}}`;
      }
    }

    if (variables.length) css += `[data-theme="${mode}"]{${variables.join(';')};}`;
    css += rules;
  }

  return css;
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const vscode = require('vscode');
  const root = context.extensionPath;
  const integrity = verifyCore(root);

  if (integrity.status === 'modified') {
    vscode.window.showErrorMessage(
      `JSRay: the bundled rendering core has been modified and no longer matches `
      + `the official JSRay Core ${integrity.version} build `
      + `(${integrity.mismatched.join(', ')}). Reinstall the extension to restore it.`
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('jsray.verifyCore', () => {
      const report = verifyCore(root);
      const message = {
        official: `JSRay Core ${report.version}: official build verified (${report.checked} files).`,
        modified: `JSRay Core ${report.version}: MODIFIED — ${report.mismatched.join(', ')}`,
        unknown: 'JSRay: no integrity manifest is bundled with this install.',
      }[report.status];

      (report.status === 'official' ? vscode.window.showInformationMessage : vscode.window.showWarningMessage)(message);
    })
  );

  const vocabulary = JSON.parse(readFileSync(join(root, 'vocabulary.json'), 'utf8'));

  /** Build the style block for the palette currently in settings. */
  const currentPaletteStyle = () => {
    const configured = vscode.workspace.getConfiguration('jsray').get('customPalette');

    if (!configured || (typeof configured === 'object' && !Object.keys(configured).length)) {
      return '';
    }

    const { themes, warnings } = validatePalette(configured, vocabulary);

    for (const warning of warnings) {
      console.warn(`JSRay: ${warning}`);
    }

    const css = paletteCss(themes, vocabulary);

    return css ? `<style data-jsray-custom-palette>${css}</style>` : '';
  };

  // Repaint the preview when the palette setting changes, so editing colors is
  // a live loop rather than a reload-and-hope one.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('jsray.customPalette')) {
        vscode.commands.executeCommand('markdown.preview.refresh');
      }
    })
  );

  return {
    // markdownItPlugins hook: the preview's HTML is generated here, which is
    // the one place an extension can inject styles that follow a setting.
    //
    // Registered as a core rule rather than by wrapping md.render — the editor
    // reaches the renderer through more than one entry point, and a wrapped
    // render() simply never fires for the preview.
    extendMarkdownIt(md) {
      md.core.ruler.push('jsray_custom_palette', (state) => {
        const style = currentPaletteStyle();
        if (!style) return;

        const token = new state.Token('html_block', '', 0);
        token.content = style;
        state.tokens.unshift(token);
      });

      return md;
    },
    verifyCore: () => verifyCore(root),
    buildPaletteCss: (palette) => {
      const { themes, warnings } = validatePalette(palette, vocabulary);
      return { css: paletteCss(themes, vocabulary), warnings };
    },
  };
}

function deactivate() {}

module.exports = { activate, deactivate, verifyCore, validatePalette, paletteCss };
