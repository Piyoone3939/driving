# Product requirements: technical baseline

## User problem

Learners need a low-friction way to rehearse observation, steering, pedal, and procedural actions between lessons. Specialized simulators are not always available, while a browser and an ordinary camera are widely available.

## Primary users

- High-school and university-age driving students.
- People currently attending driving school.

Later audiences may include paper-licensed drivers and people returning to driving after a long break.

## Core loop

1. Explain camera placement and consent.
2. Check camera and body visibility.
3. Calibrate supported inputs or choose the keyboard pedal fallback.
4. Complete a short guided practice course.
5. Receive actionable feedback and a score.
6. Retry immediately and compare history when available.

## Requirements

- Camera onboarding must explain permission and framing.
- The app must fail soft when optional Firebase configuration is unavailable.
- A learner must be able to complete a practice run with camera steering and a deterministic pedal fallback.
- A guided course must have observable checkpoints, scoring, feedback, and retry.
- Public documentation must distinguish implemented behavior from planned behavior.
- Raw camera video must not be stored by new work without an explicit reviewed requirement.

## Non-goals

- Replacing an instructor or real road practice.
- Maximizing visual realism before repeatability is demonstrated.
- Publishing confidential commercial or user-research information in this repository.
