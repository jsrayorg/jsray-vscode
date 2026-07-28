#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const read = (path) => readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const fail = [];

function expect(condition, message) {
  if (!condition) fail.push(message);
}

const release = json('version.json');
const pkg = json('package.json');
const version = release.version;
const channel = release.channel;

expect(release.project === 'jsray-vscode', 'version.json project must be jsray-vscode');
expect(typeof version === 'string' && /^\d+\.\d+\.\d+-(internal|beta)\.\d+$|^\d+\.\d+\.\d+$/.test(version), `version.json has an unsupported version: ${version}`);
expect(['internal', 'beta', 'stable'].includes(channel), `version.json has an unsupported channel: ${channel}`);

if (channel === 'internal') {
  expect(/-internal\.\d+$/.test(version), 'internal channel versions must end with -internal.N');
  expect(release.publicBetaReleased === false, 'internal channel must keep publicBetaReleased false');
  expect(pkg.private === true, 'internal channel must keep package.json private true');
}

if (channel === 'stable') {
  expect(!version.includes('-'), 'stable channel versions must not include a prerelease suffix');
}

expect(pkg.version === version, `package.json version ${pkg.version} does not match ${version}`);
expect(release.bundledCore?.project === 'jsray', 'bundledCore.project must be jsray');
expect(typeof release.bundledCore?.version === 'string', 'bundledCore.version must be set');
expect(typeof pkg.engines?.vscode === 'string', 'package.json must declare engines.vscode');

// Every contributed theme path must exist, and every palette must have
// generated dark + light themes.
for (const entry of pkg.contributes?.themes || []) {
  expect(existsSync(entry.path), `contributed theme missing on disk: ${entry.path}`);
}
for (const rel of [...(pkg.contributes?.['markdown.previewStyles'] || []), ...(pkg.contributes?.['markdown.previewScripts'] || [])]) {
  expect(existsSync(rel), `contributed markdown asset missing on disk: ${rel}`);
}
if (existsSync('palettes')) {
  for (const f of readdirSync('palettes').filter((f) => f.endsWith('.json'))) {
    const id = f.replace(/\.json$/, '');
    for (const mode of ['dark', 'light']) {
      expect(existsSync(`themes/jsray-${id}-${mode}-color-theme.json`),
        `palette ${f} has no generated ${mode} theme — run npm run build`);
    }
  }
}

// Opportunistic drift check against a sibling Core checkout.
// Day-to-day drift is ADVISORY (integrations batch Core updates); it only
// fails in strict mode: JSRAY_STRICT_DRIFT=1 or --strict (packaging/release).
// Documentation baseline, shared with Core: both READMEs keep the Core-vs-integration
// boundary statement, and the governance files are present.
const includes = (path, needle, label = needle) =>
  expect(existsSync(path) && read(path).includes(needle), `${path} is missing ${label}`);
includes('README.md', 'bundles a snapshot', 'the Core snapshot boundary statement');
includes('README.zh-CN.md', '内置 Core 的快照', 'the Core snapshot boundary statement');
for (const doc of ['LICENSE', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CODE_OF_CONDUCT.md']) {
  expect(existsSync(doc), `${doc} missing — the ecosystem baseline requires it`);
}

for (const file of ['vocabulary.json', 'core-integrity.json', 'extension.js']) {
  expect(existsSync(file), `${file} missing — run 'sh tools/sync-core.sh'`);
}

// The extension must actually verify what it ships, or the manifest is a lie.
// Anything listed here has to be shipped in the .vsix — a manifest entry for an
// ignored file makes every install report itself as modified.
const integrity = json('core-integrity.json');
expect(integrity.version === release.bundledCore.version,
  `core-integrity.json pins Core ${integrity.version} but bundledCore.version is ${release.bundledCore.version}`);
for (const [file, digest] of Object.entries(integrity.files ?? {})) {
  if (!existsSync(file)) { fail.push(`core-integrity.json lists ${file}, which is missing`); continue; }
  const actual = 'sha256-' + createHash('sha256').update(readFileSync(file)).digest('base64');
  expect(actual === digest, `${file} does not match its pinned digest — the bundled Core was modified`);
}
expect(pkg.main === './extension.js', 'package.json must declare the extension entry point');

const strictDrift = process.env.JSRAY_STRICT_DRIFT === '1' || process.argv.includes('--strict');
const warns = [];
const expectDrift = (condition, message) => {
  if (!condition) (strictDrift ? fail : warns).push(message);
};
const coreDir = process.env.JSRAY_CORE_DIR || '../jsray';
const coreDist = resolve(coreDir, 'dist');
if (existsSync(coreDist)) {
  const bundlePairs = [
    ['media/jsray.js', resolve(coreDist, 'jsray.js')],
    ['media/jsray.css', resolve(coreDist, 'jsray.css')],
    ['media/themes/default.css', resolve(coreDist, 'themes/default.css')],
    ['palettes/default.json', resolve(coreDir, 'tokens.json')],
  ];
  for (const [bundled, core] of bundlePairs) {
    if (!existsSync(core) || !existsSync(bundled)) continue;
    expectDrift(read(bundled) === read(core),
      `bundled ${bundled} differs from Core ${core} — run 'sh tools/sync-core.sh'`);
  }
  const coreVersionPath = resolve(coreDir, 'version.json');
  if (existsSync(coreVersionPath)) {
    const coreRelease = json(coreVersionPath);
    expectDrift(release.bundledCore.version === coreRelease.version,
      `bundledCore.version ${release.bundledCore.version} != Core ${coreRelease.version} — run 'sh tools/sync-core.sh'`);
  }
}

if (warns.length) {
  console.warn('Core drift (advisory — sync before this integration\'s next release):');
  for (const message of warns) console.warn(`- ${message}`);
}

if (fail.length) {
  console.error('Version metadata check failed:');
  for (const message of fail) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log(`version metadata ok: ${version} (${channel}), bundled core ${release.bundledCore.version}`);
