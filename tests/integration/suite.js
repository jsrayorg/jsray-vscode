/**
 * Assertions that run *inside* a real VS Code, in the extension host process.
 *
 * Everything else in this suite runs under plain node against a stand-in for
 * the vscode API, which can only prove the extension asks for the right things.
 * It cannot prove VS Code accepts the manifest, loads the themes, or activates
 * the extension at all — the two bugs found by installing the .vsix by hand
 * were both of that kind.
 */
const assert = require('assert');
const vscode = require('vscode');

const EXTENSION_ID = 'jsray.jsray-vscode';

async function run() {
  const results = [];
  const check = async (name, fn) => {
    try {
      await fn();
      results.push(`  ok   ${name}`);
    } catch (error) {
      results.push(`  FAIL ${name}\n       ${error.message}`);
    }
  };

  const extension = vscode.extensions.getExtension(EXTENSION_ID);

  await check('VS Code loads the extension', () => {
    assert.ok(extension, `${EXTENSION_ID} was not loaded by the editor`);
  });

  let api;
  await check('activate() runs inside the editor without throwing', async () => {
    api = await extension.activate();
    assert.ok(extension.isActive, 'the extension did not become active');
  });

  await check('activation exposes the markdown-it hook', () => {
    assert.equal(typeof api.extendMarkdownIt, 'function');
    assert.equal(typeof api.verifyCore, 'function');
  });

  await check('the bundled Core verifies from the installed location', () => {
    const report = api.verifyCore();
    assert.equal(report.status, 'official', `mismatched: ${report.mismatched.join(', ')}`);
    assert.ok(report.checked >= 4);
  });

  await check('the verify command is registered with the editor', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('jsray.verifyCore'), 'jsray.verifyCore is missing');
  });

  await check('all eight themes are contributed', () => {
    const themes = extension.packageJSON.contributes.themes;
    assert.equal(themes.length, 8);
    for (const theme of themes) {
      const uri = vscode.Uri.joinPath(extension.extensionUri, theme.path);
      assert.ok(require('fs').existsSync(uri.fsPath), `${theme.path} is declared but missing`);
    }
  });

  await check('a JSRay theme can actually be applied', async () => {
    const config = vscode.workspace.getConfiguration('workbench');
    const original = config.get('colorTheme');
    await config.update('colorTheme', 'JSRay Default Dark', vscode.ConfigurationTarget.Global);
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(
      vscode.workspace.getConfiguration('workbench').get('colorTheme'),
      'JSRay Default Dark',
      'the editor refused the theme'
    );
    await config.update('colorTheme', original, vscode.ConfigurationTarget.Global);
  });

  await check("the editor's own markdown pipeline invokes the hook", async () => {
    // The assertion above calls extendMarkdownIt directly, which proves the
    // hook works but not that VS Code ever reaches for it. markdown.api.render
    // runs the real preview pipeline, contributed plugins included.
    await vscode.workspace.getConfiguration('jsray').update(
      'customPalette',
      { themes: { dark: { tokens: { keyword: { color: '#00FFAA' } } } } },
      vscode.ConfigurationTarget.Global
    );

    let html;
    try {
      html = await vscode.commands.executeCommand('markdown.api.render', '```js\nconst x = 1;\n```');
    } catch (error) {
      throw new Error(`markdown.api.render unavailable: ${error.message}`);
    }

    assert.ok(typeof html === 'string' && html.length, 'the pipeline returned nothing');
    assert.ok(
      html.includes('--jr-keyword:#00FFAA'),
      `the palette never reached the rendered preview:\n${html.slice(0, 400)}`
    );

    await vscode.workspace.getConfiguration('jsray').update(
      'customPalette', undefined, vscode.ConfigurationTarget.Global
    );
  });

  await check('the preview palette follows the editor theme', async () => {
    // previewStyles is a static contribution — one stylesheet, and it was
    // default.css. Picking Ember gave a warm charcoal editor beside a
    // Default-coloured preview on the same screen. The palette is emitted
    // through the markdown-it hook now, which means it depends on
    // workbench.colorTheme — an API that exists only in here. A node-level
    // test can read the source and confirm the code was written; only this
    // can confirm the editor answers.
    const ember = JSON.parse(
      require('fs').readFileSync(require('path').join(__dirname, '../../palettes/ember.json'), 'utf8')
    );
    const emberKeyword = ember.themes.dark.tokens.keyword.color;

    const workbench = vscode.workspace.getConfiguration('workbench');
    const before = workbench.get('colorTheme');

    try {
      await workbench.update('colorTheme', 'JSRay Ember Dark', vscode.ConfigurationTarget.Global);

      const html = await vscode.commands.executeCommand(
        'markdown.api.render', '```js\nconst x = 1;\n```'
      );

      assert.ok(
        html.includes(`--jr-keyword:${emberKeyword}`),
        `Ember's keyword colour ${emberKeyword} never reached the preview:\n${html.slice(0, 500)}`
      );

      // Default is served by the bundled stylesheet, so it must NOT be
      // emitted again — a second block would be dead weight on every render.
      await workbench.update('colorTheme', 'JSRay Default Dark', vscode.ConfigurationTarget.Global);
      const plain = await vscode.commands.executeCommand(
        'markdown.api.render', '```js\nconst x = 1;\n```'
      );
      assert.ok(
        !plain.includes('data-jsray-theme-palette'),
        'the default palette is emitted twice — the stylesheet already provides it'
      );

      // Someone on Monokai has not asked for JSRay colours in their preview.
      await workbench.update('colorTheme', 'Default Dark+', vscode.ConfigurationTarget.Global);
      const other = await vscode.commands.executeCommand(
        'markdown.api.render', '```js\nconst x = 1;\n```'
      );
      assert.ok(
        !other.includes('data-jsray-theme-palette'),
        'a non-JSRay theme still got a JSRay palette injected'
      );
    } finally {
      await workbench.update('colorTheme', before, vscode.ConfigurationTarget.Global);
    }
  });

  await check('a custom palette still outranks the theme palette', async () => {
    const workbench = vscode.workspace.getConfiguration('workbench');
    const before = workbench.get('colorTheme');

    try {
      await workbench.update('colorTheme', 'JSRay Ember Dark', vscode.ConfigurationTarget.Global);
      await vscode.workspace.getConfiguration('jsray').update(
        'customPalette',
        { themes: { dark: { tokens: { keyword: { color: '#00FFAA' } } } } },
        vscode.ConfigurationTarget.Global
      );

      const html = await vscode.commands.executeCommand(
        'markdown.api.render', '```js\nconst x = 1;\n```'
      );

      // Both blocks target [data-theme] at equal specificity, so the later one
      // wins. The custom block has to come second in the document.
      const themeAt = html.indexOf('data-jsray-theme-palette');
      const customAt = html.indexOf('data-jsray-custom-palette');
      assert.ok(themeAt !== -1, 'the theme palette is missing');
      assert.ok(customAt !== -1, 'the custom palette is missing');
      assert.ok(customAt > themeAt, 'the custom palette lands before the theme palette and loses');
    } finally {
      await vscode.workspace.getConfiguration('jsray').update(
        'customPalette', undefined, vscode.ConfigurationTarget.Global
      );
      await workbench.update('colorTheme', before, vscode.ConfigurationTarget.Global);
    }
  });

  await check('markdown preview contributions are declared', () => {
    const contributes = extension.packageJSON.contributes;
    assert.equal(contributes['markdown.markdownItPlugins'], true);
    assert.ok(contributes['markdown.previewScripts'].length >= 2);
    assert.ok(contributes['markdown.previewStyles'].length >= 1);
  });

  const failed = results.filter((r) => r.includes('FAIL'));
  console.log('\n=== extension host ===\n' + results.join('\n'));
  console.log(`\n${results.length - failed.length}/${results.length} passed inside VS Code\n`);

  if (failed.length) throw new Error(`${failed.length} assertion(s) failed in the extension host`);
}

module.exports = { run };
