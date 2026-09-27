# SESSION-02 — Schema TS mirror + validator: `Pack.spatial`, `checkSpatial`, E-SPAT-01 in RULE_IDS

> **Program:** Ruleswright
> **Feature:** grid-combat
> **Modules:** M01
> **Depends on:** S01
> **Concurrent with:** — (W2 runs alone)
> **Owns:** `src/schema/pack.ts`, `src/schema/error-card.ts`, `src/schema/validate/sections/root.ts`, `src/schema/validate/index.ts`, `tests/schema/validate.test.ts`, `tests/schema/fixtures.ts`
> **Reads:** `src/schema/contracts/pack.schema.json` (S01's §spatial — normative), `src/schema/validate/sections/root.ts`, `src/schema/validate/context.ts`, `src/schema/validate/helpers.ts`, `tests/schema/validate.test.ts`, `tests/schema/fixtures.ts`
> **Resources:** —
> **Checkpoints:** 3

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M01 | Schema surface | `src/schema/**` (your lease) + the contract §spatial | You mirror the contract 1:1 and extend the validator dispatch |

## Context

S01 landed the normative `spatial` section (v1.3). You make it real for TypeScript: the `Pack` type gains the field, the validator learns to check it, and `E-SPAT-01` joins the frozen registry — additive-only. Every later session (S03's runtime, S04's compiler) imports your types and rule id; nothing else may define them.

## Capabilities

- **CAP-G1 (producer):** `Pack.spatial` typed per contract; malformed spatial → ErrorCards, never partial.
- **CA-G1 (consumer):** mirror `$defs/spatial` exactly — field names, types, const, bounds.
- **CA-G2 (consumer):** `E-SPAT-01` in `RULE_IDS`, additive position, registry discipline (no rename/retire).

## Contract Agreements

**CA-G1 recheck at checkpoint 0 (Orchestrator must have confirmed this before dispatch):** read the committed `pack.schema.json` `$defs/spatial` and diff it against the shape below. The contract is authoritative — if it differs from this prompt, implement the contract's shape and record the delta. Required mapping:

| Contract path | TS type |
|---|---|
| `spatial.model` | `'grid'` (const) |
| `spatial.reach.default` | `number` (integer ≥ 1) |
| `spatial.reach.keys` | `Record<string, number>` (values integer ≥ 1; keys free-form) |
| `spatial.shapes?` | `readonly ('single' \| 'burst')[]` |

## Files to Create/Modify

| File | Action | What Changes |
|------|--------|--------------|
| `src/schema/pack.ts` | modify | `SpatialDef` interface + `Pack.spatial?: SpatialDef` |
| `src/schema/error-card.ts` | modify | `RULE_ID_TUPLE` += `'E-SPAT-01'` |
| `src/schema/validate/sections/root.ts` | modify | `checkSpatial(ctx, value)` + dispatch wiring |
| `src/schema/validate/index.ts` | modify | import + call `checkSpatial(ctx, json['spatial'])` |
| `tests/schema/validate.test.ts` | modify | spatial acceptance + rejection cases |
| `tests/schema/fixtures.ts` | modify | VALID_PACK stays non-spatial; add `withSpatial(pack, …)` fixture helper if useful for cross-suite reuse |

## Implementation

### Checkpoint 0 — recheck
Read the committed `$defs/spatial` (S01) and this prompt's CA-G1 table; confirm agreement before writing any type. Confirm `RULE_ID_TUPLE`'s current shape (14 ids) so your addition is literally additive.

### Checkpoint 1 — types

In `src/schema/pack.ts` (mirroring `pack.schema.json` `$defs/spatial`, header comment cites it):

```typescript
/** $defs/spatial (v1.3) — optional spatial model (FR-11): grid reach + documented shape set. */
export interface SpatialDef {
  model: 'grid';
  reach: { default: number; keys?: Record<string, number> };
  shapes?: readonly ('single' | 'burst')[];
}
```

Add `spatial?: SpatialDef` to the `Pack` interface (after `economy?`, schema order). Note: `reach.keys` mirrors the contract's nesting — the *internal* `SpatialModel` S03 consumes flattens this (`defaultReach`, `reachOverrides`); do not flatten here; you are the contract mirror.

**Commit when:** `pnpm typecheck` 0; existing suite green (`npx vitest run tests/schema`).

### Checkpoint 2 — validator

In `root.ts`, following the file's existing section-function pattern (`checkEconomy` is the nearest sibling — read it first):

- `checkSpatial(ctx, value)`: absent → return. Not a plain object → E-SCHEMA-01. Structural checks: `model` must be present and `'grid'` (missing/mistyped → E-SCHEMA-01, message citing the const); `reach` present, plain object, `reach.default` integer ≥ 1 (else E-SCHEMA-01); `reach.keys` optional map, values integer ≥ 1, keys non-empty strings (else E-SCHEMA-01); `spatial.shapes` optional array, each entry ∈ {single, burst}, unique (structural violation → E-SCHEMA-01). Semantic check: model present but not `'grid'` → **E-SPAT-01** ("pack declares a spatial model the engine does not ship"); `shapes` containing a non-v1 shape string → **E-SPAT-01** (declared geometry the engine does not have). Unknown properties anywhere in the section → E-SCHEMA-02 (closed shape, per contract `additionalProperties: false`). Use the existing helpers (`isPlainObject`, `reqFields`, `forbidUnknown`, `add`).
- Dispatch in `validate/index.ts`: `checkSpatial(ctx, json['spatial'])` after `checkEconomy`.

In `error-card.ts`: append `'E-SPAT-01'` to `RULE_ID_TUPLE` (last position). Update the doc comment: additive minor event, database.md registry v1.3.

**Commit when:** typecheck 0; `npx vitest run tests/schema` green including your new cases; rule registry still frozen-additive (existing ids untouched).

### Checkpoint 3 — tests

In `tests/schema/validate.test.ts` (a new describe block near the economy/root tests; follow the file's existing card-assertion style):

1. valid pack + `spatial: {model:'grid', reach:{default:1}, shapes:['single','burst']}` → no cards.
2. valid pack + `spatial: {model:'grid', reach:{default:2, keys:{'weapons.long-spear':2}}}` → no cards (mock-verbatim reach label accepted).
3. absent `spatial` → no cards (theater-of-mind default holds — VALID_PACK unchanged).
4. missing `model` → E-SCHEMA-01 at `spatial.model`.
5. `model:'hex'` → E-SPAT-01 (message names the engine-shipped set).
6. `reach.default: 0` → E-SCHEMA-01 at `spatial.reach.default`.
7. `shapes:['cone']` → E-SPAT-01 (cone/line deferred, never faked).
8. unknown key `spatial.foo` → E-SCHEMA-02.
9. `E-SPAT-01` ∈ `RULE_IDS` assertion + all 15 ids in registry order.

**Commit when:** all three checkpoints' gates green: `pnpm typecheck` 0, `npx vitest run tests/schema` green, `pnpm format:check` clean (format your lease files).

## Verification

- `npx vitest run tests/schema` — lease-scoped gate (the `pnpm test --` filter does NOT work; documented hazard).
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` — whole-repo gates at session close.
- CA-G1/CA-G2 proof: your negative tests ARE the boundary assertions (E-SCHEMA-01 vs E-SPAT-01 split per STATE.md Design Decision 6).
- Baseline guard: `npx vitest run tests/compiler` must stay green (stage 8 runs validatePack on generated packs — the three themes carry no spatial yet, so nothing may change there).

## State Update

Report: status, checkpoints, landed symbols (`SpatialDef`, `Pack.spatial`, `checkSpatial`, RULE_IDS count 14→15), CA-G1 mirror-delta (contract vs prompt, if any), CA-G2 evidence. `followUp` for S03: the exact exported names (`SpatialDef` from `../schema/pack`, `RuleId` union now including `'E-SPAT-01'`); for S04: generated packs may now declare `spatial` without stage-8 rejections.