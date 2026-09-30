# Ruleswright — Architecture Record (v1-core)

> **Realized state as of tree HEAD `c39ef87`** (equipment-consumables close, 2026-09-28; last
> source commit `e5e4846`), synthesized by Archivist (final pass) across **five feature cycles**: v1-core (S01–S08, plan HEAD `53c7c91`),
> **v1-shell** (commits `770950f`–`72346a5` — schema v1.2, class combat actions, the validate/
> directory split, `character-profile.ts`, `combat.sideDefeated`, docs/CI honesty, packaging,
> coverage tooling — first reconciled into this record at the grid-combat pass; its synthesis was the loot-inventory
> pass's unfinished record-debt), **loot-inventory** (S01–S03, tree HEAD `8b802b7`),
> **grid-combat** (S01–S05 + replan + two owner corrections), and **equipment-consumables**
> (S01–S06 + two replans, feature commits `0ee3974`..`c39ef87` — schema/snapshot contract v1.4,
> slot equipment, consumables, the `heal` registry entry, `gear-*` formula scalars, the
> armorCasting cast gate, combat `use` + settlement). Every cycle's mid-run delta fragments were
> collapsed into one module-ordered description. Verified by the equipment-consumables final pass
> on a fresh run at `c39ef87`: `pnpm typecheck` 0 · `pnpm build` 0 (24 dist files) ·
> `check:isolation` 0 · `pnpm test` **661/661 across 37 files** ·
> `pnpm exec vitest run tests/proofs/` **38/38 across 6 files** (lint/format:check/security are
> the Final Report's Orchestrator receive at `e5e4846`, inherited — not re-run by this pass).
> Verified-by-source and verified-by-execution are distinguished below.
>
> *(Process history — crashes, recoveries, dispatch failures, owner-correction mechanics — lives
> in each cycle's Final Report and ARCHIVIST-LOG.md, not here.)*

<!-- Realized-state summary (Archivist synthesis, equipment-consumables final pass) -->

## Module map (as realized)

| ID | Module | Path | Imports (derived mechanically from value imports, incl. `export … from`, excluding `import type`) | Key files |
|----|--------|------|------------------------------------------------|-----------|
| M01 | Schema surface | `src/schema/` | nothing internal | `pack.ts`, `artifacts.ts`, `error-card.ts`, `version.ts`, `overrides.ts`, `validate/{collect,context,dsl,helpers,index}.ts`, `validate/sections/{actions,bestiary,content,cross,economy,progression,root,tables}.ts`, `index.ts` (+ DB-owned `contracts/**`) |
| M02 | Core mechanics | `src/core/` (9 .ts incl. dsl/) | M01 — **type-only** (`DslCheckRequest`/`ErrorCard` in `checker.ts`, `shared.ts`, `dsl/formula.ts`, `dsl/effect.ts`); no runtime value dependency | `rng.ts`, `dice.ts`, `tables.ts`, `index.ts`, `dsl/{shared,registry,formula,effect,checker}.ts` |
| M03 | Runtime | `src/runtime/` (19 .ts incl. combat/) | M01, M02 (value); never M04 | `runtime.ts`, `events.ts`, `character.ts`, `character-profile.ts`, `progression.ts`, `pools.ts`, `inventory.ts`, `equipment.ts` (equipment-consumables leaf), `conditions.ts`, `errors.ts`, `snapshots.ts`, `bestiary.ts`, `encounter.ts`, `index.ts`, `combat/{combat,resolve,action-economy,spatial,triggers}.ts` |
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
core, `./errors` and `./conditions` (its `./runtime`/`./character`/`./events` imports are
`import type`), so none of these closes a cycle. **Record correction (equipment-consumables final pass):** the Final
Report and the S03 arch fragment list only `character`/`pools`/`inventory` → `equipment`; the
`character-profile.ts → {equipment, inventory}` value edges landed at S05 ck1/ck3 (`14c01dc`,
`31540b0`) and were missing from both. Also inside M03: `snapshots.ts → {character, progression}` (`reserveValue`, `buildCharacter`,
`validateBuild`, `Combat`-side `defeatedSide` from `combat/combat.ts`), and
`combat/combat.ts → combat/triggers.ts` (value). **Record correction (grid-combat final pass):** the prior
synthesis listed `combat/triggers.ts → combat.ts` as a second value-import cycle; git shows
`triggers.ts`'s `Combat`/`CombatantState`/`PendingTrigger` imports were `import type` at creation
(`6afbe31`) and remain so — the edge is type-only. `character ⇄ progression` is real.
Guards held at `c39ef87` (re-grepped this pass): no `compiler` reference in `src/runtime` except the CI-checked bundle
rule comment; no `runtime` import in `src/compiler` (grep-asserted in tests). The runtime-only
bundle is **proven** free of `generateCampaign` by `scripts/check-runtime-isolation.mjs`
(passed by this pass on a fresh build; also wired into CI's `package` job).

## Surfaces (what a consumer actually gets — derived, not claimed)

- `ruleswright/schema` — the full M01 re-export: pack/artifact types (incl. `Pack.spatial?`,
  `SpatialDef`, `SpatialReach` — v1.3), `validatePack(json, dslChecker?)`,
  `DslChecker`/`DslCheckRequest`/`deferredDslChecker`, `checkSchemaVersion`, `packContentHash`,
  `MAX_TABLE_DEPTH`, `nearestIds`, overrides API, `ErrorCard`/`makeErrorCard`/`RULE_IDS`
  (15 ids, `E-SPAT-01` last — v1.4 added no rule id). v1.4 (equipment-consumables): `Pack.equipSlots?`,
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
  `SnapshotEquippedEntry`, and the `Character` facade's `equip`/`unequip`/`useItem`. **M03 barrel completed at v1-core S08**
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

## Cross-cutting decisions (accepted across the five cycles)

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
documented v1 answer, README-documented; an approved `move()` is an api-map product decision.
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
mechanic, so a gap can never close); skip actions must be **reach-neutral** in spatial packs.
**DD17** combat `declare()` resolves actions **only** from `pack.actions` — generated packs'
`content.spells` are not combat-declarable (no `bindSpell` symbol exists; the binding surface is
`prepareSpell`); the journey proves bursts through pack data added at test setup (FR-12
rules-are-data discipline, zero engine diffs); a "spells as combat actions" bridge is an engine
design event (Author/DB re-entry class) for a future program; `declare()` returns
`events.sinceRound(round)` (the round's window — resumed-leg assertions need a fresh sink).

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
casting has no cast verb (DD17a), so wyldwood's charm armor is validation-only content.
**DD-EG6/6a** `fight.use` draws on host-stated `balances.items` (fixed `itemBalances`, spent
`itemsUsed`), is not a slot action, gate 0 copies `declare`'s phase/turn rule; the host calls
`settleItemUses` after `combat-over` to drop the spent units — idempotent **per live fight
object** only (R-4, documented v1 limit). **DD-EG7** snapshot fields `equipped` (presence-
preserving, validated restore), combatant `itemsUsed` (spent) and `maxHp` (snapshot →
`profile.maxHp` → `max(0, profile.hp)`); `schemaVersion`/`snapshotVersion` stay 1. **DD-EG8**
theme content reuses existing item ids only. **DD-EG9** the dist-built equipment journey.

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

### M02 — DSL compiler (v1-core S03 via RECOVERY-03, 4e188fa/dff30e6/7eff106/168d71a; validity gate in grid-combat S03; heal + gear scalars in equipment-consumables S02)

Module `src/core/dsl/` — value imports only `../rng`, `../dice`; schema imports are type-only
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
- `effect.ts` — `parseEffect`; `executeEffect(ast, ctx)` pure interpreter; ctx
  `{actor, targets, rng, apply: EffectApply, vars}`; `EffectApply = {resolveTargets, damage,
  condition}` is the mutation seam; save-for-half: `damage(half)` re-rolls the fail branch's
  first damage expr, total = ceil(half), inherits type. (Known gap: per-target save *branches*
  are executor-native; save *modifiers* are not — recorded residual debt.)
- `registry.ts` — frozen registry, **13 entries** since equipment-consumables S02: `heal: {arity:
  1, kind: 'effect', signature: ['formula']}` after `damage` (the sanctioned schema event bundled
  in contract v1.4); `EFFECT_VOCABULARY` unchanged; exact-membership freeze test re-keyed 12→13.
  `executeEffect` runs `heal(f)` as `apply.damage(target, negatedRoll)` — the whole RollResult
  (values, modifier, total) negated with purpose `'heal'`, yielding `DamageOutcome {roll,
  halved: false}`; the executor never clamps (the cap is the host's, CA-EG4).
- `shared.ts` — one lexer both grammars; `MAX_PARSE_DEPTH = 24`, `MAX_EXPR_LENGTH = 512`;
  `nearestName`; `dslCard`.

### M03 — Runtime I: character side (v1-core S04 via RECOVERY-04, 23f9918/4ead08b/db7eebb/b961053/d0240e6; profileFromCharacter + sideDefeated in v1-shell; inventory in loot S01; equipment in equipment-consumables S03/S05)

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
  split; best-of saves; additive slots; tableLevelCeiling clamp.
- Restricts matcher: `matchesRestriction(pattern, kind, tags, declaredTags)` — exact
  `actions.tagged:`/`spells.tagged:` prefix, tag must be pack-declared; `isLivePattern(runtime,
  pattern)`; `declaredTags(runtime)`. **Reconciled:** S05's combat declares do NOT call these
  helpers — `combat.ts`'s `restrictionRejection` re-consults the pack index inline
  (actions-only at declare-time; the validator enforced restricts integrity at load). The
  helpers remain character-side surface with no non-test consumer (cleanup-tracked).
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

### M03 — Combat engine (v1-core S05, 6efaa16/c7a2d44/6afbe31/4be9e6c; spatial integration in grid-combat S03; item use in equipment-consumables S05)

- `combat/action-economy.ts` (CA-4) — `resolveSlotGrants(pack)` (declared `economy.turnSlots`
  authority; absent → documented default 1-of-each-cost-slot-name); `checkCost`; per-turn
  `SlotLedger` transients (`freshLedger/replenish/spend/refund`; never character state).
  equipment-consumables S05: `EconomyBalances.items?` — host-stated item charges, like
  `pools`/`boundSlots`.
- `combat/resolve.ts` (FR-3) — `parsePackEffects`/`checkPackDsl` (parse-once + load-time check);
  `profileFromStatblock` — the one combatant constructor for characters and monsters;
  `attackBonusAgainst` (`byDefense[String(v)]` literal lookup); `attackRoll` (verdict-attached);
  `executeAgainst` (per-target vars, ordered roll history for `why.rolls`). grid-combat S03
  added the optional 6th param `resolveShapeTargets?: (shape) => readonly string[]` — the CA-G4
  edge replacing the bound-target `resolveTargets` stub; combat injects it per execution.
  equipment-consumables S05: `CombatantProfile.maxHp?` (the heal cap; `profileFromStatblock`
  sets it to the evaluated `hp`); `checkPackDsl` also checks `content.items.<id>.use` as an
  effect (R-7).
- `combat/combat.ts` (FR-10/13) — `startCombat(runtime, {allies, enemies, rng?})`; `Combat`
  `step()/declare()/respond()/serialize()/eventsSince()/roundComplete`; initiative from the
  reserved formula or d20 fallback (CA-6); events emitted as CA-3 rows only; `displayRoll` =
  combat-loop.html roll anatomy. Declare gates ordered: no-action → not-yours → restricts →
  target → cost → spend. grid-combat S03 integrated the spatial layer: `StartCombatRequest
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
  targets and never rejects.
- `combat/triggers.ts` (FR-4/13) — pattern grammar `<type>`, `[target=self]`, `[actor=self]`;
  `offersForEvent`/`respond`; taken triggers ride the same pipeline as declares. **Edge note
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
`../core/{dsl/effect,dsl/formula,rng}`, `./errors`, `./conditions`; `./runtime`, `./character`,
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
`why.rolls` strings come from a private `rollText` — a copy of combat's `displayRoll` anatomy
without the verdict suffix, because the leaf may not import `combat.ts` (cleanup-tracked, C8).

### M03/M05 — Snapshots + root surface (v1-core S06, f1af841/9e18ee2/daac7b7/a6d89ff/bb01e92; positions in grid-combat S03; sideDefeated in v1-shell)

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
  restore stays verbatim (CA-01 divergence).
- Envelopes are snapshots.schema.json verbatim (`additionalProperties: false`); field mapping:
  classXp→classes[].xp, spells→knownSpells, conditions {id, remaining}, bindings slots, pools,
  inventory []. Load discipline (CA-1): identity gate BEFORE any application (kind + pack.id +
  schemaVersion + contentHash → E-SNAP-01; snapshotVersion ≠ 1 → E-SNAP-02); no state mutated on
  refusal. Combat restore takes the sides/profiles explicitly (`CombatRestoreRequest`).
- M05 `src/index.ts`: dumb `export *` from './schema' | './runtime' | './compiler'.

### M04 — Compiler + themes (v1-core S07, 116fc7e/01af260/786923b/1676c42/5d30d2f/3faf836; items+wyldwood in loot S02; spatial pass-through in grid-combat S04; equipSlots + equipment content in equipment-consumables S04)

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
  `fire-axe` `{might:1}`, `med-kit` `use: heal(2 + vigor)` (heals 2 — the vigor **save**
  shadows the ability in effect scope; carried content-semantics question); wyldwood `[charm]`,
  `hedge-charm` `{ac:1, armor:1}` (validation-only: point-pool casting has no gate). Nothing
  equipped ⇒ values byte-identical to pre-v1.4 (docs-run block-03 `hp: 27, ac: 12` unchanged).
  Byte-identity proofs (CA-5): equal hash + equal bytes, different-seed divergence, in-process
  AND across fresh module loads; no ambient values.
- FR-21 conformance: `tests/compiler/coverage-floor.test.ts` (82 tests since
  equipment-consumables S04 — the FR-17/CA-1 generate→validatePack dogfood path sees the spatial
  and equipment sections on all three packs and produces zero cards; CAP-G6/CAP-E6 evidence,
  plus a CA-EG3 content-pairing assertion).

### M05 — Packaging, CI, proofs, docs (v1-core S08, 02752a9/8f67611/9afa86c/32c7ade/d5bacba; v1-shell packaging/docs/CI/coverage; loot S03; grid S05; equipment-consumables S06)

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
  below), `docs-run.test.ts` (NFR-DX made mechanical: executes the
  README's fenced ```ts blocks verbatim AND typechecks them under strict tsc; asserts the
  README's own output lines and the block-count pin).
- `.github/workflows/ci.yml` — matrix Node 18/20/22 × typecheck/lint/test + determinism suites;
  package job (build + isolation + security + proofs); themes job (coverage floor); lint + format
  checks on every push. The browser-mode determinism leg is documented as a v1.1 follow-up (honest
  CI, DOCS-CI-01..03). **Known gap (inherited hazard (f), carried with an owner):** the `test`
  job runs `pnpm test` with no `pnpm build`, while `loot-journey` and `equipment-journey` import
  `dist/` — only the proofs job builds first; local receives build before the suite.
- The first narrow **grid journey** (grid-combat S05, `tests/proofs/grid-journey.test.ts`,
  11 tests): generate (dark-fantasy, seed 42) → `new Runtime` (stage-8 load gate) → host
  positions → adjacency reject (serialize-identical no-change) → restore-close distance (the v1
  movement seam) → burst multi-target with mixed per-target save branches (out-of-radius
  untouched) → validity in/out pair → mid-fight snapshot → JSON → restore with gates
  re-enforced → 10-combatant spatial perf budget → seeded two-run determinism (byte-equal) →
  wyldwood theater-parity capstone. No mocked boundary anywhere. The burst rides as **pack data
  added at test setup** (data-only action, generated spell's verbatim cost + effect — FR-12
  rules-are-data; zero engine diffs) because `declare()` resolves actions only from
  `pack.actions`: generated packs' `content.spells` are not combat-declarable (CA-G4
  consumer-shape amendment need recorded — a "spells as combat actions" bridge is an engine
  design event, not a test defect).
- The **equipment journey** (equipment-consumables S06 ck1 `dd6557c`,
  `tests/proofs/equipment-journey.test.ts`, 10 tests, every import from `../../dist/*.js`, seed
  42, nothing mocked): dist freshness (new symbols + generated `equipSlots`) → zombie-urban: equip
  `riot-plate`/`fire-axe` (exact ac/might shift) → out-of-combat `med-kit` heal (clamp) →
  `fight.use` (clamp, provenance) → mid-fight snapshot/restore (`itemsUsed`, `maxHp`) →
  `no-charges` → `settleItemUses` (inventory asserted after the fight; second settle `[]`) →
  character snapshot + tamper refusal → dark-fantasy: hexer in leather refused, unequip casts,
  warden casts in mail.
- README: quickstart blocks 01–04 (generate / character / one combat round / loot) — block 03
  passes host-declared `positions` (grid S05; `d20[9]=9 < ac12` unchanged — positions consume no
  RNG, proved by run); block 04 loot (observed `[{ id: 'grave-ward', qty: 1 }]`). A **Grid
  combat** section documents the FR-11 opt-in (```json spatial snippet, Chebyshev mechanics,
  E-SPAT-01, burst semantics, vancian vs pool casting, the no-move-verb/FR-10 restore seam, the
  journey cited for NFR-DX). v1-shell documented `pnpm test --coverage` and the honest CI claims.
  equipment-consumables S06 ck2 (`e5e4846`) added an **Equipment & consumables** section (a
  ```json content excerpt and a plain-fenced expected-output block — no new ```ts block, so the
  docs-run pin stays at 4) documenting slots, grants/`gear-*`, heal clamp, armorCasting's
  slot-only scope, `fight.use`, the R-4 settle-once limit, and the med-kit save-shadowing.
- Full gates at equipment-consumables close (Orchestrator receive at `e5e4846`): typecheck 0;
  lint 0; format:check 0; build 0; isolation 0; security 0; `pnpm test` **661/661 across 37
  files**; proofs 38/38. Re-run fresh by the final pass at `c39ef87`: typecheck 0, build 0 (24 dist
  files), isolation 0, 661/661 (37 files), proofs 38/38 (6 files).

### OWNER corrections (v1-core: OWNER-01-LINT c5fbb94, OWNER-04-TSCONFIG 77b4108, OWNER-08-BARREL 9afa86c + 32c7ade; loot: FORMAT-RECONCILE 8b802b7; grid: OWNER-CP-POSITIONS 2f3b1d3; equipment-consumables: format residual 8668c53)

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

## Recorded drift & intra-module notes (for the next cycle)

- **Intra-M03 value-import pairs:** `character.ts ⇄ progression.ts`, `character.ts →
  inventory.ts`, `{character, pools, inventory, character-profile}.ts → equipment.ts` (a leaf),
  `character-profile.ts → inventory.ts`, `snapshots.ts → {character, progression, combat/combat, combat/resolve,
  combat/spatial, combat/action-economy}`, `combat/combat.ts → combat/triggers.ts`. The cycle
  exists in code; TypeScript tolerates it because the imported symbols are used lazily. Recorded
  as observed, not as an architecture violation — the cross-module flow is what the architecture
  cares about, and it holds. *(Corrected at the grid-combat pass: the prior record's second cycle
  `combat/triggers.ts → combat.ts` was type-only from creation.)*
- **Restricts matcher duplication:** S04's `matchesRestriction`/`isLivePattern`/`declaredTags`
  (full pattern grammar, both families) vs combat's inline `restrictionRejection`
  (actions-only re-consult). The helpers have no non-test consumer (grep at `c2a8fff`:
  definition + barrel re-export only; re-verified at `c39ef87`). Cleanup-tracked.
- **`rollText` duplicates `displayRoll`** (equipment-consumables): `equipment.ts:352` re-implements
  combat's roll anatomy (minus the verdict suffix) because the leaf may not import `combat.ts`.
  Moving `displayRoll` to a leaf (e.g. beside `core/dice`) lets both share it. Owner: the next
  runtime-touching feature's planning (Final Report ledger). Cleanup-tracked (C8).
- **Effect-scope name shadowing** (equipment-consumables S05): saves shadow same-named abilities
  in effect scope, so zombie-urban's `med-kit` `heal(2 + vigor)` reads the vigor save and heals
  2. The README states it; the resolution is a carried content/semantics decision.
- **`useItem` condition-duration display** (equipment-consumables S03): a `condition:applied`
  event raised by `useItem` reports the pack-default duration even when the effect overrides
  it. Carried to the next runtime-touching feature (display accuracy).
- **`parsePackEffects` has no consumers:** grep at `c2a8fff` — defined in
  `combat/resolve.ts`, zero src or test references. The grid journey's burst finding made the
  gap concrete: combat `declare()` resolves actions only from `pack.actions`, so the parsed
  spell ASTs have no reader. Either the future "spells as combat actions" bridge consumes it or
  it is dead code pending that decision. Cleanup-tracked alongside the restricts matcher.
- **`MAX_TABLE_DEPTH = 8` duplication:** `core/tables.ts` and `validate/helpers.ts` both define
  8. database.md v1.2/v1.3 prose records the engine-side ratification ("bounded at load;
  deeper → E-TBL-01") and both constants are test-pinned. Single-sourcing it is in the
  duplicated-logic cleanup brief (ARCHIVIST-LOG 2026-09-28, with C1 and C8); a naive
  schema-re-exports-core fix would break M01's import-nothing-internal rule.
- **`WYLDWOOD` surface export:** defined + re-exported (`theme-loader.ts`, `compiler/index.ts`),
  no other src/test reference — the consumer story is the `loadTheme` registry (hosts load by
  name). Same class as the existing `readPatch`/`EventSeed`/`EventSink` surface-intent
  candidates. Cleanup-tracked.
- **Declare gate order (grid-combat, S03):** validity gate → spatial reach gate → cost (validity
  before spatial so the out-of-reach `hasTarget(adjacent)` rejection stays observable); recorded
  in the source comment.
- **Spells are not combat-declarable (grid-combat, S05 finding):** `declare()` resolves actions
  only from `pack.actions`; `parsePackEffects`' spell ASTs have zero consumers. Generated packs
  ship burst shapes only as `content.spells`. The "spells as combat actions" bridge is an engine
  design event (Author/DB re-entry class) — the journey proves bursts through pack data at test
  setup in the meantime.
- **Dice/Rng on the runtime surface:** not exported (see Surfaces above) — the README's "dice"
  bullet is satisfied by the engine's injectable seam + snapshots, not by exported dice symbols.
  Next surface revision decides.
- **E-SPAT-01:** RESOLVED (was: unregistered typed `pendingId`) — registered in database.md v1.3
  and `RULE_IDS` (15 ids), `pendingId` → `rule: 'E-SPAT-01'` switched with zero remnants.
- **Movement verb:** still the feature's one open product question for the human (DD1); the
  serialize → restore-with-updated-positions seam is the documented v1 answer and is
  README-documented.
- **v1.1 follow-ups carried across cycles:** browser-mode Vitest config (CI's browser leg);
  byte-level snapshot conformance; `pnpm approve-builds` advisory for esbuild/tsup (CI's job on
  first run); first real CI run on next push; `pnpm build` before `pnpm test` in CI's `test` job
  (equipment-consumables hazard (f)); a point-pool cast verb (would give wyldwood's charm armor
  teeth, DD-EG5/DD17a); item `tags` (would let the `use` restriction gate bite).

<!-- Historical delta sections (pre-synthesis, kept in git history for provenance): the
Orchestrator-integrated markers loot-inventory SESSION-01 through grid-combat SESSION-05 were
collapsed at the grid-combat final pass (original text recoverable at b671a37); the
equipment-consumables SESSION-02..05 markers (f1563b1, 643fd76, 7c3db75, 7a479e6) were collapsed
at the equipment-consumables final pass (original text recoverable at c39ef87). -->

<!-- grid-movement SESSION-02 -->
## grid-movement SESSION-02 delta (Orchestrator mid-run append; commits 21a0a5f..933c2fd)


### M01 Schema (`src/schema/`)

- `pack.ts`: new `export type TerrainKind = { cost: number } | { blocks: true }`.
  `SpatialDef.model` widens `'grid'` → `'grid' | 'hex'`.
  New `SpatialDef.terrain?: Readonly<Record<string, TerrainKind>>` (v1.5; cells are host-placed per fight).
- `validate/sections/root.ts` `checkSpatial`:
  - accepts `model ∈ {grid, hex}`; anything else is `E-SPAT-01` at `spatial.model`, naming `{grid, hex}`;
  - the closed key set gains `terrain`;
  - a private `checkTerrain` sends a non-object terrain, a non-kebab kind id, or a value other than exactly `{cost: int ≥ 1}` or `{blocks: true}` to `E-SCHEMA-01` at `spatial.terrain[.<kind>]`.
- `validate/sections/cross.ts`: new export `checkMovementDsl(ctx: Ctx, doc: Record<string, unknown>): void`. It is a pass-3 cross check, dispatched from `validate/index.ts` after `checkRestrictsTags`. It is text-level; M01 still imports no core value.
  - A root `move(` in a triggered action, a spell/feat `effect` or an item `use` → `E-FORM-02`.
  - `speed` at a formula position while `formulas` is readable and has no `speed` → `E-REF-01`, one per field. This is a position-aware scan. `NON_FORMULA_ARGS` = `{damage:[1], applyCondition:[0], target:[0], save:[0]}` and mirrors core `ARG_CATEGORIES`.
- No new rule id; `RULE_IDS` stays 15.

### M02 Core (`src/core/dsl/`)

- `registry.ts`: `REGISTRY.move = {arity: 1, kind: 'effect', signature: ['formula']}` (13 → 14). `EFFECT_VOCABULARY` gains `'move'`.
- `effect.ts`:
  - `EFFECT_SCALARS` = `['level','hp','ac','initiative','speed']`.
  - `EffectApply.move?(budget: number): void` is optional; an absent host means no movement support.
  - New `MoveOutcome {kind: 'move', budget}` joins the `EffectResolution` union.
  - The executor's `move` evaluates the budget and calls `apply.move` once. It throws when `apply.move` is absent (fail-closed).
  - `checkEffectAst` threads `atRoot`: a nested `move` → `E-FORM-02`, and any dice node in `move`'s argument → `E-FORM-02`. `ARG_CATEGORIES.move = ['formula']`.

### Edges

No new module or edge. M02→M01 stays type-only, and M01 imports no core value (`check:isolation` 0).

<!-- grid-movement SESSION-03 -->
## grid-movement SESSION-03 delta (Orchestrator mid-run append; commits ea4e308..27c77f4)


No new module, no new cross-module edge, no new rule id. One new runtime leaf file.

### `arch/v1-core.md:163` — offer surfacing (F-P1, DD-M10)

`resolve()` still returns the round window (`events.sinceRound(round)`), and so do
`declare()` and `respond()` (unchanged public return values). **Offers, however, are
surfaced only for the events the current call emitted**: `declare` and the reactive
resolution behind `respond(…, 'take')` collect their own events with a per-call sink
(`Combat.collect`, the `execute()` idiom) and feed only those to `surfaceOffers`; `use`
already surfaced per call. `surfaceOffers` also skips any event it has already surfaced
(a facade-side `WeakSet<RuntimeEvent>`, not combat state), so each (reactor, event) pair is
offered exactly once. Offers raised inside a movement walk are surfaced when they are raised.
After the only offer is taken or declined, `pendingTriggers` is `[]`.

### Public API delta (`ruleswright/runtime`)

- `combat/spatial.ts`: `hexGeometry(model)` (axial, DD-M2; `canReach` keeps
  `≤ max(reach, defaultReach)`, DD-M14); `SpatialGeometry.model?: 'grid' | 'hex'` and
  `SpatialGeometry.neighbors(p)` (grid: 8, counter-clockwise from east; hex: the pinned 6;
  theater: `[]`); `spatialFromPack` dispatches on `spatial.model`; `TerrainCell {at, kind}`;
  `PathQuery`; `PathResult`; `findPath(geometry, query)` (region-bounded exact Dijkstra,
  DD-M18; kinds `blocked` → `occupied` → `unreachable` → `out-of-range {cost}`);
  `terrainAt(vocabulary, cells)` and `entryCost(kind)`; `MoveRejection`
  `{kind: no-destination|blocked|occupied|unreachable|out-of-range, rule: 'E-SPAT-01'}`.
- `combat/combat.ts`: `DeclareOptions.to?: Position`; `StartCombatRequest.terrain?`;
  `CombatState.terrain: readonly TerrainCell[]` (`[]` when none; every `serialize()` now
  carries it); `CombatantState.speed?`, `CombatantState.pendingMove?`; `PendingMove
  {actionId, to, remaining}`; `DeclareRejection` gains `MoveRejection`. startCombat's
  E-SPAT-01 aggregate now also carries terrain refusals (unknown kind `terrain[i].kind`,
  duplicate cell `terrain[i].at`, combatant on a blocking cell `positions.<id>`).
  Events: `move:leaving-reach` (actor mover, target threatener, `{at, next}`),
  `move:advanced {from, to, path, cost, remaining}`, `move:ended {reason, at}` — all with
  `why.rule = actions.<moveActionId>`. `step()` while a move is paused emits
  `move:ended {reason:'forfeited'}` before `turn:ended`. `respond()` resumes a paused move
  when the offer queue empties and returns its events plus the resumption events.
  `displayRoll` is re-exported from the new leaf.
- `combat/resolve.ts`: `CombatantProfile.speed?` (only when `formulas.speed` is declared);
  `executeAgainst(…, resolveShapeTargets?, move?)` — `move` becomes `apply.move`;
  `effectVars(actor, target)` (the executor's per-target vars, `speed` = `profile.speed ?? 0`).
- `character-profile.ts`: `profileFromCharacter` emits `speed` only when `formulas.speed` is declared.
- `equipment.ts`: `useItem` binds `speed` (the pack's `speed` formula over the equipment
  scope, else 0); the private `rollText` is gone (uses `displayRoll`).
- `snapshots.ts`: `CombatRestoreRequest.terrain?` (host re-states; same refusals as
  startCombat, paths `restore.terrain[i].kind|at`, `restore.<id>.position`);
  `SnapshotCombatant.pendingMove?` (only when set; unknown/non-move `actionId` → E-SNAP-01
  at `combatants[i].pendingMove.actionId`). **Derived restore phase:** `combat-over` if a
  side is defeated, else `resolved` if any combatant carries `pendingMove`/`pendingTrigger`,
  else `awaiting-declare`. A restored offer's `matchingEvent` is the pattern's event type
  (base before `[`).
- New leaf `src/runtime/display-roll.ts` (`displayRoll`; imports only `core/dice` types).
  Value-import edges: `combat/combat.ts → display-roll.ts`, `equipment.ts → display-roll.ts`
  (equipment stays a leaf apart from this leaf). Intra-module helper exports not in the
  barrel: `copyTerrain`, `terrainRefusals`, `moveBudgetAst` (combat.ts → snapshots.ts),
  `effectVars` (resolve.ts → combat.ts).

<!-- grid-movement SESSION-04 -->
## grid-movement SESSION-04 delta (Orchestrator mid-run append; commits 40c4492..c23d563)


- **M04 theme content (CA-M6):** all three bundled themes declare `formulas.speed` (`{expr}` form), a move action (tag `move`, cost `{slots:{move:1}}`, effect `move(speed)`) and a leaving-reach reaction (cost `{slots:{reaction:1}}`, trigger `move:leaving-reach[target=self]`, effect = the theme's own melee sequence), appended in that order to **every** class `actions` list and **every** bestiary statblock `actions` list, plus a `spatial.terrain` vocabulary (one `cost: 2` kind, one `blocks: true` kind).
  - dark-fantasy: `stride` / `opportunist`; terrain `rubble {cost:2}`, `pillar {blocks:true}`; model `grid`.
  - zombie-urban: `hustle` / `cheap-shot`; terrain `debris {cost:2}`, `barricade-wall {blocks:true}`; model `grid`.
  - wyldwood: `glide` / `bramble-snap`; terrain `bramble {cost:2}`, `standing-stone {blocks:true}`; model **`hex`** (DD-M3).
  - No compiler source change: `pipeline.ts` passes `spatial`/`formulas` through verbatim; stages copy actions, classes and statblocks. Adding actions consumes no generation RNG (README quickstart block 03 output unchanged).
- **README "Grid combat" (documented surface):** the "There is no move verb in v1" paragraph is replaced by a "Movement, hex and terrain" subsection: move actions as pack data, `speed`, `declare(id, {to})`, grid vs hex geometry, host-placed terrain + refusals, occupancy, the five `E-SPAT-01` rejection kinds, leaving reach with pause/resume/forfeit, snapshot `pendingMove` + derived `resolved` restore phase. The restore-with-updated-positions seam is kept as the host's out-of-rules teleport. The dark-fantasy spatial example now shows its `terrain`. The movement journey `tests/proofs/movement-journey.test.ts` is cited. Still exactly 4 ```ts blocks.
- **CI:** the `test` job runs `pnpm build` before `pnpm test` (the loot/equipment journeys read `dist/`).
