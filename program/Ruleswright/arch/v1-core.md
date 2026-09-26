# Ruleswright — Architecture Record

> Module realization record for the v1-core run (plan HEAD `53c7c91`). Orchestrator integrates Coder arch deltas here; Archivist synthesizes at the configured cadence.

<!-- v1-core SESSION-01 -->
## M01 — Schema surface (SESSION-01, ck1–3, 43065f5/27d25e6/d3cbd51)

New module file: `src/schema/overrides.ts` — `applyOverrides(pack, doc): { pack, errors }` (FR-19 deep-merge per dotted-path key, array order, unknown target → E-OVR-01 with nearest-id hints, skipped never misapplied; does NOT validate — callers revalidate per database.md merge discipline). `OverrideDocument` mirrors override.schema.json. Imports `nearestIds` from `./validate` (internal M01 edge only).

New public exports from `src/schema/validate.ts`:
- `validatePack(json: unknown, dslChecker?: DslChecker): ErrorCard[]` — second param is the CA-2 consumer seam (S03 wires `checkFormula`/`checkEffect`). Default `deferredDslChecker`.
- `DslCheckRequest { expr; kind: 'formula'|'valid'|'effect'|'passive'|'attackBonus'; artifactId; jsonPath; abilities; saves }`, `DslChecker = (request) => ErrorCard[]`, `deferredDslChecker` (fail-closed default; one deferred E-FORM-01 per DSL string until wired).
- `MAX_TABLE_DEPTH = 8` (E-TBL-01 bound; value chosen here, DB owns the documented number). `nearestIds(target, candidates, limit?)` (also consumed by overrides.ts).

New public API from `src/schema/version.ts`: `checkSchemaVersion(pack, {min,max})` (E-SCHEMA-01 out-of-range; snapshot staleness is E-SNAP-02/S06); `packContentHash(json): string` — canonical JSON sorted keys + FNV-1a, 8 hex, zero deps.

`src/schema/index.ts` re-exports all six M01 implementation files. M01 imports nothing internal (sibling leaf); only declared cross-module edge is the dslChecker parameter (M02 producer, wired by S03).

M01 Key Files update: add `overrides.ts` (7 files: pack, artifacts, error-card, validate, version, overrides, index).