# SESSION-03 — Character verbs: equip/unequip/use + grants composition + armorCasting gate

> **Program:** Ruleswright
> **Feature:** equipment-consumables
> **Modules:** M03
> **Depends on:** SESSION-02 (types `ItemDef.grants/slots/use`, `Pack.equipSlots`, `RESERVED_GRANT_KEYS`; the `heal` executor; `EQUIPMENT_SCALARS` and the unbound-is-0 evaluation)
> **Concurrent with:** SESSION-04. The leases are disjoint, verified path by path: this session writes only the `src/runtime/*.ts` files listed in Owns, `tests/runtime/fixtures/**` and four `tests/runtime/*.test.ts` files. S04 writes only `src/compiler/theme.ts`, `src/compiler/pipeline.ts`, `src/compiler/themes/*.json`, `tests/compiler/pipeline.test.ts` and `tests/compiler/coverage-floor.test.ts`.
> **Owns:** `src/runtime/equipment.ts`, `src/runtime/character.ts`, `src/runtime/pools.ts`, `src/runtime/inventory.ts`, `src/runtime/runtime.ts`, `src/runtime/index.ts`, `tests/runtime/fixtures/**`, `tests/runtime/equipment.test.ts`, `tests/runtime/character.test.ts`, `tests/runtime/pools.test.ts`, `tests/runtime/inventory.test.ts`
> **Reads:** `src/runtime/conditions.ts`, `src/runtime/errors.ts`, `src/runtime/events.ts`, `src/runtime/progression.ts`, `src/runtime/snapshots.ts`, `src/runtime/combat/resolve.ts`, `src/core/dsl/effect.ts`, `src/core/dsl/formula.ts`, `src/schema/artifacts.ts`, `src/schema/pack.ts`, `tests/schema/fixtures.ts`
> **Resources:** —
> **Checkpoints:** 4

## Module Context
| ID | Module | Read | Why |
|---|---|---|---|
| M03 | Runtime | write | The verb layer, the facade, derived composition, the cast gate, the inventory guard, and the parse-once item index |

## Context

S02 landed the types and the DSL changes. S04, running in parallel, lands theme content you never read: your tests use fixtures, not themes. This session is the character-side column of the feature:
- equip and unequip over declared slots;
- grant composition into derived stats (F-E2 option (b));
- the armorCasting cast gate;
- out-of-combat consumable use.

Every verb follows `inventory.ts`'s discipline exactly: validate with named `ruleCard` rejections, mutate in place, emit one provenanced event. A rejection leaves no durable change.

**`equipped` stays absent until the first equip (F-E5).** `CharacterState.equipped?` is optional, and absent means `[]`.
- `buildCharacter` (`progression.ts`) is **not** changed, and you do not own it.
- `equipItem` creates the array lazily.

The reason: `snapshots.ts:140-156` serializes and `:296-327` restores an explicit field list that S05 extends later. A `buildCharacter` that set `equipped: []` would break the round-trip equality asserts at `tests/snapshots/character.test.ts:87` and `:165` and at `tests/proofs/loot-journey.test.ts:126` until S05 lands. That would be a planned red window, which is forbidden.

**Fixture duty:** you own the shared runtime fixtures (`tests/runtime/fixtures/**`). Extend them additively:
- `equipSlots`;
- an armor item;
- a weapon with an ability grant;
- a consumable with `use`.

S05 reads them. `tests/runtime/fixtures/pack.ts` builds on `tests/schema/fixtures.ts`'s `VALID_PACK`, which you only read. Add fields in `pack.ts`/`packs.ts` after the clone. Existing consumers must stay green unchanged. Do **not** change existing fixture formula strings: the ascending/descending proofs build their own in-test packs (structuredClone plus assigned formulas).

## Capabilities

- **CAP-E2:** equip/unequip over slot state; grants compose into `derived()`. Integration: ck2. Closing proof, run in both directions:
  - **Ascending fixture:** `ac: '10 + gear-ac'`.
  - **Descending fixture:** `ac: '12 - floor(level / 3) - gear-ac'`.
  - In each, equipping `grants: {ac: 2}` moves `derived().ac` by exactly 2 (+2 ascending, −2 descending). Unequipping restores the base byte-exactly.
  - Same checks for `hp` (`+ gear-hp`) and for an ability grant (`might: 1` adds 1 to the `might` used by an `attackBonus` formula).
- **CAP-E3:** armorCasting is enforced at slot cast time. Integration: ck3. Proof: pools tests covering the rejection with no state change and the legal path.
- **CAP-E4 (character-side leg):** out-of-combat `useItem` heals, clamped at the with-grants hp cap. Integration: ck3.

## Contract Agreements

- **CA-EG2 (producer):** composition exists in exactly one place, `equipment.ts`:
  ```ts
  /** CA-EG1/DD-EG1 — how many slots currently hold `itemId` (absent `equipped` = 0). Pure: reads state only,
   *  no runtime, no mutation. The ONE equipped-unit rule: `dropItem`'s guard, `equipItem`'s held check,
   *  `useItem`'s guard and S05's `settleItemUses` all call it (R-5). */
  export function equippedUnits(state: CharacterState, itemId: string): number;

  /** CA-EG2 — sum of every equipped item's grants, by grant key (absent `equipped` = none). */
  export function equippedGrants(runtime: Runtime, state: CharacterState): Record<string, number>;

  /** CA-EG2 — the character's effective scalars: ability/save grants ADDED to the base stat;
   *  reserved grants exposed as gear-hp/gear-ac/gear-initiative/gear-armor (0 when none). */
  export interface EquipmentView {
    readonly abilities: Record<string, number>;
    readonly saves: Record<string, number>;
    readonly gear: Record<string, number>; // exactly the EQUIPMENT_SCALARS keys
  }
  export function equipmentView(runtime: Runtime, state: CharacterState): EquipmentView;

  /** CA-EG2 — the formula scope for the character's reserved stats: `{...view.abilities, level, ...view.gear}`. */
  export function equipmentScope(view: EquipmentView, level: number): Record<string, number>;
  ```
  - **Module placement (R-11; no new import cycle).** `equipment.ts` is a runtime **leaf**: its only **value** imports are `../core/**`, `./errors` and `./conditions`. Everything from `./runtime`, `./character`, `./events` and `../schema/**` is `import type`. It never value-imports `character.ts`, `pools.ts` or `inventory.ts`. Verified at plan HEAD: `character.ts:16-35` value-imports `pools.ts` and `inventory.ts`, and `progression.ts:28` value-imports `character.ts`; `inventory.ts:23-28` and `conditions.ts:30-33` value-import only core and `./errors`. So `pools.ts` and `inventory.ts` may value-import `equipment.ts` without a cycle. Update `pools.ts`'s header docstring (`:14-15`, "imports only core + types") to name the equipment leaf as its one runtime value import.
  - A key naming both an ability and a save adds to both.
  - `character.ts` `derived()` evaluates hp/ac over `{...view.abilities, level, ...view.gear}`, and each class's attackBonus over `{...view.abilities, level: entry.level, ...view.gear}`.
  - `derived().saves` returns `view.saves`.
  - `formulaValue`/`reserveValue` gain an optional trailing `gear?: Readonly<Record<string, number>>` parameter, spread into the context. Existing callers (`progression.ts`, `snapshots.ts`) pass nothing and keep base values: level-set and restore reset hp from the unequipped formula, and that existing behavior is preserved.
  - Pool capacities (`pools.ts:24-42`) evaluate over the same view when a character state is at hand (FR-3 lists pool capacities among the equipment-derived stats). With nothing equipped they are byte-identical.
  - Equipping never heals. Unequipping never clamps: hp may exceed the base cap after an unequip, and death checks hp ≤ 0 only. Build, level-set and restore also set hp from the formula without gear. So **hp above the cap is a legal state**, and the heal rule below never lowers it (R-2).
- **CA-EG3 (producer):**
  - The armor marker means `grants` includes `armor`.
  - The gate is in `castSpell` only (`pools.ts:201`), placed after the `unknown-spell` check and **before** the slot lookup, so a blocked cast consumes nothing.
  - It rejects `armor-not-castable` when any equipped armor item's `kind` is not listed in the `armorCasting` of any of the character's classes. A class with no `armorCasting` cannot cast in armor at all (the FR-9 default).
  - `castSpell` is the slot (vancian) cast; point-pool spells have no cast verb (DD17a), so they are outside CAP-E3 (DD-EG5).
  - Monsters are unaffected.
- **CA-EG5 (character-side producer):**
  - `useItem` consumes exactly one unit, and the last unit removes the entry.
  - Rejections reuse the inventory family verbatim: `unknown-item`, `item-not-held`, `insufficient-qty`. `not-consumable` is new.
  - The effect executes against the character itself.

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `src/runtime/equipment.ts` | create | `EquippedEntry`, `equippedUnits` (pure, R-5), `equippedGrants`, `equipmentView`, `equipmentScope`, `equipItem`, `unequipItem`, `useItem` (mirror `inventory.ts`'s shape and doc discipline). Runtime leaf: value imports only core, `./errors`, `./conditions` (R-11) |
| `src/runtime/character.ts` | modify | `CharacterState.equipped?: EquippedEntry[]`; `derived()` composes per CA-EG2; `formulaValue`/`reserveValue` accept optional `gear`; the `Character` facade gains `equip(itemId, slot)`, `unequip(slot)`, `useItem(itemId, opts?)` delegates |
| `src/runtime/pools.ts` | modify | the armorCasting gate in `castSpell`; capacity evaluation over `equipmentView`; header docstring (`:14-15`) names the equipment leaf import |
| `src/runtime/inventory.ts` | modify | the equipped-unit guard: `dropItem` rejects `item-equipped` (no state change) when `held − qty < equippedUnits(character, itemId)`. It calls `equippedUnits` from `equipment.ts`; it does not re-derive the count (R-5). `useItem` and S05's settlement use the same helper |
| `src/runtime/runtime.ts` | modify | `PackIndex` (`:35-49`) gains `itemEffects: Readonly<Record<string, EffectAst>>`, built next to `spellEffects` (`:125`) by pre-filtering `content.items` to the entries that declare `use`, mapped to `{ effect: use }`, then `compileEffects(filtered, (def) => def.effect)`. `compileEffects` (`:149`) requires `effect: string` and throws on parse failure, so items without `use` get no entry. Parse once at load (CA-2; F-E11) |
| `src/runtime/index.ts` | modify | barrel: `equipItem`, `unequipItem`, `useItem`, `equippedUnits`, `equippedGrants`, `equipmentView`, types `EquippedEntry`, `EquipmentView` (the barrel checkpoint lives in the creating session; grid DD14a) |
| `tests/runtime/fixtures/**` | modify | additive equipment and consumable content (see Fixture duty) |
| `tests/runtime/equipment.test.ts` | create | verb suite (ck1, ck3) |
| `tests/runtime/character.test.ts` | modify | derived-with-grants cases, both AC directions (ck2) |
| `tests/runtime/pools.test.ts` | modify | cast-gate cases; unchanged pool capacities with nothing equipped |
| `tests/runtime/inventory.test.ts` | modify | the `item-equipped` guard (drop of the last equipped unit rejected; drop of a surplus unit allowed) |

## Implementation

### Checkpoint 1 — State + equip/unequip + inventory guard

```ts
export interface EquippedEntry { readonly slot: string; itemId: string }

/** CAP-E2 — equip a held item into one of its declared slots. One item per slot. */
export function equipItem(runtime: Runtime, state: CharacterState, itemId: string, slot: string): RuntimeEvent;

/** CAP-E2 — free a slot. Emits `item:unequipped`. */
export function unequipItem(runtime: Runtime, state: CharacterState, slot: string): RuntimeEvent;
```

`equipItem` gate order. Each step is a named `ruleCard` rejection with no state change:
1. `unknown-item`: the id is not in `content.items`.
2. `not-equippable`: the item declares no `slots`.
3. `unknown-slot`: the slot is not in `pack.equipSlots`.
4. `slot-not-allowed`: the slot is not in the item's `slots`.
5. `slot-occupied`: an entry already holds the slot. The caller must unequip first (fail-closed).
6. `item-not-held`: the held qty ≤ `equippedUnits(state, itemId)`.

On success, push `{slot, itemId}` (creating `state.equipped` if absent) and emit `item:equipped` with payload `{itemId, slot}` and `why.rule: 'content.items.<id>'`.

`unequipItem` rejects `not-equipped` when the slot is empty. Otherwise it removes the entry. An emptied array stays as `[]`; do not delete the key.

The inventory guard goes in `dropItem`, calling `equippedUnits` (R-5). Export `equippedUnits` at this checkpoint; it is the pure check S05's settlement validates with before it mutates anything.

Tests:
- `equippedUnits`: 0 for a fresh character (absent `equipped`), 1 after one equip, 2 when the same id sits in two slots, 0 again after unequipping both; it never mutates state;
- every rejection name;
- event payloads;
- two grants stacking across two slots;
- the lazy array (a fresh character has no `equipped` key);
- the `item-equipped` guard.

**Commit when:** `pnpm typecheck` is 0; `pnpm exec vitest run tests/runtime/equipment.test.ts tests/runtime/inventory.test.ts` is green.

### Checkpoint 2 — Grants compose into derived stats
Implement `equipmentView` and the CA-EG2 composition in `derived()`, `formulaValue`/`reserveValue` and pool capacities.

Tests (character.test.ts), using in-test packs cloned from the fixture with assigned formulas:
- **Ascending AC:** `ac: '10 + gear-ac'`; equip `{ac: 2}` → base + 2.
- **Descending AC:** `ac: '12 - floor(level / 3) - gear-ac'`; equip `{ac: 2}` → base − 2.
- Unequip → base, byte-exact.
- `{hp: 2}` raises `derived().hp` by 2 while `hp.current` is unchanged.
- `{might: 1}` adds exactly 1 to an `attackBonus` of `floor(level / 2) + might`. It is additive, not a replacement: with might 3, the result uses 4, not 1.
- A save grant adds to `derived().saves`.
- With nothing equipped, every fixture value equals its plan-HEAD value.

**Commit when:** typecheck is 0; `pnpm exec vitest run tests/runtime/character.test.ts tests/runtime/equipment.test.ts tests/runtime/pools.test.ts` is green; CAP-E2's closing proof passes in both directions.

### Checkpoint 3 — armorCasting gate + parse-once item effects + out-of-combat use
1. **The `castSpell` gate** (CA-EG3).
2. **The `runtime.ts` `itemEffects` index.**
3. **`useItem`:**
   ```ts
   export function useItem(runtime, state, itemId, opts?: { seed?: number | string; rng?: RandomSource }): readonly RuntimeEvent[];
   ```
   The RNG follows the `grantLoot` precedent: `opts?.rng ?? new Rng(opts?.seed ?? itemId)`.

   Gates, in order:
   1. `unknown-item`.
   2. `not-consumable`: no `runtime.index.itemEffects[itemId]`.
   3. `item-not-held`.
   4. The equipped-unit guard.

   The equipped-unit guard is `held − 1 < equippedUnits(state, itemId)` → `item-equipped`, the same rule and card as `dropItem` (R-5).

   Then:
   1. Decrement qty by 1 directly on `state.inventory`; the entry leaves at 0. (Do not call `dropItem`: `equipment.ts` stays a leaf, R-11. The gates above already cover every `dropItem` rejection that can apply to one unit.)
   2. Emit `item:used` with `why.rule: 'content.items.<id>'`. It is emitted **before** the effect's own events (the loot ordering precedent: the consuming verb announces, then the effect speaks).
   3. Execute the parse-once AST via `executeEffect`. The vars mirror the actor block `executeAgainst` builds (`resolve.ts:~333-340`), taken from the character's effective numbers: view abilities/saves, level, `hp` = current, `ac` = derived ac, `initiative` = 0-RNG initiative value or 0.
      - `cap` and `ac` are the pack's `hp`/`ac` formulas (`runtime.index.formulaAsts`) evaluated through core `evalFormula`/`valueOfFormula` over `equipmentScope(view, state.level)` with `new Rng(0)`: the same scope and RNG that `derived()` uses. A test asserts `cap === character.derived().hp` with grants equipped.

   The `EffectApply`:
   - **`damage` with a negative total (heal)** (R-2): `heal = −amount`; `after = current >= cap ? current : Math.min(cap, current + heal)`, where cap = `derived().hp` with grants. A heal never raises hp above the cap **and never lowers it**: a character already at or above the cap (legal after an unequip, CA-EG2) keeps its hp.
   - **`damage` with a positive total:** subtracts honestly, flooring at 0.
   - **`condition`:** routes through `conditions.ts` `applyCondition` (same events and stacking). The effect's evaluated duration overrides the pack default on the entry it created.
   - **`resolveTargets`:** `[{ id: state.id }]`.

   The heal emits one `damage:applied` event with `amount` (negative), `hp: "before→after"` computed from the actual clamped values, and `why.rolls`.

Tests:
- a consumable `heal(10)` into a character missing 4 → current = cap exactly (the clamp proof);
- **over-cap (R-2 closing check):** equip an `{hp: 2}` item, set `hp.current` to the with-grants cap, unequip (now current = base cap + 2 > cap), then `useItem` a heal → `hp.current` unchanged, the unit is still consumed, and the `damage:applied` event shows `hp: "X→X"` with X = that current value;
- `cap` equals `character.derived().hp` with grants equipped;
- `not-consumable` on a weapon;
- the last unit removes the entry;
- a cast in armor by a class lacking the kind → `armor-not-castable`, with the slot still bound;
- the same character after unequip → the cast succeeds;
- a class listing the kind → the cast succeeds while equipped.

**Commit when:** typecheck is 0; `pnpm exec vitest run tests/runtime/pools.test.ts tests/runtime/equipment.test.ts tests/runtime/character.test.ts` is green; the CAP-E3 and CA-EG5 character-side proofs pass.

### Checkpoint 4 — Barrel + suite close
Add the surface exports to `src/runtime/index.ts` as one additive block.

**Commit when:** typecheck is 0; `pnpm exec vitest run tests/runtime/ tests/snapshots/` is fully green (the snapshot suites must be unaffected, which proves the absent-`equipped` choice); the commit covers the whole lease.

## Verification

- Lease-scoped gates: `pnpm typecheck` and `pnpm exec vitest run tests/runtime/ tests/snapshots/` (DD14e form).
- Do **not** run `pnpm build` in this session. S04 shares the working tree concurrently. Orchestrator builds at receive (Verification Baseline F-E13 note).
- **Shared-tree hazard (e), both directions (R-6).** Your `tests/runtime/` gates include `tests/runtime/combat/{combat,character-profile}.test.ts`, which generate packs from the theme files S04 is editing (`src/compiler/themes/*.json`) in the same working tree. S04's values are unchanged by design, but a half-edited theme can go red mid-checkpoint. A red you trace to `src/compiler/**` or `tests/compiler/**` is **reported, not fixed**: re-run once S04's checkpoint commit lands (`git log --oneline -- src/compiler`), and name it in the handoff if it persists. Never edit S04's files, and do not weaken or skip the test.
- Architecture: `src/runtime/**` imports only `../schema`, `../core` and sibling runtime files; no compiler import.
- CA-EG2 boundary assertion: composition is built only in `equipment.ts`. Grep to confirm no other site adds grants.
- R-5 boundary assertion: `equippedUnits` is the only place the equipped-unit count is computed (grep `equipped` in `inventory.ts`: it calls the helper, it does not iterate `state.equipped`).
- R-11 boundary assertion: `grep -n "^import" src/runtime/equipment.ts` shows no value import from `./character`, `./pools` or `./inventory`.
- CA-EG3 boundary assertion: the gate sits before any slot mutation in `castSpell`. Read the final file to confirm the order.

## State Update

Report:
- the verb and rejection names as landed;
- the `equipmentView` shape;
- the `formulaValue`/`reserveValue` signature change;
- the clamp and unequip semantics;
- the fixture extensions (S05 reads them).

The handoff names S05's consumers:
- `equipmentView` for the profile's abilities, saves, initiative base and `maxHp`;
- `runtime.index.itemEffects` for `fight.use`;
- **`equippedUnits(state, itemId)`** (exact name and signature as landed; R-5): settlement's pure pre-check;
- `dropItem`, and its guard, for settlement's mutation;
- the heal rule as landed (`after = current >= cap ? current : min(cap, current + heal)`), which S05 mirrors in `applyMutation`;
- the absent-`equipped` convention for the serializer.
