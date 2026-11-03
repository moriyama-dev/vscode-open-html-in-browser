# Changelog

## 0.1.0 - 2026-11-02

Initial release.

- Detect the default browser on macOS, Windows and Linux and open HTML files in it, without relying on the `.html` file association.
- `openHtmlInBrowser.browser` and `openHtmlInBrowser.customBrowserPath` settings to choose Chrome, Firefox, Edge, Safari, Brave or any executable.
- **Open in Browser** command in the Explorer context menu, the editor context menu and the editor title bar, with the <kbd>Alt</kbd>+<kbd>B</kbd> shortcut.
- Double-click an HTML file in the Explorer to open it in the browser, while a single click still opens it in VS Code. Controlled by `openHtmlInBrowser.openOnDoubleClick` and `openHtmlInBrowser.alsoOpenInEditor`.
- Save unsaved changes before opening.
- English and Japanese UI.
