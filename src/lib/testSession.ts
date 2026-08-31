export const TEST_SESSION_SCHEMA_VERSION = 2 as const;

export type SessionInputMode = "camera" | "keyboard";
export type CameraPermissionOutcome = "unknown" | "granted" | "denied" | "failed";
export type FailureCategory = "camera-denied" | "camera-initialization" | "vision-initialization" | "incomplete";
export type SessionEventType =
  | "consent_accepted"
  | "camera_permission_granted"
  | "camera_permission_denied"
  | "camera_initialization_failed"
  | "vision_initialization_failed"
  | "input_mode_selected"
  | "lesson_started"
  | "lesson_completed"
  | "lesson_failed"
  | "retry_started"
  | "session_completed";

export interface TestSessionEvent {
  schemaVersion: typeof TEST_SESSION_SCHEMA_VERSION;
  sessionId: string;
  eventType: SessionEventType;
  timestampMs: number;
  lessonId?: string;
  inputMode?: SessionInputMode;
  failureCategory?: FailureCategory;
}

export interface TestSessionState {
  schemaVersion: typeof TEST_SESSION_SCHEMA_VERSION;
  sessionId: string;
  startedAt: number;
  sessionConsentAccepted: true;
  cameraProcessingAllowed: boolean;
  status: "active" | "completed";
  endedAt: number | null;
  cameraPermissionOutcome: CameraPermissionOutcome;
  selectedInputMode: SessionInputMode;
  lessonId: string;
  completed: boolean;
  retryCount: number;
  failureCategories: FailureCategory[];
  events: TestSessionEvent[];
}

export type TestSessionSummary = TestSessionState;

export function canStartCamera(session: TestSessionState | null): boolean {
  return !!session && session.status === "active" && session.sessionConsentAccepted && session.cameraProcessingAllowed;
}

type SecureRandom = {
  randomUUID?: () => string;
  getRandomValues?: (bytes: Uint8Array) => Uint8Array;
};

export function createSessionId(cryptoSource: SecureRandom | undefined = globalThis.crypto): string {
  if (cryptoSource?.randomUUID) return cryptoSource.randomUUID();
  if (!cryptoSource?.getRandomValues) throw new Error("Secure session ID unavailable");
  const bytes = cryptoSource.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createTestSessionState(options: {
  startedAt: number;
  sessionConsentAccepted: boolean;
  cameraProcessingAllowed: boolean;
  inputMode: SessionInputMode;
  lessonId: string;
}, idFactory: () => string = createSessionId): TestSessionState | null {
  // Declining never allocates an ID or collects even a consent-declined event.
  if (!options.sessionConsentAccepted) return null;
  const state: TestSessionState = {
    schemaVersion: TEST_SESSION_SCHEMA_VERSION,
    sessionId: idFactory(),
    startedAt: options.startedAt,
    sessionConsentAccepted: true,
    cameraProcessingAllowed: options.cameraProcessingAllowed,
    status: "active",
    endedAt: null,
    cameraPermissionOutcome: "unknown",
    selectedInputMode: options.cameraProcessingAllowed ? options.inputMode : "keyboard",
    lessonId: options.lessonId,
    completed: false,
    retryCount: 0,
    failureCategories: [],
    events: [],
  };
  return appendTestSessionEvent(
    appendTestSessionEvent(state, "consent_accepted", { timestamp: options.startedAt }),
    "input_mode_selected",
    { inputMode: state.selectedInputMode, timestamp: options.startedAt },
  );
}

export type SessionEventPayload = {
  timestamp?: number;
  lessonId?: string;
  inputMode?: SessionInputMode;
  failureCategory?: FailureCategory;
};

export function appendTestSessionEvent(
  state: TestSessionState,
  eventType: SessionEventType,
  payload: SessionEventPayload = {},
): TestSessionState {
  if (state.status === "completed") return state;
  const outcome = eventType === "camera_permission_granted" ? "granted"
    : eventType === "camera_permission_denied" ? "denied"
    : eventType === "camera_initialization_failed" ? "failed" : null;
  // Resume/remount with the same permission outcome is not another permission decision.
  if (outcome && outcome === state.cameraPermissionOutcome) return state;
  const timestampMs = Math.max(0, state.events.at(-1)?.timestampMs ?? 0, (payload.timestamp ?? Date.now()) - state.startedAt);
  const event: TestSessionEvent = {
    schemaVersion: TEST_SESSION_SCHEMA_VERSION,
    sessionId: state.sessionId,
    eventType,
    timestampMs,
    ...(payload.lessonId ? { lessonId: payload.lessonId } : {}),
    ...(payload.inputMode ? { inputMode: payload.inputMode } : {}),
    ...(payload.failureCategory ? { failureCategory: payload.failureCategory } : {}),
  };
  const next = { ...state, events: [...state.events, event] };
  if (eventType === "camera_permission_granted") next.cameraPermissionOutcome = "granted";
  if (eventType === "camera_permission_denied") next.cameraPermissionOutcome = "denied";
  if (eventType === "camera_initialization_failed") next.cameraPermissionOutcome = "failed";
  if (eventType === "input_mode_selected" && payload.inputMode) next.selectedInputMode = payload.inputMode;
  if (payload.lessonId) next.lessonId = payload.lessonId;
  if (eventType === "lesson_completed") next.completed = true;
  if (eventType === "lesson_started" || eventType === "retry_started" || eventType === "lesson_failed") next.completed = false;
  if (payload.failureCategory && !next.failureCategories.includes(payload.failureCategory)) {
    next.failureCategories = [...next.failureCategories, payload.failureCategory];
  }
  if (eventType === "retry_started") next.retryCount += 1;
  if (eventType === "session_completed") {
    next.status = "completed";
    next.endedAt = state.startedAt + timestampMs;
  }
  return next;
}

export function finalizeTestSession(state: TestSessionState, endedAt: number): TestSessionSummary {
  return appendTestSessionEvent(state, "session_completed", { timestamp: endedAt });
}

export function serializeTestSessionSummary(summary: TestSessionSummary): string {
  return JSON.stringify(summary, null, 2);
}
