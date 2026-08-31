# Camera consent and test-session data

DrivingSupport asks for consent to derived usability-test event recording before each new practice/test run. Both “Agree and continue with camera” and “Agree and continue without camera” accept this recording (`sessionConsentAccepted = true`). Camera processing is a separate choice (`cameraProcessingAllowed`). Browser camera permission is requested separately and its outcome is not assumed by consent. “Do not consent — return Home” allocates no session ID, collects no test-session events, and starts no camera processing. Guests do not need Firebase login.

## Run boundaries and export

- Selecting a lesson or tutorial from Home prepares a new run and shows consent again. Accepting creates a fresh ID and empty event history before the consent/input events are recorded.
- Guided lesson briefing -> driving -> feedback stays within one session. Retry preserves that ID/history, increments `retryCount`, and resets the current attempt's `completed` result. It does not reset consent.
- Returning Home (or otherwise leaving tutorial/driving/feedback for an unrelated screen) ends the run, appends `session_completed` once, clears the active session, and disables camera processing. An unfinished attempt records `lesson_failed` with `incomplete`. A tutorial visit is separate from the next lesson selected from Home; it does not claim a scored lesson result.
- Completion is terminal: later normal events and retries cannot append to that session. Late camera callbacks from an old session are ignored; a late acquired stream is stopped when that session is no longer permitted.
- Export in feedback serializes an active snapshot without ending the session. It has `status = active` and `endedAt = null`; Retry remains valid. After returning Home, the final summary is available through the same export button. Only the last summary is retained in memory, until the next run is selected or the page is reloaded/closed.
- Closing/reloading abruptly discards memory; it cannot guarantee a final event or export. No unload upload is attempted.

## Data boundary

The MVP processes camera input for driving-practice recognition. It does not add raw camera frames, recorded video, screenshots, MediaPipe landmark arrays/geometries, participant names, email addresses, Firebase UIDs, IP addresses, device fingerprints, or free-text notes to a test session. This document describes the product behavior implemented for the usability-test slice; it is not a legal privacy policy.

The active session and optional last summary are held in memory. There is no remote analytics upload and no localStorage session log. The explicit JSON download is a file controlled by the user/operator; the app cannot revoke that downloaded copy. Existing UI preferences and optional signed-in mission history are separate from this instrumentation.

## Session summary

Each test session receives a non-identifying random session ID from `crypto.randomUUID()` or 128 bits from `crypto.getRandomValues()`. It is not derived from an account, timestamp, or device and is not used for cross-session tracking. If secure randomness is unavailable, an actionable JA/EN error is shown and neither the session nor camera starts.

Schema version **2** replaces the ambiguous version-1 `consentAccepted` with `sessionConsentAccepted` and `cameraProcessingAllowed`. Fields: `schemaVersion`, `sessionId`, `startedAt` (epoch milliseconds), `endedAt` (epoch milliseconds or null), `status` (active/completed), the two consent/choice fields, `cameraPermissionOutcome` (unknown/granted/denied/failed), `selectedInputMode` (camera/keyboard pedals), `lessonId`, `completed` (latest attempt reached lesson success, not a passing score), `retryCount`, `failureCategories`, and `events`. A finished summary retains the camera choice as historical data; live camera permission is reset on exit. There is no persisted session migration.

Events are limited to `consent_accepted`, `camera_permission_granted`, `camera_permission_denied`, `camera_initialization_failed`, `vision_initialization_failed`, `input_mode_selected`, `lesson_started`, `lesson_completed`, `lesson_failed`, `retry_started`, and `session_completed`. Each contains `schemaVersion`, `sessionId`, `eventType`, relative nondecreasing `timestampMs`, and optional `lessonId`, `inputMode`, and bounded `failureCategory`. No raw exception messages are recorded.

`failureCategories` is the distinct union of all event categories: `camera-denied`, `camera-initialization`, `vision-initialization`, `incomplete`. Permission events with the same current outcome are suppressed (including granted on ordinary pause/resume or controller remount). A changed outcome, such as denied -> granted, is recorded; the earlier failure stays in the aggregate. Vision retry failures can remain distinct events, but their category is aggregated only once.

## Limitations

The event summary is intended to support a small external usability test, not to provide an analytics platform or prove driving-safety effectiveness. Camera behavior still depends on browser permissions, device capabilities, and MediaPipe availability. DrivingSupport remains supplementary practice and does not replace licensed instruction or real-road practice.

The camera runtime fetches MediaPipe assets from external hosts; this is not a blanket claim that the application makes no network requests. The legacy `recordedVideo`/replay URL lifecycle is outside Issue #30 and is tracked separately in [Issue #41](https://github.com/Piyoone3939/driving/issues/41). This export never includes that path's data.
