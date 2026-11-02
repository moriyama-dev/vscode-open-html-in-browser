import { toFileUri } from './file-uri';
import type { BrowserTarget, LaunchCommand } from './types';
import { substitutePlaceholders } from './windows';

/**
 * Builds the commands that open `filePath` in `target`, in the order they
 * should be tried. Pure, so every platform can be covered by unit tests.
 */
export function buildLaunchCommands(
  target: BrowserTarget,
  filePath: string,
  platform: NodeJS.Platform,
): LaunchCommand[] {
  switch (target.kind) {
    case 'mac-bundle':
      return [{ command: '/usr/bin/open', args: ['-b', target.bundleId, filePath], waitForExit: true }];

    case 'mac-app':
      return [{ command: '/usr/bin/open', args: ['-a', target.appPath, filePath], waitForExit: true }];

    case 'linux-desktop': {
      const uri = toFileUri(filePath, platform);
      const commands: LaunchCommand[] = [];
      if (target.gtkLaunchPath) {
        commands.push({ command: target.gtkLaunchPath, args: [target.desktopId, uri], waitForExit: true });
      }
      if (target.gioPath && target.desktopPath) {
        commands.push({ command: target.gioPath, args: ['launch', target.desktopPath, uri], waitForExit: true });
      }
      return commands;
    }

    case 'windows-command':
      // The registered command is the http URL handler, so it gets a URL.
      return [
        {
          command: target.executable,
          args: substitutePlaceholders(target.args, toFileUri(filePath, platform)),
          waitForExit: false,
        },
      ];

    case 'executable':
      return [{ command: target.executable, args: [filePath], waitForExit: false }];
  }
}

/** Renders a command for logs and diagnostics. Never used to execute anything. */
export function formatCommand(command: LaunchCommand): string {
  return [command.command, ...command.args]
    .map((part) => (/[\s"'$`\\]/.test(part) ? JSON.stringify(part) : part))
    .join(' ');
}
