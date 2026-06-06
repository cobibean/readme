# Longread Audio Highlight And Codex Modes Memory - 2026-05-26

## Session summary

- The prior Services-first selection plan was revised after testing the actual right-click context menu in Codex.
- Codex/Electron-style custom context menus may not expose macOS Services, so Services cannot be the primary low-friction UX.
- The user wants two modes:
  - Highlight Mode: highlight selected text anywhere, show a floating readme bubble, then generate/play only after the user presses the bubble.
  - Codex Mode: read Codex responses from local session JSONL files, using lessons from the `codex-read-aloud` plugin.

## Decisions made

- Do not use clipboard monitoring.
- Do not generate audio automatically from copy events or highlighted text.
- Highlight Mode should use macOS Accessibility APIs to detect selected text and bounds.
- The readme bubble must float away from selected text and native contextual bubbles, not sit directly over the highlight.
- Codex Mode should use local `~/.codex/sessions/**/*.jsonl` files unless a faster supported Codex app API appears.
- Codex Mode should remain on-demand by default: detect/latest-answer support is fine, but do not auto-speak every response.
- Services may remain a bonus trigger later, but it is no longer the launch plan.

## Source-of-truth docs

- `/Users/cobibean/DEV/longread-audio/AGENTS.md`
- `/Users/cobibean/DEV/longread-audio/README.md`
- `/Users/cobibean/DEV/longread-audio/docs/PRD.md`
- `/Users/cobibean/DEV/longread-audio/docs/RESEARCH.md`
- `/Users/cobibean/DEV/longread-audio/docs/superpowers/plans/2026-05-26-highlight-and-codex-modes.md`
- Superseded: `/Users/cobibean/DEV/longread-audio/docs/superpowers/plans/2026-05-26-macos-services-integration.md`

## Relevant prior art

- `~/plugins/codex-read-aloud/scripts/lib/read-aloud.mjs`
  - Finds latest Codex session JSONL.
  - Extracts latest assistant message.
  - Prefers final assistant messages.
  - Cleans markdown/code blocks for spoken output.
  - Tracks playback state and avoids stale automatic read-aloud behavior.

## Known constraints

- This directory is not a git repo.
- Highlight Mode needs macOS Accessibility permission.
- Accessibility text/bounds support varies by app and text surface.
- JSONL parsing is likely the fastest reliable Codex-specific path available from outside the Codex app, because it avoids UI scraping and selection APIs.
- readme must continue to use cost estimates, provider adapters, and default cost cap behavior.

## Recommended next work

- Implement `/Users/cobibean/DEV/longread-audio/docs/superpowers/plans/2026-05-26-highlight-and-codex-modes.md`.
- Treat the old Services plan as reference material only for optional future Services support.
