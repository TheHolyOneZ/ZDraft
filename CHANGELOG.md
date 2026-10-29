# Changelog

Every release of ZDraft, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [0.2.0] — 2026-10-29

### Fixed

- **Unsaved edits are no longer lost when you switch files** ([#1]). Opening
  another file, creating one (new, template or import) or closing the window
  with unsaved changes now asks **Save**, **Don't save** or **Cancel**. This
  covers the titlebar's close button and the system's own (`Alt+F4`). Clicking
  the file that is already open no longer reloads it from disk over your edits.
- **"Release all pins" no longer wipes the layout file in one click** ([#2]).
  It asks first, says what will be written, and leaves a toast with **Undo**;
  `Ctrl+Z` brings the pins back too.
- **Edge labels show their line breaks** ([#3]). `<br/>` in a Mermaid edge label
  — piped (`-->|a<br/>b|`) or inline (`-- a<br/>b -->`) — now draws one line per
  row, as node labels already did. The same applies to Graphviz `\n`, to
  subgraph titles and to sequence-diagram messages, on the canvas and in SVG,
  PNG, PDF and CLI exports.
- An inline Mermaid edge label containing `<br/>` was read as a run of extra
  nodes, which raised a "declared nodes did not render" warning. It is now read
  as the label it is.
- A subgraph whose title runs over two lines grows to fit the title instead of
  letting it overlap the first node inside.
- Dropping a dragged node no longer moves the selection to whichever node the
  editor's cursor last sat in.
- The file tree's pin badge now appears and disappears as soon as a layout file
  is created or removed, rather than on the next refresh.
- **Back to auto-layout** in the file tree's menu asks before it deletes the
  layout file, and no longer throws away unsaved source edits when used on the
  open file.
- A layout change made in the last moment before switching files or closing is
  written instead of dropped.
- A failed `Ctrl+S` now says so in a toast instead of failing silently.

### Added

- **Save layout as you go**, under Settings → Canvas. On by default, which keeps
  the behaviour you are used to. Turned off, drags and pins wait for `Ctrl+S`
  like the source does, the title bar shows `•` until they are saved, and
  switching files asks first.

### Changed

- Fit-to-view stops at 160 % rather than 260 %, so a three-node diagram no
  longer opens at poster size.
- Dialogs, menus and toasts are a little more opaque, so the canvas behind them
  stays out of the way on Linux, where WebKitGTK does not always blur it.
- The command-line renderer's bundle is rebuilt from the current source.
- The installer workflow builds the Linux AppImage, `.deb` and `.rpm` alongside
  the Windows installer, runs the test suite first, checks the Linux binary
  needs no newer glibc than Ubuntu 22.04's, and runs on its own when a `v*` tag
  is pushed.

## [0.1.0] — 2026-09-08

First public release.

[#1]: https://github.com/TheHolyOneZ/ZDraft/issues/1
[#2]: https://github.com/TheHolyOneZ/ZDraft/issues/2
[#3]: https://github.com/TheHolyOneZ/ZDraft/issues/3
[0.2.0]: https://github.com/TheHolyOneZ/ZDraft/compare/b514f26...v0.2.0
[0.1.0]: https://github.com/TheHolyOneZ/ZDraft/commit/b514f26
