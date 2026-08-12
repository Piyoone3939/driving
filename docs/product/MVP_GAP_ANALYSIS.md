# MVP gap analysis

Date: 2026-08-13
Baseline: `main@19c54cb5a87c0756587a4a809820031a5c67d535`
Scope: evidence-based technical audit; no new end-user functionality is introduced by GO-00.

## Status vocabulary

- **MVP-ready**: a usable path exists in the current code.
- **Implemented but needs stabilization**: behavior exists, but reliability or verification evidence is insufficient.
- **Partially implemented**: a meaningful slice exists but does not yet satisfy the full MVP need.
- **Missing for Month-1 MVP**: required capability has no credible current path.
- **Explicitly deferred**: intentionally outside the first test slice.
- **Legacy / candidate for removal**: obsolete, duplicated, or misleading behavior.

## Capability audit

| Capability | Status | Evidence and gap |
|---|---|---|
| Camera onboarding | Implemented but needs stabilization | `src/components/ui/TutorialScreen.tsx` explains permission and framing; `VisionController.tsx` calls `getUserMedia`. No automated camera-denied or external-tester evidence exists. |
| Calibration | Implemented but needs stabilization | `TutorialScreen.tsx` starts calibration; `footPedalRecognition.ts` and `VisionController.tsx` implement five-second stability and state transitions. Camera framing and failure recovery need manual validation. |
| Face/head tracking | Implemented but needs stabilization | `VisionController.tsx` creates `FaceLandmarker` and writes `headRotation` to `src/lib/store.ts`. Thresholds and device performance are not covered by tests. |
| Left/right safety-check recognition | Partially implemented | Head yaw is computed and used in `Car.tsx`/scoring signals, but there is no dedicated student-test acceptance scenario proving left/right recognition under ordinary conditions. |
| Hand tracking | Implemented but needs stabilization | `VisionController.tsx` creates `HandLandmarker` and draws landmarks. Camera and model loading are remote, and no automated hand landmark fixture exists. |
| Steering | MVP-ready | Two-hand and one-hand steering paths in `VisionController.tsx` update `steeringAngle`; `Car.tsx` consumes it. Needs cross-device manual acceptance. |
| Hand occlusion/crossover | Partially implemented | The current algorithm uses visible hands and cannot guarantee recovery of a hidden hand (`VisionController.tsx`, `processSteeringAndGear`). Camera guidance is the current mitigation. |
| Foot/pedal tracking | Implemented but needs stabilization | `footPedalRecognition.ts` contains calibration, smoothing, accelerator, brake, and stability logic; `VisionController.tsx` integrates it. Detection remains sensitive to framing, lighting, and clothing. |
| Keyboard pedal fallback | MVP-ready | `store.ts` persists `pedalInputMode`; `TutorialScreen.tsx` offers W/S fallback; `VisionController.tsx` avoids overwriting pedals in keyboard mode; `KeyboardControls.tsx` supplies input. |
| 3D simulation | MVP-ready | `src/components/simulation/Scene.tsx`, `Car.tsx`, `Road.tsx`, and public GLB/GLTF assets provide the playable scene. Visual realism is not the Month-1 objective. |
| Existing courses | Implemented but needs stabilization | `src/lib/course.ts`, `HomeScreen.tsx`, and `MissionController.tsx` define lessons and course checkpoints. Coverage and labels need a focused test slice. |
| Free mode | MVP-ready | `Scene.tsx` branches on `free-mode`; merged PR #15 added free mode. |
| Guided training | MVP-ready | `TutorialScreen.tsx` provides camera, steering, and pedal guidance; `ClientApp.tsx` routes the tutorial. |
| Checkpoints | Implemented but needs stabilization | `MissionController.tsx`, `RoadProps.tsx`, and `useRegisterCheckpoint.ts` register checkpoints; `store.ts` includes checkpoint-aware result calculation. Need deterministic regression tests. |
| Scoring | Implemented but needs stabilization | `store.ts` calculates mission results and `FeedbackScreen.tsx` renders score/rank. Score semantics are client-side and require test-case documentation. |
| Feedback | MVP-ready | `useDrivingFeedback.ts`, `store.ts`, `Dashboard.tsx`, and `FeedbackScreen.tsx` provide event and summary feedback. Some hook dependency warnings remain. |
| Retry flow | MVP-ready | `FeedbackScreen.tsx` resets the run and routes to driving. Needs manual verification with camera and keyboard modes. |
| History | Implemented but needs stabilization | `HistoryScreen.tsx` reads cached/store history and Firestore; `firebase.ts` enables persistence/long polling. It is unavailable in guest mode by design. |
| Authentication | Implemented but needs stabilization | `AuthScreen.tsx` supports Firebase email auth; `firebase.ts` fails soft to guest mode when configuration is missing. Production configuration and rules remain deployment concerns. |
| Firebase behavior | Implemented but needs stabilization | `src/lib/firebase.ts` is nullable/fail-soft; `FeedbackScreen.tsx` writes logs only when configured; history guards unavailable services. Configuration must be verified in the deployed environment. |
| Mobile behavior | Partially implemented | Responsive UI and browser camera API are present, but no device matrix or touch/camera performance evidence exists. |
| Performance | Implemented but needs stabilization | `Scene.tsx` constrains DPR; MediaPipe uses a video loop and remote models. The full pose model improves detection but may reduce frame rate; no measurement harness exists. |
| i18n | MVP-ready | `LanguageScreen.tsx`, `HomeScreen.tsx`, `FeedbackScreen.tsx`, `HistoryScreen.tsx`, and related components implement JA/EN selection. Some technical/debug or legacy strings may still need review. |
| Student-test analytics | Missing for Month-1 MVP | No dedicated consent, session export, completion/retry instrumentation, or operator-friendly test record exists. Firestore mission logs are not sufficient as a test protocol. |
| Test coverage | Partially implemented | Package scripts expose lint/type-check/build/smoke, and CI exists. No committed unit/e2e test files were present in this baseline despite historical PR descriptions mentioning tests. |
| CI | MVP-ready | `.github/workflows/ci.yml` runs lint/type-check and build/smoke on Ubuntu/macOS/Windows with Node 24. Branch protection is not verifiable locally. |
| Deployment readiness | Implemented but needs stabilization | `next.config.ts`, CI smoke, and Firebase fail-soft support exist. Local Node 22 violates `package.json` Node >=24; current local build also hits a parent lockfile/permission Turbopack issue. Production env/rules/deploy evidence is not in this repository. |

## Legacy Issue dispositions

### Issue #3 — foot-based accelerator/brake recognition: KEEP

Keep open as a stabilization and validation issue, not as a greenfield implementation task. The requested capability is substantially implemented in `footPedalRecognition.ts`, `VisionController.tsx`, `store.ts`, and the keyboard fallback work merged through PR #24. The remaining evidence gap is repeatability across framing, lighting, clothing, and fallback selection. Do not close until a focused acceptance test proves the current behavior or identifies a bounded rewrite.

### Issue #4 — steering hand occlusion/crossover: KEEP

Keep open as a reliability/research issue. `VisionController.tsx` calculates steering from visible hand landmarks and does not reconstruct a fully occluded hand. The current product-safe mitigation is camera placement guidance in `TutorialScreen.tsx`; a robust inference rewrite would be high risk and is not required before measuring the simplest guided slice. Close or supersede only after a test establishes the actual failure rate and an accepted mitigation.

## Month-1 gaps and critical path

1. Define a smallest guided training slice and deterministic checkpoint/scoring cases.
2. Add privacy/consent copy and a minimal external-tester session record without raw video.
3. Add manual test protocol and operator checklist for camera, keyboard fallback, retry, and history/guest behavior.
4. Verify deployment with Node 24 and production-safe Firebase configuration.
5. Run a small external test, analyze completion/retry/recognition failures, and feed only evidence-backed fixes into the next Issue.

## Explicit deferrals

Instructor dashboards, broad curriculum, commercial operations, advanced occlusion inference, raw-video recording, and visual realism beyond what supports repeatable practice are deferred.
