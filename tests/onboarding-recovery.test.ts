import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyCameraFailure,
  getKeyboardFallbackState,
  getRecoveryCopy,
  getRecoveryRetryAction,
  shouldRequireLandscape,
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

test("recovery copy follows the selected language and failure kind", () => {
  assert.match(getRecoveryCopy("camera-denied", "ja").message, /ブラウザ/);
  assert.match(getRecoveryCopy("camera-denied", "en").settingsHint ?? "", /site settings/);
  assert.equal(getRecoveryCopy("vision-error", "ja").retryLabel, "認識を再試行");
});

test("portrait mobile and tablet viewports require landscape", () => {
  assert.equal(shouldRequireLandscape(390, 844), true);
  assert.equal(shouldRequireLandscape(1024, 1366), true);
  assert.equal(shouldRequireLandscape(844, 390), false);
  assert.equal(shouldRequireLandscape(1366, 1024), false);
  assert.equal(shouldRequireLandscape(1440, 900), false);
});
