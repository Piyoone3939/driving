import { useDrivingStore } from "@/lib/store";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";

export function MissionController() {
  const currentLesson = useDrivingStore(state => state.currentLesson);
  const missionState = useDrivingStore(state => state.missionState);
  const setMissionState = useDrivingStore(state => state.setMissionState);
  const setScreen = useDrivingStore(state => state.setScreen);
  const speed = useDrivingStore(state => state.speed);

  // Logic is currently handled in Car.tsx due to access requirements
  return null;
}

// Goal Definitions (Position, Rotation Y, Size)
export const MISSION_GOALS: Record<string, { position: [number, number, number], size: [number, number, number], rotation: number }> = {
    'straight': {
        position: [0, 0, -150],
        size: [10, 5, 5],
        rotation: 0
    },
    'left-turn': {
        position: [-30, 0, -38], // Located on the exit road (-X) after turn
        size: [10, 5, 5],
        rotation: Math.PI / 2 // Rotated 90 deg to face the road traveling along -X
    },
    'right-turn': {
        position: [30, 0, -38], // Located on the exit road (+X) after turn
        size: [10, 5, 5],
        rotation: -Math.PI / 2 // Rotated -90 deg to face the road traveling along +X
    },
    's-curve': {
        position: [0, 0, -100],
        size: [10, 5, 5],
        rotation: 0
    },
    'crank': {
        position: [0, 0, -100],
        size: [10, 5, 5],
        rotation: 0
    },
};

// Checkpoints (Stop Signs, Mirrors)
export type CheckpointType = 'stop' | 'mirror';

export interface Checkpoint {
    id: string;
    type: CheckpointType;
    position: [number, number, number];
    radius: number;
    // For stop signs:
    minDuration?: number; // How long to stop
    // For mirrors:
    targetYaw?: number; // Expected look direction (radians)
    yawTolerance?: number;
}

export const MISSION_CHECKPOINTS: Record<string, Checkpoint[]> = {
    'left-turn': [
        // Stop line before intersection
        { id: 'stop-1', type: 'stop', position: [0, 0, -25], radius: 4, minDuration: 1000 },
        // Curve Mirror check (Look Right/Forward-Right to check traffic)
        { id: 'mirror-1', type: 'mirror', position: [0, 0, -28], radius: 6, targetYaw: -0.5, yawTolerance: 0.5 }
    ],
    'right-turn': [
        { id: 'stop-1', type: 'stop', position: [0, 0, -25], radius: 4 },
        // Mirror on Left Corner. Look Left.
        { id: 'mirror-1', type: 'mirror', position: [0, 0, -28], radius: 6, targetYaw: 0.5, yawTolerance: 0.5 }
    ],
};

export function checkMissionGoal(lesson: string, position: Vector3) {
    const goal = MISSION_GOALS[lesson];
    if (!goal) return false;

    const dx = position.x - goal.position[0];
    const dz = position.z - goal.position[2];
    const dist = Math.sqrt(dx*dx + dz*dz);

    // Within 4 units of the center
    if (dist < 4) {
        return true;
    }

    return false;
}
