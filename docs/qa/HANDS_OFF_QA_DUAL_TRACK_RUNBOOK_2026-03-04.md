# Hands-Off QA Dual-Track Runbook (2026-03-04)

Purpose:
- Run deterministic golden-path QA as a release gate.
- Run exploratory Agent-mode QA to discover non-obvious breakage.

## Track A: Scripted Golden Path (Gate)

Recommended secure run (no plaintext password in shell history):

```powershell
npm run qa:golden:host-room-hands-off:secure
```

The secure runner:
- prompts for email
- prompts for password with hidden input
- injects credentials only into the child process
- blocks known super-admin emails by default

Optional policy hardening:
- set `QA_ALLOWED_HOST_EMAILS` to enforce dedicated QA-only account(s)
- set `QA_BLOCKED_HOST_EMAILS` for additional denylist

Example (persist allowlist only, no password):

```powershell
setx QA_ALLOWED_HOST_EMAILS "qa-host@yourdomain.com"
```

Legacy env-based run (less secure, avoid for shared terminals):

```powershell
$env:QA_HOST_EMAIL="host-account-email"
$env:QA_HOST_PASSWORD="host-account-password"
```

Run:

```powershell
npm run qa:golden:host-room-hands-off
```

What it validates:
1. Root-domain host login
2. Host room creation
3. Automations on
4. TV load + QR + room code
5. Audience join
6. Host request and sync to TV
7. Audience request and sync to host + TV

If this fails: treat as release blocker.

## Track B: Agent-Mode Exploratory QA

Generate a ready-to-paste mission brief:

```powershell
npm run qa:agent:brief
```

Output file:
- `tmp/qa-agent-mode-brief.md`

Use it:
1. Open ChatGPT Agent mode.
2. Paste `tmp/qa-agent-mode-brief.md`.
3. Let agent browse and report findings in the required table format.

## Combined Workflow

Run scripted gate, then generate exploratory brief:

```powershell
npm run qa:dual:hands-off
```

## Severity Guidance

High:
- Broken login/create room
- Host/audience/TV queue desync
- Request accepted but disappears on another surface
- Blank/crash/deadlock in golden flow

Medium:
- Recoverable UI state errors, broken toggles, stale state until refresh

Low:
- Copy/layout inconsistencies without functional impact
