# Ruleswright — Architecture Record (v1-core)

> **Realized state as of tree HEAD `ad2cbe3`** (feat-progression close, 2026-10-04; last source
> commit `f7f6e88`), synthesized by Archivist (final pass) across **nine feature cycles**: v1-core (S01–S08, plan HEAD `53c7c91`),
> **v1-shell** (commits `770950f`–`72346a5` — schema v1.2, class combat actions, the validate/
> directory split, `character-profile.ts`, `combat.sideDefeated`, docs/CI honesty, packaging,
> coverage tooling — first reconciled into this record at the grid-combat pass; its synthesis was the loot-inventory
> pass's unfinished record-debt), **loot-inventory** (S01–S03, tree HEAD `8b802b7`),
> **grid-combat** (S01–S05 + replan + two owner corrections), **equipment-consumables**
> (S01–S06 + two replans, feature commits `0ee3974`..`c39ef87` — schema/snapshot contract v1.4,
> slot equipment, consumables, the `heal` registry entry, `gear-*` formula scalars, the
> armorCasting cast gate, combat `use` + settlement), **grid-movement** (S01–S04 + REPLAN-GM-01,
> feature commits `4ef88f0`..`6ab880a` — contract v1.5, movement as pack data via the `move`
> effect statement and the reserved `speed` formula, the hex model, pack-declared terrain,
> region-bounded exact pathing, leaving-reach provoke with pause/resume/forfeit, per-call offer
> surfacing, paused-move snapshots, the `display-roll.ts` leaf), and **spells-in-combat**
> (S01–S03 + REPLAN-SIC-01 + OWNER-M02-HALF, feature commits `b05b06e`..`5cfad48` — contract
> v1.6, spells declarable in combat with a pack-declared range and empty-cell bursts, per-target
> defender values (`EffectApply.varsFor`), recorded spell spend + `settleSpellCasts`, the
> `damage(half)` no-op, characters holding feats (`learnFeat`, the `feats.ts` leaf), reactive
> feats offered in combat, the trigger grammar enforced at load, and the combat envelope's
> `offers`/`phase`/`offeredCount`), **action-targeting** (S01–S03, feature commits
> `82832c0`..`3cce108` — contract v1.7, the `self` shape word of `target(…)` and self actions bound
> to their actor, the `ability(name)` formula function (registry 14 → 15), `heal` in
> `EFFECT_VOCABULARY`, 10 bundled self-buffs retargeted onto their user, the med-kit reading the
> vigor ability, and spell lists that reach their spells), and **feat-progression** (S01–S02, feature commits
> `3f63fd3`..`f7f6e88` — contract v1.8, per-class per-level `progression.<id>.featSlots` summed
> across classes, and the runtime rule `feat-slots-exceeded` on `learnFeat`, `levelSet`, `awardXp`
> and character/party restore; FR-6's "class features" item is still unbuilt).
> Every cycle's mid-run delta fragments were collapsed into one module-ordered description.
> Verified by the feat-progression final pass on a fresh run at `ad2cbe3`: `pnpm typecheck` 0 ·
> `pnpm build` 0 (24 dist files) · `check:isolation` 0 · `pnpm test` **911/911 across 49 files** ·
> `pnpm exec vitest run tests/proofs` **74/74 across 10 files** · `pnpm format:check` 0 (lint and
> security are the Orchestrator receive at `f7f6e88`, inherited — not re-run by this pass).
> Verified-by-source and verified-by-execution are distinguished below.
>
> *(Process history — crashes, recoveries, dispatch failures, owner-correction mechanics — lives
> in each cycle's Final Report and ARCHIVIST-LOG.md, not here.)*

<!-- Realized-state summary (Archivist synthesis, feat-progression final pass) -->

## Module map (as realized)

| ID | Module | Path | Imports (derived mechanically from value imports, incl. `export … from`, excluding `import type`) | Key files |
|----|--------|------|------------------------------------------------|-----------|
| M01 | Schema surface | `src/schema/` | nothing internal | `pack.ts`, `artifacts.ts`, `error-card.ts`, `version.ts`, `overrides.ts`, `validate/{collect,context,dsl,helpers,index}.ts`, `validate/sections/{actions,bestiary,content,cross,economy,progression,root,tables}.ts`, `index.ts` (+ DB-owned `contracts/**`) |
| M02 | Core mechanics | `src/core/` (9 .ts incl. dsl/) | M01 — **type-only** (`DslCheckRequest`/`ErrorCard` in `checker.ts`, `shared.ts`, `dsl/formula.ts`, `dsl/effect.ts`); no runtime value dependency | `rng.ts`, `dice.ts`, `tables.ts`, `index.ts`, `dsl/{shared,registry,formula,effect,checker}.ts` |
| M03 | Runtime | `src/runtime/` (21 .ts incl. combat/) | M01, M02 (value); never M04 | `runtime.ts`, `events.ts`, `character.ts`, `character-profile.ts`, `progression.ts`, `pools.ts`, `inventory.ts`, `equipment.ts` (equipment-consumables leaf), `display-roll.ts` (grid-movement leaf), `feats.ts` (spells-in-combat leaf), `conditions.ts`, `errors.ts`, `snapshots.ts`, `bestiary.ts`, `encounter.ts`, `index.ts`, `combat/{combat,resolve,action-economy,spatial,triggers}.ts` |
| M04 | Compiler | `src/compiler/` (17 .ts incl. 7 stages/ + 3 themes/) | M01, M02 (value: `validatePack`, `packDslChecker`, `Rng`, `makeErrorCard`); never M03 | `generate.ts`, `pipeline.ts`, `stage.ts`, `rng-stream.ts`, `knobs.ts`, `theme.ts`, `theme-loader.ts`, `compose.ts`, `errors.ts`, `index.ts`, `stages/{stats,skills,feats,classes,magic,bestiary,tables}.ts`, `themes/{dark-fantasy,zombie-urban,wyldwood}.json` |
| M05 | Root entry | `src/index.ts` | M01, M03, M04 (dumb `export *` re-export only) | `index.ts` |

**Realized dependency flow:** `schema` ⊥ `core` (siblings, import nothing internal — the only
declared M02→M01 edges are type-only); `runtime → {schema, core}`; `compiler → {schema, core}`;
stage 8 IS `schema.validatePack` (dogfood, no runtime import); no cross-module cycles. Intra-M03
value-import pairs (inside one module, tolerated by lazy use): `character.ts ⇄ progression.ts`
(`reserveValue` vs `validateBuild/buildCharacter`), `character.ts → inventory.ts` (facade
delegates), the equipment-consumables edges into the **`equipment.ts` leaf** — `character.ts`,
`pools.ts`, `inventory.ts` and `character-profile.ts` → `equipment.ts` — plus
`character-profile.ts → inventory.ts` (`dropItem`, settlement); `equipment.ts` value-imports only
core, `./errors`, `./conditions` and (since grid-movement) the `./display-roll` leaf (its `./runtime`/`./character`/`./events` imports are
`import type`), so none of these closes a cycle. **Record correction (equipment-consumables final pass):** the Final
Report and the S03 arch fragment list only `character`/`pools`/`inventory` → `equipment`; the
`character-profile.ts → {equipment, inventory}` value edges landed at S05 ck1/ck3 (`14c01dc`,
`31540b0`) and were missing from both. Also inside M03: `snapshots.ts → {character, progression}` (`reserveValue`, `buildCharacter`,
`validateBuild`, `Combat`-side `defeatedSide` from `combat/combat.ts`), and
`combat/combat.ts → combat/triggers.ts` (value), plus grid-movement's `{combat/combat,
equipment}.ts → display-roll.ts` (a leaf importing only `core/dice` types). spells-in-combat
added three value edges (derived at `94d40f3`, absent at `6ab880a`): `combat/combat.ts →
conditions.ts` (`matchesRestriction`, `declaredTags`; `conditions.ts` value-imports only
`./errors`), `character-profile.ts → pools.ts` (`knownSpells`, `armorBlockingCast`; `pools.ts`
imports nothing from `character-profile`) and `character.ts → feats.ts` (the **`feats.ts` leaf**
value-imports only `./errors`; its `./runtime`/`./character`/`./events` imports are `import
type`). feat-progression added one more, `progression.ts → feats.ts` (`featSlotTally`,
`featSlotsExceeded`); `feats.ts` gained only an `import type` of `../schema/error-card`, so it
stays a leaf. None closes a cycle. **Record correction (grid-combat final pass):** the prior
synthesis listed `combat/triggers.ts → combat.ts` as a second value-import cycle; git shows
`triggers.ts`'s `Combat`/`CombatantState`/`PendingTrigger` imports were `import type` at creation
(`6afbe31`) and remain so — the edge is type-only. `character ⇄ progression` is real.
Guards held at `ad2cbe3` (re-grepped by the feat-progression final pass; `git diff
-G'^(import|export .* from)' d97f269..b2db48b -- src` shows import changes only in `feats.ts`
(type-only) and `progression.ts` (the `./feats` value import)): no `compiler` reference in `src/runtime` except the CI-checked bundle
rule comment; no `runtime` import in `src/compiler` (grep-asserted in tests). The runtime-only
bundle is **proven** free of `generateCampaign` by `scripts/check-runtime-isolation.mjs`
(passed by this pass on a fresh build; also wired into CI's `package` job).

## Surfaces (what a consumer actually gets — derived, not claimed)

- `ruleswright/schema` — the full M01 re-export: pack/artifact types (incl. `Pack.spatial?`,
  `SpatialDef`, `SpatialReach` — v1.3; v1.5 widens `SpatialDef.model` to `'grid' | 'hex'` and
  adds `SpatialDef.terrain?` + `TerrainKind`; v1.6 adds `SpellTargeting.range?`; v1.8 adds
  `ClassProgression.featSlots?`), `validatePack(json, dslChecker?)`,
  `DslChecker`/`DslCheckRequest`/`deferredDslChecker`, `checkSchemaVersion`, `packContentHash`,
  `MAX_TABLE_DEPTH`, `nearestIds`, overrides API, `ErrorCard`/`makeErrorCard`/`RULE_IDS`
  (15 ids, `E-SPAT-01` last — v1.4 and v1.5 added no rule id). v1.4 (equipment-consumables): `Pack.equipSlots?`,
  `ItemDef.slots?/grants?/use?`, `RESERVED_GRANT_KEYS` (`hp`/`ac`/`initiative`/`armor`). The public validator surface is unchanged by the `validate/`
  directory split (`validate/index.ts` re-exports `MAX_TABLE_DEPTH`/`nearestIds` from
  `helpers.ts`).
- `ruleswright/compiler` — `generateCampaign`, `loadTheme` (`dark-fantasy`, `zombie-urban`,
  `wyldwood` — the three-name registry), `DARK_FANTASY`, `ZOMBIE_URBAN`, `WYLDWOOD`,
  `listThemeKnobs`, `resolveKnobs`, `composeTheme`/`readPatch`, `runPipeline`/`defaultStages`/
  `STAGE_ORDER`, `stageRng`, `GenerationError`, types. `ThemeTemplate` carries `spatial?`
  (grid-combat) so generated packs declare the grid model, and `equipSlots?`
  (equipment-consumables) so generated packs declare their slot vocabulary.
- `ruleswright/runtime` — lifecycle (Runtime/Character + progression/pools/inventory/conditions —
  `grantItem`/`dropItem`/`countItem`/`rollLoot`/`grantLoot` + facade `grant/drop/count/loot`),
  combat engine (startCombat/Combat + resolve/action-economy/spatial/triggers, host-declared
  `positions`, the reach + validity gates, `packSpatialModel`), character combat profiles
  (`profileFromCharacter`), bestiary/encounter, snapshots, EventStream,
  `RuntimeRuleError`/`ruleCard`, restricts matcher helpers (`matchesRestriction`,
  `declaredTags`, `isLivePattern`), `PackLoadError`; equipment-consumables added `equippedUnits`,
  `equippedGrants`, `equipmentView`, `equipmentScope`, `equipItem`, `unequipItem`, `useItem`
  (+ types `EquippedEntry`, `EquipmentView`, `UseItemOptions`), `settleItemUses`, `UseOptions`,
  `SnapshotEquippedEntry`, and the `Character` facade's `equip`/`unequip`/`useItem`; grid-movement
  added `hexGeometry`, `findPath`, `terrainAt`, `entryCost` and the types `PendingMove`,
  `MoveRejection`, `TerrainCell`, `PathQuery`, `PathResult` (plus the widened
  `DeclareOptions.to`, `StartCombatRequest.terrain`, `CombatRestoreRequest.terrain`); `displayRoll`
  keeps its barrel export, now re-exported from the `display-roll.ts` leaf. spells-in-combat added
  `settleSpellCasts`, `learnFeat`, `reactiveFeatsFor`, the `armorBlockingCast` export,
  `DeclareOptions.at`, the `Combat` constructor option `offeredCount` (+ read-only getter),
  `PendingTrigger.source`, `CombatSnapshot.offers?/phase?/offeredCount?`, and removed
  `parsePackEffects`. action-targeting added no barrel export (`isSelfAction` is an intra-runtime
  export of `combat.ts`, like `moveBudgetAst`). feat-progression added none either (DD-F7):
  `featSlotTally`/`FeatSlotTally`/`featSlotsExceeded` are intra-runtime exports of `feats.ts`,
  and the only public change is `validateBuild`'s optional 4th parameter `heldFeats`. (`SnapshotOffer`, the element type of `CombatSnapshot.offers`, is exported
  from `snapshots.ts` but not re-exported by the barrel — see drift notes.) **M03 barrel completed at v1-core S08**
  (D19, 9afa86c) and extended additively by every later feature (inventory verbs, spatial
  exports, `packSpatialModel` — the grid S03 one-line barrel export was outside that session's
  lease and was ratified, see the grid section; the equipment exports landed inside S03/S05's
  leases, which both owned `src/runtime/index.ts`).
- Root `ruleswright` — dumb `export *` from the three subpaths (M05).

**Dice/Rng seam (recorded drift, not a defect):** injectability is proven at `startCombat(rng?)` /
`assembleEncounter(rng?)` (`RandomSource`), and the fight's own stream is snapshot-resumable via
`CombatState.rng`. `Rng`/`RollResult` are **not** exported from `ruleswright/runtime`;
constructing an `Rng` requires importing `ruleswright` (root) or `ruleswright/core`'s barrel via
src. Recorded for the next Author/DB re-entry or v1.1 surface decision. `EQUIPMENT_SCALARS` (core)
is likewise reachable only through the root/core barrel, not a subpath surface.

## Cross-cutting decisions (accepted across the nine cycles)

v1-core (D9–D21): **D9** `src/core/index.ts` internal barrel; **D11** `src/runtime/errors.ts` +
`RuntimeRuleError` (engine-named rule ids distinct from the DB E-* registry); **D10** DSL grammar
(kebab name-swallowing, grammar-pure parser, 12-entry frozen registry, save-for-half
ceil+inheritance); **D16/D19** M03 barrel completion (S06's one-block + S08's mechanical
completion); **D20** compiler surface gains `loadTheme`/`DARK_FANTASY`/`ZOMBIE_URBAN`; **D21**
README quickstart's exact shape, executed by `tests/proofs/docs-run.test.ts`; **D13** spatial
rejections carried typed `pendingId` *(superseded: grid-combat v1.3 registered `E-SPAT-01` and
S03 switched `pendingId` → `rule: 'E-SPAT-01'` with zero remnants)*; **D17** themes carry NO
spatial section *(premise overturned by grid-combat: pack.schema.json v1.3 admits an optional
top-level `spatial`, and all three bundled themes declare it)*; **D18** `resolveJsonModule:
true`, `themes.d.ts` deleted; **D8** `MAX_TABLE_DEPTH = 8` pending DB ratification
*(superseded: database.md v1.2 records the ratification — see below)*.

v1-shell: **class combat actions** (`content.classes.<id>.actions`, schema v1.2 — a class with
actions can fight); **`profileFromCharacter(rt, character, id?)` → `{profile, balances}`** (CA-08
— a character enters its own fights; union of class actions, pool points, bound slots; classless
→ `no-combat-actions`); **`combat.sideDefeated` end-of-combat rule** (D-26: after any resolution,
a fully-downed side ends the fight — `phase: 'combat-over'`, one `combat:ended` event naming
`{winner, defeated}`, downed combatants skip turns and receive no trigger offers, a terminal
snapshot restores as `combat-over`); **validate/ split** (2319-line `validate.ts` → per-pass
directory; zero API change); **honest docs/CI** (browser matrix leg documented as a v1.1
follow-up, DOCS-CI-01..03, DOCS-TSC-01); **packaging hygiene** (MIT LICENSE, ESLint 10 flat
config — lint needs Node ≥ 20.19, CI lint on Node 22 — Prettier enforcement repo-wide);
**coverage tooling** (`pnpm test --coverage`; the dead `newCtx` helper removed with the split).

loot-inventory (D1–D10, selected): inventory as `{id, qty}` **stacks** (contract-verbatim, no
instances); **loot is a runtime verb over the one table engine**, not DSL registry growth; the
**CA-02 value convention** (string ⇒ `content.items[id]` qty 1; `{id, qty}` ⇒ stack; anything
else ⇒ flavor, skipped; nothing grantable ⇒ `loot-grants-nothing` with no state change);
restore does **not** cross-validate item ids (verbatim state restoration, mutation-time
validation); stage-7 integrity scoped to `-loot` tables (objects with undeclared ids +
missed `tables.`-prefixed refs → E-REF-01; every other string is flavor); **wyldwood** as the
third format proof (fey/wilderness, charm/ward loot economy, point-pool spells, no vancian);
engine changes land atomically at S01 ck1 (required `inventory` field + snapshot fidelity).

grid-combat (DD1–DD17e, selected; full record in STATE.md): **DD1** no movement verb in v1 —
movement = serialize → `deserializeCombat` with updated positions (FR-10 between-steps), the
documented v1 answer, README-documented; an approved `move()` is an api-map product decision. *(Superseded by grid-movement DD-M1:
movement is pack data; the restore seam remains the host's out-of-rules teleport.)*
**DD2** burst center = the declared target's position; bursts hit both sides (mock-verbatim).
**DD4** reach override keys are free-form labels; lookup `reach[profile.id] ?? reach.default`
(resolved by combatant *instance* id). **DD6** structural/semantic split: missing/mistyped
spatial fields → E-SCHEMA-01; declared-but-unshippable geometry (model ≠ grid as const, shapes
outside {single,burst}) → E-SPAT-01. **DD7** `E-SPAT-01` registered additively (v1.3 minor);
`SpatialRejection.pendingId` → `rule: 'E-SPAT-01'` in the same session that owns the file.
**DD8** the legacy `RUNTIME_PACK` fixture stays theater-of-mind (the 503-test parity baseline);
the spatial variant lives in `tests/runtime/fixtures/packs.ts` (`withSpatial`). **DD9** snapshot
contract unchanged — `snapshots.schema.json` already carried `combatants[].position?` (v1.0).
**DD14** declare gate order is **validity → spatial → cost** (so the out-of-reach
`hasTarget(adjacent)` rejection stays observable; recorded in the source comment); CA-G5's
play-time card is `kind: 'valid'`, `rule: 'E-REF-01'`; `packSpatialModel` takes the structural
`{spatial?: SpatialDef}` input; **DD14e** `npx vitest run` fails in this runtime —
`pnpm exec vitest run <path>` is the working narrow form (now a program convention). **DD14a**
S03's one-line `packSpatialModel` barrel export in `src/runtime/index.ts` was outside the lease
and **ratified** (narrowest change satisfying the approved checkpoint; D16 precedent); recorded,
never amended. **DD15** token discipline: `substituteTokens` stringifies knob values, so the only
stage-8-valid token placement inside spatial is a shape-valued knob spliced into `shapes`; reach
values stay plain integers. **DD16** the positionless `fightScript` adjacency fallback (the
distance-3 shape was empirically proved a permanent stalemate — the engine ships no movement
mechanic, so a gap can never close); skip actions must be **reach-neutral** in spatial packs. *(Stalemate retired by grid-movement:
generated packs move, and the movement journey's 2v2 reaches `combat-over`.)*
**DD17** combat `declare()` resolved actions only from `pack.actions` until spells-in-combat
(v1.6): `declare(id)` now looks the id up in `pack.actions`, then in `pack.content.spells`, and a
spell rides the same pipeline (membership in `profile.spells`, range gate instead of reach,
armor gate, binding pick, `spell:cast`); the grid journey casts the real `ember-bloom` (DD17a
retired; the binding surface is still `prepareSpell`); `declare()` returns
`events.sinceRound(round)` (the round's window — resumed-leg assertions need a fresh sink). *(Since
grid-movement F-P1 the return value is unchanged, but **offers** are surfaced only for the
events the current call emitted — see M03 combat.)*

equipment-consumables (DD-EG1–DD-EG9; full record in that run's STATE.md): **DD-EG1**
slot-based equipment — the pack declares `equipSlots` (its own vocabulary, never global ids);
`ItemDef.slots` lists eligible slots; `CharacterState.equipped?: {slot, itemId}[]` is **absent
until the first equip**; equip gates `unknown-item → not-equippable → unknown-slot →
slot-not-allowed → slot-occupied → item-not-held`; `dropItem` refuses `item-equipped`.
**DD-EG2** grants are pack-visible values the pack's formulas read: ability/save keys **add**;
reserved keys are summed into `gear-hp`/`gear-ac`/`gear-initiative`/`gear-armor`, readable in
`formulas` only, **0 when unbound** — the engine never hard-codes a stat's direction (all three
themes are descending: `… - gear-ac`). **DD-EG3** consumables = `ItemDef.use` effect DSL, parsed
once into `PackIndex.itemEffects`. **DD-EG4** `heal(formula)` is registry entry 13, executed as
a negative-amount `damage`; heal rule (R-2) `after = current >= cap ? current : min(cap,
current + heal)` — never above the cap, never lowering hp already above it. **DD-EG5**
armorCasting teeth at **slot** cast time only (an item is armor iff `grants.armor`); point-pool
spells are cast in combat (`fight.declare`, v1.6) and are never armor-gated; out of combat point-pool
casting still has no verb, so wyldwood's charm armor remains validation-only content.
**DD-EG6/6a** `fight.use` draws on host-stated `balances.items` (fixed `itemBalances`, spent
`itemsUsed`), is not a slot action, gate 0 copies `declare`'s phase/turn rule; the host calls
`settleItemUses` after `combat-over` to drop the spent units — idempotent **per live fight
object** only (R-4, documented v1 limit). **DD-EG7** snapshot fields `equipped` (presence-
preserving, validated restore), combatant `itemsUsed` (spent) and `maxHp` (snapshot →
`profile.maxHp` → `max(0, profile.hp)`); `schemaVersion`/`snapshotVersion` stay 1. **DD-EG8**
theme content reuses existing item ids only. **DD-EG9** the dist-built equipment journey.

grid-movement (DD-M1–DD-M19; full record in that run's STATE.md; DD-M2…M13 human-confirmed
2026-09-30, DD-M10/M12 refined by the F-P1/F-P2/F-P10 auto-decisions): **DD-M1** movement is
pack data (human, Option B) — one effect statement `move(<formula>)` and a movement gate, no
new combat verb; a move is `fight.declare(actionId, { to })`. **DD-M2** `spatial.model: 'grid' |
'hex'`; hex reuses `{x, y}` as axial `{q, r}`, distance `(|dq| + |dr| + |dq + dr|) / 2`, fixed
neighbor order `(+1,0), (+1,−1), (0,−1), (−1,0), (−1,+1), (0,+1)`. **DD-M3** wyldwood is hex;
dark-fantasy and zombie-urban stay grid. **DD-M4** square movement uses 8 neighbors, diagonal
cost 1 (S03 pinned the order counter-clockwise from east). **DD-M5** the pack declares the
terrain *vocabulary* (`{cost ≥ 1}` xor `{blocks: true}`); the host places cells per fight
(`startCombat({terrain})`, re-stated on restore) — the engine never invents a map. **DD-M6**
occupancy: a move cannot end on a standing combatant's cell, the mover's own included; it may
pass standing allies, not standing enemies; downed combatants never block. **DD-M7** `speed`
is an optional reserved formula, on the profile only when declared, an engine-derived effect
scalar (`profile.speed ?? 0` in combat; `useItem` binds the formula or 0); `speed` at a
*formula position* without `formulas.speed` → E-REF-01 (the one documented v1.5 compatibility
caveat). **DD-M8** `move` is legal only as the root statement of a non-triggered
`actions.<id>.effect`, with a dice-free budget (E-FORM-02 otherwise). **DD-M9** deterministic
cheapest path (Dijkstra, neighbor-order tie-break); rejections `no-destination` / `blocked` /
`occupied` / `unreachable` / `out-of-range`, all E-SPAT-01 with no state, RNG or ledger change.
**DD-M10** provoke: `move:leaving-reach` before a step that leaves a standing opponent's reach;
offers per call and once per (reactor, event); offers not filtered by affordability; the move
pauses iff an offer surfaces, resumes when the queue empties (re-checking downed / restricted /
blocked), and `step()` while paused forfeits it. **DD-M11** theater-of-mind move = no-op
success. **DD-M12** snapshot `pendingMove?`; derived restore phase *(since v1.6, DD-S14, the derivation
is only the fallback for envelopes without `phase`)*; restored offer `on` = event type. **DD-M13** `respond` target resolution unchanged (the host names the mover). **DD-M14**
`canReach` semantics preserved (F-M2). **DD-M18** `findPath` is region-bounded and exact
(bounding box of from/to/terrain/positions expanded by one; sound because clamping never raises
a step's cost). **DD-M19** the validator's `speed` reference scan is position-aware.

spells-in-combat (DD-S1–DD-S19; full record in that run's STATE.md; DD-S1…S3 human answers,
DD-S8 human-amended, DD-S8…S14 human-confirmed (B-S1), DD-S15/S16 source corrections, DD-S19 an
auto-decision implied by FR-9/FR-11): **DD-S1** one DB re-entry — contract **v1.6**,
`schemaVersion` 1, no rule id, two compatibility caveats (the trigger grammar; `pendingTrigger`
legacy-read-only). **DD-S2** only characters cast — statblocks have no spell field, so a monster
declaring a spell id is `no-action`. **DD-S4** no cast verb: `fight.declare(spellId, {targetId} |
{at})`, gated by membership in the combatant's `spells` (= `knownSpells`). **DD-S5** pool spells
cast in combat (out of combat pool casting still has no verb). **DD-S6** the armor gate in
combat is the out-of-combat one (vancian only, DD-EG5) via profile `castBlockedBy`. **DD-S7**
`settleSpellCasts` mirrors `settleItemUses` (same R-4 limit). **DD-S8** spell range is pack data
(`targeting.range`, integer ≥ 0 in the pack's distance; absent = the `canReach` value, so the
F-M2 floor is inherited); range replaces reach for spells; a burst spell may take `{at}` on any
cell (empty included); a spell `targetId` may name any combatant; no line of sight; theater packs
ignore range and `at`. **DD-S9** every bundled spell costs `slots {main: 1, move: 1}` (the
human's "cost a turn", read as the whole turn; the reaction stays) and declares `range: 6`.
**DD-S10** in combat a spell is restricted by `actions.tagged:` **or** `spells.tagged:` through
the exported `matchesRestriction`; out of combat `isRestricted` stays kind-exact (asymmetry
carried as a human question). **DD-S11** `learnFeat`; `CharacterState.feats?` absent until the
first learn; uncapped in v1.6 (since v1.8 the cap is pack data — feat-progression below). **DD-S12** reactive feats are offered like reactive
actions (after them), cost nothing, pass no gate, act on the holder, and never chain (events
raised while a feat resolves offer no feats). **DD-S13** `trigger.on` must match the
`eventMatches` grammar, else `E-FORM-01` at load. **DD-S14** the combat envelope carries
`offers` (all open offers, in order), `phase` and `offeredCount`; restore precedence frozen-hp
`combat-over` → envelope `phase` → the v1.5 derivation. **DD-S15** `parsePackEffects` deleted
(`PackIndex.spellEffects` is the parse-once source; C6). **DD-S16** no id-collision rule needed
(`E-DUP-01` already spans actions, spells and feats). **DD-S17** spell event anatomy
`spell:cast` → effect events → `action:resolved`. **DD-S18** the binding pick (lowest uncast index
bound to the spell). **DD-S19** per-target defender values through the optional
`EffectApply.varsFor`; the DC and attack bonus keep `ctx.vars` (documented consequence, F-P9).
C-S02-1 (owner correction, not a DD): a passed save whose fail branch carries no damage resolves
`damage(half)` as no damage.

action-targeting (DD-A1–DD-A9; full record in that run's STATE.md; B-AT-1 human answers
2026-10-01 — DB re-entry approved, med-kit heals 12, `brace` roots its user): **DD-A1** `self` is a
shape word of `target(…)`, with no registry entry (the shape argument was already an open name
vocabulary): `target(self, <effect>)` scopes the effect to the actor — declarer, reactor, feat
holder or item user — in grid, hex and theater packs, at any depth; `hasTarget(self)` holds while
the actor stands. **DD-A2** self actions: an **action** whose parse-once effect **root** is
`target(self, …)` binds its actor, declared or taken as a reaction — no opponent resolution, no
reach gate (the DD-M9 move-action precedent). A `targetId` other than the actor is
`invalid-target` / E-REF-01 with nothing changed; the actor's own id is accepted. Restriction,
validity and cost gates keep their order. Spells are never self actions (a `self` inside a spell
still resolves to the caster, DD-S8). A non-root `target(self, …)` leaves the action ordinary (the
root-only rule, a documented v1.7 limitation). A self action's `condition:applied` names the actor
as target, so it offers the actor's own `condition:applied[target=self]` feats (second-gust,
last-legs, gloam-step — documented in v1.7, proven at S02 ck1; feats still never chain).
**DD-A3** 10 bundled self-buffs wrapped in `target(self, …)` (M04 below); `brace` roots its user.
**DD-A4** `ability(name)` — registry 14 → 15, `{arity: 1, kind: 'formula', signature:
['ability-name']}`, legal only in effect-kind fields (else E-FORM-02), its argument a declared
ability (else E-FORM-03 with did-you-mean), its value the actor's composed ability through the
reserved var `ability:<name>` (a `:` never appears in a DSL name), fail-closed when unbound. Bare
names keep their meaning — a save still shadows the same-named ability, because swapping the
var-spread order would break every `d20 + <save>` recipe. **DD-A5** the premise "med-kit → ability
is a content fix" was disproved at planning; the med-kit reads `heal(2 + ability(vigor))` and heals
12 at level 1 (human choice; the modifier form was rejected). **DD-A6** spells are not retargeted
(a caster wards itself with `{targetId: <self>}`). **DD-A7** the spell-list fix is a class edit, not
a list rename. **DD-A8** new journeys import the `src` barrels, not `dist/`. **DD-A9** no new
```ts README block (the docs-run pin stays at 4).

feat-progression (DD-F1–DD-F10; full record in that run's STATE.md; human answers 2026-10-04 —
"1 per class per level - 2 refuse - 3 approved"): **DD-F1** `progression.<classId>.featSlots?:
integer[]`; entry *i* is the class's **running total** at class level *i + 1* (like `saves`, not
an increment). **DD-F2** a character's slots are the sum over its classes (the vancian-slot
precedent). **DD-F3** opt-in: a pack is *feat-slotted* when **any** progression entry declares
`featSlots`; there a class without it contributes 0; a pack declaring none is uncapped (v1.7
behaviour). **DD-F4** load constraints, all `E-SCHEMA-01`, no rule id: integers ≥ 0, non-empty,
non-decreasing, length ≥ the class's shortest `saves` array. **DD-F5** every held feat occupies
one slot, passive or reactive. **DD-F6** the runtime rule `feat-slots-exceeded` (engine-named like
`feat-known`, not a `RULE_IDS` entry), all-or-nothing on every path: `learnFeat`
(RuntimeRuleError, artifactId the feat id); `levelSet` through `validateBuild`'s `heldFeats`
(CharacterBuildError, `'(character)'`); `awardXp`, checked before any mutation (same); and
character/party restore (RuntimeRuleError; human Q2 "refuse"). The card's `jsonPath` is `feats`
and its hint lists each class's contribution. *Cite the refusal paths by name:* `database.md` and
STATE's DD-F6 letter them differently. **DD-F7** no new public symbol beyond `validateBuild`'s
optional parameter. **DD-F8** all 9 bundled classes declare `[1, 1, 2, 2, 2, 3, 3, 3, 4, 4]`
(levels 1–5 are `progression.html`'s warden column). **DD-F9** `snapshots.schema.json`, combat
profiles and compiler source are unchanged. **DD-F10** the pre-existing `awardXp` level-lowering
(F-FP1) is not changed; DD-F6's `awardXp` check guards the invariant regardless.

## Session-realized sections

*(Each section is the session delta as integrated by Orchestrator, reconciled by Archivist:
stale claims resolved against derived imports and git; commit ids preserved.)*

### M01 — Schema surface (v1-core S01, 43065f5/27d25e6/d3cbd51; split in v1-shell; spatial in grid-combat S01/S02)

`src/schema/overrides.ts` — `applyOverrides(pack, doc): { pack, errors }` (FR-19 deep-merge per
dotted-path key, array order, unknown target → E-OVR-01 with nearest-id hints; does NOT validate —
callers revalidate per database.md merge discipline). `OverrideDocument` mirrors override.schema.json.

Public API: `validatePack(json, dslChecker?)` — second param is the CA-2 consumer seam (default
`deferredDslChecker`, fail-closed: one deferred E-FORM-01 per DSL string until `packDslChecker`
is wired); `DslCheckRequest {expr; kind; artifactId; jsonPath; abilities; saves}`;
`MAX_TABLE_DEPTH = 8`; `nearestIds`. `version.ts`: `checkSchemaVersion` (E-SCHEMA-01),
`packContentHash` (canonical sorted-key JSON + FNV-1a → 8 hex, zero deps). `src/schema/index.ts`
re-exports every implementation file. M01 imports nothing internal.

v1-shell split `validate.ts` (2319 lines) into `validate/{collect,context,dsl,helpers,index}.ts`
+ `validate/sections/{actions,bestiary,content,cross,economy,progression,root,tables}.ts` — one
module per pass/section; zero consumer or API change (the dead `newCtx` helper was removed with
it). `MAX_TABLE_DEPTH` now lives in `validate/helpers.ts` (exported through `validate/index.ts`)
with the same value 8 as `core/tables.ts`.

grid-combat S01 (DB author re-entry, the only session leased on `contracts/**`/`specs/**`):
`pack.schema.json` v1.3 gains the optional top-level `spatial` property (after `economy`, mock
order) + `$defs/spatial` mock-verbatim — `{model: 'grid'}` const, `reach` required `default`
integer ≥1 with per-id overrides as **direct siblings of `default`** (free-form labels, no
idPattern; dotted artifact paths are a documented v2 seam), optional unique `shapes` ⊆
{single, burst} (verified field-for-field against `mocks/spatial.html` at the grid-combat pass at
`86f605e`/`0ab3622`; the property is additive, `schemaVersion` stays 1, top-level `required`
unchanged). `database.md` v1.3 registered `E-SPAT-01` + the Version Registry row.

grid-combat S02: `Pack.spatial?: SpatialDef` + `SpatialReach`/`SpatialDef` exports in
`src/schema/pack.ts` (mirror of the committed `$defs/spatial`); `RuleId` union and frozen
`RULE_IDS` 14 → 15 with `'E-SPAT-01'` last (additive minor); `checkSpatial` in
`validate/sections/root.ts` (structural → E-SCHEMA-01, unshippable geometry → E-SPAT-01;
reach-level unknown keys validated as overrides, section-level unknown keys → E-SCHEMA-02),
dispatched in `validate/index.ts` after `checkEconomy`; `checkRootSections`' closed-top-level
loop admits `spatial` (without the exemption every spatial pack double-fails E-SCHEMA-02).

equipment-consumables S01 (DB author re-entry, `a6a3334`/`c32d2d2`/`a409ef4`, format residual
`8668c53`): contract **v1.4**, additive-optional. `pack.schema.json` gains root `equipSlots`
(after `spatial`; array, minItems 1, unique, idPattern — its own vocabulary, E-DUP-01 does not
apply) and `content.items.<id>.{slots, grants, use}` (`grants.additionalProperties: integer`,
`grants.properties.armor: {integer, minimum 1}` — the armor marker); the `stats` description
reserves the `gear-*` ids. `snapshots.schema.json` gains `characterState.equipped` (`{slot,
itemId}` entries; slot uniqueness enforced by runtime restore, not `uniqueItems`) and combatant
`itemsUsed` (spent) / `maxHp` (integer ≥ 0). `database.md` v1.4 + Version Registry row 5. No
`required` changed; no rule id added.

equipment-consumables S02 (`0f1ff65`/`52df545`): mirror `Pack.equipSlots?: KebabId[]` and
`ItemDef.slots?/grants?/use?`; `RESERVED_GRANT_KEYS` in `artifacts.ts`. Validator:
`Ctx.equipSlotNames` (absent → empty Set so slotted items get E-REF-01; unreadable → `null` so
item slot refs are skipped — no cascade, R-8); `checkEquipSlots` (`root.ts`, dispatched after
`checkSpatial`); `checkStats` rejects `gear-*` ids (E-SCHEMA-01); `checkItems` gains
`checkItemSlots` (E-SCHEMA-01 structure / E-REF-01 resolution) and `checkItemGrants` (E-REF-01
unknown key / E-SCHEMA-01 value, `armor` ≥ 1); item `use` is routed as an `effect` DSL field.
Slot ids never enter the global id namespace.

grid-movement S01 (Author re-entry: Spec → Designer → DB, `9bc89f6`/`5209311`/`a134054`):
FR-11 amended (6 acceptance criteria); `spatial.html`/`api-map.html` carry movement, hex, terrain
and leaving-reach; contract **v1.5** — `$defs/spatial/properties/model` const → `{enum: [grid,
hex]}`, optional `terrain` (kebab `propertyNames`, `additionalProperties.oneOf` of closed
`{cost: integer ≥ 1}` / `{blocks: const true}`), `formulas.speed` documented as a reserved
optional id (shape unchanged); `snapshots.schema.json` combatant `pendingMove` (closed `{actionId,
to: {x, y}, remaining ≥ 0}`, all required). `database.md` v1.5 + Version Registry row 6 (carries
the `speed` compatibility caveat instead of "purely additive"). No `required` changed; no rule id.

grid-movement S02 (`21a0a5f`/`5d76126`/`933c2fd`): `pack.ts` gains `TerrainKind = {cost: number}
| {blocks: true}`, `SpatialDef.model: 'grid' | 'hex'`, `SpatialDef.terrain?`. `checkSpatial`
accepts `{grid, hex}` (anything else E-SPAT-01 at `spatial.model`), admits `terrain` in the
closed key set, and a private `checkTerrain` sends malformed kinds to E-SCHEMA-01 at
`spatial.terrain[.<kind>]`. New pass-3 cross check **`checkMovementDsl`** (`cross.ts`, dispatched
in `validate/index.ts` after `checkRestrictsTags`): a root `move(` in a triggered action, a
spell/feat `effect` or an item `use` → E-FORM-02; `speed` at a formula position with readable
`formulas` lacking `speed` → E-REF-01, one per field. The scan is text-level (core lexer grammar,
grouping-paren frames since `933c2fd`), so M01 still imports no core value; `NON_FORMULA_ARGS =
{damage:[1], applyCondition:[0], target:[0], save:[0]}` (+ `ability:[0]` since v1.7) mirrors core
`ARG_CATEGORIES`.

spells-in-combat S01 (Author re-entry: Spec → Designer → DB, `e5e1d7f`/`67705d9`/`1639a19`):
FR-9 (spell range) and FR-11 (empty-cell area center) amended; `magic.html`, `api-map.html`,
`triggers.html`, `conditions.html` carry combat casting, range + `at`, settlement and the feat
learn/offer anatomy; contract **v1.6** — `pack.schema.json` spells `targeting.range` (`{integer,
minimum 0}`, `required` unchanged), the `trigger.on` grammar `pattern` on actions and feats, and a
combat-casting description on the spells map; `snapshots.schema.json` combatant `poolsSpent` /
`slotsCast` and envelope `offers` / `phase` / `offeredCount` (all optional). `database.md` v1.6 +
Version Registry row 7 (two compatibility caveats instead of "purely additive"). No `required`
changed; no rule id.

spells-in-combat S02 ck2 (`89a11e7`): `SpellTargeting.range?: number` in `artifacts.ts`;
`content.ts` `checkTargeting` admits `range` (closed key set `{shape, radius, range}`; a
non-integer or negative value is E-SCHEMA-01 at `<base>.targeting.range`). S03 ck1 (`d9a6d71`):
`validate/helpers.ts` exports `TRIGGER_PATTERN` (the `eventMatches` grammar, equal to the v1.6
contract pattern; not re-exported by `validate/index.ts`), and `checkTrigger` refuses a string `on`
that fails it — E-FORM-01 at `<base>.trigger.on`, on actions and feats alike, with the hint `did
you mean "<base>[target=self]"?` for a trailing `[self]`. M01 gained no import.

action-targeting S01 (DB Author re-entry, `64dc746`/`f622431`): contract **v1.7** — `database.md`
§actions "Self actions and the `self` shape" and §formulas "`ability(name)`", Status line and
Version Registry row 8, with one compatibility caveat (c): a `target(self, …)` that resolved to
nobody (grid/hex) or to the bound target (theater) in v1.6 now resolves to the actor; no bundled
theme used it. `pack.schema.json` changed its `formulas.description` only — no field, no
`required`, no rule id, `schemaVersion` 1. S03 ck1 (`4c1e1e6`): `cross.ts` `NON_FORMULA_ARGS.ability
= [0]` mirrors core's `ability-name` position, so `ability(speed)` is not a `speed` reference in the
v1.5 scan. M01 gained no import.

feat-progression S01 (DB Author re-entry, `3f63fd3`/`f4cc597`): contract **v1.8** — `database.md`
§progression row `featSlots` and the *Feat slots* paragraph, the Snapshot Envelopes restore
bullet, the Status line and Version Registry row 9, with one compatibility caveat (d): a pack that
adds `featSlots` refuses learning past the cap and refuses to restore an over-cap character.
`pack.schema.json` `$defs/classProgression.featSlots` is `{type: array, minItems: 1, items:
{integer, minimum 0}}`, not in `required`; `schemaVersion` 1; no rule id. S02 ck1 (`45483c5`):
`ClassProgression.featSlots?: number[]` in `artifacts.ts`. `checkProgression` admits `featSlots`
in its `forbidUnknown` list and checks it with `checkIntegerArray(…, 0)`; then, only when every
entry is an integer ≥ 0 (so a negative entry yields one card, not two), it checks non-decreasing
(`E-SCHEMA-01` at `progression.<id>.featSlots[i]`) and coverage of the shortest `saves` array
(`E-SCHEMA-01` at `progression.<id>.featSlots`, only when `saves` is a plain object). M01 gained
no import.

### M02 — Repo spine + core mechanics (v1-core S02, 35aa73f/0f8a1ab/55918ef)

- `src/core/rng.ts` — `Rng` (sfc32, cyrb128 string/number seed), `RandomSource` (minimal
  injectable entropy: `int(maxExclusive)`), `RngState` (`{a,b,c,d}` uint32 — exactly
  snapshots.schema.json `rngState`; setState rejects extra keys).
- `src/core/dice.ts` — `parseRecipe` (pure, load-time; dice.html vocabulary), `rollRecipe` →
  `RollResult` (CA-2 shape; invariant `total === sum(values) + modifier`; verdicts
  caller-attached).
- `src/core/tables.ts` — `rollTable(def, rng, {resolve?, jsonPath?})` → `TableOutcome`;
  `TableDef`/`TableEntry` mirror `$defs/tableDef` (sibling-declared, no internal import);
  `MAX_TABLE_DEPTH = 8`; failures `malformed-entries`/`range-gap`/`depth-exceeded` → E-TBL-01,
  `unresolvable-ref` → E-REF-01.
- `src/core/index.ts` — internal barrel for runtime/compiler imports.
- Root manifests; zero runtime deps; lint bans `Math.random`/`Date.now`/`eval`/`new Function`/
  dynamic imports + `ImportExpression` under `src/**` (carried verbatim into ESLint 10 flat
  config in v1-shell).

### M02 — DSL compiler (v1-core S03 via RECOVERY-03, 4e188fa/dff30e6/7eff106/168d71a; validity gate in grid-combat S03; heal + gear scalars in equipment-consumables S02; move + speed in grid-movement S02; varsFor + the half no-op in spells-in-combat; `ability(name)` + the `heal` vocabulary entry in action-targeting S03)

Module `src/core/dsl/` — value imports outside `dsl/` only `../dice` (re-derived at `94d40f3`); schema imports are type-only
(`DslCheckRequest`, `ErrorCard`) — sibling-leaf rules held in the M02→M01 direction.

- `checker.ts` — `packDslChecker: DslChecker` (S01's seam; dispatch by request kind); E-FORM-01
  parse errors carry 0-based char offset; E-FORM-02 closed-registry miss; E-FORM-03 unknown name
  + did-you-mean via S01 `nearestIds`.
- `formula.ts` — `parseFormula` (parse-once), `evalFormula` (eval-many; `FormulaValue = number |
  RollResult`), `checkFormula`, `checkFormulaAst`, `BUILTIN_SCALARS = ['level']`. grid-combat S03
  added **`evalValidity(ast, ctx, hasTarget)`** — validity-AST evaluation with the injected
  geometry callback (core stays runtime-ignorant); comparators/scalars delegate to `evalFormula`
  over the zero-RNG stream. equipment-consumables S02 added **`EQUIPMENT_SCALARS`** =
  `['gear-hp','gear-ac','gear-initiative','gear-armor']`: `checkFormula` admits them only for
  `kind === 'formula'` (E-FORM-03 elsewhere); `evalFormula` returns 0 for an unbound one (every
  other unknown name still throws). A formula test pins `EQUIPMENT_SCALARS` ≡ `gear-` +
  `RESERVED_GRANT_KEYS` (the two lists are declared separately so schema imports no core value).
  action-targeting S03 ck1 (`4c1e1e6`) added **`ability(name)`**: `FormulaCheckContext.allowAbility?`;
  `checkFormulaAst` routes `ability(…)` (after the registry/kind/arity checks) to the private
  `checkAbilityCall` — E-FORM-02 unless `allowAbility` or for a non-name argument, E-FORM-03 with
  did-you-mean over the abilities for an undeclared one; `evalCall` reads `ctx['ability:<name>']`
  and throws when it is unbound (fail closed). Proven by `tests/core/dsl/ability.test.ts` (12) through
  the real `packDslChecker`/`evalFormula`/`executeAgainst`/`validatePack`.
- `effect.ts` — `parseEffect`; `executeEffect(ast, ctx)` pure interpreter; ctx
  `{actor, targets, rng, apply: EffectApply, vars}`; `EffectApply = {resolveTargets, damage,
  condition}` is the mutation seam; save-for-half: `damage(half)` re-rolls the fail branch's
  first damage expr, total = ceil(half), inherits type. **spells-in-combat:** optional
  **`EffectApply.varsFor?(target)`** (S02 ck2, DD-S19) — when present, `execSave` rolls each
  scoped target's save with that target's own vars and `execAttack` evaluates the defense formula
  per scoped target; the DC, the attack bonus and damage formulas keep `ctx.vars`; absent = the
  pre-v1.6 executor (closes the old per-target save-modifier gap). OWNER-M02-HALF (`623a687`,
  C-S02-1): in a passed save whose fail branch has no damage expression, `damage(half)` resolves
  as no damage (`NOTHING_TO_HALVE` marker — no `apply.damage`, no outcome, no RNG draw);
  `damage(half)` reached outside a save's pass branch still throws E-FORM-02, and the load-time
  check is unchanged. grid-movement S02:
  `EFFECT_SCALARS = ['level','hp','ac','initiative','speed']`; optional
  **`EffectApply.move?(budget: number): void`** (absent host = no movement support); the executor
  evaluates the budget, calls `apply.move` once and returns `MoveOutcome {kind: 'move', budget}`,
  and **throws when `apply.move` is absent** (fail-closed); `checkEffectAst` threads `atRoot`
  (nested `move` or dice in its argument → E-FORM-02); `ARG_CATEGORIES.move = ['formula']`.
  action-targeting: `checkEffect` is the only setter of `allowAbility: true`, so `ability()` is
  legal only in effect-kind fields (action/spell/feat `effect`, item `use`). The executor is
  unchanged by `target(self, …)`: `execTarget` asks the host's `resolveTargets('self')`.
- `registry.ts` — frozen registry, **15 entries** since action-targeting S03 ck1: equipment-consumables
  S02 added `heal: {arity: 1, kind: 'effect', signature: ['formula']}` after `damage` (12→13, the
  sanctioned schema event bundled in contract v1.4); grid-movement S02 added `move` with the same
  shape (13→14, contract v1.5); action-targeting added `ability: {arity: 1, kind: 'formula',
  signature: ['ability-name']}` (14→15, contract v1.7). `EFFECT_VOCABULARY` gained `move`, and
  `heal` at action-targeting S03 ck1 — it now equals exactly the effect-kind registry entries,
  pinned in `checker.test.ts` (F-A7; cleanup C12 closed); `FORMULA_VOCABULARY` gained `ability`.
  The registry freeze test is re-keyed to 15.
  `executeEffect` runs `heal(f)` as `apply.damage(target, negatedRoll)` — the whole RollResult
  (values, modifier, total) negated with purpose `'heal'`, yielding `DamageOutcome {roll,
  halved: false}`; the executor never clamps (the cap is the host's, CA-EG4).
- `shared.ts` — one lexer both grammars; `MAX_PARSE_DEPTH = 24`, `MAX_EXPR_LENGTH = 512`;
  `nearestName`; `dslCard`.

### M03 — Runtime I: character side (v1-core S04 via RECOVERY-04, 23f9918/4ead08b/db7eebb/b961053/d0240e6; profileFromCharacter + sideDefeated in v1-shell; inventory in loot S01; equipment in equipment-consumables S03/S05; speed in grid-movement S03; spells + feats in spells-in-combat S02/S03; feat slots in feat-progression S02)

- `src/runtime/errors.ts` — `RuntimeRuleError extends Error` carrying `readonly errors: readonly
  ErrorCard[]`; load failures remain PackLoadError (FR-2); `ruleCard(...)`. Runtime rule ids are
  engine-named strings — distinct from the DB E-* registry.
- `Runtime(pack)` — validates with the real checker, fails closed on reserved hp/ac formulas
  (CA-6), indexes artifacts, compiles effect/formula/attackBonus ASTs once (CA-2). grid-combat
  S03 added `PackIndex.validAsts` (parse-once `valid` ASTs, skip-undefined) and
  `Runtime.spatial: SpatialGeometry` built once at load (`spatialFromPack(pack)`).
- `Character` facade: state, derived(rng?), spend, prepare, cast, applyCondition, removeCondition,
  applyTheme, removeTheme, rest, tick — plus loot S01's `grant(itemId, qty?)`, `drop`,
  `count`, `loot(tableId, opts?)` one-to-one delegates over `src/runtime/inventory.ts`.
- `events.ts` (CA-3): `RuntimeEvent = {type, at, actor?, target?, payload, why:{rule, rolls}}`;
  `EventStream` emit/on/off/sinceRound/setClock (host-owned clock); named non-combat events
  (character:created, xp:awarded, level:reached, condition:applied/removed, pool:drained,
  spell:prepared/cast, rest:completed — loot S01 added character-side `item:granted`,
  `item:dropped`, `loot:rolled`; the envelope itself unchanged).
- `CharacterState`: plain JSON incl. per-class `classXp`; `slots` `(string|null)[]`; loot S01
  added `inventory: InventoryEntry[]` (`{id, qty}`, qty ≥ 1), initialized `[]`.
- Progression: shared build validator; race caps; `tables.xp` or documented fallback; even XP
  split; best-of saves; additive slots; tableLevelCeiling clamp. Since feat-progression S02 ck2
  (`a32ded2`): `validateBuild(runtime, race, entries, heldFeats = [])` adds one
  `feat-slots-exceeded` card (`'(character)'`) when the pack is feat-slotted, the build produced no
  other card and the held feats outnumber the slots. `levelSet` passes `character.feats`, restore
  passes `saved.feats ?? []`, and `createCharacter` passes nothing. `awardXp` is **compute → check
  → apply**: it derives each class's `classXp` and level into locals, runs the slot check, and only
  then mutates and emits. Event order and payloads are unchanged; a side effect is that an
  `invalid-xp-table` refusal also changes nothing (F-P4).
- Restricts matcher: `matchesRestriction(pattern, kind, tags, declaredTags)` — exact
  `actions.tagged:`/`spells.tagged:` prefix, tag must be pack-declared; `isLivePattern(runtime,
  pattern)`; `declaredTags(runtime)`. Out of combat `isRestricted`/`restrictedIds` use it
  kind-exact. **Since spells-in-combat S02 ck1** combat's `restrictionRejection` calls the exported
  `matchesRestriction` + `declaredTags` (kind `'action'` for every declare, plus `'spell'` for a
  spell declare, DD-S10) and the inline actions-only duplicate is gone; `isLivePattern` still has
  no non-test consumer (cleanup C1).
- Dependency direction: runtime → {schema, core} only; no compiler import.

v1-shell added `src/runtime/character-profile.ts` (CA-08): `profileFromCharacter(rt, character,
id?)` → `{profile, balances}` — current hp, `derived()` ac/attack bonus, the pack's `initiative`
formula, the union of the character's class `actions` (pack v1.2 `content.classes.<id>.actions`),
pool points + bound spell slots; a class with no actions cannot fight (`no-combat-actions`).
`combat.sideDefeated` (D-26): `defeatedSide(combatants)` is consulted after every resolution in
`combat.ts`; a fully-downed side ends the fight — `phase: 'combat-over'`, one `combat:ended`
event naming `{winner, defeated}`, downed combatants skip turns and get no trigger offers, and a
terminal snapshot restores as `combat-over` (snapshots.ts reads the same `defeatedSide`).

equipment-consumables S05 (`14c01dc`, `31540b0`): `profileFromCharacter` composes over
`equipmentView` — abilities/saves are the view's (grants added), the initiative base is
`{...view.abilities, ...view.saves, level, ...view.gear}`, `profile.maxHp = derived().hp`, and
`balances.items` = held qty of every consumable in `runtime.index.itemEffects`.
**`settleItemUses(runtime, character, fight, combatantId?)`** — the host-called inverse of
`profileFromCharacter`: requires `combat-over` (else `combat-not-over`), pre-checks everything
first (held ≥ used; the drop guard via the pure `equippedUnits`), then `dropItem`s the used
units, emits `item:settled`, and zeroes that combatant's `itemsUsed` (a second call on the same
live fight returns `[]`; a pre-settlement snapshot restored and settled again drops twice — the
documented R-4 limit). An unknown `combatantId` is refused `unknown-target`.

grid-movement S03: `profileFromCharacter` emits `speed` (the reserved formula over the same
scope) only when `formulas.speed` is declared; `useItem` binds the `speed` effect scalar
(`scopedFormula(runtime, 'speed', scope)` when declared, else 0 — F-P5).

spells-in-combat S02 ck3/ck4 (`9ec0410`, `45c6fce`): `profileFromCharacter` also emits
`profile.spells` (= `knownSpells`, only when non-empty), `profile.castBlockedBy` (the item id
from the now-exported `pools.ts` `armorBlockingCast`, only when armor blocks) and
`balances.bindings` (a deep copy of `state.slots`); S03 ck2 adds `profile.feats` (held feats that
declare a `trigger`, only when non-empty). **`settleSpellCasts(runtime, character, fight,
combatantId?)`** — the spell twin of `settleItemUses`: `combat-not-over` / `unknown-target`
preconditions; every refusal before any change (`unknown-pool`, `insufficient-points`,
`slot-mismatch`, `slot-unmapped`); then `pools[p] -= spent` with `pool:settled {combatantId, pool,
amount}` (why `pools.<p>`) and `slots[L][i] = null` with `slot:settled {combatantId, slotLevel,
slotIndex, spellId}` (why `content.spells`); clears the combatant's spend (a second call returns
`[]`; same R-4 limit). `poolsSpent` records **every** points cost, actions included, so action
pool spends settle and survive restore too.

**`src/runtime/feats.ts`** (spells-in-combat S03 ck2 `e5e1a55`) — a runtime leaf (value-imports
only `./errors`): `learnFeat(runtime, character, featId)` refuses `unknown-feat` / `feat-known`
(RuntimeRuleError, nothing changes), appends to `CharacterState.feats?` (absent until the first
learn — the `equipped` presence rule) and emits `feat:learned {featId}` (`why.rule`
`content.feats.<id>`). Facade `Character.learnFeat(featId)`. `runtime.ts` `PackIndex.featEffects`
holds the parse-once ASTs of feats that declare `effect`. **Feat slots (feat-progression S02 ck2
`a32ded2`, DD-F2/F3/F6):** `featSlotTally(runtime, classes)` returns `undefined` when no
progression entry declares `featSlots` (no cap). Otherwise it returns `{total, hint}`: the sum of
`featSlots[level - 1]` over the classes (0 for a class without the field) and a hint like
`warden 1 → 1, hexer 1 → 0`. `featSlotsExceeded(artifactId, held, tally)` builds the
`feat-slots-exceeded` card at `feats`. `learnFeat` refuses it after `unknown-feat`/`feat-known`
when `held + 1 > total` (RuntimeRuleError, nothing changes). These are module exports, not barrel
exports (DD-F7), and `progression.ts` consumes them. `feats.ts` is still a leaf: its new
`ErrorCard` import is `import type`.

### M03 — Combat engine (v1-core S05, 6efaa16/c7a2d44/6afbe31/4be9e6c; spatial integration in grid-combat S03; item use in equipment-consumables S05; movement in grid-movement S03; spells + feats in spells-in-combat S02/S03; self actions in action-targeting S02)

- `combat/action-economy.ts` (CA-4) — `resolveSlotGrants(pack)` (declared `economy.turnSlots`
  authority; absent → documented default 1-of-each-cost-slot-name); `checkCost`; per-turn
  `SlotLedger` transients (`freshLedger/replenish/spend/refund`; never character state).
  equipment-consumables S05: `EconomyBalances.items?` — host-stated item charges, like
  `pools`/`boundSlots`. spells-in-combat S02: `EconomyBalances.bindings?` — the character's
  `slots` at fight start, consumed by spell casts.
- `combat/resolve.ts` (FR-3) — `checkPackDsl` (load-time check; parse-once lives in `PackIndex`, and
  `parsePackEffects` was deleted in spells-in-combat S02);
  `profileFromStatblock` — the one combatant constructor for characters and monsters;
  `attackBonusAgainst` (`byDefense[String(v)]` literal lookup); `attackRoll` (verdict-attached);
  `executeAgainst` (per-target vars, ordered roll history for `why.rolls`). grid-combat S03
  added the optional 6th param `resolveShapeTargets?: (shape) => readonly string[]` — the CA-G4
  edge replacing the bound-target `resolveTargets` stub; combat injects it per execution.
  equipment-consumables S05: `CombatantProfile.maxHp?` (the heal cap; `profileFromStatblock`
  sets it to the evaluated `hp`); `checkPackDsl` also checks `content.items.<id>.use` as an
  effect (R-7). grid-movement S03: `CombatantProfile.speed?` (only when `formulas.speed` is
  declared; `profileFromStatblock` evaluates it like `initiative`); `executeAgainst(…,
  resolveShapeTargets?, move?)` — `move` becomes `apply.move`; `effectVars(actor, target)` builds
  the executor's per-target vars (`speed` = `profile.speed ?? 0`; intra-runtime export, not in
  the barrel). spells-in-combat: `CombatantProfile.spells?`, `castBlockedBy?` (S02) and `feats?`
  (S03); `executeAgainst(…, resolveShapeTargets?, move?, profileFor?)` always supplies
  `apply.varsFor = effectVars(actor, profileFor(id))` (an unresolvable id falls back to the bound
  target's vars, so callers without `profileFor` see identical values). action-targeting S03 ck1:
  `effectVars` also binds `ability:<n>` from `actor.abilities` (the equipment-composed combat
  profile), after the target-save layer — never shadowed, never the target's; `executeAgainst`,
  `varsFor` and the movement gate all see it.
- `combat/combat.ts` (FR-10/13) — `startCombat(runtime, {allies, enemies, rng?})`; `Combat`
  `step()/declare()/respond()/serialize()/eventsSince()/roundComplete`; initiative from the
  reserved formula or d20 fallback (CA-6); events emitted as CA-3 rows only; `displayRoll` =
  combat-loop.html roll anatomy. Declare gates ordered: no-action → not-yours → restricts →
  target → cost → spend. v1.6 spells: membership → restricts (both kinds) → `at` legality →
  target (any combatant) → range → armor → cost → binding pick → spend. v1.7 self actions:
  restricts → (`at` refusal) → self `targetId` refusal → validity → cost → spend (no target
  resolution, no reach gate). grid-combat S03 integrated the spatial layer: `StartCombatRequest
  .positions?: Readonly<Record<string, Position>>`, `CombatantState.position?` (plain JSON,
  emitted only when set), the **reach gate** (`checkReach` wired at declare and
  `resolveReactive`, rejections exactly `kind: 'spatial'`, `rule: 'E-SPAT-01'`), the declare-time
  **validity gate** (`evalValidity` over `Runtime.index.validAsts`, rejections `kind: 'valid'`,
  `rule: 'E-REF-01'`), gate order validity → spatial → cost (source comment), **fail-closed
  `startCombat`** (one E-SPAT-01 card per missing combatant on a spatial pack, aggregate, nothing
  built), and `restore` refusals (E-SPAT-01, artifactId `(snapshot)`, jsonPath
  `restore.<id>.position`, all cards before any rebuild). `combat.sideDefeated` ends fights.
  equipment-consumables S05: `CombatantState.maxHp` (`profile.maxHp ?? max(0, profile.hp)`),
  `itemBalances` (fixed for the fight) and `itemsUsed` (spent; remaining = balance − used);
  **`Combat.use(itemId, {target?})`** — gate 0 is `declare`'s rule (`combat-over` throws, no
  event; the user is the active combatant), then `unknown-item → not-consumable → restriction
  (synthetic item-only action) → unknown-target → no-charges`, each rejection one
  `declare:rejected` event; success emits `item:used {itemId, remaining}` and runs the effect
  with `why.rule: content.items.<id>`; it consumes no slot and does not end the turn. The private
  `resolve` is split into a shared `execute` used by `declare`, `respond` and `use`.
  `applyMutation` applies the R-2 heal rule to negative-amount damage with `hpBefore` captured
  before the mutation; heal rolls render through the unchanged `displayRoll` as negative faces
  (`d6[-4]-2=-6`). The restriction gate on `use` cannot currently block: `ItemDef` has no
  `tags` (recorded, not a defect).
  grid-movement S03 added the **move column**: `DeclareOptions.to?: Position`,
  `StartCombatRequest.terrain?`, `CombatState.terrain: readonly TerrainCell[]` (`[]` when none;
  every `serialize()` carries it), `CombatantState.speed?` and `pendingMove?` (`PendingMove
  {actionId, to, remaining}`). A move action (one whose effect is a root `move`) targets its
  actor and skips the reach gate; its **movement gate** runs where the reach gate runs (after
  validity, before cost), plans with `findPath` against current occupancy and terrain, and
  rejects with a `MoveRejection` (`no-destination`/`blocked`/`occupied`/`unreachable`/
  `out-of-range`, rule E-SPAT-01, nothing changed; a positionless spatial mover is the existing
  kind `spatial`). The walk emits `move:advanced {from, to, path, cost, remaining}` per
  contiguous segment and `move:ended {reason: arrived|downed|restricted|blocked|forfeited, at}`,
  all with `why.rule = actions.<moveId>`. Before each step that leaves a standing opponent's
  reach it emits **`move:leaving-reach`** (actor mover, target threatener, `{at, next}`); if any
  offer surfaces, the move pauses with `pendingMove`. `respond()` resumes the move when the
  offer queue empties (a refused take counts as answered) and re-checks downed → restricted →
  re-plan (`blocked` when no path); the resumed first step skips the leaving-reach check
  (R-GM-3). `step()` while paused emits `move:ended {forfeited}` before `turn:ended`. startCombat's
  E-SPAT-01 aggregate also carries terrain refusals (unknown kind `terrain[i].kind`, duplicate cell
  `terrain[i].at`, combatant on a blocking cell `positions.<id>`). In a theater-of-mind pack a move
  is a no-op success (`to` ignored; only `action:resolved`). **Offer surfacing is per call (F-P1,
  DD-M10):** `declare`/`respond` still *return* the round window, but `declare` and the reactive
  resolution behind `respond(…, 'take')` collect their own events with a per-call sink
  (`collect()`, the `execute()` idiom) and feed only those to `surfaceOffers`; `use` already
  surfaced per call; `surfaceOffers` skips any event already surfaced (a facade-side
  `WeakSet<RuntimeEvent>`, not combat state), so each (reactor, event) pair is offered exactly
  once, and offers raised inside a walk surface when raised. Offers are not filtered by
  affordability: a spent-reaction take yields one `declare:rejected {slot-exhausted, reaction}`,
  E-ECON-01. `respond(…, 'decline')` now calls `setClock()` first (restored-fight stamping fix,
  S03 ck4). Intra-runtime helper exports `copyTerrain`, `terrainRefusals`, `moveBudgetAst`
  (consumed by `snapshots.ts`) stay out of the barrel. `displayRoll` moved to the
  `display-roll.ts` leaf and is re-exported from `combat.ts` so the barrel path is unchanged.
  **The spell column (spells-in-combat S02):** `declare(id)` resolves `pack.actions[id]`, else
  `pack.content.spells[id]` as a bound action `{cost, effect, tags}` with AST
  `index.spellEffects[id]` and rule base `content.spells.<id>`; the spell gate order is the
  v1.6 list above (membership `no-action` "does not know spell" → restricts → `at` legality
  `invalid-target` → target, any combatant → **range gate** `{kind: 'out-of-range', rule:
  'E-SPAT-01', resource: targetId | "x,y"}`, `targeting.range ?? max(reachOf ?? default,
  default)`, never consulted in theater packs → `armor-not-castable` (E-REF-01, vancian only) →
  `checkCost` → the binding pick (DD-S18, `E-VANC-01`) → `spend` → `applyNonSlotCosts`). Events:
  `spell:cast {spellId, targetId|at, cost, slotLevel?, slotIndex?, pool?, amount?}` → effect events
  → `action:resolved {actionId, targetId}` or `{actionId, at}`. `DeclareOptions.at?: Position` is
  a burst center (spatial packs; theater packs drop it); `resolveShape(shape, actor, center,
  bound)` resolves bursts around the bound target's position or the `at` cell, and every execute
  passes `profileFor` (DD-S19). `CombatantState` gains `spells`, `bindings?`, `slotsCast` and
  `poolsSpent` (both `{}` at start), `castBlockedBy?` and (S03) `feats?` (present only when
  non-empty, built by `combatantFeats(profile)` in `startCombat` and `deserializeCombat`); the
  intra-runtime helpers `copyBindings`/`combatantFeats` are consumed by `snapshots.ts`, not the
  barrel. **The feat column (S03 ck3 `8d04c5e`):** `PendingTrigger.source: 'action' | 'feat'`
  (required; a feat offer's `actionId` names the feat); `respond(…, 'take')` on a feat runs
  `resolveFeat` — a `targetId` other than the holder is `invalid-target` (the offer still leaves
  the queue); otherwise the parse-once feat effect runs on the holder with no cost, restriction or
  reach gate, `why.rule` `content.feats.<id>`, phase unchanged, then `surfaceOffers(emitted,
  {feats: false})` — the no-chain rule. **The offer counter (S03 ck4 `c6128bd`):** `new
  Combat(runtime, state, rng?, {offeredCount?})` resumes the counter (absent = 0) and the read-only
  getter `Combat.offeredCount` is the next `trigger:fired.offerIndex` (R-GM-1 closed).
  **Self actions (action-targeting S02 ck1 `63f6e78`, CA-A1/A2):** `resolveShape('self', …)`
  returns `[actor.id]` before the theater-of-mind early return, so the executor's
  `resolveTargets`, `hasTarget(self)` and nested `target(self, …)` see the actor in every pack.
  The exported **`isSelfAction(runtime, actionId)`** (beside `moveBudgetAst`; intra-runtime, not in
  the barrel) is true when `index.actionEffects[actionId]`'s root is `target(self, …)` — it reads
  the action index only, so spells never qualify. `declare` (actions only) and `resolveReactive`
  bind the actor/reactor as the target and skip `resolveTarget` and the reach gate; a foreign
  `targetId` yields `declare:rejected {kind: 'invalid-target', rule: 'E-REF-01', resource:
  targetId}` from the private `selfTargetRefusal`, with nothing changed. `resolveReactive` now ends
  in the private `resolveReactiveAgainst` (shared cost gate, spend and resolve). Proven by
  `tests/runtime/combat/self-target.test.ts` (12) and the self-target journey (M05).
- `combat/spatial.ts` (FR-11) — `theaterOfMind` no-op; `gridGeometry` (Chebyshev, reach, burst);
  grid-combat S03 reshaped the pack edge: `spatialFromPack` reads the v1.3 contract shape
  (`{model:'grid', reach:{default, <label>:n}, shapes?}`) into the internal `SpatialModel`
  `{defaultReach, reachOverrides}` (internal signature unchanged; only the pack-reading edge
  adapts, CA-G1); new export `packSpatialModel(pack: { spatial?: SpatialDef }): SpatialModel |
  undefined` — the typed adapter combat consumes (`undefined` = theater of mind; accepted as a
  structural input, since a nominal `Pack` signature would reject `spatialFromPack`'s input);
  `SpatialRejection.pendingId` → `rule: 'E-SPAT-01'` (registered id, CA-G2; zero remnants).
  One shape resolver (`resolveShape`) with three consumers: the executor's
  `EffectApply.resolveTargets`, `hasTarget(…)` validity evaluation, `target()`; bursts are
  side-blind around the declared target; theater-of-mind answers every shape with the bound
  targets and never rejects. grid-movement S03: **`hexGeometry(model)`** (axial; `canReach` keeps
  `≤ max(reach, defaultReach)`, DD-M14/F-M2), `SpatialGeometry.model?` and
  `SpatialGeometry.neighbors(p)` (grid: 8, counter-clockwise from east; hex: the pinned 6;
  theater: `[]`); `spatialFromPack` dispatches on `spatial.model`; `TerrainCell {at, kind}`,
  `terrainAt(vocabulary, cells)`, `entryCost(kind)`; **`findPath(geometry, query)`** —
  region-bounded exact Dijkstra (DD-M18), failure kinds `blocked` → `occupied` → `unreachable` →
  `out-of-range {cost}`; a reachable destination is never `unreachable` (F-P9).
- `display-roll.ts` (grid-movement S03 ck5, `27c77f4`) — the one roll-display rule (FR-13
  `why.rolls`); a runtime leaf importing only `core/dice` types, consumed by `combat/combat.ts`
  and `equipment.ts` (retires equipment's private `rollText`; `equipment.test.ts` kept green).
- `combat/triggers.ts` (FR-4/13) — pattern grammar `<type>` or `<type>[target|actor=self|<id>]`
  (the grammar `TRIGGER_PATTERN` enforces at load); `offersForEvent(runtime, combatants, event,
  {feats?})` returns every action offer, then every feat offer (new `reactiveFeatsFor`) unless
  `feats: false`; `trigger:fired {triggerId, actionId, source, on, offerIndex}` and
  `trigger:declined {triggerId, actionId, source, on}`, `why.rule` `actions.<id>.trigger` or
  `content.feats.<id>.trigger`; taken action triggers ride the same pipeline as declares. **Edge note
  (corrected at the grid-combat pass):** `triggers.ts → combat.ts` is type-only, not a value-import cycle.
- `bestiary.ts` — `spawnMonster`/`bestiaryIds` via the same `profileFromStatblock`. `encounter.ts`
  (FR-16) — `assembleEncounter` heuristic `threat-weighted-uniform`; `spawnEncounter`.
- First narrow journey (v1-core S05 ck2): fixture pack → validatePack(+packDslChecker) → Runtime
  → stepwise combat → damage:applied with `why:{rule,rolls}` — superseded as the integration
  proof by the loot and grid journeys below (all still green).

### M03 — Inventory (loot-inventory S01, 24b37c1/db531d5)

`src/runtime/inventory.ts` — CAP-01/CA-02 producer. Verbs `grantItem`, `dropItem`, `countItem`,
`rollLoot`, `grantLoot`, type `LootOptions` (barrel re-export landed in the same lease). Verb
discipline mirrors `pools.ts` (named `ruleCard` rejections → mutate `state.inventory` in place →
one provenanced event); loot shape mirrors `conditions.ts` (`unknown-table`,
`loot-grants-nothing`). Rolls through the one core table engine (`rollTable`, Custom Rule 3) with
`grantLoot`'s normalized dual-space nested resolver (bare-id theme-space refs +
`tables.`-prefixed pack-space refs). Failed roll outcomes (`TableOutcome.ok === false`) map to
named rejections: `unresolvable-ref` verbatim; `range-gap`/`depth-exceeded`/`malformed-entries`
→ `table-roll-failed` naming the core reason. No ambient entropy: `opts.rng` wins, else
`new Rng(opts.seed ?? tableId)`. Snapshots: `serializeCharacterState`/`restoreCharacterState`
carry `state.inventory` verbatim (fresh copies both ways; no pack cross-validation on the load
path — CA-01). Realized edges: `runtime/index.ts → ./inventory` (barrel),
`character.ts → ./inventory` (facade value import); `inventory.ts → ./character` is **type-only**
— excluded from realized edges.

### M03 — Equipment (equipment-consumables S03, 09fb6a7/8dcfe41/960ee39/d9f2be6)

`src/runtime/equipment.ts` — a **runtime leaf** (R-11): value imports only
`../core/{dsl/effect,dsl/formula,rng}`, `./errors`, `./conditions` and (since grid-movement) the
`./display-roll` leaf; `./runtime`, `./character`,
`./events` and `../core/dice` are type-only. The one composition site for grants (CA-EG2) and the
one equipped-unit rule (R-5). Exports: `equippedUnits(state, itemId)` (pure; shared by
`dropItem`, `equipItem`, `useItem` and settlement), `equippedGrants`, `equipmentView(runtime,
state) → {abilities, saves, gear}` (`gear` holds exactly the four `EQUIPMENT_SCALARS` keys, 0
when nothing is equipped), `equipmentScope(view, level) → {...abilities, level, ...gear}`,
`equipItem` (`item:equipped`), `unequipItem` (`not-equipped`; `item:unequipped`), `useItem`
(rejections `unknown-item → not-consumable → item-not-held → insufficient-qty → item-equipped`;
consumes one unit — the last unit removes the entry — then emits `item:used {itemId, remaining}`
followed by the effect's events; heal cap = the pack `hp` formula over `equipmentScope` with
`Rng(0)`, equal to `derived().hp`; condition effects route through `applyCondition`), types
`EquippedEntry`, `EquipmentView`, `UseItemOptions {seed?, rng?}`. Equipping never heals;
unequipping never clamps.

Consumer changes in the same session: `CharacterState.equipped?` (absent until first equip; an
emptied array stays `[]`); `derived()` composes over `equipmentView`; `formulaValue(…, rng,
gear?)` / `reserveValue(…, rng, gear?)` gain the optional trailing `gear` (build/level-set/restore
pass nothing, so hp initialization stays at base); the `Character` facade gains
`equip`/`unequip`/`useItem`; `pools.ts` `castSpell` gains the **`armor-not-castable`** gate
(`armorBlockingCast`, after `unknown-spell`, before the slot lookup — CA-EG3) and `rest` evaluates
pool caps over the view; `inventory.ts` `dropItem` refuses `item-equipped` when `held − qty <
equippedUnits`; `runtime.ts` `PackIndex.itemEffects` (only items declaring `use`, parsed once).
`why.rolls` strings come from `displayRoll` in the `display-roll.ts` leaf (grid-movement S03
ck5); the private `rollText` copy (C8) is gone. `useItem` binds `speed` (grid-movement, above)
and, since action-targeting S03 ck1, `ability:<n>` from `view.abilities` (equipment-composed).

### M03/M05 — Snapshots + root surface (v1-core S06, f1af841/9e18ee2/daac7b7/a6d89ff/bb01e92; positions in grid-combat S03; sideDefeated in v1-shell; terrain + paused moves in grid-movement S03; spend, feats and the envelope in spells-in-combat S02/S03; the feat-slot restore refusal in feat-progression S02)

- `src/runtime/snapshots.ts` (M03): FR-14 serializers `serializeCharacter/serializeParty/
  serializeCombat` + loud-refusal loaders `restoreCharacter/restoreParty/deserializeCombat`;
  types incl. `CombatRestoreRequest`. grid-combat S03: `SnapshotCombatant.position?: Position`
  (precise `{x,y}`, emitted only when set, never null); `CombatRestoreRequest.positions?`;
  restore rebuilds gates against restored positions and refuses positionless combatants on a
  spatial pack. v1-shell: terminal snapshots restore as `combat-over`. equipment-consumables
  S05 (`4bfcec4`): `SnapshotCharacterState.equipped?` (new exported `SnapshotEquippedEntry
  {slot, itemId}`; emitted only when state carries it; restore refuses unknown item/slot,
  ineligible slot, a slot equipped twice, or more equipped units than held — E-SNAP-01, every
  card before any application); `SnapshotCombatant.itemsUsed?` (spent, emitted when non-empty;
  unknown id or over-spend vs the re-stated `balances.items` → E-SNAP-01) and `maxHp?` (always
  emitted; restore precedence snapshot → `profile.maxHp` → `max(0, profile.hp)`). Inventory
  restore stays verbatim (CA-01 divergence). grid-movement S03 (`e5546bb`, `dd88f0c`):
  `CombatRestoreRequest.terrain?` (host re-states; startCombat's refusals at
  `restore.terrain[i].kind|at`, `restore.<id>.position`); `SnapshotCombatant.pendingMove?`
  (emitted only when set; unknown or non-move `actionId` → E-SNAP-01 at
  `combatants[i].pendingMove.actionId`). A restored offer's `matchingEvent` is the pattern's
  event type (base before `[`), matching live offers.
  spells-in-combat S02 ck4 (`45c6fce`): `SnapshotCombatant.poolsSpent?` / `slotsCast?` (emitted
  only when non-empty). Restore: `pools = re-stated − poolsSpent`, `boundSlots[L] = re-stated −
  |slotsCast[L]|`, bindings/spells/castBlockedBy re-stated, spends copied; E-SNAP-01 refusals at
  `combatants[i].poolsSpent.<p>` / `combatants[i].slotsCast.<L>[k]` (unknown pool, over-spend, a
  level with no re-stated slots, an index out of range or bound to `null`, a duplicate index), all
  before any rebuild (fixes the latent v1.5 loss of pool/vancian spend on restore). S03 ck2: the
  character snapshot carries `feats` only when present; restore refuses an unknown feat id
  (E-SNAP-01 at `<path>.feats[i]`). feat-progression S02 ck2 (`a32ded2`): `characterStateRefusals`
  passes `saved.feats ?? []` to `validateBuild`, so `restoreCharacter` and `restoreParty` refuse an
  over-cap character with `feat-slots-exceeded` at `feats`. The held count includes unknown ids,
  and the unknown-id E-SNAP-01 card may appear beside it. Every card is returned at once and
  nothing is minted (`nextCharacterId` unchanged). **S03 ck4 (`c6128bd`) — the envelope (DD-S14):**
  `CombatSnapshot.phase?`, `offeredCount?` and `offers?: SnapshotOffer[]` (`{actorId, source, id,
  on}`); `serializeCombat` always writes `phase` and `offeredCount`, writes `offers` (every open
  offer in queue order, actions and feats) only when non-empty, and no longer writes the
  per-combatant `pendingTrigger` (read on restore, never written). **Restore phase precedence:**
  frozen hp defeating a side → `combat-over`; else the envelope `phase`; else the v1.5
  derivation (`resolved` if any combatant carries `pendingMove`/`pendingTrigger` or the envelope
  carries `offers`, else `awaiting-declare`). So a snapshot taken after a declare restores as the
  live `resolved` and a `use`-raised offer as the live `awaiting-declare` (R-GM-2 closed), and the
  counter continues from `offeredCount` (R-GM-1 closed). New E-SNAP-01 refusals, collected with
  the others: `offers` beside a `pendingTrigger`; a malformed offer; an `actorId` not in the
  order; an `id` that is not a reactive action/feat of that actor for its `source`; a non-enum
  `phase`; `phase` `combat-over` while no side is defeated; an `offeredCount` that is not an
  integer ≥ 0.
- Envelopes are snapshots.schema.json verbatim (`additionalProperties: false`); field mapping:
  classXp→classes[].xp, spells→knownSpells, conditions {id, remaining}, bindings slots, pools,
  inventory []. Load discipline (CA-1): identity gate BEFORE any application (kind + pack.id +
  schemaVersion + contentHash → E-SNAP-01; snapshotVersion ≠ 1 → E-SNAP-02); no state mutated on
  refusal. Combat restore takes the sides/profiles explicitly (`CombatRestoreRequest`).
- M05 `src/index.ts`: dumb `export *` from './schema' | './runtime' | './compiler'.

### M04 — Compiler + themes (v1-core S07, 116fc7e/01af260/786923b/1676c42/5d30d2f/3faf836; items+wyldwood in loot S02; spatial pass-through in grid-combat S04; equipSlots + equipment content in equipment-consumables S04; movement content in grid-movement S04; spell cost/range + feat patterns in spells-in-combat S02/S03; self-wrapped actions, med-kit and spell lists in action-targeting S02/S03; feat slots in feat-progression S02)

Module `src/compiler/` — imports only `../schema` + `../core` (no runtime import). Zero I/O.

- `stage.ts` — `Stage = {name, run(ctx)}`; `GenerationContext` purity asserted by key-spy test.
- `rng-stream.ts` — `stageRng(seed, stageName)`; per-stage streams independent (content-hash
  invariance under an interleaved probe stage).
- `knobs.ts` (FR-18) — knobs as theme-declared object map; `listThemeKnobs`; `resolveKnobs`
  validates caller values; `#knob/<id>` tokens substitute into stage inputs (grid-combat S04
  note: tokens stringify values — see DD15).
- `theme.ts` — `ThemeTemplate`: partial pack keyed like pack sections; base+patches (FR-20).
  grid-combat S04: `ThemeTemplate.spatial?: SpatialDef` (the same type the pack carries —
  imported from `../schema/pack`, no theme-side renaming; after `economy?`).
  equipment-consumables S04: `ThemeTemplate.equipSlots?: readonly string[]` (section-keyed like
  the pack root).
- `pipeline.ts` — `STAGE_ORDER = [stats, skills, feats, classes, magic, bestiary, tables]`;
  stage 8 = `schema.validatePack` + `packDslChecker` (CA-1 dogfood gate, NOT a replaceable
  Stage); manifest first (provenance exactly {theme, seed, knobs}); undeclared knob token →
  located E-SCHEMA-01; any card aggregates into `GenerationError`. grid-combat S04:
  `STAGE_INPUT_SECTIONS` gains `'spatial'` after `'economy'` (knob tokens resolve inside a
  theme's spatial declaration); pass-through after the manifest/formulas seeding
  (`structuredClone(themeView.spatial)` — the theme object is never mutated; absent = no key,
  theater of mind). equipment-consumables S04 (`4749543`): `'equipSlots'` joins
  `STAGE_INPUT_SECTIONS` after `'spatial'`, and after the spatial pass-through
  `structuredClone(themeView.equipSlots)` lands in `pack.equipSlots` (absent = no key).
- `stages/*.ts` — stats/skills/feats (≥1 reactive enforced)/classes (progression per class;
  loot-era note: v1.2 class actions ride `content.classes`)/magic/bestiary/tables (every table
  ROLLED through S02 `rollTable` — Custom Rule 3). loot-inventory S02: stage 7 additionally
  contributes `content.items` (guarded like races/conditions; a theme with no items contributes
  nothing) and rejects CA-02-checkable reference defects in `-loot` tables with E-REF-01 theme
  cards (per-table **before** the roll, so the located card wins over the engine's coarser
  E-TBL-01).
- `compose.ts` (FR-20) — `composeTheme(derived, base)`; add/remove/merge at '/'-joined pointers;
  later wins; base read-only hash-proven. `errors.ts` — `GenerationError` carrying ErrorCards,
  theme-relative jsonPath. `generate.ts` — `generateCampaign({theme, seed, knobs?})`,
  synchronous.
- `theme-loader.ts` + theme JSON data imports (typed via `resolveJsonModule`); `index.ts` surface
  as listed above (`loadTheme`/`DARK_FANTASY`/`ZOMBIE_URBAN` at v1-core S08 ck3 — D20; `WYLDWOOD`
  + the third `loadTheme` case at loot S02).
- Themes (three): `dark-fantasy.json` (vancian showcase to the FR-21 floor; Warden descending-AC
  table + Hexer ascending + Crypt Warden multi-class; five named saves; 33 coined spells L1–3;
  main/move/reaction economy; reactive parry/ward-glint; 10 conditions incl. sapped/rooted
  restricts; 4 statblocks; 7 tables incl. ranged xp), `zombie-urban.json` (drain/table showcase;
  adrenaline/stamina drain pools; 4 ritual spells, NO vancian; deliberately omits `economy` —
  the default-grant branch), `wyldwood.json` (loot showcase; charm/ward economy; point-pool
  spells, no vancian; 8 tables incl. the `-loot` chain). All three declare `spatial`
  (grid-combat S04): dark-fantasy `reach: {default: 1, 'barrow-wight': 2}`, zombie-urban
  `{default: 1, 'slab-brute': 2}`, wyldwood `{default: 1, 'hollow-wight': 2}` — each override
  key names a bestiary id that theme declares; `shapes: ['single', 'burst']` by all three.
  equipment-consumables S04 (`926f4c6`/`22fc990`/`90dbfc7`, no new item ids, loot tables
  unchanged): all three reserved formulas read gear — hp `6 + level + vigor * 2 + gear-hp`,
  initiative `d20 + grace + gear-initiative`, ac `12|11 - floor(level / 3) - gear-ac`
  (descending); dark-fantasy `equipSlots [body, main-hand]`, `warded-mail` kind `armor`→`mail`
  `{ac:2, armor:1}`, `oaken-cudgel` `{might:1}` (warden `armorCasting [mail]` casts, hexer
  `[leather]` is blocked); zombie-urban `[body, main-hand]`, `riot-plate` `{ac:1, armor:1}`,
  `fire-axe` `{might:1}`, `med-kit` `use: heal(2 + vigor)` (healed 2 — the vigor **save**
  shadowed the ability in effect scope; since action-targeting S03 ck3 `3cce108` it reads
  `heal(2 + ability(vigor))` and heals 12 at level 1); wyldwood `[charm]`,
  `hedge-charm` `{ac:1, armor:1}` (validation-only: point-pool casting has no gate). Nothing
  equipped ⇒ values byte-identical to pre-v1.4 (docs-run block-03 `hp: 27, ac: 12` unchanged).
  grid-movement S04 (`40c4492`, no compiler source change — `pipeline.ts` passes `spatial` and
  `formulas` verbatim): every theme declares `formulas.speed` (`{expr}` form), a move action (tag
  `move`, cost `{slots:{move:1}}`, effect `move(speed)`) and a leaving-reach reaction (cost
  `{slots:{reaction:1}}`, trigger `move:leaving-reach[target=self]`, effect copied from the
  theme's melee action), appended in that order to **every** class and **every** statblock
  `actions` list, plus a `spatial.terrain` vocabulary: dark-fantasy `stride`/`opportunist`,
  `rubble {cost:2}`/`pillar {blocks:true}`, speed `4 + floor(grace / 4)`, grid; zombie-urban
  `hustle`/`cheap-shot`, `debris`/`barricade-wall`, `4 + floor(vigor / 4)`, grid; wyldwood
  `glide`/`bramble-snap`, `bramble`/`standing-stone`, `5 + floor(grace / 4)`, **hex**. The
  existing `rooted` condition already restricts `actions.tagged:move`. Adding actions consumes no
  generation RNG (README block 03 unchanged).
  spells-in-combat (no compiler source change): S02 ck5 (`ab6d6f6`) gives every bundled spell (47:
  dark-fantasy 33, wyldwood 10, zombie-urban 4) `slots {main: 1, move: 1}` in its cost (DD-S9)
  and `targeting.range: 6` (spells without `targeting` gain `{shape: 'single', range: 6}`); S03
  ck1 (`d9a6d71`) re-keys the five feat triggers `condition:applied[self]` →
  `condition:applied[target=self]` (dark-fantasy :179, zombie-urban :183/:188, wyldwood
  :362/:369) — F-M1 closed. Known content item, carried: 12 spell sites (and the action
  `cold-grip`) have a fail-branch-free `damage(half)` and so deal no damage on a passed save
  (C-S02-1 executor rule).
  action-targeting (no compiler source change): S02 ck2 (`83c7939`) wraps 10 action effects in
  `target(self, …)` — dark-fantasy `withdraw`, `brace`, `ward-glint`; zombie-urban `fall-back`,
  `barricade`, `dodge-roll`, `adrenal-spike`; wyldwood `fall-back`, `circle-path`, `ward-step` (all
  condition-only, no RNG; `gloam-light`, every spell, feat and save/attack action unchanged).
  S03 ck2 (`7c1b8b6`): zombie-urban `medic.spellLists ["medic"]`, `fixer ["fixer"]` (scavenger
  stays `[]`), wyldwood `hedge-mage ["hedge-mage"]` (was `["hedge"]`) — every class list now
  matches a spell and every spell list is drawn by a class (`tests/compiler/spell-lists.test.ts`,
  10). S03 ck3: the med-kit line above. Newly reachable through these lists: the `mending` spells
  (drift notes).
  feat-progression S02 ck3 (`7bf5fa6`, no compiler source change — `stages/classes.ts` copies
  `progression` verbatim): all 9 bundled classes (3 per theme) declare `featSlots [1, 1, 2, 2, 2,
  3, 3, 3, 4, 4]`, so a generated character is capped end to end. Because the themes changed,
  older bundled-pack snapshots already fail the `contentHash` identity gate.
  Byte-identity proofs (CA-5): equal hash + equal bytes, different-seed divergence, in-process
  AND across fresh module loads; no ambient values.
- FR-21 conformance: `tests/compiler/coverage-floor.test.ts` (91 tests since feat-progression S02
  ck3, which added a per-theme `featSlots` floor over every `content.classes` id — the
  `playerClasses` filter would have skipped 3 of 9, F-P2; 88 since spells-in-combat
  S03 ck1, which added a per-theme trigger-grammar check; 85 since
  grid-movement S04, which added a per-theme "v1.5 movement" test; 82 since equipment-consumables S04 — the FR-17/CA-1 generate→validatePack dogfood path sees the spatial
  and equipment sections on all three packs and produces zero cards; CAP-G6/CAP-E6 evidence,
  plus a CA-EG3 content-pairing assertion).

### M05 — Packaging, CI, proofs, docs (v1-core S08, 02752a9/8f67611/9afa86c/32c7ade/d5bacba; v1-shell packaging/docs/CI/coverage; loot S03; grid S05; equipment-consumables S06; grid-movement S04; spells-in-combat S02/S03; action-targeting S02/S03; feat-progression S02)

- Build: `tsup.config.ts` — four per-entry builds (index/schema/runtime/compiler), dual ESM/CJS +
  rolled dts, target es2020; `package.json` exports map covers `.` / `./runtime` / `./schema` /
  `./compiler` (all subpaths resolve from dist; verified fresh this pass — 24 dist files).
- `scripts/check-runtime-isolation.mjs` — the runtime-only bundle is a proof, not a promise
  (greps `dist/runtime.{js,cjs}` for `generateCampaign`; asserts dual ESM/CJS + dts; CI `package`
  job wires it). `scripts/check-security-lint.mjs` — eval/new Function/Math.random/Date.now
  sweep over src/ + dist/.
- v1-shell packaging pass: MIT LICENSE (in `files`), ESLint 8.57 → 10.11 flat config (security
  bans carried verbatim; lint needs Node ≥ 20.19 — CI lint on a dedicated Node 22 job while
  typecheck/tests keep the 18/20/22 matrix), Prettier enforcement (`format`/`format:check` in CI).
- Proof tests under `tests/proofs/`: `rules-are-data.test.ts` (CA-8, FR-12 trio with baseline
  counterfactuals, zero engine diffs, trio typecheck guards), `perf-budget.test.ts` (CI-generous
  budgets; grid-combat S05 added the 10-combatant spatial round-loop budget < 500 ms),
  `loot-journey.test.ts` (loot S03: the built-dist journey — generate wyldwood → validatePack
  re-entry → Runtime → grantLoot twice (stacked) → serialize → restore lossless on a fresh
  Runtime; also proves the two real dist forms of the stage-8 DSL gate), `grid-journey.test.ts`
  (grid S05: the FR-11 journey, below), `equipment-journey.test.ts` (equipment-consumables S06,
  below), `movement-journey.test.ts` (grid-movement S04, below), `spells-journey.test.ts`
  (spells-in-combat S02/S03, below), `self-target-journey.test.ts` (action-targeting S02, below),
  `feat-slots-journey.test.ts` (feat-progression S02, below), `docs-run.test.ts` (NFR-DX made mechanical: executes the
  README's fenced ```ts blocks verbatim AND typechecks them under strict tsc; asserts the
  README's own output lines and the block-count pin; since spells-in-combat S03 ck5 it also
  guards that the README names `settleSpellCasts` and `learnFeat`). `rules-are-data.test.ts`
  proof 3 casts a spell in combat and proof 2 gains a reactive-feat leg (a learned-vs-never-learned
  baseline from pack data only, zero engine diffs).
- `.github/workflows/ci.yml` — matrix Node 18/20/22 × typecheck/lint/test + determinism suites;
  package job (build + isolation + security + proofs); themes job (coverage floor); lint + format
  checks on every push. The browser-mode determinism leg is documented as a v1.1 follow-up (honest
  CI, DOCS-CI-01..03). **Closed (grid-movement S04 ck3, `c23d563`):** the `test`
  job now runs `pnpm build` between typecheck and `pnpm test` (`ci.yml:45`), so the dist-importing
  journeys (`loot-journey`, `equipment-journey`) run on a fresh build in every matrix leg.
- The first narrow **grid journey** (grid-combat S05, `tests/proofs/grid-journey.test.ts`,
  11 tests): generate (dark-fantasy, seed 42) → `new Runtime` (stage-8 load gate) → host
  positions → adjacency reject (serialize-identical no-change) → restore-close distance (the v1
  movement seam) → burst multi-target with mixed per-target save branches (out-of-radius
  untouched) → validity in/out pair → mid-fight snapshot → JSON → restore with gates
  re-enforced → 10-combatant spatial perf budget → seeded two-run determinism (byte-equal) →
  wyldwood theater-parity capstone. No mocked boundary anywhere. Since spells-in-combat S02 the burst is the generated spell itself (`ember-bloom` /
  `ember-halo`) declared through `fight.declare`; the test-setup action (`packWithBurstAction`) is
  deleted.
- The **equipment journey** (equipment-consumables S06 ck1 `dd6557c`,
  `tests/proofs/equipment-journey.test.ts`, 10 tests, every import from `../../dist/*.js`, seed
  42, nothing mocked): dist freshness (new symbols + generated `equipSlots`) → zombie-urban: equip
  `riot-plate`/`fire-axe` (exact ac/might shift) → out-of-combat `med-kit` heal (clamp) →
  `fight.use` (clamp, provenance) → mid-fight snapshot/restore (`itemsUsed`, `maxHp`) →
  `no-charges` → `settleItemUses` (inventory asserted after the fight; second settle `[]`) →
  character snapshot + tamper refusal → dark-fantasy: hexer in leather refused, unequip casts,
  warden casts in mail. Since action-targeting S03 ck3 (`3cce108`) steps 4–5 heal 12 (`-12`,
  `'23→27'`, `'26→27'`) and the journey asserts the profile's `saves.vigor` 0 against
  `abilities.vigor` 10, so the proof tells the save from the ability.
- The **movement journey** (grid-movement S04 ck2 `da9bf03`, `tests/proofs/movement-journey.test.ts`,
  9 tests, generated content on the production path, seeded `Rng`, the only direct state setup a
  rooted-condition push): load (hex, terrain, speed, actions on every class and statblock) → hex
  `glide` around a `standing-stone` wall through `bramble` (cost 4, remaining 1) → the five
  rejection kinds (`serialize()` byte-identical) → leaving reach → offer → pause → JSON snapshot →
  restore on a fresh runtime (phase `resolved`, `matchingEvent` `move:leaving-reach`) → take in
  both fights → resume parity (`trigger:fired` compared without `offerIndex`, R-GM-1) → rooted
  `restricted` → dark-fantasy grid diagonal move with an `opportunist` pause → wyldwood minus
  spatial (no-op) → two-run determinism → a 2v2 that starts apart reaches `combat-over` within
  200 steps (DD16 retired). Negative control: wyldwood switched back to grid fails steps 1–4.
  Since spells-in-combat S03 ck4 its R-GM-1 workaround is gone: it asserts `offerIndex ===
  snap.offeredCount > 0`.
- The **spells journey** (spells-in-combat S02 ck5 `ab6d6f6` + S03 ck5 `5cfad48`,
  `tests/proofs/spells-journey.test.ts`, 5 tests, through `dist/`, generated dark-fantasy seed 42;
  CAP-S4 is the feature's first narrow journey): dist freshness → vancian leg (prepare → profile
  → two enemies, the caster ≥ 3 cells from every burst center → the real `ember-bloom` on a target
  → the named in-between enemy `stride` declares (`step()` never passes a turn) → an empty-cell
  `{at}` blast → snapshot/restore → `combat-over` via the hp-0-via-restore harness, asserted with
  its reason → `settleSpellCasts` → character snapshot shows the slots emptied) → wyldwood pool leg
  (`hexer`/`hex-bolt`) → feat leg (`learnFeat('second-gust')`, hexbound by a wight's `grave-gaze`,
  offer `source: 'feat'` survives save/restore, take puts `braced` on the hexer with no second
  offer, hexbound then blocks `ember-bloom` with nothing spent; negative control without
  `learnFeat` fails) → two-run determinism. Only how the fight ends is harnessed.
- The **self-target journey** (action-targeting S02 ck3 `05d4fbf`,
  `tests/proofs/self-target-journey.test.ts`, 13 tests, through the `src` barrels (DD-A8), generated
  dark-fantasy seed 42, only a seeded `Rng` stands in; the feature's first narrow journey): two
  enemies beyond reach → `withdraw` with no `targetId` lands on the warden (no `declare:rejected`,
  the `move` slot spent, enemies untouched) → `brace` roots the warden and its later `stride` is
  refused by the restriction gate → an enemy attack offers the hexer `ward-glint`, and taking it
  wards the hexer → serialize/deserialize on a fresh `Runtime` keeps the actor's conditions →
  theater leg (`spatial` deleted) → seven content checks across zombie-urban and wyldwood →
  `withdraw {targetId: <enemy>}` is `invalid-target` with state deep-equal. Negative control: 13/13
  fail at `5b4abca`.
- The **feat-slot journey** (feat-progression S02 ck4 `f7f6e88`,
  `tests/proofs/feat-slots-journey.test.ts`, 8 tests, through the `src` barrels; every leg runs on
  `generateCampaign({theme, seed: 42})` and a fresh `Runtime`, with no fixture pack; CAP-F5, the
  feature's first narrow journey): load (every class carries `featSlots`) → a level-1 warden learns
  one feat and the second is refused with nothing changed → `levelSet` up opens a slot, while
  `levelSet` down and an `awardXp` that lowers the level (F-FP1) are refused → multi-class warden 1 +
  hexer 1 holds two → JSON snapshot round trip, with an over-cap character and party member refused
  → zombie-urban and wyldwood, every class → an unslotted control (`featSlots` stripped) learns all
  4 feats. Negative control (worker-reported): with `learnFeat`'s check removed, legs 2, 6 and 8
  (×2) fail.
- README: quickstart blocks 01–04 (generate / character / one combat round / loot) — block 03
  passes host-declared `positions` (grid S05; `d20[9]=9 < ac12` unchanged — positions consume no
  RNG, proved by run); block 04 loot (observed `[{ id: 'grave-ward', qty: 1 }]`). A **Grid
  combat** section documents the FR-11 opt-in (```json spatial snippet, Chebyshev mechanics,
  E-SPAT-01, burst semantics, vancian vs pool casting, the no-move-verb/FR-10 restore seam, the
  journey cited for NFR-DX). v1-shell documented `pnpm test --coverage` and the honest CI claims.
  equipment-consumables S06 ck2 (`e5e4846`) added an **Equipment & consumables** section (a
  ```json content excerpt and a plain-fenced expected-output block — no new ```ts block, so the
  docs-run pin stays at 4) documenting slots, grants/`gear-*`, heal clamp, armorCasting's
  slot-only scope, `fight.use`, the R-4 settle-once limit, and the med-kit save-shadowing. grid-movement S04 ck3 (`c23d563`) replaced the
  "no move verb in v1" paragraph with a **Movement, hex and terrain** subsection (move actions as
  pack data, `speed`, `declare(id, {to})`, grid vs hex, host-placed terrain and refusals,
  occupancy, the five E-SPAT-01 kinds, leaving reach with pause/resume/forfeit, `pendingMove` and
  the derived restore phase; the restore-with-positions seam kept as the host's teleport; the
  movement journey cited) — still exactly 4 ```ts blocks. spells-in-combat S03 ck5 (`5cfad48`) added
  a **Spells and feats in combat** section (after Grid combat; a ```text event-stream sample
  copied from a run of the built package) and updated the `profileFromCharacter` bullet, the Grid
  combat burst prose (`fight.declare('ember-bloom', {targetId})`) and the armorCasting bullet
  (point-pool spells are cast in combat and never armor-gated) — still 4 ```ts blocks.
  action-targeting S02 ck3 (`05d4fbf`) added one prose paragraph on self actions (after the
  burst-spell paragraph); S03 ck3 (`3cce108`) rewrote the med-kit JSON line, prose ("heals 12") and
  expected-output lines, added an `ability(name)` sentence to the Consumables bullet, and corrected
  the line that said zombie-urban's classes know no spells — still 4 ```ts blocks.
  feat-progression S02 ck3 (`7bf5fa6`) added a **Feat slots** bullet after the Feats bullet and
  replaced "v1 limits: there is no feat-slot cap" with "The feat-slot cap is pack data …" (prose
  only — still 4 ```ts blocks, and `learnFeat` is still named).
- Full gates at feat-progression close (Orchestrator receive at `f7f6e88`): typecheck 0; lint 0;
  format:check 0; build 0; isolation 0; security 0; `pnpm test` **911/911 across 49 files**.
  Re-run fresh by the feat-progression final pass at `ad2cbe3`: typecheck 0, build 0 (24 dist
  files), isolation 0, 911/911 (49 files), proofs 74/74 (10 files). (action-targeting close was
  878/878 across 48 files, proofs 66/66 across 9; spells-in-combat close was
  829/829 across 44 files, proofs 53/53 across 8; grid-movement close 741/741 across 40 files,
  proofs 47/47 across 7; equipment-consumables close 661/661 across 37, proofs 38/38.)

### OWNER corrections (v1-core: OWNER-01-LINT c5fbb94, OWNER-04-TSCONFIG 77b4108, OWNER-08-BARREL 9afa86c + 32c7ade; loot: FORMAT-RECONCILE 8b802b7; grid: OWNER-CP-POSITIONS 2f3b1d3; equipment-consumables: format residual 8668c53; spells-in-combat: OWNER-M02-HALF 623a687)

- OWNER-04-TSCONFIG: theme JSON module types via real-file resolution (`resolveJsonModule`);
  `themes.d.ts` deleted; `tests/compiler/fresh-load.d.ts` retained (types the vite `?fresh-load`
  query specifier, not a file).
- OWNER-08-BARREL: the M03 barrel lacked S05's combat exports (a plan-level lease gap; S04's
  barrel predated S05) — mechanically completed; the trio typecheck guards landed with it.
- FORMAT-RECONCILE (loot): S01/S02 lands left 6 files unformatted; S03 self-quarantined its own
  `pnpm format` and restored the outside-lease files byte-identically; the owner pass reconciled
  them format-only.
- OWNER-CP-POSITIONS (grid): S04's spatial themes + S03's fail-closed `startCombat` made the
  CA-08 positionless `fightScript` throw (6 tests red outside S03's lease). Mechanical fix:
  `positions: {hero: {x:0,y:0}, foe: {x:1,y:0}}` (the pre-authorized adjacency fallback — the
  distance-3 shape was empirically proved a **permanent stalemate**: no movement mechanic exists,
  so a gap can never close). All 20 assertions preserved byte-identical; 20/20 green. All
  assertions preserved; planning lesson recorded (DD16).
- Format residual (equipment-consumables): S01's two contract files were not Prettier-formatted;
  Orchestrator's format-only residual `8668c53` (grid DD12 precedent). No CAP affected.
- OWNER-M02-HALF (spells-in-combat, `623a687`): the `damage(half)` throw (C-S02-1) was latent in
  the action `cold-grip` and became reachable for 12 spell sites once spells were castable; it
  threw partway through `Combat.declare`, after the spend. Executor rule above (M02); +2 tests
  in `effect.test.ts`, +2 combat casts in `spells.test.ts` with a negative control. Ran
  concurrently with S03 on a disjoint lease and verified in a temporary worktree because S03's
  uncommitted edits turned the shared tree red.

## Recorded drift & intra-module notes (for the next cycle)

- **Intra-M03 value-import pairs** (derived mechanically at `94d40f3`; at `ad2cbe3` the only
  change is feat-progression's `progression.ts → feats.ts`): `character.ts ⇄
  progression.ts`, `character.ts → inventory.ts`, `{character, progression}.ts → feats.ts`
  (`feats.ts` a leaf),
  `{character, pools, inventory, character-profile}.ts → equipment.ts` (a leaf),
  `character-profile.ts → {inventory, pools}.ts`, `combat/combat.ts → conditions.ts`,
  `{combat/combat, equipment}.ts → display-roll.ts` (grid-movement leaf; imports only `core/dice`
  types), `snapshots.ts → {character, progression, combat/combat}`, `combat/combat.ts →
  {combat/triggers, combat/resolve, combat/spatial, combat/action-economy}`, `runtime.ts →
  {character, progression, combat/spatial, events}`. The `character ⇄ progression` cycle exists
  in code; TypeScript tolerates it because the imported symbols are used lazily. Recorded as
  observed, not as an architecture violation — the cross-module flow is what the architecture
  cares about, and it holds. *(Corrected at the grid-combat pass: the prior record's second cycle
  `combat/triggers.ts → combat.ts` was type-only from creation. **Corrected at the grid-movement
  pass:** the prior record listed `snapshots.ts → {combat/resolve, combat/spatial,
  combat/action-economy}` as value edges; at both `c39ef87` and `6ab880a` those three imports are
  `import type` — snapshots' only combat value edge is `combat/combat`.)*
- **Restricts matcher duplication: RESOLVED by spells-in-combat S02 ck1** — combat's
  `restrictionRejection` now calls the exported `matchesRestriction` + `declaredTags`; the inline
  copy is deleted. `isLivePattern` still has no non-test consumer (grep at `94d40f3`: definition,
  barrel, `conditions.test.ts`). Cleanup C1 narrowed to that symbol.
- **Effect-scope name shadowing** (equipment-consumables S05): a bare name in effect scope still
  reads the save when a save and an ability share it, and the engine-derived `speed` scalar shadows
  a same-named ability the same way (DD-M7, tested). **Since action-targeting v1.7** an effect
  reads the ability explicitly with `ability(name)` (DD-A4), and the zombie-urban med-kit does
  (`heal(2 + ability(vigor))`, heals 12). The carried content question is closed; the shadowing
  rule itself is unchanged by design.
- **`useItem` condition-duration display** (equipment-consumables S03): a `condition:applied`
  event raised by `useItem` reports the pack-default duration even when the effect overrides
  it. Carried to the next runtime-touching feature (display accuracy).
- **`parsePackEffects`: DELETED** at spells-in-combat S02 ck1 (DD-S15; zero references in
  `src/` or `tests/` at `94d40f3`). `PackIndex.spellEffects` is the parse-once source the spell
  bridge reads. Cleanup C6 closed.
- **`MAX_TABLE_DEPTH = 8` duplication:** `core/tables.ts` and `validate/helpers.ts` both define
  8. database.md prose records the engine-side ratification and both constants are test-pinned.
  Single-sourcing it is in the duplicated-logic cleanup brief (ARCHIVIST-LOG 2026-09-28, C2); a
  naive schema-re-exports-core fix would break M01's import-nothing-internal rule.
- **Surface-intent candidates:** `WYLDWOOD`, `readPatch`, `EventSeed`/`EventSink` — exported, no
  non-test consumer (or none at all). Cleanup-tracked (C3/C4/C7).
- **Declare gate order:** validity gate → spatial gate (reach for opponent actions; the
  **movement gate** for move actions, which target their actor and skip reach) → cost. Recorded
  in the source comment. Self actions (v1.7) target their actor and skip reach, like move actions;
  a foreign `targetId` is refused before validity.
- **Spells are combat-declarable (spells-in-combat v1.6; DD17/DD17a retired):**
  `declare()` resolves `pack.actions`, then `pack.content.spells`; spells pass the range gate
  (`targeting.range`, absent = effective reach) where actions pass reach, and a burst spell may
  take `{at}`. Out of combat a point-pool spell still has no cast verb.
- **`SnapshotOffer` not on the runtime surface:** `CombatSnapshot` (barrel-exported) types
  `offers?` as `readonly SnapshotOffer[]`, but `src/runtime/index.ts` does not re-export
  `SnapshotOffer` (consumers can name it as `NonNullable<CombatSnapshot['offers']>[number]`).
  Type-only; for the next surface revision.
- **Dice/Rng on the runtime surface:** not exported (see Surfaces above) — the README's "dice"
  bullet is satisfied by the engine's injectable seam + snapshots, not by exported dice symbols.
  Next surface revision decides.
- **E-SPAT-01:** registered (database.md v1.3, `RULE_IDS` 15). v1.5 widened its documented scope
  to the five movement rejection kinds and the terrain refusals; no new rule id.
- **Movement verb (grid-combat DD1): RESOLVED by grid-movement** — the human chose Option B:
  movement is pack data (`move(<formula>)` + `declare(id, {to})`), not an engine verb. The
  serialize → restore-with-updated-positions seam remains valid as the host's out-of-rules
  teleport. The DD16 positionless-adjacency stalemate is retired (the movement journey's 2v2
  starts apart and reaches `combat-over`).
- **grid-movement residuals:**
  - **F-M1 — CLOSED by spells-in-combat S03 ck1/ck3**: theme feat triggers read
    `condition:applied[target=self]`, the grammar is enforced at load (CAP-S7), and held reactive
    feats are offered (CAP-S6). Cleanup C11 closed.
  - **F-M2 / DD-M14** — `canReach` compares against `max(reach, defaultReach)` on both geometries
    (`spatial.ts`), so a per-id reach override *smaller* than the default never applies.
    Preserved deliberately; since v1.6 the spell range fallback uses the same value, so a fix must
    change both sites together.
  - **R-GM-1 / R-GM-2 — CLOSED by spells-in-combat S03 ck4** (envelope `offeredCount` / `phase`).
  - **R-GM-3** — a resumed walk skips the leaving-reach check on its first step out of the paused
    cell (once-only offers, mock-consistent). If re-planning picks a different first step, a
    different threatener is not checked. Owner: the next feature that touches provoke.
  - **`heal` in `EFFECT_VOCABULARY`: CLOSED by action-targeting S03 ck1** (`4c1e1e6`; the
    exact-membership pin in `checker.test.ts`). Cleanup C12 closed.
  - The `evalPackFormula` parse-once debt (grid-combat DD10) grew by one call site (`speed`).
- **spells-in-combat residuals (carried, owners named in its Final Report):**
  - **Out-of-combat restricts asymmetry** — in combat a spell is blocked by `actions.tagged:` or
    `spells.tagged:` (DD-S10); out of combat `isRestricted`/`restrictedIds` stay kind-exact; and
    `spells.tagged:` patterns get no load-time tag-integrity check (`helpers.ts`
    `RESTRICTS_PREFIX`, `cross.ts`), so an undeclared tag there loads silently and now bites in
    combat. **Human question** (should out-of-combat follow combat?). Owner: a future restricts
    feature.
  - **`mocks/spatial.html:191`** (C-S01-1) still says restore resumes in a *derived* `resolved`;
    under DD-S14 restore keeps the live envelope phase. Existing-mock copy change → Designer
    re-entry (human-authorized design-change class). `api-map.html` also lacks `pool:settled` /
    `slot:settled` / `feat:learned` (documented in `database.md` / `magic.html`) — same re-entry.
  - **Self-buff actions: CLOSED by action-targeting** (v1.7 self actions; S02 `63f6e78`,
    `83c7939`).
  - **Content:** the zombie-urban empty `spellLists` and the wyldwood `hedge-mage` mismatch are
    CLOSED by action-targeting S03 ck2 (`7c1b8b6`). The 12 fail-branch-free `damage(half)` sites
    remain (a pack author may want real half damage). Owner: the next content feature.
  - **FR-6 feat slots: CLOSED by feat-progression** (contract v1.8; S02 `45483c5`..`f7f6e88`).
    FR-6's "class features" item is still open (feat-progression residuals below).
  - **DD-S19 consequence:** the DC and attack bonus keep `ctx.vars = effectVars(actor, bound)`, so
    a `targetId` cast's DC sees the primary target's saves and an `at` cast's DC the caster's.
    Every bundled DC is a literal; documented in database.md.
- **action-targeting residuals (carried, owners named in its Final Report):**
  - **`mending` spells — human content-meaning question.** `damage(1d8 - vigor, mending)` deals
    damage reduced by the target's vigor save rather than healing. The Final Report names
    zombie-urban `bind-the-bite` and wyldwood `bind-wound`; a source grep at `535247d` finds a
    **third** site, dark-fantasy `bind-wound` (`dark-fantasy.json:273`, warden list — reachable
    before this feature). Owner: the human, then the next content feature.
  - **Root-only self actions** (documented v1.7 limitation): `sequence(target(self, …), …)` stays
    an ordinary action that binds an opponent; its inner `self` still resolves to the actor. No
    bundled content is affected.
  - **Stale test comment:** `tests/runtime/combat/character-profile.test.ts:381` still says
    "med-kit = heal(2 + vigor)". It is outside every lease, was accepted stale and is carried to the
    next cleanup run (cleanup C14).
  - **Restricts symmetry** stays the open spells-in-combat human question (above).
- **feat-progression residuals (carried, owners named in its Final Report):**
  - **F-FP1 / F-P3: human question.** `awardXp` can lower a directly set class level
    (`progression.ts` assigns `min(levelForXp, cap, ceiling)` even when it is lower). With the cap,
    a directly levelled character at its feat cap has every XP award below its level's threshold
    refused, and because a refusal leaves `classXp` unchanged, small awards never accumulate.
    Journey leg 5 and the `progression.test.ts` awardXp guard depend on today's behaviour (DD-F10).
  - **F-P7: human question.** A pack that declares `featSlots` only on a monster-only progression
    entry is feat-slotted, so every player class is capped at 0, with no load warning (the approved
    "any entry" meaning). Bundled content cannot reach this.
  - **F-FP2 / F-P5: FR-6 "class features".** `database.md` §progression lists a `features`
    (`{level, ref}`) row that is in neither `pack.schema.json` nor the validator. Owner: DB, in a
    future human-authorized re-entry.
  - **CAP-F1 compiler leg (optional).** The compiler's stage-8 refusal of a malformed `featSlots` is
    proven only by an ad hoc probe (VERIFICATION P1), not by a committed `tests/compiler` case.
  - **Host query (optional, DD-F7 follow-up).** There is no public "slots remaining" query; a host
    learns the cap only through refusals.
- **v1.1 follow-ups carried across cycles:** browser-mode Vitest config (CI's browser leg);
  byte-level snapshot conformance; `pnpm approve-builds` advisory for esbuild/tsup; an
  out-of-combat point-pool cast verb (would give wyldwood's charm armor teeth, DD-EG5); item
  `tags` (would let the `use` restriction gate bite). **Closed by spells-in-combat:** per-target
  save modifiers (`varsFor`, DD-S19). **Closed by
  grid-movement:** CI `pnpm build` before `pnpm test` (S04 ck3 `c23d563`, `ci.yml:45`); the
  `displayRoll`/`rollText` duplicate (S03 ck5 `27c77f4`, the `display-roll.ts` leaf).

<!-- Historical delta sections (pre-synthesis, kept in git history for provenance): the
Orchestrator-integrated markers loot-inventory SESSION-01 through grid-combat SESSION-05 were
collapsed at the grid-combat final pass (original text recoverable at b671a37); the
equipment-consumables SESSION-02..05 markers (f1563b1, 643fd76, 7c3db75, 7a479e6) were collapsed
at the equipment-consumables final pass (original text recoverable at c39ef87); the
grid-movement SESSION-02..04 markers (08a831b, e354139, c420843) were collapsed at the
grid-movement final pass (original text recoverable at 6ab880a); the spells-in-combat
SESSION-02, OWNER-M02-HALF and SESSION-03 markers (4caf973, ae0f480, da4665c) were collapsed at
the spells-in-combat final pass (original text recoverable at 94d40f3); the action-targeting
SESSION-02 and SESSION-03 markers (a84dd52, 42a1fd3) were collapsed at the action-targeting final
pass (original text recoverable at 535247d); the feat-progression SESSION-02 marker (3da588a) was
collapsed at the feat-progression final pass (original text recoverable at ad2cbe3). -->
