import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const functionsSource = readFileSync(new URL('../../functions/index.js', import.meta.url), 'utf8');
const hostSource = readFileSync(new URL('../../src/apps/Host/HostApp.jsx', import.meta.url), 'utf8');
const hostQueueSource = readFileSync(new URL('../../src/apps/Host/components/HostQueueTab.jsx', import.meta.url), 'utf8');
const audienceSource = readFileSync(new URL('../../src/apps/Mobile/SingerApp.jsx', import.meta.url), 'utf8');

test('global chart qualification is automatic for signed-in members at approved host nights', () => {
  expect(functionsSource).toMatch(/Only approved BeauRocks hosts can record qualifying performances/);
  expect(functionsSource).toMatch(/leaderboardAccountEligible === true/);
  expect(functionsSource).toMatch(/globalLeaderboardEligible/);
  expect(functionsSource).toMatch(/qualified_member/);
  expect(functionsSource).toMatch(/room_only_guest/);
  expect(functionsSource).toMatch(/duplicate: true/);
  expect(functionsSource).toMatch(/leaderboardAccountUpdatedAt/);
  expect(hostQueueSource).toMatch(/performanceId: songEntry\.id \|\| null/);
});

test('room entry explains charts without adding another consent control', () => {
  expect(audienceSource).toMatch(/Signed-in singers automatically qualify for BeauRocks charts at approved nights\./);
  expect(audienceSource).not.toMatch(/Claim this score/);
});

test('private rooms do not publish recaps and recap artifacts follow room visibility', () => {
  expect(hostSource).toMatch(/Room closed\. Recap saved privately\./);
  expect(functionsSource).toMatch(/Private rooms keep their recap inside the host workspace/);
  expect(functionsSource).toMatch(/publicRecapStoragePath/);
  expect(functionsSource).toMatch(/publicRecapRemoved/);
});
