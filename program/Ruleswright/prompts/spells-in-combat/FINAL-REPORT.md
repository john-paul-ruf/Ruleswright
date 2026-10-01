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

## Files (derived from `git diff --name-status 56476e9..94d40f3`, excluding the prompts folder)

48 files changed, +4283 / −374. Breakdown, corrected after the final Archivist check (C13); it sums to 48:
- **Created (5):**
  - `src/runtime/feats.ts`
  - `tests/proofs/spells-journey.test.ts`
  - `tests/runtime/combat/spells.test.ts`
  - `tests/runtime/combat/feat-triggers.test.ts`
  - `tests/runtime/feats.test.ts`
- **Author artifacts modified (8):**
  - `specs/requirements.md` (FR-9 range, FR-11 empty-cell area center)
  - `specs/database.md` (v1.6)
  - `mocks/{magic,api-map,triggers,conditions}.html`
  - `src/schema/contracts/{pack,snapshots}.schema.json`
- **Engine modified (14):**
  - `src/schema/{artifacts.ts, validate/helpers.ts, validate/sections/content.ts}`
  - `src/core/dsl/effect.ts`
  - `src/runtime/{character-profile,character,index,pools,runtime,snapshots}.ts`
  - `src/runtime/combat/{action-economy,combat,resolve,triggers}.ts`
- **Theme content modified (3):** `src/compiler/themes/{dark-fantasy,zombie-urban,wyldwood}.json`.
- **Tests modified (16):** `git diff --name-status 56476e9..94d40f3 -- tests | grep ^M`.
- **Docs modified (2):** `README.md`, `arch/v1-core.md`.

Correction: `SnapshotOffer` is exported from `src/runtime/snapshots.ts` but **not** re-exported from the runtime barrel (`src/runtime/index.ts`). It is a type-only drift note, recorded by Archivist.

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

The final Archivist pass for spells-in-combat is done and committed as `f5e3a41`, which touches only `arch/v1-core.md`, `PROGRAM-CONFIG.MD` and `ARCHIVIST-LOG.md`.

I ran the gates myself at `94d40f3` and the numbers match the Final Report: typecheck 0, build 0, isolation 0, 829/829 tests across 44 files, 53/53 proofs across 8 files. I didn't re-run lint, format check or security; those come from Orchestrator's run at `5cfad48`. All Contract Agreements CA-S1..S9 were checked against the source with no mismatch.

What the pass did:
- **Owed duty (F-P12):** PROGRAM-CONFIG Custom Rule 4 now says spells can be declared in combat (v1.6), and keeps the old DD17/DD17a wording as history. The module registry lists `src/runtime/feats.ts` as a new leaf in M03, along with three new edges inside M03. None of them creates an import cycle.
- **Arch record:** the three mid-run delta sections are folded into the main record and their markers removed. Outdated claims were corrected, for example that `parsePackEffects` exists or that F-M1 and R-GM-1/2 are still open.
- **Conventions:** two new rules were added because each pattern has now shown up in three feature cycles. One says Final Report counts must come from a cited command. The other says the 300 s await timeout is not a crash. The existing pin-ownership rule was widened to cover tests that assert behavior a decision changes, which is what the missed `combat.test.ts:448` pin was.
- **Your envelope items:** the concurrency item and the newly-reachable-content item stayed below the threshold, so they're logged as framework recommendations only. The 17-finding preflight and single replan were added as fifth-cycle evidence for the existing rule on checking plan facts before dispatch.

Two things for Orchestrator:
- **Final Report breakdown is off:** the 48-file headline is right, but "Engine (16)" should be 17 and "Tests modified: 18" should be 16. The parts add up to 49.
- **`SnapshotOffer` isn't in the runtime index:** the Final Report and arch delta call it a new exported type, but it's only exported from `snapshots.ts`. This is type-only and doesn't affect any capability.

## Archivist Note

- **role:** archivist
- **registryUpdated:** true
- **reconciled:**
  - `program/Ruleswright/arch/v1-core.md`: the three spells-in-combat markers (`4caf973`, `ae0f480`, `da4665c`) are folded into the M01/M02/M03/M04/M05 sections, cross-cutting DD-S1..S19 and the drift notes. Markers are removed and the header reads as of `94d40f3`.
  - `program/Ruleswright/PROGRAM-CONFIG.MD`:
    - registry at `94d40f3`, with `feats.ts` as an M03 leaf;
    - new intra-M03 value edges `combat→conditions`, `character-profile→pools` and `character→feats`, none forming a cycle;
    - Custom Rule 1 (v1.6) and Custom Rule 4 (spells can be declared in combat; DD17/DD17a retired; F-P12).
  - `program/Ruleswright/ARCHIVIST-LOG.md`: dated entry appended.
- **conventionsAdded:**
  - **Final Report facts are derived and cited:** every count, breakdown and edge claim names its command, and breakdowns sum to the headline. Cycles axis: v1-core C5, equipment-consumables C9, spells-in-combat C13.
  - **The host await idle timeout (about 300 s) is not a crash:** re-await the same handle. A timeout is not an attempt, does not start Recovery and is not a blocker. Cycles axis: 3 cycles, ≥6 instances.
  - **Pin-lease ownership widened to behavior pins:** when a decision changes how an observable value is derived, grep every assertion of it and list each hit with an owner. Evidence: `combat.test.ts:448`, outside every lease, and `movement.test.ts` around l.327. 3 cycles, 5 instances.
- **proposedForFramework:**
  - **PLANNER.md and ARCHIVIST.md (planning-completeness review):** add a behavior-pin grep to the pin audit. The Planner table and the preflight both missed `combat.test.ts:448`; grid-combat's OWNER-CP-POSITIONS was the same shape. 2 cycles, 3 instances.
  - **PLANNER.md:** add a "newly reachable content" scan when a feature opens a content type to a new execution path. `damage(half)` with no fail-branch damage was latent in `cold-grip` and became reachable for 12 spell sites. 1 cycle, 1 instance.
  - **ORCHESTRATOR.md:** say what concurrency on disjoint leases means in a shared tree. Name a temporary worktree as the approved closest check. Whole-suite counts taken during a concurrent wave can't be attributed to one session, so defer whole-repo verification to wave close. Evidence: OWNER-M02-HALF's gate went red from S03's uncommitted edits, and S03's ck1 count of 804 included the sibling's tests. 1 cycle, 2 instances.
  - **Carried, counts raised:**
    - ORCHESTRATOR.md should name the await idle timeout as a non-crash (3 cycles, ≥6 instances).
    - ORCHESTRATOR.md's Final Report step should derive its facts (3 cycles, 3 instances).
    - SPEC.md/AUTHOR.md "never spawned" versus authorized re-entry sessions (4 cycles, 4 instances).
  - **Carried, no recurrence:** npx form (2 cycles, 3 instances), SHA-pinned gates (1 cycle, 1 instance), STATE row matcher (1 cycle, 2 instances), and the rest of the open backlog in the table.
  - **Adoption check:** role-doc mtimes are all 2026-09-25 and none of the substance is present, so no row was adopted. The role docs are byte-identical to how this pass found them.
- **logEntry:** dated entry "2026-09-30 — final pass, cycle `spells-in-combat`" appended to ARCHIVIST-LOG.md. Report-accuracy items for Orchestrator:
  - **C13:** the Final Report Files breakdown says "Engine (16)" and "Tests modified: 18". `git diff --name-status 56476e9..94d40f3` gives 17 and 16; the 48-file headline is correct.
  - **`SnapshotOffer`:** exported from `snapshots.ts` but not re-exported by `src/runtime/index.ts`. Type-only; recorded as a drift note.
  - **Cosmetic STATE items:** CA-S8 is ordered after CA-S9, and the first Current Blockers row still says "S01 is dispatchable".

### cleanupBriefs

- **title:** Single-source duplicated logic (carried brief, narrowed): C1 `isLivePattern` surface decision, C2 `MAX_TABLE_DEPTH`
- **targetArea:** `src/runtime/conditions.ts` and its barrel export; `src/core/tables.ts` vs `src/schema/validate/helpers.ts`
- **confidence:** medium
- **proposedPlannerTask:** build a cleanup program that:
  - decides whether `isLivePattern` stays public API. The combat duplicate of the matcher was already removed at `010d730`.
  - single-sources `MAX_TABLE_DEPTH` without giving M01 a core value import.
- **requiredChecks:**
  - `pnpm typecheck`, `pnpm lint`, `pnpm test` (829+), then `pnpm build` and `pnpm check:isolation`
  - grep shows one definition per symbol
  - M01 still imports nothing internal (mechanical import derivation)
- **risks:**
  - `isLivePattern` is public surface pinned by `conditions.test.ts`, so removing it is a surface change.
  - `MAX_TABLE_DEPTH` is on the schema surface, and the M01/M02 sibling rule forbids a naive re-export.

### standingRecommendations

- **pattern:** Large single-session builds exhaust context on exhaustive checkpoint-0 read sweeps (b32fc8d0c8c92d52)
  - **cycles:** 2
  - **instances:** 2
  - **firstSeen:** v1-core
  - **status:** open
- **pattern:** Subagent model fabricates tool inputs under long-recovery prompts (f57dbe4d010638fe)
  - **cycles:** 2
  - **instances:** 8
  - **firstSeen:** v1-core
  - **status:** open
- **pattern:** Public surface/barrel completeness gaps discovered at integration (b85c8f3e113a6764)
  - **cycles:** 2
  - **instances:** 3
  - **firstSeen:** v1-core
  - **status:** open
- **pattern:** run tool drops/misroutes argv (c1ed872bea557b96)
  - **cycles:** 2
  - **instances:** 3
  - **firstSeen:** v1-core
  - **status:** open
- **pattern:** commit_pathspec-style single-command commits fail on deleted files (3658f327cc9cff2f)
  - **cycles:** 1
  - **instances:** 1
  - **firstSeen:** v1-core
  - **status:** open
- **pattern:** Cross-suite pinning tests land without a named owner in the plan (1cc46f93038f1d9a)
  - **cycles:** 3
  - **instances:** 5
  - **firstSeen:** loot-inventory
  - **status:** promoted (widened to behavior pins 2026-09-30)
- **pattern:** Envelope factual premises reach sessions unverified; premise verification at planning time is the fix (576a281656f83b23)
  - **cycles:** 5
  - **instances:** 26
  - **firstSeen:** loot-inventory
  - **status:** promoted
- **pattern:** Whole-repo fast gates go red at role-scoped receives (854ceecd39d4b0d3)
  - **cycles:** 4
  - **instances:** 4
  - **firstSeen:** v1-core
  - **status:** promoted
- **pattern:** Provider stream aborts kill subagents mid-session; recovery resumes from the preserved tree (17f4803c1b08da77)
  - **cycles:** 3
  - **instances:** 5
  - **firstSeen:** loot-inventory
  - **status:** open (promotion held: cycle attribution ambiguous)
- **pattern:** Bare npx misresolves; working forms are pnpm exec vitest run / node_modules/.bin/vitest (6f6b491bdbe37bf0)
  - **cycles:** 2
  - **instances:** 3
  - **firstSeen:** loot-inventory
  - **status:** open
- **pattern:** Final Archivist pass aborts leave the next pass a double synthesis (1d910de11732c6c4)
  - **cycles:** 2
  - **instances:** 2
  - **firstSeen:** loot-inventory
  - **status:** open
- **pattern:** Session commit gates hard-code a plan-time base SHA (c172cd30e8dfc756)
  - **cycles:** 1
  - **instances:** 1
  - **firstSeen:** equipment-consumables
  - **status:** open
- **pattern:** Host await idle timeout (300 s); re-await reattaches with no work lost (cecd211504587426)
  - **cycles:** 3
  - **instances:** 6
  - **firstSeen:** equipment-consumables
  - **status:** promoted (framework wording open)
- **pattern:** Final Report mechanical facts transcribed rather than derived (f68c42a3f6224eb1)
  - **cycles:** 3
  - **instances:** 3
  - **firstSeen:** v1-core
  - **status:** promoted (framework wording open)
- **pattern:** Role docs say Spec/DB are never spawned while plans dispatch authorized Author re-entry (a368039028d463d6)
  - **cycles:** 4
  - **instances:** 4
  - **firstSeen:** grid-combat
  - **status:** promoted (framework wording open)
- **pattern:** Orchestrator STATE row matcher writes into the wrong table's rows (3983f8eb6d18a5f2)
  - **cycles:** 1
  - **instances:** 2
  - **firstSeen:** grid-movement
  - **status:** open
- **pattern:** Pin audits miss behavior pins, some outside every lease (f4621ac12fba3456)
  - **cycles:** 2
  - **instances:** 3
  - **firstSeen:** grid-combat
  - **status:** open
- **pattern:** Latent content hazards become reachable when a feature opens a new execution path, with no planning-time scan (760b67f17edbd346)
  - **cycles:** 1
  - **instances:** 1
  - **firstSeen:** spells-in-combat
  - **status:** open
- **pattern:** Concurrent sessions on disjoint leases share one working tree (82b4e0abbda105d6)
  - **cycles:** 1
  - **instances:** 2
  - **firstSeen:** spells-in-combat
  - **status:** open
