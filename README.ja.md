# Open HTML in Browser

[English](README.md) | 日本語

VS Code から HTML ファイルをそのまま Web ブラウザーで開きます。エクスプローラーから、エディターから、キーボードショートカットで、またはファイルのダブルクリックで開けます。

この拡張機能は、まず既定のブラウザーがどれかを調べ、そのブラウザーにファイルを渡して起動します。OS のファイルの関連付けには任せません。`.html` はテキストエディターや VS Code 自体に関連付けられていることが多く、任せるとブラウザーではなくそちらで開いてしまうからです。

不具合や要望があれば、[GitHub の Issues](https://github.com/moriyama-dev/vscode-open-html-in-browser/issues) でお知らせください。

## インストール

Windows、macOS、Linux（Ubuntu を含む）のどれでも同じように使えます。

### VS Code

1. 拡張機能ビューを開きます。Windows と Linux は <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd>、macOS は <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> です。
2. **Open HTML in Browser** を検索して、**Install**（インストール）を押します。

[Visual Studio Marketplace のページ](https://marketplace.visualstudio.com/items?itemName=moriyama-dev.vscode-open-html-in-browser)から入れることもできます。ターミナルから入れる場合は、次のコマンドです。

```sh
code --install-extension moriyama-dev.vscode-open-html-in-browser
```

**更新は自動です。** 新しいバージョンが出ると、VS Code が Marketplace から自動で入れ替えます（設定の `extensions.autoUpdate` をオフにしている場合を除きます）。

### VSCodium

1. 拡張機能ビューを開きます。ショートカットは VS Code と同じです。
2. **Open HTML in Browser** を検索して、**Install**（インストール）を押します。

VSCodium は、この拡張機能を [Open VSX](https://open-vsx.org/extension/moriyama-dev/vscode-open-html-in-browser) から入れます。ターミナルから入れる場合は、次のコマンドです。

```sh
codium --install-extension moriyama-dev.vscode-open-html-in-browser
```

**こちらも更新は自動です。** 新しいバージョンが出ると、VSCodium が Open VSX から自動で入れ替えます。

### `.vsix` ファイルから入れる

Marketplace も Open VSX も使わないエディター向けに、リリースごとの `.vsix` ファイルを [GitHub Releases](https://github.com/moriyama-dev/vscode-open-html-in-browser/releases/latest) に置いています。拡張機能ビューの上部にある **...** メニューから **Install from VSIX...**（VSIX からのインストール）を選び、ダウンロードしたファイルを指定します。この方法で入れたものは自動では更新されないので、新しいバージョンが出たら、新しいファイルを入れ直してください。

### `code` や `codium` のコマンドが見つからないとき

- **macOS:** VS Code（または VSCodium）を開き、<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> を押して **Shell Command: Install 'code' command in PATH** を実行します（VSCodium では **'codium'**）。そのあと、ターミナルを新しく開き直してください。
- **Windows:** インストーラーがコマンドを `PATH` に追加します。エディターを入れたあとに、PowerShell を新しく開き直してください。
- **Ubuntu:** `.deb`、Snap、apt のどの方法で入れても、コマンドは使えるようになります。`.tar.gz` 版を使っている場合は、そのフォルダーの中の `bin/code` か `bin/codium` を実行してください。

## できること

- **既定のブラウザーを自動で判定**します。macOS、Windows、Linux に対応し、Safari も判定できます。インストールしたあとに設定するものはありません。
- **ブラウザーで開く**（Open in Browser）コマンドが、エクスプローラーの右クリックメニュー、エディターの右クリックメニュー、エディターのタイトルバーに出ます。対象は `.html` と `.htm` のファイルです。
- **<kbd>Alt</kbd>+<kbd>B</kbd>**（macOS は <kbd>Option</kbd>+<kbd>B</kbd>）: HTML ファイルをエクスプローラーで選んでいるとき、またはエディターで開いているときに使えます。
- **ダブルクリックで開く**: エクスプローラーで HTML ファイルをダブルクリックすると、ブラウザーで開きます。シングルクリックではこれまでどおり VS Code で開き、ほかの種類のファイルには影響しません。
- 保存していない変更は、ファイルを開く前に保存します。
- ファイル名に空白や日本語などの文字が入っていても開けます。ブラウザーの起動にシェルは使いません。

## ブラウザーの起動のしかた

| OS      | 既定のブラウザー                                                                                                                                                                                                                                            |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS   | 既定のブラウザーのバンドル ID を読み取り、`open -b <バンドル ID> <ファイル>` で起動します。                                                                                                                                                                 |
| Linux   | 既定のブラウザーの `.desktop` エントリーを、`~/.local/share/applications`、`/usr/local/share/applications`、`/usr/share/applications`、Snap と Flatpak のフォルダーから探し、`gtk-launch` で起動します。`gtk-launch` が失敗したら `gio launch` を使います。 |
| Windows | `http` のリンクに選ばれている ProgId をレジストリから読み取り、`shell\open\command` に登録されているコマンドでブラウザーを起動します。                                                                                                                      |

既定のブラウザーを判定できなかったときは、最後の手段としてファイルを OS に渡して開き、設定でブラウザーを選ぶよう勧める警告を出します。

## 設定

| 設定                                  | 既定値      | 内容                                                                                                                                                                                              |
| ------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openHtmlInBrowser.browser`           | `"default"` | `default`、`chrome`、`firefox`、`edge`、`safari`、`brave`、`custom` のどれか。`default` は OS の既定のブラウザーを使います。Linux で `chrome` を選んで Chrome が無い場合は、Chromium を使います。 |
| `openHtmlInBrowser.customBrowserPath` | `""`        | `browser` が `custom` のときに使う、ブラウザーの実行ファイルのフルパス。macOS では `.app` も指定できます。                                                                                        |
| `openHtmlInBrowser.openOnDoubleClick` | `true`      | エクスプローラーで HTML ファイルをダブルクリックしたときに、ブラウザーで開きます。`false` にすると、通常どおりテキストエディターで開きます。                                                      |
| `openHtmlInBrowser.alsoOpenInEditor`  | `false`     | エクスプローラーで HTML ファイルをダブルクリックしたとき、ブラウザーに加えてテキストエディターでも開きます。                                                                                      |

`browser` と `customBrowserPath` は、ユーザー設定でだけ指定できます。ワークスペースの設定で、起動するプログラムを変えることはできません。

## ダブルクリックで開く

| エクスプローラーでの操作                               | 結果                          |
| ------------------------------------------------------ | ----------------------------- |
| HTML ファイルをシングルクリック                        | これまでどおり VS Code で開く |
| HTML ファイルをダブルクリック                          | ブラウザーだけで開く          |
| ほかのファイルをシングルクリック、またはダブルクリック | 変わらない                    |

VS Code の設定を変える必要はありません。

VS Code は、エクスプローラーでのダブルクリックを拡張機能に知らせません。そこでこの拡張機能は、`*.html` と `*.htm` の既定のエディターとして自分を登録し、ファイルがどう開かれたかを見分けています。シングルクリックでは「プレビュー」のタブ（タブ名が斜体）が開くので、そのままテキストエディターに渡します。ダブルクリックでは通常のタブが開くので、代わりにブラウザーを起動し、1 回目のクリックで残ったプレビューのタブを閉じます。

VS Code でも開いたままにしたい場合は、`openHtmlInBrowser.alsoOpenInEditor` をオンにしてください。

ディスク上に無いファイル（Git の差分に出る以前の版など）は、いつもテキストエディターだけで開きます。

この開き方をやめるには、`openHtmlInBrowser.openOnDoubleClick` を `false` にします。コマンド、メニュー、ショートカットは、そのまま使えます。

## リモートのウィンドウ

Remote - SSH、WSL、Dev Containers、GitHub Codespaces のウィンドウでは、HTML ファイルはリモートのマシンにあり、ブラウザーは手元のパソコンにあります。この場合、拡張機能はリモートのマシンからファイルを HTTP で配信し、VS Code がそのポートを手元のパソコンに転送して、ページを手元の既定のブラウザーで開きます。コマンド、メニュー、ショートカット、ダブルクリックは、どれも同じように使えます。

- ワークスペースのフォルダー全体を配信するので、CSS、スクリプト、画像へのリンクも効きます。ページより上の階層にあるものも読めます。ワークスペースの外にあるファイルは、そのファイルのフォルダーから配信します。
- サーバーは、リモートのマシンのループバック（自分自身だけがつなげるアドレス）でだけ待ち受けます。アドレスにはランダムなトークンが入るので、同じマシンのほかのユーザーが、このサーバー経由でファイルを読むことはできません。フォルダーの外に出るパス（シンボリックリンク経由を含む）は拒否し、フォルダーの一覧は出しません。
- サーバーは、VS Code のウィンドウを閉じると止まります。
- リモートのウィンドウでは、`browser` と `customBrowserPath` の設定は使われません。ページは、手元のパソコンの既定のブラウザーで開きます。

## 既知の制限

- **Ubuntu の Snap 版 Firefox** は、Snap の制限のため、隠しフォルダー（`~/.config` や `~/.cache` など）の中のファイルを読めません。ファイルを別の場所に移すか、Mozilla の APT リポジトリから入れた Firefox を使ってください。
- シングルクリックとダブルクリックは、プレビューのタブで見分けています。プレビューのタブをオフにしている場合（`"workbench.editor.enablePreview": false`）は、どのクリックでも通常のタブが開くので、シングルクリックでもブラウザーが起動します。
- この拡張機能が HTML ファイルの既定のエディターになるので、クイックオープンなど、ほかの方法で HTML ファイルを通常のタブで開いたときも、ブラウザーが起動します。困る場合は、**Reopen Editor With... › Text Editor**（エディターを再度開くアプリケーションの選択 › テキスト エディター）を使うか、`openOnDoubleClick` をオフにしてください。

## ライセンス

MIT ライセンスです。拡張機能に含まれている `LICENSE` ファイルをご覧ください。
