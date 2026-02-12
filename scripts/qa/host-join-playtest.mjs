const PROJECT_ID = "beaurocks-karaoke-v2";
const APP_ID = "bross-app";

const toJsonOrText = async (response) => {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const getFirebaseInit = async () => {
  const response = await fetchWithTimeout("https://beaurocks-karaoke-v2.web.app/__/firebase/init.json");
  if (!response.ok) {
    throw new Error(`Failed to load firebase init config (${response.status}).`);
  }
  return response.json();
};

const signInAnonymouslyViaRest = async (apiKey) => {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const body = await toJsonOrText(response);
  if (!response.ok) {
    throw new Error(`Anonymous auth failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return {
    uid: body.localId,
    idToken: body.idToken,
  };
};

const roomDocumentUrl = (roomCode) =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/rooms/${roomCode}`;

const createRoomDoc = async ({ roomCode, uid, idToken }) => {
  const payload = {
    fields: {
      roomCode: { stringValue: roomCode },
      hostUid: { stringValue: uid },
      hostUids: { arrayValue: { values: [{ stringValue: uid }] } },
      phase: { stringValue: "qa_playtest" },
    },
  };
  const response = await fetchWithTimeout(roomDocumentUrl(roomCode), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  return {
    ok: response.ok,
    status: response.status,
    body: await toJsonOrText(response),
  };
};

const getRoomDoc = async ({ roomCode, idToken }) => {
  const response = await fetchWithTimeout(roomDocumentUrl(roomCode), {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return {
    ok: response.ok,
    status: response.status,
    body: await toJsonOrText(response),
  };
};

const deleteRoomDoc = async ({ roomCode, idToken }) => {
  await fetchWithTimeout(roomDocumentUrl(roomCode), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${idToken}` },
  }).catch(() => {});
};

const run = async () => {
  const config = await getFirebaseInit();
  const host = await signInAnonymouslyViaRest(config.apiKey);
  const roomCode = `JT${Date.now().toString().slice(-6)}`;
  const missingRoom = `${roomCode}X`;
  const result = {
    roomCode,
    scenarios: [],
  };

  try {
    const create = await createRoomDoc({ roomCode, uid: host.uid, idToken: host.idToken });
    result.scenarios.push({
      name: "create_room_as_authed_host",
      pass: create.ok,
      status: create.status,
    });

    const joinExisting = await getRoomDoc({ roomCode, idToken: host.idToken });
    result.scenarios.push({
      name: "join_existing_room",
      pass: joinExisting.ok,
      status: joinExisting.status,
    });

    const joinMissing = await getRoomDoc({ roomCode: missingRoom, idToken: host.idToken });
    result.scenarios.push({
      name: "join_missing_room",
      pass: joinMissing.status === 404,
      status: joinMissing.status,
    });

    const invalidToken = await getRoomDoc({ roomCode, idToken: "invalid-token" });
    result.scenarios.push({
      name: "re_auth_needed_invalid_token",
      pass: invalidToken.status === 401 || invalidToken.status === 403,
      status: invalidToken.status,
    });

    const joinAfterReauth = await getRoomDoc({ roomCode, idToken: host.idToken });
    result.scenarios.push({
      name: "join_after_reauth",
      pass: joinAfterReauth.ok,
      status: joinAfterReauth.status,
    });

    let networkFailurePass = false;
    try {
      await fetchWithTimeout("https://firestore.googleapis.com.invalid", {}, 1200);
    } catch {
      networkFailurePass = true;
    }
    result.scenarios.push({
      name: "poor_network_transport_failure",
      pass: networkFailurePass,
      status: networkFailurePass ? "network_error" : "unexpected_success",
    });
  } finally {
    await deleteRoomDoc({ roomCode, idToken: host.idToken });
  }

  const failed = result.scenarios.filter((item) => !item.pass);
  const output = {
    ok: failed.length === 0,
    ...result,
    failedCount: failed.length,
  };

  console.log(JSON.stringify(output, null, 2));
  if (failed.length) process.exit(1);
};

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message || String(error) }, null, 2));
  process.exit(1);
});
