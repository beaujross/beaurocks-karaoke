import assert from "node:assert/strict";
import { test } from "vitest";

import { buildQaHostFixture } from "../../src/apps/Host/qaHostFixtures.js";
import { buildQaAudienceFixture } from "../../src/apps/Mobile/qaAudienceFixtures.js";

test("co-host audience QA fixtures expose deterministic face-off vote states", () => {
  const cohostFixture = buildQaAudienceFixture("cohost-song-faceoff", { roomCode: "DEMOAAHF" });
  const crowdFixture = buildQaAudienceFixture("crowd-song-faceoff", { roomCode: "DEMOAAHF" });
  const unlimitedFixture = buildQaAudienceFixture("cohost-unlimited-reactions", { roomCode: "DEMOAAHF" });
  const applauseFixture = buildQaAudienceFixture("applause-cooldown", { roomCode: "DEMOAAHF" });

  assert.equal(cohostFixture.room.runOfShowDirector.releaseWindow.active, true);
  assert.equal(cohostFixture.room.runOfShowDirector.releaseWindow.subjectType, "queue_faceoff");
  assert.equal(cohostFixture.room.runOfShowDirector.releaseWindow.governanceMode, "cohost_vote");
  assert.deepEqual(cohostFixture.room.runOfShowRoles.coHosts, ["qa_cohost-song-faceoff"]);

  assert.equal(crowdFixture.room.runOfShowDirector.releaseWindow.active, true);
  assert.equal(crowdFixture.room.runOfShowDirector.releaseWindow.governanceMode, "crowd_vote");
  assert.equal(crowdFixture.room.runOfShowDirector.releaseWindow.choiceLabels.slot_scene, "Valerie");

  assert.equal(unlimitedFixture.room.eventCredits.coHostCreditPolicy, "unlimited");
  assert.equal(unlimitedFixture.room.eventCredits.reactionTapCooldownMs, 1600);
  assert.deepEqual(unlimitedFixture.room.runOfShowRoles.coHosts, ["qa_cohost-unlimited-reactions"]);

  assert.equal(applauseFixture.room.activeMode, "applause");
  assert.equal(applauseFixture.room.eventCredits.reactionTapCooldownMs, 1400);
});

test("co-host host QA fixtures cover queue face-off and helper catalog states", () => {
  const queueFaceoffFixture = buildQaHostFixture("cohost-queue-faceoff", { roomCode: "DEMOAAHF" });
  const helperCatalogFixture = buildQaHostFixture("cohost-helper-catalog", { roomCode: "DEMOAAHF" });
  const policyFixture = buildQaHostFixture("cohost-credit-policy-settings", { roomCode: "DEMOAAHF" });

  assert.equal(queueFaceoffFixture.tab, "stage");
  assert.equal(queueFaceoffFixture.room.runOfShowDirector.releaseWindow.subjectType, "queue_faceoff");
  assert.equal(queueFaceoffFixture.room.runOfShowDirector.releaseWindow.governanceMode, "cohost_vote");
  assert.equal(queueFaceoffFixture.songs.filter((song) => song.status === "requested").length, 2);

  assert.equal(helperCatalogFixture.tab, "browse");
  assert.equal(helperCatalogFixture.activeWorkspaceView, "queue");
  assert.equal(helperCatalogFixture.activeWorkspaceSection, "queue.catalog");
  assert.equal(helperCatalogFixture.catalogueOnly, true);
  assert.equal(helperCatalogFixture.songs[0].singerName, "Taylor");

  assert.equal(policyFixture.tab, "admin");
  assert.equal(policyFixture.settingsTab, "monetization");
  assert.equal(policyFixture.room.eventCredits.coHostCreditPolicy, "unlimited");
  assert.equal(policyFixture.room.eventCredits.reactionTapCooldownMs, 1600);
});
