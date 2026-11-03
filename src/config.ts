import * as vscode from 'vscode';
import type { BrowserOptions, BrowserSetting } from './core/types';

export const CONFIG_SECTION = 'openHtmlInBrowser';

export function readBrowserOptions(): BrowserOptions {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return {
    browser: config.get<BrowserSetting>('browser', 'default'),
    customBrowserPath: config.get<string>('customBrowserPath', ''),
  };
}

export function openOnDoubleClick(): boolean {
  return vscode.workspace.getConfiguration(CONFIG_SECTION).get<boolean>('openOnDoubleClick', true);
}

export function alsoOpenInEditor(): boolean {
  return vscode.workspace.getConfiguration(CONFIG_SECTION).get<boolean>('alsoOpenInEditor', false);
}

export function isRemoteWindow(): boolean {
  return vscode.env.remoteName !== undefined;
}

export async function openExtensionSettings(): Promise<void> {
  await vscode.commands.executeCommand(
    'workbench.action.openSettings',
    `@ext:moriyama-dev.vscode-open-html-in-browser`,
  );
}
