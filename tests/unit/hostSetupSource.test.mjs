import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const primaryPicksPath = 'src/apps/Host/components/setup/MissionSetupPrimaryPicks.jsx';
const nightSetupFlowPath = 'src/apps/Host/hooks/useHostNightSetupFlow.js';

test('mission setup keeps preset selection compact and applies full preset package', () => {
  const primaryPicksSource = readFileSync(primaryPicksPath, 'utf8');
  const nightSetupFlowSource = readFileSync(nightSetupFlowPath, 'utf8');

  assert.match(
    primaryPicksSource,
    /Selected room package/,
    'Night setup should show one selected room package instead of a full wall of presets',
  );
  assert.match(
    primaryPicksSource,
    /Change room package/,
    'Night setup should tuck alternate room packages behind a disclosure',
  );
  assert.match(
    nightSetupFlowSource,
    /hostNightPresetConfig: selectedPresetConfig/,
    'Night setup should persist the full preset config so Room Settings can reflect the selected package',
  );
  assert.match(
    nightSetupFlowSource,
    /audienceShellVariant: String\(basePayload\.audienceShellVariant \|\| selectedPresetSettings\.audienceShellVariant/,
    'Night setup should persist the preset audience shell variant',
  );
});
