# Game Design Guardrails

## Product Intent

- Keep the room moving quickly.
- Maximize shared fun over individual optimization.
- Reward participation, not only skill.
- Minimize host cognitive load during live operation.
- Make mistakes reversible (undo-first design).

## Social Behavior Targets

- Encourage cheering, playfulness, and inclusive participation.
- Discourage pile-ons, humiliation, and exclusion.
- Keep competitive mechanics "lightweight rivalry," not hostility.
- Favor mechanics that re-invite disengaged players quickly.

## Design Principles

- `Clarity over cleverness`: every major action should have obvious outcome.
- `Fast path + safe guardrails`: quick actions need undo/confirm patterns.
- `Host confidence`: host must understand state at a glance.
- `Recovery`: if an action fails, user gets next best step immediately.
- `Low friction`: avoid multi-step flows for common live actions.

## System Layer Rule

- Treat game modes and cross-cutting social systems as separate design layers.
- A mode decision cannot silently redefine global social mechanics (voting, queue, economy, moderation) without explicit log entry.

## Anti-Goals

- No mechanics that shame low performers.
- No hidden state transitions without visible indicators.
- No irreversible actions without explicit intent.
- No long blocking workflows during live moments.

## Decision Rules (For Future Changes)

1. If a feature increases speed but raises accidental actions:
   - keep speed, add undo.
2. If a feature increases control but slows hosts:
   - provide quick mode toggle.
3. If a feature improves fairness but hurts energy:
   - bias toward energy unless safety/fairness is materially harmed.
4. If lyrics/media reliability is uncertain:
   - show status transparently and provide fallback path.

## Implementation Heuristics

- Always surface immediate feedback after action.
- Use status badges to reflect async/partial completion.
- Prefer optimistic UI with rollback paths.
- Persist host preferences locally when non-sensitive.
