# Packaging readme for macOS

This guide explains how to take a fresh clone of `readme` and produce a local macOS app bundle and DMG.

It is written for humans and coding agents. Follow it in order when the user asks for a packaged Mac app, a double-clickable app, or packaging troubleshooting.

## What this produces

The packaging flow creates:

```text
release/mac-arm64/readme.app
release/readme-0.1.0-arm64.dmg
```

This is enough for local testing on a compatible Mac. It is not the same as a polished public release unless the app is signed and notarized with Apple Developer credentials.

## Requirements

- macOS
- Apple Silicon Mac for the currently verified ARM package path
- Node.js `>=20 <22`
- npm
- Git
- Xcode Command Line Tools

Check the basics:

```bash
node --version
npm --version
git --version
clang --version
```

If `clang` is missing, install the Xcode Command Line Tools:

```bash
xcode-select --install
```

## Clone and install

```bash
git clone https://github.com/cobibean/readme.git
cd readme
npm ci
```

Use `npm ci`, not `npm install`, when building from a clean checkout. It follows `package-lock.json` exactly.

## API key setup

Packaging does not require an OpenAI API key.

Real narration does require a key. The app can save an OpenAI API key to the macOS Keychain from the settings panel.

For development, you can export a key in your shell:

```bash
export OPENAI_API_KEY=sk-...
```

Or create a local `.env` file:

```dotenv
OPENAI_API_KEY=sk-...
```

Never commit `.env` or API keys. `.env` files are ignored by git.

## Verify before packaging

Run tests first:

```bash
npm test
```

Build the app:

```bash
npm run build
```

The build step compiles:

- the native macOS Keychain helper
- the Electron main process
- the Vite/React renderer

## Package the Mac app

```bash
npm run package:mac
```

Expected outputs:

```text
release/mac-arm64/readme.app
release/readme-0.1.0-arm64.dmg
```

Confirm they exist:

```bash
ls -lh release/readme-0.1.0-arm64.dmg
ls -ld release/mac-arm64/readme.app
```

## Install locally

To install the packaged app for local testing:

```bash
rm -rf /Applications/readme.app
cp -R release/mac-arm64/readme.app /Applications/readme.app
```

Then open `/Applications/readme.app` from Finder.

If macOS blocks the app because it is unsigned or not notarized for your machine, use Finder's Open action from the context menu, or review the app under System Settings > Privacy & Security.

## Agent checklist

When an agent is asked to package the app for a user:

1. Confirm the working directory is the repo root.
2. Read `README.md`, `AGENTS.md`, and this file.
3. Check `git status --short --branch`.
4. Run `npm ci` on a fresh clone, or confirm dependencies are already installed.
5. Run `npm test`.
6. Run `npm run build`.
7. Run `npm run package:mac`.
8. Confirm `release/mac-arm64/readme.app` exists.
9. Confirm `release/readme-0.1.0-arm64.dmg` exists.
10. If the user wants the app installed, replace `/Applications/readme.app` with `release/mac-arm64/readme.app`.
11. Report the exact artifact paths and any signing or notarization warnings.

For user-facing app changes in this repository, agents should package before telling the user to double-click the app. This prevents stale app bundles from being tested.

## Troubleshooting

### `clang` is missing

Install Xcode Command Line Tools:

```bash
xcode-select --install
```

Then rerun:

```bash
npm run build
```

### Node version is wrong

The project expects Node.js `>=20 <22`.

Check:

```bash
node --version
```

Switch to a supported version with your Node version manager, then rerun:

```bash
npm ci
npm test
npm run package:mac
```

### `npm ci` fails

Try removing local dependency artifacts and reinstalling:

```bash
rm -rf node_modules
npm ci
```

Do not delete `package-lock.json` as part of routine troubleshooting.

### Electron Builder mentions signing

Local packaging may use a signing identity if one exists on the machine. If notarization credentials are missing, Electron Builder may skip notarization.

That is acceptable for local testing. It is not sufficient for a clean public release experience.

### The app is blocked by Gatekeeper

Unsigned or unnotarized local builds can trigger macOS warnings. For local testing, open the app from Finder's context menu or approve it in System Settings > Privacy & Security.

For public distribution, sign and notarize the app with an Apple Developer account.

### The output is ARM-only

The currently verified package output is:

```text
release/readme-0.1.0-arm64.dmg
```

Intel or universal packaging needs separate verification before being documented as supported.

## Release-quality distribution

A local DMG is useful for development and testing. A public macOS release should also include:

- Apple Developer signing identity
- hardened runtime
- notarization
- release notes
- checksum or provenance information
- verification on a clean Mac user account

The current repository is set up for local packaging first. Treat public release automation as a separate task.
