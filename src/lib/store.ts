import { create } from 'zustand';

export interface ReplayFrame {
  timestamp: number;
  position: [number, number, number];
  rotation: [number, number, number]; // Euler angles
  steering: number;
  headRotation: { pitch: number; yaw: number; roll: number };
}

interface DrivingState {
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
