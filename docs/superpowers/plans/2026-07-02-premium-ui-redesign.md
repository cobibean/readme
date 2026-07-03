# readme — Premium UI Redesign Plan

**Date:** 2026-07-02
**Author:** Design pass (impeccable / product register)
**Implementer:** Hand off to a fresh agent (Sonnet 5)
**Scope:** Visual + layout redesign of the renderer only. **No features added, removed, or changed.** Every IPC call, handler, and piece of state stays exactly as it is today.

---

## 0. The one rule that governs this whole plan

**Do not touch behavior.** You are re-arranging and restyling existing UI. Every `window.longread.*` call, every state variable, every handler in [App.tsx](../../../src/renderer/App.tsx) keeps its current wiring. If you find yourself changing what a button *does* (as opposed to how it *looks* or *when it's visible*), stop — that's out of scope.

What you ARE allowed to change:
- CSS (rewrite [styles.css](../../../src/renderer/styles.css) freely).
- JSX structure and conditional rendering in [App.tsx](../../../src/renderer/App.tsx) (move elements, wrap them, show/hide them based on existing state).
- Add small **local UI-only** state (e.g. `showKeyPanel: boolean` for the disclosure). This is presentation state, not feature state — allowed.
- One line in the Electron main process for the titlebar ([index.ts](../../../src/main/index.ts)).

---

## 1. Why we're doing this

The app currently dresses a focused tool up like a marketing landing page. Grounded in the current [styles.css](../../../src/renderer/styles.css) and [App.tsx](../../../src/renderer/App.tsx):

1. **Four accent hues + gradients.** Acid green, cyan (`--cyan`), coral (`--coral`), mint (`--ok`), layered over radial body gradients, a pinstripe textarea background, gradient panel washes, and a two-color progress bar. Premium tools run **one** accent on disciplined neutrals.
2. **Everything is bold.** Font weights run 760–900 on buttons, labels, chips, and headings alike. When everything shouts, nothing leads. Hierarchy is lost.
3. **Marketing inside the app.** The 42px `"make the page talk."` headline + 46px brand mark eat ~90px at the top of every session. Taglines belong on the website, not the tool.
4. **The rail shows every feature at once.** Full API-key management block (input + Save + Clear + Check + status) stays visible even when the key is already configured — *and* a redundant "key ready" pill sits in the header. Three action buttons sit in a row with Cancel/Resume disabled ~95% of the time. An empty progress bar + "Ready" occupy the bottom permanently.
5. **Mono textarea.** SF Mono reads as a code editor. The input is essays and letters; it should read as a page.
6. **Border noise.** Bordered doc-meta chips, bordered estimate cards, bordered pills — boxes inside boxes inside a bordered pane.
7. **Stock titlebar.** [index.ts](../../../src/main/index.ts) creates a default `BrowserWindow`, so content starts below a standard OS titlebar instead of flowing to the top like Things / Craft / Linear.

**The thesis:** premium = make the pasted text the hero, make the chrome quiet, and show stateful controls only in their state. All of it is re-arrangement + restyling.

---

## 2. Target design (mockup)

This is the desktop layout to build toward. The left pane is a serif document surface that runs to the top of the window; the right rail is a slim single-accent control column with exactly one green button; the two small cards show how the **single action slot** re-dresses itself during and after a job.

```
┌───────────────────────────────────────────────────────────────────────┐
│ ● ● ●   readme          [ Paste text | From URL ]      ← toolbar row    │  ← hiddenInset titlebar, draggable
├──────────────────────────────────────────────┬────────────────────────┤
│                                               │  Voice                 │
│  There is a time in every man's education     │  [ Marin      ▾ ] [▶]   │
│  when he arrives at the conviction that       │                        │
│  envy is ignorance; that imitation is         │  Tone                  │
│  suicide...                                   │  [ Warm lecturer   ▾ ]  │
│                                               │                        │
│  (serif, ~15-16px, line-height ~1.7,          │  Cost cap              │
│   max ~68ch, borderless)                      │  [ $10.00           ]  │
│                                               │  ────────────────────  │
│                                               │  Estimated cost        │
│                                               │  $1.86        ← focal  │
│                                               │  ~32 min · 12 chunks   │
│  Self-Reliance · 4,820 words · ~32 min listen │                        │
│  ← one quiet meta line, no chips              │  [ Generate audio ]    │  ← the ONE accent
│                                               │  ────────────────────  │
│                                               │  ● OpenAI key·Keychain ⚙│  ← collapsed when set
└──────────────────────────────────────────────┴────────────────────────┘

 The single action slot, across states:

 GENERATING:                          FINISHED:
 ┌────────────────────────┐           ┌────────────────────────────────┐
 │ ▓▓▓▓▓░░░░░░  (green)    │           │ ▶  ────────────────  32:04     │
 │ Chunk 5 of 12 · 38,400 │           │ [ Save MP3 ][ Open ][ Show file]│
 │ [      Cancel        ] │           └────────────────────────────────┘
 └────────────────────────┘
```

A rendered HTML version of this mockup was shown in the design conversation. If you want to re-view it, the layout above is the source of truth; the key relationships are: (a) serif document pane on the left running to the top, (b) slim rail with quiet 11px muted labels and 12px values, (c) estimated cost as the one 500-weight focal number, (d) one green button, (e) collapsed key line at the bottom, (f) the action slot morphing Generate → Cancel → result player.

---

## 3. Design tokens (rewrite `:root` in styles.css)

Keep the acid green as the single brand accent (it's distinctive and reads well on near-black — confirmed as the direction). **Delete cyan, coral, and mint as accent hues.** Warnings use one standard desaturated red. Depth comes from two neutral surfaces + hairlines, not gradients.

```css
:root {
  /* Surfaces — document pane slightly darker, rail slightly lighter */
  --bg: #0d0e0f;             /* app / document pane */
  --rail: #141516;           /* control rail (one step up) */
  --surface-raised: #1a1c1d; /* inputs, selects, buttons */
  --surface-raised-hover: #202324;

  /* Hairlines */
  --line: #232526;
  --line-strong: #2f3233;

  /* Text — real hierarchy, not all-bold */
  --text: #e8eae6;           /* primary */
  --text-muted: #8f948e;     /* labels, secondary */
  --text-dim: #6f746e;       /* hints, disabled meta */

  /* The ONE accent */
  --acid: #a7ff38;
  --acid-hover: #b6ff5c;
  --acid-ink: #101704;       /* text on acid */

  /* Single semantic red (was coral, four different pinks) */
  --danger: #e5695b;
  --danger-bg: rgba(229, 105, 91, 0.12);

  /* Success dot only (key ready) — muted green, not full mint */
  --ok-dot: #35c76f;

  --radius: 7px;
  --radius-lg: 10px;
}
```

**Bans to enforce while rewriting CSS:**
- No `radial-gradient` / `linear-gradient` used decoratively on body, panes, panels, brand mark, or cards. The only gradient allowed anywhere is *none* — even the progress bar becomes a solid `--acid` fill (was `linear-gradient(acid, cyan)`).
- No `repeating-linear-gradient` pinstripe on the textarea.
- No `box-shadow` + `1px border` on the same element (ghost-card pattern). Pick one. Prefer a single hairline border; drop the big `--shadow: 0 28px 80px` drop shadow on the rail entirely (it's a window, not a floating card).
- No `border-radius` above 16px on any container. Buttons/inputs stay at `--radius` (7px); the window-inner and result card at `--radius-lg` (10px).
- No `text-transform: uppercase` except on nothing here — drop the uppercase `h2` section headings and the uppercase estimate labels; they become sentence-case 11px muted labels.

---

## 4. Typography

**One UI typeface (system SF Pro) for all chrome. One serif for the document body only.** Drop `Avenir Next Condensed` and the `Avenir Next` display family from the UI entirely.

```css
:root {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", ui-sans-serif, system-ui, sans-serif;
}
```

Weights, applied deliberately (this is where hierarchy comes from — NOT from color):
- **400** — document body, meta line, secondary text, values in the rail.
- **500** — button labels, active segment, select values, the estimated-cost number.
- Never above 600. Kill every `font-weight: 760/800/850/900` in the current file.

Sizes (fixed rem/px scale — product UI, not fluid):
- Rail labels ("Voice", "Tone", "Cost cap", "Estimated cost"): `11px`, `--text-muted`, weight 400.
- Rail values / inputs / buttons: `12px`, weight 400 (500 for buttons + select values).
- Estimated cost number: `19px`, weight 500, `--text` — the one focal number.
- Document meta line: `11px`, `--text-muted`.
- Wordmark in toolbar: `12px`, weight 500, lowercase `readme`.

**Document body (the textarea):**
```css
textarea {
  font-family: "New York", Georgia, "Times New Roman", serif;
  font-size: 15.5px;
  line-height: 1.72;
  max-width: 68ch;          /* cap line length; center the column in the pane */
  border: 0;                /* borderless — it's a page, not a field */
  background: transparent;  /* no pinstripe, no fill */
  resize: none;
  color: var(--text);
}
textarea::placeholder { color: var(--text-dim); font-style: italic; }
```
The textarea should feel like typing into a page. Center the 68ch column horizontally within the document pane (`margin: 0 auto` on the textarea or a wrapping flex with `align-items` centered), with comfortable top padding.

---

## 5. Layout structure

Keep the existing two-pane grid but reweight it and change what lives where.

- Grid: `grid-template-columns: minmax(0, 1fr) 240px;` (rail is slimmer than today's 392px).
- **Document pane** (`--bg`) runs to the very top of the window (see §6 titlebar). Contains: the serif textarea (or the URL input row when in URL mode) and the single quiet meta line pinned to the bottom.
- **Rail** (`--rail`, one hairline `border-left`, **no drop shadow**). Contains, top to bottom:
  1. Voice label + `[select ▾]` + small `[▶]` preview button (see §7.4).
  2. Tone label + select.
  3. Cost cap label + number input.
  4. Hairline divider.
  5. **Estimate block** (label + focal number + sub-line) — see §7.1.
  6. **Action slot** (Generate / Cancel / Resume / result) — see §7.2.
  7. Pushed to the bottom with `margin-top: auto`: the **collapsed key line** — see §7.3.

Responsive: keep the existing `@media (max-width: 900px)` single-column collapse and the `560px` stacking, adapted to the new tokens. Behavior identical; just restyle.

---

## 6. Titlebar (the one main-process change)

In [index.ts](../../../src/main/index.ts), in `createWindow()` (currently line ~25), add to the `BrowserWindow` options:

```ts
titleBarStyle: 'hiddenInset',
trafficLightPosition: { x: 16, y: 14 },
```

Then in CSS, make the toolbar row draggable and its interactive children not:
```css
.toolbar { -webkit-app-region: drag; }
.toolbar button, .toolbar input, .toolbar .segmented { -webkit-app-region: no-drag; }
```
Leave the traffic-light gutter (~72px) clear on the left of the toolbar so the OS buttons don't overlap the wordmark. The wordmark + segmented control live in this toolbar row (see mockup). This lets the document content flow to the top of the window like a native macOS app.

**Verify:** the window still opens, drags by the toolbar, and the traffic lights don't collide with the wordmark. Nothing about window creation, show/hide, or IPC changes.

---

## 7. Component-by-component spec

### 7.1 Estimate → pre-flight line (was the `<section>` with `<h2>Estimate</h2>` + `.estimate-grid`)

Currently a 3-cell bordered grid (Cost / Cap / Duration). Replace with a compact stacked block directly above the button:
- Label: `Estimated cost` (11px muted).
- Number: `formatMoney(estimate.estimatedCostUsd)` at 19px / weight 500 — **the focal number**.
- Sub-line (11px muted): `{formatDuration(estimate.estimatedListeningSeconds)} · {chunkCount} chunks` and a `· under cap` / `· over cap` suffix. You already have `estimate.capExceeded`; the chunk count is computed in the `estimate` memo's context — reuse `sourceDocument` + existing logic, or surface it via the existing estimate object (do NOT change `buildCostEstimate`; if chunk count isn't on the estimate object, compute it in the component the same way the memo already does and pass it down — presentation only).
- Keep the empty state: when `estimate` is null, show the existing muted "Paste text or extract a public URL to estimate the job." line.
- `estimate.pricingNote` stays, rendered as an 11px dim line under the sub-line (keep it — it's real info).
- **Cap exceeded:** instead of today's separate `.warning` line + a disabled button, when `estimate.capExceeded` is true, render the sub-line's `· over cap` in `--danger` and show one inline line: `Raise the cost cap or shorten the text.` The Generate button's existing `disabled={!canGenerate}` already covers the disable; keep it.

### 7.2 The single action slot (was `.actions` with Generate/Cancel/Resume + separate `.generated-audio-box` + `.progress-box`)

This is the biggest re-arrangement. Today there are three always-visible action buttons plus a separate generated-audio section plus a permanent progress box. Collapse them into **one slot** that renders exactly one thing based on existing state:

**State machine (all from existing state — no new logic):**
- **Idle / ready to generate** (`!isBusy` and no completed audio): show the green **`Generate audio`** button. `disabled={!canGenerate}` unchanged. `onClick={generateMp3}` unchanged.
- **Running** (`isBusy`): show the progress bar (solid `--acid` fill, `width: ${progressPercent}%`) + the existing progress message + the generated-chars line, and a **`Cancel`** button in place of Generate. `onClick={cancelJob}`, `disabled={!progress?.jobId}` unchanged.
- **Resumable** (`canResume` is true — i.e. `lastManifestPath && !isBusy && status failed/cancelled`): show a **`Resume`** button (secondary style) in the slot, alongside a `Generate audio` button. Today Resume is always visible but disabled; now it appears only when `canResume`. `onClick={resumeJob}` unchanged.
- **Finished** (`generatedAudio` present): the slot becomes the **result card** — `<audio controls autoPlay src={generatedAudio.audioUrl} />` plus the existing `Save MP3` / `Open Audio` / `Show File` button row. All three handlers (`saveGeneratedAudio`, `openOutputFile`, `revealOutput`) unchanged. This is the one place a touch of polish is earned (fade the card in, ~180ms).

**Critical:** the *conditions* above are just the existing booleans (`isBusy`, `canGenerate`, `canResume`, `generatedAudio`, `progress?.status`). You're changing *when things are visible*, never *what they do*. Preserve the exact `disabled` expressions currently on each button.

Also remove the permanent bottom "Ready" placeholder + empty progress track. Status text (`message`) renders only while running or as part of a transient state — when fully idle with nothing generated, the slot is just the Generate button, no status line needed. (If you want to keep a status line for idle errors like a failed URL extract, render `message` as one muted line under the slot only when `message` is non-empty AND not the literal `'Ready'`. Don't invent new messages.)

### 7.3 Key management → collapsed line + disclosure (was `.api-key-box` + the header `.key-pill`)

Today: a redundant header pill saying "OpenAI key ready: Keychain" AND a full always-visible management block (input + Save + Clear Saved Key + Check Key + status).

New behavior, driven by one new **local UI state** `const [showKeyPanel, setShowKeyPanel] = useState(false)`:
- **Remove the header `.key-pill` entirely.** It's redundant with the rail line below.
- At the **bottom of the rail** (`margin-top: auto`), render a single quiet line:
  - When `hasOpenAiApiKey` is true: `● OpenAI key · {keySourceLabels[openAiKeySource]}` with a 6px `--ok-dot` dot and a trailing gear icon button. Clicking the line or gear toggles `showKeyPanel`.
  - When `hasOpenAiApiKey` is false: auto-expand the panel (treat as first-run) — i.e. the key panel shows at the **top of the rail** and the collapsed line shows a `--danger` dot + `OpenAI key missing`.
- **The disclosed panel** contains the *exact existing controls*: the password input, `Save` (`saveOpenAiApiKey`), `Clear Saved Key` (`clearOpenAiApiKey`), `Check Key` (`validateOpenAiSavedKey`), and the `settingsMessage` line. Same handlers, same `disabled` conditions. It renders inline (not a modal) when `showKeyPanel || !hasOpenAiApiKey`.
- Restyle it to the new tokens (quiet, no bordered pill for status — status becomes a muted line).

This is progressive disclosure: same features, shown only when relevant. Simplest possible UX, zero features touched.

### 7.4 Voice preview → play button next to Voice (was `.voice-preview-box` with a standalone `Preview Voice` button)

Move the preview trigger up next to the Voice `<select>` as a small square `[▶]` icon button (Tabler-style play glyph or an inline SVG — or just the text `▶`, your call, keep it tiny). Same `generateSample` handler, same disabled condition (`!sourceDocument || !estimate || estimate.capExceeded || !canUseOpenAi || isBusy`). When `sample` exists, render the `<audio controls src={sample.sampleUrl} />` directly under the Voice row (small). Remove the separate `.voice-preview-box` section. Preview previews the *voice*, so it belongs with the voice picker.

### 7.5 Toolbar row / brand (was `.topbar` + `.brand-lockup` + `.eyebrow` + `h1`)

- **Delete the `"make the page talk."` `<h1>` and the `.eyebrow`.** Marketing copy leaves the app.
- The brand becomes a small lowercase `readme` wordmark (12px, weight 500) in the draggable toolbar row, after the traffic-light gutter. Keep the little `r` brand-mark only if it renders cleanly at small size (≤22px, flat, no gradient) — otherwise the wordmark alone is enough.
- The `Paste text` / `From URL` segmented control moves into this toolbar row (right-aligned or after the wordmark). Same `sourceMode` state, same buttons. Restyle the `.segmented` to the new tokens: active segment gets `--acid` background + `--acid-ink` text; inactive is muted, transparent.

### 7.6 Doc meta (was `.doc-meta` with bordered chips)

Collapse the bordered chips into **one quiet line** pinned to the bottom of the document pane:
`{title} · {wordCount.toLocaleString()} words · ~{estimatedMinutes} min listen`
- 11px, `--text-muted`, no borders, no backgrounds.
- Derive minutes from the existing estimate's `estimatedListeningSeconds` if available, else keep it to `{title} · {chars} chars · {words} words` — but **do not add new computation features**; reuse what `estimate`/`sourceDocument` already give you. If listen-time isn't cheaply available here, `{title} · {wordCount} words` is fine. Keep the `host` suffix for URL sources (existing `new URL(...).host`).

---

## 8. Motion

Product-register motion only. 150–200ms, state transitions only, no load choreography.
- Segmented control active-swap, button hover/active, input focus ring: 150ms ease.
- Progress bar `width`: keep the existing ~160ms transition, solid `--acid` fill.
- Result card appearance (finished state): fade + 4px rise, ~180ms `ease-out`.
- Key panel disclosure: instant or a 150ms height/opacity fade — keep it cheap.
- **Required:** wrap non-essential transitions in `@media (prefers-reduced-motion: reduce)` → instant. Add this block; the current file has none.

---

## 9. Focus, states, accessibility

- Every input/select/button keeps a visible focus ring: `box-shadow: 0 0 0 3px rgba(167,255,56,0.18)` + `border-color: var(--acid)` on `:focus-visible`. (One acid focus treatment, consistent everywhere.)
- Contrast check the new muted text: `--text-muted #8f948e` on `--rail #141516` must clear 4.5:1 for body — verify; if it's close, lighten `--text-muted` toward `#9aa09a`. Placeholder text needs 4.5:1 too. **Do not ship light-gray-on-dark that fails contrast.**
- Preserve every existing `aria-label` (`Source text`, `Public URL`, `OpenAI API key`, `Source mode`, etc.) when moving elements. The segmented control keeps `role="tablist"`.
- The green primary button: `--acid-ink #101704` on `--acid #a7ff38` — verify large-text contrast (it passes, but confirm after any hue tweak).

---

## 10. Files to touch

| File | Change |
|---|---|
| [src/renderer/styles.css](../../../src/renderer/styles.css) | Full rewrite to the new token system, one accent, no gradients, serif document body, slim rail, single-accent progress, reduced-motion block. |
| [src/renderer/App.tsx](../../../src/renderer/App.tsx) | Re-arrange JSX: move brand + segmented into toolbar, delete h1/eyebrow, collapse doc-meta, single action slot, key disclosure (`showKeyPanel` state), preview button beside Voice. **No handler/IPC/behavior changes.** |
| [src/main/index.ts](../../../src/main/index.ts) | Add `titleBarStyle: 'hiddenInset'` + `trafficLightPosition` to `BrowserWindow` options. Nothing else. |

Do **not** touch: `src/shared/*`, `src/main/ipc.ts`, `src/main/jobs/*`, `src/main/providers/*`, or any test. If a change seems to require editing shared logic, you've drifted into behavior — stop and reconsider.

---

## 11. Verification checklist (do all before calling it done)

1. `npm run build` succeeds (typecheck + vite build clean).
2. `npm test` passes (the redesign shouldn't touch anything tested, but confirm).
3. Run the app (`npm run dev` + `npm run dev:electron`) and manually verify, in order:
   - Window opens with hidden-inset titlebar; content flows to the top; traffic lights clear of the wordmark; toolbar drags the window.
   - Paste a few paragraphs → serif document surface, meta line appears, estimate line shows a focal cost number.
   - Toggle Paste text / From URL → segment restyles, URL row works.
   - Voice preview `[▶]` next to Voice generates a sample and shows the small audio player.
   - With a key set: bottom rail shows the collapsed `● OpenAI key · Keychain` line; clicking it discloses Save/Clear/Check; they still work.
   - With no key (clear it): key panel auto-expands, collapsed line shows the danger dot.
   - Generate → the single slot shows solid-green progress + Cancel; Cancel works.
   - On completion → slot becomes the audio player + Save/Open/Show file; all three work.
   - Trigger a resumable state (cancel a job) → Resume appears in the slot; it works.
   - Cap exceeded (set cost cap to 0 with text pasted) → over-cap line in danger, Generate disabled.
4. Contrast: spot-check `--text-muted` on `--rail` and placeholder text ≥ 4.5:1.
5. `prefers-reduced-motion` on → transitions go instant.
6. Resize narrow (< 900px) → single-column collapse still works.

**Definition of done:** the app looks like the mockup in §2, every feature behaves exactly as it did before the change, build + tests are green, and the manual checklist passes.

---

## 12. Note for the implementer

Read [App.tsx](../../../src/renderer/App.tsx) fully before editing — the state relationships (`isBusy`, `canGenerate`, `canResume`, `generatedAudio`, `progress`, `sample`, `hasOpenAiApiKey`) are what drive the single-action-slot and key-disclosure logic. You're rewiring *visibility*, not *behavior*. When in doubt, preserve the existing `disabled={...}` expression verbatim and only change the surrounding markup and CSS class.
