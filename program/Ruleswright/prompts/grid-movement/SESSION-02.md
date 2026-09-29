# SESSION-02 — Schema mirror + validator + core `move` / `speed` DSL

> **Program:** Ruleswright
> **Feature:** grid-movement
> **Modules:** M01, M02
> **Depends on:** SESSION-01
> **Concurrent with:** —
> **Owns:** `src/schema/pack.ts`, `src/schema/validate/sections/root.ts`, `src/schema/validate/sections/cross.ts`, `src/schema/validate/index.ts`, `src/core/dsl/registry.ts`, `src/core/dsl/effect.ts`, `tests/schema/validate.test.ts`, `tests/core/dsl/effect.test.ts`, `tests/core/dsl/checker.test.ts`
> **Reads:** `src/schema/contracts/pack.schema.json`, `program/Ruleswright/specs/database.md` (v1.5 §spatial/§formulas), `program/Ruleswright/mocks/spatial.html`, `src/core/dsl/formula.ts`, `src/schema/validate/helpers.ts`, `src/schema/validate/dsl.ts`, `src/runtime/combat/resolve.ts` (consumer of `EffectApply`), `tests/schema/fixtures.ts`
> **Resources:** —
> **Checkpoints:** 3

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M01 | Schema | `pack.ts` (`SpatialDef` l.54-58), `validate/sections/root.ts` (`checkSpatial` l.286-383, reserved formulas l.23 + l.267-281), `validate/sections/cross.ts`, `validate/index.ts` (l.71 dispatch) | Type mirror + validator |
| M02 | Core DSL | `dsl/registry.ts`, `dsl/effect.ts` (executor switch l.199-218, `ARG_CATEGORIES` l.425, `checkEffectAst` l.453) | `move` statement, `speed` scalar |

## Context

SESSION-01 landed contract v1.5:
- `spatial.model` is `grid | hex`, and `spatial.terrain` holds the terrain vocabulary;
- reserved optional formula `speed`;
- `move(formula)` with placement rules;
- snapshot `pendingMove` (the snapshot type is S03's).

This session mirrors the pack side into TypeScript, teaches the validator, and adds the
`move` statement to core. **It does not touch `src/runtime/`.** The runtime keeps compiling
because `EffectApply.move` is **optional** and the new outcome kind is only read through
the existing `if` chains (`combat.ts:296-300`, `resolve.ts:371-387`, where no exhaustive
switch exists; Planner-verified).

**Coverage window you open (recorded in STATE):** once ck1 lands, the validator accepts
`hex`, but `spatialFromPack` still builds square-grid geometry. No shipped theme declares
hex until S04. S03 ck1 closes the window.

**Fail-closed interim:** a `move` statement executed without a host `apply.move` must throw
(see ck2). Until S03, `executeAgainst` supplies no `move`, and `speed` is not bound in
effect vars, so evaluating it throws "unknown name". No move can silently succeed.

## Capabilities

This session contributes producer legs, not a complete behavior:
- **CAP-M1** (model accepted);
- **CAP-M2** (the `move` statement + `speed` scalar);
- **CAP-M3** (terrain vocabulary validated);
- **CAP-M7** (move content needs no spatial section).

Integration owners are S03 and S04.

## Contract Agreements

- **Checkpoint-0 recheck (mandatory):** read the **committed** `$defs/spatial`,
  `formulas` description and database.md v1.5 text. If they differ from this prompt,
  **the committed contract wins**: implement it and report the delta. Also re-read S01's
  handoff in STATE.md.
- **CA-M1 (mirror + validator leg).**
  - Mapping: `model ∈ {grid, hex}` → accept.
  - Any other string → `E-SPAT-01` at `spatial.model`, with the message naming
    `{grid, hex}`.
  - `terrain` is optional. Each kind id must be kebab. The value must be exactly
    `{cost: int ≥ 1}` or `{blocks: true}`; anything else → `E-SCHEMA-01` at
    `spatial.terrain.<kind>`.
- **CA-M2 (core + validator leg).** `move` is registry entry 14:
  `{arity: 1, kind: 'effect', signature: ['formula']}`. Its uses:
  - Nested inside `sequence`/`target`/`save` → `E-FORM-02` (core `checkEffectAst`).
  - A dice node anywhere in its argument → `E-FORM-02` (core).
  - Root `move(` in `content.spells.*.effect`, `content.feats.*.effect`,
    `content.items.*.use`, or in an action that declares `trigger` → `E-FORM-02`.
    This is M01's cross check. It uses a leading-token test, `/^\s*move\s*\(/`, which is
    exact because core has already made `move` root-only; M01 still imports no core
    value.
  - `speed` referenced as a bare name token in any effect-bearing field (actions,
    spells, feats, items `use`) while `formulas.speed` is absent → `E-REF-01` at
    `formulas`. This is M01's cross check. Token test:
    `/(^|[^a-z0-9-])speed([^a-z0-9-]|$)/`.
  - `EFFECT_SCALARS` gains `'speed'`.
- **CA-M7 leg:** nothing requires `spatial` for `move` content.

## Files to Create/Modify

| File | Action | What Changes |
|------|--------|--------------|
| `src/schema/pack.ts` | modify | `SpatialDef.model: 'grid' \| 'hex'`; `TerrainKind`; `SpatialDef.terrain?` |
| `src/schema/validate/sections/root.ts` | modify | `checkSpatial`: hex accepted, `terrain` checks, `forbidUnknown` list + `terrain` |
| `src/schema/validate/sections/cross.ts` | modify | `checkMovementDsl(ctx, doc)`: move placement + speed reference |
| `src/schema/validate/index.ts` | modify | dispatch `checkMovementDsl` after the existing cross checks |
| `src/core/dsl/registry.ts` | modify | `move` entry; `EFFECT_VOCABULARY` + `move`; header comment v1.5 (13 → 14) |
| `src/core/dsl/effect.ts` | modify | `EFFECT_SCALARS` + `speed`; `EffectApply.move?`; `MoveOutcome`; `execMove`; `ARG_CATEGORIES.move`; root-only + dice-free checks |
| `tests/schema/validate.test.ts` | modify | **re-key l.472-478** (it uses `'hex'` as the *unshipped* model; switch to `'isometric'` and keep the assertion); new hex/terrain/move-placement/speed tests |
| `tests/core/dsl/effect.test.ts` | modify | re-key l.355 (the EFFECT_SCALARS title and assertion now include `speed`); `move` executor tests |
| `tests/core/dsl/checker.test.ts` | modify | vocabulary coverage includes `move`; root-only/dice-free rejections |

## Implementation

### Checkpoint 1 — spatial mirror + validator

```ts
// pack.ts
export type TerrainKind = { cost: number } | { blocks: true };
export interface SpatialDef {
  model: 'grid' | 'hex';
  reach: SpatialReach;
  shapes?: readonly ('single' | 'burst')[];
  /** v1.5 — terrain vocabulary; cells are host-placed per fight. */
  terrain?: Readonly<Record<string, TerrainKind>>;
}
```

In `checkSpatial`:
- `forbidUnknown(... ['model','reach','shapes','terrain'] ...)`;
- the model check accepts `grid` and `hex` (`const V1_MODELS = ['grid', 'hex']`), and the
  E-SPAT-01 message names both;
- add a terrain block using the existing helpers (`isPlainObject`, `isInteger`,
  `forbidUnknown`) with kebab id checking, the same way other id-keyed maps do. **Read
  `helpers.ts` for the existing kebab/id helper before writing one.**

**Commit when:** `pnpm typecheck` is 0, and `pnpm exec vitest run tests/schema` is green,
including:
- the re-keyed l.472 test (`'isometric'` → E-SPAT-01);
- a hex pack accepted;
- a terrain map accepted;
- `{cost: 0}`, `{cost: 2, blocks: true}`, `{blocks: false}`, and a non-kebab kind each
  → E-SCHEMA-01 at the right jsonPath.

### Checkpoint 2 — core `move` + `speed`

```ts
// registry.ts
move: { arity: 1, kind: 'effect', signature: ['formula'] },
// EFFECT_VOCABULARY: [..., 'move']

// effect.ts
export const EFFECT_SCALARS: readonly string[] = ['level', 'hp', 'ac', 'initiative', 'speed'];
export interface EffectApply {
  resolveTargets(shape: string): readonly EffectTargetRef[];
  damage(target: EffectTargetRef, roll: RollResult, type?: string): void;
  condition(target: EffectTargetRef, conditionId: string, duration: number): void;
  /** v1.5 — host movement (FR-11): spend up to `budget` movement points toward the declared destination. Absent = the host has no movement support. */
  move?(budget: number): void;
}
export interface MoveOutcome { readonly kind: 'move'; readonly budget: number; }
// EffectResolution union gains MoveOutcome
```

- `execMove`: evaluate the argument with `evalFormula`/`valueOfFormula`. If
  `ctx.apply.move === undefined`, throw
  `Error('move(...) needs host movement support (EffectApply.move) — combat supplies it; other callers cannot move (FR-11)')`.
  Otherwise call it once and return `[{kind: 'move', budget}]`.
- `ARG_CATEGORIES.move = ['formula']`.
- In `checkEffectAst`, thread an `atRoot` flag (true only for the top-level call). A
  `move` call with `!atRoot` → E-FORM-02 "move(...) must be the whole effect — it cannot
  be nested in sequence/target/save". Walk the argument AST: any `kind: 'dice'` node →
  E-FORM-02 "move's budget must be dice-free (evaluated at declare time, before cost)".

**Commit when:** `pnpm typecheck` is 0 (the runtime still compiles unchanged, which proves
the optional seam), and `pnpm exec vitest run tests/core` is green. New tests:
- `move(speed)` / `move(3)` / `move(speed * 2)` check clean with `speed` in scalars;
- `sequence(move(3), damage(1))` → E-FORM-02;
- `move(1d6)` → E-FORM-02;
- the executor calls `apply.move(6)` for `move(speed)` with `vars.speed = 6`;
- the executor throws when `apply.move` is absent;
- `EFFECT_VOCABULARY` covers `move`.

### Checkpoint 3 — validator movement cross-checks

`cross.ts`:

```ts
/** v1.5 (CA-M2): move placement + the speed reference rule — text-level, M01 imports no core value. */
export function checkMovementDsl(ctx: Ctx, doc: Record<string, unknown>): void
```

- **Walk:** `actions.*` (effect + trigger presence), `content.spells.*.effect`,
  `content.feats.*.effect`, `content.items.*.use`. Guard every access with
  `isPlainObject`/`typeof === 'string'`, because malformed input already produced
  structural cards.
- **`move` placement:** a root `move(` where it is not allowed → E-FORM-02 at the field's
  jsonPath (artifactId = the id).
- **`speed` reference:** if `formulas.speed` is absent and any of those fields matches the
  token regex → one E-REF-01 per field, at the field's jsonPath, with a hint to declare
  `formulas.speed`.

Dispatch it from `validate/index.ts` after the existing cross checks. Place it where the
other cross checks run. Read the file first; all-at-once ordering must be preserved.

**Commit when:**
- `pnpm typecheck`, `pnpm lint` and `pnpm format:check` are 0;
- `pnpm exec vitest run tests/schema tests/core` is green, including: a triggered action
  with `move(3)` → E-FORM-02; a spell with `move(3)` → E-FORM-02; an item `use: "move(2)"`
  → E-FORM-02; `move(speed)` without `formulas.speed` → E-REF-01; the same with
  `formulas.speed` → clean; an ability named `speedy` does not trigger the speed rule;
- **whole suite `pnpm test` green** (661 + new). The generated themes carry no `move` yet,
  so compiler stage-8 must be unaffected.

## Verification

- Whole-repo: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`.
- `pnpm build && pnpm check:isolation && pnpm check:security`: M01/M02 changed public
  surface, so confirm the bundles.
- `RULE_IDS` stays 15 (`tests/schema/registry.test.ts` untouched and green). No new rule id.
- CA-M1/CA-M2 evidence: list the test names that pin each mapping row above.

## State Update

Report:
- status and checkpoints;
- the exact exported symbols: `TerrainKind`, `SpatialDef.terrain`, `MoveOutcome`,
  `EffectApply.move`, `EFFECT_SCALARS`, `checkMovementDsl`;
- the E-FORM-02 / E-REF-01 message texts;
- any contract delta found at ck0;
- confirmation that the S02 → S03 coverage window is open (hex accepted, runtime not yet
  hex-aware).

`followUp` for S03:
- `executeAgainst` must bind `vars.speed` and supply `apply.move`;
- the `MoveOutcome` kind now appears in effect resolutions.
