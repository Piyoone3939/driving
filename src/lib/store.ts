import { create } from "zustand";
import { FootCalibration, PedalState } from "./footPedalRecognition";
import * as THREE from "three";
import { User } from "firebase/auth";
import { MISSION_CHECKPOINTS } from "@/components/simulation/MissionController";
import {
  getMissedCheckpointFeedback,
  getMissedCheckpointIds,
  getMissedCheckpointPenalty,
} from "./guidedTrainingContract";
import { getKeyboardFallbackState } from "./onboardingRecovery";
import {
  appendTestSessionEvent,
  createSessionId,
  createTestSessionState,
  finalizeTestSession,
  serializeTestSessionSummary,
  SessionEventType,
  TestSessionState,
} from "./testSession";

export interface ReplayFrame {
  timestamp: number;
  position: [number, number, number];
  rotation: [number, number, number];
  steering: number;
  speed: number;
  headRotation: { pitch: number; yaw: number; roll: number };
}

export interface MissionHistoryItem {
  id: string;
  timestamp: number;
  lesson: string;
  score: number;
  clearTime: string;
  feedbackSummary: string;
}

export interface FeedbackEvent {
  time: number;
  type: "KAIZEN" | "GOOD";
  message: string;
  meta?: Record<string, unknown>;
}

/** Signal / Traffic Light state logs */
export type SignalState = "green" | "yellow" | "red";

export interface SignalStateLog {
  time: number;
  checkpointId: string;
  state: SignalState;
}

// ✅ Added: checkpoint type definition (restored because other files reference it)
export type MissionCheckpoint = {
  id: string;
  position: [number, number, number];
  radius: number;
  type: 'stop' | 'speed-limit' | 'mirror' | 'safety-check';
  label?: string;
  targetYaw?: number; 
  visual?: string; // used for traffic-light detection
  minDuration?: number; // used to judge stop duration
};

export type LessonId =
  | "free-mode"
  | "straight"
  | "s-curve"
  | "crank"
  | "left-turn"
  | "right-turn"
  | "traffic-light"
  | "crosswalk"
  | "railroad-crossing";

export type ScreenId = "home" | "driving" | "feedback" | "auth" | "history" | "tutorial" | "language";
export type MissionState = "idle" | "briefing" | "active" | "success" | "failed";

export interface DrivingState {
  // Screen Management
  screen: ScreenId;
  isPaused: boolean;
  // UI language. Persisted to localStorage; default Japanese.
  language: "ja" | "en";

  // Vehicle Control, Head Tracking, Foot Pedal, Telemetry, Replay System, System
  steeringAngle: number;
  throttle: number;
  brake: number;
  headRotation: { pitch: number; yaw: number; roll: number };
  footCalibration: FootCalibration | null;
  pedalState: PedalState;
  calibrationStage: "idle" | "waiting_for_brake" | "calibrated";
  speed: number;
  gear: "P" | "D" | "R";

  currentLesson: LessonId;

  missionState: MissionState;
  isOffTrack: boolean;
  drivingFeedback: string | null;

  isReplaying: boolean;
  replayData: ReplayFrame[];
  replayViewMode: "chase" | "driver";

  isVisionReady: boolean;
  debugInfo: string;

  // Auth / History
  user: User | null;
  missionHistory: MissionHistoryItem[];

  setUser: (user: User | null) => void;
  setMissionHistory: (history: MissionHistoryItem[]) => void;
  addHistoryItem: (item: MissionHistoryItem) => void;

  // Actions
  setScreen: (screen: ScreenId) => void;
  setLanguage: (lang: "ja" | "en") => void;
  setIsPaused: (paused: boolean) => void;
  setSteering: (val: number) => void;
  setPedals: (throttle: number, brake: number) => void;
  setSpeed: (speed: number) => void;

  setLesson: (lesson: LessonId) => void;

  setMissionState: (state: MissionState) => void;
  setOffTrack: (isOff: boolean) => void;
  setDrivingFeedback: (msg: string | null) => void;
  setHeadRotation: (rotation: { pitch: number; yaw: number; roll: number }) => void;
  setVisionReady: (ready: boolean) => void;
  setDebugInfo: (info: string) => void;
  setFootCalibration: (calibration: FootCalibration | null) => void;
  updatePedalState: (pedalState: PedalState) => void;
  setCalibrationStage: (stage: "idle" | "waiting_for_brake" | "calibrated") => void;
  startCalibration: () => void;

  // Pedal input mode: camera (foot tracking) or keyboard (W/S) fallback for
  // when legs/feet can't be tracked reliably. See docs/superpowers/plans/0004.
  pedalInputMode: "camera" | "keyboard";
  setPedalInputMode: (mode: "camera" | "keyboard") => void;
  activateKeyboardPedalFallback: () => void;

  // Mission scoring/time
  missionStartTime: number;
  missionEndTime: number;
  deviationPenalty: number;
  addDeviationPenalty: (amount: number) => void;
  calculateMissionResult: (coursePath: THREE.CurvePath<THREE.Vector3>) => void;

  // Replay
  setIsReplaying: (isReplaying: boolean) => void;
  setReplayViewMode: (mode: "chase" | "driver") => void;
  addReplayFrame: (frame: ReplayFrame) => void;
  clearReplayData: () => void;

  // Feedback / Gaze / Video
  gaze: { x: number; y: number };
  feedbackLogs: FeedbackEvent[];
  recordedVideo: string | null;
  signalStateLogs: SignalStateLog[];
  setGaze: (gaze: { x: number; y: number }) => void;
  addFeedbackLog: (log: FeedbackEvent) => void;
  addSignalStateLog: (log: SignalStateLog) => void;
  clearFeedbackLogs: () => void;
  clearSignalStateLogs: () => void;
  setRecordedVideo: (url: string | null) => void;
  setGear: (gear: "P" | "D" | "R") => void;

  // ✅ Added: type definitions for checkpoint management
  activeCheckpoints: MissionCheckpoint[];
  registerCheckpoint: (cp: MissionCheckpoint) => void;
  unregisterCheckpoint: (id: string) => void;

  // ✅ Added: cleared-checkpoint management
  clearedCheckpointIds: string[];
  addClearedCheckpoint: (id: string) => void;
  resetClearedCheckpoints: () => void;

  // In-memory, non-identifying usability-test session instrumentation.
  cameraProcessingAllowed: boolean;
  testSession: TestSessionState | null;
  startTestSession: (cameraProcessingAllowed: boolean) => void;
  recordTestSessionEvent: (eventType: SessionEventType, payload?: { inputMode?: "camera" | "keyboard"; failureCategory?: "camera-denied" | "camera-initialization" | "vision-initialization" | "incomplete" }) => void;
  exportTestSession: () => string | null;
}

export const useDrivingStore = create<DrivingState>((set, get) => ({
  // First launch (no saved language) starts on the language-selection page;
  // returning visitors (saved choice) go straight to Home. ClientApp is
  // client-only (ssr:false), so reading localStorage here is safe.
  screen:
    typeof window !== "undefined" && localStorage.getItem("language")
      ? "home"
      : "language",
  isPaused: false,
  language:
    typeof window !== "undefined" && localStorage.getItem("language") === "en"
      ? "en"
      : "ja",

  steeringAngle: 0,
  throttle: 0,
  brake: 0,
  headRotation: { pitch: 0, yaw: 0, roll: 0 },

  footCalibration: null,
  pedalState: {
    throttle: 0,
    brake: 0,
    isAccelPressed: false,
    isBrakePressed: false,
    brakePressDuration: 0,
    brakePressCount: 0,
  },
  calibrationStage: "idle",
  pedalInputMode:
    typeof window !== "undefined" && localStorage.getItem("pedalInputMode") === "keyboard"
      ? "keyboard"
      : "camera",

  speed: 0,
  gear: "D",

  currentLesson: "straight",

  missionState: "idle",
  isOffTrack: false,
  drivingFeedback: null,

  isReplaying: false,
  replayData: [],
  replayViewMode: "chase",

  isVisionReady: false,
  debugInfo: "Initializing...",

  user: null,
  missionHistory: [],

  setUser: (user) => set({ user }),
  setMissionHistory: (history) => set({ missionHistory: history }),
  addHistoryItem: (item) =>
    set((state) => ({
      missionHistory: [item, ...state.missionHistory],
    })),

  setScreen: (screen) => set({ screen }),
  setLanguage: (lang) => {
    if (typeof window !== "undefined") localStorage.setItem("language", lang);
    set({ language: lang });
  },
  setIsPaused: (paused) => set({ isPaused: paused }),
  setSteering: (val) => set({ steeringAngle: val }),
  setPedals: (throttle, brake) => set({ throttle, brake }),
  setSpeed: (speed) => set({ speed }),

  setLesson: (lesson) =>
    set(() => ({
      currentLesson: lesson,
      missionState: lesson === "free-mode" ? "active" : "briefing",
      deviationPenalty: 0,
      missionStartTime: 0,
      missionEndTime: 0,
    })),

  missionStartTime: 0,
  missionEndTime: 0,

  setMissionState: (state) => {
      const now = Date.now();
      const previousState = get().missionState;
      const updates: Partial<DrivingState> = { missionState: state };

      if (state === "active") {
        updates.missionStartTime = now;
        updates.missionEndTime = 0;
      } else if (state === "success" || state === "failed") {
        updates.missionEndTime = now;
      }
      set(updates);
      const session = get().testSession;
      if (session && state !== previousState) {
        const eventType = state === "active" ? "lesson_started" : state === "success" ? "lesson_completed" : state === "failed" ? "lesson_failed" : null;
        if (eventType) {
          set({ testSession: appendTestSessionEvent(session, eventType, {
            timestamp: now,
            lessonId: get().currentLesson,
            ...(eventType === "lesson_failed" ? { failureCategory: "incomplete" as const } : {}),
          }) });
        }
      }
    },

  deviationPenalty: 0,
  addDeviationPenalty: (amount) =>
    set((s) => ({ deviationPenalty: s.deviationPenalty + amount })),

  calculateMissionResult: (coursePath) => {
    // free-mode is not scored
    const st = useDrivingStore.getState();
    if (st.currentLesson === "free-mode") return;

    const frames = st.replayData;
    const currentLesson = st.currentLesson;

    let deviationPenalty = 0;
    let speedViolations = 0;

    const pathResolution = 100;
    const PENALTY_DIST = 2.5;
    const SPEED_LIMIT = currentLesson === "straight" ? 60 : 20;

    const pathPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= pathResolution; i++) {
      pathPoints.push(coursePath.getPointAt(i / pathResolution));
    }

    frames.forEach((frame) => {
      const pos = new THREE.Vector3(frame.position[0], frame.position[1], frame.position[2]);

      let minDist = 1000;
      for (const p of pathPoints) {
        const d = p.distanceTo(pos);
        if (d < minDist) minDist = d;
      }

      if (minDist > PENALTY_DIST) {
        deviationPenalty += 1.0 + (minDist - PENALTY_DIST) * 0.2;
      }

      if (frame.speed && frame.speed > SPEED_LIMIT + 5) {
        speedViolations++;
      }
    });

    // --- Traffic signal stop-check before/at stop line ---
    let signalViolations = 0;
    try {
      const checkpoints = MISSION_CHECKPOINTS[currentLesson] || [];
      const STOP_SPEED_THRESHOLD = 5; // km/h

      for (const cp of checkpoints) {
        if (cp.type !== 'stop' || cp.visual !== 'traffic-light') continue;

        const crossingIndex = frames.findIndex((frame) => {
          const pos = new THREE.Vector3(frame.position[0], frame.position[1], frame.position[2]);
          const cpPos = new THREE.Vector3(cp.position[0], cp.position[1], cp.position[2]);
          return pos.distanceTo(cpPos) < cp.radius;
        });

        if (crossingIndex === -1) continue;

        const hitTime = frames[crossingIndex].timestamp;
        const logsForCp = st.signalStateLogs.filter((l) => l.checkpointId === cp.id && l.time <= hitTime);
        const stateAtHit = logsForCp.length ? logsForCp[logsForCp.length - 1].state : 'green';

        // Check whether the vehicle stopped for required duration before crossing
        const minDur = cp.minDuration ?? 1000;
        let stoppedDuration = 0;
        let j = crossingIndex;
        while (j > 0) {
          const dt = frames[j].timestamp - frames[j - 1].timestamp;
          if ((frames[j].speed || 0) <= STOP_SPEED_THRESHOLD) {
            stoppedDuration += dt;
            j--;
          } else {
            break;
          }
        }

        if (stateAtHit === 'red' && stoppedDuration < minDur) {
          signalViolations++;
        }
      }
    } catch (e) {
      // Be defensive - do not break scoring if anything goes wrong
      console.error('Signal violation check failed', e);
    }

    // ▼▼▼ Added: detect uncleared checkpoints (dynamically registered ones) ▼▼▼
    // Find entries that are in activeCheckpoints but not in clearedCheckpointIds
    const missedCheckpointIds = getMissedCheckpointIds(
      st.activeCheckpoints,
      st.clearedCheckpointIds,
    );
    const missedCheckpoints = st.activeCheckpoints.filter((cp) =>
      missedCheckpointIds.includes(cp.id),
    );
    // ▲▲▲ End of addition ▲▲▲

    set((s) => {
      const newLogs = [...s.feedbackLogs];
      const lang = s.language; // KAIZEN messages are user-facing -> bilingual
      if (speedViolations > 30) {
        newLogs.push({
          time: Date.now(),
          type: "KAIZEN",
          message: lang === 'en'
            ? `Speeding detected (limit: ${SPEED_LIMIT} km/h)`
            : `速度超過がありました (最大制限: ${SPEED_LIMIT}km/h)`,
        });
      }

      if (typeof signalViolations !== 'undefined' && signalViolations > 0) {
        newLogs.push({
          time: Date.now(),
          type: "KAIZEN",
          message: lang === 'en'
            ? `Failed to stop at a red light ${signalViolations} time(s)`
            : `赤信号で停止しなかったチェックが ${signalViolations} 回ありました`,
          meta: { penalty: 10 * signalViolations, signalViolations },
        });
      }

      // ▼▼▼ Added: add logs for ignored checkpoints ▼▼▼
      // English mode uses type-based wording; Japanese mode keeps the specific
      // checkpoint label (which is the JA-mode display text).
      missedCheckpoints.forEach(cp => {
        const msg = getMissedCheckpointFeedback(cp, lang);

        if (msg) {
            newLogs.push({
            time: Date.now(),
            type: "KAIZEN",
            message: msg
            });
        }
      });
      // ▲▲▲ End of addition ▲▲▲

      // Add a penalty based on the number of uncleared checkpoints (e.g. 20 points each)
      const missedPenalty = getMissedCheckpointPenalty(missedCheckpointIds);

      return {
        deviationPenalty: s.deviationPenalty + deviationPenalty + missedPenalty,
        feedbackLogs: newLogs,
      };
    });
  },

  setOffTrack: (isOff) => set({ isOffTrack: isOff }),
  setDrivingFeedback: (msg) => set({ drivingFeedback: msg }),
  setHeadRotation: (rotation) => set({ headRotation: rotation }),
  setVisionReady: (ready) => set({ isVisionReady: ready }),
  setDebugInfo: (info) => set({ debugInfo: info }),
  setFootCalibration: (calibration) => set({ footCalibration: calibration }),
  updatePedalState: (pedalState) =>
    set({ pedalState, throttle: pedalState.throttle, brake: pedalState.brake }),
  setCalibrationStage: (stage) => set({ calibrationStage: stage }),
  setPedalInputMode: (mode) => {
    if (typeof window !== "undefined") localStorage.setItem("pedalInputMode", mode);
    if (mode === "camera") {
      set({ pedalInputMode: mode, calibrationStage: "idle", footCalibration: null });
    } else {
      set(getKeyboardFallbackState());
    }
    const session = get().testSession;
    if (session && get().pedalInputMode !== session.selectedInputMode) {
      set({ testSession: appendTestSessionEvent(session, "input_mode_selected", { inputMode: mode, timestamp: Date.now(), lessonId: get().currentLesson }) });
    }
  },
  activateKeyboardPedalFallback: () => {
    const fallbackState = getKeyboardFallbackState();
    if (typeof window !== "undefined") localStorage.setItem("pedalInputMode", fallbackState.pedalInputMode);
    set(fallbackState);
    const session = get().testSession;
    if (session && session.selectedInputMode !== "keyboard") {
      set({ testSession: appendTestSessionEvent(session, "input_mode_selected", { inputMode: "keyboard", timestamp: Date.now(), lessonId: get().currentLesson }) });
    }
  },
  startCalibration: () =>
    set({
      calibrationStage: "waiting_for_brake",
      footCalibration: null,
      debugInfo: "キャリブレーション開始: ブレーキを踏んでください",
    }),

  setIsReplaying: (isReplaying) => set({ isReplaying }),
  setReplayViewMode: (mode) => set({ replayViewMode: mode }),
  addReplayFrame: (frame) => set((state) => ({ replayData: [...state.replayData, frame] })),
  clearReplayData: () => set({ replayData: [] }),

  gaze: { x: 0, y: 0 },
  feedbackLogs: [],
  recordedVideo: null,
  signalStateLogs: [],
  setGaze: (gaze) => set({ gaze }),
  addFeedbackLog: (log) => set((state) => ({ feedbackLogs: [...state.feedbackLogs, log] })),
  addSignalStateLog: (log) => set((state) => ({ signalStateLogs: [...state.signalStateLogs, log] })),
  clearFeedbackLogs: () => set({ feedbackLogs: [] }),
  clearSignalStateLogs: () => set({ signalStateLogs: [] }),
  setRecordedVideo: (url) => set({ recordedVideo: url }),
  setGear: (gear) => set({ gear }),

  // ✅ Added: checkpoint management implementation (this was missing)
  activeCheckpoints: [],
  registerCheckpoint: (cp) => set((state) => ({ 
    activeCheckpoints: [...state.activeCheckpoints, cp] 
  })),
  unregisterCheckpoint: (id) => set((state) => ({ 
    activeCheckpoints: state.activeCheckpoints.filter((c) => c.id !== id) 
  })),

  // ✅ Added: cleared-state management implementation
  clearedCheckpointIds: [],
  addClearedCheckpoint: (id) => set((state) => ({
    clearedCheckpointIds: [...state.clearedCheckpointIds, id]
  })),
  resetClearedCheckpoints: () => set({ clearedCheckpointIds: [] }),

  cameraProcessingAllowed: false,
  testSession: null,
  startTestSession: (cameraProcessingAllowed) => {
    const inputMode = cameraProcessingAllowed ? get().pedalInputMode : "keyboard";
    const state = createTestSessionState({
      sessionId: createSessionId(),
      startedAt: Date.now(),
      consentAccepted: cameraProcessingAllowed,
      inputMode,
      lessonId: get().currentLesson,
    });
    set({ cameraProcessingAllowed, testSession: state });
    if (!cameraProcessingAllowed) get().activateKeyboardPedalFallback();
  },
  recordTestSessionEvent: (eventType, payload) => {
    const session = get().testSession;
    if (!session) return;
    set({ testSession: appendTestSessionEvent(session, eventType, { ...payload, timestamp: Date.now(), lessonId: get().currentLesson }) });
  },
  exportTestSession: () => {
    const session = get().testSession;
    if (!session) return null;
    const summary = finalizeTestSession(session, Date.now());
    set({ testSession: summary });
    return serializeTestSessionSummary(summary);
  },
}));
