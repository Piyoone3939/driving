# Guided training regression contract

Issue #31 uses the existing `left-turn` lesson as the smallest deterministic guided-training slice.

## Existing runtime slice

- Course path: `src/lib/course.ts`, `left-turn`.
- Required checkpoints: `stop-1` at the stop line, then `mirror-1` for the safety check, from `src/components/simulation/MissionController.tsx`.
- Goal: the existing left-turn goal in `MISSION_GOALS`.
- Runtime scoring and checkpoint penalties remain in `src/lib/store.ts` and the simulation components.
- Retry remains the existing `FeedbackScreen.tsx` flow, which clears replay data and returns to driving briefing.

## Deterministic contract

The dependency-free seam in `src/lib/guidedTrainingContract.ts` models only the observable contract needed for regression coverage:

1. `stop-1` must be cleared before `mirror-1`.
2. A complete sequence passes with score 100 and no feedback.
3. Each missed checkpoint costs 20 points and reports its checkpoint ID.
4. Retry starts with no cleared checkpoints while preserving the selected pedal input mode.
5. Keyboard pedal mode uses the same checkpoint/result contract and does not require camera or Firebase state.

This is a testability seam, not a new lesson or a scoring-rule change. The production runtime remains the source of behavior and is not rewritten by Issue #31.
