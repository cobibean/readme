export const IPC_CHANNELS = {
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
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
