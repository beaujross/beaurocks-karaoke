# Demo Surface Integration Notes

Last updated: 2026-03-13

## Overview
- `/demo` now has two distinct layers:
  - `abstract demo`: a scroll-led conceptual story showing how host, TV, audience, and singer influence each other.
  - `guided walkthrough`: an on-rails simulated product demo with preset scenes.
- The page is now intended to function as a stable sales surface, not a live product sandbox.

## Current Contract
- The core `/demo` experience is self-contained inside the marketing page.
- It does not rely on embedded host, TV, or audience iframes for the main walkthrough.
- It does not require demo-room creation or continuous Firestore / callable writes to tell the story.
- The walkthrough auto-plays locally and loops through preset scenes.

## Demo Sections
- `abstract demo`
  - visually simplified on purpose
  - should feel like motion design, not a literal app capture
  - emphasizes signal flow between host, TV, audience, and singer
- `guided walkthrough`
  - auto-plays scripted scenes
  - uses simulated typing, taps, control highlights, and handoff states
  - should be understandable without user input

## Walkthrough Scene Goals
- Show a fast join + identity moment.
- Show visible host search / cueing into karaoke.
- Show audience reactions feeding the room.
- Show a host-triggered Guitar Vibe Sync mode shift.
- Show a between-song engagement beat.
- Show Auto DJ / queue handoff continuity.

## Product Positioning
- `/demo` is meant to explain and sell the system.
- It is not the canonical place to inspect live host / TV / audience runtime behavior.
- If a future need emerges for an internal live sandbox, keep that as a separate surface from the sales walkthrough.

## Troubleshooting
- Symptom: `/demo` feels too much like the real app.
  - Reduce UI fidelity in the abstract demo and keep the walkthrough clearly simulated.
- Symptom: viewers lose track of what changed.
  - Make host action, TV result, audience response, and singer impact readable in each scene.
- Symptom: the page starts depending on backend writes again.
  - Treat that as a regression against the current sales-demo contract.
