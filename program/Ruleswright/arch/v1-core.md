# Ruleswright — Architecture Record (v1-core)

> **Realized state as of tree HEAD `66d4efe`** (contract-conformance close, 2026-10-11; last `src/**/*.ts`
> commit still `64a3231` — `git diff --name-status bb61f91..66d4efe -- src` lists only the DB-owned
> `src/schema/contracts/snapshots.schema.json`), synthesized by
> Archivist (final pass) across **fourteen feature cycles**: v1-core (S01–S08, plan HEAD `53c7c91`),
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
> vigor ability, and spell lists that reach their spells), **feat-progression** (S01–S02, feature commits
> `3f63fd3`..`f7f6e88` — contract v1.8, per-class per-level `progression.<id>.featSlots` summed
> across classes, and the runtime rule `feat-slots-exceeded` on `learnFeat`, `levelSet`, `awardXp`
> and character/party restore; FR-6's "class features" item was then unbuilt — closed by class-features, v1.10), and **builder-rulings**
> (S01–S02, feature commits `cfda5dc`..`c851de2` — contract v1.9, description only: the human's four
> rulings of 2026-10-04 — the three `mending` spells heal, out-of-combat restricts follow the combat
> rule for spells, `awardXp` never lowers a level, and the feat-slotted predicate is documented as
> "any class"), **combat-decomposition** (S01–S03, feature commits `17f8f18`..`0c56866` — a
> behaviour-preserving refactor with no contract event: `combat/combat.ts` split by responsibility into
> `combat/{types,combatants,fight,declare,execute,movement}.ts` plus trigger answering in
> `combat/triggers.ts`, `snapshots.ts` split into `snapshots/{index,envelope,character,combat}.ts`,
> and the `MAX_TABLE_DEPTH` cross-pin; events, snapshot JSON and every export name unchanged, proven
> by the raw-sha256 characterization test), **class-features** (S01–S05, feature commits
> `8d5828c`..`b8973ec` — contract v1.10, a pre-release in-place revision with `schemaVersion` 1:
> a class feature `{level, ref}` moves from `content.classes.<id>.features` to
> `progression.<id>.features`; a feat `ref` is **granted** (derived, never stored, no feat slot),
> an action or spell `ref` is **unlocked** from that class level; refs resolve at load
> (`checkClassFeatures`); all 18 bundled feature rows resolve; the `features.ts` leaf and the
> `classFeatures` host query; plus the DB, Designer and Architect re-entries that closed F-FP2/F-P5,
> F-R6, F-D8 and the `database.md` seed-data drift), and **browser-determinism** (S01 +
> OWNER-M05-CI-ORDER, feature commits `1d929a7`..`fb2bf0e` — no `src/` change and no contract event:
> one shared determinism oracle with Node-pinned digests for the 9 characterization legs and the
> 3 generated bundled packs, a Vitest browser-mode leg in Chromium/Firefox/WebKit, the whole suite
> under Electron's runtime, two new CI jobs, the build-before-typecheck CI order, and a README ↔
> `ci.yml` honesty pin; see M05), and **contract-conformance** (S01 DB re-entry + S02, feature commits
> `e815e74`..`bd4f753` — contract v1.11, loosening only: the combat-snapshot combatant `hp` has no
> lower bound, matching an engine that never floored damage; an independent Ajv proof that the three
> contracts admit named library outputs; the `new Runtime` old-location refusal test; and the README's
> narrowed docs-run sentence; see M01 and M05).
> Every cycle's mid-run delta fragments were collapsed into one module-ordered description.
> Verified by the contract-conformance final pass on a fresh run at `66d4efe`: `pnpm build` 0 ·
> `pnpm typecheck` 0 · `pnpm lint` 0 · `pnpm format:check` 0 · `check:security` 0 · `check:isolation` 0 ·
> `pnpm test` **1017/1017 across 57 files** (`program/` is Prettier-ignored). Not rerun here, cited from
> the Final Report: `pnpm build && pnpm test:electron` 1017/1017 across 57 files (Orchestrator at
> `bd4f753`, Electron 44.7.0) and `pnpm test:browser` 6 files, 74/74 in each of Chromium, Firefox and
> WebKit (worker-reported at S02 ck3; the browser config does not collect the new file). GitHub Actions
> has not yet run the browser-determinism CI changes or the new file (B-BD-1, carried below).
> Verified-by-source and verified-by-execution are distinguished below.
>
> *(Process history — crashes, recoveries, dispatch failures, owner-correction mechanics — lives
> in each cycle's Final Report and ARCHIVIST-LOG.md, not here.)*

<!-- Realized-state summary (Archivist synthesis, contract-conformance final pass) -->

## Module map (as realized)

| ID | Module | Path | Imports (derived mechanically from value imports, incl. `export … from`, excluding `import type`) | Key files |
|----|--------|------|------------------------------------------------|-----------|
| M01 | Schema surface | `src/schema/` | nothing internal | `pack.ts`, `artifacts.ts`, `error-card.ts`, `version.ts`, `overrides.ts`, `validate/{collect,context,dsl,helpers,index}.ts`, `validate/sections/{actions,bestiary,content,cross,economy,progression,root,tables}.ts`, `index.ts` (+ DB-owned `contracts/**`) |
| M02 | Core mechanics | `src/core/` (9 .ts incl. dsl/) | M01 — **type-only** (`DslCheckRequest`/`ErrorCard` in `checker.ts`, `shared.ts`, `dsl/formula.ts`, `dsl/effect.ts`); no runtime value dependency | `rng.ts`, `dice.ts`, `tables.ts`, `index.ts`, `dsl/{shared,registry,formula,effect,checker}.ts` |
| M03 | Runtime | `src/runtime/` (31 .ts incl. combat/ and snapshots/) | M01, M02 (value); never M04 | `runtime.ts`, `events.ts`, `character.ts`, `character-profile.ts`, `progression.ts`, `pools.ts`, `inventory.ts`, `equipment.ts` (equipment-consumables leaf), `display-roll.ts` (grid-movement leaf), `feats.ts` (spells-in-combat; a leaf until class-features), `features.ts` (class-features leaf), `conditions.ts`, `errors.ts`, `snapshots/{index,envelope,character,combat}.ts`, `bestiary.ts`, `encounter.ts`, `index.ts`, `combat/{combat,types,combatants,fight,declare,execute,movement,triggers,resolve,action-economy,spatial}.ts` |
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
`31540b0`) and were missing from both. Also inside M03 (re-derived per statement at `0c56866`, after combat-decomposition moved the
code): `snapshots/character.ts → {character, progression}` (`reserveValue`, `buildCharacter`,
`validateBuild`) and `snapshots/combat.ts → combat/combat` (`defeatedSide`, `copyTerrain`, … through
`combat.ts`'s re-exports); `combat/combat.ts → combat/triggers.ts` (value: `answerOffer`,
`resolveReactive`); plus grid-movement's display-roll edges, now `{combat/combat, combat/execute,
equipment}.ts → display-roll.ts` (a leaf importing only `core/dice` types). The full intra-`combat/`
DAG is in the Combat engine section. spells-in-combat
added three value edges (derived at `94d40f3`, absent at `6ab880a`): `combat/combat.ts →
conditions.ts` (`matchesRestriction`, `declaredTags`; since combat-decomposition S01 the edge is
`combat/declare.ts → conditions.ts`; `conditions.ts` value-imports only `./errors`), `character-profile.ts → pools.ts` (`knownSpells`, `armorBlockingCast`; `pools.ts`
imports nothing from `character-profile`) and `character.ts → feats.ts` (the **`feats.ts` leaf**
value-imports only `./errors`; its `./runtime`/`./character`/`./events` imports are `import
type`). feat-progression added one more, `progression.ts → feats.ts` (`featSlotTally`,
`featSlotsExceeded`); `feats.ts` gained only an `import type` of `../schema/error-card`, so it
stayed a leaf. class-features added four, all into the new **`features.ts` leaf** (it value-imports
nothing; its `../schema/pack`, `./runtime` and `./character` imports are `import type`):
`feats.ts → features.ts` (`grantedFeats`, `feats.ts:18` — so `feats.ts` is **no longer a leaf**: it
value-imports `./errors` and `./features`), `pools.ts → features.ts` (`unlockedSpells`, `:27`;
`pools.ts` now value-imports the `./equipment` and `./features` leaves), `character-profile.ts →
features.ts` (`grantedFeats`, `unlockedActions`, `:28`) and the barrel re-export `index.ts →
features.ts` (`classFeatures`, type `ClassFeatureView`, `:29`). None closes a cycle. **Record correction (grid-combat final pass):** the prior
synthesis listed `combat/triggers.ts → combat.ts` as a second value-import cycle; git shows
`triggers.ts`'s `Combat`/`CombatantState`/`PendingTrigger` imports were `import type` at creation
(`6afbe31`) and remain so — the edge is type-only. `character ⇄ progression` is real.
Guards held at `5c53524` (class-features final pass: the per-statement value-import sets of every
`src/**/*.ts` differ from `f36d4ae` only in `feats.ts`, `pools.ts`, `character-profile.ts`,
`index.ts` and the new `features.ts`, all inside M03 — no cross-module edge changed) and at `a2f117f` (re-grepped by the combat-decomposition final pass; `git diff --stat
-G'^(import|export .* from)' 52d4d2a..db38f31 -- src` lists only `combat/*.ts` and the
`snapshots` split — no import line changed elsewhere, and the union of the new files'
cross-module value edges equals the base files' (CA-D4)): no `compiler` reference in `src/runtime` except the CI-checked bundle
rule comment; no `runtime` import in `src/compiler` (grep-asserted in tests). The runtime-only
bundle is **proven** free of `generateCampaign` by `scripts/check-runtime-isolation.mjs`
(passed by this pass on a fresh build; also wired into CI's `package` job).

## Surfaces (what a consumer actually gets — derived, not claimed)

- `ruleswright/schema` — the full M01 re-export: pack/artifact types (incl. `Pack.spatial?`,
  `SpatialDef`, `SpatialReach` — v1.3; v1.5 widens `SpatialDef.model` to `'grid' | 'hex'` and
  adds `SpatialDef.terrain?` + `TerrainKind`; v1.6 adds `SpellTargeting.range?`; v1.8 adds
  `ClassProgression.featSlots?`; v1.10 adds `ClassProgression.features?` and removes `ClassDef.features`), `validatePack(json, dslChecker?)`,
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
  export — defined in `combat/declare.ts` since combat-decomposition, like `moveBudgetAst` in
  `combat/movement.ts`, both re-exported from `combat.ts`). feat-progression added none either (DD-F7):
  `featSlotTally`/`FeatSlotTally`/`featSlotsExceeded` are intra-runtime exports of `feats.ts`,
  and the only public change is `validateBuild`'s optional 4th parameter `heldFeats`. builder-rulings
  added none and changed no signature: `awardXp`, `isRestricted` and `restrictedIds` changed
  behaviour only (v1.9, below). combat-decomposition added none and changed no export name; its one
  `.d.ts` delta is `Combat.state` declared as a `get`/`set` accessor pair instead of a field (DD-D3,
  type-compatible; the V4 export-list digests equal base). class-features added `classFeatures(runtime,
  character)` and the type `ClassFeatureView` (re-exported from `features.ts`, `index.ts:29`; pinned
  in `module-surface.test.ts`); `grantedFeats`/`unlockedActions`/`unlockedSpells` are intra-runtime
  exports, not on the barrel. (`SnapshotOffer`, the element type of `CombatSnapshot.offers`, is exported
  from `snapshots/combat.ts` and `snapshots/index.ts` but not re-exported by the barrel — see drift notes.) **M03 barrel completed at v1-core S08**
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

## Cross-cutting decisions (accepted across the cycles)

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
follow-up, DOCS-CI-01..03, DOCS-TSC-01 — that follow-up was retired by browser-determinism; see M05); **packaging hygiene** (MIT LICENSE, ESLint 10 flat
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
the exported `matchesRestriction`; out of combat `isRestricted` was kind-exact until v1.9, when
builder-rulings DD-R3 gave it the same rule. **DD-S11** `learnFeat`; `CharacterState.feats?` absent until the
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
(F-FP1) was not changed by feat-progression; DD-F6's `awardXp` check guards the invariant regardless.
*(F-FP1 closed by builder-rulings DD-R4, v1.9: `awardXp` never lowers a level, so the guard is now
reachable only from an edited over-cap state.)*

builder-rulings (DD-R1–DD-R7; full record in that run's STATE.md; human answers 2026-10-04 —
"1 yes, heal 2 recommendation 3 no 4 recommendation", the two "recommendation" answers read as
Planner's recommendations and confirmed by the human's "start"): **DD-R1** the three `mending`
spells (zombie-urban `bind-the-bite`, dark-fantasy and wyldwood `bind-wound`) read `heal(1d8 +
ability(vigor))` — the authored dice and vigor term with the sign flipped, vigor read explicitly as
the **caster's** ability (the med-kit precedent, DD-A5); cost, range, tags and lists unchanged.
**DD-R2** no targeting change: a spell with no `targetId` still targets the only opponent (DD-S8),
so the host names the ally. **DD-R3** out of combat `isRestricted`/`restrictedIds` block a spell by
`actions.tagged:` **or** `spells.tagged:`, the combat declare's rule; an action still matches
`actions.tagged:` only; `matchesRestriction` and load-time tag integrity are unchanged.
**DD-R4** `awardXp` sets each class to `max(current, min(xpLevel, raceCap, ceiling))`; XP and
`classXp` always accumulate and `level:reached` fires only on a rise (closes F-FP1/F-P3).
**DD-R5** the feat-slotted predicate keeps the v1.8 "any class" meaning, because the pack format
cannot tell a player class from a monster class; database.md DD-F3 and the README now state it
(closes F-P7 as intended behaviour). **DD-R6** contract **v1.9** is description only — Version
Registry row 10, caveats (e) and (f), no field, no rule id, `schemaVersion` 1, no contract file
changed. **DD-R7** cleanup C14 (the stale med-kit test comment) folded into S02 ck3.

class-features (DD-C1–DD-C13; full record in that run's STATE.md; human answers 2026-10-04 —
"1 a,b 2 no 3 move it, fix packs, 4 fix the broken packs, 5 you have my auth for whatever you
need"): **DD-C1** `progression.<classId>.features[i] = {level, ref}`; ids are pack-unique
(`registerId`, E-DUP-01), so the map that declares `ref` decides the kind — `content.feats` →
**granted**, `actions` → **unlocked** (declarable in combat), `content.spells` → **unlocked**
(known) — while the character's level **in that class** ≥ `level`; anything else is `E-REF-01`
with a did-you-mean over feats ∪ actions ∪ spells. **DD-C2** granted is not learned: derived from
`(pack, classes)`, never written to `CharacterState.feats`, never counted by `featSlotTally`, never
serialized (`snapshots.schema.json` untouched); `learnFeat` of a granted feat refuses `feat-known`;
a feat learned before its grant keeps its slot (no refund in v1, documented); a `levelSet` down
drops the grant with no event. **DD-C3** the old location is removed (`E-SCHEMA-02`, closed
contract) as a pre-release in-place revision, `schemaVersion` 1, caveat (g). **DD-C4** load rules:
`level` an integer 1..the class's level ceiling (shortest `saves` array), `ref` kebab, unique per
class (all `E-SCHEMA-01`); a redundant action (already in the class `actions`) or spell (its lists
meet the class `spellLists`) is `E-REF-01`. **DD-C5** multi-class unions keep first-occurrence
order (class, then feature). **DD-C6** characters only; statblocks unchanged. **DD-C7** no
`feature:*` event; the host query `classFeatures` lists every feature, inactive ones included.
**DD-C8** unlocked artifacts ride the existing pipeline (restricts, gates, costs, `armorCasting`,
spend unchanged). **DD-C9** byte-stable composition: unlocked actions append after the class
`actions` union, `knownSpells` filters pack order by list **or** active unlock, granted reactive
feats append after held ones; a character with no active feature is byte-identical. **DD-C10**
the 18 bundled rows (M04 below). **DD-C11** fixtures gain the passive feat `feature-warden-oath`.
**DD-C12** characterization re-key only under the normalized-dump proof (CA-C5). **DD-C13** S03
moves the field (ck1), then resolves refs and fixes content in one commit (ck2).

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

builder-rulings S01 (DB Author re-entry, `cfda5dc`/`9fdd0b9`): contract **v1.9**, description only.
`database.md` gains the symmetric DD-S10 restricts bullet (l.401-408) and the matching notes on the
conditions and spells rows (l.357, l.359), the *Feat slots* XP bullet (l.523-530), the DD-F3 "any
class counts" sentence (l.491-498), compatibility caveats (e) (l.537: out of combat a condition's
`actions.tagged:` pattern now also blocks a spell; no bundled outcome changes) and (f) (l.541:
`awardXp` keeps a directly set level above its XP level), the Status line and Version Registry
row 10 (l.747). No contract file and no `src/schema` file changed (`git diff --name-status
e7e5828..6534364` lists neither).

class-features S01 (DB Author re-entry, `8d5828c`/`efa971d`): contract **v1.10**, a pre-release
in-place revision. `database.md` gains the §progression `features` row (l.485), the *Class
features (v1.10)* subsection (l.546-608) with compatibility caveat (g) (l.600: packs using the old
location or an unresolved ref now fail load; bundled `contentHash`es change), cross-references at
l.77 (referential integrity), l.358 (the classes bullet), l.438 (`feat-known`) and l.443-444
(combatant `feats` held **or granted**), the Status line and Version Registry row 11 (l.813). The
Seed Data paragraph (l.786) now names all three templates, wyldwood included. `pack.schema.json`
moves `features` from the class object to `$defs.classProgression.properties.features` (`{level:
integer ≥ 1, ref: idPattern}`, `additionalProperties: false`, `required [level, ref]`); the
class object's `additionalProperties: false` now rejects the old location. No rule id (`RULE_IDS`
still 15). S03 ck1 (`c3fc398`): `artifacts.ts` drops `ClassDef.features` and adds
`ClassProgression.features?: ClassFeature[]` (l.164); `sections/content.ts` no longer allows
`features` on a class, so the old location gets the closed-contract `E-SCHEMA-02`;
`sections/progression.ts` admits `features` and checks it in the private `checkFeatures` (l.220)
against `levelCeiling(saves)` (l.211), a helper the v1.8 `featSlots` coverage rule now shares with
unchanged behaviour (S03's one R1 deviation); `error-card.ts:12`'s jsonPath example is now
`progression.warden.features[0].level`. S03 ck2 (`c0a23b1`): the exported
`checkClassFeatures(ctx, json)` in `sections/cross.ts` (l.92), called by `validate/index.ts:86` right
after `checkProgressionPairing`, raises `E-REF-01` at `progression.<c>.features[i].ref` for an
unresolved ref (did-you-mean over feats ∪ actions ∪ spells) and for the two DD-C4 redundancies; it
skips malformed entries, whose structural card already exists, so a non-kebab ref gets
`E-SCHEMA-01` only. M01 gained no import.

contract-conformance S01 (DB Author re-entry, `e815e74`/`bde9781`, the human's "a yes", DD-K1): contract
**v1.11**, loosening only. In `snapshots.schema.json` (l.192-195) the combat-snapshot combatant `hp` is
`{type: integer, description}` with no `minimum` (it was `minimum: 0`). `required [id, hp]` and `maxHp`'s
`minimum: 0` are unchanged, and `pack.schema.json`/`override.schema.json` are byte-identical.
`database.md` gains the *v1.11 — combatant `hp`* block (l.699-705), the Status line (l.3) and Version
Registry row 12 (l.822). `schemaVersion`/`snapshotVersion` stay 1; no rule id; no caveat (no previously
valid document becomes invalid). The contract now states what the engine always did: damage is not
floored (`combat/combatants.ts:80-92`), a combatant at `hp <= 0` is down (`:13-15`), the writer emits
`hp: combatant.hp.current` (`snapshots/combat.ts:131`) and restore reads it as-is (`:212`). No
`src/**/*.ts` file changed (`git diff --name-status bb61f91..66d4efe -- src`). The independent Ajv proof
of the three contracts is in M05.

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

### M03 — Runtime I: character side (v1-core S04 via RECOVERY-04, 23f9918/4ead08b/db7eebb/b961053/d0240e6; profileFromCharacter + sideDefeated in v1-shell; inventory in loot S01; equipment in equipment-consumables S03/S05; speed in grid-movement S03; spells + feats in spells-in-combat S02/S03; feat slots in feat-progression S02; the `awardXp` max
rule and the out-of-combat restricts spell rule in builder-rulings S02; class features in class-features S04)

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
  `invalid-xp-table` refusal also changes nothing (F-P4). **Since builder-rulings S02 ck1
  (`1056f48`, DD-R4, v1.9)** each class's derived level is `Math.max(entry.level,
  Math.min(levelForXp(classXp), cap, ceiling))` (`progression.ts:305`): an award never lowers a
  level, `xp`/`classXp` always accumulate, `level:reached` fires only for a class whose level rose,
  and the `feat-slots-exceeded` check in `awardXp` is reachable only from an edited over-cap state.
- Restricts matcher: `matchesRestriction(pattern, kind, tags, declaredTags)` — exact
  `actions.tagged:`/`spells.tagged:` prefix, tag must be pack-declared; `isLivePattern(runtime,
  pattern)`; `declaredTags(runtime)`. Out of combat `isRestricted`/`restrictedIds` use it
  with the combat rule since builder-rulings S02 ck2 (`b9e52e3`, DD-R3, v1.9): `isRestricted`
  matches every kind against `actions.tagged:` and, for kind `'spell'` only, also against
  `spells.tagged:` (`conditions.ts:189-203`); `restrictedIds` filters through it. **Since spells-in-combat S02 ck1** combat's `restrictionRejection` (in `combat/declare.ts` since combat-decomposition) calls the exported
  `matchesRestriction` + `declaredTags` (kind `'action'` for every declare, plus `'spell'` for a
  spell declare, DD-S10) and the inline actions-only duplicate is gone; `isLivePattern` still has
  no non-test consumer and is kept as public API (cleanup C1 retired, combat-decomposition DD-D9).
- Dependency direction: runtime → {schema, core} only; no compiler import.

v1-shell added `src/runtime/character-profile.ts` (CA-08): `profileFromCharacter(rt, character,
id?)` → `{profile, balances}` — current hp, `derived()` ac/attack bonus, the pack's `initiative`
formula, the union of the character's class `actions` (pack v1.2 `content.classes.<id>.actions`),
pool points + bound spell slots; a class with no actions cannot fight (`no-combat-actions`).
`combat.sideDefeated` (D-26): `defeatedSide(combatants)` (`combat/combatants.ts`) is consulted after every resolution
by `endIfSideDefeated` (`combat/execute.ts`); a fully-downed side ends the fight — `phase: 'combat-over'`, one `combat:ended`
event naming `{winner, defeated}`, downed combatants skip turns and get no trigger offers, and a
terminal snapshot restores as `combat-over` (`snapshots/combat.ts` reads the same `defeatedSide`).

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
exports (DD-F7), and `progression.ts` consumes them. `feats.ts` stayed a leaf there (its
`ErrorCard` import is `import type`) until class-features, below.

**`src/runtime/features.ts`** (class-features S04 ck1 `3a49d9f`, DD-C1/C2/C5/C7/C9) — a runtime
**leaf**: it value-imports nothing (`Pack`, `Runtime`, `ClassEntry` are `import type`).
`featureKind` (l.19) looks a ref up in `content.feats`, then `actions`, then `content.spells` (CA-C2;
a valid pack always resolves, and a ref in none of them is skipped, not thrown).
`classFeatures(runtime, character)` (l.30; public, on the barrel since ck4 `64a3231`) returns
`readonly ClassFeatureView[]` — `{classId, level, ref, kind: 'feat' | 'action' | 'spell', active}` in
DD-C5 order, inactive features included. `grantedFeats` (l.65), `unlockedActions` (l.70) and
`unlockedSpells` (l.75), each `(runtime, classes) → readonly string[]` of active refs, first
occurrence winning, are intra-runtime exports. Consumers: `profileFromCharacter` (ck1) appends
unlocked actions after the class-actions union, then runs the `no-combat-actions` check, and
appends granted reactive feats not already held after the held ones in `profile.feats`; `pools.ts`
`knownSpells` (ck2 `dd70d3e`) keeps pack spell order filtered by list match **or** an active unlock,
so `prepareSpell` and `profile.spells` inherit it (its `spell-not-known` message now adds "and no
class feature unlocks it"); `learnFeat` (ck3 `32eaa35`, `feats.ts:62`) refuses a granted feat
`feat-known` ("… is granted feat … by a class feature (FR-6)"), nothing changed, while
`featSlotTally` still counts held feats only. A character with no active feature gets a
byte-identical profile and known-spell list (`character-profile.test.ts`). The fight, snapshots and
`snapshots.schema.json` are unchanged (`git diff --quiet c0a23b1 -- src/runtime/combat
src/runtime/snapshots`): a combat restore re-states the host's profile, so a granted offer survives
it, and a restored character re-derives its grants.

### M03 — Combat engine (v1-core S05, 6efaa16/c7a2d44/6afbe31/4be9e6c; spatial integration in grid-combat S03; item use in equipment-consumables S05; movement in grid-movement S03; spells + feats in spells-in-combat S02/S03; self actions in action-targeting S02; split by responsibility in combat-decomposition S01/S02)

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
  edge replacing the bound-target `resolveTargets` stub; combat injects it per execution (`executeBound`, `combat/execute.ts`).
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
- **File layout (combat-decomposition S01 `17f8f18`..S02 `39d754d`; behaviour-preserving, DD-D2).**
  `combat.ts` (1,809 lines at `52d4d2a`) is split by responsibility. The behaviour in the next
  bullet is unchanged; the symbols it names now live as below (line counts and value imports at
  `0c56866`, derived per statement with `import type`/`export type` dropped):

  | File | Holds | Internal value imports |
  |---|---|---|
  | `combat/combat.ts` (671) | `startCombat`, `rngStateOf`, `class Combat`: constructor, `get`/`set state` (delegating to `core.state`, DD-D3), `pendingTriggers` (the core's own array), `offeredCount`, `roundComplete`, the public verbs `step`/`declare`/`use`/`respond`/`serialize`/`eventsSince`/`declareReactive`, and the private `core`, `endTurn`, `advanceFrom`. `declare` keeps the validity gate inline (`this.runtime.index.validAsts[actionId]`, `combat.ts:410`, DD-D4, pinned by `combat-spatial.test.ts:511-515`). It re-exports every name it exported at `52d4d2a` (DD-D5): the 11 types from `./types`; `isDowned`, `defeatedSide`, `combatantFeats`, `copyBindings`; `isSelfAction`; `copyTerrain`, `terrainRefusals`, `moveBudgetAst`; `displayRoll`, `replenish`, `SlotLedger`, `SlotGrants` | `../../core/rng`, `../../core/dsl/formula`, `../errors`, `../display-roll`, `./triggers`, `./action-economy`, `./combatants`, `./declare`, `./execute`, `./fight`, `./movement` |
  | `combat/types.ts` (171) | every combat type (`CombatantState` … `StartCombatRequest`) plus `CastSlot` | none |
  | `combat/combatants.ts` (98) | pure combatant facts: `isDowned`, `defeatedSide`, `combatantFeats`, `copyBindings`, `profileOf`, `reachOf`, `ruleBaseOf`, `validityVars`, `balancesOf`, `applyMutation` | none |
  | `combat/fight.ts` (90) | `class FightCore`: the fight's mutable internals (`runtime`, `state`, `rng`, `grants`, `pendingTriggers`, `offerCounter`, the private `surfaced` WeakSet) and the shared primitives `setClock()`, `collect(work)`, `reject(actorId, rejection)`, `surfaceOffers(events, {feats})` | `./combatants`, `./triggers` |
  | `combat/declare.ts` (283) | declare gates and spend helpers: `restrictionRejection`, `resolveTarget`, `spatialGate`, `atRefusal`, `rangeGate`, `selfTargetRefusal`, `isSelfAction`, `pickSlot`, `applyNonSlotCosts`, `castPayload` | `../conditions`, `./spatial`, `./combatants` |
  | `combat/execute.ts` (233) | effect execution over `FightCore`: `resolveShape`, `flattenResolutions`, `executeBound`, `resolveAction`, `boundActionOf`, `endIfSideDefeated` | `../display-roll`, `./resolve`, `./combatants` |
  | `combat/movement.ts` (351) | movement and terrain over `FightCore`: `copyTerrain`, `terrainRefusals`, `forfeitMove`, `movementGate`, `pathQuery`, `walk`, `threatenersLeft`, `resumeMove`, `endMove`, `setPendingMove`, `place`, `moveBudgetAst`; the private `ZERO_RNG` | `../../core/dsl/formula`, `../errors`, `./resolve`, `./spatial`, `./combatants`, `./declare` |
  | `combat/triggers.ts` (280) | offer grammar and emission (its 7 prior exports, incl. `resolveTriggered`) plus trigger answering: `answerOffer`, `resolveReactive`, `resolveReactiveAgainst`, `resolveFeat` | `./action-economy`, `./combatants`, `./declare`, `./execute` |
  | `combat/{resolve,spatial,action-economy}.ts` | unchanged (397, 375, 211) | unchanged (`resolve.ts → core/dsl/{checker,formula,effect}`; the other two none) |

  The value DAG is acyclic. No file value-imports `./combat` (`triggers.ts → combat.ts` stays
  type-only), only `combat.ts` value-imports `fight.ts` (the rest take `FightCore` as a type), and
  `combat.ts → ./resolve`/`./spatial` became type-only. None of the new helpers is on the runtime
  barrel. **Name map for the next bullet:** the private `resolve` → `resolveAction` and `execute()` →
  `executeBound` (`execute.ts`); `rejectionEvent` → `FightCore.reject`; `Combat`'s
  `setClock`/`collect`/`surfaceOffers` → `FightCore`'s; `resolveReactive`, `resolveReactiveAgainst`,
  `resolveFeat` and the take/decline half of `respond` (`answerOffer`) → `triggers.ts`; the movement
  gate, walk, pause/resume/forfeit and terrain refusals → `movement.ts`; the declare gates →
  `declare.ts`; `applyMutation`, `combatantFeats`, `copyBindings`, `reachOf` → `combatants.ts`.
  **Proof:** `tests/proofs/combat-characterization.test.ts` (9 legs through the public barrel; raw
  sha256 of the whole event + snapshot stream, captured from unmodified source at S01 ck1 `17f8f18`
  and green on base source too) and `tests/runtime/combat/module-surface.test.ts` (exact value-export
  lists of the barrel, `combat/combat` and `snapshots`; a no-`parseFormula`/`parseEffect` sweep over
  `combat/*.ts` except `resolve.ts`). The characterization test is a **behaviour pin** (DD-D8; see
  drift notes).
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
  `resolve` is split into a shared `execute` used by `declare`, `respond` and `use` (now
  `resolveAction`/`executeBound` in `combat/execute.ts`; the take path behind `respond` reaches them
  through `triggers.ts`).
  `applyMutation` (`combat/combatants.ts`) applies the R-2 heal rule to negative-amount damage with `hpBefore` captured
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
  (`collect()`, the `execute()` idiom — now `FightCore.collect` and `executeBound`) and feed only those to `surfaceOffers`; `use` already
  surfaced per call; `surfaceOffers` skips any event already surfaced (a `FightCore`-private
  `WeakSet<RuntimeEvent>`, not combat state), so each (reactor, event) pair is offered exactly
  once, and offers raised inside a walk surface when raised. Offers are not filtered by
  affordability: a spent-reaction take yields one `declare:rejected {slot-exhausted, reaction}`,
  E-ECON-01. `respond(…, 'decline')` now calls `setClock()` first (restored-fight stamping fix,
  S03 ck4). Intra-runtime helper exports `copyTerrain`, `terrainRefusals`, `moveBudgetAst`
  (defined in `combat/movement.ts`, re-exported from `combat.ts`, consumed by `snapshots/combat.ts`)
  stay out of the barrel. `displayRoll` moved to the
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
  intra-runtime helpers `copyBindings`/`combatantFeats` are consumed by `snapshots/combat.ts`, not the
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
  The exported **`isSelfAction(runtime, actionId)`** (in `combat/declare.ts`, re-exported from `combat.ts`; intra-runtime, not in
  the barrel) is true when `index.actionEffects[actionId]`'s root is `target(self, …)` — it reads
  the action index only, so spells never qualify. `declare` (actions only) and `resolveReactive`
  bind the actor/reactor as the target and skip `resolveTarget` and the reach gate; a foreign
  `targetId` yields `declare:rejected {kind: 'invalid-target', rule: 'E-REF-01', resource:
  targetId}` from `selfTargetRefusal` (`combat/declare.ts`), with nothing changed. `resolveReactive` now ends
  in `resolveReactiveAgainst` (shared cost gate, spend and resolve; both exported free functions of
  `combat/triggers.ts` since combat-decomposition S02 ck3 `d728c51`). Proven by
  `tests/runtime/combat/self-target.test.ts` (12) and the self-target journey (M05).
- `combat/spatial.ts` (FR-11) — `theaterOfMind` no-op; `gridGeometry` (Chebyshev, reach, burst);
  grid-combat S03 reshaped the pack edge: `spatialFromPack` reads the v1.3 contract shape
  (`{model:'grid', reach:{default, <label>:n}, shapes?}`) into the internal `SpatialModel`
  `{defaultReach, reachOverrides}` (internal signature unchanged; only the pack-reading edge
  adapts, CA-G1); new export `packSpatialModel(pack: { spatial?: SpatialDef }): SpatialModel |
  undefined` — the typed adapter combat consumes (`undefined` = theater of mind; accepted as a
  structural input, since a nominal `Pack` signature would reject `spatialFromPack`'s input);
  `SpatialRejection.pendingId` → `rule: 'E-SPAT-01'` (registered id, CA-G2; zero remnants).
  One shape resolver (`resolveShape`, in `combat/execute.ts` since combat-decomposition) with three consumers: the executor's
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
  `why.rolls`); a runtime leaf importing only `core/dice` types, consumed by `combat/execute.ts`
  and `equipment.ts` and re-exported by `combat/combat.ts` (retires equipment's private `rollText`; `equipment.test.ts` kept green).
- `combat/triggers.ts` (FR-4/13) — pattern grammar `<type>` or `<type>[target|actor=self|<id>]`
  (the grammar `TRIGGER_PATTERN` enforces at load); `offersForEvent(runtime, combatants, event,
  {feats?})` returns every action offer, then every feat offer (new `reactiveFeatsFor`) unless
  `feats: false`; `trigger:fired {triggerId, actionId, source, on, offerIndex}` and
  `trigger:declined {triggerId, actionId, source, on}`, `why.rule` `actions.<id>.trigger` or
  `content.feats.<id>.trigger`; taken action triggers ride the same pipeline as declares. **Edge note
  (corrected at the grid-combat pass):** `triggers.ts → combat.ts` is type-only, not a value-import cycle. Since combat-decomposition S02
  ck3 (`d728c51`) the file also holds trigger answering over a type-only `FightCore`: `answerOffer`
  (decline → `setClock` + `trigger:declined`, otherwise take), `resolveReactive` (restriction → self
  → target → reach), `resolveReactiveAgainst` (cost → spend → `collect(resolveAction)` →
  `surfaceOffers`) and `resolveFeat` (holder check → effect → `surfaceOffers(…, {feats: false})`).
  These are internal exports, not on the barrel.
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

### M03/M05 — Snapshots + root surface (v1-core S06, f1af841/9e18ee2/daac7b7/a6d89ff/bb01e92; positions in grid-combat S03; sideDefeated in v1-shell; terrain + paused moves in grid-movement S03; spend, feats and the envelope in spells-in-combat S02/S03; the feat-slot restore refusal in feat-progression S02; split into `snapshots/` in combat-decomposition S03)

- **File layout (combat-decomposition S03 ck1 `8b1ed0b`; a verbatim move, DD-D7, following the
  `validate.ts` → `validate/` precedent).** `src/runtime/snapshots.ts` (1,086 lines) became
  `src/runtime/snapshots/`. Importers keep the path `…/runtime/snapshots`, which resolves to
  `snapshots/index.ts` (`src/runtime/index.ts:84` unchanged). `index.ts` (35): the module header;
  it re-exports exactly the base names (values `serializeCharacter`, `serializeParty`,
  `restoreCharacter`, `restoreParty`, `serializeCombat`, `deserializeCombat`, and the 12 snapshot
  types). `envelope.ts` (123): the identity gate and shared helpers (`SnapshotPackIdentity`,
  `SNAPSHOT_VERSION`, `packIdentity`, `envelopeRefusals`, `declaredIdentityId`, `display`, `isRecord`;
  module-internal). `character.ts` (302): the field-mapping header, the character/party types,
  serializers and restores, `characterStateRefusals`, `featRefusals`, `equippedRefusals`,
  `restoreCharacterState`. `combat.ts` (671): the combat types incl. `SnapshotOffer`,
  `UINT32_MAX_WORD`, `serializeCombat`, `deserializeCombat`, `spatialRestoreRefusals`,
  `combatRestoreRefusals`, `COMBAT_PHASES`, `envelopeV16Refusals`, `frozenSideDefeated`,
  `spendRefusals`, the copy/remaining helpers and `validateRngWords`. Value imports, derived per
  statement: `index → ./character, ./combat`; `envelope → schema/{version,error-card}`; `character →
  schema/error-card, core/rng, ../errors, ../progression, ../character, ./envelope`; `combat →
  schema/error-card, ../errors, ../combat/combat, ./envelope` (`./character` type-only). Their union
  equals base `snapshots.ts`'s edges (CA-D4). Git's rename view shows the deletion as
  `snapshots.ts → snapshots/combat.ts` (R059), a similarity artifact. M01's `error-card.ts:46`
  comment now reads "enforced by runtime/snapshots/".
- `src/runtime/snapshots/` (M03): FR-14 serializers `serializeCharacter/serializeParty/
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

### M04 — Compiler + themes (v1-core S07, 116fc7e/01af260/786923b/1676c42/5d30d2f/3faf836; items+wyldwood in loot S02; spatial pass-through in grid-combat S04; equipSlots + equipment content in equipment-consumables S04; movement content in grid-movement S04; spell cost/range + feat patterns in spells-in-combat S02/S03; self-wrapped actions, med-kit and spell lists in action-targeting S02/S03; feat slots in feat-progression S02; healing `mending` spells in builder-rulings S02)

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
  10). S03 ck3: the med-kit line above. These lists also made the three `mending` spells reachable;
  since builder-rulings they heal (below).
  feat-progression S02 ck3 (`7bf5fa6`, no compiler source change — `stages/classes.ts` copies
  `progression` verbatim): all 9 bundled classes (3 per theme) declare `featSlots [1, 1, 2, 2, 2,
  3, 3, 3, 4, 4]`, so a generated character is capped end to end. Because the themes changed,
  older bundled-pack snapshots already fail the `contentHash` identity gate.
  builder-rulings S02 ck3 (`4be2a57`, no compiler source change): zombie-urban `bind-the-bite`
  (`:198`), dark-fantasy `bind-wound` (`:273`) and wyldwood `bind-wound` (`:418`) read `heal(1d8 +
  ability(vigor))` instead of `damage(1d8 - vigor, mending)`; the `mending` damage type no longer
  appears anywhere in `src/`. In combat the heal is a negative `damage:applied` amount clamped at
  `maxHp` (`applyMutation`, `combat/combatants.ts`); its payload `type` is undefined and the dice face appears only in
  `why.rolls[0]` (e.g. `d8[-7]-10=-17`). All three `contentHash`es changed; no test pins a literal
  hash.
  class-features S03 (no compiler source change; stage 4 passes `progression` through): ck1
  (`c3fc398`) moves every class's `features` to `progression.<id>.features` (its last key, refs
  unchanged); ck2 (`c0a23b1`) makes every ref resolve per DD-C10 — 18 rows. New feats, appended
  after the existing ones (passive `"passive": "1"` unless marked reactive, whose trigger is
  `condition:applied[target=self]` → `applyCondition(braced, 1)`): dark-fantasy `oath-of-the-warden`,
  `wardens-resolve`, `hexers-eye`, `crypt-vigil` (reactive); zombie-urban `scavengers-instinct`,
  `block-runner`, `milers-read`, `field-surgery`, `steady-pulse` (reactive); wyldwood
  `oath-of-the-verge`, `verges-glyph`, `hexers-eye`, `hedges-eye`, `bramble-vigil` (reactive). New
  main actions in no class or statblock list, each `sequence(attack(ac, might), damage(1d6 + might,
  <type>))`: dark-fantasy `barrow-rite` (crypt-warden L2), zombie-urban `jury-rig` (fixer L3),
  wyldwood `thornward` (hedge-mage L3). The one spell unlock is zombie-urban medic L3 `rot-read`.
  The two `wardens-glyph` refs (redundant spell unlocks) became `wardens-resolve` and `barrow-rite`;
  the warden-list spell `wardens-glyph` itself stays.
  warden, hexer and scavenger carry passive feats only. Every `contentHash` changed again.
  Byte-identity proofs (CA-5): equal hash + equal bytes, different-seed divergence, in-process
  AND across fresh module loads; no ambient values.
- FR-21 conformance: `tests/compiler/coverage-floor.test.ts` (94 tests since class-features S03 ck2,
  which added a per-theme "v1.10 class features resolve" case; 91 since feat-progression S02
  ck3, which added a per-theme `featSlots` floor over every `content.classes` id — the
  `playerClasses` filter would have skipped 3 of 9, F-P2; 88 since spells-in-combat
  S03 ck1, which added a per-theme trigger-grammar check; 85 since
  grid-movement S04, which added a per-theme "v1.5 movement" test; 82 since equipment-consumables S04 — the FR-17/CA-1 generate→validatePack dogfood path sees the spatial
  and equipment sections on all three packs and produces zero cards; CAP-G6/CAP-E6 evidence,
  plus a CA-EG3 content-pairing assertion).

### M05 — Packaging, CI, proofs, docs (v1-core S08, 02752a9/8f67611/9afa86c/32c7ade/d5bacba; v1-shell packaging/docs/CI/coverage; loot S03; grid S05; equipment-consumables S06; grid-movement S04; spells-in-combat S02/S03; action-targeting S02/S03; feat-progression S02; builder-rulings S02; class-features S03/S04; browser-determinism S01 + OWNER-M05-CI-ORDER; contract-conformance S02)

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
  `feat-slots-journey.test.ts` (feat-progression S02, below), `rulings-journey.test.ts`
  (builder-rulings S02, below), `class-features-journey.test.ts` (class-features S04, below),
  `contract-conformance.test.ts` (contract-conformance S02 ck1 `8e8c032`, below), `docs-run.test.ts` (NFR-DX made mechanical: executes the
  README's fenced ```ts blocks verbatim AND typechecks them under strict tsc; asserts the
  README's own output lines and the block-count pin; since spells-in-combat S03 ck5 it also
  guards that the README names `settleSpellCasts` and `learnFeat`; since browser-determinism S01 ck4
  (`66af2e8`, CA-B3) its CI honesty pin reads both files: the README must name `pnpm test:browser` and
  `pnpm test:electron` and must no longer call the browser leg a v1.1 follow-up, and `ci.yml` must carry
  the browser matrix and the `- run:` lines for `vitest.browser.config.ts` and `pnpm test:electron`,
  anchored to `- run:` because the header comment names the same strings (S01's R1); since
  contract-conformance S02 ck3 (`bd4f753`, CA-K3) it also checks that the README names
  `tests/proofs/contract-conformance.test.ts`, that the file exists, and that `ci.yml` carries
  `- run: pnpm test` and `- run: pnpm exec vitest run tests/proofs/` (`docs-run.test.ts:241-261`). It
  checks those strings, not the README's prose claims, and README l.595-599 now says exactly that; its
  header and inline comments no longer claim "both directions" (S02 amendment A3 and its R1). `rules-are-data.test.ts`
  proof 3 casts a spell in combat and proof 2 gains a reactive-feat leg (a learned-vs-never-learned
  baseline from pack data only, zero engine diffs).
- **Cross-runtime determinism** (browser-determinism S01 ck1–ck3, `1d929a7`/`da7bc47`/`48bd4b9`;
  FR-1, FR-17, NFR-Determinism):
  - `tests/proofs/determinism-oracle.ts` (CA-B1) is a non-test module that no test glob collects. It
    holds the 9 characterization legs (`LEG_RUNS`), `recordingRaw`, `contentHashOfRaw`,
    `CHARACTERIZATION_DIGESTS`, `PACK_THEMES`, `packRaw` and `PACK_DIGESTS` (raw sha256 +
    `contentHash` for dark-fantasy, zombie-urban and wyldwood at seed 42, default knobs). It imports
    no `node:*` module and does not touch `process`. All 12 64-hex digest literals live there and none
    elsewhere. Consumers: `combat-characterization.test.ts`, `pack-identity.test.ts` (3 tests) and
    `tests/browser/determinism.test.ts` (13 tests; hashes through WebCrypto).
  - **Browser leg (CAP-B2):** `vitest.browser.config.ts` runs `tests/browser/**` plus 5 pure suites
    (`tests/core/{rng,dice,tables}`, `tests/schema/version`, `tests/compiler/themes`) through
    `@vitest/browser@2.1.8` + `playwright@1.62.1`, headless, `screenshotFailures: false`, one engine
    per run (`--browser.name=chromium|firefox|webkit`). `pnpm test:browser` runs all three in sequence:
    6 files, 74 tests per engine. It runs `src/` transformed by Vite, not the shipped `dist/`. The
    Vitest browser server binds port 63315, so only one browser-mode invocation may run at a time.
    `vitest.config.ts` excludes `tests/browser/**`, because Node 18 has no global WebCrypto.
  - **Electron leg (CAP-B3):** `pnpm test:electron` runs `node node_modules/electron/install.js`
    (the binary download is opt-in; no `onlyBuiltDependencies`), then the whole suite with
    `ELECTRON_RUN_AS_NODE=1` under `electron@44.7.0`'s Node 24.21.0 / V8 15.2. `runtime-identity.test.ts`
    (CA-B2) fails when `RULESWRIGHT_EXPECT_RUNTIME=electron` is set outside Electron. Run `pnpm build`
    first, because the `dist/` journeys run here too.
  - devDependencies (exact) gained `@vitest/browser`, `playwright`, `electron` and
    `@types/node@24.19.2` (DD-B13: the `node` type source is in-repo; before it, `tsc` resolved
    `/Users/the.phoenix/node_modules/@types/node@25.5.0` above the repo root, hazard H13). Runtime
    `dependencies` stay empty.
- **Contract conformance** (contract-conformance S02 ck1 `8e8c032`; CAP-K1/K2, CA-K1/K2; FR-14, FR-23,
  FR-2): `tests/proofs/contract-conformance.test.ts` (42 tests) reads the three committed contract files
  with `node:fs` and checks named subjects with `ajv@8.20.0` (`ajv/dist/2020`, `allErrors: true`,
  `strict: false` because strict mode rejects the contracts' style — union `type`, `required` inside an
  `if/then` — not their validity; DD-K2), each after a JSON round-trip:
  - against `pack.schema.json`: the 3 generated bundled packs (seed 42) and the 7 fixture packs;
  - against `snapshots.schema.json`: the oracle's 14 envelopes (`LEG_RUNS`; kinds character, party,
    combat) plus a level-1 character and party per theme;
  - against `override.schema.json`: 2 override documents.

  `leg-3b[0]` carries the negative-hp subject (the wolf at hp −7). An in-memory `minimum: 0` copy of
  the contract rejects it at `/combatants/1/hp` `minimum`, and `hp: 1.5` is rejected at
  `/combatants/0/hp` `type`. Five negative controls each assert `instancePath` + `keyword`. The file's
  re-key rule: a failure is a contract ↔ engine disagreement for a DB re-entry or an engine fix, never a
  looser test. `vitest.config.ts` collects it, so it runs under Node, Electron and CI `test`
  (`ci.yml:54`) and `package` (`ci.yml:94`), not in browser mode. The contracts are repository files,
  not in the npm `files` list. `ajv` is an exact devDependency (`package.json:63`); runtime
  `dependencies` stay absent, and `ajv@6.15.0` remains ESLint's transitive dependency.
- **Old-location refusal** (contract-conformance S02 ck2 `ae5b595`, CAP-K3): `tests/runtime/features.test.ts:87`
  proves that `new Runtime` on a pack carrying `content.classes.warden.features` throws `PackLoadError`
  with exactly `[[E-SCHEMA-02, content.classes.warden.features]]`.
- `.github/workflows/ci.yml` — six jobs:
  - `test`: matrix Node 18/20/22, install → `pnpm build` → `pnpm typecheck` → `pnpm test`
    (`ci.yml:49-54`). Grid-movement S04 ck3 (`c23d563`) put the build before the tests, so the `dist/`
    journeys run on a fresh build. OWNER-M05-CI-ORDER (`fb2bf0e`) moved it before typecheck too,
    because those journeys fail TS2307 on a fresh checkout without `dist/` (B-BD-2, 34 `error TS`
    reproduced locally with `dist/` moved aside).
  - `lint`: Node 22, lint + format:check.
  - `package`: build + isolation + security + `tests/proofs/`.
  - `themes`: the coverage floor.
  - `browser` (`ci.yml:113-132`): Node 22, matrix chromium/firefox/webkit,
    `playwright install --with-deps`, then the browser config.
  - `electron` (`ci.yml:134-150`): Node 22, build, then `pnpm test:electron`.
  - The header comment names exactly the three determinism runtimes and the renderer residual. None of
    this cycle's CI changes has run on GitHub Actions yet (B-BD-1).
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
  `levelSet` down is refused, and an `awardXp` below the set level is accepted with the level and
  feats kept (re-keyed at builder-rulings S02 ck1 `1056f48`; before v1.9 that award lowered the level
  and was refused, F-FP1) → multi-class warden 1 +
  hexer 1 holds two → JSON snapshot round trip, with an over-cap character and party member refused
  → zombie-urban and wyldwood, every class → an unslotted control (`featSlots` stripped) learns all
  4 feats. Negative control (worker-reported): with `learnFeat`'s check removed, legs 2, 6 and 8
  (×2) fail. Since class-features S03 ck2 (`c0a23b1`, ARCH-PRE F-C1) the unslotted leg counts the
  *learnable* feats — those no `progression.*.features[].ref` names — and still asserts 4; it stayed
  green, unedited, after S04 ck3's grant refusal.
- The **rulings journey** (builder-rulings S02 ck3 `4be2a57`, `tests/proofs/rulings-journey.test.ts`,
  9 tests, through the `src` barrels on `generateCampaign({theme, seed: 42})` and a fresh `Runtime`,
  no fixture pack; CAP-R1 is the feature's first narrow journey): legs 1–3, one per theme, cast the
  `mending` spell on an ally wounded by 20 (caster (0,0), ally (1,0), foe (5,0)) and assert one
  `damage:applied` on the ally with `amount = −(d8 face + caster vigor 10)` parsed from
  `why.rolls[0]` and `after = before − amount` → leg 4, per theme, the `maxHp` cap → leg 5 a
  condition with `actions.tagged:casting` blocks every `casting` spell out of combat
  (`restrictedIds('spell')`, `strike` free) and in combat (`declare:rejected {kind: 'restricted'}`,
  `serialize()` unchanged) → leg 6 a level-3 warden keeps level 3 on +100 XP and reaches 4 at
  classXp 6000. Negative controls (worker-reported): a reverted theme line fails legs 1/4; a
  reverted `isRestricted` fails 3 tests; removing `Math.max` fails 4.
- The **class-features journey** (class-features S04 ck1–ck4, `tests/proofs/class-features-journey.test.ts`,
  7 tests, through the `src` barrels on `generateCampaign({theme: loadTheme('dark-fantasy'|…), seed:
  42})` and a fresh `Runtime`, a real `spawnMonster` barrow-wight, nothing mocked; leg 1 is the
  feature's first narrow journey): leg 1 a crypt-warden L3's profile holds the granted `crypt-vigil`
  with `state.feats` absent; the host declares the wight's `grave-gaze` (ARCH-PRE F-C3: `step()`
  does not declare for the monster), `cw.crypt-vigil` is offered, and taking it applies `braced`
  (`why.rule` `content.feats.crypt-vigil`) → its L2 control opens no offer → leg 2 `barrow-rite`
  refused `no-action` at L1 with nothing changed, resolved at L2 → leg 3 medic `rot-read` unknown at
  L2, cast for 2 stamina points at L3 → leg 4 `learnFeat(crypt-vigil)` refused `feat-known`, no slot
  used, held once after a learn-then-grant, dropped by `levelSet` down with only `level:reached` →
  leg 5 the grant is not serialized, is re-derived on restore, and an open offer survives a combat
  snapshot → leg 6 `classFeatures` through the barrel deep-equals the medic L3 rows. Negative
  controls (worker-reported, `cmp`-restored): removing the granted-feats line in
  `profileFromCharacter` fails leg 1; disabling the `learnFeat` grant check fails leg 4 and the
  `feats.test.ts` granted case.
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
  builder-rulings S02 ck4 (`c851de2`) added prose only: out-of-combat restricts follow the combat
  rule (`README.md:332`), a **Healing spells** bullet telling hosts to name the ally (`:340`), "an XP
  award never lowers a level" (`:360`) and the feat-slotted "any class" sentence (`:395`) — still
  4 ```ts blocks; docs-run 3/3.
  class-features S04 ck4 (`64a3231`) added a **Class features** section (`README.md:408-464`,
  between *Spells and feats in combat* and *Equipment & consumables*, one ```json block) and updated
  the `profileFromCharacter` bullet (unlocked actions; reactive feats learned, then granted), the
  known-spells sentence, the Feats bullet (`feat-known` also refuses a granted feat) and the
  *Reactive feats* bullet ("held or granted") — still 4 ```ts blocks (the pin counts the whole
  README, F-C9); docs-run's anatomy check now also asserts `progression.<id>.features` and
  `classFeatures`.
  contract-conformance S02 ck3 (`bd4f753`) added prose only: the negative-hp sentence (`README.md:151-152`),
  "all three sample themes" for the coverage floor (`:579`, was "both"), the conformance sentence
  naming exactly the test's subjects (`:581-586`, amendment A1) and the narrowed docs-run sentence
  (`:595-599`) — still 4 ```ts blocks; docs-run 3/3.
- combat-decomposition S01 ck1 (`17f8f18`) added `tests/proofs/combat-characterization.test.ts`
  (9 legs, the behaviour pin above) and `tests/runtime/combat/module-surface.test.ts` (5); S03 ck2
  (`0c56866`) added the C2 case to `tests/core/tables.test.ts`. No README, docs-run or count pin
  changed. class-features S03 re-keyed the 7 bundled-theme digests (legs 2, 3a, 3b, 4, 6, 7, 8) at
  ck1 and ck2 under CA-C5 — 9/9 normalized leg dumps (`contentHash` masked) `cmp`-equal before and
  after each — and legs 1/5 (`emberMarchesPack`) did not move. browser-determinism S01 ck1 (`1d929a7`)
  moved the leg helpers, the 9 legs and all 18 digest values verbatim into
  `tests/proofs/determinism-oracle.ts` (no re-key: every removed value reappears as an added line), and
  the test now reads `CHARACTERIZATION_DIGESTS`. Every title and non-digest assertion was kept.
- Full gates at contract-conformance close (Orchestrator at `bd4f753`): V1–V7 0; `pnpm test`
  **1017/1017 across 57 files** (974 → 1017: +42 `contract-conformance`, +1 `features` refusal); V9
  `pnpm build && pnpm test:electron` 1017/1017 across 57 files; V8 `pnpm test:browser` 6 files, 74/74 per
  engine (worker-reported; the browser set is unchanged). The contract-conformance final pass re-ran
  V1–V7 fresh at `66d4efe` with the same results.
  (browser-determinism close was 974/974 across 56 files, V8 74/74 per engine; class-features close was 970/970 across 54 files, proofs 99/99 across 13 files; combat-decomposition close was 938/938 across 52 files, proofs 92/92 across 12; builder-rulings close was 923/923 across 50 files, proofs 83 across 11; feat-progression close was
  911/911 across 49 files, proofs 74/74 across 10; action-targeting close was
  878/878 across 48 files, proofs 66/66 across 9; spells-in-combat close was
  829/829 across 44 files, proofs 53/53 across 8; grid-movement close 741/741 across 40 files,
  proofs 47/47 across 7; equipment-consumables close 661/661 across 37, proofs 38/38.)

### OWNER corrections (v1-core: OWNER-01-LINT c5fbb94, OWNER-04-TSCONFIG 77b4108, OWNER-08-BARREL 9afa86c + 32c7ade; loot: FORMAT-RECONCILE 8b802b7; grid: OWNER-CP-POSITIONS 2f3b1d3; equipment-consumables: format residual 8668c53; spells-in-combat: OWNER-M02-HALF 623a687; browser-determinism: OWNER-M05-CI-ORDER fb2bf0e)

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
- OWNER-M05-CI-ORDER (browser-determinism, `fb2bf0e`, `ci.yml` only, +2/−1): the `test` job ran
  `pnpm typecheck` before `pnpm build`, so on a fresh checkout the `dist/`-importing journeys failed
  TS2307. The defect predates this feature and never showed locally, because a local `dist/` always
  exists. S01 reported it (B-BD-2), and the owner correction swapped the two steps. It is proven only
  locally, with `dist/` moved aside; the Actions confirmation is part of B-BD-1.

## Recorded drift & intra-module notes (for the next cycle)

- **Intra-M03 value-import pairs** (re-derived per statement over every non-test file at
  `5c53524` by the class-features final pass — whole `import`/`export … from` statements,
  `import type`/`export type` dropped): `character.ts ⇄ progression.ts`, `character.ts →
  inventory.ts`, `{character, progression}.ts → feats.ts`, `{feats, pools, character-profile}.ts →
  features.ts` and the barrel re-export `index.ts → features.ts` (`features.ts` a leaf; `feats.ts`
  no longer one — class-features),
  `{character, pools, inventory, character-profile}.ts → equipment.ts` (a leaf),
  `character-profile.ts → {inventory, pools, combat/resolve}.ts`, `bestiary.ts → combat/resolve.ts`,
  `encounter.ts → bestiary.ts`, `combat/declare.ts → conditions.ts`,
  `{combat/combat, combat/execute, equipment}.ts → display-roll.ts` (grid-movement leaf; imports
  only `core/dice` types), `snapshots/character.ts → {character, progression}`,
  `snapshots/combat.ts → combat/combat`, `snapshots/{character,combat}.ts → snapshots/envelope.ts`,
  `snapshots/index.ts → snapshots/{character,combat}`, `runtime.ts → {character, progression,
  combat/spatial, events}`, and inside `combat/`: `combat.ts → {triggers, action-economy,
  combatants, declare, execute, fight, movement}`, `fight.ts → {combatants, triggers}`,
  `declare.ts → {spatial, combatants}`, `execute.ts → {resolve, combatants}`, `movement.ts →
  {resolve, spatial, combatants, declare}`, `triggers.ts → {action-economy, combatants, declare,
  execute}` (acyclic). **Record correction (combat-decomposition final pass):** the full
  derivation also shows `character-profile.ts → combat/resolve.ts` (`evalPackFormula`),
  `bestiary.ts → combat/resolve.ts` (`profileFromStatblock`) and `encounter.ts → bestiary.ts`, which
  no earlier list named. None is new: all three are present at `c39ef87`, and no import line
  outside `combat/` and the `snapshots` split changed in `52d4d2a..db38f31`. The `character ⇄ progression` cycle exists
  in code; TypeScript tolerates it because the imported symbols are used lazily. Recorded as
  observed, not as an architecture violation — the cross-module flow is what the architecture
  cares about, and it holds. *(Corrected at the grid-combat pass: the prior record's second cycle
  `combat/triggers.ts → combat.ts` was type-only from creation. **Corrected at the grid-movement
  pass:** the prior record listed `snapshots.ts → {combat/resolve, combat/spatial,
  combat/action-economy}` as value edges; at both `c39ef87` and `6ab880a` those three imports are
  `import type` — snapshots' only combat value edge is `combat/combat`; after the split it is
  `snapshots/combat.ts → combat/combat`.)*
- **Restricts matcher duplication: RESOLVED by spells-in-combat S02 ck1** — combat's
  `restrictionRejection` now calls the exported `matchesRestriction` + `declaredTags`; the inline
  copy is deleted. `isLivePattern` still has no non-test consumer, and it is **kept as public API**
  (combat-decomposition DD-D9, the human's "2 recommend"): it is on the published runtime barrel
  (`index.ts:56`), `conditions.test.ts:78-79` exercises it, and `module-surface.test.ts` pins it in the
  exact barrel list, so removing it would be a breaking surface change. Cleanup C1 retired.
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
- **`MAX_TABLE_DEPTH = 8` duplication: RESOLVED by cross-pin** (combat-decomposition S03 ck2
  `0c56866`, DD-D10, CA-D5). `core/tables.ts:32` and `validate/helpers.ts:544` still both declare
  8, because single-sourcing would need an M01 ↔ M02 value edge and the layering forbids both
  directions. `tests/core/tables.test.ts:226-228` pins them equal
  (`expect(MAX_TABLE_DEPTH).toBe(SCHEMA_MAX_TABLE_DEPTH)`), and its negative control (→ 9) fails
  the case. This follows the EQUIPMENT_SCALARS ↔ RESERVED_GRANT_KEYS precedent. Cleanup C2 closed.
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
  - **R-GM-3** — a resumed walk (`combat/movement.ts` `walk(…, resumed)`) skips the leaving-reach check on its first step out of the paused
    cell (once-only offers, mock-consistent). If re-planning picks a different first step, a
    different threatener is not checked. Owner: the next feature that touches provoke.
  - **`heal` in `EFFECT_VOCABULARY`: CLOSED by action-targeting S03 ck1** (`4c1e1e6`; the
    exact-membership pin in `checker.test.ts`). Cleanup C12 closed.
  - The `evalPackFormula` parse-once debt (grid-combat DD10) grew by one call site (`speed`).
- **spells-in-combat residuals (carried, owners named in its Final Report):**
  - **Out-of-combat restricts asymmetry: CLOSED by builder-rulings** (v1.9, DD-R3, `b9e52e3`):
    out of combat a spell now follows the combat rule. **Still carried:** `spells.tagged:` patterns
    get no load-time tag-integrity check (`helpers.ts` `RESTRICTS_PREFIX`, `cross.ts`), so an
    undeclared tag there loads silently and bites at use. Tightening it is a breaking change under
    the versioning discipline and was not asked. Owner: a future restricts feature, on a human
    decision.
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
    FR-6's "class features" item: CLOSED by class-features (contract v1.10; S03 `c3fc398`..`c0a23b1`,
    S04 `3a49d9f`..`64a3231`; see the class-features decisions and the M01, M03 character-side and
    M04 sections).
  - **DD-S19 consequence:** the DC and attack bonus keep `ctx.vars = effectVars(actor, bound)`, so
    a `targetId` cast's DC sees the primary target's saves and an `at` cast's DC the caster's.
    Every bundled DC is a literal; documented in database.md.
- **action-targeting residuals (carried, owners named in its Final Report):**
  - **`mending` spells: CLOSED by builder-rulings** (human "yes, heal", DD-R1, `4be2a57`): all
    three sites (zombie-urban `bind-the-bite`, dark-fantasy and wyldwood `bind-wound`) heal.
  - **Root-only self actions** (documented v1.7 limitation): `sequence(target(self, …), …)` stays
    an ordinary action that binds an opponent; its inner `self` still resolves to the actor. No
    bundled content is affected.
  - **Stale test comment: CLOSED** — `character-profile.test.ts:381` reads `heal(2 +
    ability(vigor))` since builder-rulings S02 ck3 (`4be2a57`, DD-R7; cleanup C14).
  - **Restricts symmetry: CLOSED by builder-rulings** (DD-R3, above).
- **feat-progression residuals (carried, owners named in its Final Report):**
  - **F-FP1 / F-P3: CLOSED by builder-rulings** (human "no", DD-R4, `1056f48`): `awardXp` never
    lowers a level, so small awards accumulate; the two behaviour pins were re-keyed in the same
    checkpoint.
  - **F-P7: CLOSED as intended behaviour by builder-rulings** (DD-R5): "any class counts" is kept
    and now stated in `database.md` DD-F3 and `README.md:395`. No load warning was added.
  - **F-FP2 / F-P5: FR-6 "class features": CLOSED by class-features** (human answers 2026-10-04,
    DD-C1..C13). Contract v1.10 (`database.md` S01 `8d5828c`, `pack.schema.json` `efa971d`) moves
    the field to `progression.<id>.features`; the validator resolves refs (`checkClassFeatures`, S03
    `c0a23b1`); every bundled ref resolves; the runtime grants feats and unlocks actions/spells via the
    `features.ts` leaf (S04 `3a49d9f`..`64a3231`). (Replaces the earlier note that the row was "in
    neither `pack.schema.json` nor the validator" — both carried it at the old
    `content.classes.<id>.features` location until v1.10; ARCH-PRE F-C11.)
  - **CAP-F1 compiler leg (optional).** The compiler's stage-8 refusal of a malformed `featSlots` is
    proven only by an ad hoc probe (VERIFICATION P1), not by a committed `tests/compiler` case.
  - **Host query (optional, DD-F7 follow-up).** There is no public "slots remaining" query; a host
    learns the cap only through refusals.
- **builder-rulings residuals (carried, owners named in its Final Report):**
  - **F-R6 — mock copy: CLOSED by class-features S05 ck1** (`e5850e2`, Designer re-entry on the
    human's blanket authorization). The earned path is now a level-1 Ald given `awardXp(ald, 6000)`
    → `level:reached warden 4` (`mocks/progression.html:115-128`), and the callout no longer claims
    byte-identical state; VERIFY-01 probe P2 reproduced the events on `dist/`. S05 ck2 (`7298b73`)
    added the `#class-features` panel (l.64-102).
  - **`spells.tagged:` load-time integrity** — carried (spells-in-combat residuals above).
  - **Heal event anatomy (informational, not a defect).** A heal's `damage:applied` carries
    `{amount < 0, type: undefined, hp: 'before→after'}`; the dice face is only in `why.rolls[0]`.
    A host that wants the healed amount reads `-amount`.
  - **`database.md` seed-data drift: CLOSED by class-features S01 ck1** (`8d5828c`). The Seed Data
    paragraph (formerly l.721-722, now l.786) names all three templates, wyldwood included.
- **combat-decomposition residuals (carried, owners named in its Final Report):**
  - **F-D8 — spec drift: CLOSED by class-features S02** (Architect re-entry, `4eb8402`/`b8973ec`).
    `specs/architecture.md` now names `validate/` (`index.ts`, `sections/*.ts`), the `combat/` split
    files, `snapshots/{index,envelope,character,combat}.ts` (tree and the l.232 serializer sentence)
    and the new `features.ts` (l.84); 26 named paths pass `test -e`. ARCH-PRE F-C8 closed with it:
    the `themes/` line lists wyldwood (l.123), and known spells are attributed to `pools.ts`, fed by
    `features.ts` (l.86-87), not `character.ts`.
  - **Architect observations (carried to the next Architect re-entry; overview completeness, not
    drift; Author-owned):** the `architecture.md` tree still omits `src/runtime/{feats, inventory,
    equipment, character-profile, display-roll, errors, index}.ts` and
    `src/schema/validate/{collect,context,dsl,helpers}.ts`; its `character.ts` line (l.82) still says
    "inventory" though that logic lives in `inventory.ts`; and the CI-gates bullet (l.220) says "both
    FR-21 packs" where there are three sample themes.
  - **Behaviour pin (DD-D8).** `tests/proofs/combat-characterization.test.ts` pins raw sha256
    digests of nine scripted legs' whole event + snapshot stream. Since browser-determinism the values
    live in `tests/proofs/determinism-oracle.ts`, which also pins `PACK_DIGESTS` for the three generated
    packs. A bundled-theme or compiler-output change re-keys those under the same rule (DD-B5). A feature that intentionally
    changes combat events (type, order, payload, `why`, `at`) or snapshot JSON lists it in its pin
    audit with a re-key owner (PROGRAM-CONFIG pin-lease convention). A red digest with no planned
    behaviour change is a regression, never a re-key.
  - **`Combat.state` accessor (DD-D3).** `state` is a `get`/`set` pair over `FightCore.state`. The
    setter exists because `movement.test.ts:560` assigns `fight.state`. `pendingTriggers` is the
    core's own array instance.
- **class-features residuals (carried, owners named in its Final Report):**
  - **No refund on grant (v1, documented, DD-C2).** A feat learned before its class grants it stays
    held and keeps its slot.
  - **Old-location refusal at `new Runtime`: CLOSED by contract-conformance S02 ck2** (`ae5b595`,
    CAP-K3). `tests/runtime/features.test.ts:87` is now the dedicated repo test (see M05).
  - **Docs prose unpinned.** CAP-C7 rests on text review; docs-run pins only that the README names
    `progression.<id>.features` and `classFeatures`.
- **browser-determinism residuals (carried, owners named in its Final Report):**
  - **B-BD-1 — GitHub Actions execution: OPEN, non-blocking.** Owner: the human pushes `main`
    (agents never push); the next Orchestrator run or Archivist then records the result. Every command
    in the new `browser` (×3) and `electron` jobs, and in the reordered `test` job, passed locally. None
    has run on Actions. At this pass `main` has not been pushed:
    `git rev-list --count origin/main..6566236` = 204, and 202 at VERIFY-01's `5c62f8d`. The last
    visible Actions run (`dadf461`, 2026-09-27) ended `failure` and predates this feature, so older CI
    drift may surface as well. Since contract-conformance the same `test` (`ci.yml:54`) and `package`
    (`ci.yml:94`) jobs also collect `tests/proofs/contract-conformance.test.ts` (VERIFY-01 `9c8cdc3`: the
    one present-unverified row). Still unpushed: `git rev-list --count origin/main..9c8cdc3` = 217, the
    Final Report's anchored figure, reproduced at this pass.
    - **To clear:** `test` green on Node 18/20/22 (typecheck and the conformance file included),
      `package` green (`tests/proofs/`), `browser` green for chromium/firefox/webkit, and `electron`
      green on `ubuntu-latest`.
    - **If a Linux step fails** (`playwright install --with-deps`, or Electron's shared libraries in
      `ELECTRON_RUN_AS_NODE` mode), that is a mechanical CI owner correction, not a product question
      (H10).
  - **Electron renderer (DD-B3): disclosed residual.** No test runs inside an Electron renderer
    process; the Chromium leg covers its engine family. Owner: a future feature, if a host reports a
    renderer-only discrepancy.
  - **The browser leg runs `src/` through Vite, not `dist/`** (ARCH-PRE F-B6). Node and Electron
    exercise `dist/` through the journeys, and the README and `ci.yml` header disclose it.
  - **README overstated what docs-run checks: CLOSED by contract-conformance S02 ck3** (`bd4f753`,
    CA-K3). The sentence was narrowed rather than the pin widened: README l.595-599 now lists exactly the
    strings `docs-run` checks and ends "it does not check the rest of this prose", and docs-run's header
    and inline comments dropped "both directions". The same claim survives outside that lease in
    `ci.yml:23-24` (H-R1, below).
  - **Clean-checkout typecheck proof (record).** DD-B13's prescribed `tsc --preserveSymlinks` command is
    wrong under pnpm: it cuts off `@vitest/runner` types and exits 2 whatever `@types/node` is. The
    accepted clean-checkout proof is a frozen install, then `pnpm build`, then `pnpm typecheck` in a
    node_modules-free copy outside `$HOME`, with 0 files resolved outside the copy. Reuse that form,
    not the flag.
- **contract-conformance residuals (carried, owners named in its Final Report):**
  - **H-R1 — "both" wording outside this feature's leases (owned residual).** `ci.yml:23-24`'s header
    comment says docs-run "checks both directions"; `ci.yml:111`'s step name says "both themes to the
    coverage floor"; the `tests/compiler/coverage-floor.test.ts:509,582` titles say "both theme(s)".
    There are three sample themes, and docs-run checks named strings only. Owner: Planner, for the next
    feature touching `ci.yml` / `tests/compiler`.
  - **README "nine combat legs"** (VERIFY-01 note). The conformance sentence (README l.582-583) and the
    browser paragraph (l.589-590) call the oracle's nine legs "combat legs"; `leg-8` is a character leg.
    Not an overclaim: the test takes all nine legs. Owner: Planner, for the next feature touching README
    determinism/CI prose.
  - **H11 — `eslint .` lints `.program/` scratch.** `eslint.config.mjs:17` ignores `program/` but not
    `.program/`, so `.ts`/`.js` scratch there turns `pnpm lint` red; Planner's plan-time probe did so at
    this cycle's run start (moved to `/tmp`, no human ask). Owner: a future lease owning
    `eslint.config.mjs`; until then the PROGRAM-CONFIG baseline-hazard convention keeps scratch out of
    the repo.
  - **Byte-level round-trip (record).** Schema conformance does not claim byte-exact round-trip. That
    stays as recorded: proven where the contract requires presence preservation, in
    `tests/snapshots/character.test.ts` (round-trip losslessness l.81; byte-exact cases l.360, l.434).
- **v1.1 follow-ups carried across cycles:** `pnpm approve-builds` advisory for esbuild/tsup; an
  out-of-combat point-pool cast verb (would give wyldwood's charm armor teeth, DD-EG5); item
  `tags` (would let the `use` restriction gate bite). **Closed by contract-conformance:** byte-level snapshot
  conformance, as schema conformance: an independent validator checks named subjects (the generated and
  fixture packs, the oracle's snapshot envelopes plus a per-theme character and party, two override
  documents) against the committed contracts (S02 ck1 `8e8c032`, CA-K1/CA-K2; v1.11 fixed the one
  disagreement it found). Byte-exact round-trip stays as recorded in the contract-conformance residuals.
  **Closed by browser-determinism:** the browser-mode
  Vitest config and CI's browser leg (S01 ck2 `da7bc47`, ck4 `66af2e8`), together with the never-listed
  Electron clause of NFR-Determinism (ck3 `48bd4b9`). **Closed by spells-in-combat:** per-target
  save modifiers (`varsFor`, DD-S19). **Closed by
  grid-movement:** CI `pnpm build` before `pnpm test` (S04 ck3 `c23d563`; now `ci.yml:50`, ahead of
  typecheck too since `fb2bf0e`); the
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
collapsed at the feat-progression final pass (original text recoverable at ad2cbe3); the
builder-rulings SESSION-02 marker (4c74017) was collapsed at the builder-rulings final pass
(original text recoverable at 12ca6ac); the combat-decomposition SESSION-01..03 markers (5a0b764,
576a307, ac39708) were collapsed at the combat-decomposition final pass (original text recoverable
at a2f117f); the class-features SESSION-03 and SESSION-04 markers (c7d517f, de67360) were collapsed
at the class-features final pass (original text recoverable at c915610). -->

<!-- random-adventures SESSION-01 -->
# SESSION-01 architecture delta

- M01 adds `src/schema/play-session.ts`, exported by `ruleswright/schema`: the portable AR-02 encounter setup/options, aggregate snapshot, member/binding/start/selection/control/journal/receipt types, plus located setup/options/snapshot validators. It has no core/runtime imports. Setup validates spatial capacity and the affordable weight bound before assembly draws.
- M03 adds `src/runtime/play/{session,encounter,settlement,snapshot}.ts`. `ruleswright/runtime` exports synchronous `createEncounterSession(pack, options)` and `restoreEncounterSession(pack, unknown)`, and the `EncounterSession`, `EncounterSessionView`, `EncounterCommand`, `EncounterActor`, and `EncounterCommandResult` types. The facade exposes `view`, `dispatch`, and `serialize`; it owns detached pack/member/combat state and stages each revision-guarded command before publication.
- Commands are advance/declare/use/respond/pass/finalize/abandon/next. Stable member/enemy combatant ids, explicit turn-start control, command-scoped journal suffixes and event-time subjects survive JSON reopen. Encounter construction uses the real assembler, profiles, spawn and combat functions with separate generation/play/combat streams; empty setup seeds remain empty. Restore uses current positions and original start profiles/balances, validates the aggregate, then resumes saved RNG words.
- Settlement stages the entire party: terminal paths reuse `settleItemUses`/`settleSpellCasts`; active abandonment uses real inventory mutation plus validated pool/indexed binding settlement, preserving terminal-only low-level APIs. HP, temp bookkeeping, condition duration and resource carryover publish together with a receipt. Raw combat spend remains frozen. Receipt ids use JSON.stringify([sessionId, encounterId, 'settlement']); hashes use packContentHash of `{pack, encounter}`, ordered entry members and ordered resulting members. Current-revision finalize is idempotent; only settled victory permits an explicit next setup. Host persistence must atomically save the entire aggregate; older saves remain independent replay branches.
- Character snapshot writers now include exact signed current HP and nonnegative temp; independent legacy snapshots may omit HP and retain formula reconstruction. Encounter members require HP/pools/slots. `CharacterCombatant` and start entries optionally carry detached conditions; empty-profile shape is preserved. `Combat.pass()` ends the turn through the existing move/end-turn machinery and refuses terminal combat/open offers. `applyCondition` accepts an optional effective duration so item application and emitted duration agree with stacking semantics.
- CAP-01 and CA-01/02 are exercised through fresh built ESM/CJS entry journeys, production settlement/reopen tests and authoritative local-schema conformance. CAP-03/04 receive shared producers only; S03/S04 retain their own consumer/integration proofs. No new module-registry id, package dependency, server, storage adapter or UI is introduced.

<!-- random-adventures SESSION-02 -->

## SESSION-02 — portable adventure generation delta

M01 adds `src/schema/adventure.ts`: portable AdventureTemplate/AdventureDefinition,
start options, identities, graph/reward/policy/narration DTOs and
`validateAdventureTemplate(pack, value)` / `validateAdventureDefinition(pack, value)`.
Its only internal value dependencies are M01 play-session (`validateEncounterSetup`),
version (`packContentHash`), error-card and validation helpers. Schema imports no core
or runtime values. `src/schema/index.ts` exports the portable surface.

M04 adds `generateAdventure({pack, template, seed})` and explicit
`loadAdventureTemplate(id, pack)`, exported from compiler/index.ts. The static registry
contains original dark-fantasy, zombie-urban and wyldwood recipes omitting only pack.
The loader attaches the validated effective pack identity; generation refuses foreign
bindings. Generation uses M02 Rng/rollTable, M01 pack/adventure validators/hash/error
cards, and the existing compiler GenerationError; there is no M04→M03 value edge.

The finite construction rolls base recipes, then declared branch inclusion/descriptors;
mandatory branches consume no inclusion draw. It emits detached JSON with a canonical
definition hash, exact authored encounter setup seeds (including empty strings), and
resolved choices. No existing pack pipeline, content, identity pin or runtime facade
changes. CAP-02/CA-03 generation and JSON boundaries are proved; S03 still owns actual
adventure play/rewards/save integration, and S04 owns director/narration consumption.

The isolation gate now rejects both generateCampaign and generateAdventure in both
runtime formats, requires runtime declarations, and supports an explicit absolute
--fixture-dir for bounded subprocess self-tests. No new module ID, rule ID, dependency,
manifest, build configuration, or runtime-only bundle content was introduced.

<!-- random-adventures SESSION-03 -->

## M03 adventure facade delta — SESSION-03

- `src/runtime/adventure/` adds `createAdventure(pack, definition, options)` and `restoreAdventure(pack, definition, snapshot)`, exported through the runtime entry with `Adventure`, `AdventureCommand`, `AdventureCommandResult`, `AdventureView`, `AdventureSnapshot`, `RewardRoll`, `RewardState`, and `RewardReceipt` types.
- The facade owns detached aggregate state and private staged runtimes. Commands guard outer and nested revisions independently. Encounter entry consumes one generation-stream seed, composes the real encounter session, copies its journal once, automatically settles terminal fights, and stages authored reward rolls in the same transaction. Nested `next` is refused.
- Reward claims invoke real positive `awardXp` and `grantItem`. The adapter preserves exact HP/temp, indexed prepared bindings and existing resources while retaining real progression; incompatible capacity rejects the complete staged transaction. Rest, preparation, equipment and item commands use existing writers. Receipt retries at the current revision are inert.
- Save validation checks definition/pack identity, graph trail and phase, stable party, nested pairing, receipt authority and hash continuity, deterministic saved reward rolls, stream words, event-time subjects and copied nested journal prefix. Aggregate `encounter:settled`, `reward:claimed`, and `members:updated` journal events bind committed member transitions to their durable receipts/hashes. Receipt member IDs remain opaque host IDs, distinct from combatant references.
- Four domain-separated streams, director policy/counters/hash, and narrationAck persist under the approved version-1 envelope. SESSION-04 owns director decisions and acknowledgement dispatch; neither is advertised by the manual facade.
- Production runtime imports no compiler. Built ESM/CJS journeys exercise generated adventures; the shared adventure oracle separately runs source through Vite browsers. JSON is the test host's persistence adapter; no transport/provider doubles or storage service were introduced.

<!-- random-adventures SESSION-04 -->

## SESSION-04 delta through checkpoint 3

- Runtime exports `advanceSolo(adventure, { maxSteps }): SoloResult`. It uses bounded, pure encounter candidates and the same guarded outer/nested dispatch as the host, yielding at player turns/offers, routes, rewards and preparation. Director decisions, mechanical progress hash and its separate tie-breaking RNG commit with the staged adventure transaction and survive JSON reopen.
- Internal `combat/preview.ts` shares declaration/reaction/feat legality with production execution without spending resources or entropy. Manual random-dependent validity remains compatible; solo rejects it before automated play.
- `PendingMove.offeredDepartures` persists exact `{ from, to, reactorId }` history through combat and aggregate snapshots. Absent legacy history retains first-edge suppression; an explicit empty array checks all departures. Resume suppresses only previously offered tuples, permitting a new edge or threatener.
- Narration and acknowledgement remain checkpoint-4 work; no `readNarration` export or acknowledgement dispatch is delivered by this delta.

<!-- random-adventures SESSION-04 c4-c5 -->

# SESSION-04 checkpoints 4–5 delta (lease revision 4)

M03 exports `readNarration(adventure): readonly NarrationMessage[]` and `NarrationMessage` with exactly messageId, sequence, templateId, event and text. `AdventureCommand` adds the approved exact `ack-narration` shape with throughSequence; views advertise it in every phase. Identity/revision guards precede equal no-op handling. A new ack validates and commits revision/cursor only, without appending an event, including terminal phases. Existing snapshot cursor validation/writers are reused unchanged.

`adventure/narration.ts` projects detached committed journal entries using event-time subjects and node context. Authored slots interpolate literal text; missing data and negative damage use factual fallback (healing for negative damage). Reads neither acknowledge nor consume entropy. New value edges: barrel → adventure/narration; adventure/narration → adventure/adventure and adventure/choices. No cross-module edge, dependency, schema change or rule id added.

CA-05/CAP-05 reset proof now covers a real director turn-start resetting explicitly restored below-limit nonzero stalledSteps and exact JSON reopen. B-RA-S04-STALL remains disproved; no reachable production stalemate claim. CAP-06 has real acknowledgement, factual narration and cross-runtime continuation proofs. Existing adventure oracle rekeys are only the new availableCommands entry; removing it reproduces both prior digests. Combat digests remain unchanged from the accepted c2 history delta.

README now executes/types all three host modes; docs-run has 17 tests and negative controls. Final source passes Node/Electron 1447 tests/73 files each, Chromium/Firefox/WebKit 77 tests/7 files each, all fast gates and outside-HOME clean frozen install/build/typecheck with 467 local tsc input paths. Remote Actions B-BD-1 remains with publication owner. Full artifact/source/lock manifests and logs: /private/tmp/ruleswright-s04-final.uhmVPL.
