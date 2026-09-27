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

---

## 2025-09-27 — final pass, cycle `grid-combat` (feature commits `ba0b66e` → tree HEAD `c2a8fff`)

**Mode:** final, after the grid-combat Final Report (`c2a8fff`). **Scope note — this pass is a
double synthesis:** the loot-inventory cycle's final Archivist pass aborted on provider capacity
(two attempts, zero writes — recorded in that cycle's Final Report's Archivist's Note), so its
integrated arch fragments and its named record-debt (the un-synthesized **v1-shell** cycle,
`770950f`–`72346a5`) were still unabsorbed. This pass synthesized all three cycles' fragments
plus the new grid-combat deltas in one motion, and absorbed the v1-shell record-debt.

### Reconciled

- **`arch/v1-core.md` rewritten across four feature cycles** (v1-core, v1-shell, loot-inventory,
  grid-combat) into one module-ordered realized-state record at tree HEAD `c2a8fff`. The
  Orchestrator-integrated feature-qualified fragments (`<!-- loot-inventory SESSION-01 -->` …
  `<!-- grid-combat SESSION-05 -->`) were collapsed into the M01–M05 sections and the surfaces
  map; the v1-shell cycle (schema v1.2 class actions, `character-profile.ts`, the validate/
  split, `combat.sideDefeated`, docs/CI honesty, ESLint 10/Prettier packaging, coverage tooling)
  received its first record — it previously existed only as git commits, which is what the loot
  pass's aborted note flagged. Grid deltas folded in: `Pack.spatial`/`SpatialDef`/`checkSpatial`
  (M01), `evalValidity` (M02), the adapter/positions/gates/shape-resolver/snapshot-position IO
  (M03), `ThemeTemplate.spatial` + pass-through + three spatial theme declarations (M04), the
  grid journey (M05). Superseded premises updated in place: D13 (`pendingId`) and D17 (themes
  carry no spatial) are marked superseded by v1.3's additive events rather than deleted.
- **Module registry reconciled in `PROGRAM-CONFIG.MD`** to `c2a8fff`: M01 key files re-keyed to
  the `validate/` tree and `SpatialDef`; M02 gains `evalValidity`; M03 gains
  `character-profile.ts` + `inventory.ts` + the spatial integration; M04 gains the spatial
  pass-through and the three-name theme registry. Edges re-derived mechanically from value
  imports of every non-test file at `c2a8fff` (type-only excluded; `export … from` as runtime
  imports). M02→M01 remains **type-only** — re-verified.
- **Record correction resolved against git (Principle 2), not recency:** the standing record
  claimed a second M03 value-import pair `combat/triggers.ts → combat.ts`. `git show 6afbe31`
  (the file's creation commit) shows those imports were `import type` from day one, and the only
  later commit touching the file (`41a967b`) is format-only whitespace — the edge is and was
  type-only. The record now says so. The `character.ts ⇄ progression.ts` cycle is real
  (`reserveValue` vs `validateBuild/buildCharacter` value imports) and stays recorded.
- **Conventions/Verification/Custom Rules updated (Archivist-owned sections only)** — see the
  crossed-threshold section below. Verification Commands' lease-scoped-gate line corrected:
  `npx vitest run` fails in this environment (DD14e); `pnpm exec vitest run <path>` is the
  working form (loot's `node_modules/.bin/vitest run <path>` noted as the equivalent). Stack row
  updated to ESLint 10 flat config; CI row updated (lint on Node 22; format:check).
- **Verified-by-execution (fresh runs by this pass):** `pnpm typecheck` 0 · `pnpm lint` 0 ·
  `pnpm test` **564/564 across 35 files** · `pnpm build` 0 (**24 dist files**) ·
  `check:isolation` 0 · `check:security` 0 · `pnpm format:check` 0 ·
  `pnpm exec vitest run tests/proofs/` **28/28 across 5 files**. Every Final-Report headline
  matches; no count discrepancies this cycle.
- **Verified-by-source (spot-checks at `c2a8fff`):** `RULE_IDS` = 15 ids with `'E-SPAT-01'`
  last in the frozen tuple (`error-card.ts`); `pack.schema.json` `$defs/spatial` matches
  `mocks/spatial.html`'s pack.json block field-for-field (model const grid, `reach.default`
  integer ≥1, overrides as direct siblings of `default`, shapes ⊆ {single,burst}); all three
  theme JSONs declare spatial with the recorded reach keys (barrow-wight:2 / slab-brute:2 /
  hollow-wight:2); `tests/proofs/grid-journey.test.ts` exists and ran 11/11; README's **Grid
  combat** section present with exactly **4 ```ts blocks** (docs-run pin intact), a ```json
  spatial snippet, and the journey cited; README/journey/contract byte-untouched since
  `f178c0a` (`git diff f178c0a..HEAD` empty on those paths). DD14a/lease-violation record
  consistent across STATE.md (session row + DD14a + S03 receive record) and FINAL-REPORT
  §Lease violations: one ratified, self-reported, never amended.
- **Adoption check (per contract, before carrying rows forward):** `git log` on
  `program-agents/**` since the prior pass (`7dcff85`) is **empty** — no commits touch the role
  docs; `git ls-files program-agents` is empty (the directory is gitignored, so adoption can
  only be observed in working-tree content, never via commit history). Current-content checks
  for every open row's substance: current CODER.md Checkpoint 0 reads "one bounded sweep of the
  affected capability" with consolidated single-return gap reporting (row b32fc8d0's *spirit*
  partially addressed by the sweep-bounding language, but no explicit per-checkpoint read-scope
  bound exists — **kept open**); ORCHESTRATOR.md has a two-consecutive-failure Recovery/Replan
  ladder and fallback language (row f57dbe4d's guardrail substance is partially present as
  failure-ladder discipline but no tool-input-fabrication-specific guardrail or argv-shape
  documentation exists — **kept open**); no barrel/surface-completeness lease language in
  PLANNER.md (row b85c8f3e **kept open**); no `git rm`/deletion-handling tooling note (row
  3658f327 **kept open**); no argv-shape runtime-contract note (row c1ed872b **kept open**).
  No row is marked adopted; none is asserted unadopted without the file check.

### Crossed thresholds — promoted to PROGRAM-CONFIG conventions (Principle 4)

- **Pin-lease ownership** — *promoted this pass.* Evidence axis: **two program cycles with three
  in-cycle instances** (loot F-2: docs-run's README block-count pin unowned through the 3→4
  re-key; grid F-G2: registry.test.ts's 14→15 RULE_IDS pin unowned; grid F-G3: docs-run's
  block-03 pin colliding with S05's README edit). Both axes short of the bar individually, but
  the envelope asks this pass to weigh the known recurrence candidates honestly: the pattern
  spans two cycles, three instances, both caught only by preflight reviews, and a third
  occurrence is structurally likely (every future feature moves a pinned count). Promoted as a
  Planner-decomposition convention: pins that other suites in the same feature can break must
  name their re-key owner and checkpoint in the plan.
- **Factual-premise verification at planning time** — *promoted this pass.* Evidence: **two
  cycles, four in-cycle instances** (loot F-1 mock-vs-prompt reach anatomy, F-3 `microTheme`
  premise, F-4 stale cross-ref; grid F-G1 `reach.keys` anatomy contradiction — the same
  mock-vs-prompt class twice). Four instances of one defect class across two cycles; promoted
  alongside the pin-lease rule since both fire at planning time and both were caught only by
  the preflight pass.
- **Whole-repo fast gates at role-scoped receives** — *promoted this pass.* Evidence axis:
  **three distinct program cycles** — v1-core OWNER-01-LINT (`c5fbb94`, lint errors left in
  tests by an earlier land), loot-inventory FORMAT-RECONCILE (`8b802b7`, 6 files unformatted at
  close), grid-combat S01 (`0ab3622`, committed contract unformatted). Three cycles, one
  instance each — the cycle axis crossed cleanly.

### Not promoted (carried below, counts rising)

- **Provider-capacity/stream aborts killing subagents with zero commits; tree-resume recovery**
  (loot preflight attempt-1 + S01 attempt-1; grid had none) — 2 cycles.
- **Bare `npx` misresolution; `pnpm exec vitest run <path>` as the working gate form** (loot
  workers; grid DD14e) — 2 cycles, now partially mitigated by the Verification Commands
  correction above; kept as a row until the form is unremarkable in practice.
- **Final-pass provider aborts leave the next cycle a double synthesis** (loot final pass ×2
  attempts, zero writes; this pass absorbed the debt) — 2 cycles, 2 instances; the cost is real
  but no framework change is proposed yet (retry policy is Orchestrator-owned per its contract).

### Proposed for the framework (Principle 3 — carried forward, no threshold)

- **CODER.md should bound checkpoint-0 read scope for large sessions** (scope reads per
  checkpoint, not per session). v1-core: S03+S04 attempt-1 empty-final crashes (2 instances).
  Grid-combat: **0 instances** — the 5-checkpoint S03 read checkpoint-scoped and never stalled,
  and the Final Report credits the promoted reading discipline. **cycles: 2 · in-cycle
  instances: 2 (v1-core) + 0 (grid)** — not yet adopted (current CODER.md checkpoint-0 text
  checked this pass).
- **Orchestrator-side guardrail for subagent tool-input fabrication; document the `run` argv
  shape** (stop the ladder after 2 consecutive failures; `{"cmd":"sh","args":["-c", …]}` form).
  v1-core: 8 instances. Grid-combat: **0 instances** — every dispatch succeeded first time.
  **cycles: 2 · in-cycle instances: 8 (v1-core) + 0 (grid)** — not yet adopted (ORCHESTRATOR.md
  checked this pass; the two-consecutive-failure ladder exists, the fabrication-specific
  guardrail and argv documentation do not).
- **PLANNER.md: name the barrel/surface-completion checkpoint in the last session's lease.**
  v1-core: 2 instances (OWNER-08-BARREL; D20). Loot-inventory: **0 instances** — D20's lesson
  was held (S02 added `WYLDWOOD` + the third `loadTheme` case in the same lease). Grid-combat:
  **1 instance** — S03's one-line `packSpatialModel` barrel export landed outside its lease and
  was ratified (DD14a): the adapter edge's surface export had no owning checkpoint, which is
  exactly the lesson's shape. **cycles: 2 · in-cycle instances: 3** (9afa86c, D20, 0a911b2).
- **`commit_pathspec`-style single-command commits fail on deleted files** — no recurrence
  observed; carried at **cycles: 1 · instances: 1**.

### Standing recommendations

| id | pattern | cycles | in-cycle instances | first seen | status |
|----|---------|-------:|-------------------:|------------|--------|
| b32fc8d0c8c92d52 | Large single-session builds exhaust context on exhaustive checkpoint-0 read sweeps (empty-final crash; recovery = checkpoint-scoped reading) | 2 | 2 | v1-core | open |
| f57dbe4d010638fe | Subagent model fabricates tool inputs (invented paths, invented project state, fabricated git output) under long-recovery prompts | 2 | 8 | v1-core | open |
| b85c8f3e113a6764 | Public surface/barrel completeness gaps discovered at integration (lease gaps across wave-spanning modules) | 2 | 3 | v1-core | open |
| c1ed872bea557b96 | run tool drops/misroutes argv; workers pass whole command lines as single argv entries | 2 | 3 | v1-core | open |
| 3658f327cc9cff2f | commit_pathspec-style single-command commits fail on deleted files | 1 | 1 | v1-core | open |
| 1cc46f93038f1d9a | Cross-suite pinning tests (docs-run block-count pin, registry-count pin) land without a named owner in the plan | 2 | 3 | loot-inventory | **promoted** (PROGRAM-CONFIG Conventions, 2025-09-27) |
| 576a281656f83b23 | Envelope factual premises (mock-vs-prompt anatomy, cross-suite counts) reach sessions unverified; mechanical premise verification at planning time is the fix | 2 | 4 | loot-inventory | **promoted** (PROGRAM-CONFIG Conventions, 2025-09-27) |
| 854ceecd39d4b0d3 | Whole-repo fast gates (typecheck/lint/format:check) go red at role-scoped receives; cleared by format-only owner corrections | 3 | 3 | v1-core | **promoted** (PROGRAM-CONFIG Conventions, 2025-09-27) |
| 17f4803c1b08da77 | Provider stream aborts / capacity failures kill subagents mid-session with zero commits; recovery resumes from the preserved tree | 2 | 4 | loot-inventory | open |
| 6f6b491bdbe37bf0 | Bare npx misresolves in this runtime; the working gate forms are pnpm exec vitest run <path> and node_modules/.bin/vitest | 2 | 3 | loot-inventory | open |
| 1d910de11732c6c4 | Final Archivist pass aborts on provider capacity leave the next cycle's pass a double synthesis (prior cycle's integrated fragments + record-debt) | 2 | 2 | loot-inventory | open |

*(Rows 1–5 carried forward from the v1-core entry with ids verbatim; rows 6–11 minted this pass
per the stable-ID contract (`sha256(firstSeen + '\n' + normalize(pattern)).slice(0,16)`). Rows
6–8 are marked promoted at this pass; their convention text lives in PROGRAM-CONFIG Conventions.
The v1-core promotion ("decompose integration sessions") is not a row — it was acted on at its
own pass. Grid-combat's Final Report Granularity feedback (planned-debt payoffs ordered strictly
before the gate that collects them; the round-window harness note recorded as DD17e) is recorded
there and does not yet meet any threshold.)*

### Cleanup ledger (carried forward; no separate CLEANUP-LEDGER.md file yet — maintained here)

| id | candidate | evidence | confidence | blast radius | proposed check | cluster | status |
|----|-----------|----------|------------|--------------|----------------|---------|--------|
| C1 | `matchesRestriction`/`isLivePattern`/`declaredTags` (`src/runtime/conditions.ts`) have no non-test consumer; combat.ts implements its own actions-only inline matcher | re-verified at `c2a8fff`: src refs = conditions.ts + index.ts re-export only | medium | src/runtime surface (2 exported symbols) | grep after removing the re-export; conditions.test.ts pins them — decide surface-first | restricts-matcher | **tracking** |
| C2 | `MAX_TABLE_DEPTH = 8` duplicated in `src/core/tables.ts` and `src/schema/validate/helpers.ts` | re-verified at `c2a8fff` (the validate/ split moved the second definition into helpers.ts); engine-side ratification recorded in database.md v1.2 prose; both constants test-pinned | medium | cross-module constant | single-source (core) + re-export from schema | depth-constant | **tracking** |
| C3 | `readPatch` exported from the compiler surface but consumed only by tests | re-verified at `c2a8fff`: src refs = compose.ts + index.ts only | low | compiler surface | decide public-surface intent (FR-20 host-side composition may be the consumer story) | compiler-surface | **tracking** |
| C4 | `EventSeed`/`EventSink` exported from the runtime surface, no external consumer found | re-verified at `c2a8fff`: events.ts + index.ts only | low | runtime surface | same surface-first decision | runtime-surface | **tracking** |
| C5 | Final Report's test-file count said 28; vitest reported 29 | **retired:** corrected at v1-core close (commit `0290d47`, "Archivist count correction (29 collected test files)") | high | report accuracy only | — | report-accuracy | **retired** |
| C6 | `parsePackEffects` (`src/runtime/combat/resolve.ts`) has zero consumers (src and tests) — the spell-AST producer with no reader, made concrete by grid-combat's spells-not-combat-declarable finding | grep at `c2a8fff`: definition only; `declare()` resolves actions only from `pack.actions` (DD17) | high | M03 internal (not on the runtime barrel) | candidate for deletion **only if** the "spells as combat actions" engine-design event is rejected; otherwise it is that bridge's first input | spell-asts | **tracking** (resumption condition: the engine design event's outcome) |
| C7 | `WYLDWOOD` exported from the compiler surface, no consumer outside theme-loader/index | grep at `c2a8fff` | low | compiler surface | same surface-first decision as C3/C4 (the consumer story is the `loadTheme` registry) | compiler-surface | **tracking** |

**No cleanup brief emitted this pass:** no cluster reaches a brief threshold (≥5 related medium,
≥3 related high, or one high-confidence destructive with automatable verification). C6 is
high-confidence but its disposition is blocked on a recorded engine design event, not on
evidence — deleting it now would preempt a documented future decision. The surface-intent
cluster (C3/C4/C7) is three related low-confidence findings — below the medium bar.

### Verification of this pass

- Every realized-state claim traces to git (`git log`/`git show`/`git diff f178c0a..HEAD`),
  STATE.md, the Final Reports, or a mechanical grep/read of `src/**` at tree HEAD `c2a8fff`.
- Nothing in the rewritten `arch/v1-core.md` contradicts STATE.md or the Final Reports; the one
  contradiction found (the triggers→combat "value-import cycle" claim) was resolved against the
  file's creation commit and is recorded above and in arch.
- `PLANNER.md`, `CODER.md`, `UI-CODER.md`, `ORCHESTRATOR.md`: byte-identical to how this pass
  found them (no writes by Archivist; `git log` on the path is empty since the prior pass — the
  directory is gitignored, so content was also checked directly for adoption substance).
- Gates re-run by this pass (observation, not inherited claim): typecheck 0 · lint 0 ·
  `pnpm test` **564/564 (35 files)** · `pnpm build` 0 (24 files) · check:isolation 0 ·
  check:security 0 · format:check 0 · `pnpm exec vitest run tests/proofs/` 28/28.
- One in-pass anomaly, disclosed: this Archivist's own first PROGRAM-CONFIG.MD write attempt
  produced corrupted content (garbled table cells, duplicated bullets) — the same failure class
  S02 recorded in grid-combat. Caught by the post-write re-read discipline; the file was
  rewritten cleanly and verified by re-read before this log entry. No corrupted byte was
  committed.