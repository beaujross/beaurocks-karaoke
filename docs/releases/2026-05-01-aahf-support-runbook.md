# AAHF Support Runbook

Date: May 1, 2026
Room: `AAHF`
Purpose: keep guest and host recovery fast during tonight's event

## Support Roles

- Host support: handles host login, queue, media, and TV control issues.
- Guest support: handles join, queue request, and mobile load issues.
- Incident scribe: records time, symptom, workaround, and escalation.

## Fast Triage

Ask these first:

1. Is this a guest issue, host issue, or TV issue?
2. Is it happening to one person or many people?
3. Is the person on venue Wi-Fi or cellular?
4. What exact screen are they on?
5. What exact button or action failed?

## Common Incidents

### Guest Cannot Join

Check:

- room code entered is `AAHF`
- QR code resolves to the live join path
- guest refreshes once
- guest retries after 10 seconds
- if venue Wi-Fi seems overloaded, try cellular

Escalate to CTO if:

- multiple guests fail at once
- many guests on the same Wi-Fi are blocked
- join failures continue after refresh and retry

### Guest App Loads Slowly or Looks Stuck

Ask guest to:

- refresh once
- close and reopen browser
- switch from venue Wi-Fi to cellular if possible

Escalate if:

- multiple people report the same stall
- the issue affects both Wi-Fi and cellular

### Host Cannot Access Media or Stage Controls

Try:

- refresh the host panel
- reopen the room
- use room settings and existing saved scenes if the stage media launcher is unreliable

Escalate to CTO if:

- the host cannot control playback
- the room becomes operationally blocked

### Queue Confusion

Clarify:

- singer queue is for performances
- TV scenes and show moments are run-of-show items, not singer queue items

If needed, route all live show/media actions through the host only.

### TV Not Updating

Try:

- refresh the TV display once
- confirm host room state is still live

Escalate if:

- TV remains stale after refresh
- host changes do not propagate to TV

## Messaging Templates

### Guest Retry Message

`We're live. If the join screen stalls, refresh once and retry in 10 seconds. If venue Wi-Fi is crowded, try cellular.`

### Host Recovery Message

`Stay on the live host room. If a control stalls, refresh once and reopen the room. If media actions still fail, use the fallback host path and escalate immediately.`

### Escalation Message To CTO

`AAHF production issue. Time: <time>. Surface: <guest/host/tv>. Symptom: <symptom>. Scope: <one user/many users>. Network: <wifi/cellular>. Immediate workaround tried: <workaround>.`

## Incident Log Format

- Time:
- Surface:
- Scope:
- Symptom:
- Network:
- Workaround tried:
- Outcome:
- Escalated to:
