import * as vscode from 'vscode';
import { isRemoteWindow, openOnDoubleClick } from './config';

const DISMISSED_KEY = 'doubleClickPromptDismissed';

/**
 * With the default single-click open mode, merely selecting an HTML file in
 * the Explorer would start the browser. Offer to switch, but never change
 * the user's settings without asking.
 */
export async function maybeSuggestDoubleClick(context: vscode.ExtensionContext): Promise<void> {
  if (context.globalState.get<boolean>(DISMISSED_KEY) || !openOnDoubleClick() || isRemoteWindow()) {
    return;
  }
  const listConfig = vscode.workspace.getConfiguration('workbench.list');
  if (listConfig.get<string>('openMode') === 'doubleClick') {
    return;
  }

  const change = vscode.l10n.t('Change');
  const notNow = vscode.l10n.t('Not Now');
  const never = vscode.l10n.t("Don't Show Again");
  const choice = await vscode.window.showInformationMessage(
    vscode.l10n.t(
      'A single click on an HTML file in the Explorer also opens the browser. Switch the Explorer to open files with a double-click?',
    ),
    change,
    notNow,
    never,
  );

  if (choice === change) {
    await listConfig.update('openMode', 'doubleClick', vscode.ConfigurationTarget.Global);
  } else if (choice === never) {
    await context.globalState.update(DISMISSED_KEY, true);
  }
}
