import { findKnownBrowser, KNOWN_BROWSERS, candidateLocations } from './known-browsers';
import { findDesktopFile, normalizeDesktopId, parseDesktopEntryName } from './linux';
import { findOnPath, pathFor } from './paths';
import type { BrowserOptions, BrowserTarget, DefaultBrowserInfo, KnownBrowser, SystemDeps } from './types';
import { queryOpenCommand, queryUserChoiceProgId, splitCommandLine } from './windows';

export class BrowserNotFoundError extends Error {
  constructor(
    readonly browser: KnownBrowser,
    readonly displayName: string,
    readonly searched: string[],
  ) {
    super(`${displayName} was not found. Searched: ${searched.join(', ') || '(not available on this OS)'}`);
    this.name = 'BrowserNotFoundError';
  }
}

export class CustomBrowserPathError extends Error {
  constructor(readonly customPath: string) {
    super(customPath === '' ? 'Custom browser path is empty.' : `Custom browser not found: ${customPath}`);
    this.name = 'CustomBrowserPathError';
  }
}

export class DefaultBrowserUndetectedError extends Error {
  constructor(reason: string) {
    super(`Could not detect the default browser: ${reason}`);
    this.name = 'DefaultBrowserUndetectedError';
  }
}

export async function resolveBrowser(options: BrowserOptions, deps: SystemDeps): Promise<BrowserTarget> {
  switch (options.browser) {
    case 'default':
      return resolveDefaultBrowser(deps);
    case 'custom':
      return resolveCustomBrowser(options.customBrowserPath, deps);
    default: {
      const target = await findKnownBrowser(deps, options.browser);
      if (!target) {
        throw new BrowserNotFoundError(
          options.browser,
          KNOWN_BROWSERS[options.browser].displayName,
          candidateLocations(deps, options.browser),
        );
      }
      return target;
    }
  }
}

async function resolveCustomBrowser(rawPath: string, deps: SystemDeps): Promise<BrowserTarget> {
  // Paths copied from Windows Explorer often keep their surrounding quotes.
  const customPath = rawPath.trim().replace(/^"(.*)"$/, '$1');
  if (customPath === '' || !(await deps.fileExists(customPath))) {
    throw new CustomBrowserPathError(customPath);
  }
  const name = pathFor(deps.platform).basename(customPath);
  if (deps.platform === 'darwin' && customPath.replace(/\/$/, '').endsWith('.app')) {
    return { kind: 'mac-app', name, appPath: customPath };
  }
  return { kind: 'executable', name, executable: customPath };
}

export async function resolveDefaultBrowser(deps: SystemDeps): Promise<BrowserTarget> {
  switch (deps.platform) {
    case 'darwin': {
      const info = await detect(deps);
      return { kind: 'mac-bundle', name: info.name, bundleId: info.id };
    }
    case 'linux':
      return resolveLinuxDefault(deps);
    case 'win32':
      return resolveWindowsDefault(deps);
    default:
      throw new DefaultBrowserUndetectedError(`unsupported platform ${deps.platform}`);
  }
}

async function detect(deps: SystemDeps): Promise<DefaultBrowserInfo> {
  let info: DefaultBrowserInfo;
  try {
    info = await deps.defaultBrowser();
  } catch (error) {
    throw new DefaultBrowserUndetectedError(error instanceof Error ? error.message : String(error));
  }
  if (!info.id) {
    throw new DefaultBrowserUndetectedError('no default browser is registered');
  }
  return info;
}

async function resolveLinuxDefault(deps: SystemDeps): Promise<BrowserTarget> {
  const info = await detect(deps);
  const desktopId = normalizeDesktopId(info.id);
  const [desktopPath, gtkLaunchPath, gioPath] = await Promise.all([
    findDesktopFile(deps, desktopId),
    findOnPath(deps, ['gtk-launch']),
    findOnPath(deps, ['gio']),
  ]);
  if (!gtkLaunchPath && !(gioPath && desktopPath)) {
    throw new DefaultBrowserUndetectedError(
      desktopPath
        ? 'neither gtk-launch nor gio is installed'
        : `${desktopId} was not found and gtk-launch is not installed`,
    );
  }
  const name = (desktopPath && (await readDesktopName(deps, desktopPath))) || info.name;
  return { kind: 'linux-desktop', name, desktopId, desktopPath, gtkLaunchPath, gioPath };
}

async function readDesktopName(deps: SystemDeps, desktopPath: string): Promise<string | undefined> {
  try {
    return parseDesktopEntryName(await deps.readTextFile(desktopPath));
  } catch {
    return undefined;
  }
}

async function resolveWindowsDefault(deps: SystemDeps): Promise<BrowserTarget> {
  // `default-browser` reports a normalised ID (e.g. "com.google.chrome") for
  // well-known browsers, so the real ProgId is read from the registry as well.
  let info: DefaultBrowserInfo | undefined;
  try {
    info = await deps.defaultBrowser();
  } catch {
    info = undefined;
  }
  const rawProgId = await queryUserChoiceProgId(deps);
  const progIds = [...new Set([rawProgId, info?.id].filter((id): id is string => Boolean(id)))];

  for (const progId of progIds) {
    const commandLine = await queryOpenCommand(deps, progId);
    if (!commandLine) {
      continue;
    }
    const [executable, ...args] = splitCommandLine(commandLine);
    if (executable) {
      return { kind: 'windows-command', name: info?.name ?? progId, progId, executable, args };
    }
  }
  throw new DefaultBrowserUndetectedError(
    progIds.length === 0 ? 'no http handler is registered' : `no shell\\open\\command for ${progIds.join(', ')}`,
  );
}
