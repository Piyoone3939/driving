import assert from "node:assert/strict";
import test from "node:test";
import { createStore } from "zustand/vanilla";
import {
  appendTestSessionEvent, canStartCamera, createSessionId, createTestSessionState,
  finalizeTestSession, serializeTestSessionSummary,
  type SessionEventType, type FailureCategory, type SessionInputMode, type TestSessionState,
} from "../src/lib/testSession.js";
import { createTestSessionSlice, leavesTestSession, type TestSessionSlice } from "../src/lib/testSessionSlice.js";

const options = {
  startedAt: 1_000, sessionConsentAccepted: true, cameraProcessingAllowed: true,
  inputMode: "camera" as const, lessonId: "left-turn",
};
const base = () => createTestSessionState(options, () => "session-1")!;

// Actual production slice; only runtime context, clock and randomness are injected.
function harness(idFactory?: () => string) {
  let id = 0;
  let time = 1_000;
  type Context = {
    currentLesson: string; pedalInputMode: SessionInputMode; missionState: string; screen: string;
    activateKeyboardPedalFallback: () => void;
  };
  return createStore<TestSessionSlice & Context>((set, get) => ({
    currentLesson: "left-turn", pedalInputMode: "camera", missionState: "briefing", screen: "driving",
    activateKeyboardPedalFallback: () => set({ pedalInputMode: "keyboard" }),
    ...createTestSessionSlice(set, get, () => time += 100, idFactory ?? (() => `session-${++id}`)),
  }));
}
const events = (state: TestSessionState) => state.events.map(event => event.eventType);

test("session consent is required: decline creates neither ID nor instrumented session", () => {
  let allocations = 0;
  const declined = createTestSessionState({ ...options, sessionConsentAccepted: false }, () => { allocations++; return "unused"; });
  assert.equal(declined, null);
  assert.equal(allocations, 0);
  assert.equal(canStartCamera(declined), false);
  const store = harness();
  store.getState().endTestSession(); // Consent's decline -> Home exit.
  store.getState().recordTestSessionEvent("camera_permission_granted");
  assert.equal(store.getState().testSession, null);
  assert.equal(store.getState().exportTestSession(), null);
  assert.equal(store.getState().cameraProcessingAllowed, false);
});

test("camera path accepts session recording and separately permits camera", () => {
  const store = harness();
  store.getState().startTestSession(true);
  const state = store.getState().testSession!;
  assert.equal(state.sessionConsentAccepted, true);
  assert.equal(state.cameraProcessingAllowed, true);
  assert.equal(canStartCamera(state), true);
  assert.equal(state.cameraPermissionOutcome, "unknown");
  assert.deepEqual(events(state), ["consent_accepted", "input_mode_selected"]);
});

test("no-camera path accepts recording and selects keyboard without camera processing", () => {
  const store = harness();
  store.getState().startTestSession(false);
  const state = store.getState().testSession!;
  assert.equal(state.sessionConsentAccepted, true);
  assert.equal(state.cameraProcessingAllowed, false);
  assert.equal(canStartCamera(state), false);
  assert.equal(store.getState().pedalInputMode, "keyboard");
  assert.equal(state.selectedInputMode, "keyboard");
  assert.deepEqual(events(state), ["consent_accepted", "input_mode_selected"]);
});

test("Home -> another lesson resets ID/events/camera permission before fresh consent", () => {
  const store = harness();
  store.getState().startTestSession(true);
  store.getState().recordTestSessionEvent("camera_permission_denied", { failureCategory: "camera-denied" });
  const first = store.getState().testSession!;
  store.getState().endTestSession();
  assert.equal(store.getState().testSession, null);
  assert.equal(store.getState().cameraProcessingAllowed, false);
  assert.equal(store.getState().lastTestSessionSummary?.status, "completed");
  store.getState().prepareNewTestSession();
  assert.equal(store.getState().testSession, null);
  assert.equal(store.getState().lastTestSessionSummary, null);
  store.setState({ currentLesson: "right-turn" });
  store.getState().startTestSession(false);
  const second = store.getState().testSession!;
  assert.notEqual(first.sessionId, second.sessionId);
  assert.notEqual(first.events, second.events);
  assert.equal(second.lessonId, "right-turn");
  assert.equal(second.retryCount, 0);
  assert.equal(second.cameraPermissionOutcome, "unknown");
  assert.deepEqual(second.failureCategories, []);
  assert.ok(second.events.every(event => event.sessionId === second.sessionId));
  assert.deepEqual(events(second), ["consent_accepted", "input_mode_selected"]);
});

test("Export is a snapshot; Retry keeps the active session and its history", () => {
  const store = harness();
  store.getState().startTestSession(true);
  store.getState().recordTestSessionEvent("lesson_started");
  store.getState().recordTestSessionEvent("lesson_completed");
  const before = store.getState().testSession!;
  const exported = JSON.parse(store.getState().exportTestSession()!);
  assert.equal(exported.status, "active");
  assert.equal(exported.endedAt, null);
  assert.equal(store.getState().testSession, before);
  assert.ok(!events(before).includes("session_completed"));
  store.getState().recordTestSessionEvent("retry_started");
  store.getState().recordTestSessionEvent("lesson_started");
  const retried = store.getState().testSession!;
  assert.equal(retried.sessionId, before.sessionId);
  assert.equal(retried.retryCount, 1);
  assert.equal(retried.completed, false);
  assert.deepEqual(events(retried).slice(-2), ["retry_started", "lesson_started"]);
});

test("finish is terminal, idempotent, and keeps a final summary exportable", () => {
  const store = harness();
  store.getState().startTestSession(true);
  store.getState().recordTestSessionEvent("lesson_completed");
  store.getState().endTestSession();
  const summary = store.getState().lastTestSessionSummary!;
  assert.equal(summary.status, "completed");
  assert.equal(canStartCamera(summary), false);
  assert.ok(summary.endedAt! >= summary.startedAt);
  assert.equal(events(summary).at(-1), "session_completed");
  for (const eventType of ["retry_started", "lesson_started", "camera_permission_granted"] as const) {
    assert.equal(appendTestSessionEvent(summary, eventType), summary);
    store.getState().recordTestSessionEvent(eventType);
  }
  assert.equal(finalizeTestSession(summary, 99_999), summary);
  store.getState().endTestSession();
  assert.deepEqual(JSON.parse(store.getState().exportTestSession()!), summary);
});

test("leaving before a result records bounded incomplete then terminal completion", () => {
  const store = harness();
  store.getState().startTestSession(false);
  store.getState().recordTestSessionEvent("lesson_started");
  store.getState().endTestSession();
  const summary = store.getState().lastTestSessionSummary!;
  assert.equal(summary.completed, false);
  assert.deepEqual(summary.failureCategories, ["incomplete"]);
  assert.deepEqual(events(summary).slice(-2), ["lesson_failed", "session_completed"]);
});

for (const [eventType, failureCategory] of [
  ["camera_permission_denied", "camera-denied"],
  ["camera_initialization_failed", "camera-initialization"],
  ["vision_initialization_failed", "vision-initialization"],
] as [SessionEventType, FailureCategory][]) {
  test(`${eventType} aggregates ${failureCategory} exactly once`, () => {
    const store = harness();
    store.getState().startTestSession(true);
    store.getState().recordTestSessionEvent(eventType, { failureCategory });
    store.getState().recordTestSessionEvent(eventType, { failureCategory });
    assert.deepEqual(store.getState().testSession?.failureCategories, [failureCategory]);
  });
}

test("pause/resume granted is deduped, but denied -> granted remains recordable", () => {
  const store = harness();
  store.getState().startTestSession(true);
  store.getState().recordTestSessionEvent("camera_permission_denied", { failureCategory: "camera-denied" });
  store.getState().recordTestSessionEvent("camera_permission_granted");
  const beforeResume = store.getState().testSession!;
  store.getState().recordTestSessionEvent("camera_permission_granted");
  assert.equal(store.getState().testSession, beforeResume);
  assert.deepEqual(events(beforeResume).slice(-2), ["camera_permission_denied", "camera_permission_granted"]);
  assert.equal(beforeResume.cameraPermissionOutcome, "granted");
  assert.deepEqual(beforeResume.failureCategories, ["camera-denied"]);
});

test("late permission result from an old run cannot enter the next run", () => {
  const store = harness();
  store.getState().startTestSession(true);
  const firstId = store.getState().testSession!.sessionId;
  store.getState().prepareNewTestSession();
  store.getState().startTestSession(true);
  const second = store.getState().testSession;
  store.getState().recordTestSessionEvent("camera_permission_granted", {}, firstId);
  assert.equal(store.getState().testSession, second);
});

test("production navigation boundary preserves Retry and finalizes Home/auth exits", () => {
  assert.equal(leavesTestSession("feedback", "driving"), false);
  assert.equal(leavesTestSession("driving", "feedback"), false);
  for (const screen of ["feedback", "driving", "tutorial"]) {
    assert.equal(leavesTestSession(screen, "home"), true);
    assert.equal(leavesTestSession(screen, "auth"), true);
  }
});

test("secure UUID/byte sources are injectable; unavailable randomness fails safely", () => {
  assert.equal(createSessionId({ randomUUID: () => "secure-uuid" }), "secure-uuid");
  assert.equal(createSessionId({ getRandomValues: bytes => bytes.fill(0xab) }), "ab".repeat(16));
  assert.throws(() => createSessionId({}), /Secure session ID unavailable/);
  const store = harness(() => createSessionId({}));
  store.getState().startTestSession(true);
  assert.equal(store.getState().sessionStartFailed, true);
  assert.equal(store.getState().testSession, null);
  assert.equal(store.getState().cameraProcessingAllowed, false);
  assert.equal(store.getState().exportTestSession(), null);
});

test("free-mode already active at consent records its lesson start", () => {
  const store = harness();
  store.setState({ currentLesson: "free-mode", missionState: "active" });
  store.getState().startTestSession(false);
  assert.equal(store.getState().testSession?.events.at(-1)?.eventType, "lesson_started");
});

test("summary excludes raw/identity fields even if an event caller supplies extras", () => {
  const extra = { timestamp: 1_100, email: "not-exported", frame: [1, 2], landmarks: [3, 4] };
  const summary = finalizeTestSession(appendTestSessionEvent(base(), "lesson_completed", extra), 1_200);
  const json = JSON.parse(serializeTestSessionSummary(summary));
  assert.equal(json.schemaVersion, 2);
  assert.equal(json.sessionConsentAccepted, true);
  assert.equal(json.events.at(-1).timestampMs, 200);
  const forbidden = new Set(["video", "frame", "image", "landmarks", "face", "handLandmarks", "poseLandmarks", "email", "name", "userId", "firebaseUid", "ipAddress"]);
  function inspect(value: unknown) {
    if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) {
      assert.ok(!forbidden.has(key), `Forbidden field ${key}`);
      inspect(child);
    }
  }
  inspect(json);
});
