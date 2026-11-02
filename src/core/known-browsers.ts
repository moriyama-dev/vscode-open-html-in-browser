import * as path from 'node:path';
import { findOnPath, firstExisting } from './paths';
import type { BrowserTarget, KnownBrowser, SystemDeps } from './types';

interface KnownBrowserSpec {
  displayName: string;
  /** App bundle name under /Applications. Safari is addressed by bundle ID instead. */
  macApp?: string;
  macBundleId?: string;
  /** Path relative to Program Files / Local AppData. */
  windowsRelative?: string;
  /** Command names, including Flatpak app IDs exported as commands. */
  linuxCommands?: string[];
}

export const KNOWN_BROWSERS: Record<KnownBrowser, KnownBrowserSpec> = {
  chrome: {
    displayName: 'Google Chrome',
    macApp: 'Google Chrome.app',
    windowsRelative: 'Google\\Chrome\\Application\\chrome.exe',
    linuxCommands: [
      'google-chrome-stable',
      'google-chrome',
      'com.google.Chrome',
      'chromium',
      'chromium-browser',
      'org.chromium.Chromium',
    ],
  },
  firefox: {
    displayName: 'Firefox',
    macApp: 'Firefox.app',
    windowsRelative: 'Mozilla Firefox\\firefox.exe',
    linuxCommands: ['firefox', 'firefox-esr', 'org.mozilla.firefox'],
  },
  edge: {
    displayName: 'Microsoft Edge',
    macApp: 'Microsoft Edge.app',
    windowsRelative: 'Microsoft\\Edge\\Application\\msedge.exe',
    linuxCommands: ['microsoft-edge-stable', 'microsoft-edge', 'com.microsoft.Edge'],
  },
  brave: {
    displayName: 'Brave',
    macApp: 'Brave Browser.app',
    windowsRelative: 'BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    linuxCommands: ['brave-browser', 'brave-browser-stable', 'brave', 'com.brave.Browser'],
  },
  safari: {
    displayName: 'Safari',
    macBundleId: 'com.apple.Safari',
  },
};

/** Every location that is checked for a browser, so error messages can list them. */
export function candidateLocations(deps: SystemDeps, browser: KnownBrowser): string[] {
  const spec = KNOWN_BROWSERS[browser];
  if (deps.platform === 'darwin') {
    if (!spec.macApp) {
      return [];
    }
    return [path.posix.join('/Applications', spec.macApp), path.posix.join(deps.homedir, 'Applications', spec.macApp)];
  }
  if (deps.platform === 'win32') {
    if (!spec.windowsRelative) {
      return [];
    }
    const roots = [
      deps.env.ProgramFiles ?? 'C:\\Program Files',
      deps.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
      deps.env.LOCALAPPDATA,
    ].filter((root): root is string => Boolean(root));
    return roots.map((root) => path.win32.join(root, spec.windowsRelative as string));
  }
  return spec.linuxCommands ?? [];
}

export function linuxExtraBinDirs(deps: SystemDeps): string[] {
  return [
    '/usr/bin',
    '/usr/local/bin',
    '/snap/bin',
    '/var/lib/flatpak/exports/bin',
    path.posix.join(deps.homedir, '.local/share/flatpak/exports/bin'),
  ];
}

export async function findKnownBrowser(deps: SystemDeps, browser: KnownBrowser): Promise<BrowserTarget | undefined> {
  const spec = KNOWN_BROWSERS[browser];
  const name = spec.displayName;

  if (deps.platform === 'darwin') {
    if (spec.macBundleId) {
      return { kind: 'mac-bundle', name, bundleId: spec.macBundleId };
    }
    const appPath = await firstExisting(deps, candidateLocations(deps, browser));
    return appPath ? { kind: 'mac-app', name, appPath } : undefined;
  }

  if (deps.platform === 'win32') {
    const executable = await firstExisting(deps, candidateLocations(deps, browser));
    return executable ? { kind: 'executable', name, executable } : undefined;
  }

  if (!spec.linuxCommands) {
    return undefined;
  }
  const executable = await findOnPath(deps, spec.linuxCommands, linuxExtraBinDirs(deps));
  return executable ? { kind: 'executable', name, executable } : undefined;
}
