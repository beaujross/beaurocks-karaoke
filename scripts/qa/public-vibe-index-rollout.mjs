#!/usr/bin/env node
import process from "node:process";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { loadEnv } from "vite";

const qaEmail = String(process.env.VIBE_OPERATOR_EMAIL || process.env.QA_HOST_EMAIL || "").trim();
const qaPassword = String(process.env.VIBE_OPERATOR_PASSWORD || process.env.QA_HOST_PASSWORD || "");
const mode = String(process.env.VIBE_ROLLOUT_MODE || "preview").trim().toLowerCase();
const targetType = String(process.env.VIBE_ROLLOUT_TARGET_TYPE || "").trim().toLowerCase();
const targetId = String(process.env.VIBE_ROLLOUT_TARGET_ID || "").trim();
const rollbackJobId = String(process.env.VIBE_ROLLOUT_JOB_ID || "").trim();
const allowWrite = String(process.env.VIBE_ROLLOUT_ALLOW_WRITE || "").trim() === "1";
const appCheckDebugToken = String(process.env.QA_APP_CHECK_DEBUG_TOKEN || "").trim();

if (!qaEmail || !qaPassword) {
  throw new Error("QA_HOST_EMAIL and QA_HOST_PASSWORD are required.");
}
if (!["preview", "evidence-preview", "canary", "rollback"].includes(mode)) {
  throw new Error("VIBE_ROLLOUT_MODE must be preview, evidence-preview, canary, or rollback.");
}
if (mode === "canary" && (!allowWrite || !targetType || !targetId)) {
  throw new Error("Canary mode requires VIBE_ROLLOUT_ALLOW_WRITE=1, VIBE_ROLLOUT_TARGET_TYPE, and VIBE_ROLLOUT_TARGET_ID.");
}
if (mode === "rollback" && (!allowWrite || !rollbackJobId)) {
  throw new Error("Rollback mode requires VIBE_ROLLOUT_ALLOW_WRITE=1 and VIBE_ROLLOUT_JOB_ID.");
}
if (mode !== "preview" && !appCheckDebugToken) {
  throw new Error("QA_APP_CHECK_DEBUG_TOKEN is required for protected Vibe operations.");
}

const env = loadEnv("production", process.cwd(), "");
const envFirebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
let runtimeFirebaseConfig = {};
try {
  const response = await fetch("https://beaurocks.app/__/firebase/init.json", { cache: "no-store" });
  if (response.ok) runtimeFirebaseConfig = await response.json();
} catch {
  runtimeFirebaseConfig = {};
}
const firebaseConfig = {
  ...envFirebaseConfig,
  ...(runtimeFirebaseConfig && typeof runtimeFirebaseConfig === "object" ? runtimeFirebaseConfig : {}),
};
if (!firebaseConfig.apiKey || firebaseConfig.projectId !== "beaurocks-karaoke-v2") {
  throw new Error("Production Firebase client configuration is missing or points at the wrong project.");
}

const app = initializeApp(firebaseConfig, `public-vibe-rollout-${Date.now()}`);
const auth = getAuth(app);
const functions = getFunctions(app, "us-west1");

const exchangeDebugToken = async () => {
  if (!appCheckDebugToken) return "";
  const projectNumber = String(firebaseConfig.messagingSenderId || "").trim();
  const appId = String(firebaseConfig.appId || "").trim();
  const apiKey = String(firebaseConfig.apiKey || "").trim();
  if (!projectNumber || !appId || !apiKey) throw new Error("Firebase App Check exchange configuration is incomplete.");
  const response = await fetch(
    `https://firebaseappcheck.googleapis.com/v1beta/projects/${encodeURIComponent(projectNumber)}/apps/${encodeURIComponent(appId)}:exchangeDebugToken?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ debugToken: appCheckDebugToken, limitedUse: false }),
    }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.token) {
    throw new Error(`App Check debug-token exchange failed (${response.status}).`);
  }
  return String(payload.token);
};

const callProductionCallable = async (name, data, { idToken, appCheckToken = "" } = {}) => {
  const response = await fetch(`https://us-west1-beaurocks-karaoke-v2.cloudfunctions.net/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {}),
    },
    body: JSON.stringify({ data: data || {} }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    throw new Error(String(payload?.error?.message || `${name} failed (${response.status}).`));
  }
  return payload?.result || {};
};

const summarize = (result = {}) => ({
  ok: result.ok === true,
  dryRun: result.dryRun === true,
  scoreVersion: result.scoreVersion || null,
  rollupVersion: result.rollupVersion || null,
  jobId: result.jobId || null,
  operationMode: result.operationMode || null,
  scanned: Number(result.scanned || 0),
  eligible: Number(result.eligible || 0),
  changed: Number(result.changed || 0),
  unchanged: Number(result.unchanged || 0),
  published: Number(result.published || 0),
  notEnoughData: Number(result.notEnoughData || 0),
  written: Number(result.written || 0),
  previews: (Array.isArray(result.previews) ? result.previews : []).slice(0, 20).map((item) => ({
    targetType: item.targetType || null,
    targetId: item.targetId || null,
    status: item.status || null,
    score: Number.isFinite(Number(item.score)) ? Number(item.score) : null,
    label: item.label || null,
    confidence: item.confidence || null,
    changed: item.changed === true,
  })),
});

try {
  await signInWithEmailAndPassword(auth, qaEmail, qaPassword);
  const idToken = await auth.currentUser.getIdToken();
  const appCheckToken = await exchangeDebugToken();
  const access = appCheckToken
    ? await callProductionCallable("getMyDirectoryAccess", {}, { idToken, appCheckToken })
    : (await httpsCallable(functions, "getMyDirectoryAccess", { timeout: 60_000 })({}))?.data || {};
  console.log(JSON.stringify({
    phase: "authority",
    isModerator: access.isModerator === true,
    isAdmin: access.isAdmin === true,
  }));
  if (access.isModerator !== true && access.isAdmin !== true) {
    console.log(JSON.stringify({
      phase: "stopped",
      reason: "qa_account_is_not_directory_moderator",
    }));
    process.exitCode = 3;
  } else if (mode !== "preview" && access.isAdmin !== true) {
    console.log(JSON.stringify({ phase: "stopped", reason: "operator_is_not_directory_admin" }));
    process.exitCode = 4;
  } else if (mode === "evidence-preview") {
    const result = await callProductionCallable(
      "previewPublicVibeEvidenceBackfill",
      { limit: 500 },
      { idToken, appCheckToken }
    );
    console.log(JSON.stringify({
      phase: "evidence-preview",
      ok: result.ok === true,
      dryRun: result.dryRun === true,
      scoreVersion: result.scoreVersion || null,
      source: result.source || null,
      sampleWindowDays: Number(result.sampleWindowDays || 0),
      sampleLimit: Number(result.sampleLimit || 0),
      truncated: result.truncated === true,
      scannedEvidenceCount: Number(result.scannedEvidenceCount || 0),
      consideredEvidenceCount: Number(result.consideredEvidenceCount || 0),
      targetCount: Number(result.targetCount || 0),
      eligibleTargetCount: Number(result.eligibleTargetCount || 0),
      notEnoughDataTargetCount: Number(result.notEnoughDataTargetCount || 0),
      qualifiedEvidenceCount: Number(result.qualifiedEvidenceCount || 0),
      droppedEvidenceCount: Number(result.droppedEvidenceCount || 0),
      collisionCount: Number(result.collisionCount || 0),
      inputEvidenceTypeCounts: result.inputEvidenceTypeCounts || {},
      confidenceCounts: result.confidenceCounts || {},
      eligibilityReasonCounts: result.eligibilityReasonCounts || {},
      droppedReasonCounts: result.droppedReasonCounts || {},
      targetTypeSummaries: Array.isArray(result.targetTypeSummaries) ? result.targetTypeSummaries : [],
      privacy: result.privacy || {},
      writesAttempted: Number(result.writesAttempted || 0),
      writesPerformed: Number(result.writesPerformed || 0),
    }, null, 2));
  } else if (mode === "rollback") {
    const result = await callProductionCallable(
      "rollbackPublicVibeIndexJob",
      { jobId: rollbackJobId },
      { idToken, appCheckToken }
    );
    console.log(JSON.stringify({ phase: "rollback", ...result }, null, 2));
  } else {
    const requestData = {
      dryRun: mode !== "canary",
      limit: mode === "canary" ? 100 : 250,
      ...(targetType ? { targetType } : {}),
      ...(targetId ? { targetId } : {}),
    };
    const result = appCheckToken
      ? await callProductionCallable("refreshPublicVibeIndexes", requestData, { idToken, appCheckToken })
      : (await httpsCallable(functions, "refreshPublicVibeIndexes", { timeout: 120_000 })(requestData))?.data || {};
    console.log(JSON.stringify({
      phase: mode,
      ...summarize(result),
    }, null, 2));
  }
} finally {
  await signOut(auth).catch(() => {});
}
