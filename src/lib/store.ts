import { create } from 'zustand';
import { FootCalibration, PedalState } from './footPedalRecognition';

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

  // Foot Pedal Recognition
  footCalibration: FootCalibration | null;
  pedalState: PedalState;
  calibrationStage: 'idle' | 'waiting_for_brake' | 'calibrated';

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

  // Foot Pedal Actions
  setFootCalibration: (calibration: FootCalibration | null) => void;
  updatePedalState: (pedalState: PedalState) => void;
  setCalibrationStage: (stage: 'idle' | 'waiting_for_brake' | 'calibrated') => void;
  startCalibration: () => void;

  // Replay Actions
  setIsReplaying: (isReplaying: boolean) => void;
  setReplayViewMode: (mode: 'chase' | 'driver') => void;
  addReplayFrame: (frame: ReplayFrame) => void;
  clearReplayData: () => void; 
}

export const useDrivingStore = create<DrivingState>((set) => ({
  screen: 'home',
  isPaused: false,

  steeringAngle: 0,
  throttle: 0,
  brake: 0,
  headRotation: { pitch: 0, yaw: 0, roll: 0 },

  // Foot Pedal初期値
  footCalibration: null,
  pedalState: {
    throttle: 0,
    brake: 0,
    isAccelPressed: false,
    isBrakePressed: false,
    brakePressDuration: 0,
    brakePressCount: 0,
  },
  calibrationStage: 'idle',

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
  setMissionState: (state) => set({ missionState: state }),

  setOffTrack: (isOff) => set({ isOffTrack: isOff }),
  setDrivingFeedback: (msg) => set({ drivingFeedback: msg }),
  setHeadRotation: (rotation) => set({ headRotation: rotation }),
  setVisionReady: (ready) => set({ isVisionReady: ready }),
  setDebugInfo: (info) => set({ debugInfo: info }),

  // Foot Pedal Actions実装
  setFootCalibration: (calibration) => set({ footCalibration: calibration }),
  updatePedalState: (pedalState) =>
    set({
      pedalState,
      throttle: pedalState.throttle,
      brake: pedalState.brake,
    }),
  setCalibrationStage: (stage) => set({ calibrationStage: stage }),
  startCalibration: () =>
    set({
      calibrationStage: 'waiting_for_brake',
      footCalibration: null,
      debugInfo: 'キャリブレーション開始: ブレーキを踏んでください',
    }),

  setIsReplaying: (isReplaying) => set({ isReplaying }),
  setReplayViewMode: (mode) => set({ replayViewMode: mode }),
  addReplayFrame: (frame) => set((state) => ({ replayData: [...state.replayData, frame] })),
  clearReplayData: () => set({ replayData: [] }),
}));
