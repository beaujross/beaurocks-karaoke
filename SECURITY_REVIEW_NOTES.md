## Security Review Notes

This repo is actively developed and demoed. A few security and architecture areas are intentionally transitional and should be understood in that context.

### Current posture

- Secrets are not committed to the repo. Runtime secrets are expected through Firebase Functions secrets and local `.env` files that are gitignored.
- Production callable paths support App Check enforcement.
- Billing and subscription flows are server-mediated through Firebase Functions and Stripe webhooks.
- Firestore and Storage rules are present and are not fully open by default.

### Transitional areas

- Realtime room state still uses some direct client Firestore writes for low-latency audience interaction.
- Demo surfaces intentionally relax some normal interaction friction so `/demo` can run without a full authenticated operator flow.
- Some owner/bootstrap administration logic still includes temporary convenience paths that should be narrowed in a hardening pass.

### Known follow-up hardening work

- Reduce direct client write authority in live room documents and move more privileged mutations behind callable functions.
- Tighten audience-writable fields in `room_users` and `karaoke_songs`.
- Narrow or remove demo-only public orchestration permissions outside isolated demo environments.
- Replace bootstrap-style super-admin fallbacks with explicit UID/custom-claim based administration only.
- Make App Check fail closed by default across all non-local environments.

### Why this is not hidden

The goal of this note is to document the current state honestly before a broader security hardening pass. If you are reviewing this repo, treat the current implementation as a working product in active iteration, not as a finished security posture.
