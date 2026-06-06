# readme PRD

## Product Summary

readme is a local-first macOS app that turns pasted text or a public URL into a saved MP3 using affordable AI voices. It is for people who want to listen to a long article, letter, essay, whitepaper, sermon, or public-domain book while walking, driving, cleaning, or working away from the screen.

The product is intentionally not a dictation app, not a podcast studio, and not a hosted account platform. It should feel like a clean utility: paste, estimate, optionally preview the voice, generate playable audio, then save only if wanted.

## Why Separate From Speakeasy

Speakeasy is narrow and fast: hold hotkey, speak, transcribe, optionally polish, paste. readme has a different rhythm and risk profile: text extraction, long-running jobs, chunking, narration voice choice, cost estimates, MP3 assembly, and resumable exports.

Keeping this separate protects Speakeasy's fragile macOS dictation and paste path while letting readme have the UI and job pipeline it needs.

## Target User

Primary user:

- A solo reader who wants to convert long text into a private MP3 without paying a subscription.
- Comfortable bringing their own API key if the app explains cost clearly.
- Wants better voices than macOS system speech, but does not want ElevenLabs-style pricing.

Example job:

- Convert a 60+ page public letter at roughly 268k characters into a single MP3.
- Expected cost should usually stay between $1 and $9 depending on voice tier.
- The app should warn before any job crosses $10.

## Jobs To Be Done

- When I find a long web page, I want to paste the URL and get a clean MP3, so I can listen away from my desk.
- When I paste a large document, I want the app to estimate cost before it starts, so I do not accidentally burn API spend.
- When I choose a voice, I want a short preview first, so I know the full export will not sound robotic.
- When a long job fails halfway through, I want to resume from completed chunks, so I do not pay twice.
- When the MP3 is done, I want to find it instantly and play it in any normal audio app.

## Goals

- Convert pasted text or public URL HTML into one playable in-app recording.
- Use good AI/cloud voices, not the default macOS voice.
- Keep typical long-document jobs under $10 by default.
- Show cost and duration estimates before generation.
- Let the user preview a voice before the full run.
- Save chunk audio and job metadata so failed jobs can resume.
- Preserve the original text's order and meaning.
- Avoid accounts, sync, history, and hosted storage in v1.

## Non-Goals

- No voice cloning in v1.
- No ElevenLabs adapter in v1.
- No podcast editing timeline.
- No transcript editing workflow beyond basic text cleanup before generation.
- No DRM bypassing or paywall extraction.
- No server-side backend.
- No mobile app.
- No Speakeasy integration beyond possible future reuse of visual design preferences.

## Core User Flow

1. User opens readme.
2. User chooses `Paste Text` or `From URL`.
3. App extracts readable text, shows title, character count, word count, estimated duration, and estimated cost.
4. User chooses provider preset:
   - Budget
   - Natural
   - Premium under $10
5. User chooses voice and tone.
6. User optionally clicks `Preview Voice`.
7. App creates a short voice preview and plays it inline.
8. User clicks `Generate Audio`.
9. App chunks text internally, generates chunk audio, writes a durable manifest, stitches one playable MP3, and shows it in the app.
10. User optionally saves the MP3 or opens the generated file.

## MVP Feature Requirements

### Input

- Paste raw text into a large editor.
- Paste a public URL and extract readable article content.
- Display detected title and source URL.
- Display character count, word count, estimated listening time, and estimated cost.

### Text Extraction

- Fetch public HTML from the main process, not renderer.
- Use Mozilla Readability with JSDOM for article extraction.
- Fall back to cleaned body text if Readability fails.
- Preserve headings and paragraph breaks.
- Strip scripts, nav, cookie banners, repeated footer text, and hidden UI content.
- Do not bypass paywalls or login-required pages.

### Text Preparation

- Normalize whitespace.
- Convert repeated blank lines into stable section boundaries.
- Remove footnote backlink clutter when obvious.
- Keep footnote content if it appears in the readable article body unless the user chooses `Skip footnotes`.
- Preserve punctuation because TTS uses it for cadence.
- Never summarize by default.

### Chunking

- Split by section, paragraph, sentence, then word as needed.
- Default target chunk size: 3,800 characters.
- Default hard chunk max: 4,000 characters for OpenAI-compatible requests.
- Provider adapters can override max chunk size.
- Never split inside a known abbreviation when a sentence boundary is available.
- Persist chunk checksums so regenerated jobs can skip already-completed chunks.
- Keep chunk counts and chunk IDs out of the normal user-facing UI.

### Voice And Provider

- The app must include a provider abstraction.
- MVP should implement OpenAI and AWS Polly first.
- The PRD-approved defaults:
  - `Natural`: OpenAI `gpt-4o-mini-tts`, voice `marin` or `cedar`, if pricing is confirmed near $15 / 1M characters.
  - `Reliable`: AWS Polly Neural, voice `Ruth` or `Stephen`.
  - `Budget`: Google WaveNet only after a listening test confirms it is acceptable.
- Groq should be documented as a later adapter because current Orpheus docs list a 200-character max input and WAV-only output.

### Cost Controls

- Estimate before any paid call.
- Require explicit confirmation for jobs estimated over $10.
- Default per-job cap: $10.
- Stop the job before starting a chunk that would exceed the cap.
- Show actual billed character total based on generated chunks.

### Voice Preview

- Generate voice preview from the first 700-1,200 narratable characters.
- Save preview separately from the final job.
- Let user regenerate the preview with another voice before running the full job.
- Keep preview optional; full audio generation is the primary action.

### Job Execution

- Main process owns all API calls and file writes.
- Renderer receives progress events only.
- Jobs are resumable from a local manifest.
- A cancel request stops after the current in-flight chunk completes or aborts if the provider supports abort signals.
- Completed chunk files are reused on resume.
- Failed chunks retry up to 3 times with exponential backoff and jitter.

### Output

- Generate one playable MP3 in app-managed storage first.
- Let the user save/export the MP3 afterward as an optional action.
- Default export filename derived from title and date.
- Also save a `.longread-job.json` manifest for the generated output.
- Keep internal chunk files hidden unless an explicit diagnostics/export mode is added later.

### Security And Privacy

- API keys are stored in the macOS Keychain where possible.
- Source text is sent only to the selected TTS provider.
- No remote telemetry in v1.
- Job manifests store metadata and checksums, not API keys.
- The app should show a short notice that users are responsible for rights to synthesize and save source text.

## UX Requirements

- The first screen is the working tool, not a marketing page.
- The UI should feel quiet and practical: document input on the left, job settings and estimate on the right, progress at the bottom.
- Avoid glossy dark Electron boilerplate styling.
- Use clear controls:
  - Provider segmented control.
  - Voice dropdown.
  - Tone dropdown.
  - Cost cap input.
  - Preview Voice button.
  - Generate Audio primary button.
  - Cancel and Resume buttons during jobs.
- The app should clearly label paid actions.
- The final completion state should show:
  - Inline audio player.
  - Total cost estimate.
  - Actual generated characters.
  - Duration estimate.
  - Save MP3, Open Audio, and Show File buttons.

## Acceptance Criteria

- Pasting 10k characters produces a playable MP3.
- Pasting the Vatican example URL extracts readable text and estimates around 268k billable characters.
- The same Vatican job estimates:
  - about $1.08 at $4 / 1M chars.
  - about $4.03 at $15 / 1M chars.
  - about $4.30 at $16 / 1M chars.
  - about $8.06 at $30 / 1M chars.
- Cancelling a job after several chunks leaves reusable chunk files and a manifest.
- Resuming the job skips completed chunks.
- A network failure retries the chunk and then marks the job recoverable.
- The final MP3 plays in QuickTime, Music, and Finder preview.
- No macOS system voice is used in the default presets.

## Open Product Decisions

- Final app name: `readme`.
- Whether Google Cloud WaveNet quality is acceptable as the `Budget` default.
- Whether OpenAI pricing remains close enough to AWS Neural to make it the default `Natural` provider.
- Whether chapterized output should be part of v1 or v1.1.
- Whether PDF import should be v1.1 or v2.
