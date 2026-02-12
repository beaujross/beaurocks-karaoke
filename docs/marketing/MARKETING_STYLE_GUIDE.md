# BeauRocks Marketing Style Guide

## Brand Intent
- Mood: energetic, inclusive, modern, celebration-first.
- Product frame: private-party event platform, not bar karaoke software.
- Voice: sharp and practical with selective hype.

## Design System
- Visual structure: chaptered sections with high-contrast transitions.
- Motion style: layered parallax, subtle depth, strong section reveals.
- Accessibility: keyboard-usable navigation, readable contrast, reduced-motion support.

## Token Reference
- File: `src/apps/Marketing/marketing.css`
- Token scope: `.marketing-site`
- Core variables:
- `--mk-bg-0`, `--mk-bg-1`, `--mk-bg-2`
- `--mk-text-strong`, `--mk-text-main`, `--mk-text-muted`
- `--mk-border`, `--mk-cyan`, `--mk-pink`, `--mk-gold`

## Typography
- Headline font: `Archivo Black` (fallback `Bebas Neue`).
- Body font: `Manrope` (fallback `Saira Condensed`).
- Keep headlines uppercase and short.
- Keep body copy sentence-case and clear.

## Layout Rules
- Main width: `min(1200px, 92vw)` via `.mk-container`.
- Use section rhythm (`.mk-section`) for scroll chapters.
- Prefer card clusters for feature sets and mode comparisons.

## CTA Hierarchy
- Primary CTA: `Join Early Access` / `Get In Line`.
- Secondary CTA: section explainer actions (`See The 3 Surfaces`, `Open Live App`).
- Keep primary CTA visible in sticky nav.

## Copy Rules
- Keep private-party framing explicit.
- Contrast old karaoke pain points with BeauRocks outcomes.
- Never claim licensing bypass.
- Include responsibility language for host music-rights compliance.

## Current Implementation Scope
- New route: `?mode=marketing`.
- Mode detail pages: `?mode=marketing&page=mode-karaoke|mode-bingo|mode-trivia|mode-bracket|mode-tight15`.
- Initial homepage shell includes:
- Parallax hero.
- Surfaces overview.
- Modes summary.
- Fundraiser section.
- VIP section.
- Host plans section.
- FAQ.
- Waitlist capture via callable backend (`submitMarketingWaitlist`) with local fallback.

## Next Build Steps
- Expand each mode page with richer screenshots/video and deeper scenario copy.
- Add a dedicated fundraiser playbook page with sample event templates.
- Add analytics events for CTA clicks and form submits.
