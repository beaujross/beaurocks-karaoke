import { initializeApp } from "firebase/app";
import { getAnalytics, logEvent } from "firebase/analytics";
import { initializeAppCheck, ReCaptchaV3Provider, getToken as getAppCheckToken } from "firebase/app-check";
import { getFunctions, httpsCallable } from "firebase/functions";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  EmailAuthProvider,
  linkWithCredential,
  updateProfile,
  setPersistence,
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
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "firebase/storage";

const readEnv = (name) => {
  if (typeof import.meta === "undefined" || !import.meta?.env) return "";
  const value = import.meta.env[name];
  return typeof value === "string" ? value.trim() : "";
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
      console.warn("[firebase] invalid window.__firebase_config JSON", err);
      return null;
    }
  }
  return null;
};

const resolveFirebaseConfig = () => {
  const runtimeConfig = parseRuntimeFirebaseConfig();
  if (runtimeConfig) {
    return runtimeConfig;
  }
  const envConfig = {
    apiKey: readEnv("VITE_FIREBASE_API_KEY"),
    authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: readEnv("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: readEnv("VITE_FIREBASE_APP_ID"),
    measurementId: readEnv("VITE_FIREBASE_MEASUREMENT_ID"),
  };
  const required = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId",
  ];
  const missing = required.filter((key) => !envConfig[key]);
  if (!missing.length) {
    return envConfig;
  }
  throw new Error(
    `Missing Firebase config: ${missing.join(", ")}. Set window.__firebase_config or VITE_FIREBASE_* env vars.`
  );
};

const firebaseConfig = resolveFirebaseConfig();

// Initialize
const app = initializeApp(firebaseConfig);
let appCheck = null;

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

if (typeof window !== "undefined") {
  const host = window.location?.hostname || "";
  try {
    const runtimeDebugToken = typeof window.__app_check_debug_token === "string"
      ? window.__app_check_debug_token.trim()
      : "";
    const storedDebugToken = window.localStorage?.getItem("bross_app_check_debug_token") || "";
    const debugToken = runtimeDebugToken || storedDebugToken;
    if (debugToken && (host === "localhost" || host === "127.0.0.1")) {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === "true" ? true : debugToken;
    }
  } catch {
    // Ignore storage access failures and continue without debug token.
  }

  const siteKey = getAppCheckSiteKey();
  if (siteKey) {
    try {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
      // Warm up token acquisition early so first callable requests include App Check.
      getAppCheckToken(appCheck, false).catch((err) => {
        console.warn("[app-check] initial token fetch failed", err);
      });
    } catch (err) {
      console.warn("[app-check] initialization failed", err);
    }
  } else {
    console.warn("[app-check] missing site key: set VITE_RECAPTCHA_V3_SITE_KEY to enable App Check.");
  }
}

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

const callFunction = async (name, data = {}) => {
  if (appCheck) {
    try {
      await getAppCheckToken(appCheck, false);
    } catch (err) {
      console.warn("[app-check] token fetch failed before callable", { name, err });
    }
  }
  const fn = httpsCallable(functions, name);
  const res = await fn(data);
  return res.data;
};

const getGoogleMapsApiKey = async () => {
  const data = await callFunction("googleMapsKey");
  return data?.apiKey || "";
};

const ensureOrganization = async (orgName = "") => {
  const data = await callFunction("ensureOrganization", { orgName });
  return data || null;
};

const getMyEntitlements = async () => {
  const data = await callFunction("getMyEntitlements");
  return data || null;
};

const getMyUsageSummary = async (period = "") => {
  const payload = period ? { period } : {};
  const data = await callFunction("getMyUsageSummary", payload);
  return data || null;
};

const getMyUsageInvoiceDraft = async (opts = {}) => {
  const data = await callFunction("getMyUsageInvoiceDraft", opts || {});
  return data || null;
};

const saveMyUsageInvoiceDraft = async (opts = {}) => {
  const data = await callFunction("saveMyUsageInvoiceDraft", opts || {});
  return data || null;
};

const listMyUsageInvoices = async (opts = {}) => {
  const data = await callFunction("listMyUsageInvoices", opts || {});
  return data || null;
};

// Helper for Auth
const initAuth = async (customToken) => {
  try {
    try {
      await setPersistence(auth, browserSessionPersistence);
    } catch {
      try {
        await setPersistence(auth, inMemoryPersistence);
      } catch (inner) {
        console.warn('Auth persistence fallback failed', inner);
      }
    }
    if (customToken) {
      await signInWithCustomToken(auth, customToken);
    } else {
      await signInAnonymously(auth);
    }
    return { ok: true };
  } catch (error) {
    console.error("Auth Error:", error);
    return { ok: false, error };
  }
};

// Ensure a top-level user profile exists for persistent data across rooms
const ensureUserProfile = async (uid, opts = {}) => {
  try {
    if (!uid) return;
    if (typeof window !== 'undefined') {
      const host = window.location?.hostname || 'unknown';
      console.info('[ensureUserProfile] host=%s uid=%s authUid=%s', host, uid, auth.currentUser?.uid || 'none');
    }
    const { name = 'Guest', avatar = '\uD83D\uDE00' } = opts;
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid,
        name,
        avatar,
        tight15: [],
        vipLevel: 0,
        unlockedEmojis: [],
        firstPerformanceUnlocked: false,
        createdAt: serverTimestamp(),
        
        // Fame System Fields
        totalFamePoints: 0,
        currentLevel: 0,
        levelProgress: 0,
        unlockedBadges: [],
        unlockedAvatars: [],
        
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
        
        // Last Performance (for display/leaderboard)
        lastPerformanceScore: {
          gameType: null,
          hypePoints: 0,
          decibelScore: 0,
          hostBonus: 1.0,
          totalFame: 0,
          timestamp: null,
          levelUpOccurred: false,
          previousLevel: 0,
          newLevel: 0
        }
      });
      return;
    }

    const data = snap.data() || {};
    const updates = { uid, name, avatar };
    if (!('tight15' in data)) updates.tight15 = [];
    if (!('vipLevel' in data)) updates.vipLevel = 0;
    if (!('unlockedEmojis' in data)) updates.unlockedEmojis = [];
    if (!('firstPerformanceUnlocked' in data)) updates.firstPerformanceUnlocked = false;
    if (!('createdAt' in data)) updates.createdAt = serverTimestamp();
    
    // Add Fame System fields if not present
    if (!('totalFamePoints' in data)) updates.totalFamePoints = 0;
    if (!('currentLevel' in data)) updates.currentLevel = 0;
    if (!('levelProgress' in data)) updates.levelProgress = 0;
    if (!('unlockedBadges' in data)) updates.unlockedBadges = [];
    if (!('unlockedAvatars' in data)) updates.unlockedAvatars = [];
    if (!('subscription' in data)) updates.subscription = {
      tier: 'free',
      startDate: null,
      renewalDate: null,
      cancelledAt: null,
      paymentMethod: null
    };
    if (!('organization' in data)) updates.organization = {
      orgId: null,
      role: 'member',
      updatedAt: null
    };
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
    if (!('lastPerformanceScore' in data)) updates.lastPerformanceScore = {
      gameType: null,
      hypePoints: 0,
      decibelScore: 0,
      hostBonus: 1.0,
      totalFame: 0,
      timestamp: null,
      levelUpOccurred: false,
      previousLevel: 0,
      newLevel: 0
    };
    
    await setDoc(userRef, updates, { merge: true });
  } catch (e) {
    console.error('ensureUserProfile error', e);
  }
};

export { 
  app, 
  appCheck,
  analytics,
  trackEvent,
  functions,
  callFunction,
  getGoogleMapsApiKey,
  ensureOrganization,
  getMyEntitlements,
  getMyUsageSummary,
  getMyUsageInvoiceDraft,
  saveMyUsageInvoiceDraft,
  listMyUsageInvoices,
  auth, 
  db, 
  rtdb, 
  storage,
  storageRef,
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
  GoogleAuthProvider,
  signInWithPopup,
  EmailAuthProvider,
  linkWithCredential,
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
  arrayUnion, arrayRemove,
  // RTDB Exports
  ref, set, onValue, remove, push, rtdbTimestamp
};
