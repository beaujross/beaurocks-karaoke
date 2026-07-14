# Controlled YouTube Cooldown Evidence

Captured: 2026-07-13
Production release: `3098b4aa26e1003d`
Artifact: `quota-exhaustion-fallback.png`
SHA-256: `3DB758F6D3FFC8FC7CD44C01694B808F940C22FB4A777B66A46DB2D6068A289D`

## Method

The authenticated production Admin smoke used an isolated browser context and seeded the same 15-minute local cooldown key written by the real quota-error path: `bross_youtube_quota_block_until_ms_v1`.

This controlled state did not call, consume, or deliberately exhaust the live YouTube API quota. The context was destroyed after the run, so it did not alter the QA account, room, server cache, or Google Cloud quota state.

## Assertions passed

- overall state: `Fallback Ready`;
- live YouTube search is explicitly paused;
- 115 known embeddable tracks remain available;
- 14 content-agnostic fallbacks remain available;
- the Host is directed to known tracks and direct validated URLs;
- the text identifies the estimate as browser-local and Google Cloud Quotas as the source of truth;
- normal Back, Chat, and Approvals navigation continues after the capture.

This is controlled production behavior evidence, not evidence that Google reported an exhausted bucket at the time of capture.
