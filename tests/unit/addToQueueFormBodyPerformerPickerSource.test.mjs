import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const addToQueueFormBodyPath = path.resolve(__dirname, '../../src/apps/Host/components/AddToQueueFormBody.jsx');

test('AddToQueueFormBody uses a searchable performer picker with a top-level custom path', () => {
  const source = readFileSync(addToQueueFormBodyPath, 'utf8');

  assert.match(
    source,
    /placeholder="Search performer or type custom"/,
    'Performer field should support direct search and freeform custom names in one compact input',
  );
  assert.match(
    source,
    /data-feature-id="host-manual-performer-suggestions"/,
    'Performer field should expose a dedicated suggestion panel for large rooms',
  );
  assert.match(
    source,
    /\.slice\(0, 8\)/,
    'Performer suggestions should stay scoped to a manageable visible result count',
  );
  assert.match(
    source,
    /Use custom performer/,
    'Custom performer should stay available at the top of the picker instead of hiding behind a distant option',
  );
  assert.doesNotMatch(
    source,
    /<option value="__custom">Custom performer\.\.\.<\/option>/,
    'Legacy custom performer select option should be removed once the compact typeahead picker is in place',
  );
});
