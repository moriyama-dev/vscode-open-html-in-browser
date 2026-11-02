import { firstExisting } from './paths';
import * as path from 'node:path';
import type { SystemDeps } from './types';

/** Directories that may hold the `.desktop` file of the default browser, in lookup order. */
export function desktopEntryDirs(deps: SystemDeps): string[] {
  const dataHome = deps.env.XDG_DATA_HOME || path.posix.join(deps.homedir, '.local/share');
  return [
    path.posix.join(dataHome, 'applications'),
    '/usr/local/share/applications',
    '/usr/share/applications',
    '/var/lib/snapd/desktop/applications',
    path.posix.join(dataHome, 'flatpak/exports/share/applications'),
    '/var/lib/flatpak/exports/share/applications',
  ];
}

export function normalizeDesktopId(id: string): string {
  const trimmed = id.trim();
  return trimmed.endsWith('.desktop') ? trimmed : `${trimmed}.desktop`;
}

export async function findDesktopFile(deps: SystemDeps, desktopId: string): Promise<string | undefined> {
  const fileName = normalizeDesktopId(desktopId);
  return firstExisting(
    deps,
    desktopEntryDirs(deps).map((dir) => path.posix.join(dir, fileName)),
  );
}

/** Reads the untranslated `Name=` of the `[Desktop Entry]` group. */
export function parseDesktopEntryName(content: string): string | undefined {
  let inMainGroup = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('[')) {
      inMainGroup = line === '[Desktop Entry]';
    } else if (inMainGroup && line.startsWith('Name=')) {
      return line.slice('Name='.length).trim() || undefined;
    }
  }
  return undefined;
}
