const assert = require("node:assert/strict");
const {
  getGeminiModelCandidates,
  getGeminiModelPricing,
  isGeminiModelUnavailableResponse,
  requestGeminiJson,
} = require("../../functions/lib/geminiClient");

test("geminiClient.test", async () => {
  assert.deepEqual(
    getGeminiModelCandidates({
      preferredModel: "gemini-2.5-flash",
      fallbackModels: ["gemini-2.5-flash", "gemini-2.5-flash-preview-09-2025"],
    }),
    ["gemini-2.5-flash", "gemini-2.5-flash-preview-09-2025"]
  );

  assert.equal(
    isGeminiModelUnavailableResponse(404, "models/gemini-2.5-flash-preview-09-2025 is not found"),
    true
  );
  assert.equal(
    isGeminiModelUnavailableResponse(503, "backend temporarily unavailable"),
    false
  );

  const calls = [];
  const result = await requestGeminiJson({
    apiKey: "test-key",
    prompt: "hello",
    modelCandidates: ["gemini-2.5-flash-preview-09-2025", "gemini-2.5-flash"],
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.includes("gemini-2.5-flash-preview-09-2025")) {
        return {
          ok: false,
          status: 404,
          text: async () => "{\"error\":{\"message\":\"model not found\"}}",
        };
      }
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "{\"ok\":true}" }] } }],
        }),
      };
    },
  });
  assert.equal(result.model, "gemini-2.5-flash");
  assert.equal(calls.length, 2);

  const pricing = getGeminiModelPricing("gemini-2.5-flash");
  assert.equal(typeof pricing.inputUsdPer1M, "number");
  assert.equal(typeof pricing.outputUsdPer1M, "number");

  await assert.rejects(
    requestGeminiJson({
      apiKey: "test-key",
      prompt: "hello",
      modelCandidates: ["gemini-2.5-flash"],
      fetchImpl: async () => ({
        ok: false,
        status: 500,
        text: async () => "{\"error\":{\"message\":\"backend down\"}}",
      }),
    }),
    /Gemini request failed for gemini-2.5-flash/i
  );
});
