# Mode Profiles

Status legend:

- `TBD`: pending interview confirmation
- `Draft`: partially defined
- `Locked`: accepted baseline

Cross-cutting systems such as voting, Tight 15, spotlight, combo/multiplier, queue governance, chat, and economy are defined in `SOCIAL_MECHANICS_PROFILES.md`.

## Karaoke Core (`karaoke`) - Draft

- Intent: keep queue momentum and spotlight singers.
- Intended social behavior:
  - Cheer, react, and reward effort.
  - Avoid dead air and queue confusion.
- Current assumptions:
  - Host should be able to start/stop in <2 taps.
  - Audience participation should remain active between songs.
- Risks:
  - Queue friction, unclear media/lyrics state.

## BeauRocks Open Stage (`self_serve_open_stage`) - Draft

- Intent: let a room run a fair self-serve karaoke night with minimal operator input.
- Intended social behavior:
  - Guests join quickly and understand the rules immediately.
  - Singers rotate fairly.
  - The audience still feels involved through bounded song or pacing votes.
- Current assumptions:
  - The host chooses a branded format, not raw policy knobs.
  - The room can always fall back safely when participation is low.
  - A host can return to normal karaoke if needed.
- Risks:
  - Hosts may confuse it with standard karaoke if the launch summary is unclear.
  - Too many crowd prompts can make the room feel slow instead of social.

## BeauRocks Spotlight Auction (`self_serve_spotlight_auction`) - Draft

- Intent: turn early or featured slots into a premium fundraiser mechanic without making the whole night feel pay-to-win.
- Intended social behavior:
  - Donors feel recognized.
  - The room sees a clear, exciting auction moment.
  - Fundraising feels communal, not extractive.
- Current assumptions:
  - Auction ordering is bounded to a named window such as the opening block.
  - All paid priority is based on verified payment state.
  - Payment and queue outcomes are visible enough to resolve disputes quickly.
- Risks:
  - Hosts may misunderstand when the room returns to normal fairness.
  - Donors may expect immediate stage priority if the rules are not explicit.
  - Support burden will spike if verification or slot assignment is ambiguous.

## BeauRocks Showcase (`self_serve_showcase`) - Draft

- Intent: deliver a prestige self-serve performance format with clear competitive integrity.
- Intended social behavior:
  - Performers treat the round seriously.
  - Audience participation adds energy without undermining legitimacy.
  - Results feel credible and worth sharing.
- Current assumptions:
  - Money does not affect advancement or winners.
  - The format uses structured rounds rather than free-form queueing.
  - Judges or audience scoring rules are declared up front.
- Risks:
  - Hosts may launch it expecting casual karaoke behavior.
  - Too much scoring complexity can intimidate casual rooms.

## Applause Meter (`applause_countdown`, `applause`, `applause_result`) - TBD

- Intent: create a short energy spike after performance.
- Intended social behavior:
  - Group hype, not judgment-heavy scoring.
- Risks:
  - Can feel punitive if framed as strict ranking.

## Selfie Cam (`selfie_cam`) - TBD

- Intent: quick visual participation.
- Intended social behavior:
  - Playful, low-pressure audience visibility.
- Risks:
  - Inappropriate content, moderation lag.

## Selfie Challenge (`selfie_challenge`) - TBD

- Intent: structured photo mini-game with voting.
- Intended social behavior:
  - Fun competition without social exclusion.
- Risks:
  - Popularity bias, unsafe submissions.

## Doodle-oke (`doodle_oke`) - TBD

- Intent: creative prompt interpretation + crowd voting.
- Intended social behavior:
  - Laugh-with, not laugh-at.
- Risks:
  - Prompt ambiguity and vote pile-on.

## Trivia (`trivia_pop`, `trivia_reveal`) - TBD

- Intent: quick brain-break between songs.
- Intended social behavior:
  - Friendly competition, broad participation.
- Risks:
  - Overly hard questions causing disengagement.
- Terminology:
  - These trivia rounds and `wyr` are host-launched prompt games.
  - They are not "QA" in the quality-assurance sense.
  - They are not the same feature as karaoke Pop Trivia.

## Would You Rather (`wyr`, `wyr_reveal`) - TBD

- Intent: social conversation catalyst.
- Intended social behavior:
  - Fast voting + reactions, no hostility.
- Risks:
  - Polarizing prompts.

## Bingo (`bingo`) - TBD

- Intent: passive engagement loop during performances.
- Intended social behavior:
  - Observe stage moments and collaborate on suggestions.
- Risks:
  - Disputes about tile legitimacy.

## Flappy Bird (`flappy_bird`) - TBD

- Intent: voice-driven arcade intensity.
- Intended social behavior:
  - Crowd encourages attempts and celebrates streaks.
- Risks:
  - Skill cliffs discouraging casual players.

## Vocal Challenge (`vocal_challenge`) - TBD

- Intent: pitch-focused challenge loop.
- Intended social behavior:
  - Skill expression with supportive crowd feedback.
- Risks:
  - Embarrassment for less confident singers.

## Riding Scales (`riding_scales`) - TBD

- Intent: memory + pitch repetition challenge.
- Intended social behavior:
  - Team encouragement and playful pressure.
- Risks:
  - Rule confusion and turn pacing.

## Guitar Vibe Mode (`lightMode: guitar`) - TBD

- Intent: high-energy tapping race.
- Intended social behavior:
  - Rapid engagement and celebration.
- Risks:
  - Dominant players suppressing others.

## Strobe Vibe Mode (`lightMode: strobe`) - TBD

- Intent: short intense rhythm burst.
- Intended social behavior:
  - Synchronized crowd action.
- Risks:
  - Accessibility and sensory overload.

## Ready Check (`readyCheck`) - TBD

- Intent: align crowd before next phase.
- Intended social behavior:
  - Quick consensus and shared pacing.
- Risks:
  - Fatigue if overused.
