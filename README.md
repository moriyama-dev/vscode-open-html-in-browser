# Open HTML in Browser

Open HTML files in a web browser straight from VS Code: from the Explorer, from the editor, with a keyboard shortcut, or by double-clicking the file.

The extension finds out which browser is your default and starts that browser with the file. It does not hand the file to the operating system's file association, because `.html` is often associated with a text editor or with VS Code itself, and the file would end up opening there instead of in a browser.

## Features

- **Default browser detection** on macOS, Windows and Linux, including Safari. Nothing needs to be configured after installation.
- **Open in Browser** command in the Explorer context menu, the editor context menu and the editor title bar, for `.html` and `.htm` files.
- **<kbd>Alt</kbd>+<kbd>B</kbd>** (<kbd>Option</kbd>+<kbd>B</kbd> on macOS) while an HTML file is selected in the Explorer or open in the editor.
- **Double-click to open**: opening an HTML file from the Explorer starts the browser, and the file can open in the text editor as well.
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
| `openHtmlInBrowser.openOnDoubleClick` | `true`      | Open HTML files in the browser when they are opened from the Explorer. When `false`, they open in the text editor as usual.                                                                           |
| `openHtmlInBrowser.alsoOpenInEditor`  | `true`      | When a file is opened in the browser from the Explorer, also open it in the text editor.                                                                                                              |

`browser` and `customBrowserPath` can only be set in user settings. Workspace settings cannot change which program is started.

## Double-click to open

VS Code does not tell extensions about double-clicks in the Explorer. Instead, the extension registers itself as the default editor for `*.html` and `*.htm`. When VS Code opens an HTML file, the extension starts the browser, opens the file in the text editor if `alsoOpenInEditor` is enabled, and closes its own tab.

By default the Explorer opens files with a **single** click, so selecting an HTML file would already start the browser. The first time the extension runs, it offers to change `workbench.list.openMode` to `doubleClick`. You can also change it yourself:

```json
{
  "workbench.list.openMode": "doubleClick"
}
```

Files that are not on disk, such as the old version shown in a Git diff, always open in the text editor only.

To stop opening the browser this way, set `openHtmlInBrowser.openOnDoubleClick` to `false`. The command, the menus and the shortcut keep working.

## Known limitations

- **Remote windows are not supported yet.** In Remote - SSH, WSL, Dev Containers and similar windows, the extension runs on the remote machine, where it cannot start the browser on your computer. The command shows a message, and opening a file from the Explorer opens it in the text editor only.
  A future version could serve the file from a small HTTP server inside the extension and pass its address through `vscode.env.asExternalUri`, which forwards the port so the browser on your computer can load the page.
- **Snap Firefox on Ubuntu** cannot read files inside hidden folders (for example `~/.config` or `~/.cache`) because of Snap confinement. Move the file, or use a Firefox installed from Mozilla's APT repository.
- Because the extension is the default editor for HTML files, the browser also starts when an HTML file is opened in other ways, such as from Quick Open or search results. Use **Reopen Editor With... › Text Editor** or disable `openOnDoubleClick` if that gets in the way.

## License

MIT. See the `LICENSE` file included with the extension.
