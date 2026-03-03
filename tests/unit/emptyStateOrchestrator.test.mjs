import assert from "node:assert/strict";
import {
  EMPTY_STATE_CONTEXT,
  getEmptyStateConfig,
} from "../../src/apps/Marketing/emptyStateOrchestrator.js";

const getActionLabels = (config = {}) =>
  (Array.isArray(config.actions) ? config.actions : []).map((action) => String(action?.label || ""));

const run = () => {
  const discoverNoResultsSignedOut = getEmptyStateConfig({
    context: EMPTY_STATE_CONTEXT.DISCOVER_NO_RESULTS,
    hasFilters: false,
    session: { isAuthed: false, isAnonymous: true },
  });
  assert.equal(getActionLabels(discoverNoResultsSignedOut).includes("Sign in to submit"), true);

  const discoverNoResultsSignedIn = getEmptyStateConfig({
    context: EMPTY_STATE_CONTEXT.DISCOVER_NO_RESULTS,
    hasFilters: false,
    session: { isAuthed: true, isAnonymous: false },
  });
  assert.equal(getActionLabels(discoverNoResultsSignedIn).includes("Submit listing"), true);

  const discoverPermissionSignedOut = getEmptyStateConfig({
    context: EMPTY_STATE_CONTEXT.DISCOVER_PERMISSION,
    session: { isAuthed: false, isAnonymous: true },
  });
  assert.equal(getActionLabels(discoverPermissionSignedOut).includes("Sign in to continue"), true);

  const hostMissingSignedOut = getEmptyStateConfig({
    context: EMPTY_STATE_CONTEXT.HOST_MISSING,
    session: { isAuthed: false, isAnonymous: true },
  });
  assert.equal(getActionLabels(hostMissingSignedOut).includes("Sign in"), true);

  const fallback = getEmptyStateConfig({});
  assert.equal(getActionLabels(fallback).length > 0, true);

  console.log("PASS emptyStateOrchestrator");
};

run();
