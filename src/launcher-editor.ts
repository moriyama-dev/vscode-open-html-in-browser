import * as vscode from 'vscode';
import type { BrowserLauncher } from './browser-launcher';
import { alsoOpenInEditor, isRemoteWindow, openOnDoubleClick } from './config';

export const LAUNCHER_VIEW_TYPE = 'openHtmlInBrowser.launcher';

/**
 * VS Code has no API for Explorer double-clicks, so this registers itself as
 * the default editor for HTML files. Its tab is never shown: it starts the
 * browser, optionally reopens the file in the text editor, and closes itself.
 *
 * Reopening uses the built-in "default" text editor rather than this one,
 * so it cannot trigger itself again.
 */
export class LauncherEditorProvider implements vscode.CustomReadonlyEditorProvider {
  constructor(private readonly launcher: BrowserLauncher) {}

  openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
    return { uri, dispose: () => undefined };
  }

  async resolveCustomEditor(document: vscode.CustomDocument, panel: vscode.WebviewPanel): Promise<void> {
    const uri = document.uri;
    // Non-file schemes (git:, the left side of a diff, ...) only get the text editor.
    const launchBrowser = uri.scheme === 'file' && !isRemoteWindow() && openOnDoubleClick();
    const openText = !launchBrowser || alsoOpenInEditor();

    // Started first, awaited last, so the text editor does not wait for the browser.
    const launching = launchBrowser ? this.launcher.open(uri) : Promise.resolve();
    try {
      if (openText) {
        await vscode.commands.executeCommand('vscode.openWith', uri, 'default', panel.viewColumn);
      }
    } finally {
      panel.dispose();
    }
    await launching;
  }
}
