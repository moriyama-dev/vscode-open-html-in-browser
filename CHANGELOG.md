# Changelog

## 0.2.0 - 2026-11-03

- Open HTML files in your browser from Remote - SSH, WSL, Dev Containers and Codespaces windows. The file is served from the remote machine and reached through a forwarded port, so relative links to CSS, scripts and images keep working.

## 0.1.1 - 2026-11-03

- New extension icon that reads at a glance in the Marketplace and in the Extensions view.

## 0.1.0 - 2026-11-02

Initial release.

- Detect the default browser on macOS, Windows and Linux and open HTML files in it, without relying on the `.html` file association.
- `openHtmlInBrowser.browser` and `openHtmlInBrowser.customBrowserPath` settings to choose Chrome, Firefox, Edge, Safari, Brave or any executable.
- **Open in Browser** command in the Explorer context menu, the editor context menu and the editor title bar, with the <kbd>Alt</kbd>+<kbd>B</kbd> shortcut.
- Double-click an HTML file in the Explorer to open it in the browser, while a single click still opens it in VS Code. Controlled by `openHtmlInBrowser.openOnDoubleClick` and `openHtmlInBrowser.alsoOpenInEditor`.
- Save unsaved changes before opening.
- English and Japanese UI.
