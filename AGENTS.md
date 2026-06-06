# AGENTS.md

This project is a planned standalone macOS app called `Longread Audio`.

## Start Here

Before implementation, read:

1. `README.md`
2. `docs/PRD.md`
3. `docs/RESEARCH.md`
4. `docs/superpowers/plans/2026-05-25-longread-audio-mvp.md`

## Product Shape

Longread Audio turns pasted text or public URLs into saved MP3 narration using affordable AI voices.

It is not Speakeasy. Do not fold dictation, hotkeys, paste automation, accounts, sync, or hosted history into this app unless explicitly requested.

## Provider Guardrails

- Do not use the default macOS system voice as a main product path.
- Do not default to ElevenLabs or other expensive subscription-first providers.
- Show cost estimates before generation.
- Keep the default per-job cost cap at `$10`.
- Prefer provider adapters over hard-coding one TTS API into the app.

## Implementation Guardrails

- Use small, verifiable changes.
- Use `rg` for search.
- Use `apply_patch` for file edits.
- Build and test after meaningful changes:
  - `npm run build`
  - `npm test`

## Packaged App Testing

- The built macOS product is named `readme`.
- After any user-facing app change, run `npm run package:mac` and replace `/Applications/readme.app` with `release/mac-arm64/readme.app` so the double-clickable app is current.
- If the user wants to test by double-clicking the app, run `npm run package:mac` first so `release/mac-arm64/readme.app` is not stale.
- For faster local testing without repackaging, run `npm run build` then `npm run dev:electron`.
