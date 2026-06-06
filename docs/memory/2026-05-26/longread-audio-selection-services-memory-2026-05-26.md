# Longread Audio Selection Services Memory - 2026-05-26

> **Superseded note, 2026-05-26:** This Services-first direction was replaced by the Highlight Mode + Codex Mode direction in `/Users/cobibean/DEV/longread-audio/docs/memory/2026-05-26/longread-audio-highlight-codex-modes-memory-2026-05-26.md`. Services may remain a future optional trigger, but it is no longer the launch plan.

## Session summary

- The user wants a low-friction "highlight text, then read it" path that works while the app is open.
- We investigated the implementation shape and chose a staged rollout instead of trying the hardest universal overlay first.
- This memory was started before implementation so future agents preserve the product direction.

## Decisions made

- Ship selection-to-audio integrations in this order:
  1. macOS Services integration first.
  2. Chrome extension second, if a web app/browser release becomes part of the product path.
  3. Universal macOS selection bubble third; this is the user's favorite/vision, but it is the hardest and least deterministic path.
- The Services integration should still show a cost estimate before any paid generation.
- The selection path should reuse the existing provider adapter, cost cap, chunking, retry, and MP3 generation pipeline.
- Do not turn this into Speakeasy: no dictation, hotkeys, paste automation, accounts, sync, hosted history, or background transcription.

## Source-of-truth docs

- `/Users/cobibean/DEV/longread-audio/AGENTS.md`
- `/Users/cobibean/DEV/longread-audio/README.md`
- `/Users/cobibean/DEV/longread-audio/docs/PRD.md`
- `/Users/cobibean/DEV/longread-audio/docs/RESEARCH.md`
- `/Users/cobibean/DEV/longread-audio/docs/superpowers/plans/2026-05-25-longread-audio-mvp.md`
- `/Users/cobibean/DEV/longread-audio/docs/superpowers/plans/2026-05-26-macos-services-integration.md`

## Known constraints

- This directory is not a git repo.
- The current app is Electron with native helper precedent already established for Keychain.
- A universal macOS bubble requires Accessibility APIs and per-app behavior testing; Services is a more reliable first integration.
- macOS Services can receive selected text through pasteboard types, but Electron needs native help to register/respond cleanly.

## Recommended next work

- Implement the Services plan in `/Users/cobibean/DEV/longread-audio/docs/superpowers/plans/2026-05-26-macos-services-integration.md`.
- After Services ships, revisit the Chrome extension only if the product gains a web/browser distribution path.
- Treat the universal macOS bubble as a dedicated native integration project, not a small polish task.
