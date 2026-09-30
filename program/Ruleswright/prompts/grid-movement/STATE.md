# State Tracker — Ruleswright / grid-movement

## Program / Feature / Intent / Sessions

- **Program:** Ruleswright (`program/Ruleswright/`)
- **Feature:** `grid-movement`
- **Intent:** Combatants move on the grid through **pack-declared move actions**, not a new
  engine command. Packs may choose a **hex** grid. Blocking and difficult **terrain** are
  pack-declared, and **opportunity reactions** (reacting when an enemy leaves your reach)
  are pack-declared.
- **Authorization:** this comes from the human's answers on 2026-09-29: "1 B; hex movement;
  yes blocking and difficult terrain defined by pack; reactions — yes — defined by pack".
  That settles the direction. The defaults DD-M2…DD-M13 below were chosen by Planner and
  **confirmed by the human on 2026-09-30 ("confirmed", no edits)**. That answer authorizes
  SESSION-01's Author re-entry (requirements-change, design-change and schema-change
  classes) exactly as written in DD-M1…DD-M13.
- **Plan HEAD:** `02f8196` (clean tree; `pnpm test` 661/661 across 37 files, run by Planner
  2026-09-29).
- **Sessions:** 4. They run serially:
  S01 Author re-entry → S02 schema + core DSL → S03 runtime movement engine →
  S04 content + journey + docs.

## Session Status

| # | Session | Modules | Owns | Status | Checkpoint | Completed | Notes |
|---|---------|---------|------|--------|------------|-----------|-------|
| 01 | Author re-entry: FR-11 movement amendment, spatial/api-map design, contract v1.5 | — (Author: Spec, Designer, DB) | `program/Ruleswright/specs/requirements.md`, `program/Ruleswright/mocks/spatial.html`, `program/Ruleswright/mocks/api-map.html`, `program/Ruleswright/specs/database.md`, `src/schema/contracts/pack.schema.json`, `src/schema/contracts/snapshots.schema.json` | pending (ready — DD-M2..M13 confirmed 2026-09-30) | — | — | Author roles, not Coder |
| 02 | Schema mirror + validator + core `move`/`speed` DSL | M01, M02 | see SESSION-02 | pending | — | — | |
| 03 | Runtime movement engine: hex geometry, terrain, pathing, provoke pause, snapshots | M03 | see SESSION-03 | pending | — | — | first narrow journey at ck2 |
| 04 | Generated content moves: themes, movement journey, README, CI | M04 (+ tests/docs/CI) | see SESSION-04 | pending | — | — | |

## Wave Plan

| Wave | Sessions | Why this shape |
|------|----------|----------------|
| W1 | S01 | Author gate. Every later session mirrors the v1.5 contract and the amended FR-11 text, so nothing runs beside it. |
| W2 | S02 | M01/M02 owns the type mirror (`SpatialDef.model` union, terrain), the validator and the `move` registry entry. S03 constructs against these. |
| W3 | S03 | M03 consumes S02's types and the executor's `apply.move` seam. |
| W4 | S04 | Theme content (wyldwood → hex, `stride`, `opportunist`, terrain kinds) must run on S03's engine. Its journey proves the whole capability. |

**No concurrency is available.** Each wave consumes an artifact the previous one produces
(contract → mirror/registry → engine → content that executes on the engine). S04 was
deliberately *not* run beside S03. Doing so would put a hex wyldwood on the tree while the
runtime still used square-grid geometry. See the next paragraph.

**Recorded coverage window (S02 → S03):** after S02 lands, the validator accepts
`spatial.model: "hex"`. The runtime's `spatialFromPack` still returns square-grid geometry
until S03 ck1. No shipped theme declares hex before S04, so only a hand-built pack could
reach this state. **S03 ck1 closes the window.** It is its first task, and the window is
listed in S03's Context.

## Dependency Graph

```
S01 (Author: FR-11 + spatial.html/api-map.html + contract v1.5)
  └─> S02 (M01 mirror/validator · M02 registry move + speed scalar)
        └─> S03 (M03 geometry/pathing/movement gate/provoke pause/snapshots/barrel)
              └─> S04 (M04 themes · movement journey · README · CI build step)
```

## Architecture Reference (feature-specific)

- **Layering held:** `move` is a core effect statement (M02) that asks the host to move
  through an **optional** `EffectApply.move` callback. The combat layer (M03) owns geometry,
  pathing, occupancy, terrain and provoke. Core stays runtime-ignorant, following the CA-G4
  precedent for `resolveTargets`. M01 still imports no internal values.
- **One shape/geometry authority:** `src/runtime/combat/spatial.ts` gains `hexGeometry`,
  `neighbors`, `findPath`, and a model-dispatching `spatialFromPack`. `combat.ts` consults
  geometry only through `runtime.spatial`.
- **No new module, no new cross-module edge, no new rule id.** `E-SPAT-01` grows its
  documented scope to cover movement rejections.

## Scope Summary

| ID | Module | Change |
|----|--------|--------|
| — | Author | `requirements.md` FR-11 amendment; `spatial.html` movement/hex/terrain/provoke sections; `api-map.html` `declare(actionId, {targetId?, to?})` + `startCombat` `terrain`; `database.md` v1.5; `pack.schema.json` + `snapshots.schema.json` v1.5 |
| M01 | `src/schema/` | `SpatialDef.model: 'grid' \| 'hex'`, `SpatialDef.terrain?`, `TerrainKind`; validator: hex accepted, terrain kinds, `move` placement rule, `speed` reference rule |
| M02 | `src/core/` | registry `move` (13 → 14); `EFFECT_SCALARS` + `speed`; executor `move` → `apply.move?`; checker: root-only, dice-free |
| M03 | `src/runtime/` | hex geometry, neighbors, pathing, movement gate, `declare({to})`, `startCombat({terrain})`, provoke pause/resume, `move:*` events, `CombatantProfile.speed`, snapshot `pendingMove`, `displayRoll` leaf, barrel |
| M04 | `src/compiler/themes/*.json` | `formulas.speed`, `stride` (move), `opportunist` (reaction), `spatial.terrain`; wyldwood → `hex` |
| — | tests/docs/CI | `tests/proofs/movement-journey.test.ts`; README "Grid combat" movement text; ci.yml `pnpm build` before `pnpm test` |

**Inherited findings, with dispositions** (sources inspected:
`prompts/grid-combat/{STATE,FINAL-REPORT}.md` and
`prompts/equipment-consumables/FINAL-REPORT.md` follow-up closure ledger at `02f8196`;
`ARCHIVIST-LOG.md` header entries; `program/Ruleswright/STATE.md` is empty apart from its
header; `.program/` holds no ledger or blockers file in the tree):

| Finding | Source | Disposition |
|---------|--------|-------------|
| Move verb open question | grid-combat DD1 / S05 followUp (b) | **Resolved by this feature.** The human chose Option B (movement as pack data). The restore-with-updated-positions seam stays valid. |
| Spells not combat-declarable (burst bridge) | grid-combat DD17a / S05 followUp (a) | **Carried** (unchanged; engine design event). Not needed here: movement is an action, not a spell. |
| `displayRoll` duplicate `rollText` in `equipment.ts` | equipment-consumables S03/S05/S06 | **Assigned: S03 ck5** (move `displayRoll` into the leaf `src/runtime/display-roll.ts`; the barrel export is kept). |
| CI `test` job lacks `pnpm build` (loot/equipment journeys read `dist/`) | equipment-consumables S06 followUp | **Assigned: S04 ck3** (ci.yml). |
| `evalPackFormula` parse-once debt | grid-combat DD10 | **Carried.** S03 adds one more `evalPackFormula` call (for `speed`) using the same idiom, with zero behavior change. The debt grows by one call site, which is recorded. |
| Per-target save modifiers | grid-combat S03 | **Carried** (not touched). |
| Browser determinism CI leg | Custom Rule 5 | **Carried** (tracked v1.1). |
| `useItem` condition duration display; restricts-matcher public API; item tags; med-kit vigor; wyldwood charm armor | equipment-consumables ledger | **Carried** (none is touched by movement). |
| **F-M1 (new):** theme feat triggers written `condition:applied[self]` never match the `eventMatches` grammar (`[key=value]`). Feat triggers are also never registered by `reactiveActionsFor` (actions only). | Planner source read: `triggers.ts:37-46`, `dark-fantasy.json:170` | **Carried** (out of scope; no movement behavior depends on it). Owner: planning for the next feature that touches triggers. The new `opportunist` content uses the working `[target=self]` form. |
| **F-M2 (new):** `gridGeometry.canReach` compares against `max(reach, model.defaultReach)`, so a per-id override **smaller** than the default never applies | `spatial.ts:57-58` | **Preserved** (DD-M14). The hex geometry mirrors it, and the provoke check reuses the same `canReach`. Carried as a separate decision. |

## Design Decisions

DD-M1 was stated by the human. **DD-M2…DD-M13 were Planner defaults, confirmed unchanged by
the human on 2026-09-30.** S01 writes them into the Author artifacts. If S01's
Author roles or the human change one, the matching CA row and the affected session
prompts are amended before S02 dispatch.

1. **DD-M1: movement is pack data** (human, Option B). The engine adds one effect statement
   `move(<formula>)` and a movement gate. There is no new combat verb. A move is
   `fight.declare(actionId, { to: {x, y} })`. The api-map already pins
   `declare(actionId, targetRef)` and treats signatures as illustrative, so `to` is a
   declare option.
2. **DD-M2: hex is additive.** `spatial.model` becomes `"grid" | "hex"`. `grid` keeps its
   square/Chebyshev meaning, so every existing pack and verified journey is unchanged. Hex
   positions reuse `{x, y}` as **axial `{q, r}`** (no snapshot shape change). Hex distance
   is `(|dq| + |dr| + |dq + dr|) / 2`. The neighbor order is fixed:
   `(+1,0), (+1,−1), (0,−1), (−1,0), (−1,+1), (0,+1)`. Reach, `adjacent` and burst all use
   hex distance on a hex pack.
3. **DD-M3: sample themes.** **wyldwood switches to `hex`.** dark-fantasy and zombie-urban
   stay `grid`. This way both geometries are dogfooded and grid-combat's verified
   dark-fantasy journey is not re-keyed. *(Human may prefer all themes hex; that is a
   one-line theme change per file in S04, plus re-keyed grid-journey dark-fantasy
   assertions.)*
4. **DD-M4: square movement** uses 8 neighbors. A diagonal step costs 1, the same as the
   existing Chebyshev distance.
5. **DD-M5: terrain.** The pack declares the terrain *vocabulary* in
   `spatial.terrain: { <kind-id>: { cost: int ≥ 1 } | { blocks: true } }`.
   The host places cells per fight: `startCombat({ …, terrain: [{ at: {x,y}, kind }] })`.
   The engine never invents a map (the same discipline as positions). Entering a cell of
   kind `k` costs `terrain[k].cost` (plain cells cost 1). A `blocks` cell can never be
   entered. startCombat refuses (`E-SPAT-01` aggregate, nothing built) when a kind is
   unknown, a cell is placed twice, or a combatant starts on a blocking cell. Terrain given to a pack with
   no spatial section rides along and is never consulted. This matches the documented
   theater-of-mind treatment of positions (README "Grid combat").
6. **DD-M6: occupancy (engine rule, documented).** A move cannot end on a cell held by a
   standing combatant. It may pass through standing allies but not standing enemies.
   Downed combatants (hp ≤ 0) never block.
7. **DD-M7: speed.** `formulas.speed` is an optional **reserved formula id**, evaluated like
   `initiative` into `CombatantProfile.speed` for characters and statblocks. `speed` is an
   engine-derived effect scalar (added to `EFFECT_SCALARS`). As with `hp`/`ac`, it shadows
   a same-named ability inside effect vars. An effect that references `speed` in a pack
   with no `formulas.speed` → `E-REF-01` at load.
8. **DD-M8: `move(formula)` placement.** Registry 13 → 14. It is legal **only as the root
   statement** of a **non-triggered `actions.<id>.effect`**. Nested inside
   sequence/target/save, or used in spells, feats, items' `use`, or triggered actions →
   `E-FORM-02`. The argument must be **dice-free**, because the budget is evaluated at
   declare time, before cost, and must not consume RNG → `E-FORM-02`.
9. **DD-M9: pathing.** The engine computes the cheapest legal path. It uses Dijkstra with
   the fixed neighbor order as the tie-break, so it is deterministic. Each declare is one
   move up to the budget. Unspent budget is lost. Rejections are `declare:rejected`, rule
   `E-SPAT-01`, with no state, RNG or ledger change. Kinds: `no-destination` (move action
   without `to`); `blocked` (destination is a blocking cell); `occupied` (a standing
   combatant is there); `unreachable` (no legal path); `out-of-range` (cheapest path cost >
   budget). The movement gate runs where the reach gate runs, before cost. A move action
   targets its actor (no opponent resolution, no reach gate).
10. **DD-M10: provoke.**
    - **Trigger:** before each step, if the mover's current cell is within reach of a
      standing opposing combatant and the next cell is not, the engine emits
      **`move:leaving-reach`** (actor = mover, target = threatener, payload `{at, next}`).
      Packs react with `trigger.on: "move:leaving-reach[target=self]"`.
    - **Pause:** if ≥ 1 offer surfaces, the move **pauses** at the current cell, and the
      mover's state carries `pendingMove {actionId, to, remaining}`.
    - **Resume:** when the offer queue empties (every offer answered by `respond`, take or
      decline), the move resumes automatically. On resume:
      - mover downed → end, reason `downed`;
      - an active condition now restricts the action's tags → end, reason `restricted`;
      - otherwise re-plan from the current cell with `remaining` budget; no path → end,
        reason `blocked`.
    - **Forfeit:** `step()` while paused forfeits the move (reason `forfeited`) before its
      usual effect.
    - **Events:** `move:advanced {from, to, path, cost, remaining}` per contiguous segment,
      and `move:ended {reason: arrived|downed|restricted|blocked|forfeited, at}`.
    - Packs without matching reactions never pause.
11. **DD-M11: theater of mind.** In a pack without `spatial`, a move action resolves as a
    no-op success. `to` is ignored, and nothing is emitted beyond `action:resolved`. Such a
    pack's move content still loads (the grid-journey `stripSpatial` parity leg depends on
    it). Terrain passed to such a pack rides along unconsulted, like positions.
12. **DD-M12: snapshots.** The combat envelope's combatant item gains optional
    **`pendingMove {actionId, to:{x,y}, remaining}`**. Positions and terrain keep the
    CAP-G5 discipline: the host re-states them on restore (`CombatRestoreRequest.terrain?`
    mirrors `startCombat`). Restore precedence is unchanged. A `pendingMove` naming an
    unknown action or a non-move action → `E-SNAP-01`. No new rule id.
13. **DD-M13: `respond` default target unchanged.** To take an opportunity reaction with
    several opponents, the host passes the mover as `targetId`. `respond` keeps its current
    target resolution (no default-to-event-actor), so existing trigger behavior is
    unchanged.
14. **DD-M14: reach semantics preserved** (F-M2). Hex `canReach` mirrors grid's
    `≤ max(reach, defaultReach)`. It is not fixed here.
15. **DD-M15: carried items folded in.** `displayRoll` leaf → S03 ck5. CI build step → S04
    ck3. Nothing else is folded.
16. **DD-M16: Author artifacts** are revised by S01, run by the Author roles (Spec →
    Designer → DB). This follows the precedent of grid-combat S01 and equipment-consumables
    S01, where a DB author re-entry was a planned session. S01 is the only lease that ever
    names `specs/`, `mocks/` or `contracts/`. No Coder session names them.
17. **DD-M17: serial plan** (see Wave Plan). Four sessions are enough. S02/S03 are split at
    the M02 → M03 boundary because of context size (validator + DSL + a 1015-line
    `combat.ts` + 744-line `snapshots.ts` is too much for one working set). That split is
    forced, not principled.

## Verification Baseline

| Item | Effective command / config | Evidence | Notes / owner |
|------|---------------------------|----------|---------------|
| Whole suite | `pnpm test` → `vitest run` (include `tests/**`) | **actual:** 661/661, 37 files, 2.0 s at `02f8196` (Planner, 2026-09-29) | New files expected: S03 `tests/runtime/combat/movement.test.ts`, `tests/runtime/combat/movement-geometry.test.ts`; S04 `tests/proofs/movement-journey.test.ts` |
| Narrow gate | `pnpm exec vitest run <path>` | inherited (DD14e) | `pnpm test -- <pattern>` does NOT filter; `npx vitest` fails here |
| typecheck / lint / format:check | `pnpm typecheck` · `pnpm lint` · `pnpm format:check` | inherited green at `02f8196` (equipment-consumables final); not re-run by Planner | Whole-repo fast gates at every receive (promoted convention) |
| build / isolation / security | `pnpm build` · `pnpm check:isolation` · `pnpm check:security` | inherited green at `02f8196` | S03 must keep runtime free of compiler strings |
| Journeys needing `dist/` | `tests/proofs/{loot,equipment}-journey.test.ts` read `dist/` | **hazard:** CI `test` job never builds | S04 ck3 adds `pnpm build` before `pnpm test` in ci.yml. Locally, run `pnpm build` before the whole suite |
| Pins touched by this feature | `docs-run.test.ts:49` (4 ```ts blocks); `docs-run.test.ts:195` (warden action list); `character-profile.test.ts:215-217` (action list); `grid-journey.test.ts:223` (wyldwood `model:'grid'`); `pipeline.test.ts:428-432` and `coverage-floor.test.ts:166-173` (every theme `model 'grid'`); `effect.test.ts:355` (EFFECT_SCALARS list); `registry.test.ts`/`validate.test.ts` RULE_IDS 15 (**unchanged**: no new id) | source-read by Planner | **Re-key owners:** S02 owns `effect.test.ts`; S04 owns docs-run, character-profile, grid-journey, pipeline and coverage-floor re-keys. README edits in S04 must add **no** ```ts block. |
| CI proofs job | `pnpm exec vitest run tests/proofs/` (package job, after build) | inherited | The new movement journey is discovered automatically |

## Capability Readiness

| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|----|--------------------------------|---------------------------------|------------------------|--------------------------------|--------|-------------------------|-------------------------------|
| CAP-M1 | A pack may declare `spatial.model: "hex"`; reach, `adjacent` and burst use hex distance | model value (S01 contract; S02 mirror + validator); geometry (S03 ck1) | CA-M1 | S03/ck1 (unit); S04/ck2 (generated wyldwood) | planned | — | coverage window S02→S03 (closed by S03 ck1) |
| CAP-M2 | **First narrow journey:** `declare(moveAction, {to})` moves the actor along the cheapest legal path within `speed`; the position survives serialize/restore; rejections change nothing | speed (S01 → S02 scalar → S03 profile); move statement (S02); path/gate (S03 ck2) | CA-M2, CA-M3 | S03/ck2 | planned | — | — |
| CAP-M3 | Pack-declared blocking and difficult terrain, placed by the host per fight | terrain vocabulary (S01/S02); placement + costs (S03 ck1/ck2) | CA-M1, CA-M3 | S03/ck2 | planned | — | — |
| CAP-M4 | Pack-declared opportunity reactions fire when a mover leaves reach; the move pauses and resumes | provoke event + pause (S03 ck3); reaction content (S04 ck1) | CA-M4 | S03/ck3 (fixture pack); S04/ck2 (generated) | planned | — | — |
| CAP-M5 | A mid-move pause snapshots and resumes losslessly | `pendingMove` contract (S01); serializer/restore (S03 ck4) | CA-M5 | S03/ck4 | planned | — | — |
| CAP-M6 | Generated themes can move: `speed`, `stride`, `opportunist`, terrain kinds; wyldwood hex | theme content (S04 ck1) | CA-M6 | S04/ck2 | planned | — | — |
| CAP-M7 | Theater-of-mind packs pay nothing: move content loads and moves are no-op successes | S02 validator (no spatial requirement); S03 no-op branch | CA-M7 | S03/ck2 (unit); S04/ck2 (wyldwood minus spatial) | planned | — | — |

**Production path, for every CAP:** `generateCampaign` (or a validated fixture pack) →
`new Runtime(pack)` (stage-8 `validatePack` + `checkPackDsl`) → `profileFromCharacter` /
`spawnMonster` (profiles carry `speed`) → `startCombat({allies, enemies, positions,
terrain})` → `fight.step()` → `fight.declare('stride', {to})` → movement gate → `spend` →
`executeAgainst` → `move` statement → `apply.move` → path walk with `move:*` events →
`surfaceOffers` → `fight.respond(...)` → resume → `serializeCombat` →
`deserializeCombat(..., {positions, terrain})`. This library has no durable storage beyond
the snapshot envelope. "Restart" = serialize → JSON → restore.

## Contract Agreements

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|----|------------------------------|--------------------------------|-----------------------|----------------------------------------|-----------|----------|------------------------------------|
| CA-M1 | Spatial model vocabulary: `grid` = square/Chebyshev (unchanged); `hex` = axial `{x:q, y:r}`, hex distance; `terrain` kinds `{cost ≥ 1}` xor `{blocks: true}` | `pack.schema.json $defs/spatial` (S01) → `SpatialDef` + `checkSpatial` (S02) → `spatialFromPack`/`hexGeometry` (S03) → theme JSON (S04) | `model` enum `["grid","hex"]` (was const); `terrain` optional; kind ids kebab; exactly one of `cost`/`blocks`; unknown model → `E-SPAT-01` (unchanged mapping); malformed terrain → `E-SCHEMA-01` | S01 ck3 · S02 ck1 · S03 ck1 · S04 ck1 | agreed (DD-M2/M5 confirmed 2026-09-30) | planned | planned: S02 validate tests; S03 `movement-geometry.test.ts` |
| CA-M2 | `move(formula)`: root-only, dice-free, non-triggered action effects only; `speed` reserved formula + effect scalar | `database.md §formulas` + registry doc (S01) → `REGISTRY.move`, `EFFECT_SCALARS`, `checkEffect`, executor (S02) → `executeAgainst` vars + `apply.move` + `CombatantProfile.speed` (S03) | registry 13 → 14; misuse → `E-FORM-02`; `speed` referenced without `formulas.speed` → `E-REF-01`; executor without `apply.move` throws (fail-closed) | S01 ck3 · S02 ck2 · S03 ck2 | agreed (DD-M7/M8 confirmed 2026-09-30) | planned | planned: S02 effect/checker/validate tests; S03 movement test |
| CA-M3 | Move declare semantics: `DeclareOptions.to`; terrain placement; path legality; rejection kinds with no change | `spatial.html` + `api-map.html` (S01) → `Combat.declare` movement gate + `startCombat` terrain (S03) → journey (S04) | kinds `no-destination` / `blocked` / `occupied` / `unreachable` / `out-of-range`, all rule `E-SPAT-01`; no state/rng/ledger change (compare `serialize()` before and after); startCombat terrain refusals aggregate | S01 ck2 · S03 ck2 · S04 ck2 | agreed (DD-M5/M6/M9 confirmed 2026-09-30) | planned | planned |
| CA-M4 | Provoke: `move:leaving-reach` (actor mover, target threatener); pause iff offers; resume on empty queue; resume re-checks; forfeit on `step()`; `move:advanced` / `move:ended` | `spatial.html` provoke section (S01) → `combat.ts` walk + `respond` + `step` (S03) → `opportunist` content (S04) | pattern `move:leaving-reach[target=self]` matches through the existing `eventMatches` (no grammar change); reasons are the closed set in DD-M10 | S01 ck2 · S03 ck3 · S04 ck1/ck2 | agreed (DD-M10 confirmed 2026-09-30) | planned | planned |
| CA-M5 | Snapshot: combatant `pendingMove?` round-trips; positions and terrain re-stated by the host | `snapshots.schema.json` (S01) → `serializeCombat` / `deserializeCombat` / `CombatRestoreRequest.terrain` (S03) | serialize only when set; restore refuses an unknown or non-move `actionId` → `E-SNAP-01`; spatial restore gate (CAP-G5) unchanged | S01 ck3 · S03 ck4 | agreed (DD-M12 confirmed 2026-09-30) | planned | planned: `tests/snapshots/combat.test.ts` round-trip mid-pause |
| CA-M6 | Theme content: `formulas.speed`, `stride` (tag `move`, `move` slot, `move(speed)`), `opportunist` (reaction slot, `move:leaving-reach[target=self]`, attack), terrain kinds; wyldwood `hex` | theme JSON (S04) → pipeline pass-through (existing) → `validatePack` (S02) → runtime (S03) | `rooted` already restricts `actions.tagged:move`, so it applies to `stride` without new code | S04 ck1/ck2 | agreed (DD-M3 confirmed 2026-09-30) | planned | planned: coverage-floor + movement journey |
| CA-M7 | Theater of mind: move no-op success; move content loads without `spatial`; terrain rides along unconsulted, like positions | S01 text → S02 (no spatial requirement on `move`) → S03 no-op branch | no positions and no `move:*` events in theater packs | S02 ck2 · S03 ck2 · S04 ck2 | agreed (DD-M11 confirmed 2026-09-30) | planned | planned |

**Provisional:** every CA's producer is built inside this feature. All rows are provisional
against their named producer checkpoints. **Orchestrator re-checks each mapping against
the landed producer before dispatching the dependent session:**
- CA-M1/M2 against S01's committed contract before S02;
- CA-M1/M2 against S02's committed types before S03;
- CA-M3/M4/M5 against S03 before S04.

Dependents are dispatched against the amended CA text, not the planned text.

## Current Blockers

| ID | Affects | Next action | Owner | Evidence to clear |
|----|---------|-------------|-------|-------------------|
| — | — | None open. B-M1 (human confirmation of DD-M2…DD-M13) **cleared 2026-09-30**: the human answered "confirmed" with no edits. | — | Recorded in Program/Authorization and Design Decisions |

## Handoff Notes

<!-- Orchestrator appends Coder/Author handoffs here verbatim. Do not pre-fill. -->
