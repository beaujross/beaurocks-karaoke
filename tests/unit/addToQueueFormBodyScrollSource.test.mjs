import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const addToQueueFormBodyPath = path.resolve(__dirname, '../../src/apps/Host/components/AddToQueueFormBody.jsx');

test('AddToQueueFormBody keeps YouTube/autocomplete results inside a dedicated scroll lane', () => {
  const source = readFileSync(addToQueueFormBodyPath, 'utf8');

  assert.match(
    source,
    /host-autocomplete-results-list min-h-0 flex-1 overflow-y-auto overscroll-contain touch-scroll-y custom-scrollbar p-3/,
    'Autocomplete results should be their own touch-friendly scroll surface',
  );
  assert.match(
    source,
    /host-autocomplete-results absolute left-0 right-0 top-full mt-2 z-50 flex max-h-\[min\(32rem,calc\(100dvh-14rem\)\)\] flex-col overflow-hidden/,
    'Floating autocomplete results should stay bounded to viewport height and clip into an internal scroller',
  );
  assert.match(
    source,
    /mt-2 flex min-h-0 max-h-\[min\(56dvh,36rem\)\] flex-1 flex-col overflow-hidden/,
    'Docked add-tab results should also keep a bounded internal scroll lane',
  );
});
