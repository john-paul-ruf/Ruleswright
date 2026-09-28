# Final Report — Ruleswright / equipment-consumables

## Summary

This run adds slot-based equipment and consumables, one engine mechanism behind both. It also delivers two approved requirements that had not been built: FR-3 (derived stats read equipment) and FR-9 (`armorCasting` now actually blocks casting).
- **Pack content:** packs declare `equipSlots`, and items can carry `slots`, `grants` and `use`. The effect registry gains `heal` (12 → 13), and pack formulas read `gear-hp` / `gear-ac` / `gear-initiative` / `gear-armor`. The formula decides which way a grant moves the stat, so the engine never hard-codes stat direction.
- **Runtime:** it adds `equipItem` / `unequipItem` / `useItem`, the slot-cast armorCasting gate, and in combat `fight.use` with a per-fight charge ledger and a `maxHp` heal cap. Heals never raise hp above the cap and never lower it. After the fight, `settleItemUses` removes the used units from the character's inventory. Snapshots carry `equipped`, `itemsUsed` (units spent) and `maxHp`, and a bad restore is refused.
- **Proof:** `tests/proofs/equipment-journey.test.ts` runs end to end against the dist build and seed-42 generated packs, with nothing mocked.

**Sessions done:** 6/6. **Capabilities:** CAP-E1..E8 all verified against current sources (see *Capability completion*).

## Files

- **Created:** `src/runtime/equipment.ts`, `tests/runtime/equipment.test.ts`, `tests/proofs/equipment-journey.test.ts`.
- **Modified (46):**
  - **Contracts:** `src/schema/contracts/{pack,snapshots}.schema.json` and `specs/database.md` (v1.4, DB author re-entry).
  - **Schema:** the mirror and validator: `pack.ts`, `artifacts.ts`, and `validate/{collect,context,index,sections/content,sections/root}.ts`.
  - **Core:** `dsl/{registry,effect,formula}.ts`.
  - **Runtime:** `character`, `character-profile`, `pools`, `inventory`, `runtime`, `snapshots`, `index`, and `combat/{combat,resolve,action-economy}`.
  - **Compiler:** `theme.ts`, `pipeline.ts`, and the three themes.
  - **Tests:** schema, DSL, runtime, fixtures, snapshots and compiler.
  - **Docs:** README.
- **Size:** 49 files, +3288/−123, not counting the plan files.

## Architecture impact

- **No new module IDs.** M03 gains the leaf file `equipment.ts`. Its value imports are core, `./errors` and `./conditions`, so no new cycle is created. New realized edges: `character`, `pools` and `inventory` → `equipment`.
- **Public API deltas** are recorded in `arch/v1-core.md`, in the markers `<!-- equipment-consumables SESSION-02..05 -->` (commits `f1563b1`, `643fd76`, `7c3db75`, `7a479e6`).
- **Contract v1.4** is additive-optional. `schemaVersion` and `snapshotVersion` are both still 1, and no rule id was added.

## Verification (Orchestrator-run, final receive at `e5e4846`, after a fresh `pnpm build`)

| Gate | Result |
|---|---|
| typecheck | 0 |
| lint | 0 |
| format:check | 0 |
| build | 0 |
| test | 661/661 across 37 files (baseline 564/35) |
| check:isolation | 0 |
| check:security | 0 |

`tests/proofs/`: 38/38. That covers docs-run 3/3 (the README `ts` block count is still 4), loot-journey 7/7, grid-journey 11/11 and equipment-journey 10/10.

Test-count lineage:

| Point | Tests |
|---|---|
| baseline | 564 |
| S02 | 584 |
| W3 close | 623 |
| S05 | 651 |
| S06 | 661 |

## Residual gap

None is required for this feature's capabilities. Carried items are listed in the follow-up closure ledger below.

## Follow-up

- **CI:** add `pnpm build` before `pnpm test` in the ci.yml test job.
- **Content semantics:** decide how an ability and a save with the same name resolve in effect scope.
- **Cleanup:** remove the `rollText` duplicate.

Each has an owner in the ledger below.

## Orchestration

**Concurrency:** 3 cap. The widest wave ran 2 workers: W1 ran S01 alongside REPLAN-EC-02, and W3 ran S03 ∥ S04.   **Wall clock:** about 1h15m (startup around 00:32, final receive 01:46, 2026-09-28).
**Sessions run:** 6. **Plan workers:** 2 replans and 2 Archivist planning reviews.   **Checkpoints committed by Coder:** 20 (S01 3 · S02 2 · S03 4 · S04 4 · S05 5 · S06 2), each confirmed in `git log`.
**Binding:** Native (`mcp__demiurge__spawn_subagent` / `await_subagent_result`). Several awaits hit the host's 300-second idle timeout; re-awaiting the same handle reattached cleanly every time, and no work was lost.

### Wave plan as executed
| Wave | Sessions | Notes |
|---|---|---|
| W0 | ARCHIVIST-PREFLIGHT-EC → REPLAN-EC-01 → ARCHIVIST-RECHECK-EC | 15 findings (F-E1..F-E15) → replan `0ee3974`; the recheck found R-1..R-11 |
| W1 | S01 (DB role) ∥ REPLAN-EC-02 | Disjoint write sets. R-1 and R-9 were applied through S01's envelope; the replan `46932f2` covered R-2..R-11 |
| W2 | S02 | Solo |
| W3 | S03 ∥ S04 | Disjoint leases; the shared-tree hazard was not observed in either direction |
| W4 | S05 | Solo |
| W5 | S06 | Solo; the journey and README |

### Blocked
None.

### Blocker escalations
| S | Class | Action / human ask | Disposition |
|---|---|---|---|
| PLAN | Planning-completeness: 5 blocking findings (F-E2 grant composition, F-E3 pipeline dropped `equipSlots`, F-E4 snapshot contract closed, F-E5 red window at S03, F-E9 no combat HP cap) plus 10 bounded ones | REPLAN-EC-01. Automatic decisions: F-E2 option (b), F-E9 clamp, F-E10 settlement. No human ask; the Human Interruption Gate failed because approved FR-3, Q2, DD-EG4 and CA-EG5 already settle each one | Cleared `0ee3974` |
| PLAN | Recheck: R-1 (S01's gate hard-coded a SHA) and R-2 (the heal clamp could lower HP), plus R-3..R-11 | R-1 and R-9 through the S01 envelope; REPLAN-EC-02 for the rest | Cleared `46932f2` |

### Interim Archivist checks
| After wave | Sessions received | Result | Drift found | Actions |
|---|---|---|---|---|
| pre-W1 | — | planning-completeness | F-E1..F-E15 | REPLAN-EC-01 |
| pre-W1 | — | scoped recheck | R-1..R-11 | S01 envelope and REPLAN-EC-02 |

This was a 6-session run, so no interim drift check was due.

### Lease violations
None. `git show --name-only` was checked on all 20 checkpoint commits, and every one stayed inside its session's `Owns`.

### Checkpoint shortfalls
None.

### Wave plan corrections
None. S03 ∥ S04 were verified disjoint path by path, both before and after the replans.

### Granularity feedback for Planner
None structural: every session finished its checkpoints in one dispatch. S05 reported some work moved between checkpoints for compile reasons:
- ck2 had to touch the `deserializeCombat` literal so the code compiled;
- `balances.items` moved from ck1 to ck2;
- the barrel export landed at ck3.

This is a minor boundary note, not a defect. The plan did need two review-and-replan rounds before dispatch, which is planning-completeness feedback: the original plan's grant composition, pipeline pass-through and snapshot contract premises were not checked against source.

### Process effectiveness
- **First-dispatch completion:** 6/6. Every session was accepted with no redispatch and no recovery.
- **Unplanned corrections:** 1, the Orchestrator's format-only residual `8668c53` (S01's contracts were not Prettier-formatted; grid DD12 precedent). No CAP was affected.
- **Integration rework after acceptance:** none.
- **Pre-dispatch plan corrections:** 2 replans, correcting 26 findings (15 + 11) before any code was written. The heaviest were CAP-E2, E4, E5, E6 and E8.
- **Product decisions escalated to the human:** 0. Environment failures: none, apart from the await idle timeouts, which recovered by re-awaiting.

### Capability completion
All verified against current sources at `e5e4846`:

| Capability | Verified by |
|---|---|
| CAP-E1 | S02 ck2 |
| CAP-E2 | S03 ck2 + S06 ck1 |
| CAP-E3 | S03 ck3 + S06 ck1, dark-fantasy leg |
| CAP-E4 | S03 ck3, S05 ck2, S06 ck1 |
| CAP-E5 | S05 ck4 + S06 ck1 |
| CAP-E6 | S04 ck4 |
| CAP-E7 | S06 ck1, the journey |
| CAP-E8 | S05 ck3 + S06 ck1 |

CA-EG1..EG6: every producer landed and every proof passed. No required capability is still planned, blocked or stale.

### Follow-up closure ledger
| Source | Item | Disposition |
|---|---|---|
| S01 followUp / needsOwnerCorrection | `grants.properties.armor {integer, min 1}` added to the contract | **closed**: accepted within CA-EG1; S02 enforces it (`52df545`) |
| S01 followUp | S02 mirror duties and S05 snapshot duties | **closed**: `52df545`, `4bfcec4` |
| S01 surprises | Temporary edit scripts in `.program/signal/` | **closed**: deleted by S01 |
| S02 surprises / followUp | Heal RollResult is negated as a whole, so heal rolls show negative dice | **closed**: S05 kept `displayRoll` consistent (`1af3945`) |
| S02 surprises | `EQUIPMENT_SCALARS`↔`RESERVED_GRANT_KEYS` test moved to ck2; the `attackBonus` wording covered both ways | **retired**: no action needed |
| S02 followUp | S03/S04/S05 consumer facts | **closed**: consumed at `8dcfe41`, `90dbfc7`, `14c01dc` |
| S03 surprise 1 / S05 followUp / S06 followUp | `equipment.ts` has a private `rollText` copy of `displayRoll` (the R-11 leaf rule) | **carried**: the next runtime-touching feature's planning moves `displayRoll` to a leaf |
| S03 surprise 2 | The `armorBlockingCast` walk of `state.equipped` | **retired**: consistent with CA-EG2/R-5 |
| S03 surprise 3 | A save grant with no base value starts at 0 | **retired**: documented behaviour |
| S03 surprise 4 | A `useItem` condition event reports the pack-default duration when the effect overrides it | **carried**: next runtime-touching feature's planning (display accuracy) |
| S03 surprise 5 | The fixture premise (`VALID_PACK`) in the prompt was wrong | **retired**: no effect |
| S03 surprise 6 / S04 surprise | Shared-tree typecheck red from S03 in flight, seen during S04 | **closed**: whole repo green at W3 close |
| S04 surprises | `tsx` probe script dropped; Prettier expanded the JSON; extra CA-EG3 floor assertion | **retired** |
| S04 followUp | wyldwood charm armor is content-only (point-pool casting has no gate) | **carried**: documented limit (DD-EG5); a future point-pool cast verb owns it (DD17a lineage) |
| S05 surprise 1 | `use()` rejections reuse the `declare:rejected` event type | **retired**: consistent with `declare`; journey-asserted |
| S05 surprise 2 | The restriction gate on `use` cannot block, because `ItemDef` has no `tags` | **carried**: next feature's planning, if item tags are introduced |
| S05 surprise 3 / followUp | med-kit `heal(2 + vigor)` reads the vigor **save**, because saves shadow same-named abilities in effect scope | **carried**: next feature's planning (content/semantics decision). README states it honestly |
| S05 surprise 4 | `settleItemUses` refuses an unknown `combatantId` with `unknown-target` | **retired**: fail-closed and consistent |
| S05 surprise 5 | Work moved between checkpoints | **retired**: see Granularity feedback |
| S05 followUp | README must document R-4 | **closed**: `e5e4846` |
| S06 surprise 1 | Step 6 restores the character as well as the fight | **retired**: matches how a resuming host works |
| S06 surprise 4 / followUp | CI's `test` job lacks `pnpm build`, so loot-journey and equipment-journey need `dist/` | **carried**: next feature's planning, as a CI owner correction adding `pnpm build` before `pnpm test` in ci.yml |
| grid-combat inherited | Movement verb, DD17a burst/spells bridge, parse-once C6, browser CI leg | **carried**: unchanged; none was owed by this feature |

### Archivist's Note
_(appended below after the final Archivist pass)_
