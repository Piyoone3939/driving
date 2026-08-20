export type CameraFailureKind = "denied" | "error";
export type RecoveryKind = "camera-denied" | "camera-error" | "vision-error";
export type RecoveryLanguage = "ja" | "en";

export interface KeyboardFallbackState {
  pedalInputMode: "keyboard";
  calibrationStage: "idle";
  footCalibration: null;
}

export interface RecoveryCopy {
  title: string;
  message: string;
  retryLabel: string;
  fallbackLabel: string;
  settingsHint?: string;
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

export function getRecoveryCopy(kind: RecoveryKind, language: RecoveryLanguage): RecoveryCopy {
  if (language === "ja") {
    if (kind === "camera-denied") {
      return {
        title: "📷 カメラの許可が必要です",
        message: "カメラへのアクセスが拒否されました。ブラウザのサイト設定でカメラを許可してから再試行してください。",
        retryLabel: "カメラを再試行",
        fallbackLabel: "キーボード操作を使う",
        settingsHint: "ブラウザがこのサイトをブロックした場合は、サイト設定のカメラ権限を変更してください。",
      };
    }
    if (kind === "vision-error") {
      return {
        title: "⚙️ カメラ認識を開始できません",
        message: "カメラ認識の準備に失敗しました。認識の準備を再試行するか、キーボード操作へ切り替えてください。",
        retryLabel: "認識を再試行",
        fallbackLabel: "キーボード操作を使う",
      };
    }
    return {
      title: "📷 カメラを起動できません",
      message: "カメラの起動に失敗しました。カメラの接続を確認して再試行してください。",
      retryLabel: "カメラを再試行",
      fallbackLabel: "キーボード操作を使う",
    };
  }

  if (kind === "camera-denied") {
    return {
      title: "📷 Camera permission required",
      message: "Camera access was denied. Allow the camera in your browser site settings, then tap Retry.",
      retryLabel: "Retry camera",
      fallbackLabel: "Use keyboard controls",
      settingsHint: "If the browser blocked this site, change camera permission in the site settings.",
    };
  }
  if (kind === "vision-error") {
    return {
      title: "⚙️ Vision setup unavailable",
      message: "Camera recognition setup failed. Retry vision setup or continue with keyboard controls.",
      retryLabel: "Retry vision setup",
      fallbackLabel: "Use keyboard controls",
    };
  }
  return {
    title: "📷 Camera unavailable",
    message: "The camera could not be started. Check the camera connection and try again.",
    retryLabel: "Retry camera",
    fallbackLabel: "Use keyboard controls",
  };
}

export function shouldRequireLandscape(width: number, height: number): boolean {
  return width <= 1024 && height > width;
}
