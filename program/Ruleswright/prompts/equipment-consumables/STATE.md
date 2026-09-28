# State Tracker — Ruleswright / equipment-consumables

## Program / Feature / Intent / Sessions

- **Program:** Ruleswright, a headless TS library: theme → campaign pack → embeddable runtime.
- **Feature:** `equipment-consumables` (F_NAME). Run folder: `program/Ruleswright/prompts/equipment-consumables/`.
- **Intent:** builder decision 2025-09-27: slot-based equipment and consumables ship in this run. One engine mechanism serves two approved-but-unrealized requirements and the builder's consumables ask:
  - **Requirements served:** FR-3's "…and equipment" formula input; FR-9's armorCasting teeth.
  - **What ships:**
    - deterministic pack-declared item effects: ability/save grants that add, reserved-stat grants exposed to formulas as `gear-*` variables, and consumable heal;
    - a slot-based equip/unequip/use verb family over the existing inventory stacks;
    - armorCasting enforcement at slot cast time;
    - combat use with a heal cap and settlement back to the inventory;
    - snapshots carrying `equipped` / `itemsUsed` / `maxHp`;
    - one journeyed proof, end to end.
- **Governing principle unchanged:** rules are data. Armor, weapons and consumables are pack content. The engine gains the mechanics, never the rules, and never hard-codes a stat's direction (Q2).
- **Sessions:** S1 contract gate (DB author re-entry; both contract files) → S2 TS mirror + validator + heal + `gear-*` DSL → S3 (character verbs + cast gate + parse-once item index) ∥ S4 (pipeline pass-through + themes) → S5 (combat: profiles, use, clamp, settlement, snapshots) → S6 (journey + README).
- **Replanned:** REPLAN-EC-01 (2026-09-28), before any dispatch; REPLAN-EC-02 (2026-09-28, dispatch HEAD `0ee3974`, while S01 runs), applying the Archivist recheck R-2..R-11. See *Planning completeness review* below.

## Session Status

| # | Session | Modules | Owns | Status | Checkpoint | Completed | Notes |
|---|---------|---------|------|--------|-----------|-----------|-------|
| 01 | Contract gate — schema v1.4 (DB re-entry) | M01 contracts | `src/schema/contracts/pack.schema.json`, `src/schema/contracts/snapshots.schema.json`, `program/Ruleswright/specs/database.md` | **done** | 3/3 (`a6a3334`, `c32d2d2`, `a409ef4`; Orchestrator format residual `8668c53`) | 2026-09-28 | Author role; grid S01 precedent; now owns the snapshots contract too (F-E4). Receive gates: typecheck 0, lint 0, format 0 (after residual), 564/564 |
| 02 | TS mirror + validator + heal registry + `gear-*` DSL | M01, M02 | `src/schema/pack.ts`, `src/schema/artifacts.ts`, `src/schema/validate/sections/content.ts`, `src/schema/validate/sections/root.ts`, `src/schema/validate/index.ts`, `src/schema/validate/context.ts`, `src/schema/validate/collect.ts`, `src/core/dsl/registry.ts`, `src/core/dsl/effect.ts`, `src/core/dsl/formula.ts`, `tests/schema/validate.test.ts`, `tests/core/dsl/checker.test.ts`, `tests/core/dsl/effect.test.ts`, `tests/core/dsl/formula.test.ts` | **done** | 2/2 (`0f1ff65`, `52df545`) | 2026-09-28 | Receive (after `pnpm build`): typecheck 0, lint 0, format 0, build 0, isolation 0, security 0, **584/584**; arch delta `f1563b1`. Serial after S1; owns the registry membership re-key (checker.test.ts:13-26) |
| 03 | Character verbs: equip/unequip/use + grants + armorCasting gate | M03 | `src/runtime/equipment.ts`, `src/runtime/character.ts`, `src/runtime/pools.ts`, `src/runtime/inventory.ts`, `src/runtime/runtime.ts`, `src/runtime/index.ts`, `tests/runtime/fixtures/**`, `tests/runtime/equipment.test.ts`, `tests/runtime/character.test.ts`, `tests/runtime/pools.test.ts`, `tests/runtime/inventory.test.ts` | **done** | 4/4 (`09fb6a7`, `8dcfe41`, `960ee39`, `d9f2be6`) | 2026-09-28 | Receive: lease gates tests/runtime+tests/snapshots 223/223, typecheck 0, lease lint/format 0; arch `643fd76`; whole-repo at W3 close. | Concurrent with S04 (disjoint); owns the shared runtime fixtures; must not run `pnpm build`; exports the pure `equippedUnits` helper (R-5) |
| 04 | Themes + equipSlots pipeline pass-through | M04 | `src/compiler/theme.ts`, `src/compiler/pipeline.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `tests/compiler/pipeline.test.ts`, `tests/compiler/coverage-floor.test.ts` | **done** | 4/4 (`4749543`, `926f4c6`, `22fc990`, `90dbfc7`) | 2026-09-28 | W3-close whole-repo (after build): typecheck 0, lint 0, format 0, build 0, isolation 0, security 0, **623/623 (36 files)**; arch `7c3db75`. | Concurrent with S03 (disjoint); must not run `pnpm build` |
| 05 | Combat integration: profiles, fight.use, clamp, settlement, snapshots | M03 | `src/runtime/combat/combat.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/combat/action-economy.ts`, `src/runtime/character-profile.ts`, `src/runtime/snapshots.ts`, `src/runtime/runtime.ts`, `src/runtime/index.ts`, `tests/runtime/combat/**`, `tests/snapshots/combat.test.ts`, `tests/snapshots/character.test.ts` | **done** | 5/5 (`14c01dc`, `1af3945`, `31540b0`, `4bfcec4`, `15ef2df`) | 2026-09-28 | Receive (after build): typecheck 0, lint 0, format 0, build 0, isolation 0, security 0, **651/651 (36 files)**; arch `7a479e6`. | After S03 and S04; re-key owner for `tests/snapshots/combat.test.ts:102`; re-verifies loot-journey:126 at ck5; `checkPackDsl` item-`use` check (R-7) |
| 06 | Journey + README | proofs, docs | `tests/proofs/equipment-journey.test.ts`, `tests/proofs/docs-run.test.ts`, `README.md` | **done** | 2/2 (`dd6557c`, `e5e4846`) | 2026-09-28 | FINAL receive (after build): typecheck 0, lint 0, format 0, build 0, isolation 0, security 0, **661/661 (37 files)**; README ```ts count 4 (docs-run pin unchanged). | Last; journey first, docs pin inside the README checkpoint |

Checkpoint counts:

| Session | Commit checkpoints | Read-only ck0 |
|---|---|---|
| S1 | 3 | — |
| S2 | 2 | yes |
| S3 | 4 | — |
| S4 | 4 | — |
| S5 | 5 | yes |
| S6 | 2 | — |

## Wave Plan

| Wave | Sessions | Why concurrent |
|---|---|---|
| W1 | S01 | Solo: the contract gate. Every later session reads its committed artifacts |
| W2 | S02 | Solo: the mirror, validator and DSL changes consume S1's contract. S03 and S04 both need its types and the `gear-*` evaluation default |
| W3 | S03 ∥ S04 | `Owns` are literally disjoint (see below). S04's `gear-*` formula strings evaluate identically with or without S03, because S02's unbound-is-0 rule applies. Neither session runs `pnpm build`, since they share the working tree; Orchestrator builds at the wave receive |
| W4 | S05 | Solo: composes S03's verbs and S04's content into combat. Re-checks CA-EG2/EG4/EG5/EG6 against the landed producers at ck0 |
| W5 | S06 | Solo: the journey rides every landed capability; README gates |

**S03 ∥ S04 disjointness check, path by path (REPLAN-EC-01):**
- **S03:** `src/runtime/{equipment,character,pools,inventory,runtime,index}.ts`, `tests/runtime/fixtures/**`, `tests/runtime/{equipment,character,pools,inventory}.test.ts`.
- **S04:** `src/compiler/{theme,pipeline}.ts`, `src/compiler/themes/{dark-fantasy,zombie-urban,wyldwood}.json`, `tests/compiler/{pipeline,coverage-floor}.test.ts`.
- **Result:** no shared path; no glob of one matches a path of the other (`src/runtime/**` vs `src/compiler/**`; `tests/runtime/**` vs `tests/compiler/**`).
- **Serial reuse, which is not a race:**
  - `src/runtime/runtime.ts` and `src/runtime/index.ts`: S03 (W3) → S05 (W4).
  - `src/schema/contracts/*`: S01 only.
- **Shared-assertion windows:** none. Every pin a session breaks is re-keyed in that same session (see *Pin re-key owners*).
- **Shared working-tree hazard (not a lease overlap):** each session's gates read files the other writes (S03's `tests/runtime/combat/**` generate packs from S04's themes; S04's proofs import S03's `src/runtime/**`). Values are unchanged by design, but a mid-checkpoint state can go red. Both directions are reported, not fixed (Verification Baseline hazard (e), R-6).

## Dependency Graph

```
S01 ──> S02 ──┬──> S03 ──┐
              │          ├──> S05 ──> S06
              └──> S04 ──┘
```

## Architecture Reference (feature-specific; full config in PROGRAM-CONFIG)

- **Dependency flow unchanged:** `runtime → {schema, core}`, `compiler → {schema, core}`. M03 never imports M04. No new module; `schema` still imports no core value. `RESERVED_GRANT_KEYS` (schema) and `EQUIPMENT_SCALARS` (core) are declared separately, and a test pins their correspondence.
- **New symbols by module:**
  - **M01:** `ItemDef.grants/slots/use`; `Pack.equipSlots`; `RESERVED_GRANT_KEYS`; validator `checkEquipSlots` / `checkItemGrants` / `checkItemSlots`; `Ctx.equipSlotNames`; snapshot contract fields.
  - **M02:** registry `heal`; `execHeal`; `EQUIPMENT_SCALARS`, with an unbound one evaluating to 0.
  - **M03:**
    - `equipment.ts` (a runtime leaf: value-imports only core, `./errors`, `./conditions`, R-11): `equippedUnits` (pure; the one equipped-unit rule, R-5), `equippedGrants`, `equipmentView`, `equipmentScope`, `equipItem`, `unequipItem`, `useItem`;
    - the cast gate in `pools.ts`;
    - the `item-equipped` drop guard;
    - `PackIndex.itemEffects`;
    - `CombatantProfile.maxHp?`;
    - `CombatantState.maxHp/itemBalances/itemsUsed`;
    - `EconomyBalances.items?`;
    - `Combat.use` (gate 0 = `declare`'s phase/turn rule, R-3);
    - `settleItemUses`;
    - `checkPackDsl` checks item `use` (R-7);
    - the snapshot fields.
  - **M04:** `ThemeTemplate.equipSlots?`; the pipeline pass-through; theme content.
- **`MutationRequest` gains no field:** a heal is `damage` with a negative amount. Combat's `applyMutation` gains the `maxHp` clamp for negative amounts (never lowering hp, R-2), and the `hpBefore` display is captured before the mutation.
- **Import graph:** `pools.ts` and `inventory.ts` gain one runtime value import, `equipment.ts`, which is a leaf, so no new cycle (R-11). `pools.ts`'s header docstring is updated to say so.

## Scope Summary (modules affected, indexed by ID)

| ID | Module | Affected |
|---|---|---|
| M01 | Schema surface | Contract v1.4 in pack + snapshots (S01, DB role); mirror types + validator (S02) |
| M02 | Core mechanics | Registry 12 → 13 (`heal`); `execHeal`; `gear-*` checker admission (formulas section only) and the unbound-is-0 evaluation (S02) |
| M03 | Runtime | Equipment verbs, composition, cast gate, drop guard, item index (S03); profiles, combat use, clamp, settlement, snapshots (S05) |
| M04 | Compiler | `equipSlots` pass-through (theme.ts/pipeline.ts) and three themes' content + formulas (S04) |
| M05 | Root entry | Untouched: surface exports ride the existing barrels |
| — | Out of scope (unchanged, inherited) | Movement verb; DD17a spells-as-actions/burst bridge; browser CI leg; cleanup C6 (`parsePackEffects`); settlement of pools/boundSlots after combat (no precedent exists; not required by this feature) |

## Design Decisions

| # | Decision | Rationale |
|---|---|---|
| DD-EG1 | **Slot-based equipment** (builder decision). The pack declares `equipSlots: string[]` (≥1, kebab, unique; slot ids are their own vocabulary, not global artifact ids). `ItemDef.slots` lists the declared slots the item **may** be equipped into; one equip places it in one of them. `CharacterState.equipped?: {slot, itemId}[]` holds one item per slot. It is **absent until the first equip** (absent = `[]`). Equip gates, in order: `unknown-item` → `not-equippable` → `unknown-slot` → `slot-not-allowed` → `slot-occupied` → `item-not-held` (held qty must exceed the slots already holding the id). `dropItem` rejects `item-equipped` rather than strand an equipped unit | Builder's choice; the declared vocabulary keeps the engine theme-agnostic. Lazy absence avoids the F-E5 red window. The slot-eligibility and drop guards keep grants from items the character no longer holds out of the math (REPLAN-EC-01 gap P-3) |
| DD-EG2 | **Grants are pack-visible equipment values the pack's formulas reference** (Orchestrator decision F-E2 option (b); FR-3; Q2). `ItemDef.grants?: Record<string, integer>`, no dice. **Ability and save keys add** to the base stat; a key naming both adds to both. **Reserved keys** `hp`/`ac`/`initiative`/`armor` are summed over equipped items and exposed to `formulas` entries **only**, as `gear-hp`/`gear-ac`/`gear-initiative`/`gear-armor`: 0 with nothing equipped, and 0 wherever unbound (statblocks). The pack's formula decides direction; all three themes are descending, so their formulas read `… - gear-ac`. `stats` ids may not use a `gear-*` name | The engine never hard-codes a stat's direction, so descending AC stays expressible. Nothing equipped ⇒ byte-identical values everywhere. The unbound-is-0 rule means no eval site outside the character path needs to change, which is what lets S03 ∥ S04 stay concurrent |
| DD-EG3 | **Consumables are finite-count effect-bearing items.** `ItemDef.use?: DslString` (effect DSL), parsed once at load into `PackIndex.itemEffects` (S03). `useItem` consumes one unit (the entry leaves at 0), then executes. Rejections: `not-consumable`, and the inventory family (`unknown-item`, `item-not-held`, `insufficient-qty`) | Reuses the existing inventory rejection vocabulary; parse-once (CA-2) |
| DD-EG4 | **Heal is a new registry entry** `heal(formula)`, kind `effect`: the sanctioned extension of the frozen registry (schema event, bundled in contract v1.4). It executes as a `damage` request with a **negative amount**. Cap: character side, `derived().hp` with grants; combat, `CombatantState.maxHp`. **Heal rule (R-2):** `after = current >= cap ? current : min(cap, current + heal)`. A heal never raises hp above the cap **and never lowers hp already above it** (legal after an unequip, and at fight start). The `damage:applied` anatomy stays unchanged; `amount` is the honest negative total, and `hp: "before→after"` shows the actual values (`X→X` when nothing changes) | Verified mechanic (resolve.ts documents negative amounts). Honours "never above the derived hp cap" without turning the cap into a "set to" (REPLAN-EC-02) |
| DD-EG5 | **armorCasting teeth at slot cast time.** An item is armor iff its `grants` include `armor`. `castSpell` (slot/vancian casting, the only cast verb in v1) rejects `armor-not-castable` when any equipped armor's `kind` is missing from every one of the character's classes' `armorCasting`. The gate sits before the slot lookup. **Scope: slot casting only.** Point-pool spells have no cast verb (DD17a), so zombie-urban and wyldwood never reach the gate; their armor content is validation-only coverage. Documented in database.md and the README | FR-9: who may cast in what armor is pack data (F-E8) |
| DD-EG6 | **Combat `use`:** `fight.use(itemId, {target?})` (default target: the actor itself). Charges come from host-stated `balances.items` (held qty at start, mirroring pools/boundSlots). `CombatantState.itemBalances` is fixed and `itemsUsed` counts spent units; remaining = balance − used. Gates: **0. phase/turn, exactly as `declare` (`combat.ts:358`: `combat-over` throws, no event; the user is the active combatant)** (R-3) → `unknown-item` → `not-consumable` → restriction → target → `no-charges`. It is not a slot action. The synthetic BoundAction is **item-only** (F-E15). Events carry `why.rule: content.items.<id>` | Mirrors the boundSlots combat-transient discipline without a new cost kind |
| DD-EG6a | **Settlement (F-E10):** `settleItemUses(runtime, character, fight, combatantId?)`, the host-called inverse of `profileFromCharacter` in `character-profile.ts`. It requires `combat-over` (else `combat-not-over`), validates everything first (held qty ≥ used, and the drop guard via S03's pure `equippedUnits`, R-5), then drops the used units via `dropItem`, emits `item:settled`, and zeroes that combatant's `itemsUsed`, so a second call is a no-op. **v1 limits, documented (docstring + README):** (1) a fight abandoned before `combat-over` does not settle (the host may `drop`); (2) **idempotence is per live fight object (R-4):** a snapshot taken before settlement still carries the spend, so restoring it and settling again drops twice. The host settles each fight once. No contract field is added; restored fights are not refused (the journey legitimately resumes a fight from a snapshot and then settles it) | Precedent checked: combat never writes back to character state; pools/boundSlots are host-owned balances with no settlement. An explicit host verb keeps that discipline and makes "exactly one unit per use" mechanical and testable |
| DD-EG7 | **Snapshot fields** (contract v1.4, S01; runtime S05):<br>• `characterState.equipped` (additive-optional) is emitted only when state carries it, and restored only when present. Restore validates each entry (item, slot, eligibility, uniqueness, held) with E-SNAP-01, all cards before any application.<br>• Inventory restore stays verbatim (the documented CA-01 divergence).<br>• Combatant `itemsUsed` = **spent** count. Fight-start balances come from the host's re-stated request; the snapshot wins for the spend. Over-spend or an unknown id → E-SNAP-01.<br>• Combatant `maxHp`: the snapshot wins, else `profile.maxHp`, else `max(0, profile.hp)` (R-9).<br>• `slotsUsed` stays as-is (a remaining per-turn ledger) | Additive minor per the Version Registry. Presence-preserving keeps every existing round-trip pin green. "Spent" is required because the host re-states fight-start balances (F-E12) |
| DD-EG8 | **Themes (coverage-floor style; corrected per F-E7).** All three gain `equipSlots` and the `gear-*` formula terms.<br>• **dark-fantasy:** `warded-mail` kind changes `armor` → `mail`, with `{ac:2, armor:1}` in `body`; the existing `oaken-cudgel` gains `{might:1}` in `main-hand`.<br>• **zombie-urban:** the existing `riot-plate` gains `{ac:1, armor:1}` in `body`; the existing `fire-axe` gains `{might:1}` in `main-hand`; `med-kit` (in `street-remnants`) gains `use: "heal(2 + vigor)"`.<br>• **wyldwood:** the existing `hedge-charm` gains `{ac:1, armor:1}` in `charm`; the item count stays 6.<br>No new item ids | The smallest content exercising every capability. It reuses existing ids, so no duplicates, no loot-table churn, and the `themes.test.ts:74` pin stays at 6 (F-E6) |
| DD-EG9 | **Journey proof (S06).** Dist build, plus a mechanical dist-freshness assertion.<br>• **zombie-urban leg** (seed 42): equip → exact ac/might shift → out-of-combat heal (clamp) → combat `fight.use` (clamp, provenance) → mid-fight snapshot/restore (`itemsUsed`, `maxHp`) → `no-charges` → settlement (inventory asserted after the fight) → character snapshot and tamper refusal.<br>• **dark-fantasy leg:** warden (mail legal) and hexer (leather; rejection, then unequip → legal).<br>No mocked boundary | The first-narrow-journey rule. The armorCasting leg needs slot casting, which only dark-fantasy has (F-E8) |

## Verification Baseline

- **Effective commands** (from PROGRAM-CONFIG, verified at plan HEAD `dadf461`): `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build` · `pnpm check:isolation` · `pnpm check:security` · `pnpm format:check` · `pnpm exec vitest run <path>`.
  - `pnpm exec vitest run <path>` is **the only working narrow form**: `npx vitest run` fails in this environment (DD14e), and `pnpm test -- <pattern>` does NOT filter.
- **Evidence at plan HEAD** (grid-combat close; Orchestrator's observation, inherited and not re-run by REPLAN-EC-01): typecheck 0 · lint 0 · **564/564 across 35 files** · build 0 (24 dist files) · isolation 0 · security 0 · format:check 0 · proofs 28/28.
- **Dist freshness (F-E13):**
  - `tests/proofs/loot-journey.test.ts` imports `../../dist/*` without building, and `dist/` is gitignored.
  - **Orchestrator runs `pnpm build` before every whole-suite receive from S02 onward** (R-10: S02 changes `src/core/**`, which `tsup` bundles into `dist/runtime.*` and `dist/compiler.*` with `splitting: false`, so W2's loot-journey would otherwise run against a stale dist). For W3 that is after both S03 and S04 land, because they share the working tree and neither may build mid-wave.
  - S05 (ck5) and S06 (ck1) build inside their solo waves. S06's journey asserts the dist exports the new symbols.
  - `docs-run` and `grid-journey` import `src/` and need no build.
- **Known hazards carried forward:**
  - **(a) docs-run pin.** `tests/proofs/docs-run.test.ts:49` pins **4** ```ts blocks and typechecks them. S06 owns both the README and the pin file. Prefer fence discipline, so the pin stays at 4.
  - **(b) Registry pin.** `tests/core/dsl/checker.test.ts:13-26` pins the registry membership (12). Re-keying it to 13 is **S02's** duty (ck1). No E-FORM-01 message changes: the only E-FORM-01 assertion (`:81-86`) matches `/offset/` (F-E1).
  - **(c) Receive gates.** Whole-repo fast gates are Orchestrator's receive check (promoted convention). Role-scoped sessions run lease-scoped gates.
  - **(d) Resumed legs.** Journey tests use a fresh event sink on resumed fight legs (DD17e).
  - **(e) Shared working tree in W3, both directions (R-6).** S03 and S04 share the working tree.
    - S04's proofs (`docs-run`, `grid-journey`) import S03's in-progress `src/runtime/**`.
    - S03's `tests/runtime/` gates include `tests/runtime/combat/{combat,character-profile}.test.ts`, which generate packs from S04's in-progress `src/compiler/themes/*.json`.
    - In either direction, a red traced to the other session's area is **reported, not fixed**. The session re-runs after the other's checkpoint commit lands and names a persistent red in its handoff. Orchestrator's receive gates, run after both land, are the evidence of record.
  - **(f) Inherited, unverified: CI dist gap.** CI's `test` job (`ci.yml:43-45`) runs `pnpm test` with no `pnpm build`, and dist-importing journeys (loot-journey; equipment-journey after S06) need `dist/`. Only the proofs job builds first (`ci.yml:80-85`). No CI run history was inspected, so the job's actual state is unknown.
    - **Deferred:** it is outside this feature's lease set, and local receive builds cover the feature's proofs.
    - **Owner:** a follow-up CI correction named in this run's Final Report.
    - **Resumption condition:** CI evidence of a red test job, or the next CI-maintenance session.
    - **Blocks:** no CAP in this feature, since local proofs build first.
- **Pin re-key owners** (every pin changed by any session):

  | Pin | Change | Owner (lease covers it) |
  |---|---|---|
  | `tests/core/dsl/checker.test.ts:13-26` | registry membership 12→13 | S02 ck1 |
  | `tests/snapshots/combat.test.ts:102` | combatant keys gain `maxHp` | S05 ck4 |
  | `tests/runtime/combat/**` | any whole-profile equality gaining `maxHp` | S05 ck1 |
  | `tests/proofs/docs-run.test.ts:49` | only if S06 adds a ```ts block | S06 ck2 |

  Confirmed unchanged:
  - `tests/compiler/themes.test.ts:74` (wyldwood stays at 6);
  - `tests/snapshots/character.test.ts:45` (`equipped` key absent for never-equipped characters);
  - `tests/snapshots/character.test.ts:87,165` and `tests/proofs/loot-journey.test.ts:126` (presence-preserving; S05 ck5 re-verifies loot-journey against a fresh dist; S06 re-runs all proofs);
  - `formula.test.ts:258` (self-comparison);
  - `tests/schema/registry.test.ts` (no rule id added);
  - docs-run block-03 (`hp: 27, ac: 12`) and block-04 (`grave-ward`), because `gear-*` = 0 when nothing is equipped.

  No test pins a pack hash or a theme formula string (grep at plan HEAD).
- **Unverified until execution:** exact heal roll values for the journey (S06 reads S04/S05's handoffs at ck0); the action-economy restriction gate's applicability to the synthetic item action (S05 reads it at ck0; not inspected by the review).

## Capability Readiness

| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|----|--------------------------------|---------------------------------|------------------------|--------------------------------|--------|-------------------------|-------------------------------|
| CAP-E1 | A pack declares equipment/consumable items and equip slots; bad declarations are rejected at load | ItemDef v1.4 fields, `equipSlots` (S01 ck1); mirror + validator (S02 ck2) | CA-EG1 | S02 ck2 | **verified** (S02 ck2 `52df545`) | `tests/schema/validate.test.ts` 12 new validator tests (isolated pack, real `packDslChecker`), R-8 negative control; whole suite 584/584 at receive | Runtime re-check of item `use` in `checkPackDsl`: S05 ck1 (R-7) |
| CAP-E2 | Equip/unequip over slot state; grants compose into `derived()` (ability/save add; `gear-*` via the pack's formulas) | `gear-*` admission + unbound-is-0 (S02 ck1); `equipmentView` + composition (S03 ck2); theme formulas (S04 ck2–4) | CA-EG1, CA-EG2 | S03 ck2 (fixtures); S06 ck1 (generated pack) | **verified** S03 ck2 `8dcfe41` + S06 ck1 `dd6557c` | `tests/runtime/character.test.ts` "CAP-E2 closing proof": ascending 10→12→base, descending 11→9→base, gear-hp 20→22, ability add 4→5; nothing-equipped identical; runtime+snapshots 223/223 at receive | — |
| CAP-E3 | armorCasting enforced at **slot** cast time | armor marker (S01); gate (S03 ck3); dark-fantasy warden/mail + hexer/leather (S04 ck2) | CA-EG3 | S03 ck3; S06 ck1 (dark-fantasy leg) | **verified** S03 ck3 `960ee39` + S06 ck1 `dd6557c` (dark-fantasy: hexer refused, unequip cast, warden casts in mail) | `tests/runtime/pools.test.ts`: rejection with no state/event change, cast after unequip, listed kind casts, non-armor never blocks; negative control failed as expected | Point-pool casting is out of scope (DD-EG5) |
| CAP-E4 | A consumable heals out of combat (`useItem`) and in combat (`fight.use`), capped at max hp and never lowering hp already above it (R-2); `fight.use` only while the fight is live, by the active combatant (R-3) | `heal` (S02 ck1); `itemEffects` + `useItem` (S03 ck3); `maxHp` + heal rule + `use()` gate 0 (S05 ck1–2); med-kit (S04 ck3) | CA-EG4, CA-EG5 | S03 ck3 (character side, incl. over-cap); S05 ck2 (combat, incl. over-cap and use-after-over); S06 ck1 | **verified** S03 ck3, S05 ck2, S06 ck1 `dd6557c` (med-kit heals 2: `23→25`, combat `26→27` clamp, `27→27`) | `equipment.test.ts` (character, over-cap `22→22`); `tests/runtime/combat/combat.test.ts` "fight.use": `4→9`, `9→12` clamp, `12→12`, over-cap `15→15`, use after combat-over throws with no event, maxHp floor 0; negative controls failed as expected | — |
| CAP-E5 | Snapshots carry `equipped`, `itemsUsed`, `maxHp`; restore fails closed | contract (S01 ck2); serializer/restore (S05 ck4) | CA-EG6 | S05 ck4; S06 ck1 | **verified** S05 ck4 + S06 ck1 `dd6557c` (itemsUsed/maxHp mid-fight round-trip; equipped round-trip; tamper refused) | `tests/snapshots/{character,combat}.test.ts`: equipped round-trip lossless + fail-closed restore (all cards, nothing applied); itemsUsed spend + maxHp round-trip lossless; combat key pin re-keyed `[conditions,hp,id,maxHp,slotsUsed]`; loot-journey 7/7 on fresh dist | — |
| CAP-E6 | All three themes carry the new content and gear formulas; `equipSlots` reaches the pack; packs validate; floor green | pass-through (S04 ck1); themes (S04 ck2–4) | CA-EG1, CA-EG2, CA-EG3 | S04 ck4 | **verified** S04 ck4 `90dbfc7` | `tests/compiler/pipeline.test.ts` (3 pass-through tests; negative control failed as expected), `tests/compiler/coverage-floor.test.ts` (per-theme equipment + CA-EG3 pairing; zero stage-8 cards ×3); docs-run block-03 `hp: 27, ac: 12` unchanged; W3-close whole suite 623/623 after build | — |
| CAP-E7 | **First narrow journey** end to end (DD-EG9) | all above | all | S06 ck1 | **verified** S06 ck1 `dd6557c` | `tests/proofs/equipment-journey.test.ts` (S06 ck1 `dd6557c`, dist, seed 42): 10/10 — freshness, zombie-urban steps 1–8, dark-fantasy 9–11; no mocked boundary; negative control failed as expected; whole suite 661/661 at receive | — |
| CAP-E8 | A combat use ends with exactly one unit removed from the character's inventory | ledger (S05 ck2); `settleItemUses` (S05 ck3); drop guard + pure `equippedUnits` (S03 ck1, R-5) | CA-EG5 | S05 ck3; S06 ck1 (inventory asserted after the fight) | **verified** S05 ck3 + S06 ck1 `dd6557c` (3 − 1 − 2 → entry gone; second settle `[]`) | `tests/runtime/combat/character-profile.test.ts`: med-kit x3, 2 uses → qty 1, `[item:dropped, item:settled]`, second call `[]`; live fight `combat-not-over`; all-at-once pre-check; `item-equipped` guard; negative control failed as expected | Documented v1 limit (R-4): idempotent per live fight object; settle once per fight (DD-EG6a, README) |

**Production paths:**
- **CAP-E2:** `Character.derived()` → `equipmentView` → `reserveValue(…, gear)` → pack `formulas`.
- **CAP-E4 (combat):** `fight.use` → `resolve` → `executeAgainst` → `execHeal` → `applyMutation` (clamp) → `damage:applied`.
- **CAP-E8:** `settleItemUses` → `dropItem` → `item:settled`.
- **CAP-E5:** `serializeCharacter`/`restoreCharacter` and `serializeCombat`/`deserializeCombat`.
- **Restart behavior:** CAP-E5 carries it; S06 steps 6 and 8.

## Contract Agreements

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|----|------------------------------|--------------------------------|-----------------------|------------------------------------------|-----------|----------|------------------------------------|
| CA-EG1 | ItemDef admits `grants` (keys ∈ abilities ∪ saves ∪ {hp, ac, initiative, armor}; integer values; `armor` ≥ 1), `slots` (non-empty unique, each ∈ `equipSlots`), `use` (effect DSL). Root optional `equipSlots` (≥1, unique, kebab; not global ids). `stats` ids ≠ `gear-*` | pack.schema.json (S01) → validator/context/collect (S02) → mirror (S02) → themes (S04) → runtime verbs (S03) → runtime re-check `checkPackDsl` item `use` (S05 ck1, R-7) | Additive-optional; schemaVersion 1; structural → E-SCHEMA-01, reference → E-REF-01. Validator context keeps **absent** `equipSlots` (empty set → slotted items get E-REF-01) distinct from **unreadable** (null → item slot refs skipped, no cascade) (R-8) | S01 ck1 → S02 ck2 (tests, incl. malformed-vs-absent); S05 ck1 (`checkPackDsl`) | agreed | contract **landed** S01 ck1 `a6a3334` (fmt `8668c53`), incl. `grants.properties.armor {integer, minimum 1}`; mirror/validator **landed** S02 ck2 `52df545` | **passed** S02 ck2; consumers: S04 themes **passed**, S03 verbs **passed**, S05 `checkPackDsl` item-`use` **passed** S05 ck1 (R-7) |
| CA-EG2 | **Grant semantics (F-E2 (b)):** ability/save grants ADD; reserved grants are exposed only to `formulas` as `gear-hp/ac/initiative/armor` (sum over equipped; 0 when none or unbound). The engine applies no direction. Equipping never heals; unequip never clamps | contract (S01) → formula checker/eval (S02 ck1) → `equipmentView` + `derived()`/pool caps (S03 ck2) → theme formulas (S04) → `profileFromCharacter` abilities/saves/initiative/maxHp (S05 ck1) | One composition site (`equipment.ts`). Build/level-set/restore hp init stays at base (gear not passed) | S02 ck1; S03 ck2 (both AC directions); S05 ck1 (profile); S06 ck1 (generated pack) | agreed | contract S01; DSL S02; composition S03 ck2; profile leg **landed** S05 ck1 `14c01dc` (`profileFromCharacter` over `equipmentView`, `maxHp = derived().hp`) | DSL/composition **passed**; profile **passed** S05 ck1 (riot-plate ac 11→10, fire-axe might 10→11 seen by combat); generated-pack journey **passed** (S06 ck1 `dd6557c`) |
| CA-EG3 | Armor marker: an item is armor iff `grants` has `armor`. A **slot** cast while armor-equipped requires a character class listing the item's `kind` in `armorCasting` | `pools.ts` `castSpell` → RuntimeRuleError | `armor-not-castable`, no state change, gate before the slot lookup; monsters and point-pool spells unaffected | S03 ck3; S06 ck1 (dark-fantasy) | agreed | **landed** S03 ck3 `960ee39` (`armorBlockingCast` in `pools.ts`, gate after `unknown-spell`, before slot lookup); content pairing S04 ck2 `926f4c6` | **passed** S03 ck3 (`pools.test.ts`); journey **passed** (S06 ck1 `dd6557c`) |
| CA-EG4 | `heal(formula)` = an effect statement → a negative-amount `damage` request; `why.rolls` carry the roll; `damage:applied` anatomy unchanged. Cap: character = derived hp with grants; combat = `maxHp`. **Rule (R-2):** `after = current >= cap ? current : min(cap, current + heal)`, never above the cap and never lowering hp already above it. `hp` display shows the actual values (`X→X` when unchanged; `hpBefore` captured before the mutation) | registry/`execHeal` (S02) → `useItem` (S03) / `applyMutation` (S05) | Registry 12→13; membership pin re-keyed by S02. **No E-FORM-01 message change** (F-E1). Combat `maxHp` fallback floored at 0 (R-9) | S02 ck1 → S03 ck3 (over-cap test) → S05 ck2 (over-cap test) | agreed | registry note **landed** S01 ck3 `a409ef4` (database.md §formulas, row 5); executor **landed** S02 ck1 `0f1ff65` (`REGISTRY.heal`, `execHeal` negates whole RollResult — values/modifier/total, purpose `heal`) | DSL **passed** S02 ck1; character clamp **passed** S03 ck3; combat clamp **passed** S05 ck2 (`applyMutation` R-2 rule, pre-mutation before-value); journey **passed** (S06 ck1 `dd6557c`) |
| CA-EG5 | `useItem` and `fight.use` each consume exactly one unit/charge; the last unit removes the entry. A combat use ends with the inventory reduced by exactly the units used (settlement). Rejections: `unknown-item`, `item-not-held`, `insufficient-qty`, `not-consumable`, `no-charges`, `combat-not-over`, `item-equipped`; `fight.use` after `combat-over` throws like `declare` (gate 0, R-3) | `useItem` (S03) · `balances.items` → `itemBalances`/`itemsUsed` → `Combat.use` (S05) → `settleItemUses` → `equippedUnits` pre-check → `dropItem` (S05) | Balances are host-stated (the pools/boundSlots precedent); the fight never touches character state; settlement is host-called, all-or-nothing, idempotent **per live fight object** (R-4 v1 limit). One equipped-unit rule, `equippedUnits` (S03), shared by `dropItem`, `useItem` and settlement (R-5) | S03 ck1 (`equippedUnits`), ck3; S05 ck2 (use-after-over test), ck3; S06 ck1 | agreed | character side **landed** S03 ck1/ck3; combat side **landed** S05 ck2 (`Combat.use`, gate 0 throw + `declare:rejected` kinds `unknown-item`/`not-consumable`/`unknown-target`/`no-charges`) and ck3 (`settleItemUses`, `combat-not-over`, all-at-once pre-check via `equippedUnits`) | character **passed** S03 ck3; combat + settlement **passed** S05 ck2/ck3; journey **passed** (S06 ck1 `dd6557c`) |
| CA-EG6 | Character snapshot `equipped` (presence-preserving; validated restore; slot uniqueness enforced by S05's restore, not the schema, R-9a). Combatant `itemsUsed` = spent (host balances + snapshot spend; snapshot wins for spend) and `maxHp` (snapshot → profile.maxHp → max(0, profile.hp), R-9) | snapshots.schema.json (S01 ck2) → `snapshots.ts` (S05 ck4) | Additive-optional; all refusal cards before any application; inventory verbatim (CA-01 divergence) | S01 ck2 → S05 ck4 (+ ck5 loot-journey re-verify) → S06 ck1 | agreed | contract **landed** S01 ck2 `c32d2d2`; serializer/restore **landed** S05 ck4 `4bfcec4` | **passed** S05 ck4 (round-trips + fail-closed restore) and ck5 (loot-journey `:126` 7/7 on fresh dist); journey **passed** (S06 ck1 `dd6557c`) |

**Provisional-producer rule (applies to every CA row above):** all producers land inside this feature, so every mapping is provisional against its named producer checkpoint. Orchestrator re-checks each mapping against the actual landed producer before dispatching the dependent session:
- S02 ck0 re-checks the S01 contract;
- S05 ck0 re-checks CA-EG2/EG4/EG5/EG6 against S01, S03 and S04;
- S06 reads the S04/S05 handoff numbers at ck0.

A dependent session is dispatched against the amended CA text.

## Planning completeness review (2026-09-28)

Source: `.program/results/ARCHIVIST-PREFLIGHT.equipment-consumables.result.md`. REPLAN-EC-01 verified every finding against the source at `dadf461` before applying it, and **no finding was disproved**.

| Finding | Verified against | Disposition |
|---|---|---|
| F-E1 — false E-FORM-01 premise | `checker.ts` (12 lines); `checker.test.ts:81-86` matches `/offset/` | **Applied.** The premise was removed from CA-EG4, the Baseline hazard (b), the "Unverified" line and S02; S02 re-keys only the membership list; `EFFECT_VOCABULARY` is unchanged |
| F-E2 — grant composition broken | Theme formulas omit their stat (`dark-fantasy.json:105-107`); `character.ts:171-178`; `character-profile.ts` base; `formula.ts` checker ctx (`:550-565`) has no scalars | **Applied (Orchestrator decision (b)).** See DD-EG2 and CA-EG1/EG2. The `gear-*` scheme fits the grammar (`shared.ts` `isNameChar` admits `-`). S02 owns checker admission (formulas section only) and unbound-is-0 evaluation; S03 does composition; S04 does formulas; S05 does the profile (abilities/saves/initiative); S06 checks the journey. Closing proof: S03 ck2, ascending and descending |
| F-E3 — pipeline drops `equipSlots` | `pipeline.ts:140-150`; `theme.ts:45-66`; `theme-loader.ts:13-19` casts | **Applied.** S04 owns `theme.ts`, `pipeline.ts` and `pipeline.test.ts`; ck1 is the pass-through (spatial precedent); the "zero pipeline changes" text is removed |
| F-E4 — snapshot contract closed | `snapshots.schema.json` `characterState` and combatant are `additionalProperties:false` | **Applied.** S01 owns `snapshots.schema.json` (ck2); database.md §Snapshot Envelopes and Version Registry row 5 name both files; the false S02 "position precedent" text is removed |
| F-E5 — planned red window | `snapshots.ts:140-156`, `:296-327`; `tests/snapshots/character.test.ts:87,165`; `loot-journey.test.ts:126` | **Applied.** S03 leaves `equipped` absent (absent = `[]`; lazy on first equip; `progression.ts` untouched). S05 serializes presence-preservingly and re-verifies loot-journey:126 at ck5 after `pnpm build`; S06 re-runs all proofs |
| F-E6 — pin audit | `themes.test.ts:74` (6); `coverage-floor.test.ts:307` | **Applied.** wyldwood extends `hedge-charm` (count stays 6); the full re-key owner table is in the Verification Baseline |
| F-E7 — wrong theme facts | theme JSON item maps and tables | **Applied.** `oaken-cudgel` is extended, not added; `warded-mail` gets an explicit kind change `armor`→`mail` (dark-fantasy only); `riot-plate`/`fire-axe` are reused and `scrap-plate`/`rebar-club` withdrawn; `med-kit` sits in `street-remnants` (not a `-loot` table) |
| F-E8 — armorCasting legal path unprovable in zombie-urban | `pools.ts:201-257` is slot-only; zombie-urban/wyldwood have no slot progression | **Applied.** S06 has a dark-fantasy leg (warden/mail legal; hexer/leather rejected, then unequip → legal); slot-casting scope is recorded in DD-EG5, database.md (S01) and the README (S06) |
| F-E9 — no heal cap in combat | `combat.ts:53,217,793-796,805-807` | **Applied (Orchestrator decision).** `CombatantProfile.maxHp?` → `CombatantState.maxHp` (derived hp with grants at start); the clamp is in `applyMutation`; `hpBefore` is captured before the mutation; the snapshot `maxHp` is contracted in S01. Owner: S05 ck1–2 and ck4 |
| F-E10 — items never leave the inventory after combat | `combat.ts:220-221,601-612`; `snapshots.ts:450-452`; `character-profile.ts` | **Applied (Orchestrator decision; mechanism chosen here).** Precedent: combat never writes back, and pools/boundSlots are host-owned with no settlement. Mechanism: the host verb `settleItemUses` (DD-EG6a). Owner: S05 ck3. Journey assertion on the inventory: S06 step 7 |
| F-E11 — parse-once lease gap | `runtime.ts:35-49,125,149-163` | **Applied.** `PackIndex.itemEffects` moved to S03 (ck3; S03 owns `runtime.ts`); S05 keeps `runtime.ts` serially for any additive change |
| F-E12 — `itemsUsed` meaning undefined | `snapshots.ts:395` (slotsUsed = remaining), `:450-452` | **Applied.** `itemsUsed` = spent; fight-start balances come from the host's re-stated request; the snapshot wins for the spend (CA-EG6, S01 ck2 contract text) |
| F-E13 — dist freshness not mechanical | `loot-journey.test.ts:32-42`; `ci.yml:43-45,80-85` | **Applied.** S06's journey asserts the dist exports the new symbols plus the generated `equipSlots`; the Baseline records Orchestrator's `pnpm build` before whole-suite receives from S03 on (moved to S02 on by REPLAN-EC-02, R-10); the CI dist gap is recorded as hazard (f), deferred with an owner |
| F-E14 — `VALID_PACK` has non-registry words | `tests/schema/fixtures.ts:40,69` | **Applied.** S02 uses an isolated pack in `validate.test.ts`; `tests/schema/fixtures.ts` stays untouched (it also feeds `tests/runtime/fixtures/pack.ts`) |
| F-E15 — synthetic action must stay item-only | — | **Applied.** S05 and DD-EG6 state it explicitly; DD17a stays out of scope |

**Planner-found corrections (REPLAN-EC-01, beyond the review):**
- **P-1:** the `gear-*` names need checker admission (the `formulas`-section `kind:'formula'`; callers `root.ts:192` **and** `checkPackDsl` `resolve.ts:171-172`, corrected by REPLAN-EC-02 R-7: the earlier "only caller" note was wrong, the behavior is identical at both) and a defined evaluation at every unbound eval site. Resolved by `formula.ts` joining S02's lease (+ `formula.test.ts`).
- **P-2:** item slot resolution needs `equipSlots` in the validator context. `Ctx` is built in `index.ts` and defined in `context.ts`; pass 1 is `collect.ts`. Both joined S02's lease.
- **P-3:** equip had no slot-eligibility gate, and dropping an equipped unit would strand grants. Added `not-equippable`/`slot-not-allowed` and the `item-equipped` drop guard; `inventory.ts` + `inventory.test.ts` joined S03's lease.
- **P-4:** S03 ∥ S04 share a working tree, so neither runs `pnpm build`; Orchestrator builds at receive.
- **P-5:** `progression.ts`/`progression.test.ts` left S03's lease; they are no longer needed under F-E5's absent-`equipped` choice.
- **P-6:** CI dist gap, recorded as hazard (f).
- **P-7:** `compileEffects` requires `effect: string` and throws on parse failure (`runtime.ts:149-163`), so the item index pre-filters to items that declare `use`.
- **P-8:** `CAP-E8` (settlement) was added as its own capability row.

### Recheck corrections — REPLAN-EC-02 (2026-09-28, dispatch HEAD `0ee3974`)

Source: `.program/results/ARCHIVIST-RECHECK.equipment-consumables.result.md`. Each finding was re-verified against source at `0ee3974` (src unchanged since `dadf461`). **None was disproved.** SESSION-01 and MASTER.md were not edited (S01 is running).

| Finding | Verified against | Disposition |
|---|---|---|
| R-1 — S01 ck3 gate compares against a fixed SHA | `git log`: `0ee3974` follows `dadf461` | **Applied via S01 envelope (Orchestrator).** The ck3 gate is `git diff --stat 0ee3974 -- src/schema/contracts program/Ruleswright/specs` |
| R-2 — heal clamp can lower hp | S03 CA-EG2 "unequipping never clamps"; S05 `hp = state.hp.current`, `maxHp = derived().hp` | **Applied (Orchestrator decision).** `after = current >= cap ? current : min(cap, current + heal)`, character and combat side. DD-EG4, CA-EG4, CAP-E4, S03 ck3 and S05 ck2 updated; over-cap closing tests (`X→X`) added in S03 ck3 and S05 ck2 |
| R-3 — `Combat.use` has no phase/turn gate | `combat.ts:357-360`: `declare` throws `combat is over` and acts as `this.state.active`; it has no other phase gate | **Applied (Orchestrator decision).** Gate 0 in S05 ck2 copies `declare`'s rule (throw on `combat-over`, no event; the active combatant is the user); use-after-over test in S05 ck2 and S06 step 7. DD-EG6, CA-EG5 updated |
| R-4 — settlement idempotent only per fight object | DD-EG6a marker = `itemsUsed = {}` on the live fight | **Applied as a documented v1 limit (Orchestrator decision).** DD-EG6a, S05 ck3 (docstring), S06 README plan, CAP-E8. No contract field; restored fights are not refused |
| R-5 — settlement would duplicate the drop-guard rule | `inventory.ts:134-175` `dropItem` throws and mutates; no pure check exists | **Applied.** S03 ck1 exports pure `equippedUnits(state, itemId)` from `equipment.ts`, used by `dropItem`, `equipItem`, `useItem`, and S05's `settleItemUses` pre-check (S05 ck0 re-checks the landed name). S03 handoff names it |
| R-6 — shared-tree hazard one-directional | `tests/runtime/combat/**` generate packs from theme JSON | **Applied.** Hazard (e) in the Baseline, S03 and S04 Verification are bidirectional: report, don't fix |
| R-7 — "only caller" note wrong; `checkPackDsl` skips item `use` | `resolve.ts:145,171-172`; `action-economy.test.ts:35` | **Applied (Orchestrator decision).** Note corrected in S02 Context and P-1. S05 ck1 adds the item-`use` effect check to `checkPackDsl` with tests in `tests/runtime/combat/action-economy.test.ts` (inside S05's `tests/runtime/combat/**` lease; no Owns change) |
| R-8 — `equipSlotNames: null` ambiguous | `context.ts:27-28` (economy null conflates); `collect.ts:56-62`; `progressionIds` absent → empty set at `collect.ts:65-66` | **Applied.** S02 ck2: absent → empty set (slotted items → E-REF-01); unreadable (non-array, empty, bad entry, duplicate) → null (item slot refs skipped). Closing test: malformed `equipSlots` yields only its own E-SCHEMA-01 cards; absent yields E-REF-01. CA-EG1 updated |
| R-9 — contract details | JSON Schema `uniqueItems` compares whole objects; `profile.hp` may be ≤ 0 on hand-built profiles | **R-9a/R-9b applied via S01 envelope (Orchestrator):** the `equipped` description says slot uniqueness is enforced by S05's restore; `maxHp` stays integer ≥ 0 and its description says a heal never lowers hp. **S05 leg applied here:** the `maxHp` fallback from `profile.hp` is floored at 0 at start and restore (DD-EG7, CA-EG6, S05 CA-EG4/CA-EG6, test in ck2) |
| R-10 — build-before-receive starts too late | `tsup.config.ts`: `splitting: false`, runtime/compiler entries bundle core | **Applied.** Baseline: Orchestrator builds before whole-suite receives from S02 on; S02 Verification notes it |
| R-11 — `pools.ts` cycle; optional formula tests | `pools.ts:14-15` header; `character.ts:16-35` value-imports pools/inventory; `inventory.ts:23-28`, `conditions.ts:30-33` are leaves; `shared.ts:106-120` | **Applied.** S02 ck1 adds `10-gear-ac` (subtracts → 8 with gear-ac 2) and `level-gear-ac` (E-FORM-03). S03: `equipment.ts` is a runtime leaf (value imports only core, `./errors`, `./conditions`), so `pools.ts`/`inventory.ts` import it with no new cycle; `useItem` computes its cap via `equipmentScope` + core eval and decrements inventory directly instead of calling `character.ts`/`inventory.ts`; boundary grep added |

**Lease impact:** none. No session's Owns or checkpoint count changed. S03 ∥ S04 stay literally disjoint (re-checked path by path; unchanged from REPLAN-EC-01).

**Inspection limits (REPLAN-EC-02):** the action-economy restriction gate, `snapshots.ts` restore bodies, the seed-42 spell lists and `executeEffect`'s `EffectApply` interface were not re-read (same limits as the recheck; S05 ck0 and S06 ck0 own them). No gates were run.

**Inspection limits (REPLAN-EC-01):** `validate/index.ts` dispatch was read (`:35-72`). `root.ts` was read at `:25-60`; its `checkStats`, `checkFormulas` and `checkSpatial` sites (`:158`, `:172-192`, `:257-290`) were located by grep, not read in full. design.md, mocks and CI run history were not inspected.

## Current Blockers

None open (feature complete 2026-09-28; CAP-E1..E8 verified). Carried, owned in FINAL-REPORT: (1) CI `test` job lacks `pnpm build` before `pnpm test` (loot-journey + equipment-journey read `dist/`) — owner: next feature's planning (CI owner correction); (2) ability/save name shadowing in effect scope (med-kit reads vigor save) — owner: next feature's planning (content/semantics decision); (3) `equipment.ts` private `rollText` duplicate of `displayRoll` — owner: next runtime-touching feature. All prior bulletins are closed (`.program/blockers.md`). Residual debts from grid-combat remain recorded with their owners, and **none** is owed by this feature:
- the movement verb;
- the burst-shape bridge;
- parse-once cleanup C6;
- the browser CI leg.

The burst-shape/spells-as-actions bridge is future-program debt (DD17a), *not* silently absorbed here. Hazard (f) (CI dist gap) is deferred, not blocking.

## Handoff Notes (Orchestrator writes here after each session — from Coder's Handoff section, verbatim)

### SESSION-01 — received 2026-09-28 (Orchestrator receive: accepted; format-only residual `8668c53`)

- **session:** SESSION-01 (equipment-consumables, DB author re-entry)
- **status:** complete
- **checkpoint:** 3/3. ck1 `a6a3334` (pack.schema.json v1.4) · ck2 `c32d2d2` (snapshots.schema.json v1.4) · ck3 `a409ef4` (database.md v1.4 + Version Registry)
- **notes:**
  - **CA-EG1: pack fields as landed** in `pack.schema.json`:
    - Root `equipSlots` sits right after `spatial`, alongside `actions`/`economy`/`spatial`, not inside `content`. It is an array, `minItems 1`, `uniqueItems`, with `$defs/idPattern` items. The description says slot ids are their own vocabulary and not artifact ids, so E-DUP-01 does not apply.
    - `content.items.<id>` gains three optional fields:
      - `slots`: array, minItems 1, uniqueItems, idPattern items; each must resolve in `equipSlots` (E-REF-01).
      - `grants`: object, `additionalProperties: {type: integer}`, plus `properties.armor: {type: integer, minimum: 1}` (the armor marker).
      - `use`: `$ref dslString`, an effect-DSL string.
    - `name` and `kind` are unchanged, and `required: ["name"]` is unchanged.
    - The `stats` description names the reserved ids `gear-hp`, `gear-ac`, `gear-initiative`, `gear-armor` (E-SCHEMA-01).
  - **CA-EG2: `gear-*` variables, exactly as written:** `gear-hp`, `gear-ac`, `gear-initiative`, `gear-armor`. The `formulas` description says:
    - they are readable only in the `formulas` section;
    - each is the sum of its reserved grant key over the equipped items, and 0 when nothing is equipped or the name is unbound (statblocks);
    - the formula decides direction. Examples given: `10 + gear-ac` (ascending) and `12 - floor(level / 3) - gear-ac` (descending).
    - Ability/save grant keys add to the stat and never replace it; a key naming both an ability and a save adds to both.
  - **CA-EG4: registry note wording** (database.md §formulas): "the frozen effect registry grows **12 → 13** with `heal(formula)` — arity 1, kind `effect`, signature `['formula']`. It executes as a negative-amount `damage` mutation … clamps at the target's max hp: out of combat the character's derived `hp` with equipment grants; in combat the combatant's `maxHp`. A heal never raises hp above the cap and never lowers hp. Extension of the registry is a schema event (CA-2 / NFR-Security) — **this revision is that event**. No new rule id: an unknown function remains `E-FORM-02`."
  - **CA-EG6: snapshot fields as landed** in `snapshots.schema.json`:
    - `$defs/characterState.properties.equipped`: array of `{slot, itemId}` objects, `additionalProperties:false`, both required, both kebab-pattern strings. Absent means nothing equipped, and the runtime emits it only when state carries it. Per envelope correction R-9a, the description says `uniqueItems` can't enforce one item per slot, so runtime restore enforces it fail-closed (E-SNAP-01, all refusals collected before anything is applied).
    - Combatant `itemsUsed`: object, kebab keys, values integer ≥ 0.
      - It records units **spent**, not remaining; the description contrasts this with `slotsUsed`, which stores what remains.
      - Fight-start balances come from the host's re-stated `CombatRestoreRequest.balances.items`.
      - The snapshot wins for the spend; remaining = restated balance − itemsUsed.
      - An unknown id or an over-spend is E-SNAP-01.
    - Combatant `maxHp`: integer ≥ 0 (R-9b), the heal cap fixed at fight start.
      - Precedence: the snapshot value, then `profile.maxHp`, then `profile.hp` (floored at 0).
      - A heal never lowers hp; a combatant already above its cap stays unchanged.
    - No `required` array changed, and `additionalProperties:false` still stands everywhere it stood before.
  - **database.md** now carries:
    - status v1.4; the overview tree lists `equipSlots?` (8 required + 3 optional sections);
    - the §stats reserved ids and a new §`equipSlots` section written in the same style as the spatial section;
    - the §formulas `gear-*` table plus the registry note;
    - a §content **items** table with slots/grants/use duties, the armor-marker prose verbatim, and the slot-casting-only scope (DD17a/DD-EG5);
    - a §Snapshot Envelopes v1.4 fields table with restore precedence and the itemsUsed/slotsUsed asymmetry;
    - an ErrorCard note (no new id), two access-pattern rows, and Version Registry row 5 verbatim.
- **delivered:** both contracts at v1.4 (the CAP-E1/E2/E4/E5 contract origins) and database.md v1.4 with row 5.
- **verification:**
  - Both contracts pass `JSON.parse`. `schemaVersion` is still `const 1`, and `snapshotVersion` is still `const 1`.
  - `git diff --stat 0ee3974 -- src/schema/contracts program/Ruleswright/specs` lists exactly the 3 owned files (150+/8−).
  - Additivity audit: 8 lines show as deleted. Seven are doc lines in database.md, reworded in place (status, overview tree, two envelope rows, ErrorCard sentence). The eighth is the one-line ItemDef `properties` in pack.schema.json, split across several lines with `name`/`kind` kept. No key was removed or renamed.
  - After each commit, `git show --name-only HEAD` listed only the file that checkpoint leased.
  - `pnpm typecheck` exits 0.
  - I did not run lint, format:check or test, as the envelope instructs.
- **surprises:**
  - None in scope. The planner's uncommitted `SESSION-02.md` edit showed up in the working tree; I left it alone.
  - No test reads the contract JSON at runtime.
  - I ran two temporary edit scripts from `.program/signal/` and deleted them; nothing was left there.
- **followUp:** S02 must mirror and enforce the following.
  - **Types:** `Pack.equipSlots?: string[]`; `ItemDef.slots?: string[]`, `grants?: Record<string, number>`, `use?: DslString`; `RESERVED_GRANT_KEYS`.
  - **Validator passes (`checkEquipSlots`, `checkItemSlots`, `checkItemGrants`), with the error-code split I landed in the contract:**
    - an unknown grant key is E-REF-01;
    - a non-integer grant value, or `armor` < 1, is E-SCHEMA-01;
    - a stats id equal to a `gear-*` name is E-SCHEMA-01;
    - bad `equipSlots` structure is E-SCHEMA-01;
    - an unresolved item slot is E-REF-01;
    - an item `use` is checked as an effect DSL string (E-FORM-01/02/03).
  - **Formula checker:** admit the `gear-*` names in the formulas section only, and evaluate them as 0 when unbound. Elsewhere they stay E-FORM-03.
  - **Registry:** add `heal` and re-key the membership pin 12→13.
  - **S05 (snapshots):** emit `equipped` only when state carries it and validate it on restore (the uniqueness check lives here). Serialize `itemsUsed` as spent, restoring against `balances.items`. Serialize `maxHp` with the snapshot → profile.maxHp → profile.hp precedence.
- **needsOwnerCorrection:** none. One judgement call for Orchestrator's S02 ck0 recheck: I added `grants.properties.armor` (integer, minimum 1). This makes the plan's "`armor` ≥ 1" rule enforceable by schema; it is additive and fits CA-EG1.
- **needsDesignSource:** none
- **blockedReason:** —
- **filesTouched:** `src/schema/contracts/pack.schema.json`, `src/schema/contracts/snapshots.schema.json`, `program/Ruleswright/specs/database.md`

### REPLAN-EC-01 / REPLAN-EC-02 (plan workers, not sessions)

- REPLAN-EC-01 `0ee3974` — planning-completeness corrections F-E1..F-E15. REPLAN-EC-02 `46932f2` — recheck corrections R-2..R-11 (R-1/R-9 S01 leg via envelope). Raw returns: `.program/results/REPLAN-EC-0{1,2}.result.md`.

### SESSION-02 — received 2026-09-28 (Orchestrator receive: accepted; build+suite 584/584; arch `f1563b1`)

- **session:** 02
- **status:** done
- **checkpoint:** 2
- **notes:** CAP-E1 implementation leg proven (validator tests, isolated pack, real `packDslChecker`). CAP-E2 and CAP-E4 producer legs landed and proven at the DSL level; the user capabilities are not yet proven (S03/S05/S06). CA-EG1 mirror and validator leg: `Pack.equipSlots`, `ItemDef.slots/grants/use`, `RESERVED_GRANT_KEYS`, `Ctx.equipSlotNames` (absent → empty Set, unreadable → null, R-8), `checkEquipSlots`, `checkItemSlots`, `checkItemGrants`, `checkStats` rejecting `gear-*` ids. CA-EG2 DSL leg: `EQUIPMENT_SCALARS` in `formula.ts`, admitted only for `kind === 'formula'`, unbound → 0 in `evalFormula`. CA-EG4 registry/executor leg: `REGISTRY.heal` (12 → 13), `ARG_CATEGORIES.heal`, `execHeal`. Commits: ck1 `0f1ff65`, ck2 `52df545`.
- **delivered:**
  - **Mirror as landed:**
    - `Pack.equipSlots?: KebabId[]`, placed after `spatial`.
    - `ItemDef` gains `slots?: KebabId[]`, `grants?: Record<string, number>` and `use?: DslString`.
    - Exports `RESERVED_GRANT_KEYS` (schema) and `EQUIPMENT_SCALARS` (core).
  - **Registry:** 13 entries, with `heal` after `damage`. `EFFECT_VOCABULARY` is unchanged.
  - **Validator rejections as tested:**
    - non-integer grant value → E-SCHEMA-01;
    - `armor` < 1 → E-SCHEMA-01;
    - unknown grant key → E-REF-01 with a did-you-mean hint;
    - unknown slot → E-REF-01 with a hint;
    - slots declared while `equipSlots` is absent → E-REF-01 ("the pack declares no equipSlots");
    - an `equipSlots` entry that breaks the id pattern, a non-array value, an empty array or a duplicate → E-SCHEMA-01 only, with no item E-REF-01 follow-on;
    - `gear-*` used as a stats id → E-SCHEMA-01;
    - item `use` → E-FORM-01/02 through the effect checker;
    - `gear-ac` → no cards in `formulas`, E-FORM-03 in a progression `attackBonus` and in an action `attack()` bonus.
- **verification:**
  - **Checkpoint 1:**
    - `pnpm typecheck` exit 0.
    - `pnpm exec vitest run tests/core/dsl/` → 3 files, 55/55 (48 existing + 7 new).
    - The freeze test in `checker.test.ts` names `heal` among 13.
    - `effect.test.ts`: `heal(2 + might)` → damage request total −5, `halved: false`, and the outcome roll equals the requested roll. `heal(1d4 + might)` → values [−3], modifier −2, total −5, and the RollResult total still equals the dice sum plus the modifier. `mend(2)` → E-FORM-02.
    - `formula.test.ts`:
      - `12 - gear-ac` gives 12 unbound and 10 with gear-ac = 2;
      - `10 + gear-ac` with 2 gives 12;
      - `10-gear-ac` with 2 gives 8;
      - `level-gear-ac` → E-FORM-03;
      - `gear-ac` is E-FORM-03 in `attackBonus`/`effect`/`valid`/`passive` checks;
      - `gear-shield` still throws.
  - **Checkpoint 2:**
    - `pnpm exec vitest run tests/schema/ tests/core/dsl/` → 7 files, 140/140. That is the intended scope in both directions.
    - The new validator block in `tests/schema/validate.test.ts` has 12 tests.
    - The formula test asserting `EQUIPMENT_SCALARS` equals `RESERVED_GRANT_KEYS` with the `gear-` prefix passes.
    - Negative control: with the `null` skip removed, the R-8 test failed with two cascade E-REF-01 cards. Reverted afterwards and confirmed green.
  - **Whole-repo fast gates (solo worker):** `pnpm typecheck` 0, `pnpm lint` 0, `pnpm format:check` 0.
  - **Expected-unchanged:** `pnpm exec vitest run tests/runtime/ tests/compiler/ tests/snapshots/` → 20 files, 374/374.
  - **Not run:** `tests/proofs/` and `pnpm build` (Orchestrator's at receive, R-10).
- **surprises:**
  - **Heal roll negation:** `execHeal` negates the whole RollResult (values, modifier and total), not only the total the plan names. This keeps the RollResult total invariant. `resolve.ts` pushes this roll into `why.rolls`, and the roll text (`combat.ts:881`) will show negative faces for a heal. S05 owns that rendering.
  - **Test moved to checkpoint 2:** the `EQUIPMENT_SCALARS` ↔ `RESERVED_GRANT_KEYS` test landed in ck2, because `artifacts.ts` is a ck2 file.
  - **"an action's attackBonus" is ambiguous:** actions have no `attackBonus` field, so I tested both the progression `attackBonus` field and the `attack()` bonus argument inside an action effect.
  - **Structural checker reuse:** `checkIdList` is used for both `equipSlots` and item `slots`. Its messages follow the existing stats style.
  - Lease revision 1. The landed contract matched CA-EG1/EG2/EG4 with no delta, including S01's `armor` ≥ 1.
- **followUp:**
  - **S03 consumers:**
    - `ItemDef.slots/grants/use` and `Pack.equipSlots`;
    - `EQUIPMENT_SCALARS` (bind `gear-*` in the character formula context; unbound means 0);
    - the `heal` executor, which calls `apply.damage` with a negative-total roll and does not clamp, so the cap is the host's job (CA-EG4 R-2).
  - **S04 facts:** `gear-hp/ac/initiative/armor` are legal in theme `formulas` entries only, and `equipSlots` is an accepted root key.
  - **S05:**
    - the heal `why.rolls` roll carries negated values and modifier;
    - the `checkPackDsl` item-`use` check is still S05 ck1's (R-7).
  - **Proofs still owned elsewhere:** CAP-E2 (S03 ck2, S06), CAP-E4 (S03 ck3, S05 ck2, S06), CA-EG1 runtime re-check (S05 ck1).
  - The arch delta is in `.program/signal/SESSION-02.arch.md`.
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:**
  - `src/core/dsl/registry.ts`
  - `src/core/dsl/effect.ts`
  - `src/core/dsl/formula.ts`
  - `tests/core/dsl/checker.test.ts`
  - `tests/core/dsl/effect.test.ts`
  - `tests/core/dsl/formula.test.ts`
  - `src/schema/pack.ts`
  - `src/schema/artifacts.ts`
  - `src/schema/validate/collect.ts`
  - `src/schema/validate/context.ts`
  - `src/schema/validate/index.ts`
  - `src/schema/validate/sections/content.ts`
  - `src/schema/validate/sections/root.ts`
  - `tests/schema/validate.test.ts`

### SESSION-03 — received 2026-09-28 (Orchestrator receive: accepted; lease-scoped gates green; arch `643fd76`)

- **session:** 03
- **status:** done
- **checkpoint:** 4
- **notes:** CAP-E2 proven (ck2). CAP-E3 proven (ck3). CAP-E4 character leg proven (ck3), including the R-2 over-cap `X→X` case. CAP-E8 pieces landed at ck1: the pure `equippedUnits` and the `dropItem` guard. The CAP-E4 combat leg, the CAP-E8 settlement and the user capabilities stay with S05/S06. Contract producer legs landed: CA-EG2 composition, CA-EG3 gate, CA-EG4 character-side clamp, CA-EG5 character-side `useItem`, and `PackIndex.itemEffects` (F-E11). Commits: ck1 `09fb6a7`, ck2 `8dcfe41`, ck3 `960ee39`, ck4 `d9f2be6`. Lease revision 1.
- **delivered:**
  - **New module `src/runtime/equipment.ts`** (runtime leaf, R-11). Exact exported signatures:
    - `equippedUnits(state: CharacterState, itemId: string): number`. This is the pure R-5 helper.
    - `equippedGrants(runtime: Runtime, state: CharacterState): Record<string, number>`
    - `equipmentView(runtime: Runtime, state: CharacterState): EquipmentView`, with shape `{ readonly abilities: Record<string, number>; readonly saves: Record<string, number>; readonly gear: Record<string, number> }`. `gear` holds exactly the `gear-hp`, `gear-ac`, `gear-initiative` and `gear-armor` keys, each 0 when nothing is equipped.
    - `equipmentScope(view: EquipmentView, level: number): Record<string, number>`
    - `equipItem(runtime, state, itemId: string, slot: string): RuntimeEvent`
    - `unequipItem(runtime, state, slot: string): RuntimeEvent`
    - `useItem(runtime, state, itemId: string, opts?: UseItemOptions): readonly RuntimeEvent[]`
    - Types: `EquippedEntry { readonly slot: string; itemId: string }` and `UseItemOptions { readonly seed?: number | string; readonly rng?: RandomSource }`.
  - **Rejection names as landed:**
    - Equip, in order: `unknown-item`, `not-equippable`, `unknown-slot`, `slot-not-allowed`, `slot-occupied`, `item-not-held`.
    - Unequip: `not-equipped`.
    - `useItem`, in order: `unknown-item`, `not-consumable`, `item-not-held`, `insufficient-qty`, `item-equipped`.
    - `dropItem`: `item-equipped`, when `held − qty < equippedUnits`.
    - `castSpell`: `armor-not-castable`, placed after `unknown-spell` and before the slot lookup.
  - **Events:**
    - `item:equipped` / `item:unequipped`: payload `{itemId, slot}`, `why.rule` `content.items.<id>`.
    - `item:used`: payload `{itemId, remaining}`, emitted before the effect's own events.
    - `damage:applied`: payload `{amount, type, hp: "before→after"}`, `why.rolls` = `["d0[]-10=-10"]`-style strings.
  - **`character.ts` changes:**
    - `CharacterState.equipped?: EquippedEntry[]` stays absent until the first equip. An emptied array stays `[]`.
    - `derived()` composes over `equipmentView`, and `saves` returns `view.saves`.
    - `formulaValue(runtime, id, abilities, level, rng, gear?)` and `reserveValue(runtime, id, abilities, level, rng, gear?)` gain the optional trailing `gear`. Build, level-set and restore callers pass nothing, so they keep the base value.
    - The facade gains `equip(itemId, slot)`, `unequip(slot)` and `useItem(itemId, opts?)`.
  - **Heal rule as landed:** `after = current >= cap ? current : min(cap, current + heal)`, where cap is the pack `hp` formula over `equipmentScope`, evaluated with `Rng(0)`. That equals `derived().hp`. Positive damage floors at 0. Equipping never heals and unequipping never clamps.
  - **Condition effects** in `useItem` route through `applyCondition`. The effect's duration then overrides the entry that call created or refreshed.
  - **Pools:** `rest` evaluates pool caps over the view. `initPools` is unchanged because no character state exists at build time.
  - **Runtime index:** `PackIndex.itemEffects` holds only items that declare `use`, parsed once at load. The barrel exports everything above.
  - **Fixture extensions (additive; existing formulas and items untouched):**
    - `RUNTIME_PACK`:
      - `equipSlots: ['body','main-hand','off-hand','ring']`
      - `chain-shirt`: kind `mail`, slots `body`, grants `{ac: 2, armor: 1}`. Warden lists `mail` in armorCasting; hexer has none.
      - `ashwood-blade`: kind `weapon`, slots `main-hand`/`off-hand`, grants `{might: 1}`
      - `ward-ring`: slots `ring`, grants `{hp: 2, luck: 1}`
      - `mend-draught`: use `heal(10)`
    - `emberMarchesPack`:
      - `equipSlots: ['body','main-hand']`
      - `scale-coat`: kind `mail`, slots `body`, grants `{ac: 2, armor: 1}`
      - `ember-brand`: slots `main-hand`, grants `{might: 1}`
      - `mend-salve`: use `heal(1d6 + 2)`
- **verification:**
  - `pnpm typecheck` 0 at every checkpoint. Lint 0 on lease files and for the whole repo. Prettier check clean on all lease files.
  - **Per-checkpoint gates:**

    | Checkpoint | Command | Result |
    |---|---|---|
    | ck1 | `pnpm exec vitest run tests/runtime/equipment.test.ts tests/runtime/inventory.test.ts` | 2 files, 42/42 |
    | ck2 | `pnpm exec vitest run tests/runtime/character.test.ts tests/runtime/equipment.test.ts tests/runtime/pools.test.ts` | 3 files, 31/31 |
    | ck3 | same three files | 3 files, 42/42 |
    | ck4 | `pnpm exec vitest run tests/runtime/ tests/snapshots/` | 16 files, 223/223 |

    Selected counts matched intent in both directions. The snapshot suites were unaffected, which confirms the absent-`equipped` choice.
  - Whole repo for information: `pnpm test` 36 files, 623/623 (baseline 584 + 39 new); `pnpm lint` 0. No `pnpm build`.
  - **Proofs:**
    - **CAP-E2** (`character.test.ts`, "CAP-E2 closing proof"):
      - ascending `10 + gear-ac`: 10 → 12 → base byte-exact;
      - descending `12 - floor(level / 3) - gear-ac` at level 3: 11 → 9 → base;
      - `gear-hp`: 20 → 22 with `hp.current` unchanged;
      - might 3 + 1 inside `floor(level / 2) + might`: 4 → 5;
      - a save grant, and a key that is both ability and save;
      - nothing equipped: the fixture's `derived()` values are identical, with all four `gear-*` = 0.
    - **CAP-E3** (`pools.test.ts`): rejection with slots, state JSON and event count unchanged; cast succeeds after unequip; a class listing `mail` casts while equipped; non-armor never blocks; one class of a multiclass character is enough.
    - **CAP-E4 / CA-EG5** (`equipment.test.ts`): heal from 16 lands exactly at 20 with event `16→20`; cap equals `derived().hp` with grants (22); over-cap stays at `22→22` and the unit is still consumed; one unit per use and the last unit removes the entry; every rejection leaves no change and no event.
  - **Negative controls:** I temporarily disabled the R-2 over-cap branch and the armor gate. Three tests failed as expected (over-cap 20≠22, and both gate tests). The code was restored before the ck3 commit.
  - **Boundary greps:**
    - R-11: `equipment.ts` has no value import from character, pools or inventory.
    - R-5: `inventory.ts` only calls `equippedUnits`.
    - CA-EG2: grants are summed only in `equipment.ts`.
    - No compiler import anywhere in the runtime.
- **surprises:**
  1. `why.rolls` formatting is a small private copy (`rollText`) of combat's `displayRoll` anatomy, because `equipment.ts` may not import `combat.ts` (R-11). If S05 moves `displayRoll` to a leaf, this copy can go.
  2. The `castSpell` gate (`armorBlockingCast` in `pools.ts`) walks `state.equipped` to read the armor marker. That is neither a grant sum nor a unit count, so CA-EG2 and R-5 still hold.
  3. A save grant for a save the character has no base value for starts from 0 in `view.saves`. Membership is decided by the pack's `stats` lists.
  4. When a condition effect with `ignore` stacking hits an already-active condition, `useItem` changes nothing. The `condition:applied` event reports the pack-default duration even when the effect's duration overrode it.
  5. The SESSION prompt says `tests/runtime/fixtures/pack.ts` builds on `VALID_PACK`. In fact it is a standalone literal; this changed nothing.
  6. S04 landed ck1–4 (up to `90dbfc7`) during this session. No shared-tree red was observed in either direction.
- **followUp:** S05 consumers:
  - `equipmentView` for the profile's abilities, saves, initiative base and `maxHp`. Profile `maxHp` should equal `derived().hp`.
  - `runtime.index.itemEffects` for `fight.use`.
  - `equippedUnits(state, itemId)` as settlement's pure pre-check.
  - `dropItem` (with its `item-equipped` guard) for settlement's mutation.
  - Mirror the heal rule exactly as landed in `applyMutation`.
  - The serializer must keep `equipped` absent when absent (build never writes it).

  Proofs still owned elsewhere: CAP-E2 generated-pack leg (S06), CAP-E4 combat leg (S05 ck2), CAP-E8 settlement (S05 ck3), CA-EG6 snapshots (S05 ck4). Orchestrator's build and whole-repo battery run at receive.
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:**
  - `src/runtime/equipment.ts`
  - `src/runtime/character.ts`
  - `src/runtime/pools.ts`
  - `src/runtime/inventory.ts`
  - `src/runtime/runtime.ts`
  - `src/runtime/index.ts`
  - `tests/runtime/fixtures/pack.ts`
  - `tests/runtime/fixtures/packs.ts`
  - `tests/runtime/equipment.test.ts`
  - `tests/runtime/character.test.ts`
  - `tests/runtime/pools.test.ts`
  - `tests/runtime/inventory.test.ts`
  - `.program/signal/SESSION-03.arch.md` (arch fragment; uncommitted, for Orchestrator)

### SESSION-04 — received 2026-09-28 (Orchestrator receive: accepted; W3-close whole-repo battery green 623/623; typecheck red in handoff was S03 in-flight, cleared at close)

- **session:** 04
- **status:** done
- **checkpoint:** 4
- **notes:** CAP-E6 verified at ck4: `equipSlots` reaches the pack, all three themes carry the equipment content and `gear-*` formulas, generated packs have zero stage-8 cards, and the coverage floor passes. Code added: `ThemeTemplate.equipSlots`, and in `runPipeline` the `'equipSlots'` entry in `STAGE_INPUT_SECTIONS` plus a structuredClone pass-through. CA-EG1 consumer leg (themes) passed: stage 8 accepted every declared field, so no producer defect. CA-EG2 theme-formula leg landed, descending direction. CA-EG3 content pairing landed; this is content only, and the runtime proof stays with S03 ck3 / S06. Commits: ck1 `4749543`, ck2 `926f4c6`, ck3 `22fc990`, ck4 `90dbfc7`.
- **delivered:** Exact content as landed, for S05/S06 to re-check:
  - **dark-fantasy**
    - `equipSlots: ["body","main-hand"]`
    - `warded-mail`: kind `armor` → **`mail`**, slots `["body"]`, grants `{ac:2, armor:1}`
    - `oaken-cudgel`: kind `weapon`, slots `["main-hand"]`, grants `{might:1}`
    - formulas: hp `"6 + level + vigor * 2 + gear-hp"`, ac `"12 - floor(level / 3) - gear-ac"`, initiative `"d20 + grace + gear-initiative"`
    - `armorCasting` unchanged: warden `["mail"]` (legal with warded-mail), hexer `["leather"]` (blocked)
  - **zombie-urban**
    - `equipSlots: ["body","main-hand"]`
    - `riot-plate`: kind `armor`, slots `["body"]`, grants `{ac:1, armor:1}`
    - `fire-axe`: kind `weapon`, slots `["main-hand"]`, grants `{might:1}`
    - `med-kit`: kind `consumable`, use `"heal(2 + vigor)"`
    - formulas: hp `"6 + level + vigor * 2 + gear-hp"`, ac `"11 - floor(level / 3) - gear-ac"`, initiative `"d20 + grace + gear-initiative"`
  - **wyldwood**
    - `equipSlots: ["charm"]`
    - `hedge-charm`: kind `charm`, slots `["charm"]`, grants `{ac:1, armor:1}`; item count still 6
    - formulas: hp `"6 + level + vigor * 2 + gear-hp"`, ac `"12 - floor(level / 3) - gear-ac"`, initiative `"d20 + grace + gear-initiative"`
  - No new item ids anywhere, and loot tables are unchanged.
  - **Tests added:**
    - `tests/compiler/pipeline.test.ts`: a new `describe` with 3 tests (equipSlots passed through and slotted item clears stage 8; no key when absent; theme not mutated).
    - `tests/compiler/coverage-floor.test.ts`: one per-theme test (non-empty `equipSlots` matching the theme, an armor grant, an ability grant for dark-fantasy and zombie-urban, a `use` item for zombie-urban, and an `ac` formula matching `/ - gear-ac\b/`), plus one CA-EG3 pairing test for dark-fantasy.
- **verification:**
  - `pnpm exec vitest run tests/compiler/ tests/proofs/docs-run.test.ts tests/proofs/grid-journey.test.ts` → 7 files, 204/204 passed, exit 0 at ck4 (200/200 at ck2 and ck3). That is the intended 7 files: the 5 compiler files plus 2 proofs, so no over- or under-selection. coverage-floor went from 78 to 82 tests and pipeline from 24 to 27.
  - Stage 8 ×3: the floor's "zero cards" tests (`validatePack` + `packDslChecker`) pass for dark-fantasy, zombie-urban and wyldwood. `runPipeline` also throws on any card, so every generating test is further evidence.
  - docs-run block-03 still asserts `hp: 27, ac: 12` and passes; `themes.test.ts` still pins wyldwood at 6 and passes.
  - Negative control: with the pass-through line turned off, 2 of the 3 new pipeline tests fail (E-REF-01 "pack declares no equipSlots", and `equipSlots` undefined). Restored afterwards.
  - Read-only: `tests/runtime/combat/{combat,character-profile}.test.ts` → 36/36 against my themes.
  - Lint: eslint on the lease files passes (exit 0). Prettier `--check` passes on all lease files.
  - `pnpm typecheck`: passed (0) at ck1. It fails at ck4 only on S03's in-flight `src/runtime/equipment.ts` (TS2339 `equipped` not on `CharacterState`); no errors in lease files.
  - `pnpm build` not run, as instructed.
- **surprises:**
  - The whole-repo `pnpm typecheck` failure comes from S03's uncommitted `src/runtime/equipment.ts`. Reported, not fixed; re-run after S03's next commit.
  - `tsx` isn't installed, so I dropped a standalone stage-8 probe script (deleted, never committed). The coverage-floor zero-card tests are the evidence instead.
  - Prettier expanded the edited single-line item entries in the dark-fantasy and zombie-urban JSON into multi-line blocks. This is formatting only.
  - I also added the CA-EG3 pairing assertion (warden lists `mail`, hexer does not) to the floor as content-level evidence.
  - Lease revision 1.
- **followUp:**
  - CAP-E2: S03 ck2 fixtures; S06 ck1 on the generated pack.
  - CAP-E3 runtime gate: S03 ck3; S06 dark-fantasy leg (warden/mail legal, hexer/leather rejected).
  - CAP-E4 med-kit heal clamp: S03 ck3, S05 ck2, S06.
  - Item `use` re-check in `checkPackDsl`: S05 ck1.
  - wyldwood charm armor is content-only coverage (point-pool casting never reaches the gate); no runtime claim.
  - `tests/proofs/loot-journey.test.ts` reads `dist/`, so Orchestrator's wave-close build is needed.
  - Arch delta written to `.program/signal/SESSION-04.arch.md`.
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:**
  - `src/compiler/theme.ts`
  - `src/compiler/pipeline.ts`
  - `tests/compiler/pipeline.test.ts`
  - `src/compiler/themes/dark-fantasy.json`
  - `src/compiler/themes/zombie-urban.json`
  - `src/compiler/themes/wyldwood.json`
  - `tests/compiler/coverage-floor.test.ts`

### W3 close — 2026-09-28

- Whole-repo re-verify after both receives, with fresh `pnpm build`: typecheck 0 · lint 0 · format:check 0 · build 0 · check:isolation 0 · check:security 0 · **623/623 across 36 files**. Shared-tree hazard: no red observed in either direction (both sessions report).

### SESSION-05 — received 2026-09-28 (Orchestrator receive: accepted; battery green 651/651; med-kit vigor-save heal kept as-is, see decisions)

- **session:** 05
- **status:** done
- **checkpoint:** 5
- **notes:** Five commits: ck1 `14c01dc`, ck2 `1af3945`, ck3 `31540b0`, ck4 `4bfcec4`, ck5 `15ef2df`. Lease revision 1. No CA amendment at ck0: the S02/S03/S04 producers matched. This session proved its legs of CAP-E4 (combat heal), CAP-E8 (settlement) and CAP-E5 (snapshots), plus the CA-EG2 profile leg and CA-EG4/EG5/EG6. It also added the `checkPackDsl` item-`use` check (R-7). The end-to-end user journey is still S06's (CAP-E7). Exact public signatures:
  - `Combat.use(itemId: string, options?: UseOptions): readonly RuntimeEvent[]`, with `UseOptions { readonly target?: string }`.
  - `settleItemUses(runtime: Runtime, character: Character, fight: Combat, combatantId?: string): readonly RuntimeEvent[]`, exported from `character-profile.ts` and the runtime barrel.
  - `CombatantProfile.maxHp?: number`.
  - `CombatantState.maxHp: number` (`profile.maxHp ?? Math.max(0, profile.hp)`).
  - `CombatantState.itemBalances: Readonly<Record<string, number>>` (fixed for the fight).
  - `CombatantState.itemsUsed: Record<string, number>` (units spent, starts `{}`).
  - `EconomyBalances.items?: Readonly<Record<string, number>>`.
  - Snapshot fields as emitted:
    - `SnapshotCharacterState.equipped?: readonly SnapshotEquippedEntry[]`, with `{slot, itemId}`. Emitted only when the state has it; an emptied `[]` stays `[]`.
    - `SnapshotCombatant.maxHp` (always emitted).
    - `SnapshotCombatant.itemsUsed` (spent units; emitted only when non-empty).
- **delivered:**
  - **ck1 — profiles:**
    - `profileFromCharacter` builds on `equipmentView`: abilities and saves are the view's; the initiative base is `{...view.abilities, ...view.saves, level, ...view.gear}`; `maxHp = derived().hp`; `hp = state.hp.current`.
    - `profileFromStatblock` sets `maxHp` to its evaluated hp.
    - `checkPackDsl` checks every `content.items.<id>.use` as an effect, with jsonPath `content.items.<id>.use`.
  - **ck2 — combat:**
    - `startCombat` sets `maxHp` (floored at 0, R-9), `itemBalances` from `balances.items`, and `itemsUsed: {}`. `profileFromCharacter` fills `balances.items` with the held qty of every item in `runtime.index.itemEffects`.
    - Clamp in `applyMutation` (R-2): for a negative amount, `after = current >= maxHp ? current : min(maxHp, current + heal)`. It never raises hp above the cap and never lowers it. Positive damage is unchanged (no floor).
    - The damage `hp` display now uses a before-value captured before the mutation (`hpBefore` removed).
    - The private `resolve` is split into a shared `execute(actor, boundAction, target, rule)`.
    - `use()` gate order as landed:
      - 0: `combat-over` → `throw Error('combat is over')`; no event, no ledger change; the user is `state.active`.
      - 1: `unknown-item`
      - 2: `not-consumable`
      - 3: restriction, over a synthetic item-only `{cost:{}, effect: item.use}` (F-E15)
      - 4: `unknown-target` (default target is the user; any combatant in the fight may be targeted)
      - 5: `no-charges` (remaining ≤ 0)
    - Each rejection is one `declare:rejected` event (`payload.kind` = the gate name) and changes nothing.
    - On success, in order: `itemsUsed[id]` += 1; then `item:used` with `{itemId, remaining}` (actor = user, target = target, `why.rule` `content.items.<id>`); then the effect runs through the executor, its events carrying `why.rule: content.items.<id>`.
    - Afterwards: the end rule and trigger offers run. No slot is spent, the phase is unchanged, and the turn continues.
  - **ck3 — settlement:**
    - Refuses unless the fight is `combat-over` (`combat-not-over`); an unknown `combatantId` is refused with `unknown-target`.
    - Checks every used item before anything changes, all cards at once: `item-not-held`, `insufficient-qty`, and `item-equipped` via S03's `equippedUnits` (R-5).
    - Then, in item-id order: `dropItem` (emits `item:dropped`), then `item:settled` with `{combatantId, itemId, qty}` (`why.rule` `content.items.<id>`).
    - Finally sets that combatant's `itemsUsed = {}`; a second call returns `[]`.
    - The R-4 limit (settle each fight once; a pre-settlement snapshot restored and settled again drops twice) and the abandoned-fight limit are both in the docstring.
  - **ck4 — snapshots:**
    - Character `equipped` is serialized only when present. Restore checks every entry before applying anything, E-SNAP-01, all cards at once: item declared, slot declared, slot allowed for the item, slot used once, and the inventory holds a unit for each entry. Paths are `state.equipped[i]…` / `members[i].equipped[j]…`.
    - Inventory still restores verbatim.
    - Combat restore: charges come from the re-stated `balances.items`, and the snapshot's `itemsUsed` wins for the spend.
    - These refuse with E-SNAP-01, all cards before any rebuild: an unknown item id, a spend above the re-stated balance (including a host that did not re-state balances), and an invalid `maxHp`.
    - `maxHp` precedence: snapshot → `profile.maxHp` → `max(0, profile.hp)`.
    - Re-keyed `tests/snapshots/combat.test.ts:102` to `['conditions','hp','id','maxHp','slotsUsed']`.
  - **ck5:** barrel exports for `UseOptions` and `SnapshotEquippedEntry` (`settleItemUses` was exported at ck3). `runtime.ts` is unchanged.
- **verification:**
  - **Per checkpoint:**
    - ck1: `pnpm typecheck` 0; `pnpm exec vitest run tests/runtime/combat/` → 5 files, 83/83.
    - ck2: `tests/runtime/ tests/snapshots/` → 16 files, 239/239.
    - ck3: `tests/runtime/` → 13 files, 214/214.
    - ck4: `tests/snapshots/ tests/runtime/` → 16 files, 251/251.
    - ck5: `pnpm build` 0 (24 dist files; `settleItemUses` present in `dist/runtime.{js,cjs}`); `pnpm exec vitest run tests/runtime/ tests/snapshots/ tests/proofs/` → 21 files, 279/279.
    - Selected counts matched intent in both directions.
  - **loot-journey re-verify (F-E5):** `tests/proofs/loot-journey.test.ts` 7/7 against the fresh dist, including the `:126` restore round-trip.
  - **Whole repo at close:** lint 0, format:check 0, check:isolation 0, check:security 0; `pnpm test` → 36 files, 651/651.
  - **Boundary proofs:**
    - **CA-EG4 / CAP-E4** (`tests/runtime/combat/combat.test.ts`, "fight.use"), asserted on `damage:applied`:
      - `field-dose` heal(5) on an ally: `4→9`, then `9→12`, clamped.
      - at full hp: `12→12`.
      - over cap: `{amount:-5, hp:'15→15'}`.
      - after `combat-over`: throws `combat is over`, a fresh sink sees nothing, ledger unchanged.
      - `maxHp` floors at 0 for hp −3; `no-charges`, `not-consumable`, `unknown-item` and `unknown-target` all leave state unchanged.
      - `mend-salve` roll text equals `d6[${amount+2}]-2=${amount}`.
      - an attack's damage display is unchanged.
    - **CA-EG5 / CAP-E8** (`character-profile.test.ts`), real zombie-urban fights to `combat-over`:
      - `med-kit` x3 with 2 uses → inventory `[{med-kit, 1}]`; events `[item:dropped, item:settled]`; a second call → `[]`.
      - a live fight → `combat-not-over`.
      - items no longer held → `[item-not-held field-dose, insufficient-qty med-kit]`, no change.
      - equipped and consumable `stim-belt` → `item-equipped`, no change; after unequipping it settles.
    - **CA-EG6 / CAP-E5:** restore fails closed with all cards and leaves `nextCharacterId` at 1; the equipped round-trip and the spend/`maxHp` round-trip are both lossless.
    - **CA-EG2** (`character-profile.test.ts`): `riot-plate` moves ac 11→10; `fire-axe` raises might 10→11, and combat sees it; `maxHp = derived().hp`; statblock `maxHp = hp`; with nothing equipped the profile equals the old shape plus `maxHp`.
    - **R-7** (`action-economy.test.ts`): `heal(2 + might)` → `[]`; `mend(2)` → one E-FORM-02 card at `content.items.field-tonic.use`; the `:35` fixture assertion stays `[]`.
  - **Negative controls, each failed as expected and restored before commit:** the R-7 loop disabled; the R-2 over-cap branch disabled; the settlement all-at-once pre-check disabled; the equipped restore gate disabled.
- **surprises:**
  1. **Rejection event type:** `use()` rejections reuse the `declare:rejected` type with new kinds `unknown-item`, `not-consumable` and `no-charges`. `unknown-target` already existed. I read "no event" for `no-charges` as no `item:used` or effect event: the one rejection event is still emitted, as `declare` does.
  2. **Restriction gate:** it is applied but cannot block, because `ItemDef` has no `tags`.
  3. **Heal size in zombie-urban:** `med-kit` heals **2** at level 1, in and out of combat (checked on the dist). `vigor` is both an ability (10) and a save (0 at level 1), and the save value wins in both S03's `useItem` vars and the combat executor's vars. The two paths are consistent, but the theme author may have meant the ability.
  4. **Settlement guard for an unknown id:** `settleItemUses` also refuses an unknown `combatantId` with the existing `unknown-target` name; the plan did not cover this.
  5. **Checkpoint spill:**
     - ck2 edited the `deserializeCombat` state literal so the new required fields compile; the snapshot semantics landed at ck4.
     - ck1's `balances.items` was moved to ck2 because `EconomyBalances.items` is ck2's.
     - The `settleItemUses` barrel export landed at ck3 because its tests import from the barrel.
  6. **Display choice:** combat keeps `displayRoll` unchanged; heals render as `d0[]-2=-2` / `d6[-4]-2=-6`, identical to S03's `rollText`.
- **followUp:**
  - **S06 journey facts** (zombie-urban seed 42; class list `scavenger`/`fixer`/`medic`; race `mile-born`, level 1):
    - base: vigor 10, hp 27, ac 11, might 10;
    - riot-plate + fire-axe: ac 10, might 11, `maxHp` 27 (`gear-hp` 0);
    - `med-kit` heal: `damage:applied {amount:-2, type: undefined, hp:'X→min(27, X+2)'}`, `why.rolls ['d0[]-2=-2']`, `why.rule 'content.items.med-kit'`, preceded by `item:used {itemId:'med-kit', remaining}`;
    - charges = held qty at `profileFromCharacter`, so 2 med-kits → 2 uses, then `no-charges`;
    - settlement of 2 uses from 3 held leaves `[{id:'med-kit', qty:1}]`.
  - **Possible S04 content correction:** if `heal(2 + vigor)` was meant to read the ability, rename the save or change the formula. This is Author/Orchestrator territory, not mine.
  - **`equipment.ts` duplicate:** it still has a private `rollText` copy. `displayRoll` was not moved to a leaf, so the copy stays (not in my lease).
  - **README:** S06 documents the R-4 limit (settle each fight once).
  - The arch delta is in `.program/signal/SESSION-05.arch.md`.
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:**
  - `src/runtime/combat/combat.ts`
  - `src/runtime/combat/resolve.ts`
  - `src/runtime/combat/action-economy.ts`
  - `src/runtime/character-profile.ts`
  - `src/runtime/snapshots.ts`
  - `src/runtime/index.ts`
  - `tests/runtime/combat/action-economy.test.ts`
  - `tests/runtime/combat/character-profile.test.ts`
  - `tests/runtime/combat/combat.test.ts`
  - `tests/snapshots/combat.test.ts`
  - `tests/snapshots/character.test.ts`
  - `.program/signal/SESSION-05.arch.md` (arch fragment; uncommitted, for Orchestrator)

### SESSION-06 — received 2026-09-28 (Orchestrator receive: accepted; FINAL battery green 661/661; feature complete)

- **session:** 06
- **status:** done
- **checkpoint:** 2
- **notes:** CAP-E7 verified (S06 ck1 `dd6557c`, `tests/proofs/equipment-journey.test.ts` against dist, seed-42 generated packs, no mocked boundary); journey legs closed for CAP-E2/E3/E4/E5/E8 and CA-EG1..EG6; NFR-DX README section landed at ck2 `e5e4846`, ```ts block count still 4, docs-run pin untouched and green. Lease revision 1. Readiness: CAP-E1 verified (S02 ck2), CAP-E2 verified (S03 ck2 + S06 ck1), CAP-E3 verified (S03 ck3 + S06 ck1, dark-fantasy), CAP-E4 verified (S03 ck3, S05 ck2, S06 ck1), CAP-E5 verified (S05 ck4 + S06 ck1), CAP-E6 verified (S04 ck4), CAP-E7 verified (S06 ck1), CAP-E8 verified (S05 ck3 + S06 ck1).
- **delivered:**
  - **Journey file:** `tests/proofs/equipment-journey.test.ts`, 10 tests, every import from `../../dist/*.js`.
  - **Test 1, dist freshness:** `equipItem`, `useItem` and `settleItemUses` are exported functions, and the zombie-urban `equipSlots` equals `['body','main-hand']`.
  - **zombie-urban leg (steps 1–8), zombie-urban seed 42, scavenger / mile-born, level 1:**
    - **Steps 1–3 (EG1/EG2):**
      - Load, then base hp 27, ac 11, might 10.
      - riot-plate: ac 10. fire-axe: profile might 11, profile ac 10, maxHp 27. State might is unchanged.
      - Unequip: ac back to 11. Re-equip: 10. hp unchanged.
    - **Step 4 (EG4/EG5, character side):**
      - `useItem('med-kit')`: events `[item:used {remaining:2}, damage:applied {amount:-2, hp:'23→25'}]`.
      - `why` is `{rule:'content.items.med-kit', rolls:['d0[]-2=-2']}`; qty is now 2.
    - **Step 5 (EG4/EG5, combat):**
      - `balances.items` is `{med-kit:2}`.
      - `fight.use('med-kit',{target:ally})` gives `item:used {remaining:1}`, then `damage:applied {amount:-2, hp:'26→27'}` (clamped); `why.rolls` includes the roll, `why.rule` is the med-kit rule.
      - `itemsUsed` is `{med-kit:1}` and the foe's hp is unchanged.
    - **Step 6 (EG6):**
      - Serialize the character and the fight mid-fight; the snapshot has `itemsUsed {med-kit:1}` and `maxHp 27`.
      - Restore the character and `deserializeCombat` on a fresh Runtime with the same request; both carry over.
      - With a fresh sink: the second use gives `remaining:0` and `'27→27'`. The third gives one `declare:rejected` event with kind `no-charges`, and the state is byte-identical.
    - **Step 7 (EG5, CAP-E8):**
      - Fight to `combat-over`. The character still holds 2, because the fight never touches character state.
      - Settle: `[item:dropped, item:settled {qty:2}]`. The med-kit entry is gone (3 − 1 − 2), and the inventory is `[riot-plate×1, fire-axe×1]`.
      - A second settle returns `[]`. `use` now throws `combat is over`, and a fresh sink sees no event.
    - **Step 8 (EG6):**
      - `equipped` is `[{main-hand,fire-axe},{body,riot-plate}]` and round-trips onto a fresh runtime (restored ac 10).
      - A tampered itemId `ghost-kit` gives all E-SNAP-01 cards, including `state.equipped[0].itemId`, and the target's `nextCharacterId` stays 1.
  - **dark-fantasy leg (steps 9–11, EG3):**
    - `warded-mail` is kind mail in `body`. Each caster prepares their first level-1 known spell into slot 1[0].
    - hexer `[leather]`: refused `armor-not-castable` at `content.items.warded-mail`, slot still bound, no events. After unequip, `spell:cast` succeeds and the slot empties.
    - warden `[mail]`: casts while wearing the mail.
  - **README:** new section "Equipment & consumables" after *Grid combat*:
    - a ```json content excerpt, plus a plain-fenced expected-output block quoting only values the journey asserts; med-kit is worded honestly as heals 2 (the vigor save shadows the ability);
    - it covers equip/unequip, grants and `gear-*` direction, armorCasting (slot casting only, DD-EG5), `useItem` / `fight.use` / `settleItemUses`, the heal cap rule and the snapshot fields;
    - v1 limits: R-4 (settle each fight once; a pre-settlement snapshot restored and settled again drops twice) and the abandoned-fight limit;
    - it cites the journey file.
- **verification:**
  - **Checkpoint 1:**
    - `pnpm build` exit 0.
    - `pnpm exec vitest run tests/proofs/equipment-journey.test.ts`: 1 file, 10/10.
    - Negative control: I changed the step-5 clamp expectation to `'26→28'`. It failed as expected (received `'26→27'`, 1 failed / 9 passed), and I restored it before the commit.
    - typecheck 0; eslint on the file 0; prettier applied.
  - **Checkpoint 2:**
    - README ```ts count is 4 by grep.
    - `pnpm exec vitest run tests/proofs/`: 6 files, 38/38 (baseline 28 + 10). This includes docs-run 3/3 (executed + strict typecheck), loot-journey 7/7 and grid-journey 11/11.
  - **Session-scoped seven-gate battery at `e5e4846`:**

    | Gate | Result |
    |---|---|
    | typecheck | 0 |
    | lint | 0 |
    | format:check | 0 |
    | build | 0 |
    | test | 0, 37 files, 661/661 |
    | check:isolation | 0 |
    | check:security | 0 |

    Selected counts match intent in both directions (+1 file, +10 tests over the 651/36 baseline).
  - After each commit, `git show --name-only HEAD` listed only lease paths.
- **surprises:**
  1. Step 6 restores the character, as well as the fight, onto the fresh runtime (`restoreCharacter`, which mints the same id `char-1`). Settlement then runs as `settleItemUses(resumedRt, resumedSurvivor, resumed)` instead of against the original runtime/character. This is the resuming-host shape and avoids mixing runtimes; it also exercises the pairing of the character snapshot with the combat snapshot.
  2. The wound in step 5 is set on the character before profiling (hp 26 = cap − 1), so the +2 heal visibly clamps (`26→27`).
  3. No other delta from S04/S05's landed facts. The R-7/§7 concern is resolved at seed 42: warden and hexer each know level-1 spells (5 and 7) and have level-1 slots.
  4. The inherited CI dist gap (baseline hazard f) now also covers `equipment-journey`: CI's `test` job runs without `pnpm build`. Not edited (outside the lease).
- **followUp:**
  - CI correction for hazard (f): `ci.yml` test job needs `pnpm build` before `pnpm test`, for loot-journey and equipment-journey. Owner: the follow-up CI session named in the Final Report.
  - The med-kit save-shadows-ability semantics stay as decided (the README states it).
  - `equipment.ts`'s private `rollText` duplicate (S05 followUp) is still open.
  - No arch fragment written (tests and docs only).
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:**
  - `tests/proofs/equipment-journey.test.ts`
  - `README.md`
