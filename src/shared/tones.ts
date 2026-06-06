interface ToneOption {
  id: string;
  label: string;
  instructions: string;
  speed: number;
}

const exactTextGuard =
  'Read the supplied text exactly as written. Do not summarize, paraphrase, reorder, skip, or add words.';

export const TONE_OPTIONS = [
  {
    id: 'calm-narrator',
    label: 'Calm narrator',
    speed: 0.96,
    instructions: `${exactTextGuard} Use a calm, steady audiobook narration style with relaxed pacing and clear articulation.`
  },
  {
    id: 'warm-lecturer',
    label: 'Warm lecturer',
    speed: 1,
    instructions: `${exactTextGuard} Sound warm, conversational, and thoughtful, like a lecturer guiding a small seminar.`
  },
  {
    id: 'formal-reading',
    label: 'Formal reading',
    speed: 0.96,
    instructions: `${exactTextGuard} Use a formal, respectful, measured cadence suitable for letters, essays, and official documents.`
  },
  {
    id: 'brisk-skim',
    label: 'Brisk skim',
    speed: 1.12,
    instructions: `${exactTextGuard} Read a little faster than normal while keeping articulation crisp and easy to follow.`
  },
  {
    id: 'documentary',
    label: 'Documentary',
    speed: 0.98,
    instructions: `${exactTextGuard} Use an observant documentary narration style with quiet authority and natural emphasis.`
  },
  {
    id: 'news-reader',
    label: 'News reader',
    speed: 1.06,
    instructions: `${exactTextGuard} Use a clear, neutral news-reader cadence with confident pacing and minimal dramatization.`
  },
  {
    id: 'storyteller',
    label: 'Storyteller',
    speed: 0.96,
    instructions: `${exactTextGuard} Sound vivid and engaged, with gentle variation in emphasis while staying grounded and untheatrical.`
  },
  {
    id: 'bedtime-reading',
    label: 'Bedtime reading',
    speed: 0.9,
    instructions: `${exactTextGuard} Use a soft, slow, reassuring reading style that remains intelligible and avoids whispering.`
  },
  {
    id: 'gentle-explainer',
    label: 'Gentle explainer',
    speed: 0.98,
    instructions: `${exactTextGuard} Sound patient and clear, emphasizing transitions and definitions without sounding childish.`
  },
  {
    id: 'academic-lecture',
    label: 'Academic lecture',
    speed: 0.96,
    instructions: `${exactTextGuard} Use a precise, composed lecture style with careful phrasing for dense arguments and citations.`
  },
  {
    id: 'reflective-essay',
    label: 'Reflective essay',
    speed: 0.94,
    instructions: `${exactTextGuard} Use a thoughtful, intimate essay-reading tone with natural pauses after reflective sentences.`
  },
  {
    id: 'clear-instructional',
    label: 'Clear instructional',
    speed: 1.02,
    instructions: `${exactTextGuard} Sound direct, practical, and easy to follow, with clean emphasis on steps and important details.`
  }
] as const satisfies readonly ToneOption[];

export type TonePreset = (typeof TONE_OPTIONS)[number]['id'];

export const getToneOption = (tone: TonePreset): ToneOption => {
  const option = TONE_OPTIONS.find((candidate) => candidate.id === tone);
  if (!option) {
    throw new Error(`Unknown tone: ${tone}`);
  }
  return option;
};
