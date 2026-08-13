# Issue

Issue #31 — Define deterministic guided training slice and scoring regression cases

## Date

2026-08-13 JST

## Objective

Make the smallest existing guided-training slice verifiable without webcam, Firebase, network, time, or randomness dependencies.

## Selected slice

The existing `left-turn` lesson: `stop-1` followed by `mirror-1`, then the existing left-turn goal and result flow.

## Regression cases

- Successful run: clears both checkpoints in order; expects pass, score 100, and no feedback.
- Missed checkpoint: clears only `stop-1`; expects score 80 and feedback naming `mirror-1`.
- Retry reset: resets a completed run; expects no cleared checkpoints and the base score of 60 for two required checkpoints.
- Keyboard pedal fallback: runs the same sequence with `pedalInputMode = keyboard`; expects score 100 without camera state.
- Additional order guard: an out-of-order `mirror-1` event cannot bypass `stop-1`.

## Technical decisions

- Use Node's built-in `node:test` runner; no E2E framework or browser dependency is added.
- Add a small dependency-free TypeScript contract seam rather than importing the React/Zustand/Firebase runtime into tests.
- Keep runtime scoring and course definitions unchanged.

## Testability seams

`src/lib/guidedTrainingContract.ts` contains deterministic checkpoint ordering, penalty/result calculation, feedback identifiers, and retry reset behavior. It is deliberately independent of camera, Firebase, Three.js, time, and randomness.

## Verification

`npm ci`, `npm run lint`, `npm run type-check`, `npm run test:guided`, and `git diff --check` are required before PR.

## Remaining risks

The seam verifies the documented guided-training contract, while full runtime integration still needs manual/browser validation in a later issue. It does not test MediaPipe, camera permissions, or Firebase.
