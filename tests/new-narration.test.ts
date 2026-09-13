// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../src/renderer/App';
import { makeSourceDocumentFromText } from '../src/shared/text-normalize';
import type { GeneratedNarrationAudio, JobProgress } from '../src/shared/types';

let root: Root;
let container: HTMLDivElement;
let progress: (value: JobProgress) => void;
const button = (text: string): HTMLButtonElement =>
  [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text))!;
const click = async (text: string): Promise<void> => {
  await act(async () => button(text).click());
};
const change = async (element: HTMLInputElement | HTMLSelectElement, value: string): Promise<void> => {
  await act(async () => {
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
};

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  window.longread = {
    getSettings: vi.fn().mockResolvedValue({ hasOpenAiApiKey: true, openAiKeySource: 'keychain' }),
    onJobProgress: vi.fn((callback) => { progress = callback; return () => {}; }),
    extractUrl: vi.fn().mockResolvedValue({ ...makeSourceDocumentFromText('An article worth listening to.', 'Article'), sourceUrl: 'https://example.com/article' }),
    generateSample: vi.fn().mockResolvedValue({ sampleUrl: 'file:///sample.mp3', characterCount: 34 }),
    startJob: vi.fn().mockResolvedValue({ audioUrl: 'file:///audio.mp3', outputPath: '/audio.mp3', manifestPath: '/job.json' })
  } as unknown as NonNullable<Window['longread']>;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(App)));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete window.longread;
  vi.restoreAllMocks();
});

const extract = async (): Promise<void> => {
  await click('From URL');
  await change(container.querySelector('[aria-label="Public URL"]')!, 'https://example.com/article');
  await click('Extract');
};

it('clears URL, text, preview and narration while retaining settings and focusing the editor', async () => {
  await change(container.querySelector('#voice-select')!, 'openai-natural-cedar');
  await change(container.querySelector('#tone-select')!, 'calm-narrator');
  await change(container.querySelector('#cost-cap-input')!, '7');
  await extract();
  await click('Generate Audio');
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Preview voice"]')!.click());
  expect(container.querySelectorAll('audio')).toHaveLength(2);
  await click('New narration');
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(2);
  expect(container.querySelectorAll('audio')).toHaveLength(0);
  expect(container.querySelector('textarea')!.value).toBe('');
  expect(document.activeElement).toBe(container.querySelector('textarea'));
  expect(container.querySelector('.doc-meta')).toBeNull();
  expect(container.querySelector('.estimate-cost')).toBeNull();
  expect(button('Generate Audio').disabled).toBe(true);
  expect(container.querySelector<HTMLSelectElement>('#voice-select')!.value).toBe('openai-natural-cedar');
  expect(container.querySelector<HTMLSelectElement>('#tone-select')!.value).toBe('calm-narrator');
  expect(container.querySelector<HTMLInputElement>('#cost-cap-input')!.value).toBe('7');
  expect(container.textContent).toContain('OpenAI key · Keychain');
  await click('From URL');
  expect(container.querySelector<HTMLInputElement>('[aria-label="Public URL"]')!.value).toBe('');
});

it('waits for the generation response even after terminal progress, then clears resume state', async () => {
  await extract();
  let finish!: (value: GeneratedNarrationAudio | { status: 'cancelled' }) => void;
  vi.mocked(window.longread!.startJob).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  await click('Generate Audio');
  await act(async () => progress({ status: 'cancelled', jobId: 'old', manifestPath: '/job.json', currentMessage: 'Cancelled', completedChunks: 0, totalChunks: 1, generatedCharacters: 0 } as JobProgress));
  expect(button('New narration').disabled).toBe(true);
  await act(async () => finish({ status: 'cancelled' }));
  expect(button('Resume')).toBeDefined();
  await click('New narration');
  expect(button('Resume')).toBeUndefined();
  expect(container.textContent).not.toContain('Generation cancelled');
});
