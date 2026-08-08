# Changelog

## v3.17.1 - 2026-08-08

- Fixed startup importing an empty live config as a meaningless "default" provider entry (e.g. a Claude `settings.json` that is just `{}`): empty snapshots are now skipped instead of being saved and marked current.
- Fixed the Rust integration test suite, which had been silently broken since the rebrand: test isolation now cleans the app database directory, and stale `.ai-coding`/`cc switch` path and naming expectations were updated to the current layout.

## v3.17.0 - 2026-08-08

- Added chat archive to the session manager: sessions can be moved into a separate "Archived" tab in the left list to keep the main list clean.
- Added session pinning: pinned sessions stay at the top of the session list with a dedicated "Pinned" group.
- Fixed macOS downloads being blocked by Gatekeeper with a "damaged" error: release builds are now fully ad-hoc signed instead of linker-signed only.
- Documented how to open the app when macOS blocks the first launch (System Settings "Open Anyway" or `xattr -cr`).

## v3.16.2 - 2026-07-14

- Rebranded the project as AI Coding.
- Added a Claude-style warm orange theme and dark-first UI.
- Added a macOS-like animated dock with hover labels.
- Added Bincode as an OpenCode-compatible app target.
- Added categorized provider presets for domestic, custom, and international models.
- Added cross-tool memory sync from Claude Code memory to other coding tools.
- Added Markdown export for chat/session records.
- Removed activation requirements from the public open-source build.
- Published a macOS Apple Silicon DMG download in the repository.
