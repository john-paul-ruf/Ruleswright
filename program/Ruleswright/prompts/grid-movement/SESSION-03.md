# SESSION-03 — Runtime movement engine: hex geometry, terrain, pathing, provoke pause, snapshots

> **Program:** Ruleswright
> **Feature:** grid-movement
> **Modules:** M03
> **Depends on:** SESSION-02
> **Concurrent with:** —
> **Owns:** `src/runtime/combat/spatial.ts`, `src/runtime/combat/combat.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/character-profile.ts`, `src/runtime/snapshots.ts`, `src/runtime/equipment.ts`, `src/runtime/display-roll.ts`, `src/runtime/index.ts`, `tests/runtime/combat/movement-geometry.test.ts`, `tests/runtime/combat/movement.test.ts`, `tests/runtime/fixtures/packs.ts`, `tests/snapshots/combat.test.ts`
> **Reads:** `src/schema/pack.ts`, `src/core/dsl/effect.ts`, `src/core/dsl/registry.ts`, `src/runtime/combat/triggers.ts`, `src/runtime/combat/action-economy.ts`, `src/runtime/runtime.ts`, `src/runtime/bestiary.ts`, `src/runtime/errors.ts`, `src/schema/contracts/snapshots.schema.json`, `program/Ruleswright/specs/database.md` (v1.5), `program/Ruleswright/mocks/spatial.html`, `tests/runtime/combat/combat-spatial.test.ts`, `tests/runtime/combat/spatial-triggers.test.ts`, `tests/runtime/equipment.test.ts`, `tests/runtime/combat/character-profile.test.ts`, `tests/proofs/grid-journey.test.ts`
> **Resources:** —
> **Checkpoints:** 5

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M03 | Runtime | `combat/spatial.ts` (whole, 131 lines; `canReach` l.60-61), `combat/combat.ts` (whole, 1015 lines: `DeclareOptions` l.112, `startCombat` l.173, `offeredCount` l.320, `step` l.346, `declare` l.385 (its `surfaceOffers` call l.456), `use` l.471 (per-call `surfaceOffers(effectEvents)` l.541), `respond` l.546, `resolveTarget` l.609, `spatialGate` l.658, `resolveShape` l.673, `resolve` l.728 (returns the round window l.743), `execute` l.752 (per-call sink l.758-763; mutation sink + shape callback l.768-797), `surfaceOffers` l.837, `resolveReactive` l.850, `rejectionEvent` l.934, `displayRoll` l.1002), `combat/resolve.ts` (`CombatantProfile` l.76, `profileFromStatblock` l.198, `executeAgainst` l.332, its `apply` object l.350-365), `character-profile.ts` (`initiativeBonus` l.106-107), `snapshots.ts` l.395-600 (`SnapshotCombatant` l.405, `CombatRestoreRequest` l.435, `CombatState` build l.549-557, phase l.554, restored offer l.558-567), `equipment.ts` (`useItem` vars l.272-280, `scopedFormula` l.341, `rollText` l.352), `index.ts` barrel (`displayRoll` l.77) | The whole movement column lives here |
| M03 | Triggers (read) | `combat/triggers.ts` (`eventMatches` l.31-41, base-before-`[` l.33; `offersForEvent` l.62-81, `matchingEvent: event.type` l.75; `emitOffer`/`emitDeclined`) | Offer semantics you must preserve |
| M02 | Core (read) | `effect.ts` `EffectApply.move?`, `MoveOutcome`, `EFFECT_SCALARS` (S02) | The seam you wire |

## Context

S02 landed:
- `SpatialDef.model: 'grid' | 'hex'`, `SpatialDef.terrain?`, `TerrainKind`;
- the core `move(formula)` statement, which calls the optional `EffectApply.move(budget)`
  and throws when it is absent;
- `speed` in `EFFECT_SCALARS`;
- validator rules (root-only, dice-free, action-only, `speed` at a formula position ⇒
  `formulas.speed`).

This session builds the engine side, column by column. Geometry comes first. Then the
first narrow journey: a real Runtime → startCombat → declare move → serialize/restore with
terrain re-stated. Then provoke, with per-call offer surfacing. Then the paused-move
snapshot, with the derived restore phase. Then the surface close.

**Close the S02 → S03 coverage window first** (ck1): `spatialFromPack` must dispatch on
`model`.

**Design decisions you implement are STATE.md DD-M2, DD-M4…DD-M13, DD-M18 and DD-M19**,
including every **[F-P…]** amendment (REPLAN-GM-01, 2026-09-30, from the Archivist
planning-completeness review; see STATE "Planning completeness review (2026-09-30)"). The
committed database.md v1.5 and spatial.html are authoritative. If they differ from this
prompt, the committed text wins; report the delta.

**Where the executor callbacks are built (F-P7):** the `apply` object is built in
`resolve.ts` `executeAgainst` (l.350-365), not in `combat.ts`. `combat.ts` `execute`
(l.768-797) supplies the mutation sink and the shape callback. The move callback follows
the same route: `combat.ts` builds the closure and `executeAgainst` places it on `apply`.

## Capabilities

- **CAP-M1** (hex geometry): integration owner at ck1 for the unit leg.
- **CAP-M2** (move): **the first narrow journey.** Owned at ck2 through the real path:
  - `new Runtime(validated fixture pack)` → `spawnMonster` / `profileFromCharacter`
    (`speed` on profiles when declared) → `startCombat({positions, terrain})` → `step()` →
    `declare('stride', {to})` → movement gate → `spend` → `executeAgainst` → the `move`
    statement → `apply.move` → path walk → `move:advanced` / `move:ended`;
  - then `serializeCombat` → `JSON` → `deserializeCombat` with the re-stated
    positions **and terrain** (restore terrain lands at ck2, F-P3) → the moved position
    holds.
  - Also out-of-combat `useItem` reads `speed` (F-P5).
- **CAP-M3** (terrain, including restore): ck2.
- **CAP-M4** (provoke, per-call offers): ck3, on a fixture pack.
- **CAP-M5** (pause snapshot, derived phase): ck4.
- **CAP-M7** (theater no-op): ck2.

No mocked boundary. Dice are scripted through the `ScriptedRng` idiom only where an
assertion needs a verdict.

## Contract Agreements

**Checkpoint-0 recheck (mandatory):**
- Read S02's handoff and the committed `effect.ts` / `pack.ts`: the `EffectApply.move`
  signature, the `MoveOutcome` shape, `TerrainKind`.
- Read database.md v1.5 §spatial/§formulas/Snapshot Envelopes and `snapshots.schema.json`
  `pendingMove`. Confirm that the F-P1, F-P2, F-P9, F-P10a/b and F-P5 statements there
  match STATE DD-M6/M7/M9/M10/M12.
- Axis (a): every input you construct already exists (types from S02; `evalPackFormula`,
  `resolveSlotGrants`, `offersForEvent`, `emitOffer`, `scopedFormula` in-tree).
- Axis (b): `apply.move(budget: number): void` fits a combat-side closure.
- Axis (c): the rejection kinds, event names and reasons match database.md verbatim.
- Axis (d): each CA row below names the test that proves it on the real path.
- Record the result of each axis in the handoff.

| CA | What you prove | Where |
|----|----------------|-------|
| CA-M1 | Hex distance, neighbors, reach/`adjacent`/burst on hex; grid unchanged; terrain vocabulary adapter; region-bounded exact search (a wall detour whose cost exceeds the budget → `out-of-range`, never `unreachable`) | ck1 `movement-geometry.test.ts` |
| CA-M2 | `speed` on both profile builders (only when `formulas.speed` is declared); `vars.speed` bound; `apply.move` wired; budget evaluated at gate time without consuming RNG; out-of-combat `useItem` binds `speed` (`heal(speed)` succeeds) | ck2 `movement.test.ts` |
| CA-M3 | `declare({to})` path legality + the five rejection kinds, including `to` = own cell → `occupied` (no change: `serialize()` deep-equal before and after, RNG words equal, ledger equal); `startCombat` terrain refusals (aggregate, nothing built); restore terrain (same refusals) | ck2 |
| CA-M4 | `move:leaving-reach` per threatener; per-call offers (each exactly once; queue empties after answers); offers not filtered by affordability, and a spent-slot take is refused with no change; pause iff offers; resume on empty queue; the three resume re-checks; forfeit on `step()` | ck3 |
| CA-M5 | `pendingMove` serialize (only when set) → JSON → restore (derived `resolved` phase; restored offer `on` = event type) → `respond` resumes identically to the uninterrupted fight; `step()` forfeit parity; bad `actionId` → E-SNAP-01; CAP-G5 restore gate unchanged | ck4 `tests/snapshots/combat.test.ts` |
| CA-M7 | Theater pack: a move is a no-op success, no `move:*` events; terrain given → no refusal, never consulted | ck2 |

## Files to Create/Modify

| File | Action | What Changes |
|------|--------|--------------|
| `src/runtime/combat/spatial.ts` | modify | `hexGeometry`; `SpatialGeometry.neighbors(p)`; `model` dispatch in `spatialFromPack`; `findPath(...)` (region-bounded exact Dijkstra, DD-M18); `TerrainCell`; header comment |
| `src/runtime/combat/combat.ts` | modify | `CombatantState.pendingMove?`, `CombatantState.speed?`; `CombatState.terrain`; `StartCombatRequest.terrain?`; `DeclareOptions.to?`; the movement gate; move-action self-targeting; `apply.move` walk + events; **per-call offer surfacing** (F-P1); provoke pause/resume in `respond`; forfeit in `step`; `DeclareRejection` kinds; `displayRoll` re-exported from the leaf |
| `src/runtime/combat/resolve.ts` | modify | `CombatantProfile.speed?`; `profileFromStatblock` evaluates the reserved `speed` when declared; `executeAgainst` binds `vars.speed` and accepts an optional `move` callback |
| `src/runtime/character-profile.ts` | modify | `speed` from `formulas.speed` over the same `base` as `initiative`, **omitted when `formulas.speed` is absent** (keeps the `character-profile.test.ts:309-329` pin green, F-P6b) |
| `src/runtime/snapshots.ts` | modify | **ck2:** `CombatRestoreRequest.terrain?`, its refusals, the `CombatState.terrain` rebuild (F-P3). **ck4:** `SnapshotCombatant.pendingMove?`; serialize/restore + E-SNAP-01 refusal; derived restore phase; restored offer `matchingEvent` = event type (F-P2) |
| `src/runtime/display-roll.ts` | create | the `displayRoll` leaf (moved verbatim from combat.ts) |
| `src/runtime/equipment.ts` | modify | **ck2:** `useItem` vars bind `speed` (F-P5). **ck5:** delete the private `rollText`; import `displayRoll` from the leaf |
| `src/runtime/index.ts` | modify | export `hexGeometry`, `findPath`, `MoveRejection`/new types, `PendingMove`, `TerrainCell`; keep `displayRoll` |
| `tests/runtime/fixtures/packs.ts` | modify | `emberMarchesHexPack()`: the spatial fixture with `model:'hex'`, terrain kinds, `formulas.speed`, a `stride` action, an `opportunist` reaction, and one consumable item whose `use` is `heal(speed)` |
| `tests/runtime/combat/movement-geometry.test.ts` | create | geometry + pathing units |
| `tests/runtime/combat/movement.test.ts` | create | the movement column + provoke + `useItem` `speed` |
| `tests/snapshots/combat.test.ts` | modify | restore terrain (ck2); the `pendingMove` round-trip, forfeit parity + refusal (ck4) |

**Outside this lease, must stay green (not edited):** `tests/runtime/equipment.test.ts`
(F-P12, ck5), `tests/runtime/combat/character-profile.test.ts:309-329` (F-P6b; S04 re-keys
it), and every test that relies on today's offer behavior (F-P1, ck3). If any of them
needs an edit, return `blocked` naming the test and line. Orchestrator uses Controlled
Lease Revision. Do not edit it.

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
export function hexGeometry(model: SpatialModel): SpatialGeometry; // axial; mirrors grid's max(reach, defaultReach) quirk (DD-M14, spatial.ts:60-61)
export function spatialFromPack(pack: { spatial?: SpatialDef }): SpatialGeometry; // grid → gridGeometry, hex → hexGeometry
export interface TerrainCell { readonly at: Position; readonly kind: string; }
export interface PathQuery {
  readonly from: Position; readonly to: Position; readonly budget: number;
  readonly terrain: Readonly<Record<string, TerrainKind>>; // pack vocabulary
  readonly cells: readonly TerrainCell[];                   // host placement
  readonly occupied: readonly Position[];                   // every combatant position (bounds the region)
  readonly passable: (p: Position) => boolean;              // not a standing enemy
  readonly endable: (p: Position) => boolean;               // not any standing combatant — INCLUDING the mover (F-P10a)
}
export type PathResult =
  | { ok: true; path: readonly Position[]; cost: number } // path excludes `from`, includes `to`
  | { ok: false; kind: 'blocked' | 'occupied' | 'unreachable' | 'out-of-range'; cost?: number };
export function findPath(geometry: SpatialGeometry, query: PathQuery): PathResult;
```

- **Dijkstra:** entering a cell costs `terrain[kind].cost` (1 when plain); a `blocks` cell
  is never entered. It is deterministic: the priority is (cost, insertion sequence), and
  neighbors expand in `neighbors()` order.
- **Search region (DD-M18, F-P9; replaces the old `distance × maxCost` bound):** run the
  search **with no cost cutoff** over a finite region. The region is the axis-aligned
  `(x, y)` bounding box of `from`, `to`, every `cells[].at` and every `occupied` position,
  expanded by 1 on every side. A neighbor outside the region is never enqueued. This is
  exact for both reachability and cheapest cost:
  - outside the original box, every cell is plain, unoccupied and unblocked;
  - clamping coordinates into the expanded box maps neighbors to neighbors (or to the same
    cell) under both the 8-neighbor square set and the 6-neighbor axial set, and it never
    raises a step's cost.

  So a cheapest path never needs to leave the region. Put this soundness argument in a
  comment above `findPath`. You may stop early once `to` is settled. You may not prune by
  budget, because the classification needs the true cheapest cost.
- **Classification order:**
  1. `to` is a blocking cell → `blocked`;
  2. `!endable(to)` → `occupied` (this covers `to` = the mover's own cell, F-P10a);
  3. `to` not reached inside the region → `unreachable` (no legal path at any cost);
  4. cheapest cost > budget → `out-of-range`, with `cost` = the cheapest cost.

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
  - **the F-P9 closing assertion:** a destination behind a wall whose only path is a
    detour costing more than the budget, and more than `distance(from, to) × maxCost`,
    reports `out-of-range` with the detour's true `cost`, never `unreachable`. Run it on
    both grid and hex;
  - a destination fully enclosed by blocking cells → `unreachable`;
  - `to` = `from` with `endable` excluding the mover's cell → `occupied`;
  - each `PathResult` failure kind.

### Checkpoint 2 — the move column (first narrow journey)

1. **Profiles.**
   - `CombatantProfile.speed?: number`.
   - `profileFromStatblock` and `profileFromCharacter` set `speed` **only when
     `formulas.speed` is declared** (same `evalPackFormula` idiom and same `base` vars as
     `initiative`, `character-profile.ts:106-107`). When it is not declared, the key is
     **absent**, not `0` or `undefined` (F-P6b: `character-profile.test.ts:309-329`
     deep-equals the whole zombie-urban profile, and it must stay green until S04 re-keys
     it).
   - `CombatantState.speed?` is copied at `startCombat` and restore (profile-sourced, like
     `initiativeBonus`), again only when present.
2. **Vars.** `executeAgainst` sets `vars['speed'] = actor.profile.speed ?? 0` next to
   `initiative`. Engine-derived, so it overrides a same-named ability, as `hp`/`ac` already
   do. It also takes an optional `move?: (budget: number) => void` parameter (appended last)
   and places it on `apply` (l.350-365) as `apply.move` only when given.
3. **Out-of-combat item use (F-P5, `equipment.ts:272-280`).** Add to `useItem`'s `vars`:
   ```ts
   speed: runtime.index.formulaAsts['speed'] === undefined ? 0 : scopedFormula(runtime, 'speed', scope),
   ```
   This mirrors the `initiative` line.
4. **Terrain at start.**
   - `StartCombatRequest.terrain?: readonly TerrainCell[]` →
     `CombatState.terrain: TerrainCell[]` (plain JSON; `[]` when absent).
   - Refusals, in one aggregate `RuntimeRuleError`, **E-SPAT-01**, before any RNG is
     consumed, spatial packs only: an unknown kind; a duplicate cell; a combatant
     positioned on a blocking cell. A theater pack given terrain: no refusal; it rides
     along unconsulted, like positions (DD-M11).
   - Factor the refusal check into one helper shared with restore (step 5).
5. **Terrain on restore (F-P3, moved here from ck4).** `snapshots.ts`:
   - `CombatRestoreRequest.terrain?: readonly TerrainCell[]` (re-stated by the host, like
     positions);
   - `deserializeCombat` builds `CombatState` (l.549-557) with
     `terrain: [...(restore.terrain ?? [])]`;
   - the same refusals as `startCombat`, collected with the existing refusal cards before
     anything is rebuilt.

   `serializeCombat` does **not** freeze terrain (CAP-G5 discipline: the host re-states
   it). `pendingMove` is **not** in this checkpoint; it stays at ck4.
6. **Declare.**
   - `DeclareOptions.to?: Position` (l.112).
   - A **move action** is an action whose parse-once AST root is `call` `move`: read
     `runtime.index.actionEffects[actionId]`. There is no string matching at play time.
   - For a move action:
     - the target is the actor (skip `resolveTarget` and `spatialGate`);
     - the validity clause runs as today;
     - then the **movement gate** (spatial packs only): missing `to` → `no-destination`;
       otherwise the budget is `valueOfFormula(evalFormula(root.args[0], vars, zeroRng))`,
       where `vars` = the same actor vars `executeAgainst` builds (`speed` included). This
       is RNG-free and dice-free by S02's checker;
     - then `findPath` with `endable` = "no standing combatant, **the mover included**, is
       there" (F-P10a) and `occupied` = every combatant position. Any failure → one
       `declare:rejected` event, rule `E-SPAT-01`, kind as returned, message naming cost
       and budget;
     - cost check, then spend, then execute, exactly as today.
   - Keep the computed path for the walk.
7. **The walk (`apply.move`).**
   - Walk the planned path cell by cell.
   - At the end (arrived) emit `move:advanced {from, to, path, cost, remaining}` and then
     `move:ended {reason: 'arrived', at}`, both with `why.rule = actions.<id>`.
   - Update `position` immutably; `CombatantState.position` is readonly.
   - **Theater pack:** `apply.move` is a no-op; no `move:*` events (CA-M7).
8. **Rejection types.**
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
  the ledger equal. This includes **`to` = the mover's own cell → `occupied`**, with no slot
  spent (F-P10a).
- `rooted` (restricts `actions.tagged:move`) rejects `stride` as `restricted`, with no new
  code.
- `speed` shadows an ability named `speed` in a hand-built pack.
- A profile built from a pack **without** `formulas.speed` has no `speed` key.
- Terrain start refusals, all cards in one aggregate.
- **F-P5 closing assertion:** `useItem` (out of combat) on the fixture's `heal(speed)` item
  succeeds and heals by the profile's `speed` value, clamped as `useItem` already clamps.
- A theater pack (hex fixture minus `spatial`) loads; `stride` resolves with no position
  and no `move:*` events.
- **The journey leg:** move → `serializeCombat` → `JSON.parse(JSON.stringify())` →
  `deserializeCombat(rt, snap, {allies, enemies, positions: <from snapshot>, terrain})` →
  the position holds, the restored `fight.state.terrain` equals the re-stated cells, and
  the next `declare` in reach succeeds.

`tests/snapshots/combat.test.ts` (spatial describe block): restore with an unknown terrain
kind, or a combatant on a blocking cell → aggregate E-SPAT-01 refusal, nothing built.

**Commit when:** `pnpm typecheck` is 0, and **the whole suite `pnpm test`** is green (run
`pnpm build` first). `CombatState.terrain` changes the shape of every `fight.serialize()`,
so an outside-lease pin could surface here. If one does, return `blocked` naming it.

### Checkpoint 3 — provoke, pause, resume, per-call offers

**Per-call offer surfacing (F-P1, DD-M10).** Today `resolve()` returns the whole round
window (`combat.ts:743`), and `declare` (l.456) and `resolveReactive` (l.875) pass that to
`surfaceOffers`. So every earlier matching event is offered again, and after
`respond(x, 'take')` the same offer returns. Change it:
- Collect the events each public call emits with a per-call sink, the idiom `execute()`
  already uses (l.758-763: an `emitted` array, `runtime.events.on(sink)`, `off` in
  `finally`). Feed **only those** to `surfaceOffers`.
  - `declare`: every event from the gates through `action:resolved` and
    `endIfSideDefeated`;
  - `resolveReactive`: the same;
  - `use` already surfaces per call (l.541); leave it as it is.
- Keep the **return values** of `declare`/`respond` unchanged (the round window from
  `resolve()`).
- Offers raised *inside the walk* (below) are surfaced at the moment they are raised. The
  call-level pass must not offer them again. Track the events already surfaced in this
  call (for example a `Set<RuntimeEvent>`) and skip them.
- Each matching (reactor, event) pair is offered **exactly once**.

**The walk, before stepping from cell P to cell Q:**
- For every standing combatant `T` on the other side with a position, where
  `canReach(T.pos, P, reachOf(T))` and `!canReach(T.pos, Q, reachOf(T))`, emit
  `move:leaving-reach {actor: mover, target: T, payload: {at: P, next: Q}}`.
- **Offers:** surface them right away through the same `surfaceOffers` path (skip downed
  reactors, as today). **Do not filter by affordability (F-P10b):** a `T` whose reaction
  slot is already spent is still offered, and still pauses the move.
- **If ≥ 1 offer is raised:**
  - stop at P;
  - emit `move:advanced` for the segment walked so far (omit it when empty);
  - set `mover.pendingMove = {actionId, to, remaining: budget − costSoFar}`;
  - return.

  The effect's walk ends there. `resolve()` still emits `action:resolved`, which is the
  declared action's resolution.

**`respond()`:** after it resolves or declines, and the queue is **empty**, if the active
combatant has a `pendingMove`, resume. A **refused take also counts as an answer**: for
example, the spent-slot case. `respond` removes the offer at l.551 before any gate;
`resolveReactive` then returns one `declare:rejected {slot-exhausted, reaction}`,
E-ECON-01, from `spend` (`action-economy.ts:178-185`). The resume re-checks, in order:
1. downed → `move:ended {reason: 'downed'}`;
2. `restrictionRejection(actor, def) !== undefined` → `'restricted'`;
3. otherwise re-plan `findPath` from the current cell with `remaining`, using the current
   occupancy. Failure → `'blocked'`. Success → walk again (a walk may pause again; its
   offers are surfaced per call, like any other).

Clear `pendingMove` when the move ends. `respond()` returns its events plus the resumption
events.

**`step()`:** a `pendingMove` present → emit `move:ended {reason: 'forfeited'}`, clear it,
then behave exactly as today (from the `resolved` phase, that means `endTurn` →
`turn:ended`).

**Do not change** `resolveTarget`/`respond` target defaults (DD-M13). The host passes the
mover as `targetId`.

Tests:
- Leaving one threatener's reach: an offer, a pause, a take (an attack against the mover at
  P, in reach, so the spatial gate passes), then a resume to the destination.
- Decline → resume.
- **F-P1 closing assertion** (for both the take case and the decline case): after the
  only offer is answered, `fight.pendingTriggers` is `[]`. Across all events of the fight,
  there is exactly one `trigger:fired` for that `move:leaving-reach` event. The decline
  case also has exactly one `trigger:declined`.
- **F-P1 regression on a non-move fight:** an attack that offers `parry`; after
  `respond('<id>.parry', 'take')`, `pendingTriggers` does not contain `<id>.parry` again.
- **F-P10b:** a threatener whose reaction slot is already spent is still offered, and the
  move pauses.
  - `respond(id, 'take', moverId)` returns one `declare:rejected` with kind
    `slot-exhausted` and resource `reaction`, rule `E-ECON-01`. The reactor's ledger, hp
    and RNG words are unchanged. No `trigger:declined` is emitted. The move resumes.
  - The same setup with `'decline'` → one `trigger:declined` → resume.
- Two threateners → two offers; the move resumes only after both are answered.
- The reaction downs the mover → `downed`.
- The reaction applies `rooted` → `restricted`.
- An ally stepping into the vacated destination blocks the re-plan → `blocked` (use a
  second fixture ally's reaction or a direct state setup; document which).
- `step()` while paused → `forfeited`, then `turn:ended`.
- A pack with no matching reaction never pauses, and events are unchanged apart from
  `move:leaving-reach` itself.

**Arch fragment (Orchestration Envelope path):** record the delta for
`arch/v1-core.md:163`. `resolve()`/`declare()`/`respond()` still return the round window,
but offers are surfaced only for the events the current call emitted (per-call sink), and
each (reactor, event) pair is offered once. Do not edit `arch/` directly.

**Commit when:** **the whole suite `pnpm test`** is green (after `pnpm build`), including
grid-journey, rules-are-data, perf-budget, `spatial-triggers`, `combat.test.ts` and every
test that answers offers in a loop. **If a test outside this lease depends on repeated
offers, return `blocked` and name the test file and line.** Do not edit it.

### Checkpoint 4 — paused-move snapshots, derived phase

- `SnapshotCombatant.pendingMove?`: emit it only when set; restore it into
  `CombatantState`.
- `combatRestoreRefusals` gains E-SNAP-01 for a `pendingMove.actionId` that is not a
  declared action whose AST root is `move`.
- **Derived restore phase (F-P2, DD-M12):** in `deserializeCombat`, replace the phase rule
  at l.554 with:
  ```ts
  phase: defeatedSide(combatants) !== undefined
    ? 'combat-over'
    : saved.combatants.some((c) => c.pendingMove !== undefined || (c.pendingTrigger !== undefined && c.pendingTrigger !== null))
      ? 'resolved'
      : 'awaiting-declare',
  ```
  There is no envelope field and no schema change.
- **Restored offer `on` (F-P2):** at l.558-567, set `matchingEvent` to the pattern's
  **event type**, the base before `[`. This is exactly `eventMatches`' `base`
  (`triggers.ts:33`): `pattern.indexOf('[') === -1 ? pattern : pattern.slice(0,
  pattern.indexOf('['))`. Live offers store `event.type` (`triggers.ts:75`).
- Positions: CAP-G5 is unchanged. The host re-states them. Do **not** read frozen
  positions. Terrain restore already landed at ck2.

Tests (`tests/snapshots/combat.test.ts`, spatial describe block):
1. Pause mid-move (one threatener, one offer).
2. Serialize → JSON → restore with the positions read from `snap.combatants[].position`
   and the same terrain. Assert that the restored `fight.state.phase` is `'resolved'`, and
   that the restored offer's `matchingEvent` is `'move:leaving-reach'`, not the pattern.
3. **Resume parity:** call `respond` in both fights, the uninterrupted one and the
   restored one. They produce identical `move:*`, `attack:rolled` and `damage:applied`
   payloads and identical final positions. Also, the `trigger:declined` payloads
   (decline variant) are identical, including `on`.
4. **F-P2 closing assertion (forfeit parity):** from a second pair of fights paused at the
   same point, call `step()` in both. Each produces `move:ended {reason: 'forfeited'}`
   then `turn:ended`, with identical payloads (same `at`; same `{turn, round}`), and
   neither produces `turn:began`.
5. The refusal for a bad `actionId` (unknown, and a non-move action) → E-SNAP-01.

**Recorded residuals (do not fix; report in the handoff):**
- **R-GM-1:** `trigger:fired.payload.offerIndex` restarts at 0 after restore, because
  `offeredCount` (l.320) is not in the envelope. Compare any post-restore `trigger:fired`
  without `offerIndex`.
- **R-GM-2:** a `use`-raised offer restores to `resolved`, while live it stays in
  `awaiting-declare`. No test in this session restores one.

**Commit when:** the whole suite `pnpm test` is green (the phase change touches every
restored fight that carries an offer; `tests/snapshots/combat.test.ts:116-127` must stay
green), and
`python3 -c "import json;json.load(open('src/schema/contracts/snapshots.schema.json'))"`
still parses. The contract is read-only here; confirm the field names against it.

### Checkpoint 5 — surface close + carried leaf

- Create `src/runtime/display-roll.ts` holding `displayRoll` verbatim (same signature and
  output).
- `combat.ts` imports it and re-exports it (`export { displayRoll } from '../display-roll'`
  or the equivalent), so `src/runtime/index.ts:77` keeps working.
- `equipment.ts` deletes `rollText` (l.352) and imports `displayRoll` from the leaf. The
  leaf imports only `core/dice` types, so no cycle is created. The two functions produce
  the same output for rolls without a verdict, and equipment's damage callback only ever
  receives damage rolls (F-P12). **`tests/runtime/equipment.test.ts` (outside this lease)
  must stay green unchanged.** Run it by name.
- Barrel: export every new public symbol (`hexGeometry`, `findPath`, `TerrainCell`,
  `PathQuery`, `PathResult`, `PendingMove`, the rejection type). **Barrel completeness is a
  standing recommendation; grep your own new exports against `index.ts` before
  committing.**

**Commit when:** all of these are 0/green: `pnpm typecheck`, `pnpm lint`,
`pnpm format:check`, `pnpm build`, `pnpm check:isolation`, `pnpm check:security`,
`pnpm exec vitest run tests/runtime/equipment.test.ts`, and `pnpm test` (whole suite; run
`pnpm build` first because loot/equipment journeys read `dist/`).

## Verification

- All seven package gates at ck5 (commands per the STATE Verification Baseline).
- Whole suite at ck2, ck3, ck4 and ck5.
- CA evidence: for each CA row above, list test names with their checkpoint commit.
- Record the whole-suite count at close.

## State Update

Report:
- status and checkpoints;
- landed symbols and their files;
- exact event payload shapes and rejection messages (S04 asserts them);
- how the `blocked`-on-resume case was set up;
- the per-call offer mechanism as landed, and any test that depended on repeat offers;
- the arch-fragment text for `v1-core.md:163`;
- any deviation from DD-M9/M10/M12/M18 with its reason;
- the axis (a)–(d) results at ck0;
- R-GM-1/R-GM-2, confirmed as observed;
- confirmation that the coverage window closed at ck1.

`followUp` for S04:
- the `respond(triggerId, 'take', moverId)` harness pattern;
- that the path is planned at declare time and re-planned on resume;
- that a restored paused fight is in the `resolved` phase;
- the fixture numbers that pin costs;
- that `speed` appears on profiles only when `formulas.speed` is declared, so S04 re-keys
  `character-profile.test.ts:309-329`.
