# AI Feature Matrix

## Purpose
Keep product, marketing, and onboarding language aligned on current AI features and the outcomes they enable.

## Live AI Features
| Feature | Primary Surface | What It Does | Outcome |
|---|---|---|---|
| Lyrics Recovery | Host queue + backend automation | Fills missing lyrics via catalog/Apple/AI fallback | Fewer dead moments, smoother singer handoff |
| Pop Trivia Companion | TV + Singer during performances | Generates song-adjacent trivia rounds | Non-singers stay active while karaoke continues |
| AI Prompt Tools | Host game setup | Generates selfie prompts, bingo boards, trivia/WYR bank items | Faster prep and fresher repeat nights |

## Messaging Rules
- Keep karaoke as the first noun in AI copy.
- Describe AI as assistive, not autonomous.
- Tie every AI capability to one host pain point and one crowd outcome.
- Mention usage controls whenever pricing is referenced.

## Normalization Opportunities
1. Canonical AI type names:
- Maintain a single list of allowed `type` values shared by frontend and callable prompts.
- Keep aliases only for backwards compatibility.

2. Unified result schema:
- Standardize `geminiGenerate` outputs by `type` (array vs object handling).
- Validate and normalize each type server-side before returning.

3. Single lyrics enrichment path:
- Ensure queue insertions rely on one backend lyrics pipeline to avoid duplicate generation.
- Keep local/manual generation as explicit host action only.

4. Shared telemetry envelope:
- Record `aiType`, `model`, `tokens`, `estimatedCostUsd`, and `sourceSurface` uniformly.
- Use this for product analytics, billing transparency, and marketing proof points.
