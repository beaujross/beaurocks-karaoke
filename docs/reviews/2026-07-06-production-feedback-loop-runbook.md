# Production Feedback Loop Runbook

Date: 2026-07-06

## Purpose

Use each real event to improve YouTube quota efficiency, backing-track quality, Apple Music background reliability, and host simplicity.

This runbook is ready to use after the next high-usage karaoke event.

## Pre-Event Checklist

- Confirm production app loads.
- Confirm host can open the room.
- Confirm BG starts and stops from the shared BG control.
- Confirm Apple Music is connected if the host plans to use Apple background.
- Confirm selected Apple BG playlist appears in Media Setup.
- Confirm YouTube search is available.
- Confirm direct YouTube URL paste is available.
- Confirm legal URLs are live:
  - `https://beaurocks.app/karaoke/terms`
  - `https://beaurocks.app/karaoke/privacy`
  - `https://beaurocks.app/karaoke/data-deletion`
- Capture Google Cloud YouTube Data API quota page before the event.

## During-Event Operating Notes

- Use BG as the only background start/stop control.
- Use `Use for BG` only to choose the Apple playlist.
- Use YouTube karaoke-focused search first for performance backings.
- Switch to broader embeddable YouTube search only when karaoke-focused search is too narrow.
- Paste a YouTube URL when the host already knows the right backing.
- Mark obvious good or bad tracks when it does not slow the room down.
- Do not require host feedback on every performance.

## Post-Event Data To Pull

### YouTube Usage

- live YouTube search count
- live search quota/cooldown incidents
- indexed YouTube matches reused
- curated/global/account matches reused
- canonical known backings shown
- canonical known backings accepted
- direct YouTube URLs pasted
- non-embeddable results blocked
- stale IDs refreshed with `videos.list`
- nightly backfilled canonical candidates

### Backing Quality

- performances with YouTube karaoke backing
- performances with Apple full-song fallback
- performances with custom/local backing
- host good-track signals
- host bad-track signals
- completed performances
- skipped performances
- singer overrides
- candidates promoted from feedback
- candidates demoted from feedback

### Apple Music Background

- Apple connection success or failure
- selected BG playlist ID/title
- BG start/stop events
- Play Now events
- fallback to built-in BG tracks
- TV Apple background display correctness

### Host UX Friction

- moments where the host changed YouTube search mode
- moments where the host pasted a YouTube URL
- repeated failed searches
- known backing suggestions that needed correction
- dead/disabled controls noticed during the show
- places where labels required explanation

## Recap Output Template

Create a post-event recap with these sections:

### Event Media Summary

- event date:
- room code/name:
- total performances:
- YouTube-backed performances:
- Apple full-song/fallback performances:
- local/custom-backed performances:
- background source used:
- Apple playlist used:

### YouTube Quota Summary

- live searches:
- indexed/cache/canonical reuse:
- known-ID refreshes:
- quota/cooldown incidents:
- direct URL adds:
- non-embeddable blocks:
- recommended quota reserve change:

### Catalog Learning Summary

- new canonical songs touched:
- new backing candidates:
- candidates promoted:
- candidates demoted:
- candidates blocked:
- top reusable known backings:

### UX Friction Summary

- controls that caused hesitation:
- copy that was unclear:
- flows that took too many clicks:
- controls that should be removed or merged:
- host-facing improvements for next slice:

## Decision Rules After Review

- If the same song is searched repeatedly, prioritize cache/index/canonical reuse work.
- If known backings are accepted, increase confidence in ranking.
- If known backings are rejected, inspect whether title intent, duration fit, or source trust is wrong.
- If hosts paste URLs often, keep paste path prominent and fast.
- If hosts use broad YouTube search often, make the toggle easier to reach but do not make it the default.
- If Apple BG works reliably, keep it as setup-owned and BG-controlled.
- If Apple BG causes runtime confusion, remove copy or controls before adding new features.

## Definition Of Done

After each major event:

- event media recap is written
- YouTube quota recap is written
- canonical backing candidates are reviewed
- obvious bad candidates are demoted or blocked
- one small host-simplicity improvement is identified
- YouTube quota-extension evidence packet is updated if new evidence is useful
