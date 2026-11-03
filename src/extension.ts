import * as vscode from 'vscode';
import { BrowserLauncher } from './browser-launcher';
import { CONFIG_SECTION } from './config';
import { createNodeSystem } from './core/system';
import { createHtmlOpener } from './html-opener';
import { LAUNCHER_VIEW_TYPE, LauncherEditorProvider } from './launcher-editor';
import { registerOpenCommand } from './open-command';
import { RemoteOpener } from './remote-opener';

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel('Open HTML in Browser', { log: true });
  const launcher = new BrowserLauncher(createNodeSystem(), log);
  const remote = new RemoteOpener(log);
  const opener = createHtmlOpener(launcher, remote);

  context.subscriptions.push(
    log,
    launcher,
    remote,
    registerOpenCommand(opener),
    vscode.window.registerCustomEditorProvider(LAUNCHER_VIEW_TYPE, new LauncherEditorProvider(opener), {
      supportsMultipleEditorsPerDocument: true,
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_SECTION)) {
        launcher.clearCache();
      }
    }),
  );
}

export function deactivate(): void {}
