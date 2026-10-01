# State Tracker — Ruleswright / spells-in-combat

## Program / Feature / Intent / Sessions

- **Program:** Ruleswright (`program/Ruleswright/`)
- **Feature:** `spells-in-combat`
- **Intent:** a character casts a spell it knows in a fight with
  `fight.declare(spellId, { targetId? | at? })` — within the spell's pack-declared range,
  and a burst may be centered on an empty cell. Casting rides the normal action pipeline
  (FR-9): validate → consume → resolve the effect DSL → emit events. The spend survives a
  mid-fight snapshot, and the host settles it back into the character after the fight.
  In the same feature, **reactive feats become live**: characters can hold feats, feat
  triggers use a grammar the engine matches, and the engine checks that grammar at load
  (F-M1). The combat snapshot keeps every open offer, the offer counter and the phase
  (R-GM-1, R-GM-2).
- **Authorization (human, 2026-09-30):** answering Planner's three questions, the human
  wrote **"1 approved 2 agreed 3 yes, agreed"**:
  1. **Approved:** one DB re-entry (schema-change class) for the snapshot change. The
     snapshot records which spell was cast from which slot and what was spent. The same
     re-entry folds in R-GM-1 and R-GM-2.
  2. **Agreed:** only characters cast. Statblocks get no spell field.
  3. **Yes:** fix F-M1 (feat triggers) in this feature.

  The human did not object to Planner's "unless you object" list: no new cast verb; pool
  spells cast too; a `settleSpellCasts` host verb; the armor rule applies in combat as it
  does outside; the grid-combat journey casts the real spell. Two items on that list were
  corrected from source (DD-S15, DD-S16).
- **Human answer on DD-S8 (2026-09-30):** "**8 spell need a range, can target empty
  square for aoe blasts**". This replaces Planner's reach-gated default: spells declare a
  range (pack data), and burst spells may be centered on an empty cell (DD-S8 as amended).
  It is a product rule, so it authorizes S01's **requirements-change class** (Spec adds the
  FR-9/FR-11 criteria) as well as the schema field (`targeting.range`, DB). Delivering it
  forced one auto-decision, DD-S19 (per-target defender values).
- **B-S1 cleared (human, 2026-09-30):** "**8a - yes 8b - fine 9 cost a turn 10 yes 11 yes 12 yes 13 yes 14 yes**".
  - DD-S8 (a) optional range with a reach fallback, and (b) `range: 6` on every bundled
    spell: confirmed.
  - DD-S9: "cost a turn", given twice (once before Planner's A/B question, once after
    it). Planner reads it as option **B, the whole turn**: every bundled spell costs
    `main` **and** `move`; the reaction stays available. DD-S9 is rewritten accordingly.
    If the human meant only the main action, revert DD-S9 to `main: 1` and the four
    S02 edits listed under DD-S9; nothing else depends on it.
  - DD-S10 … DD-S14: confirmed as written.
  - The confirmation authorizes S01's design-change class for `magic.html`,
    `api-map.html`, `triggers.html` and `conditions.html`.
- **Plan HEAD:** `55b294f` (clean tree; all gates green, see Verification Baseline).
  Plan committed at `ac0e225`; amended for the DD-S8 answer (S01 gains Spec ck1; S02 gains
  ck2 "range and area targeting" and widens to M01/M02); amended again for the B-S1
  answer (DD-S9 whole-turn cost; the theater-of-mind grid-journey test is now leased work).
- **Sessions:** 3. They run serially: S01 Author re-entry (Spec → Designer → DB) → S02 the spell
  column → S03 the feat/trigger column, snapshot envelope and README.

## Session Status

| # | Session | Modules | Owns | Status | Checkpoint | Completed | Notes |
|---|---------|---------|------|--------|------------|-----------|-------|
| 01 | Author re-entry: FR-9/FR-11 spell range, magic/api-map/triggers/conditions mocks + contract v1.6 | — (Author: Spec, Designer, DB) | `program/Ruleswright/specs/requirements.md`, `program/Ruleswright/mocks/magic.html`, `program/Ruleswright/mocks/api-map.html`, `program/Ruleswright/mocks/triggers.html`, `program/Ruleswright/mocks/conditions.html`, `program/Ruleswright/specs/database.md`, `src/schema/contracts/pack.schema.json`, `src/schema/contracts/snapshots.schema.json` | pending | — | — | Author roles, not Coder; 3 checkpoints (Spec added for DD-S8); B-S1 cleared 2026-09-30 |
| 02 | The spell column: declare spells, range + empty-cell bursts, spend + snapshot, settlement, generated spells, spell journey | M01 (mirror/validator), M02 (executor), M03, M04 (content) | `src/schema/artifacts.ts`, `src/schema/validate/sections/content.ts`, `src/core/dsl/effect.ts`, `src/runtime/combat/combat.ts`, `src/runtime/combat/action-economy.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/character-profile.ts`, `src/runtime/pools.ts`, `src/runtime/snapshots.ts`, `src/runtime/index.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `tests/schema/validate.test.ts`, `tests/core/dsl/effect.test.ts`, `tests/runtime/combat/spells.test.ts`, `tests/runtime/combat/combat-spatial.test.ts`, `tests/runtime/combat/character-profile.test.ts`, `tests/runtime/fixtures/packs.ts`, `tests/snapshots/combat.test.ts`, `tests/proofs/grid-journey.test.ts`, `tests/proofs/rules-are-data.test.ts`, `tests/proofs/spells-journey.test.ts` | pending | — | — | depends S01; 5 checkpoints |
| 03 | The feat column: trigger grammar, feats held + offered, snapshot envelope, README | M01, M03, M04 (content) | `src/schema/validate/helpers.ts`, `src/runtime/feats.ts`, `src/runtime/character.ts`, `src/runtime/runtime.ts`, `src/runtime/combat/triggers.ts`, `src/runtime/combat/combat.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/character-profile.ts`, `src/runtime/snapshots.ts`, `src/runtime/index.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `tests/schema/validate.test.ts`, `tests/runtime/fixtures/packs.ts`, `tests/compiler/pipeline.test.ts`, `tests/compiler/stages.test.ts`, `tests/compiler/coverage-floor.test.ts`, `tests/runtime/feats.test.ts`, `tests/runtime/combat/feat-triggers.test.ts`, `tests/snapshots/character.test.ts`, `tests/snapshots/combat.test.ts`, `tests/proofs/movement-journey.test.ts`, `tests/proofs/rules-are-data.test.ts`, `tests/proofs/spells-journey.test.ts`, `tests/proofs/docs-run.test.ts`, `README.md` | pending | — | — | depends S02 |

S02 and S03 share files (`combat.ts`, `snapshots.ts`, the themes, and several tests). That
is allowed only because they never run at the same time; see the Wave Plan.

## Wave Plan

| Wave | Sessions | Why this shape |
|------|----------|----------------|
| W1 | S01 | Author gate (B-S1 cleared 2026-09-30). S02 and S03 mirror the v1.6 contract text, so nothing runs beside it. |
| W2 | S02 | The spell column. It owns `combat.ts`, `snapshots.ts`, `character-profile.ts` and the themes, all of which S03 also edits. |
| W3 | S03 | The feat column builds on S02's `CombatantState`, snapshot fields and `profileFromCharacter`. It also extends S02's journey file with the feat leg. |

**No concurrency is available.** The two columns meet in the same four engine files. If
they were split by file instead, each column would be half-built at its checkpoints,
which the column rule forbids.

**Recorded windows:**
- **Contract window (S01 → S03).** After S01, `snapshots.schema.json` allows `offers`,
  `phase` and `offeredCount`, and `pack.schema.json` describes the trigger grammar. The
  runtime does not write the new envelope fields, and the validator does not enforce the
  grammar, until S03 (ck1 and ck4). Nothing reads these fields in between: the snapshot
  validator is hand-rolled in `snapshots.ts`, which ignores them until S03, and no test
  feeds them. **S03 closes the window.**
- **Spend window (S01 → S02 ck4).** The contract allows `poolsSpent`/`slotsCast` before
  the runtime writes them. **S02 ck4 closes it.**
- **Range window (S01 → S02 ck2).** After S01, `pack.schema.json` allows
  `targeting.range`, but the hand-rolled validator still refuses it (`content.ts:514`
  `forbidUnknown(['shape','radius'])`) until S02 ck2. No pack or fixture declares a range
  before S02 ck5 (themes), so nothing loads it in between. **S02 ck2 closes it.**
- **Feat window (S02 → S03).** Between the two sessions, spells are live in combat but
  feats are still inert (F-M1 as today). No test asserts feat offers before S03.

## Dependency Graph

```
S01 (Author: Spec FR-9/FR-11 ck1 → Designer mocks ck2 → DB contract v1.6 + database.md ck3)
  └─> S02 (M03 spell declare; M01 targeting.range mirror + M02 varsFor + M03 range gate/`at`;
           spend + snapshot spend + settlement; M04 spell turn cost + range; spell journey)
        └─> S03 (M01 trigger grammar; M03 feats + offers + envelope offers/phase/offeredCount;
                 M04 feat patterns; feat journey leg; README)
```

## Architecture Reference (feature-specific)

- **No new module, no new cross-module edge, no new rule id.** `src/runtime/feats.ts` is
  a new file inside M03. It is a leaf: it imports only `./errors`, plus types from
  `./runtime`, `./character` and `./events`.
- **One parse-once index.** Spell effects are already compiled at load
  (`runtime.ts` `PackIndex.spellEffects`, built by `compileEffects`). S02 reads that
  index. `resolve.ts` `parsePackEffects` (line 115, zero consumers in `src/` and `tests/`
  at `55b294f`) is deleted (DD-S15; Archivist C6 resolved). S03 adds
  `PackIndex.featEffects` the same way.
- **One declare pipeline.** `Combat.declare` (`combat.ts:515`) looks the id up in
  `pack.actions`, then in `pack.content.spells`. A spell becomes a `BoundAction`
  `{id, def: {cost, effect, tags}, ast: index.spellEffects[id]}`, with rule base
  `content.spells.<id>`. Every later gate is the existing one: restriction, target,
  validity (spells declare none), spatial, cost, spend, resolve. The two spell-only steps
  are the armor gate and the binding pick.
- **One offer pipeline.** `offersForEvent` (`triggers.ts:62`) returns offers for
  reactive actions **and** reactive feats. A `PendingTrigger` gains
  `source: 'action' | 'feat'`. `respond` dispatches on `source`.
- **Range and area targeting (CA-S9).** Spells pass a range gate (`runtime.spatial.distance`)
  where actions pass the reach gate. `resolveShape` takes a **center** (the target's
  position or the `at` cell) instead of a target combatant. Per-target defender values
  reach the executor through one optional `EffectApply.varsFor` hook (DD-S19); M02 still
  imports nothing from M03. No new cross-module edge.
- **Spend is recorded, not re-stated (CA-S2).** Following the `itemsUsed` precedent, the
  combatant records `poolsSpent` and `slotsCast`. Restore computes balance = re-stated
  balance − spend. This fixes a latent defect: today a pool or vancian spend is lost on
  restore, because `snapshots.ts:559-560` rebuilds `pools`/`boundSlots` from the re-stated
  fight-start balances.

## Scope Summary

| ID | Module | Change |
|----|--------|--------|
| — | Author | `requirements.md` FR-9 (spell range) + FR-11 (empty-cell area center); `magic.html`, `api-map.html`, `triggers.html`, `conditions.html` (cast in combat, range + `at`, settle, feat learn/offer anatomy, trigger grammar copy); `database.md` v1.6; `pack.schema.json` (`targeting.range`, trigger `on` grammar `pattern`, description of combat casting); `snapshots.schema.json` (combatant `poolsSpent`, `slotsCast`; envelope `offers`, `phase`, `offeredCount`) |
| M01 | `src/schema/artifacts.ts`, `validate/sections/content.ts`, `validate/helpers.ts` | `SpellTargeting.range?` mirror + validator (S02 ck2); `checkTrigger` enforces the grammar (E-FORM-01, S03) |
| M02 | `src/core/dsl/effect.ts` | optional `EffectApply.varsFor`: per-target saves/defense inside a shape scope (DD-S19, S02 ck2) |
| M03 | `src/runtime/` | spell declare, range gate, `at` (empty-cell burst center), binding pick, armor gate, spell restricts, `spell:cast`; `poolsSpent`/`slotsCast` with snapshot round-trip; `settleSpellCasts`; profile `spells`/`castBlockedBy`/`feats`, balances `bindings`; `feats.ts` `learnFeat` + character feats + character snapshot feats; `featEffects` index; feat offers, take/decline, no-chain rule; envelope `offers`/`phase`/`offeredCount`; `parsePackEffects` deleted; barrel |
| M04 | `src/compiler/themes/*.json` | every spell cost gains `slots: { main: 1, move: 1 }` and every spell `targeting.range: 6` (S02); feat triggers `condition:applied[self]` → `condition:applied[target=self]` (S03). No compiler source change |
| — | tests/docs | `tests/proofs/spells-journey.test.ts` (spell leg in S02, feat leg in S03); grid-journey casts the real `ember-bloom`; FR-12 proof 3 casts in combat, proof 2 adds a reactive feat; README spells/feats text |

### Inherited findings and dispositions

Sources inspected at `55b294f`:
- `prompts/{v1-core,loot-inventory,grid-combat,equipment-consumables,grid-movement}/FINAL-REPORT.md`
  (residual-gap and follow-up closure ledgers);
- `prompts/grid-movement/STATE.md` (inherited-findings table);
- `ARCHIVIST-LOG.md` standing recommendations (C6, C11, rows 1–16);
- `.program/blockers.md`, `.program/decisions.md` and `.program/ledger.md` (grid-movement
  sections; nothing open);
- `program/Ruleswright/STATE.md`, which has a header only.

| Finding | Source | Disposition |
|---------|--------|-------------|
| DD17a: spells are not combat-declarable | grid-combat S05, PROGRAM-CONFIG Custom Rule 4 | **Implemented:** S02 ck1 (declare), ck5 (journey on the real spell). |
| C6: `parsePackEffects` has zero consumers | ARCHIVIST-LOG C6 | **Resolved by deletion** at S02 ck1. `runtime.index.spellEffects` is the parse-once source the bridge uses (DD-S15). |
| F-M1 / C11: feat triggers never match, and feats are never registered | grid-movement STATE, ARCHIVIST-LOG C11 | **Implemented:** S03 ck1 (grammar and content), ck2 (holding feats), ck3 (offers). Deeper than recorded: characters hold **no** feats in engine state (`snapshots.ts:26` "v1 engine state has neither"), so S03 also adds `learnFeat` (DD-S11). |
| R-GM-1: restored `offerIndex` restarts at 0 | grid-movement FINAL-REPORT | **Implemented:** S03 ck4 (envelope `offeredCount`). The workaround at `movement-journey.test.ts:263-264` is removed. |
| R-GM-2: a `use`-raised offer restores into `resolved` | grid-movement FINAL-REPORT | **Implemented:** S03 ck4 (envelope `phase`). |
| Latent (new): pool and vancian spend is lost on combat restore | Planner source read: `snapshots.ts:559-560`, `combat.ts:1105-1117` | **Implemented:** S02 ck4 (`poolsSpent`, `slotsCast`). |
| Latent (new): only the first open offer per combatant is serialized | `snapshots.ts:462-465` (`offeredBy` keeps the first) | **Implemented:** S03 ck4 (envelope `offers`, all of them, in order). |
| Latent (new): `spells.tagged:` restricts never bite in combat | `combat.ts:737` reads `actions.tagged:` only; `dark-fantasy.json:440` hexbound | **Implemented for spells:** S02 ck1 (DD-S10). Action matching is unchanged. |
| Per-target save modifiers: in a burst every target saves with the primary target's value | grid-combat S03 note; `effect.ts:292-296`, `resolve.ts` `effectVars` | **Implemented:** S02 ck2 (DD-S19), required by DD-S8's empty-cell blasts. |
| Action/spell id collision | Planner's earlier claim | **Disproved:** `helpers.ts:105` `registerId` registers every action (`actions.ts:39`) and spell (`content.ts:420`) id in one namespace, and a duplicate is `E-DUP-01`. No DB change (DD-S16). |
| Self-buff actions (`withdraw`, `brace`, `ward-glint`) apply their condition to the declared opponent | `combat.ts:759-806` resolves to opponents only; `dark-fantasy.json` actions | **Carried, unchanged for actions.** Spells may target any combatant (DD-S8), and feats target their holder (DD-S12). Owner: a future feature that touches action targeting. |
| zombie-urban classes declare empty `spellLists`, so no character knows its 4 spells | theme read at `55b294f` | **Carried:** content decision. S02 still adds the turn cost to those spells for consistency. Owner: the next content feature. |
| FR-6 feat slots: no progression field exists | `artifacts.ts` `ClassProgression` | **Carried:** v1 `learnFeat` has no slot limit (DD-S11), and the docs say so. Owner: a future feat-progression feature (schema event). |
| R-GM-3 resume provoke skip; F-M2 reach floor; `heal` missing from `EFFECT_VOCABULARY`; `useItem` duration display; restricts-matcher API; item tags; med-kit vigor; wyldwood charm armor; `evalPackFormula` parse-once; browser determinism leg | prior ledgers | **Carried, untouched:** this feature edits no provoke, reach, DSL vocabulary or item code. Owners as recorded in grid-movement's FINAL-REPORT. |
| Framework wording items (Spec/DB "never spawned", the STATE row matcher, the await idle timeout, etc.) | ARCHIVIST-LOG | **Out of scope:** these concern role documents, not the product. |

## Design Decisions

**Human answers (2026-09-30):** DD-S1, DD-S2 and DD-S3.
**Announced Planner defaults, not objected to:** DD-S4 … DD-S7.
**Human answer on DD-S8 (2026-09-30):** spell range + empty-cell blasts; DD-S8 rewritten.
**Confirmed by the human (B-S1, 2026-09-30, "8a - yes 8b - fine 9 cost a turn 10 yes 11 yes 12 yes 13 yes 14 yes"):** DD-S8 sub-defaults (a)/(b),
DD-S9 (as "cost a turn", read as the whole turn), DD-S10 … DD-S14.
**Corrections from source:** DD-S15 and DD-S16.
**Auto-decision (implied by approved FR-9/FR-11):** DD-S19.

1. **DD-S1 — one DB re-entry (human: "1 approved").** Contract v1.6:
   - snapshot combatant `poolsSpent` and `slotsCast`;
   - envelope `offers`, `phase` and `offeredCount`;
   - the trigger grammar in `pack.schema.json`;
   - database.md text for combat casting, settlement and feats.

   `schemaVersion` stays 1. No rule id is added. Two compatibility caveats are recorded:
   the stricter trigger grammar (DD-S13), and the per-combatant `pendingTrigger` becoming
   legacy-read-only (DD-S14).
2. **DD-S2 — only characters cast (human: "2 agreed").** Statblocks gain no spell field.
   A statblock profile carries no `spells`, so declaring a spell id as a monster is
   `no-action`.
3. **DD-S3 — fix F-M1 here (human: "3 yes").** See DD-S11 … DD-S13.
4. **DD-S4 — no cast verb.**
   - A spell is declared with `fight.declare(spellId, { targetId? | at? })` (DD-S8).
   - A combatant may declare a spell only if its id is in the combatant's `spells` list.
     `profileFromCharacter` sets that list to `knownSpells(runtime, state)`, and emits it
     only when it is non-empty.
   - Otherwise the declare is rejected `no-action` (`E-REF-01`), with the message
     `combatant "<id>" does not know spell "<spellId>".`
5. **DD-S5 — pool spells cast in combat.**
   - A `cost.points` spell draws from the combatant's pool and records `poolsSpent`.
   - database.md's "point-pool spells have no cast verb in v1" (line 313) is rewritten:
     they are cast in combat. Out-of-combat pool casting is still not a verb.
6. **DD-S6 — armor in combat works exactly as outside (DD-EG5 kept).**
   - Only a **vancian** spell cast is gated.
   - `profileFromCharacter` evaluates `armorBlockingCast` (currently private,
     `pools.ts:208`, so S02 exports it) and emits `castBlockedBy: <itemId>` only when it
     blocks.
   - A vancian spell declared while `castBlockedBy` is set is rejected:
     `{kind: 'armor-not-castable', rule: 'E-REF-01', resource: <itemId>}`.
   - The check runs after the spatial gate and before cost.
7. **DD-S7 — `settleSpellCasts(runtime, character, fight, combatantId?)`.** It mirrors
   `settleItemUses` (`character-profile.ts:160`):
   - it runs only at `combat-over` (`combat-not-over` otherwise);
   - all refusals are collected before any change;
   - it writes `poolsSpent` and `slotsCast` back to the character;
   - it emits events;
   - it then clears the combatant's spend, so a second call returns `[]`;
   - per-fight idempotence has the same documented limit as R-4.
8. **DD-S8 — spell range, targets and empty-cell blasts (human, 2026-09-30: "8 spell
   need a range, can target empty square for aoe blasts"; sub-defaults (a) "yes" and
   (b) "fine", B-S1 2026-09-30).**
   - **Range is pack data.** A spell may declare `targeting.range`, an integer ≥ 0 in the
     pack's own distance (grid: Chebyshev steps; hex: hex steps; `runtime.spatial.distance`).
     It is measured from the caster's position to the target combatant's position, or to
     the `at` cell. Range 0 = the caster's own cell only.
   - **Range replaces reach for spells.** A spell declare never runs the reach gate
     (`spatialGate`); it runs the range gate instead. Actions keep reach exactly as today
     (`hurl`/`long-shot` stay reach-gated, carried).
   - **Out of range** → one `declare:rejected {kind: 'out-of-range', rule: 'E-SPAT-01',
     resource: <targetId> | "<x>,<y>"}`, with the message `spell "<id>" has range <r>;
     <target> is <d> away.` Nothing changes.
   - **Empty-cell blasts.** A spell whose `targeting.shape` is `burst` may be declared with
     `{ at: { x, y } }` instead of a `targetId`. The cell may be empty, occupied or a
     terrain cell. The burst resolves every standing combatant within its radius of that
     cell, side-blind as today (the caster included when inside). A blast that catches
     nobody is a legal cast: the cost is spent, `spell:cast` and `action:resolved` are
     emitted, and there are no effect events.
   - **`at` refusals** (`invalid-target`, `E-REF-01`, nothing changes): `at` together with
     `targetId`; `at` on a spell whose shape is not `burst` (absent `targeting` = single);
     `at` on an action; `at` on a burst spell whose parse-once effect root is not
     `target(burst-…)`. No shipped spell hits the last case: all 18 bundled burst spells
     have that root with `burst-N` = `targeting.radius` (checked at `55b294f`).
   - **No line of sight** in v1 (no LOS geometry exists); terrain never blocks a spell.
   - **Targets:** a `targetId` may name any combatant in the fight, either side, the caster
     included, so a buff such as `ward-sigil` lands on an ally or on the caster.
   - With neither `targetId` nor `at`: the existing default, the only opponent, else
     `no-target`.
   - **Theater-of-mind packs:** range is never consulted and `at` is ignored (DD-M11
     discipline); a burst resolves to the bound target, as today.
   - **Sub-default (a) — confirm:** `targeting.range` is **optional**. Absent → the
     caster's reach (`spatial.reach`, today's gate), so third-party packs keep loading and
     behaving as in v1.5. *Alternative:* required on every spell of a spatial pack, a load
     error otherwise (a compatibility break).
   - **Sub-default (b) — confirm:** every bundled spell declares `range: 6`. Spells with no
     `targeting` block gain `"targeting": { "shape": "single", "range": 6 }`; burst spells
     keep their shape and radius and gain `"range": 6`. *Alternative:* per-spell ranges
     chosen by content.
9. **DD-S9 — a sample-theme spell costs the caster's whole turn (human, B-S1: "9 cost a
   turn").**
   - Every spell in the three themes gains `"slots": { "main": 1, "move": 1 }` in its cost.
     This is content, not engine: the pack decides. The engine has no "end turn" cost, so
     "a turn" is expressed as the turn slots a turn grants, minus the reaction.
   - After casting, the caster can neither act (`main`) nor take a move-costing action
     (`stride`, `hustle`, `glide`, …) that turn: each is one `declare:rejected`
     `slot-exhausted` / `E-ECON-01`. The **reaction stays available**, so reactive actions
     and feats still fire.
   - Grants (checked at `55b294f`): dark-fantasy and wyldwood declare
     `economy.turnSlots {main: 1, move: 1, reaction: 1}`; zombie-urban declares none and
     derives `main`, `move`, `reaction` from its action costs. All three already grant
     `move`, so no `slot-ungranted` risk.
   - **Interpretation note:** Planner offered A (main only) and B (main + move); the
     human answered "cost a turn" both times. B is the literal reading. Reverting to A
     touches only: the theme edit and its one-liner (S02 ck5 item 1), the grid-journey
     pins (`:409`, `:433`), the theater test's turn advance, and the journey's
     move-rejection assertion.
   - Without a cost, the shipped spells cost no turn slot, so a caster could cast every
     prepared spell in one turn.
10. **DD-S10 — restricts and spells (human-confirmed, B-S1).**
    - A spell declare is blocked when an active condition carries `actions.tagged:<t>`
      **or** `spells.tagged:<t>` and `<t>` is among the spell's tags. A spell is an action
      (FR-9), and database.md:297 says spells use "the same matcher as actions".
    - Action declares are unchanged (`actions.tagged:` only).
    - Effect on dark-fantasy: `hexbound` (`spells.tagged:casting`, line 440) now stops
      casting.
11. **DD-S11 — characters hold feats (human-confirmed, B-S1).**
    - New verb `learnFeat(runtime, state, featId)` plus the facade `character.learnFeat(id)`.
    - It rejects an unknown feat (`unknown-feat`) and a feat already held
      (`feat-known`).
    - It emits `feat:learned {featId}`.
    - `CharacterState.feats?: string[]` is **absent until the first learn**, following the
      `equipped` presence rule, so characters that never learned a feat round-trip
      byte-exact.
    - The character snapshot's `feats` field already exists in the contract
      (`snapshots.schema.json:74`). Restore refuses an unknown feat id with `E-SNAP-01`.
    - **v1 limit:** there is no feat-slot cap. Progression has no feat-slot field
      (FR-6 gap, carried).
    - **Alternative:** the host states feats on the combat profile only, so characters
      never hold them. Rejected as a default because then generated play never fires a
      feat.
12. **DD-S12 — reactive feats in combat (human-confirmed, B-S1).**
    - A combatant's `feats` list holds every reactive feat the character has learned.
    - A matching event offers the feat exactly as a reactive action is offered: per call,
      once per (reactor, event), not to downed combatants.
    - `trigger:fired` carries `source: 'feat'`, and its `why.rule` is
      `content.feats.<id>.trigger`.
    - **Take:** the feat costs nothing (feats declare no cost) and passes no restriction
      or reach gate. Its parse-once effect runs with the **holder as its target**, and
      `why.rule` is `content.feats.<id>`. A `targetId` other than the holder is
      `invalid-target`.
    - **Decline:** one `trigger:declined`.
    - **No chain:** events emitted while a feat resolves never offer *feats*, although
      reactive actions may still be offered. Without this rule, dark-fantasy's
      `second-gust` (on condition applied to self → apply `braced` to self) would re-offer
      itself forever, and zombie-urban's `second-gust`/`last-legs` would ping-pong.
    - **Alternative:** a pack-declared `once` gate. The mock `triggers.html` shows
      `"once": "per:encounter"`, but no schema field exists, so that would be a schema
      addition.
13. **DD-S13 — the trigger grammar is checked at load (human-confirmed, B-S1).**
    - `trigger.on` must match
      `^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)*(\[(target|actor)=[a-z][a-z0-9-]*\])?$`. That is
      the `eventMatches` grammar (`triggers.ts:31-41`); `self` is the reactor.
    - Anything else is **`E-FORM-01`**, on actions and feats alike (`helpers.ts:296`
      `checkTrigger`). No new rule id.
    - Themes: `condition:applied[self]` → `condition:applied[target=self]` (5 sites:
      dark-fantasy:179, zombie-urban:183/188, wyldwood:361/368).
    - Mock copy: `conditions.html:109` and the `triggers.html` anatomy (which uses
      `on:event(…)` notation and the unsupported `once`) are aligned to the real grammar.
    - **Compatibility caveat:** a v1.5 pack with any other bracket form now fails load.
      The bare forms used by fixtures (`enemy-approaches`, `damaged`) still pass.
    - This follows the v1.1 "tag integrity" precedent: a pattern that can never fire is a
      broken reference, not a silent no-op.
14. **DD-S14 — the combat snapshot envelope (human-confirmed, B-S1).**
    - **`offers`** (optional array, in queue order):
      `[{actorId, source: 'action' | 'feat', id, on}]`. `on` is the live offer's event
      type. v1.6 writers emit `offers` (when non-empty) and **stop emitting** the
      per-combatant `pendingTrigger`.
    - Restore reads `offers` when present, and otherwise the legacy `pendingTrigger`.
      Both present is `E-SNAP-01`.
    - **`phase`** (optional enum of the four `CombatPhase` values): v1.6 writers always
      emit it. Restore order:
      1. frozen hp that satisfy the end rule → `combat-over`;
      2. else the envelope `phase`;
      3. else the v1.5 derivation.

      `phase` `combat-over` while no side is defeated is `E-SNAP-01`.
    - **`offeredCount`** (optional integer ≥ 0): restored into the fight's offer counter,
      so the next `trigger:fired.offerIndex` continues where it left off. Absent → 0.
15. **DD-S15 — correction: `parsePackEffects` is deleted, not reused.** Planner earlier
    said it would be reused. `PackIndex.spellEffects` (`runtime.ts`) already holds every
    spell's parse-once AST, so the function is redundant.
16. **DD-S16 — correction: no id-collision rule is needed.** `E-DUP-01` already enforces
    one id namespace across actions, spells and feats (`helpers.ts:105`).
17. **DD-S17 — the spell event anatomy.** A successful spell declare emits, in order:
    - `spell:cast {spellId, targetId? | at?, cost: 'vancian' | 'points' | 'none',
      slotLevel?, slotIndex?, pool?, amount?}` (actor = caster, `why.rule`
      `content.spells.<id>`; exactly one of `targetId`/`at`; `target` set only with
      `targetId`);
    - the effect's events (`attack:rolled` / `damage:applied` / `condition:applied`, with
      `why.rule` `content.spells.<id>`);
    - `action:resolved {actionId: spellId, targetId}` — or `{actionId: spellId, at}` for an
      empty-cell cast.

    The out-of-combat `spell:cast` payload (`pools.ts`) is unchanged.
18. **DD-S18 — the binding pick.**
    - A vancian **spell** at level `L = String(spell.magic.level)` (where `prepareSpell`
      binds; `pools.ts:161`) consumes the **lowest** index `i` with
      `bindings[L][i] === spellId` and `i ∉ slotsCast[L]`. None found → reject
      `{kind: 'vancian', rule: 'E-VANC-01', resource: L}`, with the message
      `no uncast level-L slot is bound to "<spellId>"`.
    - A vancian **action** (not a spell) consumes the lowest uncast index whose binding is
      non-null. If the combatant has no `bindings`, it consumes the lowest uncast index
      `< boundSlots[L]` (the count-only host form).
    - In both cases the index is pushed to `slotsCast[L]`, and `boundSlots[L]` decrements
      as today.
    - Pinned against theme data: no shipped spell has `cost.vancian ≠ magic.level`
      (checked at `55b294f`).

19. **DD-S19 — per-target defender values (auto-decision; implied by FR-9 "per-target
    saves" and FR-11 "AoE resolution … per-target saves"; closes the carried
    "per-target save modifiers" gap).**
    - Today every combatant inside a `target(shape, …)` scope saves with the **primary
      target's** save value (`effect.ts:292-296` rolls with `ctx.vars`, which
      `resolve.ts` `effectVars` builds from the one bound target), and an attack inside a
      scope compares against the primary target's `ac` (`effect.ts:262`). An empty-cell
      blast has no primary target, so DD-S8 cannot ship without this fix.
    - Mechanism: `EffectApply` gains optional
      `varsFor?(target: EffectTargetRef): Readonly<Record<string, number>>`. When present,
      `execSave` rolls each scoped target's save with `varsFor(target)`, and `execAttack`
      evaluates the defense formula per scoped target with it. DC, attack bonus and damage
      formulas keep `ctx.vars`. Absent → exactly today's behavior (direct executor users
      unchanged). Core stays runtime-ignorant (the CA-G4 `resolveTargets` precedent).
    - `resolve.ts` `executeAgainst` gains an optional `profileFor(id)` lookup and supplies
      `varsFor = ref => effectVars(actor.profile, profileFor(ref.id))`; `combat.ts` passes
      its `profileOf`.
    - For an `at` cast, `executeAgainst`'s bound target is the caster, a nominal binding no
      statement reads (the DD-S8 root guard puts every statement inside the burst scope).
    - Pins move: burst save values in `combat-spatial.test.ts` and `grid-journey.test.ts`
      (S02 ck2 re-keys both). Rollback: drop `varsFor`.

## Verification Baseline

**Planner run at `55b294f` (2026-09-30 19:16, actual):**
- `pnpm build` 0, `pnpm typecheck` 0, `pnpm lint` 0, `pnpm format:check` 0,
  `pnpm check:isolation` 0, `pnpm check:security` 0;
- `pnpm test` **741/741 across 40 files** (1.7 s).

| Command | Scope / notes |
|---|---|
| `pnpm exec vitest run <path>` | The narrow gate. `pnpm test -- <pattern>` does **not** filter (documented hazard). Bare `npx` misresolves in this runtime (Archivist row 9). |
| `pnpm build` then `pnpm test` | Whole suite. The loot/equipment journeys and the new `spells-journey` read `dist/`, so build first. A stale `dist` fails each journey's freshness test. |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check` | Whole-repo fast gates. Orchestrator runs them at every receive (promoted convention). Workers run `pnpm exec prettier --check <lease files>` before each commit. |
| `pnpm check:isolation`, `pnpm check:security` | After `pnpm build`. S02/S03 add runtime-only code; the runtime bundle must carry no compiler strings. |
| JSON parse of contracts | `python3 -c "import json;[json.load(open(p)) for p in ['src/schema/contracts/pack.schema.json','src/schema/contracts/snapshots.schema.json']]"` (S01). |

**Known hazards.** None open. No hanging tests are recorded for this suite, and every
run in prior cycles finished in seconds.

**Pins that move in this feature** (the pin-lease ownership convention):

| Pin | File:line | Moves when | Owner |
|---|---|---|---|
| burst leaves `main` at 1 | `tests/proofs/grid-journey.test.ts:409` | DD-S9 adds the whole-turn cost: `main` **0** and `move` **0** | S02 ck5 |
| rejected cast leaves `main` at 1 | `tests/proofs/grid-journey.test.ts:433` | unchanged value; add `move` stays 1 | S02 ck5 |
| theater-of-mind parity: `ember-halo` burst then `strike` in the same turn | `tests/proofs/grid-journey.test.ts:595-645` | `packWithBurstAction` is deleted, and the real spell now costs `main`, so the same-turn `strike` is `slot-exhausted` | S02 ck5 (see its item 2) |
| burst per-target save values | `tests/runtime/combat/combat-spatial.test.ts:294-362`, `tests/proofs/grid-journey.test.ts:342-410` | DD-S19 rolls each target's save with its own value | S02 ck2 (re-key; recompute each expected total from the target's own save) |
| whole-profile shape | `tests/runtime/combat/character-profile.test.ts:313-330` | S02 adds `spells`/`castBlockedBy` (both emitted only when set; the zombie-urban survivor knows no spells, so it probably does not move) | S02 ck3 (re-key if red) |
| spell targeting closed shape | `tests/schema/validate.test.ts` (any `targeting` unknown-key assertion) | `range` becomes a known key | S02 ck2 |
| serialized `pendingTrigger` | `tests/snapshots/combat.test.ts:123-125`, `:606` | DD-S14 stops writing it | S03 ck4 |
| R-GM-1 workaround | `tests/proofs/movement-journey.test.ts:263-264` | `offeredCount` restores | S03 ck4 |
| feat pattern literals | `tests/runtime/fixtures/packs.ts:136`, `tests/compiler/pipeline.test.ts:67`, `tests/compiler/stages.test.ts:77` | DD-S13 grammar | S03 ck1 |
| README ```ts block count = 4 | `tests/proofs/docs-run.test.ts:49` | Never in this feature: README additions use ```text/```json only | S03 ck5 (keeps 4) |
| `RULE_IDS` 15 / DSL `REGISTRY` 14 | `tests/schema/registry.test.ts` | Never: no id is added | — |

## Capability Readiness

| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|----|--------------------------------|---------------------------------|------------------------|--------------------------------|--------|-------------------------|-------------------------------|
| CAP-S1 | A character casts a known spell in combat: `fight.declare(spellId, {targetId?})` → gates → spend → effect → events (FR-9, FR-10) | known spells (`knownSpells`, `pools.ts`), bindings (character `slots`), armor (`armorBlockingCast`) → profile/balances (S02 ck3); spell AST (`index.spellEffects`, landed) | CA-S1, CA-S4, CA-S5; S01 | S02 ck3 | planned | — | — |
| CAP-S9 | A spell is gated by its pack-declared range; a burst spell may be centered on an empty cell, hitting everyone in radius with per-target saves (FR-9, FR-11; human 2026-09-30) | `targeting.range` (S01 contract, S02 ck2 mirror/validator), `runtime.spatial.distance` (landed), `varsFor` (S02 ck2), theme ranges (S02 ck5) | CA-S9; S01 | S02 ck2 (unit), S02 ck5 (journey empty-cell leg) | planned | — | — |
| CAP-S2 | A mid-fight snapshot keeps the spell spend, and restore continues it (FR-14) | `poolsSpent`/`slotsCast` (S02 ck4) | CA-S2; S01 contract | S02 ck4 | planned | — | — |
| CAP-S3 | After `combat-over`, `settleSpellCasts` writes the spend into the character, which persists in a character snapshot | combatant spend (S02 ck4) | CA-S3 | S02 ck4 | planned | — | — |
| CAP-S4 | **First narrow journey:** the generated dark-fantasy pack (seed 42), through `dist/`: prepare → profile → start → declare the real `ember-bloom` → an empty-cell blast → snapshot/restore → finish → settle → character snapshot shows the slots emptied; plus a wyldwood pool-spell leg | all of the above; theme spell costs + ranges (S02 ck5) | CA-S1…S5, CA-S9 | S02 ck5 | planned | — | the S03 feat leg depends on this proof |
| CAP-S5 | A character learns a feat; feats persist in character snapshots and reach combat (FR-5, FR-13) | `learnFeat` (S03 ck2), profile `feats` (S03 ck2) | CA-S6 | S03 ck2 | planned | — | — |
| CAP-S6 | Reactive feats fire in generated play: offered, taken (effect on the holder) or declined, with no chaining (FR-12 proof 2, FR-13) | feat offers (S03 ck3), theme patterns (S03 ck1) | CA-S6, CA-S7 | S03 ck3 (unit), S03 ck5 (journey leg) | planned | — | — |
| CAP-S7 | A trigger pattern the engine can never match is refused at load (FR-2) | `checkTrigger` (S03 ck1) | CA-S7 | S03 ck1 | planned | — | — |
| CAP-S8 | The combat snapshot keeps every open offer (action and feat), the offer counter and the phase (FR-14; R-GM-1/2) | envelope fields (S03 ck4) | CA-S8 | S03 ck4 | planned | — | — |

**Production paths and acceptance assertions:**
- **CAP-S1:**
  - Path: `profileFromCharacter` → `startCombat` → `Combat.declare` → `executeAgainst`
    → the events stream.
  - Asserts: `spell:cast`, then the effect events, then `action:resolved`, in that order;
    `boundSlots`, `slotsCast`, `poolsSpent` and the turn-slot ledger change exactly.
  - Every rejection (`no-action`, `restricted`, `out-of-range`, `invalid-target`,
    `armor-not-castable`, `vancian`, `points`, `slot-exhausted`) is one `declare:rejected` with
    `serialize()` unchanged.
- **CAP-S2:**
  - Path: `serializeCombat` → JSON text → `deserializeCombat` with the **fight-start**
    balances re-stated.
  - Asserts: remaining pool = start − spent; a cast index cannot be cast again; the next
    dice equal the uninterrupted fight's.
  - Refusals (`E-SNAP-01`): over-spend, an index out of range, an index whose binding is
    null, a duplicate index.
- **CAP-S3:**
  - Asserts: character `pools` decrease by the spend; `slots[L][i]` becomes `null`.
  - `serializeCharacter` → `restoreCharacter` keeps both.
  - A second settle returns `[]`.
  - Refusals with no change: the character changed after the fight (`slot-mismatch`,
    `insufficient-points`), and `combat-not-over`.
- **CAP-S9:**
  - Path: `Combat.declare(spellId, {targetId} | {at})` → range gate → `resolveShape`
    around the center → `executeAgainst` with `varsFor` → events.
  - Asserts: in range succeeds, one step beyond is `out-of-range` with `serialize()`
    unchanged; an empty-cell `ember-bloom` hits exactly the standing combatants within
    radius 2 of the cell on both sides, each save rolled with that target's own save value;
    a blast on a cell with nobody in radius spends the cost and emits no effect events;
    each `at` refusal; theater-of-mind ignores range and `at`.
- **CAP-S5 … CAP-S8:** see S03's Verification.

## Contract Agreements

All rows are **provisional against S01 ck3** (DB text). Before S02 dispatches,
Orchestrator rechecks each row against the landed `database.md` and contracts, then
amends the S02/S03 prompts. S02's landed code becomes the producer for CA-S1 … CA-S5,
which S03 consumes: recheck them at S02 receive.

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|----|------------------------------|--------------------------------|-----------------------|----------------------------------------|-----------|----------|------------------------------------|
| CA-S1 | A spell is an action plus metadata; casting rides the action pipeline (FR-9) | `pack.content.spells[id]` + `index.spellEffects[id]` → `Combat.declare` → executor/events | see below | S02 ck1 (unit), ck5 (journey) | agreed | planned | `combat.ts:515-604`, `runtime.ts` PackIndex at `55b294f` |
| CA-S2 | A spend is recorded; balances are re-stated; restore = re-stated − spend (the `itemsUsed` precedent) | `CombatantState.poolsSpent/slotsCast` → snapshot combatant → `deserializeCombat` | see below | S01 ck3 (contract); S02 ck4 | agreed | planned | `snapshots.ts:413-430, 515-596`, `snapshots.schema.json:185-247` |
| CA-S3 | The fight never writes character state; the host settles explicitly | combatant spend → `settleSpellCasts` → `CharacterState.pools/slots` | see below | S02 ck4 | agreed | planned | `character-profile.ts:131-236` |
| CA-S4 | Character → combatant parity (FR-16) | `CharacterState` → `profileFromCharacter` → `CombatantProfile` / `EconomyBalances` | `spells` = `knownSpells` (non-empty only); `castBlockedBy` = `armorBlockingCast` (set only); `balances.bindings` = deep copy of `state.slots`; `feats` = `state.feats` (non-empty only, S03) | S02 ck3; S03 ck2 | agreed | planned | `character-profile.ts:58-117`, `pools.ts:208, 300-310` |
| CA-S5 | Conditions restrict spells by tag (FR-7, FR-9) | `content.conditions[*].restricts` → `restrictionRejection` | DD-S10 | S02 ck1 (unit), ck3 (integrated) | agreed | planned | `combat.ts:732-757`, `conditions.ts:41` |
| CA-S6 | Reactive feats ride the trigger substrate (FR-13; mocks triggers/conditions) | `CharacterState.feats` → profile → `CombatantState.feats` → `offersForEvent` → `respond` | DD-S11/S12; `PendingTrigger.source`; `triggerId = <combatantId>.<id>` (ids are globally unique, E-DUP-01) | S03 ck2–ck3 | agreed | planned | `triggers.ts:44-81`, `combat.ts:619-640, 1237-1289` |
| CA-S7 | The trigger pattern grammar is the `eventMatches` grammar, enforced at load | `pack.schema.json` `trigger.on` pattern → `checkTrigger` → `eventMatches` | DD-S13 regex; `E-FORM-01`; jsonPath `<base>.trigger.on` | S01 ck3; S03 ck1 | agreed | planned | `helpers.ts:296-325`, `triggers.ts:31-41` |
| CA-S9 | Spell range and area center (FR-9, FR-11; human 2026-09-30) | `content.spells[id].targeting.{shape,radius,range}` → `Combat.declare` range gate / `at` → `resolveShape(center)` → executor `varsFor` | see below; DD-S8, DD-S19 | S01 ck3 (contract); S02 ck2 (unit), ck5 (journey) | agreed | planned | `spatial.ts:45-63, 93-135`, `combat.ts:1064-1092`, `resolve.ts` `executeAgainst`/`effectVars`, `effect.ts:255-307, 383-393`, `content.ts:497-530` at `55b294f` |
| CA-S8 | The combat envelope keeps offers/phase/counter (FR-14) | `Combat.pendingTriggers`/`state.phase`/`offeredCount` → envelope → `deserializeCombat` | DD-S14 | S01 ck3; S03 ck4 | agreed | planned | `snapshots.ts:461-610, 757-770`, `combat.ts:439` |

**CA-S1 — explicit mapping**
- **Lookup:** `pack.actions[id]` first, then `pack.content.spells[id]` (ids are unique, so
  at most one hit). Neither → `no-action` "is not declared in the pack" (unchanged).
- **Spell membership:** the id is in `actor.spells`; else `no-action` (DD-S4).
- **Bound action:** `def = {cost: spell.cost, effect: spell.effect, tags: spell.tags}`,
  `ast = index.spellEffects[id]`. Rule base `content.spells.<id>`, used for every
  `why.rule` of the cast.
- **Gate order:** restriction (CA-S5) → target or `at` (DD-S8; for spells, a same-side
  target is allowed) → for a spell the range gate (CA-S9), for an action the existing
  `spatialGate` → armor (vancian only, DD-S6) →
  `checkCost` → binding pick (DD-S18) → `spend` → `applyNonSlotCosts` (records the spend)
  → `resolve` (rule base `content.spells.<id>`).
- **Rejection:** one `declare:rejected`, and nothing changes: slots, pools, `slotsCast`,
  `poolsSpent`, RNG.
- **Events:** DD-S17.
- **Spells never move** (`move` in a spell is already `E-FORM-02`), so `moveBudgetAst`
  stays action-only.
- **Reactive resolution** (`resolveReactive`) stays action-only. Spells have no
  `trigger`.

**CA-S9 — explicit mapping**
- **Contract:** `pack.schema.json` spells `targeting.properties.range`: `{type: integer,
  minimum: 0}`; `required` stays `["shape"]`. Mirror: `SpellTargeting.range?: number`.
  Validator: `checkTargeting` admits `range`; a non-integer or negative value is
  `E-SCHEMA-01` at `<base>.targeting.range`.
- **Declare options:** `DeclareOptions.at?: Position`. `at` + `targetId` → `invalid-target`.
- **Effective range** (spatial packs only): `targeting.range` if declared, else the caster's
  reach (`reachOf(actor.id)`, the same number `spatialGate` uses today).
- **Distance:** `runtime.spatial.distance(actor.position, center)`; `center` = the target's
  position, or `at`. `distance > range` → `{kind: 'out-of-range', rule: 'E-SPAT-01',
  resource: targetId | "x,y"}`.
- **`at` legality:** the spell's `targeting.shape === 'burst'` and its AST root is
  `target(burst-…)`; otherwise `invalid-target` (`E-REF-01`). Actions never accept `at`.
- **Shape resolution:** `resolveShape(shape, actor, center: Position | undefined,
  bound: CombatantState)`. `burst-N` filters standing positioned combatants by
  `inBurst(center, N, …)` (unchanged geometry); `adjacent` is unchanged; theater-of-mind
  returns `[bound.id]` (unchanged).
- **Executor:** an `at` cast binds the caster as the nominal target; `varsFor` (DD-S19)
  supplies every scoped target's own defender values.
- **Events:** DD-S17 (`spell:cast`/`action:resolved` carry `at` instead of `targetId`).
- **Theater-of-mind:** no range gate; `at` is ignored; resolution as today.

**CA-S2 — explicit mapping**
- **`CombatantState` additions:**
  - `spells: string[]`;
  - `bindings?: Record<L, (string | null)[]>` (deep copy of `balances.bindings`);
  - `slotsCast: Record<L, number[]>` (`{}` at start);
  - `poolsSpent: Record<pool, number>` (`{}` at start);
  - `castBlockedBy?: string`.
- **Live balances.** `pools` and `boundSlots` stay as they are today (decremented), so
  existing assertions keep holding. The live values always equal
  `re-stated − poolsSpent` and `re-stated boundSlots[L] − |slotsCast[L]|`.
- **Snapshot combatant (v1.6, optional):**
  - `poolsSpent {pool: integer ≥ 1}`, emitted only when non-empty;
  - `slotsCast {L: [unique integers ≥ 0]}`, emitted only when non-empty.
- **Restore:** `pools[p] = restated[p] − poolsSpent[p]`;
  `boundSlots[L] = restated[L] − |slotsCast[L]|`; `bindings` re-stated; spends copied.
  `E-SNAP-01` for any of:
  - an unknown pool, or an over-spend;
  - a level the combatant has no re-stated slots for;
  - an index `≥` the re-stated binding length (or `≥ boundSlots[L]` when there are no
    bindings);
  - an index whose re-stated binding is `null`;
  - a duplicate index.

  All cards are collected before any rebuild.
- **Absent fields:** absent = nothing spent (the v1.5 behavior, exact).

**CA-S3 — explicit mapping**
- **Preconditions:** `phase === 'combat-over'`, else `combat-not-over`; the combatant
  exists, else `unknown-target`.
- **Refusals, all collected before any change:**
  - for each pool `p` in `poolsSpent` (id order): `state.pools[p]` is missing →
    `unknown-pool`; `< spent` → `insufficient-points`;
  - for each `L`, `i` in `slotsCast` (ascending): `state.slots[L]?.[i]` must equal the
    combatant's `bindings[L][i]` (non-null) → otherwise `slot-mismatch`. When the
    combatant has no bindings (count-only), the cast cannot be mapped to the character →
    `slot-unmapped`.
- **Apply:**
  - `pools[p] -= spent`, then `pool:settled {combatantId, pool, amount}`;
  - `slots[L][i] = null`, then `slot:settled {combatantId, slotLevel, slotIndex, spellId}`.

  `actor` = character id; `why.rule` is `content.spells` for slots and `pools.<p>` for
  pools.
- **Finish:** clear `poolsSpent` and `slotsCast` on the combatant; return the events.

## Current Blockers

| ID | Affects | Next action | Owner | Evidence to clear |
|----|---------|-------------|-------|-------------------|
| — | — | None open. **B-S1 cleared** 2026-09-30 ("8a - yes 8b - fine 9 cost a turn 10 yes 11 yes 12 yes 13 yes 14 yes", recorded in Intent). DD-S9 was read as the whole turn; see the interpretation note under DD-S9. | — | — |

## Handoff Notes

*(Orchestrator writes here after each session, verbatim from Coder's Handoff.)*
