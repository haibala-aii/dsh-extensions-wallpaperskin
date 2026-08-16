# Contributing

Contributions are welcome through [GitHub Issues](https://github.com/haibala-aii/dsh-extensions-wallpaperskin/issues) and pull requests.

## Before opening an issue

Search existing issues first. For a bug, include:

- DSH version and installation method
- Windows and Node.js versions
- Steam library layout or whether `STEAM_PATH` is set
- Wallpaper project type (`image`, `video`, `web`, or `scene`)
- Steps to reproduce and the observed result
- Relevant DSH logs with personal paths and credentials removed

Do not attach copyrighted wallpaper files unless you have permission to redistribute them. For security reports, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Local development

Clone the repository and run the focused checks:

```sh
git clone https://github.com/haibala-aii/dsh-extensions-wallpaperskin.git
cd dsh-extensions-wallpaperskin
npm run check
npm pack --dry-run
```

The package has no build step or installed runtime dependencies. `lib/index.js` is the DSH Host plugin and `lib/client.js` is loaded by the DSH browser runtime.

Link the checkout into a disposable DSH web profile:

```sh
dsh plugin --profile web add link:E:/path/to/dsh-extensions-wallpaperskin
dsh web
```

Restart DSH after changing Host or Client code. Test the behavior in **Extensions > External**.

## Pull requests

- Keep changes focused and explain the user-visible behavior.
- Preserve the explicit **Apply wallpaper** confirmation. Selection and slider changes must remain reversible until they are saved.
- Keep local file paths out of browser responses. The Host API exposes stable ids and local image bytes, not absolute paths for individual wallpapers.
- Update both `README.md` and `README.zh.md` when user-facing behavior or configuration changes.
- Add an entry to `CHANGELOG.md` for user-visible changes.
- Run `npm run check`, `npm pack --dry-run`, and `git diff --check` before submitting.
- Include manual DSH verification steps for UI changes.

By submitting a contribution, you agree that it may be distributed under the repository's [MIT License](LICENSE).
