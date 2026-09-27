# SESSION-03 — Runtime spatial integration: positions, reach gate, shapes, validity, snapshots

> **Program:** Ruleswright
> **Feature:** grid-combat
> **Modules:** M02, M03
> **Depends on:** S02
> **Concurrent with:** S04 (leases verified disjoint path-by-path)
> **Owns:** `src/runtime/combat/spatial.ts`, `src/runtime/combat/combat.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/runtime.ts`, `src/runtime/snapshots.ts`, `src/core/dsl/formula.ts`, `tests/runtime/combat/spatial-triggers.test.ts`, `tests/runtime/combat/combat-spatial.test.ts`, `tests/snapshots/combat.test.ts`, `tests/runtime/fixtures/packs.ts`
> **Reads:** `src/schema/pack.ts` (`SpatialDef`), `src/schema/error-card.ts` (`RuleId` incl. `'E-SPAT-01'`), `src/core/dsl/formula.ts`, `src/core/dsl/effect.ts`, `src/core/dsl/registry.ts`, `src/runtime/combat/*`, `tests/runtime/combat/combat.test.ts`, `tests/runtime/fixtures/pack.ts`
> **Resources:** —
> **Checkpoints:** 5

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M03 | Runtime | your lease — combat/, runtime.ts, snapshots.ts | The integration half of FR-11 |
| M02 | Core | `src/core/dsl/formula.ts` | `evalValidity` addition; core stays runtime-ignorant (injected callback) |

## Context

The geometry layer exists (`spatial.ts`: `gridGeometry`, `theaterOfMind`, `checkReach`, all unit-tested) but has zero engine consumers. This session wires the column end to end: packs declare spatial (S02's `SpatialDef`), Runtime builds geometry once at load, `startCombat` carries host-declared positions, `declare()` gains the reach and validity gates, the executor's `resolveTargets` stub becomes real shape resolution, snapshots round-trip positions, and the pending `E-SPAT-01` id becomes the registered rule.

## Capabilities

- **CAP-G1 (consumer):** pack shape → geometry adapter (ck1).
- **CAP-G2:** positions + reach gate (ck2).
- **CAP-G3:** burst resolution through the executor (ck3).
- **CAP-G4:** `def.valid` play-time evaluation (ck3).
- **CAP-G5:** snapshot round-trip + fail-closed restore (ck4).
- Integration owner for CAP-G1..G5 at their named checkpoints; S05 integrates the full journey.

## Contract Agreements

Recheck at checkpoint 0 (Orchestrator confirms CA-G1 mapping against S02's committed types before dispatch):

- **CA-G1:** `SpatialDef {model:'grid', reach:{default, <id>: n, ...}, shapes?}` → adapter splits the inline reach map: `default` → `defaultReach`, the remaining sibling keys → `reachOverrides`, into `SpatialModel {defaultReach, reachOverrides}`. Pack-section reach keys (siblings of `default`) vs internal model keys (`reachOverrides`) — you own the edge, name it explicitly in the adapter.
- **CA-G2:** `SpatialRejection.pendingId` → `rule: 'E-SPAT-01'` (the registered id from S02). Keep `kind: 'spatial'` for the `declare:rejected` payload.
- **CA-G3:** positions plain JSON `{x,y}`; emitted only when set; restore refuses spatial-pack fights missing positions (fail-closed, all cards).
- **CA-G4:** one `resolveShape`, three consumers (executor wiring, `hasTarget`, `target()` statements).
- **CA-G5:** `evalValidity` parses nothing at play time — takes the AST + injected `hasTarget` callback; `PackIndex.validAsts` compiled at load from existing `compileFormulas`.

## Files to Create/Modify

| File | Action | What Changes |
|------|--------|--------------|
| `src/runtime/combat/spatial.ts` | modify | Pack-shape adapter + registered rule id |
| `src/runtime/combat/combat.ts` | modify | `positions?` in requests/state, reach gate, validity gate, `resolveShape` |
| `src/runtime/combat/resolve.ts` | modify | Real `resolveTargets` binding via per-target context |
| `src/runtime/runtime.ts` | modify | `spatial: SpatialGeometry` + `validAsts` in `PackIndex`/constructor |
| `src/runtime/snapshots.ts` | modify | Position write/restore + restore refusals |
| `src/core/dsl/formula.ts` | modify | `evalValidity(ast, ctx, hasTarget)` |
| `tests/runtime/combat/spatial-triggers.test.ts` | modify | E-SPAT-01 registered id, adapter tests |
| `tests/runtime/combat/combat-spatial.test.ts` | create | The integration suite (below) |
| `tests/snapshots/combat.test.ts` | modify | Position round-trip + restore refusal cases |
| `tests/runtime/fixtures/packs.ts` | modify | `emberMarchesSpatialPack()` helper |

## Implementation

### Checkpoint 0 — recheck
Read S02's committed `SpatialDef` and `RULE_IDS`; diff against CA-G1's mapping above; confirm `RuleId` includes `'E-SPAT-01'`. Read `combat.ts`'s declare gate chain and `resolve.ts`'s `executeAgainst` before touching either.

### Checkpoint 1 — adapter + rule id (CAP-G1)

In `spatial.ts`:

- `spatialFromPack(pack: {spatial?: SpatialDef})`: `undefined` → `theaterOfMind` (unchanged). Declared → split the inline reach map: `const { default: defaultReach, ...reachOverrides } = pack.spatial.reach;` → `gridGeometry({defaultReach, reachOverrides})`. Keep the old `{defaultReach, reachOverrides}` overload signature working if it costs nothing — but its only callers are tests; migrate them in this lease (the test file is yours).
- `SpatialRejection`: replace `pendingId: 'E-SPAT-01 (unregistered — DB decision pending)'` with `rule: 'E-SPAT-01'` (CA-G2). Update the doc comment (registration resolved v1-core's pending decision).
- New export `packSpatialModel(pack: Pack): SpatialModel | undefined` — the typed edge combat uses; `undefined` = theater of mind.

**Commit when:** `npx vitest run tests/runtime/combat` green (the spatial describe block updated to the registered id and pack-shape input); typecheck 0.

### Checkpoint 2 — positions + reach gate (CAP-G2)

In `combat.ts`:

- `StartCombatRequest` gains `positions?: Readonly<Record<string, Position>>` (import `Position` from `./spatial`). `CombatantState` gains `position?: Position`.
- `startCombat`: copy `request.positions?.[member.id]` onto each combatant. Spatial pack (`runtime.spatial.enabled`) with a declared combatant missing a position → **throw** `RuntimeRuleError` with an E-SPAT-01-family card (fail-closed, all missing combatants in one aggregate). Theater-of-mind: positions are stored but never consulted (zero behavior change).
- `declare()` gate: after the target resolves, before cost check —
  ```typescript
  const reach = this.runtime.spatial; // built once at load
  if (reach.enabled) {
    const reachOf = (id: string) =>
      this.state.combatants[id]!.position === undefined
        ? undefined
        : this.packSpatialReach(id); // reachOverrides[profile.id] ?? default — read from runtime.pack.spatial
    const rejection = checkReach(reach, { position: actor.position, reach: reachOf(actor.id) }, { id: target.id, position: target.position }, defaultReach);
    if (rejection !== undefined) return [this.spatialRejectionEvent(actorId, rejection)];
  }
  ```
  (exact shape yours to adapt; the contract is: reach gate runs only when `enabled`, reads positions from combat state, emits `declare:rejected` with `kind: 'spatial'` and the registered rule id). `DeclareRejection` union gains the spatial kind. Missing positions in a spatial pack mid-fight (combatant added without position) fail closed the same way — the declare-time check treats a missing position as a rejection with a distinct message from out-of-reach.
- `resolveReactive` rides the same gate (same helper — triggers resolve through the same pipeline).

**Commit when:** new `tests/runtime/combat/combat-spatial.test.ts` describe "reach gate" green: out-of-reach melee → `declare:rejected` kind `spatial` (rule `E-SPAT-01`), no state mutation (serialize before/after equal); within-reach → resolves; reach override extends; theater-of-mind pack → identical declare behavior to the pre-feature baseline. `npx vitest run tests/runtime/combat` green.

### Checkpoint 3 — shapes + validity (CAP-G3, CAP-G4)

In `combat.ts`, add the single shape resolver:

```typescript
/** Resolve a shape word to combatant ids. Theater-of-mind: the bound targets. */
private resolveShape(shape: string, actorId: string, targetId: string | undefined): string[] {
  const geometry = this.runtime.spatial;
  if (!geometry.enabled) return targetId !== undefined ? [targetId] : /* bound target */;
  if (shape === 'adjacent') return opponents within actor reach (checkReach-style, no rejection here — filter)
  if (shape.startsWith('burst-')) {
    const radius = Number(shape.slice('burst-'.length));
    const center = this.state.combatants[targetId!]?.position; // the declared target's position (mock: burst @ (4,3))
    return all standing combatants (both sides) whose Chebyshev distance to center ≤ radius, via geometry.inBurst;
  }
  return []; // unknown shape → no targets → validity gate handles
}
```

In `resolve.ts` `executeAgainst`: replace the stub `resolveTargets: (shape) => [{ id: target.id }]` with a per-target wiring — the executor calls it once per `target()` statement; the combat layer resolves via the shape resolver **against the primary target's position** and returns those ids. `EffectTargetRef`s flow to `execStatement` scope as today; mutations still flow through `sink` with the actor/target provenance (CA-G4: one resolver, three consumers — executor, `hasTarget`, `target()`).

In `runtime.ts`: `readonly spatial: SpatialGeometry` built once in the constructor (`spatialFromPack(pack)`); `PackIndex` gains `validAsts: Readonly<Record<string, FormulaAst>>` compiled from `pack.actions[*].valid` via the existing `compileFormulas` (CA-2). Note `valid` is optional on `ActionDef` — compile only where present (skip undefined).

In `src/core/dsl/formula.ts`, add (M02's file — core stays runtime-ignorant):

```typescript
/**
 * Evaluate a validity AST. Comparators/scalars delegate to evalFormula;
 * `hasTarget(shape)` resolves through the injected geometry callback —
 * the engine's shape vocabulary lives in the caller (M03), not here.
 */
export function evalValidity(
  ast: FormulaAst,
  ctx: FormulaContext,
  hasTarget: (shape: string) => boolean,
): boolean
```

Walk: `hasTarget` call → `hasTarget(arg0.text)`; comparators/binary on scalar operands → `valueOfFormula(evalFormula(...))` truthiness; unknown call names throw (check-time guarantee). In `combat.ts`'s `declare()` chain — before cost spend, after restriction:

```typescript
const validity = this.runtime.index.validAsts[actionId];
if (validity !== undefined) {
  const ok = evalValidity(validity, this.validityVars(actorId), (shape) =>
    this.resolveShape(shape, actorId, options.targetId).length > 0,
  );
  if (!ok) return [this.rejectionEvent(actorId, { kind: 'valid', rule: 'E-REF-01', resource: shape, message })];
}
```

(final `kind`/`rule` naming for the valid-rejection card: pick `kind: 'valid'` and record the rule-id choice in your handoff; `DeclareRejection` gains the member). Theater-of-mind `hasTarget('adjacent')` → `resolveShape` returns the bound targets (non-empty → true) — matches spatial.html's absent-column: the same action body that fails declaratively in a spatial pack works in a theater pack.

**Commit when:** combat-spatial.test.ts gains: burst around a target hits multiple combatants across both sides with per-target saves/mixed outcomes (assert each target's outcome branch, not just a count); `hasTarget(adjacent)` action rejects out-of-reach in a spatial pack and passes in theater; CA-2 discipline — no `parseFormula` call inside `declare()` (assert by reading: the gate path touches only `index.validAsts`). `npx vitest run tests/runtime/combat` green.

### Checkpoint 4 — snapshots (CAP-G5)

In `snapshots.ts`:

- `serializeCombat`: when a combatant has `position`, emit `position: {x, y}` (the contract's `position?: null | object` accepts the precise shape; emit the precise shape, never `null`).
- `CombatRestoreRequest` entries gain `position?: Position`; `deserializeCombat` copies them onto restored `CombatantState`s; when the runtime pack is spatial and a restored combatant lacks a position → refusal card (E-SPAT-01 family, artifactId `(snapshot)`, jsonPath `restore.<id>.position`), all cards at once before rebuilding (existing refusal pattern).
- Spatial resume discipline: gates re-enforce against restored positions — proven by the test, not asserted by code.

**Commit when:** `npx vitest run tests/snapshots` green with the new round-trip cases: spatial fight → `serializeCombat` → `deserializeCombat` with re-stated positions → gates hold (out-of-reach still rejects); restore refusing a spatial fight missing a position; theater fight round-trips unchanged (positions absent → field absent, not `null`).

### Checkpoint 5 — fixture + suite close

- `tests/runtime/fixtures/packs.ts`: `emberMarchesSpatialPack()` — `withSpatial(emberMarchesPack(), {model:'grid', reach:{default:1, 'barrow-wight':2}})` reshaped to the v1.3 `SpatialDef` shape (the existing `withSpatial` helper is yours to update to the contract shape) (inline sibling override — no keys sub-object).
- Run the full local gate: `pnpm typecheck` 0 · `pnpm lint` 0 · `npx vitest run tests/runtime tests/snapshots` green · `pnpm format:check` clean.

**Commit when:** fixture lands, all four gates green.

## Verification

- Lease-scoped: `npx vitest run tests/runtime/combat`, `npx vitest run tests/snapshots` — all new + existing cases green.
- Whole-repo at session close: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`.
- **Theater-of-mind parity is a hard gate:** the pre-feature 503-test baseline must stay green with unchanged behavior for non-spatial packs. Run `npx vitest run tests/runtime/combat tests/runtime/character-profile tests/schema` and confirm the legacy spatial-triggers cases (updated in-lease) still assert the no-op discipline.
- CA-G2 boundary: the updated spatial-triggers test asserts `rule: 'E-SPAT-01'` (registered id, no `pendingId` remnant — grep your own lease to prove it).
- Architecture compliance: `runtime` imports nothing from `compiler`; `core/dsl/formula.ts` takes `hasTarget` as a parameter (no `runtime` import; `pnpm check:isolation` semantics hold — full build gate runs in S05).
- CA-G3/G4/G5 proofs: the tests named in checkpoints 2–4; their passing output is the evidence; record test paths in the handoff.

## State Update

Report: status, checkpoints, landed symbols (adapter, `positions` in request/state, `resolveShape`, `evalValidity`, `validAsts`, snapshot position I/O, E-SPAT-01 switch), CA-G3/G4/G5 evidence (test paths), the `kind: 'valid'`/rule-id choice you made, theater-parity result. `followUp` for S05: the exact positions/reach/shape semantics to compose in the journey (reach gate → restore-close → burst multi-target → snapshot round-trip), and any surprise deltas from CA-G3..G5's provisional mappings.