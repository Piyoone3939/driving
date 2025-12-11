import { useDrivingStore } from "@/lib/store";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";

export function MissionController() {
  const currentLesson = useDrivingStore(state => state.currentLesson);
  const missionState = useDrivingStore(state => state.missionState);
  const setMissionState = useDrivingStore(state => state.setMissionState);
  const setScreen = useDrivingStore(state => state.setScreen);
  const speed = useDrivingStore(state => state.speed); // We might need actual position from store or ref.
  
  // To check car position, we need access to it.
  // This component should ideally be inside the <Car> or have access to car ref.
  // But <Car> is isolated.
  // Alternative: <Car> updates the store with its position?
  // No, updating store every frame is bad.
  // Solution: <Car> calls a callback or we perform checks INSIDE <Car>?
  // OR: <MissionController> is a child of <Car>? No.
  // OR: <MissionController> uses a subscribing Ref if possible?
  // Let's make MissionController logic part of Scene or Car? 
  // Car is already big.
  // Let's keep MissionController separate but maybe pass the car's ref to it?
  // In `Scene.tsx`, we can have `const carRef = useRef()` and pass it to both `Car` (via forwardRef?) and `MissionController`.
  
  // For now, simpler: Logic inside `Car.tsx` for "Goal Reached" check?
  // Or: update store with "Distance Travelled" at 60fps? No.
  
  // Let's implement a simplified Goal based on time or distance estimation in Car.tsx?
  // Ideally, valid collision detection with "Goal Areas".
  // Since I can't easily pass refs across the suspense boundary/structure without refactoring `Scene`,
  // I will cheat: I will add "Goal Check" logic into `Car.tsx` for now, or make MissionController simpler.
  
  // Wait, I can't put this file in `components/simulation` if I don't use it.
  // I'll put the logic in `Car.tsx` as a helper hook or function.
  // But I said I would create `MissionController.tsx`.
  // I'll create it as a "Logic Component" that takes the position as a prop?
  // But updating props 60fps is also re-render.
  
  // Decision: Logic inside `Car.tsx` is most performant for now.
  // But I will create `MissionController` to hold the DEFINITIONS of missions.
  
  return null;
}

// Goal Definitions (Position, Rotation Y, Size)
export const MISSION_GOALS: Record<string, { position: [number, number, number], size: [number, number, number], rotation: number }> = {
    'straight': { 
        position: [0, 0, -150], // Extended goal distance
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
        // Target Yaw: looking right is negative? No, Yaw is positive Left usually?
        // Let's assume Yaw > 0.5 (Looking Left) or Yaw < -0.5 (Looking Right)?
        // For Left Turn, we look Right (-Yaw) then Left (+Yaw).
        // Let's simplified: Mirror is at Right Corner. Look Right.
        { id: 'mirror-1', type: 'mirror', position: [0, 0, -28], radius: 6, targetYaw: -0.5, yawTolerance: 0.5 } 
    ],
    'right-turn': [
        { id: 'stop-1', type: 'stop', position: [0, 0, -25], radius: 4 },
        // Mirror on Left Corner. Look Left.
        { id: 'mirror-1', type: 'mirror', position: [0, 0, -28], radius: 6, targetYaw: 0.5, yawTolerance: 0.5 }
    ]
};

// State to track cleared checkpoints in a session (should be reset on start)
// Using a simple module-level var is risky if multiple sessions provided without reload.
// Better to store in the component loop or pass a Set.
// We'll return the result of the check to be handled by the caller (Car.tsx).

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
