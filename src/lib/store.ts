import { create } from 'zustand';
import * as THREE from 'three';

export interface ReplayFrame {
  timestamp: number;
  position: [number, number, number];
  rotation: [number, number, number]; // Euler angles
  steering: number;
  speed: number;
  headRotation: { pitch: number; yaw: number; roll: number };
}

export interface DrivingState {
  // Screen Management
  screen: 'home' | 'driving' | 'feedback';
  isPaused: boolean;

  // Vehicle Control
  steeringAngle: number; // -1 (left) to 1 (right)
  throttle: number; // 0 to 1
  brake: number; // 0 to 1
  
  // Head Tracking
  headRotation: { pitch: number; yaw: number; roll: number }; // In radians
  
  // Vehicle Telemetry
  speed: number; // Current speed (arbitrary units or km/h)
  gear: 'P' | 'D' | 'R';
  currentLesson: 'straight' | 's-curve' | 'crank' | 'left-turn' | 'right-turn';
  missionState: 'idle' | 'briefing' | 'active' | 'success' | 'failed'; 
  isOffTrack: boolean;
  drivingFeedback: string | null;

  // Replay System
  isReplaying: boolean;
  replayData: ReplayFrame[];
  replayViewMode: 'chase' | 'driver'; 
  
  // System
  isVisionReady: boolean;
  debugInfo: string;

  // Actions
  setScreen: (screen: 'home' | 'driving' | 'feedback') => void;
  setIsPaused: (paused: boolean) => void;
  
  setSteering: (val: number) => void;
  setPedals: (throttle: number, brake: number) => void;
  setSpeed: (speed: number) => void;
  setLesson: (lesson: 'straight' | 's-curve' | 'crank' | 'left-turn' | 'right-turn') => void;
  setMissionState: (state: 'idle' | 'briefing' | 'active' | 'success' | 'failed') => void;

  setOffTrack: (isOff: boolean) => void;
  setDrivingFeedback: (msg: string | null) => void;
  setHeadRotation: (rotation: { pitch: number; yaw: number; roll: number }) => void;
  setVisionReady: (ready: boolean) => void;
  setDebugInfo: (info: string) => void;
  
  // Timer & Scoring
  missionStartTime: number;
  missionEndTime: number;
  deviationPenalty: number;
  addDeviationPenalty: (amount: number) => void;
  calculateMissionResult: (coursePath: THREE.CurvePath<THREE.Vector3>) => void;

  // Replay Actions
  setIsReplaying: (isReplaying: boolean) => void; 
  setReplayViewMode: (mode: 'chase' | 'driver') => void;
  addReplayFrame: (frame: ReplayFrame) => void; 
  clearReplayData: () => void; 

  // Feedback & Gaze
  gaze: { x: number; y: number };
  feedbackLogs: FeedbackEvent[];
  recordedVideo: string | null;
  setGaze: (gaze: { x: number; y: number }) => void;
  addFeedbackLog: (log: FeedbackEvent) => void;
  clearFeedbackLogs: () => void;
  setRecordedVideo: (url: string | null) => void;
}

export interface FeedbackEvent {
  time: number;
  type: 'KAIZEN' | 'GOOD';
  message: string;
}

export const useDrivingStore = create<DrivingState>((set) => ({
  screen: 'home', 
  isPaused: false,

  steeringAngle: 0,
  throttle: 0,
  brake: 0,
  headRotation: { pitch: 0, yaw: 0, roll: 0 },
  
  speed: 0,
  gear: 'D',
  currentLesson: 'straight',
  missionState: 'idle', 
  isOffTrack: false,
  drivingFeedback: null,

  isReplaying: false,
  replayData: [],
  replayViewMode: 'chase',

  isVisionReady: false,
  debugInfo: 'Initializing...',

  setScreen: (screen) => set({ screen }),
  setIsPaused: (paused) => set({ isPaused: paused }),

  setSteering: (val) => set({ steeringAngle: val }),
  setPedals: (throttle, brake) => set({ throttle, brake }),
  setSpeed: (speed) => set({ speed }),
  setLesson: (lesson) => set({ currentLesson: lesson, missionState: 'briefing' }), 
  // Timer & Scoring
  missionStartTime: 0,
  missionEndTime: 0,

  setMissionState: (state) => set((s) => {
      const now = Date.now();
      let updates: Partial<DrivingState> = { missionState: state };
      
      if (state === 'active') {
          updates.missionStartTime = now;
          updates.missionEndTime = 0; // Reset end time
      } else if (state === 'success' || state === 'failed') {
          updates.missionEndTime = now;
      }
      return updates;
  }),
  
  deviationPenalty: 0,
  addDeviationPenalty: (amount) => set((s) => ({ deviationPenalty: s.deviationPenalty + amount })),
  
  calculateMissionResult: (coursePath) => {
      const state = useDrivingStore.getState();
      const frames = state.replayData;
      const currentLesson = state.currentLesson;

      let deviationPenalty = 0;
      let speedViolations = 0;
      
      const pathResolution = 100;
      const PENALTY_DIST = 2.5; 
      const SPEED_LIMIT = currentLesson === 'straight' ? 60 : 20;

      // Pre-calculate path points for fast lookup
      // Note: This blocks the main thread, but it's during feedback screen load.
      // We can use a Web Worker later if needed.
      const pathPoints: THREE.Vector3[] = [];
      for(let i=0; i<=pathResolution; i++) {
          pathPoints.push(coursePath.getPointAt(i/pathResolution));
      }

      frames.forEach(frame => {
          // 1. Deviation
          const pos = new THREE.Vector3(frame.position[0], frame.position[1], frame.position[2]);
          let minDist = 1000;
          for(const p of pathPoints) {
              const d = p.distanceTo(pos);
              if(d < minDist) minDist = d;
          }
          
          if (minDist > PENALTY_DIST) {
              deviationPenalty += 1.0 + (minDist - PENALTY_DIST) * 0.2;
          }

          // 2. Speed
          if (frame.speed && frame.speed > SPEED_LIMIT + 5) { 
              speedViolations++;
          }
      });

      // Update State
      set((s) => {
          const newLogs = [...s.feedbackLogs];
          
          if (speedViolations > 30) { 
              newLogs.push({
                  time: Date.now(),
                  type: 'KAIZEN',
                  message: `速度超過がありました (最大制限: ${SPEED_LIMIT}km/h)`
              });
          }
          
          return {
              deviationPenalty: s.deviationPenalty + deviationPenalty,
              feedbackLogs: newLogs
          };
      });
  },

  setOffTrack: (isOff) => set({ isOffTrack: isOff }),
  setDrivingFeedback: (msg) => set({ drivingFeedback: msg }),
  setHeadRotation: (rotation) => set({ headRotation: rotation }),
  setVisionReady: (ready) => set({ isVisionReady: ready }),
  setDebugInfo: (info) => set({ debugInfo: info }),

  setIsReplaying: (isReplaying) => set({ isReplaying }),
  setReplayViewMode: (mode) => set({ replayViewMode: mode }),
  addReplayFrame: (frame) => set((state) => ({ replayData: [...state.replayData, frame] })),
  clearReplayData: () => set({ replayData: [] }),

  // Feedback & Gaze
  gaze: { x: 0, y: 0 },
  feedbackLogs: [],
  recordedVideo: null,
  setGaze: (gaze) => set({ gaze }),
  addFeedbackLog: (log) => set((state) => ({ feedbackLogs: [...state.feedbackLogs, log] })),
  clearFeedbackLogs: () => set({ feedbackLogs: [] }),
  setRecordedVideo: (url) => set({ recordedVideo: url }),
}));
