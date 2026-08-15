import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyCameraFailure, getKeyboardFallbackState } from "../src/lib/onboardingRecovery.js";

test("camera permission failure is classified as denied", () => {
  assert.equal(classifyCameraFailure(new DOMException("blocked", "NotAllowedError")), "denied");
});

test("camera initialization failure is classified as a retryable error", () => {
  assert.equal(classifyCameraFailure(new Error("device unavailable")), "error");
});

test("keyboard fallback clears calibration requirements while preserving the mode", () => {
  assert.deepEqual(getKeyboardFallbackState(), {
    pedalInputMode: "keyboard",
    calibrationStage: "idle",
    footCalibration: null,
  });
});
