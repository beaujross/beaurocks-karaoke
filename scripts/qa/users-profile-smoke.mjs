const PROJECT_ID = "beaurocks-karaoke-v2";

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

const encodeValue = (value) => {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") return { integerValue: String(Math.trunc(value)) };
  if (typeof value === "boolean") return { booleanValue: value };
  if (value === null) return { nullValue: null };
  throw new Error(`Unsupported Firestore field value type: ${typeof value}`);
};

const toFirestoreFields = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, encodeValue(value)]));

const userDocUrl = (uid) =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`;

const getFirebaseInit = async () => {
  const response = await fetchWithTimeout("https://beaurocks-karaoke-v2.web.app/__/firebase/init.json");
  if (!response.ok) {
    throw new Error(`Failed to load firebase init config (${response.status}).`);
  }
  return response.json();
};

const signInAnonymouslyViaRest = async (apiKey) => {
  const response = await fetchWithTimeout(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    }
  );
  const body = await toJsonOrText(response);
  if (!response.ok) {
    throw new Error(`Anonymous auth failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return { uid: body.localId, idToken: body.idToken };
};

const patchUserDoc = async ({ uid, idToken, fields }) => {
  const response = await fetchWithTimeout(userDocUrl(uid), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ fields: toFirestoreFields(fields) }),
  });
  return {
    ok: response.ok,
    status: response.status,
    body: await toJsonOrText(response),
  };
};

const getUserDoc = async ({ uid, idToken }) => {
  const response = await fetchWithTimeout(userDocUrl(uid), {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return {
    ok: response.ok,
    status: response.status,
    body: await toJsonOrText(response),
  };
};

const deleteUserDoc = async ({ uid, idToken }) => {
  await fetchWithTimeout(userDocUrl(uid), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${idToken}` },
  }).catch(() => {});
};

const run = async () => {
  const config = await getFirebaseInit();
  const userA = await signInAnonymouslyViaRest(config.apiKey);
  const userB = await signInAnonymouslyViaRest(config.apiKey);

  const checks = [];
  try {
    const ownCreate = await patchUserDoc({
      uid: userA.uid,
      idToken: userA.idToken,
      fields: {
        name: "Smoke Host",
        avatar: "😎",
        vipLevel: 1,
        isVip: true,
      },
    });
    checks.push({
      name: "own_user_doc_create",
      pass: ownCreate.ok,
      status: ownCreate.status,
    });

    const ownUpdate = await patchUserDoc({
      uid: userA.uid,
      idToken: userA.idToken,
      fields: {
        name: "Smoke Host Updated",
        city: "Seattle",
      },
    });
    checks.push({
      name: "own_user_doc_profile_edit",
      pass: ownUpdate.ok,
      status: ownUpdate.status,
    });

    const ownRead = await getUserDoc({ uid: userA.uid, idToken: userA.idToken });
    const ownName = ownRead?.body?.fields?.name?.stringValue || "";
    checks.push({
      name: "own_user_doc_readback",
      pass: ownRead.ok && ownName === "Smoke Host Updated",
      status: ownRead.status,
    });

    const crossWrite = await patchUserDoc({
      uid: userB.uid,
      idToken: userA.idToken,
      fields: {
        name: "Intrusion Attempt",
      },
    });
    checks.push({
      name: "cross_user_write_denied",
      pass: crossWrite.status === 403,
      status: crossWrite.status,
    });
  } finally {
    await deleteUserDoc({ uid: userA.uid, idToken: userA.idToken });
    await deleteUserDoc({ uid: userB.uid, idToken: userB.idToken });
  }

  const failed = checks.filter((item) => !item.pass);
  const output = {
    ok: failed.length === 0,
    checks,
    failedCount: failed.length,
  };
  console.log(JSON.stringify(output, null, 2));
  if (failed.length) process.exit(1);
};

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message || String(error) }, null, 2));
  process.exit(1);
});
