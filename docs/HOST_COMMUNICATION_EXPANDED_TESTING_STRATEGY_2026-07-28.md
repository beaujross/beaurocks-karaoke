# Host Communication And Expanded Testing Strategy

Date: 2026-07-28  
Audience: CTO, Chief Product Officer, Chief Marketing Officer  
Status: Proposed executive plan

## Executive Decision

BeauRocks should open host applications now, but expand active host access in controlled waves rather than treating the wait list as an automatic path into production hosting.

The next operating milestone is not simply "more hosts." It is:

> A verified host can apply, be approved, learn what changed, ask for help, run a private test, report a problem, and receive a response without Beau having to reconstruct the conversation across email, room chat, Tell Host, and Firestore.

The strategy has two parallel tracks:

1. Build a durable host-to-BeauRocks communication layer for onboarding, updates, support, and testing.
2. Harden the live-room communication layer so lounge chat, participant DMs, co-host signals, and Public TV projections have clear security and product boundaries.

Recruitment may begin before both tracks are complete. Broader activation should not.

## Why This Matters Now

The repository already has the foundation for a controlled host beta:

- public host wait-list capture;
- application confirmation and admin notification email;
- an administrator review queue;
- approval and rejection decisions;
- approved-host and paid-plan access checks;
- Host Dashboard room provisioning;
- an outbound SMTP queue;
- room lounge chat, host DMs, co-host signals, and Public TV presentation controls.

The weakness is not lack of communication features. It is that several different communication jobs share ambiguous names, incomplete security boundaries, or no operational owner.

Expanded testing will amplify these problems:

- applicants will ask about status;
- newly approved hosts will need a reliable first-run path;
- testers will need release notes and known-issue notices;
- hosts will report setup failures before or during events;
- the product team will need searchable context rather than scattered replies;
- room participants will expect "DM" and "Tell Host" to be private;
- hosts will need to understand what can appear on Public TV;
- marketing will need applicant attribution, segmentation, and consent;
- engineering will need evidence that a reported problem came from a specific build, room, device, and workflow.

## Communication Taxonomy

The product should name and implement each communication lane according to its job.

| Lane | Participants | Lifetime | Privacy | Primary destination |
|---|---|---:|---|---|
| Host application | applicant and BeauRocks admissions | weeks | private | application record |
| Host updates | BeauRocks to approved hosts/testers | months | approved-host only | Host Hub |
| Host support | one host and BeauRocks product/support team | persistent | private | support thread |
| Testing assignment | BeauRocks to a testing cohort | release cycle | cohort-private | Host Hub |
| Room lounge | room participants and room host | one room/night | room-public | room chat |
| DM Host | one participant and that room's hosts | one room/night | private | room inbox |
| Tell Host | assigned co-host and primary operator | minutes | private/operational | urgent room inbox |
| TV message | host or approved public-room projection | seconds/minutes | intentionally public | Public TV |
| Product feedback | tester to product team | persistent | private | support/feedback record |
| Incident notice | BeauRocks to affected hosts | hours | segmented | Host Hub plus email |

No lane should silently fall through into another lane. In particular:

- room chat must never become product support;
- product support must not be stored in a room's chat history;
- DMs and Tell Host signals must not rely on client-side hiding for privacy;
- a Public TV projection must be explicitly public rather than "everything except known DMs";
- email should notify and recover, while the application remains the system of record.

## Host Communication Challenges By Journey Stage

### 1. Recruitment And Application

Host candidates need to understand:

- who BeauRocks is accepting;
- what testing participation requires;
- whether hosting is currently a beta or commercial offer;
- what equipment and time commitment are expected;
- what happens after applying;
- how long review may take;
- which email must be tied to their account.

Current gap:

- the form captures little more than email;
- queue position is not host-specific;
- campaign attribution is mutable and coarse;
- there is no application-open/paused state;
- rejected applications do not cleanly re-enter pending review;
- anonymous and signed-in applications can produce different records.

### 2. Approval And Account Activation

An approved host needs:

- proof that the approval belongs to their verified account;
- one clear sign-in and first-room action;
- a private-test checklist;
- build/device requirements;
- a named support destination;
- an explanation of beta expectations and data collection.

Current gap:

- email approval can unlock server access without verified-email enforcement;
- email invitations are not consistently converted into UID approvals;
- welcome guidance exists in email but not as a durable in-app checklist;
- manual approval overrides do not inherently send a welcome message.

### 3. Learning And Change Management

Hosts need to know:

- what changed since their last session;
- whether a feature is ready for real guests;
- known issues and workarounds;
- whether an update requires refreshing Host or Public TV;
- which workflows BeauRocks wants tested.

Current gap:

- the public changelog is hardcoded and stale;
- it is not segmented to approved hosts or testers;
- the Host portal release brief is not rendered;
- there are no read receipts, targeting, expiry, or severity levels.

### 4. Support And Product Feedback

Hosts need a low-friction way to report:

- room-launch or login failure;
- TV/display trouble;
- join or queue friction;
- bad media/backing behavior;
- billing or access questions;
- feature ideas;
- an urgent live-night problem.

The product team needs:

- host UID and organization;
- room code when applicable;
- app build and surface;
- browser/device details;
- problem category and severity;
- timestamps;
- screenshots or attachments;
- reply history;
- resolution status.

Current gap:

- approval email replies remain ordinary mailbox threads;
- audience feedback writes into a Firestore collection with no in-product review/reply workflow;
- live room DMs do not reach BeauRocks;
- no support SLA, assignment, status, or searchable conversation exists in the product.

### 5. Live-Room Communication

The operator needs:

- passive awareness of lounge conversation;
- a prioritized inbox for actionable participant messages;
- private participant DMs;
- low-noise co-host signals;
- explicit control over what appears on TV;
- moderation and abuse controls.

Current gap:

- DM privacy is implemented by client filtering over publicly readable records;
- chat policy and rate limits are primarily client-enforced;
- message deletion and durable moderation are absent;
- users can provide untrusted host/display fields;
- Tell Host writes conflict with checked-in Firestore rules;
- Tell Host activity can be rendered on Public TV;
- several duplicated controls change TV chat behavior;
- some presets say chat is enabled while selecting activity-only presentation.

## Strategic Product Model

### The Host Hub

Create one approved-host destination inside the Host surface. It should be available before a room is opened and persist across all rooms.

Initial navigation:

1. **Updates**
   - product announcements;
   - release notes;
   - known issues;
   - maintenance and incident notices;
   - testing requests;
   - "new since your last visit."

2. **Support**
   - start a thread;
   - reply to BeauRocks;
   - attach context;
   - see open/waiting/resolved status;
   - receive an email when staff replies.

3. **Testing**
   - current cohort assignment;
   - checklist and scenarios;
   - due date or testing window;
   - submit structured results;
   - see acknowledged issues and workarounds.

4. **Getting Started**
   - account verified;
   - profile/workspace ready;
   - test room created;
   - Public TV opened;
   - phone joined;
   - first queue item completed;
   - feedback submitted.

### Host Hub Roles

- `host`: reads applicable updates and owns support threads.
- `tester`: receives testing assignments and pre-release notices.
- `host_admin` or organization owner: sees organization-level support context.
- `support_staff`: reads/replies/assigns threads.
- `product_staff`: publishes updates and testing assignments.
- `super_admin`: manages access, escalations, and incident notices.

Approved-host access should resolve to one canonical verified UID before the Host Hub is available.

### Recommended Data Boundaries

Suggested conceptual records:

- `host_announcements`
- `host_announcement_reads`
- `host_support_threads`
- `host_support_threads/{threadId}/messages`
- `host_test_cohorts`
- `host_test_assignments`
- `host_test_submissions`
- `host_onboarding_progress`

Room communications should remain separate:

- `room_chat_messages` for room-public lounge messages;
- `room_host_threads` or recipient-scoped room DMs;
- `room_cohost_signals` for short-lived operational alerts;
- `room_public_message_projection` for content explicitly approved for TV.

The exact collection structure may change during technical design. The boundary should not.

## Email Strategy

Email is required, but it should not be the only place where host relationships live.

Use email for:

- application receipt;
- application decision;
- account verification;
- onboarding reminder;
- unread Host Hub reply;
- urgent incident or maintenance notice;
- testing-window reminder;
- digest of unread updates.

Do not use email as the only source of truth for:

- approval status;
- host access;
- support-thread state;
- testing completion;
- release-note history;
- incident acknowledgement.

Operational decisions:

1. Confirm `hello@beaurocks.app` as the monitored sender and reply destination.
2. Decide whether `hello@beauross.com` remains a supported legacy address.
3. Set an explicit reply-to policy for every template.
4. Add delivery-failure visibility for application, approval, support, and incident messages.
5. Treat inbound replies as mailbox fallback until inbound-email threading is intentionally implemented.

## Live-Room Communication Architecture

### Room Lounge

- readable only by current room participants and room hosts unless the room explicitly makes it public;
- writable only by a joined, eligible participant;
- server-enforced chat enabled/VIP/slow-mode/mute/rate-limit policy;
- messages may be projected to TV only through public-safe fields;
- host badges derived from trusted room roles.

### DM Host

- readable only by the sending participant and authorized room hosts;
- queryable as a real participant-host thread;
- never included in Public TV queries;
- supports host reply, unread state, and resolution/dismissal;
- retention disclosed and bounded.

### Tell Host

- available only to assigned co-hosts or room hosts;
- written through a server-validated callable or tightly scoped rules;
- intentionally limited to urgent operational categories;
- short retention and aggressive deduplication/cooldown;
- visible in the Host Inbox and optional operator toast;
- never written into the Public TV activity feed.

### Public TV

Public TV should consume an explicit public projection. It should never download private messages and filter them locally.

Host controls should converge on:

- `Audience chat on/off`;
- `Show audience chat on TV`;
- `TV chat layout: sidebar / fullscreen`;
- `Show activity instead of chat`;
- `Clear TV message`;
- `Send host announcement to TV`.

Setup presets may provide defaults, but only one live control surface should own runtime switching.

## Expanded Testing Program

### Wave 0: Owner And Internal Canary

Cohort:

- Beau and internal/admin accounts.

Purpose:

- establish the Host Hub skeleton;
- validate canonical verified-host identity;
- harden room chat privacy;
- confirm email delivery and reply routing;
- create operational dashboards and runbooks.

Exit gates:

- application-to-UID approval is deterministic;
- room DMs are not publicly readable;
- Tell Host passes delivery and non-TV-leak tests;
- one support thread can be opened, answered, and closed;
- one targeted update can be published and acknowledged;
- security-rule tests cover every communication lane.

### Wave 1: Design Partners

Cohort:

- 3-5 trusted hosts with direct relationships and varied devices/use cases.

Purpose:

- observe onboarding;
- validate terminology;
- measure support burden;
- test one private room per host;
- exercise updates, support, and incident communication.

Operating cadence:

- personal kickoff;
- one structured private test;
- weekly update;
- 48-hour response target for normal support;
- same-day response target during an agreed testing window;
- short post-test interview.

Exit gates:

- all hosts complete the first-room checklist;
- no host requires database/manual intervention to regain access;
- support threads preserve sufficient diagnostic context;
- critical issues are acknowledged through one system;
- no private room communication appears on TV or to another participant.

### Wave 2: Structured Beta

Cohort:

- 10-15 approved hosts segmented by home party, private event, venue/KJ, and fundraiser use case.

Purpose:

- test repeat use;
- validate cohort targeting;
- measure self-service success;
- identify operational load;
- validate marketing source and applicant quality.

Operating cadence:

- in-app weekly digest;
- cohort-specific test assignment;
- office-hours window;
- structured release feedback;
- automated inactivity and incomplete-onboarding reminders.

Exit gates:

- target first-room and second-room completion rates are met;
- support volume per active host is sustainable;
- incident and known-issue notices reach affected hosts;
- application and approval reporting is reliable;
- marketing can distinguish applicants, approved hosts, activated hosts, and repeat hosts.

### Wave 3: Expanded Beta

Cohort:

- 25-50 hosts admitted in scheduled batches.

Purpose:

- test support scalability;
- test asynchronous onboarding;
- validate documentation and product-led recovery;
- validate real event usage within explicit beta limits.

Requirements:

- published beta terms and expectations;
- documented support coverage;
- host-status and incident dashboard;
- clear escalation path;
- rollback/disable mechanism for risky features;
- automated cohort and communication segmentation;
- privacy and moderation controls treated as production boundaries.

### Wave 4: General Host Availability

This is a commercial/product launch stage, not merely a larger test.

It requires:

- stable paid entitlement and downgrade behavior;
- production support commitments;
- self-service onboarding;
- operational analytics;
- abuse and moderation readiness;
- current public documentation;
- accurate marketing claims;
- a deliberate migration plan for approved-host overrides.

## Readiness Gates

### Gate A: Identity And Access

- applicant email ownership verified;
- one canonical UID per approved host;
- email approvals redeemed to UID approval;
- application records deduplicated;
- rejection and reapplication states are explicit;
- approval, suspension, and revocation are audited;
- manual overrides have notification and expiry policy.

### Gate B: Host Communication

- approved-host Updates area exists;
- support threads support two-way replies;
- email notification links return to the correct authenticated destination;
- incident notices can target cohorts;
- read/unread and acknowledgement states exist;
- staff ownership and response expectations are documented.

### Gate C: Room Communication Safety

- lounge, DMs, Tell Host, and TV projection use separate authorization rules;
- DMs are private below the UI layer;
- only assigned roles can send Tell Host signals;
- host identity cannot be spoofed;
- chat policy is server enforced;
- moderation actions and retention are defined;
- Public TV consumes only public-safe records.

### Gate D: Onboarding Quality

- approved host receives a durable checklist;
- first test room can be completed without manual database work;
- known issues and device expectations are visible;
- first-run analytics identify abandonment;
- feedback can be tied to build, surface, room, and host.

### Gate E: Operational Readiness

- failed email delivery is visible;
- support backlog and age are visible;
- active hosts and active testing cohorts are reportable;
- release and incident communications have an owner;
- the team can pause applications, approvals, or cohort activation independently;
- escalation and rollback runbooks exist.

### Gate F: Marketing Readiness

- application source and campaign attribution are immutable;
- consent and beta expectations are captured;
- the applicant funnel distinguishes submitted, qualified, approved, activated, and repeat;
- capacity and review-time copy is accurate;
- rejection/waiting communications preserve trust;
- public claims match the currently enabled host tier.

## Metrics

### Acquisition

- host application conversion rate;
- qualified-application rate;
- application source by campaign;
- median review time;
- approval rate;
- applicant email delivery failure rate.

### Activation

- approval-to-first-sign-in;
- approval-to-first-room;
- first-room checklist completion;
- first private test completion;
- time to second room;
- onboarding abandonment step.

### Communication

- update reach and read rate;
- incident acknowledgement rate;
- support first-response time;
- support resolution time;
- reopened-thread rate;
- percentage of support reports with automatic diagnostics;
- email-to-in-app handoff success.

### Live-Room Quality

- chat send failure rate;
- DM delivery/read latency;
- Tell Host delivery latency;
- private-message exposure incidents;
- moderation actions per room;
- TV projection errors;
- hosts who disable chat after initially enabling it.

### Program Health

- weekly active test hosts;
- rooms per active host;
- repeat-host rate;
- support contacts per active host;
- critical defects per host-night;
- cohort completion and retention.

## Ownership

### CTO

Accountable for:

- canonical identity and authorization;
- secure communication boundaries;
- data model and migration;
- delivery observability;
- incident controls;
- automated security and integration tests.

### Chief Product Officer

Accountable for:

- communication taxonomy and terminology;
- Host Hub experience;
- onboarding checklist;
- support workflow;
- cohort design;
- readiness gates and go/no-go recommendation.

### Chief Marketing Officer

Accountable for:

- applicant promise and targeting;
- application form and qualification questions;
- campaign attribution;
- lifecycle messaging;
- cohort invitation cadence;
- funnel reporting and expectation management.

### BeauRocks Owner / Operating Lead

Accountable for:

- approval decisions;
- support coverage commitment;
- update and incident voice;
- cohort capacity;
- escalation decisions;
- final activation authorization.

## Prioritized Roadmap

### P0 - Before Activating Additional Hosts

1. Require verified identity and convert email approval to UID approval.
2. Fix application deduplication and reapplication states.
3. Secure room DMs below the client layer.
4. Move Tell Host out of public activities and make its write path valid.
5. Prevent all private communication from reaching Public TV.
6. Confirm the monitored BeauRocks sender/reply mailbox.
7. Replace stale host wait-list browser QA with the current flow.
8. Add end-to-end coverage: application -> approval -> verified account -> first room.

### P1 - Before Wave 1

1. Ship a small Host Hub with Updates, Support, and Getting Started.
2. Add structured diagnostics to support creation.
3. Add staff reply and thread status.
4. Add targeted email notification for replies and urgent updates.
5. Consolidate TV chat runtime controls.
6. Define message moderation and retention.
7. Publish the private-test checklist and beta expectations.

### P2 - Before Wave 2

1. Add testing cohorts and assignments.
2. Add host announcement targeting and read state.
3. Add funnel and support dashboards.
4. Add application qualification fields and immutable attribution.
5. Add application pause/capacity controls.
6. Add known-issue and incident workflows.
7. Automate onboarding and inactivity reminders.

### P3 - Before Wave 3

1. Add support assignment, escalation, and service-level reporting.
2. Add richer attachments and diagnostic bundles.
3. Add cohort-level experimentation and segmentation.
4. Add organization-level support visibility.
5. Prove moderation, privacy, and incident response under load.
6. Review beta terms, data retention, and public claims.

## Executive Persona Review

### CTO Perspective

Recommendation:

> Approve recruitment, but block expanded activation on Gate A and Gate C.

The largest technical risk is not feature completeness. It is that identity and privacy are inconsistent across email approvals, UID rules, room DMs, co-host signals, and Public TV. Adding more hosts before resolving these boundaries will create security risk and expensive support archaeology.

CTO decisions required:

- approve canonical verified-UID host identity;
- approve separate private/public room communication records;
- choose callable versus rules-owned message writes;
- require communication security tests in the release gate;
- name the operational owner for email and support delivery failures.

### Chief Product Officer Perspective

Recommendation:

> Make the Host Hub the relationship surface and the Host Inbox the live-room surface.

The primary product risk is asking hosts to understand the application's internal architecture. Hosts should see one persistent place for BeauRocks updates/support and one room-specific inbox while operating. "DM," "Tell Host," "announcement," and "TV chat" must correspond to distinct promises.

CPO decisions required:

- approve the communication taxonomy;
- define the minimum Wave 1 Host Hub;
- approve the onboarding checklist and beta obligations;
- define urgency and escalation semantics;
- own wave exit criteria and the activation go/no-go.

### Chief Marketing Officer Perspective

Recommendation:

> Begin applicant acquisition now, but market a limited, reviewed testing program rather than open host availability.

The current wait-list path can collect demand, but marketing should not imply immediate access, commercial readiness, or guaranteed response times. Recruitment should intentionally populate use-case cohorts and set expectations about private testing and feedback participation.

CMO decisions required:

- approve the "applications open for limited host testing" positioning;
- choose qualification questions and target cohorts;
- define campaign and referral attribution;
- define application capacity and review-time copy;
- establish lifecycle messaging from application through second room.

## Joint Executive Decisions

The CTO, CPO, and CMO should jointly approve:

1. Recruitment may open immediately.
2. New host activation remains batch-controlled.
3. Wave 1 is limited to 3-5 design partners.
4. Verified UID identity is the canonical host identity.
5. Host Hub communications and room communications remain separate systems.
6. Private room communication will be private at the database/API layer.
7. Public TV will consume only explicit public projections.
8. Gate A, Gate B, and Gate C must pass before Wave 1.
9. Cohort size increases only after the prior wave's exit gates are reviewed.
10. The owner names a monitored support mailbox and response commitment before invitations are sent.

## Recommended Immediate Sequence

Week 1:

- approve taxonomy, cohort promise, and Wave 1 size;
- confirm mailbox and applicant messaging;
- write technical designs for identity conversion and room communication separation;
- update the application/reapplication contract and tests.

Week 2:

- implement identity and room communication P0 fixes;
- create Host Hub read-only Updates and Getting Started;
- create support thread foundation;
- update wait-list end-to-end QA.

Week 3:

- finish staff replies, email notifications, diagnostics, and TV-safe projection;
- run Wave 0;
- publish the private-test checklist and known issues.

Week 4:

- invite 3-5 Wave 1 design partners;
- observe every onboarding session;
- run at least one private room per host;
- review metrics, support load, and privacy evidence before Wave 2 planning.

## Final Recommendation

BeauRocks is ready to recruit more host applicants. It is not yet ready to activate a large number of additional hosts.

The correct next move is a controlled design-partner program supported by:

- verified host identity;
- one persistent Host Hub;
- one live Host Inbox;
- secure room communication boundaries;
- explicit Public TV projection;
- measurable wave-based readiness gates.

This approach lets Marketing build demand now, Product learn with real hosts soon, and Engineering protect the system before communication ambiguity becomes operational debt.
