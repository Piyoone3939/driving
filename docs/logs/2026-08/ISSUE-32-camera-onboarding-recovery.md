# Issue #32 — Camera onboarding and calibration recovery

## Date

2026-08-15 JST

## Current failure modes found

- `VisionController` calls `getUserMedia` after MediaPipe models are ready. Permission denial and other camera errors were displayed with a Retry button, but there was no direct keyboard-pedal action in the error panel.
- MediaPipe setup failures were logged to the console without a user-facing recovery state.
- Foot calibration reported missing landmarks through the debug/status text and could remain in `waiting_for_brake`; the tutorial's keyboard link was the only recovery path.
- Keyboard pedal processing already returned early in `VisionController`, while hand-based steering continued. `KeyboardControls` already provided W/S and arrow-key input.
- The tutorial did not identify the active pedal mode on its final pre-driving screen.

## Implemented recovery paths

- Added `src/lib/onboardingRecovery.ts` with dependency-free camera failure classification and keyboard fallback state helpers.
- Added a direct `Use keyboard pedals` action to the camera error panel. The panel is an interactive foreground layer; the background preview and status are pointer-transparent so tutorial navigation remains usable.
- Camera errors retry `getUserMedia`; vision setup errors retry MediaPipe model initialization through the same bounded manual setup callback. Partially-created models are closed before retry.
- Added a `Retry calibration` action while calibration is waiting and a continuation action for keyboard mode.
- Camera mode selection resets calibration state so returning from keyboard mode starts a fresh calibration attempt.
- Added explicit Camera pedal / Keyboard pedal text on the final tutorial screen.
- MediaPipe setup errors now enter the user-facing recovery panel with distinct copy and a vision-specific Retry action instead of only being logged.
- Recovery copy is selected from the app language and overlapping camera/status panels are hidden while recovery is active.
- Onboarding and driving are blocked behind a landscape gate for portrait viewports below 1024px; the gate renders no underlying training controls until landscape.
- Recovery buttons use an equal-width vertical stack that fits narrow viewports.

## Technical decisions

- No new MediaPipe model, steering algorithm, or browser permission automation was added.
- Keyboard fallback intentionally changes only pedal authority; camera hand steering remains active when the camera/hand pipeline is available.
- Existing `KeyboardControls` remains the input implementation; the new action only makes its activation and calibration bypass explicit.

## Tests

`npm run test:guided` now covers the existing guided regression suite plus deterministic onboarding recovery checks:

- permission errors classify as denied;
- initialization errors classify as retryable errors;
- vision setup failure selects the vision-setup retry path rather than camera-only retry;
- keyboard fallback clears calibration requirements and selects keyboard pedals.
- Japanese and English recovery copy routes correctly by failure kind.
- Portrait mobile/tablet dimensions require landscape while desktop and landscape dimensions remain unblocked.

## Manual verification

Automated state and UI-path checks were completed locally. Real camera permission prompts, camera hardware, and mobile-sized viewport interaction were not available in this environment, so desktop camera allow/deny and mobile layout remain manual follow-up checks.

## Manual QA checklist for preview

- Desktop camera allow → tutorial → successful calibration → Camera pedal visible → playable run.
- Desktop camera deny → visible/clickable recovery → keyboard fallback → Arrow/A-D steering and W/S pedals → playable run.
- Camera or vision initialization error → Retry runs the corresponding initialization path.
- Calibration failure → Retry calibration or keyboard fallback → final tutorial step.
- Mobile-sized viewport around 390×844 → recovery controls visible, no critical action off-screen, tutorial navigation usable.

## Verification

- `npm ci`
- `npm run test:guided`
- `npm run lint`
- `npm run type-check`
- `git diff --check`

## Remaining risks

- Browser permission UI and device-specific camera errors differ by platform.
- Full MediaPipe initialization and camera/hand tracking still need manual validation on supported desktop and mobile-sized viewports.
- Existing lint hook-dependency warnings remain outside this Issue's scope.
