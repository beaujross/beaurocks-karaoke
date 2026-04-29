import assert from "node:assert/strict";
import { test } from "vitest";

import {
  buildRoomMediaIdentity,
  mergeRoomMediaIdentities,
  reconcileRunOfShowDirectorMediaDeletion,
  roomMediaIdentityMatches,
} from "../../src/apps/Host/runOfShowMediaCleanup.js";

test("room media identity matches uploads, presets, and persisted show items", () => {
  const upload = {
    id: "upload_123",
    storagePath: "room_uploads/AAHF/flyer.png",
    mediaUrl: "https://cdn.example.com/flyer.png",
  };
  const preset = {
    id: "preset_456",
    sourceUploadId: "upload_123",
    storagePath: "room_uploads/AAHF/flyer.png",
    mediaUrl: "https://cdn.example.com/flyer.png",
  };
  const runOfShowItem = {
    presentationPlan: {
      mediaSceneUrl: "https://cdn.example.com/flyer.png",
      mediaSceneSourceUploadId: "preset_456",
      mediaSceneStoragePath: "room_uploads/AAHF/flyer.png",
    },
  };

  const mergedIdentity = mergeRoomMediaIdentities(
    buildRoomMediaIdentity(upload),
    buildRoomMediaIdentity(preset),
  );

  assert.equal(roomMediaIdentityMatches(mergedIdentity, runOfShowItem), true);
});

test("run-of-show media cleanup strips deleted scene assets but keeps the item itself", () => {
  const director = {
    currentItemId: "scene_1",
    items: [
      {
        id: "scene_1",
        type: "announcement",
        title: "Sponsor Flyer",
        presentationPlan: {
          publicTvTakeoverEnabled: true,
          takeoverScene: "media_scene",
          headline: "Sponsor Flyer",
          mediaSceneUrl: "https://cdn.example.com/flyer.png",
          mediaSceneType: "image",
          mediaSceneFit: "contain",
          mediaSceneSourceUploadId: "upload_123",
          mediaSceneStoragePath: "room_uploads/AAHF/flyer.png",
        },
      },
      {
        id: "scene_2",
        type: "announcement",
        title: "Still Fine",
        presentationPlan: {
          publicTvTakeoverEnabled: true,
          takeoverScene: "announcement",
          headline: "Still Fine",
        },
      },
    ],
  };

  const result = reconcileRunOfShowDirectorMediaDeletion(director, {
    id: "upload_123",
    storagePath: "room_uploads/AAHF/flyer.png",
    mediaUrl: "https://cdn.example.com/flyer.png",
  });

  assert.equal(result.changed, true);
  assert.deepEqual(result.affectedItemIds, ["scene_1"]);
  assert.equal(result.nextDirector.items[0].presentationPlan.takeoverScene, "announcement");
  assert.equal(result.nextDirector.items[0].presentationPlan.mediaSceneUrl, "");
  assert.equal(result.nextDirector.items[0].presentationPlan.mediaSceneSourceUploadId, "");
  assert.equal(result.nextDirector.items[0].presentationPlan.mediaSceneStoragePath, "");
  assert.equal(result.nextDirector.items[1].presentationPlan.headline, "Still Fine");
});
