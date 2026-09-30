# Final Report — Ruleswright / grid-movement

## Summary

Combatants can now move on the grid. Movement is **pack data** (human Option B): a pack declares a move action whose effect is `move(<formula>)`, budgeted by an optional reserved `speed` formula, and the host calls `fight.declare(moveId, { to })`.

Packs may also:
- choose a **hex** grid (axial coordinates) as well as the square grid;
- declare **blocking and difficult terrain**, which the host places per fight and re-states on restore;
- declare **opportunity reactions** to the new `move:leaving-reach` event. A move pauses while offers are open and resumes once they are answered.

A paused move survives serialize → JSON → restore with identical behavior.

All three generated themes now move:
- dark-fantasy: grid, `stride` / `opportunist`;
- zombie-urban: grid, `hustle` / `cheap-shot`;
- wyldwood: **hex**, `glide` / `bramble-snap`.

A 2v2 fight that starts apart now reaches `combat-over` without host teleports, which retires the grid-combat DD16 stalemate.

- **Sessions done:** 4 / 4. Plus one bounded replan, REPLAN-GM-01, which crashed once and was recovered.
- **Checkpoints committed by workers:** 3 + 3 (+1 correction) + 5 + 3 = 15 feature checkpoints (16 commits), plus the replan commit.
- **Verification at `b8380e1`:**
  - typecheck, lint, format:check, build, check:isolation and check:security all exit 0;
  - `pnpm test` 741/741 across 40 files (baseline was 661/661 across 37 files);
  - `pnpm exec vitest run tests/proofs/` 47/47 across 7 files.

## Files created / modified

Diff `67f383b..b8380e1`: 34 files under src/tests/README/.github changed, +3297 / −147.

- **Author (S01):**
  - `specs/requirements.md` (FR-11 plus 6 criteria);
  - `mocks/spatial.html`, `mocks/api-map.html`;
  - `specs/database.md` (v1.5);
  - `src/schema/contracts/{pack,snapshots}.schema.json` (v1.5, additive-optional; one documented `speed` compatibility caveat).
- **M01/M02 (S02):** `src/schema/pack.ts`, `validate/sections/{root,cross}.ts`, `validate/index.ts`, `src/core/dsl/{registry,effect}.ts`, plus 3 test files.
- **M03 (S03):** `src/runtime/combat/{spatial,combat,resolve}.ts`, `character-profile.ts`, `snapshots.ts`, `equipment.ts`, the new `display-roll.ts` leaf, `index.ts`, plus new `movement-geometry.test.ts` and `movement.test.ts`, the fixtures and the snapshots tests.
- **M04 + proofs (S04):** the three theme JSONs, the new `tests/proofs/movement-journey.test.ts`, pin re-keys in 5 test files, README "Grid combat" movement subsection, and ci.yml (`pnpm build` before `pnpm test`).

## Architecture impact

There is no new module, no new cross-module edge and no new rule id; E-SPAT-01 gained documented scope. The changes are:
- registry 13 → 14 (`move`);
- `EFFECT_SCALARS` gains `speed`;
- optional `EffectApply.move`, which fails closed when absent;
- `SpatialDef.model: 'grid' | 'hex'` and `terrain`;
- the region-bounded exact `findPath` (DD-M18).

**Per-call offer surfacing (F-P1):** offers now surface only for the current call's events. This is the delta to the `arch/v1-core.md:163` record, integrated from S03's fragment. `declare` and `respond` still return the round window.

The derived restore phase (F-P2) means a restored paused fight's `step()` forfeits exactly as the uninterrupted fight does. The arch deltas were integrated at 08a831b (S02), e354139 (S03) and c420843 (S04).

## Residual gaps (carried, owners named)

- **F-M1:** theme feat triggers use a non-matching grammar and are never registered. Owner: the next feature that touches triggers.
- **F-M2 / DD-M14:** `canReach` ignores a per-id reach smaller than the default. This was preserved deliberately.
- **R-GM-1:** a restored fight restarts `trigger:fired.offerIndex` at 0. Owner: a future DB snapshot revision.
- **R-GM-2:** a `use`-raised offer restores into the `resolved` phase. Owner: a future DB snapshot revision.
- **R-GM-3 (new at S03 receive):** a resumed walk skips the leaving-reach check on its first step out of the paused cell. This was accepted as implied by once-only offers and the mock. If re-planning changes that first step, a different threatener is not checked. Owner: the next feature that touches provoke.
- **Carried ledger, unchanged:** DD17a spells bridge; per-target save modifiers; browser determinism CI leg; `evalPackFormula` parse-once (one more call site); the equipment-consumables items (useItem duration display, restricts-matcher API, item tags, med-kit vigor, wyldwood charm armor).
- **Closed here:** CI `pnpm build` before `pnpm test` (S04 ck3); the `displayRoll`/`rollText` duplicate (S03 ck5); the grid-combat DD1 move-verb question.

## Follow-up

- Reconcile SPEC.md ("Spec is never spawned") with planned Author re-entry sessions, flagged by S01. S01 proceeded on the recorded human authorization; the text it wrote was prescribed verbatim.
- `heal` is absent from `EFFECT_VOCABULARY`. This predates the feature and was noted by S02.
- A future snapshot revision could add an envelope phase and `offeredCount`, which would close R-GM-1 and R-GM-2.

---

## Orchestration

**Concurrency:** 3 configured. Effective concurrency was 1, because the plan is fully serial.
**Wall clock:** about 16:52 → 18:02 on 2026-09-30, across two orchestrator runs (r-G-jf, then r-1ftZ from about 17:13). Session work (S01 dispatch to S04 receive) ran 17:21 → 18:01.
**Sessions run:** 4 Planner sessions, plus REPLAN-GM-01 (two attempts) and ARCHIVIST-PREFLIGHT.
**Checkpoints committed by workers:** 15 feature checkpoints (+1 correction commit), plus 1 replan commit.
**Binding:** Native (`mcp__demiurge__spawn_subagent` / `await_subagent_result`). Several awaits hit the client's 300 s idle timeout while the worker was still running; re-awaiting the same handle collected each result, and none was lost.

### Wave plan as executed
| Wave | Sessions | Notes |
|---|---|---|
| Preflight | ARCHIVIST-PREFLIGHT, REPLAN-GM-01 | F-P1..F-P12 applied at 4ef88f0. The replan's attempt 1 aborted uncommitted and was recovered by attempt 2. |
| W1 | S01 (Author: Spec → Designer → DB) | 3/3; no DD deltas |
| W2 | S02 | 3/3 + an in-lease correction (933c2fd) |
| W3 | S03 | 5/5; whole suite at ck3 showed no outside test relying on repeated offers |
| W4 | S04 | 3/3; generated-content journey |

### Blocked
none

### Blocker escalations
| S | Class | Action / human ask | Disposition |
|---|---|---|---|
| PREFLIGHT | planning-completeness F-P1..F-P5 blocking | REPLAN-GM-01 plus auto-decisions; no human ask | closed (4ef88f0) |
| REPLAN-GM-01 | crash ×1 (`error_during_execution`, uncommitted draft) | Draft preserved as a patch; recovery attempt 1 of 2 | closed (4ef88f0) |

### Interim Archivist checks
| After wave | Sessions received | Result | Drift found | Actions |
|---|---|---|---|---|
| — | — | none (4 sessions; below the 16-session cadence) | — | the planning-completeness pass ran at preflight |

### Lease violations
none (every commit was checked with `git show --name-only` against its `Owns`)

### Checkpoint shortfalls
none

### Wave plan corrections
none (the plan claimed no concurrency)

### Granularity feedback for Planner
none. Every session committed every checkpoint in one dispatch. S03's 5-checkpoint shape held on a large working set (combat.ts plus snapshots.ts).

### Process effectiveness
- **First-dispatch completion:** 4 of 4 sessions were accepted without redispatch.
- **Unplanned corrections:** 0 owner corrections and 0 lease revisions. The replan recovery was caused by the runtime environment, not a planning defect.
- **Integration rework:** none. S02's 933c2fd was a self-found fix inside the checkpoint, before acceptance.
- **Orchestrator bookkeeping defect:**
  - My S01/S02 receive commits (3d52826, dfab1d9) wrote CA contract-leg notes into the CAP-M1/M5/M7 rows. The row matcher also matched the CAP table's CA-ID column.
  - I found this at the S03 receive and rebuilt both tables in 4ffa236.
  - No worker consumed the wrong rows, because each dispatch envelope stated the CA readiness explicitly.

### Capability completion
All seven capabilities are verified against current sources at `c23d563` / `b8380e1`:

| CAP | Verified by |
|---|---|
| M1 | movement-geometry + journey steps 1–2 |
| M2 | movement.test.ts + journey 2–3 |
| M3 | movement + journey 2 |
| M4 | provoke describe + journey 4, 6 |
| M5 | snapshots v1.5 + journey 4 |
| M6 | coverage-floor v1.5 + journey 1, 5, 9 |
| M7 | theater tests + journey 7 |

CA-M1..M7 have all landed with proofs. CAP-M5 carries R-GM-1 and R-GM-2.

### Follow-up closure ledger
| Source | Item | Disposition |
|---|---|---|
| REPLAN-GM-01 | S01 ready; recheck CA before S02; optional Archivist recheck | **closed** (S01 dispatched; CA rechecked at every receive; recheck not needed) |
| REPLAN-GM-01 | R-GM-1, R-GM-2 | **carried**: future DB snapshot revision |
| S01 surprise | SPEC.md vs orchestrated Author re-entry | **carried**: owners of the program-agents role docs (Archivist to log) |
| S01 surprise | "v1 set" → "shipped set" wording; requirements.md trailing newline | **retired**: cosmetic, same meaning |
| S01 followUp | S02 wording; S03 semantics; CA recheck | **closed** (S02 5d76126; S03 3af4127/dd88f0c; recheck at 3d52826) |
| S02 surprise | grouping-paren speed scan | **closed** (933c2fd) |
| S02 surprise | tokenizer uses the core lexer grammar | **retired**: stricter, same DD-M19 mapping |
| S02 surprise | `heal` absent from `EFFECT_VOCABULARY` | **carried**: next feature touching the DSL vocabulary |
| S02 followUp | S03 bindings, MoveOutcome, hex geometry | **closed** (S03 ck1/ck2) |
| S03 surprise 1 | resume skips the first provoke check | **carried** as R-GM-3: next feature touching provoke |
| S03 surprise 2 | decline `setClock` restore defect | **closed** (dd88f0c) |
| S03 surprise 3 | square neighbor order pinned | **closed** (decision recorded; tested) |
| S03 surprise 4 | positionless spatial mover → E-SPAT-01 `spatial` | **retired**: existing kind, documented in the handoff |
| S03 surprises 5–9 | internal helpers, refactor, hand-computed expectations, harness, MoveOutcome no-op | **retired** |
| S03 followUp | S04 harness pins; R-GM-1/2; CA recheck | **closed** (S04 da9bf03); R-GM-1/2 **carried** |
| S04 surprise 1 | stages.test.ts re-registers pipeline tests | **retired**: resolved by the in-lease re-key |
| S04 surprise 2 | hero `attack:rolled` reaction causes a second offer | **retired**: expected pack behavior; journey covers it |
| S04 surprises 3–7 | `why.rule` prefix, seeded Rng, speeds, README wording, harness | **retired** |
| S04 followUp | F-M1, F-M2, DD17a, browser leg, parse-once | **carried** (owners as in Residual gaps) |

### Archivist's Note
(Final Archivist h-6gAA / ASDFy; synthesis commit 6fb5a76. The return is appended verbatim.)

- **role:** archivist
- **registryUpdated:** true
- **reconciled:**
  - `program/Ruleswright/arch/v1-core.md`: the grid-movement SESSION-02..04 deltas (`08a831b`, `e354139`, `c420843`) are merged into the M01/M02/M03/M04/M05 sections.
    - The per-call offer change to `v1-core.md:163` (F-P1) is recorded in M03 combat. The old round-window sentence under DD17 now says the return value is unchanged but offers are per call.
    - DD-M1..DD-M19 are summarised. grid-combat DD1 is marked superseded and DD16 retired.
    - Drift notes: the movement verb is marked resolved. The `rollText` duplicate and the CI build gap are closed. F-M1, F-M2, R-GM-1..3, `heal` missing from `EFFECT_VOCABULARY`, and the grown `evalPackFormula` debt are added.
    - Correction checked against source: the `snapshots.ts → combat/{resolve,spatial,action-economy}` imports are type-only, so they are not value edges.
  - `program/Ruleswright/PROGRAM-CONFIG.MD`:
    - The Module Registry is re-derived from value imports at `6ab880a`. There is no new module, no new cross-module edge and no rule id. The new edges inside M03 go into the `display-roll.ts` leaf.
    - Conventions gain one new rule.
    - Custom Rules 1, 2 and 4 now cover v1.5, `speed`, and movement as pack data.
    - Author Sources is Planner-owned and flagged, not edited.
  - `program/Ruleswright/ARCHIVIST-LOG.md`: dated entry appended.
- **conventionsAdded:**
  - **Planned Author re-entry sessions carry their authorization in the envelope.** STATE.md records the human's answer, and the envelope quotes it and the prescribed text word for word. This crossed on the cycles axis: grid-combat S01, equipment-consumables S01 and grid-movement S01.
- **proposedForFramework:**
  - **New: SPEC.md and AUTHOR.md conflict with authorized re-entry sessions.** Both say Spec is never spawned, and AUTHOR.md says Designer is the only Author role ever spawned. Yet planned, authorized Author re-entry sessions keep running orchestrated. Recommendation: add an explicit "authorized re-entry session" path that names what the envelope must quote. 3 cycles, 3 instances.
  - **New: key STATE table rows by their first-column ID.** Orchestrator's row matcher also matched the CAP table's CA-ID column, so the S01/S02 receives (`3d52826`, `dfab1d9`) wrote contract-leg notes into the wrong CAP rows. Orchestrator rebuilt both tables in `4ffa236`. Recommendation: match on the first cell and re-read the row after writing. 1 cycle, 2 instances.
  - **Carried, narrowed: the host's 300 s await idle timeout.** ORCHESTRATOR.md:78 already says to re-await after a crash. What's missing is saying that the idle timeout isn't a crash and doesn't start the recovery ladder. 2 cycles, at least 4 instances.
  - **Carried, no recurrence:** the `npx vitest` form (CODER.md:186, ORCHESTRATOR.md:368; 2 cycles, 3 instances), SHA-pinned gates, deriving Final Report facts, checkpoint-0 read scope, fabricated tool inputs, barrel lease gaps, argv, deletion commits and double synthesis.
  - **No adoption since the prior pass.** The role docs are gitignored; their mtimes are still `2026-09-25`, and their content was checked row by row.
- **logEntry:** dated entry "2026-09-30 — final pass, cycle `grid-movement`" appended to ARCHIVIST-LOG.md.

#### cleanupBriefs

- **title:** Single-source duplicated logic (carried brief; C8 accepted and closed at `27c77f4`, C1/C2 remain)
- **targetArea:** `src/runtime/conditions.ts` vs `combat.ts` `restrictionRejection`; `src/core/tables.ts` vs `src/schema/validate/helpers.ts` (`MAX_TABLE_DEPTH`)
- **confidence:** medium
- **proposedPlannerTask:** build a cleanup program that makes the surface decision on the restricts helpers and single-sources `MAX_TABLE_DEPTH` without giving M01 a value import from core.
- **requiredChecks:**
  - `pnpm typecheck`, `pnpm lint`, `pnpm test` (741+), then `pnpm build` and `check:isolation`
  - a grep proving one definition per symbol
  - M01 still imports nothing internal, checked by mechanically deriving its imports
- **risks:**
  - The restricts helpers are public surface pinned by `conditions.test.ts`, so removing them is a surface change.
  - `MAX_TABLE_DEPTH` is on the schema surface, and the rule that M01 and M02 are independent siblings rules out a naive re-export.

#### standingRecommendations

- **pattern:** Large single-session builds exhaust context on exhaustive checkpoint-0 read sweeps
- **cycles:** 2
- **instances:** 2
- **firstSeen:** v1-core
- **status:** open

- **pattern:** Subagent model fabricates tool inputs under long-recovery prompts
- **cycles:** 2
- **instances:** 8
- **firstSeen:** v1-core
- **status:** open

- **pattern:** Public surface/barrel completeness gaps discovered at integration
- **cycles:** 2
- **instances:** 3
- **firstSeen:** v1-core
- **status:** open

- **pattern:** run tool drops/misroutes argv; workers pass whole command lines as single argv entries
- **cycles:** 2
- **instances:** 3
- **firstSeen:** v1-core
- **status:** open

- **pattern:** commit_pathspec-style single-command commits fail on deleted files
- **cycles:** 1
- **instances:** 1
- **firstSeen:** v1-core
- **status:** open

- **pattern:** Cross-suite pinning tests land without a named owner in the plan
- **cycles:** 2
- **instances:** 3
- **firstSeen:** loot-inventory
- **status:** promoted

- **pattern:** Envelope factual premises reach sessions unverified; mechanical premise verification at planning time is the fix
- **cycles:** 4
- **instances:** 17
- **firstSeen:** loot-inventory
- **status:** promoted

- **pattern:** Whole-repo fast gates go red at role-scoped receives
- **cycles:** 4
- **instances:** 4
- **firstSeen:** v1-core
- **status:** promoted

- **pattern:** Provider stream aborts kill subagents mid-session with zero commits; recovery resumes from the preserved tree
- **cycles:** 3
- **instances:** 5
- **firstSeen:** loot-inventory
- **status:** open (promotion held: which cycles the carried count covers is unclear)

- **pattern:** Bare npx misresolves in this runtime; the working forms are `pnpm exec vitest run <path>` and `node_modules/.bin/vitest`
- **cycles:** 2
- **instances:** 3
- **firstSeen:** loot-inventory
- **status:** open

- **pattern:** Final Archivist pass aborts leave the next cycle a double synthesis
- **cycles:** 2
- **instances:** 2
- **firstSeen:** loot-inventory
- **status:** open

- **pattern:** Session commit gates hard-code a plan-time base SHA that a later replan makes stale
- **cycles:** 1
- **instances:** 1
- **firstSeen:** equipment-consumables
- **status:** open

- **pattern:** Host await idle timeout (300 s) interrupts long subagent waits; re-awaiting the same handle reattaches with no work lost
- **cycles:** 2
- **instances:** 4
- **firstSeen:** equipment-consumables
- **status:** open

- **pattern:** Final Report mechanical facts are transcribed from handoffs rather than derived from the tree
- **cycles:** 2
- **instances:** 2
- **firstSeen:** v1-core
- **status:** open

- **pattern:** Role documents say Spec/DB are never spawned, while plans dispatch orchestrated Author re-entry sessions on recorded human authorization
- **cycles:** 3
- **instances:** 3
- **firstSeen:** grid-combat
- **status:** promoted (framework wording still open)

- **pattern:** Orchestrator STATE row matcher hits a CA-ID column inside the CAP table and writes contract-leg notes into the wrong rows
- **cycles:** 1
- **instances:** 2
- **firstSeen:** grid-movement
- **status:** open
