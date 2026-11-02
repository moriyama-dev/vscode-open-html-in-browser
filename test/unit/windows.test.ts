import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  expandEnvironment,
  parseRegDefaultValue,
  splitCommandLine,
  substitutePlaceholders,
} from '../../src/core/windows';

describe('parseRegDefaultValue', () => {
  it('reads the default value from English output', () => {
    const stdout = [
      '',
      'HKEY_CLASSES_ROOT\\ChromeHTML\\shell\\open\\command',
      '    (Default)    REG_SZ    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --single-argument %1',
      '',
    ].join('\r\n');
    assert.equal(
      parseRegDefaultValue(stdout, {}),
      '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --single-argument %1',
    );
  });

  it('does not depend on the localized value name', () => {
    const stdout = 'HKEY_CLASSES_ROOT\\X\\shell\\open\\command\r\n    (既定)    REG_SZ    "C:\\a b\\x.exe" "%1"\r\n';
    assert.equal(parseRegDefaultValue(stdout, {}), '"C:\\a b\\x.exe" "%1"');
  });

  it('expands REG_EXPAND_SZ values', () => {
    const stdout = '    (Default)    REG_EXPAND_SZ    "%LOCALAPPDATA%\\Browser\\b.exe" %1\r\n';
    assert.equal(
      parseRegDefaultValue(stdout, { LOCALAPPDATA: 'C:\\Users\\taro\\AppData\\Local' }),
      '"C:\\Users\\taro\\AppData\\Local\\Browser\\b.exe" %1',
    );
  });

  it('returns undefined when the value is empty or missing', () => {
    assert.equal(parseRegDefaultValue('    (Default)    REG_SZ    \r\n', {}), undefined);
    assert.equal(parseRegDefaultValue('ERROR: not found', {}), undefined);
  });
});

describe('expandEnvironment', () => {
  it('is case-insensitive and leaves placeholders alone', () => {
    assert.equal(
      expandEnvironment('%ProgramFiles(x86)%\\x.exe %1 %* %UNKNOWN%', { 'PROGRAMFILES(X86)': 'C:\\PF86' }),
      'C:\\PF86\\x.exe %1 %* %UNKNOWN%',
    );
  });
});

describe('splitCommandLine', () => {
  it('splits a quoted executable and its arguments', () => {
    assert.deepEqual(splitCommandLine('"C:\\Program Files\\Mozilla Firefox\\firefox.exe" -osint -url "%1"'), [
      'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
      '-osint',
      '-url',
      '%1',
    ]);
  });

  it('handles an unquoted executable path that contains spaces', () => {
    assert.deepEqual(splitCommandLine('C:\\Program Files\\Browser\\browser.exe -- %1'), [
      'C:\\Program Files\\Browser\\browser.exe',
      '--',
      '%1',
    ]);
  });

  it('follows the backslash and quote rules of CommandLineToArgvW', () => {
    assert.deepEqual(splitCommandLine('x.exe "a\\"b" c\\\\d "e f\\\\"'), ['x.exe', 'a"b', 'c\\\\d', 'e f\\']);
  });
});

describe('substitutePlaceholders', () => {
  const uri = 'file:///C:/My%20Site/index.html';

  it('replaces %1 without adding quotes', () => {
    assert.deepEqual(substitutePlaceholders(['--single-argument', '%1'], uri), ['--single-argument', uri]);
  });

  it('replaces %L and placeholders embedded in an argument', () => {
    assert.deepEqual(substitutePlaceholders(['--url=%L'], uri), [`--url=${uri}`]);
  });

  it('drops %* and appends the target when there is no placeholder', () => {
    assert.deepEqual(substitutePlaceholders(['--new-window', '%*'], uri), ['--new-window', uri]);
  });

  it('does not interpret replacement patterns in the target', () => {
    assert.deepEqual(substitutePlaceholders(['%1'], "file:///C:/$&$'.html"), ["file:///C:/$&$'.html"]);
  });
});
