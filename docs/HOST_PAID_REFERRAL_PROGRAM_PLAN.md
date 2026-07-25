# BeauRocks paid-host referral program

## Product boundary

The referral program belongs to the BeauRocks host account and subscription lifecycle. It is not a Facebook campaign, an audience room-invite reward, a Points faucet, or a BeauBucks promotion.

Facebook, Instagram, YouTube, email, QR codes, and direct messages may help distribute a referral link. BeauRocks remains the authority for who referred the prospective host, whether that host was approved, whether a qualifying paid subscription was collected, and whether a reward is available.

## Invite-only contract

- Only an approved BeauRocks host with an eligible account may own a referral code.
- A referred applicant still enters the normal approval queue. A referral never bypasses host review.
- Referral attribution is captured before or during the host application and becomes immutable once the application is approved.
- The referring host earns nothing for a click, room join, email capture, application, approval, trial, or failed payment.
- Qualification starts only after BeauRocks receives a server-verified paid subscription event.

## Recommended lifecycle

1. `invited`: a provider-neutral referral code or signed link was opened.
2. `applied`: the candidate submitted the approval-only host application.
3. `approved`: BeauRocks approved the candidate for host access.
4. `subscribed`: Stripe reports the candidate's first successful host-subscription payment.
5. `pending`: the payment remains inside the configured refund/chargeback hold.
6. `qualified`: the hold passed and the subscription is still eligible.
7. `rewarded`: a server-side reward grant was applied once.
8. `reversed`: a refund, dispute, duplicate identity, or policy violation invalidated the grant.

## Recommended first reward

Use BeauRocks subscription credit, not room Points or BeauBucks.

The amount should remain server-configurable until host pricing and first-month gross margin are final. The safe default is:

- reward only the referring host;
- grant after a 30-day hold;
- cap the reward at the lower of the configured referral amount or the referred host's first net subscription payment;
- apply the credit to a future BeauRocks invoice;
- no cash withdrawal or transfer;
- one reward per newly paying host account.

This keeps the program valuable without turning BeauRocks into a bank or allowing a reward to exceed collected revenue.

## Server authority

Suggested collections:

- `host_referral_codes/{code}`: owner UID, eligibility, creation and revocation state.
- `host_referrals/{referralId}`: referrer UID, candidate identity, attribution, lifecycle, and qualification evidence.
- `host_referral_reward_grants/{grantId}`: idempotent reward operation and Stripe credit reference.
- `host_referral_program_config/current`: qualification window, reward type, amount cap, campaign dates, and abuse limits.

All transitions should be written by callable functions, approval functions, or Stripe webhooks. Client code can display status but cannot qualify or grant a reward.

## Attribution

The canonical invite should resemble:

`https://beaurocks.app/host-access?ref=HOSTCODE`

UTM fields may record the distribution channel, such as Facebook, Instagram, YouTube, email, or direct. They never determine reward ownership. The immutable BeauRocks referral code does.

Use first-touch attribution before application submission. Permit the candidate to remove a referral before submitting, but do not allow silent last-click overwrites after submission.

## Abuse and cost controls

- Referrer and candidate must be different authenticated accounts.
- Normalize and compare verified email, Stripe customer, payment method fingerprints where permitted, and other server-side risk signals.
- Reject self-referrals and repeated subscriptions for a previously paying host.
- Require a successful non-refunded payment and configurable hold.
- Enforce per-referrer monthly and lifetime qualification caps.
- Record manual reversals and appeals rather than deleting ledger history.
- Do not disclose sensitive fraud signals in the client.

## Host experience

Add an `Invites & rewards` area to the authenticated Host account:

- personal link and copy/share button;
- plain-language qualification rule: “Earn when an approved host becomes a paying subscriber”;
- invited, applied, approved, pending, and earned counts;
- estimated pending date;
- reward history and reversals;
- terms link.

The application form should recognize a valid referral without making the applicant feel pre-approved.

## Implementation slices

1. Confirm reward unit, amount cap, hold, monthly cap, and program terms.
2. Add referral policy/model helpers and emulator tests.
3. Capture immutable referral attribution on the host application.
4. Issue referral codes only to eligible approved hosts.
5. Connect approval and Stripe subscription events to the lifecycle.
6. Add an idempotent subscription-credit grant and reversal path.
7. Build the Host `Invites & rewards` UI and admin audit controls.
8. Run a small invite-only canary before opening the program to every paid host.
