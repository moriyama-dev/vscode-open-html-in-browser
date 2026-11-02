/**
 * Prints what the extension would do on this machine without starting a browser:
 *   npm run detect-browser [-- <file>]
 */
import * as path from 'node:path';
import { KNOWN_BROWSERS } from '../src/core/known-browsers';
import { buildLaunchCommands, formatCommand } from '../src/core/launch-commands';
import { resolveBrowser } from '../src/core/resolve-browser';
import { createNodeSystem } from '../src/core/system';
import type { BrowserSetting, KnownBrowser } from '../src/core/types';

async function main(): Promise<void> {
  const deps = createNodeSystem();
  const file = path.resolve(process.argv[2] ?? 'test/fixtures/sample page.html');

  console.log(`platform: ${deps.platform}`);
  console.log(`file:     ${file}`);
  console.log('');

  try {
    const info = await deps.defaultBrowser();
    console.log(`default-browser: name=${JSON.stringify(info.name)} id=${JSON.stringify(info.id)}`);
  } catch (error) {
    console.log(`default-browser: failed (${String(error)})`);
  }
  console.log('');

  const settings: BrowserSetting[] = ['default', ...(Object.keys(KNOWN_BROWSERS) as KnownBrowser[])];
  for (const browser of settings) {
    console.log(`[${browser}]`);
    try {
      const target = await resolveBrowser({ browser, customBrowserPath: '' }, deps);
      console.log(`  name:    ${target.name}`);
      console.log(`  kind:    ${target.kind}`);
      if (target.kind === 'linux-desktop') {
        console.log(`  id:      ${target.desktopId}`);
        console.log(`  desktop: ${target.desktopPath ?? '(not found)'}`);
      }
      buildLaunchCommands(target, file, deps.platform).forEach((command, index) => {
        console.log(`  command${index + 1}: ${formatCommand(command)}`);
      });
    } catch (error) {
      console.log(`  error:   ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

void main();
