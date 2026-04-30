# AAHF Scene Upload Note

Date: 2026-04-29

Scope:
- Upload new AAHF event-flyer images into the live `AAHF` room scene library.
- Keep layout behavior aligned with existing image scenes by using the standard media-scene path, which renders with `contain` fit on Public TV.

Live room state before upload:
- Room code: `AAHF`
- Room name: `AAHF Karaoke Kick-Off`
- Existing scene preset count: `2`
- Run of show enabled: `false`

Assets uploaded into the live `AAHF` scene library:
- `Japanese Heritage Night`
- `AAHF Dance 4.11`
- `AAHF Festival Event List Flyer`
- `AAHF Festival Finale AL`
- `AAHF Karaoke`
- `AAHF Mahjong Boathouse Flyer`
- `AAHF Monologues Flyer`
- `AAHF Morales Flyer`
- `AAHF Strawberry Festival Flyer`
- `AAHF Strawberry Fields Flyer`

Additional video scenes uploaded into the live `AAHF` scene library:
- `AHB Show for 12.17`
- `2nd Annual Asian Arts & Heritage Festival 4.2025`

Live room state after upload:
- Scene preset count: `14`
- Default scene duration applied: `20` seconds for image cards
- Default scene duration applied: `300` seconds for the two uploaded video cards
- Upload path: `room_scene_media/AAHF/...`
- Firestore collection: `artifacts/bross-app/public/data/room_scene_presets`

Operator note for CTO/Product:
- This change is limited to scene-library content for the live room.
- No run-of-show automation was turned on or altered.
- The uploaded assets are intended to be manual event-break cards between performances until final resized artwork is ready.
