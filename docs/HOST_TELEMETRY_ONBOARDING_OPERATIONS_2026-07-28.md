# Host Onboarding Milestones and Usage Exposure

Last updated: 2026-07-28

## Purpose

This is the operating contract for expanded BeauRocks Host testing. The design intentionally reuses Host applications, organization usage meters, subscription records, and existing Firebase Analytics instead of creating a separate event warehouse or accounting system.

The product should feel selective without manufacturing scarcity, make onboarding legible to the Host, and expose enough usage information to spot operational risk without presenting modeled estimates as profit or loss.

## Deployment and Surfaces

One Vite bundle supplies Marketing, Host, Audience, Public TV, Help, and Recap. Firebase Hosting serves `dist`; Firebase Functions v2 in `us-west1` own privileged application, approval, workspace, Room, usage, billing, and email operations.

Host, Audience, and Public TV share the same Firestore Room state. Host-to-product communication remains separate from Room chat: Host Inbox, DM Host, and Tell Host are live-event tools, while access, onboarding, billing questions, bugs, and product feedback belong in the BeauRocks support email channel.

## Host Journey and Authoritative Milestones

The testing funnel has five decision-useful stages:

1. `appliedAt`: the application was received.
2. `approvedAt` / `inviteIssuedAt`: an admin selected the applicant for a cohort.
3. `workspaceActivatedAt`: `bootstrapOnboardingWorkspace` succeeded.
4. `firstRoomAt`: `provisionHostRoom` created the first distinct Room.
5. `secondRoomAt`: provisioning created a second distinct Room, proving repeat use.

These fields live inside `host_access_applications.milestones`. Workspace identity and the latest plan/status snapshot live in `hostAccountSnapshot` on the same application.

Only successful server workflows write activation and Room milestones. Client page views, Help visits, billing views, and onboarding-step views continue through ordinary product analytics when needed; they do not invoke a dedicated lifecycle Function.

No lifecycle profile, daily-event, deduplication, or TTL collection is required.

## Application Experience

The application asks only for:

- name and account email;
- intended Host type;
- an optional description of what the applicant wants to test.

Applicants are told that applications are reviewed personally and invitations are released in small testing cohorts. The UI does not show a numerical queue position because the underlying marketing counter is not Host-specific. Applying does not begin a subscription.

## Admin Funnel and Usage Exposure

The Marketing admin Host Applications section calls `getHostLifecycleReportingSummary`. Despite the compatibility name, it now reads only:

- up to 200 Host application documents;
- one existing organization usage document per represented workspace for the selected UTC month.

It displays:

- applications and approvals;
- workspace activations;
- first-Room and repeat-Room completion;
- Hosts with Room activity in the last 30 days;
- AI, YouTube, and Apple Music request counts;
- per-Host plan/status snapshots and usage units.

The report does **not** calculate revenue, provider cost, contribution, margin, or breakpoint labels. Request units are not interchangeable currencies and should not be summed into a financial total.

## Billing Boundary

Host-facing `Money > Billing & Usage` remains the source for plan state, request meters, safety limits, planning ranges, additional-capacity transactions, and available receipts.

Internal usage exposure is not an accounting ledger. Pricing or margin decisions require a separate reconciliation of payment settlement, refunds, taxes, provider invoices, Firebase/Google Cloud billing, storage, bandwidth, email, and support costs by stable `orgId` and accounting period.

Keep that future ledger separate from product analytics so changing a funnel definition cannot rewrite financial history.

## Release Order

This change crosses Functions and Hosting:

1. Run Functions lint and the Host access callable emulator suite.
2. Deploy Functions first so milestone and report behavior is live.
3. Build and deploy Hosting.
4. Run the applicant-to-repeat-Room smoke test below.

There is no new Firestore TTL or rules deployment requirement.

## Production Smoke Test

Use a non-admin applicant account and a separate admin account:

1. Submit an application and confirm receipt without a numerical queue claim.
2. Confirm the admin sees Host type and testing goal.
3. Approve the application and confirm the private invitation enters the existing outbound email pipeline.
4. Sign in as the approved Host and complete workspace setup.
5. Confirm the application records `workspaceActivatedAt`.
6. Create a private rehearsal Room and confirm `firstRoomAt`.
7. Create a second distinct test Room and confirm `secondRoomAt`.
8. Open Audience and Public TV to verify the shared Room flow.
9. Refresh the admin funnel and usage-exposure report.
10. Confirm no revenue, cost, contribution, or margin claim appears.

## When to Add More Instrumentation

Add a new event or data store only when all three are true:

1. a named product or operating decision depends on it;
2. existing application milestones, usage documents, Room data, or Firebase Analytics cannot answer it;
3. its write volume, retention, access model, and owner are documented.