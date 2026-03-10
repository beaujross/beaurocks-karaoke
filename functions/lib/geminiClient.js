"use strict";

const normalizeModelToken = (value = "") => String(value || "").trim();

const parseCsvTokens = (value = "") =>
  String(value || "")
    .split(",")
    .map((entry) => normalizeModelToken(entry))
    .filter(Boolean);

const parseNonNegativeNumber = (value, fallback = 0) => {
  const next = Number(value);
  if (!Number.isFinite(next) || next < 0) return fallback;
  return next;
};

const GEMINI_DEFAULT_MODEL = normalizeModelToken(process.env.GEMINI_MODEL || "gemini-2.5-flash")
  || "gemini-2.5-flash";

const GEMINI_FALLBACK_MODELS = Object.freeze(
  parseCsvTokens(process.env.GEMINI_FALLBACK_MODELS || "gemini-2.5-flash-preview-09-2025")
);

const GEMINI_MODEL_PRICING = Object.freeze({
  "gemini-2.5-flash": Object.freeze({
    inputUsdPer1M: parseNonNegativeNumber(
      process.env.GEMINI_25_FLASH_INPUT_USD_PER_1M || process.env.GEMINI_LYRICS_INPUT_USD_PER_1M,
      0.3
    ),
    outputUsdPer1M: parseNonNegativeNumber(
      process.env.GEMINI_25_FLASH_OUTPUT_USD_PER_1M || process.env.GEMINI_LYRICS_OUTPUT_USD_PER_1M,
      2.5
    ),
  }),
  "gemini-2.5-flash-preview-09-2025": Object.freeze({
    inputUsdPer1M: parseNonNegativeNumber(
      process.env.GEMINI_25_FLASH_PREVIEW_INPUT_USD_PER_1M || process.env.GEMINI_LYRICS_INPUT_USD_PER_1M,
      0.3
    ),
    outputUsdPer1M: parseNonNegativeNumber(
      process.env.GEMINI_25_FLASH_PREVIEW_OUTPUT_USD_PER_1M || process.env.GEMINI_LYRICS_OUTPUT_USD_PER_1M,
      2.5
    ),
  }),
});

const getGeminiModelCandidates = ({
  preferredModel = GEMINI_DEFAULT_MODEL,
  fallbackModels = GEMINI_FALLBACK_MODELS,
} = {}) => {
  const ordered = [
    normalizeModelToken(preferredModel),
    ...((Array.isArray(fallbackModels) ? fallbackModels : [fallbackModels]).map(normalizeModelToken)),
  ].filter(Boolean);
  return Array.from(new Set(ordered));
};

const getGeminiModelPricing = (model = GEMINI_DEFAULT_MODEL) =>
  GEMINI_MODEL_PRICING[normalizeModelToken(model)]
  || GEMINI_MODEL_PRICING[GEMINI_DEFAULT_MODEL]
  || { inputUsdPer1M: 0.3, outputUsdPer1M: 2.5 };

const isGeminiModelUnavailableResponse = (status, text = "") => {
  const message = String(text || "").toLowerCase();
  return (
    Number(status) === 404
    || message.includes("is not found")
    || message.includes("not supported for generatecontent")
    || (message.includes("model") && message.includes("not found"))
  );
};

const requestGeminiJson = async ({
  apiKey = "",
  prompt = "",
  responseMimeType = "application/json",
  modelCandidates = null,
  fetchImpl = fetch,
} = {}) => {
  const safeApiKey = String(apiKey || "").trim();
  if (!safeApiKey) {
    const error = new Error("Gemini API key not configured.");
    error.code = "missing-api-key";
    throw error;
  }

  const models = Array.isArray(modelCandidates) && modelCandidates.length
    ? modelCandidates.map(normalizeModelToken).filter(Boolean)
    : getGeminiModelCandidates();
  if (!models.length) {
    const error = new Error("No Gemini models configured.");
    error.code = "missing-model";
    throw error;
  }

  const unavailableAttempts = [];
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${safeApiKey}`;
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: String(prompt || "") }] }],
        generationConfig: { responseMimeType },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return { data, model };
    }

    const text = await res.text();
    if (isGeminiModelUnavailableResponse(res.status, text) && models.length > 1) {
      unavailableAttempts.push({ model, status: res.status, text });
      continue;
    }

    const error = new Error(`Gemini request failed for ${model}: ${text}`);
    error.code = "gemini-request-failed";
    error.status = res.status;
    error.model = model;
    throw error;
  }

  const summary = unavailableAttempts.map((entry) => `${entry.model} (${entry.status})`).join(", ");
  const error = new Error(
    `Gemini request failed for all configured models${summary ? `: ${summary}` : "."}`
  );
  error.code = "gemini-model-unavailable";
  error.status = unavailableAttempts[unavailableAttempts.length - 1]?.status || 404;
  error.attempts = unavailableAttempts;
  throw error;
};

module.exports = {
  GEMINI_DEFAULT_MODEL,
  GEMINI_FALLBACK_MODELS,
  getGeminiModelCandidates,
  getGeminiModelPricing,
  isGeminiModelUnavailableResponse,
  requestGeminiJson,
};
