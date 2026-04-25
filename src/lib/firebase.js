import { initializeApp } from "firebase/app";
import { getAnalytics, logEvent } from "firebase/analytics";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  ReCaptchaV3Provider,
  getToken as getAppCheckToken,
} from "firebase/app-check";
import { getFunctions, httpsCallable } from "firebase/functions";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  EmailAuthProvider,
  linkWithCredential,
  signInWithCredential,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp, 
  increment, 
  arrayUnion,
  arrayRemove,
  runTransaction,
  writeBatch, 
  orderBy, 
  limit 
} from "firebase/firestore";
import {
  getDatabase,
  ref,
  set,
  onValue,
  remove,
  push,
  serverTimestamp as rtdbTimestamp
} from "firebase/database";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "firebase/storage";
import {
  getAppCheckRetryDelayMs,
  isAppCheckThrottledError,
  isRecoverableAppCheckError,
} from "./appCheckErrors";
import {
  parseOptionalBoolToken,
  resolveAppCheckProviderMode,
  resolveRuntimeAppCheckDebugToken,
  shouldEnableRuntimeAppCheckDebug,
} from "./appCheckConfig";
import { createLogger } from "./logger";
import { shouldBootstrapAnonymousAuth } from "./authBootstrap";

const firebaseLogger = createLogger("firebase");

const readEnv = (name) => {
  if (typeof import.meta === "undefined" || !import.meta?.env) return "";
  const value = import.meta.env[name];
  return typeof value === "string" ? value.trim() : "";
};

const parseOptionalBool = parseOptionalBoolToken;

const REQUIRED_FIREBASE_KEYS = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

const sanitizeFirebaseConfig = (config) => {
  if (!config || typeof config !== "object") return null;
  const sanitized = {};
  for (const [key, rawValue] of Object.entries(config)) {
    if (rawValue == null) continue;
    if (typeof rawValue === "string") {
      const trimmed = rawValue.trim();
      if (!trimmed) continue;
      sanitized[key] = trimmed;
      continue;
    }
    sanitized[key] = rawValue;
  }
  return sanitized;
};

const parseRuntimeFirebaseConfig = () => {
  if (typeof window === "undefined") return null;
  const runtime = window.__firebase_config;
  if (!runtime) return null;
  if (typeof runtime === "object") return runtime;
  if (typeof runtime === "string") {
    try {
      return JSON.parse(runtime);
    } catch (err) {
      firebaseLogger.warn("invalid window.__firebase_config JSON", err);
      return null;
    }
  }
  return null;
};

const resolveFirebaseConfig = () => {
  const runtimeConfig = sanitizeFirebaseConfig(parseRuntimeFirebaseConfig());
  const envConfig = sanitizeFirebaseConfig({
    apiKey: readEnv("VITE_FIREBASE_API_KEY"),
    authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: readEnv("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: readEnv("VITE_FIREBASE_APP_ID"),
    measurementId: readEnv("VITE_FIREBASE_MEASUREMENT_ID"),
  }) || {};
  const mergedConfig = {
    ...envConfig,
    ...(runtimeConfig || {}),
  };
  const missing = REQUIRED_FIREBASE_KEYS.filter((key) => !mergedConfig[key]);
  if (!missing.length) {
    return mergedConfig;
  }
  throw new Error(
    `Missing Firebase config: ${missing.join(", ")}. Set window.__firebase_config or VITE_FIREBASE_* env vars.`
  );
};

const firebaseConfig = resolveFirebaseConfig();

// Initialize
const app = initializeApp(firebaseConfig);
let appCheck = null;
let appCheckInitAttempted = false;
let appCheckDisabledReason = "";

const shouldEnableAppCheckClient = () => {
  const explicit = parseOptionalBool(readEnv("VITE_APP_CHECK_ENABLED"));
  if (explicit !== null) return explicit;
  return false;
};

const shouldRequireLocalAppCheck = () => {
  const explicit = parseOptionalBool(readEnv("VITE_REQUIRE_APP_CHECK"));
  if (explicit !== null) return explicit;
  return false;
};

const resolveAuthPersistenceMode = () => {
  const explicitMode = readEnv("VITE_AUTH_PERSISTENCE").toLowerCase();
  if (explicitMode === "local") return browserLocalPersistence;
  if (explicitMode === "memory") return inMemoryPersistence;
  if (explicitMode === "session") return browserSessionPersistence;
  if (typeof window !== "undefined") {
    const host = window.location?.hostname || "";
    if (host === "localhost" || host === "127.0.0.1") {
      return browserLocalPersistence;
    }
  }
  return browserSessionPersistence;
};

const resolveQaAuthBootstrap = () => {
  if (typeof window === "undefined") return null;
  const host = String(window.location?.hostname || "").trim().toLowerCase();
  const search = String(window.location?.search || "");
  const params = new URLSearchParams(search);
  const requested = params.get("qaAuthBootstrap") === "1";
  const debugEnabled =
    window.__app_check_debug_enabled === true ||
    !!resolveRuntimeAppCheckDebugToken();
  const localHost = host === "localhost" || host === "127.0.0.1";
  if (!requested || (!debugEnabled && !localHost)) return null;
  const bootstrap = window.__qa_auth_bootstrap;
  if (!bootstrap || typeof bootstrap !== "object") return null;
  const email = typeof bootstrap.email === "string" ? bootstrap.email.trim() : "";
  const password = typeof bootstrap.password === "string" ? bootstrap.password.trim() : "";
  if (!email || !password) return null;
  return { email, password };
};

const getAppCheckSiteKey = () => {
  if (typeof window === "undefined") return "";
  const runtimeKey = typeof window.__app_check_site_key === "string"
    ? window.__app_check_site_key.trim()
    : "";
  const envKey = typeof import.meta !== "undefined" && import.meta?.env?.VITE_RECAPTCHA_V3_SITE_KEY
    ? String(import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY).trim()
    : "";
  return runtimeKey || envKey;
};

const getAppCheckProviderMode = () => {
  if (typeof window === "undefined") return "enterprise";
  const runtimeProvider = typeof window.__app_check_provider === "string"
    ? window.__app_check_provider.trim()
    : "";
  const envProvider = readEnv("VITE_APP_CHECK_PROVIDER");
  return resolveAppCheckProviderMode({
    runtimeProvider,
    envProvider,
    fallback: "enterprise",
  });
};

const createAppCheckProvider = (siteKey = "", providerMode = "enterprise") => {
  if (!siteKey) return null;
  if (providerMode === "v3") {
    return new ReCaptchaV3Provider(siteKey);
  }
  return new ReCaptchaEnterpriseProvider(siteKey);
};

if (typeof window !== "undefined") {
  const host = window.location?.hostname || "";
  try {
    const runtimeDebugToken = typeof window.__app_check_debug_token === "string"
      ? window.__app_check_debug_token.trim()
      : "";
    const storedDebugToken = window.localStorage?.getItem("bross_app_check_debug_token") || "";
    const storedDebugEnabled = window.localStorage?.getItem("bross_app_check_debug_enabled") || "";
    const debugToken = resolveRuntimeAppCheckDebugToken({
      runtimeDebugToken,
      storedDebugToken,
    });
    const debugEnabled = shouldEnableRuntimeAppCheckDebug({
      host,
      envEnabled: readEnv("VITE_APP_CHECK_DEBUG_ENABLED"),
      runtimeEnabled: window.__app_check_debug_enabled === true,
      storedEnabled: storedDebugEnabled,
    });
    if (debugToken && debugEnabled) {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === "true" ? true : debugToken;
    }
  } catch {
    // Ignore storage access failures and continue without debug token.
  }

}

const initializeAppCheckClient = () => {
  if (appCheckDisabledReason) return null;
  if (appCheck || appCheckInitAttempted || typeof window === "undefined") return appCheck;
  appCheckInitAttempted = true;

  const appCheckEnabled = shouldEnableAppCheckClient();
  const siteKey = getAppCheckSiteKey();
  const providerMode = getAppCheckProviderMode();
  if (appCheckEnabled && siteKey) {
    try {
      const provider = createAppCheckProvider(siteKey, providerMode);
      if (!provider) {
        throw new Error("App Check provider could not be created.");
      }
      appCheck = initializeAppCheck(app, {
        provider,
        isTokenAutoRefreshEnabled: true,
      });
      return appCheck;
    } catch (err) {
      firebaseLogger.warn("app-check initialization failed", err);
      return null;
    }
  }
  if (appCheckEnabled && !siteKey) {
    firebaseLogger.debug("app-check enabled but missing site key: set VITE_RECAPTCHA_V3_SITE_KEY.");
  } else {
    firebaseLogger.debug("app-check disabled (set VITE_APP_CHECK_ENABLED=true to enable).");
  }
  return null;
}

const shouldDisableAppCheckClient = (error) => {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return (
    code.includes("appcheck/throttled")
    || code.includes("appcheck/initial-throttle")
    || message.includes("appcheck/throttled")
    || message.includes("appcheck/initial-throttle")
    || message.includes("exchangeRecaptchaEnterpriseToken".toLowerCase())
    || message.includes("403")
    || message.includes("forbidden")
    || message.includes("401")
    || message.includes("unauthorized")
  );
};

const disableAppCheckClient = (reason = "unavailable", error = null) => {
  if (appCheckDisabledReason) return;
  appCheckDisabledReason = reason;
  appCheck = null;
  firebaseLogger.warn("app-check disabled for current session", { reason, error });
};

const auth = getAuth(app);
if (typeof window !== 'undefined') {
  const host = window.location?.hostname || '';
  if (host === 'localhost' || host === '127.0.0.1') {
    if (auth?.settings) {
      auth.settings.appVerificationDisabledForTesting = true;
    }
  }
}
const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);
const functions = getFunctions(app, "us-west1");
let analytics = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch {
    analytics = null;
  }
}

const trackEvent = (name, params = {}) => {
  if (!analytics) return;
  try {
    logEvent(analytics, name, params);
  } catch {
    // Swallow analytics errors to avoid breaking UX.
  }
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ensureAppCheckToken = async (forceRefresh = false) => {
  if (appCheckDisabledReason) return false;
  initializeAppCheckClient();
  if (!appCheck) return false;
  try {
    const tokenResult = await getAppCheckToken(appCheck, !!forceRefresh);
    return !!tokenResult?.token;
  } catch (error) {
    firebaseLogger.debug("app-check token fetch failed", { forceRefresh, error });
    if (!shouldRequireLocalAppCheck() && shouldDisableAppCheckClient(error)) {
      disableAppCheckClient("token-fetch-failed", error);
    }
    return false;
  }
};

const requireAppCheckToken = async (scope = "callable") => {
  const warmToken = await ensureAppCheckToken(false);
  if (warmToken) return true;
  const refreshedToken = await ensureAppCheckToken(true);
  if (refreshedToken) return true;
  if (!shouldRequireLocalAppCheck()) {
    firebaseLogger.debug("app-check token unavailable; continuing without client-side token", { scope });
    return false;
  }
  const err = new Error(`App Check token required for ${scope}.`);
  err.code = "failed-precondition";
  throw err;
};

const callFunction = async (name, data = {}) => {
  initializeAppCheckClient();
  const fn = httpsCallable(functions, name);
  const invoke = async () => {
    const res = await fn(data);
    return res.data;
  };

  if (appCheck && !appCheckDisabledReason) {
    try {
      await getAppCheckToken(appCheck, false);
    } catch (err) {
      firebaseLogger.debug("app-check token fetch failed before callable", { name, err });
      if (!shouldRequireLocalAppCheck() && shouldDisableAppCheckClient(err)) {
        disableAppCheckClient(`callable-prefetch-failed:${name}`, err);
      }
    }
  }

  try {
    return await invoke();
  } catch (error) {
    if (appCheck && !appCheckDisabledReason && isRecoverableAppCheckError(error)) {
      let retryError = error;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          const throttled = isAppCheckThrottledError(retryError);
          const waitMs = getAppCheckRetryDelayMs(attempt, throttled);
          if (waitMs > 0) {
            await delay(waitMs);
          }
          // Avoid force-refreshing while throttled; let the cached token path recover.
          await getAppCheckToken(appCheck, !throttled);
          return await invoke();
        } catch (nextError) {
          retryError = nextError;
          if (!shouldRequireLocalAppCheck() && shouldDisableAppCheckClient(nextError)) {
            disableAppCheckClient(`callable-retry-failed:${name}`, nextError);
            break;
          }
          if (!isRecoverableAppCheckError(nextError)) {
            throw nextError;
          }
        }
      }
      firebaseLogger.warn("callable retry failed after app-check refresh", { name, retryError });
      throw retryError;
    }
    throw error;
  }
};

const getGoogleMapsApiKey = async () => {
  const data = await callFunction("googleMapsKey");
  return data?.apiKey || "";
};

const submitMarketingWaitlist = async (payload = {}) => {
  const data = await callFunction("submitMarketingWaitlist", payload || {});
  return data || null;
};

const setHostApprovalStatus = async (payload = {}) => {
  await requireAppCheckToken("setHostApprovalStatus");
  const data = await callFunction("setHostApprovalStatus", payload || {});
  return data || null;
};

const listHostApplications = async (payload = {}) => {
  await requireAppCheckToken("listHostApplications");
  const data = await callFunction("listHostApplications", payload || {});
  return data || null;
};

const resolveHostApplication = async (payload = {}) => {
  await requireAppCheckToken("resolveHostApplication");
  const data = await callFunction("resolveHostApplication", payload || {});
  return data || null;
};

const getMyHostAccessStatus = async (payload = {}) => {
  await requireAppCheckToken("getMyHostAccessStatus");
  const data = await callFunction("getMyHostAccessStatus", payload || {});
  return data || null;
};

const getMyDirectoryAccess = async (payload = {}) => {
  await requireAppCheckToken("getMyDirectoryAccess");
  const data = await callFunction("getMyDirectoryAccess", payload || {});
  return data || null;
};

const setMyVipAccountStatus = async (payload = {}) => {
  await requireAppCheckToken("setMyVipAccountStatus");
  const data = await callFunction("setMyVipAccountStatus", payload || {});
  return data || null;
};

const getDirectoryMapsConfig = async () => {
  const data = await callFunction("getDirectoryMapsConfig", {});
  return data || null;
};

const upsertDirectoryProfile = async (payload = {}) => {
  await requireAppCheckToken("upsertDirectoryProfile");
  const data = await callFunction("upsertDirectoryProfile", payload || {});
  return data || null;
};

const submitDirectoryListing = async (payload = {}) => {
  await requireAppCheckToken("submitDirectoryListing");
  const data = await callFunction("submitDirectoryListing", payload || {});
  return data || null;
};

const upsertHostRoomDiscoveryListing = async (payload = {}) => {
  await requireAppCheckToken("upsertHostRoomDiscoveryListing");
  const data = await callFunction("upsertHostRoomDiscoveryListing", payload || {});
  return data || null;
};

const updateDirectoryListing = async (payload = {}) => {
  await requireAppCheckToken("updateDirectoryListing");
  const data = await callFunction("updateDirectoryListing", payload || {});
  return data || null;
};

const followDirectoryEntity = async (payload = {}) => {
  await requireAppCheckToken("followDirectoryEntity");
  const data = await callFunction("followDirectoryEntity", payload || {});
  return data || null;
};

const unfollowDirectoryEntity = async (payload = {}) => {
  await requireAppCheckToken("unfollowDirectoryEntity");
  const data = await callFunction("unfollowDirectoryEntity", payload || {});
  return data || null;
};

const createDirectoryCheckin = async (payload = {}) => {
  await requireAppCheckToken("createDirectoryCheckin");
  const data = await callFunction("createDirectoryCheckin", payload || {});
  return data || null;
};

const submitDirectoryReview = async (payload = {}) => {
  await requireAppCheckToken("submitDirectoryReview");
  const data = await callFunction("submitDirectoryReview", payload || {});
  return data || null;
};

const listModerationQueue = async (payload = {}) => {
  await requireAppCheckToken("listModerationQueue");
  const data = await callFunction("listModerationQueue", payload || {});
  return data || null;
};

const resolveModerationItem = async (payload = {}) => {
  await requireAppCheckToken("resolveModerationItem");
  const data = await callFunction("resolveModerationItem", payload || {});
  return data || null;
};

const runExternalDirectoryIngestion = async (payload = {}) => {
  await requireAppCheckToken("runExternalDirectoryIngestion");
  const data = await callFunction("runExternalDirectoryIngestion", payload || {});
  return data || null;
};

const submitDirectoryClaimRequest = async (payload = {}) => {
  await requireAppCheckToken("submitDirectoryClaimRequest");
  const data = await callFunction("submitDirectoryClaimRequest", payload || {});
  return data || null;
};

const resolveDirectoryClaimRequest = async (payload = {}) => {
  await requireAppCheckToken("resolveDirectoryClaimRequest");
  const data = await callFunction("resolveDirectoryClaimRequest", payload || {});
  return data || null;
};

const setDirectoryRsvp = async (payload = {}) => {
  await requireAppCheckToken("setDirectoryRsvp");
  const data = await callFunction("setDirectoryRsvp", payload || {});
  return data || null;
};

const setDirectoryReminderPreferences = async (payload = {}) => {
  await requireAppCheckToken("setDirectoryReminderPreferences");
  const data = await callFunction("setDirectoryReminderPreferences", payload || {});
  return data || null;
};

const listDirectoryGeoLanding = async (payload = {}) => {
  await requireAppCheckToken("listDirectoryGeoLanding");
  const data = await callFunction("listDirectoryGeoLanding", payload || {});
  return data || null;
};

const listDirectoryDiscover = async (payload = {}) => {
  await requireAppCheckToken("listDirectoryDiscover");
  const data = await callFunction("listDirectoryDiscover", payload || {});
  return data || null;
};

const submitCatalogContribution = async (payload = {}) => {
  await requireAppCheckToken("submitCatalogContribution");
  const data = await callFunction("submitCatalogContribution", payload || {});
  return data || null;
};

const listCatalogContributionQueue = async (payload = {}) => {
  await requireAppCheckToken("listCatalogContributionQueue");
  const data = await callFunction("listCatalogContributionQueue", payload || {});
  return data || null;
};

const resolveCatalogContribution = async (payload = {}) => {
  await requireAppCheckToken("resolveCatalogContribution");
  const data = await callFunction("resolveCatalogContribution", payload || {});
  return data || null;
};

const previewDirectoryRoomSessionByCode = async (payload = {}) => {
  await requireAppCheckToken("previewDirectoryRoomSessionByCode");
  const data = await callFunction("previewDirectoryRoomSessionByCode", payload || {});
  return data || null;
};

const sendBeauRocksEmailSignInLink = async (payload = {}) => {
  await requireAppCheckToken("sendBeauRocksEmailSignInLink");
  const data = await callFunction("sendBeauRocksEmailSignInLink", payload || {});
  return data || null;
};

const joinRoomAudience = async (payload = {}) => {
  await requireAppCheckToken("joinRoomAudience");
  const data = await callFunction("joinRoomAudience", payload || {});
  return data || null;
};

const claimTimedLobbyCredits = async (payload = {}) => {
  await requireAppCheckToken("claimTimedLobbyCredits");
  const data = await callFunction("claimTimedLobbyCredits", payload || {});
  return data || null;
};

const submitAudienceEmailCapture = async (payload = {}) => {
  await requireAppCheckToken("submitAudienceEmailCapture");
  const data = await callFunction("submitAudienceEmailCapture", payload || {});
  return data || null;
};

const updateAudienceIdentity = async (payload = {}) => {
  await requireAppCheckToken("updateAudienceIdentity");
  const data = await callFunction("updateAudienceIdentity", payload || {});
  return data || null;
};

const uploadAudienceRoomPhoto = async (payload = {}) => {
  await requireAppCheckToken("uploadAudienceRoomPhoto");
  const data = await callFunction("uploadAudienceRoomPhoto", payload || {});
  return data || null;
};

const uploadHostSceneMedia = async (payload = {}) => {
  await requireAppCheckToken("uploadHostSceneMedia");
  const data = await callFunction("uploadHostSceneMedia", payload || {});
  return data || null;
};

const submitAudienceQueueSong = async (payload = {}) => {
  await requireAppCheckToken("submitAudienceQueueSong");
  const data = await callFunction("submitAudienceQueueSong", payload || {});
  return data || null;
};

const castKaraokeBracketVote = async (payload = {}) => {
  await requireAppCheckToken("castKaraokeBracketVote");
  const data = await callFunction("castKaraokeBracketVote", payload || {});
  return data || null;
};

const manageKaraokeBracket = async (payload = {}) => {
  await requireAppCheckToken("manageKaraokeBracket");
  const data = await callFunction("manageKaraokeBracket", payload || {});
  return data || null;
};

const submitBracketRoundSong = async (payload = {}) => {
  await requireAppCheckToken("submitBracketRoundSong");
  const data = await callFunction("submitBracketRoundSong", payload || {});
  return data || null;
};

const resolveKaraokeBracketMatch = async (payload = {}) => {
  await requireAppCheckToken("resolveKaraokeBracketMatch");
  const data = await callFunction("resolveKaraokeBracketMatch", payload || {});
  return data || null;
};

const submitSelfieChallengeEntry = async (payload = {}) => {
  await requireAppCheckToken("submitSelfieChallenge");
  const data = await callFunction("submitSelfieChallenge", payload || {});
  return data || null;
};

const castSelfieChallengeVote = async (payload = {}) => {
  await requireAppCheckToken("castSelfieChallengeVote");
  const data = await callFunction("castSelfieChallengeVote", payload || {});
  return data || null;
};

const submitDoodleOkeEntry = async (payload = {}) => {
  await requireAppCheckToken("submitDoodleOkeEntry");
  const data = await callFunction("submitDoodleOkeEntry", payload || {});
  return data || null;
};

const castDoodleOkeVote = async (payload = {}) => {
  await requireAppCheckToken("castDoodleOkeVote");
  const data = await callFunction("castDoodleOkeVote", payload || {});
  return data || null;
};

const castPromptVote = async (payload = {}) => {
  await requireAppCheckToken("castPromptVote");
  const data = await callFunction("castPromptVote", payload || {});
  return data || null;
};

const finalizePromptVoteRound = async (payload = {}) => {
  await requireAppCheckToken("finalizePromptVoteRound");
  const data = await callFunction("finalizePromptVoteRound", payload || {});
  return data || null;
};

const submitBingoTileConfirmation = async (payload = {}) => {
  await requireAppCheckToken("submitBingoTileConfirmation");
  const data = await callFunction("submitBingoTileConfirmation", payload || {});
  return data || null;
};

const submitBingoMysterySpin = async (payload = {}) => {
  await requireAppCheckToken("submitBingoMysterySpin");
  const data = await callFunction("submitBingoMysterySpin", payload || {});
  return data || null;
};

const lockBingoMysteryPick = async (payload = {}) => {
  await requireAppCheckToken("lockBingoMysteryPick");
  const data = await callFunction("lockBingoMysteryPick", payload || {});
  return data || null;
};

const mergeAnonymousAccountData = async (payload = {}) => {
  await requireAppCheckToken("mergeAnonymousAccountData");
  const data = await callFunction("mergeAnonymousAccountData", payload || {});
  return data || null;
};

const claimAudienceEventGrant = async (payload = {}) => {
  await requireAppCheckToken("claimAudienceEventGrant");
  const data = await callFunction("claimAudienceEventGrant", payload || {});
  return data || null;
};

const redeemPromoCode = async (payload = {}) => {
  await requireAppCheckToken("redeemPromoCode");
  const data = await callFunction("redeemPromoCode", payload || {});
  return data || null;
};

const ensureOrganization = async (orgName = "") => {
  await requireAppCheckToken("ensureOrganization");
  const data = await callFunction("ensureOrganization", { orgName });
  return data || null;
};

const bootstrapOnboardingWorkspace = async (opts = {}) => {
  await requireAppCheckToken("bootstrapOnboardingWorkspace");
  const data = await callFunction("bootstrapOnboardingWorkspace", opts || {});
  return data || null;
};

const getMyEntitlements = async () => {
  await requireAppCheckToken("getMyEntitlements");
  const data = await callFunction("getMyEntitlements");
  return data || null;
};

const listHostWorkspaceOperators = async (payload = {}) => {
  await requireAppCheckToken("listHostWorkspaceOperators");
  const data = await callFunction("listHostWorkspaceOperators", payload || {});
  return data || null;
};

const searchHostVenueAutocomplete = async (payload = {}) => {
  await requireAppCheckToken("searchHostVenueAutocomplete");
  const data = await callFunction("searchHostVenueAutocomplete", payload || {});
  return data || null;
};

const getMyUsageSummary = async (period = "") => {
  await requireAppCheckToken("getMyUsageSummary");
  const payload = period ? { period } : {};
  const data = await callFunction("getMyUsageSummary", payload);
  return data || null;
};

const getMyUsageInvoiceDraft = async (opts = {}) => {
  await requireAppCheckToken("getMyUsageInvoiceDraft");
  const data = await callFunction("getMyUsageInvoiceDraft", opts || {});
  return data || null;
};

const saveMyUsageInvoiceDraft = async (opts = {}) => {
  await requireAppCheckToken("saveMyUsageInvoiceDraft");
  const data = await callFunction("saveMyUsageInvoiceDraft", opts || {});
  return data || null;
};

const listMyUsageInvoices = async (opts = {}) => {
  await requireAppCheckToken("listMyUsageInvoices");
  const data = await callFunction("listMyUsageInvoices", opts || {});
  return data || null;
};

const assertRoomHostAccess = async (roomCode = "") => {
  await requireAppCheckToken("assertRoomHostAccess");
  const data = await callFunction("assertRoomHostAccess", { roomCode });
  return data || null;
};

const removeHostRoomDiscoveryListing = async (roomCode = "") => {
  await requireAppCheckToken("removeHostRoomDiscoveryListing");
  const data = await callFunction("removeHostRoomDiscoveryListing", { roomCode });
  return data || null;
};

const provisionHostRoom = async (payload = {}) => {
  await requireAppCheckToken("provisionHostRoom");
  const data = await callFunction("provisionHostRoom", payload || {});
  return data || null;
};

const updateRoomAsHost = async (roomCode = "", updates = {}) => {
  await requireAppCheckToken("updateRoomAsHost");
  const data = await callFunction("updateRoomAsHost", {
    roomCode,
    updates: updates || {},
  });
  return data || null;
};

const submitRunOfShowSlotSong = async (payload = {}) => {
  await requireAppCheckToken("submitRunOfShowSlotSong");
  const data = await callFunction("submitRunOfShowSlotSong", payload || {});
  return data || null;
};

const reviewRunOfShowSlotSubmission = async (payload = {}) => {
  await requireAppCheckToken("reviewRunOfShowSlotSubmission");
  const data = await callFunction("reviewRunOfShowSlotSubmission", payload || {});
  return data || null;
};

const executeRunOfShowAction = async (payload = {}) => {
  await requireAppCheckToken("executeRunOfShowAction");
  const data = await callFunction("executeRunOfShowAction", payload || {});
  return data || null;
};

const manageRunOfShowTemplate = async (payload = {}) => {
  await requireAppCheckToken("manageRunOfShowTemplate");
  const data = await callFunction("manageRunOfShowTemplate", payload || {});
  return data || null;
};

const resolveQueueSongLyrics = async (payload = {}) => {
  await requireAppCheckToken("resolveQueueSongLyrics");
  const data = await callFunction("resolveQueueSongLyrics", payload || {});
  return data || null;
};

const runDemoDirectorAction = async (payload = {}) => {
  await requireAppCheckToken("runDemoDirectorAction");
  const data = await callFunction("runDemoDirectorAction", payload || {});
  return data || null;
};

const recordMarketingTelemetry = async (payload = {}) => {
  await requireAppCheckToken("recordMarketingTelemetry");
  const data = await callFunction("recordMarketingTelemetry", payload || {});
  return data || null;
};

const getMarketingReportingSummary = async (payload = {}) => {
  await requireAppCheckToken("getMarketingReportingSummary");
  const data = await callFunction("getMarketingReportingSummary", payload || {});
  return data || null;
};

const waitForInitialAuthState = async (timeoutMs = 4000) => {
  const timeout = Math.max(1000, Number(timeoutMs || 0));
  try {
    if (typeof auth?.authStateReady === "function") {
      await Promise.race([
        auth.authStateReady(),
        new Promise((resolve) => setTimeout(resolve, timeout)),
      ]);
      return;
    }
  } catch (error) {
    firebaseLogger.debug("authStateReady unavailable; falling back to onAuthStateChanged", error);
  }

  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    let unsub = () => {};
    try {
      unsub = onAuthStateChanged(
        auth,
        () => {
          try { unsub(); } catch (error) {
            firebaseLogger.debug("Failed to unsubscribe auth observer", error);
          }
          finish();
        },
        () => {
          try { unsub(); } catch (error) {
            firebaseLogger.debug("Failed to unsubscribe auth observer", error);
          }
          finish();
        }
      );
    } catch {
      finish();
      return;
    }

    setTimeout(() => {
      try { unsub(); } catch (error) {
        firebaseLogger.debug("Failed to unsubscribe auth observer", error);
      }
      finish();
    }, timeout);
  });
};

// Helper for Auth
const initAuth = async (customTokenOrOptions) => {
  try {
    const initOptions = (
      customTokenOrOptions
      && typeof customTokenOrOptions === "object"
      && !Array.isArray(customTokenOrOptions)
    )
      ? customTokenOrOptions
      : { customToken: customTokenOrOptions };
    const customToken = initOptions?.customToken;

    const preferredPersistence = resolveAuthPersistenceMode();
    try {
      await setPersistence(auth, preferredPersistence);
    } catch {
      try {
        await setPersistence(auth, inMemoryPersistence);
      } catch (inner) {
        firebaseLogger.debug("Auth persistence fallback failed", inner);
      }
    }

    await waitForInitialAuthState();

    if (customToken) {
      await signInWithCustomToken(auth, customToken);
      return { ok: true };
    }

    const qaAuthBootstrap = resolveQaAuthBootstrap();
    if (qaAuthBootstrap) {
      await signInWithEmailAndPassword(auth, qaAuthBootstrap.email, qaAuthBootstrap.password);
      return { ok: true, qaBootstrap: true };
    }

    if (!shouldBootstrapAnonymousAuth({
      customToken,
      currentUser: auth.currentUser,
      viewHint: initOptions?.viewHint,
      locationLike: initOptions?.locationLike,
    })) {
      return {
        ok: true,
        reusedExistingSession: true,
        isAnonymous: !!auth.currentUser?.isAnonymous,
      };
    }

    await signInAnonymously(auth);
    return { ok: true };
  } catch (error) {
    firebaseLogger.error("Auth Error", error);
    return { ok: false, error };
  }
};

// Ensure a top-level user profile exists for persistent data across rooms
const ensuredUserProfileCache = new Map();
const ensureUserProfile = async (uid, opts = {}) => {
  try {
    if (!uid) return;
    const { name = 'Guest' } = opts;
    const defaultAvatar = '\uD83D\uDE00';
    const ensureKey = `${uid}:${String(name)}`;
    if (ensuredUserProfileCache.get(uid) === ensureKey) return;
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid,
        name,
        avatar: defaultAvatar,
        tight15: [],
        unlockedEmojis: [],
        firstPerformanceUnlocked: false,
        pointsBalance: 0,
        createdAt: serverTimestamp(),

        // Subscription (no pay-to-win multipliers - only convenience/features)
        subscription: {
          tier: 'free', // 'free' | 'vip' | 'host' | 'host_plus'
          plan: 'monthly', // 'monthly' or 'yearly' (only relevant for paid tiers)
          startDate: null,
          renewalDate: null,
          cancelledAt: null,
          paymentMethod: null // 'stripe', 'appstore', 'playstore'
        },
        organization: {
          orgId: null,
          role: 'member',
          updatedAt: null
        },

        // VIP profile fields (public-facing)
        vipProfile: {
          location: '',
          birthMonth: '',
          birthDay: '',
          smsOptIn: false,
          tosAccepted: false,
          tosAcceptedAt: null
        },
        
        // Profile Augmentation
        profile: {
          bio: null,
          pronouns: null,
          favoriteGenre: null,
          musicPreferences: [], // Array of genre strings
          socialLinks: {}, // { spotify: url, instagram: url, etc }
          recordLabel: null,
          profilePictureUrl: null,
          profileCompletion: 0 // 0-100%
        },
        
        // Augmentation Bonuses Tracking (to prevent double-awarding)
        augmentationBonuses: {
          profilePicture: false,
          bio: false,
          musicPreferences: false,
          pronouns: false,
          favoriteGenre: false,
          socialLinks: [],
          recordLabel: false
        },
        crowdSelfieUrl: null,
        crowdSelfieStoragePath: null,
        crowdSelfieStatus: null,
        crowdSelfieApprovedAt: null,
        crowdSelfieSourceRoomCode: null,
        crowdSelfieSubmissionId: null,
        crowdSelfieConsentAcceptedAt: null
      });
      ensuredUserProfileCache.set(uid, ensureKey);
      return;
    }

    const data = snap.data() || {};
    const updates = {};
    if (data.uid !== uid) updates.uid = uid;
    if (data.name !== name) updates.name = name;
    if (!('avatar' in data)) updates.avatar = defaultAvatar;
    if (!('tight15' in data)) updates.tight15 = [];
    if (!('unlockedEmojis' in data)) updates.unlockedEmojis = [];
    if (!('firstPerformanceUnlocked' in data)) updates.firstPerformanceUnlocked = false;
    if (!('pointsBalance' in data)) updates.pointsBalance = 0;
    if (!('createdAt' in data)) updates.createdAt = serverTimestamp();
    if (!('vipProfile' in data)) updates.vipProfile = {
      location: '',
      birthMonth: '',
      birthDay: '',
      smsOptIn: false,
      tosAccepted: false,
      tosAcceptedAt: null
    };
    if (!('profile' in data)) updates.profile = {
      bio: null,
      pronouns: null,
      favoriteGenre: null,
      musicPreferences: [],
      socialLinks: {},
      recordLabel: null,
      profilePictureUrl: null,
      profileCompletion: 0
    };
    if (!('augmentationBonuses' in data)) updates.augmentationBonuses = {
      profilePicture: false,
      bio: false,
      musicPreferences: false,
      pronouns: false,
      favoriteGenre: false,
      socialLinks: [],
      recordLabel: false
    };
    if (!('crowdSelfieUrl' in data)) updates.crowdSelfieUrl = null;
    if (!('crowdSelfieStoragePath' in data)) updates.crowdSelfieStoragePath = null;
    if (!('crowdSelfieStatus' in data)) updates.crowdSelfieStatus = null;
    if (!('crowdSelfieApprovedAt' in data)) updates.crowdSelfieApprovedAt = null;
    if (!('crowdSelfieSourceRoomCode' in data)) updates.crowdSelfieSourceRoomCode = null;
    if (!('crowdSelfieSubmissionId' in data)) updates.crowdSelfieSubmissionId = null;
    if (!('crowdSelfieConsentAcceptedAt' in data)) updates.crowdSelfieConsentAcceptedAt = null;

    if (!Object.keys(updates).length) {
      ensuredUserProfileCache.set(uid, ensureKey);
      return;
    }

    await setDoc(userRef, updates, { merge: true });
    ensuredUserProfileCache.set(uid, ensureKey);
  } catch (e) {
    ensuredUserProfileCache.delete(uid);
    firebaseLogger.error("ensureUserProfile error", e);
  }
};

export { 
  app, 
  appCheck,
  ensureAppCheckToken,
  analytics,
  trackEvent,
  functions,
  callFunction,
  getGoogleMapsApiKey,
  submitMarketingWaitlist,
  setHostApprovalStatus,
  listHostApplications,
  resolveHostApplication,
  getMyHostAccessStatus,
  getMyDirectoryAccess,
  setMyVipAccountStatus,
  getDirectoryMapsConfig,
  upsertDirectoryProfile,
  submitDirectoryListing,
  upsertHostRoomDiscoveryListing,
  updateDirectoryListing,
  followDirectoryEntity,
  unfollowDirectoryEntity,
  createDirectoryCheckin,
  submitDirectoryReview,
  listModerationQueue,
  resolveModerationItem,
  runExternalDirectoryIngestion,
  submitDirectoryClaimRequest,
  resolveDirectoryClaimRequest,
  setDirectoryRsvp,
  setDirectoryReminderPreferences,
  listDirectoryGeoLanding,
  listDirectoryDiscover,
  submitCatalogContribution,
  listCatalogContributionQueue,
  resolveCatalogContribution,
  previewDirectoryRoomSessionByCode,
  sendBeauRocksEmailSignInLink,
  joinRoomAudience,
  claimTimedLobbyCredits,
  submitAudienceEmailCapture,
  updateAudienceIdentity,
  uploadAudienceRoomPhoto,
  uploadHostSceneMedia,
  submitAudienceQueueSong,
  castKaraokeBracketVote,
  manageKaraokeBracket,
  submitBracketRoundSong,
  resolveKaraokeBracketMatch,
  submitSelfieChallengeEntry,
  castSelfieChallengeVote,
  submitDoodleOkeEntry,
  castDoodleOkeVote,
  castPromptVote,
  finalizePromptVoteRound,
  submitBingoTileConfirmation,
  submitBingoMysterySpin,
  lockBingoMysteryPick,
  mergeAnonymousAccountData,
  claimAudienceEventGrant,
  redeemPromoCode,
  ensureOrganization,
  bootstrapOnboardingWorkspace,
  getMyEntitlements,
  listHostWorkspaceOperators,
  searchHostVenueAutocomplete,
  getMyUsageSummary,
  getMyUsageInvoiceDraft,
  saveMyUsageInvoiceDraft,
  listMyUsageInvoices,
  assertRoomHostAccess,
  removeHostRoomDiscoveryListing,
  provisionHostRoom,
  updateRoomAsHost,
  submitRunOfShowSlotSong,
  reviewRunOfShowSlotSubmission,
  executeRunOfShowAction,
  manageRunOfShowTemplate,
  resolveQueueSongLyrics,
  runDemoDirectorAction,
  recordMarketingTelemetry,
  getMarketingReportingSummary,
  auth, 
  db, 
  rtdb, 
  storage,
  storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  initAuth,
  ensureUserProfile,
  // Auth Exports
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  EmailAuthProvider,
  linkWithCredential,
  signInWithCredential,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  // Firestore Exports
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, onSnapshot, serverTimestamp, increment, writeBatch, orderBy, limit,
  arrayUnion, arrayRemove, runTransaction,
  // RTDB Exports
  ref, set, onValue, remove, push, rtdbTimestamp
};
