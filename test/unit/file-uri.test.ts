import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toFileUri } from '../../src/core/file-uri';

describe('toFileUri', () => {
  it('encodes spaces and Japanese characters in POSIX paths', () => {
    assert.equal(
      toFileUri('/home/taro/my site/テスト.html', 'linux'),
      'file:///home/taro/my%20site/%E3%83%86%E3%82%B9%E3%83%88.html',
    );
  });

  it('encodes characters that would otherwise start a query or fragment', () => {
    assert.equal(toFileUri('/tmp/a#b?c.html', 'darwin'), 'file:///tmp/a%23b%3Fc.html');
  });

  it('converts Windows drive paths and keeps the drive colon', () => {
    assert.equal(
      toFileUri('C:\\Users\\Taro\\My Site\\index.html', 'win32'),
      'file:///C:/Users/Taro/My%20Site/index.html',
    );
  });

  it('converts Windows UNC paths', () => {
    assert.equal(toFileUri('\\\\server\\share\\page.html', 'win32'), 'file://server/share/page.html');
  });
});
