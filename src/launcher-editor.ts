import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { alsoOpenInEditor, openOnDoubleClick } from './config';
import type { HtmlOpener } from './html-opener';

export const LAUNCHER_VIEW_TYPE = 'openHtmlInBrowser.launcher';

/** Upper bound for waiting on the webview, e.g. when it was opened in the background and never renders. */
const READY_TIMEOUT_MS = 1500;

type AttachOutcome = 'ready' | 'disposed' | 'timeout';

/**
 * VS Code has no API for Explorer double-clicks, so this registers itself as
 * the default editor for HTML files and tells the two apart by the tab it is
 * given: a single click opens a preview tab, a double-click a pinned one.
 *
 * A preview open is handed to the text editor as if nothing happened; a
 * pinned open starts the browser. Either way this editor's own tab is closed.
 *
 * Reopening uses the built-in "default" text editor rather than this one,
 * so it cannot trigger itself again.
 */
export class LauncherEditorProvider implements vscode.CustomReadonlyEditorProvider {
  constructor(private readonly opener: HtmlOpener) {}

  openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
    return { uri, dispose: () => undefined };
  }

  resolveCustomEditor(document: vscode.CustomDocument, panel: vscode.WebviewPanel): void {
    const uri = document.uri;
    // Non-file schemes (git:, the left side of a diff, ...) only get the text editor.
    const canLaunch = uri.scheme === 'file' && openOnDoubleClick();
    let launching: Promise<void> | undefined;
    if (canLaunch && isPinned(uri)) {
      launching = this.opener.open(uri);
    }

    // Closing or replacing the tab before VS Code has finished attaching the
    // webview makes the whole open fail with "OverlayWebview has been
    // disposed", so everything that touches the tab waits for the page to load.
    void whenAttached(panel).then(async (outcome) => {
      if (outcome === 'disposed') {
        // VS Code already took the tab away, e.g. another preview replaced it.
        if (launching) {
          await closePreviewTextTabs(uri);
          await launching;
        }
        return;
      }
      const viewColumn = panel.viewColumn;
      // The second click of a double-click pins the tab while the page from
      // the first click is still loading, so the decision is made again here.
      const pinned = isPinned(uri);
      if (canLaunch && pinned && !launching) {
        launching = this.opener.open(uri);
      }
      try {
        if (!launching) {
          await vscode.commands.executeCommand('vscode.openWith', uri, 'default', { viewColumn, preview: !pinned });
        } else if (alsoOpenInEditor()) {
          await vscode.commands.executeCommand('vscode.openWith', uri, 'default', { viewColumn, preview: false });
        } else {
          // The first click of the double-click already opened a preview; drop it.
          await closePreviewTextTabs(uri);
        }
      } finally {
        await closeOwnTab(uri, panel);
      }
      await launching;
    });
  }
}

/**
 * Resolves once the webview has loaded, which only happens after VS Code has
 * attached it to the editor, or when it is disposed or the timeout passes.
 */
function whenAttached(panel: vscode.WebviewPanel): Promise<AttachOutcome> {
  return new Promise((resolve) => {
    const subscriptions: vscode.Disposable[] = [];
    const done = (outcome: AttachOutcome): void => {
      clearTimeout(timer);
      for (const subscription of subscriptions) {
        subscription.dispose();
      }
      resolve(outcome);
    };
    const timer = setTimeout(() => done('timeout'), READY_TIMEOUT_MS);
    subscriptions.push(
      panel.webview.onDidReceiveMessage(() => done('ready')),
      panel.onDidDispose(() => done('disposed')),
    );

    // The only script posts a single message so the extension knows the page is up.
    panel.webview.options = { enableScripts: true, localResourceRoots: [] };
    const nonce = randomBytes(16).toString('base64');
    panel.webview.html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}';">
</head>
<body>
<script nonce="${nonce}">acquireVsCodeApi().postMessage('ready');</script>
</body>
</html>`;
  });
}

/** A tab that is not in the tab model (yet) is treated as pinned, like an open from Quick Open. */
function isPinned(uri: vscode.Uri): boolean {
  return !(findOwnTab(uri)?.isPreview ?? false);
}

function findOwnTab(uri: vscode.Uri): vscode.Tab | undefined {
  return allTabs().find(
    (tab) =>
      tab.input instanceof vscode.TabInputCustom &&
      tab.input.viewType === LAUNCHER_VIEW_TYPE &&
      tab.input.uri.toString() === uri.toString(),
  );
}

/**
 * Closes through the tab API rather than `panel.dispose()`. Closing a tab
 * first cancels an open of that editor that is still running and only then
 * throws the webview away; disposing the panel does it the other way round,
 * and an open caught in between fails with "OverlayWebview has been disposed".
 */
async function closeOwnTab(uri: vscode.Uri, panel: vscode.WebviewPanel): Promise<void> {
  const tab = findOwnTab(uri);
  if (tab && (await vscode.window.tabGroups.close(tab, true))) {
    return;
  }
  panel.dispose();
}

async function closePreviewTextTabs(uri: vscode.Uri): Promise<void> {
  const previews = allTabs().filter(
    (tab) =>
      tab.isPreview &&
      !tab.isDirty &&
      tab.input instanceof vscode.TabInputText &&
      tab.input.uri.toString() === uri.toString(),
  );
  if (previews.length > 0) {
    await vscode.window.tabGroups.close(previews, true);
  }
}

function allTabs(): vscode.Tab[] {
  return vscode.window.tabGroups.all.flatMap((group) => group.tabs);
}
