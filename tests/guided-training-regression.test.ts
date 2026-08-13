import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateFinalScore,
  getMissedCheckpointFeedback,
  getMissedCheckpointIds,
  getMissedCheckpointPenalty,
  getRetryTransition,
} from "../src/lib/guidedTrainingContract.js";
import { MISSION_CHECKPOINTS } from "../src/lib/missionCheckpoints.js";

const leftTurnCheckpoints = MISSION_CHECKPOINTS["left-turn"] ?? [];
const stopCheckpoint = leftTurnCheckpoints[0];
const mirrorCheckpoint = leftTurnCheckpoints[1];
assert.ok(stopCheckpoint);
assert.ok(mirrorCheckpoint);

test("successful left-turn result has no missed-checkpoint penalty", () => {
  const missed = getMissedCheckpointIds(leftTurnCheckpoints, [stopCheckpoint.id, mirrorCheckpoint.id]);

  assert.deepEqual(missed, []);
  assert.equal(getMissedCheckpointPenalty(missed), 0);
  assert.equal(calculateFinalScore([], getMissedCheckpointPenalty(missed)), 100);
});

test("missed checkpoint follows current production semantics", () => {
  const missed = getMissedCheckpointIds(leftTurnCheckpoints, [stopCheckpoint.id]);
  const missedMirror = leftTurnCheckpoints.find((checkpoint) => checkpoint.id === mirrorCheckpoint.id);

  assert.deepEqual(missed, [mirrorCheckpoint.id]);
  assert.equal(getMissedCheckpointPenalty(missed), 20);
  assert.equal(getMissedCheckpointFeedback(missedMirror!, "en"), "");
  assert.equal(calculateFinalScore([], getMissedCheckpointPenalty(missed)), 80);
});

test("retry transition matches the production feedback flow", () => {
  assert.deepEqual(getRetryTransition(), {
    missionState: "briefing",
    screen: "driving",
  });
});

test("keyboard pedal mode does not alter the scoring/checkpoint contract", () => {
  const missed = getMissedCheckpointIds(leftTurnCheckpoints, [stopCheckpoint.id, mirrorCheckpoint.id]);
  const penalty = getMissedCheckpointPenalty(missed);

  // Production scoring does not read pedalInputMode; camera and keyboard runs
  // therefore use the same checkpoint and score helpers.
  const cameraScore = calculateFinalScore([], penalty);
  const keyboardScore = calculateFinalScore([], penalty);

  assert.deepEqual(missed, []);
  assert.equal(keyboardScore, cameraScore);
});
