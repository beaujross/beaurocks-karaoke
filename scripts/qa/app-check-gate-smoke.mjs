const CALLABLE_URL = "https://us-west1-beaurocks-karaoke-v2.cloudfunctions.net/submitMarketingWaitlist";
const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
};

const toJsonOrText = async (response) => {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const run = async () => {
  const expectReject = toBool(process.env.QA_APP_CHECK_EXPECT_REJECT, false);

  const response = await fetch(CALLABLE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: {
        name: "QA AppCheck",
        email: "qa-appcheck-smoke@example.com",
        useCase: "Home Party Host",
        source: "qa_appcheck_smoke",
      },
    }),
  });
  const body = await toJsonOrText(response);

  const blocked = response.status >= 400;
  const ok = blocked || !expectReject;
  const output = {
    ok,
    expected: expectReject
      ? "Request without App Check token should be rejected"
      : "Request may be allowed when APP_CHECK_MODE is monitor/log",
    mode: expectReject ? "enforce" : "monitor",
    status: response.status,
    body,
  };

  console.log(JSON.stringify(output, null, 2));
  if (!ok) process.exit(1);
};

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message || String(error) }, null, 2));
  process.exit(1);
});
