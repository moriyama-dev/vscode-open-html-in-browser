import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { RemoteOpener } from '../../src/remote-opener';

const EXTENSION_ID = 'moriyama-dev.vscode-open-html-in-browser';
const VIEW_TYPE = 'openHtmlInBrowser.launcher';

async function waitFor(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await sleep(50);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http
      .get(url, { agent: false }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (body += chunk));
        res.on('end', () => (res.statusCode === 200 ? resolve(body) : reject(new Error(`HTTP ${res.statusCode}`))));
      })
      .on('error', reject);
  });
}

function allTabs(): vscode.Tab[] {
  return vscode.window.tabGroups.all.flatMap((group) => group.tabs);
}

function customTabs(): vscode.Tab[] {
  return allTabs().filter((tab) => tab.input instanceof vscode.TabInputCustom);
}

describe('Open HTML in Browser', () => {
  const config = () => vscode.workspace.getConfiguration('openHtmlInBrowser');
  let fixture: vscode.Uri;
  let recordFile: string;

  /** Arguments the fake browser has been started with, one launch per line. */
  const launches = (): string[] =>
    fs.existsSync(recordFile) ? fs.readFileSync(recordFile, 'utf8').split('\n').filter(Boolean) : [];

  before(async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, 'the test workspace must be open');
    fixture = vscode.Uri.joinPath(folder.uri, 'sample page.html');

    // A stand-in browser that records the file it was asked to open.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-html-in-browser-'));
    recordFile = path.join(dir, 'launches.txt');
    const fakeBrowser = path.join(dir, 'fake-browser');
    fs.writeFileSync(fakeBrowser, `#!/bin/sh\nprintf '%s\\n' "$1" >> '${recordFile}'\n`, { mode: 0o755 });

    await config().update('browser', 'custom', vscode.ConfigurationTarget.Global);
    await config().update('customBrowserPath', fakeBrowser, vscode.ConfigurationTarget.Global);
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
  });

  beforeEach(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    fs.rmSync(recordFile, { force: true });
  });

  afterEach(async () => {
    await config().update('openOnDoubleClick', undefined, vscode.ConfigurationTarget.Global);
    await config().update('alsoOpenInEditor', undefined, vscode.ConfigurationTarget.Global);
  });

  after(async () => {
    await config().update('browser', undefined, vscode.ConfigurationTarget.Global);
    await config().update('customBrowserPath', undefined, vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  it('is installed under the published extension ID', () => {
    assert.ok(vscode.extensions.getExtension(EXTENSION_ID));
  });

  it('registers the open command', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('openHtmlInBrowser.open'));
  });

  it('uses the documented defaults', () => {
    const defaultOf = <T>(key: string) => config().inspect<T>(key)?.defaultValue;
    assert.equal(defaultOf<string>('browser'), 'default');
    assert.equal(defaultOf<string>('customBrowserPath'), '');
    assert.equal(defaultOf<boolean>('openOnDoubleClick'), true);
    assert.equal(defaultOf<boolean>('alsoOpenInEditor'), false);
  });

  it('opens a preview (single click) in the text editor without starting the browser', async () => {
    await vscode.commands.executeCommand('vscode.openWith', fixture, VIEW_TYPE, { preview: true });

    await waitFor(() => vscode.window.activeTextEditor?.document.uri.toString() === fixture.toString());
    await waitFor(() => customTabs().length === 0);
    await sleep(500);
    const tabs = allTabs();
    assert.equal(tabs.length, 1);
    assert.ok(tabs[0].input instanceof vscode.TabInputText);
    assert.equal(tabs[0].isPreview, true);
    assert.deepEqual(launches(), []);
  });

  it('starts only the browser for a pinned open (double-click)', async () => {
    await vscode.commands.executeCommand('vscode.openWith', fixture, VIEW_TYPE, { preview: false });

    await waitFor(() => launches().length > 0);
    await waitFor(() => customTabs().length === 0);
    await sleep(500);
    assert.deepEqual(launches(), [fixture.fsPath]);
    assert.equal(allTabs().length, 0);
  });

  it('handles click then double-click: browser starts and the preview tab is closed', async () => {
    // What the Explorer does: the first click opens a preview, the second pins it.
    await vscode.commands.executeCommand('vscode.open', fixture, { preview: true });
    await waitFor(() => vscode.window.activeTextEditor?.document.uri.toString() === fixture.toString());
    await vscode.commands.executeCommand('vscode.open', fixture, { preview: false });

    await waitFor(() => launches().length > 0);
    await waitFor(() => allTabs().length === 0);
    assert.deepEqual(launches(), [fixture.fsPath]);
  });

  it('starts the browser once however quickly the double-click follows the first click', async function () {
    this.timeout(60000);
    // The pinned open from the second click can arrive while the preview from
    // the first click is still being set up; the outcome must not depend on it.
    for (const delay of [0, 20, 40, 80, 150]) {
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      fs.rmSync(recordFile, { force: true });

      const first = vscode.commands.executeCommand('vscode.open', fixture, { preview: true, preserveFocus: true });
      await sleep(delay);
      const second = vscode.commands.executeCommand('vscode.open', fixture, { preview: false });
      await Promise.all([first, second]);

      await waitFor(() => launches().length > 0 && allTabs().length === 0);
      await sleep(500);
      assert.deepEqual(launches(), [fixture.fsPath], `delay ${delay}ms`);
      assert.equal(allTabs().length, 0, `delay ${delay}ms`);
    }
  });

  it('also opens the text editor when alsoOpenInEditor is enabled', async () => {
    await config().update('alsoOpenInEditor', true, vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('vscode.openWith', fixture, VIEW_TYPE, { preview: false });

    await waitFor(() => launches().length > 0);
    await waitFor(() => customTabs().length === 0 && allTabs().length === 1);
    const [tab] = allTabs();
    assert.ok(tab.input instanceof vscode.TabInputText);
    assert.equal(tab.isPreview, false);
  });

  it('never starts the browser when openOnDoubleClick is disabled', async () => {
    await config().update('openOnDoubleClick', false, vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('vscode.openWith', fixture, VIEW_TYPE, { preview: false });

    await waitFor(() => vscode.window.activeTextEditor?.document.uri.toString() === fixture.toString());
    await sleep(500);
    assert.deepEqual(launches(), []);
    assert.equal(customTabs().length, 0);
  });

  it('opens the file from the command', async () => {
    await vscode.commands.executeCommand('openHtmlInBrowser.open', fixture);
    await waitFor(() => launches().length > 0);
    assert.deepEqual(launches(), [fixture.fsPath]);
  });

  describe('in remote windows', () => {
    const log = vscode.window.createOutputChannel('Open HTML in Browser (test)', { log: true });
    let opened: vscode.Uri[];
    let remote: RemoteOpener;

    beforeEach(() => {
      opened = [];
      remote = new RemoteOpener(log, (uri) => {
        opened.push(uri);
        return Promise.resolve(true);
      });
    });

    afterEach(() => remote.dispose());

    it('opens the file through a local HTTP URL that serves it', async () => {
      await remote.open(fixture);

      assert.equal(opened.length, 1);
      const url = opened[0].toString(true);
      assert.match(url, /^http:\/\/(127\.0\.0\.1|localhost):\d+\//);
      assert.equal(await httpGet(url), fs.readFileSync(fixture.fsPath, 'utf8'));
    });

    it('reuses one server for files in the same folder', async () => {
      const first = new URL(await remote.urlFor(fixture));
      const second = new URL(await remote.urlFor(fixture));
      assert.equal(first.port, second.port);
    });

    it("serves a file outside the workspace from the file's own folder", async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-html-in-browser-outside-'));
      const page = path.join(dir, 'page.html');
      fs.writeFileSync(page, '<p>outside</p>');
      fs.writeFileSync(path.join(dir, 'style.css'), 'p{}');

      const url = await remote.urlFor(vscode.Uri.file(page));
      assert.equal(await httpGet(url), '<p>outside</p>');
      assert.equal(await httpGet(new URL('style.css', url).toString()), 'p{}');
    });

    it('stops serving once disposed', async () => {
      const url = await remote.urlFor(fixture);
      remote.dispose();
      await sleep(200);
      await assert.rejects(httpGet(url));
    });
  });
});
