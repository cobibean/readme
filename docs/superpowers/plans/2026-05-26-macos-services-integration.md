# macOS Services Integration Implementation Plan

> **Status:** Superseded on 2026-05-26 by `docs/superpowers/plans/2026-05-26-highlight-and-codex-modes.md`. Services may still be useful as an optional trigger later, but it is no longer the primary launch plan because custom Electron/Chromium context menus, including Codex, may not expose macOS Services.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a macOS Services item so selected text in other apps can be sent to readme, estimated, generated, and played from a compact quick-listen window without opening the main app window.

**Architecture:** Declare a `Read with readme` service in the app bundle Info.plist and run a tiny native AppKit/Foundation helper while Electron is open. The helper registers the service provider, reads selected text from the service pasteboard, forwards the text to Electron over a local Unix socket, and Electron shows a small always-on-top quick-listen window that estimates cost before generation. Quick-listen generation reuses the existing source normalization, provider registry, cost caps, chunking, job runner, and temp MP3 output.

**Tech Stack:** Electron main process, React renderer, TypeScript, Vitest, Node `net` Unix sockets, Objective-C AppKit/Foundation helper compiled with `clang`, electron-builder mac Info.plist extension.

---

## File Structure

- Create: `src/native/services-helper.m`
  Native macOS helper that registers the Services provider and forwards selected text to Electron.
- Create: `src/main/services/services-bridge.ts`
  Starts/stops the helper, owns the Unix socket server, validates helper messages, and emits service selection events.
- Create: `src/main/quick-listen/quick-listen.ts`
  Builds a `SourceDocument` from selected text, estimates cost, and generates a temporary MP3 through the existing job runner.
- Create: `src/main/quick-listen/quick-listen-window.ts`
  Owns the compact floating BrowserWindow used for selected-text confirmation and playback.
- Create: `tests/quick-listen.test.ts`
  Verifies estimate and fake-provider generation for selected text.
- Create: `tests/services-bridge.test.ts`
  Verifies service message validation and rejection of malformed helper payloads.
- Modify: `package.json`
  Build both native helpers and include a direct `build:native` script.
- Modify: `electron-builder.config.mjs`
  Package the Services helper and add the `NSServices` bundle metadata.
- Modify: `src/main/index.ts`
  Initialize the services bridge and quick-listen window when the app is ready.
- Modify: `src/main/ipc.ts`
  Register quick-listen IPC handlers.
- Modify: `src/main/preload.cts`
  Expose quick-listen APIs to the renderer.
- Modify: `src/shared/ipc-channels.ts`
  Add quick-listen IPC channel names.
- Modify: `src/shared/types.ts`
  Add quick-listen request/result/progress types.
- Modify: `src/renderer/App.tsx`
  Route `?view=quick-listen` to the quick-listen UI while keeping the main app unchanged.
- Modify: `src/renderer/styles.css`
  Add compact quick-listen window styles.

## Product Rules

- Do not generate paid audio until the quick-listen window has shown the estimated cost and the user clicks `Read`.
- If the selected text estimate exceeds the current cap, show `Open in readme` instead of `Read`.
- Use the current default voice/provider settings; do not introduce ElevenLabs or system voices.
- Store generated quick-listen audio under app support temp state, not beside user documents.
- Keep selected text local except for the chosen TTS provider call after confirmation.

## Task 1: Add Quick-Listen Types And IPC Channels

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/ipc-channels.ts`

- [ ] **Step 1: Add shared quick-listen types**

Add these interfaces to `src/shared/types.ts` after `GeneratedSample`:

```ts
export interface QuickListenSelection {
  id: string;
  receivedAtIso: string;
  source: SourceDocument;
}

export interface QuickListenEstimate {
  selection: QuickListenSelection;
  estimate: CostEstimate;
  providerId: ProviderId;
  voiceId: string;
  tone: TonePreset;
  costCapUsd: number;
}

export interface QuickListenGenerateRequest {
  selectionId: string;
}

export interface QuickListenGeneratedAudio {
  selectionId: string;
  outputPath: string;
  audioUrl: string;
  actualCostUsd: number;
  generatedCharacters: number;
}
```

- [ ] **Step 2: Add IPC channel names**

Add these entries to `IPC_CHANNELS` in `src/shared/ipc-channels.ts`:

```ts
QUICK_LISTEN_GET: 'quick-listen:get',
QUICK_LISTEN_GENERATE: 'quick-listen:generate',
QUICK_LISTEN_OPEN_MAIN: 'quick-listen:open-main',
QUICK_LISTEN_DISMISS: 'quick-listen:dismiss',
QUICK_LISTEN_PROGRESS: 'quick-listen:progress'
```

- [ ] **Step 3: Build to catch type drift**

Run: `npm run build`

Expected: build fails only if a typo was introduced in the shared exports. Fix any typo before continuing.

## Task 2: Implement Quick-Listen Core

**Files:**
- Create: `src/main/quick-listen/quick-listen.ts`
- Test: `tests/quick-listen.test.ts`

- [ ] **Step 1: Write the failing quick-listen test**

Create `tests/quick-listen.test.ts`:

```ts
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createQuickListenEstimate,
  generateQuickListenAudio
} from '../src/main/quick-listen/quick-listen';

describe('quick listen', () => {
  it('estimates selected text before generation', () => {
    const estimate = createQuickListenEstimate({
      id: 'selection-1',
      text: 'This selected paragraph should be read aloud after the user confirms the cost.',
      settings: {
        providerId: 'fake',
        voiceId: 'fake-test',
        tone: 'calm-narrator',
        costCapUsd: 10
      }
    });

    expect(estimate.selection.source.title).toBe('Selected Text');
    expect(estimate.selection.source.characterCount).toBeGreaterThan(20);
    expect(estimate.estimate.estimatedCostUsd).toBe(0);
    expect(estimate.voiceId).toBe('fake-test');
  });

  it('generates temporary audio with the fake provider', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'readme-quick-listen-'));
    const quickEstimate = createQuickListenEstimate({
      id: 'selection-2',
      text: 'Quick listen text with enough words to become a tiny generated audio file.',
      settings: {
        providerId: 'fake',
        voiceId: 'fake-test',
        tone: 'calm-narrator',
        costCapUsd: 10
      }
    });

    const generated = await generateQuickListenAudio({
      quickEstimate,
      quickListenRootDir: root,
      providerSecrets: {},
      onProgress: () => undefined
    });

    expect(generated.selectionId).toBe('selection-2');
    expect(generated.outputPath.endsWith('.mp3')).toBe(true);
    expect(generated.audioUrl.startsWith('file://')).toBe(true);
    expect(generated.generatedCharacters).toBe(quickEstimate.selection.source.characterCount);
  }, 20_000);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/quick-listen.test.ts`

Expected: fail because `src/main/quick-listen/quick-listen.ts` does not exist.

- [ ] **Step 3: Implement quick-listen core**

Create `src/main/quick-listen/quick-listen.ts`:

```ts
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ProviderSecrets } from '../providers/provider-registry.js';
import { estimateNarrationJob, runNarrationJob } from '../jobs/job-runner.js';
import { makeSourceDocumentFromText } from '../../shared/text-normalize.js';
import type {
  JobProgress,
  ProviderId,
  QuickListenEstimate,
  QuickListenGeneratedAudio,
  TonePreset
} from '../../shared/types.js';

export interface QuickListenSettings {
  providerId: ProviderId;
  voiceId: string;
  tone: TonePreset;
  costCapUsd: number;
}

export interface CreateQuickListenEstimateInput {
  id?: string;
  text: string;
  settings: QuickListenSettings;
}

export const createQuickListenEstimate = ({
  id = randomUUID(),
  text,
  settings
}: CreateQuickListenEstimateInput): QuickListenEstimate => {
  const source = makeSourceDocumentFromText(text, 'Selected Text');
  const request = {
    source,
    providerId: settings.providerId,
    voiceId: settings.voiceId,
    tone: settings.tone,
    outputPath: '',
    costCapUsd: settings.costCapUsd,
    keepChunkFiles: false
  };

  return {
    selection: {
      id,
      receivedAtIso: new Date().toISOString(),
      source
    },
    estimate: estimateNarrationJob(request),
    ...settings
  };
};

export const generateQuickListenAudio = async ({
  quickEstimate,
  quickListenRootDir,
  providerSecrets,
  onProgress,
  signal
}: {
  quickEstimate: QuickListenEstimate;
  quickListenRootDir: string;
  providerSecrets?: ProviderSecrets;
  onProgress: (progress: JobProgress) => void;
  signal?: AbortSignal;
}): Promise<QuickListenGeneratedAudio> => {
  const outputPath = path.join(
    quickListenRootDir,
    quickEstimate.selection.id,
    'selected-text.mp3'
  );

  const manifest = await runNarrationJob({
    request: {
      source: quickEstimate.selection.source,
      providerId: quickEstimate.providerId,
      voiceId: quickEstimate.voiceId,
      tone: quickEstimate.tone,
      outputPath,
      costCapUsd: quickEstimate.costCapUsd,
      keepChunkFiles: false
    },
    jobRootDir: path.join(quickListenRootDir, 'jobs'),
    providerSecrets,
    signal,
    onProgress
  });

  return {
    selectionId: quickEstimate.selection.id,
    outputPath,
    audioUrl: pathToFileURL(outputPath).toString(),
    actualCostUsd: manifest.actualCostUsd,
    generatedCharacters: manifest.generatedCharacters
  };
};
```

- [ ] **Step 4: Run the quick-listen test**

Run: `npm test -- tests/quick-listen.test.ts`

Expected: pass.

## Task 3: Implement Native Services Helper

**Files:**
- Create: `src/native/services-helper.m`
- Modify: `package.json`

- [ ] **Step 1: Add the Objective-C services helper**

Create `src/native/services-helper.m`:

```objc
#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>
#import <sys/socket.h>
#import <sys/un.h>
#import <string.h>
#import <unistd.h>

static NSString *ReadmeSocketPath(void) {
  NSDictionary *environment = [[NSProcessInfo processInfo] environment];
  return environment[@"README_SERVICES_SOCKET"];
}

static NSData *ReadmeJsonPayload(NSString *text) {
  NSISO8601DateFormatter *formatter = [NSISO8601DateFormatter new];
  NSDictionary *payload = @{
    @"type": @"selection",
    @"text": text,
    @"receivedAtIso": [formatter stringFromDate:[NSDate date]]
  };
  return [NSJSONSerialization dataWithJSONObject:payload options:0 error:nil];
}

static BOOL ReadmeSendSelection(NSString *text) {
  NSString *socketPath = ReadmeSocketPath();
  if (socketPath.length == 0 || text.length == 0) {
    return NO;
  }

  int fd = socket(AF_UNIX, SOCK_STREAM, 0);
  if (fd < 0) {
    return NO;
  }

  struct sockaddr_un address;
  memset(&address, 0, sizeof(address));
  address.sun_family = AF_UNIX;
  strncpy(address.sun_path, [socketPath fileSystemRepresentation], sizeof(address.sun_path) - 1);

  if (connect(fd, (struct sockaddr *)&address, sizeof(address)) != 0) {
    close(fd);
    return NO;
  }

  NSData *json = ReadmeJsonPayload(text);
  NSMutableData *line = [json mutableCopy];
  const char newline = '\n';
  [line appendBytes:&newline length:1];
  ssize_t written = write(fd, line.bytes, line.length);
  close(fd);
  return written == (ssize_t)line.length;
}

@interface ReadmeServicesProvider : NSObject
@end

@implementation ReadmeServicesProvider

- (void)readSelection:(NSPasteboard *)pboard userData:(NSString *)userData error:(NSString **)error {
  NSString *text = [pboard stringForType:NSPasteboardTypeString];
  if (text.length == 0) {
    text = [pboard stringForType:NSStringPboardType];
  }

  NSString *trimmed = [text stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  if (trimmed.length == 0) {
    if (error != NULL) {
      *error = @"No readable selected text was found.";
    }
    return;
  }

  if (!ReadmeSendSelection(trimmed) && error != NULL) {
    *error = @"readme is open, but the selection bridge is not available.";
  }
}

@end

int main(void) {
  @autoreleasepool {
    NSString *portName = [[[NSProcessInfo processInfo] environment] objectForKey:@"README_SERVICES_PORT"];
    if (portName.length == 0) {
      portName = @"app.readme.desktop.services";
    }

    ReadmeServicesProvider *provider = [ReadmeServicesProvider new];
    NSRegisterServicesProvider(provider, portName);
    NSUpdateDynamicServices();
    [[NSRunLoop currentRunLoop] run];
  }
  return 0;
}
```

- [ ] **Step 2: Update native build scripts**

In `package.json`, replace `build:keychain-helper` with these scripts:

```json
"build:keychain-helper": "mkdir -p dist/native && clang -fobjc-arc -framework Foundation -framework Security src/native/keychain-helper.m -o dist/native/longread-keychain",
"build:services-helper": "mkdir -p dist/native && clang -fobjc-arc -framework AppKit -framework Foundation src/native/services-helper.m -o dist/native/longread-services-helper",
"build:native": "npm run build:keychain-helper && npm run build:services-helper",
"dev": "npm run build:native && npm run build:main && vite --host 127.0.0.1",
"build": "npm run build:native && npm run build:main && npm run build:renderer",
```

- [ ] **Step 3: Compile native helpers**

Run: `npm run build:native`

Expected: `dist/native/longread-keychain` and `dist/native/longread-services-helper` exist.

## Task 4: Add Services Bridge In Electron Main

**Files:**
- Create: `src/main/services/services-bridge.ts`
- Test: `tests/services-bridge.test.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Write service bridge validation tests**

Create `tests/services-bridge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseServicePayload } from '../src/main/services/services-bridge';

describe('services bridge payload parsing', () => {
  it('accepts selected text payloads', () => {
    expect(parseServicePayload('{"type":"selection","text":"Hello world"}\n')).toEqual({
      type: 'selection',
      text: 'Hello world'
    });
  });

  it('rejects missing text', () => {
    expect(parseServicePayload('{"type":"selection","text":"   "}')).toBeNull();
  });

  it('rejects malformed json', () => {
    expect(parseServicePayload('not-json')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/services-bridge.test.ts`

Expected: fail because `src/main/services/services-bridge.ts` does not exist.

- [ ] **Step 3: Implement the bridge**

Create `src/main/services/services-bridge.ts`:

```ts
import { EventEmitter } from 'node:events';
import { existsSync, rmSync } from 'node:fs';
import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { app } from 'electron';

export interface ServiceSelectionPayload {
  type: 'selection';
  text: string;
}

export const parseServicePayload = (raw: string): ServiceSelectionPayload | null => {
  try {
    const parsed = JSON.parse(raw.trim()) as Partial<ServiceSelectionPayload>;
    if (parsed.type !== 'selection' || typeof parsed.text !== 'string') {
      return null;
    }
    const text = parsed.text.trim();
    return text ? { type: 'selection', text } : null;
  } catch {
    return null;
  }
};

export class ServicesBridge extends EventEmitter {
  private server: net.Server | null = null;
  private helper: ChildProcess | null = null;

  start(): void {
    const socketPath = path.join(app.getPath('userData'), 'readme-services.sock');
    if (existsSync(socketPath)) {
      rmSync(socketPath, { force: true });
    }

    this.server = net.createServer((socket) => {
      let buffer = '';
      socket.setEncoding('utf8');
      socket.on('data', (chunk) => {
        buffer += chunk;
        const payload = parseServicePayload(buffer);
        if (payload) {
          this.emit('selection', payload.text);
        }
      });
    });

    this.server.listen(socketPath, () => {
      this.launchHelper(socketPath);
    });
  }

  stop(): void {
    this.helper?.kill();
    this.helper = null;
    this.server?.close();
    this.server = null;
  }

  private launchHelper(socketPath: string): void {
    const helperPath = app.isPackaged
      ? path.join(process.resourcesPath, 'native', 'longread-services-helper')
      : path.join(app.getAppPath(), 'dist', 'native', 'longread-services-helper');

    if (!existsSync(helperPath)) {
      console.warn('Services helper missing:', helperPath);
      return;
    }

    this.helper = spawn(helperPath, [], {
      env: {
        ...process.env,
        README_SERVICES_SOCKET: socketPath,
        README_SERVICES_PORT: 'app.readme.desktop.services'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.helper.on('exit', () => {
      this.helper = null;
    });
  }
}
```

- [ ] **Step 4: Wire bridge startup**

Modify `src/main/index.ts`:

```ts
import { ServicesBridge } from './services/services-bridge.js';
import { showQuickListenWindow } from './quick-listen/quick-listen-window.js';

let servicesBridge: ServicesBridge | null = null;
```

Inside `app.whenReady().then(() => { ... })`, after `registerIpcHandlers();`:

```ts
servicesBridge = new ServicesBridge();
servicesBridge.on('selection', (text: string) => {
  void showQuickListenWindow(text);
});
servicesBridge.start();
```

Add this shutdown handler:

```ts
app.on('before-quit', () => {
  servicesBridge?.stop();
});
```

- [ ] **Step 5: Run bridge tests**

Run: `npm test -- tests/services-bridge.test.ts`

Expected: pass.

## Task 5: Add Quick-Listen Window And IPC

**Files:**
- Create: `src/main/quick-listen/quick-listen-window.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/main/preload.cts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`

- [ ] **Step 1: Create quick-listen window state**

Create `src/main/quick-listen/quick-listen-window.ts`:

```ts
import { BrowserWindow, app, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createQuickListenEstimate } from './quick-listen.js';
import { getSettings } from '../settings.js';
import type { QuickListenEstimate } from '../../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pendingQuickListens = new Map<string, QuickListenEstimate>();
let quickListenWindow: BrowserWindow | null = null;

export const getQuickListenEstimate = (selectionId: string): QuickListenEstimate | null =>
  pendingQuickListens.get(selectionId) ?? null;

export const showQuickListenWindow = async (text: string): Promise<void> => {
  const settings = await getSettings();
  const quickEstimate = createQuickListenEstimate({
    text,
    settings: {
      providerId: settings.defaultProviderId,
      voiceId: settings.defaultVoiceId,
      tone: 'warm-lecturer',
      costCapUsd: settings.defaultCostCapUsd
    }
  });
  pendingQuickListens.set(quickEstimate.selection.id, quickEstimate);

  const cursor = screen.getCursorScreenPoint();
  quickListenWindow?.close();
  quickListenWindow = new BrowserWindow({
    width: 390,
    height: 270,
    x: cursor.x + 12,
    y: cursor.y + 12,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    alwaysOnTop: true,
    title: 'readme quick listen',
    webPreferences: {
      preload: path.join(__dirname, '../preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void quickListenWindow.loadURL(`${devServerUrl}?view=quick-listen&selectionId=${quickEstimate.selection.id}`);
  } else {
    void quickListenWindow.loadFile(path.join(__dirname, '../../renderer/index.html'), {
      query: { view: 'quick-listen', selectionId: quickEstimate.selection.id }
    });
  }
  quickListenWindow.showInactive();
};

export const closeQuickListenWindow = (): void => {
  quickListenWindow?.close();
  quickListenWindow = null;
};
```

- [ ] **Step 2: Add quick-listen IPC handlers**

In `src/main/ipc.ts`, import:

```ts
import { getQuickListenEstimate, closeQuickListenWindow } from './quick-listen/quick-listen-window.js';
import { generateQuickListenAudio } from './quick-listen/quick-listen.js';
```

Inside `registerIpcHandlers`, add:

```ts
ipcMain.handle(IPC_CHANNELS.QUICK_LISTEN_GET, async (_event, selectionId: string) => {
  return getQuickListenEstimate(selectionId);
});

ipcMain.handle(IPC_CHANNELS.QUICK_LISTEN_GENERATE, async (event, selectionId: string) => {
  const quickEstimate = getQuickListenEstimate(selectionId);
  if (!quickEstimate) {
    throw new Error('Selected text is no longer available.');
  }
  if (quickEstimate.estimate.capExceeded) {
    throw new Error('Selected text exceeds the configured cost cap.');
  }
  const sender = BrowserWindow.fromWebContents(event.sender);
  return generateQuickListenAudio({
    quickEstimate,
    quickListenRootDir: appSupportPath('quick-listens'),
    providerSecrets: await providerSecrets(),
    onProgress: (progress) => {
      sender?.webContents.send(IPC_CHANNELS.QUICK_LISTEN_PROGRESS, progress);
    }
  });
});

ipcMain.handle(IPC_CHANNELS.QUICK_LISTEN_DISMISS, async () => {
  closeQuickListenWindow();
});

ipcMain.handle(IPC_CHANNELS.QUICK_LISTEN_OPEN_MAIN, async (_event, selectionId: string) => {
  const quickEstimate = getQuickListenEstimate(selectionId);
  const window = BrowserWindow.getAllWindows().find((candidate) => candidate.getTitle() === 'readme');
  window?.show();
  window?.focus();
  return quickEstimate;
});
```

- [ ] **Step 3: Expose preload APIs**

In `src/main/preload.cts`, add these entries to the local `IPC_CHANNELS` object:

```ts
QUICK_LISTEN_GET: 'quick-listen:get',
QUICK_LISTEN_GENERATE: 'quick-listen:generate',
QUICK_LISTEN_OPEN_MAIN: 'quick-listen:open-main',
QUICK_LISTEN_DISMISS: 'quick-listen:dismiss',
QUICK_LISTEN_PROGRESS: 'quick-listen:progress'
```

Then add these methods to the object passed to `contextBridge.exposeInMainWorld`:

```ts
getQuickListen: (selectionId: string) =>
  ipcRenderer.invoke(IPC_CHANNELS.QUICK_LISTEN_GET, selectionId),
generateQuickListen: (selectionId: string) =>
  ipcRenderer.invoke(IPC_CHANNELS.QUICK_LISTEN_GENERATE, selectionId),
dismissQuickListen: () =>
  ipcRenderer.invoke(IPC_CHANNELS.QUICK_LISTEN_DISMISS),
openQuickListenInMain: (selectionId: string) =>
  ipcRenderer.invoke(IPC_CHANNELS.QUICK_LISTEN_OPEN_MAIN, selectionId),
onQuickListenProgress: (callback: (progress: unknown) => void): Cleanup => {
  const listener = (_event: unknown, progress: unknown) => callback(progress);
  ipcRenderer.on(IPC_CHANNELS.QUICK_LISTEN_PROGRESS, listener);
  return () => ipcRenderer.removeListener(IPC_CHANNELS.QUICK_LISTEN_PROGRESS, listener);
}
```

- [ ] **Step 4: Add compact renderer branch**

In `src/renderer/App.tsx`, extend the existing shared type import:

```ts
import type {
  CostEstimate,
  GeneratedSample,
  JobProgress,
  NarrationJobRequest,
  QuickListenEstimate,
  QuickListenGeneratedAudio,
  SourceDocument,
  TonePreset
} from '../shared/types';
```

Add these methods to `Window.longread` inside the existing `declare global` block:

```ts
getQuickListen: (selectionId: string) => Promise<QuickListenEstimate | null>;
generateQuickListen: (selectionId: string) => Promise<QuickListenGeneratedAudio>;
dismissQuickListen: () => Promise<void>;
openQuickListenInMain: (selectionId: string) => Promise<QuickListenEstimate | null>;
onQuickListenProgress: (callback: (progress: JobProgress) => void) => () => void;
```

Add this component above `const App = (): JSX.Element => {`:

```tsx
const QuickListenView = (): JSX.Element => {
  const params = new URLSearchParams(window.location.search);
  const selectionId = params.get('selectionId') ?? '';
  const [quickListen, setQuickListen] = useState<QuickListenEstimate | null>(null);
  const [generated, setGenerated] = useState<QuickListenGeneratedAudio | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [message, setMessage] = useState('Loading selection');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    void window.longread?.getQuickListen(selectionId).then((nextQuickListen) => {
      setQuickListen(nextQuickListen);
      setMessage(nextQuickListen ? 'Ready' : 'Selection unavailable');
    });
    return window.longread?.onQuickListenProgress((nextProgress) => {
      setProgress(nextProgress);
      setMessage(nextProgress.currentMessage);
    });
  }, [selectionId]);

  const readSelection = async (): Promise<void> => {
    if (!selectionId || !window.longread || !quickListen || quickListen.estimate.capExceeded) {
      return;
    }
    setIsGenerating(true);
    setMessage('Generating audio');
    try {
      const nextGenerated = await window.longread.generateQuickListen(selectionId);
      setGenerated(nextGenerated);
      setMessage('Ready to play');
    } catch (error) {
      setMessage(displayError(error, 'Quick listen failed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const openInMain = async (): Promise<void> => {
    await window.longread?.openQuickListenInMain(selectionId);
  };

  const dismiss = async (): Promise<void> => {
    await window.longread?.dismissQuickListen();
  };

  const estimate = quickListen?.estimate;
  const progressPercent = progress && progress.totalChunks > 0
    ? Math.round((progress.completedChunks / progress.totalChunks) * 100)
    : 0;

  return (
    <main className="quick-listen-shell">
      <header className="quick-listen-header">
        <div>
          <p className="eyebrow">readme</p>
          <h1>Read selection?</h1>
        </div>
        <button type="button" className="icon-button" aria-label="Close" onClick={dismiss}>x</button>
      </header>

      {quickListen && estimate ? (
        <>
          <div className="quick-listen-meta">
            <div><span>Cost</span><strong>{formatMoney(estimate.estimatedCostUsd)}</strong></div>
            <div><span>Cap</span><strong>{formatMoney(estimate.costCapUsd)}</strong></div>
            <div><span>Text</span><strong>{quickListen.selection.source.characterCount.toLocaleString()} chars</strong></div>
          </div>

          {estimate.capExceeded && (
            <p className="warning">This selection exceeds the current cost cap.</p>
          )}

          {progress && (
            <div className="progress-track">
              <div style={{ width: `${progressPercent}%` }} />
            </div>
          )}

          {generated && <audio controls autoPlay src={generated.audioUrl} />}

          <div className="quick-listen-actions">
            <button
              className="primary"
              type="button"
              onClick={readSelection}
              disabled={isGenerating || estimate.capExceeded || Boolean(generated)}
            >
              Read
            </button>
            <button type="button" onClick={openInMain}>
              Open in readme
            </button>
          </div>
        </>
      ) : (
        <p className="muted">No selected text was received.</p>
      )}

      <p className="muted">{message}</p>
    </main>
  );
};
```

At the top of the `App` component, add:

```tsx
const params = new URLSearchParams(window.location.search);
if (params.get('view') === 'quick-listen') {
  return <QuickListenView />;
}
```

- [ ] **Step 5: Style the compact window**

In `src/renderer/styles.css`, append:

```css
.quick-listen-shell {
  min-height: 100vh;
  padding: 18px;
  background: #f7f4ed;
  color: #181714;
  display: flex;
  flex-direction: column;
  gap: 14px;
  border: 1px solid rgba(24, 23, 20, 0.16);
}

.quick-listen-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.quick-listen-header h1 {
  margin: 0;
  font-size: 20px;
  line-height: 1.15;
}

.icon-button {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  padding: 0;
  display: inline-grid;
  place-items: center;
}

.quick-listen-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.quick-listen-meta div {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(24, 23, 20, 0.1);
  border-radius: 8px;
  padding: 10px;
}

.quick-listen-meta span {
  display: block;
  color: #6f6a60;
  font-size: 11px;
  margin-bottom: 4px;
}

.quick-listen-meta strong {
  display: block;
  font-size: 13px;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.quick-listen-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.quick-listen-shell audio {
  width: 100%;
}
```

- [ ] **Step 6: Build renderer**

Run: `npm run build`

Expected: build passes and the main app still renders normally.

## Task 6: Package The macOS Service

**Files:**
- Modify: `electron-builder.config.mjs`

- [ ] **Step 1: Package the helper**

In `electron-builder.config.mjs`, add the Services helper to `extraResources` and `binaries`:

```js
{
  from: 'dist/native',
  to: 'native',
  filter: ['longread-keychain', 'longread-services-helper']
}
```

```js
binaries: [
  'Contents/Resources/ffmpeg-static/ffmpeg',
  'Contents/Resources/native/longread-keychain',
  'Contents/Resources/native/longread-services-helper'
]
```

- [ ] **Step 2: Add `NSServices` metadata**

Inside `mac.extendInfo`, add:

```js
NSServices: [
  {
    NSMenuItem: {
      default: 'Read with readme'
    },
    NSMessage: 'readSelection',
    NSPortName: 'app.readme.desktop.services',
    NSSendTypes: ['public.utf8-plain-text', 'NSStringPboardType'],
    NSUserData: 'read-selection',
    NSTimeout: '30000'
  }
]
```

- [ ] **Step 3: Package the app**

Run: `npm run package:mac`

Expected: the package contains `Contents/Resources/native/longread-services-helper` and the app Info.plist contains `NSServices`.

- [ ] **Step 4: Inspect packaged Info.plist**

Run:

```bash
/usr/libexec/PlistBuddy -c 'Print :NSServices' 'release/mac-arm64/readme.app/Contents/Info.plist'
```

Expected: prints the `Read with readme` service with `NSMessage` set to `readSelection`.

## Task 7: Manual macOS Validation

**Files:**
- No source changes.

- [ ] **Step 1: Rebuild Launch Services registration**

Run:

```bash
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f /Applications/readme.app
```

Expected: no output or successful registration output.

- [ ] **Step 2: Launch the packaged app**

Open `/Applications/readme.app` or the packaged app under `release/mac-arm64/readme.app`.

Expected: app opens, Services helper process is running, and the main window remains usable.

- [ ] **Step 3: Validate service from TextEdit**

Open TextEdit, type a paragraph, select it, then use `TextEdit > Services > Read with readme`.

Expected: a compact readme quick-listen window appears near the cursor, shows selected text character count and estimated cost, and does not start generation automatically.

- [ ] **Step 4: Validate generation and playback**

Click `Read` in the quick-listen window.

Expected: progress updates, a temp MP3 is generated, and playback controls appear and play the selected text.

- [ ] **Step 5: Validate cap behavior**

Temporarily set the app cost cap very low, select a long paragraph, and invoke the service.

Expected: the quick-listen window shows the cap warning and offers `Open in readme`, not paid generation.

## Task 8: Final Verification

**Files:**
- No source changes unless failures are found.

- [ ] **Step 1: Run tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: native helper, main process, and renderer builds pass.

- [ ] **Step 3: Run package**

Run: `npm run package:mac`

Expected: packaged app builds successfully.

- [ ] **Step 4: Record memory**

Create a new memory file under `docs/memory/YYYY-MM-DD/` with changed files, verification commands, known Services limitations, and manual validation results.

## Known Limitations

- Services are lower friction than paste/open-app flows but are not the universal hover bubble. The user still chooses a menu item or keyboard shortcut from macOS Services.
- Some apps expose selected text to Services more reliably than others.
- macOS may need Launch Services registration refresh before a new or changed Service appears.
- The service helper only runs while readme is open, matching the product assumption for this integration.
- The first universal bubble implementation should be planned separately because it needs Accessibility permissions and per-app selection coordinate handling.
