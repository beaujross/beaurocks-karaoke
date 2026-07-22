import assert from 'node:assert/strict';
import { afterEach, beforeEach, test, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('generateAiContentRequest tracks successful AI generations', async () => {
  const callFunction = vi.fn(async () => ({
    result: { lyrics: 'hello world' },
  }));
  vi.doMock('../../src/lib/firebase.js', () => ({
    callFunction,
  }));

  const {
    generateAiContentRequest,
    getAiGenerationTelemetrySnapshot,
  } = await import('../../src/lib/aiGenerationClient.js');

  const result = await generateAiContentRequest({
    type: 'lyrics',
    context: { title: 'Song' },
    roomCode: 'ROOM1',
    usageSource: 'test_ai',
  });

  assert.equal(result.lyrics, 'hello world');
  const telemetry = getAiGenerationTelemetrySnapshot();
  assert.equal(telemetry.recentGenerations, 1);
  assert.equal(telemetry.successes, 1);
  assert.equal(telemetry.failures, 0);
  assert.match(callFunction.mock.calls[0][1]?.usageContext?.operationId || '', /^ai-lyrics:/);
  assert.equal(callFunction.mock.calls[0][1]?.usageContext?.surface, 'host');
});

test('generateAiContentRequest tracks AI failures', async () => {
  const callFunction = vi.fn(async () => {
    throw new Error('AI failed');
  });
  vi.doMock('../../src/lib/firebase.js', () => ({
    callFunction,
  }));

  const {
    generateAiContentRequest,
    getAiGenerationTelemetrySnapshot,
  } = await import('../../src/lib/aiGenerationClient.js');

  await assert.rejects(() => generateAiContentRequest({
    type: 'lyrics',
    context: { title: 'Song' },
    roomCode: 'ROOM1',
    usageSource: 'test_ai',
  }));
  const telemetry = getAiGenerationTelemetrySnapshot();
  assert.equal(telemetry.recentGenerations, 1);
  assert.equal(telemetry.failures, 1);
  assert.equal(telemetry.failurePct, 100);
});
