export const TEST_SESSION_SCHEMA_VERSION = 1 as const;

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
  consentAccepted: boolean;
  cameraPermissionOutcome: CameraPermissionOutcome;
  selectedInputMode: SessionInputMode;
  lessonId: string;
  completed: boolean;
  retryCount: number;
  failureCategories: FailureCategory[];
  events: TestSessionEvent[];
}

export type TestSessionSummary = Omit<TestSessionState, "startedAt"> & {
  startedAt: number;
  endedAt: number;
};

export function canStartCamera(consentAccepted: boolean): boolean {
  return consentAccepted;
}

export function createSessionId(randomUuid: () => string = () => globalThis.crypto?.randomUUID?.() ?? ""): string {
  const id = randomUuid();
  if (id) return id;
  return `session-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function createTestSessionState(options: {
  sessionId: string;
  startedAt: number;
  consentAccepted: boolean;
  inputMode: SessionInputMode;
  lessonId: string;
}): TestSessionState {
  const state: TestSessionState = {
    schemaVersion: TEST_SESSION_SCHEMA_VERSION,
    sessionId: options.sessionId,
    startedAt: options.startedAt,
    consentAccepted: options.consentAccepted,
    cameraPermissionOutcome: "unknown",
    selectedInputMode: options.inputMode,
    lessonId: options.lessonId,
    completed: false,
    retryCount: 0,
    failureCategories: [],
    events: [],
  };
  return options.consentAccepted
    ? appendTestSessionEvent(state, "consent_accepted", { timestamp: options.startedAt })
    : appendTestSessionEvent(state, "input_mode_selected", { inputMode: "keyboard", timestamp: options.startedAt });
}

export function appendTestSessionEvent(
  state: TestSessionState,
  eventType: SessionEventType,
  payload: { timestamp?: number; lessonId?: string; inputMode?: SessionInputMode; failureCategory?: FailureCategory } = {},
): TestSessionState {
  const timestampMs = Math.max(0, (payload.timestamp ?? Date.now()) - state.startedAt);
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
  if (eventType === "lesson_completed") next.completed = true;
  if (eventType === "lesson_failed" && payload.failureCategory && !next.failureCategories.includes(payload.failureCategory)) {
    next.failureCategories = [...next.failureCategories, payload.failureCategory];
  }
  if (eventType === "retry_started") next.retryCount += 1;
  return next;
}

export function finalizeTestSession(state: TestSessionState, endedAt: number): TestSessionSummary {
  const completed = state.events.some((event) => event.eventType === "session_completed")
    ? state
    : appendTestSessionEvent(state, "session_completed", { timestamp: endedAt });
  return { ...completed, endedAt };
}

export function serializeTestSessionSummary(summary: TestSessionSummary): string {
  return JSON.stringify(summary, null, 2);
}
