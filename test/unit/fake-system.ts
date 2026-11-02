import type { DefaultBrowserInfo, SystemDeps } from '../../src/core/types';

export interface FakeSystemOptions {
  platform: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  homedir?: string;
  /** Existing files, with optional contents. */
  files?: Record<string, string>;
  /** Maps "command arg1 arg2" to stdout. Unknown commands fail like a missing registry key. */
  commands?: Record<string, string>;
  defaultBrowser?: DefaultBrowserInfo | Error;
}

export interface FakeSystem extends SystemDeps {
  calls: string[];
}

export function fakeSystem(options: FakeSystemOptions): FakeSystem {
  const calls: string[] = [];
  const files = options.files ?? {};
  return {
    calls,
    platform: options.platform,
    env: options.env ?? {},
    homedir: options.homedir ?? (options.platform === 'win32' ? 'C:\\Users\\taro' : '/home/taro'),
    fileExists: (filePath) => Promise.resolve(Object.prototype.hasOwnProperty.call(files, filePath)),
    readTextFile: (filePath) =>
      filePath in files ? Promise.resolve(files[filePath]) : Promise.reject(new Error(`ENOENT: ${filePath}`)),
    execFile: (command, args) => {
      const key = [command, ...args].join(' ');
      calls.push(key);
      const stdout = options.commands?.[key];
      return stdout === undefined
        ? Promise.reject(new Error(`ERROR: The system was unable to find the specified registry key or value.`))
        : Promise.resolve(stdout);
    },
    defaultBrowser: () => {
      const result = options.defaultBrowser;
      if (result === undefined) {
        return Promise.reject(new Error('no default browser'));
      }
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    },
  };
}
