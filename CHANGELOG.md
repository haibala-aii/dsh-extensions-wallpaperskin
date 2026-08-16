# Changelog

This file records user-visible changes to `@haibala-aii/dsh-extensions-wallpaperskin`.

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
