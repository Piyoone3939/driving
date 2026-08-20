# Issue #30 — Camera consent and student-test session instrumentation

## Selected slice

The existing guest flow was kept: lesson/tutorial entry, explicit camera consent, camera or keyboard fallback, mission state transitions, retry, feedback, and an optional JSON summary export.

## Consent and privacy boundary

`VisionController` is not mounted until explicit consent. “Continue without camera” starts a keyboard session and does not mount MediaPipe or request `getUserMedia`. The session schema contains derived, bounded events only; it excludes raw media, landmark data, identity, account IDs, network identifiers, and free text.

## Technical decisions and testability seams

- `src/lib/testSession.ts` is the dependency-free typed session state/event seam used by production Zustand actions and pure tests.
- Session state is in memory. Export is an explicit user-visible JSON download; there is no Firebase event upload or indefinite localStorage event log.
- Camera permission and initialization outcomes are recorded at the existing `VisionController` transitions. Lesson start/completion/failure and retry are recorded at existing store/feedback transitions.
- The session ID is random and non-identifying; the production generator prefers `crypto.randomUUID()`.

## Verification

Recorded after implementation: `npm ci`, `npm run test:guided`, `npm run lint`, `npm run type-check`, and `git diff --check`.

## Remaining risks

Browser permission behavior and external MediaPipe/model availability remain environment-dependent. Existing replay support may display a separately managed video URL; the new test-session export never includes it. A future privacy review should decide whether that legacy replay path should be removed or constrained independently.
