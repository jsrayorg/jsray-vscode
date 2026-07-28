#!/usr/bin/env node
/**
 * Launch a real VS Code and run tests/integration/suite.js inside its
 * extension host.
 *
 * Reuses the VS Code already installed on this machine when there is one, so
 * the suite exercises the same build a user would run and no 150MB download is
 * needed. Falls back to a downloaded stable build otherwise (CI).
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTests } from '@vscode/test-electron';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const LOCAL_VSCODE = '/Applications/Visual Studio Code.app/Contents/MacOS/Electron';

try {
  await runTests({
    extensionDevelopmentPath: ROOT,
    extensionTestsPath: resolve(ROOT, 'tests/integration/suite.js'),
    vscodeExecutablePath: existsSync(LOCAL_VSCODE) ? LOCAL_VSCODE : undefined,
    // A clean profile: the assertions touch global settings (theme, palette),
    // and they must not reach the developer's own VS Code configuration.
    launchArgs: [
      '--disable-extensions',
      '--disable-gpu',
      '--user-data-dir', resolve(ROOT, '.vscode-test-profile'),
    ],
  });
} catch (error) {
  console.error('extension host tests failed:', error.message);
  process.exit(1);
}
