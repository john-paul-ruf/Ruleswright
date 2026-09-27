# SESSION-01 — Runtime Inventory Core

> **Program:** Ruleswright
> **Feature:** loot-inventory
> **Modules:** M03 (runtime)
> **Depends on:** —
> **Concurrent with:** — (serialized behind nothing; its lease is disjoint from S02's but the CA-02 relay is serialized by plan)
> **Owns:** `src/runtime/inventory.ts`, `src/runtime/character.ts`, `src/runtime/progression.ts`, `src/runtime/snapshots.ts`, `src/runtime/index.ts`, `tests/runtime/inventory.test.ts`, `tests/snapshots/character.test.ts`
> **Reads:** `src/runtime/pools.ts`, `src/runtime/conditions.ts`, `src/runtime/errors.ts`, `src/runtime/events.ts`, `src/core/tables.ts`, `src/core/rng.ts`, `src/core/index.ts`, `src/schema/contracts/snapshots.schema.json`, `tests/runtime/fixtures/pack.ts`, `tests/runtime/fixtures/packs.ts`
> **Resources:** —
> **Checkpoints:** 2

## Module Context
| ID | Module | Read | Why |
|----|--------|------|-----|
| M03 | Runtime `src/runtime/**` | yes (modify subset) | The inventory lifecycle is character-side state; pools.ts/conditions.ts are the two API-shape precedents to mirror |
| M02 | Core `src/core/tables.ts` | yes | `rollTable(def, rng, { jsonPath, resolve })` is the one table engine — grantLoot rolls through it (Custom Rule 3), never a second implementation |

## Context
Characters exist, spend pools, bind vancian slots, and carry conditions — but they
cannot hold anything. `CharacterState` (src/runtime/character.ts) has no inventory
field; `serializeCharacterState` (src/runtime/snapshots.ts) hard-codes
`inventory: []` and its header comment says "v1 engine state tracks no inventory";
`restoreCharacterState` drops the envelope's inventory field entirely. Meanwhile
the pack contract already validates `content.items` (`{name, kind?}` —
src/schema/artifacts.ts `ItemDef`, checked by validate/sections/content.ts's
`checkItems`) and the snapshot contract already declares
`inventory: [{id, qty}]` (snapshots.schema.json $defs/characterState, qty integer
≥ 1). Themes declare items; nothing consumes them.

**Ordering hazard this plan closes deliberately:** `CharacterState.inventory` is a
required field, so the moment it exists, `serializeCharacterState`'s hard-coded
`[]` and `restoreCharacterState`'s missing field are both wrong — the existing
snapshot round-trip test (`restored.state` deep-equals `state`,
tests/snapshots/character.test.ts) fails the moment the field lands. The engine
changes therefore land **together in checkpoint 1** (state + verbs + serialize +
restore); checkpoint 2 is the dedicated CA-01 proof with the extended snapshot
suite. Every checkpoint stays valid: no intermediate state where a character can
hold items that a snapshot loses.

**Established conventions you are extending (read them before writing):**
- Pool verbs live in `pools.ts` as `(runtime, state, …)` functions throwing
  `RuntimeRuleError` with `ruleCard(rule, artifactId, jsonPath, message, hint?)`
  and emitting one event per mutation (`pool:drained`, `spell:prepared`).
- Theme-table consumption lives in `conditions.ts` (`applyTheme`/`removeTheme`):
  look up `runtime.pack.tables[id]`, throw `unknown-theme` when absent, act on
  resolvable entries, throw `theme-grants-nothing` when none resolved. Loot
  mirrors this exact shape with item semantics.
- Facade methods on `Character` delegate one-to-one to the module functions.
- The barrel `src/runtime/index.ts` exports every lifecycle verb; leaving the new
  verbs out of it is the OWNER-08-BARREL failure mode from v1-core — export them
  in the same checkpoint that creates them.

## Capabilities
- **CAP-01 — Character inventory:** a character gains, drops, and counts items;
  every mutation emits a provenanced event; rejections (`unknown-item`,
  `item-not-held`, `insufficient-qty`, `invalid-amount`) leave no durable change
  and carry named rules. Entry: `Character.grant/drop/count` + the same functions
  standalone. Observable success: `state.inventory` reflects `{id, qty}`
  aggregates; `item:granted`/`item:dropped` events carry
  `why.rule = content.items.<id>`. Integration owner/checkpoint: this session,
  checkpoint 1.
- **CAP-02 — Loot resolution + restart leg:** `grantLoot` rolls a pack table
  through `rollTable` (seeded, deterministic per seed) and converts the rolled
  value into inventory under the CA-02 value convention; a snapshot round-trip
  preserves the stacks losslessly. Entry: `Character.loot(tableId, opts?)`.
  Observable success: deterministic grants for a fixed seed; `loot:rolled` names
  the table; a roll yielding nothing grantable rejects with
  `loot-grants-nothing` (no state change); restore reproduces the inventory.
  Integration owner/checkpoint: this session, checkpoint 2 (CA-01 proof).

Production path: host calls `grantLoot` → `rollTable` (core) → value mapped per
CA-02 → `state.inventory` mutated in place → events on the runtime's existing
`EventStream` → `serializeCharacter` envelope → host storage →
`restoreCharacter` on a fresh `Runtime`. This is the producer path SESSION-02's
theme loot tables and SESSION-03's docs compose against.

## Contract Agreements
- **CA-01 (snapshot inventory fidelity)** — STATE.md is authoritative. The
  envelope field `inventory` is `{id: string, qty: integer ≥ 1}[]` exactly
  (snapshots.schema.json $defs/characterState — DB-owned, unchanged). Producer:
  `serializeCharacterState`/`restoreCharacterState` in `src/runtime/snapshots.ts`
  (this session, checkpoint 1). Mapping: engine `state.inventory` ⇄ envelope
  `inventory` verbatim, fresh copies both directions; restore does **not**
  cross-validate item ids against the pack (verbatim state restoration, same
  discipline as pools/slots — validation happens at mutation time). Proof at
  checkpoint 2: round-trip deep-equal with a non-empty inventory, plus the
  envelope-key pin test (keys stay exactly the current 9 — inventory is already
  among them, verified at tests/snapshots/character.test.ts:47).
  **Recheck at checkpoint 0** against the committed schema file.
- **CA-02 (loot value convention)** — a table entry value grants inventory iff:
  (a) it is a string that resolves in `content.items` (qty 1), or (b) it is a
  plain object `{id: <item id>, qty: integer ≥ 1}`. Every other value is flavor:
  skipped, not granted, not an error by itself — but a roll where **nothing**
  was grantable rejects with `loot-grants-nothing`. Distinct concepts stay
  distinct: a string condition id in a theme table (applyTheme's vocabulary) is
  not an item here — the convention resolves against `content.items` only.
  Producer: `inventory.ts` (this session); consumer: every loot table in the
  shipped themes + wyldwood (SESSION-02 authors them against this convention —
  flagged in that prompt). Proof: `tests/runtime/inventory.test.ts` asserts each
  mapping branch. **This CA is provisional until this session's checkpoint 1
  lands** — Orchestrator rechecks the mapping against the committed
  `src/runtime/inventory.ts` before dispatching SESSION-02.
- No other CA applies: no schema/contract files change (Custom Rule 1 holds —
  `src/schema/contracts/**` is not in this lease and must not be touched); no
  DSL/registry change (no new effect vocabulary — loot is not an effect).

## Files to Create/Modify
| File | Action | What Changes |
|---|---|---|
| `src/runtime/inventory.ts` | create | The inventory module: verbs + loot resolution + events (API below) |
| `src/runtime/character.ts` | modify | `CharacterState.inventory` field + `InventoryEntry` type + 4 facade methods delegating to inventory.ts |
| `src/runtime/progression.ts` | modify | `buildCharacter` state literal gains `inventory: []` (one line) |
| `src/runtime/snapshots.ts` | modify | `serializeCharacterState` emits the real inventory; `restoreCharacterState` restores it; header comment's `inventory ⇄ []` line corrected |
| `src/runtime/index.ts` | modify | Barrel: export the new functions + types |
| `tests/runtime/inventory.test.ts` | create | Unit + behavior suite over the fixture packs |
| `tests/snapshots/character.test.ts` | modify | Inventory round-trip assertions (existing key-pin test keeps passing) |

## Implementation

### Checkpoint 1 — inventory lifecycle + snapshot fidelity (all engine changes together)
1. Read first: `src/runtime/pools.ts` (verb shape), `src/runtime/conditions.ts`
   (applyTheme precedent), `src/runtime/errors.ts`, `src/runtime/events.ts`,
   `src/runtime/snapshots.ts` serialize + restore sections, and the committed
   `src/schema/contracts/snapshots.schema.json` characterState def.
2. In `src/runtime/character.ts` add (near `ActiveCondition`):
   ```ts
   /** One held stack: plain data; qty >= 1; ids resolve in content.items. */
   export interface InventoryEntry {
     id: string;
     qty: number;
   }
   ```
   and add to `CharacterState`: `inventory: InventoryEntry[];`
3. Create `src/runtime/inventory.ts` with exactly this public surface (signatures
   pinned; bodies mirror pools.ts discipline — validate, mutate in place, emit):
   ```ts
   export function grantItem(runtime: Runtime, character: CharacterState,
     itemId: string, qty?: number): RuntimeEvent;            // default qty 1; stacks by id
   export function dropItem(runtime: Runtime, character: CharacterState,
     itemId: string, qty?: number): RuntimeEvent;            // removes the entry at qty 0
   export function countItem(runtime: Runtime, character: CharacterState,
     itemId: string): number;
   export function rollLoot(runtime: Runtime, tableId: string,
     rng: RandomSource): TableOutcome;                        // raw roll through core/tables
   export function grantLoot(runtime: Runtime, character: CharacterState,
     tableId: string, opts?: { seed?: number | string; rng?: RandomSource }):
       readonly RuntimeEvent[];                               // roll + CA-02 mapping
   ```
   - Rejections via `RuntimeRuleError` + `ruleCard`: `unknown-item`
     (path `content.items.<id>`), `item-not-held` (id absent entirely),
     `insufficient-qty` (drop more than held — name held vs requested),
     `invalid-amount` (non-positive-integer qty — mirror `invalid-spend` in
     pools.ts), `unknown-table` and `loot-grants-nothing` (mirror
     `unknown-theme` / `theme-grants-nothing` in conditions.ts).
   - A failed roll outcome (`TableOutcome.ok === false`) maps to named runtime
     rejections instead of being silent — mirror the engine's failure reasons as
     rule cards: `unresolvable-ref` → rule `unresolvable-ref` (jsonPath from the
     failure, artifactId = tableId); `range-gap` / `depth-exceeded` /
     `malformed-entries` → rule `table-roll-failed` naming the core reason in
     the message (jsonPath from the failure, artifactId = tableId) — keep names
     kebab-snake consistent with the existing rejection vocabulary. State MUST
     be unchanged on these rejections (no loot event emitted for a failed roll).
   - Events: `item:granted` payload `{itemId, qty, total}`; `item:dropped`
     payload `{itemId, qty, remaining}`; `loot:rolled` payload
     `{tableId, value, grants: [{itemId, qty}]}` — `why.rule` =
     `content.items.<id>` for item events, `tables.<tableId>` for loot.
     Event order in `grantLoot`: `loot:rolled` first, then one `item:granted`
     per granted stack, in roll order.
   - `grantLoot` rng resolution: `opts.rng` wins; else
     `new Rng(opts.seed ?? tableId)` — deterministic per seed, no ambient
     entropy (import `Rng`/`RandomSource` from `../core/rng` and
     `rollTable`/`TableOutcome` from `../core/tables` — the direct-module
     pattern encounter.ts uses; check exact names in `src/core/index.ts`).
   - Nested-table resolver normalizes both reference spaces (CA-02):
     `(ref) => typeof ref === 'string' ? (runtime.pack.tables[ref] ??
     (ref.startsWith('tables.') ? runtime.pack.tables[ref.slice('tables.'.length)] : undefined)) : undefined`
     — theme-space nested refs are bare ids (stage-7 resolverOf, shipped themes
     barrow-loot→common-relics); pack-space refs are 'tables.'-prefixed (the
     committed fixture loot-chain→'tables.district-scavenge', validator
     semantics).
   - Type-only import of `CharacterState` from `./character` (value imports
     flow the other way: character.ts → inventory.ts functions; this avoids a
     third value-import cycle — M03 already has two, keep them the only ones).
4. Facade methods on `Character` (delegate, same style as `spend`/`prepare`):
   `grant(itemId, qty?)`, `drop(itemId, qty?)`, `count(itemId)`,
   `loot(tableId, opts?)`.
5. `buildCharacter` (progression.ts): add `inventory: []` to the state literal.
6. Snapshots (same checkpoint — see the Ordering hazard above):
   `serializeCharacterState` gains
   `inventory: state.inventory.map((entry) => ({ id: entry.id, qty: entry.qty }))`
   replacing the hard-coded `[]`; `restoreCharacterState` carries
   `inventory: saved.inventory.map((entry) => ({ ...entry }))` into the returned
   state; correct the header mapping line to `inventory ⇄ state.inventory (CA-01)`.
7. Barrel (`src/runtime/index.ts`): export `type InventoryEntry` from
   `./character` and `grantItem, dropItem, countItem, rollLoot, grantLoot` from
   `./inventory`.
8. Tests `tests/runtime/inventory.test.ts` over `cloneRuntimePack()` (its
   `district-scavenge` table rolls `bandage` — not an item, flavor, skipped —
   and `{id: 'rope', qty: 1}` — a real grant; `wandering-dread` grants nothing
   grantable → the rejection branch): grant stacks, drop to removal, count,
   every rejection rule, `grantLoot` deterministic across two calls with the
   same seed and different across seeds, CA-02 branches, plain-JSON purity
   (`structuredClone`/`JSON.stringify` equality on state), and a `loot:rolled`
   event whose `grants` reflect exactly what landed. The suite explicitly
   asserts nested recursion through the committed fixture's `loot-chain` for
   BOTH reference forms: the fixture's `'tables.district-scavenge'`-prefixed
   inner ref resolves through the normalized resolver — the roll lands
   `bandage` (flavor, skipped) or `{id: 'rope', qty: 1}` (grant) or its
   weight-1 `nothing` branch (seeds may land either branch; deterministic per
   seed, so assert the exact observed behavior for the named seeds used); and a
   bare-id form resolves too — build a local test pack in `inventory.test.ts`
   (in-lease) with a bare-id nested table mirroring the shipped themes'
   `barrow-loot → common-relics` shape. Also assert the failed-outcome branch:
   a dangling inner ref yields the named rejection (`unresolvable-ref`, not a
   silent skip) and leaves `JSON.stringify(state)` unchanged.

**Commit when:** `pnpm typecheck` exit 0, `pnpm lint` exit 0, full `pnpm test`
green — including the existing snapshot suite, which now passes *because* the
fidelity landed in this same checkpoint (the round-trip test's
`restored.state` deep-equals `state` only once restore carries inventory).
Pathspec: `git add -- src/runtime/inventory.ts src/runtime/character.ts
src/runtime/progression.ts src/runtime/snapshots.ts src/runtime/index.ts
tests/runtime/inventory.test.ts` — commit subject
`{F_NAME} SESSION-01: checkpoint 1 — inventory lifecycle + snapshot fidelity`.

### Checkpoint 2 — CA-01 proof (snapshot test extension)
1. Extend `tests/snapshots/character.test.ts`: a character holding items
   (grant, then maybe drop one stack partially) serializes with the exact
   stacks; `serialize → JSON.parse(JSON.stringify) → restoreCharacter` on a
   fresh Runtime deep-equals the original state including inventory; the
   envelope-key pin (the existing `Object.keys(snap.state).sort()` assertion)
   still passes unchanged — the envelope shape itself does not move; qty stays
   ≥ 1 (no zero-qty entries in the envelope).

**Commit when:** `pnpm typecheck` + `pnpm lint` exit 0, full `pnpm test` green.
Pathspec: `git add -- tests/snapshots/character.test.ts` — commit subject
`{F_NAME} SESSION-01: checkpoint 2 — CA-01 snapshot proof`.

## Verification
- Lease-scoped gates (the `pnpm test -- <pattern>` filter is a documented
  no-op hazard — use `npx vitest run <path>`): `npx vitest run
  tests/runtime/inventory.test.ts`, `npx vitest run
  tests/snapshots/character.test.ts`, then whole-repo
  `pnpm typecheck && pnpm lint && pnpm test` (baseline at plan HEAD:
  typecheck 0, lint 0, 421/421 across 30 files — do not relax).
- CA-01 proof (ck2): round-trip
  `serializeCharacter → JSON.parse(JSON.stringify) → restoreCharacter` on a fresh
  Runtime deep-equals the original state including inventory; envelope keys
  unchanged (9 keys, inventory among them).
- CA-02 proof (ck1): same seed ⇒ same grants; each convention branch asserted;
  rejection leaves `JSON.stringify(state)` unchanged.
- No `src/schema/contracts/**`, no `src/core/**`, no compiler paths in any
  commit — the runtime-only bundle must stay compiler-free (isolation gate is
  re-verified at SESSION-03 against the built package).

## State Update
Return a Handoff with: status; checkpoints committed (paths + commit ids);
landed symbols (`InventoryEntry`, `grantItem`, `dropItem`, `countItem`,
`rollLoot`, `grantLoot`, facade `grant/drop/count/loot`); checks actually run
with pass counts; CA-01/CA-02 evidence pointers; the observed deterministic
`grantLoot` output on `cloneRuntimePack()`'s `district-scavenge` for one named
seed; surprises; followUp for SESSION-03 (the docs block calls
`grantLoot` on a generated dark-fantasy pack — name any rejection-message
wording the docs may quote).