const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms || 0) || 0)));

let ioGuardInstalled = false;

function installIoGuards() {
  if (ioGuardInstalled) return;
  ioGuardInstalled = true;
  const swallowBrokenPipe = (stream) => {
    if (!stream || typeof stream.on !== "function") return;
    stream.on("error", (err) => {
      if (String(err?.code || "") === "EPIPE") {
        process.exitCode = process.exitCode || 0;
        return;
      }
      throw err;
    });
  };
  swallowBrokenPipe(process.stdout);
  swallowBrokenPipe(process.stderr);
}

async function retryAsync(run, {
  retries = 3,
  delayMs = 60,
  shouldRetry = () => false,
} = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await run(attempt);
    } catch (err) {
      lastError = err;
      if (attempt >= retries || !shouldRetry(err, attempt)) {
        throw err;
      }
      await sleep(delayMs * (attempt + 1));
    }
  }
  throw lastError;
}

async function deleteCollection(db, pathSegments = [], {
  batchSize = 500,
} = {}) {
  const ref = db.collection(pathSegments.join("/"));
  while (true) {
    const snap = await ref.limit(batchSize).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    if (snap.size < batchSize) return;
  }
}

async function waitForDocument(ref, {
  timeoutMs = 2000,
  intervalMs = 50,
  predicate = (snap) => snap.exists,
} = {}) {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) <= timeoutMs) {
    const snap = await ref.get();
    if (predicate(snap)) return snap;
    await sleep(intervalMs);
  }
  return ref.get();
}

const isRetryableFirestoreHarnessError = (err) => {
  const code = String(err?.code || "").toLowerCase();
  const message = String(err?.message || "").toLowerCase();
  return code.includes("not-found")
    || code.includes("aborted")
    || code.includes("deadline-exceeded")
    || code.includes("unavailable")
    || message.includes("room not found");
};

module.exports = {
  deleteCollection,
  installIoGuards,
  isRetryableFirestoreHarnessError,
  retryAsync,
  sleep,
  waitForDocument,
};
