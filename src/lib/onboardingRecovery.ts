export type CameraFailureKind = "denied" | "error";

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
