import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearCheckpoint,
  createGuidedTrainingRun,
  evaluateGuidedTrainingRun,
  resetGuidedTrainingRun,
} from "../src/lib/guidedTrainingContract.js";

test("successful left-turn run clears checkpoints in order", () => {
  let run = createGuidedTrainingRun();
  run = clearCheckpoint(run, "stop-1");
  run = clearCheckpoint(run, "mirror-1");

  assert.deepEqual(evaluateGuidedTrainingRun(run), {
    passed: true,
    score: 100,
    missedCheckpointIds: [],
    feedback: [],
  });
});

test("missed checkpoint produces the expected penalty and feedback", () => {
  let run = createGuidedTrainingRun();
  run = clearCheckpoint(run, "stop-1");
  const result = evaluateGuidedTrainingRun(run);

  assert.equal(result.passed, false);
  assert.equal(result.score, 80);
  assert.deepEqual(result.missedCheckpointIds, ["mirror-1"]);
  assert.deepEqual(result.feedback, ["Missed checkpoint: mirror-1"]);
});

test("retry reset clears temporary checkpoint and score state", () => {
  let run = createGuidedTrainingRun();
  run = clearCheckpoint(run, "stop-1");
  run = clearCheckpoint(run, "mirror-1");
  assert.equal(evaluateGuidedTrainingRun(run).score, 100);

  const retry = resetGuidedTrainingRun(run);
  assert.deepEqual(retry, {
    pedalInputMode: "camera",
    clearedCheckpointIds: [],
  });
  assert.equal(evaluateGuidedTrainingRun(retry).score, 60);
});

test("keyboard pedal fallback completes the same slice without camera state", () => {
  let run = createGuidedTrainingRun("keyboard");
  run = clearCheckpoint(run, "stop-1");
  run = clearCheckpoint(run, "mirror-1");

  assert.equal(run.pedalInputMode, "keyboard");
  assert.equal(evaluateGuidedTrainingRun(run).score, 100);
});

test("out-of-order checkpoint events do not bypass the required sequence", () => {
  let run = createGuidedTrainingRun();
  run = clearCheckpoint(run, "mirror-1");

  assert.deepEqual(run.clearedCheckpointIds, []);
  assert.deepEqual(evaluateGuidedTrainingRun(run).missedCheckpointIds, [
    "stop-1",
    "mirror-1",
  ]);
});
