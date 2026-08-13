import { Vector3 } from "three";

export { MISSION_CHECKPOINTS } from "@/lib/missionCheckpoints";
export type { Checkpoint, CheckpointType } from "@/lib/missionCheckpoints";

export function MissionController() {
  // Logic is currently handled in Car.tsx due to access requirements
  return null;
}

// Goal Definitions (Position, Rotation Y, Size)
export const MISSION_GOALS: Record<
  string,
  { position: [number, number, number]; size: [number, number, number]; rotation: number }
> = {
  straight: {
    position: [0, 0, -150],
    size: [10, 5, 5],
    rotation: 0,
  },

  "left-turn": {
    // getCoursePath(): the exit keeps z=-38 while x goes -8 → -60, so -30 is OK
    position: [-30, 0, -38],
    size: [10, 5, 5],
    rotation: Math.PI / 2,
  },

  "right-turn": {
    // getCoursePath(): the exit keeps z=-38 while x goes 8 → 60, so 30 is OK
    position: [30, 0, -38],
    size: [10, 5, 5],
    rotation: -Math.PI / 2,
  },

  "s-curve": {
    position: [0, 0, -100],
    size: [10, 5, 5],
    rotation: 0,
  },

  crank: {
    // getCoursePath(): ends with a straight at xL=-8, with ( -8,0,-100 ) as the endpoint
    position: [-8, 0, -100],
    size: [10, 5, 5],
    rotation: 0,
  },

  "traffic-light": {
    position: [0, 0, -100],
    size: [10, 5, 5],
    rotation: 0,
  },

  // ✅ Added: goal for the crosswalk level
  "crosswalk": {
    position: [0, 0, -80],
    size: [10, 5, 5],
    rotation: 0,
  },
  // ✅ Added: level 8 goal
  "railroad-crossing": {
    position: [0, 0, -100], 
    size: [10, 5, 5],
    rotation: 0,
  },
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
