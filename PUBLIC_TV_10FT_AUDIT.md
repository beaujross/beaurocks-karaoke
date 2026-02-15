# Public TV 10ft Audit

Date: 2026-02-14
Scope: `PublicTV` shell plus TV game cartridges (`GameContainer` routes).
Heuristic: at ~10ft viewing distance, primary text should remain readable without squinting; micro labels and dense metadata should be minimized.

## Screens Needing Visual Improvements

### Critical

1. Main karaoke screen (stage + sidebar) is too dense for 10ft use.
- Why it fails: too many simultaneous widgets, many 9-11px labels, and stacked metadata in queue/activity.
- Evidence:
`src/apps/TV/PublicTV.jsx:2122`
`src/apps/TV/PublicTV.jsx:2124`
`src/apps/TV/PublicTV.jsx:2133`
`src/apps/TV/PublicTV.jsx:2180`
`src/apps/TV/PublicTV.jsx:2198`
`src/apps/TV/PublicTV.jsx:2224`
`src/apps/TV/PublicTV.jsx:2233`
`src/apps/TV/PublicTV.jsx:2241`
`src/apps/TV/PublicTV.jsx:2253`
`src/apps/TV/PublicTV.jsx:2284`
`src/apps/TV/PublicTV.jsx:2314`
`src/apps/TV/PublicTV.jsx:2335`
`src/apps/TV/PublicTV.jsx:2365`

2. Vocal Challenge TV and Riding Scales TV have micro HUD text and tiny note labels.
- Why it fails: gameplay labels and status chips are mostly xs/10px; note axis labels and bottom status text are too small at distance.
- Evidence:
`src/games/VocalChallenge/Game.jsx:318`
`src/games/VocalChallenge/Game.jsx:322`
`src/games/VocalChallenge/Game.jsx:328`
`src/games/VocalChallenge/Game.jsx:338`
`src/games/VocalChallenge/Game.jsx:355`
`src/games/VocalChallenge/Game.jsx:364`
`src/games/RidingScales/Game.jsx:363`
`src/games/RidingScales/Game.jsx:367`
`src/games/RidingScales/Game.jsx:373`
`src/games/RidingScales/Game.jsx:385`
`src/games/RidingScales/Game.jsx:402`
`src/games/RidingScales/Game.jsx:411`

3. Sweet 16 Bracket TV view is information-dense with small metadata.
- Why it fails: multiple match cards on one screen plus 10-11px status lines and vote counts.
- Evidence:
`src/games/KaraokeBracket/Game.jsx:164`
`src/games/KaraokeBracket/Game.jsx:166`
`src/games/KaraokeBracket/Game.jsx:183`
`src/games/KaraokeBracket/Game.jsx:237`
`src/games/KaraokeBracket/Game.jsx:238`
`src/games/KaraokeBracket/Game.jsx:244`
`src/games/KaraokeBracket/Game.jsx:249`

### High

4. Trivia TV reveal is readable at headline level but crowded in secondary details.
- Why it fails: voter chips, summary labels, and top-correct rows rely on xs/10-11px text.
- Evidence:
`src/games/QA/Game.jsx:289`
`src/games/QA/Game.jsx:312`
`src/games/QA/Game.jsx:315`
`src/games/QA/Game.jsx:325`
`src/games/QA/Game.jsx:341`
`src/games/QA/Game.jsx:357`
`src/games/QA/Game.jsx:369`

5. Doodle-oke TV view has right-column microcopy and cramped vote list.
- Why it fails: prompt/vote sections use small text with dense stacked rows.
- Evidence:
`src/apps/TV/PublicTV.jsx:1629`
`src/apps/TV/PublicTV.jsx:1633`
`src/apps/TV/PublicTV.jsx:1636`
`src/apps/TV/PublicTV.jsx:1639`
`src/apps/TV/PublicTV.jsx:1647`
`src/apps/TV/PublicTV.jsx:1655`

6. Sidebar blocks (Join/Spotlight/Up Next/Activity) are over-labeled.
- Why it fails: long URLs, multiple chips, and tight vertical packing push critical queue readability down.
- Evidence:
`src/apps/TV/PublicTV.jsx:2224`
`src/apps/TV/PublicTV.jsx:2225`
`src/apps/TV/PublicTV.jsx:2233`
`src/apps/TV/PublicTV.jsx:2241`
`src/apps/TV/PublicTV.jsx:2249`
`src/apps/TV/PublicTV.jsx:2253`
`src/apps/TV/PublicTV.jsx:2314`
`src/apps/TV/PublicTV.jsx:2350`
`src/apps/TV/PublicTV.jsx:2388`

### Medium

7. Bingo board text in 5x5 mode trends too small for distance reading.
- Why it fails: tile text drops to `text-xl`/`text-sm` with additional xs metadata.
- Evidence:
`src/games/Bingo/Game.jsx:19`
`src/games/Bingo/Game.jsx:20`
`src/games/Bingo/Game.jsx:22`
`src/games/Bingo/Game.jsx:36`
`src/games/Bingo/Game.jsx:37`

8. Lyrics overlay top HUD/status uses micro text even though lyric lines are strong.
- Why it fails: top metadata and sync badges are 10-11px and compete with main lyric reading.
- Evidence:
`src/components/AppleLyricsRenderer.jsx:155`
`src/components/AppleLyricsRenderer.jsx:157`
`src/components/AppleLyricsRenderer.jsx:201`
`src/components/AppleLyricsRenderer.jsx:205`

9. Small top/bottom callout pills are not 10ft friendly.
- Why it fails: transient chips (live badge, tip pulse, MVP bars) rely on ~10px text.
- Evidence:
`src/apps/TV/PublicTV.jsx:1902`
`src/apps/TV/PublicTV.jsx:1945`
`src/apps/TV/PublicTV.jsx:1964`

## Screens That Mostly Pass 10ft

- Tip full-screen CTA: large headline and QR dominate (`src/apps/TV/PublicTV.jsx:229`, `src/apps/TV/PublicTV.jsx:231`).
- Ready Check countdown: strong number hierarchy (`src/apps/TV/PublicTV.jsx:1560`).
- Applause meter overlay: very clear center metric (`src/apps/TV/PublicTV.jsx:2508`).
- WYR reveal split percentages: large % numbers and two-panel layout (`src/games/QA/Game.jsx:451`, `src/games/QA/Game.jsx:472`).
