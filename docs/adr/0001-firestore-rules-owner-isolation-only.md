# Firestore rules enforce owner isolation only; score integrity deferred

The `mission_logs` security rules gate `read`, `create`, and (owner-scoped) `delete` on a single condition — owner match on `userId == request.auth.uid` — and nothing else. `update` is denied by default; a mission log is never edited in place. They deliberately do **not** validate field shape, types, sizes, or that `score` is genuine. The only threat being closed is **cross-user access** (one user reading or altering another's runs). `score` is a private, personal progress figure (see [CONTEXT.md](../../CONTEXT.md)), so a user fabricating their own score harms only themselves and is accepted.

## Considered Options

We drafted and rejected a fully-validated rule (exact field set via `hasOnly`/`hasAll`, per-field type checks, `score 0–100`, byte-size caps). It buys ~no security under this threat model — every extra clause only constrains what a user writes into their *own* document — while each clause is a silent-denial landmine: writes are rejected by the rule but the client `catch` at `src/components/ui/FeedbackScreen.tsx:74-76` swallows the error, so a rule/client shape drift becomes invisible data loss. Minimal Rule A removes that fragility entirely (it can only reject when `userId != auth.uid`, which the client never produces), so it needs no app-code change and no schema-change contract.

## Consequences

- Enforcement is rules-only (no Cloud Function). Scores are trusted as supplied by the client.
- **Revisit trigger:** the moment `score` or `mission_logs` feeds anything **competitive, shared, or rewarded** (a leaderboard, run sharing, class/completion credit), these rules become a real hole and MUST be revisited — server-computed scores and/or field validation become mandatory. Deferred work (server-side scoring, surfacing save failures, field validation) is tracked in `docs/superpowers/plans/0001-mission-logs-firestore-security-rules.md`.
