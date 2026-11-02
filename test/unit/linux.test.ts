import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { desktopEntryDirs, normalizeDesktopId, parseDesktopEntryName } from '../../src/core/linux';
import { fakeSystem } from './fake-system';

describe('desktopEntryDirs', () => {
  it('lists user, system, Snap and Flatpak directories in lookup order', () => {
    assert.deepEqual(desktopEntryDirs(fakeSystem({ platform: 'linux', homedir: '/home/taro' })), [
      '/home/taro/.local/share/applications',
      '/usr/local/share/applications',
      '/usr/share/applications',
      '/var/lib/snapd/desktop/applications',
      '/home/taro/.local/share/flatpak/exports/share/applications',
      '/var/lib/flatpak/exports/share/applications',
    ]);
  });
});

describe('normalizeDesktopId', () => {
  it('adds the .desktop suffix only when missing', () => {
    assert.equal(normalizeDesktopId('firefox'), 'firefox.desktop');
    assert.equal(normalizeDesktopId(' firefox.desktop\n'), 'firefox.desktop');
  });
});

describe('parseDesktopEntryName', () => {
  it('reads Name from the [Desktop Entry] group only', () => {
    const content = '[Desktop Action new]\nName=New Window\n\n[Desktop Entry]\nName[ja]=ウェブ\nName=Google Chrome\n';
    assert.equal(parseDesktopEntryName(content), 'Google Chrome');
  });

  it('returns undefined when there is no name', () => {
    assert.equal(parseDesktopEntryName('[Desktop Entry]\nExec=foo\n'), undefined);
  });
});
