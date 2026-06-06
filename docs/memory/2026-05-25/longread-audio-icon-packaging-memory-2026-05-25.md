# Longread Audio Icon And macOS Packaging Memory - 2026-05-25

## Session summary

- Added a transparent macOS-style app icon for Longread Audio.
- Wired the icon into Electron/mac packaging and dev Dock/window behavior.
- Configured electron-builder for macOS hardened runtime, entitlements, DMG layout, ffmpeg signing, and notarization when valid Apple credentials are available.
- Ran full mac packaging and installed the built app into `/Applications/Longread Audio.app`.
- Used Computer Use to verify the installed packaged app opens from `/Applications` and the first screen is usable.

## Decisions made

- Icon direction: transparent-canvas document stack with audio ribbon/play mark, avoiding a black square background and avoiding generic Electron boilerplate.
- `electron-builder.config.mjs` must be passed explicitly from `package.json`; `electron-builder --mac` did not auto-load the `.mjs` config in this project.
- Vite production assets must use `base: './'` so the packaged app can load JS/CSS from `file://...app.asar/...`.
- Removed Electron default camera/mic/audio/Bluetooth usage strings from packaged `Info.plist` because Longread Audio is not Speakeasy and should not imply dictation or capture features.
- Kept notarization enabled in config, but local notarization could not run because required notary credentials were not present.

## Files created or changed

- `/Users/cobibean/DEV/longread-audio/build/icon.svg`
- `/Users/cobibean/DEV/longread-audio/build/icon.png`
- `/Users/cobibean/DEV/longread-audio/build/icon.icns`
- `/Users/cobibean/DEV/longread-audio/build/icon.iconset/*`
- `/Users/cobibean/DEV/longread-audio/build/entitlements.mac.plist`
- `/Users/cobibean/DEV/longread-audio/build/entitlements.mac.inherit.plist`
- `/Users/cobibean/DEV/longread-audio/electron-builder.config.mjs`
- `/Users/cobibean/DEV/longread-audio/package.json`
- `/Users/cobibean/DEV/longread-audio/src/main/index.ts`
- `/Users/cobibean/DEV/longread-audio/vite.config.ts`

## Source-of-truth docs

- `/Users/cobibean/DEV/longread-audio/AGENTS.md`
- `/Users/cobibean/DEV/longread-audio/README.md`
- `/Users/cobibean/DEV/longread-audio/docs/PRD.md`
- `/Users/cobibean/DEV/longread-audio/docs/memory/2026-05-25/longread-audio-mvp-closed-memory-2026-05-25.md`

## Commands and verification

- `npm test` passed: 6 files / 13 tests.
- `npm run build` passed after adding `base: './'`.
- `npm run package:mac` passed with explicit config:
  - built `/Users/cobibean/DEV/longread-audio/release/mac-arm64/Longread Audio.app`
  - built `/Users/cobibean/DEV/longread-audio/release/Longread Audio-0.1.0-arm64.dmg`
  - built `/Users/cobibean/DEV/longread-audio/release/Longread Audio-0.1.0-arm64.dmg.blockmap`
- `codesign --verify --deep --strict --verbose=2 /Applications/Longread\ Audio.app` passed.
- `spctl --assess --type execute --verbose=4 /Applications/Longread\ Audio.app` rejected because the app is Apple Development-signed and not notarized.
- `ditto release/mac-arm64/Longread\ Audio.app /Applications/Longread\ Audio.app` installed the local app copy.
- Computer Use confirmed `/Applications/Longread Audio.app` opens, renders the Longread Audio first screen, accepts pasted text, and updates estimate cards.
- Icon PNG transparency was checked with ImageMagick; corner pixels are fully transparent.

## Known constraints

- This directory is still not a git repo.
- The machine only exposed an `Apple Development: cobibean777@icloud.com (XKBHS6L9BQ)` signing identity via `security find-identity -v -p codesigning`.
- A real publicly distributable notarized DMG requires a `Developer ID Application` certificate and notary credentials discoverable by electron-builder:
  - `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, or
  - `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, or
  - `APPLE_KEYCHAIN_PROFILE` with optional `APPLE_KEYCHAIN`.
- electron-builder logged `skipped macOS notarization reason=\`notarize\` options were unable to be generated`.
- The packaged app shows `OPENAI_API_KEY missing` when launched from `/Applications` because the MVP only reads `process.env.OPENAI_API_KEY` or `.env` from `process.cwd()`. It does not yet have Keychain-backed API key storage or a packaged-app settings flow.
- `spctl` rejection is expected until the app is signed with Developer ID and notarized.

## Open questions

- Whether to add Keychain-backed API key entry/storage before open-sourcing, so the packaged app is useful when launched from Applications.
- Whether to add author/repository/license metadata before the next `package:mac`; electron-builder warns that `author` is missing.
- Whether the first open-source-ready release should include notarization instructions only, or a fully notarized local artifact.

## Recommended next work

- Install a valid `Developer ID Application` certificate for the Apple Developer Team, configure notary credentials, and rerun `npm run package:mac`.
- Recheck:
  - `codesign --verify --deep --strict --verbose=2 release/mac-arm64/Longread\ Audio.app`
  - `spctl --assess --type execute --verbose=4 release/mac-arm64/Longread\ Audio.app`
  - `xcrun stapler validate release/Longread\ Audio-0.1.0-arm64.dmg`
- Add Keychain/API-key settings for packaged app use.
- Prepare open-source handoff: repo initialization, license, README local-run instructions, environment variable setup, packaging caveats, and contribution notes.
