# SESSION-03 — Runtime movement engine: hex geometry, terrain, pathing, provoke pause, snapshots

> **Program:** Ruleswright
> **Feature:** grid-movement
> **Modules:** M03
> **Depends on:** SESSION-02
> **Concurrent with:** —
> **Owns:** `src/runtime/combat/spatial.ts`, `src/runtime/combat/combat.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/character-profile.ts`, `src/runtime/snapshots.ts`, `src/runtime/equipment.ts`, `src/runtime/display-roll.ts`, `src/runtime/index.ts`, `tests/runtime/combat/movement-geometry.test.ts`, `tests/runtime/combat/movement.test.ts`, `tests/runtime/fixtures/packs.ts`, `tests/snapshots/combat.test.ts`
> **Reads:** `src/schema/pack.ts`, `src/core/dsl/effect.ts`, `src/core/dsl/registry.ts`, `src/runtime/combat/triggers.ts`, `src/runtime/combat/action-economy.ts`, `src/runtime/runtime.ts`, `src/runtime/bestiary.ts`, `src/runtime/errors.ts`, `src/schema/contracts/snapshots.schema.json`, `program/Ruleswright/specs/database.md` (v1.5), `program/Ruleswright/mocks/spatial.html`, `tests/runtime/combat/combat-spatial.test.ts`, `tests/runtime/combat/spatial-triggers.test.ts`, `tests/proofs/grid-journey.test.ts`
> **Resources:** —
> **Checkpoints:** 5

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M03 | Runtime | `combat/spatial.ts` (whole, 134 lines), `combat/combat.ts` (whole, 1015 lines: `startCombat` l.172, `declare` l.388, `resolveTarget` l.609, `spatialGate` l.658, `resolveShape` l.673, `execute` l.759, `surfaceOffers` l.836, `respond` l.546, `step` l.346, `displayRoll` l.1002), `combat/resolve.ts` (`CombatantProfile` l.77, `profileFromStatblock` l.198, `executeAgainst` l.334), `character-profile.ts` l.56, `snapshots.ts` l.395-600, `equipment.ts` `rollText` l.352, `index.ts` barrel | The whole movement column lives here |
| M02 | Core (read) | `effect.ts` `EffectApply.move?`, `MoveOutcome`, `EFFECT_SCALARS` (S02) | The seam you wire |

## Context

S02 landed:
- `SpatialDef.model: 'grid' | 'hex'`, `SpatialDef.terrain?`, `TerrainKind`;
- the core `move(formula)` statement, which calls the optional `EffectApply.move(budget)`
  and throws when it is absent;
- `speed` in `EFFECT_SCALARS`;
- validator rules (root-only, dice-free, action-only, `speed` ⇒ `formulas.speed`).

This session builds the engine side, column by column. Geometry comes first; then the
first narrow journey (a real Runtime → startCombat → declare move → serialize/restore);
then provoke; then snapshots; then the surface close.

**Close the S02 → S03 coverage window first** (ck1): `spatialFromPack` must dispatch on
`model`.

**Design decisions you implement are STATE.md DD-M2, DD-M4…DD-M13.** The committed
database.md v1.5 and spatial.html are authoritative. If they differ from this prompt, the
committed text wins; report the delta.

## Capabilities

- **CAP-M1** (hex geometry): integration owner at ck1 for the unit leg.
- **CAP-M2** (move): **the first narrow journey.** Owned at ck2 through the real path:
  - `new Runtime(validated fixture pack)` → `spawnMonster` / `profileFromCharacter`
    (`speed` on profiles) → `startCombat({positions, terrain})` → `step()` →
    `declare('stride', {to})` → movement gate → `spend` → `executeAgainst` → the `move`
    statement → `apply.move` → path walk → `move:advanced` / `move:ended`;
  - then `serializeCombat` → `JSON` → `deserializeCombat` with the re-stated
    positions/terrain → the moved position holds.
- **CAP-M3** (terrain): ck2.
- **CAP-M4** (provoke): ck3, on a fixture pack.
- **CAP-M5** (pause snapshot): ck4.
- **CAP-M7** (theater no-op): ck2.

No mocked boundary. Dice are scripted through the `ScriptedRng` idiom only where an
assertion needs a verdict.

## Contract Agreements

**Checkpoint-0 recheck (mandatory):**
- Read S02's handoff and the committed `effect.ts` / `pack.ts`: the `EffectApply.move`
  signature, the `MoveOutcome` shape, `TerrainKind`.
- Read database.md v1.5 §spatial/§formulas/Snapshot Envelopes and `snapshots.schema.json`
  `pendingMove`.
- Axis (a): every input you construct already exists (types from S02; `evalPackFormula`,
  `resolveSlotGrants`, `offersForEvent`, `emitOffer` in-tree).
- Axis (b): `apply.move(budget: number): void` fits a combat-side closure.
- Axis (c): the rejection kinds, event names and reasons match database.md verbatim.
- Record the result of each axis in the handoff.

| CA | What you prove | Where |
|----|----------------|-------|
| CA-M1 | Hex distance, neighbors, reach/`adjacent`/burst on hex; grid unchanged; terrain vocabulary adapter | ck1 `movement-geometry.test.ts` |
| CA-M2 | `speed` on both profile builders; `vars.speed` bound; `apply.move` wired; budget evaluated at gate time without consuming RNG | ck2 `movement.test.ts` |
| CA-M3 | `declare({to})` path legality + the five rejection kinds (no change: `serialize()` deep-equal before and after, RNG words equal, ledger equal); `startCombat` terrain refusals (aggregate, nothing built) | ck2 |
| CA-M4 | `move:leaving-reach` per threatener; pause iff offers; resume on empty queue; the three resume re-checks; forfeit on `step()` | ck3 |
| CA-M5 | `pendingMove` serialize (only when set) → JSON → restore → `respond` resumes identically to the uninterrupted fight; bad `actionId` → E-SNAP-01; CAP-G5 restore gate unchanged | ck4 `tests/snapshots/combat.test.ts` |
| CA-M7 | Theater pack: a move is a no-op success, no `move:*` events; terrain given → no refusal, never consulted | ck2 |

## Files to Create/Modify

| File | Action | What Changes |
|------|--------|--------------|
| `src/runtime/combat/spatial.ts` | modify | `hexGeometry`; `SpatialGeometry.neighbors(p)`; `model` dispatch in `spatialFromPack`; `findPath(...)`; `TerrainMap` helpers; header comment |
| `src/runtime/combat/combat.ts` | modify | `CombatantState.pendingMove?`; `CombatState.terrain`; `StartCombatRequest.terrain?`; `DeclareOptions.to?`; the movement gate; move-action self-targeting; `apply.move` walk + events; provoke pause/resume in `respond`; forfeit in `step`; `DeclareRejection` kinds; `displayRoll` re-exported from the leaf |
| `src/runtime/combat/resolve.ts` | modify | `CombatantProfile.speed?`; `profileFromStatblock` evaluates the reserved `speed`; `executeAgainst` binds `vars.speed` and accepts an optional `move` callback |
| `src/runtime/character-profile.ts` | modify | `speed` from `formulas.speed` over the same `base` as `initiative` |
| `src/runtime/snapshots.ts` | modify | `SnapshotCombatant.pendingMove?`; `CombatRestoreRequest.terrain?`; serialize/restore + E-SNAP-01 refusal |
| `src/runtime/display-roll.ts` | create | the `displayRoll` leaf (moved verbatim from combat.ts) |
| `src/runtime/equipment.ts` | modify | delete the private `rollText`; import `displayRoll` from the leaf |
| `src/runtime/index.ts` | modify | export `hexGeometry`, `findPath`, `MoveRejection`/new types, `PendingMove`, `TerrainCell`; keep `displayRoll` |
| `tests/runtime/fixtures/packs.ts` | modify | `emberMarchesHexPack()`: the spatial fixture with `model:'hex'`, terrain kinds, `formulas.speed`, a `stride` action, an `opportunist` reaction |
| `tests/runtime/combat/movement-geometry.test.ts` | create | geometry + pathing units |
| `tests/runtime/combat/movement.test.ts` | create | the movement column + provoke |
| `tests/snapshots/combat.test.ts` | modify | the `pendingMove` round-trip + refusal |

## Implementation

### Checkpoint 1 — geometry (closes the coverage window)

```ts
export interface SpatialGeometry {
  readonly enabled: boolean;
  readonly model?: 'grid' | 'hex';
  distance(a: Position, b: Position): number;
  canReach(from: Position, to: Position, reach: number): boolean;
  inBurst(center: Position, radius: number, candidates: readonly (readonly [string, Position])[]): readonly string[];
  /** v1.5 — adjacent cells in the fixed tie-break order (DD-M2/DD-M4); theater = []. */
  neighbors(p: Position): readonly Position[];
}
export function hexGeometry(model: SpatialModel): SpatialGeometry; // axial; mirrors grid's max(reach, defaultReach) quirk (DD-M14)
export function spatialFromPack(pack: { spatial?: SpatialDef }): SpatialGeometry; // grid → gridGeometry, hex → hexGeometry
export interface TerrainCell { readonly at: Position; readonly kind: string; }
export interface PathQuery {
  readonly from: Position; readonly to: Position; readonly budget: number;
  readonly terrain: Readonly<Record<string, TerrainKind>>; // pack vocabulary
  readonly cells: readonly TerrainCell[];                   // host placement
  readonly passable: (p: Position) => boolean;              // not a standing enemy
  readonly endable: (p: Position) => boolean;               // not any standing combatant
}
export type PathResult =
  | { ok: true; path: readonly Position[]; cost: number } // path excludes `from`, includes `to`
  | { ok: false; kind: 'blocked' | 'occupied' | 'unreachable' | 'out-of-range'; cost?: number };
export function findPath(geometry: SpatialGeometry, query: PathQuery): PathResult;
```

- **Dijkstra:** entering a cell costs `terrain[kind].cost` (1 when plain); a `blocks` cell is
  never entered. It is deterministic: the priority is (cost, insertion sequence), and
  neighbors expand in `neighbors()` order.
- **Search bound (a finite search on an unbounded plane):** stop expanding cells whose cost
  exceeds the budget. For `out-of-range` detection, run the same search once more with
  budget = `distance(from, to) × maxCost`, where `maxCost` = the largest terrain cost or 1.
  Report the cheapest cost if one is found.
- **Classification order:**
  1. `to` is a blocking cell → `blocked`;
  2. `!endable(to)` → `occupied`;
  3. no path at the extended bound → `unreachable`;
  4. cheapest cost > budget → `out-of-range`.

**Commit when:**
- `pnpm typecheck` is 0;
- `pnpm exec vitest run tests/runtime/combat/movement-geometry.test.ts
  tests/runtime/combat/combat-spatial.test.ts tests/runtime/combat/spatial-triggers.test.ts`
  is green;
- `movement-geometry.test.ts` covers:
  - hex distance on a known table (`(0,0)→(2,-1)=2`, `(0,0)→(-3,3)=3`, `(1,-2)→(-1,1)=3`);
  - the 6 hex neighbors in the pinned order; the 8 grid neighbors;
  - hex `inBurst` radius 1 = 7 cells;
  - a grid geometry byte-identical to before (the existing `combat-spatial` tests
    untouched and green);
  - a path around a blocking wall; difficult cost 2 chosen versus a longer plain detour
    (the cheapest wins; ties go to the neighbor order);
  - each `PathResult` failure kind.

### Checkpoint 2 — the move column (first narrow journey)

1. **Profiles.**
   - `CombatantProfile.speed?: number`.
   - `profileFromStatblock` and `profileFromCharacter` set `speed` when `formulas.speed` is
     declared (same `evalPackFormula` idiom and same `base` vars as `initiative`).
   - `CombatantState.speed?` is copied at `startCombat` and restore (profile-sourced, like
     `initiativeBonus`).
2. **Vars.** `executeAgainst` sets `vars['speed'] = actor.profile.speed ?? 0` next to
   `initiative`. Engine-derived, so it overrides a same-named ability, as `hp`/`ac` already
   do. It also takes an optional `move?: (budget: number) => void` parameter (appended last)
   and passes it as `apply.move` only when given.
3. **Terrain at start.**
   - `StartCombatRequest.terrain?: readonly TerrainCell[]` →
     `CombatState.terrain: TerrainCell[]` (plain JSON; `[]` when absent).
   - Refusals, in one aggregate `RuntimeRuleError`, **E-SPAT-01**, before any RNG is
     consumed, spatial packs only: an unknown kind; a duplicate cell; a combatant
     positioned on a blocking cell. A theater pack given terrain: no refusal; it rides
     along unconsulted, like positions (DD-M11).
4. **Declare.**
   - `DeclareOptions.to?: Position`.
   - A **move action** is an action whose parse-once AST root is `call` `move`: read
     `runtime.index.actionEffects[actionId]`. There is no string matching at play time.
   - For a move action:
     - the target is the actor (skip `resolveTarget` and `spatialGate`);
     - the validity clause runs as today;
     - then the **movement gate** (spatial packs only): missing `to` → `no-destination`;
       otherwise the budget is `valueOfFormula(evalFormula(root.args[0], vars, zeroRng))`,
       where `vars` = the same actor vars `executeAgainst` builds (`speed` included). This
       is RNG-free and dice-free by S02's checker;
     - then `findPath`. Any failure → one `declare:rejected` event, rule `E-SPAT-01`, kind as
       returned, message naming cost and budget;
     - cost check, then spend, then execute, exactly as today.
   - Keep the computed path for the walk.
5. **The walk (`apply.move`).**
   - Walk the planned path cell by cell.
   - At the end (arrived) emit `move:advanced {from, to, path, cost, remaining}` and then
     `move:ended {reason: 'arrived', at}`, both with `why.rule = actions.<id>`.
   - Update `position` immutably; `CombatantState.position` is readonly.
   - **Theater pack:** `apply.move` is a no-op; no `move:*` events (CA-M7).
6. **Rejection types.**
   - Add `SpatialRejection`-shaped kinds: `DeclareRejection` gains
     `{kind: 'no-destination' | 'blocked' | 'occupied' | 'unreachable' | 'out-of-range';
     rule: 'E-SPAT-01'; ...}`.
   - Widen `SpatialRejection.kind` to a union in `spatial.ts`, or add `MoveRejection` there.
     Choose one and export it.

Tests (`movement.test.ts`) on `emberMarchesHexPack()`, through `new Runtime(...)`:
- A monster and a hero move to a destination; the position changes; the events are ordered
  `move:advanced` → `move:ended` → `action:resolved`; the move slot is spent.
- A difficult cell costs 2.
- Each of the five rejections leaves `fight.serialize()` deep-equal, RNG words equal, and
  the ledger equal.
- `rooted` (restricts `actions.tagged:move`) rejects `stride` as `restricted`, with no new
  code.
- `speed` shadows an ability named `speed` in a hand-built pack.
- Terrain start refusals, all cards in one aggregate.
- A theater pack (hex fixture minus `spatial`) loads; `stride` resolves with no position
  and no `move:*` events.
- **The journey leg:** move → `serializeCombat` → `JSON.parse(JSON.stringify())` →
  `deserializeCombat(rt, snap, {allies, enemies, positions: <from snapshot>, terrain})` →
  the position holds and the next `declare` in reach succeeds.

**Commit when:** `pnpm typecheck` is 0, and
`pnpm exec vitest run tests/runtime tests/snapshots` is green.

### Checkpoint 3 — provoke, pause, resume

- **In the walk, before stepping from cell P to cell Q:** for every standing combatant `T`
  on the other side with a position, where `canReach(T.pos, P, reachOf(T))` and
  `!canReach(T.pos, Q, reachOf(T))`, emit
  `move:leaving-reach {actor: mover, target: T, payload: {at: P, next: Q}}`.
- **Offers:** collect them through the existing `offersForEvent`/`emitOffer` path, the same
  code `surfaceOffers` uses, and skip downed reactors.
- **If ≥ 1 offer is new:**
  - stop at P;
  - emit `move:advanced` for the segment walked so far (omit it when empty);
  - set `mover.pendingMove = {actionId, to, remaining: budget − costSoFar}`;
  - return.

  The effect's walk ends there. `resolve()` still emits `action:resolved`, which is the
  declared action's resolution.
- **`respond()`:** after it resolves or declines and the queue is **empty**, if the active
  combatant has a `pendingMove`, resume:
  1. downed → `move:ended {reason: 'downed'}`;
  2. `restrictionRejection(actor, def) !== undefined` → `'restricted'`;
  3. otherwise re-plan `findPath` from the current cell with `remaining`, using the current
     occupancy. Failure → `'blocked'`. Success → walk again (a walk may pause again).

  Clear `pendingMove` when the move ends. `respond()` returns its events plus the
  resumption events.
- **`step()`:** a `pendingMove` present → emit `move:ended {reason: 'forfeited'}`, clear
  it, then behave exactly as today.
- **Do not change** `resolveTarget`/`respond` target defaults (DD-M13). The host passes the
  mover as `targetId`.

Tests:
- Leaving one threatener's reach: an offer, a pause, a take (an attack against the mover at
  P, in reach, so the spatial gate passes), then a resume to the destination.
- Decline → resume.
- Two threateners → two offers; the move resumes only after both are answered.
- The reaction downs the mover → `downed`.
- The reaction applies `rooted` → `restricted`.
- An ally stepping into the vacated destination blocks the re-plan → `blocked` (use a
  second fixture ally's reaction or a direct state setup; document which).
- `step()` while paused → `forfeited`, then the turn ends.
- A pack with no matching reaction never pauses, and events are unchanged apart from
  `move:leaving-reach` itself.

**Commit when:** `pnpm exec vitest run tests/runtime tests/snapshots tests/proofs` is
green (grid-journey, rules-are-data and perf-budget unchanged).

### Checkpoint 4 — snapshots

- `SnapshotCombatant.pendingMove?`: emit it only when set; restore it into
  `CombatantState`.
- `CombatRestoreRequest.terrain?`: re-stated like positions; same refusals as `startCombat`.
- `combatRestoreRefusals` gains E-SNAP-01 for a `pendingMove.actionId` that is not a
  declared action whose AST root is `move`.
- Positions: CAP-G5 is unchanged. The host re-states them. Do **not** read frozen
  positions.

Test (`tests/snapshots/combat.test.ts`, spatial describe block):
1. Pause mid-move.
2. Serialize → JSON → restore with the positions read from `snap.combatants[].position`
   and the same terrain.
3. `respond` in both fights: the uninterrupted fight and the restored one produce
   identical `move:*` payloads and final positions.

Also test the refusal for a bad `actionId`.

**Commit when:** `pnpm exec vitest run tests/snapshots` is green, and
`python3 -c "import json;json.load(open('src/schema/contracts/snapshots.schema.json'))"`
still parses. The contract is read-only here; confirm the field names against it.

### Checkpoint 5 — surface close + carried leaf

- Create `src/runtime/display-roll.ts` holding `displayRoll` verbatim (same signature and
  output).
- `combat.ts` imports it and re-exports it (`export { displayRoll } from '../display-roll'`
  or the equivalent), so `src/runtime/index.ts:77` keeps working.
- `equipment.ts` deletes `rollText` and imports `displayRoll` from the leaf. The leaf
  imports only `core/dice` types, so no cycle is created.
- Barrel: export every new public symbol (`hexGeometry`, `findPath`, `TerrainCell`,
  `PathQuery`, `PathResult`, `PendingMove`, the rejection type). **Barrel completeness is a
  standing recommendation; grep your own new exports against `index.ts` before
  committing.**

**Commit when:** all of these are 0/green: `pnpm typecheck`, `pnpm lint`,
`pnpm format:check`, `pnpm build`, `pnpm check:isolation`, `pnpm check:security`,
`pnpm test` (whole suite; run `pnpm build` first because loot/equipment journeys read
`dist/`).

## Verification

- All seven package gates at ck5 (commands per the STATE Verification Baseline).
- CA evidence: for each CA row above, list test names with their checkpoint commit.
- Record the whole-suite count at close.

## State Update

Report:
- status and checkpoints;
- landed symbols and their files;
- exact event payload shapes and rejection messages (S04 asserts them);
- how the `blocked`-on-resume case was set up;
- any deviation from DD-M9/M10 with its reason;
- the axis (a)–(d) results at ck0;
- confirmation that the coverage window closed at ck1.

`followUp` for S04:
- the `respond(triggerId, 'take', moverId)` harness pattern;
- that the path is planned at declare time and re-planned on resume;
- the fixture numbers that pin costs.
