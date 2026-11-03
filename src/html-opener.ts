import type * as vscode from 'vscode';
import type { BrowserLauncher } from './browser-launcher';
import { isRemoteWindow } from './config';
import type { RemoteOpener } from './remote-opener';

/** Opens one saved local file in a browser. */
export interface HtmlOpener {
  open(fileUri: vscode.Uri): Promise<void>;
}

/**
 * Starts the browser directly in a local window, and serves the file through
 * a forwarded port in a remote window, where the browser is on another machine.
 */
export function createHtmlOpener(local: BrowserLauncher, remote: RemoteOpener): HtmlOpener {
  return {
    open: (fileUri) => (isRemoteWindow() ? remote.open(fileUri) : local.open(fileUri)),
  };
}
