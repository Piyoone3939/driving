# Guided training regression contract

Issue #31 uses the existing `left-turn` lesson as the smallest deterministic guided-training slice.

## Existing runtime slice

- Course path: `src/lib/course.ts`, `left-turn`.
- Checkpoints: `stop-1` and `mirror-1`, from `src/components/simulation/MissionController.tsx`.
- Goal: the existing left-turn goal in `MISSION_GOALS`.
- Runtime scoring and checkpoint penalties are implemented in `src/lib/store.ts`.
- Retry remains the existing `FeedbackScreen.tsx` flow: clear replay data, set mission state to `briefing`, and show `driving`.

## Current behavior extracted for testing

The helpers in `src/lib/guidedTrainingContract.ts` are imported by production `store.ts` and `FeedbackScreen.tsx`, and by the regression tests. They extract existing behavior; they do not define a separate guided-training state machine.

1. Missed checkpoint IDs are active checkpoints not present in the cleared list. Production does not currently enforce checkpoint ordering.
2. Each missed checkpoint costs 20 points in `store.ts`.
3. Missed `stop` and `safety-check` checkpoints produce existing KAIZEN feedback. Missed `mirror` checkpoints currently produce no missed-checkpoint feedback. This surprising behavior is preserved and is a follow-up candidate, not fixed here.
4. Final score is the existing `100 - KAIZEN penalties - floor(deviationPenalty)`, clamped at zero.
5. Keyboard pedal mode does not alter checkpoint or scoring calculations.

This is a testability seam, not a new lesson or a scoring-rule change. The production runtime calls the same helpers tested by Issue #31.
