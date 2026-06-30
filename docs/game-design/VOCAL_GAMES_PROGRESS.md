# Vocal Games Progress Ledger

This is the working tracker for turning the browser vocal games into console-level audio games: clear fantasy, strong sound design, forgiving controls, public-TV clarity, host-owned mic setup, and crowd-first participation.

## Product Bar

Reference feel:
- `Rock Band` / `Guitar Hero`: readable lanes, anticipation, timing windows, forgiving feedback, satisfying hit sounds.
- `SingStar`: voice as the instrument, pitch/sustain scoring, instant visual feedback, party-friendly competition.
- Karaoke battle modes such as KaraFun: lightweight competitive framing, singers/crowd can understand the objective immediately.

Non-negotiables:
- Public TV is display-only during game modes.
- Host panel owns room mic setup and permission prompts.
- Crowd mic is the default player when possible.
- Audience phones provide tactical powers, reactions, boosts, rescues, or spotlight turns.
- Audio cues must be sustained, reverberant, and musical enough to teach the mechanic.
- Latency and pitch detection are assumed unreliable, so scoring must be forgiving and based on windows, trends, sustain, confidence, and energy rather than frame-perfect precision.

## Cross-Game Progress Matrix

| Mode | Current Identity | Target Identity | Progress | Next Implementation Slice |
| --- | --- | --- | --- | --- |
| Volley Sync / Vocal Rocket | Crowd volley/orb with vocal rocket pressure, higher-note lift requirements, TV command language, phone rescue/combo layer, and shared launch/climb/orbit cue tails | Cooperative scale-climb rocket: low rumble launches, higher pitch bands sustain altitude, phones rescue/combo | Voice physics + shared Vocal Rocket cue pass | Playtest/tune pressure thresholds, add produced launch/orbit assets, phone combo powers |
| Team Pong | Save/Slow-Mo/Shield/Redirect/Spike rally with host room-mic chant charge, team meters, cue tails, and a big Rally Command overlay | Vocal-energy rally: crowd voice charges rallies, phones trigger saves/slow-mo/shields/redirects/spikes | Rally command + tactical phone powers pass | Tune cooldowns and replace generated cue prototypes with produced rally sounds |
| Riding Scales | Scale echo game with breath windows, shared sustained guide tones, phrase locks, checkpoint progress, and a big Scale Command overlay | Long-form scale climb: sustain notes up/down with breath breaks and checkpoint phrases | Shared guide-tone + phrase/checkpoint clarity pass | Tune sustain scoring, add fuller phrase-lane visuals, add produced phrase stingers |
| Vocal Challenge | Target-ribbon vocal battle with shared sustained guide tones, battle commands, launcher framing, and phrase result history | SingStar-style target battle: solo/spotlight/crowd turns with visible target ribbons | Shared guide-tone + battle/ribbon clarity pass | Add singer-vs-crowd scoring, phone support powers, and produced result stingers |
| Pitch Runner / Flappy | Forgiving voice runner with trend cues, checkpoint shields, generated cue tones, and a big Runner Command overlay | Voice platformer: pitch trend steers lane, volume boosts, crowd shield saves | Trend + command clarity pass | Add phone shield/slow/preview powers and stronger gate visuals |
| Musical Moments | Media-loop rhythm challenge with beat-clock anticipation, AudioScape level-map rail, forgiving phone taps, rewards, host room-mic vocal lift scoring, loop grades, and attempt history | Viral song-moment challenge: replay a famous re-entry/drop/high note, tap or sing the hit, then reveal timing and vocal lift | Shared sound system + AudioScape geometry pass | Add curated moment packs, produced stingers, final championship reveal, and real-room calibration |

## Fun, Clarity, And Distinction Scorecard

Each mode needs to earn its place by passing all four checks:

| Mode | Fun Loop | Audience Clarity | Distinct From Other Vocal Games | Whole-Crowd Interaction |
| --- | --- | --- | --- | --- |
| Volley Sync / Vocal Rocket | Cooperative launch, climb, save, orbit | TV says the current target: low rumble, climb, hold, rescue | Orb/rocket physics, altitude ladder, scale pressure | Crowd voice drives lift; phones rescue/combo |
| Team Pong | Competitive rally charge, save, slow-mo, shield, redirect, spike | TV says charge rally, save now, slow-mo active, redirect window, spike now | Team sport energy, left-vs-right meters, ball physics | Crowd voice charges team energy; phones fire timed powers |
| Riding Scales | Phrase mastery: hold, slide, rest, checkpoint | TV shows current note, next note, breath break | Vocal-coach scale highway, not an obstacle game | Crowd sustains together; phones lock checkpoints |
| Vocal Challenge | Battle phrases and target ribbons | TV shows who is active, phrase target, result | SingStar-style scoring/battle, not physics | Crowd can be player, support team, or challenger |
| Pitch Runner / Flappy | Arcade run with pitch trend, shield, checkpoints | TV says sing higher/lower, hold steady, shield ready | Runner/platformer with lanes and gates | Crowd steers trend; phones shield/slow/preview |
| Musical Moments | Anticipate, tap, sing, reveal | TV shows loop clock, target hit, timing spread, vocal lift | Media-moment party challenge, not pitch exercise | Crowd sings the lift; phones tap the iconic hit |

## Current Rankings

Scores are my current implementation/readiness ratings after this pass, not the final ambition.

| Mode | Fun | Clarity | Distinction | Crowd Role | Audio Reward | Remaining Need |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Volley Sync / Vocal Rocket | 8 | 9 | 8 | 8 | 6 | Tune pressure thresholds against room recordings, add produced launch/orbit assets, phone combo powers |
| Team Pong | 8 | 9 | 9 | 8 | 7 | Tune cooldowns, replace cue prototypes with produced sounds, real-room latency playtest |
| Riding Scales | 8 | 9 | 8 | 7 | 7 | Tune sustain scoring, richer phrase lanes, phone checkpoint powers, produced phrase stingers |
| Vocal Challenge | 8 | 9 | 8 | 7 | 7 | Singer-vs-crowd scoring, phone support powers, produced result stingers |
| Pitch Runner / Flappy | 8 | 9 | 8 | 7 | 7 | Phone powers, stronger gate visuals, real-room latency tuning |
| Musical Moments | 9 | 9 | 9 | 8 | 8 | Curated packs, produced stingers, final championship reveal, real-room calibration tuning |

Minimum bar before a mode is considered improved:
- A first-time audience member can describe the goal after five seconds of watching the TV.
- The crowd can contribute without opening a phone.
- Phones create at least one clutch moment that feels intentional.
- The failure state is funny or fast, not confusing or punishing.
- The sounds teach the mechanic, not just decorate it.

## Rotation Rule

Do not fully polish one vocal game while another remains at "unclear prototype" quality. Work in passes:

1. **Identity pass:** make the mode visually and mechanically distinct.
2. **Clarity pass:** rewrite TV/phone/host copy and remove ambiguous controls.
3. **Forgiveness pass:** add smoothing, grace, cooldowns, stale-input handling, and quick recovery.
4. **Crowd pass:** ensure the default crowd mic has a useful role.
5. **Audio pass:** add guide tones, warning tones, success layers, and reverb tails.
6. **Fun pass:** add a clutch mechanic, combo, comeback, or spectacle moment.

Every mode should complete pass 1 and pass 2 before any mode gets deep polish beyond pass 4.

## Crowd Interaction Pattern Library

Use these patterns across games, but with different names and visuals so the modes do not blur together:

- **Sustain:** hold a note or loud crowd sound to fill a meter.
- **Trend:** sing higher or lower over time; exact pitch is less important than direction.
- **Band match:** enter a target note zone and stay there.
- **Breath window:** explicit rest moments where silence is correct.
- **Rescue:** phone action prevents a fail or widens the scoring window.
- **Spike:** phone action converts built-up vocal energy into a big moment.
- **Shield:** temporary protection from noisy/late input.
- **Combo unlock:** coordinated phone reactions or vocal streaks trigger a room effect.
- **Spotlight:** host highlights one player or section while the crowd remains the fallback player.

## Shared Mechanics Backlog

### Voice Input Model
- Track pitch, confidence, volume, stability, and note changes.
- Score on musical windows instead of exact samples.
- Prefer "trend up", "trend down", "hold", "enter band", and "sustain together" over exact Hz matching.
- Use crowd voice as ambient/default input.
- Let host spotlight individual audience phones/mics later without requiring that for core play.

### Audio System Needs
- Guide tones must be pleasant and sustained, not tiny beeps.
- Add reverb tails for target notes and success moments.
- Add low-frequency launch rumble for low-note mechanics.
- Add "slipping" warning tone before fail states.
- Add satisfying success layers for streak, combo, tier-up, and save.
- Make sound optional/volume-controlled from host.

### Public TV Instruction Pattern
- Show one active objective at a time.
- Use large readable verbs: `RUMBLE`, `HOLD`, `CLIMB`, `SAVE`, `PASS`, `SPIKE`.
- Highlight the active target band/lane/rhythm visually.
- Never require tapping or keyboard interaction on the public TV.

### Audience Phone Pattern
- Phones are secondary but meaningful.
- Roles can include rescue, boost, pass, shield, spike, combo unlock, emoji powers.
- Keep reaction emojis distinct from avatar emojis.
- Long-term: reaction emoji bank can support unlocks, swaps, monetization, and special abilities.

## Mode Ledgers

### Volley Sync / Vocal Rocket

Fantasy:
- The room launches an orb like a rocket.
- Low voices create ignition.
- The crowd climbs higher and higher on the scale to keep altitude.
- Phones provide tactical support and combo powers.

Current production progress:
- Added `applyLobbyVoiceFrame` and `deriveLobbyVoiceTarget` in `src/apps/TV/lobbyPlaygroundEngine.js`.
- Host can arm room mic and publish `lobbyVoiceTelemetry` from `src/apps/Host/HostApp.jsx`.
- Public TV consumes host telemetry while Volley is active and skips Team Pong.
- TV prompt now shows voice-target language for Volley, including phase-specific command labels such as `RUMBLE LOW`, `LIFT OFF`, `CLIMB HIGHER`, and `HOLD ORBIT`.
- Vocal Rocket now exposes current phase, target note, match percent, lift requirement, and pressure on the TV sidebar.
- Volley/Vocal Rocket cues now route through the shared `voiceGameSoundSystem` for launch, climb, orbit, warning, reset, and hit layers before falling back to the older local synth path.
- Voice physics now raise the minimum lift requirement as altitude/airborne pressure climbs, so low effort cannot float forever.
- Unit coverage added in `tests/unit/lobbyPlaygroundVoiceEngine.test.mjs`.

Open design/implementation:
- Add produced guide-note assets for each target band.
- Replace procedural launch, climb, warning, and orbit cues with produced sound-pack assets when ready.
- Tune pressure/lift thresholds from real room testing.
- Add phone combo powers that can rescue or temporarily widen pitch windows.
- Expand the TV ladder from sidebar HUD into a clearer full-scene scale/altitude rail.

Fun drivers:
- Whole-room cooperation.
- Low voices and high voices both matter at different moments.
- Increasing difficulty creates a natural party arc.
- The TV gives immediate visual altitude feedback.

### Team Pong

Problem:
- Voice up/down control is not intuitive for a pong game.
- Audience members do not understand what they are supposed to control.
- First clarity pass now reframes the game around chanting, Save, and Spike instead of direct paddle steering.
- Host Game Launcher now exposes the Team Pong rally goal and drop timer, and its setup panel explains Chant, Save, Slow-Mo, Shield, Redirect, and Spike before launch.
- Host room mic now publishes Team Pong voice telemetry into gameData.voiceTelemetry while the game is live.
- Team Pong now turns fresh room voice into chant charge that fills visible meters and extends the rally drop window forgivingly.
- Team Pong now has team-specific charge meters on TV and phones, plus richer generated Save/Slow-Mo/Shield/Redirect/Spike/Charge/Danger cue tails.
- Phone powers now include Shield as a slower defensive clutch action between Save and Spike.
- Phone powers now include Slow-Mo as a long-cooldown time stretch that extends the rally drop window.
- Phone powers now include Redirect as a timed counter during rally danger or after a spike window.

Target:
- Keep the pong fantasy, but stop using voice as direct paddle steering.
- Voice becomes rally energy.
- Sustained crowd sound charges paddle reach, ball speed, or comeback meter.
- Phones perform discrete powers: save, slow-mo, shield, spike, redirect.

Screen direction:
- TV shows two teams, ball, rally count, charge meters, and current callout.
- Phone shows a small set of team actions, not complex controls.
- Host can force teams, start/stop, and arm room mic.

Audio direction:
- Serve countdown tone.
- Paddle hit thunk with pitch-shift by rally speed.
- Crowd charge hum that grows with volume/sustain.
- Spike and save stingers.

Next slice:
- Tune Save and Spike cooldowns after room playtest.
- Add phone shield/slow-mo powers and optional left/right host balancing.
- Replace generated cue tones with richer produced chant, save, spike, and danger sounds when the sound pack is ready.
- Add tests for stale telemetry, charge decay, action cooldowns, and rally scoring.

Fun drivers:
- Competitive left-vs-right energy.
- Crowd can shout/sing together without precision.
- Phones provide clutch moments that feel intentional.

### Riding Scales

Current production progress:
- Guide tones now use the shared `voiceGameSoundSystem` sustained-note primitive with layered octave support and echo tail instead of local short beeps.
- Correct notes now create visible phrase locks, and completed phrases bank checkpoints that persist on the TV.
- Public rules and TV copy now explain breath windows and forgiving close-note matching.
- Source coverage added in `tests/unit/ridingScalesVocalClaritySource.test.mjs`.

Target:
- This should be the most "vocal exercise as game" mode.
- Players ride up and down a visible musical scale.
- Sustained notes and controlled transitions matter more than speed.
- Built-in breath breaks prevent instant failure and make the game feel coached.

Screen direction:
- TV shows a vertical or diagonal scale highway.
- Current target note glows.
- Upcoming notes appear like a music-game lane.
- Breath/rest windows are visually explicit.

Inputs:
- Crowd mic for default cooperative mode.
- Spotlight singer mic/phone for individual turns later.
- Phones can trigger breath saves, harmony boost, or checkpoint locks.

Audio direction:
- Sustained guide note for current target.
- Soft metronome or pulse during transitions.
- Warm success chord on completed phrase.
- Gentle warning shimmer when drifting out of band.

Next slice:
- Extract scale phrase definitions into data.
- Implement phrase windows: hold, slide up, hold, rest, slide down.
- Add scoring for sustain, smooth transition, and recovery.

Fun drivers:
- Clear improvement loop.
- Feels like a vocal coach game rather than another obstacle game.
- Room can celebrate phrase completions.

### Vocal Challenge

Current production progress:
- TV layout now frames the game as a Vocal Battle with target ribbons instead of a generic pitch target.
- Guide tones now use the shared `voiceGameSoundSystem` sustained-note primitive with layered octave support and echo tail.
- Correct notes now create visible phrase locks, and completed phrases bank checkpoints that persist on the TV.
- Result labels now use battle language: `Locked`, `Close`, `Crowd Save`, and `Find The Lane`.
- Phrase result history now stays visible during the round so singers and the crowd can read recent Locked/Close notes and points.
- Host Game Launcher now presents crowd battle and spotlight battle starts with ribbon/assist cards.
- Source coverage added in `tests/unit/vocalChallengeBattleSource.test.mjs`.

Target:
- This should become the SingStar/KaraFun battle-inspired mode.
- It can support crowd-vs-singer, singer-vs-singer, or spotlight turns.
- The main mechanic is matching target ribbons and sustaining phrases.

Screen direction:
- TV shows target ribbons, active persona, score race, phrase results.
- Audience phone shows "support singer", "challenge singer", or reaction powers.
- Host chooses crowd mode, selected participants, or rotating spotlight.

Inputs:
- Crowd mic default for ambient challenge.
- Host-selected user phone/mic for spotlight challenge later.
- Phones can boost, freeze score, widen window, or send crowd support.

Audio direction:
- Target tone before each phrase.
- Start phrase count-in.
- Success layer when the player stays inside the band.
- Distinct miss/recovery cue that does not shame the singer.

Next slice:
- Add singer-vs-crowd score lanes for spotlight battles.
- Add phone support powers: Harmony Boost, Freeze Lane, and Crowd Save.
- Add richer result stingers for Locked, Close, Recovered, and Crowd Save.

Fun drivers:
- Competition is understandable.
- People hear and see why points happened.
- Forgiving scoring keeps casual singers engaged.

### Pitch Runner / Flappy

Current production progress:
- Pitch movement now uses confidence-weighted trend smoothing instead of snapping directly to detected pitch.
- Low-confidence or missing voice input now drifts toward the safe lane instead of immediately falling.
- TV now shows runner cues: `Sing higher`, `Sing lower`, `Hold steady`, and checkpoint/shield state.
- Host Game Launcher now frames the mode as a safe-lane voice runner with trend, lane, and shield cards.
- Source coverage added in `tests/unit/pitchRunnerVocalClaritySource.test.mjs`.

Target:
- Keep the arcade pitch-control identity, but make it feel less like raw mic chaos.
- Pitch trend controls lane, not exact position.
- Volume or sustained tone can provide boost/shield.

Screen direction:
- TV shows a music-runner lane, gates, checkpoints, and shield state.
- Obstacles should read as beat/phrase gates rather than random pipes.
- Mobile/host copy should say "sing higher/lower" and "hold to stabilize".

Inputs:
- Crowd mic default for ambient mode.
- Spotlight player for solo run.
- Phones can trigger shield, slow time, or lane preview.

Audio direction:
- Gate approach tones.
- Checkpoint chord.
- Shield shimmer.
- Fail/retry cue that quickly restarts instead of hard-stopping.

Next slice:
- Add checkpoint-based scoring and celebratory gate-pass cues.
- Add phone powers: Shield, Slow Lane, and Preview Gate.
- Add distinct audio cues for higher/lower/hold, shield, checkpoint, and recovery.

Fun drivers:
- Immediate arcade readability.
- Short rounds, fast retries.
- Funny crowd moments without harsh failure.

### Musical Moments

Fantasy:
- The host loads a famous musical moment: re-entry, beat drop, held high note, or silence-before-impact.
- The room learns the loop quickly, then tries to tap and sing the iconic hit together.
- Timing is forgiving enough for phones, and the vocal score rewards lift, confidence, and crowd energy instead of sample-perfect pitch.

Current production progress:
- Added the `musical_moments` cartridge in `src/games/MusicalMoments/Game.jsx`.
- Host Game Launcher can configure title, artist/source, media URL, loop timing, target beat, and hit window.
- Host Game Launcher includes challenge-shape presets: Silence Drop, High Note Lift, Chant Punch, and Final Word.
- Host Game Launcher now exposes phone latency calibration so taps can be pulled earlier/later before scoring.
- Host launch auto-arms the room mic and publishes `gameData.voiceTelemetry` for the mode.
- Audience phones get a large `Tap The Hit` action instead of duplicating the full TV game.
- TV can show a YouTube/embed/direct-media loop, the target hit, phone timing spread, vocal lift, loop reveal headline, grade, average offset, calibration offset, and early/on-time/late histogram.
- Browser-native stingers now play once per loop for Nailed, Lift, Close, Early, and Late reveals.
- The TV now has a beat-clock stage with `SING THE LIFT`, `GET READY`, `TAP NOW`, and `REVEAL` callouts instead of relying only on dashboard stats.
- Shared `voiceGameSoundSystem` now provides richer procedural stinger families for Pitch Runner, Team Pong, Musical Moments, Vocal Rocket, Vocal Challenge, and Riding Scales, plus future sound-pack asset resolution and waveform-to-level geometry helpers.
- Musical Moments now shows an `AudioScape Level Map` rail that can use supplied waveform samples or a generated preview to turn the loop into visible hit/rest geometry.
- Audience phones now show a `Beat Clock` countdown and change the tap button into a higher-energy hit-window state.
- Successful hits now create visible reward feedback, points, a TV celebration, up-next spotlighting, and a multi-loop attempt history strip.
- Run-of-show launch support and source coverage exist in `tests/unit/musicalMomentsSource.test.mjs`.

Open design/implementation:
- Replace challenge-shape presets with a curated challenge pack list using legal/embeddable references and known target timings.
- Add host-side latency calibration so tap windows can be adjusted per room/device setup.
- Add richer stingers for `early`, `late`, `nailed it`, and `vocal lift` results.
- Add final room championship reveal and richer section/player summaries at the end of a challenge set.
- Add fallback non-media mode that still feels intentional when a clip cannot embed.

Fun drivers:
- Recognizable moments give the room instant stakes.
- The silence-before-impact format creates natural anticipation.
- Phones participate with one obvious action while the crowd mic remains the default vocal player.
- Replaying the same loop makes improvement visible and funny instead of punishing.

## Implementation Order

1. Playtest and tune Volley Sync / Vocal Rocket.
2. Tune Team Pong Save/Slow-Mo/Shield/Redirect/Spike cooldowns and produced rally sounds.
3. Upgrade shared audio cues and guide tones.
4. Add Musical Moments real curated packs, produced stingers, and result history polish.
5. Rebuild Riding Scales around phrase windows and breath breaks.
6. Add Vocal Challenge singer-vs-crowd scoring and phone support powers.
7. Polish Pitch Runner with phone powers, stronger gate visuals, and real-room latency tuning.
8. Add spotlight individual mic routing after the crowd-mic loop is reliable.

## Definition Of Done Per Mode

- Public TV can teach the objective in five seconds.
- Host can start/stop and manage mic state without touching the TV.
- Crowd can participate without opening phones.
- Phones add meaningful but optional powers.
- Audio cues make the mechanic easier to understand.
- The game fails gracefully and recovers quickly.
- Tests cover core scoring/reducer behavior and stale input handling.
