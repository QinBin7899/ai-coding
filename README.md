# AI Coding

<p align="center">
  <img src="assets/branding/ai-coding-wordmark.png" alt="AI Coding" width="520" />
</p>

AI Coding is a desktop manager for AI coding tools and model providers. It gives you one place to switch providers, manage prompts, sync MCP servers, organize skills, inspect sessions, and work across multiple AI apps with a cleaner Apple-style interface.

## Screenshots

| Main | Add Provider |
| --- | --- |
| ![Main](assets/screenshots/main-zh.png) | ![Add Provider](assets/screenshots/add-zh.png) |

## Supported Apps

- Claude Code
- Claude Desktop
- Codex
- Gemini CLI
- OpenCode
- bincode
- OpenClaw
- Hermes

`bincode` is integrated as an OpenCode-compatible app in this fork.

## What This Fork Includes

- Warm orange + dark Apple-inspired visual style
- Floating Dock-style bottom navigation
- Provider switching for multiple AI coding apps
- Prompt, Skills, MCP, Sessions, Workspace, Tools, Memory and Settings views
- `bincode` branding and switch support
- Open-source build in this repository with no activation-code gate

## Open-Source Build Note

This repository is prepared as an open-source version for self-hosted use and secondary development.

- The activation gate has been removed from this repo build.
- Commercial/private builds can still reintroduce license logic separately if needed.
- Existing internal config compatibility is preserved, so some storage paths still keep historical names for migration safety.

## Development

### Requirements

- Node.js 20+
- pnpm
- Rust
- Tauri build environment

### Run

```bash
pnpm install
pnpm tauri dev
```

### Build

```bash
pnpm tauri build
```

## Project Structure

```text
src/          React + TypeScript frontend
src-tauri/    Rust + Tauri backend
assets/       Screenshots and branding assets
```

## Publishing To GitHub

Recommended repo sections for the public page:

- A short product description
- 2 screenshots
- Supported apps list
- Build steps
- Open-source note

You can use this README directly as the first public version.

## License

MIT
