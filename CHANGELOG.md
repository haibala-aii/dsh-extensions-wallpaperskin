# Changelog

This file records user-visible changes to `@haibala-aii/dsh-extensions-wallpaperskin`.

## 0.3.0 - 2026-08-16

- Use the original file for Wallpaper Engine image projects instead of the preview thumbnail.
- Stream MP4, WebM, M4V, and MOV video projects with HTTP Range support and muted looping playback.
- Read compatible `scene.pkg` archives and use their primary TEX texture as the DSH background.
- Distinguish original images, videos, scene textures, and preview-only projects in the picker.
- Keep preview images as a fallback when media playback or scene decoding is unavailable.
- Reject unsafe project paths and malformed scene package entries.
- Add focused scene package and texture decoder tests.

## 0.2.0 - 2026-08-16

- Move the installable DSH plugin package to the repository root.
- Open the wallpaper picker from the installed item under **Extensions > External**.
- Add local-library and Wallpaper Engine tabs with a Steam Workshop link.
- Require explicit confirmation before saving a selected wallpaper.
- Add restore and close rollback for unsaved wallpaper changes.
- Apply selected images as a full-window DSH background.
- Add a live `0-70%` surface-transparency preview and save it with the wallpaper.
- Keep the sidebar more opaque than the main workspace for readability.
- Document installation, operation, local data access, development, and contribution workflows in English and Chinese.
- Add Node.js syntax checks in GitHub Actions.

## 0.1.0 - 2026-08-15

- Add the initial static-image plugin skeleton.
- Discover local Steam libraries and Wallpaper Engine projects.
- Serve wallpaper previews and persist the current selection in `$DSH_HOME/wallpaperskin.json`.
