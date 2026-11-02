import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

const EXTENSION_ID = 'takumi.open-html-in-browser';

async function waitFor(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function customTabs(): vscode.Tab[] {
  return vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter((tab) => tab.input instanceof vscode.TabInputCustom);
}

describe('Open HTML in Browser', () => {
  const config = () => vscode.workspace.getConfiguration('openHtmlInBrowser');
  let fixture: vscode.Uri;

  before(async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, 'the test workspace must be open');
    fixture = vscode.Uri.joinPath(folder.uri, 'sample page.html');
    // Keep the tests from starting a real browser.
    await config().update('openOnDoubleClick', false, vscode.ConfigurationTarget.Global);
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
  });

  after(async () => {
    await config().update('openOnDoubleClick', undefined, vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  it('registers the open command', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('openHtmlInBrowser.open'));
  });

  it('uses the documented defaults', () => {
    const inspect = <T>(key: string) => config().inspect<T>(key)?.defaultValue;
    assert.equal(inspect<string>('browser'), 'default');
    assert.equal(inspect<string>('customBrowserPath'), '');
    assert.equal(inspect<boolean>('openOnDoubleClick'), true);
    assert.equal(inspect<boolean>('alsoOpenInEditor'), true);
  });

  it('reopens the file in the text editor and closes its own tab', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await vscode.commands.executeCommand('vscode.openWith', fixture, 'openHtmlInBrowser.launcher');

    await waitFor(() => vscode.window.activeTextEditor?.document.uri.toString() === fixture.toString());
    await waitFor(() => customTabs().length === 0);

    // Give a runaway reopen loop the chance to show up.
    await new Promise((resolve) => setTimeout(resolve, 500));
    const tabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);
    assert.equal(tabs.length, 1);
    assert.ok(tabs[0].input instanceof vscode.TabInputText);
  });
});
