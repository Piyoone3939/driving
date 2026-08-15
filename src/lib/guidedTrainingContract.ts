/**
 * Small pure helpers extracted from the existing mission/result flow.
 * Production imports these helpers from store.ts and FeedbackScreen.tsx;
 * this module does not define a separate guided-training state machine.
 */
export interface MissableCheckpoint {
  id: string;
  type: "stop" | "speed-limit" | "mirror" | "safety-check";
  label?: string;
}

export interface FeedbackLike {
  type: string;
  meta?: Record<string, unknown>;
}

export function getMissedCheckpointIds(
  activeCheckpoints: readonly Pick<MissableCheckpoint, "id">[],
  clearedCheckpointIds: readonly string[],
): string[] {
  return activeCheckpoints
    .filter((checkpoint) => !clearedCheckpointIds.includes(checkpoint.id))
    .map((checkpoint) => checkpoint.id);
}

export function getMissedCheckpointPenalty(missedCheckpointIds: readonly string[]): number {
  return missedCheckpointIds.length * 20;
}

export function getMissedCheckpointFeedback(
  checkpoint: MissableCheckpoint,
  language: "ja" | "en",
): string {
  if (checkpoint.type === "stop") {
    return language === "en"
      ? "You ignored a required stop"
      : `${checkpoint.label || "一時停止"}を無視しました`;
  }
  if (checkpoint.type === "safety-check") {
    return language === "en"
      ? "You skipped a safety check"
      : `${checkpoint.label || "安全確認"}を行いませんでした`;
  }
  // Current production behavior intentionally has no missed feedback for mirrors.
  return "";
}

export function calculateFinalScore(
  feedbackLogs: readonly FeedbackLike[],
  deviationPenalty: number,
): number {
  const kaizenPenalty = feedbackLogs
    .filter((log) => log.type === "KAIZEN")
    .reduce(
      (total, log) =>
        total + (typeof log.meta?.penalty === "number" ? log.meta.penalty : 5),
      0,
    );
  return Math.max(0, 100 - kaizenPenalty - Math.floor(deviationPenalty || 0));
}

export function getRetryTransition(): {
  missionState: "briefing";
  screen: "driving";
} {
  return { missionState: "briefing", screen: "driving" };
}
