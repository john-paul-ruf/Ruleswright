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
  ```
  - A key naming both an ability and a save adds to both.
  - `character.ts` `derived()` evaluates hp/ac over `{...view.abilities, level, ...view.gear}`, and each class's attackBonus over `{...view.abilities, level: entry.level, ...view.gear}`.
  - `derived().saves` returns `view.saves`.
  - `formulaValue`/`reserveValue` gain an optional trailing `gear?: Readonly<Record<string, number>>` parameter, spread into the context. Existing callers (`progression.ts`, `snapshots.ts`) pass nothing and keep base values: level-set and restore reset hp from the unequipped formula, and that existing behavior is preserved.
  - Pool capacities (`pools.ts:24-42`) evaluate over the same view when a character state is at hand (FR-3 lists pool capacities among the equipment-derived stats). With nothing equipped they are byte-identical.
  - Equipping never heals. Unequipping never clamps: hp may exceed the base cap after an unequip, and death checks hp ≤ 0 only.
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
| `src/runtime/equipment.ts` | create | `EquippedEntry`, `equippedGrants`, `equipmentView`, `equipItem`, `unequipItem`, `useItem` (mirror `inventory.ts`'s shape and doc discipline) |
| `src/runtime/character.ts` | modify | `CharacterState.equipped?: EquippedEntry[]`; `derived()` composes per CA-EG2; `formulaValue`/`reserveValue` accept optional `gear`; the `Character` facade gains `equip(itemId, slot)`, `unequip(slot)`, `useItem(itemId, opts?)` delegates |
| `src/runtime/pools.ts` | modify | the armorCasting gate in `castSpell`; capacity evaluation over `equipmentView` |
| `src/runtime/inventory.ts` | modify | the equipped-unit guard: `dropItem` rejects `item-equipped` (no state change) when dropping would leave held qty below the number of slots holding that id. A consumable use or settlement of an equipped unit hits the same guard |
| `src/runtime/runtime.ts` | modify | `PackIndex` (`:35-49`) gains `itemEffects: Readonly<Record<string, EffectAst>>`, built next to `spellEffects` (`:125`) by pre-filtering `content.items` to the entries that declare `use`, mapped to `{ effect: use }`, then `compileEffects(filtered, (def) => def.effect)`. `compileEffects` (`:149`) requires `effect: string` and throws on parse failure, so items without `use` get no entry. Parse once at load (CA-2; F-E11) |
| `src/runtime/index.ts` | modify | barrel: `equipItem`, `unequipItem`, `useItem`, `equippedGrants`, `equipmentView`, types `EquippedEntry`, `EquipmentView` (the barrel checkpoint lives in the creating session; grid DD14a) |
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
6. `item-not-held`: the held qty ≤ the number of slots already holding this id.

On success, push `{slot, itemId}` (creating `state.equipped` if absent) and emit `item:equipped` with payload `{itemId, slot}` and `why.rule: 'content.items.<id>'`.

`unequipItem` rejects `not-equipped` when the slot is empty. Otherwise it removes the entry. An emptied array stays as `[]`; do not delete the key.

The inventory guard goes in `dropItem`.

Tests:
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

   Then:
   1. Decrement qty by 1; the entry leaves at 0.
   2. Emit `item:used` with `why.rule: 'content.items.<id>'`. It is emitted **before** the effect's own events (the loot ordering precedent: the consuming verb announces, then the effect speaks).
   3. Execute the parse-once AST via `executeEffect`. The vars mirror the actor block `executeAgainst` builds (`resolve.ts:~333-340`), taken from the character's effective numbers: view abilities/saves, level, `hp` = current, `ac` = derived ac, `initiative` = 0-RNG initiative value or 0.

   The `EffectApply`:
   - **`damage` with a negative total (heal):** `hp.current = min(cap, current − amount)`, where cap = `derived().hp` with grants. It never goes above the cap.
   - **`damage` with a positive total:** subtracts honestly, flooring at 0.
   - **`condition`:** routes through `conditions.ts` `applyCondition` (same events and stacking). The effect's evaluated duration overrides the pack default on the entry it created.
   - **`resolveTargets`:** `[{ id: state.id }]`.

   The heal emits one `damage:applied` event with `amount` (negative), `hp: "before→after"` computed from the actual clamped values, and `why.rolls`.

Tests:
- a consumable `heal(10)` into a character missing 4 → current = cap exactly (the clamp proof);
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
- Architecture: `src/runtime/**` imports only `../schema`, `../core` and sibling runtime files; no compiler import.
- CA-EG2 boundary assertion: composition is built only in `equipment.ts`. Grep to confirm no other site adds grants.
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
- `dropItem`, and its guard, for settlement;
- the absent-`equipped` convention for the serializer.
