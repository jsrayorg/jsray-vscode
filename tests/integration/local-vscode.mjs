/**
 * Locate the VS Code already installed on this machine.
 *
 * Both runners prefer a local build: it is the same build a user would run,
 * and it saves a 300MB download on every run. The executable inside the app
 * bundle has not always had the same name — it was Electron for years and is
 * Code now — so look for either rather than hard-coding one. A wrong guess
 * here is silent: the runner simply downloads a whole editor instead.
 */
import { existsSync } from 'node:fs';

const APP = '/Applications/Visual Studio Code.app';

const first = (...paths) => paths.find((p) => existsSync(p)) || null;

/** Path to the local VS Code executable, or null when there is none. */
export const localVSCode = () =>
  first(`${APP}/Contents/MacOS/Code`, `${APP}/Contents/MacOS/Electron`);

/** Path to the CLI of that same build, or null when there is none. */
export const localVSCodeCLI = () => first(`${APP}/Contents/Resources/app/bin/code`);
