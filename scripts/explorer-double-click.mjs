// Double-clicks the fixture in the Explorer of a real VS Code window and
// reports what happened. The integration tests can only imitate the
// double-click through the API; this drives the actual mouse path through
// the Chrome DevTools Protocol, so it needs a display (use xvfb-run).
//
//   xvfb-run -a node scripts/explorer-double-click.mjs [gapMs] [screenshot.png]
//
// gapMs is the pause between the first click and the second; a human
// double-click is usually somewhere between 50 and 200 ms.
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gap = Number(process.argv[2] ?? 120);
const screenshot = process.argv[3];
const port = 9333 + Math.floor(Math.random() * 1000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const vscodeDir = path.join(repo, '.vscode-test');
const build = fs
  .readdirSync(vscodeDir)
  .filter((name) => name.startsWith('vscode-'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .pop();
if (!build) {
  console.error('No VS Code build under .vscode-test; run the integration tests once first.');
  process.exit(1);
}
const code = path.join(vscodeDir, build, 'code');

// Fresh profile with a stand-in browser that records what it was asked to open.
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'open-html-in-browser-ui-'));
const userData = path.join(work, 'user-data');
const recordFile = path.join(work, 'launches.txt');
const fakeBrowser = path.join(work, 'fake-browser');
fs.writeFileSync(fakeBrowser, `#!/bin/sh\nprintf '%s\\n' "$1" >> '${recordFile}'\n`, { mode: 0o755 });
fs.mkdirSync(path.join(userData, 'User'), { recursive: true });
fs.writeFileSync(
  path.join(userData, 'User', 'settings.json'),
  JSON.stringify({
    'openHtmlInBrowser.browser': 'custom',
    'openHtmlInBrowser.customBrowserPath': fakeBrowser,
    'window.dialogStyle': 'custom',
    'workbench.startupEditor': 'none',
    'security.workspace.trust.enabled': false,
    'update.mode': 'none',
    'telemetry.telemetryLevel': 'off',
  }),
);

// Inside a VS Code terminal ELECTRON_RUN_AS_NODE is set, which would turn the binary into plain Node.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const vscode = spawn(
  code,
  [
    `--extensionDevelopmentPath=${repo}`,
    '--disable-extensions',
    `--user-data-dir=${userData}`,
    `--extensions-dir=${path.join(work, 'extensions')}`,
    `--remote-debugging-port=${port}`,
    '--disable-workspace-trust',
    '--skip-welcome',
    '--skip-release-notes',
    '--disable-gpu',
    '--no-sandbox',
    path.join(repo, 'test/fixtures'),
  ],
  { stdio: 'ignore', env },
);

function finish(exitCode) {
  vscode.kill();
  fs.rmSync(work, { recursive: true, force: true });
  process.exit(exitCode);
}

let page;
for (let i = 0; i < 100 && !page; i++) {
  await sleep(300);
  try {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    page = targets.find((target) => target.type === 'page' && /workbench\.html/.test(target.url));
  } catch {
    // not listening yet
  }
}
if (!page) {
  console.error('VS Code did not open a debuggable window.');
  finish(1);
}

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => (socket.onopen = resolve));
const pending = new Map();
let nextId = 0;
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  pending.get(message.id)?.(message);
  pending.delete(message.id);
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, (message) => (message.error ? reject(new Error(message.error.message)) : resolve(message.result)));
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.text);
  }
  return result.value;
};
await send('Runtime.enable');
await send('Page.enable');

const findRow = `(() => {
  const row = [...document.querySelectorAll('.explorer-folders-view .monaco-list-row')]
    .find((candidate) => candidate.textContent.includes('sample page.html'));
  if (!row) return null;
  const box = row.getBoundingClientRect();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
})()`;
let row = null;
for (let i = 0; i < 100 && !row; i++) {
  await sleep(300);
  row = await evaluate(findRow);
}
if (!row) {
  console.error('The fixture did not show up in the Explorer.');
  finish(1);
}
await sleep(1500);

const click = async (type, clickCount) =>
  send('Input.dispatchMouseEvent', {
    type,
    x: row.x,
    y: row.y,
    button: 'left',
    clickCount,
    buttons: type === 'mousePressed' ? 1 : 0,
  });
await click('mouseMoved', 0);
await click('mousePressed', 1);
await click('mouseReleased', 1);
await sleep(gap);
await click('mousePressed', 2);
await click('mouseReleased', 2);
await sleep(3000);

const view = await evaluate(`(() => ({
  dialog: document.querySelector('.monaco-dialog-box')?.innerText.replace(/\\s+/g, ' ').trim() ?? null,
  tabs: [...document.querySelectorAll('.tabs-container .tab')].map((tab) => tab.querySelector('.tab-label')?.textContent),
}))()`);
if (screenshot) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(screenshot, Buffer.from(data, 'base64'));
}
const launches = fs.existsSync(recordFile) ? fs.readFileSync(recordFile, 'utf8').split('\n').filter(Boolean) : [];
const logs = path.join(userData, 'logs');
const rendererErrors = fs.existsSync(logs)
  ? fs
      .readdirSync(logs)
      .map((session) => path.join(logs, session, 'window1', 'renderer.log'))
      .filter((file) => fs.existsSync(file))
      .flatMap((file) => fs.readFileSync(file, 'utf8').split('\n'))
      .filter((line) => /\[error\]/.test(line) && !/DEP0169/.test(line))
  : [];

console.log(JSON.stringify({ build, gap, launches: launches.length, ...view, rendererErrors }, null, 2));
socket.close();
finish(view.dialog || rendererErrors.length > 0 || launches.length !== 1 || view.tabs.length !== 0 ? 1 : 0);
