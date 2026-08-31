import {
  appendTestSessionEvent, canStartCamera, createSessionId, createTestSessionState,
  finalizeTestSession, serializeTestSessionSummary,
  type SessionEventPayload, type SessionEventType, type SessionInputMode, type TestSessionState,
} from "./testSession";

export interface TestSessionSlice {
  cameraProcessingAllowed: boolean;
  testSession: TestSessionState | null;
  lastTestSessionSummary: TestSessionState | null;
  sessionStartFailed: boolean;
  prepareNewTestSession: () => void;
  startTestSession: (cameraProcessingAllowed: boolean) => void;
  endTestSession: () => void;
  recordTestSessionEvent: (eventType: SessionEventType, payload?: SessionEventPayload, sourceSessionId?: string) => void;
  exportTestSession: () => string | null;
}

interface RuntimeContext {
  currentLesson: string;
  pedalInputMode: SessionInputMode;
  missionState: string;
  screen: string;
  activateKeyboardPedalFallback: () => void;
}

// Used by the real driving store and the isolated regression store. No Firebase/vision dependencies.
export function createTestSessionSlice(
  set: (updates: Partial<TestSessionSlice>) => void,
  get: () => TestSessionSlice & RuntimeContext,
  clock: () => number = Date.now,
  idFactory: () => string = createSessionId,
): TestSessionSlice {
  return {
    cameraProcessingAllowed: false,
    testSession: null,
    lastTestSessionSummary: null,
    sessionStartFailed: false,
    prepareNewTestSession: () => {
      get().endTestSession();
      // Only retain the previous summary until another run is selected.
      set({ lastTestSessionSummary: null, sessionStartFailed: false });
    },
    startTestSession: (cameraProcessingAllowed) => {
      if (get().testSession) return;
      try {
        const context = get();
        const session = createTestSessionState({
          startedAt: clock(), sessionConsentAccepted: true, cameraProcessingAllowed,
          inputMode: context.pedalInputMode,
          lessonId: context.screen === "tutorial" ? "tutorial" : context.currentLesson,
        }, idFactory)!;
        set({ testSession: session, cameraProcessingAllowed: canStartCamera(session), sessionStartFailed: false });
        if (!cameraProcessingAllowed) get().activateKeyboardPedalFallback();
        // Free-mode starts before the consent gate, unlike guided lesson briefing.
        if (context.screen === "driving" && context.missionState === "active") {
          get().recordTestSessionEvent("lesson_started");
        }
      } catch {
        set({ testSession: null, cameraProcessingAllowed: false, sessionStartFailed: true });
      }
    },
    endTestSession: () => {
      const session = get().testSession;
      let summary = session;
      if (summary && !summary.completed && summary.events.at(-1)?.eventType !== "lesson_failed") {
        summary = appendTestSessionEvent(summary, "lesson_failed", { timestamp: clock(), failureCategory: "incomplete" });
      }
      set({
        testSession: null, cameraProcessingAllowed: false, sessionStartFailed: false,
        ...(summary ? { lastTestSessionSummary: finalizeTestSession(summary, clock()) } : {}),
      });
    },
    recordTestSessionEvent: (eventType, payload, sourceSessionId) => {
      const session = get().testSession;
      // A late camera promise from a previous run must never contaminate the next one.
      if (!session || (sourceSessionId !== undefined && sourceSessionId !== session.sessionId)) return;
      const next = appendTestSessionEvent(session, eventType, {
        timestamp: clock(), lessonId: session.lessonId, ...payload,
      });
      set({ testSession: next, cameraProcessingAllowed: canStartCamera(next) });
    },
    exportTestSession: () => {
      const summary = get().testSession ?? get().lastTestSessionSummary;
      return summary ? serializeTestSessionSummary(summary) : null;
    },
  };
}

// Feedback -> driving (Retry) stays active. Leaving the practice screens ends the run.
export function leavesTestSession(previousScreen: string, nextScreen: string): boolean {
  const practiceScreens = ["tutorial", "driving", "feedback"];
  return practiceScreens.includes(previousScreen) && !practiceScreens.includes(nextScreen);
}
