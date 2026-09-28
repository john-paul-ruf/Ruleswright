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

- **No new module IDs.** M03 gains the leaf file `equipment.ts`. Its value imports are core, `./errors` and `./conditions`, so no new cycle is created. New realized edges: `character`, `pools`, `inventory` and `character-profile` → `equipment`, plus `character-profile` → `inventory` (S05). *(Corrected after the final Archivist pass, finding C9: the first version of this report listed only three of these links.)*
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

## Archivist Note

The final pass for equipment-consumables is done and committed as `2e73640`: `arch/`, the module registry and the log now match the tree at `c39ef87`. One real correction came out of it: the Final Report misses two new module links (details below). I didn't edit the Final Report or STATE.md.

I re-ran part of the gates after a fresh build: typecheck 0, build 0, `check:isolation` 0, `pnpm test` 661/661 across 37 files, and proofs 38/38 across 6 files. Lint, format and security are taken from your receive at `e5e4846`; I didn't re-run them.

- **role:** archivist
- **registryUpdated:** true
- **reconciled:**
  - `program/Ruleswright/arch/v1-core.md`
    - The four delta sections for SESSION-02..05 (commits `f1563b1`, `643fd76`, `7c3db75`, `7a479e6`) are folded into the M01–M05 sections.
    - There is a new **M03 — Equipment** section for the `equipment.ts` leaf file. DD-EG1..9 are added under Cross-cutting decisions.
    - Updated to `c39ef87`: the header, module map, surfaces, M05 (the equipment journey, the README section, the CI build gap) and the drift notes (`rollText`, effect-scope shadowing, the useItem condition-duration display).
    - Wording from the last pass that said "this pass" now names the grid-combat pass.
    - The provenance comment at the end no longer nests `<!-- -->` markers. Nesting them had closed the comment early.
  - `program/Ruleswright/PROGRAM-CONFIG.MD`
    - The module registry and realized-state note now describe `c39ef87`. I derived the module links from value imports in the source; M02→M01 is still type-only, and M01 imports nothing from core.
    - The Factual-premise convention's evidence note now covers three cycles. The rule text itself is unchanged.
    - Custom Rules 1, 2 and 4 now record the v1.4 contract, the `gear-*` reserved scalars, and that armorCasting is checked at slot cast time only.
    - Four "2025-09-27" dates are corrected to 2026 (git shows 2026).
    - Verification Commands, Git Config, Session Defaults, Stack and Author Sources are unchanged. Author Sources still mentions only v1.2/v1.3. That section belongs to Planner, so I flagged it in the log instead of editing it.
  - `program/Ruleswright/ARCHIVIST-LOG.md`: new entry appended.
- **Finding for Orchestrator (report accuracy, cleanup ledger C9):** the Final Report's *Architecture impact* lists only `character`/`pools`/`inventory` → `equipment`. Reading the imports at `c39ef87` also shows `character-profile.ts → equipment.ts` and `character-profile.ts → inventory.ts` (S05 ck1/ck3, `14c01dc`/`31540b0`). Neither creates a cycle. `arch/` and the registry now include both links.
- **Contract agreements CA-EG1..EG6:** I checked each producer and consumer path at `c39ef87` (`validate/index.ts:72`, `content.ts:652-688`, `pools.ts:208/247`, `registry.ts:17`, `combat.ts:243/471/517`, `snapshots.ts:168/319-357`). Nothing disagrees with the record. Capability readiness for CAP-E1..E8 and the Current Blockers list are consistent too.
- **conventionsAdded:**
  - None newly minted.
  - Factual-premise verification at planning time: already promoted, and now seen in 3 cycles. This cycle the pre-dispatch review and its recheck caught 7 premise defects (F-E1/2/3/4/7/14 and R-7). One harmless wrong premise still reached a session: S03's `VALID_PACK` fixture claim.
  - Whole-repo fast gates at role-scoped receives: still working. The format fix `8668c53` is its 4th cycle and 4th instance.
  - Pin-lease ownership: still working; every pin had a named owner.
  - R-1 (a session gate hard-coded a SHA): **not promoted.** It happened once, in one cycle, so it goes to the framework channel below.
- **proposedForFramework:**
  - PLANNER/ORCHESTRATOR: write session gates against a dispatch base that Orchestrator puts in the envelope, or in a worktree-relative form, never a SHA fixed at planning time. Evidence: R-1; 1 cycle, 1 instance.
  - ORCHESTRATOR's native binding: document that the 300-second idle timeout on awaiting a subagent is recovered by awaiting the same handle again, so it isn't mistaken for a crash. 1 cycle, at least 2 instances (the exact count wasn't recorded).
  - ORCHESTRATOR's Final Report step: derive test counts and module links from the tree, or cite the command that produced them, instead of copying them from handoffs. 2 cycles, 2 instances (v1-core C5 and this cycle's C9).
  - Carried over: CODER.md:186 and ORCHESTRATOR.md:368 still say `npx vitest run <path>` is the working narrow form. In this program that form fails, and the working one is `pnpm exec vitest run` (DD14e). 2 cycles, 3 instances; no new ones this cycle.
  - Carried over with no recurrence: rows b32fc8d0, f57dbe4d, b85c8f3e, c1ed872b, 3658f327, 17f4803c, 1d910de1.
  - Nothing counts as adopted. The role docs are gitignored, their last-modified time (2026-09-25 16:37) is older than the previous pass, and I checked their current text against each recommendation.
- **logEntry:** dated entry "2026-09-28 — final pass, cycle `equipment-consumables`" appended to ARCHIVIST-LOG.md.

### cleanupBriefs

- **title:** Single-source the duplicated logic (C8 `rollText`/`displayRoll`, C1 restricts matcher, C2 `MAX_TABLE_DEPTH`)
- **targetArea:**
  - `src/runtime/equipment.ts`
  - `src/runtime/combat/combat.ts`
  - `src/runtime/conditions.ts`
  - `src/core/tables.ts`
  - `src/schema/validate/helpers.ts`
- **confidence:** high (C8); medium (C1, C2)
- **proposedPlannerTask:** build a cleanup program with one serial session per finding:
  - move `displayRoll` into a leaf file that both `combat.ts` and `equipment.ts` import, keeping the barrel export;
  - decide what happens to the restricts matcher as public API: either combat calls `matchesRestriction`, or the helpers are removed from the barrel;
  - single-source `MAX_TABLE_DEPTH` without giving schema a value import from core.
- **requiredChecks:**
  - `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` (661 or more), then `pnpm build` followed by `pnpm check:isolation`
  - `why.rolls` strings stay byte-identical in `tests/runtime/equipment.test.ts` and `tests/runtime/combat/**`
  - a grep shows one definition per symbol
  - a mechanical import derivation shows M01 still imports nothing internal
- **risks:**
  - `displayRoll` is exported from the runtime barrel, so its export path must be kept.
  - The restricts helpers are public and pinned by `conditions.test.ts`, so this is an API decision, not just cleanup.
  - The M01/M02 sibling rule rules out simply re-exporting core's `MAX_TABLE_DEPTH` from schema.

### standingRecommendations

| id | pattern | cycles | in-cycle instances | first seen | status |
|---|---|---:|---:|---|---|
| b32fc8d0c8c92d52 | Large single-session builds exhaust context on exhaustive checkpoint-0 read sweeps | 2 | 2 | v1-core | open |
| f57dbe4d010638fe | Subagent model fabricates tool inputs under long-recovery prompts | 2 | 8 | v1-core | open |
| b85c8f3e113a6764 | Public surface/barrel completeness gaps discovered at integration | 2 | 3 | v1-core | open |
| c1ed872bea557b96 | run tool drops/misroutes argv | 2 | 3 | v1-core | open |
| 3658f327cc9cff2f | commit_pathspec-style single-command commits fail on deleted files | 1 | 1 | v1-core | open |
| 1cc46f93038f1d9a | Cross-suite pinning tests land without a named owner in the plan | 2 | 3 | loot-inventory | promoted (held this cycle) |
| 576a281656f83b23 | Envelope factual premises reach sessions unverified; verify them at planning time | 3 | 11 | loot-inventory | promoted (third-cycle evidence recorded) |
| 854ceecd39d4b0d3 | Whole-repo fast gates go red at role-scoped receives; cleared by format-only owner corrections | 4 | 4 | v1-core | promoted (held, `8668c53`) |
| 17f4803c1b08da77 | Provider stream aborts / capacity failures kill subagents mid-session with zero commits | 2 | 4 | loot-inventory | open |
| 6f6b491bdbe37bf0 | Bare npx misresolves in this runtime; the working gate forms are `pnpm exec vitest run <path>` and `node_modules/.bin/vitest` | 2 | 3 | loot-inventory | open |
| 1d910de11732c6c4 | Final Archivist pass aborts leave the next cycle a double synthesis | 2 | 2 | loot-inventory | open |
| c172cd30e8dfc756 | Session commit gates hard-code a plan-time base SHA that a later replan makes stale | 1 | 1 | equipment-consumables | open |
| cecd211504587426 | Host await idle timeout (300 s) interrupts long subagent waits; re-awaiting the same handle reattaches with no work lost | 1 | 2 | equipment-consumables | open |
| f68c42a3f6224eb1 | Final Report mechanical facts (test-file counts, realized module edges) transcribed from handoffs rather than derived from the tree | 2 | 2 | v1-core | open |
