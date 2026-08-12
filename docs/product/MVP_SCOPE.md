# Month-1 MVP scope

## In scope

- Browser launch and camera permission/onboarding.
- Face/head, hand, and pose landmark processing through MediaPipe.
- Camera-based steering and head-turn signals.
- Foot/pedal calibration where tracking is usable.
- Keyboard W/S pedal fallback when foot tracking is unsuitable.
- At least one guided course with checkpoints, score, feedback, and immediate retry.
- Free mode for exploratory use.
- Guest operation when Firebase is not configured.
- Optional authentication and history when Firebase is configured.
- Basic Japanese/English language selection and switching.
- CI checks for lint, type-check, build, and smoke readiness.

## Exit evidence

- A first-time user can start without being trapped by camera or foot detection failure.
- A short guided practice run can be repeated with stable checkpoint and score behavior.
- Student-test operators can record consent, device/browser conditions, completion, retry, and qualitative feedback without storing raw video by default.

## Deferred

- Broad curriculum coverage.
- Instructor dashboard and institutional workflows.
- Production analytics platform beyond the minimum test instrumentation.
- Robust inference of fully occluded hands; camera placement guidance is the first mitigation.
- High-fidelity driving physics and additional 3D asset polish.
