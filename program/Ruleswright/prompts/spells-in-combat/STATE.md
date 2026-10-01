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
    If the human meant only the main action, revert DD-S9 to `main: 1` and the S02/S03
    edits listed under DD-S9; nothing else depends on it.
  - DD-S10 … DD-S14: confirmed as written.
  - The confirmation authorizes S01's design-change class for `magic.html`,
    `api-map.html`, `triggers.html` and `conditions.html`.
- **Plan HEAD:** `55b294f` (clean tree; all gates green, see Verification Baseline).
  Plan committed at `ac0e225`; amended for the DD-S8 answer (S01 gains Spec ck1; S02 gains
  ck2 "range and area targeting" and widens to M01/M02); amended again for the B-S1
  answer (DD-S9 whole-turn cost; the theater-of-mind grid-journey test is now leased work).
  Replanned at `56476e9` by REPLAN-SIC-01, after the Archivist planning-completeness
  review (F-P1 … F-P17; see "Planning completeness review" below). Source is unchanged since
  `55b294f`.
- **Sessions:** 3. They run serially: S01 Author re-entry (Spec → Designer → DB) → S02 the spell
  column → S03 the feat/trigger column, snapshot envelope and README.

## Session Status

| # | Session | Modules | Owns | Status | Checkpoint | Completed | Notes |
|---|---------|---------|------|--------|------------|-----------|-------|
| 01 | Author re-entry: FR-9/FR-11 spell range, magic/api-map/triggers/conditions mocks + contract v1.6 | — (Author: Spec, Designer, DB) | `program/Ruleswright/specs/requirements.md`, `program/Ruleswright/mocks/magic.html`, `program/Ruleswright/mocks/api-map.html`, `program/Ruleswright/mocks/triggers.html`, `program/Ruleswright/mocks/conditions.html`, `program/Ruleswright/specs/database.md`, `src/schema/contracts/pack.schema.json`, `src/schema/contracts/snapshots.schema.json` | done | 3/3 (`e5e1d7f`, `67705d9`, `1639a19`) | 2026-09-30 | Author roles, not Coder; 3 checkpoints (Spec added for DD-S8); B-S1 cleared 2026-09-30 |
| 02 | The spell column: declare spells, range + empty-cell bursts, spend + snapshot, settlement, generated spells, spell journey | M01 (mirror/validator), M02 (executor), M03, M04 (content) | `src/schema/artifacts.ts`, `src/schema/validate/sections/content.ts`, `src/core/dsl/effect.ts`, `src/runtime/combat/combat.ts`, `src/runtime/combat/action-economy.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/character-profile.ts`, `src/runtime/pools.ts`, `src/runtime/snapshots.ts`, `src/runtime/index.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `tests/schema/validate.test.ts`, `tests/core/dsl/effect.test.ts`, `tests/runtime/combat/spells.test.ts`, `tests/runtime/combat/combat-spatial.test.ts`, `tests/runtime/combat/character-profile.test.ts`, `tests/runtime/fixtures/packs.ts`, `tests/snapshots/combat.test.ts`, `tests/proofs/grid-journey.test.ts`, `tests/proofs/rules-are-data.test.ts`, `tests/proofs/spells-journey.test.ts` | done | 5/5 (`010d730`, `89a11e7`, `9ec0410`, `45c6fce`, `ab6d6f6`) | 2026-09-30 | depends S01; 5 checkpoints; replanned (F-P1/P2/P3/P5/P7/P8/P12/P13) |
| 03 | The feat column: trigger grammar, feats held + offered, snapshot envelope, README | M01, M03, M04 (content) | `src/schema/validate/helpers.ts`, `src/runtime/feats.ts`, `src/runtime/character.ts`, `src/runtime/runtime.ts`, `src/runtime/combat/triggers.ts`, `src/runtime/combat/combat.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/character-profile.ts`, `src/runtime/snapshots.ts`, `src/runtime/index.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `tests/schema/validate.test.ts`, `tests/runtime/fixtures/packs.ts`, `tests/compiler/pipeline.test.ts`, `tests/compiler/stages.test.ts`, `tests/compiler/coverage-floor.test.ts`, `tests/runtime/feats.test.ts`, `tests/runtime/combat/feat-triggers.test.ts`, `tests/runtime/combat/movement.test.ts`, `tests/runtime/combat/combat.test.ts` (rev 2), `tests/snapshots/character.test.ts`, `tests/snapshots/combat.test.ts`, `tests/proofs/movement-journey.test.ts`, `tests/proofs/rules-are-data.test.ts`, `tests/proofs/spells-journey.test.ts`, `tests/proofs/docs-run.test.ts`, `README.md` | done (lease rev 2) | 5/5 (`d9a6d71`, `e5e1a55`, `8d04c5e`, `c6128bd`, `5cfad48`) | 2026-09-30 | depends S02; 5 checkpoints; `movement.test.ts` added (F-P4) |

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
| Latent (new): `spells.tagged:` restricts never bite in combat | `combat.ts:737` reads `actions.tagged:` only; `dark-fantasy.json:440` hexbound | **Implemented for spells in combat:** S02 ck1 (DD-S10), through the exported `matchesRestriction`. Action matching is unchanged; out of combat, see the carried asymmetry row below. |
| Per-target save modifiers: in a burst every target saves with the primary target's value | grid-combat S03 note; `effect.ts:292-296`, `resolve.ts` `effectVars` | **Implemented:** S02 ck2 (DD-S19), required by DD-S8's empty-cell blasts. |
| Action/spell id collision | Planner's earlier claim | **Disproved:** `helpers.ts:105` `registerId` registers every action (`actions.ts:39`) and spell (`content.ts:420`) id in one namespace, and a duplicate is `E-DUP-01`. No DB change (DD-S16). |
| Self-buff actions (`withdraw`, `brace`, `ward-glint`) apply their condition to the declared opponent | `combat.ts:759-806` resolves to opponents only; `dark-fantasy.json` actions | **Carried, unchanged for actions.** Spells may target any combatant (DD-S8), and feats target their holder (DD-S12). Owner: a future feature that touches action targeting. |
| zombie-urban classes declare empty `spellLists`, so no character knows its 4 spells | theme read at `55b294f` | **Carried:** content decision. S02 still adds the turn cost to those spells for consistency. Owner: the next content feature. |
| FR-6 feat slots: no progression field exists | `artifacts.ts` `ClassProgression` | **Carried:** v1 `learnFeat` has no slot limit (DD-S11), and the docs say so. Owner: a future feat-progression feature (schema event). |
| R-GM-3 resume provoke skip; `heal` missing from `EFFECT_VOCABULARY`; `useItem` duration display; item tags; med-kit vigor; wyldwood charm armor; `evalPackFormula` parse-once; browser determinism leg | prior ledgers | **Carried, untouched:** this feature edits no provoke, DSL vocabulary or item code. Owners as recorded in grid-movement's FINAL-REPORT. |
| F-M2 reach floor (`canReach` compares against `max(reach, defaultReach)`, so a reach entry below the default is ignored) | grid-movement ledger; `spatial.ts:99-100, 125` | **Carried; now interacts with the range fallback** (review F-P7). A spell without `targeting.range` uses the same `max(reachOf ?? default, default)` value (DD-S8 a, CA-S9), so it inherits the floor deliberately: absent-range packs behave exactly as today's reach gate. Fixing F-M2 later must change both sites together. Owner as recorded in grid-movement's FINAL-REPORT. |
| Restricts-matcher API (C1: `matchesRestriction`/`isLivePattern`/`declaredTags` had no non-test consumer; combat ran its own actions-only matcher) | ARCHIVIST-LOG C1 | **Partially touched** (review F-P5). S02 ck1 makes `combat.ts` `restrictionRejection` call the exported `matchesRestriction` + `declaredTags` for both kinds, deleting the inline duplicate; `conditions.ts` is not edited. `isLivePattern` still has no non-test consumer (carried). If the call turns out to need a `conditions.ts` edit, S02 keeps a local helper and C1 stays carried. |
| Restricts asymmetry (new): (a) in combat, a spell is blocked by `actions.tagged:` **or** `spells.tagged:` (DD-S10), while out of combat `isRestricted`/`restrictedIds` stay kind-exact, so `actions.tagged:` never restricts a spell there; (b) load-time tag integrity checks `actions.tagged:` patterns only (`helpers.ts:526` `RESTRICTS_PREFIX`, `src/schema/validate/sections/cross.ts:56`), so a `spells.tagged:` pattern naming an undeclared tag loads silently and now bites in combat | review F-P5 (checked at `56476e9`) | **Carried.** Conservative default: no existing out-of-combat behavior changes in v1.6. S01 ck3 states the stance in database.md, and S02 ck1 pins (a) with an `isRestricted` assertion. Owner: a future restricts feature. Whether out-of-combat `isRestricted` should follow combat is a **product question**, listed for the human in the Final Report, not asked now. |
| Wyldwood `hedge-mage` knows no spells: the class declares `spellLists ['hedge']` (`wyldwood.json:270`), but its 4 spells (`gloam-veil`, `wyrd-bloom`, `verge-light`, `briar-word`) list `hedge-mage` (`wyldwood.json:458, 473, 492, 507`). The review said 5; the generated pack has 4 | review F-P10 (generated pack probed at `56476e9`) | **Carried:** content decision. The S02 pool leg uses the wyldwood `hexer` / `hex-bolt` instead. Owner: the next content feature. |
| Theme feats exercised only by grammar: zombie-urban `second-gust`/`last-legs` and wyldwood `second-gust`/`gloam-step` are never offered in a test; only dark-fantasy `second-gust` is | review F-P11 | **Accepted:** S03 ck1's per-theme `coverage-floor` grammar check covers them; the offer path is proven once (dark-fantasy). ARCHIVIST-LOG C11's "generated-hash pins will move" is **disproved**: no literal hash pins exist in `tests/` (grep at `56476e9`). |
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
     caster's effective reach, which is the `canReach` value
     `max(reachOf(actor) ?? spatial.reach.default, spatial.reach.default)` (the F-M2 floor;
     `spatial.ts:99-100, 125`). Absent-range packs therefore behave exactly as today's
     reach gate, and third-party packs keep loading and behaving as in v1.5 (review F-P7
     corrected the earlier `reachOf ?? default` wording). *Alternative:* required on every
     spell of a spatial pack, a load error otherwise (a compatibility break).
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
     touches only these (completed by review F-P14):
     - the theme edit and its one-liner (S02 ck5 item 1);
     - the grid-journey pins (`:409`, `:433`);
     - the theater test's same-turn `strike` rejection (it would stay `slot-exhausted`
       only through `main`; the in-between declares are unaffected);
     - the spells-journey move-rejection assertion (S02 ck5 vancian step 4);
     - the spells-journey freshness assertion `slots: { main: 1, move: 1 }`;
     - the CAP-S9/CAP-S1 "`main` spent" style assertions that name `move`;
     - the README whole-turn text (S03 ck5, "the whole-turn cost in the sample themes").
   - Without a cost, the shipped spells cost no turn slot, so a caster could cast every
     prepared spell in one turn.
10. **DD-S10 — restricts and spells in combat (human-confirmed, B-S1; scoped by review
    F-P5).**
    - **In combat,** a spell declare is blocked when an active condition carries
      `actions.tagged:<t>` **or** `spells.tagged:<t>` and `<t>` is among the spell's tags.
      A spell is an action (FR-9), and database.md:297 says spells use "the same matcher as
      actions".
    - **Mechanism:** `combat.ts` `restrictionRejection` calls the exported
      `matchesRestriction` (`conditions.ts:41-52`) with `declaredTags`. It checks kind
      `'action'` for every declare, plus kind `'spell'` for a spell declare. The inline
      duplicate matcher (C1) is deleted, and `conditions.ts` is not edited.
    - Action declares are unchanged (`actions.tagged:` only).
    - **Out of combat, unchanged (conservative default):** `isRestricted`/`restrictedIds`
      stay kind-exact (`tests/runtime/conditions.test.ts:67-72`). The resulting asymmetry,
      and the missing load-time integrity check for `spells.tagged:`, are carried (see
      Inherited findings). Whether out-of-combat behavior should follow combat is a
      product question for the Final Report.
    - S01 ck3's database.md text states the rule as a combat-declare rule, together with
      the out-of-combat stance.
    - Effect on dark-fantasy: `hexbound` (`spells.tagged:casting`, line 440) now stops
      casting in a fight. The fixture `hexbound` (`actions.tagged:casting`, `packs.ts:159`)
      also blocks a fixture spell in a fight, but not `isRestricted(…, 'spell', …)`.
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
      dark-fantasy:179, zombie-urban:183/188, wyldwood:362/369).
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
    - **Documented consequence (review F-P9; no code change):** a DC and an attack bonus
      keep `ctx.vars = effectVars(actor, bound)` (`resolve.ts:348, 381-395`), where the
      bound target's saves shadow the caster's. A `targetId` cast's DC therefore sees the
      **primary target's** saves, and an `at` cast's DC sees the **caster's**. Every bundled
      DC is a literal, so no shipped spell changes. Per-target `execAttack` defense
      evaluation changes RNG order only for defense formulas that roll dice; no bundled
      pack has one. S01 ck3 writes this into database.md.

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

**REPLAN-SIC-01 probes at `56476e9` (actual; read-only).** These were `/tmp` esbuild
bundles of `src/`, plus reads of the generated packs through the existing `dist/` (built
2026-09-30 19:16; source unchanged since `55b294f`). The repo test suite was **not**
re-run, so 741/741 above is still the Planner-observed baseline.
- **Theater sequence (F-P1).** The wyldwood pack was stripped of `spatial`, with a test
  action carrying `ember-halo`'s cost plus `slots {main:1, move:1}`. Turn order:
  `caster, ally, foe`. The cast used dice `20,4,2,3` (wolf `7→2`). The same-turn
  `strike` was `slot-exhausted`/`main`, with no die drawn and `serialize()` unchanged.
  Then `step()`×2, ally `glide` (no die), `step()`×2, wolf `glide` (no die), `step()` →
  `round-completed`, `step()` → caster `turn-started`. The final `strike` used `5,6`
  (16 damage) → `combat-over`, `{winner: 'allies', defeated: 'enemies'}`.
- **Vancian journey layout (F-P2).** Dark-fantasy, default `Rng(0)`, with a test action
  carrying `ember-bloom`'s cost plus the turn slots (reach widened only so that the
  action stands in for the range gate). Positions: hexer `(0,0)`, wight `(4,0)`,
  shambles `(10,0)`; order `hexer, wight, shambles`.
  - The cast left the wight at 15 → 10 hp. The hexer's same-turn `stride {to:(0,1)}` was
    `slot-exhausted`/`move`.
  - The wight's `stride {to:(5,0)}` and the shambles' `stride {to:(10,1)}` each
    resolved, and the hexer's next turn began.
  - Restore → `awaiting-declare`. Every enemy `hp: 0` in the snapshot → restore
    `combat-over`.
- **Generated facts.**
  - Dark-fantasy: level-3 hexer slots `{'1':[×4], '2':[×3]}`, hp 29, `ember` 18; wight
    hp 15; shambles hp 11; level-1 hexer slots `{'1':[×3]}`; `grave-light` L1 `{vancian:1}`.
  - Wyldwood: `hexer` knows `hex-bolt`/`cold-clasp`/`thorn-wake`, motes 16; `thorn-wolf`
    hp 7; `briar-shade` hp 9; `hedge-mage` knows nothing (F-P10).

**Pins that move in this feature** (the pin-lease ownership convention):

| Pin | File:line | Moves when | Owner |
|---|---|---|---|
| burst leaves `main` at 1 | `tests/proofs/grid-journey.test.ts:409` | DD-S9 adds the whole-turn cost: `main` **0** and `move` **0** | S02 ck5 |
| rejected cast leaves `main` at 1 | `tests/proofs/grid-journey.test.ts:433` | unchanged value; add `move` stays 1 | S02 ck5 |
| theater-of-mind parity: `ember-halo` burst then `strike` in the same turn | `tests/proofs/grid-journey.test.ts:595-642` | `packWithBurstAction` is deleted, and the real spell now costs `main` + `move`, so the same-turn `strike` is `slot-exhausted` (`E-ECON-01`, no die, `serialize()` unchanged). `step()` cannot pass a turn (`combat.ts:467-497`), so the test reaches the caster's next turn through two named in-between declares: the ally `glide`, then the wolf `glide`, both dice-free. The script stays `[1,1,1,20,4,2,3,5,6]`, and the next-turn `strike` ends the fight (Planner probe, `56476e9`) | S02 ck5 (see its item 2) |
| burst per-target save values | `tests/runtime/combat/combat-spatial.test.ts:294-362`, `tests/proofs/grid-journey.test.ts:342-410` | DD-S19 rolls each target's save with its own value | S02 ck2 (re-key; recompute each expected total from the target's own save) |
| whole-profile shape | `tests/runtime/combat/character-profile.test.ts:313-330` | S02 adds `spells`/`castBlockedBy` (both emitted only when set; the zombie-urban survivor knows no spells, so it probably does not move) | S02 ck3 (re-key if red) |
| spell targeting closed shape | `tests/schema/validate.test.ts` (any `targeting` unknown-key assertion) | `range` becomes a known key | S02 ck2 |
| serialized `pendingTrigger` | `tests/snapshots/combat.test.ts:123-125`, `:606` | DD-S14 stops writing it | S03 ck4 |
| exact `pendingTriggers` literal (`{triggerId, actorId, actionId, matchingEvent}`) | `tests/runtime/combat/movement.test.ts:388-395` | S03 ck3 makes `PendingTrigger.source` required; add `source: 'action'` | S03 ck3 (file added to S03's Owns, F-P4; in no other session's lease) |
| exact `pendingTriggers` literal | `tests/proofs/movement-journey.test.ts:216-223` | same as above | S03 ck3 |
| envelope exact key set | `tests/snapshots/combat.test.ts:79-89` | S03 ck4 always writes `phase` and `offeredCount` (add both; `offers` stays absent in that fight) | S03 ck4 |
| restore after a declare = `awaiting-declare` (v1.5 derivation) | `tests/runtime/combat/combat.test.ts:448` | DD-S14 restores the envelope `phase` (`resolved`) | S03 ck4 (lease rev 2; missed at planning, found at attempt 1) |
| narrow-journey `restored.step()` relying on the lost phase | `tests/runtime/combat/movement.test.ts` ~l.327 | DD-S14 | S03 ck4 (in lease; re-keyed to `phase === fight.state.phase`) |
| R-GM-1 workaround | `tests/proofs/movement-journey.test.ts:263-264` | `offeredCount` restores | S03 ck4 |
| feat pattern literals | `tests/runtime/fixtures/packs.ts:136`, `tests/compiler/pipeline.test.ts:67`, `tests/compiler/stages.test.ts:77` | DD-S13 grammar | S03 ck1 |
| README ```ts block count = 4 | `tests/proofs/docs-run.test.ts:49` | Never in this feature: README additions use ```text/```json only | S03 ck5 (keeps 4) |
| `RULE_IDS` 15 / DSL `REGISTRY` 14 | `tests/schema/registry.test.ts` | Never: no id is added | — |
| kind-exact restricts matcher ("wrong-kind prefix never matches") | `tests/runtime/conditions.test.ts:67-72` | Never: `conditions.ts` is not edited; combat calls the matcher once per kind (DD-S10) | — |
| combatant / character-state key sets | `tests/snapshots/combat.test.ts:103`, `tests/snapshots/character.test.ts:45` | Never: `poolsSpent`/`slotsCast` are emitted only when non-empty, and `feats` only after a learn | — |

## Capability Readiness

| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|----|--------------------------------|---------------------------------|------------------------|--------------------------------|--------|-------------------------|-------------------------------|
| CAP-S1 | A character casts a known spell in combat: `fight.declare(spellId, {targetId?})` → gates → spend → effect → events (FR-9, FR-10) | known spells (`knownSpells`, `pools.ts`), bindings (character `slots`), armor (`armorBlockingCast`) → profile/balances (S02 ck3); spell AST (`index.spellEffects`, landed); restricts (`matchesRestriction`/`declaredTags`, `conditions.ts`, landed) | CA-S1, CA-S4, CA-S5; S01 | S02 ck3 (src integration on the dark-fantasy generated pack; the fixture hexer has no class actions, F-P3) | verified (C-S02-1 closed by OWNER-M02-HALF `623a687`: passed save with no fail-branch damage resolves as no damage, `effect.test.ts` +2, `spells.test.ts` +2 combat cast, negative control; Orchestrator gate 102/102 at `aa3eb23` tree) | `tests/runtime/combat/spells.test.ts`, `tests/proofs/spells-journey.test.ts` | out-of-combat restricts asymmetry carried (owner: future restricts feature); C-S02-1 closed `623a687` |
| CAP-S9 | A spell is gated by its pack-declared range; a burst spell may be centered on an empty cell, hitting everyone in radius with per-target saves (FR-9, FR-11; human 2026-09-30) | `targeting.range` (S01 contract, S02 ck2 mirror/validator), `runtime.spatial.distance` (landed), the absent-range fallback = the `canReach` value (`spatial.ts:99-100, 125`, landed), `varsFor` (S02 ck2), theme ranges (S02 ck5) | CA-S9; S01 | S02 ck2 (unit), S02 ck5 (journey empty-cell leg) | verified | `ab6d6f6` (Orchestrator: build/typecheck/lint/format/isolation/security 0, 793/793): `spells.test.ts` (range, `at`, refusals, theater), `effect.test.ts` (`varsFor`, +3), `validate.test.ts` (`range`), journey empty-cell leg through `dist/` | F-M2 floor inherited by the fallback (carried) |
| CAP-S2 | A mid-fight snapshot keeps the spell spend, and restore continues it (FR-14) | `poolsSpent`/`slotsCast` (S02 ck4) | CA-S2; S01 contract | S02 ck4 | verified | `ab6d6f6` (Orchestrator: build/typecheck/lint/format/isolation/security 0, 793/793): `tests/snapshots/combat.test.ts` (+8) + journey restore | — |
| CAP-S3 | After `combat-over`, `settleSpellCasts` writes the spend into the character, which persists in a character snapshot | combatant spend (S02 ck4) | CA-S3 | S02 ck4 | verified | `ab6d6f6` (Orchestrator: build/typecheck/lint/format/isolation/security 0, 793/793): `spells.test.ts` settlement + journey settle → character snapshot round-trip | — |
| CAP-S4 | **First narrow journey:** the generated dark-fantasy pack (seed 42), through `dist/`. Steps: prepare (twice) → profile → start against **two** enemies (wight + shambles; the caster ≥ 3 cells from every burst center) → declare the real `ember-bloom` → the named in-between enemy declares (wight `stride`, shambles `stride`) → an empty-cell blast on the hexer's next turn → snapshot/restore → end via the hp-0-via-restore harness (asserted, with the reason) → settle → the character snapshot shows the slots emptied. Plus a wyldwood pool-spell leg (`hexer` / `hex-bolt`), with the same end route | all of the above; theme spell costs + ranges (S02 ck5) | CA-S1…S5, CA-S9 | S02 ck5 | verified | `ab6d6f6` (Orchestrator: build/typecheck/lint/format/isolation/security 0, 793/793): `tests/proofs/spells-journey.test.ts` through `dist/` built at `ab6d6f6` (hp-0-via-restore ending asserted) | the S03 feat leg depends on this proof; ledger/turn continuity across a restore is **not** claimed at S02 (no envelope `phase` until S03 ck4, CAP-S8) |
| CAP-S5 | A character learns a feat; feats persist in character snapshots and reach combat (FR-5, FR-13) | `learnFeat` (S03 ck2), profile `feats` (S03 ck2) | CA-S6 | S03 ck2 | verified | S03 ck2 `e5e1a55`: `tests/runtime/feats.test.ts` (7), `tests/snapshots/character.test.ts` +3 | — |
| CAP-S6 | Reactive feats fire in generated play: offered, taken (effect on the holder) or declined, with no chaining (FR-12 proof 2, FR-13) | feat offers (S03 ck3), theme patterns (S03 ck1) | CA-S6, CA-S7 | S03 ck3 (unit), S03 ck5 (journey leg) | verified | unit S03 ck3 `8d04c5e` (`feat-triggers.test.ts` 8); journey feat leg through `dist/` S03 ck5 `5cfad48` (`spells-journey.test.ts` +1, negative control without `learnFeat`); rules-are-data proof 2 feat leg; Orchestrator 829/829 at `5cfad48` | — |
| CAP-S7 | A trigger pattern the engine can never match is refused at load (FR-2) | `checkTrigger` (S03 ck1) | CA-S7 | S03 ck1 | verified | S03 ck1 `d9a6d71`: `validate.test.ts` +4, `coverage-floor.test.ts` +3; negative control (theme `[self]`) refuses generation | — |
| CAP-S8 | The combat snapshot keeps every open offer (action and feat), the offer counter and the phase (FR-14; R-GM-1/2) | envelope fields (S03 ck4) | CA-S8 | S03 ck4 | verified | S03 ck4 `c6128bd`: `tests/snapshots/combat.test.ts` (offers order + counter continuity, R-GM-2, legacy v1.5, refusals), `movement-journey.test.ts` (`offerIndex === snap.offeredCount`, workaround removed); Orchestrator 829/829 at `5cfad48` | — |

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
- **CAP-S4:**
  - `step()` never passes a turn (`combat.ts:467-497`): every enemy turn between two
    hexer turns is a named successful declare (S02 ck5).
  - The fight ends through the restore harness (every enemy `hp: 0` in the snapshot →
    `deserializeCombat` derives `combat-over`, `snapshots.ts:585-593`). Only how the fight
    ends is harnessed; spend, restore, settlement and the character round-trip are real.
- **CAP-S9:**
  - Path: `Combat.declare(spellId, {targetId} | {at})` → range gate → `resolveShape`
    around the center → `executeAgainst` with `varsFor` → events.
  - Absent `targeting.range` → `max(reachOf ?? default, default)`, the `canReach` value.
  - Asserts: in range succeeds, one step beyond is `out-of-range` with `serialize()`
    unchanged; an empty-cell `ember-bloom` hits exactly the standing combatants within
    radius 2 of the cell on both sides, each save rolled with that target's own save value;
    a blast on a cell with nobody in radius spends the cost (in the fixture: the bound slot
    only, since its `ember-bloom` costs `{vancian: 2}`, F-P8) and emits no effect events;
    each `at` refusal; theater-of-mind ignores range and `at`.
- **CAP-S5 … CAP-S8:** see S03's Verification.

## Contract Agreements

All rows are **provisional against S01 ck3** (DB text). Before S02 dispatches,
Orchestrator rechecks each row against the landed `database.md` and contracts, then
amends the S02/S03 prompts. S02's landed code becomes the producer for CA-S1 … CA-S5,
which S03 consumes: recheck them at S02 receive.

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|----|------------------------------|--------------------------------|-----------------------|----------------------------------------|-----------|----------|------------------------------------|
| CA-S1 | A spell is an action plus metadata; casting rides the action pipeline (FR-9) | `pack.content.spells[id]` + `index.spellEffects[id]` → `Combat.declare` → executor/events | see below | S02 ck1 (unit), ck5 (journey) | agreed (DB text rechecked vs `1639a19` database.md v1.6, no delta) | landed ck1 `010d730`, ck5 `ab6d6f6`; proof passed at `ab6d6f6` | `combat.ts:515-604`, `runtime.ts` PackIndex at `55b294f`; counterexample C-S02-1 closed by `623a687` (passed-save case proven in `spells.test.ts`) |
| CA-S2 | A spend is recorded; balances are re-stated; restore = re-stated − spend (the `itemsUsed` precedent) | `CombatantState.poolsSpent/slotsCast` → snapshot combatant → `deserializeCombat` | see below | S01 ck3 (contract); S02 ck4 | agreed (rechecked vs `1639a19`, no delta) | contract leg landed S01 ck3 `1639a19`; runtime landed S02 ck4 `45c6fce`; proof passed at `ab6d6f6` | `snapshots.ts:413-430, 515-596`, `snapshots.schema.json:185-247` |
| CA-S3 | The fight never writes character state; the host settles explicitly | combatant spend → `settleSpellCasts` → `CharacterState.pools/slots` | see below | S02 ck4 | agreed (DB text rechecked vs `1639a19` database.md v1.6, no delta) | landed ck4 `45c6fce`; proof passed at `ab6d6f6` | `character-profile.ts:131-236` |
| CA-S4 | Character → combatant parity (FR-16) | `CharacterState` → `profileFromCharacter` → `CombatantProfile` / `EconomyBalances` | `spells` = `knownSpells` (non-empty only); `castBlockedBy` = `armorBlockingCast` (set only); `balances.bindings` = deep copy of `state.slots`; `feats` = `state.feats` (non-empty only, S03) | S02 ck3; S03 ck2 | agreed (DB text rechecked vs `1639a19` database.md v1.6, no delta) | landed S02 ck3 `9ec0410` (spell half); feats S03 ck2 `e5e1a55`; proof passed at `ab6d6f6` | `character-profile.ts:58-117`, `pools.ts:208, 300-310` |
| CA-S5 | Conditions restrict spells by tag in combat (FR-7, FR-9) | `content.conditions[*].restricts` → `restrictionRejection` → the exported `matchesRestriction` + `declaredTags` | DD-S10: kind `'action'` for every declare, plus kind `'spell'` for a spell declare; out of combat `isRestricted` unchanged (kind-exact) | S01 ck3 (DB text, combat-scoped); S02 ck1 (unit, incl. the out-of-combat `isRestricted` pin), ck3 (integrated) | agreed (DB text rechecked vs `1639a19` database.md v1.6, no delta) | landed ck1 `010d730`, ck3 `9ec0410`; proof passed at `ab6d6f6` | `combat.ts:732-757`, `conditions.ts:41-52, 55, 186-213`, `tests/runtime/conditions.test.ts:67-72` at `56476e9` |
| CA-S6 | Reactive feats ride the trigger substrate (FR-13; mocks triggers/conditions) | `CharacterState.feats` → profile → `CombatantState.feats` → `offersForEvent` → `respond` | DD-S11/S12; `PendingTrigger.source`; `triggerId = <combatantId>.<id>` (ids are globally unique, E-DUP-01) | S03 ck2–ck3 | agreed (DB text rechecked vs `1639a19` database.md v1.6, no delta) | landed S03 ck2 `e5e1a55`, ck3 `8d04c5e`; unit proof passed; journey ck5 `5cfad48` passed | `triggers.ts:44-81`, `combat.ts:690-709` (`respond`), `combat.ts:1237-1289` |
| CA-S7 | The trigger pattern grammar is the `eventMatches` grammar, enforced at load | `pack.schema.json` `trigger.on` pattern → `checkTrigger` → `eventMatches` | DD-S13 regex; `E-FORM-01`; jsonPath `<base>.trigger.on` | S01 ck3; S03 ck1 | agreed (rechecked vs `1639a19`, no delta) | contract leg landed S01 ck3 `1639a19`; runtime landed S03 ck1 `d9a6d71`; proof passed | `helpers.ts:296-325`, `triggers.ts:31-41` |
| CA-S9 | Spell range and area center (FR-9, FR-11; human 2026-09-30) | `content.spells[id].targeting.{shape,radius,range}` → `Combat.declare` range gate / `at` → `resolveShape(center)` → executor `varsFor` | see below; DD-S8, DD-S19 | S01 ck3 (contract); S02 ck2 (unit), ck5 (journey) | agreed (rechecked vs `1639a19`, no delta) | contract leg landed S01 ck3 `1639a19`; runtime landed S02 ck2 `89a11e7`; proof passed (unit + journey) at `ab6d6f6` | `spatial.ts:45-63, 93-135`, `combat.ts:1064-1092`, `resolve.ts` `executeAgainst`/`effectVars`, `effect.ts:255-307, 383-393`, `content.ts:497-530` at `55b294f` |
| CA-S8 | The combat envelope keeps offers/phase/counter (FR-14) | `Combat.pendingTriggers`/`state.phase`/`offeredCount` → envelope → `deserializeCombat` | DD-S14 | S01 ck3; S03 ck4 | agreed (rechecked vs `1639a19`, no delta) | contract leg landed S01 ck3 `1639a19`; runtime landed S03 ck4 `c6128bd`; proof passed at `5cfad48` | `snapshots.ts:461-610, 757-770`, `combat.ts:439` |

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
- **Effective range** (spatial packs only): `targeting.range` if declared. Otherwise it is
  `max(reachOf(actor.id) ?? spatial.reach.default, spatial.reach.default)`, the value
  `canReach` compares against (`spatial.ts:99-100, 125`; the F-M2 floor), so absent-range
  packs behave exactly as under today's reach gate (review F-P7).
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

## Planning completeness review (2026-09-30, r-ZVpm)

**Source:** `.program/results/ARCHIVIST-PREFLIGHT.spells-in-combat.result.md`, Archivist
AXluF at `56476e9`. It found 6 blocking and 11 informational findings. Each one was
verified against the committed source by REPLAN-SIC-01 at `56476e9`, and **none was
disproved**. The Orchestrator decisions applied here are recorded in
`.program/decisions.md` (they are not human questions). The human answers (Intent quotes
and B-S1) are unchanged.

| ID | Class | Finding (short) | Verified evidence | Disposition |
|----|-------|-----------------|-------------------|-------------|
| F-P1 | blocking | `step()` cannot pass a turn; the "advance with `step()`" steps cannot run | `combat.ts:467-497`; theater order `caster, ally, foe` (probe) | **Applied.** S02 ck5 theater rewrite with the named in-between declares (ally `glide`, wolf `glide`; script unchanged; probe-verified). The spells journey names the wight's and the shambles' `stride` declares. The S03 feat leg says why none is needed there. The pin row is corrected. No text claims that `step()` passes a turn. |
| F-P2 | blocking | The spells journey can end before its later legs; caster inside its own burst; no end route | `snapshots.ts:585-593`; `combat.ts:516`; probe | **Applied.** The caster stands ≥ 3 cells from every burst center; a second enemy (`grave-shambles`); both legs end through the hp-0-via-restore harness, asserted with its reason; no ledger/turn continuity is asserted across an S02 restore. |
| F-P3 | blocking | The fixture hexer has no class `actions` | `packs.ts:121`; `character-profile.ts:73-84`; `rules-are-data.test.ts:59` | **Applied.** Proof 3's data delta gives the fixture hexer `actions: ['strike']`. The S02 ck3 src integration names the dark-fantasy generated pack. S03 proof 2 uses `learnFeat` + `profileFromCharacter` on a fixture warden whose class gains `actions` (exact construction in SESSION-03). |
| F-P4 | blocking | Pins missing from STATE; `movement.test.ts` outside S03's lease | `movement.test.ts:388-395`; `movement-journey.test.ts:216-223`; `snapshots/combat.test.ts:79-89` | **Applied.** `movement.test.ts` added to S03's Owns (in no other lease). Three pin rows added with their owners. The "stays green unchanged" claim is removed. |
| F-P5 | blocking | DD-S10 builds a second matcher; the inherited "untouched" note is stale | `conditions.ts:41-52`; `conditions.test.ts:67-72`; `helpers.ts:526`; `sections/cross.ts:56` | **Applied.** In combat, DD-S10 is kept and implemented by calling the exported `matchesRestriction` for both kinds (no `conditions.ts` edit). Out of combat it is unchanged. S01 ck3 scopes the DB text. The matcher row is re-dispositioned as partially touched. A carried row records the asymmetry and the `spells.tagged:` integrity gap; it goes to the human in the Final Report. |
| F-P6 | blocking | S01 ck3 leaves stale contract/DB text | `snapshots.schema.json:222, 243`; `database.md:390-391` | **Applied.** The three edits are added to S01 ck3, with a grep commit check. |
| F-P7 | info | The range fallback is not the reach gate's number | `spatial.ts:99-100, 125`; `combat.ts:1099-1103` | **Applied.** The fallback is the `canReach` value; CA-S9, S02 ck2, DD-S8 (a) and the F-M2 row are updated. |
| F-P8 | info | The "catches nobody" assertion contradicts the fixture cost | `packs.ts:151` | **Applied.** S02 ck2 asserts the bound slot only; no fixture spell is added. |
| F-P9 | info | DD-S19: the DC still sees the primary target's saves | `resolve.ts:348, 381-395` | **Recorded** in DD-S19 as a documented consequence; S01 ck3 DB text. No code change. |
| F-P10 | info | Wyldwood `hedge-mage` knows no spells; feat line numbers | `wyldwood.json:270, 362, 369` (probe) | **Applied.** Carried row (owner: next content feature); refs corrected to 362/369. Minor count correction: 4 hedge-mage spells, not 5. |
| F-P11 | info | Only dark-fantasy `second-gust` is ever offered; the C11 hash premise | grep `tests/` (no literal hashes) | **Recorded** as accepted; the C11 "hash pins move" premise is disproved. |
| F-P12 | info | DD17/DD17a doc drift without owners | `combat.ts:642`; `arch/v1-core.md:170-171, 192, 425` (also `:715`, `:817`); PROGRAM-CONFIG Custom Rule 4; `database.md:313`; `README.md:342-343` | **Applied.** The `combat.ts:642` comment → S02 ck1. `arch/v1-core.md` → Orchestrator's S02 arch-delta duty (S02's arch fragment states the replacement text). PROGRAM-CONFIG Custom Rule 4 → final Archivist pass. `database.md:313` stays with S01; `README.md:342-343` stays with S03 ck5. |
| F-P13 | info | Citation drift | `combat.ts:690-709`; `grid-journey.test.ts:595-642`, `:148` | **Applied** in CA-S6, SESSION-03, the pin table and SESSION-02. |
| F-P14 | info | The DD-S9 revert list is incomplete | DD-S9 text | **Applied.** The list now includes the README whole-turn text, the spells-journey freshness assertion and the `move` spent assertions. |
| F-P15 | info | The C6 deletion is justified | `runtime.ts:121`; `resolve.ts:31` | **Confirmed;** no change (S02 ck1 already drops the import). |
| F-P16 | info | The S02 receive gate is clean | structural/relative pins | **Confirmed;** no change. |
| F-P17 | info | Premises confirmed | as listed in the review | **Confirmed;** no change. |

## Current Blockers

| ID | Affects | Next action | Owner | Evidence to clear |
|----|---------|-------------|-------|-------------------|
| — | — | None open. **B-S1 cleared** 2026-09-30 ("8a - yes 8b - fine 9 cost a turn 10 yes 11 yes 12 yes 13 yes 14 yes", recorded in Intent). DD-S9 was read as the whole turn; see the interpretation note under DD-S9. The planning-completeness review's blocking findings F-P1 … F-P6 are resolved by REPLAN-SIC-01 (see "Planning completeness review"), and S01 is dispatchable. | — | — |
| C-S01-1 | `mocks/spatial.html:191` (derived-phase copy goes stale once S03 ck4 writes envelope `phase`) | Carried: an existing-mock copy change outside S01's authorized four-mock design-change; Designer re-entry after S03, listed in the Final Report | Designer (human-authorized design-change) | mock text matches DD-S14 |
| C-S02-1 | CAP-S1, CA-S1 (12 theme sites: dark-fantasy :92/:261/:381/:405/:421/:437/:445, wyldwood :189/:535/:582, zombie-urban :100/:214; actions incl. `cold-grip`) | OWNER-M02-HALF: executor treats `damage(half)` whose save fail branch has no damage as no damage (no throw); regression on a combat cast | **closed** `623a687` (OWNER-M02-HALF) | a passed save on such a spell resolves with no damage event, `action:resolved` emitted, no throw |
| B-S03-1 | S03 ck4/ck5 | Lease revision 2 adds `tests/runtime/combat/combat.test.ts` (one pin re-key); resume S03 from ck3 with its preserved ck4 tree | **cleared**: ck4 `c6128bd`, whole suite 827/827 | ck4 committed with whole suite green |

## Handoff Notes

*(Orchestrator writes here after each session, verbatim from Coder's Handoff.)*

### SESSION-01 — received 2026-09-30 (r-ZVpm, handle h-vs87 / AFZM2)

**Orchestrator receive:** 3/3 commits (`e5e1d7f`, `67705d9`, `1639a19`), every path inside the lease. Gates run by Orchestrator at `1639a19`: typecheck 0, lint 0, format:check 0, build 0, test 741/741 (40 files), check:isolation 0, check:security 0. CA rows rechecked against the landed contracts and database.md v1.6: `targeting.range` {integer, min 0}, required [shape]; trigger `on` pattern on actions and feats equals DD-S13; combatant `poolsSpent`/`slotsCast`; envelope `phase`/`offeredCount`/`offers`; `pendingTrigger` legacy. No delta. No arch fragment (data/docs). spatial.html:191 carried (C-S01-1).

**Handoff (verbatim):**

- **session:** SESSION-01 (spells-in-combat)
- **status:** done
- **checkpoint:** 3 of 3. Commits: `e5e1d7f` (ck1 Spec), `67705d9` (ck2 Designer), `1639a19` (ck3 DB). Each commit used an explicit pathspec, and `git show --name-only` after each one listed only lease files.
- **notes:** S01 Author re-entry is complete. Spec added the FR-9 range criterion and the FR-11 empty-cell area-center criterion. Designer updated `magic.html`, `api-map.html`, `triggers.html` and `conditions.html`. DB wrote contract v1.6 and `database.md` v1.6. No rule id was added, `schemaVersion` stays 1, there are two compatibility caveats, and the text never says "purely additive".
- **delivered:**
  - **FR-9 line, as written (after the targeting criterion):** "- [ ] Spells declare a **range** as pack data. In a pack with a spatial model, a spell whose target (or area center) is farther than its range is rejected declaratively, with no state change. A spell that declares no range reaches as far as its caster's reach. Theater-of-mind packs never consult range."
  - **FR-11 line, as written (after the AoE criterion):** "- [ ] An area spell may be **centered on an empty cell**. Every combatant within the shape is affected, on both sides, each with its own save, and an area that catches nobody is still a legal cast."
  - **Decision Log row:** `| 2026-09-30 | spells-in-combat: spells declare a range (pack data; absent = caster reach); area spells may be centered on an empty cell (human) | FR-9, FR-11 |`. I put it in the existing table format; the "Encoded in" column says FR-9, FR-11.
  - **Mocks:** all four were changed as specified. The anatomy blocks are verbatim apart from HTML escaping, the `once` line is gone, and the fourth timeline row, the proof block and `conditions.html` line 109 were all updated.
  - **JSON paths S02/S03 must mirror:**
    - `pack.schema.json`:
      - `$defs/content/properties/spells/additionalProperties/properties/targeting/properties/range`, which is `{type: integer, minimum: 0}`. The spell targeting `required` stays `["shape"]` and the `allOf` is untouched.
      - `$defs/actionDef/properties/trigger/properties/on/pattern` and `$defs/content/properties/feats/additionalProperties/properties/trigger/properties/on/pattern`. Both equal `^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)*(\[(target|actor)=[a-z][a-z0-9-]*\])?$`. The action `on` keeps `minLength: 1`; the feat `on` never had a `minLength`.
      - New descriptions on the `spells` and `feats` maps.
    - `snapshots.schema.json`:
      - combatant: `$defs/combatSnapshot/properties/combatants/items/properties/{poolsSpent,slotsCast}`;
      - envelope: `$defs/combatSnapshot/properties/{phase,offeredCount,offers}`;
      - each `offers[]` item is `{actorId, source: action|feat, id, on}`, with all four required and `additionalProperties: false`.
  - **Event names:** `spell:cast`, `action:resolved` (with `{actionId, targetId}` or `{actionId, at}`), `pool:settled`, `slot:settled`, `feat:learned`, and `trigger:fired` with `source: 'feat'`.
  - **Settle refusal names:** `combat-not-over`, `unknown-target`, `unknown-pool`, `insufficient-points`, `slot-mismatch`, `slot-unmapped`.
  - **Learn refusals:** `unknown-feat`, `feat-known`.
  - **Cast rejection kinds and rules:**
    - `no-action` / `E-REF-01`
    - `out-of-range` / `E-SPAT-01`, resource `targetId` or `"x,y"`
    - `invalid-target` / `E-REF-01`
    - `armor-not-castable` / `E-REF-01`
    - `vancian` / `E-VANC-01`
    - points / `E-POINTS-01`
    - `slot-exhausted` / `E-ECON-01`
  - **DD-S values:** DD-S2, S4, S5, S6, S8, S10, S11, S12, S13, S14, S17, S18 and S19 are in `database.md` with the meaning STATE gives them. DD-S7 is in the spend-asymmetry paragraph, following CA-S3. Wording deltas, none of which changes a value:
    - **DD-S6:** "after the spatial gate" became "after the target/range gates and before cost", because spells now pass a range gate rather than the spatial gate.
    - **DD-S13:** the grammar is a paragraph under the §actions table, not inside the `trigger` row. The `|` characters in the regex would split a Markdown table cell. The row points to the paragraph.
- **verification:**
  - Both contracts parse with the Python `json.load` command.
  - `pnpm exec prettier --check src/schema/contracts/ program/Ruleswright/specs/database.md` is 0. Note that `.prettierignore` ignores `program/`, so in practice only the contracts are checked.
  - `pnpm typecheck` is 0.
  - `pnpm exec vitest run tests/schema` passes, 105/105 in 4 files.
  - No `required` line changed. The only `required` line in the diff is the new `offers` item's own list.
  - `grep "(no envelope field)"` on the snapshots schema and `grep "none is added"` on `database.md` both print nothing. `DD17a` no longer appears in `database.md`.
  - The four mocks parse with balanced tags.
  - The pattern accepts `condition:applied[target=self]`, `attack:rolled[actor=wight]`, `damaged` and `enemy-approaches`. It rejects `condition:applied[self]`, `on:event(x)` and the empty string.
  - The `phase` enum equals `CombatPhase` (`combat.ts:127`).
  - The cumulative `git diff --stat b05b06e HEAD` touches only the 8 lease files.
  - I did not run the whole test suite, as the envelope instructs.
- **surprises:**
  1. **`api-map.html` names vs `database.md`:** the specified `api-map` lines include `settleSpellCasts`, `learnFeat` and `spell:cast`, but not `pool:settled`, `slot:settled` or `feat:learned`. The first two appear in the `magic.html` callout; `feat:learned` appears only in `database.md`. I added none of them beyond the task text.
  2. **`spatial.html:191` goes stale:** it still says restore resumes in `resolved`, "derived". It is outside the lease. A design-change follow-up is needed after S03 ck4.
  3. **Versioning-discipline conflict:** `database.md` says "tightening constraints = breaking → major". The trigger grammar is a tightening, but it is recorded as caveat (a) under the pre-release revisable-v1 rule, following the v1.5 `speed` precedent.
  4. **No map description existed** on the spells or feats map in `pack.schema.json`, so I added a `description` key to each map object.
  5. **Header label left alone:** the `triggers.html` anatomy header still says "pack actions — one reactive action, one reactive feat", although the feat now lives in `content.feats`. Its inline comment says so.
  6. **New spells-section callout:** it uses the existing blue `◈` info-callout style; no new token.
- **followUp:**
  - **S02, CA-S2 restore refusals (`E-SNAP-01`), exactly as written:**
    - an unknown pool, or an over-spend;
    - a level with no re-stated slots;
    - an index ≥ the re-stated binding length (or ≥ `boundSlots[L]` when there are no bindings);
    - an index whose binding is `null`;
    - a duplicate index;
    - all cards collected before any rebuild.
  - **S02, CA-S9 range wording:** "absent `targeting.range` = the caster's effective reach: max(its reach entry, `spatial.reach.default`), the value the reach gate uses". Out of range is `{kind:'out-of-range', rule:'E-SPAT-01', resource: <targetId> | "<x>,<y>"}`, with the message `spell "<id>" has range <r>; <target> is <d> away.`
  - **S02, CA-S9 `at` refusals (`invalid-target`/`E-REF-01`):** `at` with `targetId`; `at` on a non-burst spell (absent `targeting` = single); `at` on an action; `at` on a burst spell whose effect root is not `target(burst-…)`.
  - **S02:** the validator must admit `range` (closes the range window) and re-key the `tests/schema` `targeting` assertion.
  - **S03, restore phase precedence:**
    1. frozen hp satisfying the end rule → `combat-over`;
    2. else the envelope `phase`;
    3. else the v1.5 derivation.

    `combat-over` while no side is defeated is `E-SNAP-01`.
  - **S03, `offers`:** read when present, else the legacy `pendingTrigger`. Both present is `E-SNAP-01`; an unknown actor, or an id that is not a reactive action/feat that actor holds, is `E-SNAP-01`. v1.6 writers emit `offers` (when non-empty) and always emit `phase`.
  - **S03, `offeredCount`:** absent = 0; the next `trigger:fired.offerIndex` continues from it.
  - **S03, grammar wording:** "the eventMatches grammar: <eventType> or <eventType>[target|actor=self|<id>] (self = the reactor). Any other form can never fire and is E-FORM-01 at load." The jsonPath is `<base>.trigger.on`.
  - **Orchestrator:** recheck the CA rows against `1639a19`, and route `spatial.html` (surprise 2) as a design-change.
- **needsOwnerCorrection:** `program/Ruleswright/mocks/spatial.html:191`, the derived-phase copy (Designer, after S03).
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:**
  - `program/Ruleswright/specs/requirements.md`
  - `program/Ruleswright/mocks/magic.html`
  - `program/Ruleswright/mocks/api-map.html`
  - `program/Ruleswright/mocks/triggers.html`
  - `program/Ruleswright/mocks/conditions.html`
  - `program/Ruleswright/specs/database.md`
  - `src/schema/contracts/pack.schema.json`
  - `src/schema/contracts/snapshots.schema.json`

### SESSION-02 — received 2026-09-30 (r-ZVpm, handle h-Rxfr / CmX6_)

**Orchestrator receive:** 5/5 commits (`010d730`, `89a11e7`, `9ec0410`, `45c6fce`, `ab6d6f6`), every path inside the lease. Gates run by Orchestrator at `ab6d6f6`: typecheck 0, lint 0, format:check 0, build 0, test 793/793 (42 files), check:isolation 0, check:security 0. Arch delta integrated at `4caf973` (F-P12 replacements applied in place). CAP-S2/S3/S4/S9 verified. CAP-S1 marked stale by counterexample C-S02-1, which the source confirms (`effect.ts:316,331-334`; 12 theme sites, more than the six the handoff names), and routed to OWNER-M02-HALF. CA-S1..S5 rechecked for S03: no mapping changed.

**Handoff summary (verbatim):**

SESSION-02 is done: all 5 checkpoints are committed, and the full suite passes at 793/793 at `ab6d6f6` (the 741 baseline plus 52 new tests). A character can now cast a known spell in a fight with `fight.declare(spellId, { targetId } | { at })`, within the spell's range. The spend survives a snapshot, the host settles it back with `settleSpellCasts`, and the generated pack proves the whole path through `dist/`.

Things you should know before S03:

- **Content hazard (not fixed, outside the plan):** six theme spells have `damage(half)` on a passed save while the failed-save branch deals no damage. They are dark-fantasy `dread-hush`, `wight-bell`, `barrow-wake`, `bind-the-lung`, `mass-sapping-word` and zombie-urban `quietsong`; the existing action `cold-grip` has the same shape. Reading the executor, a passed save makes `execDamage` throw partway through resolution, after the cost is spent. These spells are now castable in combat, so a real fight can hit this. I found it by reading the source; no test reproduces it yet. It needs an owner: either the content changes or the executor changes.
- **The range-floor test differs from the prompt:** the prescribed reach entry of 0 can't load, because the validator requires reach entries ≥ 1. I showed the same floor with entry 1 under default 2.
- **Pool spends from actions now settle too:** `poolsSpent` records any pool cost, so action costs like `ember-surge` are also restored and settled. That also fixes action pool spends that were previously lost on restore.
- **Burst pins:** no asserted value moved under per-target saves; only the test comments' save arithmetic changed.

**Handoff (verbatim):**

- **session:** SESSION-02 (spells-in-combat)
- **status:** done
- **checkpoint:** 5 of 5. Commits:
  - ck1 `010d730`
  - ck2 `89a11e7`
  - ck3 `9ec0410`
  - ck4 `45c6fce`
  - ck5 `ab6d6f6`

  After each commit, `git show --name-only` listed only write-set paths.
- **notes:** Spell column landed. Lease revision 1. Base `a5a788e`.
  - **Capabilities proven:**
    - CAP-S1: unit (ck1), src integration on the generated dark-fantasy pack (ck3), journey (ck5).
    - CAP-S9: unit (ck2), journey empty-cell leg (ck5).
    - CAP-S2 and CAP-S3: ck4, plus the journey.
    - CAP-S4: first narrow journey through `dist/`, built at `ab6d6f6`.
  - **Contract runtime legs produced:**
    - CA-S1: `Combat.declare` spell lookup, `boundActionOf`/`ruleBaseOf`, `spell:cast`.
    - CA-S9: `SpellTargeting.range`, `checkTargeting`, `rangeGate`, `atRefusal`, `resolveShape(center)`, `EffectApply.varsFor`, `executeAgainst(…, profileFor)`.
    - CA-S4 (spell half): `profileFromCharacter` `spells`/`castBlockedBy`/`balances.bindings`.
    - CA-S2: `SnapshotCombatant.poolsSpent`/`slotsCast`, restore arithmetic, `spendRefusals`.
    - CA-S3: `settleSpellCasts`.
    - CA-S5: `restrictionRejection` now calls the exported `matchesRestriction` + `declaredTags`; the duplicate matcher (C1) is deleted and `conditions.ts` is not edited.
  - **Landed symbols:**
    - `CombatantState`: `spells`, `bindings?`, `slotsCast`, `poolsSpent`, `castBlockedBy?`.
    - `DeclareOptions.at`, `EffectApply.varsFor`, `SpellTargeting.range`.
    - `settleSpellCasts`; `armorBlockingCast` exported.
    - `DeclareRejection` kinds `armor-not-castable` and `out-of-range`.
    - `CombatantProfile.spells?`/`castBlockedBy?`, `EconomyBalances.bindings?`.
    - `parsePackEffects` deleted.
  - **Contract mappings:** no CA-S1…S5 or CA-S9 mapping changed. All were checked at ck0 against the landed v1.6 contracts and `database.md`; every checkpoint-0 premise matched.
  - **Tests:** 793 total (741 + 52 new).
- **delivered:**
  - **ck1:** spell lookup, membership, any-combatant target, armor gate, binding pick, spend recording and `spell:cast` in `combat.ts`. The `use()` comment is retired. New `tests/runtime/combat/spells.test.ts`.
  - **ck2:**
    - `targeting.range` mirror and validator.
    - The executor's `varsFor` hook (DD-S19).
    - The range gate replaces reach for spells; the fallback is `max(reachOf ?? default, default)`.
    - `at` legality and empty-cell bursts.
    - Bursts resolve around a center.
    - `action:resolved`/`spell:cast` carry `at`.
  - **ck3:** the character bridge (`spells`, `castBlockedBy`, `bindings`); `armorBlockingCast` exported.
  - **ck4:** spend serialized and restored as re-stated − spend; CA-S2 refusals; `settleSpellCasts` exported.
  - **ck5:**
    - All 47 theme spells (dark-fantasy 33, zombie-urban 4, wyldwood 10) gain `slots {main:1, move:1}` and `targeting.range: 6`, with each file's formatting kept.
    - grid-journey casts the real spells.
    - Proof 3 gains a combat leg.
    - New `tests/proofs/spells-journey.test.ts`.
  - **Pins moved (old → new):**
    - `grid-journey.test.ts` (old line 409): `main` 1 → 0, and a new `move` 0 assertion.
    - Vancian-gate test (old line 433): `main` stays 1, and a new `move` stays 1 assertion.
    - Theater test (old lines 595–642): rewritten to the real `ember-halo`. Same-turn `strike` is `slot-exhausted` on `main` with no die drawn. Then `step`×2, ally `glide`, `step`×2, wolf `glide`, `round-completed`, caster's turn, `strike` for 16 → `combat-over`. Script unchanged `[1,1,1,20,4,2,3,5,6]`; neither in-between declare drew a die (`ScriptedRng.drawn` asserted 9 at the end).
    - Burst save pins (`combat-spatial.test.ts` 294–362, `grid-journey.test.ts` 342–410): no asserted value changed; comments re-keyed. combat-spatial shambles save 9 → 6 (own reason 0); grid-journey brynn save 9 → 6 (warden reason 0). Every branch stays fail/pass as before.
    - `character-profile.test.ts` 313–330: unchanged, still green.
    - `validate.test.ts`: no closed-set pin existed; added `range` accept/refuse tests and a new closed-set test.
  - **Pool leg:** `hexer` / `hex-bolt` as planned; motes 16 → 14.
  - **Wight after the first blast:** stood at 10 hp (15 → 10), as Planner's emulation predicted; pinned in the test.
  - **Arch fragment:** `.program/signal/SESSION-02.arch.md`. It holds the API delta and replacement text for `arch/v1-core.md` 170–171, 191–192, 425, 712–717 and 817–819, plus an optional gate-list note at 441–442.
- **verification:**
  - **Final gate at HEAD `ab6d6f6`, clean tree, `dist/` built at that commit:**
    - `pnpm build` 0.
    - `pnpm test`: 793/793 across 42 files (40 + 2 new). The count matches intent (741 + 52); this is not a filtered run.
    - `pnpm typecheck` 0, `pnpm lint` 0, `pnpm format:check` 0.
    - `pnpm check:isolation` 0 (`generateCampaign` absent from the runtime bundle); `pnpm check:security` 0.
  - **Narrow gates per checkpoint (`pnpm exec vitest run <paths>`):**
    - ck1: `tests/runtime` 263.
    - ck2: `tests/schema tests/core tests/runtime tests/proofs/grid-journey.test.ts` 497.
    - ck3: `tests/runtime` plus grid and equipment journeys, after build, 297.
    - ck4: `tests/runtime tests/snapshots` 334.
  - **Per-file counts:** spells.test 32, spells-journey 4, snapshots/combat 32 (+8), effect 27 (+3), validate 87 (+2), character-profile 34 (+3).
  - **Negative controls (each reverted afterwards):**
    - Disabling the spell-kind restricts match fails the `spells.tagged:` test.
    - Forcing `varsFor` back to the bound target's vars fails the empty-cell per-target test (`[5,5]` vs `[9,5]`).
    - Restoring without subtracting `poolsSpent` fails the CA-S2 round-trip (`{stamina: 6}` vs `{stamina: 4}`).
  - **Boundaries:** all real — Runtime and validator, generated packs at seed 42, `gridGeometry`/`hexGeometry`, the executor, the economy, the serializers via JSON text, and `restoreCharacter`. Dice are scripted only in unit tests; the journey uses seeded `Rng(0)` and asserts determinism over two runs. The only harness is the journey's ending (enemy hp set to 0 in the snapshot JSON), which the test asserts and explains.
- **surprises:**
  1. **Range-floor fixture changed:** the prescribed `reach: {default: 1, hexer: 0}` cannot load (validator: per-id reach must be an integer ≥ 1). The F-M2 floor test uses `{default: 2, hexer: 1}` at distance 2 instead.
  2. **Content hazard, by source reading:** six theme spells have the shape `save(X, dc, applyCondition(...), damage(half))` — the failed-save branch has no damage. They are dark-fantasy `dread-hush`, `wight-bell`, `barrow-wake`, `bind-the-lung`, `mass-sapping-word` and zombie-urban `quietsong`. When the save passes, `halveFromFail` returns undefined and `execDamage` throws, partway through `declare` and after the spend. The existing action `cold-grip` has the same shape. These spells are now combat-castable; no test reproduces this yet.
  3. **Pool spends from actions are recorded too:** `poolsSpent` covers every points cost (e.g. `ember-surge`, `surge`), as ck1 item 5 specifies. So `settleSpellCasts` also settles action pool spends, and restore now keeps them (this fixes the latent loss for actions as well).
  4. **`varsFor` is always supplied:** `executeAgainst` now always provides `varsFor`. Callers without `profileFor` get the bound target's vars, so values are identical; only defense formulas that roll dice would change RNG order, and no bundled pack has one.
  5. **Spell slot level:** for a spell, the binding pick and the `boundSlots` decrement both use `magic.level`; for actions they use `cost.vancian`. These are identical in all shipped data (DD-S18 pin).
  6. **Journey restore re-states start positions:** restoring with the fight-start request puts the striders back on their starting cells. This is harmless; no position is asserted after restore.
- **followUp:**
  - **For S03 — `CombatantState` shape it extends:** `{id, side, name, hp{current}, maxHp, conditions[], slots, pools, boundSlots, itemBalances, itemsUsed, abilities, saves, level, ac, initiativeBonus, speed?, actions, spells, bindings?, slotsCast, poolsSpent, castBlockedBy?, attackTable?, attackBonus?, position?, pendingMove?}`. `feats` comes next, and should be filled in both `startCombat` and `deserializeCombat` (`snapshots.ts` mirrors every field).
  - **For S03 — spells-journey layout:** header doc, helpers (`packFor`, `during`, `frozen`, `endedThroughRestore`, `standingWithin`), then `describe` blocks in order: dist freshness, vancian leg (`vancianLeg()`), pool leg (`poolLeg()`), determinism. Append the feat leg after the pool leg; add its function to the determinism block if wanted.
  - **For S03 — `resolveTarget`'s `anyCombatant` parameter:** it does not fit the feat target rule (DD-S12: the target is always the holder; another `targetId` is `invalid-target`). The feat take path should bind the holder directly, as the move-action branch binds the actor, rather than going through `resolveTarget`.
  - **For S03 — README facts:**
    - `SpellTargeting.range` is an integer ≥ 0 in the pack's spatial distance. Absent means the caster's effective reach, `max(reach entry, spatial.reach.default)`. Theater packs ignore it.
    - `fight.declare(spellId, { targetId })` may name any combatant. `{ at: {x, y} }` works only on burst spells, may be an empty cell, and is dropped by theater packs.
    - Refusal kinds: `out-of-range`/E-SPAT-01 (resource `targetId` or `"x,y"`); `invalid-target`/E-REF-01 (the four `at` cases); `armor-not-castable`/E-REF-01; `vancian`/E-VANC-01 (`no uncast level-L slot is bound to "<id>"`); `no-action` (`does not know spell`).
    - Every sample-theme spell costs the whole turn (`main` + `move`) and has range 6.
    - Settlement events: `pool:settled`, `slot:settled`.
  - **Carried, unchanged:** the out-of-combat restricts asymmetry (`isRestricted` kind-exact), F-M2 floor, C1 `isLivePattern` consumer, hedge-mage content.
  - **New, needs an owner:** the `damage(half)` content/executor hazard in surprise 2 (owner: content feature or executor).
  - **Remaining proof owners:** CAP-S5…S8 (S03); ledger/turn continuity across a restore (S03 ck4, envelope `phase`).
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:**
  - `src/schema/artifacts.ts`
  - `src/schema/validate/sections/content.ts`
  - `src/core/dsl/effect.ts`
  - `src/runtime/combat/combat.ts`
  - `src/runtime/combat/action-economy.ts`
  - `src/runtime/combat/resolve.ts`
  - `src/runtime/character-profile.ts`
  - `src/runtime/pools.ts`
  - `src/runtime/snapshots.ts`
  - `src/runtime/index.ts`
  - `src/compiler/themes/dark-fantasy.json`
  - `src/compiler/themes/zombie-urban.json`
  - `src/compiler/themes/wyldwood.json`
  - `tests/schema/validate.test.ts`
  - `tests/core/dsl/effect.test.ts`
  - `tests/runtime/combat/spells.test.ts`
  - `tests/runtime/combat/combat-spatial.test.ts`
  - `tests/runtime/combat/character-profile.test.ts`
  - `tests/snapshots/combat.test.ts`
  - `tests/proofs/grid-journey.test.ts`
  - `tests/proofs/rules-are-data.test.ts`
  - `tests/proofs/spells-journey.test.ts`

### SESSION-03 attempt 1 — received 2026-09-30 (r-ZVpm, handle h-_FY8 / CYWgF): blocked at ck3

**Orchestrator receive:** 3 commits (`d9a6d71`, `e5e1a55`, `8d04c5e`), every path inside the lease. ck4 is implemented but uncommitted in 5 lease paths, preserved in the tree and as `.program/history/spells-in-combat/SESSION-03.ck4-pending.attempt1.patch` (base `8d04c5e`). Blocker: the unowned pin `tests/runtime/combat/combat.test.ts:448`, which contradicts approved DD-S14. Disposition: Controlled Lease Revision 2 (one pin re-key), then resume the same worker context. `CombatantState.feats` optional (present only when non-empty) accepted: it matches the DD-S11 presence rule. CAP-S5/S7 verified; CAP-S6 unit proven.

**Handoff summary (verbatim):**

SESSION-03 is blocked at checkpoint 4. Checkpoints 1–3 are committed. Checkpoint 4 is fully written but left uncommitted, because one test outside my lease contradicts the approved snapshot rule (DD-S14) and it is the only thing keeping the whole suite red.

**The blocker.** `tests/runtime/combat/combat.test.ts:448` expects a fight saved right after a declare to restore as `awaiting-declare`. Under DD-S14 the snapshot now records the phase, so that fight restores as `resolved`, its live phase. That is the R-GM-2 fix itself. The pin moves under the approved rule, but no plan row names it and it is in no session's lease. The fix is one expected value: `toBe('awaiting-declare')` → `toBe(fight.state.phase)` (`resolved`).

**Landed:**
- **ck1 (`d9a6d71`), CAP-S7:** trigger patterns that can never fire are refused at load (`E-FORM-01`). The 5 theme feat patterns and 3 test literals now read `condition:applied[target=self]`. A negative control with the old literal in one theme makes generation refuse the pack.
- **ck2 (`e5e1a55`), CAP-S5:** characters can learn feats with `learnFeat`. Held feats survive a character snapshot, an unknown feat id is refused on restore, and held reactive feats reach the combat profile.
- **ck3 (`8d04c5e`), CAP-S6 unit:** held feats are offered like reactions, act on their holder when taken, and never chain. A negative control with the no-chain rule switched off fails the take test.

**Pending ck4 (uncommitted, in the working tree):** the combat snapshot now keeps every open offer, the offer counter and the phase. Everything else is green: 826/827 tests, typecheck/lint 0, prettier clean.

**Decision for you:** the plan types `CombatantState.feats` as always present, but it also says to emit it only when non-empty in any JSON form. I made it present only when non-empty so both hold. Say if you want it the other way.

The concurrent worker's files (`effect.ts`, `effect.test.ts`, `spells.test.ts`) did not affect any of my gates. The arch fragment for ck1–ck3 is written; ck4's delta will follow on resume.

**Handoff (verbatim):**

- **session:** 03
- **status:** blocked
- **checkpoint:** 3
- **notes:** Lease revision 1. Landed:
  - ck1 `d9a6d71` (CAP-S7, CA-S7 runtime leg: `TRIGGER_PATTERN`, `checkTrigger` E-FORM-01);
  - ck2 `e5e1a55` (CAP-S5, CA-S4 feats half, CA-S6 part: `learnFeat`, `CharacterState.feats?`, `Character.learnFeat`, `PackIndex.featEffects`, character-snapshot `feats` + E-SNAP-01 refusal, `CombatantProfile.feats?`, `profileFromCharacter` feats);
  - ck3 `8d04c5e` (CAP-S6 unit, CA-S6: `PendingTrigger.source`, `reactiveFeatsFor`, `offersForEvent(…, {feats?})`, `resolveFeat` take/invalid-target, the no-chain rule).
  - ck4 (CAP-S8, CA-S8) is implemented but uncommitted. Base `8d04c5e`; pending paths (all in the lease, all modified, none untracked): `src/runtime/combat/combat.ts`, `src/runtime/snapshots.ts`, `tests/snapshots/combat.test.ts`, `tests/proofs/movement-journey.test.ts`, `tests/runtime/combat/movement.test.ts`. Orchestrator should preserve them at receive.
  - Exact payloads as landed: `trigger:fired {triggerId, actionId, source, on, offerIndex}` and `trigger:declined {triggerId, actionId, source, on}`, `why.rule` `actions.<id>.trigger` | `content.feats.<id>.trigger`. A feat take's effect events carry `why.rule` `content.feats.<id>`.
  - ck4 counter-restore mechanism (pending): `new Combat(runtime, state, rng?, { offeredCount? })` plus a read-only getter `offeredCount`.
- **delivered:**
  - **ck1:** `TRIGGER_PATTERN` in `helpers.ts`. A string `on` that fails the grammar is E-FORM-01 at `<base>.trigger.on`; the hint `did you mean "<base>[target=self]"?` is given for `[self]`. 5 theme feats re-keyed to `condition:applied[target=self]` (dark-fantasy:179, zombie-urban:183/188, wyldwood:362/369). Literal re-keys at `packs.ts:136`, `pipeline.test.ts:67`, `stages.test.ts:77`. Tests: `validate.test.ts` +4, `coverage-floor.test.ts` +3 (per-theme grammar check and `[target=self]` on every reactive feat).
  - **ck2:**
    - `src/runtime/feats.ts` (leaf; imports only `./errors` plus types) with `learnFeat`.
    - Character feats, facade, `featEffects`; character snapshot feats with the refusal; the `snapshots.ts` doc line updated.
    - Profile `feats` = held feats that declare a `trigger`, non-empty only.
    - Barrel exports `learnFeat`.
    - Tests: `tests/runtime/feats.test.ts` (7), `tests/snapshots/character.test.ts` +3.
  - **ck3:**
    - `CombatantState.feats?`; `PendingTrigger.source`, set to `'action'` at every existing construction including the legacy restore.
    - Feat offers come after all action offers.
    - Feat take/decline; the no-chain rule via `surfaceOffers(emitted, {feats: false})`.
    - The `triggers.ts` grammar doc was corrected; the barrel exports `reactiveFeatsFor`.
    - Pins re-keyed (`source: 'action'` only): `movement.test.ts` (old l.388–395), `movement-journey.test.ts` (old l.216–223).
    - New `tests/runtime/combat/feat-triggers.test.ts` (8).
  - **ck4 (pending):**
    - Serialize always writes `phase` and `offeredCount`, writes `offers` (every open offer in queue order, action and feat) when non-empty, and no longer writes `pendingTrigger`.
    - Restore follows DD-S14 precedence and reads legacy `pendingTrigger` only when `offers` is absent.
    - E-SNAP-01 refusals, all collected: offers beside a pendingTrigger; an unknown actorId; an id the source does not hold; `combat-over` with no side defeated; plus a non-enum phase and an `offeredCount` that is not an integer ≥ 0.
    - Pins re-keyed: `snapshots/combat.test.ts` key-set (9 → 11 keys, +`offeredCount`, +`phase`), old l.123–125 and l.606 → `snap.offers`. `movement-journey` R-GM-1 workaround removed, with an assertion that `offerIndex === snap.offeredCount > 0`.
    - New envelope tests (5): two offers in order plus counter continuity; R-GM-2 use-raised `awaiting-declare` (and `resolved` once `phase` is deleted); the v1.5 envelope restoring as before; all refusals; combat-over accepted when a side is down.
- **verification:**
  - **ck1:** `pnpm build` 0. `pnpm test` 804/804 across 42 files; this includes the concurrent worker's in-flight tests (793 baseline + 7 mine + 4 theirs). typecheck 0 after a test-only typing fix made before the commit; lint 0. Narrow gate `pnpm exec vitest run tests/schema/validate.test.ts tests/compiler` → 287/287 in 6 files. Negative control: dark-fantasy reverted to `[self]` → coverage-floor fails at collect (stage-8 validation refuses); restored.
  - **ck2:** typecheck 0; `pnpm exec vitest run tests/runtime tests/snapshots` → 346/346 in 20 files; lint 0; prettier clean.
  - **ck3:** typecheck 0; build 0; `pnpm exec vitest run tests/runtime tests/snapshots tests/proofs` → 405/405 in 29 files; lint 0. Negative control: no-chain rule off → the take test fails; restored.
  - **ck4 (pending):** typecheck 0, lint 0, prettier clean. `pnpm exec vitest run tests/snapshots/combat.test.ts tests/runtime/combat/movement.test.ts` → 58/58. Negative control: counter reset to 0 → the continuity test fails; restored.
  - **Whole suite:** `pnpm build` (working tree at base `8d04c5e`) then `pnpm test` → 826/827 across 44 files. The only red is `tests/runtime/combat/combat.test.ts:448`.
  - Every commit was checked with `git show --name-only`; all paths are inside the write set.
- **surprises:**
  - **Unowned pin (planning defect, outside the lease):** `tests/runtime/combat/combat.test.ts` "a mid-fight snapshot (one side partly downed) restores exactly as before: awaiting-declare at the frozen turn" (l.448). It asserts the v1.5 derivation after `declare('surge')`. DD-S14 restores the live envelope phase `resolved`, so the pin moves under the approved rule; it is in no session's lease and no "Pins that move" row.
  - **Second pin of the same class, inside my lease:** `tests/runtime/combat/movement.test.ts` (narrow journey leg, about l.327). Its `restored.step()` relied on the lost phase. I replaced it with `expect(restored.state.phase).toBe(fight.state.phase)`, and the same-turn `strike` still succeeds. This goes beyond the plan's "only the l.388–395 change" for that file.
  - **`CombatantState.feats` is optional** (present only when non-empty) so that "emit only when non-empty in any JSON form" holds; readers use `?? []`.
  - **Offer ordering:** all action offers for an event come first (across combatants), then feat offers (the "actions first" rule).
  - **Phase without an envelope `phase`:** the v1.5 derivation also treats envelope `offers` as `resolved`.
  - **`Combat.use` surfaces only effect events, not `item:used`** (pre-existing). The R-GM-2 test uses a `damage:applied[target=brynn]` reaction.
  - No CA-S6/S7/S8 mapping changed.
- **followUp:**
  - On a lease revision adding `tests/runtime/combat/combat.test.ts`: re-run whole-suite verification, commit ck4 ("The combat envelope keeps offers, counter and phase"), then ck5 (spells-journey feat leg, rules-are-data proof 2, README plus the docs-run guards and the `learnFeat` dist freshness assertion).
  - Arch fragment `.program/signal/SESSION-03.arch.md` covers landed ck1–ck3; the ck4/ck5 delta follows in the resumed session.
  - Remaining proof owners (S03 after resume): CAP-S8 / CA-S8 (ck4); CAP-S6 journey (ck5). CA-S6/CA-S7 runtime legs are landed and unit-proven.
  - Carried open items:
    - C-S01-1 `spatial.html:191` derived-phase copy — Designer, after ck4.
    - C-S02-1 damage(half) — OWNER-M02-HALF.
    - Out-of-combat restricts asymmetry — a future restricts feature.
    - F-M2 reach floor and R-GM-3 resume provoke skip — owners as in grid-movement FINAL-REPORT.
    - zombie-urban and wyldwood hedge-mage spell lists — the next content feature.
    - FR-6 feat-slot cap — a future feat-progression feature.
    - Self-buff actions target the opponent — a future feature that touches action targeting.
    - C1 `isLivePattern` — carried.
    - `heal`/`EFFECT_VOCABULARY`, item tags, `evalPackFormula` parse-once, browser determinism leg — owners as in prior ledgers.
- **needsOwnerCorrection:**
  - **kind:** mechanical-owner-seam
  - **paths:** `tests/runtime/combat/combat.test.ts`
  - **whyNeeded:** DD-S14 (approved) restores the frozen envelope `phase`. The test at l.448 pins the v1.5-derived `awaiting-declare` after a declare, when the live phase is `resolved`. The ck4 whole-suite commit gate cannot go green without this one-line re-key.
  - **unblocks:** SESSION-03 ck4 and ck5
  - **suggestedChange:** at l.448, `expect(restored.state.phase).toBe('awaiting-declare')` → `expect(restored.state.phase).toBe(fight.state.phase)` (= `'resolved'`). Optionally retitle "…: the live phase at the frozen turn". Every other assertion is unchanged. Requested as lease revision 2 adding this path to S03's write set (or an Orchestrator owner correction); last accepted checkpoint 3.
- **needsDesignSource:** —
- **blockedReason:** ck4 (CAP-S8 / CA-S8 proof due here) cannot commit green: the only whole-suite red (826/827) is the unowned outside-lease pin `tests/runtime/combat/combat.test.ts:448`, which contradicts the approved DD-S14 phase restore. Machine-actionable lease gap, not a product-design question. ck4 implementation is preserved uncommitted in the 5 lease paths listed in notes.
- **filesTouched:**
  - `src/schema/validate/helpers.ts`
  - `src/compiler/themes/dark-fantasy.json`
  - `src/compiler/themes/zombie-urban.json`
  - `src/compiler/themes/wyldwood.json`
  - `tests/runtime/fixtures/packs.ts`
  - `tests/compiler/pipeline.test.ts`
  - `tests/compiler/stages.test.ts`
  - `tests/compiler/coverage-floor.test.ts`
  - `tests/schema/validate.test.ts`
  - `src/runtime/feats.ts`
  - `src/runtime/character.ts`
  - `src/runtime/runtime.ts`
  - `src/runtime/snapshots.ts`
  - `src/runtime/combat/resolve.ts`
  - `src/runtime/character-profile.ts`
  - `src/runtime/index.ts`
  - `tests/runtime/feats.test.ts`
  - `tests/snapshots/character.test.ts`
  - `src/runtime/combat/combat.ts`
  - `src/runtime/combat/triggers.ts`
  - `tests/runtime/combat/feat-triggers.test.ts`
  - `tests/runtime/combat/movement.test.ts`
  - `tests/proofs/movement-journey.test.ts`

### OWNER-M02-HALF — received 2026-09-30 (r-ZVpm, handle h-fgRX / CzvAR)

**Orchestrator receive:** 1 commit `623a687`, every path inside the write set. Lease-scoped gate re-run by Orchestrator in the shared tree after S03 ck1 landed: `pnpm exec vitest run tests/core/dsl tests/runtime/combat/spells.test.ts` 102/102, prettier 0, eslint 0. Whole-repo re-verification is deferred to wave close (S03 in flight). Arch delta appended. C-S02-1 closed; CAP-S1 verified.

**Result (verbatim):**

I fixed C-S02-1: a passed save whose fail branch has no damage now resolves `damage(half)` as no damage instead of throwing in the middle of `Combat.declare`. It is committed as `623a687`, all four required proofs hold, and the tests run in a clean worktree pass 102/102. The spells tests can't pass in the shared tree right now, because SESSION-03's uncommitted edits break pack loading for the whole file.

## Handoff

- **session:** OWNER-M02-HALF
- **status:** done
- **checkpoint:** 1
- **notes:** C-S02-1 fixed (CAP-S1 / CA-S1). In `src/core/dsl/effect.ts`, a passed save with no fail-branch damage now resolves `damage(half)` as no damage. `execSave` passes a `NOTHING_TO_HALVE` marker, and `execDamage` returns `[]` for it: no `apply.damage` call, no outcome, no RNG draw. The load-time check, the fail branch and saves that do have fail-branch damage are unchanged. Commit `623a687`, at base `df03f7b`.
- **delivered:**
  - **`execSave`** passes `halveFromFail(failEffect) ?? NOTHING_TO_HALVE` into the pass branch.
  - **`execDamage`** now has one `source: HalveFrom | undefined`:
    - `damage(half)` with nothing to halve returns `[]`.
    - `damage(half)` outside any save's pass branch, which only an unvalidated tree can produce, still throws E-FORM-02, so misuse still fails closed.
    - Every path that had damage to halve evaluates the same expression with the same RNG draws as before, so draws and outcomes are unchanged.
  - **The header docs** now describe the new rule.
  - **Tests:** 2 new in `effect.test.ts` and 2 new in `spells.test.ts`, using a fixture spell `dread-hush` = `save(reason, 12, applyCondition(shaken, 2), damage(half))`.
- **verification:**
  - **Required gate:** `pnpm exec vitest run tests/core/dsl tests/runtime/combat/spells.test.ts`.
    - In a temporary `git worktree` at HEAD `df03f7b` with only my 3 files copied in: 4 files, 102/102 pass. The baseline there is 98/98, so this is +4 new tests and 0 existing tests changed.
    - In the shared tree it is red: 34/34 spells tests fail at pack load because of SESSION-03's in-flight edits (see surprises).
  - **Proof 1, `effect.test.ts`:** "damage(half) with no fail-branch damage resolves as no damage on a pass…". A counting RNG wraps scripted [10] with vigor 2, so the save totals 12, a tie that passes. It asserts no throw, `draws === 1`, no apply calls, a single `save` outcome with a pass verdict, and an empty `perTarget[0].outcomes`. A companion test checks that the failed save still applies `sapped 3`.
  - **Proof 2, `spells.test.ts`:** `describe('C-S02-1 …')` runs the real `Runtime`, `startCombat` and `Combat.declare` on the fixture pack. The `ScriptedRng` throws if its queue runs out, and the queue is [1, 1, 10], so any extra roll would fail the test. Assertions:
    - `fight.declare` does not throw;
    - events are exactly `['spell:cast', 'action:resolved']`, all with `why.rule` `content.spells.dread-hush`;
    - the wight stays at 40 hp with no conditions;
    - `slotsCast` is `{'1':[0]}` and `boundSlots['1']` is 0, so the cost was spent exactly once;
    - phase is `resolved`.
    - A companion fail test expects `spell:cast` → `condition:applied` → `action:resolved`.
  - **Proof 3, negative control:** done in the worktree only.
    - Restoring a throw on `NOTHING_TO_HALVE` fails exactly the 2 new pass tests (100/102).
    - Running the original HEAD `effect.ts` against the new tests fails the same 2.
    - After reverting, 102/102 pass.
  - **Proof 4:** every existing test in both suites passes unchanged (98/98 → still green).
  - **`pnpm typecheck`:** none of the errors are in my files, in either tree.
    - Shared tree: 1 error, in `tests/compiler/coverage-floor.test.ts` (SESSION-03 area).
    - Worktree: errors in `tests/proofs/{equipment,loot,spells}-journey.test.ts`, the same with and without my files, so they come from the worktree setup.
  - **`pnpm exec prettier --check`** on the 3 files: clean.
  - **Lease check:** `git show --name-only` on HEAD lists only the 3 write-set paths.
- **surprises:**
  - **Shared-tree red from SESSION-03:** uncommitted edits to `src/schema/validate/helpers.ts` (the trigger grammar, "condition:applied[self] can never fire") and to `tests/runtime/fixtures/packs.ts` make every Runtime and `generateCampaign` load fail. That turns all of `spells.test.ts` red in the shared tree, and also changes the shared-tree typecheck (`coverage-floor.test.ts`). I verified hermetically in a temp worktree under `/tmp`, which is now removed.
  - **Throw message changed:** the remaining throw's message now reads "damage(half) is only legal inside a save's pass branch…", since the old "needs a fail branch with damage" case no longer throws.
  - **Fixture spell instead of the generated pack:** the generated dark-fantasy pack fails to load in the shared tree. In the clean worktree the fixture spell was the simpler real path.
- **followUp:**
  - CAP-S1 / CA-S1 can be re-verified once SESSION-03's helpers and fixture edits land consistently.
  - The 12 theme sites and the `cold-grip` action now resolve a passed save as fail-branch-free with no damage. The content is unchanged, as decided.
  - When the generated pack loads again, a later run could add a check that `dread-hush` and `wight-bell` cast through the generated pack.
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:**
  - `src/core/dsl/effect.ts`
  - `tests/core/dsl/effect.test.ts`
  - `tests/runtime/combat/spells.test.ts`
  - `.program/signal/OWNER-M02-HALF.arch.md` (arch fragment, uncommitted, as the envelope specifies)

### SESSION-03 (resume, lease rev 2) — received 2026-09-30 (r-ZVpm, handle h-F3Tn / CkOcV)

**Orchestrator receive:** ck4 `c6128bd` and ck5 `5cfad48`, every path inside lease revision 2. The `combat.test.ts` diff is exactly the permitted pin re-key. Wave-close whole-repo gates run by Orchestrator at `5cfad48`: typecheck 0, lint 0, format:check 0, build 0, test 829/829 (44 files), check:isolation 0, check:security 0. Arch delta integrated at `da4665c`. CAP-S1..S9 all verified; CA-S1..S9 producers landed and proofs passed. B-S03-1 cleared. Feature complete.

**Handoff summary (verbatim):**

SESSION-03 is done: all five checkpoints are committed, and the whole suite passes 829/829 with `dist` built at the final commit.

**Lease revision 2.** I made the one permitted edit in `tests/runtime/combat/combat.test.ts` at l.448. The test now asserts the restored phase is `'resolved'`, equal to the live `fight.state.phase`, and its title ends "…: the live phase at the frozen turn". Nothing else in that file changed.

**ck4 (`c6128bd`).** The combat snapshot keeps every open offer, the offer counter and the live phase. Two Orchestrator commits landed right after it (`ae0f480`, `937e5b4`); my own commit holds only the 6 lease paths.

**ck5 (`5cfad48`).**
- **Feat leg** in `tests/proofs/spells-journey.test.ts`, run against the built package. A hexer learns `second-gust` and is hexbound by an adjacent wight's `grave-gaze`. The feat is offered with `source: 'feat'`, survives a save and restore, and taking it puts `braced` on the hexer with no second offer. Hexbound then blocks `ember-bloom` with nothing spent, and the character save keeps the feat. If I drop the `learnFeat` call, the leg fails.
- **Rules-are-data proof 2** gains a feat leg built from pack data only: a character holds the feat, and a character who never learned it gets no offer.
- **README** gains the new `## Spells and feats in combat` section and three updated passages. Its event-stream sample was copied from a real run of the built package. The docs-run test now also checks that the README mentions `settleSpellCasts` and `learnFeat`.

Inherited item C-S02-1 (`damage(half)`) is closed: OWNER-M02-HALF landed the fix and `937e5b4` closed it. The arch fragment now covers ck1–ck5.

**Handoff (verbatim):**

- **session:** 03
- **status:** done
- **checkpoint:** 5
- **notes:**
  - Done 5/5 under lease revision 2. Commits:
    - ck1 `d9a6d71`
    - ck2 `e5e1a55`
    - ck3 `8d04c5e`
    - ck4 `c6128bd`
    - ck5 `5cfad48`
  - Verification:
    - CAP-S5/S6/S7/S8 verified.
    - CA-S4 (feat half), CA-S6, CA-S7 and CA-S8 have their legs landed and proven here.
    - No CA-S6/S7/S8 mapping changed.
    - Final suite: 829/829 in 44 files.
  - Landed symbols:
    - **ck1:** `TRIGGER_PATTERN` (`helpers.ts`), and `checkTrigger` E-FORM-01 with the `[target=self]` hint.
    - **ck2:**
      - `learnFeat` (new leaf `src/runtime/feats.ts`; barrel export);
      - `CharacterState.feats?`, `Character.learnFeat`, `PackIndex.featEffects`;
      - character-snapshot `feats` with the E-SNAP-01 unknown-id refusal;
      - `CombatantProfile.feats?`, set by `profileFromCharacter` (held feats with a `trigger`, non-empty only).
    - **ck3:**
      - `CombatantState.feats?` (present only when non-empty; accepted decision), `PendingTrigger.source: 'action' | 'feat'`;
      - `reactiveFeatsFor` (barrel), `offersForEvent(…, { feats? })` (actions first);
      - feat take/decline, plus the no-chain rule (`surfaceOffers(emitted, { feats: false })`).
    - **ck4:**
      - `CombatSnapshot.phase?`, `offeredCount?` and `offers?: SnapshotOffer[]` (`{actorId, source, id, on}`);
      - the offer-counter restore mechanism: constructor option `new Combat(runtime, state, rng?, { offeredCount? })` plus a read-only getter `Combat.offeredCount`.
  - Exact payloads:
    - `trigger:fired {triggerId, actionId, source, on, offerIndex}`;
    - `trigger:declined {triggerId, actionId, source, on}`;
    - `why.rule` is `actions.<id>.trigger` or `content.feats.<id>.trigger`;
    - a taken feat's effect events carry `why.rule` `content.feats.<id>`.
  - README sections changed:
    - new `## Spells and feats in combat` (after Grid combat; a ```text event-stream sample; no new ```ts block, count stays 4);
    - the `profileFromCharacter` bullet (spells known, slot bindings, armor that blocks slot casting, reactive feats);
    - the Grid combat burst prose (`fight.declare('ember-bloom', { targetId })`);
    - the armorCasting bullet (point-pool spells are cast in combat and never armor-gated).
- **delivered:**
  - **ck1:**
    - The trigger grammar is enforced at load: a `trigger.on` that can never fire is E-FORM-01 at `<base>.trigger.on`.
    - 5 theme feat patterns, the fixture and 2 compiler-test literals re-keyed to `condition:applied[target=self]`.
    - Grammar accept/refuse tests, and a per-theme grammar check in coverage-floor.
  - **ck2:** characters learn and hold feats (`learnFeat`); the feats survive the character snapshot; held reactive feats reach the combat profile.
  - **ck3:** held feats are offered like reactions (`source: 'feat'`), are free, act on their holder, refuse another target (`invalid-target`, and the offer still leaves the queue) and never chain.
  - **ck4:**
    - Serialize always writes `phase` and `offeredCount`, writes `offers` when non-empty, and stops writing `pendingTrigger`.
    - Restore follows DD-S14 precedence, still reads a legacy `pendingTrigger`, and collects every E-SNAP-01 refusal.
    - R-GM-1 workaround removed from movement-journey; R-GM-2 fixed; the l.448 pin re-keyed under rev 2.
  - **ck5:**
    - spells-journey feat leg (dist, dark-fantasy seed 42, grid), plus a `learnFeat` dist-freshness assertion.
    - rules-are-data proof 2 feat leg: data delta `warden.actions = ['strike']`, `validatePack` `[]`, a learned-vs-never-learned baseline, zero engine diffs.
    - README updates, plus the docs-run anatomy guards `settleSpellCasts` and `learnFeat`.
- **verification:**
  - **ck1:**
    - `pnpm build` 0; `pnpm test` 804/804.
    - Narrow gate `pnpm exec vitest run tests/schema/validate.test.ts tests/compiler` → 287/287 in 6 files.
    - Negative control: dark-fantasy reverted to `[self]` → coverage-floor fails at collect.
  - **ck2:** typecheck 0; `pnpm exec vitest run tests/runtime tests/snapshots` → 346/346 in 20 files; lint 0; prettier clean.
  - **ck3:**
    - `pnpm exec vitest run tests/runtime tests/snapshots tests/proofs` → 405/405 in 29 files.
    - Negative control: no-chain rule off → the take test fails.
  - **ck4 (rev 2):**
    - `pnpm build` 0, then `pnpm test` → 827/827 in 44 files; typecheck 0; lint 0; prettier clean on the 6 paths.
    - Earlier: the snapshot/movement narrow gate gave 58/58.
    - Negative control: counter reset to 0 → the continuity test fails.
  - **ck5:**
    - `pnpm build` 0 (dist built at the ck5 source tree; ck5 changed only tests and README). Then `pnpm test` → 829/829 in 44 files: spells-journey 5 (+1), rules-are-data 4 (+1), docs-run 3.
    - typecheck 0; lint 0; check:isolation 0; check:security 0.
    - `pnpm format:check` 0 after prettier `--write` on the 2 new test files; `pnpm exec vitest run tests/proofs` then gave 53/53 in 8 files.
    - Negative control: the feat leg without `learnFeat` fails (`hexer.state.feats` undefined).
  - CAP-S6 production path, all real (no doubles): `learnFeat` → `profileFromCharacter` → `startCombat` → wight `declare('grave-gaze')` → `offersForEvent` → `serializeCombat`/JSON/`deserializeCombat` → `respond(take)`. The fixture leg is the rules-are-data proof.
  - CAP-S8 proof: `tests/snapshots/combat.test.ts`. Covers:
    - both offers and counter continuity;
    - the R-GM-2 `use`-raised `awaiting-declare`;
    - the legacy v1.5 envelope;
    - all refusals.

    Also `tests/proofs/movement-journey.test.ts`: `offerIndex === snap.offeredCount > 0`, no workaround.
  - Architecture: `feats.ts` value-imports only `./errors`; `helpers.ts` gains no import; `tests/schema/registry.test.ts` unchanged and green (RULE_IDS 15, REGISTRY 14).
  - Every commit was checked with `git show --name-only`; all paths are inside the write set.
- **surprises:**
  - **Lease revision 2:** the unowned DD-S14 pin `combat.test.ts:448` was re-keyed exactly as permitted (two assertion lines, `'resolved'` and `=== fight.state.phase`, plus the retitle).
  - **Inside the lease, beyond the plan:** `tests/runtime/combat/movement.test.ts` (narrow journey leg, about l.327). `restored.step()` was replaced with `expect(restored.state.phase).toBe(fight.state.phase)`; same DD-S14 cause.
  - **Where the ck4 envelope tests live:** the prompt says "New tests in combat.test.ts". They are in `tests/snapshots/combat.test.ts`, the leased snapshot suite, not the rev-2 runtime file (one permitted edit only).
  - **v1.5 derivation:** it also treats envelope `offers` as `resolved`.
  - **Pre-existing:** `Combat.use` surfaces only effect events, not `item:used`.
  - **Restricted-rejection message:** reads `action "casting" carries tag "casting"…` (pre-existing wording); `resource` is `casting`.
  - **Seed observation:** in the seed-42 feat leg the wight's `grave-gaze` lands `hexbound` with duration 1 (save branch), and `hexbound` is still active at the hexer's turn.
  - Concurrent OWNER-M02-HALF (`623a687`) affected no gate.
  - No CA mapping changed.
- **followUp:**
  - Arch fragment `.program/signal/SESSION-03.arch.md` covers ck1–ck5 (the ck4 envelope API; ck5 README only).
  - Carried open items with owners:
    - C-S01-1 `spatial.html:191` derived-phase copy: Designer. It is now stale under DD-S14, because restore keeps the live phase.
    - Out-of-combat restricts asymmetry: a future restricts feature.
    - F-M2 reach floor and R-GM-3 resume provoke skip: owners as in the grid-movement FINAL-REPORT.
    - zombie-urban and wyldwood hedge-mage spell lists: the next content feature.
    - FR-6 feat-slot cap: a future feat-progression feature (documented as a v1 limit in the README).
    - Self-buff actions target the opponent: a future action-targeting feature.
    - C1 `isLivePattern`: carried.
    - `heal`/`EFFECT_VOCABULARY`, item tags, `evalPackFormula` parse-once and the browser determinism leg: owners as in prior ledgers.
  - Closed during this session: C-S02-1 `damage(half)`, by OWNER-M02-HALF (`623a687`, STATE `937e5b4`).
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:**
  - `src/schema/validate/helpers.ts`
  - `src/compiler/themes/dark-fantasy.json`
  - `src/compiler/themes/zombie-urban.json`
  - `src/compiler/themes/wyldwood.json`
  - `tests/runtime/fixtures/packs.ts`
  - `tests/compiler/pipeline.test.ts`
  - `tests/compiler/stages.test.ts`
  - `tests/compiler/coverage-floor.test.ts`
  - `tests/schema/validate.test.ts`
  - `src/runtime/feats.ts`
  - `src/runtime/character.ts`
  - `src/runtime/runtime.ts`
  - `src/runtime/snapshots.ts`
  - `src/runtime/combat/resolve.ts`
  - `src/runtime/character-profile.ts`
  - `src/runtime/index.ts`
  - `tests/runtime/feats.test.ts`
  - `tests/snapshots/character.test.ts`
  - `src/runtime/combat/combat.ts`
  - `src/runtime/combat/triggers.ts`
  - `tests/runtime/combat/feat-triggers.test.ts`
  - `tests/runtime/combat/movement.test.ts`
  - `tests/proofs/movement-journey.test.ts`
  - `tests/snapshots/combat.test.ts`
  - `tests/runtime/combat/combat.test.ts`
  - `tests/proofs/spells-journey.test.ts`
  - `tests/proofs/rules-are-data.test.ts`
  - `tests/proofs/docs-run.test.ts`
  - `README.md`
