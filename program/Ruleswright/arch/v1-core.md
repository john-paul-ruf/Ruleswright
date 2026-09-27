# Ruleswright — Architecture Record (v1-core)

> **Realized state as of tree HEAD `73a8105`** (plan HEAD `53c7c91`), synthesized by Archivist
> (final pass, 2025-09-25) from the seven Orchestrator-integrated session deltas, STATE.md's
> Design Decisions D7–D21, and mechanical import derivation over `src/**`.
> Verified by this pass: `pnpm typecheck` 0 / `pnpm lint` 0 / `pnpm test` 387/387 (29 files) /
> `pnpm build` 24 dist files / `check:isolation` / `check:security` — re-run on a fresh build.
> Verified-by-source and verified-by-execution are distinguished below.
>
> *(The two S03/S04 attempt-1 crashes, the 5-failure S08 dispatch cluster, the two owner
> corrections, and the one Orchestrator fallback execution are process history, not architecture;
> they live in the Final Report's Orchestration section and ARCHIVIST-LOG.md, not here.)*

<!-- Realized-state summary (Archivist synthesis, final pass) -->

## Module map (as realized)

| ID | Module | Path | Imports (derived mechanically from value imports, incl. `export … from`, excluding `import type`) | Key files |
|----|--------|------|------------------------------------------------|-----------|
| M01 | Schema surface | `src/schema/` (7 .ts) | nothing internal | `pack.ts`, `artifacts.ts`, `error-card.ts`, `validate.ts`, `version.ts`, `overrides.ts`, `index.ts` |
| M02 | Core mechanics | `src/core/` (8 .ts incl. dsl/) | M01 — **type-only** (DslCheckRequest/ErrorCard); no runtime value dependency | `rng.ts`, `dice.ts`, `tables.ts`, `index.ts`, `dsl/{shared,registry,formula,effect,checker}.ts` |
| M03 | Runtime | `src/runtime/` (17 .ts incl. combat/) | M01, M02 (value); never M04 | `runtime.ts`, `events.ts`, `character.ts`, `progression.ts`, `pools.ts`, `conditions.ts`, `errors.ts`, `snapshots.ts`, `bestiary.ts`, `encounter.ts`, `index.ts`, `combat/{combat,resolve,action-economy,spatial,triggers}.ts` |
| M04 | Compiler | `src/compiler/` (16 .ts + 7 stages/ + 2 themes/) | M01, M02 (value); never M03 | `generate.ts`, `pipeline.ts`, `stage.ts`, `rng-stream.ts`, `knobs.ts`, `theme.ts`, `theme-loader.ts`, `compose.ts`, `errors.ts`, `index.ts`, `stages/{stats,skills,feats,classes,magic,bestiary,tables}.ts`, `themes/{dark-fantasy,zombie-urban}.json` |
| M05 | Root entry | `src/index.ts` | M01, M03, M04 (dumb `export *` re-export only) | `index.ts` |

**Realized dependency flow:** `schema` ⊥ `core` (siblings, import nothing internal — the only
declared M02→M01 edge is type-only); `runtime → {schema, core}`; `compiler → {schema, core}`;
stage 8 IS `schema.validatePack` (dogfood, no runtime import); no cycles inside any module except
the two intra-M03 pairs noted below. Guards held: no `compiler` reference in `src/runtime` except
the CI-checked bundle rule comment; no `runtime` import in `src/compiler` (grep-asserted in tests).
The runtime-only bundle is **proven** free of `generateCampaign` by `scripts/check-runtime-isolation.mjs`
(passed by this pass on a fresh build; also wired into CI's `package` job).

## Surfaces (what a consumer actually gets — derived, not claimed)

- `ruleswright/schema` — the full M01 re-export: pack/artifact types, `validatePack(json, dslChecker?)`,
  `DslChecker`/`DslCheckRequest`/`deferredDslChecker`, `checkSchemaVersion`, `packContentHash`,
  `MAX_TABLE_DEPTH`, `nearestIds`, overrides API, `ErrorCard`/`makeErrorCard`/`RULE_IDS`.
- `ruleswright/compiler` — `generateCampaign`, `loadTheme`, `DARK_FANTASY`, `ZOMBIE_URBAN`,
  `listThemeKnobs`, `resolveKnobs`, `composeTheme`/`readPatch`, `runPipeline`/`defaultStages`/`STAGE_ORDER`,
  `stageRng`, `GenerationError`, types. `loadTheme`/`DARK_FANTASY`/`ZOMBIE_URBAN` landed at S08 ck3 (D20)
  for the docs proof (FR-17's one-call entry).
- `ruleswright/runtime` — lifecycle (Runtime/Character + progression/pools/conditions), combat engine
  (startCombat/Combat + resolve/action-economy/spatial/triggers), bestiary/encounter, snapshots,
  EventStream, `RuntimeRuleError`/`ruleCard`, restricts matcher helpers (`matchesRestriction`,
  `declaredTags`, `isLivePattern`), `PackLoadError`. **M03 barrel completed at S08** (D19, 9afa86c):
  combat/bestiary/encounter/profile/spatial/triggers exports — a plan-level lease gap (S04's barrel
  predated S05; no session owned barrel completion), mechanically closed.
- Root `ruleswright` — dumb `export *` from the three subpaths (M05).

**Dice/Rng seam (recorded drift, not a defect):** injectability is proven at `startCombat(rng?)` /
`assembleEncounter(rng?)` (`RandomSource`), and the fight's own stream is snapshot-resumable via
`CombatState.rng` (S06's resume test). `Rng`/`RollResult` are **not** exported from
`ruleswright/runtime` (dist/runtime.d.ts has none); `specs/architecture.md` had pinned "core exports
never re-exported at a surface root except `Rng`/`RollResult` types through runtime". A consumer
injecting a custom source still passes any `{ int(maxExclusive) }`; constructing an `Rng` requires
importing `ruleswright` (root). Recorded for the next Author/DB re-entry or v1.1 surface decision.

## Cross-cutting decisions (accepted this cycle)

- **D9** `src/core/index.ts` internal barrel; **D11** `src/runtime/errors.ts` + `RuntimeRuleError`
  (runtime rule ids are engine-named strings — `unknown-race`, `no-slot`, `unknown-spell`, … —
  distinct from the DB E-* registry); **D10** DSL grammar decisions (kebab name-swallowing,
  grammar-pure parser, 12-entry frozen registry, save-for-half ceil+inheritance); **D16/D19**
  M03 barrel completion (S06's one-block + S08's mechanical completion); **D20** compiler surface
  gains `loadTheme`/`DARK_FANTASY`/`ZOMBIE_URBAN`; **D21** README quickstart's exact shape,
  executed verbatim by `tests/proofs/docs-run.test.ts`; **D17** themes carry NO spatial section
  (closed pack root; E-SCHEMA-02 on extra sections); **D18** `resolveJsonModule: true`,
  `themes.d.ts` deleted, `fresh-load.d.ts` retained; **D13** spatial rejections carry typed
  `pendingId` (E-SPAT-01 deliberately NOT in the frozen registry); **D8** `MAX_TABLE_DEPTH = 8`
  pending DB ratification.
- **One table engine:** the compiler's tables stage rolls every pack table through S02's
  `rollTable` — no second engine. `MAX_TABLE_DEPTH = 8` is defined in both `src/core/tables.ts`
  and `src/schema/validate.ts` (S02/S01 matched; a same-value duplication pending the DB
  ratification and a single-source cleanup in v1.1).

## Session-realized sections

*(Each section below is the session delta as integrated by Orchestrator, lightly reconciled by
Archivist: stale claims resolved against derived imports; commit ids preserved.)*

### M01 — Schema surface (SESSION-01, 43065f5/27d25e6/d3cbd51)

`src/schema/overrides.ts` — `applyOverrides(pack, doc): { pack, errors }` (FR-19 deep-merge per
dotted-path key, array order, unknown target → E-OVR-01 with nearest-id hints; does NOT validate —
callers revalidate per database.md merge discipline). `OverrideDocument` mirrors override.schema.json.
Imports `nearestIds` from `./validate` (internal M01 edge).

`validate.ts` public API: `validatePack(json, dslChecker?)` — second param is the CA-2 consumer seam
(default `deferredDslChecker`, fail-closed: one deferred E-FORM-01 per DSL string until S03's
`packDslChecker` is wired — verified at source); `DslCheckRequest {expr; kind; artifactId; jsonPath;
abilities; saves}`; `MAX_TABLE_DEPTH = 8`; `nearestIds`. `version.ts`: `checkSchemaVersion` (E-SCHEMA-01),
`packContentHash` (canonical sorted-key JSON + FNV-1a → 8 hex, zero deps). `src/schema/index.ts`
re-exports all six implementation files. M01 imports nothing internal.

### M02 — Repo spine + core mechanics (SESSION-02, 35aa73f/0f8a1ab/55918ef)

- `src/core/rng.ts` — `Rng` (sfc32, cyrb128 string/number seed), `RandomSource` (minimal injectable
  entropy: `int(maxExclusive)`), `RngState` (`{a,b,c,d}` uint32 — exactly snapshots.schema.json
  `rngState`; setState rejects extra keys).
- `src/core/dice.ts` — `parseRecipe` (pure, load-time; dice.html vocabulary), `rollRecipe` →
  `RollResult` (CA-2 shape; invariant `total === sum(values) + modifier`; verdicts caller-attached).
- `src/core/tables.ts` — `rollTable(def, rng, {resolve?, jsonPath?})` → `TableOutcome`;
  `TableDef`/`TableEntry` mirror `$defs/tableDef` (sibling-declared, no internal import);
  `MAX_TABLE_DEPTH = 8`; failures `malformed-entries`/`range-gap`/`depth-exceeded` → E-TBL-01,
  `unresolvable-ref` → E-REF-01.
- `src/core/index.ts` — internal barrel for runtime/compiler imports; core still imports nothing internal.
- Root manifests (package.json/tsconfig/vitest/eslint/prettier/pnpm-lock); zero runtime deps; lint bans
  `Math.random`/`Date.now`/`eval`/`new Function`/dynamic imports + `ImportExpression` under `src/**`.

### M02 — DSL compiler (SESSION-03 via RECOVERY-03, 4e188fa/dff30e6/7eff106/168d71a)

Module `src/core/dsl/` — value imports only `../rng`, `../dice`; schema imports are type-only
(`DslCheckRequest`, `ErrorCard`) — sibling-leaf rules held in the M02→M01 direction.

- `checker.ts` — `packDslChecker: DslChecker` (S01's seam; dispatch by request kind); E-FORM-01 parse
  errors carry 0-based char offset; E-FORM-02 closed-registry miss; E-FORM-03 unknown name + did-you-mean
  via S01 `nearestIds`.
- `formula.ts` — `parseFormula` (parse-once), `evalFormula` (eval-many; `FormulaValue = number |
  RollResult`), `checkFormula`, `checkFormulaAst` (S05/S07 reuse), `BUILTIN_SCALARS = ['level']`.
- `effect.ts` — `parseEffect` (root must be a statement call); `executeEffect(ast, ctx)` pure
  interpreter; ctx `{actor, targets, rng, apply: EffectApply, vars}`; `EffectApply =
  {resolveTargets, damage, condition}` is S05's mutation seam; save-for-half: `damage(half)` re-rolls
  the fail branch's first damage expr, total = ceil(half), inherits type.
- `registry.ts` — frozen 12-entry registry; extension = schema event (CA-2); exact-membership freeze test.
- `shared.ts` — one lexer both grammars; `MAX_PARSE_DEPTH = 24`, `MAX_EXPR_LENGTH = 512`; `nearestName`;
  `dslCard` (literal ErrorCard construction).

Grammar decisions: kebab ids swallow `-` inside names; parser grammar-pure (E-FORM-02 is the
checker's call); one dice lexeme = one die cluster, multi-dice compose via +/-; effect-embedded
formulas resolve names against abilities+saves+`EFFECT_SCALARS` only (no pack-formula refs at play
time); no eval/new Function/Math.random (lint + grep-tested); all randomness injected.

### M03 — Runtime I: character side (SESSION-04 via RECOVERY-04, 23f9918/4ead08b/db7eebb/b961053/d0240e6)

- `src/runtime/errors.ts` — `RuntimeRuleError extends Error` carrying `readonly errors: readonly
  ErrorCard[]`; load failures remain PackLoadError (FR-2); `ruleCard(rule, artifactId, jsonPath,
  message, hint?)`. Runtime rule ids are engine-named strings (unknown-race … theme-grants-nothing) —
  distinct from the DB E-* registry.
- `Runtime(pack)` — validates with S03's real checker, fails closed on reserved hp/ac formulas
  (CA-6 recheck), indexes artifacts, compiles effect/formula/attackBonus ASTs once (CA-2). Facade:
  createCharacter, levelSet, awardXp.
- `Character` facade: state, derived(rng?), spend, prepare, cast, applyCondition, removeCondition,
  applyTheme, removeTheme, rest, tick.
- `events.ts` (CA-3 producer): `RuntimeEvent = {type, at, actor?, target?, payload, why:{rule, rolls}}`;
  `EventStream` emit/on/off/sinceRound/setClock (host-owned clock); named non-combat events
  (character:created, xp:awarded, level:reached, condition:applied/removed, pool:drained,
  spell:prepared/cast, rest:completed). Envelope-shape equality asserted in tests/runtime/events.test.ts.
- `CharacterState`: plain JSON incl. per-class `classXp`; `slots` values `(string|null)[]` keyed by
  string level.
- Progression: shared build validator for level-set and XP paths; race caps; pack `tables.xp`
  thresholds or documented 1000/level fallback; even XP split w/ remainder to first class; best-of
  saves; additive slots; tableLevelCeiling clamp. Mock-wins where schema permits; the mock's race
  `allowed`/`multiMax` is absent from the closed v1 RaceDef — not implemented (DB schema event if wanted).
- Restricts matcher: `matchesRestriction(pattern, kind, tags, declaredTags)` — exact
  `actions.tagged:<tag>` / `spells.tagged:<tag>` prefix, tag must be pack-declared;
  `isLivePattern(runtime, pattern)`; `declaredTags(runtime)`.
  **Reconciled (this pass):** S05's combat declares do NOT call these helpers — `combat.ts`'s
  `restrictionRejection` re-consults the pack index inline, handling only the `actions.tagged:`
  family at declare-time (the engine never re-derives tag existence — E-REF-01 rejections; the
  validator enforced restricts integrity at load). S04's helpers remain the character-side surface
  (tests only). `matchesRestriction`/`isLivePattern` currently have no non-test consumer.
- Dependency direction: runtime → {schema, core} only; intra-runtime edges: runtime.ts →
  {events, character, progression}; character.ts ⇄ progression.ts (value import cycle — see note
  below); pools/conditions → {errors} + core; no compiler import.

### M03 — Combat engine (SESSION-05, 6efaa16/c7a2d44/6afbe31/4be9e6c)

- `combat/action-economy.ts` (CA-4 producer) — `resolveSlotGrants(pack)` (v1.1: declared
  `economy.turnSlots` authority; absent → documented default 1-of-each-cost-slot-name); `checkCost`
  (E-ECON-01-shaped declare-time rejections; points; vancian bound slots); per-turn `SlotLedger`
  transients (`freshLedger/replenish/spend/refund`; never character state).
- `combat/resolve.ts` (FR-3) — `parsePackEffects`/`checkPackDsl` (parse-once + load-time check via
  S03 `packDslChecker`); `profileFromStatblock` — the one combatant constructor for characters and
  monsters; `attackBonusAgainst` (`byDefense[String(v)]` literal lookup — engine never interprets the
  convention); `attackRoll` (`d20 + attackBonus ≥ defenseTarget`, verdict-attached RollResult);
  `executeAgainst` (S03 executor seam, per-target vars, ordered roll history for `why.rolls`).
- `combat/combat.ts` (FR-10/13) — `startCombat(runtime, {allies, enemies, rng?})`; `Combat`
  `step()/declare()/respond()/serialize()/eventsSince()/roundComplete`; initiative from reserved
  `initiative` formula or d20 fallback (CA-6); events emitted as CA-3 rows only (envelope untouched):
  combat:start, turn:began/ended, round:completed, attack:rolled, damage:applied, condition:applied,
  action:resolved, declare:rejected, trigger:fired, trigger:declined; `displayRoll` = combat-loop.html
  roll anatomy. Declare gates ordered: no-action → not-yours → restricts → target → cost → spend.
- `combat/spatial.ts` (FR-11) — `theaterOfMind` no-op; `gridGeometry` (Chebyshev, reach, burst);
  `checkReach` → typed `SpatialRejection` carrying `pendingId: 'E-SPAT-01 (unregistered — DB decision
  pending)'` (registry frozen additive — no unregistered id in code).
- `combat/triggers.ts` (FR-4/13, FR-12 proof-2 shape) — pattern grammar `<type>`, `[target=self]`,
  `[actor=self]`; `offersForEvent`/`respond`; taken triggers ride the same resolution pipeline as declares.
- `bestiary.ts` — `spawnMonster`/`bestiaryIds` via the same `profileFromStatblock` (no second
  combatant path). `encounter.ts` (FR-16) — `assembleEncounter` heuristic `threat-weighted-uniform`
  (documented, deterministic per seed, bypassable); `spawnEncounter`.
- Test fixtures: `emberMarchesPack()` (declared economy + tags, descending-AC + ascending
  conventions, vancian + pool costs, reactive action, restricts), `emberMarchesNoEconomyPack()`
  (default-grant branch), `emberMarchesAscendingPack()`, spatial seam helpers.
- First narrow journey landed at ck2: fixture pack → validatePack(+packDslChecker) → Runtime →
  stepwise combat → damage:applied with `why:{rule,rolls}` and mock-verbatim display strings.

### M03/M05 — Snapshots + root surface (SESSION-06, f1af841/9e18ee2/daac7b7/a6d89ff/bb01e92)

- New module `src/runtime/snapshots.ts` (M03): FR-14 serializers `serializeCharacter/
  serializeParty/serializeCombat` + loud-refusal loaders `restoreCharacter/restoreParty/
  deserializeCombat`; types incl. `CombatRestoreRequest`. Exported through `src/runtime/index.ts`
  (one added export block — D16).
- Envelopes are snapshots.schema.json verbatim (`additionalProperties: false` — state only, no
  timestamps/environment); field mapping: classXp→classes[].xp, spells→knownSpells, conditions
  {id, remaining}, bindings slots, pools, inventory [].
- Load discipline (CA-1 consumer): identity gate BEFORE any application — kind + pack.id +
  pack.schemaVersion + pack.contentHash → E-SNAP-01 on mismatch; snapshotVersion ≠ 1 → E-SNAP-02;
  aggregated via RuntimeRuleError; no state mutated on refusal. Restore is the third build path
  (validateBuild runs there; restoreParty validates every member before minting ids).
- Combat restore: envelope carries no side/profile fields — `deserializeCombat(runtime, snapshot,
  restore: CombatRestoreRequest)` takes the sides/profiles explicitly; balances ride the paired
  party snapshot (`pairsWith`, FR-14).
- M05 `src/index.ts`: dumb `export *` from './schema' | './runtime' | './compiler'; no logic, no
  cross-surface barrel. Runtime imports: {schema, core, combat/*} only.

### M04 — Compiler + themes (SESSION-07, 116fc7e/01af260/786923b/1676c42/5d30d2f/3faf836)

Module `src/compiler/` — imports only `../schema` + `../core` (no runtime import; grep-asserted in
tests). Zero I/O.

- `stage.ts` — `Stage = {name, run(ctx)}`; `GenerationContext = {theme, knobs, seed, stream, pack,
  own}` (stage sees only resolved knobs, its seed-salted stream, the document under construction;
  purity asserted by key-spy test).
- `rng-stream.ts` — `stageRng(seed, stageName)` → S02 Rng over `"${seed}:${stageName}"`; per-stage
  streams independent (content-hash invariance under an interleaved probe stage).
- `knobs.ts` (FR-18) — knobs as theme-declared object map; `listThemeKnobs(theme)` →
  `KnobDeclWithId[]`; `resolveKnobs` validates caller values (unknown → did-you-mean; out-of-range →
  typed rejection), fills defaults, returns provenance knobs verbatim; `#knob/<id>` tokens substitute
  into stage inputs.
- `theme.ts` — `ThemeTemplate`: partial pack keyed like pack sections; base+patches (FR-20); readme
  carries a documented example override.
- `pipeline.ts` — `STAGE_ORDER = [stats, skills, feats, classes, magic, bestiary, tables]`; stage 8 =
  `schema.validatePack` + S03 `packDslChecker` (CA-1 dogfood gate, NOT a replaceable Stage); manifest
  first (provenance exactly {theme, seed, knobs}); undeclared knob token → located E-SCHEMA-01 before
  stages run; any card aggregates into `GenerationError` (failed campaigns never return partial packs).
- `stages/*.ts` — stats/skills/feats (≥1 reactive enforced)/classes (progression per class, E-REF-03
  located)/magic (spells + declared economy + pool capacity formulas, E-ECON-01 located)/bestiary
  (statblocks + content.races + content.conditions; refs E-REF-01/-02 located — stage-6 correction
  3faf836 landed the race/condition floor content)/tables (every table ROLLED through S02 `rollTable`
  — Custom Rule 3 held).
- `compose.ts` (FR-20) — `composeTheme(derived, base)`: add/remove/merge at '/'-joined pointer paths;
  add-on-existing and remove-of-missing rejected; deep-merge objects, replace scalars/arrays; later
  wins; base read-only hash-proven; shipped themes stand alone (D1) but composition is built + tested.
- `errors.ts` — `GenerationError` carrying ErrorCards; theme-relative jsonPath; mirrors PackLoadError
  discipline. `generate.ts` — `generateCampaign({theme, seed, knobs?})` → Pack, synchronous.
- `theme-loader.ts` + theme JSON data imports (typed via `resolveJsonModule` after D18);
  `index.ts` surface as listed above (loadTheme/DARK_FANTASY/ZOMBIE_URBAN added at S08 ck3 — D20).
- `themes/dark-fantasy.json` — vancian showcase to the FR-21 floor (3 classes incl. Warden
  descending-AC table + Hexer ascending + Crypt Warden multi-class hybrid; 4 races with demihuman
  caps; five named saves vigor/grace/tenacity/reason/presence; 33 coined spells L1–3;
  main/move/reaction economy; reactive parry/ward-glint + second-gust feat; 10 conditions incl.
  sapped/rooted restricts; 4 statblocks; 7 tables incl. ranged xp L1–10).
- `themes/zombie-urban.json` — drain/table showcase (3 survivor classes; adrenaline/stamina drain
  pools; 4 ritual spells, NO vancian; 7 skills; 8 conditions; 4 statblocks; 8 tables incl. ranged
  bite-turns infection; deliberately omits `economy` — the pack side of S05's default-grant branch).
- CA-5 producer proof landed: byte-identity (equal hash + equal bytes), different-seed divergence,
  in-process AND across fresh module loads; no ambient values (provenance exactly {theme, seed, knobs}).
- FR-21 conformance test (S08's proof-4 input): `tests/compiler/coverage-floor.test.ts` (50 tests,
  every floor bullet + showcase split + coined-name lint + knob feeding).
- Envelope-premise correction (D17): themes carry NO spatial section — pack.schema.json root is
  closed (E-SCHEMA-02 on extra sections); S05's fixtures attach spatial post-validation via test
  helper; the optional spatial layer stays host-side (FR-11); spatial schema section = DB schema
  event if wanted.

### M05 — Packaging, CI, proofs, docs (SESSION-08, ck1–3 via Orchestrator fallback, 02752a9/8f67611/9afa86c/32c7ade/d5bacba)

*(New section — this synthesis, from STATE/Final Report/S08 lease + mechanical source reads.)*

- Build: `tsup.config.ts` — four per-entry builds (index/schema/runtime/compiler), dual ESM/CJS +
  rolled dts, target es2020, tree-shake-friendly; `package.json` exports map covers
  `.` / `./runtime` / `./schema` / `./compiler` (verified: all subpaths resolve from dist).
- `scripts/check-runtime-isolation.mjs` — the runtime-only bundle is a proof, not a promise: greps
  `dist/runtime.{js,cjs}` for `generateCampaign` and asserts dual ESM/CJS + dts (packaging.html's
  check; CI `package` job wires it). `scripts/check-security-lint.mjs` — eval/new Function/
  Math.random/Date.now sweep over src/ + dist/ (belt to ESLint's suspenders).
- `tests/proofs/rules-are-data.test.ts` (CA-8, FR-12 trio): proof 1 — new action + condition with
  restricts changes declare/resolution/restriction behavior through the unchanged machinery
  (declare-rejection = typed event); proof 2 — pack-declared parry trigger fires → respond(take) →
  same pipeline → reaction slot consumed; proof 3 — new spell prepare→bind→cast, unknown-spell throw
  on the unmutated fixture. Baseline counterfactuals; zero engine diffs (each proof names the engine
  files it does not modify); trio typecheck guards added at 32c7ade.
- `tests/proofs/perf-budget.test.ts` — CI-generous budgets (generate < 2s actual ~6ms; 10-combatant
  round < 500ms CI-bound (real ~50ms); snapshot round-trip < 50ms).
- `tests/proofs/docs-run.test.ts` (NFR-DX made mechanical): executes the README's three fenced ts (TypeScript) code blocks verbatim (import-stripped, assertion-preserving evaluation) and asserts the README's
  own output lines: manifest dark-fantasy/3 classes/33 spells; derived() hp 27/ac 12;
  `d20[9]=9 < ac11`; `why.rule = actions.cut-down.attackBonus`. README quickstart rewritten to
  shipped reality (3 copy-paste steps with expected outputs — D21).
- `.github/workflows/ci.yml` — matrix Node 18/20/22 × typecheck/lint/test + determinism suites;
  package job (build + isolation + security + proofs); themes job (coverage floor). The
  browser-mode determinism step is documented as a v1.1 follow-up (D4 realized honestly); the CI
  step fails loudly if a browser config appears and is skipped. First real CI run pending (runs on
  next push).
- Compiler surface gained `loadTheme`/`DARK_FANTASY`/`ZOMBIE_URBAN` (D20) for the docs proof.
- Full gates at close (S08 + re-verified by this Archivist pass): typecheck 0; lint 0;
  `pnpm test` 387/387 (28 files — the Final Report's count; vitest reports 29 files: the suite-wide
  total includes one additional collected file); build 0 (24 dist files); isolation 0; security 0;
  built-package journey smoke green (generate → load → combat surface functions from
  `dist/runtime.js`).

### OWNER-04-TSCONFIG (owner correction, 77b4108)

Theme JSON module types now come from real-file resolution via tsconfig `resolveJsonModule`;
ambient shim `src/compiler/themes.d.ts` deleted (cast retained in theme-loader.ts);
`tests/compiler/fresh-load.d.ts` retained — it types the vite `?fresh-load` query specifier (not a
file), and its consumer `tests/compiler/coverage-floor.test.ts` was outside the correction write set.

<!-- loot-inventory SESSION-01 -->

# SESSION-01 arch delta — loot-inventory (runtime inventory core)

## M03 (runtime) — new module file: `src/runtime/inventory.ts`

- CAP-01/CA-02 producer. Public surface: `grantItem`, `dropItem`, `countItem`,
  `rollLoot`, `grantLoot`, `type LootOptions` (exported via the runtime barrel).
- Verb discipline mirrors `pools.ts` (validate with named `ruleCard` rejections
  → mutate `state.inventory` in place → emit one provenanced event); loot shape
  mirrors `conditions.ts` (`applyTheme`/`unknown-theme` → `unknown-table`,
  `theme-grants-nothing` → `loot-grants-nothing`).
- Loot rolls through the one core table engine (`rollTable`, Custom Rule 3) with
  grantLoot's normalized dual-space nested resolver (bare-id theme-space refs +
  `tables.`-prefixed pack-space refs). Failed roll outcomes (`TableOutcome.ok ===
  false`) map to named runtime rejections: `unresolvable-ref` verbatim;
  `range-gap` / `depth-exceeded` / `malformed-entries` → `table-roll-failed`
  naming the core reason. No ambient entropy: `opts.rng` wins, else
  `new Rng(opts.seed ?? tableId)`.

## Public API added (M03)

- `CharacterState.inventory: InventoryEntry[]` (new `InventoryEntry {id, qty}` in
  `character.ts`); `buildCharacter` initializes `inventory: []`.
- `Character` facade methods: `grant(itemId, qty?)`, `drop(itemId, qty?)`,
  `count(itemId)`, `loot(tableId, opts?)` — one-to-one delegates.
- Snapshots: `serializeCharacterState` emits `state.inventory` verbatim (fresh
  copies), `restoreCharacterState` restores it (fresh entry copies; no
  pack cross-validation on the load path) — CA-01.
- New event types (character-side, round 0): `item:granted`, `item:dropped`,
  `loot:rolled` — payload/why anatomy per the session prompt; the `EventStream`
  envelope itself is unchanged.

## Realized import edges (value imports, type-only excluded)

- `runtime/index.ts → ./inventory` (barrel re-export; OWNER-08-BARREL closed at landing).
- `character.ts → ./inventory` (facade delegates) — new intra-module value-import
  pair in M03 (alongside the existing `character ⇄ progression` and
  `combat/triggers → combat` pairs).
- `inventory.ts → ./character` is **type-only** — excluded from realized edges;
  no third value-import cycle was added (the M03 pair count stays as documented).
- Module-registry delta: M03 key files gain `inventory.ts`.

*(Integrated by Orchestrator at receive of SESSION-01 attempt 2 / RECOVERY-01, commits 24b37c1 + db531d5; synthesis is the Archivist final pass.)*

## Recorded drift & intra-module notes (for the next cycle)

- **M03 internal cycles (value imports):** `character.ts ⇄ progression.ts` (progression imports
  `reserveValue` from character; character imports `validateBuild/buildCharacter` from progression)
  and `combat/triggers.ts → combat.ts` (value). The cycle exists in code; TypeScript's runtime
  module evaluation tolerates these shapes because the imported symbols are used lazily (function
  bodies, not module-init time). Recorded as observed, not as an architecture violation — M03 is
  one module; the constraint the architecture cares about is the cross-module flow, which holds.
- **Restricts matcher duplication:** S04's `matchesRestriction`/`isLivePattern` (full pattern
  grammar, both families) vs S05's inline `restrictionRejection` (actions-only re-consult). The
  two coexist; the helpers have no non-test consumer. Candidate for the next feature cycle's
  cleanup program (single shared matcher or explicit surface rationale).
- **`MAX_TABLE_DEPTH` duplication:** same value 8 in `core/tables.ts` and `schema/validate.ts`
  (S02/S01 independently chose 8; DB ratification pending). Single-source in v1.1.
- **E-SPAT-01 unregistered:** typed `pendingId` carried verbatim in `src/runtime/combat/spatial.ts`;
  registry frozen additive; DB decision pending.
- **Dice/Rng on the runtime surface:** not exported (see Surfaces above) — the approved surface
  spec said types should ride runtime; the README's "dice" bullet is satisfied by the engine's
  injectable seam + snapshots, not by exported dice symbols. Next surface revision decides.

<!-- Historical delta sections (pre-synthesis, kept verbatim below this line for provenance) -->

---

*(Session deltas S01–S07 and the OWNER-04 note were integrated by Orchestrator during the run; the
sections above carry their content reconciled. The original delta-section markers are preserved in
git history at `573b075` and earlier.)*