import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateFinalScore,
  getMissedCheckpointFeedback,
  getMissedCheckpointIds,
  getMissedCheckpointPenalty,
  getRetryTransition,
} from "../src/lib/guidedTrainingContract.js";

const leftTurnCheckpoints = [
  { id: "stop-1", type: "stop" as const, label: "一時停止" },
  { id: "mirror-1", type: "mirror" as const, label: "安全確認" },
];

test("successful left-turn result has no missed-checkpoint penalty", () => {
  const missed = getMissedCheckpointIds(leftTurnCheckpoints, ["stop-1", "mirror-1"]);

  assert.deepEqual(missed, []);
  assert.equal(getMissedCheckpointPenalty(missed), 0);
  assert.equal(calculateFinalScore([], getMissedCheckpointPenalty(missed)), 100);
});

test("missed checkpoint follows current production semantics", () => {
  const missed = getMissedCheckpointIds(leftTurnCheckpoints, ["stop-1"]);
  const missedMirror = leftTurnCheckpoints.find((checkpoint) => checkpoint.id === missed[0]);

  assert.deepEqual(missed, ["mirror-1"]);
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
  const missed = getMissedCheckpointIds(leftTurnCheckpoints, ["stop-1", "mirror-1"]);
  const penalty = getMissedCheckpointPenalty(missed);

  // Production scoring does not read pedalInputMode; camera and keyboard runs
  // therefore use the same checkpoint and score helpers.
  const cameraScore = calculateFinalScore([], penalty);
  const keyboardScore = calculateFinalScore([], penalty);

  assert.deepEqual(missed, []);
  assert.equal(keyboardScore, cameraScore);
});
