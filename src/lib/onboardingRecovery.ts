export type CameraFailureKind = "denied" | "error";
export type RecoveryKind = "camera-denied" | "camera-error" | "vision-error";

export interface KeyboardFallbackState {
  pedalInputMode: "keyboard";
  calibrationStage: "idle";
  footCalibration: null;
}

export function classifyCameraFailure(error: unknown): CameraFailureKind {
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError")) {
    return "denied";
  }
  return "error";
}

export function getKeyboardFallbackState(): KeyboardFallbackState {
  return {
    pedalInputMode: "keyboard",
    calibrationStage: "idle",
    footCalibration: null,
  };
}

export function getRecoveryRetryAction(kind: RecoveryKind): "camera-retry" | "vision-retry" {
  return kind === "vision-error" ? "vision-retry" : "camera-retry";
}
