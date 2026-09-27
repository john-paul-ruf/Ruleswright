# SESSION-04 — Compiler pass-through + theme spatial declarations

> **Program:** Ruleswright
> **Feature:** grid-combat
> **Modules:** M04
> **Depends on:** S02
> **Concurrent with:** S03 (leases verified disjoint path-by-path)
> **Owns:** `src/compiler/theme.ts`, `src/compiler/pipeline.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `tests/compiler/pipeline.test.ts`, `tests/compiler/coverage-floor.test.ts`
> **Reads:** `src/schema/pack.ts` (`SpatialDef`, S02's committed type), `src/compiler/pipeline.ts`, `src/compiler/theme.ts`, `src/compiler/stages/*.ts`, `tests/compiler/pipeline.test.ts`, `tests/compiler/coverage-floor.test.ts`, `src/schema/contracts/pack.schema.json` (S01's §spatial — normative)
> **Resources:** —
> **Checkpoints:** 3

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M04 | Compiler | your lease — theme.ts, pipeline.ts, themes/*.json | Generated packs must be able to declare spatial; the sample themes are the FR-21 proof vehicles |

## Context

S02's validator accepts `spatial` and S03's runtime consumes it — but a generated pack cannot carry the section yet: `ThemeTemplate` has no `spatial` field and the pipeline assembles the pack root from an explicit list of sections (`STAGE_INPUT_SECTIONS` + explicit manifest/formulas seeding). This session adds the pass-through and declares the model in all three bundled themes, so the FR-21 coverage-floor proof and S05's journey run against *generated* spatial packs — the real production path, not fixtures.

## Capabilities

- **CAP-G6 (owner):** generated packs ship spatial; the three themes declare the model; stage-8 validation passes.

## Contract Agreements

**CA-G1 (consumer, recheck at ck0):** the theme's `spatial` input is the *same* `SpatialDef` the pack carries — no theme-side renaming. The contract's `$defs/spatial` (S01, committed) is normative; `ThemeTemplate.spatial?: SpatialDef` mirrors it via the existing import.

## Files to Create/Modify

| File | Action | What Changes |
|------|--------|--------------|
| `src/compiler/theme.ts` | modify | `ThemeTemplate` gains `spatial?: SpatialDef` (stage input, section-keyed like the pack) |
| `src/compiler/pipeline.ts` | modify | `STAGE_INPUT_SECTIONS` += `'spatial'`; pack root gains the token-resolved section |
| `src/compiler/themes/dark-fantasy.json` | modify | Declare `spatial` |
| `src/compiler/themes/zombie-urban.json` | modify | Declare `spatial` |
| `src/compiler/themes/wyldwood.json` | modify | Declare `spatial` |
| `tests/compiler/pipeline.test.ts` | modify | Pass-through assertions |
| `tests/compiler/coverage-floor.test.ts` | modify | The three themes' spatial coverage asserts |

## Implementation

### Checkpoint 0 — recheck
Read S02's committed `SpatialDef`; read `pipeline.ts`'s section assembly (the `pack[...]` writes after the manifest) to place the pass-through exactly where the other optional section (`economy`) lives.

### Checkpoint 1 — types + pipeline pass-through

In `theme.ts`: import `SpatialDef` from `../schema/pack` (alongside the existing `PackEconomy` etc.); add `spatial?: SpatialDef;` to `ThemeTemplate` after `economy?` with a doc comment citing spatial.html's anatomy and FR-11.

In `pipeline.ts`:
- `STAGE_INPUT_SECTIONS` gains `'spatial'` (after `'economy'`) — this makes `#knob/<id>` tokens resolvable inside a theme's spatial declaration too.
- After the manifest/formulas seeding, before stages run:
  ```typescript
  if (themeView.spatial !== undefined) {
    pack['spatial'] = structuredClone(themeView.spatial);
  }
  ```
  (`structuredClone` matches the formulas-seeding precedent — the theme object is never mutated by generation.)

**Commit when:** `pnpm typecheck` 0; `npx vitest run tests/compiler` green (existing suite unchanged — themes carry no spatial yet).

### Checkpoint 2 — theme declarations

All three themes gain an identical-shape `spatial` section placed after `economy`:

```json
"spatial": {
  "model": "grid",
  "reach": { "default": 1, "barrow-wight": 2 },
  "shapes": ["single", "burst"]
}
```

Adapt per theme: the reach-override key must name a **bestiary id that theme declares** (dark-fantasy: `barrow-wight`; zombie-urban and wyldwood: pick a declared threat id from each — read the themes first). Keep the shape identical otherwise so the coverage-floor test can assert uniformly. `shapes` is included by all three (the v1 set, documented). Reach override values are yours to pick (2 is sensible for an extended-reach monster); they must be integers ≥ 1.

**Commit when:** `npx vitest run tests/compiler/coverage-floor.test.ts` green with the new spatial assertions; the generated packs (both themes, default knobs) pass stage-8 validation — that is the commit gate: run the existing generate+validate test and confirm no new ErrorCards.

### Checkpoint 3 — tests

In `tests/compiler/pipeline.test.ts` (follow the existing theme-composition/pipeline describe patterns):

1. A theme with `spatial` → generated `pack.spatial` deep-equals the theme's declaration (token resolution applies: a `#knob/` token inside a reach value resolves — use the existing test theme's knob if one is declared, or assert the plain pass-through).
2. A theme without `spatial` → generated pack has no `spatial` key (absent = theater of mind; the existing composition test theme must stay spatial-free so the absent branch stays covered).
3. The three real themes' generated packs carry `spatial.model === 'grid'` and `spatial.reach.default` ≥ 1.

In `coverage-floor.test.ts`: extend the FR-21 floor assertions — each theme's spatial declaration present and shape-valid (the same coverage-floor discipline that already asserts `economy.turnSlots`).

**Commit when:** both test files green; `pnpm format:check` clean; `npx vitest run tests/compiler` green.

## Verification

- Lease-scoped: `npx vitest run tests/compiler` — pass-through, composition, coverage-floor all green.
- Whole-repo at session close: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`.
- Stage-8 dogfood proof: the existing generate→validate path now sees a `spatial` section and must produce zero cards — this is CAP-G6's evidence (the validator work is S02's; your test proves the composed document fits it).
- CA-G1 boundary: theme `spatial` shape === contract `$defs/spatial` === `SpatialDef` (no renaming at any layer — assert the JSON keys match `SpatialDef`'s fields in the pass-through test).

## State Update

Report: status, checkpoints, landed symbols (`ThemeTemplate.spatial`, `STAGE_INPUT_SECTIONS` +spatial, three theme declarations), CAP-G6 evidence (which tests prove it), reach-override keys/values chosen per theme. `followUp` for S05: the exact `spatial` sections each generated pack will carry (so the journey test can assert them), and the knob-token note if you used one.