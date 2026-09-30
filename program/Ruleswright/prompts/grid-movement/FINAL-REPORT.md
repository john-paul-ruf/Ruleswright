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
{pending — appended after the final Archivist pass}
