# BeauRocks Discovery, Host Growth, and Pacific Northwest Expansion Executive Plan

Date: 2026-08-10  
Audience: CEO, CTO, Chief Product Officer, Chief Marketing Officer  
Advisory lenses: UX, Host, co-host, venue/operator, fan, moderator, and regional content operator  
Decision requested: approve the program direction, the numbered slice sequence, and the release gates below

## Executive position

BeauRocks should build a first-party karaoke graph, not a larger pile of venue cards.

The durable product model is:

```text
Venue -> recurring Night -> dated Occurrence
                 |              |
                 +-- Host assignments

Host -> public profile -> schedule -> followers -> support

Venue / Host / Night -> verified activity -> Vibe history
```

This model supports the realities that Hosts move between venues, venues use different Hosts on different nights, one night can have multiple Hosts, and a substitute can cover one date without rewriting the recurring relationship.

The current product already contains valuable foundations: public detail pages, recurring night series, first-party follows, RSVP reminders, karaoke-specific reviews, social-card generation, provider media enrichment, Host room discovery listings, and a protected Vibe v2 evidence ledger. The program should reuse those foundations while correcting four structural risks:

1. a Host or manager claim can currently become venue ownership;
2. public schedule paths still collapse multi-Host relationships to one `hostUid`;
3. SEO image generation selects the first available image rather than the best verified image;
4. the current Vibe projection lacks history and can reward BeauRocks-powered status.

## Final recommendation to the CEO

Approve a ten-slice program with four release gates.

The first commercial priority is not the public numerical Index. It is a trustworthy supply flywheel:

1. represent ownership and Host assignments safely;
2. make listings and schedules easy to manage;
3. give Hosts compelling public pages and follower activation;
4. automate verified regional supply and imagery;
5. use first-party activity to create defensible historical differentiation.

Do not launch Pacific Northwest automation on top of the current ownership model, and do not expose Vibe movement until paid-plan influence is removed and historical shadow data passes its stability gate.

## Executive team synthesis

### CTO verdict: approve with architectural gates

The CTO supports the program if it evolves the existing directory and occurrence systems through compatibility adapters rather than introducing a second directory.

Required CTO conditions:

- claims create memberships or assignments and never silently replace `ownerUid`;
- all new writes are idempotent, audited, reversible, and protected by explicit role checks;
- one canonical Night/Occurrence graph feeds Discovery, Host pages, reminders, SEO, and Index evidence;
- imported media records provenance, freshness, dimensions, rights status, and fetch safety;
- PNW ingestion has bounded queues, deterministic deduplication, rate limits, dry runs, and rollback;
- Vibe v2 stays server-only and shadowed until threshold, abuse, privacy, and stability evidence passes;
- migrations preserve current public URLs and live Room behavior.

CTO approval condition: Slices 1-3 must close before automated regional publishing, and Slice 10 must close before any public trend or exact-number launch.

### Chief Product Officer verdict: approve the graph, simplify the jobs

The CPO supports the program because it replaces overlapping listing concepts with four understandable user jobs:

- own or manage a Venue;
- host a recurring Night;
- cover a dated Occurrence;
- follow a Host, Venue, or Night.

Required CPO conditions:

- the user sees “Night,” not internal distinctions between event, Room session, series, and occurrence;
- a Host can attach to a Night without claiming the Venue;
- the owner workflow is search first, relationship second, verification third;
- one management workspace owns profile, schedule, people, photos, reviews, and insights;
- Host public pages answer: who are they, where are they next, what are their nights like, how can I follow/book/support them;
- every slice reduces decisions or creates a clear new customer outcome;
- mobile completion, empty states, correction paths, and recovery are release criteria.

CPO approval condition: a first-time Host must be able to claim or propose a Night and publish a complete profile without BeauRocks assistance in moderated testing.

### Chief Marketing Officer verdict: approve the regional and first-party differentiation strategy

The CMO supports the program because it creates indexable local supply, shareable Host identities, follower reactivation, and a proprietary activity story.

Required CMO conditions:

- “BeauRocks-powered” remains a product capability badge, not a quality or ranking shortcut;
- owner and official media outrank provider imagery when verified and suitable;
- every indexable page has a strong unique image, useful local copy, canonical relationships, and truthful structured data;
- regional pages are published only when inventory is useful and schedule freshness is measurable;
- public reviews are explicitly first-party karaoke reviews, not copied provider reviews;
- Vibe is described as an activity/experience signal, never business value, revenue, or professional worth;
- exact scores and deltas are withheld until confidence and stability justify the claim.

CMO approval condition: launch-market pages must look populated, current, distinctive, and locally credible before they become acquisition landing pages.

### UX and operating-persona verdict: approve with progressive disclosure

The supporting personas align on these rules:

- Host: can manage their identity and schedule across venues without managing every venue;
- co-host/substitute: can be assigned to one Night or Occurrence without excessive authority;
- venue/operator: retains ownership, controls team access, and can see who changed the schedule;
- fan: can follow once and choose useful alert types without notification flooding;
- moderator: reviews identity conflicts and exceptions, not every routine correction;
- regional operator: can audit imported sources, duplicates, stale schedules, and media provenance in batches;
- search visitor: can distinguish verified, community-maintained, imported, and BeauRocks-powered facts.

## Program guardrails

- No second discovery database.
- No ownership transfer as a side effect of a Host or manager claim.
- No single-Host assumption in new schedule contracts.
- No copied provider review text in first-party review or structured-data claims.
- No arbitrary remote image fetch without timeout, size, type, and domain controls.
- No paid-plan, official-listing, or self-declared-feature boost inside Vibe scoring.
- No public numerical Index before shadow evidence and executive approval.
- No city page merely because an importer found one listing.
- No production publishing step without preview, provenance, and rollback.
- No slice is complete if it improves one surface by transferring confusion to another.

## Numbered implementation slices

### Slice 1 — Authority and scoring safety

Outcome: stop the two highest-risk forms of incorrect public authority and reputation.

Deliver:

- freeze claim approval behavior that overwrites `ownerUid` for Host/manager roles;
- introduce explicit claim outcomes: venue ownership, venue membership, Night assignment, profile identity;
- prevent a later claim from replacing an existing primary owner without a transfer workflow;
- make Host profile management recognize the authenticated profile owner;
- make “My Listings” resolve current authority rather than reconstruct it only from claim/submission history;
- remove BeauRocks-powered/official status from Index score inputs while retaining badges outside the score;
- add regression tests for conflicting claims, transfers, and score neutrality.

Definition of done:

- zero non-owner claim paths can change primary ownership;
- current owners, managers, and Hosts see the correct management state;
- identical verified activity produces the same score regardless of plan or official status;
- old documents continue to render and remain manageable through compatibility reads.

Persona gate: CTO, CPO, venue/operator, Host, and moderator approval.

### Slice 2 — Canonical memberships and invitations

Outcome: give Venues durable, role-based teams.

Deliver:

- `venue_memberships` with primary owner, owner, manager, scheduler, media editor, and viewer roles;
- invitations, acceptance, removal, expiry, transfer, and audit history;
- a permission matrix for profile, schedule, people, media, review response, insights, and ownership actions;
- a management entry point that queries effective membership directly;
- a migration adapter from `ownerUid`/`hostUid` into membership-aware authorization;
- moderator escalation for disputes and orphaned listings.

Definition of done:

- an owner can invite and remove a manager without support;
- a manager can update allowed fields but cannot transfer ownership;
- all privileged changes identify actor, role, before state, and after state;
- removing a membership removes access promptly without deleting the public listing.

Persona gate: CTO security and migration review; CPO and venue/operator usability review.

### Slice 3 — Canonical Night, Occurrence, and Host assignments

Outcome: accurately represent roaming Hosts, multiple Hosts, recurring nights, and substitutes.

Deliver:

- one public Night concept backed by `night_series` and dated occurrences;
- explicit Host assignments with primary Host, co-host, substitute, and producer roles;
- recurring assignments plus occurrence-specific overrides;
- preserve all Host assignments through occurrence generation and public projections;
- update Host, Venue, Event, Room, Discovery, SEO, reminders, and Vibe attribution to consume assignments;
- one-time exceptions, cancellations, and substitutions without rewriting the recurring series;
- compatibility projection to legacy `hostUid` while old readers remain.

Definition of done:

- one Host can appear at multiple venues correctly;
- one venue can show different Hosts on different Nights;
- a Night and a dated Occurrence can show multiple Hosts;
- substituting one date updates all public surfaces and attribution without changing future dates;
- timezone and cancellation tests pass across the PNW launch markets.

Persona gate: CTO data-contract review; CPO, Host, co-host, venue/operator, and fan journey review.

### Slice 4 — Unified claim and management experience

Outcome: make ongoing listing maintenance understandable and fast.

Deliver:

- search-first add/claim flow with relationship selection before evidence;
- adaptive verification options for Venue control and lower-risk Night association;
- a mobile management workspace with Profile, Schedule, People, Photos, Reviews, Insights, and History;
- direct low-risk edits for authorized roles and moderated community corrections for everyone else;
- stale-listing reports, duplicate resolution, ownership transfer, and claim escalation;
- bulk schedule confirmation for recurring Nights;
- visible provenance and last-verified status without exposing private evidence.

Definition of done:

- at least 85% of moderated first-time Hosts complete profile/Night association without assistance;
- median routine schedule confirmation is under one minute;
- every public listing has a correction/report path;
- no mobile dead end between search, sign-in, claim, and management.

Persona gate: CPO and UX approval; Host and venue/operator moderated acceptance; CTO authorization check.

### Slice 5 — Media intelligence and SEO card pipeline

Outcome: ensure the richest safe image represents every Venue, Host, Night, and region.

Deliver:

- `media_assets` records for source, owner, role, dimensions, aspect ratio, focal point, attribution, verification, and moderation;
- explicit `seoHeroAssetId` override;
- deterministic image scoring that favors verified high-resolution landscape media;
- Host cards with a rich background and portrait inset instead of avatar-first full-bleed crops;
- secure remote fetching with timeout, byte, type, redirect, and allowlist controls plus durable caching;
- affected-route regeneration when entity, media, schedule, review summary, or approved Index projection changes;
- 1200x630 and square share variants with selection/failure reports;
- image arrays and stronger relationships in Venue, Event, Host, and Night structured data;
- eligible first-party karaoke review summaries on detail pages and in structured data only after policy gates pass.

Definition of done:

- every indexable entity uses a non-placeholder image when verified media exists;
- Host OG cards do not use a square avatar as the background when landscape media exists;
- broken provider URLs cannot break the build;
- each generated card records the winning asset and fallback reason;
- social-card visual QA passes representative Host, Venue, Night, and geo-page fixtures.

Persona gate: CMO brand and claim review; CTO fetch/security review; CPO/UX visual comprehension review.

### Slice 6 — Host public front ends and support inventory

Outcome: turn every approved BeauRocks Host into an indexable local acquisition and retention surface.

Deliver:

- stable handle URL backed by immutable profile identity;
- hero, avatar, bio, service area, specialties, social links, and verification state;
- aggregated upcoming schedule, recurring residencies, Venue history, and substitutions;
- booking availability, travel radius, event types, and inquiry path;
- first-party review and Room recap highlights;
- provider-neutral support links, wishlist collections, and clear recipient disclosures;
- ARPG-style gear inventory slots for microphone, mixer, speakers, display, lighting, controls, connectivity, and backup kit;
- owner controls for public/private gear items and desired/current status;
- Host-specific SEO, OG cards, and share actions.

Definition of done:

- a Host can publish a complete useful page without a developer or moderator editing raw data;
- schedule aggregation includes every approved assignment and excludes cancelled/private dates;
- support destinations are safe, attributable, and clearly external;
- profile completion and share conversion are measurable.

Persona gate: CPO, CMO, UX, Host, fan, and legal/support review.

### Slice 7 — Following, alerts, and availability activation

Outcome: convert discovery affinity into repeat attendance and Host opportunity.

Deliver:

- follow preferences for Host, Venue, and Night;
- alert types for new dates, schedule changes, cancellations, nearby Host availability, and weekly digest;
- in-app and email first; SMS remains feature-gated and consent-controlled;
- occurrence-created/changed/cancelled triggers with deduplication, quiet hours, frequency caps, and delivery history;
- “available for bookings” alerts constrained by geography and explicit Host consent;
- follower preference and unsubscribe controls;
- conversion metrics from follow to alert to detail view to RSVP.

Definition of done:

- following a Host can produce a configurable new-date alert;
- duplicate schedule writes cannot create duplicate alerts;
- cancellations and material time changes notify affected RSVPs and opted-in followers;
- users can understand and revoke every notification channel.

Persona gate: CTO reliability/privacy review; CPO and fan comprehension review; CMO lifecycle review.

### Slice 8 — Pacific Northwest supply automation

Outcome: expand trustworthy listings beyond the current immediate market without scaling manual work linearly.

Deliver:

- a source registry with permitted collection method, attribution, geography, cadence, and freshness policy;
- a normalized ingestion contract for Venue, Night, Host text identity, schedule evidence, and media candidates;
- deterministic source IDs and duplicate/entity resolution across existing BeauRocks, Google, Yelp, venue, Host, and community records;
- evidence confidence and queues for auto-approve, moderator review, and reject;
- schedule freshness checks, stale-state transitions, cancellation detection, and source-change diffs;
- media ingestion into the Slice 5 asset model rather than copying URLs into multiple fields;
- bounded dry-run/apply/rollback jobs and regional operator dashboards;
- launch waves:
  1. Seattle and Tacoma;
  2. Olympia and South Sound;
  3. Portland and Vancouver, Washington;
  4. Vancouver, British Columbia and Lower Mainland;
  5. Bellingham, Kitsap, Everett, and additional PNW clusters based on evidence.

Definition of done:

- imports are idempotent and cannot create duplicate public entities on replay;
- each public imported fact has source, observation time, and confidence;
- launch-market manual samples meet at least 95% schedule accuracy;
- stale or contradicted schedules leave active Discovery within the documented window;
- regional publishing can be paused independently without disabling existing Discovery.

Persona gate: CTO operational review; CPO trust review; CMO market-readiness review; moderator/regional-operator acceptance.

### Slice 9 — Discovery and regional acquisition surfaces

Outcome: turn the expanded graph into useful discovery rather than undifferentiated inventory.

Deliver:

- geo pages and Discovery filters that understand Venue, Host, Night, and time;
- one clear primary action per card based on state: directions, view Night, RSVP, or join Room;
- verified freshness, recurring cadence, Host identity, and BeauRocks capability badges;
- local internal linking between cities, Venues, Hosts, Nights, and upcoming Occurrences;
- region-level supply thresholds before indexing a page;
- useful empty/nearby alternatives when a city lacks inventory;
- Search Console, crawl, indexation, social-card, conversion, and listing-correction monitoring;
- region scorecards for coverage, accuracy, freshness, imagery, claims, follows, and RSVP activation.

Definition of done:

- each indexed geo page clears the approved useful-inventory threshold;
- no private, cancelled, ended, or unverified low-confidence listing leaks into anonymous results;
- representative mobile tasks pass for tonight, weekday, Venue, and Host discovery;
- regional organic traffic and correction rates can be segmented without exposing private data.

Persona gate: CMO acquisition approval; CPO search-task approval; CTO scale/privacy approval; fan acceptance.

### Slice 10 — Historical Vibe, momentum, and public Index launch

Outcome: create an addictive but defensible first-party reason to revisit Host and Venue pages.

Deliver:

- immutable daily or weekly Host, Venue, Night, and Occurrence metric snapshots;
- score version, component values, confidence, evidence counts, and metro/region percentile;
- 7-day and 30-day deltas plus a 90-day sparkline;
- Vibe and Momentum language that explicitly rejects business-value, revenue, and professional-worth interpretations;
- private claimed-entity diagnostics richer than the public projection;
- anomaly, self-attribution, ownership-change, revocation, minimum-evidence, and gaming controls;
- shadow comparisons across multiple independent markets and score versions;
- bands and confidence before exact public numbers;
- public cards, detail pages, geo pages, and OG images only after the executive publication gate;
- methodology, dispute, rollback, and version-change pages.

Definition of done:

- sufficient multi-night evidence exists across multiple independent Hosts and Venues;
- historical reruns do not use future evidence;
- score bands remain stable across reruns and ownership changes;
- no paid-plan or official-status advantage exists;
- one-target canary and rollback pass;
- CTO, CPO, CMO, and CEO explicitly approve the public claim language and exposure level.

Persona gate: full executive go/no-go. Exact numbers remain held if bands and trends are useful but precision is not yet defensible.

## Four release gates

### Gate A — Safe identity graph

Required slices: 1-3.

Customer promise unlocked: BeauRocks can accurately represent who owns a Venue, who manages it, and who Hosts each Night or date.

CEO decision: authorize management-experience work and compatibility migration; do not yet authorize regional auto-publishing.

### Gate B — Host and retention flywheel

Required slices: 4-7.

Customer promise unlocked: owners and Hosts can maintain compelling pages, while fans can follow and receive useful alerts.

CEO decision: authorize public Host growth beta in established markets.

### Gate C — PNW Discovery expansion

Required slices: 8-9 plus the relevant operating controls from the existing public-readiness roadmap.

Customer promise unlocked: people can reliably find current karaoke across approved PNW launch markets.

CEO decision: authorize market-by-market indexing and acquisition promotion, not a blanket regional switch.

### Gate D — Public historical Index

Required slice: 10 and completion of the existing Vibe v2 evidence/stability requirements.

Customer promise unlocked: people can see how verified Host and Venue activity is changing over time.

CEO decision: separately approve bands, trends, exact scores, and SEO exposure. Approval of one does not imply approval of all four.

## Program scorecard

The executive dashboard should report:

- schedule accuracy by market;
- active/stale/contradicted listing counts;
- duplicate and merge rates;
- claim completion, verification time, dispute rate, and ownership-transfer rate;
- profile completion and verified-media coverage;
- percentage of pages with a strong non-placeholder social image;
- Host follow, Venue follow, alert opt-in, delivery, click, RSVP, and unsubscribe rates;
- organic entrances and indexed useful geo pages by market;
- first-party review/check-in/recap evidence coverage;
- Vibe shadow eligibility, confidence, stability, anomaly, and rollback measures;
- moderator minutes per accepted listing and per corrected schedule.

North-star program metric:

> Verified upcoming karaoke Occurrences with a known Venue, accountable maintainer, current schedule, strong image, and at least one actionable fan path.

This is a better expansion metric than raw listing count because it measures useful supply.

## Explicit holds

Hold outside this program unless separately authorized:

- broad self-serve commercial activation;
- payout or marketplace economics for Host support;
- public exact Vibe scores before Gate D;
- direct scraping or source collection that violates provider terms;
- paid placement inside organic relevance or Vibe scoring;
- replacing stable Host Room/runtime systems while building public Host identity;
- expanding beyond the PNW waves before the earlier markets meet accuracy and operations thresholds.

## Proposed CEO decision

Approve:

1. the Venue -> Night -> Occurrence graph with explicit Host assignments;
2. memberships and invitations instead of claim-driven ownership replacement;
3. unified Venue/Host management and independent Host public pages;
4. provenance-aware rich media and incremental SEO-card generation;
5. configurable Host/Venue/Night following and schedule alerts;
6. market-gated PNW ingestion and geo-page expansion;
7. Vibe historical shadowing with a separate future decision for public numbers;
8. the ten numbered slices and four release gates in this packet.

Authorize Slice 1 as the immediate implementation slice.

Hold:

- PNW auto-publishing until Gate A;
- public Host growth promotion until Gate B;
- blanket regional indexing until Gate C;
- public Vibe numbers and SEO claims until Gate D.

## Immediate next action after approval

Begin Slice 1 with a bounded contract-and-regression change:

1. add failing tests for Host/manager claims that currently replace ownership;
2. introduce claim outcome and membership/assignment compatibility contracts;
3. correct Host management recognition and present-authority listing lookup;
4. remove product-status influence from Vibe scoring;
5. produce a migration preview with zero production writes;
6. return to the executive personas with test evidence, migration counts, remaining risks, and a Gate A recommendation before starting Slice 2.

