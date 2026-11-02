import { spawn } from 'node:child_process';
import { formatCommand } from './launch-commands';
import type { LaunchCommand } from './types';

export type SpawnFn = typeof spawn;

const HELPER_TIMEOUT_MS = 15_000;

export class LaunchFailedError extends Error {
  constructor(readonly failures: string[]) {
    super(failures.join('; ') || 'no launch command available');
    this.name = 'LaunchFailedError';
  }
}

/** Tries each command in order and resolves with the first one that worked. */
export async function runLaunchCommands(
  commands: readonly LaunchCommand[],
  spawnFn: SpawnFn = spawn,
): Promise<LaunchCommand> {
  const failures: string[] = [];
  for (const command of commands) {
    try {
      await runLaunchCommand(command, spawnFn);
      return command;
    } catch (error) {
      failures.push(`${formatCommand(command)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new LaunchFailedError(failures);
}

export function runLaunchCommand(command: LaunchCommand, spawnFn: SpawnFn = spawn): Promise<void> {
  return new Promise((resolve, reject) => {
    // No shell: arguments are passed as-is, so spaces and non-ASCII
    // characters in the file name need no quoting.
    const child = spawnFn(command.command, command.args, {
      shell: false,
      detached: !command.waitForExit,
      stdio: command.waitForExit ? ['ignore', 'ignore', 'pipe'] : 'ignore',
    });

    let settled = false;
    let stderr = '';
    let timer: NodeJS.Timeout | undefined = undefined;
    const finish = (error?: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    child.once('error', (error) => finish(error));

    if (!command.waitForExit) {
      child.once('spawn', () => {
        child.unref();
        finish();
      });
      return;
    }

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once('close', (code, signal) => {
      if (code === 0) {
        finish();
      } else {
        const reason = stderr.trim() || `exited with ${code ?? signal}`;
        finish(new Error(reason));
      }
    });
    // A helper that has not returned yet has most likely handed the file over.
    timer = setTimeout(() => {
      child.unref();
      finish();
    }, HELPER_TIMEOUT_MS);
  });
}
