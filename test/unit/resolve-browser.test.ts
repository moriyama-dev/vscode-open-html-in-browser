import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildLaunchCommands } from '../../src/core/launch-commands';
import {
  BrowserNotFoundError,
  CustomBrowserPathError,
  DefaultBrowserUndetectedError,
  resolveBrowser,
} from '../../src/core/resolve-browser';
import type { BrowserOptions } from '../../src/core/types';
import { fakeSystem } from './fake-system';

const DEFAULT: BrowserOptions = { browser: 'default', customBrowserPath: '' };
const REG = 'C:\\Windows\\System32\\reg.exe';
const USER_CHOICE =
  'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice';

describe('resolveBrowser: macOS', () => {
  it('opens the default browser by bundle ID', async () => {
    const deps = fakeSystem({ platform: 'darwin', defaultBrowser: { name: 'Safari', id: 'com.apple.Safari' } });
    const target = await resolveBrowser(DEFAULT, deps);
    assert.deepEqual(buildLaunchCommands(target, '/Users/taro/My Site/ページ.html', 'darwin'), [
      {
        command: '/usr/bin/open',
        args: ['-b', 'com.apple.Safari', '/Users/taro/My Site/ページ.html'],
        waitForExit: true,
      },
    ]);
  });

  it('uses the Safari bundle ID when Safari is selected', async () => {
    const target = await resolveBrowser(
      { browser: 'safari', customBrowserPath: '' },
      fakeSystem({ platform: 'darwin' }),
    );
    assert.deepEqual(target, { kind: 'mac-bundle', name: 'Safari', bundleId: 'com.apple.Safari' });
  });

  it('finds an app in ~/Applications and opens it with open -a', async () => {
    const deps = fakeSystem({
      platform: 'darwin',
      homedir: '/Users/taro',
      files: { '/Users/taro/Applications/Firefox.app': '' },
    });
    const target = await resolveBrowser({ browser: 'firefox', customBrowserPath: '' }, deps);
    assert.deepEqual(buildLaunchCommands(target, '/tmp/a.html', 'darwin'), [
      {
        command: '/usr/bin/open',
        args: ['-a', '/Users/taro/Applications/Firefox.app', '/tmp/a.html'],
        waitForExit: true,
      },
    ]);
  });

  it('accepts an .app bundle as the custom browser', async () => {
    const deps = fakeSystem({ platform: 'darwin', files: { '/Applications/Arc.app': '' } });
    const target = await resolveBrowser({ browser: 'custom', customBrowserPath: '/Applications/Arc.app' }, deps);
    assert.equal(target.kind, 'mac-app');
  });

  it('reports a missing default browser as undetected', async () => {
    const deps = fakeSystem({ platform: 'darwin', defaultBrowser: new Error('defaults failed') });
    await assert.rejects(resolveBrowser(DEFAULT, deps), DefaultBrowserUndetectedError);
  });
});

describe('resolveBrowser: Linux', () => {
  const env = { PATH: '/usr/local/bin:/usr/bin' };

  it('finds a Snap .desktop file and prefers gtk-launch, with gio as fallback', async () => {
    const desktopPath = '/var/lib/snapd/desktop/applications/firefox_firefox.desktop';
    const deps = fakeSystem({
      platform: 'linux',
      env,
      files: {
        [desktopPath]:
          '[Desktop Entry]\nName=Firefox Web Browser\nName[ja]=Firefox\n[Desktop Action new-window]\nName=New Window\n',
        '/usr/bin/gtk-launch': '',
        '/usr/bin/gio': '',
      },
      defaultBrowser: { name: 'Firefox_firefox', id: 'firefox_firefox.desktop' },
    });
    const target = await resolveBrowser(DEFAULT, deps);
    assert.deepEqual(target, {
      kind: 'linux-desktop',
      name: 'Firefox Web Browser',
      desktopId: 'firefox_firefox.desktop',
      desktopPath,
      gtkLaunchPath: '/usr/bin/gtk-launch',
      gioPath: '/usr/bin/gio',
    });
    const uri = 'file:///home/taro/my%20site/index.html';
    assert.deepEqual(buildLaunchCommands(target, '/home/taro/my site/index.html', 'linux'), [
      { command: '/usr/bin/gtk-launch', args: ['firefox_firefox.desktop', uri], waitForExit: true },
      { command: '/usr/bin/gio', args: ['launch', desktopPath, uri], waitForExit: true },
    ]);
  });

  it('searches the user directory first and honours XDG_DATA_HOME', async () => {
    const deps = fakeSystem({
      platform: 'linux',
      env: { ...env, XDG_DATA_HOME: '/data/taro' },
      files: {
        '/data/taro/applications/brave-browser.desktop': '[Desktop Entry]\nName=Brave Web Browser\n',
        '/usr/share/applications/brave-browser.desktop': '[Desktop Entry]\nName=System Brave\n',
        '/usr/bin/gio': '',
      },
      defaultBrowser: { name: 'Brave Browser', id: 'brave-browser.desktop' },
    });
    const target = await resolveBrowser(DEFAULT, deps);
    assert.ok(target.kind === 'linux-desktop');
    assert.equal(target.desktopPath, '/data/taro/applications/brave-browser.desktop');
    assert.deepEqual(
      buildLaunchCommands(target, '/tmp/a.html', 'linux').map((c) => c.command),
      ['/usr/bin/gio'],
    );
  });

  it('finds Flatpak exports', async () => {
    const desktopPath = '/var/lib/flatpak/exports/share/applications/org.mozilla.firefox.desktop';
    const deps = fakeSystem({
      platform: 'linux',
      env,
      files: { [desktopPath]: '', '/usr/bin/gio': '' },
      defaultBrowser: { name: 'Org.mozilla.firefox', id: 'org.mozilla.firefox.desktop' },
    });
    const target = await resolveBrowser(DEFAULT, deps);
    assert.ok(target.kind === 'linux-desktop');
    assert.equal(target.desktopPath, desktopPath);
  });

  it('fails when neither gtk-launch nor gio can start the browser', async () => {
    const deps = fakeSystem({
      platform: 'linux',
      env,
      files: { '/usr/share/applications/firefox.desktop': '' },
      defaultBrowser: { name: 'Firefox', id: 'firefox.desktop' },
    });
    await assert.rejects(resolveBrowser(DEFAULT, deps), DefaultBrowserUndetectedError);
  });

  it('fails when xdg-mime reports nothing', async () => {
    const deps = fakeSystem({ platform: 'linux', env, defaultBrowser: { name: '', id: '' } });
    await assert.rejects(resolveBrowser(DEFAULT, deps), DefaultBrowserUndetectedError);
  });

  it('finds Chrome on PATH and passes the plain file path', async () => {
    const deps = fakeSystem({ platform: 'linux', env, files: { '/usr/bin/google-chrome': '' } });
    const target = await resolveBrowser({ browser: 'chrome', customBrowserPath: '' }, deps);
    assert.deepEqual(buildLaunchCommands(target, '/home/taro/テスト ページ.html', 'linux'), [
      { command: '/usr/bin/google-chrome', args: ['/home/taro/テスト ページ.html'], waitForExit: false },
    ]);
  });

  it('falls back to Chromium for the chrome setting', async () => {
    const deps = fakeSystem({ platform: 'linux', env, files: { '/snap/bin/chromium': '' } });
    const target = await resolveBrowser({ browser: 'chrome', customBrowserPath: '' }, deps);
    assert.ok(target.kind === 'executable');
    assert.equal(target.executable, '/snap/bin/chromium');
  });

  it('reports Safari as unavailable outside macOS', async () => {
    const deps = fakeSystem({ platform: 'linux', env });
    await assert.rejects(resolveBrowser({ browser: 'safari', customBrowserPath: '' }, deps), (error) => {
      assert.ok(error instanceof BrowserNotFoundError);
      assert.deepEqual(error.searched, []);
      return true;
    });
  });
});

describe('resolveBrowser: Windows', () => {
  const env = {
    SYSTEMROOT: 'C:\\Windows',
    ProgramFiles: 'C:\\Program Files',
    'ProgramFiles(x86)': 'C:\\Program Files (x86)',
    LOCALAPPDATA: 'C:\\Users\\taro\\AppData\\Local',
  };

  it('uses the real ProgId from the registry, including its hash suffix', async () => {
    const deps = fakeSystem({
      platform: 'win32',
      env,
      defaultBrowser: { name: 'Firefox', id: 'org.mozilla.firefox' },
      commands: {
        [`${REG} query ${USER_CHOICE} /v ProgId`]: `\r\n${USER_CHOICE}\r\n    ProgId    REG_SZ    FirefoxURL-308046B0AF4A39CB\r\n`,
        [`${REG} query HKEY_CLASSES_ROOT\\FirefoxURL-308046B0AF4A39CB\\shell\\open\\command /ve`]:
          '    (Default)    REG_SZ    "C:\\Program Files\\Mozilla Firefox\\firefox.exe" -osint -url "%1"\r\n',
      },
    });
    const target = await resolveBrowser(DEFAULT, deps);
    assert.deepEqual(buildLaunchCommands(target, 'C:\\Users\\taro\\My Site\\テスト.html', 'win32'), [
      {
        command: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
        args: ['-osint', '-url', 'file:///C:/Users/taro/My%20Site/%E3%83%86%E3%82%B9%E3%83%88.html'],
        waitForExit: false,
      },
    ]);
    assert.equal(target.name, 'Firefox');
  });

  it('falls back to UserChoiceLatest and to the ID from default-browser', async () => {
    const deps = fakeSystem({
      platform: 'win32',
      env,
      defaultBrowser: { name: 'SomeBrowserHTML', id: 'SomeBrowserHTML' },
      commands: {
        [`${REG} query ${USER_CHOICE}Latest /v ProgId`]: '    ProgId    REG_SZ    SomeBrowserHTML\r\n',
        [`${REG} query HKEY_CLASSES_ROOT\\SomeBrowserHTML\\shell\\open\\command /ve`]:
          '    (Default)    REG_EXPAND_SZ    %LOCALAPPDATA%\\Some Browser\\some.exe %1\r\n',
      },
    });
    const target = await resolveBrowser(DEFAULT, deps);
    assert.deepEqual(target, {
      kind: 'windows-command',
      name: 'SomeBrowserHTML',
      progId: 'SomeBrowserHTML',
      executable: 'C:\\Users\\taro\\AppData\\Local\\Some Browser\\some.exe',
      args: ['%1'],
    });
  });

  it('still works when default-browser itself fails', async () => {
    const deps = fakeSystem({
      platform: 'win32',
      env,
      defaultBrowser: new Error('UnknownBrowserError'),
      commands: {
        [`${REG} query ${USER_CHOICE} /v ProgId`]: '    ProgId    REG_SZ    MSEdgeHTM\r\n',
        [`${REG} query HKEY_CLASSES_ROOT\\MSEdgeHTM\\shell\\open\\command /ve`]:
          '    (Default)    REG_SZ    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --single-argument %1\r\n',
      },
    });
    const target = await resolveBrowser(DEFAULT, deps);
    assert.equal(target.name, 'MSEdgeHTM');
    assert.deepEqual(buildLaunchCommands(target, 'D:\\site\\a.html', 'win32')[0].args, [
      '--single-argument',
      'file:///D:/site/a.html',
    ]);
  });

  it('is undetected when no open command is registered', async () => {
    const deps = fakeSystem({ platform: 'win32', env, defaultBrowser: { name: 'Chrome', id: 'com.google.chrome' } });
    await assert.rejects(resolveBrowser(DEFAULT, deps), DefaultBrowserUndetectedError);
  });

  it('finds a per-user Chrome installation', async () => {
    const exe = 'C:\\Users\\taro\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
    const deps = fakeSystem({ platform: 'win32', env, files: { [exe]: '' } });
    const target = await resolveBrowser({ browser: 'chrome', customBrowserPath: '' }, deps);
    assert.deepEqual(buildLaunchCommands(target, 'C:\\a b\\c.html', 'win32'), [
      { command: exe, args: ['C:\\a b\\c.html'], waitForExit: false },
    ]);
  });

  it('lists every searched location when Edge is missing', async () => {
    const deps = fakeSystem({ platform: 'win32', env });
    await assert.rejects(resolveBrowser({ browser: 'edge', customBrowserPath: '' }, deps), (error) => {
      assert.ok(error instanceof BrowserNotFoundError);
      assert.deepEqual(error.searched, [
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Users\\taro\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe',
      ]);
      return true;
    });
  });

  it('strips quotes around a custom path', async () => {
    const exe = 'C:\\Tools\\Vivaldi\\vivaldi.exe';
    const deps = fakeSystem({ platform: 'win32', env, files: { [exe]: '' } });
    const target = await resolveBrowser({ browser: 'custom', customBrowserPath: ` "${exe}" ` }, deps);
    assert.deepEqual(target, { kind: 'executable', name: 'vivaldi.exe', executable: exe });
  });

  it('rejects an empty or missing custom path', async () => {
    const deps = fakeSystem({ platform: 'win32', env });
    await assert.rejects(resolveBrowser({ browser: 'custom', customBrowserPath: '' }, deps), CustomBrowserPathError);
    await assert.rejects(
      resolveBrowser({ browser: 'custom', customBrowserPath: 'C:\\nope.exe' }, deps),
      CustomBrowserPathError,
    );
  });
});
