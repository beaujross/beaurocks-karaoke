import { POINTS_PACKS } from "./catalog";

export const BILLING_PLATFORMS = {
  WEB: "web",
  IOS: "ios",
};

export const detectBillingPlatform = () => {
  if (typeof navigator === "undefined") return BILLING_PLATFORMS.WEB;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return BILLING_PLATFORMS.IOS;
  return BILLING_PLATFORMS.WEB;
};

const normalizePointsPack = (pack) => {
  if (!pack) return null;
  const match = POINTS_PACKS.find((item) => item.id === pack.id);
  return match || pack;
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

  async purchaseSubscription() {
    throw new Error("Subscriptions on web are not wired yet.");
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
