import * as path from 'node:path';
import * as vscode from 'vscode';
import { StaticFileServer } from './core/file-server';

export type OpenExternal = (uri: vscode.Uri) => Thenable<boolean>;
export type AsExternalUri = (uri: vscode.Uri) => Thenable<vscode.Uri>;

/**
 * Opens files in remote windows (SSH, WSL, containers, Codespaces).
 *
 * The extension runs on the remote machine there, while the browser is on
 * the user's computer, so the file cannot be handed to the browser directly.
 * Instead the folder is served over HTTP on the remote's loopback interface,
 * VS Code forwards that port to the user's computer, and the forwarded URL
 * is opened there. Relative links to CSS, scripts and images keep working,
 * and an http URL always opens in a browser rather than in whatever the
 * .html file association points to.
 */
export class RemoteOpener implements vscode.Disposable {
  private readonly servers = new Map<string, Promise<StaticFileServer>>();

  constructor(
    private readonly log: vscode.LogOutputChannel,
    private readonly openExternal: OpenExternal = (uri) => vscode.env.openExternal(uri),
    private readonly asExternalUri: AsExternalUri = (uri) => vscode.env.asExternalUri(uri),
  ) {}

  async open(fileUri: vscode.Uri): Promise<void> {
    try {
      const url = await this.urlFor(fileUri);
      const external = await this.asExternalUri(vscode.Uri.parse(url, true));
      this.log.info(`Opening ${fileUri.fsPath} as ${external.toString(true)}`);
      if (!(await this.openExternal(external))) {
        this.log.warn('The browser was not opened.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.error(`Serving ${fileUri.fsPath} failed: ${message}`);
      void vscode.window.showErrorMessage(vscode.l10n.t('Failed to open the browser: {0}', message));
    }
  }

  /** The local URL that serves the file; exposed for tests. */
  async urlFor(fileUri: vscode.Uri): Promise<string> {
    const root = rootFor(fileUri);
    let server = this.servers.get(root);
    if (!server) {
      server = StaticFileServer.start(root);
      this.servers.set(root, server);
      server.then(
        (started) => this.log.info(`Serving ${root} on port ${started.port}`),
        () => this.servers.delete(root),
      );
    }
    const url = (await server).urlFor(fileUri.fsPath);
    if (!url) {
      throw new Error(`${fileUri.fsPath} is outside ${root}`);
    }
    return url;
  }

  dispose(): void {
    const servers = [...this.servers.values()];
    this.servers.clear();
    for (const server of servers) {
      server.then((started) => started.close()).catch(() => undefined);
    }
  }
}

/**
 * The workspace folder of the file, so pages can link to anything in the
 * project, or the file's own folder when it is not part of the workspace.
 */
function rootFor(fileUri: vscode.Uri): string {
  return vscode.workspace.getWorkspaceFolder(fileUri)?.uri.fsPath ?? path.dirname(fileUri.fsPath);
}
