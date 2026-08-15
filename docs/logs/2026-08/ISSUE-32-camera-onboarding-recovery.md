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
- Added a direct `Use keyboard pedals` action to the camera error panel. It clears the calibration requirement, persists keyboard pedal mode, and preserves the optional tutorial continuation callback.
- Added a `Retry calibration` action while calibration is waiting and a continuation action for keyboard mode.
- Camera mode selection resets calibration state so returning from keyboard mode starts a fresh calibration attempt.
- Added explicit Camera pedal / Keyboard pedal text on the final tutorial screen.
- MediaPipe setup errors now enter the same user-facing recovery panel instead of only being logged.

## Technical decisions

- No new MediaPipe model, steering algorithm, or browser permission automation was added.
- Keyboard fallback intentionally changes only pedal authority; camera hand steering remains active when the camera/hand pipeline is available.
- Existing `KeyboardControls` remains the input implementation; the new action only makes its activation and calibration bypass explicit.

## Tests

`npm run test:guided` now covers the existing guided regression suite plus deterministic onboarding recovery checks:

- permission errors classify as denied;
- initialization errors classify as retryable errors;
- keyboard fallback clears calibration requirements and selects keyboard pedals.

## Manual verification

Automated state and UI-path checks were completed locally. Real camera permission prompts, camera hardware, and mobile-sized viewport interaction were not available in this environment, so desktop camera allow/deny and mobile layout remain manual follow-up checks.

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
