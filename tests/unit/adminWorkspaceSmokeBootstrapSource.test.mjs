import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'scripts/qa/admin-workspace-playwright-smoke.mjs'),
  'utf8',
);

describe('admin workspace smoke bootstrap', () => {
  it('never clicks the room-create action while it is disabled during hydration', () => {
    expect(source).toContain('(await quickStart.isVisible().catch(() => false)) &&');
    expect(source).toContain('(await quickStart.isEnabled().catch(() => false))');
    expect(source).toContain('await quickStart.click();');
  });
});
