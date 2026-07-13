# Contributing to AI Coding

Thank you for helping improve AI Coding. This project focuses on making AI coding tools easier to configure, switch, sync, and maintain across local developer workflows.

## Ways to Contribute

- Report bugs with clear reproduction steps and screenshots when possible.
- Suggest provider, routing, memory sync, session export, or UI improvements.
- Improve documentation, translations, packaging, and onboarding.
- Submit focused pull requests that solve one clear problem at a time.

## Development Setup

Prerequisites:

- Node.js 20+
- pnpm
- Rust 1.85+
- Tauri 2 prerequisites for your platform

Common commands:

```bash
pnpm install
pnpm tauri dev
pnpm exec tsc --noEmit
pnpm tauri build
```

Use `pnpm tauri build` for desktop builds. Running `cargo build` alone does not embed the web frontend and can produce a blank app window.

## Pull Requests

- Open an issue first for large features or design changes.
- Keep changes small and easy to review.
- Include screenshots or screen recordings for UI changes.
- Update documentation when behavior changes.
- Run type checks before opening a PR.

## AI-Assisted Contributions

AI tools are welcome, but every contributor is responsible for the code they submit. Please review generated changes carefully, test them locally, and avoid submitting broad refactors without context.

## Questions

Use GitHub Issues for bugs, feature requests, and support questions:

https://github.com/QinBin7899/ai-coding/issues
