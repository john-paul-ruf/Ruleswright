# Final Report — Ruleswright / spells-in-combat

## Summary

Characters can now cast the spells they know in a fight. The call is `fight.declare(spellId, { targetId } | { at })` and runs through the normal action pipeline (FR-9):
- **Range:** a spell has a pack-declared range (`targeting.range`). A spell with no range reaches as far as the caster's effective reach.
- **Empty-cell bursts:** a burst spell may be centered on an empty cell, and each target saves with its own value (DD-S8, DD-S19).
- **Spend:** the spend (`poolsSpent` / `slotsCast`) survives a mid-fight snapshot. After the fight, the host writes it back into the character with `settleSpellCasts`.
- **Turn cost:** every bundled spell costs the caster's whole turn (`main` + `move`, DD-S9) and has range 6.

Reactive feats now work:
- characters learn and hold feats (`learnFeat`);
- trigger patterns are checked against the engine grammar at load (`E-FORM-01`, F-M1/C11);
- held feats are offered, taken (the effect lands on the holder) or declined, and a feat never triggers another feat.

The combat snapshot now keeps every open offer, the offer counter and the phase (R-GM-1, R-GM-2).

- **Sessions:** 3/3 done (S01 Author re-entry, S02 the spell column, S03 the feat column). There was also one owner correction (OWNER-M02-HALF) and one planning replan (REPLAN-SIC-01).
- **Capabilities:** CAP-S1 … CAP-S9 are all **verified** against current sources at `5cfad48`, and CA-S1 … CA-S9 are all proven (STATE.md).
- **Tests:** 829/829 across 44 files (baseline 741/40). Counted by Orchestrator from `pnpm test` at `5cfad48`.

## Files (derived from `git diff --name-status 56476e9..HEAD`, excluding the prompts folder)

48 files changed, +4283 / −374.
- **Created (5):**
  - `src/runtime/feats.ts`
  - `tests/proofs/spells-journey.test.ts`
  - `tests/runtime/combat/spells.test.ts`
  - `tests/runtime/combat/feat-triggers.test.ts`
  - `tests/runtime/feats.test.ts`
- **Author artifacts (8):**
  - `specs/requirements.md` (FR-9 range, FR-11 empty-cell area center)
  - `specs/database.md` (v1.6)
  - `mocks/{magic,api-map,triggers,conditions}.html`
  - `src/schema/contracts/{pack,snapshots}.schema.json`
- **Engine (16):**
  - `src/schema/{artifacts.ts, validate/helpers.ts, validate/sections/content.ts}`
  - `src/core/dsl/effect.ts`
  - `src/runtime/{character-profile,character,index,pools,runtime,snapshots}.ts`
  - `src/runtime/combat/{action-economy,combat,resolve,triggers}.ts`
  - plus the three theme JSON files (content)
- **Tests modified:** 18.
- **Docs:** `README.md`, `arch/v1-core.md`.

## Architecture impact

- No new module, no new cross-module edge and no new rule id. `RULE_IDS` is still 15 and `REGISTRY` still 14.
- **New intra-M03 leaf:** `src/runtime/feats.ts` (`learnFeat`).
- **New value edges:**
  - `combat.ts → conditions.ts` (`matchesRestriction`, `declaredTags`; the duplicate matcher C1 is deleted);
  - `character-profile.ts → pools.ts` (`knownSpells`, `armorBlockingCast`);
  - `character.ts → feats.ts`.
- **Public API added:**
  - `settleSpellCasts`, `learnFeat`, `reactiveFeatsFor`, the `armorBlockingCast` export;
  - `DeclareOptions.at`, `EffectApply.varsFor`, `SpellTargeting.range`, `TRIGGER_PATTERN`;
  - `PackIndex.featEffects`, `PendingTrigger.source`;
  - envelope `offers` / `phase` / `offeredCount`;
  - `Combat` option `offeredCount`.
- **Removed:** `parsePackEffects` (C6).
- **arch/v1-core.md:** deltas appended under the `<!-- spells-in-combat SESSION-02 / OWNER-M02-HALF / SESSION-03 -->` markers (`4caf973`, `ae0f480`, `da4665c`). The DD17 / DD17a "spells are not combat-declarable" text is replaced in place (review F-P12).

## Verification

Orchestrator ran the whole-repo gates at every receive. Final run, at `5cfad48`:

| Gate | Result |
|---|---|
| `pnpm typecheck` | 0 |
| `pnpm lint` | 0 |
| `pnpm format:check` | 0 |
| `pnpm build` | 0 |
| `pnpm test` | 829/829 (44 files) |
| `pnpm check:isolation` | 0 |
| `pnpm check:security` | 0 |

The first narrow journey (CAP-S4, `tests/proofs/spells-journey.test.ts`) runs on the generated dark-fantasy pack (seed 42) through `dist/`, built at the session HEAD. It covers prepare → profile → two enemies → the real `ember-bloom` on a target and on an empty cell → snapshot/restore → `combat-over` → `settleSpellCasts` → character snapshot, plus a wyldwood pool leg and a feat leg.

The fight ends through the hp-0-via-restore harness. The test asserts that harness and says why it is used.

## Residual gaps (carried, with owners)

| Item | Owner |
|---|---|
| **Out-of-combat restricts asymmetry.** In combat, a spell is blocked by `actions.tagged:` or `spells.tagged:` (DD-S10). Out of combat, `isRestricted` / `restrictedIds` stay kind-exact. `spells.tagged:` patterns have no load-time integrity check (`helpers.ts`, `cross.ts`). **Human question: should out-of-combat restricts follow the in-combat rule?** | future restricts feature |
| **`mocks/spatial.html:191`** (C-S01-1) still describes the v1.5 derived restore phase. Under DD-S14, restore now keeps the live phase. This is an existing-mock copy change, which is the human-authorized design-change class. | Designer re-entry |
| Self-buff actions (`withdraw`, `brace`, `ward-glint`) apply their condition to the opponent. | future action-targeting feature |
| zombie-urban classes declare empty `spellLists`. Wyldwood `hedge-mage` lists `hedge`, while its 4 spells list `hedge-mage`. | next content feature |
| FR-6 feat slots: there is no progression field, so `learnFeat` has no cap. This is documented in the README as a v1 limit. | future feat-progression feature (schema event) |
| R-GM-3 resume provoke skip; F-M2 reach floor (also inherited by the spell range fallback). | as in grid-movement FINAL-REPORT |
| `heal` missing from `EFFECT_VOCABULARY`; `useItem` duration display; item tags; med-kit vigor; wyldwood charm armor; `evalPackFormula` parse-once; browser determinism leg. | prior ledgers |
| `damage(half)` with no fail-branch damage now resolves as no damage (C-S02-1, closed). The 12 theme sites keep their content. A pack author may still want real half-damage there. | content (optional) |

## Follow-up

- Final Archivist: update `PROGRAM-CONFIG` Custom Rule 4 (DD17 / DD17a retired) and synthesize the three arch markers.
- Planner, next feature: the pin-lease audit missed `tests/runtime/combat/combat.test.ts:448`, a phase pin outside every lease. See Granularity feedback.

## Orchestration

**Concurrency:** 3 (effective 1 for the serial plan; 2 in W3)
**Wall clock:** about 1 h 15 min (run r-ZVpm, 20:40 → about 21:55)
**Sessions run:** 3 Planner sessions + 1 owner correction + 1 replan + 1 Archivist preflight
**Checkpoints committed by Coder/Author:** 13 (S01 3, S02 5, S03 5) + 1 owner-correction commit

**Binding:** Native (`mcp__demiurge__spawn_subagent` / `await_subagent_result`). The await tool's 300 s idle timeout fired repeatedly; re-awaiting the same handle always recovered it. No result was lost.

### Wave plan as executed
| Wave | Sessions | Notes |
|---|---|---|
| W0 | Archivist preflight → REPLAN-SIC-01 | 6 blocking and 11 informational findings; one bounded replan (`b05b06e`) |
| W1 | S01 | Author re-entry, 3/3 |
| W2 | S02 | 5/5; the counterexample C-S02-1 was found on receive |
| W3 | S03 ‖ OWNER-M02-HALF | disjoint leases, run concurrently; S03 blocked at ck3, got lease rev 2 and resumed in the same context |

### Blocked
| S | Reason | Last checkpoint | Dependents stalled |
|---|---|---|---|
| — | none open | — | — |

### Blocker escalations
| S | Class | Action / human ask | Disposition |
|---|---|---|---|
| plan | preflight F-P1..F-P6 blocking | REPLAN-SIC-01 | cleared `b05b06e` |
| S02 | counterexample C-S02-1 (`damage(half)` throws after spend) | OWNER-M02-HALF, executor no-op | cleared `623a687` |
| S03 | declared-blocked: lease gap at `combat.test.ts:448` (DD-S14 pin) | Controlled Lease Revision 2 + resume | cleared `c6128bd` |
| S01 | `spatial.html:191` stale copy | design-change class; carried | carried (human) |

No human interruption was needed during the run.

### Interim Archivist checks
| After wave | Sessions received | Result | Drift found | Actions |
|---|---|---|---|---|
| W0 (preflight) | — | done | F-P1..F-P17 | REPLAN-SIC-01 |

### Lease violations
None. Every commit was inspected with `git show --name-only` against the lease in force; S03's `combat.test.ts` edit was made under revision 2.

### Checkpoint shortfalls
None. Git commit counts match each handoff (S03 attempt 1 reported 3 and committed 3).

### Wave plan corrections
None. No pairs were claimed concurrent. W3's concurrency (S03 ‖ OWNER-M02-HALF) was added by Orchestrator after verifying that their leases are disjoint.

### Granularity feedback for Planner
- The pin audit (and the Archivist preflight) missed `tests/runtime/combat/combat.test.ts:448`. That test pins the v1.5-derived restore phase, which DD-S14 changes. A phase-precedence change should prompt a grep of every `deserializeCombat` + `state.phase` assertion.
- S03 also re-keyed a same-class pin inside its own lease (`movement.test.ts` around l.327).
- The `damage(half)` hazard was latent for actions such as `cold-grip`. It became reachable for 12 spell sites once spells were castable. A "newly reachable content" scan belongs in planning when a feature opens a content class to a new execution path.

### Process effectiveness
- **First-dispatch completion:** 2 of 3 sessions (S01, S02) were accepted without redispatch. S03 needed one lease revision and a same-context resume.
- **Unplanned corrections:** 2.
  - OWNER-M02-HALF (CAP-S1; reason: a latent executor/content hazard exposed by the feature; separate owner).
  - S03 lease revision 2 (CAP-S8; reason: a missed pin; same-context lease revision).
- **Integration rework:** none after acceptance. CAP-S1 went stale on receive and was restored by the owner correction before wave close.
- **Product decisions during the run:** none. Environment failures: await idle timeouts only (transport, not a planning defect).

### Capability completion
CAP-S1 … CAP-S9 are verified against current sources at `5cfad48`; none is planned, blocked or stale. The product is complete for this feature's scope. The open items are the carried residual gaps above.

### Follow-up closure ledger
| Source | Item | Disposition |
|---|---|---|
| Preflight | F-P1..F-P17 | **closed** `b05b06e` (REPLAN-SIC-01; dispositions in STATE) |
| REPLAN-SIC-01 followUp | Orchestrator rechecks the CA rows after S01 | **closed** `a5a788e` (no delta) |
| REPLAN-SIC-01 followUp | arch-delta replacements at the S02 receive | **closed** `4caf973` |
| REPLAN-SIC-01 followUp | PROGRAM-CONFIG Custom Rule 4 | **carried** → final Archivist pass (this run) |
| REPLAN-SIC-01 followUp | human question on out-of-combat restricts | **carried** → human, via this report (Residual gaps) |
| REPLAN-SIC-01 surprise | `arch/v1-core.md:715,817` stale claims | **closed** `4caf973` |
| S01 surprise 1 | `api-map.html` lacks `pool:settled` / `slot:settled` / `feat:learned` | **carried** → Designer re-entry with C-S01-1 (the names are documented in `database.md` and `magic.html`) |
| S01 surprise 2 / needsOwnerCorrection | `spatial.html:191` | **carried** → Designer re-entry (human design-change class) |
| S01 surprise 3 | trigger grammar tightening recorded as a caveat, not a major bump | **retired**: follows the v1.5 revisable-v1 precedent, documented in database.md |
| S01 surprises 4–6 | map descriptions added; `triggers.html` header label; info-callout style | **retired**: informational, inside approved scope |
| S01 followUps (S02/S03 mappings) | refusal lists, range wording, grammar wording | **closed** by S02 `010d730..ab6d6f6` and S03 `d9a6d71..c6128bd` |
| S02 surprise 1 | range-floor fixture changed to `{default 2, hexer 1}` | **retired**: the validator requires reach ≥ 1; same floor proven |
| S02 surprise 2 | `damage(half)` hazard | **closed** `623a687` |
| S02 surprise 3 | action pool spends also recorded and settled | **retired**: as specified (ck1 item 5); also fixes a latent restore loss |
| S02 surprises 4–6 | `varsFor` always supplied; spell slot level = `magic.level`; restore re-states positions | **retired**: behavior-identical in shipped data, documented |
| S02 followUps for S03 | shape, journey layout, feat target binding, README facts | **closed** by S03 `8d04c5e`, `5cfad48` |
| S02 followUp | `dread-hush` / `wight-bell` cast through the generated pack | **carried** → next content feature (an optional extra proof; the executor path is proven with a fixture spell) |
| OWNER-M02-HALF surprise | throw message changed | **retired**: only misuse still throws |
| OWNER-M02-HALF followUp | CAP-S1 re-verify after S03 | **closed**: 829/829 at `5cfad48` |
| S03 attempt 1 needsOwnerCorrection | `combat.test.ts:448` | **closed** `c6128bd` (lease rev 2) |
| S03 surprises | `movement.test.ts` ~l.327 pin; envelope tests in the snapshot suite; v1.5 derivation treats `offers` as `resolved`; `Combat.use` does not surface `item:used`; restricts message wording; seed-42 hexbound duration | **retired**: in lease and per DD-S14 (the `Combat.use` item and the wording are pre-existing and informational) |
| S03 followUp carried items | C-S01-1, restricts asymmetry, F-M2, R-GM-3, content lists, FR-6, self-buff targeting, C1 `isLivePattern`, prior-ledger items | **carried** → owners in Residual gaps |

### Archivist's Note
(appended below after the final Archivist pass)
