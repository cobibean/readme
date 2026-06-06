# Longread Audio MVP Closed Memory - 2026-05-25

## Session summary

- Built the Longread Audio MVP end to end in `/Users/cobibean/DEV/longread-audio`.
- Status: closed. Runtime goal was marked complete.
- Extra detailed context lives in the agent ledger HTML:
  `/Users/cobibean/DEV/longread-audio/.agent/runs/2026-05-25-longread-audio-mvp/implementation-notes.html`
- The goal contract is:
  `/Users/cobibean/DEV/longread-audio/.agent/runs/2026-05-25-longread-audio-mvp/GOAL.md`

## Decisions made

- PM update superseded the older plan: v1 is OpenAI-only plus fake/test provider. No AWS SDK, AWS key, AWS runtime path, macOS system voice, accounts, sync, hosted history, backend, dictation, hotkeys, or paste automation.
- `.env` is ignored and used only as a local source for `OPENAI_API_KEY`; the key was detected/used but never printed or stored in manifests.
- OpenAI preset catalog covers budget/natural/premium:
  - `tts-1` / `alloy`
  - `gpt-4o-mini-tts` / `marin`
  - `tts-1-hd` / `nova`
- `gpt-4o-mini-tts` cost estimate uses official token/minute guidance and is presented as an estimate, because pricing is token-based rather than purely character-based.
- Fake/test provider generates valid silent MP3 through ffmpeg so tests and resume flows do not assemble invalid audio.

## Files created or changed

- Core app:
  - `/Users/cobibean/DEV/longread-audio/src/renderer/App.tsx`
  - `/Users/cobibean/DEV/longread-audio/src/renderer/styles.css`
  - `/Users/cobibean/DEV/longread-audio/src/main/ipc.ts`
  - `/Users/cobibean/DEV/longread-audio/src/main/settings.ts`
  - `/Users/cobibean/DEV/longread-audio/src/main/extraction/fetch-readable.ts`
  - `/Users/cobibean/DEV/longread-audio/src/main/jobs/job-runner.ts`
  - `/Users/cobibean/DEV/longread-audio/src/main/jobs/job-store.ts`
  - `/Users/cobibean/DEV/longread-audio/src/main/audio/ffmpeg.ts`
  - `/Users/cobibean/DEV/longread-audio/src/main/providers/openai-tts.ts`
  - `/Users/cobibean/DEV/longread-audio/src/main/providers/fake-tts.ts`
  - `/Users/cobibean/DEV/longread-audio/src/main/providers/provider-registry.ts`
- Shared modules:
  - `/Users/cobibean/DEV/longread-audio/src/shared/types.ts`
  - `/Users/cobibean/DEV/longread-audio/src/shared/ipc-channels.ts`
  - `/Users/cobibean/DEV/longread-audio/src/shared/costs.ts`
  - `/Users/cobibean/DEV/longread-audio/src/shared/text-normalize.ts`
  - `/Users/cobibean/DEV/longread-audio/src/shared/chunker.ts`
- Tests:
  - `/Users/cobibean/DEV/longread-audio/tests/*.test.ts`
  - `/Users/cobibean/DEV/longread-audio/tests/fixtures/vatican-sample.html`
- Project files:
  - `/Users/cobibean/DEV/longread-audio/package.json`
  - `/Users/cobibean/DEV/longread-audio/package-lock.json`
  - `/Users/cobibean/DEV/longread-audio/.gitignore`
  - `/Users/cobibean/DEV/longread-audio/index.html`
  - `/Users/cobibean/DEV/longread-audio/.agent/GOALS.md`

## Source-of-truth docs

- `/Users/cobibean/DEV/longread-audio/AGENTS.md`
- `/Users/cobibean/DEV/longread-audio/README.md`
- `/Users/cobibean/DEV/longread-audio/docs/PRD.md`
- `/Users/cobibean/DEV/longread-audio/docs/RESEARCH.md`
- `/Users/cobibean/DEV/longread-audio/docs/superpowers/plans/2026-05-25-longread-audio-mvp.md`
- Official OpenAI docs checked during implementation:
  - `https://platform.openai.com/docs/guides/text-to-speech?lang=javascript`
  - `https://platform.openai.com/docs/api-reference/audio/voice-object?lang=curl`
  - `https://developers.openai.com/api/docs/models/gpt-4o-mini-tts`
  - `https://platform.openai.com/docs/models/tts-1`
  - `https://platform.openai.com/docs/models/tts-1-hd`

## Commands and verification

- `npm install` completed.
- `npm test` passed: 6 test files, 13 tests.
- `npm run build` passed: main TypeScript build and Vite renderer build.
- Manual dev smoke loaded renderer at `http://127.0.0.1:5174/`.
- Vatican URL extraction succeeded for the PRD URL:
  - title: `Encyclical Letter of His Holiness Leo XIV Magnifica Humanitas (15 May 2026)`
  - characters: `258,359`
  - words: `41,381`
  - OpenAI natural estimate: `$5.42`
  - OpenAI premium estimate: `$7.75`
- OpenAI sample MP3 generated:
  `/Users/cobibean/DEV/longread-audio/.agent/runs/2026-05-25-longread-audio-mvp/evidence/openai-sample.mp3`
- OpenAI short full MP3 generated:
  `/Users/cobibean/DEV/longread-audio/.agent/runs/2026-05-25-longread-audio-mvp/evidence/openai-short-full.mp3`
- Fake-provider cancel/resume validation completed: cancelled after initial chunk, resumed to 7/7 chunks complete.

## Known constraints

- This directory was not a git repo during the session; no commits were made.
- `openai@^7.0.0` was not available from npm, so the project uses `openai@^6.39.0`.
- Vite 7 required Node 20.19+ while the machine had Node 20.18.3, so Vite was pinned to the compatible 6.x line.
- `electron-builder` dependencies emitted Node engine warnings through `@electron/rebuild`/`node-abi`, but install, tests, and build completed.
- The app currently reads `OPENAI_API_KEY` from process env or local `.env`; it does not implement Keychain storage.
- Full signed/notarized mac packaging was not run; packaging config exists with `ffmpeg-static` resources.

## Open questions

- Whether to add Keychain-backed API key storage in a follow-up.
- Whether the final default should prefer `gpt-4o-mini-tts` natural quality or cheaper `tts-1` cost.
- Whether to add a persistent in-app job history/list beyond manifest resume support.

## Recommended next work

- Run `npm run package:mac` on the target machine and verify packaged ffmpeg path and output writes.
- Add a small settings surface for API-key status and output defaults.
- Add tests around IPC request validation and cost-cap enforcement during resume.
- Consider an explicit manifest picker for resume instead of only resuming the most recent in-memory manifest path.
