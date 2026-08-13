/**
 * Deterministic contract for the existing left-turn guided-training slice.
 *
 * Runtime checkpoint registration and scoring remain in the existing store and
 * simulation components. This small, dependency-free seam makes the contract
 * testable without importing React, Three.js, Firebase, or MediaPipe.
 */
export const LEFT_TURN_CHECKPOINTS = ["stop-1", "mirror-1"] as const;

export type LeftTurnCheckpoint = (typeof LEFT_TURN_CHECKPOINTS)[number];
export type PedalInputMode = "camera" | "keyboard";

export interface GuidedTrainingRun {
  pedalInputMode: PedalInputMode;
  clearedCheckpointIds: LeftTurnCheckpoint[];
}

export interface GuidedTrainingResult {
  passed: boolean;
  score: number;
  missedCheckpointIds: LeftTurnCheckpoint[];
  feedback: string[];
}

export function createGuidedTrainingRun(
  pedalInputMode: PedalInputMode = "camera",
): GuidedTrainingRun {
  return { pedalInputMode, clearedCheckpointIds: [] };
}

export function clearCheckpoint(
  run: GuidedTrainingRun,
  checkpointId: LeftTurnCheckpoint,
): GuidedTrainingRun {
  const nextExpected = LEFT_TURN_CHECKPOINTS[run.clearedCheckpointIds.length];
  if (checkpointId !== nextExpected) return run;

  return {
    ...run,
    clearedCheckpointIds: [...run.clearedCheckpointIds, checkpointId],
  };
}

export function evaluateGuidedTrainingRun(
  run: GuidedTrainingRun,
): GuidedTrainingResult {
  const missedCheckpointIds = LEFT_TURN_CHECKPOINTS.filter(
    (checkpointId) => !run.clearedCheckpointIds.includes(checkpointId),
  );
  const penalty = missedCheckpointIds.length * 20;

  return {
    passed: missedCheckpointIds.length === 0,
    score: Math.max(0, 100 - penalty),
    missedCheckpointIds: [...missedCheckpointIds],
    feedback: missedCheckpointIds.map(
      (checkpointId) => `Missed checkpoint: ${checkpointId}`,
    ),
  };
}

export function resetGuidedTrainingRun(
  run: GuidedTrainingRun,
): GuidedTrainingRun {
  return createGuidedTrainingRun(run.pedalInputMode);
}
