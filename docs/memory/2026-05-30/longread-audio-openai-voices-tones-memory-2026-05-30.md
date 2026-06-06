# Longread Audio OpenAI Voices And Tones Memory - 2026-05-30

## Session summary

- Expanded readme's OpenAI narration choices beyond the original three presets.
- Added a shared tone catalog and wired tones through OpenAI TTS `instructions` plus mild `speed` control.
- Verified, packaged, and replaced the installed `/Applications/readme.app` after the user noticed the rebuilt package had not replaced the app they were launching.
- This workspace is still not a git repo; no commits were made.

## Decisions made

- Keep `gpt-4o-mini-tts` as the primary OpenAI TTS path for Longread Audio.
- Keep `marin` and `cedar` first and marked as recommended.
- Include all current built-in `gpt-4o-mini-tts` voices in the UI:
  - `marin`, `cedar`, `alloy`, `ash`, `ballad`, `coral`, `echo`, `fable`, `nova`, `onyx`, `sage`, `shimmer`, `verse`
- Keep `tts-1/alloy` and `tts-1-hd/nova` as legacy fallback options instead of primary choices.
- Move tone definitions into a shared module so renderer labels and provider instructions stay aligned.
- Tone prompts must preserve source text exactly: no summarizing, paraphrasing, reordering, skipping, or adding words.
- Do not treat recent OpenAI transcription models as relevant TTS defaults; they are speech-to-text, not text-to-speech for MP3 generation.

## Files created or changed

- Created:
  - `/Users/cobibean/DEV/longread-audio/src/shared/tones.ts`
  - `/Users/cobibean/DEV/longread-audio/docs/memory/2026-05-30/longread-audio-openai-voices-tones-memory-2026-05-30.md`
- Changed:
  - `/Users/cobibean/DEV/longread-audio/src/shared/types.ts`
  - `/Users/cobibean/DEV/longread-audio/src/shared/costs.ts`
  - `/Users/cobibean/DEV/longread-audio/src/main/providers/openai-tts.ts`
  - `/Users/cobibean/DEV/longread-audio/src/renderer/App.tsx`
  - `/Users/cobibean/DEV/longread-audio/tests/costs.test.ts`
  - `/Users/cobibean/DEV/longread-audio/package.json`
  - `/Users/cobibean/DEV/longread-audio/package-lock.json`
- Rebuilt/replaced local app artifacts:
  - `/Users/cobibean/DEV/longread-audio/release/mac-arm64/readme.app`
  - `/Users/cobibean/DEV/longread-audio/release/readme-0.1.0-arm64.dmg`
  - `/Applications/readme.app`

## Source-of-truth docs

- `/Users/cobibean/DEV/longread-audio/AGENTS.md`
- `/Users/cobibean/DEV/longread-audio/README.md`
- `/Users/cobibean/DEV/longread-audio/docs/PRD.md`
- `/Users/cobibean/DEV/longread-audio/docs/RESEARCH.md`
- Official OpenAI docs consulted:
  - `https://developers.openai.com/api/docs/guides/text-to-speech`
  - `https://developers.openai.com/api/docs/models/gpt-4o-mini-tts`
  - `https://developers.openai.com/api/docs/guides/speech-to-text`

## Commands and verification

- `npm view openai version` showed `6.39.1`.
- Updated OpenAI SDK patch version:
  - `npm install openai@^6.39.1`
- Initial verification after code changes:
  - `npm run build` passed.
  - `npm test` passed: 12 test files, 39 tests.
  - `npm audit --omit=dev` passed with 0 vulnerabilities.
  - `npm audit` initially found a dev transitive `tmp` vulnerability via Electron Builder tooling.
  - `npm audit fix` updated `tmp` to `0.2.7`; later `npm audit` passed with 0 vulnerabilities.
- Browser/dev smoke:
  - Ran `npm run dev`.
  - Loaded `http://127.0.0.1:5173/`.
  - Verified the voice dropdown showed the expanded list and tone dropdown showed 12 tones.
- Packaged app:
  - `npm run package:mac` passed.
  - Electron Builder skipped notarization because notarize options were unavailable.
  - Replaced `/Applications/readme.app` by quitting the running old installed app, deleting the old app bundle, and copying `release/mac-arm64/readme.app` into `/Applications/readme.app`.
  - Verified `/Applications/readme.app/Contents/Resources/app.asar` contains the expanded voice/tone bundle strings.
  - Launched `/Applications/readme.app`; process path confirmed as `/Applications/readme.app/Contents/MacOS/readme`.

## Known constraints

- The repo directory is not a git repo.
- Package signing can take a quiet while during `npm run package:mac`.
- Electron Builder still emits Node engine warnings from `@electron/rebuild` / `node-abi` under Node 20.18.3, but build, test, package, and audit passed after this work.
- Packaging alone does not update the app the user launches from `/Applications`; future packaging sessions should explicitly replace `/Applications/readme.app` when the user wants double-click testing of the installed app.
- Do not print or store OpenAI API keys or secret values in memory. This session did not record secrets.

## Open questions

- Whether to remove the legacy `tts-1` and `tts-1-hd` options entirely later, or keep them for comparison/fallback.
- Whether to add a model/version note in the UI so users understand `Marin` and `Cedar` are the recommended OpenAI voices.
- Whether packaged-app replacement should become a script, for example `npm run install:mac-local`.

## Recommended next work

- Add a small helper script or documented command for "package and replace `/Applications/readme.app`" to avoid stale-app confusion.
- Consider a lightweight in-app "About voice models" note if users keep asking which OpenAI model is best/current.
- If continuing voice QA, generate short previews for `marin`, `cedar`, `ash`, `sage`, and `verse` across several tones and pick better defaults from listening tests.
