import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/integration/**/*.test.js',
  version: '1.143.0',
  workspaceFolder: 'test/fixtures',
  launchArgs: ['--disable-extensions', '--user-data-dir', '/home/yoshi/t/uopen'],
  mocha: { ui: 'bdd', timeout: 20000 },
});
