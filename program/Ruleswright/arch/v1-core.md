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

<!-- v1-core SESSION-05 -->
## M03 — Combat engine (SESSION-05, ck1–4, 6efaa16/c7a2d44/6afbe31/4be9e6c)

- `src/runtime/combat/action-economy.ts` (CA-4 producer) — `resolveSlotGrants(pack)` (v1.1: declared `economy.turnSlots` authority; absent → documented default 1-of-each-cost-slot-name); `checkCost` declare-time validation (E-ECON-01-shaped rejections naming the slot; points; vancian bound slots); `freshLedger/replenish/spend/refund` per-turn `SlotLedger` transients (never character state).
- `src/runtime/combat/resolve.ts` (FR-3) — `parsePackEffects`/`checkPackDsl` (parse-once + load-time check via S03 `packDslChecker`); `profileFromStatblock` — the one combatant constructor for characters and monsters (reserved hp/ac/initiative formulas, overrides, attack table or ascending `attackBonus`); `attackBonusAgainst` (`byDefense[String(v)]` literal lookup — engine never interprets the convention); `attackRoll` (`d20 + attackBonus ≥ defenseTarget` with verdict-attached RollResult); `executeAgainst` (S03 executor seam, per-target vars, ordered roll history for `why.rolls`).
- `src/runtime/combat/combat.ts` (FR-10/13) — `startCombat(runtime, {allies, enemies, rng?})`; `Combat.step()/declare()/respond()/serialize()/eventsSince()/roundComplete`; initiative from reserved `initiative` formula or d20 fallback (CA-6); events emitted as CA-3 rows only (envelope untouched): combat:start, turn:began/ended, round:completed, attack:rolled, damage:applied, condition:applied, action:resolved, declare:rejected, trigger:fired, trigger:declined; `displayRoll` = combat-loop.html roll anatomy.
- `src/runtime/combat/spatial.ts` (FR-11) — `theaterOfMind` no-op; `gridGeometry` (Chebyshev, reach, burst); `checkReach` → typed `SpatialRejection` carrying `pendingId: 'E-SPAT-01 (unregistered — DB decision pending)'` (registry frozen additive — no unregistered id in code).
- `src/runtime/combat/triggers.ts` (FR-4/13, FR-12 proof-2 shape) — pattern grammar `<type>`, `[target=self]`, `[actor=self]`; `offersForEvent`/`respond`; taken triggers ride the same resolution pipeline as declares.
- `src/runtime/bestiary.ts` — `spawnMonster`/`bestiaryIds` via the same `profileFromStatblock` (no second combatant path).
- `src/runtime/encounter.ts` (FR-16) — `assembleEncounter` heuristic `threat-weighted-uniform` (documented, deterministic per seed, bypassable); `spawnEncounter`.
- Test fixtures: `emberMarchesPack()` (declared economy + tags, descending-AC + ascending conventions, vancian + pool costs, reactive action, restricts), `emberMarchesNoEconomyPack()` (default-grant branch), `emberMarchesAscendingPack()`, spatial seam helpers.

Consumer edges honored: S03 `executeEffect` ctx contract; S04 envelope (events.ts untouched — rows emitted as event types; envelope test still passes). First narrow journey landed at ck2: fixture pack → validatePack(+packDslChecker) → Runtime → stepwise combat → damage:applied with why:{rule,rolls} and mock-verbatim display strings.

<!-- v1-core SESSION-04 -->
## M03 — Runtime I: character side (SESSION-04 via RECOVERY-04, ck1–3 + 2 corrections, 23f9918/4ead08b/db7eebb/b961053/d0240e6)

- New module file beyond the M03 registry key-file list: `src/runtime/errors.ts` — `RuntimeRuleError extends Error` carrying `readonly errors: readonly ErrorCard[]` (illegal-operation aggregate per PROGRAM-CONFIG); load failures remain PackLoadError (FR-2); `ruleCard(rule, artifactId, jsonPath, message, hint?)`. Runtime rule ids are engine-named strings (unknown-race, unknown-class, duplicate-class, invalid-level, missing-progression, race-cap-exceeded, invalid-xp, invalid-spend, unknown-pool, insufficient-points, unknown-spell, spell-not-known, no-slot, no-empty-slot, slot-bound, not-prepared, slot-mismatch, unknown-condition, condition-not-active, unknown-theme, theme-grants-nothing) — distinct from the DB E-* registry.
- `Runtime(pack)` — validates with S03's real checker, fails closed on reserved hp/ac formulas (CA-6 recheck, E-REF-01), indexes artifacts, compiles effect/formula/attackBonus ASTs once (CA-2). Facade: createCharacter, levelSet, awardXp.
- `Character` facade (api-map shape): state, derived(rng?), spend, prepare, cast, applyCondition, removeCondition, applyTheme, removeTheme, rest, tick.
- `events.ts` (CA-3 producer): `RuntimeEvent = {type, at:{round,turn}, actor?, target?, payload, why:{rule, rolls}}`; `EventStream` emit/on/off/sinceRound/setClock (host-owned clock); named non-combat events: character:created, xp:awarded, level:reached, condition:applied/removed, pool:drained, spell:prepared/cast, rest:completed. Envelope-shape equality asserted in tests/runtime/events.test.ts (shared-file window closed before any S05 events.ts commit).
- `CharacterState`: plain JSON incl. per-class `classXp` (FR-14 classes + XP split); `slots` values `(string|null)[]` keyed by string level.
- Progression: shared build validator for level-set and XP paths; race caps; pack `tables.xp` thresholds or documented 1000/level fallback; even XP split w/ remainder to first class; best-of saves; additive slots; tableLevelCeiling clamp. Mock-wins where schema permits: per-class levels, best-of saves, additive slot arrays; mock's race allowed/multiMax absent from closed v1 RaceDef — not implemented (schema event if wanted).
- Restricts matcher (for S05 declare-time reuse): `matchesRestriction(pattern, kind('action'|'spell'), tags, declaredTags)` — exact `actions.tagged:<tag>` / `spells.tagged:<tag>` prefix, tag must be pack-declared, exact kebab match; `isLivePattern(runtime, pattern)`; `declaredTags(runtime)`.
- Dependency direction realized: runtime → {schema, core} only; runtime-internal: runtime.ts → {events, character, progression}; character.ts → {progression, pools, conditions}; pools/conditions → {errors} + core; no cycles; no compiler import.
