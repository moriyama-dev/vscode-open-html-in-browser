import type { SystemDeps } from './types';

const URL_ASSOCIATION_KEY =
  'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http';

export function regExePath(env: NodeJS.ProcessEnv): string {
  const root = env.SYSTEMROOT ?? env.SystemRoot ?? env.windir ?? 'C:\\Windows';
  return `${root}\\System32\\reg.exe`;
}

/**
 * Reads the ProgId of the http handler chosen by the user.
 * Recent Windows 11 builds may store it under `UserChoiceLatest` instead.
 */
export async function queryUserChoiceProgId(deps: SystemDeps): Promise<string | undefined> {
  for (const subKey of ['UserChoice', 'UserChoiceLatest']) {
    try {
      const stdout = await deps.execFile(regExePath(deps.env), [
        'query',
        `${URL_ASSOCIATION_KEY}\\${subKey}`,
        '/v',
        'ProgId',
      ]);
      const match = /ProgId\s+REG_SZ\s+(\S+)/i.exec(stdout);
      if (match) {
        return match[1];
      }
    } catch {
      // Key not present; try the next one.
    }
  }
  return undefined;
}

/** Reads `HKCR\<ProgId>\shell\open\command` and returns the raw command line. */
export async function queryOpenCommand(deps: SystemDeps, progId: string): Promise<string | undefined> {
  try {
    const stdout = await deps.execFile(regExePath(deps.env), [
      'query',
      `HKEY_CLASSES_ROOT\\${progId}\\shell\\open\\command`,
      '/ve',
    ]);
    return parseRegDefaultValue(stdout, deps.env);
  } catch {
    return undefined;
  }
}

/**
 * Extracts the value from `reg query ... /ve` output. The name column is
 * localized ("(Default)", "(既定)", ...), so the line is found by its type.
 */
export function parseRegDefaultValue(stdout: string, env: NodeJS.ProcessEnv): string | undefined {
  for (const line of stdout.split(/\r?\n/)) {
    const match = /\s(REG_SZ|REG_EXPAND_SZ)\s+(.*)$/.exec(line);
    if (match) {
      const value = match[2].trim();
      if (value === '') {
        return undefined;
      }
      return match[1] === 'REG_EXPAND_SZ' ? expandEnvironment(value, env) : value;
    }
  }
  return undefined;
}

/** Expands `%NAME%` variables. Placeholders such as `%1` and `%*` are left alone. */
export function expandEnvironment(value: string, env: NodeJS.ProcessEnv): string {
  const lookup = new Map(Object.entries(env).map(([key, val]) => [key.toLowerCase(), val]));
  return value.replace(/%([A-Za-z_][A-Za-z0-9_()]*)%/g, (whole, name: string) => {
    return lookup.get(name.toLowerCase()) ?? whole;
  });
}

/**
 * Splits a Windows command line into the executable and its arguments,
 * following the quoting rules of `CommandLineToArgvW`. An unquoted executable
 * path containing spaces (seen in some hand-written registrations) is
 * recognised by its `.exe` suffix.
 */
export function splitCommandLine(commandLine: string): string[] {
  const trimmed = commandLine.trim();
  if (!trimmed.startsWith('"')) {
    const exe = /^(.+?\.exe)(?=\s|$)/i.exec(trimmed);
    if (exe && exe[1].includes(' ')) {
      return [exe[1], ...tokenize(trimmed.slice(exe[1].length))];
    }
  }
  return tokenize(trimmed);
}

function tokenize(input: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let hasToken = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '\\') {
      let slashes = 0;
      while (input[i] === '\\') {
        slashes++;
        i++;
      }
      if (input[i] === '"') {
        current += '\\'.repeat(Math.floor(slashes / 2));
        if (slashes % 2 === 1) {
          current += '"';
        } else {
          inQuotes = !inQuotes;
        }
      } else {
        current += '\\'.repeat(slashes);
        i--;
      }
      hasToken = true;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
      hasToken = true;
    } else if (/\s/.test(ch) && !inQuotes) {
      if (hasToken) {
        result.push(current);
        current = '';
        hasToken = false;
      }
    } else {
      current += ch;
      hasToken = true;
    }
  }
  if (hasToken) {
    result.push(current);
  }
  return result;
}

/**
 * Replaces the `%1` / `%L` placeholders with the target. Arguments are passed
 * to `spawn` as an array, so the surrounding quotes from the registry have
 * already been removed by `splitCommandLine` and must not be added back.
 * `%*` (remaining arguments) is dropped. If the command has no placeholder,
 * the target is appended.
 */
export function substitutePlaceholders(args: readonly string[], target: string): string[] {
  let substituted = false;
  const result: string[] = [];
  for (const arg of args) {
    if (arg === '%*') {
      continue;
    }
    const replaced = arg.replace(/%[1lL]/g, () => {
      substituted = true;
      return target;
    });
    result.push(replaced);
  }
  if (!substituted) {
    result.push(target);
  }
  return result;
}
