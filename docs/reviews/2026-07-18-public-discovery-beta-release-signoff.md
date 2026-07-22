# Public Discovery beta release signoff

Date: 2026-07-18

## Decision

Public Discovery beta is deployed and operationally ready for public testing.

This signoff covers the public map/list feed, schedule lifecycle, public/private
visibility enforcement, venue/night submission, ownership claims, recent public
recaps, geo landing data, and the marketing-to-application entry paths.

## Shipped behavior

- Discovery defaults to nationwide on desktop and mobile.
- Approved public venues and unscheduled listings remain discoverable.
- Current and upcoming nights remain discoverable.
- Cancelled occurrences and ordinary ended nights are excluded.
- Published room recaps remain discoverable for 30 days.
- Historical event detail routes can explicitly request ended listings.
- Public Discovery and geo payloads omit owner UIDs and internal identity links.
- Authenticated owners receive a server-computed `canManage` capability.
- Claim creation requires an existing, approved, public target.
- Claim approval stops if the target is no longer publicly claimable.
- Venue submissions infer their region from city and state.
- Technical experience metadata is optional and collapsed in the submission UI.
- Room cards distinguish upcoming, join-ready, ended, and recap states.

## Release evidence

- Scoped ESLint: clean.
- Unit suite: 291 files, 1,042 tests passed.
- Directory callable emulator suite: 45 checks passed.
- Firestore and Storage rules suite: passed.
- Production Vite build: passed.
- SEO output: 134 prerendered routes and 131 social cards.
- Local marketing browser release gate: passed.
- Live `beaurocks.app` marketing golden path: 9 checks passed.
- Live Discovery sample: 25 items, zero owner/identity-link leaks, zero cancelled
  occurrences.
- Post-deploy error sweep: zero ERROR entries for the five deployed services.

## Production revisions

- `listDirectoryDiscover`: `listdirectorydiscover-00117-xes`
- `listDirectoryGeoLanding`: `listdirectorygeolanding-00121-pas`
- `submitDirectoryClaimRequest`: `submitdirectoryclaimrequest-00120-top`
- `resolveDirectoryClaimRequest`: `resolvedirectoryclaimrequest-00120-kid`
- `submitDirectoryListing`: `submitdirectorylisting-00122-qug`
- Hosting release: `1784400158175000`

## Guardrails retained

- Only approved public listings enter public discovery surfaces.
- Private room discovery remains code/passcode based and is not placed on the map.
- Submission and claim writes remain authenticated and moderated.
- No payment or public Vibe Index rollout gates were widened by this release.

## Next launch slice

Advance to Public Host beta readiness:

1. Re-verify the simplified room setup flow against saved presets and effective
   runtime behavior.
2. Complete host launch preflight for public/private discovery, join access,
   background music fallback, and run-of-show defaults.
3. Add production QA for create, edit-to-blank, save, reopen, launch, and end-room
   lifecycle.
4. Keep BeauBucks spend and public Vibe publishing behind their existing canaries.

