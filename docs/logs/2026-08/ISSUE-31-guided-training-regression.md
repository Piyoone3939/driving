# Issue

Issue #31 — Define deterministic guided training slice and scoring regression cases

## Date

2026-08-13 JST

## Objective

Make the smallest existing guided-training slice verifiable without webcam, Firebase, network, time, or randomness dependencies.

## Selected slice

The existing `left-turn` lesson with `stop-1` and `mirror-1`, then the existing goal and result flow.

## PM review finding and correction

The first draft tested an independent model that enforced checkpoint ordering and invented mirror feedback. That could pass while production behaved differently. The correction removed that model and extracted helpers from existing production behavior.

`store.ts` now uses the shared missed-ID, penalty, and feedback helpers. `FeedbackScreen.tsx` uses the shared score and retry-transition helpers. Runtime behavior is preserved.

The left-turn checkpoint definition was also moved to the dependency-light `src/lib/missionCheckpoints.ts`. `MissionController.tsx` re-exports it for existing consumers, and the regression tests import the shared definition directly so checkpoint ID changes cannot silently leave the tests stale. The guided regression command is enforced in the existing quality job in `.github/workflows/ci.yml`.

## Regression cases

- Successful result: both existing checkpoints are cleared; expects no missed penalty and score 100.
- Missed checkpoint: only `stop-1` is cleared; expects the existing 20-point penalty. `mirror-1` produces no missed feedback because that is current production behavior.
- Retry transition: expects the existing `briefing`/`driving` transition after replay data is cleared.
- Keyboard pedal fallback: uses the same shared checkpoint/score helpers; pedal input mode does not alter scoring.

## Technical decisions

- Use Node's built-in `node:test` runner; no E2E framework or browser dependency is added.
- Extract small dependency-free helpers from production rather than maintaining a test-only copy.
- Keep runtime scoring and course definitions unchanged.

## Testability seams

`src/lib/guidedTrainingContract.ts` contains the shared missed-checkpoint, penalty, final-score, feedback, and retry-transition helpers. `src/lib/missionCheckpoints.ts` contains the shared mission checkpoint data. Both are independent of camera, Firebase, Three.js, time, and randomness.

## Verification

`npm ci`, `npm run lint`, `npm run type-check`, `npm run test:guided`, and `git diff --check` are required before PR.

## Remaining risks

The tests verify helpers imported by production, while full runtime integration still needs manual/browser validation in a later issue. The lack of missed mirror feedback is an existing behavior mismatch/follow-up candidate, not changed by Issue #31.
