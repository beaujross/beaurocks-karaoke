import assert from "node:assert/strict";
import { test } from "vitest";
import {
  BRACKET_SIGNUP_DEFAULT_DURATION_MIN,
  BRACKET_SIGNUP_DEFAULT_READY_COUNT,
  BRACKET_SIGNUP_MIN_READY_COUNT,
  buildBracketSignupRoster,
  buildBracketSignupState,
  getBracketSignupState,
  getRoomUserTight15Count,
  isBracketSignupOpen,
  summarizeBracketSignup
} from "../../src/lib/karaokeBracketSupport.js";

test("karaokeBracketSupport.test", () => {
  assert.equal(BRACKET_SIGNUP_DEFAULT_DURATION_MIN, 15);
  assert.equal(BRACKET_SIGNUP_DEFAULT_READY_COUNT, 5);
  assert.equal(BRACKET_SIGNUP_MIN_READY_COUNT, 2);

  assert.equal(getRoomUserTight15Count({ tight15: [{ id: 1 }, { id: 2 }] }), 2);
  assert.equal(getRoomUserTight15Count({ tight15Temp: [{ id: 1 }] }), 1);
  assert.equal(getRoomUserTight15Count({}), 0);

  const signup = buildBracketSignupState(
    {
      openedAt: 1000,
      durationMin: 12,
      readySongMin: 3
    },
    500
  );
  assert.deepEqual(signup, {
    status: "open",
    openedAt: 1000,
    countdownStartedAt: 1000,
    deadlineMs: 721000,
    durationMin: 12,
    readySongMin: 3
  });

  const bracket = {
    status: "signup",
    createdAt: 1000,
    signup: {
      openedAt: 2000,
      durationMin: 15,
      readySongMin: 5
    }
  };
  assert.equal(isBracketSignupOpen(bracket), true);
  assert.equal(getBracketSignupState(bracket)?.deadlineMs, 902000);
  assert.equal(isBracketSignupOpen({ status: "setup", signup: bracket.signup }), false);

  const room = { hostUid: "host-1", hostName: "Hosty" };
  const roomUsers = [
    { uid: "host-1", name: "Hosty", tight15Temp: [{ id: 1 }] },
    { uid: "u-2", name: "Bravo", tight15Temp: [{ id: 1 }, { id: 2 }, { id: 3 }] },
    { uid: "u-3", name: "Alpha", tight15Temp: [{ id: 1 }] },
    { uid: "u-4", name: "Charlie", tight15Temp: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] }
  ];
  const roster = buildBracketSignupRoster({ roomUsers, room, signup });
  assert.deepEqual(
    roster.map((entry) => [entry.uid, entry.tight15Count, entry.ready]),
    [
      ["u-4", 4, true],
      ["u-2", 3, true],
      ["u-3", 1, false]
    ]
  );

  const summary = summarizeBracketSignup({
    roomUsers,
    room,
    bracket: {
      status: "signup",
      signup
    },
    nowMs: 4000
  });
  assert.equal(summary.readyCount, 2);
  assert.equal(summary.totalCount, 3);
  assert.equal(summary.launchUnlocked, true);
  assert.equal(summary.remainingMs, 717000);
});
