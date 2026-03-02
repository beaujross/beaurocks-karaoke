import { useCallback, useEffect, useMemo, useState } from "react";
import {
  auth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  EmailAuthProvider,
  linkWithCredential,
  signOut,
  ensureUserProfile,
  mergeAnonymousAccountData,
} from "../../../lib/firebase";
import { subscribeModeratorAccess } from "../api/directoryApi";

const normalizeAuthError = (error) =>
  String(error?.message || error?.code || "Auth failed.").replace(/^Firebase:\s*/i, "");

export const useDirectorySession = () => {
  const [user, setUser] = useState(() => auth.currentUser || null);
  const [ready, setReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [modAccess, setModAccess] = useState({ isModerator: false, isAdmin: false, roles: [] });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser || null);
      setReady(true);
      setAuthError("");
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setModAccess({ isModerator: false, isAdmin: false, roles: [] });
      return () => {};
    }
    return subscribeModeratorAccess({
      uid: user.uid,
      onData: setModAccess,
      onError: () => setModAccess({ isModerator: false, isAdmin: false, roles: [] }),
    });
  }, [user?.uid]);

  const ensureProfile = useCallback(async (nextUser, fallbackName = "BeauRocks User") => {
    if (!nextUser?.uid) return;
    await ensureUserProfile(nextUser.uid, {
      name: fallbackName,
      avatar: ":)",
    });
  }, []);

  const signInWithEmail = useCallback(async ({ email, password }) => {
    setAuthLoading(true);
    setAuthError("");
    const activeAnonUid = auth.currentUser?.isAnonymous ? auth.currentUser.uid : "";
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await ensureProfile(credential.user, email.split("@")[0] || "BeauRocks User");
      if (activeAnonUid && credential.user?.uid && activeAnonUid !== credential.user.uid) {
        await mergeAnonymousAccountData({
          sourceUid: activeAnonUid,
          targetUid: credential.user.uid,
        }).catch(() => {});
      }
      return { ok: true, user: credential.user };
    } catch (error) {
      setAuthError(normalizeAuthError(error));
      return { ok: false, error };
    } finally {
      setAuthLoading(false);
    }
  }, [ensureProfile]);

  const signUpWithEmail = useCallback(async ({ email, password }) => {
    setAuthLoading(true);
    setAuthError("");
    const activeUser = auth.currentUser;
    try {
      let createdUser = null;
      if (activeUser?.isAnonymous) {
        const credential = EmailAuthProvider.credential(email, password);
        const linked = await linkWithCredential(activeUser, credential);
        createdUser = linked.user;
      } else {
        const created = await createUserWithEmailAndPassword(auth, email, password);
        createdUser = created.user;
      }
      await ensureProfile(createdUser, email.split("@")[0] || "BeauRocks User");
      return { ok: true, user: createdUser };
    } catch (error) {
      setAuthError(normalizeAuthError(error));
      return { ok: false, error };
    } finally {
      setAuthLoading(false);
    }
  }, [ensureProfile]);

  const signOutAccount = useCallback(async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      await signOut(auth);
      return { ok: true };
    } catch (error) {
      setAuthError(normalizeAuthError(error));
      return { ok: false, error };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async ({ email }) => {
    const safeEmail = String(email || "").trim();
    if (!safeEmail) {
      setAuthError("Enter your account email first.");
      return { ok: false, code: "missing-email" };
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      await sendPasswordResetEmail(auth, safeEmail);
      return { ok: true };
    } catch (error) {
      const code = String(error?.code || "").toLowerCase();
      if (code.includes("user-not-found")) {
        return { ok: true };
      }
      setAuthError(normalizeAuthError(error));
      return { ok: false, error };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const session = useMemo(() => ({
    ready,
    user,
    uid: user?.uid || "",
    email: user?.email || "",
    isAuthed: !!user?.uid,
    isAnonymous: !!user?.isAnonymous,
    isModerator: !!modAccess.isModerator,
    isAdmin: !!modAccess.isAdmin,
    roles: modAccess.roles || [],
    authLoading,
    authError,
  }), [ready, user, modAccess, authLoading, authError]);

  return {
    session,
    actions: {
      signInWithEmail,
      signUpWithEmail,
      signOutAccount,
      requestPasswordReset,
      clearAuthError: () => setAuthError(""),
    },
  };
};
