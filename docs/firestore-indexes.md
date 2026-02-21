# Firestore Index Ownership

This project now tracks composite indexes in-repo via `firestore.indexes.json` and `firebase.json`:

- `firebase.json` -> `firestore.indexes`
- `firestore.indexes.json` -> canonical index set for current query shapes

## Why This Exists

Audience/TV/Host listeners use multiple filtered query patterns (`roomCode` + `timestamp`, `roomCode` + `promptId`, etc.). If these indexes are missing, Firestore emits runtime `failed-precondition` errors and listeners stop updating.

## Covered Query Patterns

1. `reactions`: `where(roomCode == ...) + orderBy(timestamp desc)`
2. `reactions`: `where(roomCode == ...) + where(questionId == ...)`
3. `reactions`: `where(roomCode == ...) + where(type == ...)`
4. `chat_messages`: `where(roomCode == ...) + orderBy(timestamp desc)`
5. `doodle_submissions`: `where(roomCode == ...) + where(promptId == ...) + orderBy(timestamp desc)`
6. `doodle_votes`: `where(roomCode == ...) + where(promptId == ...) + orderBy(timestamp desc)`
7. `song_hall_of_fame_weeks`: `where(weekKey == ...) + orderBy(bestScore desc)`

## Deploy Indexes

```bash
npx firebase-tools deploy --only firestore:indexes --project beaurocks-karaoke-v2
```

## Update Workflow

1. Add/modify query shape in app code.
2. Add matching composite entry in `firestore.indexes.json`.
3. Run `npm run lint && npm run build && npm run test:unit`.
4. Deploy indexes explicitly (separate from hosting deploy).

## Notes

- These are composite indexes only; single-field indexes remain Firestore-managed.
- Keep query changes and index changes in the same PR/commit whenever possible.
