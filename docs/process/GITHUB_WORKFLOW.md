# GitHub workflow

Every change starts with an Issue and a branch containing its Issue ID:

```text
feat/<issue>-description
fix/<issue>-description
research/<issue>-description
content/<issue>-description
bizdev/<issue>-description
docs/<issue>-description
chore/<issue>-description
```

Use conventional-style commits, for example:

```text
feat(vision): stabilize steering tracking (#31)
fix(simulation): correct checkpoint transition (#32)
docs(product): define MVP scope (#33)
research(test): define student test protocol (#34)
```

PR is required. Open a draft first, self-review, run CI, address unresolved findings, then use Squash and Merge only after project-owner GO. Auto-merge is prohibited. Codex stops before merge.
