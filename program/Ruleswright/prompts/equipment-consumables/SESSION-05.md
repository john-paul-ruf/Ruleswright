# SESSION-05 — Combat integration: profiles with grants + maxHp, fight.use, item settlement, snapshots

> **Program:** Ruleswright
> **Feature:** equipment-consumables
> **Modules:** M03
> **Depends on:** SESSION-03, SESSION-04
> **Concurrent with:** —
> **Owns:** `src/runtime/combat/combat.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/combat/action-economy.ts`, `src/runtime/character-profile.ts`, `src/runtime/snapshots.ts`, `src/runtime/runtime.ts`, `src/runtime/index.ts`, `tests/runtime/combat/**`, `tests/snapshots/combat.test.ts`, `tests/snapshots/character.test.ts`
> **Reads:** `src/runtime/equipment.ts`, `src/runtime/character.ts`, `src/runtime/pools.ts`, `src/runtime/inventory.ts`, `src/runtime/combat/triggers.ts`, `src/schema/contracts/snapshots.schema.json`, `program/Ruleswright/specs/database.md`, `src/compiler/themes/zombie-urban.json`, `tests/runtime/fixtures/**`, `tests/proofs/loot-journey.test.ts`, `tests/proofs/grid-journey.test.ts` (harness precedent; read-only)
> **Resources:** `dist-build` (ck5 runs `pnpm build`; this is a solo wave)
> **Checkpoints:** 5 (plus a read-only ck0)

## Module Context
| ID | Module | Read | Why |
|---|---|---|---|
| M03 | Runtime | write | The combat engine, the character↔combatant bridge (both directions), snapshots. Every integration seam lives here |

## Context

S03 landed the character-side verbs, `equipmentView` and `runtime.index.itemEffects`. S04 landed the theme content. You compose both into the combat transport, settle combat item use back into the inventory, and close the snapshot contract that S01 already widened (`snapshots.schema.json` v1.4: `characterState.equipped`, combatant `itemsUsed`, `maxHp`).

**Mechanics verified at plan HEAD:**
- `MutationRequest.amount` carries "the executor's honest total, positive or negative". `applyMutation` (`combat.ts:793-796`) does `hp.current -= amount` and **does not clamp**.
- `hpBefore` (`combat.ts:805-807`) back-computes `current + amount` **after** the mutation (`:644-645`). Once heals clamp, that back-computation is wrong. Capture the before value **before** `applyMutation`, and derive the displayed `before→after` from the captured value and the actual resulting hp.
- Combat hp is only `hp:{current}` (`combat.ts:53`, `:217`), and the profile's `hp` is the current value. There is no cap anywhere (F-E9).
- `profileFromCharacter` (`character-profile.ts`) uses the unmodified `state.abilities`/`state.saves` for `profile.abilities`/`saves` and the initiative base. Combat's effect vars come from `profile.abilities` (`resolve.ts:~333`). So without this session, ability grants never reach combat (F-E2).
- **Settlement precedent (checked, F-E10):** combat never writes back to the character. Pools and boundSlots are copied from host `balances` at start (`combat.ts:220-221`), spent on the combatant copy (`combat.ts:601-612`), and rebuilt from the host's re-stated balances on restore (`snapshots.ts:450-452`). Nothing settles them afterwards; that is the host's business. For items, CA-EG5 requires the character's inventory to actually lose the unit, so this session adds the narrowest mechanism consistent with the precedent: an **explicit host-called settlement verb**, the inverse of `profileFromCharacter`, living in the same bridge file. The fight still never touches character state.

**Fixture discipline:** S03 owns `tests/runtime/fixtures/**`, and you consume them read-only. If an extension doesn't cover a combat case, add it in-test (structuredClone and assign) or report a lease seam.

## Capabilities

- **CAP-E4:** consumable `use` in combat through the heal registry path, clamped at `maxHp`. Integration: ck2.
- **CAP-E8 (settlement):** a combat `use` ends with exactly one unit removed from the character's inventory. Integration: ck3.
- **CAP-E5:** snapshots carry `equipped`, `itemsUsed` and `maxHp`; restore fails closed. Integration: ck4.
- **CA-EG2 profile leg:** combat numbers reflect equipped grants (ck1).

## Contract Agreements

- **CA-EG2 profile leg (ck1).** `profileFromCharacter` uses `equipmentView(runtime, state)` (S03):
  - `abilities` = `view.abilities`;
  - `saves` = `view.saves`;
  - the initiative base = `{...view.abilities, ...view.saves, level, ...view.gear}` (the order is today's `{...abilities, ...saves, level}` plus gear);
  - `ac` = `derived().ac` (S03 already composes);
  - `maxHp` = `derived().hp`;
  - `hp` = `state.hp.current` (unchanged).

  `CombatantProfile` (`resolve.ts:76-91`) gains optional `maxHp?: number`. It is additive, so hand-built host profiles keep compiling. `profileFromStatblock` (`resolve.ts:192`) sets `maxHp` equal to its evaluated `hp`. The unbound `gear-*` names evaluate to 0 (S02), so statblocks are unchanged.
- **CA-EG4 (ck2).** A `heal` arrives as a negative-amount damage mutation.
  - `CombatantState` gains `maxHp: number` = `profile.maxHp ?? Math.max(0, profile.hp)` at start. The fallback is **floored at 0** (R-9): a hand-built host profile with `hp ≤ 0` must not serialize a negative `maxHp`, which the S01 contract forbids (integer ≥ 0).
  - `applyMutation` handles a negative amount (R-2): `heal = −amount`; `after = current >= maxHp ? current : Math.min(maxHp, current + heal)`. A heal never raises hp above `maxHp` **and never lowers it**. hp above `maxHp` is legal: `profileFromCharacter` sets `hp = state.hp.current`, which can exceed `derived().hp` after an unequip (CA-EG2). Positive damage is unchanged; no floor, today's semantics.
  - The `damage:applied` event keeps its anatomy: `amount` stays the executor's honest negative total, and `hp: "before→after"` shows the real clamped values.
- **CA-EG5 (ck2/ck3).** Combat side:
  - `EconomyBalances` gains `items?: Record<string, number>`, the host-stated held count per consumable, mirroring `pools`/`boundSlots`.
  - `profileFromCharacter.balances.items` = the held qty of every held item that has `runtime.index.itemEffects`.
  - `CombatantState` gains `itemBalances: Record<string, number>` (from `balances.items`, immutable in the fight) and `itemsUsed: Record<string, number>` (units **spent**, starting at `{}`).
  - Remaining = balance − used.

  `Combat.use(itemId, options?: { target?: string })`. Gate order mirrors declare minus slots, with named `declare:rejected`-style rejections:
  0. **Phase and turn (R-3), exactly as `declare` does it** (`combat.ts:357-360`): if `this.state.phase === 'combat-over'`, throw the same `Error('combat is over')` `declare` throws, with no event and no ledger change; the user is always `this.state.active` (only the active combatant can use an item, as only it can declare). `declare` has no other phase gate, and `use` adds none. If ck0 finds that `declare` has gained another phase or turn gate, `use` copies it.
  2. `not-consumable`
  3. the restriction gate (as declare applies it)
  4. target (default: the actor itself)
  5. `no-charges` (remaining ≤ 0)

  Then:
  1. Increment `itemsUsed[itemId]`.
  2. Emit `item:used` (`why.rule: 'content.items.<id>'`).
  3. Execute `runtime.index.itemEffects[itemId]` through the existing `resolve` path with a **synthetic, item-only** BoundAction `{ id: itemId, def: <synthetic ActionDef>, ast }`. `why.rule` for the effect's events = `content.items.<id>`.

  F-E15: the synthetic action object is for items only. Do **not** generalize it to spells; that is the DD17a spells-as-actions design event and is out of scope. A use consumes no turn slot (DD-EG6).
- **CA-EG5 settlement (ck3).**
  ```ts
  /** CA-EG5 — write a finished fight's item spend back to the character (inverse of profileFromCharacter). */
  export function settleItemUses(runtime: Runtime, character: Character, fight: Combat, combatantId?: string): readonly RuntimeEvent[];
  ```
  - Refuse `combat-not-over` unless `fight.state.phase === 'combat-over'`. Settling a live fight would desync with the re-stated-balances restore discipline.
  - Validate all at once before any mutation: every used item must still be held with qty ≥ used, and must pass the equipped-unit guard, checked with S03's pure **`equippedUnits(character.state, itemId)`** from `equipment.ts` (R-5): `held − used < equippedUnits(…)` → `item-equipped`. Do **not** re-derive the equipped count in `character-profile.ts`; the pre-check and `dropItem`'s guard must be the same rule. Otherwise throw `RuntimeRuleError` with every card, and change nothing.
  - Then, per item in id order: decrement the inventory by the used count (via `inventory.ts` `dropItem`, which emits `item:dropped`) and emit `item:settled` `{combatantId, itemId, qty}` (`why.rule: content.items.<id>`).
  - Finally set that combatant's `itemsUsed` to `{}`, so a second call settles nothing and returns `[]`.
  - `combatantId` defaults to `character.state.id`.
  - Documented v1 limit: a fight abandoned before `combat-over` does not settle; the host may `drop` manually.
  - **Documented v1 limit (R-4): settlement is idempotent per live fight object, not across snapshots.** The "already settled" marker is only that combatant's `itemsUsed = {}` on the live `Combat`. A snapshot taken at `combat-over` **before** settling still carries the spend; restoring it and settling again drops the same units a second time. The host must settle each fight **once**. No contract field is added, and restored fights are **not** refused: the journey legitimately resumes a fight from a snapshot and then settles it. State the limit in the `settleItemUses` docstring.
- **CA-EG6 (ck4).** Serializer and restore follow S01's contract:
  - **Character.** `SnapshotCharacterState.equipped?` is emitted **only when `state.equipped !== undefined`** (presence-preserving; F-E5). Restore sets it only when the snapshot carries it. That keeps `tests/snapshots/character.test.ts:87,165` and `loot-journey.test.ts:126` equal for never-equipped characters. Restore cross-validates every `equipped` entry, all at once and before any application, with E-SNAP-01 cards:
    - `itemId` is in `content.items`;
    - `slot` is in `equipSlots`;
    - `slot` is in the item's `slots`;
    - each slot is unique;
    - the entry is held in the restored inventory.

    Inventory restore stays verbatim (the CA-01 divergence is documented in DD-EG7).
  - **Combat.** `SnapshotCombatant` gains `itemsUsed?` (spent; emitted when non-empty) and `maxHp?` (always emitted by v1.4 serializers). Restore:
    - fight-start balances come from `restore.<side>[].balances.items` (the host re-states its original request, `CombatRestoreRequest` doc);
    - the snapshot's `itemsUsed` wins for the spend;
    - `itemsUsed[id]` greater than the restated balance, or an unknown item id → E-SNAP-01 refusal, all cards before any rebuild;
    - `maxHp` = snapshot value, else `profile.maxHp`, else `Math.max(0, profile.hp)` (R-9, same floor as start).

    Key pins: `tests/snapshots/combat.test.ts:102` pins combatant keys `['conditions','hp','id','slotsUsed']`. You own it and re-key it to include `maxHp`. `tests/snapshots/character.test.ts:45` stays unchanged for a never-equipped character (the key is absent).

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `src/runtime/combat/resolve.ts` | modify | `CombatantProfile.maxHp?`; `profileFromStatblock` sets `maxHp`; **`checkPackDsl` (`:145`) also checks every `content.items.<id>.use` as kind `effect`** (jsonPath `content.items.<id>.use`), after the feats loop (R-7) |
| `src/runtime/combat/action-economy.ts` | modify | `EconomyBalances.items?` |
| `src/runtime/combat/combat.ts` | modify | `CombatantState.maxHp/itemBalances/itemsUsed`; start + clamp + captured `hpBefore`; `use()` |
| `src/runtime/character-profile.ts` | modify | profile composition (CA-EG2), `maxHp`, `balances.items`; `settleItemUses` |
| `src/runtime/snapshots.ts` | modify | `equipped` / `itemsUsed` / `maxHp` serialize + restore + refusals (restore's `CombatantState` literal gains the new fields) |
| `src/runtime/runtime.ts` | modify | only if a facade method is needed (e.g. none expected); keep any change additive. S03 already added `itemEffects` |
| `src/runtime/index.ts` | modify | export `settleItemUses` and any new public type |
| `tests/runtime/combat/**` | modify | profile grant cases (`character-profile.test.ts`); use/clamp/charges/rejections/provenance (`combat.test.ts`); settlement cases; `checkPackDsl` item-`use` cases (`action-economy.test.ts`, next to the existing `checkPackDsl(pack)` assertion at `:35`, R-7) |
| `tests/snapshots/combat.test.ts` | modify | re-key `:102`; `itemsUsed`/`maxHp` round-trip; the restore ledger; refusal cases |
| `tests/snapshots/character.test.ts` | modify | `equipped` round-trip; never-equipped stays keyless; dangling/illegal equipped entry → loud refusal, state untouched |

## Implementation

### Checkpoint 0 — Producer re-check (read-only, no commit)
Read the landed `equipment.ts`/`character.ts`/`inventory.ts`/`runtime.ts` (S03), `zombie-urban.json` (S04), and `snapshots.schema.json` (S01). Verify:
- CA-EG5's verb and rejection names;
- `equipmentView`'s shape;
- the name and signature of S03's pure equipped-unit helper (planned `equippedUnits(state, itemId)`, R-5), and S03's landed heal rule (R-2);
- `declare`'s phase/turn gate as it stands (R-3);
- that `itemEffects` exists and holds `med-kit`;
- the contract's `itemsUsed`/`maxHp`/`equipped` definitions.

Any mismatch → report a plan correction and amend the CA text before coding.

### Checkpoint 1 — Profiles carry grants + maxHp
Make the `resolve.ts` profile field and statblock change, the `checkPackDsl` item-`use` check (R-7), and the `character-profile.ts` composition.

Tests: an equipped armor shifts the combatant's `ac` by exactly the pack formula's response; a `might` grant raises `profile.abilities.might` by 1; `maxHp` = `derived().hp`; statblock `maxHp` = its hp; nothing equipped → the profile is byte-identical to plan HEAD apart from the new `maxHp` field.

`checkPackDsl` tests (`action-economy.test.ts`): a pack whose item declares `use: 'heal(2 + might)'` → `[]`; an item `use: 'mend(2)'` → one E-FORM-02 card whose jsonPath is `content.items.<id>.use`; the existing fixture assertion at `:35` stays `[]`.

**Commit when:** typecheck is 0; `pnpm exec vitest run tests/runtime/combat/` is green.

### Checkpoint 2 — fight.use + charges + clamp
Make the `action-economy.ts` balances change and the `combat.ts` state, clamp, `hpBefore` capture and `use()`.

Tests:
- heal a damaged ally: hp rises by the roll, clamped at `maxHp`, and the event shows `before→after` exactly;
- heal at full hp → `before→after` equal;
- **over-cap (R-2 closing check):** a combatant whose `hp` exceeds `maxHp` (a character profiled after unequipping an `{hp: 2}` item at full hp, or a hand-built profile with `hp > maxHp`) is healed → hp unchanged, and the event shows `hp: "X→X"`;
- **use after the fight (R-3 closing check):** drive the fight to `combat-over`, then `use(...)` throws `combat is over`, emits no event (fresh sink) and leaves `itemsUsed` unchanged;
- the `maxHp` fallback floors at 0 (R-9): a hand-built profile with no `maxHp` and `hp: -3` starts with `maxHp: 0`;
- charge exhaustion → `no-charges` with no event;
- `not-consumable`;
- `unknown-item`;
- provenance (`why.rule: 'content.items.<id>'`, `why.rolls`);
- an attack's damage display is unchanged (regression).

**Commit when:** typecheck is 0; the combat suite is green with the CAP-E4 proofs.

### Checkpoint 3 — Settlement
Implement `settleItemUses` and its tests:
- after a fight with two uses → the inventory qty drops by 2 exactly, with `item:settled` events;
- a second call → `[]` and no change;
- a live fight → `combat-not-over`, no change;
- an item no longer held → all cards, no change;
- a used unit that is also equipped (held − used < `equippedUnits`) → `item-equipped` card, no change (the R-5 shared rule).

**Commit when:** typecheck is 0; `pnpm exec vitest run tests/runtime/` is green.

### Checkpoint 4 — Snapshots
Make the `snapshots.ts` changes, the key re-key, round-trips and refusals. Use a fresh event sink on any resumed-leg assertion (DD17e).

**Commit when:** typecheck is 0; `pnpm exec vitest run tests/snapshots/ tests/runtime/` is green.

### Checkpoint 5 — Surface close + dist round-trip re-verify
Barrel exports. Then `pnpm build` and `pnpm exec vitest run tests/runtime/ tests/snapshots/ tests/proofs/`. You are the named owner of re-verifying `tests/proofs/loot-journey.test.ts:126` (the dist restore round-trip) after the serializer change (F-E5).

**Commit when:** the build exits 0; runtime, snapshots and proofs are green, including loot-journey; the lease is complete.

## Verification

- Lease-scoped: `pnpm typecheck`; `pnpm exec vitest run tests/runtime/ tests/snapshots/` (DD14e form); ck5 adds `pnpm build` + `tests/proofs/`.
- CA-EG4 boundary proof: assert the `damage:applied` event (negative `amount`, clamped `hp` display), not a private field.
- CA-EG5 boundary proof: settlement's inventory effect is asserted on `character.state.inventory`.
- CA-EG6 boundary proof: restoring an envelope with an illegal equipped entry throws with every card, and the target state is untouched.

## State Update

Report:
- the `use()` gate order as landed, including gate 0;
- the clamp mechanics (never lowers hp);
- settlement semantics, including the per-fight-object idempotence limit (R-4) for S06's README;
- the `checkPackDsl` item-`use` coverage;
- the snapshot fields and restore precedence;
- the `combat.test.ts:102` re-key;
- the loot-journey re-verify result;
- any CA amendment made at ck0.

The handoff names S06's journey facts: the exact heal anatomy, the cap values, the charge counts, and settlement's resulting inventory.
