import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import * as path from 'node:path';

/**
 * Content types by extension. HTML, CSS and JavaScript deliberately carry no
 * charset, so a page that declares its own encoding (for example Shift_JIS
 * in a meta tag) is still decoded the way the author intended.
 */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.map': 'application/json',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
};

export function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/** True when `child` is `parent` itself or lies somewhere below it. */
export function isInside(parent: string, child: string, pathModule: typeof path = path): boolean {
  const relative = pathModule.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !pathModule.isAbsolute(relative));
}

/**
 * Serves the files under one folder to the local machine only.
 *
 * Every URL starts with a random token, so other users and programs on the
 * same machine, or a web page trying to reach localhost, cannot read the
 * folder without knowing it. Paths that leave the folder, also through
 * symbolic links, are refused, and directories are never listed.
 */
export class StaticFileServer {
  private readonly token = randomBytes(24).toString('base64url');
  private server: http.Server | undefined;
  private realRoot = '';

  private constructor(readonly root: string) {}

  static async start(root: string): Promise<StaticFileServer> {
    const instance = new StaticFileServer(root);
    instance.realRoot = await realpath(root);
    const server = http.createServer((request, response) => {
      instance.handle(request, response).catch(() => {
        if (!response.headersSent) {
          response.writeHead(500);
        }
        response.end();
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
    instance.server = server;
    return instance;
  }

  get port(): number {
    return (this.server?.address() as AddressInfo | null)?.port ?? 0;
  }

  /** The URL of a file below the root on this machine, or undefined when it lies outside. */
  urlFor(filePath: string): string | undefined {
    const resolved = path.resolve(filePath);
    if (!isInside(path.resolve(this.root), resolved)) {
      return undefined;
    }
    const relative = path.relative(path.resolve(this.root), resolved);
    const encoded = relative === '' ? '' : relative.split(path.sep).map(encodeURIComponent).join('/');
    return `http://127.0.0.1:${this.port}/${this.token}/${encoded}`;
  }

  async close(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (!server) {
      return;
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      // Browsers keep connections alive; without this, close() would wait for them.
      server.closeAllConnections();
    });
  }

  private async handle(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end();
      return;
    }

    const urlPath = (request.url ?? '/').split(/[?#]/, 1)[0];
    const segments = urlPath.split('/').slice(1);
    const token = segments.shift() ?? '';
    if (!this.hasToken(token)) {
      notFound(response);
      return;
    }

    const decoded = decodeSegments(segments);
    if (!decoded) {
      notFound(response);
      return;
    }

    let target: string;
    try {
      target = await realpath(path.join(this.realRoot, ...decoded));
    } catch {
      notFound(response);
      return;
    }
    if (!isInside(this.realRoot, target)) {
      notFound(response);
      return;
    }

    let info = await stat(target);
    if (info.isDirectory()) {
      // Relative links inside index.html only resolve against a trailing slash.
      if (!urlPath.endsWith('/')) {
        response.writeHead(301, { Location: `${urlPath}/` });
        response.end();
        return;
      }
      target = path.join(target, 'index.html');
      try {
        info = await stat(target);
      } catch {
        notFound(response);
        return;
      }
    }
    if (!info.isFile()) {
      notFound(response);
      return;
    }

    response.writeHead(200, {
      'Content-Type': contentTypeFor(target),
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    createReadStream(target)
      .on('error', () => response.destroy())
      .pipe(response);
  }

  private hasToken(candidate: string): boolean {
    const expected = Buffer.from(this.token);
    const actual = Buffer.from(candidate);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}

/** Decodes URL path segments, refusing anything that could step outside the root. */
export function decodeSegments(segments: readonly string[]): string[] | undefined {
  const decoded: string[] = [];
  for (const segment of segments) {
    let value: string;
    try {
      value = decodeURIComponent(segment);
    } catch {
      return undefined;
    }
    if (value === '..' || /[\\/\0]/.test(value)) {
      return undefined;
    }
    if (value !== '' && value !== '.') {
      decoded.push(value);
    }
  }
  return decoded;
}

function notFound(response: http.ServerResponse): void {
  response.writeHead(404, { 'Content-Type': 'text/plain' });
  response.end('Not found');
}
