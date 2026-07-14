import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const source = readFileSync(new URL('../../scripts/qa/admin-workspace-playwright-smoke.mjs', import.meta.url), 'utf8');

test('production permanent-delete evidence is opt-in and disposable-room pinned', () => {
  expect(source).toMatch(/QA_PERMANENT_DELETE_ROOM_CODE/);
  expect(source).toMatch(/QA_PERMANENT_DELETE_ONLY/);
  expect(source).toMatch(/return "room-manager"/);
  expect(source).toMatch(/data-room-browser-bucket="past"/);
  expect(source).toMatch(/QA_PERMANENT_DELETE_CONFIRM/);
  expect(source).toMatch(/DELETE_DISPOSABLE_QA_ROOM/);
  expect(source).toMatch(/Refusing unsafe permanent-delete room code/);
  expect(source).toMatch(/room-permanent-delete-confirmation\.png/);
  expect(source).toMatch(/room-permanent-delete-success\.png/);
});

test('permanent-delete evidence accepts both confirmation dialogs and verifies disappearance', () => {
  expect(source).toMatch(/dialog\.type\(\) === "confirm"/);
  expect(source).toMatch(/dialog\.type\(\) === "prompt"/);
  expect(source).toMatch(/permanently deleted\./);
  expect(source).toMatch(/is still visible in the filtered room browser/);
});
