#!/usr/bin/env node
/**
 * Run the same suite against the packaged extension rather than the checkout.
 *
 * run.mjs points VS Code at this directory with --extensionDevelopmentPath,
 * which loads the source tree. That proves the code works; it does not prove
 * the .vsix does. A file left out of the package, an entry .vscodeignore
 * swallows, a path that only resolves because a sibling folder happens to be
 * there — none of it shows up until someone installs the thing.
 *
 * So: build the package, install it into an extensions directory of its own,
 * and launch an editor that has it as an ordinary installed extension.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTests, downloadAndUnzipVSCode } from '@vscode/test-electron';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const LOCAL_APP = '/Applications/Visual Studio Code.app';
const LOCAL_ELECTRON = `${LOCAL_APP}/Contents/MacOS/Electron`;
const LOCAL_CLI = `${LOCAL_APP}/Contents/Resources/app/bin/code`;

const sandbox = mkdtempSync(join(tmpdir(), 'jsray-vsix-'));
const vsix = join(sandbox, 'jsray.vsix');
const extensionsDir = join(sandbox, 'extensions');
const userDataDir = join(sandbox, 'user-data');

const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });

try {
  console.log('packaging…');
  run('npx', ['--yes', '@vscode/vsce', 'package', '--allow-star-activation', '--out', vsix]);

  // The CLI that installs has to be the same build that will run, or the
  // install lands in a profile the test never opens.
  const cli = existsSync(LOCAL_CLI) ? LOCAL_CLI : null;
  const electron = existsSync(LOCAL_ELECTRON) ? LOCAL_ELECTRON : await downloadAndUnzipVSCode();

  console.log('installing the package into a directory of its own…');
  run(cli || electron, [
    ...(cli ? [] : ['--']),
    '--extensions-dir', extensionsDir,
    '--user-data-dir', userDataDir,
    '--install-extension', vsix,
    '--force',
  ]);

  console.log('running the suite against the installed copy…\n');
  await runTests({
    // No extensionDevelopmentPath: the editor has to find the extension the
    // way it finds any other, from the extensions directory.
    extensionTestsPath: resolve(ROOT, 'tests/integration/suite.js'),
    vscodeExecutablePath: existsSync(LOCAL_ELECTRON) ? LOCAL_ELECTRON : undefined,
    launchArgs: [
      '--disable-gpu',
      '--extensions-dir', extensionsDir,
      '--user-data-dir', userDataDir,
    ],
  });
} catch (error) {
  console.error('packaged-extension tests failed:', error.message);
  process.exitCode = 1;
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
