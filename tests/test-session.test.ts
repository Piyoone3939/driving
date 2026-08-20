import assert from "node:assert/strict";
import test from "node:test";
import {
  appendTestSessionEvent,
  canStartCamera,
  createTestSessionState,
  finalizeTestSession,
} from "../src/lib/testSession.js";

const base = () => createTestSessionState({
  sessionId: "session-test-1",
  startedAt: 1_000,
  consentAccepted: true,
  inputMode: "camera",
  lessonId: "left-turn",
});

test("camera processing requires explicit consent", () => {
  assert.equal(canStartCamera(false), false);
  assert.equal(canStartCamera(true), true);
});

test("accepted consent and camera permission are derived events", () => {
  const state = appendTestSessionEvent(base(), "camera_permission_granted", { timestamp: 1_100 });
  assert.equal(state.events[0].eventType, "consent_accepted");
  assert.equal(state.cameraPermissionOutcome, "granted");
  assert.deepEqual(state.events[1], {
    schemaVersion: 1,
    sessionId: "session-test-1",
    eventType: "camera_permission_granted",
    timestampMs: 100,
  });
});

test("denied camera and keyboard fallback remain bounded", () => {
  const denied = appendTestSessionEvent(base(), "camera_permission_denied", {
    timestamp: 1_200,
    failureCategory: "camera-denied",
  });
  const keyboard = appendTestSessionEvent(denied, "input_mode_selected", { timestamp: 1_300, inputMode: "keyboard" });
  assert.equal(keyboard.cameraPermissionOutcome, "denied");
  assert.equal(keyboard.selectedInputMode, "keyboard");
  assert.equal(keyboard.events.at(-1)?.inputMode, "keyboard");
});

test("lesson completion and retry are represented in the summary", () => {
  let state = appendTestSessionEvent(base(), "lesson_started", { timestamp: 1_400 });
  state = appendTestSessionEvent(state, "retry_started", { timestamp: 1_500 });
  state = appendTestSessionEvent(state, "lesson_completed", { timestamp: 1_600 });
  const summary = finalizeTestSession(state, 1_700);
  assert.equal(summary.completed, true);
  assert.equal(summary.retryCount, 1);
  assert.equal(summary.events.at(-1)?.eventType, "session_completed");
  const serialized = JSON.stringify(summary);
  for (const forbidden of ["video", "frame", "image", "landmarks", "face", "handLandmarks", "poseLandmarks", "email", "name", "userId", "firebaseUid", "ipAddress"]) {
    assert.equal(serialized.includes(forbidden), false, `forbidden field: ${forbidden}`);
  }
});
