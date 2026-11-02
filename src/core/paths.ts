import * as path from 'node:path';
import type { SystemDeps } from './types';

/** Path helpers for the platform being resolved, not the host running the code. */
export function pathFor(platform: NodeJS.Platform): path.PlatformPath {
  return platform === 'win32' ? path.win32 : path.posix;
}

export async function firstExisting(deps: SystemDeps, candidates: readonly string[]): Promise<string | undefined> {
  for (const candidate of candidates) {
    if (await deps.fileExists(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/** Looks a program up in PATH, then in any extra directories. */
export async function findOnPath(
  deps: SystemDeps,
  names: readonly string[],
  extraDirs: readonly string[] = [],
): Promise<string | undefined> {
  const p = pathFor(deps.platform);
  const pathValue = deps.env.PATH ?? deps.env.Path ?? '';
  const dirs = [...pathValue.split(p.delimiter), ...extraDirs].filter((dir) => dir !== '');
  const candidates: string[] = [];
  for (const name of names) {
    for (const dir of dirs) {
      candidates.push(p.join(dir, name));
    }
  }
  return firstExisting(deps, candidates);
}
