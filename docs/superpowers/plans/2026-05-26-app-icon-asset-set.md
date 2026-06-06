# App Icon Asset Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the provisional Longread Audio icon with the approved blue waveform-book direction and regenerate the complete macOS icon asset set.

**Architecture:** Keep packaging and Electron wiring unchanged. Treat `build/icon-source.png` as the source asset because the approved icon is a material-heavy rendered object, not a clean vector mark. Generate `build/icon.png`, generate every required `build/icon.iconset/*.png` size from the PNG source, then rebuild `build/icon.icns` with `iconutil`.

**Tech Stack:** PNG alpha assets, ImageMagick, `sips`, `iconutil`, npm build/test scripts.

---

### Task 1: Replace Source Icon

**Files:**
- Create: `build/icon-source.png`
- Modify: `build/icon.png`
- Delete: `build/icon.svg`

- [ ] **Step 1: Install the approved transparent PNG source**

Use the approved blue/black waveform-book icon with transparent corners. Avoid vector tracing because the icon depends on raster material detail: soft lighting, texture, chrome-like page strata, cyan glow, and shadow.

- [ ] **Step 2: Visually inspect the 1024px result**

Run: `magick build/icon-source.png -resize 1024x1024 build/icon.png`

Expected: `build/icon.png` renders cleanly, fills normal macOS icon visual weight, and has transparent corners.

### Task 2: Regenerate macOS Icon Assets

**Files:**
- Modify: `build/icon.png`
- Modify: `build/icon.icns`
- Modify: `build/icon.iconset/*.png`

- [ ] **Step 1: Generate all iconset PNGs**

Run ImageMagick resize commands for 16, 32, 64, 128, 256, 512, and 1024 outputs using the required macOS iconset filenames.

Expected: every file under `build/icon.iconset` exists with the correct pixel dimensions and alpha channel.

- [ ] **Step 2: Build the ICNS**

Run: `iconutil -c icns build/icon.iconset -o build/icon.icns`

Expected: `build/icon.icns` is regenerated without errors.

### Task 3: Verify Project

**Files:**
- No source code changes.

- [ ] **Step 1: Check icon metadata**

Run: `sips -g pixelWidth -g pixelHeight -g hasAlpha build/icon.png build/icon.iconset/icon_32x32.png build/icon.iconset/icon_128x128.png`

Expected: requested sizes match and all PNGs report `hasAlpha: yes`.

- [ ] **Step 2: Build**

Run: `npm run build`

Expected: main and renderer builds pass.

- [ ] **Step 3: Test**

Run: `npm test`

Expected: all tests pass.
