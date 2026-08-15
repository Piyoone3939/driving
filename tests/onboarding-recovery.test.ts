import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyCameraFailure,
  getKeyboardFallbackState,
  getRecoveryRetryAction,
} from "../src/lib/onboardingRecovery.js";

test("camera permission failure is classified as denied", () => {
  assert.equal(classifyCameraFailure(new DOMException("blocked", "NotAllowedError")), "denied");
});

test("camera initialization failure is classified as a retryable error", () => {
  assert.equal(classifyCameraFailure(new Error("device unavailable")), "error");
});

test("vision setup failure retries vision setup rather than camera-only startup", () => {
  assert.equal(getRecoveryRetryAction("vision-error"), "vision-retry");
  assert.equal(getRecoveryRetryAction("camera-error"), "camera-retry");
});

test("keyboard fallback clears calibration requirements while preserving the mode", () => {
  assert.deepEqual(getKeyboardFallbackState(), {
    pedalInputMode: "keyboard",
    calibrationStage: "idle",
    footCalibration: null,
  });
});
