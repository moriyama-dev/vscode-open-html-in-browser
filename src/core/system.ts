import defaultBrowser from 'default-browser';
import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import * as os from 'node:os';
import { promisify } from 'node:util';
import type { SystemDeps } from './types';

const execFileAsync = promisify(execFile);

export function createNodeSystem(): SystemDeps {
  return {
    platform: process.platform,
    env: process.env,
    homedir: os.homedir(),
    async fileExists(filePath) {
      try {
        await access(filePath);
        return true;
      } catch {
        return false;
      }
    },
    readTextFile: (filePath) => readFile(filePath, 'utf8'),
    async execFile(command, args) {
      const { stdout } = await execFileAsync(command, [...args], { windowsHide: true, timeout: 10_000 });
      return stdout;
    },
    defaultBrowser: () => defaultBrowser(),
  };
}
