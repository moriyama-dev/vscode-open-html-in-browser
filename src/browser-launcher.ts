import * as vscode from 'vscode';
import { openExtensionSettings, readBrowserOptions } from './config';
import { buildLaunchCommands, formatCommand } from './core/launch-commands';
import {
  BrowserNotFoundError,
  CustomBrowserPathError,
  DefaultBrowserUndetectedError,
  resolveBrowser,
} from './core/resolve-browser';
import { runLaunchCommands } from './core/run-launch';
import type { BrowserTarget, SystemDeps } from './core/types';

/** Opens local files in the configured browser and remembers the browser it found. */
export class BrowserLauncher implements vscode.Disposable {
  private target: Promise<BrowserTarget> | undefined;

  constructor(
    private readonly deps: SystemDeps,
    private readonly log: vscode.LogOutputChannel,
  ) {}

  clearCache(): void {
    this.target = undefined;
  }

  dispose(): void {
    this.clearCache();
  }

  async open(fileUri: vscode.Uri): Promise<void> {
    const options = readBrowserOptions();

    let target: BrowserTarget;
    try {
      this.target ??= resolveBrowser(options, this.deps);
      target = await this.target;
    } catch (error) {
      this.clearCache();
      await this.handleResolveError(error, fileUri);
      return;
    }

    const commands = buildLaunchCommands(target, fileUri.fsPath, this.deps.platform);
    try {
      const used = await runLaunchCommands(commands);
      this.log.info(`Opened with ${target.name}: ${formatCommand(used)}`);
    } catch (error) {
      this.clearCache();
      this.log.error(`Launching ${target.name} failed: ${errorMessage(error)}`);
      if (options.browser === 'default') {
        await this.fallBackToSystemHandler(fileUri);
      } else {
        await showErrorWithSettings(vscode.l10n.t('Failed to start {0}: {1}', target.name, errorMessage(error)));
      }
    }
  }

  private async handleResolveError(error: unknown, fileUri: vscode.Uri): Promise<void> {
    this.log.error(errorMessage(error));
    if (error instanceof DefaultBrowserUndetectedError) {
      await this.fallBackToSystemHandler(fileUri);
    } else if (error instanceof BrowserNotFoundError) {
      await showErrorWithSettings(
        error.searched.length === 0
          ? vscode.l10n.t('{0} is not available on this operating system.', error.displayName)
          : vscode.l10n.t(
              '{0} was not found. Install it, or choose another browser in the settings.',
              error.displayName,
            ),
      );
    } else if (error instanceof CustomBrowserPathError) {
      await showErrorWithSettings(
        error.customPath === ''
          ? vscode.l10n.t('Set the browser executable in "Custom Browser Path".')
          : vscode.l10n.t('The custom browser was not found: {0}', error.customPath),
      );
    } else {
      await showErrorWithSettings(vscode.l10n.t('Failed to open the browser: {0}', errorMessage(error)));
    }
  }

  /**
   * Last resort. The OS opens the file with whatever is associated with
   * .html, which is not always a browser, hence the warning.
   */
  private async fallBackToSystemHandler(fileUri: vscode.Uri): Promise<void> {
    await vscode.env.openExternal(fileUri);
    await showWarningWithSettings(
      vscode.l10n.t(
        'Could not detect the default browser, so the file was handed to the operating system. Choose a browser in the settings to make this reliable.',
      ),
    );
  }
}

async function showErrorWithSettings(message: string): Promise<void> {
  const openSettings = vscode.l10n.t('Open Settings');
  if ((await vscode.window.showErrorMessage(message, openSettings)) === openSettings) {
    await openExtensionSettings();
  }
}

async function showWarningWithSettings(message: string): Promise<void> {
  const openSettings = vscode.l10n.t('Open Settings');
  if ((await vscode.window.showWarningMessage(message, openSettings)) === openSettings) {
    await openExtensionSettings();
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
