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
---

## 2026-09-28 — final pass, cycle `equipment-consumables` (feature commits `0ee3974` → tree HEAD `c39ef87`)

**Mode:** final, after the equipment-consumables Final Report (`c39ef87`; last source commit
`e5e4846`). A single-cycle synthesis this time. The grid-combat pass left no record debt, so
this is not a double synthesis. **Date note:** the two previous entries are headed `2025-09-2x`,
but their commits (`7dcff85`, `c72908a`) are dated 2026-09-25 and 2026-09-27. The headings are
typos. This log is append-only, so they stay as written. PROGRAM-CONFIG's convention notes
(Archivist-owned) were corrected to 2026-09-27.

### Reconciled

- **`arch/v1-core.md`: the four Orchestrator-integrated delta sections** (`<!--
  equipment-consumables SESSION-02..05 -->`, commits `f1563b1`, `643fd76`, `7c3db75`,
  `7a479e6`) were folded into the module-ordered record. Where each piece went:
  - v1.4 contract and mirror/validator: the M01 section.
  - `heal`, registry 12→13 and `EQUIPMENT_SCALARS`: the M02 DSL section.
  - The new **M03 — Equipment** section for the `equipment.ts` leaf.
  - `profileFromCharacter` over the view and `settleItemUses`: M03 character side.
  - `Combat.use`, `maxHp`/`itemBalances`/`itemsUsed`, the R-2 clamp in `applyMutation` and `checkPackDsl` on item `use`: M03 combat.
  - `equipped`/`itemsUsed`/`maxHp`: M03 snapshots.
  - `ThemeTemplate.equipSlots`, the pass-through and the exact theme content: M04.
  - The equipment journey, the README section and the CI dist gap: M05.
  - DD-EG1..DD-EG9 are summarized under Cross-cutting decisions. The header, module map, surfaces and drift notes were updated to `c39ef87`.
  - Pass-relative wording ("this pass") left over from the grid pass was re-attributed to the grid-combat pass, so no claim is misdated.
  - The trailing provenance comment no longer nests `<!-- -->` markers. Nesting them ended the comment early, in this revision and in the previous one.
- **Record correction, checked against source (Principle 2).** The Final Report's
  *Architecture impact* and the S03 arch fragment name the new realized edges as `character`,
  `pools`, `inventory` → `equipment` and nothing else. Deriving edges mechanically from value imports at
  `c39ef87` adds **`character-profile.ts → equipment.ts`** (`equipmentView`,
  `equippedUnits`) and **`character-profile.ts → inventory.ts`** (`dropItem`). Both landed at
  S05 ck1/ck3 (`14c01dc`, `31540b0`). Neither closes a cycle: `equipment.ts` value-imports
  only core, `./errors` and `./conditions`, and `inventory.ts` does not import
  `character-profile`. Both the arch record and the registry now carry these edges. The Final
  Report is committed and not Archivist's to edit, so this goes to Orchestrator as a
  report-accuracy item (cleanup ledger C9).
- **Module registry in `PROGRAM-CONFIG.MD`** reconciled to `c39ef87`. No new module ID, no
  new cross-module edge, and no rule id this cycle. Key files gained `equipment.ts`, the v1.4
  mirror and `RESERVED_GRANT_KEYS`, `EQUIPMENT_SCALARS`, the 13-entry registry, the snapshot
  fields, and the equipSlots pass-through and theme content. Guards were re-verified:
  - M02→M01 is still **type-only** (seven `import type` lines in `core/dsl/*`, no value import);
  - M01 imports no core value;
  - `src/runtime` has no compiler import (the one match is the barrel's comment);
  - `src/compiler` has no runtime import.
- **Custom Rules (Archivist-owned) updated:**
  - Rule 1 records the v1.4 contract event.
  - Rule 2 records the `gear-*` reserved scalars (formulas only, 0 when unbound, direction set by the pack).
  - Rule 4 records that FR-9 armorCasting is slot-cast-only.
  - Author Sources' "Data source" line still reads "v1.2 class actions + v1.3 spatial" and does not mention v1.4. That section is Planner-owned, not Archivist's, so it is flagged here for the next Planner rather than edited.
- **Contract Agreements CA-EG1..EG6, sampled against source at `c39ef87`:**
  - **CA-EG1:** `checkEquipSlots` is dispatched in `validate/index.ts:72`. `checkItemSlots` and `checkItemGrants` are in `content.ts:652-688`. `Ctx` documents absent vs unreadable at `context.ts:34`.
  - **CA-EG2:** grants are summed only in `equipment.ts`, and `profileFromCharacter` imports `equipmentView`.
  - **CA-EG3:** `armorBlockingCast` is at `pools.ts:208` and gated at `:247`.
  - **CA-EG4:** registry `heal` is at `registry.ts:17`. `applyMutation`'s clamp is documented at `combat.ts:24`, and `maxHp` falls back to `profile.maxHp ?? Math.max(0, profile.hp)` at `:243`.
  - **CA-EG5:** `Combat.use` is at `combat.ts:471`, and `no-charges` compares `itemBalances` against `itemsUsed` (`:517-524`).
  - **CA-EG6:** `equippedRefusals` (`snapshots.ts:319-357`) refuses every case before anything is applied: non-array, bad entry shape, ineligible slot, duplicate slot, worn > held. Serialization is presence-preserving (`:168`).
  - **Findings:** no mismatch found. Every CA row's producer and consumer path exists as recorded.
- **Capability Readiness** (CAP-E1..E8 verified) is consistent with the record.
  - CAP-E7's journey file exists and ran green in this pass's fresh proofs run, 38/38 across 6 files, 10 of them the equipment journey.
  - STATE's *Current Blockers* and the Final Report's closure ledger agree on the three carried items: the CI build step, effect-scope shadowing, and `rollText`.
  - No stale summary found.
- **Verified by execution** (fresh runs by this pass at `c39ef87`, after a fresh `pnpm build`):
  - `pnpm typecheck` 0
  - `pnpm build` 0 (24 dist files)
  - `check:isolation` 0
  - `pnpm test` **661/661 across 37 files**
  - `pnpm exec vitest run tests/proofs/` **38/38 across 6 files**
  - lint, format:check and security were **not** re-run. They are inherited from the Orchestrator receive at `e5e4846`.
  - Every re-run headline matches the Final Report.
- **Adoption check, done before carrying rows forward.** `program-agents/` is gitignored (`.gitignore:28`), so `git log` cannot show adoption. The file mtimes of all role docs are `2026-09-25 16:37`, earlier than the grid pass's commit `c72908a` (2026-09-27), so nothing changed since the prior pass. The current content was also checked for each open row's substance:
  - **b32fc8d0:** CODER.md:47 still has only "one bounded sweep", with no per-checkpoint read-scope bound.
  - **f57dbe4d:** ORCHESTRATOR.md:405 has the two-consecutive-failure ladder, but no guardrail specific to tool-input fabrication.
  - **b85c8f3e:** PLANNER.md has no language about the barrel checkpoint.
  - **3658f327:** there is no note on deletion commits.
  - **c1ed872b:** there is no documentation of the argv shape.
  - **6f6b491b:** CODER.md:186 and ORCHESTRATOR.md:368 **still name `npx vitest run <path>` as the working narrow form**. That contradicts this program's recorded evidence (DD14e) and PROGRAM-CONFIG's Verification Commands.
  - **Result:** no row is adopted. `PLANNER.md`, `CODER.md`, `UI-CODER.md` and `ORCHESTRATOR.md` are byte-identical to how this pass found them. That is a separate claim from the adoption check above.

### Crossed thresholds (Principle 4): considered, with evidence counts

- **Factual-premise verification at planning time** (row 576a2816, promoted 2026-09-27) is **re-confirmed, and its evidence now spans three program cycles.** This is not a new promotion.
  - **Instances this cycle.** The preflight returned 15 findings (F-E1..F-E15). The following were premise defects, each disproved against source at `dadf461`:
    - F-E1 (false E-FORM-01 premise);
    - F-E2 (grant composition);
    - F-E3 (pipeline dropped `equipSlots`);
    - F-E4 (closed snapshot contract);
    - F-E7 (wrong theme facts);
    - F-E14 (`VALID_PACK` non-registry words).
    - The recheck added R-7, the wrong "only caller" note.
  - **Did the convention work?** The review ran before any dispatch, both replans landed before code, first-dispatch completion was 6/6, and integration rework was zero.
  - **Leak:** one disproved premise still reached a session. S03's prompt said `tests/runtime/fixtures/pack.ts` builds on `VALID_PACK`, which is false and had no effect (S03 surprise 5).
  - **Action:** the PROGRAM-CONFIG note was updated with the third-cycle evidence. The rule text is unchanged.
  - **Not minted:** a rule that a replan's Orchestrator decisions get a scoped recheck before dispatch. R-2 shows why it matters: REPLAN-EC-01's F-E9 clamp could lower hp, and the recheck caught it. It rests on one cycle, and ORCHESTRATOR.md:121 already requires rechecking after a correction lands, so it is noted here instead.
- **Session commit gates that hard-code a plan-time SHA (R-1).** **Not promoted: 1 cycle, 1 instance.**
  - **What happened:** S01's ck3 gate diffed against the plan-time HEAD. REPLAN-EC-01 then moved the base (`0ee3974` follows `dadf461`), and Orchestrator repaired the gate through S01's envelope.
  - **Search:** the prior cycles' prompts show no SHA-pinned gate. grid S01 used a worktree-relative `git diff --stat <path>`.
  - **Neither axis crosses**, so no rule was minted. It is recorded below under Principle 3, which has no threshold.
- **Whole-repo fast gates at role-scoped receives** (row 854ceecd, promoted): **held, with a fourth-cycle instance.**
  - S01's contracts were unformatted at a role-scoped receive.
  - Orchestrator caught it with the whole-repo gate and cleared it with the format-only residual `8668c53`, exactly as the convention prescribes.
  - Counts are raised to 4 cycles and 4 instances.
- **Pin-lease ownership** (row 1cc46f93, promoted): **held.**
  - STATE carried a full *Pin re-key owners* table, covering the registry 12→13 change (S02 ck1), `combat.test.ts:102` (S05 ck4), the combat profile equalities (S05 ck1) and the docs-run pin (S06 ck2).
  - No unowned pin surfaced.
  - The row stays promoted. Its counts are not raised, since a held rule is not a recurrence.

### Proposed for the framework (Principle 3: no threshold, recorded at first sight)

- **New: PLANNER.md / ORCHESTRATOR.md should state session gates relative to the dispatch base, never a plan-time SHA.**
  - A gate like `git diff --stat <sha> -- <owned paths>` goes stale the moment any replan or owner correction lands between planning and dispatch.
  - **Recommendation:** gates use a base Orchestrator stamps into the envelope at dispatch (the "dispatch HEAD"), or a worktree-relative form.
  - **Evidence:** R-1. **1 cycle · 1 in-cycle instance.**
- **New: document the host await idle timeout in ORCHESTRATOR.md's Native binding.**
  - The Final Report records that several `await_subagent_result` calls hit the host's 300-second idle timeout. Re-awaiting the same handle reattached cleanly every time, and nothing was lost.
  - **Recommendation:** name that as the expected recovery, so a future Orchestrator does not read the timeout as a crash and start the Recovery ladder.
  - **Evidence: 1 cycle · ≥2 in-cycle instances.** The exact count is unrecorded ("several" per the Final Report), so 2 is entered as a floor.
- **New: Final Report mechanical facts should be derived, not transcribed.**
  - This cycle, the *Architecture impact* edge list came from the handoffs and missed two value edges (C9).
  - v1-core's report miscounted test files, 28 vs 29 (C5, retired).
  - **Recommendation:** ORCHESTRATOR.md's Final Report step should derive counts and edges mechanically, or cite the command. Archivist's registry derivation remains the backstop.
  - **Evidence: 2 cycles · 2 instances.**
- **Carried: CODER.md/ORCHESTRATOR.md name `npx vitest run <path>` as the working narrow form** (row 6f6b491b).
  - This program's recorded environment evidence says the opposite: DD14e, and PROGRAM-CONFIG's corrected Verification Commands.
  - This cycle's envelopes used `pnpm exec vitest run`, and no session tripped on it, so there were 0 new instances.
  - The framework text still teaches the failing form. **Recommendation:** make the narrow form a per-program Verification Commands lookup rather than a literal in the role doc.
  - **2 cycles · 3 instances.**
- **Carried, no recurrence this cycle:**
  - b32fc8d0: checkpoint-0 read scope. S05 ran 5 checkpoints read-scoped with no stall.
  - f57dbe4d: fabrication guardrail and argv documentation. Every dispatch succeeded first time.
  - b85c8f3e: barrel checkpoint. This cycle's barrel was owned by S03 and S05 leases, and S05's `settleItemUses` export landed inside its lease.
  - c1ed872b: argv.
  - 3658f327: deletion commits.
  - 17f4803c: provider aborts.
  - 1d910de1: double synthesis.
  - The counts are unchanged. Three of these rows (b32fc8d0, f57dbe4d, c1ed872b) have now gone two consecutive cycles without recurrence. They stay **open** because none has been adopted and the evidence is not false. A human may choose to retire them.

### Standing recommendations

| id | pattern | cycles | in-cycle instances | first seen | status |
|----|---------|-------:|-------------------:|------------|--------|
| b32fc8d0c8c92d52 | Large single-session builds exhaust context on exhaustive checkpoint-0 read sweeps (empty-final crash; recovery = checkpoint-scoped reading) | 2 | 2 | v1-core | open |
| f57dbe4d010638fe | Subagent model fabricates tool inputs (invented paths, invented project state, fabricated git output) under long-recovery prompts | 2 | 8 | v1-core | open |
| b85c8f3e113a6764 | Public surface/barrel completeness gaps discovered at integration (lease gaps across wave-spanning modules) | 2 | 3 | v1-core | open |
| c1ed872bea557b96 | run tool drops/misroutes argv; workers pass whole command lines as single argv entries | 2 | 3 | v1-core | open |
| 3658f327cc9cff2f | commit_pathspec-style single-command commits fail on deleted files | 1 | 1 | v1-core | open |
| 1cc46f93038f1d9a | Cross-suite pinning tests (docs-run block-count pin, registry-count pin) land without a named owner in the plan | 2 | 3 | loot-inventory | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-27; held in equipment-consumables) |
| 576a281656f83b23 | Envelope factual premises (mock-vs-prompt anatomy, cross-suite counts) reach sessions unverified; mechanical premise verification at planning time is the fix | 3 | 11 | loot-inventory | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-27; third-cycle evidence recorded 2026-09-28) |
| 854ceecd39d4b0d3 | Whole-repo fast gates (typecheck/lint/format:check) go red at role-scoped receives; cleared by format-only owner corrections | 4 | 4 | v1-core | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-27; held — `8668c53`) |
| 17f4803c1b08da77 | Provider stream aborts / capacity failures kill subagents mid-session with zero commits; recovery resumes from the preserved tree | 2 | 4 | loot-inventory | open |
| 6f6b491bdbe37bf0 | Bare npx misresolves in this runtime; the working gate forms are pnpm exec vitest run <path> and node_modules/.bin/vitest | 2 | 3 | loot-inventory | open |
| 1d910de11732c6c4 | Final Archivist pass aborts on provider capacity leave the next cycle's pass a double synthesis (prior cycle's integrated fragments + record-debt) | 2 | 2 | loot-inventory | open |
| c172cd30e8dfc756 | Session commit gates hard-code a plan-time base SHA that a later replan makes stale | 1 | 1 | equipment-consumables | open |
| cecd211504587426 | Host await idle timeout (300 s) interrupts long subagent waits; re-awaiting the same handle reattaches with no work lost | 1 | 2 | equipment-consumables | open |
| f68c42a3f6224eb1 | Final Report mechanical facts (test-file counts, realized module edges) transcribed from handoffs rather than derived from the tree | 2 | 2 | v1-core | open |

- **Carried rows (1–11):** the ids are copied verbatim.
- **Minted this pass (12–14):** these follow the stable-ID contract, `sha256(firstSeen + '\n' + normalize(pattern)).slice(0,16)`.
  - Row 14's `first seen` is `v1-core`, because its first instance is the v1-core C5 file-count discrepancy.
  - Row 13's instance count of 2 is a floor.
- **Count changes:**
  - Row 7 went from 4 to 11 instances: the prior 4 plus F-E1, F-E2, F-E3, F-E4, F-E7, F-E14 and R-7.
  - Row 8 went from 3 cycles and 3 instances to 4 and 4.

### Cleanup ledger (carried forward; maintained here, no separate CLEANUP-LEDGER.md yet)

| id | candidate | evidence | confidence | blast radius | proposed check | cluster | status |
|----|-----------|----------|------------|--------------|----------------|---------|--------|
| C1 | `matchesRestriction`/`isLivePattern` (`src/runtime/conditions.ts`) have no non-test consumer; combat.ts implements its own actions-only inline matcher (`restrictionRejection`) | re-verified at `c39ef87`: src refs = conditions.ts + index.ts re-export only; 1 test file (`declaredTags` also names an unrelated validator Ctx field, so the grep is noisy for it) | medium | src/runtime surface | grep after removing the re-export; conditions.test.ts pins them — decide surface-first | duplicated-logic | **briefed** (2026-09-28) |
| C2 | `MAX_TABLE_DEPTH = 8` duplicated in `src/core/tables.ts` and `src/schema/validate/helpers.ts` | re-verified at `c39ef87`: both definitions present; both test-pinned; database.md prose ratifies the value | medium | cross-module constant (schema must not value-import core — the single source must respect M01's no-internal-import rule) | single-source strategy that keeps M01 import-free (e.g. schema owns it, core imports type-free literal via a pinned equality test) | duplicated-logic | **briefed** (2026-09-28) |
| C3 | `readPatch` exported from the compiler surface but consumed only by tests | re-verified at `c39ef87`: compose.ts + index.ts; 2 test files | low | compiler surface | decide public-surface intent (FR-20 host-side composition) | compiler-surface | **tracking** |
| C4 | `EventSeed`/`EventSink` exported from the runtime surface, no consumer | re-verified at `c39ef87`: events.ts + index.ts; 0 test files | low | runtime surface | same surface-first decision | runtime-surface | **tracking** |
| C5 | Final Report test-file count 28 vs 29 | corrected at v1-core close (`0290d47`) | high | report accuracy | — | report-accuracy | **retired** |
| C6 | `parsePackEffects` (`src/runtime/combat/resolve.ts`) has zero consumers | re-verified at `c39ef87`: definition only, 0 tests | high | M03 internal | delete **only if** the spells-as-combat-actions engine event is rejected | spell-asts | **tracking** (resumption condition: that engine design event's outcome) |
| C7 | `WYLDWOOD` exported from the compiler surface, consumed only via theme-loader/index | re-verified at `c39ef87`: 3 test files | low | compiler surface | same surface-first decision as C3/C4 | compiler-surface | **tracking** |
| C8 | `equipment.ts` private `rollText` duplicates `combat.ts` `displayRoll` (minus the verdict suffix) because the leaf may not import `combat.ts` (R-11) | `equipment.ts:352` vs `combat.ts:1002`; S03 surprise 1, S05/S06 followUp; Final Report closure ledger "carried" | high | M03 internal (display strings in `why.rolls`) | move `displayRoll` to a leaf (beside `core/dice` or a runtime leaf), import from both; assert byte-identical `why.rolls` strings in equipment + combat tests | duplicated-logic | **briefed** (2026-09-28) |
| C9 | Final Report *Architecture impact* omits the `character-profile.ts → {equipment, inventory}` value edges | value imports at `c39ef87` vs FINAL-REPORT §Architecture impact | high | report accuracy only | Orchestrator appends a correction (or the Archivist note carries it) | report-accuracy | **tracking** (owner: Orchestrator) |
| C10 | `Combat.use`'s restriction gate cannot block (`ItemDef` has no `tags`) | S05 surprise 2; `combat.ts` use() gate order | low | M03 combat | retain as forward-compat unless item tags are rejected as a product direction | item-tags | **tracking** (intentional; resumption: item tags decision) |

**Cleanup brief for Planner: Single-source duplicated logic (C1, C2, C8).**

- **Target area:**
  - `src/runtime/equipment.ts`, `src/runtime/combat/combat.ts` (`displayRoll`) and `src/runtime/conditions.ts` vs `combat.ts` `restrictionRejection`;
  - `src/core/tables.ts` vs `src/schema/validate/helpers.ts`.
- **Why a brief now:** this crosses the "repeated cleanup pattern already observed in the standing ledger" bar. Duplicated implementations were logged at v1-core (C1, C2), and this cycle added a third, high-confidence instance (C8) with an owner already named in the Final Report.
- **Findings:** C8 (high), C1 (medium), C2 (medium).
- **Proposed automated strategy (one session per finding, serial):**
  1. Move `displayRoll` to a runtime- or core-level leaf and import it from `combat.ts` and `equipment.ts`.
  2. Decide the restricts matcher's surface. Either `combat.ts` calls `matchesRestriction`, or the helpers leave the barrel. This is a surface decision.
  3. Single-source `MAX_TABLE_DEPTH` without giving M01 a core value import.
- **Required checks:**
  - `pnpm typecheck`, `pnpm lint`, `pnpm test` (661+) and `pnpm build` followed by `check:isolation`;
  - byte-identical `why.rolls` strings in `tests/runtime/equipment.test.ts` and `tests/runtime/combat/**`;
  - grep proving one definition per symbol;
  - M01 still imports nothing internal, verified by mechanical import derivation.
- **Risks:**
  - `displayRoll` is exported from the runtime barrel, so moving it must keep the export path.
  - The restricts helpers are public surface and pinned by `conditions.test.ts`, so removing them is a surface change, not a pure cleanup.
  - `MAX_TABLE_DEPTH` sits on the schema public surface, and the M01/M02 sibling rule forbids a naive re-export.
- **Not destructive to user data.** No human authorization is needed for C8. C1 needs a surface-intent decision from Planner.

### Verification of this pass

- **Sources.** Every realized-state claim traces to:
  - git (`git log`, `git show 0ee3974:src/runtime/character-profile.ts` for the pre-feature imports);
  - STATE.md (all 790 lines read, including the planning-completeness tables and the S01–S06 handoffs);
  - the Final Report;
  - a mechanical grep or read of `src/**` at `c39ef87`.
- **No contradictions** with STATE.md or the Final Report, apart from the one edge-list omission, which was resolved against source and is recorded above and as C9.
- **Re-read after writing:**
  - `arch/v1-core.md` has 2 `<!--` and 2 `-->`, with no nesting.
  - PROGRAM-CONFIG's diff touches only the header realized-state note, the Module Registry, the Conventions evidence note (plus the date correction) and Custom Rules 1, 2 and 4.
  - Verification Commands, Git Config, Session Defaults, Stack and Author Sources are byte-unchanged.
- **Role docs:** `PLANNER.md`, `CODER.md`, `UI-CODER.md` and `ORCHESTRATOR.md` are byte-identical to how this pass found them.

---

## 2026-09-30 — final pass, cycle `grid-movement` (feature commits `4ef88f0` → tree HEAD `6ab880a`)

**Mode:** final, after the grid-movement Final Report (`6ab880a`; last source commit `c23d563`).
Single-cycle synthesis. The equipment-consumables pass left no record debt, and this cycle's
preflight planning-completeness pass (ARCHIVIST-PREFLIGHT, F-P1..F-P12) was consumed by
REPLAN-GM-01. No interim checks ran (4 sessions, below the cadence).

### Reconciled

- **`arch/v1-core.md`: the three Orchestrator-integrated delta sections** (`<!-- grid-movement
  SESSION-02..04 -->`, commits `08a831b`, `e354139`, `c420843`) were folded into the
  module-ordered record. Where each piece went:
  - v1.5 contract (S01) and mirror/validator, `checkTerrain`, `checkMovementDsl` (S02): the M01 section.
  - `move` (registry 13→14), `EFFECT_SCALARS` + `speed`, optional `EffectApply.move`, `MoveOutcome`, `atRoot`: M02 DSL.
  - `profileFromCharacter` `speed`, `useItem` `speed`: M03 character side.
  - The move column, provoke pause/resume/forfeit, terrain refusals and **per-call offer surfacing (the `v1-core.md:163` delta, F-P1)**: M03 combat. The DD17 round-window sentence now says the return value is unchanged but offers are per call, so the two no longer read as contradictory.
  - `hexGeometry`, `neighbors`, `findPath`, `terrainAt`/`entryCost`: M03 spatial. The new `display-roll.ts` leaf has its own bullet.
  - Terrain restore, `pendingMove`, derived restore phase, restored `matchingEvent`: M03 snapshots.
  - Theme movement content: M04. Movement journey, README subsection, CI build step: M05.
  - DD-M1..DD-M19 summarized under Cross-cutting decisions. grid-combat DD1 (no move verb) and DD16 (stalemate) are marked superseded/retired, not deleted.
  - Drift notes: the movement-verb item is RESOLVED; the `rollText` duplicate and the CI build gap are CLOSED; F-M1, F-M2, R-GM-1..3, `heal` missing from `EFFECT_VOCABULARY` and the grown `evalPackFormula` parse-once debt were added.
- **Record correction, checked against source (Principle 2).** The prior drift note listed
  `snapshots.ts → {combat/resolve, combat/spatial, combat/action-economy}` as value edges. At both
  `c39ef87` and `6ab880a` those imports are `import type` (`snapshots.ts:52-54`). Snapshots' only
  combat value edge is `combat/combat`. Both the arch record and the registry were corrected. The M02 DSL line "value imports only
  `../rng`, `../dice`" was also re-derived: outside `dsl/` only `../dice` is a value import.
- **Module registry in `PROGRAM-CONFIG.MD`** reconciled to `6ab880a`, with edges derived mechanically from
  value imports (type-only clauses stripped, `export … from` counted as a runtime import):
  - No new module ID, no new cross-module edge, and no rule id. This agrees with the Final Report's *Architecture impact*.
  - New intra-M03 edges: `{combat/combat, equipment}.ts → display-roll.ts`. That leaf imports only `core/dice` types, so no cycle is formed.
  - Guards re-verified: M01 imports nothing internal; M02→M01 is type-only; `src/runtime` has no compiler import; `src/compiler` has no runtime import.
  - M03 now has 20 `.ts` files (was 19).
- **Custom Rules (Archivist-owned) updated:**
  - Rule 1 records the v1.5 contract event, including the `speed` caveat.
  - Rule 2 records `speed` as an optional reserved formula id.
  - Rule 4 notes that movement is pack data.
  - Author Sources' "Data source" line still names only v1.2/v1.3, which is now two contract events stale. That section is Planner-owned, so it is flagged again for the next Planner rather than edited.
- **Contract Agreements CA-M1..M7, sampled against source at `6ab880a`:**
  - **CA-M1:** `SpatialDef.model: 'grid' | 'hex'` and `TerrainKind` are at `pack.ts:66-74`. `hexGeometry` is at `spatial.ts:120`, and `findPath` at `:280` is bounded by the expanded box (`:289-291`).
  - **CA-M2:** `REGISTRY.move` is at `registry.ts:25` and `EFFECT_SCALARS` at `effect.ts:60`. `checkMovementDsl` is dispatched at `validate/index.ts:81`, after `checkRestrictsTags`. `useItem` binds `speed` or 0 at `equipment.ts:281`, and profiles carry `speed` only when declared (`resolve.ts:230`, `character-profile.ts:110`).
  - **CA-M4:** the facade `WeakSet` is at `combat.ts:441`. Every `surfaceOffers` call is fed a per-call list (`:600`, `:685`, `:950`, `:1005`, `:1282`).
  - **CA-M5:** the derived phase is at `snapshots.ts:590-592`, restored `matchingEvent` equals the pattern base at `:607`, and the `pendingMove.actionId` refusal is at `:743-750`.
  - **CA-M6:** the three themes carry `move:leaving-reach` (3 occurrences), and wyldwood has `"model": "hex"`.
  - **CA-M3/M7** were sampled through the journey run below.
  - **Findings:** no mismatch. Every CA row's producer and consumer exist as recorded. No required fact is missing from the inventory.
- **Capability Readiness** (CAP-M1..M7 verified) is consistent with the record. Current Blockers is empty. The carried items R-GM-1/2/3 and F-M1/F-M2 agree between STATE, the Final Report and source. No stale summary was found.
- **Final Report mechanical facts were re-derived and match:**
  - `git diff --shortstat 67f383b..b8380e1 -- src tests README.md .github` gives 34 files, +3297/−147;
  - 741 tests across 40 files; 47 proofs across 7 files.
  - No report-accuracy item this cycle.
- **Verified by execution** (fresh runs by this pass at `6ab880a`): `pnpm typecheck` 0 · `pnpm build`
  0 (24 dist files) · `check:isolation` 0 · `pnpm test` **741/741 across 40 files** ·
  `pnpm exec vitest run tests/proofs/` **47/47 across 7 files**. lint, format:check and security were
  **not** re-run. They are inherited from the Orchestrator receive at `c23d563`/`b8380e1`.
- **Adoption check, done before carrying rows forward.** `program-agents/` is gitignored (`.gitignore:28`), so `git log` cannot show adoption. Every role doc's mtime is `2026-09-25 16:37:57`, earlier than the prior pass (2026-09-28), so no human edit has landed since. Current content was checked for each open row:
  - **6f6b491b:** CODER.md:186 and ORCHESTRATOR.md:368 still name `npx vitest run <path>`.
  - **a3680390 (new):** SPEC.md:14 and AUTHOR.md:137 still say "Spec is never spawned", and AUTHOR.md says Designer is "the only Author role that is ever spawned".
  - **cecd2115:** ORCHESTRATOR.md:78 already has "Re-collect after crash: yes — re-await the id" for the Native binding. That text pre-dates the recommendation, and the prior pass did not cite it. The substance still missing is naming the host's 300 s idle timeout as an expected non-crash that must not start the Recovery ladder, so the row stays **open** with its wording narrowed.
  - **Other rows:** no substance present.
  - **Result:** no row is adopted. `PLANNER.md`, `CODER.md`, `UI-CODER.md` and `ORCHESTRATOR.md` are byte-identical to how this pass found them (sha1 recorded before and after). That is a separate claim from the adoption check above.

### Crossed thresholds (Principle 4)

- **Promoted this pass: planned Author re-entry sessions carry their authorization in the envelope** (row a3680390). This crossed the **cycles axis**, with 3 program cycles:
  - grid-combat S01, a DB re-entry, "Human-authorized 2026-09-27" in that STATE;
  - equipment-consumables S01, a DB re-entry, "builder-authorized" in the SESSION-01 Version Registry row;
  - grid-movement S01, Spec → Designer → DB, with the authorization and DD-M confirmation recorded in STATE.
  - In every case the worker proceeded on the recorded authorization. Only this cycle's worker flagged the role-document conflict.
  - **The convention records the practice that has held:** STATE records the answer, and the envelope quotes it plus the prescribed text. It does **not** resolve the role-doc wording, which goes to the framework below.
- **Held, not promoted: crash recovery from a preserved uncommitted tree** (row 17f4803c). By count it would cross, at 3 cycles and 5 instances with REPLAN-GM-01 attempt 1 added. But the carried "2 cycles" cannot be traced: the grid-combat entry calls both instances loot-inventory's, and also says "grid had none". That ambiguity is real, so the promotion is held until an entry can cite three distinct cycles.
  - This is not a deferral behind the pattern itself: nothing is blocked on it.
  - This cycle's instance added a lesson: attempt 2 re-verified the draft and corrected two pin-line ranges.
- **Re-confirmed, no new promotion:**
  - **Factual-premise verification** (row 576a2816) held for a fourth cycle. The preflight caught F-P1..F-P12 before dispatch, 4/4 sessions completed on first dispatch, and integration rework was zero. Disproved plan premises this cycle: F-P1 (arch round-window record), F-P2, F-P3, F-P5, F-P7 (line drift), plus the recovered draft's pin lines. That raises the row to 4 cycles and 17 instances.
  - **Pin-lease ownership** (row 1cc46f93) held. STATE carried a full *Pins* table with owners, and S04's staged ck0 run failed exactly the listed pins plus one explained re-registration. Counts unchanged.
  - **Whole-repo fast gates** (row 854ceecd) held. No red gate at any receive. Counts unchanged.

### Proposed for the framework (Principle 3: no threshold)

- **New: reconcile SPEC.md/AUTHOR.md "never spawned" with planned, human-authorized Author re-entry sessions** (row a3680390).
  - **The conflict:** SPEC.md:14 tells Spec to stop when handed an orchestration envelope, and AUTHOR.md:130-137 says Designer is the only Author role ever spawned. Yet three consecutive programs planned DB (and now Spec) re-entry as orchestrated sessions, each on a recorded builder authorization.
  - **Recommendation:** add an explicit "authorized re-entry session" path to AUTHOR.md/ORCHESTRATOR.md. It would name what the envelope must quote (the authorization, the classes, the prescribed text), so a worker is not forced to choose between the role doc and the plan.
  - **Evidence:** 3 cycles, 3 in-cycle instances (1 explicitly flagged, grid-movement S01 surprise 1).
- **New: ORCHESTRATOR.md STATE-update guidance should key table rows by their first-column ID** (row 3983f8eb).
  - The S01/S02 receive commits (`3d52826`, `dfab1d9`) wrote CA contract-leg notes into CAP-M1/M5/M7, because the matcher also hit the CAP table's CA-ID column. Orchestrator found it at the S03 receive and rebuilt both tables in `4ffa236`. No worker consumed the wrong rows.
  - **Recommendation:** match on the row's first cell (or table + ID), and re-read the target row after each write.
  - **Evidence:** 1 cycle · 2 in-cycle instances.
- **Carried, count raised: host await idle timeout** (row cecd2115). Several awaits hit the 300 s idle timeout again, and re-awaiting recovered each one.
  - **Recommendation (narrowed):** ORCHESTRATOR.md:78 already says re-await after a crash. Also name the idle timeout as an expected, non-crash event that does not advance the Recovery ladder or count as an attempt.
  - **Evidence:** 2 cycles · ≥4 instances (a floor; "several" per both Final Reports).
- **Carried, no recurrence this cycle:**
  - 6f6b491b (`npx`): every envelope used `pnpm exec`;
  - c172cd30 (SHA-pinned gates): no SHA-pinned gate found in SESSION-01..04;
  - f68c42a3 (derived report facts): this report's facts re-derived correctly;
  - b32fc8d0, f57dbe4d, b85c8f3e (the barrel was leased to S03), c1ed872b, 3658f327, 1d910de1.
  - Counts are unchanged. b32fc8d0, f57dbe4d and c1ed872b have now gone **three** consecutive cycles without recurrence. They stay open because they have been neither adopted nor disproved. A human may retire them.

### Standing recommendations

| id | pattern | cycles | in-cycle instances | first seen | status |
|----|---------|-------:|-------------------:|------------|--------|
| b32fc8d0c8c92d52 | Large single-session builds exhaust context on exhaustive checkpoint-0 read sweeps (empty-final crash; recovery = checkpoint-scoped reading) | 2 | 2 | v1-core | open |
| f57dbe4d010638fe | Subagent model fabricates tool inputs (invented paths, invented project state, fabricated git output) under long-recovery prompts | 2 | 8 | v1-core | open |
| b85c8f3e113a6764 | Public surface/barrel completeness gaps discovered at integration (lease gaps across wave-spanning modules) | 2 | 3 | v1-core | open |
| c1ed872bea557b96 | run tool drops/misroutes argv; workers pass whole command lines as single argv entries | 2 | 3 | v1-core | open |
| 3658f327cc9cff2f | commit_pathspec-style single-command commits fail on deleted files | 1 | 1 | v1-core | open |
| 1cc46f93038f1d9a | Cross-suite pinning tests (docs-run block-count pin, registry-count pin) land without a named owner in the plan | 2 | 3 | loot-inventory | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-27; held in equipment-consumables and grid-movement) |
| 576a281656f83b23 | Envelope factual premises (mock-vs-prompt anatomy, cross-suite counts) reach sessions unverified; mechanical premise verification at planning time is the fix | 4 | 17 | loot-inventory | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-27; fourth-cycle evidence recorded 2026-09-30) |
| 854ceecd39d4b0d3 | Whole-repo fast gates (typecheck/lint/format:check) go red at role-scoped receives; cleared by format-only owner corrections | 4 | 4 | v1-core | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-27; held in grid-movement) |
| 17f4803c1b08da77 | Provider stream aborts / capacity failures kill subagents mid-session with zero commits; recovery resumes from the preserved tree | 3 | 5 | loot-inventory | open (promotion held: carried cycle attribution ambiguous) |
| 6f6b491bdbe37bf0 | Bare npx misresolves in this runtime; the working gate forms are pnpm exec vitest run <path> and node_modules/.bin/vitest | 2 | 3 | loot-inventory | open |
| 1d910de11732c6c4 | Final Archivist pass aborts on provider capacity leave the next cycle's pass a double synthesis (prior cycle's integrated fragments + record-debt) | 2 | 2 | loot-inventory | open |
| c172cd30e8dfc756 | Session commit gates hard-code a plan-time base SHA that a later replan makes stale | 1 | 1 | equipment-consumables | open |
| cecd211504587426 | Host await idle timeout (300 s) interrupts long subagent waits; re-awaiting the same handle reattaches with no work lost | 2 | 4 | equipment-consumables | open |
| f68c42a3f6224eb1 | Final Report mechanical facts (test-file counts, realized module edges) transcribed from handoffs rather than derived from the tree | 2 | 2 | v1-core | open |
| a368039028d463d6 | Role documents say Spec/DB are never spawned, while plans dispatch orchestrated Author re-entry sessions on recorded human authorization | 3 | 3 | grid-combat | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-30); framework wording open |
| 3983f8eb6d18a5f2 | Orchestrator STATE row matcher hits a CA-ID column inside the CAP table and writes contract-leg notes into the wrong rows | 1 | 2 | grid-movement | open |

- **Carried rows (1–14):** the ids are copied verbatim.
- **Minted this pass (15–16):** `sha256(firstSeen + '\n' + normalize(pattern)).slice(0,16)`. Row 15's `first seen` is `grid-combat`, because its first instance is grid-combat's S01 DB re-entry.
- **Count changes:**
  - Row 7 went from 3 cycles and 11 instances to 4 and 17.
  - Row 9 went from 2 and 4 to 3 and 5.
  - Row 13 went from 1 and 2 to 2 and 4 (a floor).

### Cleanup ledger (carried forward; maintained here, no separate CLEANUP-LEDGER.md yet)

| id | candidate | evidence | confidence | blast radius | proposed check | cluster | status |
|----|-----------|----------|------------|--------------|----------------|---------|--------|
| C1 | `matchesRestriction`/`isLivePattern` (`src/runtime/conditions.ts`) have no non-test consumer; combat.ts implements its own actions-only inline matcher (`restrictionRejection`) | re-verified at `6ab880a`: src refs = conditions.ts + index.ts re-export only; 1 test file | medium | src/runtime surface | grep after removing the re-export; conditions.test.ts pins them — decide surface-first | duplicated-logic | **briefed** (2026-09-28) |
| C2 | `MAX_TABLE_DEPTH = 8` duplicated in `src/core/tables.ts` and `src/schema/validate/helpers.ts` | re-verified at `6ab880a`: both definitions present; 3 test files | medium | cross-module constant (M01 must stay import-free) | single-source strategy that keeps M01 import-free | duplicated-logic | **briefed** (2026-09-28) |
| C3 | `readPatch` exported from the compiler surface but consumed only by tests | re-verified at `6ab880a`: compose.ts + index.ts; 2 test files | low | compiler surface | decide public-surface intent (FR-20 host-side composition) | compiler-surface | **tracking** |
| C4 | `EventSeed`/`EventSink` exported from the runtime surface, no consumer | re-verified at `6ab880a`: events.ts + index.ts; 0 test files | low | runtime surface | same surface-first decision | runtime-surface | **tracking** |
| C5 | Final Report test-file count 28 vs 29 | corrected at v1-core close (`0290d47`) | high | report accuracy | — | report-accuracy | **retired** |
| C6 | `parsePackEffects` (`src/runtime/combat/resolve.ts`) has zero consumers | re-verified at `6ab880a`: definition only, 0 tests | high | M03 internal | delete **only if** the spells-as-combat-actions engine event is rejected | spell-asts | **tracking** (resumption condition: that engine design event's outcome) |
| C7 | `WYLDWOOD` exported from the compiler surface, consumed only via theme-loader/index | re-verified at `6ab880a`: 3 test files | low | compiler surface | same surface-first decision as C3/C4 | compiler-surface | **tracking** |
| C8 | `equipment.ts` private `rollText` duplicated `combat.ts` `displayRoll` | planned by REPLAN-GM-01 as DD-M15 and landed at grid-movement S03 ck5 `27c77f4`: `display-roll.ts` leaf, `rollText` has 0 src refs, `equipment.test.ts` 15/15 | high | M03 internal | — | duplicated-logic | **accepted** (closed by `27c77f4`) |
| C9 | equipment-consumables Final Report *Architecture impact* omitted the `character-profile.ts → {equipment, inventory}` value edges | the committed report is historical; the arch record and registry carry the corrected edges since 2026-09-28 | high | report accuracy only | — | report-accuracy | **retired** (obsolete: corrected in the living record) |
| C10 | `Combat.use`'s restriction gate cannot block (`ItemDef` has no `tags`) | S05 surprise 2 (equipment-consumables) | low | M03 combat | retain as forward-compat unless item tags are rejected as a product direction | item-tags | **tracking** (intentional; resumption: item tags decision) |
| C11 | Theme feat triggers written `condition:applied[self]` never match the `eventMatches` grammar (`[key=value]`), and `reactiveActionsFor` registers actions only, so the feat-trigger content is inert | F-M1 (STATE grid-movement); `dark-fantasy.json:179`, `zombie-urban.json:183/188`, `wyldwood.json:362/369` at `6ab880a` | medium | M04 theme content + M03 triggers (product-visible if fixed: feats would start firing) | fix grammar in content or register feat triggers, then a per-theme test that each feat trigger is offered at least once; generated-hash pins will move | inert-content | **tracking** (owner: next feature touching triggers) |
| C12 | `heal` is registry entry 13 but absent from `EFFECT_VOCABULARY` | `registry.ts:21` vs `:53-61` at `6ab880a`; S02 surprise | low | M02 DSL vocabulary (any consumer enumerating the vocabulary misses `heal`) | add `heal`, then an exact-membership test pairing `EFFECT_VOCABULARY` with the effect-kind registry entries | vocabulary-drift | **tracking** |

**Cleanup brief status.** The 2026-09-28 duplicated-logic brief (C1, C2, C8) is partly
accepted: C8 was taken into grid-movement's plan and closed. C1 (a surface decision) and C2
(single-sourcing without an M01 value import) remain **briefed** and unaccepted. The brief
carries forward unchanged apart from dropping C8. No new campaign crosses a threshold this pass:
C11 and C12 are one medium and one low finding in different clusters.

### Verification of this pass

- **Sources.** Every realized-state claim traces to:
  - git (`git log 67f383b..6ab880a`, `git show c39ef87:src/runtime/snapshots.ts` for the import correction);
  - STATE.md (all 754 lines, including the planning-completeness, Pins, CAP and CA tables and the S01–S04 handoffs);
  - the Final Report;
  - mechanical value-import derivation, greps and reads of `src/**` at `6ab880a`.
- **No contradiction** was found with STATE.md or the Final Report. One stale claim in the prior record (the snapshots edges) was resolved against source.
- **Re-read after writing:**
  - `arch/v1-core.md` has 2 `<!--` and 2 `-->`, with no nesting, and zero `grid-movement SESSION` markers.
  - PROGRAM-CONFIG's diff touches only the header realized-state note, the Module Registry, Conventions (one new rule) and Custom Rules 1, 2 and 4.
  - Verification Commands, Git Config, Session Defaults, Stack and Author Sources are byte-unchanged.
- **Role docs:** `PLANNER.md`, `CODER.md`, `UI-CODER.md` and `ORCHESTRATOR.md` are byte-identical to how this pass found them.

---

## 2026-09-30 — final pass, cycle `spells-in-combat` (feature commits `b05b06e` → tree HEAD `94d40f3`)

**Mode:** final, after the spells-in-combat Final Report (`94d40f3`; last source commit
`5cfad48`). Single-cycle synthesis. The grid-movement pass left no record debt. This cycle's
preflight (ARCHIVIST-PREFLIGHT, F-P1..F-P17) was consumed by REPLAN-SIC-01 (`b05b06e`). No
interim checks ran.

### Reconciled

- **`arch/v1-core.md`: the three Orchestrator-integrated delta sections** (`<!-- spells-in-combat
  SESSION-02 -->` `4caf973`, `<!-- … OWNER-M02-HALF -->` `ae0f480`, `<!-- … SESSION-03 -->`
  `da4665c`) were folded into the module-ordered record and the markers removed. Where each
  piece went:
  - Contract v1.6 (S01), the `SpellTargeting.range` mirror/validator (S02 ck2), and `TRIGGER_PATTERN` / `checkTrigger` (S03 ck1): the M01 section.
  - `EffectApply.varsFor` (DD-S19) and the OWNER-M02-HALF `damage(half)` no-op: M02 DSL. The old "per-target save modifiers are not executor-native" gap now reads as closed.
  - `profileFromCharacter` spells/castBlockedBy/bindings/feats, `settleSpellCasts`, and a new paragraph for the **`feats.ts` leaf**: M03 character side. The restricts-matcher paragraph now says combat calls the exported matcher.
  - The spell column (lookup, gate order, range gate, `at`, binding pick, events, `CombatantState` fields), the feat column (`source`, `resolveFeat`, the no-chain rule) and the `Combat` `offeredCount` option: M03 combat. Also `EconomyBalances.bindings`, the profile fields and `profileFor` in `resolve.ts`, and the feat grammar and offer order in `triggers.ts`.
  - Spend fields, character `feats`, the DD-S14 envelope and the restore-phase precedence: M03 snapshots. The "derived restore phase" text is replaced by the precedence, with the derivation kept as the fallback. R-GM-1/2 are marked closed.
  - Spell cost/range (47 spells: 33 + 10 + 4, counted in the themes) and the F-M1 feat-pattern re-key: M04. The F-M1 "known content gap" sentence is replaced. `coverage-floor` is now 88 tests (run by this pass).
  - The spells journey, the rules-are-data proof 2/3 legs, the docs-run anatomy guard, the README section and the close gates: M05.
  - OWNER-M02-HALF: the OWNER corrections section.
  - DD-S1..DD-S19 are summarized under Cross-cutting decisions. DD-M12 is annotated as superseded in part by DD-S14.
  - Drift notes:
    - restricts duplication is RESOLVED;
    - `parsePackEffects` is DELETED;
    - F-M1 and R-GM-1/2 are CLOSED;
    - per-target save modifiers are closed in the v1.1 list;
    - added: a spells-in-combat residuals block, plus a new `SnapshotOffer` surface note (below).
- **DD17/DD17a in-place replacements** (applied by Orchestrator at `4caf973`, per F-P12) were checked against source and kept as they are:
  - `combat.ts:580` looks up `pack.content.spells` after `pack.actions`;
  - `:961`/`:974` read `spellEffects` for `at` legality.
- **New finding, from source (Principle 2).** The arch delta and the Final Report call
  `SnapshotOffer` a "new exported type". It is exported from `snapshots.ts`, but
  `src/runtime/index.ts` does **not** re-export it. `CombatSnapshot` is re-exported, and its
  `offers?` field is typed with `SnapshotOffer`. This is type-only and is recorded as a drift note
  for the next surface revision. It is not a defect in any CAP.
- **Module registry in `PROGRAM-CONFIG.MD`** reconciled to `94d40f3`. Edges were derived mechanically:
  - Every `src/**/*.ts` file's value imports were read, with `import type` and fully-`type` clauses stripped and `export … from` counted.
  - No new module ID, cross-module edge or rule id. This agrees with the Final Report.
  - **New intra-M03 value edges**, each checked as absent at `6ab880a`:
    - `combat/combat.ts → conditions.ts`;
    - `character-profile.ts → pools.ts`;
    - `character.ts → feats.ts`.
  - None closes a cycle: `conditions.ts` and `feats.ts` value-import only `./errors`, and `pools.ts` does not import `character-profile`.
  - M03 now has 21 `.ts` files.
  - Guards re-verified: M01 imports nothing internal; M02→M01 is type-only (seven `import type` lines in `core/dsl/*`); `src/runtime` has no compiler import; `src/compiler` has no runtime import.
  - Envelope check: `src/runtime/feats.ts` is registered as the M03 leaf.
- **Custom Rules (Archivist-owned) updated:**
  - **Rule 4 (owed duty, review F-P12)** is rewritten to the v1.6 reality. Spells are combat-declarable through `declare`, and only characters cast. The armor gate is vancian-only, in combat and out. Out of combat, point-pool spells still have no cast verb. The DD17/DD17a history is kept as history.
  - Rule 1 records the v1.6 contract event and its two caveats (Version Registry row 7).
  - Author Sources' "Data source" line still names only v1.2/v1.3, now **three** contract events stale (v1.4, v1.5, v1.6). That section is Planner-owned, so it is flagged a third time for the next Planner rather than edited.
- **Contract Agreements CA-S1..CA-S9, sampled against source at `94d40f3`:**
  - **CA-S1:** spell lookup at `combat.ts:580`. The `spell:cast` → effect → `action:resolved` order is proven by the C-S02-1 test (`spells.test.ts`), whose events are exactly `['spell:cast', 'action:resolved']`.
  - **CA-S2:** `snapshots.schema.json:245-251` (`poolsSpent`, `slotsCast`). The restore arithmetic is in `snapshots.ts`.
  - **CA-S3:** `settleSpellCasts` is at `character-profile.ts:274` and emits `pool:settled` at `:355`.
  - **CA-S4:** `knownSpells` is at `pools.ts:307` and `armorBlockingCast` at `:208`. Both are value-imported by `character-profile.ts`.
  - **CA-S5:** `combat.ts:862-867` calls `matchesRestriction` for `'action'`, plus `'spell'` on a spell.
  - **CA-S6:** `reactiveFeatsFor` is at `triggers.ts:61` and consumed at `:103`. `featEffects` is read at `combat.ts:1580`.
  - **CA-S7:** the `TRIGGER_PATTERN` regex is byte-equal to the contract pattern at `pack.schema.json:155` and `:328`.
  - **CA-S8:** `SnapshotOffer` is at `snapshots.ts:461`. `phase?`/`offeredCount?`/`offers?` are at `:480-484`, the counter restore at `:668`, and the `offeredCount` refusal at `:943-945`.
  - **CA-S9:** `range` is at `pack.schema.json:368` and `artifacts.ts:55`. `out-of-range` is at `combat.ts:1017`.
  - **Findings:** no mismatch. Every producer and consumer exists as recorded, and no required fact is missing from the inventory.
  - One table-order nit: CA-S8 sits after CA-S9. It is cosmetic and left to Orchestrator.
- **Capability Readiness** (CAP-S1..S9 verified) is consistent with the record and with this pass's fresh run. *Current Blockers* agrees with the Final Report: C-S01-1 is carried, and C-S02-1 and B-S03-1 are closed. Its first row still ends "S01 is dispatchable", which is stale wording from the time of planning. That is an Orchestrator-owned cosmetic item. It is not a stale readiness claim.
- **Final Report mechanical facts, re-derived:**
  - The headline is correct: `git diff --shortstat 56476e9..94d40f3 -- . ':!program/Ruleswright/prompts'` gives **48 files, +4283/−374**, with 5 created.
  - The breakdown is not: "Engine (16)" is actually 17 (3 schema + `effect.ts` + 6 runtime + 4 combat + 3 themes), and "Tests modified: 18" is actually 16 (from `git diff --name-status`; the parts as reported sum to 49).
  - The headline numbers and every test count match: 829 tests across 44 files, 53 proofs across 8 files, spells-journey 5, rules-are-data 4.
  - Recorded as **C13** (report-accuracy, owner Orchestrator). This is the third cycle of row f68c42a3 (see Crossed thresholds).
- **Verified by execution** (fresh runs by this pass at `94d40f3`):
  - `pnpm typecheck` 0
  - `pnpm build` 0 (24 dist files)
  - `check:isolation` 0
  - `pnpm test` **829/829 across 44 files**
  - `pnpm exec vitest run tests/proofs/` **53/53 across 8 files**
  - `coverage-floor` 88/88
  - lint, format:check and security were **not** re-run. They are inherited from the Orchestrator receive at `5cfad48`.
- **Adoption check, done before carrying rows forward.** `program-agents/` is gitignored (`.gitignore:28`), so `git log` cannot show adoption. All eleven role docs have mtime `2026-09-25 16:37`, earlier than the prior pass, so no human edit has landed since. Current content was checked for each open row's substance:
  - **6f6b491b:** `CODER.md:186` and `ORCHESTRATOR.md:368` still name `npx vitest run <path>`.
  - **a3680390:** `SPEC.md:14` and `AUTHOR.md:132/137` still say "never spawned".
  - **cecd2115:** `ORCHESTRATOR.md` has no idle-timeout text (grep `idle|300`: only an unrelated "Idle slots" line).
  - **82b4e0ab (new):** `CODER.md:188/320` already cover non-hermetic gates and visible sibling files. The new row is narrowed to what is missing. No role doc mentions a worktree.
  - **Other rows:** no substance present.
  - **Result:** no row is adopted. `PLANNER.md`, `CODER.md`, `UI-CODER.md` and `ORCHESTRATOR.md` are byte-identical to how this pass found them (sha1 recorded before and after). That is a separate claim from the adoption check above.

### Crossed thresholds (Principle 4)

- **Promoted: Final Report mechanical facts are derived and cited** (row f68c42a3). This crossed the **cycles axis**, with 3 program cycles:
  - v1-core C5 (test-file count 28 vs 29);
  - equipment-consumables C9 (two value edges missing from Architecture impact);
  - spells-in-combat C13 (the Files breakdown, above).

  The rule is minted in PROGRAM-CONFIG Conventions: every count and breakdown names its command and sums to its headline.
- **Promoted: the host await idle timeout is not a crash** (row cecd2115). This crossed the **cycles axis**, with 3 program cycles: equipment-consumables, grid-movement and spells-in-combat. The Final Report says the timeout "fired repeatedly; re-awaiting the same handle always recovered it". Instances are ≥ 6, a floor, and no work was ever lost. It is minted as a program convention so the next Orchestrator inherits it. The framework recommendation for ORCHESTRATOR.md stays open beside it.
- **Widened, already promoted: pin-lease ownership** (row 1cc46f93). It leaked this cycle:
  - **What was missed:** the plan's *Pins that move* table, and the preflight that audited it, missed `tests/runtime/combat/combat.test.ts:448`. That test asserts the v1.5-derived `awaiting-declare` after a declare, which DD-S14 changes to the live `resolved`. The test sat outside every lease. S03 returned blocked at ck3, and Orchestrator issued Controlled Lease Revision 2.
  - **A second pin of the same class:** `movement.test.ts` ~l.327 was inside S03's lease but not listed.
  - **Why the rule missed them:** its text covered count/shape pins only. These are **behavior pins**, assertions of a value whose derivation a decision changes.
  - **What changed:** the convention now also requires grepping every assertion of a changed value (the Final Report's own suggestion: `deserializeCombat` + `state.phase`).
  - **Counts:** 3 cycles and 5 instances, up from 2 and 3. The cycles are loot-inventory, grid-combat and spells-in-combat.
  - This widens an existing promoted rule using its own recurrence; it is not a new one-cycle rule.
- **Re-confirmed: factual-premise verification at planning time** (row 576a2816), for a fifth cycle.
  - **Caught before dispatch:** the preflight raised 17 findings (6 blocking, 11 informational). REPLAN-SIC-01 verified all of them at `56476e9` and disproved none.
  - **Disproved plan premises:** F-P1 (`step()` passes a turn), F-P3 (fixture hexer has actions), F-P5 (inline matcher "untouched"), F-P7 (fallback number), F-P8 (catch-nobody cost), F-P10 (5 vs 4 spells), F-P11 (C11 hash-pin premise), F-P13 (citation drift).
  - **Result:** S01 and S02 completed on first dispatch.
  - **Leaks:** two disproved premises still reached sessions. S02's prescribed `reach {default: 1, hexer: 0}` cannot load (S02 surprise 1). S03 ck4 was told "new tests in combat.test.ts" (they belong in the snapshot suite). The behavior-pin miss is accounted under 1cc46f93.
  - **Counts:** 5 cycles and 26 instances (17 + 8 + 1).
- **Held:**
  - **Whole-repo fast gates** (854ceecd): no red gate at any receive; counts unchanged.
  - **Planned Author re-entry carries its authorization** (a3680390): S01's envelope quoted the authorization (SESSION-01.md:16-29) and the worker proceeded. The underlying role-doc conflict recurred, so the counts go to 4 and 4.
- **Not promoted, recorded under Principle 3:** newly reachable content (1 cycle, 1 instance) and shared-tree concurrency (1 cycle, 2 instances). Neither axis crosses.

### Proposed for the framework (Principle 3: no threshold)

- **New: PLANNER.md (pin audit) and ARCHIVIST.md (planning-completeness review) should require a behavior-pin grep** (row f4621ac1).
  - **When:** a design decision changes how an observable value is derived or which call yields it, such as restore phase, gate order, fail-closed construction or event order.
  - **What:** the plan greps every assertion of that value across `tests/` and lists each hit with an owner, in or out of a lease.
  - **Evidence:** both the Planner pin table and this program's own Archivist preflight missed `combat.test.ts:448`. grid-combat's OWNER-CP-POSITIONS was the same shape: S03's fail-closed `startCombat` made 6 tests red outside its lease.
  - **2 cycles · 3 instances.**
- **New: PLANNER.md should require a "newly reachable content" scan** (row 760b67f1).
  - **When:** a feature opens a content class to a new execution path, as spells-in-combat made spells castable.
  - **What:** run or statically scan that content through the new path before dispatch.
  - **Evidence:** the `damage(half)` hazard with no fail-branch damage was latent in the action `cold-grip` and became reachable for 12 spell sites. S02 found it by reading source after landing, which produced a stale CAP-S1 and an unplanned owner correction (OWNER-M02-HALF `623a687`).
  - **1 cycle · 1 instance** (12 sites).
- **New: ORCHESTRATOR.md should state what concurrency on disjoint leases means in a shared tree** (row 82b4e0ab).
  - **Evidence:** Orchestrator ran OWNER-M02-HALF beside the serial-plan S03 after checking that their leases were disjoint.
    - S03's uncommitted edits turned OWNER-M02-HALF's lease-scoped gate red (34/34 spells tests failed at pack load). The worker verified in a temporary `git worktree` instead.
    - S03's ck1 whole-suite count (804) included 4 of the sibling's in-flight tests.
  - **What CODER.md already covers:** :188/:320 cover the worker side (record a non-hermetic gate, ignore visible sibling files).
  - **Recommendation:** name a temporary worktree at the worker's base as the approved closest check under concurrency. Have Orchestrator note in the receive that whole-suite counts taken during a concurrent wave are not attributable to one session, and defer whole-repo verification to wave close, as was done here.
  - **1 cycle · 2 instances.**
- **Carried, count raised: host await idle timeout** (row cecd2115). This is now also a program convention. ORCHESTRATOR.md:78 says to re-await after a crash. The recommendation stays: name the idle timeout as an expected non-crash that does not advance the Recovery ladder. **3 cycles · ≥ 6 instances.**
- **Carried, count raised: Final Report facts derived, not transcribed** (row f68c42a3). Now a program convention. ORCHESTRATOR.md's Final Report step should name the commands. **3 cycles · 3 instances.**
- **Carried, count raised: SPEC.md/AUTHOR.md "never spawned"** (row a3680390). **4 cycles · 4 instances.**
- **Carried, no recurrence this cycle:**
  - 6f6b491b (`npx`): every envelope used `pnpm exec`;
  - c172cd30 (SHA-pinned gates): no SHA-pinned gate in SESSION-01..03;
  - 3983f8eb (STATE row matcher): no mis-keyed row found in this STATE;
  - 17f4803c (provider aborts): none this cycle;
  - b32fc8d0, f57dbe4d, b85c8f3e (the barrel was leased to S02 and S03), c1ed872b, 3658f327, 1d910de1.
  - Counts are unchanged. b32fc8d0, f57dbe4d and c1ed872b have now gone **four** consecutive cycles without recurrence. They stay open because they have been neither adopted nor disproved. A human may retire them.

### Standing recommendations

| id | pattern | cycles | in-cycle instances | first seen | status |
|----|---------|-------:|-------------------:|------------|--------|
| b32fc8d0c8c92d52 | Large single-session builds exhaust context on exhaustive checkpoint-0 read sweeps (empty-final crash; recovery = checkpoint-scoped reading) | 2 | 2 | v1-core | open |
| f57dbe4d010638fe | Subagent model fabricates tool inputs (invented paths, invented project state, fabricated git output) under long-recovery prompts | 2 | 8 | v1-core | open |
| b85c8f3e113a6764 | Public surface/barrel completeness gaps discovered at integration (lease gaps across wave-spanning modules) | 2 | 3 | v1-core | open |
| c1ed872bea557b96 | run tool drops/misroutes argv; workers pass whole command lines as single argv entries | 2 | 3 | v1-core | open |
| 3658f327cc9cff2f | commit_pathspec-style single-command commits fail on deleted files | 1 | 1 | v1-core | open |
| 1cc46f93038f1d9a | Cross-suite pinning tests (docs-run block-count pin, registry-count pin) land without a named owner in the plan | 3 | 5 | loot-inventory | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-27; widened to behavior pins 2026-09-30) |
| 576a281656f83b23 | Envelope factual premises (mock-vs-prompt anatomy, cross-suite counts) reach sessions unverified; mechanical premise verification at planning time is the fix | 5 | 26 | loot-inventory | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-27; fifth-cycle evidence recorded 2026-09-30) |
| 854ceecd39d4b0d3 | Whole-repo fast gates (typecheck/lint/format:check) go red at role-scoped receives; cleared by format-only owner corrections | 4 | 4 | v1-core | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-27; held in spells-in-combat) |
| 17f4803c1b08da77 | Provider stream aborts / capacity failures kill subagents mid-session with zero commits; recovery resumes from the preserved tree | 3 | 5 | loot-inventory | open (promotion held: carried cycle attribution ambiguous) |
| 6f6b491bdbe37bf0 | Bare npx misresolves in this runtime; the working gate forms are pnpm exec vitest run <path> and node_modules/.bin/vitest | 2 | 3 | loot-inventory | open |
| 1d910de11732c6c4 | Final Archivist pass aborts on provider capacity leave the next cycle's pass a double synthesis (prior cycle's integrated fragments + record-debt) | 2 | 2 | loot-inventory | open |
| c172cd30e8dfc756 | Session commit gates hard-code a plan-time base SHA that a later replan makes stale | 1 | 1 | equipment-consumables | open |
| cecd211504587426 | Host await idle timeout (300 s) interrupts long subagent waits; re-awaiting the same handle reattaches with no work lost | 3 | 6 | equipment-consumables | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-30); framework wording open |
| f68c42a3f6224eb1 | Final Report mechanical facts (test-file counts, realized module edges) transcribed from handoffs rather than derived from the tree | 3 | 3 | v1-core | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-30); framework wording open |
| a368039028d463d6 | Role documents say Spec/DB are never spawned, while plans dispatch orchestrated Author re-entry sessions on recorded human authorization | 4 | 4 | grid-combat | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-30; held in spells-in-combat); framework wording open |
| 3983f8eb6d18a5f2 | Orchestrator STATE row matcher hits a CA-ID column inside the CAP table and writes contract-leg notes into the wrong rows | 1 | 2 | grid-movement | open |
| f4621ac12fba3456 | Pin audits enumerate count/shape pins but miss behavior pins: tests asserting a value whose derivation a decision changes surface red at a quiet boundary, some outside every lease | 2 | 3 | grid-combat | open |
| 760b67f17edbd346 | A feature opens a content class to a new execution path, and latent content hazards become reachable without a planning-time scan (damage(half) with no fail-branch damage, 12 spell sites) | 1 | 1 | spells-in-combat | open |
| 82b4e0abbda105d6 | Concurrent sessions on disjoint leases share one working tree: a sibling's uncommitted edits turn another worker's gates red or inflate its whole-suite counts | 1 | 2 | spells-in-combat | open |

- **Carried rows (1–16):** the ids are copied verbatim.
- **Minted this pass (17–19):** `sha256(firstSeen + '\n' + normalize(pattern)).slice(0,16)`. Row 17's `first seen` is `grid-combat`, because its first instance is OWNER-CP-POSITIONS.
- **Count changes:**
  - Row 6 went from 2 cycles and 3 instances to 3 and 5.
  - Row 7 went from 4 and 17 to 5 and 26.
  - Row 13 went from 2 and 4 to 3 and 6 (a floor).
  - Row 14 went from 2 and 2 to 3 and 3.
  - Row 15 went from 3 and 3 to 4 and 4.
- **Status changes:** rows 13 and 14 are promoted.
- Sessions were not repeatedly blocked this cycle: one blocked return, cleared by a lease revision. The table is not empty, so the "empty while blocked" signal does not apply.

### Cleanup ledger (carried forward; maintained here, no separate CLEANUP-LEDGER.md yet)

| id | candidate | evidence | confidence | blast radius | proposed check | cluster | status |
|----|-----------|----------|------------|--------------|----------------|---------|--------|
| C1 | `isLivePattern` (`src/runtime/conditions.ts`) has no non-test consumer. *(The matcher half — combat's inline actions-only duplicate of `matchesRestriction` — was removed at spells-in-combat S02 ck1 `010d730`; combat now calls the exported matcher.)* | re-verified at `94d40f3`: `isLivePattern` src refs = conditions.ts + index.ts re-export; 1 test file | medium | src/runtime surface | decide surface-first: keep as public API, or drop the barrel export (conditions.test.ts pins it) | duplicated-logic | **briefed** (2026-09-28; narrowed — duplicate half accepted and closed by `010d730`) |
| C2 | `MAX_TABLE_DEPTH = 8` duplicated in `src/core/tables.ts` and `src/schema/validate/helpers.ts` | re-verified at `94d40f3`: both definitions present; 3 test files | medium | cross-module constant (M01 must stay import-free) | single-source strategy that keeps M01 import-free | duplicated-logic | **briefed** (2026-09-28) |
| C3 | `readPatch` exported from the compiler surface but consumed only by tests | re-verified at `94d40f3`: compose.ts + index.ts; 2 test files | low | compiler surface | decide public-surface intent (FR-20 host-side composition) | compiler-surface | **tracking** |
| C4 | `EventSeed`/`EventSink` exported from the runtime surface, no consumer | re-verified at `94d40f3`: events.ts + index.ts; 0 test files | low | runtime surface | same surface-first decision | runtime-surface | **tracking** |
| C5 | Final Report test-file count 28 vs 29 | corrected at v1-core close (`0290d47`) | high | report accuracy | — | report-accuracy | **retired** |
| C6 | `parsePackEffects` (`src/runtime/combat/resolve.ts`) had zero consumers | deleted at spells-in-combat S02 ck1 `010d730` (DD-S15); 0 refs in `src/`/`tests/` at `94d40f3` | high | M03 internal | — | spell-asts | **accepted** (closed by `010d730`) |
| C7 | `WYLDWOOD` exported from the compiler surface, consumed only via theme-loader/index | re-verified at `94d40f3`: 3 test files | low | compiler surface | same surface-first decision as C3/C4 | compiler-surface | **tracking** |
| C8 | `equipment.ts` private `rollText` duplicated `combat.ts` `displayRoll` | closed at grid-movement S03 ck5 `27c77f4` | high | M03 internal | — | duplicated-logic | **accepted** (closed by `27c77f4`) |
| C9 | equipment-consumables Final Report *Architecture impact* omitted two value edges | corrected in the living record since 2026-09-28 | high | report accuracy only | — | report-accuracy | **retired** |
| C10 | `Combat.use`'s restriction gate cannot block (`ItemDef` has no `tags`) | S05 surprise 2 (equipment-consumables) | low | M03 combat | retain as forward-compat unless item tags are rejected as a product direction | item-tags | **tracking** (intentional; resumption: item tags decision) |
| C11 | Theme feat triggers `condition:applied[self]` never matched and feats were never registered | closed at spells-in-combat S03 ck1 `d9a6d71` (patterns + load-time grammar) and ck3 `8d04c5e` (feat offers); the "hash pins will move" premise was disproved (F-P11) | medium | — | — | inert-content | **accepted** (closed by `d9a6d71`/`8d04c5e`) |
| C12 | `heal` is registry entry 13 but absent from `EFFECT_VOCABULARY` | `registry.ts:53-61` at `94d40f3` (vocabulary: attack, save, damage, applyCondition, target, sequence, move) | low | M02 DSL vocabulary | add `heal`, then an exact-membership test pairing `EFFECT_VOCABULARY` with the effect-kind registry entries | vocabulary-drift | **tracking** |
| C13 | spells-in-combat Final Report *Files* breakdown: "Engine (16)" and "Tests modified: 18" vs 17 and 16 by `git diff --name-status 56476e9..94d40f3` (parts sum to 49 against a correct headline of 48) | this pass's derivation | high | report accuracy only | Orchestrator appends a correction (this note carries it) | report-accuracy | **tracking** (owner: Orchestrator) |

**Cleanup brief status.** The 2026-09-28 duplicated-logic brief is now down to C1 (narrowed to
the `isLivePattern` surface decision) and C2. C8 and C1's duplicate half were accepted and closed by
feature work, so the brief carries forward without them. C6 and C11 were closed by this
feature's plan, which took them in as inherited findings. No new campaign crosses a threshold:
C13 is a single report-accuracy item, and the new `SnapshotOffer` surface gap is an addition
rather than a cleanup.

### Verification of this pass

- **Sources.** Every realized-state claim traces to:
  - git (`git log 56476e9..94d40f3`, `git diff --name-status`, `git show 6ab880a:` for the pre-feature imports of `character-profile.ts` and `combat.ts`);
  - STATE.md (all 1275 lines, including Inherited findings, DD-S1..S19, the Pins table, CAP/CA tables, the planning-completeness table and all four handoffs);
  - the Final Report;
  - a mechanical value-import derivation over `src/**`, plus greps and reads at `94d40f3`.
- **No contradiction** with STATE.md or the Final Report, apart from C13 and the `SnapshotOffer` barrel wording, both recorded above.
- **Re-read after writing:**
  - `arch/v1-core.md` has 2 `<!--` and 2 `-->`, with no nesting, and zero `spells-in-combat SESSION`/`OWNER-M02-HALF delta` markers.
  - No surviving claim says spells are not combat-declarable, that F-M1 or R-GM-1/2 are open, or that `parsePackEffects` exists.
  - PROGRAM-CONFIG's diff touches only the header realized-state note, the Module Registry, Conventions (one widened, two minted, one evidence note) and Custom Rules 1 and 4.
  - Verification Commands, Git Config, Session Defaults, Stack and Author Sources are byte-unchanged.
- **Role docs:** `PLANNER.md`, `CODER.md`, `UI-CODER.md` and `ORCHESTRATOR.md` are byte-identical to how this pass found them.

---

## 2026-10-01 — final pass, cycle `action-targeting` (feature commits `82832c0` → tree HEAD `535247d`)

**Mode:** final, after the action-targeting Final Report (`535247d`; last source commit
`3cce108`). Single-cycle synthesis. The spells-in-combat pass left no record debt; its C13 report
correction landed at `0b5787e`. This cycle's preflight planning-completeness pass (handle h-j20l,
F-A1..F-A10, no blocking finding) was routed through envelopes and STATE edits (`a1d0174`). No
interim checks ran (3 sessions, final-only cadence).

### Reconciled

- **`arch/v1-core.md`: the two Orchestrator-integrated delta sections** (`<!-- action-targeting
  SESSION-02 -->` `a84dd52`, `<!-- action-targeting SESSION-03 -->` `42a1fd3`) were folded into the
  module-ordered record and the markers removed. Where each piece went:
  - Contract v1.7 (S01 `64dc746`/`f622431`) and `NON_FORMULA_ARGS.ability = [0]` (S03 ck1): the M01 section. The grid-movement paragraph's `NON_FORMULA_ARGS` listing now notes the v1.7 entry.
  - `ability(name)` check/eval (`allowAbility`, `checkAbilityCall`, fail-closed `evalCall`), `checkEffect` as the sole setter, registry 14 → 15, `heal` in an exact `EFFECT_VOCABULARY`, `FORMULA_VOCABULARY` + `ability`: M02 DSL.
  - The `self` shape, `isSelfAction`, self-action binding in `declare`/`resolveReactive`, `selfTargetRefusal`, `resolveReactiveAgainst`, and the self-action gate order: M03 combat. The `effectVars` `ability:<n>` binding goes to `resolve.ts`, and the `useItem` binding to the equipment section.
  - The 10 self-wrapped actions, the spell-list fix and the med-kit line: M04. The "heals 2, carried content-semantics question" text is now history.
  - The self-target journey, the equipment-journey re-key with its discriminating assertion, the README edits and the close gates: M05.
  - DD-A1..DD-A9 are summarized under Cross-cutting decisions, including F-A2 (self actions offer the actor's own `[target=self]` feats).
  - Drift notes:
    - **closed:** `heal` vocabulary (C12), self-buff actions, zombie-urban/hedge-mage spell lists, and the effect-scope shadowing *content* question (the rule itself is kept by design);
    - **added:** an action-targeting residuals block (mending spells, the root-only limitation, the stale test comment, restricts symmetry).
  - The header and the guards line now point at `535247d`.
- **Module registry in `PROGRAM-CONFIG.MD`** reconciled to `535247d`:
  - **Edges.** `git diff 0b5787e..535247d -- src` adds or removes no `import` or `export … from` line. The value-import graph is therefore byte-identical to the one derived mechanically at `94d40f3`.
  - **Agreement with the Final Report.** No new module ID, no cross-module edge and no rule id, as the report says.
  - **File counts.** M03 is still 21 `.ts` files, and M02 is still 9.
  - **Guards re-verified.** M01 imports nothing internal, and M02→M01 is type-only.
  - **Surface.** `isSelfAction` is an intra-runtime export and is absent from `src/runtime/index.ts`. This agrees with the S02 delta.
  - **Key-file columns.** M01 through M04 now carry the v1.7 additions.
- **Custom Rules (Archivist-owned) updated:**
  - Rule 1 records the v1.7 contract event and caveat (c).
  - Rule 2 records `ability(name)` and that bare-name precedence is unchanged.
  - Rule 4 notes that self actions are pack data.
  - Author Sources' "Data source" line still names only v1.2/v1.3, now **four** contract events stale (v1.4–v1.7). That section is Planner-owned, so it is flagged a fourth time rather than edited.
- **Contract Agreements CA-A1..CA-A4, sampled against source at `535247d`:**
  - **CA-A1:** `combat.ts:1287` `if (shape === 'self') return [actor.id]` sits before the `!geometry.enabled` early return at :1289.
  - **CA-A2:** `declare` computes `selfAction` only when `spell === undefined` (:627). The refusal comes after the restriction gate (:612) and the `at` refusal (:619), and before the validity gate. `resolveReactive` applies the same refusal and binding (:1545-1549). `selfTargetRefusal` (:1776) accepts `undefined` and the actor's own id. `isSelfAction` (:1769) reads `index.actionEffects` only, so it is root-only and action-only.
  - **CA-A3:**
    - `REGISTRY.ability` is at `registry.ts:36`.
    - `checkEffect` is the only `allowAbility: true` (`effect.ts:499`); `formula.ts:557` guards on it.
    - The `evalCall` binding read (:375) throws when the key is unbound.
    - `effectVars` binds `ability:<n>` from `actor.abilities` after the target saves (`resolve.ts:377`).
    - `useItem` binds it from `view.abilities` (`equipment.ts:283`).
    - The `cross.ts:87` mirror is present.
    - `grep executeEffect(` finds only those two var builders as callers, so no effect path lacks the binding.
  - **CA-A4:** `knownSpells` is at `pools.ts:307`, unchanged; the theme lists are at `zombie-urban.json:128/137/151` and `wyldwood.json:270`.
  - **Contract text:** `database.md` Status line is v1.7, §actions l.251 and §formulas l.334, Version Registry row 8 at l.681.
  - **Findings:** no mismatch. Every producer and consumer exists as recorded, and no required fact is missing from the inventory. The proofs were sampled through this pass's fresh whole-suite run.
- **Capability Readiness** (CAP-A1..A7 verified) is consistent with source and with the fresh run. *Current Blockers* is empty, and B-AT-1 is correctly recorded as cleared before the run. No stale readiness summary was found.
- **Counterevidence to a carried claim:** the Final Report's `mending` residual names two sites, zombie-urban `bind-the-bite` and wyldwood `bind-wound`. `grep -n mending src/compiler/themes/*.json` at `535247d` finds **three**; the third is dark-fantasy `bind-wound` (`dark-fantasy.json:273`, warden list, reachable since before this feature). This does not affect any CAP: the question is content meaning, and its owner is the human. The human question's scope should name all three sites. **Routed to Orchestrator**, which owns the Final Report and the human question text, and recorded in the arch residuals.
- **Final Report mechanical facts were re-derived** (PROGRAM-CONFIG convention):
  - **Path counts.** `git diff --name-status 0b5787e..ebf081c` gives **26** paths, 9 A and 17 M; the breakdown 7+3+1+7+1+7 matches. The report cites `0b5787e..HEAD`, and after the report's own commit that command yields **27**: `FINAL-REPORT.md` itself is the 27th, an added path. The count was correct when written, but the cited command no longer reproduces it. This is new row c3c94358 (below), not a transcription error.
  - **Diff size.** `git diff --shortstat 0b5787e..HEAD -- src tests README.md` gives 19 files, +1035/−37, as reported.
  - **Checkpoints.** The `--grep` checkpoint count is **8**, as reported.
  - **Lease audit.** `git show --name-only` on all 8 checkpoints shows only leased paths, so "Lease violations: none" is confirmed.
  - **Test counts.** 854 = 829+12+13 and 878 = 854+12+2+10, matching this pass's run.
- **Verified by execution** (fresh runs by this pass at `535247d`):
  - `pnpm typecheck` 0
  - `pnpm build` 0 (24 dist files)
  - `check:isolation` 0
  - `pnpm test` **878/878 across 48 files**
  - `pnpm exec vitest run tests/proofs` **66/66 across 9 files**
  - lint, format:check and security were **not** re-run. They are inherited from the Orchestrator receive at `3cce108`.
- **Adoption check, done before carrying rows forward.** `program-agents/` is gitignored, so `git log` cannot show adoption. All eleven role docs have mtime `2026-09-25 16:37`, earlier than the prior pass, so no human edit has landed. Current content was checked for each open row:
  - **6f6b491b:** `CODER.md:186` and `ORCHESTRATOR.md:368` still name `npx vitest run <path>`.
  - **a3680390:** `SPEC.md:14` and `AUTHOR.md:132/137` still say "never spawned".
  - **cecd2115:** `ORCHESTRATOR.md` has no idle-timeout text (grep `idle|300`: only the unrelated "Idle slots" line at :262).
  - **f4621ac1:** no "behavior pin" text in any role doc.
  - **82b4e0ab:** no "worktree" text.
  - **760b67f1:** no "newly reachable" text.
  - **3983f8eb:** no first-cell row-keying text.
  - **Other rows:** no substance present.
  - **Result:** no row is adopted. `PLANNER.md`, `CODER.md`, `UI-CODER.md` and `ORCHESTRATOR.md` are byte-identical to how this pass found them (sha1 `79b210d7…`, `2d713e3c…`, `3b19b1b2…`, `369e2928…`, recorded before and after). That is a separate claim from the adoption check above.

### Crossed thresholds (Principle 4)

- **Widened, already promoted: pin-lease ownership now covers doc pins** (row 1cc46f93). This crossed the **cycles axis**, at 4 program cycles and 6 instances.
  - **The miss:** the plan's pin audit (STATE *Behavior-pin audit*) ran four greps, all scoped to `tests/`. It missed `README.md:381`, "zombie-urban's classes know no spells", which became false at S03 ck2 (DD-A7).
  - **Why it did no damage:** README was in S03's lease, so S03 corrected the line at ck3 and reported it (surprise 1). The Final Report records it under granularity feedback as a pin-audit miss.
  - **Why the rule missed it:** the convention's text covered count/shape pins and *test* behavior pins. A prose statement of a content fact is the same shape, a pin on content that moved, in a place the grep did not look.
  - **The change:** the convention now requires the audit to grep `README.md` and docs as well as `tests/` for any content fact a session changes.
  - **Cycle count:** loot-inventory, grid-combat, spells-in-combat, action-targeting.
- **Re-confirmed: factual-premise verification at planning time** (row 576a2816), for a sixth cycle.
  - **Caught before dispatch:**
    - the planner's own probe disproved the human-answer premise "med-kit → ability is a content fix" (DD-A5) and raised B-AT-1 *before* any session existed;
    - the carried "CI build fix" was disproved against `ci.yml`;
    - the preflight corrected F-A1 (the `dist/` hazard covers 3 suites, not 1) and F-A9 (citation drift).
  - **Result:** 3/3 first-dispatch completion, and no disproved premise reached a session. The README pin is counted under 1cc46f93.
  - **Counts:** 6 cycles, 30 instances (26 + 4).
- **Held:**
  - **Planned Author re-entry carries its authorization** (a3680390): S01's envelope quoted B-AT-1 verbatim and the DB worker proceeded. The role-doc conflict recurred, so the counts go to 5 and 5.
  - **Whole-repo fast gates** (854ceecd): S01's role-scoped receive ran typecheck/lint/format and found them green; no red gate anywhere. Counts unchanged.
  - **Await idle timeout** (cecd2115): it fired once, on the preflight, and was not counted, per the convention. Counts go to 4 cycles and ≥ 7 instances.
  - **Final Report facts derived** (f68c42a3): every figure cites its command and the parts sum. Held; the residual precision issue is the new row c3c94358.
- **Not promoted:** row 760b67f1 (newly reachable content) now has 2 cycles and 2 instances; no axis crosses.

### Proposed for the framework (Principle 3: no threshold)

- **New: ORCHESTRATOR.md's Final Report step should cite commands against an explicit end SHA, not `HEAD`** (row c3c94358).
  - **The evidence:** the report's `git diff --name-status 0b5787e..HEAD` gave 26 when it was written. The report's own commit (`535247d`) is an added path, so the same command now gives 27.
  - **Recommendation:** write `<base>..<last-non-report-commit>`, or exclude the report's own path, so a later reader can reproduce the figure.
  - **1 cycle · 1 instance.**
- **Carried, count raised: the PLANNER.md pin audit should grep for behavior and doc pins** (row f4621ac1). This cycle adds a doc pin outside `tests/` (`README.md:381`). The recommendation is widened: the audit's greps for a changed fact should cover `README.md`/docs as well as `tests/`. **3 cycles · 4 instances.**
- **Carried, count raised: PLANNER.md should require a "newly reachable content" scan** (row 760b67f1).
  - **This cycle:** the Planner ran the scan voluntarily, as STATE's *Newly reachable content scan* records. It surfaced the `mending` content-meaning question before dispatch, which is evidence that the scan works.
  - **What it missed:** it listed only the newly reachable sites, and missed the same-shape dark-fantasy `bind-wound` that was already reachable.
  - **Recommendation (widened):** when the scan raises a content-meaning question, grep for the same pattern across all themes, so the human question names every site.
  - **2 cycles · 2 instances.**
- **Carried, count raised:**
  - SPEC.md/AUTHOR.md "never spawned" (a3680390): **5 cycles · 5 instances**.
  - Host await idle timeout (cecd2115): **4 cycles · ≥ 7 instances**.
- **Carried, no recurrence this cycle:**
  - 6f6b491b (`npx`): every envelope used `pnpm exec`;
  - c172cd30 (SHA-pinned gates): none in SESSION-01..03;
  - 3983f8eb (STATE row matcher): CAP/CA tables are keyed correctly in this STATE;
  - 82b4e0ab (shared-tree concurrency): the plan was serial;
  - 17f4803c (provider aborts): none;
  - b32fc8d0, f57dbe4d, b85c8f3e (no barrel change was needed), c1ed872b, 3658f327, 1d910de1.
  - Counts are unchanged. b32fc8d0, f57dbe4d and c1ed872b have now gone **five** consecutive cycles without recurrence. They stay open because they have been neither adopted nor disproved. A human may retire them.

### Standing recommendations

| id | pattern | cycles | in-cycle instances | first seen | status |
|----|---------|-------:|-------------------:|------------|--------|
| b32fc8d0c8c92d52 | Large single-session builds exhaust context on exhaustive checkpoint-0 read sweeps (empty-final crash; recovery = checkpoint-scoped reading) | 2 | 2 | v1-core | open |
| f57dbe4d010638fe | Subagent model fabricates tool inputs (invented paths, invented project state, fabricated git output) under long-recovery prompts | 2 | 8 | v1-core | open |
| b85c8f3e113a6764 | Public surface/barrel completeness gaps discovered at integration (lease gaps across wave-spanning modules) | 2 | 3 | v1-core | open |
| c1ed872bea557b96 | run tool drops/misroutes argv; workers pass whole command lines as single argv entries | 2 | 3 | v1-core | open |
| 3658f327cc9cff2f | commit_pathspec-style single-command commits fail on deleted files | 1 | 1 | v1-core | open |
| 1cc46f93038f1d9a | Cross-suite pinning tests (docs-run block-count pin, registry-count pin) land without a named owner in the plan | 4 | 6 | loot-inventory | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-27; widened to behavior pins 2026-09-30 and to doc pins 2026-10-01) |
| 576a281656f83b23 | Envelope factual premises (mock-vs-prompt anatomy, cross-suite counts) reach sessions unverified; mechanical premise verification at planning time is the fix | 6 | 30 | loot-inventory | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-27; sixth-cycle evidence recorded 2026-10-01) |
| 854ceecd39d4b0d3 | Whole-repo fast gates (typecheck/lint/format:check) go red at role-scoped receives; cleared by format-only owner corrections | 4 | 4 | v1-core | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-27; held in action-targeting) |
| 17f4803c1b08da77 | Provider stream aborts / capacity failures kill subagents mid-session with zero commits; recovery resumes from the preserved tree | 3 | 5 | loot-inventory | open (promotion held: carried cycle attribution ambiguous) |
| 6f6b491bdbe37bf0 | Bare npx misresolves in this runtime; the working gate forms are pnpm exec vitest run <path> and node_modules/.bin/vitest | 2 | 3 | loot-inventory | open |
| 1d910de11732c6c4 | Final Archivist pass aborts on provider capacity leave the next cycle's pass a double synthesis (prior cycle's integrated fragments + record-debt) | 2 | 2 | loot-inventory | open |
| c172cd30e8dfc756 | Session commit gates hard-code a plan-time base SHA that a later replan makes stale | 1 | 1 | equipment-consumables | open |
| cecd211504587426 | Host await idle timeout (300 s) interrupts long subagent waits; re-awaiting the same handle reattaches with no work lost | 4 | 7 | equipment-consumables | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-30); framework wording open |
| f68c42a3f6224eb1 | Final Report mechanical facts (test-file counts, realized module edges) transcribed from handoffs rather than derived from the tree | 3 | 3 | v1-core | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-30; held in action-targeting); framework wording open |
| a368039028d463d6 | Role documents say Spec/DB are never spawned, while plans dispatch orchestrated Author re-entry sessions on recorded human authorization | 5 | 5 | grid-combat | **promoted** (PROGRAM-CONFIG Conventions, 2026-09-30; held in action-targeting); framework wording open |
| 3983f8eb6d18a5f2 | Orchestrator STATE row matcher hits a CA-ID column inside the CAP table and writes contract-leg notes into the wrong rows | 1 | 2 | grid-movement | open |
| f4621ac12fba3456 | Pin audits enumerate count/shape pins but miss behavior pins: tests asserting a value whose derivation a decision changes surface red at a quiet boundary, some outside every lease | 3 | 4 | grid-combat | open |
| 760b67f17edbd346 | A feature opens a content class to a new execution path, and latent content hazards become reachable without a planning-time scan (damage(half) with no fail-branch damage, 12 spell sites) | 2 | 2 | spells-in-combat | open |
| 82b4e0abbda105d6 | Concurrent sessions on disjoint leases share one working tree: a sibling's uncommitted edits turn another worker's gates red or inflate its whole-suite counts | 1 | 2 | spells-in-combat | open |
| c3c94358b35f8316 | Final Report cites `git diff <base>..HEAD` while its own commit then moves HEAD, so the cited command no longer reproduces the reported count | 1 | 1 | action-targeting | open |

- **Carried rows (1–19):** the ids are copied verbatim.
- **Minted this pass (row 20):** `sha256(firstSeen + '\n' + normalize(pattern)).slice(0,16)`.
- **Count changes:**
  - Row 6 went from 3 cycles and 5 instances to 4 and 6.
  - Row 7 went from 5 and 26 to 6 and 30.
  - Row 13 went from 3 and 6 to 4 and 7 (a floor).
  - Row 15 went from 4 and 4 to 5 and 5.
  - Row 17 went from 2 and 3 to 3 and 4.
  - Row 18 went from 1 and 1 to 2 and 2.
- **Status changes:** none (row 6 was widened while already promoted).
- **Blocked signal:** no session returned blocked this cycle. The table is not empty, so the "empty while blocked" signal does not apply.

### Cleanup ledger (carried forward; maintained here, no separate CLEANUP-LEDGER.md yet)

| id | candidate | evidence | confidence | blast radius | proposed check | cluster | status |
|----|-----------|----------|------------|--------------|----------------|---------|--------|
| C1 | `isLivePattern` (`src/runtime/conditions.ts`) has no non-test consumer (the matcher-duplicate half closed by `010d730`) | re-verified at `535247d`: src refs = `conditions.ts:67` + `index.ts:56` re-export; 1 test file | medium | src/runtime surface | decide surface-first: keep as public API, or drop the barrel export (conditions.test.ts pins it) | duplicated-logic | **briefed** (2026-09-28; narrowed) |
| C2 | `MAX_TABLE_DEPTH = 8` duplicated in `src/core/tables.ts` and `src/schema/validate/helpers.ts` | re-verified at `535247d`: `tables.ts:32`, `helpers.ts:544` | medium | cross-module constant (M01 must stay import-free) | single-source strategy that keeps M01 import-free | duplicated-logic | **briefed** (2026-09-28) |
| C3 | `readPatch` exported from the compiler surface but consumed only by tests | re-verified at `535247d`: compose.ts + index.ts | low | compiler surface | decide public-surface intent (FR-20 host-side composition) | compiler-surface | **tracking** |
| C4 | `EventSeed`/`EventSink` exported from the runtime surface, no consumer | re-verified at `535247d`: events.ts + index.ts | low | runtime surface | same surface-first decision | runtime-surface | **tracking** |
| C5 | Final Report test-file count 28 vs 29 | corrected at v1-core close (`0290d47`) | high | report accuracy | — | report-accuracy | **retired** |
| C6 | `parsePackEffects` had zero consumers | deleted at `010d730` | high | M03 internal | — | spell-asts | **accepted** (closed by `010d730`) |
| C7 | `WYLDWOOD` exported from the compiler surface, consumed only via theme-loader/index | re-verified at `535247d`: compiler `index.ts` + `theme-loader.ts` | low | compiler surface | same surface-first decision as C3/C4 | compiler-surface | **tracking** |
| C8 | `equipment.ts` private `rollText` duplicated `combat.ts` `displayRoll` | closed at `27c77f4` | high | M03 internal | — | duplicated-logic | **accepted** (closed by `27c77f4`) |
| C9 | equipment-consumables Final Report *Architecture impact* omitted two value edges | corrected in the living record since 2026-09-28 | high | report accuracy only | — | report-accuracy | **retired** |
| C10 | `Combat.use`'s restriction gate cannot block (`ItemDef` has no `tags`) | S05 surprise 2 (equipment-consumables) | low | M03 combat | retain as forward-compat unless item tags are rejected as a product direction | item-tags | **tracking** (intentional; resumption: item tags decision) |
| C11 | Theme feat triggers never matched / feats never registered | closed at `d9a6d71`/`8d04c5e` | medium | — | — | inert-content | **accepted** |
| C12 | `heal` was registry entry 13 but absent from `EFFECT_VOCABULARY` | taken in as CAP-A6 and closed at action-targeting S03 ck1 `4c1e1e6`; `registry.ts:63`, exact-membership pin in `checker.test.ts` | low | — | — | vocabulary-drift | **accepted** (closed by `4c1e1e6`) |
| C13 | spells-in-combat Final Report *Files* breakdown mismatch | corrected by Orchestrator at `0b5787e` ("file breakdown re-derived (C13)") | high | report accuracy only | — | report-accuracy | **accepted** (closed by `0b5787e`) |
| C14 | Stale comment `tests/runtime/combat/character-profile.test.ts:381` "`med-kit` = heal(2 + vigor)" — the theme line is `heal(2 + ability(vigor))` since `3cce108` | read at `535247d`; STATE F-A4 auto-decision (accepted stale, outside every lease) | high | one comment line, no assertion | edit the comment; the file stays 100% green | stale-docs | **tracking** (owner: next cleanup run) |

**Cleanup brief status.** The 2026-09-28 duplicated-logic brief (C1 narrowed, C2) carries forward
unchanged and is still unaccepted. C12 and C13 were closed by feature work and by Orchestrator. No
new campaign crosses a threshold: C14 is a single trivial comment in its own cluster, and the
surface-intent items (C3, C4, C7) stay three low-confidence findings.

### Verification of this pass

- **Sources.** Every realized-state claim traces to:
  - git (`git log 0b5787e..535247d`, `git diff --name-status`/`--shortstat`, `git show --name-only` on the 8 checkpoints, `git diff 0b5787e..535247d -- src` for import lines);
  - STATE.md (all 436 lines: B-AT-1, DD-A1..A9, the Verification Baseline and pin audit, CAP/CA tables, the planning-completeness table and the three handoffs);
  - the Final Report and MASTER.md;
  - greps and reads of `src/**` at `535247d`, plus this pass's fresh gate runs.
- **No contradiction** with STATE.md or the Final Report, apart from the `mending` site count and the `..HEAD` reproduction, both recorded above.
- **Re-read after writing:**
  - `arch/v1-core.md` has 2 `<!--` and 2 `-->`, with no nesting, and zero `action-targeting SESSION` markers.
  - No surviving claim says the registry has 14 entries, that `EFFECT_VOCABULARY` lacks `heal`, that zombie-urban classes know no spells, or that self-buffs hit opponents.
  - PROGRAM-CONFIG's diff touches only the header realized-state note, the Module Registry, Conventions (one widened, two evidence notes) and Custom Rules 1, 2 and 4.
  - Verification Commands, Git Config, Session Defaults, Stack and Author Sources are byte-unchanged.
- **Role docs:** `PLANNER.md`, `CODER.md`, `UI-CODER.md` and `ORCHESTRATOR.md` are byte-identical to how this pass found them.
