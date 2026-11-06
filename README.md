# Open HTML in Browser

Open HTML files in a web browser straight from VS Code: from the Explorer, from the editor, with a keyboard shortcut, or by double-clicking the file.

The extension finds out which browser is your default and starts that browser with the file. It does not hand the file to the operating system's file association, because `.html` is often associated with a text editor or with VS Code itself, and the file would end up opening there instead of in a browser.

## Install

The extension works the same on Windows, macOS and Linux (including Ubuntu).

### VS Code

1. Open the Extensions view: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> on Windows and Linux, <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> on macOS.
2. Search for **Open HTML in Browser** and click **Install**.

You can also install it from the [Visual Studio Marketplace page](https://marketplace.visualstudio.com/items?itemName=moriyama-dev.vscode-open-html-in-browser), or from a terminal:

```sh
code --install-extension moriyama-dev.vscode-open-html-in-browser
```

**Updates are automatic.** VS Code installs new versions from the Marketplace by itself (unless you turned off `extensions.autoUpdate`).

### VSCodium

The extension is not on Open VSX yet, so install the `.vsix` file from GitHub Releases. Once it is on Open VSX, VSCodium will find it in the Extensions view and update it automatically like any other extension.

**The easy way (all operating systems):**

1. Download `vscode-open-html-in-browser-<version>.vsix` from the [latest release](https://github.com/moriyama-dev/vscode-open-html-in-browser/releases/latest).
2. In VSCodium, open the Extensions view, click the **...** menu at the top and choose **Install from VSIX...**, then pick the downloaded file.

**Install or update with one command.** Run the same command again whenever a new version is released; it always fetches the latest one.

macOS and Ubuntu (Terminal):

```sh
url=$(curl -fsSL https://api.github.com/repos/moriyama-dev/vscode-open-html-in-browser/releases/latest | grep -o 'https://[^"]*\.vsix' | head -n 1) && curl -fsSL -o /tmp/vscode-open-html-in-browser.vsix "$url" && codium --install-extension /tmp/vscode-open-html-in-browser.vsix --force
```

Windows (PowerShell):

```powershell
$u = (Invoke-RestMethod https://api.github.com/repos/moriyama-dev/vscode-open-html-in-browser/releases/latest).assets | Where-Object name -like '*.vsix' | Select-Object -First 1 -ExpandProperty browser_download_url; Invoke-WebRequest $u -OutFile "$env:TEMP\vscode-open-html-in-browser.vsix"; codium --install-extension "$env:TEMP\vscode-open-html-in-browser.vsix" --force
```

To hear about new versions, click **Watch → Custom → Releases** on the [GitHub repository](https://github.com/moriyama-dev/vscode-open-html-in-browser).

### If `code` or `codium` is not found

- **macOS:** open VS Code (or VSCodium), press <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> and run **Shell Command: Install 'code' command in PATH** (**'codium'** in VSCodium). Then open a new Terminal window.
- **Windows:** the installer adds the command to `PATH`; open a new PowerShell window after installing the editor.
- **Ubuntu:** the `.deb`, Snap and apt packages all add the command. If you use the `.tar.gz` build, call `bin/code` or `bin/codium` inside its folder.

## Features

- **Default browser detection** on macOS, Windows and Linux, including Safari. Nothing needs to be configured after installation.
- **Open in Browser** command in the Explorer context menu, the editor context menu and the editor title bar, for `.html` and `.htm` files.
- **<kbd>Alt</kbd>+<kbd>B</kbd>** (<kbd>Option</kbd>+<kbd>B</kbd> on macOS) while an HTML file is selected in the Explorer or open in the editor.
- **Double-click to open**: double-clicking an HTML file in the Explorer opens it in the browser. A single click still opens it in VS Code, and other file types are not affected.
- Unsaved changes are saved before the file is opened.
- File names with spaces or non-ASCII characters work. No shell is involved when the browser is started.

## How the browser is started

| OS      | Default browser                                                                                                                                                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS   | The bundle ID of the default browser is read, then `open -b <bundle-id> <file>`.                                                                                                                                                                                                  |
| Linux   | The `.desktop` entry of the default browser is looked up in `~/.local/share/applications`, `/usr/local/share/applications`, `/usr/share/applications`, the Snap and the Flatpak export directories, then started with `gtk-launch`, or with `gio launch` when `gtk-launch` fails. |
| Windows | The ProgId chosen for `http` links is read from the registry, and the browser is started with the command registered under `shell\open\command`.                                                                                                                                  |

If the default browser cannot be detected, the file is handed to the operating system as a last resort and a warning suggests choosing a browser in the settings.

## Settings

| Setting                               | Default     | Description                                                                                                                                                                                           |
| ------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openHtmlInBrowser.browser`           | `"default"` | `default`, `chrome`, `firefox`, `edge`, `safari`, `brave` or `custom`. `default` uses the operating system's default browser. On Linux, `chrome` falls back to Chromium when Chrome is not installed. |
| `openHtmlInBrowser.customBrowserPath` | `""`        | Full path to the browser executable, used when `browser` is `custom`. On macOS an `.app` bundle can also be given.                                                                                    |
| `openHtmlInBrowser.openOnDoubleClick` | `true`      | Open HTML files in the browser when they are double-clicked in the Explorer. When `false`, they open in the text editor as usual.                                                                     |
| `openHtmlInBrowser.alsoOpenInEditor`  | `false`     | When an HTML file is double-clicked in the Explorer, open it in the text editor as well as in the browser.                                                                                            |

`browser` and `customBrowserPath` can only be set in user settings. Workspace settings cannot change which program is started.

## Double-click to open

| In the Explorer                        | Result                     |
| -------------------------------------- | -------------------------- |
| Single-click an HTML file              | Opens in VS Code, as usual |
| Double-click an HTML file              | Opens in the browser only  |
| Single- or double-click any other file | Unchanged                  |

No VS Code settings need to be changed.

VS Code does not tell extensions about double-clicks in the Explorer, so the extension registers itself as the default editor for `*.html` and `*.htm` and looks at how the file is being opened. A single click opens a _preview_ tab (shown in italics), and the extension passes it on to the text editor. A double-click opens a regular tab, and the extension starts the browser instead, closing the preview left behind by the first click.

To keep the file open in VS Code as well, enable `openHtmlInBrowser.alsoOpenInEditor`.

Files that are not on disk, such as the old version shown in a Git diff, always open in the text editor only.

To stop opening the browser this way, set `openHtmlInBrowser.openOnDoubleClick` to `false`. The command, the menus and the shortcut keep working.

## Remote windows

In Remote - SSH, WSL, Dev Containers and GitHub Codespaces windows, the HTML file is on the remote machine but the browser is on your computer. There the extension serves the file over HTTP from the remote machine, VS Code forwards the port to your computer, and the page opens in your default browser. The command, the menus, the shortcut and the double-click all work the same way.

- The whole workspace folder is served, so links to CSS, scripts and images work, including ones in parent folders of the page. A file outside the workspace is served from its own folder.
- The server listens on the remote machine's loopback interface only, and every address contains a random token, so other users on the machine cannot read your files through it. Paths that leave the folder, also through symbolic links, are refused, and folders are never listed.
- The server stops when the VS Code window is closed.
- The `browser` and `customBrowserPath` settings do not apply in remote windows: the page opens in the default browser of your computer.

## Known limitations

- **Snap Firefox on Ubuntu** cannot read files inside hidden folders (for example `~/.config` or `~/.cache`) because of Snap confinement. Move the file, or use a Firefox installed from Mozilla's APT repository.
- Single and double clicks are told apart by preview tabs. If preview tabs are turned off (`"workbench.editor.enablePreview": false`), every click opens a regular tab, so a single click also starts the browser.
- Because the extension is the default editor for HTML files, opening an HTML file in a regular tab in other ways, such as from Quick Open, also starts the browser. Use **Reopen Editor With... › Text Editor** or disable `openOnDoubleClick` if that gets in the way.

## License

MIT. See the `LICENSE` file included with the extension.
