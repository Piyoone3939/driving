# Plan 0001 — Firestore Security Rules for `mission_logs`

Status: REVISED after grilling (see docs/adr/0001-firestore-rules-owner-isolation-only.md). Supersedes the earlier fully-validated draft.
Branch target: feature branch off `main` (e.g. `security/firestore-rules`), reviewed, then self-merged.

## Decisions locked (Phase 0)
- 1.A Security theme: enforce **owner isolation** for `mission_logs` (no cross-user read/write) and commit rules to version control. NOT score integrity — `score` is a private, personal, client-trusted figure (see CONTEXT.md). Scope clarified during grilling.
- 2.A Enforcement: Firestore Security Rules only (no Cloud Function, no Blaze requirement).
- 3.B Tooling: CLI-managed, committed `firestore.rules`, deployed via Firebase CLI, verified manually in the Rules Playground (no emulator test runner / Java).
- 4.A → **A (minimal)**: `read` + `create` + `delete` gated solely on owner match (`userId == request.auth.uid`). No field/type/size validation, no `hasOnly`/`hasAll`. `update` omitted (denied by default) — mission logs are never edited in place. `delete` is owner-scoped and enabled at the boundary ahead of any UI. Field validation and score integrity are **deferred** (ADR-0001); see Future work for the revisit trigger.

## Verified facts (read against code, confirmed by QA + Architecture agents)
- Collection is top-level `mission_logs`, the only collection used; created via `addDoc` — [FeedbackScreen.tsx:69](src/components/ui/FeedbackScreen.tsx#L69); read via `getDocs` query — [HistoryScreen.tsx:33](src/components/ui/HistoryScreen.tsx#L33).
- Exactly six fields are written — [FeedbackScreen.tsx:59-66](src/components/ui/FeedbackScreen.tsx#L59): `userId` (string), `timestamp` (JS number from `Date.now()`, NOT a Firestore Timestamp), `lesson` (string, a `LessonId`; longest value `railroad-crossing` = 17 chars), `score` (number, bounded 0–100 at [FeedbackScreen.tsx:51](src/components/ui/FeedbackScreen.tsx#L51)), `clearTime` (string `MM:SS`), `feedbackSummary` (Japanese string).
- Write only runs when authenticated: `if (state.user)` — [FeedbackScreen.tsx:36](src/components/ui/FeedbackScreen.tsx#L36).
- Read query filters by owner: `where("userId","==",user.uid)` ... `orderBy("timestamp","desc")` — [HistoryScreen.tsx:26-31](src/components/ui/HistoryScreen.tsx#L26).
- No `setDoc`/`updateDoc`/`deleteDoc`/`getDoc` in `src` (grep). `addHistoryItem` is a local Zustand update only — [store.ts:202-205](src/lib/store.ts#L202).
- No `firebase.json`/`.firebaserc`/`firestore.rules` exist yet (glob). `.gitignore` ignores `.env*` (line 34) but not these config files.
- Write errors are swallowed: the `catch` only `console.error`s — [FeedbackScreen.tsx:74-76](src/components/ui/FeedbackScreen.tsx#L74). Any rule mismatch therefore fails SILENTLY (the mission still completes, history just stops growing). This drives the schema-change contract below.

Type note (now moot under Rule A, retained for the deferred validation pass): `timestamp` is a plain JS number, so any future rule must test `is number`, never `is timestamp`; the latter would reject every write. The fields above are documented so the deferred validation work has a verified source of truth.

## New code to write (all new files; no app code changes needed)
1. `firebase.json` (new)
2. `firestore.rules` (new)
3. `firestore.indexes.json` (new, COMMITTED) — versions the composite index the `HistoryScreen` query depends on (see Index section below).
4. `.firebaserc` (new, COMMITTED) — holds only the public project id alias; committing it makes the deploy target reproducible and prevents deploying to the wrong project. Target project: **`driving-school-e862d`** (display name "driving-school"), confirmed in the Firebase console; billing plan is **Spark (free)** — which is why Cloud Functions are off the table and rules-only (2.A) is the only enforcement option, not just a preference. The Firebase account also contains an unrelated project `l11provestudentchosen` — `firebase use --add` lists BOTH, so the selection step is a real footgun: choosing the wrong one would deploy rules to the wrong database while the app's real DB stays unprotected. Firebase config is public by design (the whole config ships in the client bundle via `NEXT_PUBLIC_*`, [firebase.ts:5-12](src/lib/firebase.ts#L5)), so committing the project id is safe. The id must equal `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (see the env-var note in Phase A).

No changes to `FeedbackScreen.tsx` or `HistoryScreen.tsx`: the existing authenticated write (exactly the six fields) and owner-filtered read already satisfy the rules.

## Phase A — Tooling and scaffolding
- CLI strategy: **pinned `npx` in a committed `package.json` script** (no global install, no devDependency). `package.json` gains `"deploy:rules": "npx --yes firebase-tools@15.22.0 deploy --only firestore:rules"`. Parity across collaborators comes from the exact version in the committed script; nothing is added to the dependency tree, so Vercel builds are untouched (Vercel installs devDependencies at build time, which is why a `firebase-tools` devDependency was rejected). Requires Node ≥20 (already satisfied by Next 16). Upgrade = bump the version in the script.
- `firebase login` (interactive — run via the session `!` prefix). Logs in as the account that owns `driving-school-e862d`. Login state persists in the home dir, so `npx`-invoked deploys reuse it.
- `firebase use --add` → select **`driving-school-e862d`** (NOT `l11provestudentchosen`), alias it `default`. This creates `.firebaserc`; commit it.
- Add `firebase.json`:
  ```json
  {
    "firestore": {
      "rules": "firestore.rules",
      "indexes": "firestore.indexes.json"
    }
  }
  ```
- Create `firestore.rules` (Phase B) and `firestore.indexes.json` (Index section).
- Create `.env.local` (repo root, NOT committed — already covered by `.gitignore` `.env*`, line 34). FINDING (2026-06-20): there is NO local env file in the repo AND Vercel Production shows "No Environment Variables Added", so the six `NEXT_PUBLIC_FIREBASE_*` values are `undefined` both locally and in production — the deployed app currently cannot connect to Firebase (`initializeApp` gets all-`undefined` config, [firebase.ts:15](src/lib/firebase.ts#L15)). The **source of truth** for the six values is the Firebase console (Project Settings → General → "Your apps" → SDK config), NOT Vercel (which is empty). Copy them into `.env.local` for local dev; they must ALSO be added to Vercel (Production/Preview/Development) for the deployed app to work — flagged as a related fix, separate from the rules work.
- Verify: `firebase.json` is valid JSON; `.firebaserc` names `driving-school-e862d` AND that id equals `NEXT_PUBLIC_FIREBASE_PROJECT_ID` in `.env.local` (deploy target must match the app's DB).
- Environment topology: single project, no staging. `firebase deploy --only firestore:rules` (Phase E) goes straight to the live DB; there is no undo buffer. Recovery from a bad deploy is rules rollback in the Firebase console (Firestore → Rules → version history), not a frantic re-deploy.

## Phase B — Author the rules
`firestore.rules` (Rule A — owner isolation only; see ADR-0001):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // mission_logs: per-run records, one per completed run, owned by the writer.
    // Scope: owner isolation ONLY. We do NOT validate field shape, types, sizes,
    // or that `score` is genuine — `score` is private and client-trusted
    // (CONTEXT.md). The day score becomes competitive/shared/rewarded, revisit
    // this (ADR-0001): server-computed scores and/or field validation required.
    match /mission_logs/{logId} {

      // Owner-only reads (get + list). The HistoryScreen query constrains by
      // where("userId","==",user.uid), satisfying this rule (rules are not filters).
      allow read: if request.auth != null
                  && resource.data.userId == request.auth.uid;

      // Create owned by the caller. No further validation by design.
      allow create: if request.auth != null
                    && request.resource.data.userId == request.auth.uid;

      // Owner may delete own runs. Note: resource.data (existing doc), NOT
      // request.resource.data (null on delete). No client UI calls this yet.
      allow delete: if request.auth != null
                    && resource.data.userId == request.auth.uid;

      // update intentionally omitted => denied by default (a mission_log is
      // never edited in place).
    }

    // All other paths: denied by default (no match grants access).
  }
}
```
Design notes:
- This is the deliberate, grilled-down rule. The fully-validated alternative was rejected: under an owner-isolation-only threat model it adds no security (every extra clause only constrains a user's own document) while each clause is a silent-denial landmine given the swallowed write error at FeedbackScreen.tsx:74-76. ADR-0001 records the reasoning.
- Rule A can only deny a create when `userId != auth.uid`, which the client never produces (it writes `state.user.uid`). So no schema-change contract and no app-code change are needed; the Q3 observability concern is moot for this scope.

## Index — `firestore.indexes.json` (now in scope)
The `HistoryScreen` query combines an equality filter with an order-by on a *different* field — `where("userId","==",uid)` + `orderBy("timestamp","desc")` + `limit(10)` ([HistoryScreen.tsx:26-31](src/components/ui/HistoryScreen.tsx#L26)) — which Firestore cannot serve from automatic single-field indexes; it needs a **composite index** on (`userId` ASC, `timestamp` DESC). Without it the query throws `failed-precondition`, which the UI catches and renders as "データベースの設定が必要です" ([HistoryScreen.tsx:46](src/components/ui/HistoryScreen.tsx#L46)). So if this index was never created, the history feature is broken today; committing + deploying it fixes that and versions it.

Expected file content:
```json
{
  "indexes": [
    {
      "collectionGroup": "mission_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```
**Generate it, don't hand-write it.** During Phase A run `firebase firestore:indexes > firestore.indexes.json` to EXPORT whatever indexes the project already has. This does two things: (1) it answers whether the composite index was already created manually via the console (the usual "click the link in the error" flow) — if so, deploy is a no-op; (2) it prevents a deploy from prompting to DELETE any pre-existing index not captured in the file. After exporting, confirm the (`userId` ASC, `timestamp` DESC) index above is present; add it by hand only if the export lacks it.

OPEN QUESTION (decides whether the index deploy does anything): does that composite index already exist in `driving-school-e862d`? The export answers it; until then it's unknown whether history works in prod today.
Rule A is owner-isolation only, so the matrix is small. Run each case and record ALLOW/DENY:
1. Auth owner create (`userId == auth.uid`) → ALLOW
2. Unauthenticated create → DENY
3. Auth user, `userId` != `auth.uid`, create → DENY
4. Create omitting `userId` → DENY (the ownership check has nothing to match)
5. Auth owner reads own doc → ALLOW
6. Auth user reads another user's doc → DENY
7. Update existing doc → DENY
8. Owner deletes own doc → ALLOW
9. Auth user deletes another user's doc → DENY
10. Unauthenticated delete → DENY
11. Query `mission_logs` where `userId == auth.uid` → ALLOW; unconstrained list → DENY

(Field-shape cases — extra field, bad types, `score` out of range, numeric-vs-Timestamp `timestamp`, `feedbackSummary` byte length — are intentionally NOT tested here; Rule A does not inspect fields. They move to the deferred validation pass.)

## Phase D — Functional regression (real app)
- PREREQUISITE: `.env.local` exists (Phase A) with all six `NEXT_PUBLIC_FIREBASE_*` values; otherwise the local app cannot reach Firebase and this phase tests nothing.
- `npm run dev`, log in, complete a mission, confirm `saveResultToFirestore` still writes (no permission error) and `HistoryScreen` still loads.
- Because the write error is swallowed ([FeedbackScreen.tsx:74-76](src/components/ui/FeedbackScreen.tsx#L74)), do NOT rely on the UI alone: confirm the new doc appears in the Firestore console (or temporarily log the catch) so a silent denial cannot masquerade as success.
- History load exercises the composite index (Index section). If `HistoryScreen` shows "データベースの設定が必要です" (`failed-precondition`), the index has not finished building — wait for the build or check console index status, then retry. A successful history load confirms the index is live.

## Phase E — Deploy and commit
- Deploy rules: `npm run deploy:rules` (committed pinned-`npx` script; `firebase deploy --only firestore:rules`).
- Deploy the index SEPARATELY: `npx --yes firebase-tools@15.22.0 deploy --only firestore:indexes`. Index builds are async (can take minutes on a populated collection); a green deploy means "build started", not "ready". `--only` keeps rules and indexes as independent, scoped deploys so one never silently rides along with the other. (If the export showed the index already exists, this is a no-op.)
- Commit `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `.firebaserc`, and the `package.json` `deploy:rules` script to the feature branch; do not push to `main`.
- Verify before push: both deploys succeeded; Phase C cases recorded; Phase D write confirmed in console; history loads (index live).

## External sources
- Rules structure / deploy / CLI: https://firebase.google.com/docs/firestore/security/get-started
- Operations, auth, ownership, resource vs request.resource: https://firebase.google.com/docs/firestore/security/rules-conditions
- Rules are not filters: https://firebase.google.com/docs/firestore/security/rules-query
- Data validation idioms (`is`, `keys().hasAll/hasOnly`, `.size()`): https://firebase.google.com/docs/rules/data-validation , https://firebase.google.com/docs/firestore/security/rules-fields

## Open verification items (closed in Phase C, not before push)
- Phase C confirms the assembled Rule A behaves as the 9-case matrix expects.

## Deferred — the "security pass" (ADR-0001)
**Revisit trigger:** the moment `score` or `mission_logs` feeds anything **competitive, shared, or rewarded** (leaderboard, run sharing, class/completion credit), Rule A is a real hole and the items below become mandatory, not optional.
- Server-side score integrity (Cloud Function or equivalent) so `score` is no longer client-trusted.
- Field validation in the rules (the rejected Rule B is the documented starting point: exact field set, types, `score 0–100`, byte-size caps; mind `is number` not `is timestamp`).
- Surface save failures in the UI instead of swallowing them at [FeedbackScreen.tsx:74-76](src/components/ui/FeedbackScreen.tsx#L74) — required *before* re-adding field validation, since validation reintroduces silent-denial risk.

## Future work (flagged, out of scope)
- If the rules grow, migrate the Phase C matrix to `@firebase/rules-unit-testing` (Node, no Java) so cases become repeatable.
- **Production is currently down** (`auth/invalid-api-key` crash) due to missing env vars — tracked and root-caused in `docs/superpowers/plans/0002-firebase-env-config-prod-crash.md`. Fix that FIRST; Phase D cannot run until the app loads.
