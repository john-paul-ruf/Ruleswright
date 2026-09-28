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
| 01 | Contract gate — schema v1.4 (DB re-entry) | M01 contracts | `src/schema/contracts/pack.schema.json`, `src/schema/contracts/snapshots.schema.json`, `program/Ruleswright/specs/database.md` | pending | — | — | Author role; grid S01 precedent; now owns the snapshots contract too (F-E4) |
| 02 | TS mirror + validator + heal registry + `gear-*` DSL | M01, M02 | `src/schema/pack.ts`, `src/schema/artifacts.ts`, `src/schema/validate/sections/content.ts`, `src/schema/validate/sections/root.ts`, `src/schema/validate/index.ts`, `src/schema/validate/context.ts`, `src/schema/validate/collect.ts`, `src/core/dsl/registry.ts`, `src/core/dsl/effect.ts`, `src/core/dsl/formula.ts`, `tests/schema/validate.test.ts`, `tests/core/dsl/checker.test.ts`, `tests/core/dsl/effect.test.ts`, `tests/core/dsl/formula.test.ts` | pending | — | — | Serial after S1; owns the registry membership re-key (checker.test.ts:13-26) |
| 03 | Character verbs: equip/unequip/use + grants + armorCasting gate | M03 | `src/runtime/equipment.ts`, `src/runtime/character.ts`, `src/runtime/pools.ts`, `src/runtime/inventory.ts`, `src/runtime/runtime.ts`, `src/runtime/index.ts`, `tests/runtime/fixtures/**`, `tests/runtime/equipment.test.ts`, `tests/runtime/character.test.ts`, `tests/runtime/pools.test.ts`, `tests/runtime/inventory.test.ts` | pending | — | — | Concurrent with S04 (disjoint); owns the shared runtime fixtures; must not run `pnpm build`; exports the pure `equippedUnits` helper (R-5) |
| 04 | Themes + equipSlots pipeline pass-through | M04 | `src/compiler/theme.ts`, `src/compiler/pipeline.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `tests/compiler/pipeline.test.ts`, `tests/compiler/coverage-floor.test.ts` | pending | — | — | Concurrent with S03 (disjoint); must not run `pnpm build` |
| 05 | Combat integration: profiles, fight.use, clamp, settlement, snapshots | M03 | `src/runtime/combat/combat.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/combat/action-economy.ts`, `src/runtime/character-profile.ts`, `src/runtime/snapshots.ts`, `src/runtime/runtime.ts`, `src/runtime/index.ts`, `tests/runtime/combat/**`, `tests/snapshots/combat.test.ts`, `tests/snapshots/character.test.ts` | pending | — | — | After S03 and S04; re-key owner for `tests/snapshots/combat.test.ts:102`; re-verifies loot-journey:126 at ck5; `checkPackDsl` item-`use` check (R-7) |
| 06 | Journey + README | proofs, docs | `tests/proofs/equipment-journey.test.ts`, `tests/proofs/docs-run.test.ts`, `README.md` | pending | — | — | Last; journey first, docs pin inside the README checkpoint |

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
| CAP-E1 | A pack declares equipment/consumable items and equip slots; bad declarations are rejected at load | ItemDef v1.4 fields, `equipSlots` (S01 ck1); mirror + validator (S02 ck2) | CA-EG1 | S02 ck2 | planned | planned: `tests/schema/validate.test.ts` (isolated pack) | — |
| CAP-E2 | Equip/unequip over slot state; grants compose into `derived()` (ability/save add; `gear-*` via the pack's formulas) | `gear-*` admission + unbound-is-0 (S02 ck1); `equipmentView` + composition (S03 ck2); theme formulas (S04 ck2–4) | CA-EG1, CA-EG2 | S03 ck2 (fixtures); S06 ck1 (generated pack) | planned | planned: ascending and descending fixtures move by exactly the grant | — |
| CAP-E3 | armorCasting enforced at **slot** cast time | armor marker (S01); gate (S03 ck3); dark-fantasy warden/mail + hexer/leather (S04 ck2) | CA-EG3 | S03 ck3; S06 ck1 (dark-fantasy leg) | planned | planned | Point-pool casting is out of scope (DD-EG5) |
| CAP-E4 | A consumable heals out of combat (`useItem`) and in combat (`fight.use`), capped at max hp and never lowering hp already above it (R-2); `fight.use` only while the fight is live, by the active combatant (R-3) | `heal` (S02 ck1); `itemEffects` + `useItem` (S03 ck3); `maxHp` + heal rule + `use()` gate 0 (S05 ck1–2); med-kit (S04 ck3) | CA-EG4, CA-EG5 | S03 ck3 (character side, incl. over-cap); S05 ck2 (combat, incl. over-cap and use-after-over); S06 ck1 | planned | planned | — |
| CAP-E5 | Snapshots carry `equipped`, `itemsUsed`, `maxHp`; restore fails closed | contract (S01 ck2); serializer/restore (S05 ck4) | CA-EG6 | S05 ck4; S06 ck1 | planned | planned | — |
| CAP-E6 | All three themes carry the new content and gear formulas; `equipSlots` reaches the pack; packs validate; floor green | pass-through (S04 ck1); themes (S04 ck2–4) | CA-EG1, CA-EG2, CA-EG3 | S04 ck4 | planned | planned | — |
| CAP-E7 | **First narrow journey** end to end (DD-EG9) | all above | all | S06 ck1 | planned | planned | — |
| CAP-E8 | A combat use ends with exactly one unit removed from the character's inventory | ledger (S05 ck2); `settleItemUses` (S05 ck3); drop guard + pure `equippedUnits` (S03 ck1, R-5) | CA-EG5 | S05 ck3; S06 ck1 (inventory asserted after the fight) | planned | planned | Documented v1 limit (R-4): idempotent per live fight object; settle once per fight (DD-EG6a, README) |

**Production paths:**
- **CAP-E2:** `Character.derived()` → `equipmentView` → `reserveValue(…, gear)` → pack `formulas`.
- **CAP-E4 (combat):** `fight.use` → `resolve` → `executeAgainst` → `execHeal` → `applyMutation` (clamp) → `damage:applied`.
- **CAP-E8:** `settleItemUses` → `dropItem` → `item:settled`.
- **CAP-E5:** `serializeCharacter`/`restoreCharacter` and `serializeCombat`/`deserializeCombat`.
- **Restart behavior:** CAP-E5 carries it; S06 steps 6 and 8.

## Contract Agreements

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|----|------------------------------|--------------------------------|-----------------------|------------------------------------------|-----------|----------|------------------------------------|
| CA-EG1 | ItemDef admits `grants` (keys ∈ abilities ∪ saves ∪ {hp, ac, initiative, armor}; integer values; `armor` ≥ 1), `slots` (non-empty unique, each ∈ `equipSlots`), `use` (effect DSL). Root optional `equipSlots` (≥1, unique, kebab; not global ids). `stats` ids ≠ `gear-*` | pack.schema.json (S01) → validator/context/collect (S02) → mirror (S02) → themes (S04) → runtime verbs (S03) → runtime re-check `checkPackDsl` item `use` (S05 ck1, R-7) | Additive-optional; schemaVersion 1; structural → E-SCHEMA-01, reference → E-REF-01. Validator context keeps **absent** `equipSlots` (empty set → slotted items get E-REF-01) distinct from **unreadable** (null → item slot refs skipped, no cascade) (R-8) | S01 ck1 → S02 ck2 (tests, incl. malformed-vs-absent); S05 ck1 (`checkPackDsl`) | agreed | planned (S01 ck1) | planned (S02 ck2) |
| CA-EG2 | **Grant semantics (F-E2 (b)):** ability/save grants ADD; reserved grants are exposed only to `formulas` as `gear-hp/ac/initiative/armor` (sum over equipped; 0 when none or unbound). The engine applies no direction. Equipping never heals; unequip never clamps | contract (S01) → formula checker/eval (S02 ck1) → `equipmentView` + `derived()`/pool caps (S03 ck2) → theme formulas (S04) → `profileFromCharacter` abilities/saves/initiative/maxHp (S05 ck1) | One composition site (`equipment.ts`). Build/level-set/restore hp init stays at base (gear not passed) | S02 ck1; S03 ck2 (both AC directions); S05 ck1 (profile); S06 ck1 (generated pack) | agreed | planned (S02 ck1, S03 ck2) | planned |
| CA-EG3 | Armor marker: an item is armor iff `grants` has `armor`. A **slot** cast while armor-equipped requires a character class listing the item's `kind` in `armorCasting` | `pools.ts` `castSpell` → RuntimeRuleError | `armor-not-castable`, no state change, gate before the slot lookup; monsters and point-pool spells unaffected | S03 ck3; S06 ck1 (dark-fantasy) | agreed | planned (S03 ck3) | planned |
| CA-EG4 | `heal(formula)` = an effect statement → a negative-amount `damage` request; `why.rolls` carry the roll; `damage:applied` anatomy unchanged. Cap: character = derived hp with grants; combat = `maxHp`. **Rule (R-2):** `after = current >= cap ? current : min(cap, current + heal)`, never above the cap and never lowering hp already above it. `hp` display shows the actual values (`X→X` when unchanged; `hpBefore` captured before the mutation) | registry/`execHeal` (S02) → `useItem` (S03) / `applyMutation` (S05) | Registry 12→13; membership pin re-keyed by S02. **No E-FORM-01 message change** (F-E1). Combat `maxHp` fallback floored at 0 (R-9) | S02 ck1 → S03 ck3 (over-cap test) → S05 ck2 (over-cap test) | agreed | planned (S02 ck1) | planned (S03 ck3, S05 ck2) |
| CA-EG5 | `useItem` and `fight.use` each consume exactly one unit/charge; the last unit removes the entry. A combat use ends with the inventory reduced by exactly the units used (settlement). Rejections: `unknown-item`, `item-not-held`, `insufficient-qty`, `not-consumable`, `no-charges`, `combat-not-over`, `item-equipped`; `fight.use` after `combat-over` throws like `declare` (gate 0, R-3) | `useItem` (S03) · `balances.items` → `itemBalances`/`itemsUsed` → `Combat.use` (S05) → `settleItemUses` → `equippedUnits` pre-check → `dropItem` (S05) | Balances are host-stated (the pools/boundSlots precedent); the fight never touches character state; settlement is host-called, all-or-nothing, idempotent **per live fight object** (R-4 v1 limit). One equipped-unit rule, `equippedUnits` (S03), shared by `dropItem`, `useItem` and settlement (R-5) | S03 ck1 (`equippedUnits`), ck3; S05 ck2 (use-after-over test), ck3; S06 ck1 | agreed | planned (S03 ck1/ck3, S05 ck3) | planned |
| CA-EG6 | Character snapshot `equipped` (presence-preserving; validated restore; slot uniqueness enforced by S05's restore, not the schema, R-9a). Combatant `itemsUsed` = spent (host balances + snapshot spend; snapshot wins for spend) and `maxHp` (snapshot → profile.maxHp → max(0, profile.hp), R-9) | snapshots.schema.json (S01 ck2) → `snapshots.ts` (S05 ck4) | Additive-optional; all refusal cards before any application; inventory verbatim (CA-01 divergence) | S01 ck2 → S05 ck4 (+ ck5 loot-journey re-verify) → S06 ck1 | agreed | planned (S01 ck2, S05 ck4) | planned |

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

None open. All prior bulletins are closed (`.program/blockers.md`). Residual debts from grid-combat remain recorded with their owners, and **none** is owed by this feature:
- the movement verb;
- the burst-shape bridge;
- parse-once cleanup C6;
- the browser CI leg.

The burst-shape/spells-as-actions bridge is future-program debt (DD17a), *not* silently absorbed here. Hazard (f) (CI dist gap) is deferred, not blocking.

## Handoff Notes (Orchestrator writes here after each session — from Coder's Handoff section, verbatim)
