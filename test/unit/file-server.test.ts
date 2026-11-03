import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { contentTypeFor, decodeSegments, isInside, StaticFileServer } from '../../src/core/file-server';

interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

/** Sends the path exactly as written; fetch() would normalise "..", which is what the server must refuse. */
function request(port: number, rawPath: string, method = 'GET'): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: rawPath, method, agent: false }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('StaticFileServer', () => {
  let base: string;
  let root: string;
  let server: StaticFileServer;
  let token: string;

  const urlPath = (filePath: string): string => {
    const url = server.urlFor(filePath);
    assert.ok(url, `no URL for ${filePath}`);
    return new URL(url).pathname;
  };

  before(async () => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'file-server-'));
    root = path.join(base, 'site');
    fs.mkdirSync(path.join(root, 'css'), { recursive: true });
    fs.mkdirSync(path.join(root, 'docs'));
    fs.mkdirSync(path.join(root, 'empty'));
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>home</h1>');
    fs.writeFileSync(path.join(root, 'css', 'site.css'), 'body{}');
    fs.writeFileSync(path.join(root, 'docs', 'index.html'), '<h1>docs</h1>');
    fs.writeFileSync(path.join(root, '写真 一覧.html'), '<p>photos</p>');
    fs.writeFileSync(path.join(base, 'secret.txt'), 'top secret');
    fs.symlinkSync(path.join(base, 'secret.txt'), path.join(root, 'escape.txt'));
    fs.symlinkSync(path.join(root, 'css', 'site.css'), path.join(root, 'alias.css'));

    server = await StaticFileServer.start(root);
    token = urlPath(path.join(root, 'index.html')).split('/')[1];
  });

  after(async () => {
    await server.close();
    fs.rmSync(base, { recursive: true, force: true });
  });

  it('listens on the loopback interface only', () => {
    const url = server.urlFor(path.join(root, 'index.html'));
    assert.match(url ?? '', /^http:\/\/127\.0\.0\.1:\d+\//);
  });

  it('serves a file with its content type and without caching', async () => {
    const reply = await request(server.port, urlPath(path.join(root, 'css', 'site.css')));
    assert.equal(reply.status, 200);
    assert.equal(reply.body, 'body{}');
    assert.equal(reply.headers['content-type'], 'text/css');
    assert.equal(reply.headers['cache-control'], 'no-store');
    assert.equal(reply.headers['x-content-type-options'], 'nosniff');
  });

  it('round-trips file names with spaces and Japanese characters', async () => {
    const reply = await request(server.port, urlPath(path.join(root, '写真 一覧.html')));
    assert.equal(reply.status, 200);
    assert.equal(reply.body, '<p>photos</p>');
  });

  it('ignores the query string and the fragment', async () => {
    const reply = await request(server.port, `${urlPath(path.join(root, 'index.html'))}?v=2`);
    assert.equal(reply.body, '<h1>home</h1>');
  });

  it('answers HEAD without a body', async () => {
    const reply = await request(server.port, urlPath(path.join(root, 'index.html')), 'HEAD');
    assert.equal(reply.status, 200);
    assert.equal(reply.headers['content-length'], String('<h1>home</h1>'.length));
    assert.equal(reply.body, '');
  });

  it('refuses other methods', async () => {
    const reply = await request(server.port, urlPath(path.join(root, 'index.html')), 'POST');
    assert.equal(reply.status, 405);
  });

  it('serves index.html for a directory and redirects to the trailing slash first', async () => {
    const redirect = await request(server.port, `/${token}/docs`);
    assert.equal(redirect.status, 301);
    assert.equal(redirect.headers.location, `/${token}/docs/`);
    const page = await request(server.port, `/${token}/docs/`);
    assert.equal(page.body, '<h1>docs</h1>');
  });

  it('never lists a directory', async () => {
    const reply = await request(server.port, `/${token}/empty/`);
    assert.equal(reply.status, 404);
  });

  it('requires the token', async () => {
    assert.equal((await request(server.port, '/index.html')).status, 404);
    assert.equal((await request(server.port, '/')).status, 404);
    const wrong = token.replace(/^./, (c) => (c === 'A' ? 'B' : 'A'));
    assert.equal((await request(server.port, `/${wrong}/index.html`)).status, 404);
  });

  for (const attempt of [
    '../secret.txt',
    '%2e%2e/secret.txt',
    '%2E%2E%2Fsecret.txt',
    'css/../../secret.txt',
    '..%5Csecret.txt',
    'index.html%00',
    '%E0%A4%A',
  ]) {
    it(`refuses to leave the folder: ${attempt}`, async () => {
      const reply = await request(server.port, `/${token}/${attempt}`);
      assert.equal(reply.status, 404);
      assert.ok(!reply.body.includes('top secret'));
    });
  }

  it('refuses symbolic links that point outside the folder', async () => {
    const reply = await request(server.port, `/${token}/escape.txt`);
    assert.equal(reply.status, 404);
    assert.ok(!reply.body.includes('top secret'));
  });

  it('follows symbolic links that stay inside the folder', async () => {
    const reply = await request(server.port, `/${token}/alias.css`);
    assert.equal(reply.body, 'body{}');
  });

  it('gives no URL for files outside the folder', () => {
    assert.equal(server.urlFor(path.join(base, 'secret.txt')), undefined);
  });

  it('closes even while a browser keeps a connection open', async () => {
    const other = await StaticFileServer.start(root);
    const agent = new http.Agent({ keepAlive: true });
    await new Promise<void>((resolve, reject) => {
      http
        .get(
          {
            host: '127.0.0.1',
            port: other.port,
            path: new URL(other.urlFor(path.join(root, 'index.html')) ?? '').pathname,
            agent,
          },
          (res) => {
            res.resume();
            res.on('end', resolve);
          },
        )
        .on('error', reject);
    });
    await other.close();
    agent.destroy();
  });
});

describe('decodeSegments', () => {
  it('drops empty and "." segments', () => {
    assert.deepEqual(decodeSegments(['a', '', '.', 'b%20c.html']), ['a', 'b c.html']);
  });

  it('rejects "..", encoded separators and NUL', () => {
    assert.equal(decodeSegments(['..']), undefined);
    assert.equal(decodeSegments(['a%2Fb']), undefined);
    assert.equal(decodeSegments(['a%5Cb']), undefined);
    assert.equal(decodeSegments(['a%00']), undefined);
  });

  it('rejects malformed escapes', () => {
    assert.equal(decodeSegments(['%E0%A4%A']), undefined);
  });
});

describe('isInside', () => {
  it('accepts the folder itself and anything below it', () => {
    assert.ok(isInside('/srv/site', '/srv/site'));
    assert.ok(isInside('/srv/site', '/srv/site/a/b.html'));
  });

  it('rejects siblings that only share a prefix, and parents', () => {
    assert.ok(!isInside('/srv/site', '/srv/site-old/a.html'));
    assert.ok(!isInside('/srv/site', '/srv'));
  });

  it('handles Windows paths, including other drives', () => {
    assert.ok(isInside('C:\\work\\site', 'C:\\work\\site\\index.html', path.win32));
    assert.ok(!isInside('C:\\work\\site', 'D:\\work\\site\\index.html', path.win32));
  });
});

describe('contentTypeFor', () => {
  it('maps common web files and falls back to binary', () => {
    assert.equal(contentTypeFor('a.HTML'), 'text/html');
    assert.equal(contentTypeFor('a.mjs'), 'text/javascript');
    assert.equal(contentTypeFor('a.woff2'), 'font/woff2');
    assert.equal(contentTypeFor('a.unknown'), 'application/octet-stream');
  });
});
