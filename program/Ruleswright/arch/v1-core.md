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
<!-- v1-core SESSION-02 -->
## M02 — Repo spine + core mechanics (SESSION-02, ck1–3, 35aa73f/0f8a1ab/55918ef)

- `src/core/rng.ts` — `Rng` (sfc32, cyrb128 string/number seed), `RandomSource` (minimal injectable entropy: `int(maxExclusive)`), `RngState` (`{a,b,c,d}` uint32 — exactly snapshots.schema.json `rngState`; setState rejects extra keys).
- `src/core/dice.ts` — `parseRecipe` (pure, load-time; dice.html vocabulary: `XdY`, `kh/kl`, flat ints, variables; one die cluster per recipe) + `rollRecipe` → `RollResult` (CA-2 shape; `values` = kept dice in roll order; invariant `total === sum(values) + modifier`; verdicts caller-attached).
- `src/core/tables.ts` — `rollTable(def, rng, {resolve?, jsonPath?})` → `TableOutcome`; `TableDef`/`TableEntry` mirror `$defs/tableDef` (sibling-declared, no internal import); `MAX_TABLE_DEPTH = 8` (tables entered, root = depth 1); failures `malformed-entries`/`range-gap`/`depth-exceeded` → E-TBL-01, `unresolvable-ref` → E-REF-01.
- `src/core/index.ts` — NEW internal barrel (not in architecture.md's core file list): groups the three modules' exports for runtime/compiler imports; no cross-surface re-exports; core still imports nothing internal.

Root manifests landed (package.json/tsconfig/vitest/eslint/prettier/pnpm-lock); zero runtime deps; lint bans `Math.random`/`Date.now`/`eval`/`new Function`/dynamic imports + `ImportExpression` under `src/**` (proven to fire via red/green check).

<!-- v1-core SESSION-03 -->
## M02 — DSL compiler (SESSION-03 via RECOVERY-03, ck1–3 + correction, 4e188fa/dff30e6/7eff106/168d71a)

New module `src/core/dsl/` — imports only `../rng`, `../dice`, type-only `../../schema/{validate,error-card}` (sibling-leaf rules held).

- `checker.ts` — `packDslChecker: DslChecker`: pass as S01's `validatePack(json, dslChecker)` 2nd param; replaces `deferredDslChecker`. Dispatch by `DslCheckRequest.kind` (`effect` → effect grammar; `formula|valid|passive|attackBonus` → formula). E-FORM-01 parse errors carry 0-based char offset in message; E-FORM-02 closed-registry miss (unknown fn, wrong vocabulary, bad arity, misplaced `half`); E-FORM-03 unknown name + `did you mean` via S01 nearestIds (no distance cutoff).
- `formula.ts` — `parseFormula` (parse-once), `evalFormula(ast, ctx, rng)` (eval-many; `FormulaValue = number | RollResult`), `checkFormula(request): ErrorCard[]`, `checkFormulaAst` (S05/S07 reuse), `FormulaNode`/`FormulaAst`, `BUILTIN_SCALARS = ['level']`.
- `effect.ts` — `parseEffect(src)` (root must be a statement call); `executeEffect(ast, ctx): readonly EffectResolution[]` pure interpreter; ctx `{actor, targets, rng, apply: EffectApply, vars}`; `EffectApply = {resolveTargets, damage, condition}` is S05's mutation seam; outcome union embeds verdict-attached RollResults (FR-13 raw material); `EFFECT_SCALARS = ['level','hp','ac','initiative']` (CA-6); save-for-half per magic.html: `damage(half)` re-rolls fail branch's first damage expr, total = ceil(half), inherits type.
- `registry.ts` — frozen 12-entry registry (attack, save, damage, applyCondition, target, sequence, hasTarget, min, max, floor, ceil, half); extension = schema event (CA-2); exact-membership freeze test.
- `shared.ts` — one lexer both grammars; `MAX_PARSE_DEPTH = 24`, `MAX_EXPR_LENGTH = 512`; `nearestName`; `dslCard` (literal ErrorCard construction).

Grammar decisions: kebab ids swallow `-` inside names (`level-1` reads as a name → E-FORM-03; digit-leading terms keep classic subtraction); parser grammar-pure (unknown fn parses; E-FORM-02 is the checker's call); one dice lexeme = one S02 recipe = one die cluster, multi-dice compose via +/-; effect-embedded formulas resolve names against abilities+saves+EFFECT_SCALARS only (no pack-formula refs at play time); no eval/new Function/Math.random (grepped + tested); all randomness injected.
