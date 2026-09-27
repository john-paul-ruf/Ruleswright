# State Tracker — Ruleswright / grid-combat

## Program / Feature / Intent

- **Program:** Ruleswright (`program/Ruleswright/`)
- **Feature:** `grid-combat` — engine-enforced grid combat per approved FR-11: packs declare an optional spatial model; positions ride combat state; melee declares fail declaratively when out of reach; burst shapes resolve through the targeting DSL; spatial fights snapshot/resume losslessly. Theater-of-mind packs pay nothing.
- **Intent:** Close the integration half of FR-11. The geometry layer (`src/runtime/combat/spatial.ts`) is landed and unit-tested but has zero consumers inside the engine; `Pack` cannot declare `spatial` (closed top level, E-SCHEMA-02); `def.valid` clauses are load-checked but never evaluated at play; the executor's `resolveTargets` is a stub; snapshots' `position` field has no writer. This feature wires the whole column: contract → validator → combat loop → snapshots → generated themes → end-to-end proof.

## Sessions

| # | Session | Title |
|---|---------|-------|
| S01 | SESSION-01 | DB author re-entry — pack.schema.json `spatial` (v1.3) + E-SPAT-01 registration |
| S02 | SESSION-02 | Schema TS mirror + validator (`Pack.spatial`, checkSpatial, RULE_IDS) |
| S03 | SESSION-03 | Runtime spatial integration (positions, reach gate, shapes, validity, snapshots) |
| S04 | SESSION-04 | Compiler pass-through + theme spatial declarations |
| S05 | SESSION-05 | Grid journey proof (real generated pack) + README |

## Session Status

| # | Session | Modules | Owns | Status | Checkpoint | Completed | Notes |
|---|---------|---------|------|--------|------------|-----------|-------|
| 01 | DB author re-entry | — (Author artifacts) | `src/schema/contracts/pack.schema.json`, `program/Ruleswright/specs/database.md` | pending | — | — | Author (DB) session — the only session leased on `contracts/**`/`specs/**`, per Author re-entry (schema-change class). Human-authorized 2026-09-27 ("yes I want grid based combat"). |
| 02 | Schema TS mirror | M01 | `src/schema/pack.ts`, `src/schema/error-card.ts`, `src/schema/validate/sections/root.ts`, `src/schema/validate/index.ts`, `tests/schema/validate.test.ts`, `tests/schema/fixtures.ts`, `tests/schema/registry.test.ts` | pending | — | — | Blocked on S01. |
| 03 | Runtime integration | M02, M03 | `src/runtime/combat/spatial.ts`, `src/runtime/combat/combat.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/runtime.ts`, `src/runtime/snapshots.ts`, `src/core/dsl/formula.ts`, `tests/runtime/combat/spatial-triggers.test.ts`, `tests/runtime/combat/combat-spatial.test.ts`, `tests/snapshots/combat.test.ts`, `tests/runtime/fixtures/packs.ts` | pending | — | — | Blocked on S02. Concurrent with S04 (disjoint leases, verified path-by-path). |
| 04 | Compiler + themes | M04 | `src/compiler/theme.ts`, `src/compiler/pipeline.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `tests/compiler/pipeline.test.ts`, `tests/compiler/coverage-floor.test.ts` | pending | — | — | Blocked on S02. Concurrent with S03. |
| 05 | Journey + README | M01–M04 (reads) | `tests/proofs/grid-journey.test.ts`, `README.md` | pending | — | — | Blocked on S03 + S04. Replanned 2025-09-27 (REPLAN-GC-01): ck1 = README block-03 positions restatement (docs-run planned-debt payoff after S04), ck2 = journey, ck3 = README grid section (json snippet, no new ts block) + package gates. |

## Wave Plan

| Wave | Sessions | Why concurrent / serial |
|------|----------|------------------------|
| W1 | S01 | Alone: the contract gate. Every later session reads pack.schema.json §spatial; no TS work may prescribe fields the contract has not defined (prescribed-facts rule). |
| W2 | S02 | Alone: S03/S04 both consume `Pack.spatial` types and the registered E-SPAT-01 id; the TS mirror must land before either. |
| W3 | S03 ∥ S04 | Disjoint leases: S03 owns `src/runtime/**`, `src/core/dsl/formula.ts`, `tests/runtime/**`, `tests/snapshots/combat.test.ts`; S04 owns `src/compiler/**`, `src/compiler/themes/*.json`, `tests/compiler/**`. Verified path-by-path — zero intersection. |
| W4 | S05 | Alone: the journey runs `generateCampaign` (S04's themes) through `startCombat` with positions (S03's engine); needs both; replanned ck order: README block-03 fix → journey → README section + package gates. |

## Dependency Graph

```
S01 (DB contract v1.3 + registry)
 └─> S02 (Pack.spatial TS + validator + E-SPAT-01 in RULE_IDS)
      ├─> S03 (runtime integration: positions, reach gate, shapes, validity, snapshots)
      └─> S04 (compiler pass-through + three themes declare spatial)
           └─(both)─> S05 (grid journey proof + README)
```

## Architecture Reference (feature-specific)

- Geometry stays in `src/runtime/combat/spatial.ts` (M03). `Runtime` builds it once at load: `readonly spatial: SpatialGeometry = spatialFromPack(pack)` — combat never constructs geometry per action.
- `Pack.spatial` (contract shape, mock-verbatim: `{model: 'grid', reach: {default, <id>: n}, shapes?}`) maps in `spatialFromPack` to the internal `SpatialModel` (`defaultReach`/`reachOverrides`). The internal model's signature is unchanged; only the pack-reading edge adapts.
- Shape resolution has exactly one implementation (combat-side `resolveShape`), consumed by three callers: the executor's `EffectApply.resolveTargets` (replacing combat.ts's stub), `hasTarget(…)` validity evaluation, and nothing else. Theater-of-mind: every shape resolves to the bound targets (current stub behavior preserved — no-op discipline).
- Validity ASTs are parse-once at Runtime load (`PackIndex.validAsts`, compiled by the existing `compileFormulas`), honoring CA-2. Play time evaluates them; nothing parses at declare time.
- Positions are host-declared at `startCombat` (engine never invents a grid), stored on `CombatantState.position?` (plain JSON), serialized in the combat envelope's existing `position` field, and re-stated on restore. Movement in v1 = serialize → restore with updated positions (the FR-10 between-steps boundary); no new combat verb.
- `runtime` never imports `compiler`; `core` never imports `runtime` (evalValidity takes `hasTarget` as an injected callback). Isolation check stays green.

## Scope Summary

| ID | Module | Affected files |
|----|--------|----------------|
| M01 | Schema surface | `pack.ts` (+SpatialDef), `error-card.ts` (+E-SPAT-01), `validate/sections/root.ts` (+checkSpatial), `validate/index.ts` (dispatch) |
| M02 | Core mechanics | `dsl/formula.ts` (+`evalValidity`) |
| M03 | Runtime | `combat/spatial.ts` (pack-shape adapter + registered rule id), `combat/combat.ts` (positions, reach gate, validity gate, shape resolver), `combat/resolve.ts` (real `resolveTargets`), `runtime.ts` (geometry + validAsts), `snapshots.ts` (position write/restore) |
| M04 | Compiler | `theme.ts` (+spatial input), `pipeline.ts` (pass-through), `themes/*.json` (three themes declare spatial) |
| M05 | Root entry | none |

Author artifacts touched only by the sanctioned S01: `src/schema/contracts/pack.schema.json`, `program/Ruleswright/specs/database.md`. No other session's `Owns` may include them.

## Design Decisions

1. **No movement verb in v1.** FR-11's approved text and spatial.html pin positions/adjacency/reach/shapes — no move verb; api-map.html pins the combat verb set (step/declare/respond/…). Adding `move()` is an api-map product decision. Conservative default: positions are declared at `startCombat` and re-stated on restore; movement = serialize → `deserializeCombat` with updated positions (uses only approved seams). Surfaced to the human as the feature's one open product question; additive follow-up if approved.
2. **Burst center = the declared target's position; bursts hit both sides.** Mock-verbatim ("ember-bloom, radius 2 @ (4,3): grave-shambles · bone-choir · brynn" — an ally is in the radius). Mixed per-target outcomes are the effect's business (save branches), already executor-native.
3. **`hasTarget` in theater-of-mind packs = "a target resolved" (true).** The no-op geometry answers every shape with the bound targets and never rejects (spatial.ts header, spatial.html absent-column). Declared adjacency requirements only bite when geometry exists — "fails declaratively, never by engine special case."
4. **Reach override keys are free-form labels in v1** (the mock's `"weapons.long-spear": 2` is illustrative). Runtime lookup: `reach[profile.id] ?? reach.default`. Dotted artifact paths are a documented v2 seam; no idPattern constraint on reach keys.
5. **`shapes[]` is validated and documentation in v1.** Values constrained to the v1 set (`single`, `burst`) → else E-SPAT-01. The engine's shape vocabulary is fixed (`adjacent`, `burst-N` via `target()`); declaring `shapes` changes no engine branch. Cone/line remain deferred, never faked.
6. **Structural vs semantic split for spatial validation:** missing/mistyped fields → E-SCHEMA-01 (consistent with `schemaVersion const 1` handling); declared-but-unshippable geometry (model ≠ grid handled as const, shapes outside the v1 set) → E-SPAT-01 (semantic: the pack opts into geometry the engine does not have).
7. **E-SPAT-01 becomes a registered id** (additive = compatible minor event, database.md Versioning discipline). Resolves the pending decisions recorded in v1-core's blocker bulletin (S01/S05 advisories: "`E-SPAT-01` registry decision belongs to DB"). `SpatialRejection.pendingId` → `rule: 'E-SPAT-01'` in the same session that owns the file (S03), with its test updated in the same lease.
8. **`RUNTIME_PACK` fixture stays theater-of-mind** (non-spatial parity proof: existing 503-test baseline must not shift behavior); the spatial variant lives in `tests/runtime/fixtures/packs.ts` as a `withSpatial`-reshaped helper carrying the v1.3 declaration shape.
9. **Snapshot contract unchanged.** `snapshots.schema.json` already carries `position?: null | object` on combatants (DB anticipated FR-11). S03 is its producer; no DB edit needed. Runtime emits the precise `{x, y}` shape; the contract's looser `object` accepts it.
10. **CA-2 hygiene debt stays out of scope:** `evalPackFormula` re-parses at play time (resolve.ts vs the parse-once index) — known, tiny, zero-behavior-change; recorded as open debt, not piggybacked into this feature.
11. **Planning-completeness review (2025-09-27, pre-W1):** the preflight Archivist (read-only, h-rxH5) verified CA/CAP origins, lease disjointness, the journey's real transport, and all inherited dispositions. Findings F-G1..G4 corrected by REPLAN-GC-01 before first dispatch: F-G1 — session-prompt text carried a nested `reach.keys` anatomy contradicting CA-G1's mock-verbatim inline shape; rewritten to the mock shape (mock wins; inline is structurally free in the committed schema idiom). F-G2 — `tests/schema/registry.test.ts`'s 14-id RULE_IDS pin had no owner; added to S02's lease with the ck2 re-key. F-G3 — `tests/proofs/docs-run.test.ts` pins the README ```ts block count and executes block 03 against live themes; S05 re-ordered (README fix first) and fence-disciplined (```json snippet; journey cited) rather than leasing docs-run. F-G4 — vancian binding note on the journey's burst step (informational). Confirmed-clean: prescribed-facts sequencing, S03∥S04 disjointness, CA-G2 additive chain, snapshots contract no-edit premise, geometry-API consistency, baseline hazards.

## Verification Baseline

Inherited from the loot-inventory close (`.program/ledger.md`, FINAL observed baseline, re-confirmed by both Archivist attempts): `pnpm typecheck` 0 · `pnpm lint` 0 · `pnpm test` 503/503 across 33 files · `pnpm build` 0 (24 dist files) · `check-runtime-isolation` 0 · `check-security-lint` 0 · `pnpm format:check` 0. Source revision: plan HEAD (loot-inventory FINAL @ `f792f49` lineage); this feature re-baselines at its S02 wave close.

Effective commands (PROGRAM-CONFIG, verified against package.json scripts):

| Command | Scope | Evidence |
|---|---|---|
| `pnpm typecheck` | tsc --noEmit over repo | inherited 0; re-run per checkpoint |
| `pnpm lint` | ESLint incl. security bans on src/ | inherited 0; Node 22-only in CI |
| `npx vitest run <path>` | **Lease-scoped gate** | `pnpm test -- <pattern>` does NOT filter (documented hazard) — use npx form under concurrency |
| `pnpm test` | whole suite (baseline 503/503) | inherited; re-run at session close |
| `pnpm format:check` | Prettier | inherited 0; FORMAT-RECONCILE lesson: format every land |
| `pnpm build` + `pnpm check:isolation` + `pnpm check:security` | package gates | run in S05 (last wave) |
| `pnpm exec vitest run tests/proofs/` | FR-12 trio + perf budgets | CI package job; S05 extends proofs |

Hazards: (a) the `pnpm test --` filter hazard above; (b) perf-budget proof (`tests/proofs/perf-budget.test.ts`, < 50 ms combat round / 10 combatants) must stay green — spatial adds O(combatants) work per declare, expected well inside budget, but S05 re-runs the proofs; (c) unexecuted checks this planning pass: full suite last observed at loot close, not re-run end-to-end here (spot check `npx vitest run tests/runtime/combat` → 50/50 at planning time); (d) tests/proofs/docs-run.test.ts pins the README's ```ts block count (four) at module scope and executes the quickstart against the live themes: after S04 lands it is red until S05 ck1 restates block-03 positions (planned debt, owner S05 ck1). The README grid section adds a ```json snippet, never a fifth ```ts block; registry.test.ts's RULE_IDS pin is re-keyed 14→15 inside S02's lease (replan 2025-09-27). Affected CAP/CA proofs reference their owning sessions below.

## Capability Readiness

| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|----|--------------------------------|---------------------------------|------------------------|-------------------------------|--------|------------------------|-------------------------------|
| CAP-G1 | A pack declares `spatial` (mock anatomy) and loads; malformed spatial → ErrorCards, never a partial load | Contract §spatial (S01); `Pack.spatial` type + `checkSpatial` (S02); `spatialFromPack` adapter (S03 ck1) | CA-G1; S01 → S02 | S03/ck1 | planned | prescribed — see SESSION-03 Verification | — |
| CAP-G2 | Melee declares fail declaratively out of reach (E-SPAT-01, kind `spatial`); reach extends adjacency; theater-of-mind unchanged | positions on `CombatantState` (S03 ck2); `checkReach` (landed, unwired) | CA-G2, CA-G3 | S03/ck2 | planned | prescribed — integration tests, exact assertions in SESSION-03 | movement verb deferred (Design Decision 1) |
| CAP-G3 | `target(burst-N, …)` resolves all combatants in radius around the target; per-target saves, mixed outcomes; theater-of-mind returns the bound target | real `resolveShape` replacing the stub (S03 ck3); geometry `inBurst` (landed) | CA-G4 | S03/ck3 | planned | prescribed — burst integration test with mixed outcomes | — |
| CAP-G4 | `def.valid` clauses evaluate at declare time; `hasTarget(shape)` declaratively gates actions | `evalValidity` (S03 ck3); `PackIndex.validAsts` parse-once (S03 ck3) | CA-G5 | S03/ck3 | planned | prescribed — validity gate tests (in-reach passes, out-of-reach rejects, theater no-op passes) | — |
| CAP-G5 | Spatial fights snapshot/resume: positions round-trip; restored fights re-enforce geometry; fail-closed restore | `serializeCombat`/`deserializeCombat` position write/restore (S03 ck4); contract field already present | CA-G3 | S03/ck4 | planned | prescribed — round-trip + resume-gate test | — |
| CAP-G6 | Generated packs ship spatial: three themes declare the model; generated packs pass stage-8 validation | `ThemeTemplate.spatial` + pipeline pass-through (S04) | CA-G1 | S04/ck2 | planned | prescribed — coverage-floor + pipeline tests | — |
| CAP-G7 | First narrow journey: generate (dark-fantasy, seed) → load → startCombat with positions → adjacency reject → restore-close distance → strike lands → burst spell hits multiple with mixed outcomes → serialize → resume keeps gates | all producers above | CA-G1..G5 | S05/ck2 | planned | prescribed — `tests/proofs/grid-journey.test.ts`, exact assertions in SESSION-05 | — |

**First narrow journey:** CAP-G7 (S05). It crosses the real transport end to end: `generateCampaign` (compiler) → `validatePack` (stage 8) → `new Runtime` (load) → `startCombat` (positions) → `declare` (reach/validity gates, shape resolution, executor) → `serializeCombat` → `deserializeCombat` (resume, gates intact). External providers: none (deterministic library; seeded RNG fixtures are the approved determinism discipline).

## Contract Agreements

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence |
|----|------------------------------|-------------------------------|----------------------|----------------------------------------|-----------|----------|------------------|
| CA-G1 | A pack's spatial declaration is `{model: 'grid', reach: {default ≥1, <label>: ≥1}, shapes? ⊆ {single,burst}}` — mock-verbatim (`spatial.html`), normative in `pack.schema.json` §spatial (v1.3, additive-optional, schemaVersion stays 1) | pack.schema.json (S01) → `Pack.spatial` TS type (S02) → `spatialFromPack` adapter → `SpatialModel` → geometry | Structural violations → E-SCHEMA-01; unshippable geometry (shapes outside v1 set) → E-SPAT-01; absent section → theater-of-mind, zero behavior change | S01 ck1/ck2 defines; S02 ck1 implements; S03 ck1 consumes. Replan 2025-09-27 (REPLAN-GC-01): all session-prompt blocks corrected to this mock-verbatim inline reach anatomy — overrides as siblings of `default`, no `reach.keys` sub-object anywhere; provisional status unchanged. | agreed (provisional against S01 ck1 — recheck mapping against the committed contract before S02 dispatch) | planned | planned (S02 schema tests; S03 ck1 adapter tests) |
| CA-G2 | `E-SPAT-01` is a registered rule id: "pack declares spatial geometry the engine does not ship / spatial gate rejection" — additive to the DB registry and `RULE_IDS` | database.md registry (S01) → `error-card.ts` RULE_IDS (S02) → `SpatialRejection.rule` (S03) → `declare:rejected` payload | Additive-only (compatible minor); no id renamed/retired; resolves v1-core's pending `pendingId` decision verbatim recorded in spatial.ts | S01 ck2 ratifies; S02 ck2 mirrors; S03 ck1 switches pendingId → rule with its own test updated in-lease | agreed | planned | planned (S02 negative tests; S03 rejection-shape tests) |
| CA-G3 | Positions are host-declared, engine-stored, snapshot-round-tripped: `StartCombatRequest.positions?` → `CombatantState.position?` → combat envelope `combatants[].position` (contract field already present) → `CombatRestoreRequest` re-states them. Spatial pack + missing position at start/restore = loud refusal (E-SPAT-01 family, fail-closed, all cards) | host → startCombat (S03 ck2) → state → serializeCombat/deserializeCombat (S03 ck4) | Plain JSON `{x: int, y: int}`; theater-of-mind packs ignore positions; snapshot emits position only when set; restore rebuilds gates against restored positions | S03 ck2/ck4; snap contract: no change needed | agreed (provisional against S03 ck2/ck4) | planned | planned (tests/snapshots/combat.test.ts round-trip + refusal cases) |
| CA-G4 | One shape resolver, three consumers: executor `EffectApply.resolveTargets` (real, replacing combat.ts's bound-target stub), `hasTarget(…)` validity, burst `target()` statements. Semantics: `adjacent` → opponents within actor reach; `burst-N` → all combatants within Chebyshev radius N of the primary target's position; theater-of-mind → bound targets for every shape | combat.ts `resolveShape` (S03 ck3) → resolve.ts `executeAgainst` wiring + core `evalValidity` callback | Bursts are side-blind (mock); mixed outcomes ride save branches (executor-native); no geometry code in packs (FR-11) | S03 ck3 implements + proves | agreed (provisional against S03 ck3) | planned | planned (combat-spatial.test.ts: burst mixed outcomes; theater parity) |
| CA-G5 | `def.valid` is load-checked (existing) AND declare-evaluated (new): parse once into `PackIndex.validAsts` (CA-2), evaluated at declare time before cost spend; falsy → `declare:rejected` kind `valid` (rule `E-REF-01`-adjacent play-time family — final kind naming fixed at S03 ck3, recorded in STATE) | theme/pack `valid` strings (existing data) → Runtime load compile (S03 ck3) → declare() gate → host | `hasTarget(shape)` → resolveShape non-empty; comparators/scalars delegate to `evalFormula`; no parser at play time (CA-2) | S03 ck3 implements; S03 ck3 proves in-reach/out-of-reach/theater triple | agreed (provisional against S03 ck3) | planned | planned |

Provisional rows: Orchestrator re-checks each mapping against the actual producer at its named checkpoint before dispatching dependents (CA-G1 before S02; CA-G3/G4/G5 before S05).

## Current Blockers

None open. Historical bulletins (v1-core, loot-inventory) are closed; their `E-SPAT-01` pending-decision advisories are resolved by this feature's S01/S02 (CA-G2).

## Handoff Notes (Orchestrator writes here after each session — verbatim from Coder)