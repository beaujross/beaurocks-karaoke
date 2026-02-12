const CALLABLE_URL = "https://us-west1-beaurocks-karaoke-v2.cloudfunctions.net/submitMarketingWaitlist";

const toJsonOrText = async (response) => {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const run = async () => {
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
  const output = {
    ok: blocked,
    expected: "Request without App Check token should be rejected",
    status: response.status,
    body,
  };

  console.log(JSON.stringify(output, null, 2));
  if (!blocked) process.exit(1);
};

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message || String(error) }, null, 2));
  process.exit(1);
});
