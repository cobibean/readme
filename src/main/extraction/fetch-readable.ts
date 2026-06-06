import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { countWords, normalizeNarrationText } from '../../shared/text-normalize.js';
import type { SourceDocument } from '../../shared/types.js';

const removeClutter = (document: Document): void => {
  for (const element of document.querySelectorAll(
    [
      'script',
      'style',
      'noscript',
      'nav',
      'footer',
      'header',
      'form',
      'aside',
      '[aria-hidden="true"]',
      '[hidden]',
      '.cookie',
      '.cookies',
      '.cookie-banner',
      '.newsletter',
      '.subscribe',
      '.share',
      '.social'
    ].join(',')
  )) {
    element.remove();
  }
};

const fallbackBodyText = (html: string, sourceUrl: string): string => {
  const dom = new JSDOM(html, { url: sourceUrl });
  removeClutter(dom.window.document);
  const article = dom.window.document.querySelector('article, main');
  return article?.textContent ?? dom.window.document.body?.textContent ?? '';
};

export const extractReadableFromHtml = (html: string, sourceUrl: string): SourceDocument => {
  const dom = new JSDOM(html, { url: sourceUrl });
  removeClutter(dom.window.document);
  const parsed = new Readability(dom.window.document, { keepClasses: false }).parse();
  const title =
    parsed?.title?.trim() ||
    dom.window.document.querySelector('h1')?.textContent?.trim() ||
    dom.window.document.title.trim() ||
    'Untitled read';
  const rawText = parsed?.textContent?.trim() || fallbackBodyText(html, sourceUrl);
  const text = normalizeNarrationText(rawText);

  if (text.length < 120) {
    throw new Error('Could not extract enough readable text from this URL.');
  }

  return {
    title,
    sourceUrl,
    text,
    characterCount: text.length,
    wordCount: countWords(text)
  };
};

export const fetchReadableFromUrl = async (sourceUrl: string): Promise<SourceDocument> => {
  const url = new URL(sourceUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only public http and https URLs are supported.');
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'readme/0.1 public readable text extraction'
    },
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch URL: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    throw new Error('This URL did not return public HTML content.');
  }

  const html = await response.text();
  return extractReadableFromHtml(html, url.toString());
};
