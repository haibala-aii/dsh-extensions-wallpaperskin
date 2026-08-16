# @haibala-aii/dsh-extensions-wallpaperskin

English | [中文](README.zh.md)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web plugin that uses local Wallpaper Engine media as the DSH background. It adds a wallpaper picker to **Extensions > External**, keeps the DSH workspace readable with translucent surfaces, and stores the selected wallpaper locally.

> [!IMPORTANT]
> Image projects use their original image and video projects play their original local video. Compatible `scene.pkg` projects use the primary texture stored inside the package. Wallpaper Engine particles, SceneScript, puppet rigs, audio visualizers, and web wallpapers are not executed; unsupported projects retain their preview image.

## Features

- Discovers Steam libraries on Windows through `STEAM_PATH`, the Steam registry entry, and common installation paths.
- Scans subscribed Wallpaper Engine Workshop items and local Wallpaper Engine projects.
- Streams MP4, WebM, M4V, and MOV files with browser-native muted looping playback.
- Reads PKGV scene packages and decodes PNG, JPEG, BMP, raw BGRA, and RLE-compressed TEX base textures.
- Opens from the installed `extensions-wallpaperskin` row under **Extensions > External** instead of adding another Settings page.
- Separates the local library and Wallpaper Engine Workshop cache into tabs.
- Stages wallpaper and transparency changes until **Apply wallpaper** is pressed.
- Restores the saved wallpaper and transparency when the dialog is closed or **Restore current selection** is pressed.
- Applies local image, video, or compatible scene media as a full-window `cover` background while keeping DSH content and navigation usable.
- Provides a `0-70%` surface-transparency control. The default is `36%`; the sidebar stays 14 percentage points less transparent for readability.
- Keeps wallpaper files on the local machine and serves them only through the local DSH host.

## Requirements

- Windows. Automatic Steam discovery currently targets Windows registry and drive layouts.
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) with the web profile.
- Node.js `^22.19.0` or `>=24.0.0`, matching the package engine declaration.
- Wallpaper Engine for Workshop and local-project discovery. The plugin can still load without Wallpaper Engine, but the picker will be empty.

If Steam is installed in a non-standard location, set `STEAM_PATH` to the Steam directory before starting DSH.

## Installation

Install directly from GitHub into the DSH web profile:

```sh
dsh plugin --profile web add github:haibala-aii/dsh-extensions-wallpaperskin
```

Restart the web application after installation:

```sh
dsh web
```

For a local checkout, clone the repository and link its root directory:

```sh
git clone https://github.com/haibala-aii/dsh-extensions-wallpaperskin.git
dsh plugin --profile web add link:E:/path/to/dsh-extensions-wallpaperskin
```

The repository root is the installable package. There is no nested package directory.

## Usage

1. Open DSH and go to **Extensions > External**.
2. Click the `extensions-wallpaperskin` row for `@haibala-aii/dsh-extensions-wallpaperskin`.
3. Choose **Local library** to see every discovered project, or **Wallpaper Engine** to see locally synced Workshop items. The Workshop link opens Steam when you need to subscribe to more wallpapers.
4. Check the media label on each card: **Original**, **Video**, **Scene texture**, or **Preview only**. Click a card to stage the selection.
5. Adjust **Surface transparency** to preview how much of the wallpaper is visible through the DSH base surface.
6. Press **Apply wallpaper** to save both settings.

Closing the dialog before applying restores the saved state. **Restore current selection** also discards the staged wallpaper and transparency. **Disable wallpaper** removes the background without deleting any Wallpaper Engine files.

## Wallpaper discovery

For every discovered Steam library, the host scans:

```text
steamapps/workshop/content/431960
steamapps/common/wallpaper_engine/projects/myprojects
```

The scanner reads `project.json` when present. Image projects use the declared original image. Video projects use the declared video or the first supported video in the project directory. Scene projects follow `scene.json`, model metadata, and material metadata inside `scene.pkg` to find the primary TEX texture. Preview files remain thumbnails and runtime fallbacks.

Supported image extensions are PNG, JPEG, GIF, WebP, BMP, SVG, and AVIF. Supported video containers are MP4, WebM, M4V, and MOV; playback still depends on codecs supported by the browser.

The **Wallpaper Engine** tab is a view of Workshop files already downloaded to the machine. The plugin does not download Workshop items itself. Subscribe or create wallpapers in Wallpaper Engine, wait for them to sync, then use **Scan local library** in the dialog.

## Configuration

The host stores configuration in `$DSH_HOME/wallpaperskin.json`. When `DSH_HOME` is unset, DSH's default home is used (`~/.dsh`). A saved configuration looks like this:

```json
{
  "enabled": true,
  "selectedId": "workshop/1234567890",
  "surfaceTransparency": 36
}
```

`surfaceTransparency` is an integer from `0` to `70`. `0` keeps the DSH base surface opaque; larger values reveal more of the wallpaper. Invalid or missing values resolve to `36` in the client.

## Host API

The browser client uses these local endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/plugins/wallpaperskin/list` | Rescan and return available wallpapers, Steam library roots, and saved configuration |
| `GET` | `/plugins/wallpaperskin/preview/<id>` | Return a wallpaper thumbnail |
| `GET` | `/plugins/wallpaperskin/image/<id>` | Return the selected background image |
| `GET` | `/plugins/wallpaperskin/media/<id>` | Return an original image, a ranged video stream, or a decoded scene texture |
| `GET` | `/plugins/wallpaperskin/config` | Return the saved configuration |
| `POST` | `/plugins/wallpaperskin/config` | Merge and save configuration fields |
| `GET` | `/plugins/wallpaperskin/health` | Return plugin health and rendering mode |

The API is intended for the local DSH web client. It is not an authenticated public media service. Apply the same network-access controls to DSH that you use for other local-file capabilities.

## Architecture

The package has two runtime halves:

- `lib/index.js` is the Host plugin. It discovers Steam libraries, selects original project media, provides ranged video responses, exposes the HTTP endpoints, and persists configuration.
- `lib/scene-package.js` validates PKGV directories, resolves scene metadata, and decodes the largest TEX mip level without extracting files to disk.
- `lib/client.js` is the browser plugin. It registers the Extensions overlay, renders the picker, previews draft changes, and applies image or video backgrounds with translucent DSH theme variables.

`cordis.patch.yml` inserts the Host plugin into the selected DSH profile. The `dsh.client` fields in `package.json` register the browser half.

## Privacy and security

The plugin does not upload wallpapers, send telemetry, or call a remote wallpaper API. Wallpaper metadata, package textures, and video bytes remain on the machine and are read by the local DSH host. The only external navigation is the user-initiated link to the public Wallpaper Engine Workshop.

DSH serves selected media to its connected web client. Do not expose an untrusted DSH instance to the network, because any client that can reach these plugin routes can request discovered wallpaper media by id.

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Development

No build step is required. Edit the ESM sources in `lib/`, then run:

```sh
npm run check
npm pack --dry-run
```

To exercise the plugin in DSH, link the checkout to a disposable web profile, restart `dsh web`, and test the complete selection, preview, apply, restore, and disable flows.

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), review the [open issues](https://github.com/haibala-aii/dsh-extensions-wallpaperskin/issues), and include focused verification with behavior changes.

## Project identifiers

- Cordis row id: `wallpaperskin`
- Package: `@haibala-aii/dsh-extensions-wallpaperskin`
- Browser extension row: `extensions-wallpaperskin`
- Host route prefix: `/plugins/wallpaperskin`

## License

Released under the [MIT License](LICENSE).
