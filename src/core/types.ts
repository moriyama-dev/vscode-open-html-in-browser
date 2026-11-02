export type BrowserSetting = 'default' | 'chrome' | 'firefox' | 'edge' | 'safari' | 'brave' | 'custom';

export type KnownBrowser = Exclude<BrowserSetting, 'default' | 'custom'>;

export interface BrowserOptions {
  browser: BrowserSetting;
  customBrowserPath: string;
}

/** Result of the `default-browser` package. */
export interface DefaultBrowserInfo {
  name: string;
  id: string;
}

/**
 * Everything the resolver needs from the operating system.
 * Injected so the platform branches can be tested on any host.
 */
export interface SystemDeps {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  homedir: string;
  fileExists(filePath: string): Promise<boolean>;
  readTextFile(filePath: string): Promise<string>;
  /** Runs a program without a shell and resolves with its stdout. */
  execFile(command: string, args: readonly string[]): Promise<string>;
  defaultBrowser(): Promise<DefaultBrowserInfo>;
}

/** A browser that has been located and can be launched. */
export type BrowserTarget =
  | { kind: 'mac-bundle'; name: string; bundleId: string }
  | { kind: 'mac-app'; name: string; appPath: string }
  | {
      kind: 'linux-desktop';
      name: string;
      desktopId: string;
      desktopPath: string | undefined;
      gtkLaunchPath: string | undefined;
      gioPath: string | undefined;
    }
  | { kind: 'windows-command'; name: string; progId: string; executable: string; args: string[] }
  | { kind: 'executable'; name: string; executable: string };

export interface LaunchCommand {
  command: string;
  args: string[];
  /**
   * True for helpers such as `open`, `gtk-launch` and `gio` that hand the file
   * to the browser and exit, so their exit code tells us whether it worked.
   * False for the browser binary itself, which keeps running.
   */
  waitForExit: boolean;
}
