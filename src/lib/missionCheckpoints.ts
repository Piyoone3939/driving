/**
 * Dependency-light mission checkpoint definitions shared by runtime code and
 * deterministic regression tests.
 */
export type CheckpointType = "stop" | "mirror" | "speed-limit" | "safety-check";

export interface Checkpoint {
  id: string;
  type: CheckpointType;
  position: [number, number, number];
  radius: number;
  visual?: "traffic-light";
  orientation?: "z" | "x";
  minDuration?: number;
  targetYaw?: number;
  yawTolerance?: number;
  label?: string;
}

export const MISSION_CHECKPOINTS: Partial<Record<string, Checkpoint[]>> = {
  "left-turn": [
    { id: "stop-1", type: "stop", position: [0, 0, -25], radius: 4, minDuration: 1000, label: "一時停止" },
    { id: "mirror-1", type: "mirror", position: [0, 0, -28], radius: 6, targetYaw: -0.5, yawTolerance: 0.5, label: "安全確認" },
  ],
  "right-turn": [
    { id: "stop-1", type: "stop", position: [0, 0, -25], radius: 4, label: "一時停止" },
    { id: "mirror-1", type: "mirror", position: [0, 0, -28], radius: 6, targetYaw: 0.5, yawTolerance: 0.5, label: "安全確認" },
  ],
  "traffic-light": [
    { id: "signal-1", type: "stop", position: [0, 0, -18], radius: 4, minDuration: 1200, visual: "traffic-light", orientation: "z", label: "赤信号停止" },
  ],
  "crosswalk": [
    { id: "cw-stop-1", type: "stop", position: [0, 0, -25], radius: 5, minDuration: 1000, label: "横断歩道前停止" },
  ],
  "railroad-crossing": [
    { id: "rr-stop-1", type: "stop", position: [0, 0, -50], radius: 5, minDuration: 2000, label: "踏切前一時停止" },
  ],
};
