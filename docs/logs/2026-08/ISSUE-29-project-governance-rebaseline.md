# Issue

Issue #29 — Establish DrivingSupport project governance and rebaseline MVP

## Date

2026-08-13 JST

## Objective

Create a public-safe engineering source of truth and evidence-based Month-1 MVP gap analysis without adding end-user functionality.

## Implemented

- Added contribution rules, product documents, public roadmap, process documents, templates, and work-log conventions.
- Audited current camera, MediaPipe, simulation, scoring, Firebase, i18n, CI, and deployment behavior.
- Preserved existing ADR and superpowers documents.
- Recorded KEEP dispositions for Issues #3 and #4.

## Technical Decisions

- Keep confidential commercial planning in a private project/operations repository.
- Treat existing camera, pedal, simulation, and scoring code as stabilization candidates rather than duplicate implementations.
- Keep raw video out of new scope; document current behavior honestly.

## Problems Encountered

- Local checkout initially pointed at the wrong remote and was 29 commits behind.
- Local Node version is 22 while the project requires Node >=24.
- Turbopack build inspection attempted to read a parent directory with restricted permissions and detected an unrelated parent lockfile.

## How They Were Solved

- Corrected the remote and fast-forwarded to the expected baseline SHA before editing.
- Reinstalled dependencies and recorded the runtime mismatch.
- Classified the build result as an environment/reproducibility blocker for follow-up rather than changing Next.js architecture.

## Verification Results

- `npm ci`: pass, with Node engine warning and npm audit findings.
- `npm run lint`: pass, 0 errors and 5 existing hook-dependency warnings.
- `npm run type-check`: pass.
- `npm run build`: environment failure; see PR verification.

## Metrics

Technical backlog and student-test protocol work remain the critical path for Month-1 evidence.

## What We Learned

The current application already contains substantial camera, pedal fallback, simulation, scoring, history, auth, and i18n implementation. The largest missing evidence is repeatability and student-test instrumentation, not feature count.

## Remaining Problems

Production deployment configuration, device-matrix validation, minimal consent/test records, and deterministic regression coverage need follow-up Issues.

## Related PR

Pending draft PR for Issue #29.
