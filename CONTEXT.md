# Driving — Context

A browser-based driving-practice game. Players run driving lessons, get scored, and can review their own past runs. This glossary pins down the terms used around persisted run records and their access rules.

## Language

**Mission log**:
A single persisted record of one completed run: its owner, lesson, score, clear time, a feedback summary, and a timestamp. Stored in the top-level `mission_logs` Firestore collection, one document per run, created once and never edited. Its owner may delete it; it is never mutated in place.
_Avoid_: history item, record, result (use "mission log" for the persisted document; "history" only for the user-facing list view of their own mission logs).

**Owner**:
The authenticated user a mission log belongs to, identified by `userId == auth.uid`. Ownership is the *only* access boundary the security rules enforce: a user may read and create their own mission logs and nothing else.
_Avoid_: user (reserve "owner" specifically for the access-control relationship on a mission log).

**Score**:
A 0–100 number computed on the client from penalties at the end of a run. It is a **private, personal** progress figure — not competitive or rewarded — and is therefore *trusted as supplied by the client*. The rules do not (and cannot, under the rules-only design) verify a score is genuine; they only prevent one user from altering another's.
_Avoid_: rank (the letter grade S/A/B/C/D shown in History is a display projection of score, not stored).
