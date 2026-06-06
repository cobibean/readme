# readme Research

Last updated: 2026-05-25.

## Research Summary

The app should not use the default macOS system voices. The strongest product path is a provider adapter layer with a cost estimate before generation, then a default preset that favors "good enough to actually listen to" over the absolute cheapest robotic option.

For a real long document like the Vatican example, a quick extraction estimate is about 268,758 characters and 42,987 words. AWS says 1 million characters is roughly 23 hours and 8 minutes of speech in its pricing examples, so this document is roughly 6.2 listening hours.

## Provider Shortlist

| Provider | Best Fit | Current Published Price | Example Cost For 268,758 Chars | Output | Notes |
| --- | --- | ---: | ---: | --- | --- |
| Google Cloud WaveNet | Cheapest non-system budget mode | $4 / 1M chars | $1.08 | MP3 supported | Low cost, better than standard TTS, but not the most expressive. |
| AWS Polly Neural | Default low-risk MVP adapter | $16 / 1M chars | $4.30 | MP3 supported | Mature SDK, direct MP3, good reliability, free tier for new accounts. |
| OpenAI `gpt-4o-mini-tts` | Best voice quality for simple setup | Published platform pricing has recently shown TTS around $15 / 1M chars; verify in account before shipping | about $4.03 if $15 / 1M | MP3 by default | Strong voices and instruction control. Good candidate for default if pricing remains near AWS Neural. |
| Google Cloud Neural2 | Alternative AWS Neural equivalent | $16 / 1M chars | $4.30 | MP3 supported | Good general-purpose voices, but Google auth setup is heavier. |
| Google Cloud Chirp 3 HD | Premium-but-still-under-$10 for this use case | $30 / 1M chars | $8.06 | MP3 supported | More natural and expressive. Good "quality" preset. |
| AWS Polly Generative | Premium-but-still-under-$10 for this use case | $30 / 1M chars | $8.06 | MP3 supported | More human-like than Neural, but region/voice availability matters. |
| Groq Orpheus | Not recommended for long documents | $22 / 1M chars | $5.91 | WAV only in Orpheus docs | 200-character input cap makes this awkward for 60-page documents. |
| Deepgram Aura-1 | Alternative OpenAI-ish price | $15 / 1M chars | $4.03 | API TTS | Built for low latency voice apps; less obvious advantage for long MP3 exports. |
| Deepgram Aura-2 | Premium voice-app adapter | $30 / 1M chars | $8.06 | API TTS | Competitive, but not cheaper than Google/AWS premium modes. |
| xAI TTS | Possible future adapter | $15 / 1M chars | $4.03 | MP3/WAV/PCM/etc. | Official docs list $15 / 1M chars. Not the ultra-cheap $4.20/M number mentioned in some articles. |

## Recommended Provider Strategy

Default v1 should ship with two adapters:

1. OpenAI `gpt-4o-mini-tts` for "Natural" if account pricing confirms the expected ~$15 / 1M character range.
2. AWS Polly Neural for "Reliable" because it has mature SDKs, direct MP3 output, and predictable character-based pricing.

Add Google Cloud WaveNet as a "Budget" adapter if initial voice tests are acceptable. It is the cheapest official cloud option in this research, but quality needs a listening test before making it the default.

Groq should remain a later adapter. Speakeasy already uses Groq, but Groq's current documented Orpheus limits are a poor fit for long-form narration, and the PlayAI model page recommends keeping input under 10K characters without clearly surfacing pricing in the public pricing table.

## Cost Guardrails

The app must show an estimate before starting a job:

- Character count used for billing.
- Estimated listening time.
- Estimated provider cost.
- Number of chunks.
- A warning if the estimate is over $10.

The app should default to a stop-after budget of $10 per job. Users can raise it, but the default keeps the product promise aligned with "I do not want to spend ten dollars instead of reading."

## Quality Guardrails

Every long generation should begin with a 30-60 second voice sample from the first 700-1,200 characters. The user can approve the voice before paying to generate the whole document.

The app should support these tone presets without rewriting source text:

- Calm narrator
- Warm lecturer
- Formal reading
- Brisk skim

Tone presets should pass provider-specific instructions or SSML where supported. They must not summarize, paraphrase, or reorder source text.

## Sources

- Groq Text to Speech docs: https://console.groq.com/docs/text-to-speech
- Groq Orpheus docs and pricing: https://console.groq.com/docs/text-to-speech/orpheus
- Groq pricing: https://groq.com/pricing
- Groq PlayAI model guidance: https://console.groq.com/docs/model/playai-tts
- OpenAI speech generation docs: https://platform.openai.com/docs/guides/text-to-speech
- OpenAI pricing: https://platform.openai.com/docs/pricing
- AWS Polly pricing: https://aws.amazon.com/polly/pricing/
- AWS Polly generative voices: https://docs.aws.amazon.com/polly/latest/dg/generative-voices.html
- AWS Polly quotas: https://docs.aws.amazon.com/polly/latest/dg/limits.html
- Google Cloud Text-to-Speech pricing: https://cloud.google.com/text-to-speech/pricing
- Google Cloud voice types: https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types
- Deepgram pricing: https://deepgram.com/pricing
- xAI Text to Speech docs: https://docs.x.ai/developers/models/text-to-speech
- Microsoft text-to-speech overview and billing note: https://learn.microsoft.com/en-us/azure/ai-services/Speech-Service/text-to-speech
