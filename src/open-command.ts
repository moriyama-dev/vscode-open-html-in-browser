import * as vscode from 'vscode';
import type { BrowserLauncher } from './browser-launcher';
import { isRemoteWindow } from './config';

export const OPEN_COMMAND = 'openHtmlInBrowser.open';

export function registerOpenCommand(launcher: BrowserLauncher): vscode.Disposable {
  return vscode.commands.registerCommand(OPEN_COMMAND, (uri?: vscode.Uri, selected?: vscode.Uri[]) =>
    openInBrowser(launcher, uri, selected),
  );
}

/**
 * `uri` is set when invoked from a menu; `selected` holds every file when
 * several are selected in the Explorer. From the keyboard or the Command
 * Palette neither is set and the active editor is used.
 */
async function openInBrowser(launcher: BrowserLauncher, uri?: vscode.Uri, selected?: vscode.Uri[]): Promise<void> {
  if (isRemoteWindow()) {
    void vscode.window.showInformationMessage(vscode.l10n.t('Open in Browser is not supported in remote windows yet.'));
    return;
  }

  const targets = selected && selected.length > 0 ? selected : uri ? [uri] : activeEditorUri();
  if (targets.length === 0) {
    void vscode.window.showInformationMessage(vscode.l10n.t('Open an HTML file first.'));
    return;
  }

  for (const target of targets) {
    if (target.scheme === 'untitled') {
      void vscode.window.showInformationMessage(vscode.l10n.t('Save the file before opening it in a browser.'));
      continue;
    }
    if (target.scheme !== 'file') {
      void vscode.window.showInformationMessage(
        vscode.l10n.t('Only files on this computer can be opened in a browser.'),
      );
      continue;
    }
    const document = vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === target.toString());
    if (document?.isDirty && !(await document.save())) {
      continue;
    }
    await launcher.open(target);
  }
}

function activeEditorUri(): vscode.Uri[] {
  const uri = vscode.window.activeTextEditor?.document.uri;
  return uri ? [uri] : [];
}
