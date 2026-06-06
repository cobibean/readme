const { contextBridge, ipcRenderer } = require('electron');

const IPC_CHANNELS = {
  SETTINGS_GET: 'settings:get',
  SETTINGS_OPENAI_KEY_SAVE: 'settings:openai-key-save',
  SETTINGS_OPENAI_KEY_CLEAR: 'settings:openai-key-clear',
  SETTINGS_OPENAI_KEY_VALIDATE: 'settings:openai-key-validate',
  SOURCE_EXTRACT_URL: 'source:extract-url',
  JOB_ESTIMATE: 'job:estimate',
  JOB_GENERATE_SAMPLE: 'job:generate-sample',
  JOB_START: 'job:start',
  JOB_CANCEL: 'job:cancel',
  JOB_RESUME: 'job:resume',
  JOB_PROGRESS: 'job:progress',
  OUTPUT_PICK_FILE: 'output:pick-file',
  OUTPUT_SAVE_COPY: 'output:save-copy',
  OUTPUT_OPEN_FILE: 'output:open-file',
  OUTPUT_REVEAL: 'output:reveal'
};

type Cleanup = () => void;

contextBridge.exposeInMainWorld('longread', {
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  saveOpenAiApiKey: (apiKey: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_OPENAI_KEY_SAVE, apiKey),
  clearOpenAiApiKey: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_OPENAI_KEY_CLEAR),
  validateOpenAiApiKey: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_OPENAI_KEY_VALIDATE),
  extractUrl: (sourceUrl: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SOURCE_EXTRACT_URL, sourceUrl),
  estimateJob: (request: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.JOB_ESTIMATE, request),
  generateSample: (request: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.JOB_GENERATE_SAMPLE, request),
  startJob: (request: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.JOB_START, request),
  cancelJob: (jobId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.JOB_CANCEL, jobId),
  resumeJob: (request: unknown, manifestPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.JOB_RESUME, request, manifestPath),
  pickOutputFile: (defaultName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OUTPUT_PICK_FILE, defaultName),
  saveAudioCopy: (sourcePath: string, defaultName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OUTPUT_SAVE_COPY, sourcePath, defaultName),
  openOutputFile: (outputPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OUTPUT_OPEN_FILE, outputPath),
  revealOutput: (outputPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OUTPUT_REVEAL, outputPath),
  onJobProgress: (callback: (progress: unknown) => void): Cleanup => {
    const listener = (_event: unknown, progress: unknown) => callback(progress);
    ipcRenderer.on(IPC_CHANNELS.JOB_PROGRESS, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.JOB_PROGRESS, listener);
  }
});
