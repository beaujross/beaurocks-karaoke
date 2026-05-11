# YouTube Catalog Middle Ground

## Decision

We are taking a reuse-first approach instead of trying to brute-force daily YouTube quota consumption.

Implemented on May 10, 2026:

- extend durable successful YouTube search cache retention from `6h` to `72h`
- add an intent-level cache key so semantically equivalent karaoke searches can reuse the same verified result set
- keep empty-result persistence conservative by storing misses only on the exact query key

This lets the room build a practical operator catalog without turning every phrasing variation into a fresh `search.list` hit.

## CTO Persona

Primary concern: quota efficiency and operational safety.

- `search.list` remains the expensive step, so the right optimization is to reduce live search frequency rather than trimming `videos.list` depth.
- Intent-level cache reuse is low-risk because it only aliases successful result sets and still preserves exact-query miss behavior.
- `72h` is materially more useful for a solo operator than `6h`, while staying short enough that metadata and embeddability can still refresh naturally through normal use.

## Chief Product Officer Persona

Primary concern: fewer dead-end host flows and less repeated work.

- Hosts often reformulate the same request with slightly different punctuation, artist order, or filler words like `official` and `karaoke`.
- Reusing verified results across those variants makes the product feel more consistent and reduces the need to "hunt again" for the same backing.
- Exact misses remain exact so the product does not get stuck suppressing future successful searches after one bad query.

## Chief Marketing And Brand Officer Persona

Primary concern: the room should feel curated, premium, and increasingly "smart" over time.

- Returning the same proven backing for the same song request reinforces trust in the host brand.
- Faster repeated search resolution improves the perception that Beaurocks already "knows the room."
- This approach supports a house-catalog story without claiming offline ownership of YouTube media.

## Next Slice

If we want to push the strategy further without broad UI churn:

1. bias host review flows harder toward trusted room picks before any live search
2. surface a simple `known/proven backing` label more consistently across singer and host flows
3. add a refresh-on-use policy for long-lived approved picks so stable favorites revalidate naturally
