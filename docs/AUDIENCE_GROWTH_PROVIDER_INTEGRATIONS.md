# Audience growth integrations

This slice separates verified actions, explicit self-attestation, and useful outbound links. Currency is never granted by opening a provider link alone.

## Live and safe now

| Action | Verification | Reward |
| --- | --- | --- |
| Create a BeauRocks account and verify email | Firebase Auth plus the existing idempotent VIP claim | 5,000 Points once |
| Self-attested Facebook or Instagram follow | Verified BeauRocks account plus an account-global idempotent claim | 250 Points once |
| Share a room invite | Client share telemetry | No automatic currency |
| Share a published room recap | Client share telemetry | No automatic currency |
| YouTube channel visit or subscription | Outbound link only | No currency |

The audience currency hub presents the verified-email offer. A completed room exposes its recap in the same hub, and the recap itself has native-share, copy-link, and “Start your own room” actions.

## Deferred Meta webhook

A Meta app is not required for the initial Community Boost. The `metaGrowthWebhook` foundation remains available for a later provider-connection or event-measurement phase, but should remain undeployed until BeauRocks has a concrete need for reviewed Meta permissions.

If that phase is activated:

1. Create a Meta app and add the products required for the BeauRocks Facebook Page and Instagram professional account.
2. Set Firebase secrets `META_APP_SECRET` and `META_WEBHOOK_VERIFY_TOKEN`.
3. Deploy `metaGrowthWebhook`.
4. Register its HTTPS URL as the Meta callback and enter the same verification token.
5. Subscribe only to fields approved for the connected Page or Instagram account.
6. Complete App Review before enabling production subscriptions that require reviewed permissions.

POST requests require Meta's `x-hub-signature-256`. Accepted event metadata is normalized into `audience_growth_provider_events`. External actor IDs are HMAC-hashed; message/comment text and usernames are not stored. Events are idempotent and explicitly marked `not_awarded`.

A provider connection would improve measurement, comments, and mentions. It should not silently replace the explicit honor-system language or scrape profiles.

## YouTube boundary

BeauRocks can link to its YouTube channel and may later use an OAuth-authorized account connection for allowed account features. It must not award Points or BeauBucks for watching, liking, sharing, commenting, or subscribing. YouTube's API policies and Subscribe Button conditions prohibit incentivizing those actions:

- https://developers.google.com/youtube/terms/developer-policies
- https://developers.google.com/youtube/subscribe/conditions-of-use

The server policy matrix therefore marks `youtube_subscribe` and `youtube_like` as prohibited reward actions.

## Next provider slice

Official BeauRocks destinations:

- Facebook: https://www.facebook.com/BeauRocksKaraoke
- Instagram: https://www.instagram.com/beaurockskaraoke/
- YouTube: https://www.youtube.com/channel/UCkWxI2CivAk52-l9zXofrKA

These links are acquisition destinations, not reward authorities.

- Add consented recap-email preferences to BeauRocks accounts.
- On public recap publication, queue one recap email per opted-in participant through the existing outbound-email system.
- Keep room invites non-monetized. The separate host referral program qualifies only after an approved referred host becomes a paying BeauRocks subscriber.
- If Meta is activated later, build an admin event viewer for `audience_growth_provider_events` before using reviewed events operationally.
