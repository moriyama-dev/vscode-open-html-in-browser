/**
 * Converts an absolute path to a `file://` URI for the given platform.
 * `url.pathToFileURL` always follows the host platform, which makes the
 * Windows branch impossible to test elsewhere, so this is done by hand.
 */
export function toFileUri(filePath: string, platform: NodeJS.Platform): string {
  if (platform === 'win32') {
    const slashed = filePath.replace(/\\/g, '/');
    if (slashed.startsWith('//')) {
      // UNC path: \\server\share\file.html -> file://server/share/file.html
      return `file:${encodePath(slashed)}`;
    }
    return `file:///${encodePath(slashed)}`;
  }
  return `file://${encodePath(filePath)}`;
}

function encodePath(value: string): string {
  return value
    .split('/')
    .map((segment) => encodeURIComponent(segment).replace(/%3A/gi, ':'))
    .join('/');
}
