import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  DEFAULT_COST_CAP_USD,
  DEFAULT_TARGET_CHARS,
  VOICE_OPTIONS,
  buildCostEstimate,
  getVoiceOption
} from '../shared/costs';
import { makeSourceDocumentFromText } from '../shared/text-normalize';
import { TONE_OPTIONS } from '../shared/tones';
import type {
  CostEstimate,
  GeneratedNarrationAudio,
  GeneratedSample,
  JobProgress,
  NarrationJobRequest,
  SourceDocument,
  TonePreset
} from '../shared/types';

type OpenAiKeySource = 'env' | 'keychain' | 'dotenv' | 'missing';

interface AppSettings {
  defaultVoiceId?: unknown;
  defaultCostCapUsd?: unknown;
  hasOpenAiApiKey?: unknown;
  openAiKeySource?: unknown;
}

interface OpenAiKeyValidation {
  ok: boolean;
  message: string;
}

declare global {
  interface Window {
    longread?: {
      getSettings: () => Promise<AppSettings>;
      saveOpenAiApiKey: (apiKey: string) => Promise<AppSettings>;
      clearOpenAiApiKey: () => Promise<AppSettings>;
      validateOpenAiApiKey: () => Promise<OpenAiKeyValidation>;
      extractUrl: (sourceUrl: string) => Promise<SourceDocument>;
      estimateJob: (request: NarrationJobRequest) => Promise<CostEstimate>;
      generateSample: (request: {
        source: SourceDocument;
        providerId: 'openai' | 'fake';
        voiceId: string;
        tone: TonePreset;
        costCapUsd: number;
      }) => Promise<GeneratedSample>;
      startJob: (request: NarrationJobRequest) => Promise<GeneratedNarrationAudio | { status: 'cancelled' }>;
      cancelJob: (jobId: string) => Promise<void>;
      resumeJob: (request: NarrationJobRequest, manifestPath: string) => Promise<GeneratedNarrationAudio | { status: 'cancelled' }>;
      pickOutputFile: (defaultName: string) => Promise<string>;
      saveAudioCopy: (sourcePath: string, defaultName: string) => Promise<string>;
      openOutputFile: (outputPath: string) => Promise<void>;
      revealOutput: (outputPath: string) => Promise<void>;
      onJobProgress: (callback: (progress: JobProgress) => void) => () => void;
    };
  }
}

const openAiVoiceGroups = [
  {
    label: 'OpenAI gpt-4o mini TTS',
    voices: VOICE_OPTIONS.filter((voice) => voice.providerId === 'openai' && voice.model === 'gpt-4o-mini-tts')
  },
  {
    label: 'Legacy OpenAI TTS',
    voices: VOICE_OPTIONS.filter((voice) => voice.providerId === 'openai' && voice.model !== 'gpt-4o-mini-tts')
  }
];

const formatMoney = (value: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${Math.max(1, minutes)}m`;
};

const defaultOutputName = (title: string): string => `${title || 'readme'}.mp3`;

const keySourceLabels: Record<OpenAiKeySource, string> = {
  env: 'Environment',
  keychain: 'Keychain',
  dotenv: 'Local .env',
  missing: 'Missing'
};

const isOpenAiKeySource = (value: unknown): value is OpenAiKeySource =>
  value === 'env' || value === 'keychain' || value === 'dotenv' || value === 'missing';

const displayError = (error: unknown, fallback: string): string => {
  if (!(error instanceof Error)) {
    return fallback;
  }

  return error.message
    .replace(/^Error invoking remote method '[^']+': (?:(?:[A-Za-z][\w.]*Error|Error): )?/i, '')
    .replace(/\bsk-[A-Za-z0-9_-]{3,}\*{6,}[A-Za-z0-9_*.-]*/g, '[redacted-api-key]')
    .replace(/\bsk-[A-Za-z0-9_-]{4,}\b/g, '[redacted-api-key]');
};

const MainApp = (): ReactElement => {
  const [sourceMode, setSourceMode] = useState<'text' | 'url'>('text');
  const [sourceText, setSourceText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceDocument, setSourceDocument] = useState<SourceDocument | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState('openai-natural-marin');
  const [tone, setTone] = useState<TonePreset>('warm-lecturer');
  const [costCapUsd, setCostCapUsd] = useState(DEFAULT_COST_CAP_USD);
  const [sample, setSample] = useState<GeneratedSample | null>(null);
  const [generatedAudio, setGeneratedAudio] = useState<GeneratedNarrationAudio | null>(null);
  const [savedOutputPath, setSavedOutputPath] = useState('');
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [message, setMessage] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [hasOpenAiApiKey, setHasOpenAiApiKey] = useState(false);
  const [openAiKeySource, setOpenAiKeySource] = useState<OpenAiKeySource>('missing');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [lastManifestPath, setLastManifestPath] = useState('');
  const [showKeyPanel, setShowKeyPanel] = useState(false);

  const selectedVoice = useMemo(() => getVoiceOption(selectedVoiceId), [selectedVoiceId]);

  const applySettings = (settings: AppSettings): void => {
    setHasOpenAiApiKey(Boolean(settings.hasOpenAiApiKey));
    setOpenAiKeySource(isOpenAiKeySource(settings.openAiKeySource) ? settings.openAiKeySource : 'missing');
    if (typeof settings.defaultVoiceId === 'string') {
      setSelectedVoiceId(settings.defaultVoiceId);
    }
    if (typeof settings.defaultCostCapUsd === 'number') {
      setCostCapUsd(settings.defaultCostCapUsd);
    }
  };

  useEffect(() => {
    void window.longread?.getSettings().then(applySettings);
    const removeProgressListener = window.longread?.onJobProgress((nextProgress) => {
      setProgress(nextProgress);
      setLastManifestPath(nextProgress.manifestPath);
      setMessage(nextProgress.currentMessage);
      if (nextProgress.status === 'complete' || nextProgress.status === 'failed' || nextProgress.status === 'cancelled') {
        setIsBusy(false);
      }
    });

    return () => {
      removeProgressListener?.();
    };
  }, []);

  useEffect(() => {
    const defaultTone = selectedVoice.defaultTone;
    setTone(defaultTone);
    setSample(null);
    setGeneratedAudio(null);
    setSavedOutputPath('');
    setLastManifestPath('');
    setProgress(null);
  }, [selectedVoice.defaultTone, selectedVoiceId]);

  useEffect(() => {
    const trimmedText = sourceText.trim();
    setSourceDocument((currentDocument) => {
      const previousTitle = currentDocument?.title || 'Pasted Text';
      const previousUrl = currentDocument?.sourceUrl || '';
      const nextDocument = trimmedText.length ? makeSourceDocumentFromText(sourceText, previousTitle) : null;

      return nextDocument ? { ...nextDocument, sourceUrl: previousUrl } : null;
    });
    setSample(null);
  }, [sourceText]);

  const estimate = useMemo(() => {
    if (!sourceDocument) {
      return null;
    }
    const chunkCount = Math.max(
      1,
      Math.ceil(sourceDocument.characterCount / Math.min(DEFAULT_TARGET_CHARS, selectedVoice.maxChunkCharacters))
    );
    return buildCostEstimate(
      sourceDocument.characterCount,
      sourceDocument.wordCount,
      chunkCount,
      selectedVoice,
      costCapUsd
    );
  }, [costCapUsd, selectedVoice, sourceDocument]);

  const canUseOpenAi = selectedVoice.providerId !== 'openai' || hasOpenAiApiKey;
  const canGenerate = Boolean(sourceDocument && estimate && !estimate.capExceeded && canUseOpenAi && !isBusy);
  const progressPercent = progress && progress.totalChunks > 0
    ? Math.round((progress.completedChunks / progress.totalChunks) * 100)
    : 0;
  const canResume = Boolean(
    lastManifestPath &&
    !isBusy &&
    (progress?.status === 'failed' || progress?.status === 'cancelled')
  );

  const extractUrl = async (): Promise<void> => {
    if (!sourceUrl.trim() || !window.longread) {
      return;
    }
    setIsBusy(true);
    setMessage('Extracting readable text');
    try {
      const extracted = await window.longread.extractUrl(sourceUrl.trim());
      setSourceDocument(extracted);
      setSourceText(extracted.text);
      setSample(null);
      setGeneratedAudio(null);
      setSavedOutputPath('');
      setLastManifestPath('');
      setProgress(null);
      setMessage('URL extracted');
    } catch (error) {
      setMessage(displayError(error, 'URL extraction failed'));
    } finally {
      setIsBusy(false);
    }
  };

  const generateSample = async (): Promise<void> => {
    if (!window.longread || !sourceDocument || !estimate || estimate.capExceeded) {
      return;
    }
    setIsBusy(true);
    setMessage('Generating voice preview');
    try {
      const nextSample = await window.longread.generateSample({
        source: sourceDocument,
        providerId: selectedVoice.providerId,
        voiceId: selectedVoiceId,
        tone,
        costCapUsd
      });
      setSample(nextSample);
      setMessage(`Voice preview ready (${nextSample.characterCount.toLocaleString()} chars)`);
    } catch (error) {
      setMessage(displayError(error, 'Voice preview failed'));
    } finally {
      setIsBusy(false);
    }
  };

  const buildRequest = (pathOverride?: string): NarrationJobRequest | null => {
    if (!sourceDocument) {
      return null;
    }
    return {
      source: sourceDocument,
      providerId: selectedVoice.providerId,
      voiceId: selectedVoiceId,
      tone,
      ...(pathOverride ? { outputPath: pathOverride } : {}),
      costCapUsd,
      keepChunkFiles: false
    };
  };

  const generateMp3 = async (): Promise<void> => {
    if (!window.longread || !sourceDocument) {
      return;
    }
    const request = buildRequest();
    if (!request) {
      return;
    }
    setIsBusy(true);
    setSample(null);
    setGeneratedAudio(null);
    setSavedOutputPath('');
    setMessage('Generating audio');
    try {
      const result = await window.longread.startJob(request);
      if ('audioUrl' in result) {
        setGeneratedAudio(result);
        setLastManifestPath(result.manifestPath);
        setMessage('Audio ready. Press play if it does not start automatically.');
      } else {
        setIsBusy(false);
        setMessage('Generation cancelled');
      }
    } catch (error) {
      setIsBusy(false);
      setMessage(displayError(error, 'Generation failed'));
    }
  };

  const resumeJob = async (): Promise<void> => {
    if (!window.longread || !lastManifestPath) {
      return;
    }
    const request = buildRequest(generatedAudio?.outputPath);
    if (!request) {
      return;
    }
    setIsBusy(true);
    setMessage('Resuming saved job');
    try {
      const result = await window.longread.resumeJob(request, lastManifestPath);
      if ('audioUrl' in result) {
        setGeneratedAudio(result);
        setLastManifestPath(result.manifestPath);
        setMessage('Audio ready. Press play if it does not start automatically.');
      } else {
        setIsBusy(false);
        setMessage('Resume cancelled');
      }
    } catch (error) {
      setIsBusy(false);
      setMessage(displayError(error, 'Resume failed'));
    }
  };

  const saveGeneratedAudio = async (): Promise<void> => {
    if (!window.longread || !generatedAudio) {
      return;
    }

    setMessage('Saving MP3');
    try {
      const savedPath = await window.longread.saveAudioCopy(
        generatedAudio.outputPath,
        defaultOutputName(sourceDocument?.title || 'readme')
      );
      if (savedPath) {
        setSavedOutputPath(savedPath);
        setMessage('MP3 saved');
      } else {
        setMessage('Save cancelled');
      }
    } catch (error) {
      setMessage(displayError(error, 'Could not save MP3'));
    }
  };

  const cancelJob = async (): Promise<void> => {
    if (progress?.jobId) {
      await window.longread?.cancelJob(progress.jobId);
      setMessage('Cancel requested');
    }
  };

  const saveOpenAiApiKey = async (): Promise<void> => {
    if (!window.longread || !apiKeyInput.trim()) {
      return;
    }
    setSettingsMessage('Saving key');
    try {
      const settings = await window.longread.saveOpenAiApiKey(apiKeyInput);
      applySettings(settings);
      setApiKeyInput('');
      setSettingsMessage('OpenAI key saved. Checking with OpenAI...');
      const validation = await window.longread.validateOpenAiApiKey();
      setSettingsMessage(validation.message);
    } catch (error) {
      setSettingsMessage(displayError(error, 'Could not save OpenAI key'));
    }
  };

  const validateOpenAiSavedKey = async (): Promise<void> => {
    if (!window.longread) {
      return;
    }
    setSettingsMessage('Checking saved key with OpenAI');
    try {
      const validation = await window.longread.validateOpenAiApiKey();
      setSettingsMessage(validation.message);
    } catch (error) {
      setSettingsMessage(displayError(error, 'Could not validate OpenAI key'));
    }
  };

  const clearOpenAiApiKey = async (): Promise<void> => {
    if (!window.longread) {
      return;
    }
    setSettingsMessage('Clearing saved key');
    try {
      const settings = await window.longread.clearOpenAiApiKey();
      applySettings(settings);
      setSettingsMessage(settings.hasOpenAiApiKey ? 'Saved key cleared; another key source is active' : 'Saved key cleared');
    } catch (error) {
      setSettingsMessage(displayError(error, 'Could not clear saved key'));
    }
  };

  const keyPanel = (
    <div className="key-panel">
      <div className="api-key-row">
        <input
          aria-label="OpenAI API key"
          type="password"
          value={apiKeyInput}
          onChange={(event) => setApiKeyInput(event.target.value)}
          placeholder="Paste key to save in Keychain"
          autoComplete="off"
        />
        <button type="button" onClick={saveOpenAiApiKey} disabled={!apiKeyInput.trim()}>
          Save
        </button>
      </div>
      <div className="button-row settings-actions">
        <button type="button" onClick={clearOpenAiApiKey}>
          Clear Saved Key
        </button>
        <button type="button" onClick={validateOpenAiSavedKey} disabled={!hasOpenAiApiKey}>
          Check Key
        </button>
        <span className={hasOpenAiApiKey ? 'status-text ok' : 'status-text'}>
          {hasOpenAiApiKey ? keySourceLabels[openAiKeySource] : 'Missing'}
        </span>
      </div>
      {settingsMessage && <p className="muted">{settingsMessage}</p>}
    </div>
  );

  return (
    <main className="app-shell">
      <section className="document-pane">
        <header className="toolbar">
          <p className="wordmark">readme</p>
          <div className="segmented" role="tablist" aria-label="Source mode">
            <button className={sourceMode === 'text' ? 'active' : ''} type="button" onClick={() => setSourceMode('text')}>
              Paste Text
            </button>
            <button className={sourceMode === 'url' ? 'active' : ''} type="button" onClick={() => setSourceMode('url')}>
              From URL
            </button>
          </div>
        </header>

        {sourceMode === 'url' && (
          <div className="url-row">
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://example.com/long-article"
              aria-label="Public URL"
            />
            <button type="button" onClick={extractUrl} disabled={isBusy || !sourceUrl.trim()}>
              Extract
            </button>
          </div>
        )}

        <textarea
          aria-label="Source text"
          value={sourceText}
          onChange={(event) => setSourceText(event.target.value)}
          placeholder="Paste the essay, letter, sermon, whitepaper, or public-domain chapter here."
        />

        {sourceDocument && (
          <div className="doc-meta">
            {sourceDocument.title} · {sourceDocument.wordCount.toLocaleString()} words
            {estimate && ` · ~${formatDuration(estimate.estimatedListeningSeconds)} listen`}
            {sourceDocument.sourceUrl && ` · ${new URL(sourceDocument.sourceUrl).host}`}
          </div>
        )}
      </section>

      <aside className="control-pane">
        {!hasOpenAiApiKey && keyPanel}

        <div className="rail-section">
          <label className="rail-label" htmlFor="voice-select">Voice</label>
          <div className="voice-row">
            <select id="voice-select" value={selectedVoiceId} onChange={(event) => setSelectedVoiceId(event.target.value)}>
              {openAiVoiceGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.voices.map((voice) => (
                    <option key={voice.id} value={voice.id}>{voice.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              className="icon-button"
              type="button"
              aria-label="Preview voice"
              onClick={generateSample}
              disabled={!sourceDocument || !estimate || estimate.capExceeded || !canUseOpenAi || isBusy}
            >
              ▶
            </button>
          </div>
          {sample && <audio className="voice-preview-audio" controls src={sample.sampleUrl} />}
        </div>

        <div className="rail-section">
          <label className="rail-label" htmlFor="tone-select">Tone</label>
          <select
            id="tone-select"
            value={tone}
            onChange={(event) => {
              setTone(event.target.value as TonePreset);
              setSample(null);
              setGeneratedAudio(null);
              setSavedOutputPath('');
              setLastManifestPath('');
              setProgress(null);
            }}
          >
            {TONE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="rail-section">
          <label className="rail-label" htmlFor="cost-cap-input">Cost cap</label>
          <input
            id="cost-cap-input"
            type="number"
            min="0"
            step="0.25"
            value={costCapUsd}
            onChange={(event) => setCostCapUsd(Number(event.target.value))}
          />
        </div>

        <hr className="rail-divider" />

        <div className="estimate-block">
          <p className="rail-label">Estimated cost</p>
          {estimate ? (
            <>
              <p className="estimate-cost">{formatMoney(estimate.estimatedCostUsd)}</p>
              <p className={estimate.capExceeded ? 'estimate-sub danger' : 'estimate-sub'}>
                ~{formatDuration(estimate.estimatedListeningSeconds)} · {estimate.chunkCount} {estimate.chunkCount === 1 ? 'chunk' : 'chunks'} · {estimate.capExceeded ? 'over cap' : 'under cap'}
              </p>
              <p className="estimate-note">{estimate.pricingNote}</p>
              {estimate.capExceeded && <p className="estimate-warning">Raise the cost cap or shorten the text.</p>}
            </>
          ) : (
            <p className="estimate-empty">Paste text or extract a public URL to estimate the job.</p>
          )}
        </div>

        <div className="action-slot">
          {generatedAudio ? (
            <div className="result-card">
              <audio controls autoPlay src={generatedAudio.audioUrl} />
              <div className="button-row">
                <button type="button" onClick={saveGeneratedAudio}>
                  Save MP3
                </button>
                <button type="button" onClick={() => window.longread?.openOutputFile(savedOutputPath || generatedAudio.outputPath)}>
                  Open Audio
                </button>
                <button type="button" onClick={() => window.longread?.revealOutput(savedOutputPath || generatedAudio.outputPath)}>
                  Show File
                </button>
              </div>
            </div>
          ) : isBusy ? (
            <>
              <div className="progress-track">
                <div style={{ width: `${progressPercent}%` }} />
              </div>
              {progress && (
                <p className="progress-status">
                  {message} · {progress.generatedCharacters.toLocaleString()} generated chars
                </p>
              )}
              <button type="button" onClick={cancelJob} disabled={!progress?.jobId}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button className="primary" type="button" onClick={generateMp3} disabled={!canGenerate}>
                Generate Audio
              </button>
              {canResume && (
                <button type="button" onClick={resumeJob}>
                  Resume
                </button>
              )}
              {message && message !== 'Ready' && <p className="muted">{message}</p>}
            </>
          )}
        </div>

        <div className="key-line">
          <span className={hasOpenAiApiKey ? 'key-dot ok' : 'key-dot'} aria-hidden="true" />
          <button className="key-line-label" type="button" onClick={() => setShowKeyPanel((current) => !current)}>
            {hasOpenAiApiKey ? `OpenAI key · ${keySourceLabels[openAiKeySource]}` : 'OpenAI key missing'}
          </button>
          {hasOpenAiApiKey && (
            <button className="key-gear" type="button" aria-label="OpenAI key settings" onClick={() => setShowKeyPanel((current) => !current)}>
              ⚙
            </button>
          )}
        </div>
        {hasOpenAiApiKey && showKeyPanel && keyPanel}
      </aside>
    </main>
  );
};

const App = (): ReactElement => {
  return <MainApp />;
};

export default App;
