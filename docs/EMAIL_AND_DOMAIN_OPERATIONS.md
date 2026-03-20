# Email And Domain Operations

Operational notes for BeauRocks email delivery, custom-surface routing, and related production gotchas.

## Current Email Delivery Model

There are two distinct email paths in this repo:

1. Firebase Auth-managed emails
- Email link sign-in: `src/hooks/usePasswordlessAuth.js`
- Password reset: `src/apps/Marketing/hooks/useDirectorySession.js`
- These are sent by Firebase Auth, not the BeauRocks SMTP sender.

2. BeauRocks-managed SMTP emails
- Queue collection: `outboundMessages`
- Internal webhook: `emailReminderWebhook` in `functions/index.js`
- Sender trigger: `sendOutboundEmail` in `functions/index.js`
- Shared HTML shell: `buildBeauRocksEmailHtml(...)` in `functions/index.js`
- Template registry: `buildEmailTemplatePayload(...)` in `functions/index.js`

## SMTP + Webhook Setup

Production uses first-party queueing on `beaurocks.app`:

- Hosting rewrite: `/api/reminder-email` -> `emailReminderWebhook`
- The webhook writes normalized email jobs into `outboundMessages`
- `sendOutboundEmail` sends via nodemailer + Gmail SMTP
- Delivery status is written back to the same Firestore message doc

Required Functions secrets:

- `REMINDER_EMAIL_WEBHOOK_URL`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Relevant env:

- `SUPER_ADMIN_EMAILS`

Recommended sender account:

- `hello@beaurocks.app`

## Live Repo-Backed Outbound Emails

SMTP-backed emails currently implemented in `functions/index.js`:

- Host application created admin alert
- Host application resubmitted admin alert
- Host application approved applicant email
- Host application rejected applicant email
- Directory reminder emails
- Generic webhook-driven emails posted to `/api/reminder-email`

## Host Application Alert Behavior

Important behavior for `host_access_applications`:

- First submission creates the document and triggers `notifyOnHostApplicationCreated`
- Repeat submissions update the existing record and trigger `notifyOnHostApplicationResubmitted` when `submissionCount` increases
- Admin review changes alone should not be treated as resubmissions

Collections to inspect when debugging:

- `host_access_applications`
- `host_application_notifications`
- `outboundMessages`

## Shared Email Branding

The shared HTML shell is designed to stay close to the marketing site visual system.

Branding details:

- Logo asset: `public/images/logo-library/beaurocks-logo-neon trasnparent.png`
- Hosted logo URL should resolve from `https://beaurocks.app/images/logo-library/beaurocks-logo-neon%20trasnparent.png`
- Display font target: `Bebas Neue`
- UI/body font target: `Plus Jakarta Sans`
- Link color is explicitly styled in-template so clients do not fall back to default dark blue

Important note:

- Email clients may not render custom fonts exactly like the website, so the template should be judged as "close to marketing" rather than pixel-identical.

## Email Smoke Testing

Safe production verification path:

1. POST a test payload to `/api/reminder-email`
2. Confirm the response returns `{ ok: true, messageId }`
3. Inspect `outboundMessages/{messageId}`
4. Expect:
- `status = sent`
- `provider = smtp`
- `providerMessageId` populated

Useful checks:

- Webhook accepted but not sent: inspect `lastError`
- SMTP auth failures: expect Gmail `535 5.7.8`
- Missing sender configuration: message may be marked `failed_config`

## Custom Domain Routing Gotchas

Firebase Hosting currently redirects `/` to `/for-fans` in `firebase.json`.

That is fine for the marketing surface, but it creates a production edge case on custom interactive surfaces:

- `host.beaurocks.app`
- `tv.beaurocks.app`

Because the browser can be redirected to a marketing-looking path, client boot must prioritize explicit interactive intent over pathname alone.

The routing rule in `src/App.jsx` should continue to prefer, in this order:

- `mode=host`
- `mode=recap`
- `mode=tv`
- explicit host dashboard paths
- any `room=...` launch
- only then marketing path detection like `/for-fans`

This avoids loops and misclassification such as:

- host login bouncing between `host.beaurocks.app` and `beaurocks.app`
- TV launch URLs like `tv.beaurocks.app/for-fans/?mode=tv&room=CODE` opening the marketing homepage instead of `PublicTV`

## Host Auth Bridge Note

Host auth can intentionally land on the marketing surface first. If the intent is an authenticated host resume, the marketing host-access page should immediately hand off to `host.beaurocks.app` rather than waiting for a second manual click.

If this regresses, inspect:

- `src/App.jsx`
- `src/apps/Marketing/MarketingSite.jsx`

## Hosting Asset Cache Note

To avoid stale chunk failures on custom domains:

- `/assets/**` should not be long-cache immutable
- current policy is `Cache-Control: public, max-age=0, must-revalidate`

This prevents old hashed JS URLs from getting cached as HTML and breaking module boot with MIME-type errors.
