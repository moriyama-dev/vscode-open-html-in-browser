import assert from 'node:assert/strict';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import { LaunchFailedError, runLaunchCommand, runLaunchCommands, type SpawnFn } from '../../src/core/run-launch';
import type { LaunchCommand } from '../../src/core/types';

type Outcome = { exitCode: number; stderr?: string } | { error: string } | 'spawned';

/** A spawn replacement that records calls and plays back a scripted outcome per command. */
function fakeSpawn(outcomes: Record<string, Outcome>) {
  const calls: { command: string; args: string[]; options: SpawnOptions }[] = [];
  const spawnFn = ((command: string, args: string[], options: SpawnOptions) => {
    calls.push({ command, args, options });
    const child = new EventEmitter() as ChildProcess;
    const stderr = new EventEmitter();
    Object.assign(child, { stderr, unref: () => undefined });
    const outcome = outcomes[command];
    setImmediate(() => {
      if (outcome === 'spawned') {
        child.emit('spawn');
      } else if ('error' in outcome) {
        child.emit('error', new Error(outcome.error));
      } else {
        child.emit('spawn');
        if (outcome.stderr) {
          stderr.emit('data', Buffer.from(outcome.stderr));
        }
        child.emit('close', outcome.exitCode, null);
      }
    });
    return child;
  }) as unknown as SpawnFn;
  return { spawnFn, calls };
}

const gtk: LaunchCommand = { command: 'gtk-launch', args: ['firefox.desktop', 'file:///a.html'], waitForExit: true };
const gio: LaunchCommand = {
  command: 'gio',
  args: ['launch', '/x/firefox.desktop', 'file:///a.html'],
  waitForExit: true,
};

describe('runLaunchCommands', () => {
  it('stops at the first helper that exits with 0', async () => {
    const { spawnFn, calls } = fakeSpawn({ 'gtk-launch': { exitCode: 0 }, gio: { exitCode: 0 } });
    assert.equal(await runLaunchCommands([gtk, gio], spawnFn), gtk);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.shell, false);
    assert.equal(calls[0].options.detached, false);
  });

  it('falls back to the next command when a helper fails', async () => {
    const { spawnFn } = fakeSpawn({
      'gtk-launch': { exitCode: 1, stderr: 'no such application' },
      gio: { exitCode: 0 },
    });
    assert.equal(await runLaunchCommands([gtk, gio], spawnFn), gio);
  });

  it('collects every failure when nothing works', async () => {
    const { spawnFn } = fakeSpawn({
      'gtk-launch': { exitCode: 1, stderr: 'no such application' },
      gio: { error: 'spawn gio ENOENT' },
    });
    await assert.rejects(runLaunchCommands([gtk, gio], spawnFn), (error) => {
      assert.ok(error instanceof LaunchFailedError);
      assert.equal(error.failures.length, 2);
      assert.match(error.failures[0], /no such application/);
      assert.match(error.failures[1], /ENOENT/);
      return true;
    });
  });

  it('detaches a browser executable and returns once it has spawned', async () => {
    const browser: LaunchCommand = { command: '/usr/bin/firefox', args: ['/tmp/a.html'], waitForExit: false };
    const { spawnFn, calls } = fakeSpawn({ '/usr/bin/firefox': 'spawned' });
    await runLaunchCommands([browser], spawnFn);
    assert.equal(calls[0].options.detached, true);
    assert.equal(calls[0].options.stdio, 'ignore');
  });
});

describe('runLaunchCommand with a real process', () => {
  it('passes a file name with spaces and Japanese characters as one argument', async () => {
    const fileName = 'my site/テスト ページ $(echo x).html';
    await runLaunchCommand({
      command: process.execPath,
      args: ['-e', 'process.exit(process.argv[1] === process.argv[2] ? 0 : 5)', fileName, fileName],
      waitForExit: true,
    });
  });

  it('rejects when the helper exits with a non-zero code', async () => {
    await assert.rejects(
      runLaunchCommand({ command: process.execPath, args: ['-e', 'process.exit(3)'], waitForExit: true }),
      /exited with 3/,
    );
  });
});
