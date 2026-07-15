#!/usr/bin/env node
import process from "node:process";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { loadEnv } from "vite";

const qaEmail = String(process.env.QA_HOST_EMAIL || "").trim();
const qaPassword = String(process.env.QA_HOST_PASSWORD || "");
if (!qaEmail || !qaPassword) {
  throw new Error("QA_HOST_EMAIL and QA_HOST_PASSWORD are required.");
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

const app = initializeApp(firebaseConfig, `public-chart-preflight-${Date.now()}`);
const auth = getAuth(app);
const functions = getFunctions(app, "us-west1");

try {
  await signInWithEmailAndPassword(auth, qaEmail, qaPassword);
  console.log(JSON.stringify({
    phase: "authenticated",
    qaUid: auth.currentUser?.uid || null,
  }));
  const callHostAccess = httpsCallable(functions, "getMyHostAccessStatus", { timeout: 60_000 });
  const hostAccessResponse = await callHostAccess({});
  const hostAccess = hostAccessResponse?.data || {};
  console.log(JSON.stringify({
    phase: "host_access",
    ok: hostAccess.ok === true,
    hasHostWorkspaceAccess: hostAccess.hasHostWorkspaceAccess === true,
    hostApprovalEnabled: hostAccess.hostApprovalEnabled === true,
    entitledHostAccess: hostAccess.entitledHostAccess === true,
    applicationStatus: hostAccess.applicationStatus || null,
  }));
  if (hostAccess.ok !== true || hostAccess.hasHostWorkspaceAccess !== true) {
    process.exitCode = 2;
  }
  const callPreflight = httpsCallable(functions, "previewPublicChartLaunch", { timeout: 60_000 });
  try {
    const response = await callPreflight({});
    const result = response?.data || {};
    console.log(JSON.stringify({
      phase: "admin_preflight",
      ok: result.ok === true,
      chartEra: result.chartEra || null,
      canLaunch: result.canLaunch === true,
      truncated: result.truncated === true,
      gateScope: result.gateScope || null,
      scannedRoomCount: Number(result.scannedRoomCount || 0),
      openLifecycleRoomCount: Number(result.openLifecycleRoomCount || 0),
      activeRoomCount: Number(result.activeRoomCount || 0),
      publicRoomCount: Number(result.publicRoomCount || 0),
      activeHostCount: Number(result.activeHostCount || 0),
      approvedActiveHostCount: Number(result.approvedActiveHostCount || 0),
      unapprovedHostCount: Number(result.unapprovedHostCount || 0),
      orphanedHostCount: Number(result.orphanedHostCount || 0),
    }, null, 2));
    if (result.canLaunch !== true || result.truncated === true) process.exitCode = 2;
  } catch (error) {
    if (String(error?.code || "") !== "functions/permission-denied") throw error;
    console.log(JSON.stringify({
      phase: "admin_boundary",
      enforced: true,
      detail: "Dedicated QA host is correctly excluded from directory-admin preflight.",
    }));
  }
} finally {
  await signOut(auth).catch(() => {});
}
