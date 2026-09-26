# ARCHIVIST LOG — Ruleswright

> Append-only history of Archivist passes across cycles. One dated entry per run. The newest
> entry's **Standing recommendations** table carries the full open backlog; the **Cleanup
> ledger** below is the single ledger for the whole program.

---

## 2025-09-25 — final pass, cycle `v1-core` (plan HEAD `53c7c91` → tree HEAD `73a8105`)

**Mode:** final (after the Final Report, commit 73a8105). First Archivist pass of this run —
planning-completeness was skipped at preflight (Archivist unavailable; recorded in the Final
Report's Interim Archivist checks table), and no interim drift checks were configured under the
default cadence, so this pass synthesized the whole record in one motion.

### Reconciled

- **`arch/v1-core.md` rewritten to the realized state** (was: 7 unreconciled session delta
  sections + 2 owner notes, in commit order rather than module order, with no realized-state
  header). Added the missing **SESSION-08/M05 section** (packaging, CI, proofs trio, docs-run,
  D20) — it existed only in STATE.md and the Final Report. Added a derived module map and a
  surfaces section, moved owner-note content into the session sections, and collapsed duplicate
  claims (the M03-barrel completion was stated twice — D16/D19 and the M03 registry line — into
  one place per document).
- **Stale claim resolved against source (Principle 2):** the S04 arch section said its restricts
  matcher was built "for S05 declare-time reuse"; `combat.ts` actually re-consults the pack index
  inline via `restrictionRejection` (actions-only at declare-time). The section now records both
  implementations and says the helpers currently have no non-test consumer. Recorded as a
  cleanup tracking item below.
- **Module registry reconciled in `PROGRAM-CONFIG.MD`** (Archivist-owned section): plan-time
  "[D] declared … no TypeScript exists yet" replaced with the realized state — [R] edges derived
  mechanically from value imports of every non-test file. Corrections: M01 key files gain
  `overrides.ts`; M02 gains the internal `index.ts` barrel + `dsl/{shared,registry}.ts`; M03
  gains `errors.ts`/`snapshots.ts`; M04 gains `theme-loader.ts`/`stage.ts`/`compose.ts`/`errors.ts`
  and loses `themes.d.ts` (D18 deleted it). Key corrections to *prose claims* found while
  deriving edges: M02 → M01 is **type-only** (no runtime value dependency — "sibling of M01"
  holds in the value graph); M03/M04 hold "never each other"; `src/index.ts` holds "dumb".
  **Conventions, Verification Commands, Git Config, Session Defaults, Custom Rules, and Author
  Sources are byte-unchanged** — verified by diff (8 insertions outside the registry are the
  header note + registry note only).
- **Cross-checked every Final Report headline against actual execution by this pass:** typecheck
  0, lint 0, build 0 (24 dist files, re-built fresh), isolation 0, security 0, suite
  **387/387** — with one count discrepancy: **vitest reports 29 test files, the Final Report
  says 28** (test count 387 matches; the file count appears to have missed one file — the
  fixture-holding suite). Recorded to Orchestrator as a report-correction owner item (STATE.md
  not edited by Archivist).
- **CA spot-checks (sampling, by source):** CA-2's `validatePack(json, dslChecker?)` +
  `deferredDslChecker` fail-closed default verified in `src/schema/validate.ts`; CA-4's
  `economy.turnSlots` + default branch verified in `src/runtime/combat/action-economy.ts` and
  both fixtures; CA-1's identity gate (kind/pack.id/schemaVersion/contentHash → E-SNAP-01,
  snapshotVersion → E-SNAP-02) verified in `src/runtime/snapshots.ts`; CA-8's trio verified to
  import only public surfaces with named unmodified engine files; D19's barrel and D20's
  `loadTheme`/`DARK_FANTASY`/`ZOMBIE_URBAN` verified in `src/runtime/index.ts` /
  `src/compiler/index.ts`; D17 verified against `zombie-urban.json` (no economy section) and the
  closed pack root; the frozen 14-id registry verified in `src/schema/error-card.ts`
  (E-SPAT-01 absent; typed `pendingId` carried in `src/runtime/combat/spatial.ts`).
- **Adoption check (first pass — no prior backlog):** role docs were read for the substance of
  this pass's new recommendations; this is the first emission of each, so nothing is marked
  adopted. `PLANNER.md`, `CODER.md`, `UI-CODER.md`, `ORCHESTRATOR.md` are byte-identical to how
  this pass found them (no writes by Archivist; no commits by anyone this pass — verified via
  `git status`).

### Crossed threshold — promoted to the program (Principle 4, minted this pass)

**Convention (Planner decomposition):** decompose final integration sessions into ≥2 sessions
(build/packaging vs proofs/docs), with facts inlined into envelopes and single-checkpoint
dispatches preferred when any dispatch has failed. Evidence axis: **three distinct
sessions/recoveries within one cycle** — S03 attempt-1 (empty-final crash), S04 attempt-1
(identical crash), and the S08 dispatch cluster (5 consecutive failures). The Final Report's
Granularity feedback already says this; the promotion means the next **Planner** inherits it as a
decomposition convention rather than a report line. The convention's home is the next
MASTER.md's planning step (minted via this log; the Final Report carries it in Granularity
feedback; the next cycle's Final Report should confirm it took).

**Not promoted (below threshold, one cycle):** `run`-tool argv hygiene, `commit_pathspec`
deleted-file handling, the empty-final recovery protocol, and barrel/surface-completeness
checking — each observed within this single cycle only. They are carried below so the counts
rise if they recur.

### Proposed for the framework (Principle 3 — no threshold; recorded first-seen)

- **Subagent runtime: tool-input fabrication under long prompts.** The model fabricates tool
  inputs on long-recovery shapes (invented paths, invented project state, fabricated git
  output): 5 consecutive S08-family dispatch failures this cycle (CQRcZ context-terminal;
  C4FM8 fabricated premise + invented paths + run-misuse; CZqwA hallucinated a nonexistent
  project; Clnue fabricated a path + run-misuse; CJFDL hallucinated a different project).
  Also: the `run` tool drops/misroutes argv (3 workers confirmed) — `{"cmd":"sh","args":["-c",
  "<line>"]}` works, whole-command-line strings ENOENT. Recommend: Orchestrator-side guardrail —
  after 2 consecutive subagent failures on one session, stop the ladder and re-slice to
  single-checkpoint dispatches with inlined facts before considering fallback execution; document
  the argv shape in the runtime contract. **cycles: 1 · in-cycle instances: 8** (5 S08-family +
  3 worker-confirmed argv cases).
- **Empty-final crash signature + working recovery.** Large single-session builds (S03, S04 —
  3-checkpoint builds over large modules) crashed on attempt 1 with the same signature:
  exhaustive checkpoint-0 read sweeps exhausting context before the first write. The recovery
  that worked both times: recovery envelopes that diagnose the failure mode explicitly, mandate
  checkpoint-scoped reading, and put a commit-then-Handoff guard in the prompt. Recommend:
  CODER.md should bound checkpoint-0 read scope for large sessions (scope reads per checkpoint,
  not per session). **cycles: 1 · in-cycle instances: 2** (S03, S04).
- **Surface/barrel completeness needs an explicit checkpoint in the LAST session's lease.**
  Two plan-level lease gaps produced owner corrections: the M03 barrel lacked S05's combat
  exports (S04's barrel predated S05; S05's lease was rows-only; OWNER-08-BARREL, 9afa86c) and
  the compiler surface lacked the theme loader for the docs proof (S08 ck3 added it itself,
  D20). Recommend: PLANNER.md — modules landing across waves should name the barrel-completion
  checkpoint in the last session's lease explicitly. **cycles: 1 · in-cycle instances: 2**
  (OWNER-08-BARREL; S08's D20 self-addition).
- **`commit_pathspec`-style single-command commits fail on deleted files** (Final Report,
  Process effectiveness item 3). Recommend: ORCHESTRATOR.md/CODER.md tooling note — deletions
  need a two-step or `git rm` path. **cycles: 1 · in-cycle instances: 1** (documented
  environment failure; worker-level instance count not separately recorded).

### Standing recommendations

| id | pattern | cycles | in-cycle instances | first seen | status |
|----|---------|-------:|-------------------:|------------|--------|
| b32fc8d0c8c92d52 | Large single-session builds exhaust context on exhaustive checkpoint-0 read sweeps (empty-final crash; recovery = checkpoint-scoped reading) | 1 | 2 | v1-core | open |
| f57dbe4d010638fe | Subagent model fabricates tool inputs (invented paths, invented project state, fabricated git output) under long-recovery prompts | 1 | 5 | v1-core | open |
| b85c8f3e113a6764 | Public surface/barrel completeness gaps discovered at integration (lease gaps across wave-spanning modules) | 1 | 2 | v1-core | open |
| c1ed872bea557b96 | run tool drops/misroutes argv; workers pass whole command lines as single argv entries | 1 | 3 | v1-core | open |
| 3658f327cc9cff2f | commit_pathspec-style single-command commits fail on deleted files | 1 | 1 | v1-core | open |

*(First pass — no prior table to carry forward; the five rows above are minted this pass with
ids computed per the stable-ID contract. All are within one cycle; none is promoted to
PROGRAM-CONFIG conventions. The crossed Principle 4 promotion is recorded above — decompose
integration sessions — and is NOT a standing row because its evidence axis (sessions within a
cycle) has already been acted on: the promotion itself.)*

### Cleanup ledger (program/Ruleswright/CLEANUP-LEDGER.md — maintained here until a separate file is warranted)

| id | candidate | evidence | confidence | blast radius | proposed check | cluster | status |
|----|-----------|----------|------------|--------------|----------------|---------|--------|
| C1 | `matchesRestriction`/`isLivePattern`/`declaredTags` (S04, `src/runtime/conditions.ts`) have no non-test consumer; combat.ts implements its own actions-only inline matcher | grep: zero src references outside conditions.ts + index.ts re-export; combat.ts restrictionRejection re-consults the pack index directly | medium | src/runtime surface (2 exported symbols) | grep after removing the re-export; conditions.test.ts pins them — decide surface-first | restricts-matcher | **tracking** (2 findings, below threshold) |
| C2 | `MAX_TABLE_DEPTH = 8` duplicated in `src/schema/validate.ts` and `src/core/tables.ts` (same value, independently chosen by S01/S02; DB ratification pending) | grep: two definitions; both tested | medium | cross-module constant | single-source (core) + re-export from schema; DB ratification first | depth-constant | **tracking** |
| C3 | `readPatch` exported from the compiler surface but consumed only by tests | grep: src refs = definition + index.ts re-export only | low | compiler surface | decide public-surface intent (FR-20 host-side composition may be the consumer story) | compiler-surface | **tracking** |
| C4 | `EventSeed`/`EventSink` exported from the runtime surface, no external consumer found | grep: definition + index.ts re-export only | low | runtime surface | same surface-first decision | runtime-surface | **tracking** |
| C5 | Final Report's test-file count says 28; `vitest run` reports 29 | this pass's `pnpm test` (29 files/387 tests) vs FINAL-REPORT.md | high | report accuracy only | re-run `pnpm test`, fix the count in the Final Report | report-accuracy | **tracking** (owner: Orchestrator) |

**No cleanup brief emitted this pass:** no cluster reached a brief threshold (≥5 medium or ≥3
high related findings). C1–C4 are tracking for the next cycle's first pass; C5 is a
report-correction owner item (not a code cleanup).

### Verification of this pass

- Every realized-state claim above traces to git (`git log`/`git show`), STATE.md, the Final
  Report, or a mechanical grep/read of `src/**` at tree HEAD `73a8105`.
- Nothing in the rewritten `arch/v1-core.md` contradicts STATE.md or the Final Report; the two
  contradictions found (S04's "S05 reuse" claim; the stale plan-time registry) were resolved
  against git/source, not recency, and are recorded above.
- `PLANNER.md`, `CODER.md`, `UI-CODER.md`, `ORCHESTRATOR.md`: byte-identical to how this pass
  found them.
- Gates re-run by this pass (observation, not inherited claim): typecheck 0 · lint 0 ·
  `pnpm test` 387/387 (29 files) · `pnpm build` 0 (24 files) · check:isolation 0 ·
  check:security 0 · loadTheme present in fresh `dist/compiler.{d.ts,js}`.