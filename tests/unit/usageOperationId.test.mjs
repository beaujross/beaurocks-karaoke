import { expect, test } from 'vitest';
import { createUsageOperationId } from '../../src/lib/usageOperationId';

test('client usage operation ids are unique and server-safe', () => {
  const first = createUsageOperationId('youtube-search');
  const second = createUsageOperationId('youtube-search');
  expect(first).not.toBe(second);
  expect(first).toMatch(/^youtube-search:[a-z0-9]+:[a-zA-Z0-9]+$/);
  expect(first.length).toBeLessThanOrEqual(160);
});
