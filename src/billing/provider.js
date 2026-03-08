import { POINTS_PACKS, SUBSCRIPTIONS } from "./catalog";

export const BILLING_PLATFORMS = {
  WEB: "web",
  IOS: "ios",
};

const isNativeAppleBillingSurface = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (!/iPad|iPhone|iPod/i.test(ua)) return false;
  const explicitPlatform = String(window.__BEAUROCKS_NATIVE_BILLING__ || "").trim().toLowerCase();
  if (explicitPlatform === BILLING_PLATFORMS.IOS) return true;
  if (typeof window.Capacitor?.isNativePlatform === "function" && window.Capacitor.isNativePlatform()) {
    return true;
  }
  return !!window.webkit?.messageHandlers?.beaurocksBilling;
};

export const detectBillingPlatform = () => {
  if (isNativeAppleBillingSurface()) return BILLING_PLATFORMS.IOS;
  return BILLING_PLATFORMS.WEB;
};

const normalizePointsPack = (pack) => {
  if (!pack) return null;
  const match = POINTS_PACKS.find((item) => item.id === pack.id);
  return match || pack;
};

const normalizeSubscriptionPlan = (plan) => {
  if (!plan) return null;
  const planId = typeof plan === "string" ? plan : plan.id;
  if (!planId) return null;
  const match = SUBSCRIPTIONS.find((item) => item.id === planId);
  return match || { id: planId };
};

class WebStripeBillingProvider {
  constructor({ callFunction, origin }) {
    this.callFunction = callFunction;
    this.origin = origin;
  }

  async purchasePointsPack({ pack, roomCode, userUid, userName }) {
    const selected = normalizePointsPack(pack);
    if (!selected?.id || !roomCode) {
      throw new Error("Invalid points pack.");
    }
    const payload = await this.callFunction("createPointsCheckout", {
      roomCode,
      packId: selected.id,
      label: selected.label,
      amount: selected.amount,
      points: selected.points,
      userUid,
      userName,
      origin: this.origin,
    });
    return payload;
  }

  async purchaseTipCrate({ crate, roomCode, userUid, userName }) {
    if (!crate?.id || !roomCode) {
      throw new Error("Invalid tip crate.");
    }
    const payload = await this.callFunction("createTipCrateCheckout", {
      roomCode,
      crateId: crate.id,
      origin: this.origin,
      userName,
      userUid,
    });
    return payload;
  }

  async purchaseSubscription({ plan, orgName }) {
    const selected = normalizeSubscriptionPlan(plan);
    if (!selected?.id) {
      throw new Error("Invalid subscription plan.");
    }
    const payload = await this.callFunction("createSubscriptionCheckout", {
      planId: selected.id,
      orgName: orgName || "",
      origin: this.origin,
    });
    return payload;
  }
}

class AppleIapBillingProvider {
  async purchasePointsPack() {
    throw new Error("iOS in-app purchases are not wired yet.");
  }

  async purchaseTipCrate() {
    throw new Error("iOS in-app purchases are not wired yet.");
  }

  async purchaseSubscription() {
    throw new Error("iOS in-app purchases are not wired yet.");
  }
}

export const createBillingProvider = ({
  platform = detectBillingPlatform(),
  callFunction,
  origin = "",
}) => {
  if (platform === BILLING_PLATFORMS.IOS) {
    return new AppleIapBillingProvider();
  }
  return new WebStripeBillingProvider({ callFunction, origin });
};
