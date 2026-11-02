import * as vscode from 'vscode';
import { BrowserLauncher } from './browser-launcher';
import { CONFIG_SECTION } from './config';
import { createNodeSystem } from './core/system';
import { maybeSuggestDoubleClick } from './double-click-prompt';
import { LAUNCHER_VIEW_TYPE, LauncherEditorProvider } from './launcher-editor';
import { registerOpenCommand } from './open-command';

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel('Open HTML in Browser', { log: true });
  const launcher = new BrowserLauncher(createNodeSystem(), log);

  context.subscriptions.push(
    log,
    launcher,
    registerOpenCommand(launcher),
    vscode.window.registerCustomEditorProvider(LAUNCHER_VIEW_TYPE, new LauncherEditorProvider(launcher), {
      supportsMultipleEditorsPerDocument: true,
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_SECTION)) {
        launcher.clearCache();
      }
    }),
  );

  void maybeSuggestDoubleClick(context);
}

export function deactivate(): void {}
