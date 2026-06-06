# Highlight And Codex Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two low-friction read-aloud modes: Highlight Mode for selected text via a floating Accessibility bubble, and Codex Mode for on-demand reading of the latest local Codex assistant response.

**Architecture:** Build one `QuickRead` pipeline that accepts text from multiple sources, estimates cost locally, then generates and plays audio only after explicit user action. Highlight Mode uses a native macOS Accessibility helper to detect selected text and selection bounds, then positions a bubble away from the selected text. Codex Mode reads local Codex session JSONL files, extracts the latest assistant response, cleans it for narration, and routes it through the same QuickRead estimate/generate/play path.

**Tech Stack:** Electron main process, React renderer, TypeScript, Vitest, Objective-C AppKit/ApplicationServices helper, Node filesystem APIs, local Unix socket bridge, existing provider adapters and job runner.

---

## Product Rules

- Never generate audio just because text is highlighted.
- Never monitor clipboard contents.
- Do not use a clipboard fallback in the default product.
- Highlight Mode requires Accessibility permission and should fail quietly when selected text cannot be read.
- The bubble should float away from the selected text and native contextual UI. Prefer a right-side or lower-right sidecar position with collision detection, not directly above the highlight.
- Codex Mode is on-demand by default. It may detect that a new response exists, but it should not speak automatically unless the user explicitly enables that later.
- Both modes must show cost estimate and cap before paid generation.
- Both modes must reuse the existing provider adapter/job pipeline.

## File Structure

- Create: `src/shared/quick-read.ts`
  Shared helpers for source IDs, text limits, and source labels.
- Create: `src/main/quick-read/quick-read.ts`
  Main-process estimate/generate controller reused by Highlight Mode and Codex Mode.
- Create: `src/main/highlight/highlight-bridge.ts`
  Starts the native Accessibility helper, receives selected-text events, dedupes them, and opens the bubble.
- Create: `src/main/highlight/bubble-position.ts`
  Pure positioning logic for floating away from selected text and screen edges.
- Create: `src/native/highlight-helper.m`
  Native helper that asks Accessibility for focused selected text and selection bounds.
- Create: `src/main/codex/codex-session-reader.ts`
  Finds and parses local Codex session JSONL files.
- Create: `src/main/quick-read/quick-read-window.ts`
  Creates the floating bubble/window for both modes.
- Create: `tests/bubble-position.test.ts`
  Unit tests for collision-free bubble placement.
- Create: `tests/codex-session-reader.test.ts`
  Unit tests adapted from `codex-read-aloud` behavior.
- Create: `tests/quick-read.test.ts`
  Unit tests for estimate/generate with fake provider.
- Modify: `src/main/index.ts`
  Start Highlight Mode bridge when enabled and register quick-read windows.
- Modify: `src/main/ipc.ts`
  Add QuickRead and Codex Mode IPC handlers.
- Modify: `src/main/preload.cts`
  Expose QuickRead/Codex APIs.
- Modify: `src/shared/ipc-channels.ts`
  Add QuickRead IPC channel names.
- Modify: `src/shared/types.ts`
  Add QuickRead, Highlight, Codex source types.
- Modify: `src/renderer/App.tsx`
  Add mode controls and a compact `?view=quick-read` bubble UI.
- Modify: `src/renderer/styles.css`
  Style the mode controls and floating bubble.
- Modify: `package.json`
  Build the native highlight helper.
- Modify: `electron-builder.config.mjs`
  Package and sign the native helper.

## Task 1: Shared QuickRead Types

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/ipc-channels.ts`
- Create: `src/shared/quick-read.ts`

- [ ] **Step 1: Add source/mode types**

Add to `src/shared/types.ts`:

```ts
export type QuickReadMode = 'highlight' | 'codex';

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QuickReadSource {
  id: string;
  mode: QuickReadMode;
  title: string;
  text: string;
  sourceAppName?: string;
  sourceAppBundleId?: string;
  bounds?: ScreenRect;
  receivedAtIso: string;
}

export interface QuickReadEstimate {
  source: QuickReadSource;
  document: SourceDocument;
  estimate: CostEstimate;
  providerId: ProviderId;
  voiceId: string;
  tone: TonePreset;
  costCapUsd: number;
}

export interface QuickReadGeneratedAudio {
  sourceId: string;
  outputPath: string;
  audioUrl: string;
  actualCostUsd: number;
  generatedCharacters: number;
}

export interface CodexSessionMessage {
  key: string;
  sessionFile: string;
  line: number;
  phase: string;
  timestamp: string | null;
  rawText: string;
  text: string;
}
```

- [ ] **Step 2: Add IPC channels**

Add to `src/shared/ipc-channels.ts`:

```ts
QUICK_READ_GET: 'quick-read:get',
QUICK_READ_GENERATE: 'quick-read:generate',
QUICK_READ_DISMISS: 'quick-read:dismiss',
QUICK_READ_PROGRESS: 'quick-read:progress',
CODEX_LATEST_GET: 'codex:latest-get',
CODEX_LATEST_OPEN: 'codex:latest-open',
HIGHLIGHT_MODE_SET: 'highlight-mode:set'
```

- [ ] **Step 3: Add shared constants**

Create `src/shared/quick-read.ts`:

```ts
import type { QuickReadMode } from './types.js';

export const QUICK_READ_MAX_CHARACTERS = 60_000;

export const quickReadTitleForMode = (mode: QuickReadMode): string => {
  if (mode === 'codex') {
    return 'Latest Codex Response';
  }
  return 'Selected Text';
};

export const truncateQuickReadText = (text: string): string => {
  const normalized = text.trim();
  if (normalized.length <= QUICK_READ_MAX_CHARACTERS) {
    return normalized;
  }
  return normalized.slice(0, QUICK_READ_MAX_CHARACTERS).trim();
};
```

- [ ] **Step 4: Verify build**

Run: `npm run build`

Expected: TypeScript either passes or reports only type import mistakes from this task.

## Task 2: QuickRead Core Pipeline

**Files:**
- Create: `src/main/quick-read/quick-read.ts`
- Test: `tests/quick-read.test.ts`

- [ ] **Step 1: Add failing tests**

Create `tests/quick-read.test.ts`:

```ts
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createQuickReadEstimate, generateQuickReadAudio } from '../src/main/quick-read/quick-read';

describe('quick read', () => {
  it('creates an estimate from a highlight source without generating audio', () => {
    const quickRead = createQuickReadEstimate({
      source: {
        id: 'highlight-1',
        mode: 'highlight',
        title: 'Selected Text',
        text: 'A highlighted paragraph waits for explicit confirmation before narration.',
        receivedAtIso: '2026-05-26T00:00:00.000Z'
      },
      settings: {
        providerId: 'fake',
        voiceId: 'fake-test',
        tone: 'calm-narrator',
        costCapUsd: 10
      }
    });

    expect(quickRead.document.title).toBe('Selected Text');
    expect(quickRead.estimate.estimatedCostUsd).toBe(0);
    expect(quickRead.source.mode).toBe('highlight');
  });

  it('generates temporary fake-provider audio after explicit request', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'readme-quick-read-'));
    const quickRead = createQuickReadEstimate({
      source: {
        id: 'codex-1',
        mode: 'codex',
        title: 'Latest Codex Response',
        text: 'The latest answer is ready to become spoken audio.',
        receivedAtIso: '2026-05-26T00:00:00.000Z'
      },
      settings: {
        providerId: 'fake',
        voiceId: 'fake-test',
        tone: 'calm-narrator',
        costCapUsd: 10
      }
    });

    const generated = await generateQuickReadAudio({
      quickRead,
      quickReadRootDir: root,
      providerSecrets: {},
      onProgress: () => undefined
    });

    expect(generated.sourceId).toBe('codex-1');
    expect(generated.audioUrl.startsWith('file://')).toBe(true);
    expect(generated.generatedCharacters).toBe(quickRead.document.characterCount);
  }, 20_000);
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- tests/quick-read.test.ts`

Expected: fails because `src/main/quick-read/quick-read.ts` does not exist.

- [ ] **Step 3: Implement QuickRead core**

Create `src/main/quick-read/quick-read.ts`:

```ts
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runNarrationJob, estimateNarrationJob } from '../jobs/job-runner.js';
import type { ProviderSecrets } from '../providers/provider-registry.js';
import { makeSourceDocumentFromText } from '../../shared/text-normalize.js';
import { quickReadTitleForMode, truncateQuickReadText } from '../../shared/quick-read.js';
import type {
  JobProgress,
  ProviderId,
  QuickReadEstimate,
  QuickReadGeneratedAudio,
  QuickReadSource,
  TonePreset
} from '../../shared/types.js';

export interface QuickReadSettings {
  providerId: ProviderId;
  voiceId: string;
  tone: TonePreset;
  costCapUsd: number;
}

export const createQuickReadEstimate = ({
  source,
  settings
}: {
  source: QuickReadSource;
  settings: QuickReadSettings;
}): QuickReadEstimate => {
  const safeText = truncateQuickReadText(source.text);
  const title = source.title || quickReadTitleForMode(source.mode);
  const document = makeSourceDocumentFromText(safeText, title);
  const request = {
    source: document,
    providerId: settings.providerId,
    voiceId: settings.voiceId,
    tone: settings.tone,
    outputPath: '',
    costCapUsd: settings.costCapUsd,
    keepChunkFiles: false
  };

  return {
    source: { ...source, text: safeText, title },
    document,
    estimate: estimateNarrationJob(request),
    ...settings
  };
};

export const generateQuickReadAudio = async ({
  quickRead,
  quickReadRootDir,
  providerSecrets,
  onProgress,
  signal
}: {
  quickRead: QuickReadEstimate;
  quickReadRootDir: string;
  providerSecrets?: ProviderSecrets;
  onProgress: (progress: JobProgress) => void;
  signal?: AbortSignal;
}): Promise<QuickReadGeneratedAudio> => {
  const outputPath = path.join(quickReadRootDir, quickRead.source.id, 'quick-read.mp3');
  const manifest = await runNarrationJob({
    request: {
      source: quickRead.document,
      providerId: quickRead.providerId,
      voiceId: quickRead.voiceId,
      tone: quickRead.tone,
      outputPath,
      costCapUsd: quickRead.costCapUsd,
      keepChunkFiles: false
    },
    jobRootDir: path.join(quickReadRootDir, 'jobs'),
    providerSecrets,
    onProgress,
    signal
  });

  return {
    sourceId: quickRead.source.id,
    outputPath,
    audioUrl: pathToFileURL(outputPath).toString(),
    actualCostUsd: manifest.actualCostUsd,
    generatedCharacters: manifest.generatedCharacters
  };
};
```

- [ ] **Step 4: Run QuickRead tests**

Run: `npm test -- tests/quick-read.test.ts`

Expected: pass.

## Task 3: Codex Mode Session Reader

**Files:**
- Create: `src/main/codex/codex-session-reader.ts`
- Test: `tests/codex-session-reader.test.ts`

- [ ] **Step 1: Add failing Codex reader tests**

Create `tests/codex-session-reader.test.ts`:

```ts
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findLatestCodexSessionFile,
  getLatestCodexAssistantMessage,
  prepareCodexSpeechText
} from '../src/main/codex/codex-session-reader';

describe('codex session reader', () => {
  it('finds the newest jsonl session recursively', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'readme-codex-'));
    await mkdir(path.join(root, 'sessions', '2026', '05'), { recursive: true });
    const sessionPath = path.join(root, 'sessions', '2026', '05', 'session.jsonl');
    await writeFile(sessionPath, '');

    expect(findLatestCodexSessionFile(root)).toBe(sessionPath);
  });

  it('prefers final assistant messages and removes code blocks', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'readme-codex-'));
    const sessionPath = path.join(root, 'session.jsonl');
    await writeFile(sessionPath, [
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          phase: 'commentary',
          content: [{ type: 'output_text', text: 'working' }]
        }
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          phase: 'final',
          content: [{ type: 'output_text', text: '## Done\\nHere is `thing`.\\n```ts\\nsecret();\\n```' }]
        }
      })
    ].join('\n'));

    const message = getLatestCodexAssistantMessage(sessionPath, {
      includeCodeBlocks: false,
      maxCharacters: 1000,
      speakMode: 'final'
    });

    expect(message?.text).toBe('Done Here is thing. Code block omitted.');
  });

  it('truncates long Codex text', () => {
    expect(prepareCodexSpeechText('a'.repeat(10), {
      includeCodeBlocks: false,
      maxCharacters: 5,
      speakMode: 'final'
    })).toBe('aaaaa...');
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- tests/codex-session-reader.test.ts`

Expected: fails because the reader does not exist.

- [ ] **Step 3: Implement Codex reader**

Implement `src/main/codex/codex-session-reader.ts` by porting the relevant ideas from `~/plugins/codex-read-aloud/scripts/lib/read-aloud.mjs`: recursive latest `.jsonl` lookup, assistant-message extraction, final-phase preference, markdown cleanup, code-block omission, max-character truncation, and stable message keys.

- [ ] **Step 4: Run Codex reader tests**

Run: `npm test -- tests/codex-session-reader.test.ts`

Expected: pass.

## Task 4: Bubble Positioning Away From Text

**Files:**
- Create: `src/main/highlight/bubble-position.ts`
- Test: `tests/bubble-position.test.ts`

- [ ] **Step 1: Add failing positioning tests**

Create `tests/bubble-position.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { placeBubbleAwayFromSelection } from '../src/main/highlight/bubble-position';

describe('placeBubbleAwayFromSelection', () => {
  const screen = { x: 0, y: 0, width: 1440, height: 900 };
  const bubble = { width: 180, height: 46 };

  it('places the bubble to the right of normal selected text', () => {
    const selection = { x: 100, y: 400, width: 600, height: 36 };
    const placed = placeBubbleAwayFromSelection({ selection, screen, bubble });

    expect(placed.x).toBeGreaterThanOrEqual(selection.x + selection.width + 24);
    expect(placed.y + bubble.height).toBeLessThanOrEqual(screen.height);
  });

  it('uses lower-right fallback when right side would overflow', () => {
    const selection = { x: 1220, y: 120, width: 180, height: 40 };
    const placed = placeBubbleAwayFromSelection({ selection, screen, bubble });

    expect(placed.x + bubble.width).toBeLessThanOrEqual(screen.width - 16);
    expect(placed.y).toBeGreaterThan(selection.y + selection.height);
  });

  it('never overlaps the selection rectangle', () => {
    const selection = { x: 500, y: 300, width: 260, height: 80 };
    const placed = placeBubbleAwayFromSelection({ selection, screen, bubble });

    const overlaps =
      placed.x < selection.x + selection.width &&
      placed.x + bubble.width > selection.x &&
      placed.y < selection.y + selection.height &&
      placed.y + bubble.height > selection.y;

    expect(overlaps).toBe(false);
  });
});
```

- [ ] **Step 2: Implement positioning**

Create `src/main/highlight/bubble-position.ts`:

```ts
import type { ScreenRect } from '../../shared/types.js';

export interface BubbleSize {
  width: number;
  height: number;
}

const MARGIN = 16;
const GAP = 24;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const placeBubbleAwayFromSelection = ({
  selection,
  screen,
  bubble
}: {
  selection: ScreenRect;
  screen: ScreenRect;
  bubble: BubbleSize;
}): { x: number; y: number } => {
  const rightSide = {
    x: selection.x + selection.width + GAP,
    y: selection.y + Math.round((selection.height - bubble.height) / 2)
  };

  if (rightSide.x + bubble.width <= screen.x + screen.width - MARGIN) {
    return {
      x: rightSide.x,
      y: clamp(rightSide.y, screen.y + MARGIN, screen.y + screen.height - bubble.height - MARGIN)
    };
  }

  const below = {
    x: selection.x + selection.width - bubble.width,
    y: selection.y + selection.height + GAP
  };

  return {
    x: clamp(below.x, screen.x + MARGIN, screen.x + screen.width - bubble.width - MARGIN),
    y: clamp(below.y, screen.y + MARGIN, screen.y + screen.height - bubble.height - MARGIN)
  };
};
```

- [ ] **Step 3: Run positioning tests**

Run: `npm test -- tests/bubble-position.test.ts`

Expected: pass.

## Task 5: Native Highlight Accessibility Helper

**Files:**
- Create: `src/native/highlight-helper.m`
- Modify: `package.json`

- [ ] **Step 1: Create native helper**

Create `src/native/highlight-helper.m`.

Implementation requirements:
- Call `AXIsProcessTrustedWithOptions` with `kAXTrustedCheckOptionPrompt` when Highlight Mode is enabled.
- Poll the focused UI element at a conservative interval, such as 250 ms.
- Read `kAXSelectedTextAttribute`.
- Read `kAXSelectedTextRangeAttribute`.
- Use `kAXBoundsForRangeParameterizedAttribute` to get selected text bounds when available.
- Emit newline-delimited JSON to the Electron bridge with `text`, `bounds`, `sourceAppName`, `sourceAppBundleId`, and timestamp.
- Do not read or write the clipboard.
- Deduplicate unchanged selected text before sending.

- [ ] **Step 2: Add native build script**

Add to `package.json`:

```json
"build:highlight-helper": "mkdir -p dist/native && clang -fobjc-arc -framework AppKit -framework ApplicationServices -framework Foundation src/native/highlight-helper.m -o dist/native/longread-highlight-helper",
"build:native": "npm run build:keychain-helper && npm run build:highlight-helper"
```

If `build:native` already exists, include `build:highlight-helper` in the chain.

- [ ] **Step 3: Compile helper**

Run: `npm run build:native`

Expected: `dist/native/longread-highlight-helper` exists.

## Task 6: Highlight Bridge And Bubble Window

**Files:**
- Create: `src/main/highlight/highlight-bridge.ts`
- Create: `src/main/quick-read/quick-read-window.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/main/preload.cts`

- [ ] **Step 1: Implement highlight bridge**

Create `src/main/highlight/highlight-bridge.ts`.

Implementation requirements:
- Spawn `longread-highlight-helper` only when Highlight Mode is enabled.
- Receive newline-delimited JSON events.
- Validate text is non-empty and within `QUICK_READ_MAX_CHARACTERS`.
- Deduplicate by text hash plus bounds.
- Convert helper payloads into `QuickReadSource` with `mode: 'highlight'`.
- Call the quick-read window with the source and bounds.
- Stop helper cleanly when Highlight Mode is disabled or app quits.

- [ ] **Step 2: Implement quick-read window**

Create `src/main/quick-read/quick-read-window.ts`.

Implementation requirements:
- Store pending `QuickReadEstimate` values by source ID.
- For highlight sources with bounds, use `placeBubbleAwayFromSelection`.
- Create a small frameless `BrowserWindow` loaded with `?view=quick-read&sourceId=...`.
- Use `alwaysOnTop: true`.
- Do not focus the window until the user clicks it.
- Close stale bubble windows when a new selection arrives.

- [ ] **Step 3: Register IPC**

Add handlers in `src/main/ipc.ts` for:
- `QUICK_READ_GET`
- `QUICK_READ_GENERATE`
- `QUICK_READ_DISMISS`
- `CODEX_LATEST_GET`
- `CODEX_LATEST_OPEN`
- `HIGHLIGHT_MODE_SET`

Each generate handler must reject cap-exceeded estimates before provider calls.

## Task 7: Codex Mode UI And Flow

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`

- [ ] **Step 1: Add mode controls**

Add two visible modes in the main UI:
- `Highlight Mode` toggle with Accessibility permission status.
- `Codex Mode` section with `Read latest Codex response`, `Refresh`, and `Stop`/dismiss behavior.

- [ ] **Step 2: Add quick-read bubble UI**

Add a `QuickReadBubbleView` for `?view=quick-read`.

The bubble must show:
- source label: `Selected Text` or `Latest Codex Response`
- character count
- estimated cost
- cost cap
- `Read` button
- `Open in readme` button for long/cap-exceeded text
- playback controls after generation

- [ ] **Step 3: Add styles**

Style the bubble as a compact floating utility surface. Keep it small enough to avoid covering text and native bubbles.

## Task 8: Packaging And Permissions

**Files:**
- Modify: `electron-builder.config.mjs`

- [ ] **Step 1: Package helper**

Add `longread-highlight-helper` to `extraResources` and `mac.binaries`.

- [ ] **Step 2: Preserve hardened runtime config**

Keep existing Electron hardened runtime settings and sign the helper with the app.

- [ ] **Step 3: Build package**

Run: `npm run package:mac`

Expected: packaged app includes `Contents/Resources/native/longread-highlight-helper`.

## Task 9: Verification

**Files:**
- No planned source changes.

- [ ] **Step 1: Unit tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Build**

Run: `npm run build`

Expected: native helper, main process, and renderer build pass.

- [ ] **Step 3: Manual Highlight Mode checks**

Validate:
- First enable prompts for Accessibility permission.
- Highlighting text in TextEdit shows the bubble away from selected text.
- Highlighting text in Codex shows either a bubble or a quiet failure, but never clipboard access.
- Bubble does not overlap native contextual UI like `Add to chat`.
- Clicking `Read` generates and plays audio.
- Merely highlighting text does not generate audio.

- [ ] **Step 4: Manual Codex Mode checks**

Validate:
- `Read latest Codex response` finds the newest local session JSONL.
- Final assistant messages are preferred.
- Code blocks are omitted by default.
- Cost estimate appears before generation.
- Clicking `Read` generates and plays audio.
- No automatic read-aloud happens without explicit user action.
