import assert from "node:assert/strict";
import { test } from "vitest";
import {
  AUDIENCE_SHELL_VARIANTS,
  deriveAudienceTakeoverKind,
  getAudienceTakeoverLabel,
  normalizeAudienceShellVariant,
} from "../../src/apps/Mobile/audienceShellVariant.js";

test("audience shell variant helpers normalize and derive takeover state", () => {
  assert.equal(normalizeAudienceShellVariant("streamlined"), AUDIENCE_SHELL_VARIANTS.streamlined);
  assert.equal(normalizeAudienceShellVariant("CLASSIC"), AUDIENCE_SHELL_VARIANTS.classic);
  assert.equal(normalizeAudienceShellVariant("unexpected"), AUDIENCE_SHELL_VARIANTS.classic);

  assert.equal(deriveAudienceTakeoverKind({ activeMode: "bingo" }), "active:bingo");
  assert.equal(deriveAudienceTakeoverKind({ activeMode: "karaoke", lightMode: "storm" }), "light:storm");
  assert.equal(deriveAudienceTakeoverKind({ activeMode: "karaoke", lightMode: "off" }), "");

  assert.equal(getAudienceTakeoverLabel("active:selfie_challenge"), "Selfie Challenge");
  assert.equal(getAudienceTakeoverLabel("light:banger"), "Banger");
  assert.equal(getAudienceTakeoverLabel(""), "Live Mode");
});
