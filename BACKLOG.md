# Backlog

## P0 - Blocking
- VIP SMS auth: reCAPTCHA/phone verification must succeed for test + real numbers; document required keys and settings.
- VIP profile onboarding: required ToS consent + profile fields must save to `/users/{uid}` and be editable.
- Firestore permissions: ensure `/users/{uid}` writes succeed after auth for VIP onboarding/profile edits.
- Singer app hook order errors: ensure no conditional hooks; verify `SingerApp.jsx` renders without hook mismatch.
- Host portal “connecting” hang: identify missing data/permissions and unblock create/join flow.

## P1 - High Priority
- Public profile viewer: allow viewing lobby/leaderboard user profiles with VIP badge and fame progress.
- Fame XP UX: surface fame progress/unlocks in VIP profile, show next unlock clearly.
- Queue settings visibility: show readable queue rules in singer app + public TV without truncation.
- Emoji carousel: center selection on load; improve tap/scroll behavior without jank.
- Local media playback: uploaded mp4 should play in TV stage view (CORS + permissions).

## P2 - Medium
- VIP alerts: host-configured “notify before stage” timing + VIP opt-in toggle (Twilio).
- Points/Monetization UX: simplify points info + packs, highlight room boost crate.
- Tight 15 UX: clear “Add new” action; CTA when empty; show top 3 on profile.
- Chat moderation: host tools and DM-to-host flow polished.

## P3 - Nice-to-have
- Global UI polish: consistent modal styling, tooltips, and button styles.
- About BROSS: richer, more visual, less text.
- Additional VIP unlock visuals + badges.

