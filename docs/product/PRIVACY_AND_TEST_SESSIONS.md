# Camera consent and test-session data

DrivingSupport asks for explicit consent before mounting the camera/vision runtime. A guest can continue with keyboard pedals without granting camera access.

## Data boundary

The MVP processes camera input for driving-practice recognition. It does not add raw camera frames, recorded video, screenshots, MediaPipe landmark arrays/geometries, participant names, email addresses, Firebase UIDs, IP addresses, device fingerprints, or free-text notes to a test session. This document describes the product behavior implemented for the usability-test slice; it is not a legal privacy policy.

The active session is held in memory. There is no remote analytics upload and no indefinite local-storage session log. A participant or operator can explicitly export a JSON summary from the feedback screen.

## Session summary

Each test session receives a non-identifying random session ID. It is not derived from an account or device and is not used for cross-session tracking. The summary contains the schema version, session ID, start/end timestamps, consent state, bounded camera-permission outcome, selected input mode, lesson ID, completion state, retry count, bounded failure categories, and ordered derived events.

Events are limited to: consent accepted, camera permission granted/denied, camera or vision initialization failure, input mode selected, lesson started/completed/failed, retry started, and session completed. Events contain only the schema version, session ID, relative timestamp, lesson/input mode where applicable, and a bounded failure category.

## Limitations

The event summary is intended to support a small external usability test, not to provide an analytics platform or prove driving-safety effectiveness. Camera behavior still depends on browser permissions, device capabilities, and MediaPipe availability. DrivingSupport remains supplementary practice and does not replace licensed instruction or real-road practice.
