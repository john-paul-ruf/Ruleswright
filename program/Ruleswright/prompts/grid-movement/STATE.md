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
- **Orchestrator auto-decisions (2026-09-30, `.program/decisions.md` grid-movement
  preflight rows):** F-P1, F-P2 (derived phase), F-P4, F-P10a/b and F-P11 amend DD-M10 and
  DD-M12 *within* the approved DD-M1…M13 meaning. No schema scope changed. They were
  applied by REPLAN-GM-01 (see "Planning completeness review (2026-09-30)").
- **Plan HEAD:** `02f8196` (clean tree; `pnpm test` 661/661 across 37 files, run by Planner
  2026-09-29). **Replan HEAD:** `67f383b` (REPLAN-GM-01; Orchestrator re-ran all gates at
  `67f383b`: 661/661).
- **Sessions:** 4. They run serially:
  S01 Author re-entry → S02 schema + core DSL → S03 runtime movement engine →
  S04 content + journey + docs.

## Session Status

| # | Session | Modules | Owns | Status | Checkpoint | Completed | Notes |
|---|---------|---------|------|--------|------------|-----------|-------|
| 01 | Author re-entry: FR-11 movement amendment, spatial/api-map design, contract v1.5 | — (Author: Spec, Designer, DB) | `program/Ruleswright/specs/requirements.md`, `program/Ruleswright/mocks/spatial.html`, `program/Ruleswright/mocks/api-map.html`, `program/Ruleswright/specs/database.md`, `src/schema/contracts/pack.schema.json`, `src/schema/contracts/snapshots.schema.json` | **done** | 3/3 (9bc89f6, 5209311, a134054) | 2026-09-30 | Author roles, not Coder. No DD deltas; receive gates green 661/661 |
| 02 | Schema mirror + validator + core `move`/`speed` DSL | M01, M02 | `src/schema/pack.ts`, `src/schema/validate/sections/root.ts`, `src/schema/validate/sections/cross.ts`, `src/schema/validate/index.ts`, `src/core/dsl/registry.ts`, `src/core/dsl/effect.ts`, `tests/schema/validate.test.ts`, `tests/core/dsl/effect.test.ts`, `tests/core/dsl/checker.test.ts` | **done** | 3/3 (21a0a5f, a2b4db3, 5d76126, corr 933c2fd) | 2026-09-30 | Receive gates green 689/689 (37 files); arch 08a831b |
| 03 | Runtime movement engine: hex geometry, terrain, pathing, provoke pause, snapshots | M03 | `src/runtime/combat/spatial.ts`, `src/runtime/combat/combat.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/character-profile.ts`, `src/runtime/snapshots.ts`, `src/runtime/equipment.ts`, `src/runtime/display-roll.ts`, `src/runtime/index.ts`, `tests/runtime/combat/movement-geometry.test.ts`, `tests/runtime/combat/movement.test.ts`, `tests/runtime/fixtures/packs.ts`, `tests/snapshots/combat.test.ts` | **done** | 5/5 (ea4e308, e5546bb, 3af4127, dd88f0c, 27c77f4) | 2026-09-30 | Receive gates green 729/729 (39 files); arch e354139 |
| 04 | Generated content moves: themes, movement journey, README, CI | M04 (+ tests/docs/CI) | `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `tests/compiler/coverage-floor.test.ts`, `tests/compiler/pipeline.test.ts`, `tests/proofs/grid-journey.test.ts`, `tests/proofs/docs-run.test.ts`, `tests/runtime/combat/character-profile.test.ts`, `tests/proofs/movement-journey.test.ts`, `README.md`, `.github/workflows/ci.yml` | **done** | 3/3 (40c4492, da9bf03, c23d563) | 2026-09-30 | Receive gates green 741/741 (40 files); proofs 47/47 |

The leases are pairwise disjoint (checked path by path by REPLAN-GM-01). REPLAN-GM-01 did
not widen any lease. Every new task and every pin it assigned falls inside an existing lease
(see Verification Baseline → Pins).

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

**Recorded pin window (S03 → S04), `character-profile.test.ts:309-329`:** S03 adds
`speed` to profiles *only when `formulas.speed` is declared*, so this whole-profile pin
stays green at S03 (no shipped theme declares `speed` yet). S04 ck1 adds
`formulas.speed` to every theme and re-keys the pin in the same checkpoint. **S04 closes
it** (the file is in S04's lease).

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
- **Where the executor callbacks are built:** the `apply` object (`resolveTargets`,
  `damage`, `condition`, and the new `move`) is built in `resolve.ts` `executeAgainst`
  (`:332`, `apply` at `:350-365`). `combat.ts` `execute` (`:752`, sink/shape callbacks at
  `:768-797`) supplies the mutation sink and the shape callback, and will supply the
  move callback.
- **Offer surfacing becomes per-call (F-P1, DD-M10):** `resolve()` still *returns* the
  round window (`combat.ts:743`, unchanged public behavior of `declare`/`respond`'s return
  value). But `surfaceOffers` is fed only the events the current call emitted, collected
  with a per-call sink (the `execute()` idiom, `combat.ts:758-763`). **Arch delta:** the
  `arch/v1-core.md:163` record notes the round-window return but not this change. S03
  writes the delta into its arch fragment; Orchestrator folds it in.
- **No new module, no new cross-module edge, no new rule id.** `E-SPAT-01` grows its
  documented scope to cover movement rejections.

## Scope Summary

| ID | Module | Change |
|----|--------|--------|
| — | Author | `requirements.md` FR-11 amendment; `spatial.html` movement/hex/terrain/provoke sections; `api-map.html` `declare(actionId, {targetId?, to?})` + `startCombat` `terrain`; `database.md` v1.5 (with the `speed` compatibility note); `pack.schema.json` + `snapshots.schema.json` v1.5 |
| M01 | `src/schema/` | `SpatialDef.model: 'grid' \| 'hex'`, `SpatialDef.terrain?`, `TerrainKind`; validator: hex accepted, terrain kinds, `move` placement rule, `speed` reference rule (formula-position tokens only) |
| M02 | `src/core/` | registry `move` (13 → 14); `EFFECT_SCALARS` + `speed`; executor `move` → `apply.move?`; `checkEffectAst`: root-only, dice-free (`checker.ts` unchanged — F-P8) |
| M03 | `src/runtime/` | hex geometry, neighbors, pathing (region-bounded exact search), movement gate, `declare({to})`, `startCombat({terrain})`, restore terrain (ck2), provoke pause/resume, per-call offer surfacing, `move:*` events, `CombatantProfile.speed`, out-of-combat `useItem` binds `speed`, snapshot `pendingMove` + derived restore phase + restored offer `on` = event type, `displayRoll` leaf, barrel |
| M04 | `src/compiler/themes/*.json` | `formulas.speed`, move action, reaction (on every class **and every statblock**), `spatial.terrain`; wyldwood → `hex` |
| — | tests/docs/CI | `tests/proofs/movement-journey.test.ts`; README "Grid combat" movement text; ci.yml `pnpm build` before `pnpm test` |

**Inherited findings, with dispositions** (sources inspected:
`prompts/grid-combat/{STATE,FINAL-REPORT}.md` and
`prompts/equipment-consumables/FINAL-REPORT.md` follow-up closure ledger at `02f8196`;
`ARCHIVIST-LOG.md` header entries; `program/Ruleswright/STATE.md` is empty apart from its
header; `.program/` holds no ledger or blockers file in the tree). The planning-completeness
review findings F-P1…F-P12 have their own section below.

| Finding | Source | Disposition |
|---------|--------|-------------|
| Move verb open question | grid-combat DD1 / S05 followUp (b) | **Resolved by this feature.** The human chose Option B (movement as pack data). The restore-with-updated-positions seam stays valid. |
| Spells not combat-declarable (burst bridge) | grid-combat DD17a / S05 followUp (a) | **Carried** (unchanged; engine design event). Not needed here: movement is an action, not a spell. |
| `displayRoll` duplicate `rollText` in `equipment.ts` | equipment-consumables S03/S05/S06 | **Assigned: S03 ck5** (move `displayRoll` (`combat.ts:1002`) into the leaf `src/runtime/display-roll.ts`; `rollText` is `equipment.ts:352`; the barrel export at `index.ts:77` is kept). |
| CI `test` job lacks `pnpm build` (loot/equipment journeys read `dist/`) | equipment-consumables S06 followUp | **Assigned: S04 ck3** (ci.yml). |
| `evalPackFormula` parse-once debt | grid-combat DD10 | **Carried.** S03 adds one more `evalPackFormula` call (for `speed`) using the same idiom, with zero behavior change. The debt grows by one call site, which is recorded. |
| Per-target save modifiers | grid-combat S03 | **Carried** (not touched). |
| Browser determinism CI leg | Custom Rule 5 | **Carried** (tracked v1.1). |
| `useItem` condition duration display; restricts-matcher public API; item tags; med-kit vigor; wyldwood charm armor | equipment-consumables ledger | **Carried** (none is touched by movement). |
| **F-M1 (new):** theme feat triggers written `condition:applied[self]` never match the `eventMatches` grammar (`[key=value]`). Feat triggers are also never registered by `reactiveActionsFor` (actions only). | Planner source read: `triggers.ts:31-41` (`eventMatches`), `triggers.ts:44-54` (`reactiveActionsFor`), `dark-fantasy.json:170` | **Carried** (out of scope; no movement behavior depends on it). Owner: planning for the next feature that touches triggers. The new reaction content uses the working `[target=self]` form. |
| **F-M2 (new):** `gridGeometry.canReach` compares against `max(reach, model.defaultReach)`, so a per-id override **smaller** than the default never applies | `spatial.ts:60-61` | **Preserved** (DD-M14). The hex geometry mirrors it, and the provoke check reuses the same `canReach`. Carried as a separate decision. |

## Design Decisions

DD-M1 was stated by the human. **DD-M2…DD-M13 were Planner defaults, confirmed unchanged by
the human on 2026-09-30.** DD-M10 and DD-M12 were then amended by Orchestrator
auto-decisions (2026-09-30), which refine behavior the confirmed text leaves undefined or
contradicts in source. They do not change product direction. Each amendment is marked
**[F-P…]**. S01 writes the amended text into the Author artifacts. If S01's Author roles or
the human change one, the matching CA row and the affected session prompts are amended
before S02 dispatch.

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
   dark-fantasy journey is not re-keyed beyond its `spatial` pins (terrain added, F-P6a).
   *(Human may prefer all themes hex; that is a one-line theme change per file in S04,
   plus re-keyed grid-journey dark-fantasy assertions.)*
4. **DD-M4: square movement** uses 8 neighbors. A diagonal step costs 1, the same as the
   existing Chebyshev distance.
5. **DD-M5: terrain.** The pack declares the terrain *vocabulary* in
   `spatial.terrain: { <kind-id>: { cost: int ≥ 1 } | { blocks: true } }`.
   The host places cells per fight: `startCombat({ …, terrain: [{ at: {x,y}, kind }] })`.
   The engine never invents a map (the same discipline as positions). Entering a cell of
   kind `k` costs `terrain[k].cost` (plain cells cost 1). A `blocks` cell can never be
   entered. startCombat refuses (`E-SPAT-01` aggregate, nothing built) when a kind is
   unknown, a cell is placed twice, or a combatant starts on a blocking cell. Terrain given
   to a pack with no spatial section rides along and is never consulted. This matches the
   documented theater-of-mind treatment of positions (README "Grid combat").
6. **DD-M6: occupancy (engine rule, documented).** A move cannot end on a cell held by a
   standing combatant. **This includes the mover itself** [F-P10a]. It may pass through
   standing allies but not standing enemies. Downed combatants (hp ≤ 0) never block.
7. **DD-M7: speed.** `formulas.speed` is an optional **reserved formula id**, evaluated like
   `initiative` into `CombatantProfile.speed` for characters and statblocks. The profile
   carries `speed` **only when `formulas.speed` is declared**; it is omitted otherwise
   [F-P6b]. `speed` is an engine-derived effect scalar (added to `EFFECT_SCALARS`). As with
   `hp`/`ac`, it shadows a same-named ability inside effect vars. In combat it binds to
   `profile.speed ?? 0`. **Out of combat, `useItem` binds it too**, through
   `scopedFormula(runtime, 'speed', scope)` when `formulas.speed` is declared, otherwise
   `0` [F-P5]. An effect that references `speed` **at a formula position** in a pack with
   no `formulas.speed` → `E-REF-01` at load. A token `speed` at a non-formula position
   (a damage type, a condition id, a shape, a save name) is not a reference [F-P11].
   **Compatibility [F-P11]:** a pack that uses a token `speed` at a formula position in an
   effect without declaring `formulas.speed` loaded before v1.5 (for example, through an
   ability named `speed`) and now fails `E-REF-01`. No shipped theme is affected. The
   v1.5 row therefore does not claim to be "purely additive" without this caveat.
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
   combatant is there, **including the mover itself** [F-P10a]); `unreachable` (no legal
   path exists at any cost); `out-of-range` (a legal path exists, but its cheapest cost >
   budget). **A reachable destination is never reported `unreachable`, whatever its
   cost** [F-P9]. The movement gate runs where the reach gate runs, before cost. A move
   action targets its actor (no opponent resolution, no reach gate).
10. **DD-M10: provoke.**
    - **Trigger:** before each step, if the mover's current cell is within reach of a
      standing opposing combatant and the next cell is not, the engine emits
      **`move:leaving-reach`** (actor = mover, target = threatener, payload `{at, next}`).
      Packs react with `trigger.on: "move:leaving-reach[target=self]"`.
    - **Offers are per call [F-P1]:** a call (`declare`, `respond`, `use`) offers
      reactions only for the events *that call* emitted, collected with a per-call sink
      (the `execute()` idiom). It never replays the round window. Each matching
      (reactor, event) pair is offered **exactly once**. After the only offer is taken or
      declined, `pendingTriggers` is `[]`. There is exactly one `trigger:fired` per matching
      event and at most one `trigger:declined` per offer. The *return value* of
      `declare`/`respond` is unchanged (it is still the round window from `resolve()`).
    - **Pause:** if ≥ 1 offer surfaces, the move **pauses** at the current cell, and the
      mover's state carries `pendingMove {actionId, to, remaining}`.
    - **Offers are not filtered by affordability [F-P10b]:** existing trigger semantics are
      kept (`triggers.ts:62-81` `offersForEvent` checks no cost). A threatener whose
      reaction slot is already spent still gets an offer, and the offer still pauses the
      move. The host answers it:
      - `respond(id, 'decline')` removes the offer and emits one `trigger:declined`
        (`combat.ts:547-556`);
      - `respond(id, 'take', moverId)` removes the offer first (`combat.ts:551`). Then
        `resolveReactive` (`:850-877`) refuses at `spend` (`action-economy.ts:166-191`;
        `checkCost` passes, because it compares against the *grant*, not what remains).
        The result is exactly one `declare:rejected {kind: 'slot-exhausted',
        resource: 'reaction'}`, rule `E-ECON-01`. No slot, pool, hp or RNG changes, and no
        `trigger:declined` is emitted.

      Both answers count as answered: the offer has left the queue.
    - **Resume:** when the offer queue empties (every offer answered by `respond`, take or
      decline, including a refused take), the move resumes automatically. On resume:
      - mover downed → end, reason `downed`;
      - an active condition now restricts the action's tags → end, reason `restricted`;
      - otherwise re-plan from the current cell with `remaining` budget; no path → end,
        reason `blocked`.
    - **Forfeit:** `step()` while paused forfeits the move (reason `forfeited`) before its
      usual effect.
    - **Own cell [F-P10a]:** a declare whose `to` is the mover's own cell is rejected as
      `E-SPAT-01` kind `occupied` (DD-M6). There is no new kind, no slot is spent, and
      nothing changes.
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
    mirrors `startCombat`, with the same refusals). Restore precedence is unchanged. A
    `pendingMove` naming an unknown action or a non-move action → `E-SNAP-01`. No new rule
    id.
    - **Derived restore phase [F-P2]:** the envelope carries no phase, and none is added.
      Restore sets the phase to **`resolved`** when any restored combatant carries
      `pendingMove` or `pendingTrigger`. Otherwise it keeps today's rule
      (`awaiting-declare`, or `combat-over` when a side is defeated; `snapshots.ts:554`).
      A restored paused fight's `step()` therefore forfeits the move and ends the turn,
      exactly as the uninterrupted fight does.
    - **Restored offer `on` [F-P2]:** a restored offer's `matchingEvent` is the live
      **event type**: the trigger pattern's base before `[` (the `eventMatches` base,
      `triggers.ts:32-34`). Live offers store `event.type` (`triggers.ts:75`). This fixes
      the pattern-string divergence at `snapshots.ts:565`.
    - Schema scope is unchanged by these two points (description text only).
13. **DD-M13: `respond` default target unchanged.** To take an opportunity reaction with
    several opponents, the host passes the mover as `targetId`. `respond` keeps its current
    target resolution (no default-to-event-actor), so existing trigger behavior is
    unchanged.
14. **DD-M14: reach semantics preserved** (F-M2). Hex `canReach` mirrors grid's
    `≤ max(reach, defaultReach)` (`spatial.ts:60-61`). It is not fixed here.
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
18. **DD-M18 (REPLAN-GM-01): path search is region-bounded and exact [F-P9].** `findPath`
    runs Dijkstra *without* a cost cutoff over a finite region. The region is the
    axis-aligned `(x, y)` bounding box of `from`, `to`, every placed terrain cell and every
    combatant position, expanded by one cell on every side. **Why it is sound:** outside
    the original box every cell is plain, unoccupied and unblocked. Clamping coordinates
    into the expanded box maps neighbors to neighbors (or to the same cell) for both the
    8-neighbor square set and the 6-neighbor axial hex set, and it never raises a step's
    cost. So some cheapest path always lies inside the region. The search is therefore
    exact for both reachability and cheapest cost.
19. **DD-M19 (REPLAN-GM-01): `speed` reference detection is position-aware [F-P11].** The
    matcher is new code in S02's lease (`src/schema/validate/sections/cross.ts`
    `checkMovementDsl`; no `speed` matcher exists at `67f383b`). S02 narrows it to
    formula identifiers. It is a text-level call/argument-index scan. A token counts only
    when it is **not** the argument at a non-formula position: `damage` arg 2 (type),
    `applyCondition` arg 1 (condition id), `target` arg 1 (shape), `save` arg 1 (save
    name). These positions mirror `effect.ts` `ARG_CATEGORIES` (`:417-425`). M01 still
    imports no core value. Owner: S02 ck3.

## Planning completeness review (2026-09-30)

Source: `.program/results/ARCHIVIST-PREFLIGHT.grid-movement.result.md` (Archivist
planning-completeness pass at `67f383b`). Every finding was re-verified against committed
source by REPLAN-GM-01 before being applied. Orchestrator decisions:
`.program/decisions.md` § grid-movement preflight.

| Finding | Verified? | Disposition |
|---------|-----------|-------------|
| **F-P1** duplicate offers (blocking) | **Confirmed.** `resolve()` returns `sinceRound` (`combat.ts:743`); `declare` (`:456`) and `resolveReactive` (`:875`) pass it to `surfaceOffers` (`:837-847`). `respond` splices the offer (`:551`), and the take path re-surfaces the round, so the same `triggerId` (`${reactor}.${action}`, `triggers.ts:72`) returns. | **Applied.** DD-M10 and CA-M4 amended (per-call sink). Work assigned to **S03 ck3**, which runs the whole suite and returns `blocked` naming any outside-lease test that depends on repeat offers. The arch delta for `v1-core.md:163` goes into S03's arch fragment. |
| **F-P2** restore phase (blocking) | **Confirmed.** `snapshots.ts:554` always sets `awaiting-declare`; `step()` then starts a turn (`combat.ts:347-367`). Restored `matchingEvent` = pattern (`snapshots.ts:565`) vs `event.type` live (`triggers.ts:75`). | **Applied (derived phase, no schema change).** DD-M12, CA-M5 and **S03 ck4** amended; S01 schema scope unchanged (description text only). Residuals recorded below (R-GM-1, R-GM-2). |
| **F-P3** terrain restore scheduled after use (blocking) | **Confirmed.** `snapshots.ts:549-557` builds `CombatState`; `CombatRestoreRequest` (`:435-440`) has no `terrain`. | **Applied.** `CombatRestoreRequest.terrain`, its refusals and the `CombatState.terrain` rebuild moved to **S03 ck2**. `pendingMove` stays at ck4. |
| **F-P4** monsters lack the reaction (blocking) | **Confirmed** in SESSION-04 CA-M6 text (statblocks got only the move action). | **Applied.** S04 appends the move action **and** the reaction to every class and every statblock. CA-M6 row amended. Journey steps 1/4/6 unchanged. |
| **F-P5** `useItem` throws on `speed` (blocking) | **Confirmed.** `equipment.ts:272-280` binds `level/hp/ac/initiative` only; `formula.ts:296-300` throws "unknown name". | **Applied.** S03 ck2 task (equipment.ts already leased), with its closing assertion in `movement.test.ts`. |
| **F-P6** pins | **Confirmed** at source (a: `grid-journey.test.ts:211-227`, all three theme `spatial` deep-equals; b: `character-profile.test.ts:309-329`; c: `:206-226`, pinned list `:212-222`; d: `checker.test.ts:12-29`; e: `effect.test.ts:355` title only; f: none; g: `equipment-journey.test.ts:72-81`). | **Applied.** See Verification Baseline → Pins. a → S04 ck1; b → S03 (omit when absent) + S04 ck1 re-key; c → S04 ck1 insertion; d → S02 ck2; g → S04 ck0 staged whole-suite run kept. |
| **F-P7** line drift | **Confirmed.** `spatial.ts` 131 lines, `canReach` `:60-61`; `startCombat` `:173`; `declare` `:385`; `executeAgainst` `resolve.ts:332`, `apply` `:350-365`. | **Applied.** References corrected in STATE, S03 and S04. |
| **F-P8** lease leads | **Confirmed not gaps.** `checker.ts` needs no change; root-only/dice-free checks live in `effect.ts` `checkEffectAst` (S02); `EFFECT_SCALARS` is `effect.ts:57`; `runtime.ts`, `triggers.ts`, `action-economy.ts`, `events.ts`, `bestiary.ts` need no edits. | **Recorded** (no lease change). |
| **F-P9** out-of-range bound | **Confirmed** (the planned `distance × maxCost` bound can miss a wall detour). | **Applied.** DD-M18; S03 ck1 search amended; closing assertion: a wall detour costing more than the budget reports `out-of-range`. |
| **F-P10** own cell; spent reaction slot | **Confirmed** (a: undefined in the plan; b: `offersForEvent` `triggers.ts:62-81` has no cost check). The take/decline behavior was verified in source (see DD-M10). | **Applied.** DD-M6/M9/M10 and S01 ck2/ck3 text; S03 ck2/ck3 tests. |
| **F-P11** `speed` not purely additive | **Confirmed.** The matcher is planned new code inside S02's lease (`cross.ts`). | **Applied.** S01 ck3 compatibility note + Version Registry row 6 reworded; S02 ck3 narrows the matcher to formula positions (DD-M19). No debt carried. |
| **F-P12** `displayRoll` vs `rollText` | **Confirmed.** The output is the same for rolls without a verdict. | **Applied.** S03 ck5 must keep `tests/runtime/equipment.test.ts` green (explicit selector). |

**Recovery pass (REPLAN-GM-01 attempt 2, 2026-09-30):** the uncommitted draft of the
aborted attempt was re-checked against committed source at `67f383b`. Pin lines corrected:
the whole-profile pin is `character-profile.test.ts:309-329` (the `it` at `:309`, the
deep-equal at `:317-329`), not `:312-329`; the grid-journey `spatial` deep-equals are
`:211-215` / `:218-222` / `:223-227` (not `:210-214` / `:217-221` / `:222-226`). S04's
`formulas.speed` values were restated in the themes' `{ "expr": ... }` form; all three
themes declare `grace` and `vigor`. The F-P10b take/decline semantics, the `endTurn` path
(no `turn:began` after a forfeit), `checkCost` comparing against the grant, and the
planned (not yet committed) `speed` regex in S02's lease were re-confirmed.

**Residuals recorded (not blocking, carried):**
- **R-GM-1 (F-P2):** `trigger:fired.payload.offerIndex` comes from the private
  `Combat.offeredCount` (`combat.ts:320`). It is not in the snapshot, so a restored fight
  restarts it at 0 (pre-existing). The CA-M5 parity assertion therefore compares the
  `move:*`, `attack:rolled`, `damage:applied`, `move:ended{forfeited}` and `turn:ended`
  payloads, plus final positions. Any `trigger:fired` emitted *after* restore is compared
  without `offerIndex`. Owner: a future snapshot revision (DB); not this feature.
- **R-GM-2 (F-P2):** the derived phase is exact for `pendingMove`. It is also exact for
  offers raised by `declare`/`respond`, where the live phase is `resolved`. But an offer
  raised by `fight.use` leaves the live phase at `awaiting-declare` (`use` does not end the
  turn). Restoring such a fight derives `resolved`, so `step()` ends the turn, while the
  uninterrupted fight's `step()` re-begins it. Only an envelope phase could distinguish the
  two cases (the option Orchestrator declined). Owner: a future snapshot revision (DB);
  recorded in S03's handoff. No journey in this feature restores a `use`-raised offer.

- **R-GM-3 (S03 receive, 2026-09-30):** a resumed walk skips the leaving-reach check on its first step out of the paused cell. This is S03's interpretation, following the spatial.html mock and the once-only offer rule, and it was accepted in decisions.md. Edge case: if re-planning picks a *different* first step, a different threatener whose reach that step leaves is not checked. Owner: the next feature that touches provoke. Not blocking.

## Verification Baseline

| Item | Effective command / config | Evidence | Notes / owner |
|------|---------------------------|----------|---------------|
| Whole suite | `pnpm test` → `vitest run` (include `tests/**`) | **actual:** 661/661, 37 files, 2.0 s at `02f8196` (Planner, 2026-09-29); **actual:** 661/661 at `67f383b` (Orchestrator startup, 2026-09-30) | New files expected: S03 `tests/runtime/combat/movement.test.ts`, `tests/runtime/combat/movement-geometry.test.ts`; S04 `tests/proofs/movement-journey.test.ts` |
| Narrow gate | `pnpm exec vitest run <path>` | inherited (DD14e) | `pnpm test -- <pattern>` does NOT filter; `npx vitest` fails here |
| typecheck / lint / format:check | `pnpm typecheck` · `pnpm lint` · `pnpm format:check` | actual green at `67f383b` (Orchestrator startup) | Whole-repo fast gates at every receive (promoted convention) |
| build / isolation / security | `pnpm build` · `pnpm check:isolation` · `pnpm check:security` | actual green at `67f383b` (Orchestrator startup) | S03 must keep runtime free of compiler strings |
| Journeys needing `dist/` | `tests/proofs/{loot,equipment}-journey.test.ts` read `dist/` | **hazard:** CI `test` job never builds | S04 ck3 adds `pnpm build` before `pnpm test` in ci.yml. Locally, run `pnpm build` before the whole suite |
| CI proofs job | `pnpm exec vitest run tests/proofs/` (package job, after build) | inherited | The new movement journey is discovered automatically |
| Probe (review) | Archivist `/tmp` script against `dist/` built after HEAD | observed duplicate re-offer after `respond('b.parry','take')` (F-P1) | Not repo evidence; S03 ck3's closing assertion replaces it |

### Pins touched by this feature (pin-lease ownership; source-read by REPLAN-GM-01 at `67f383b`)

Every assertion is preserved except the pinned value itself. Each pin has one re-key owner
whose lease covers the file.

| Pin (file:line) | What it pins | Changed by | Re-key owner / checkpoint |
|---|---|---|---|
| `tests/schema/validate.test.ts:473-481` | uses `'hex'` as the *unshipped* model → E-SPAT-01 | S02 ck1 (hex accepted) | **S02 ck1**: switch to `'isometric'`; assertion kept |
| `tests/core/dsl/checker.test.ts:12-29` | exact 13-entry `REGISTRY` membership (title "v1.4 membership (13…)") | S02 ck2 (`move` added) | **S02 ck2**: 14 entries incl. `'move'` (sorted between `min` and `save`); title → v1.5 / 14 [F-P6d] |
| `tests/core/dsl/effect.test.ts:355` | test **title** names `hp/ac/initiative/level`; no list assertion [F-P6e] | — (harmless) | **S02 ck2** may retitle to add `speed`; no assertion change required |
| `tests/runtime/combat/character-profile.test.ts:309-329` (deep-equal `:317-329`) | whole zombie-urban profile deep-equal (`rest`) | S03 would break it only if `speed` were always emitted; S04 ck1 (`formulas.speed` added) | **S03**: emit `speed` only when `formulas.speed` is declared (keeps it green). **S04 ck1**: add `speed: evalPackFormula(rt.pack, 'speed', base)` to the expected object [F-P6b] |
| `tests/runtime/combat/character-profile.test.ts:212-222` (test `:206-226`) | warden/hexer class-action **union**, first occurrence wins | S04 ck1 | **S04 ck1**: **insert** the theme's move action and reaction after `'parry'` (they are appended to each class, and the union keeps first occurrence). Result: `strike, cut-down, withdraw, brace, parry, stride, opportunist, hurl, long-shot, ward-glint, ember-surge`. This is not an append [F-P6c] |
| `tests/proofs/docs-run.test.ts:195` | warden actions (`strike…parry`) | S04 ck1 | **S04 ck1**: append `'stride', 'opportunist'` |
| `tests/proofs/docs-run.test.ts:49` | exactly 4 ```ts blocks in README | — | **unchanged**: S04 README additions use ```json / ```text only |
| `tests/proofs/grid-journey.test.ts:211-215` | dark-fantasy `rt.pack.spatial` deep-equal | S04 ck1 (terrain added) | **S04 ck1**: add `terrain: {rubble:{cost:2}, pillar:{blocks:true}}` [F-P6a] |
| `tests/proofs/grid-journey.test.ts:218-222` | zombie-urban `spatial` deep-equal | S04 ck1 (terrain added) | **S04 ck1**: add `terrain: {debris:{cost:2}, 'barricade-wall':{blocks:true}}` [F-P6a] |
| `tests/proofs/grid-journey.test.ts:223-227` | wyldwood `spatial` deep-equal (`model:'grid'` at `:224`) | S04 ck1 (hex + terrain) | **S04 ck1**: `model:'hex'` + `terrain: {bramble:{cost:2}, 'standing-stone':{blocks:true}}` |
| `tests/compiler/pipeline.test.ts:430-432` | "each generated pack carries model grid" | S04 ck1 | **S04 ck1**: per-theme expectation (`hex` for wyldwood). `pipeline.test.ts:340-356` uses a hand-set theme spatial and is **unaffected** |
| `tests/compiler/coverage-floor.test.ts:167`, `:173`, header `:9` | `model === 'grid'` per theme | S04 ck1 | **S04 ck1**: per-theme model; header comment |
| `tests/schema/registry.test.ts` / `validate.test.ts` RULE_IDS 15 | rule-id count | — | **unchanged**: no new id |
| Fight loops `equipment-journey.test.ts:72-81` (and similar) | try each action in order | S04 ck1 (new actions appended last) | not a pin; covered by **S04 ck0 staged whole-suite run** with `blocked` return [F-P6g] |
| No hash/byte-count pins on generated content; `stages`/`encounter`/`overrides` tests use fixture or micro themes [F-P6f] | — | — | — |

## Capability Readiness

| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|----|--------------------------------|---------------------------------|------------------------|--------------------------------|--------|-------------------------|-------------------------------|
| CAP-M1 | A pack may declare `spatial.model: "hex"`; reach, `adjacent` and burst use hex distance | model value (S01 contract; S02 mirror + validator); geometry (S03 ck1) | CA-M1 | S03/ck1 (unit); S04/ck2 (generated wyldwood) | **verified** (S03 ck1 ea4e308 unit; S04 ck2 da9bf03 wyldwood hex) | movement-geometry.test.ts; movement-journey.test.ts steps 1-2; 741/741 at c23d563 | coverage window S02→S03 closed at ea4e308 (S03 ck1) |
| CAP-M2 | **First narrow journey:** `declare(moveAction, {to})` moves the actor along the cheapest legal path within `speed`; the position survives serialize/restore (terrain re-stated); rejections change nothing; out-of-combat `useItem` can read `speed` | speed (S01 → S02 scalar → S03 ck2 profile + vars + `useItem`); move statement (S02); path/gate (S03 ck1/ck2); restore terrain (S03 ck2) | CA-M2, CA-M3 | S03/ck2 | **verified** (S03 ck2 e5546bb; re-exercised S04 ck2 da9bf03) | movement.test.ts; movement-journey.test.ts steps 2-3; 741/741 | — |
| CAP-M3 | Pack-declared blocking and difficult terrain, placed by the host per fight and re-stated on restore | terrain vocabulary (S01/S02); placement + costs + restore terrain (S03 ck1/ck2) | CA-M1, CA-M3, CA-M5 (terrain leg) | S03/ck2 | **verified** (S03 ck2 e5546bb; S04 ck2 generated terrain) | movement.test.ts; movement-journey.test.ts step 2; 741/741 | — |
| CAP-M4 | Pack-declared opportunity reactions fire when a mover leaves reach; the move pauses and resumes; each offer surfaces once | provoke event + pause + per-call offers (S03 ck3); reaction content on classes and statblocks (S04 ck1) | CA-M4, CA-M6 | S03/ck3 (fixture pack); S04/ck2 (generated) | **verified** (S03 ck3 3af4127 fixture; S04 ck2 da9bf03 generated, grid+hex) | movement.test.ts provoke; movement-journey.test.ts steps 4, 6; 741/741 | — |
| CAP-M5 | A mid-move pause snapshots and resumes losslessly: derived `resolved` phase; restored offer `on` = event type | `pendingMove` contract (S01); serializer/restore/phase/`on` (S03 ck4) | CA-M5 | S03/ck4; S04/ck2 step 4 | **verified** (S03 ck4 dd88f0c; S04 ck2 step 4 generated JSON round-trip) | snapshots/combat.test.ts v1.5; movement-journey.test.ts step 4; 741/741 | R-GM-1 (`offerIndex`), R-GM-2 (`use`-raised offer phase): carried, owner future DB revision |
| CAP-M6 | Generated themes can move: `speed`, move action, reaction (classes + statblocks), terrain kinds; wyldwood hex | theme content (S04 ck1) | CA-M6 | S04/ck2 | **verified** (S04 ck1 40c4492 content + ck2 da9bf03 journey) | coverage-floor.test.ts v1.5 movement; movement-journey.test.ts steps 1, 5, 9; 741/741 | — |
| CAP-M7 | Theater-of-mind packs pay nothing: move content loads and moves are no-op successes | S02 validator (no spatial requirement); S03 no-op branch | CA-M7 | S03/ck2 (unit); S04/ck2 (wyldwood minus spatial) | **verified** (S03 ck2 e5546bb unit; S04 ck2 wyldwood minus spatial) | movement.test.ts theater; movement-journey.test.ts step 7; 741/741 | — |

**Production path, for every CAP:** `generateCampaign` (or a validated fixture pack) →
`new Runtime(pack)` (stage-8 `validatePack` + `checkPackDsl`) → `profileFromCharacter` /
`spawnMonster` (profiles carry `speed` when declared) → `startCombat({allies, enemies,
positions, terrain})` → `fight.step()` → `fight.declare('stride', {to})` → movement gate →
`spend` → `executeAgainst` (`resolve.ts:332`) → `move` statement → `apply.move` → path walk
with `move:*` events → per-call `surfaceOffers` → `fight.respond(...)` → resume →
`serializeCombat` → `deserializeCombat(..., {positions, terrain})` (derived phase). This
library has no durable storage beyond the snapshot envelope. "Restart" = serialize → JSON →
restore.

## Contract Agreements

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|----|------------------------------|--------------------------------|-----------------------|----------------------------------------|-----------|----------|------------------------------------|
| CA-M1 | Spatial model vocabulary: `grid` = square/Chebyshev (unchanged); `hex` = axial `{x:q, y:r}`, hex distance; `terrain` kinds `{cost ≥ 1}` xor `{blocks: true}` | `pack.schema.json $defs/spatial` (S01) → `SpatialDef` + `checkSpatial` (S02) → `spatialFromPack`/`hexGeometry`/`findPath` (S03) → theme JSON (S04) | `model` enum `["grid","hex"]` (was const); `terrain` optional; kind ids kebab; exactly one of `cost`/`blocks`; unknown model → `E-SPAT-01` (unchanged mapping); malformed terrain → `E-SCHEMA-01`; search region-bounded exact (DD-M18) | S01 ck3 · S02 ck1 · S03 ck1 · S04 ck1 | agreed (DD-M2/M5 confirmed 2026-09-30) | landed: S01 ck3 a134054 (contract); S02 ck1 21a0a5f (mirror+validator); S03 ck1 ea4e308 (geometry/findPath) | passed: validate.test.ts CA-M1 cases (S02); movement-geometry.test.ts incl. F-P9 wall detour (S03); S04 ck1 40c4492 (theme content) |
| CA-M2 | `move(formula)`: root-only, dice-free, non-triggered action effects only; `speed` reserved formula + effect scalar, bound in combat and in `useItem` | `database.md §formulas` + registry doc (S01) → `REGISTRY.move`, `EFFECT_SCALARS`, `checkEffectAst`, executor (S02) → `executeAgainst` vars + `apply.move` + `CombatantProfile.speed` + `useItem` vars (S03) | registry 13 → 14; misuse → `E-FORM-02`; `speed` at a formula position without `formulas.speed` → `E-REF-01` (non-formula positions ignored, DD-M19); executor without `apply.move` throws (fail-closed); `useItem` `speed` = `scopedFormula` or 0; compatibility note in database.md (F-P11) | S01 ck3 · S02 ck2/ck3 · S03 ck2 | agreed (DD-M7/M8 confirmed 2026-09-30; F-P5/F-P11 amendments) | landed: S01 ck3 a134054; S02 ck2 a2b4db3 + ck3 5d76126/933c2fd; S03 ck2 e5546bb (vars, apply.move, useItem) | passed: effect/checker/validate tests (S02); movement.test.ts incl. useItem heal(speed) (S03) |
| CA-M3 | Move declare semantics: `DeclareOptions.to`; terrain placement; path legality; rejection kinds with no change | `spatial.html` + `api-map.html` (S01) → `Combat.declare` movement gate + `startCombat` terrain (S03) → journey (S04) | kinds `no-destination` / `blocked` / `occupied` (incl. `to` = own cell) / `unreachable` (no path at any cost) / `out-of-range` (reachable, cost > budget), all rule `E-SPAT-01`; no state/rng/ledger change (compare `serialize()` before and after); startCombat terrain refusals aggregate | S01 ck2 · S03 ck1/ck2 · S04 ck2 | agreed (DD-M5/M6/M9 confirmed 2026-09-30; F-P9/F-P10a amendments) | landed: S01 ck2 5209311 + ck3 a134054; S03 ck1/ck2 e5546bb | passed: movement.test.ts five rejection kinds, serialize() unchanged, startCombat terrain refusals (S03 ck2); S04 ck2 da9bf03 journey step 3 |
| CA-M4 | Provoke: `move:leaving-reach` (actor mover, target threatener); **offers only for events emitted by the current call, each exactly once**; offers not filtered by affordability; pause iff offers; resume on empty queue (a refused take counts as answered); resume re-checks; forfeit on `step()`; `move:advanced` / `move:ended` | `spatial.html` provoke section + database.md (S01) → `combat.ts` walk + per-call `surfaceOffers` + `respond` + `step` (S03) → reaction content on classes and statblocks (S04) | pattern `move:leaving-reach[target=self]` matches through the existing `eventMatches` (no grammar change); reasons are the closed set in DD-M10; after the only offer is taken or declined, `pendingTriggers` is `[]` and exactly one `trigger:fired`/`trigger:declined` exists per matching event; spent-slot take → one `declare:rejected {slot-exhausted, reaction}` E-ECON-01, no change | S01 ck2/ck3 · S03 ck3 · S04 ck1/ck2 | agreed (DD-M10 confirmed 2026-09-30; F-P1/F-P10b amendments) | landed: S01 ck2/ck3; S03 ck3 3af4127 | passed: movement.test.ts provoke describe incl. F-P1 regression, F-P10b take/decline; whole suite 724/724 at ck3 (S03); S04 ck2 da9bf03 journey steps 4/6 (generated reactions) |
| CA-M5 | Snapshot: combatant `pendingMove?` round-trips; positions and terrain re-stated by the host; restore derives phase `resolved` when any `pendingMove`/`pendingTrigger`; restored offer `on` = event type | `snapshots.schema.json` (S01) → `serializeCombat` / `deserializeCombat` / `CombatRestoreRequest.terrain` (S03 ck2) / `pendingMove` + phase + `on` (S03 ck4) | serialize only when set; restore refuses an unknown or non-move `actionId` → `E-SNAP-01`; terrain refusals = startCombat's; spatial restore gate (CAP-G5) unchanged; parity: restored paused fight's `step()` yields the same `move:ended{forfeited}` → `turn:ended` (identical payloads) as uninterrupted; `respond` resume parity on `move:*` payloads + positions (R-GM-1 scope) | S01 ck3 · S03 ck2 (terrain) · S03 ck4 | agreed (DD-M12 confirmed 2026-09-30; F-P2/F-P3 amendments) | landed: S01 ck3 a134054; S03 ck2 e5546bb (terrain) + ck4 dd88f0c | passed: tests/snapshots/combat.test.ts v1.5 paused-move (take/decline resume parity, F-P2 forfeit parity, E-SNAP-01) (S03). R-GM-1/R-GM-2 carried; S04 ck2 da9bf03 journey step 4 |
| CA-M6 | Theme content: `formulas.speed`, move action (tag `move`, `move` slot, `move(speed)`), reaction (reaction slot, `move:leaving-reach[target=self]`, the theme's melee attack), terrain kinds; wyldwood `hex`. **Move action and reaction are appended to every class `actions` list and every bestiary statblock `actions` list** | theme JSON (S04) → pipeline pass-through (existing) → `validatePack` (S02) → runtime (S03) | `rooted` already restricts `actions.tagged:move`, so it applies to the move action without new code | S04 ck1/ck2 | agreed (DD-M3 confirmed 2026-09-30; F-P4 amendment) | landed: S04 ck1 40c4492 (move + reaction appended to every class and statblock list; wyldwood hex) | passed: coverage-floor.test.ts v1.5 movement (per theme); movement-journey.test.ts steps 1/4/5/6; 741/741 |
| CA-M7 | Theater of mind: move no-op success; move content loads without `spatial`; terrain rides along unconsulted, like positions | S01 text → S02 (no spatial requirement on `move`) → S03 no-op branch | no positions and no `move:*` events in theater packs | S02 ck2 · S03 ck2 · S04 ck2 | agreed (DD-M11 confirmed 2026-09-30) | landed: S01 text; S02 ck3 5d76126 (validator); S03 ck2 e5546bb (no-op branch) | passed: validate.test.ts no-spatial move (S02); movement.test.ts theater of mind (S03); S04 ck2 da9bf03 journey step 7 |

**Provisional:** every CA's producer is built inside this feature. All rows are provisional
against their named producer checkpoints. **Orchestrator re-checks each mapping against
the landed producer before dispatching the dependent session:**
- CA-M1/M2/M4/M5 against S01's committed contract and database.md before S02;
- CA-M1/M2 against S02's committed types (and the DD-M19 matcher) before S03;
- CA-M3/M4/M5 against S03 before S04.

Dependents are dispatched against the amended CA text, not the planned text.

## Current Blockers

| ID | Affects | Next action | Owner | Evidence to clear |
|----|---------|-------------|-------|-------------------|
| — | — | None open. All four sessions done 2026-09-30 (741/741). B-M1 (human confirmation of DD-M2…DD-M13) **cleared 2026-09-30**: the human answered "confirmed" with no edits. F-P1…F-P5 (blocking review findings) **cleared 2026-09-30** by REPLAN-GM-01 (prompt corrections; implementations remain planned in S03/S04). | — | Recorded in Program/Authorization, Design Decisions and "Planning completeness review (2026-09-30)" |

## Handoff Notes

<!-- Orchestrator appends Coder/Author handoffs here verbatim. Do not pre-fill. -->

### SESSION-01 — done 2026-09-30 (3/3: 9bc89f6, 5209311, a134054)

Orchestrator receive: commits inside the lease; typecheck/lint/format:check/build/isolation/security 0; `pnpm test` 661/661 (37 files). CA-M1/M2/M4/M5 rechecked against a134054: `model` enum [grid,hex], `terrain` oneOf {cost≥1}|{blocks:true}, snapshots `pendingMove` closed {actionId,to{x,y},remaining≥0}; database.md carries per-call offers, slot-exhausted, out-of-range, formula-position E-REF-01. No mapping changed; S02 dispatched against the planned CA text.


- **session:** 01
- **status:** done
- **checkpoint:** 3
- **notes:** Author re-entry done (Spec → Designer → DB). FR-11 amended; spatial.html and api-map.html design-changed; contract v1.5 (pack + snapshots) and database.md v1.5 landed. Commits: ck1 `9bc89f6`, ck2 `5209311`, ck3 `a134054` (base `4ef88f0`). This session produces the approved text for CAP-M1…CAP-M7 and the contract legs of CA-M1, CA-M2, CA-M3, CA-M4, CA-M5 and CA-M7. Nothing is proven at runtime. **Every DD-M value is written as approved, with no deltas:** DD-M2 (hex axial, distance formula, fixed neighbor order), DD-M4 (8 neighbors, diagonal costs 1), DD-M5 (terrain vocabulary, host placement, startCombat refusals), DD-M6 (occupancy, including the mover's own cell [F-P10a]), DD-M7 (reserved optional `speed`; profile carries it only when declared; combat binds `profile.speed ?? 0`; `useItem` binds the formula or 0 [F-P5]; E-REF-01 only at formula positions, plus the compatibility caveat [F-P11]), DD-M8 (root-only, non-triggered action effect, dice-free, E-FORM-02; registry 13→14), DD-M9 (Dijkstra, the five kinds, unreachable vs out-of-range [F-P9], own cell = occupied), DD-M10 (trigger, per-call offers [F-P1], pause, no affordability filter with decline/take semantics [F-P10b], resume re-checks, forfeit, events), DD-M11 (theater-of-mind no-op), DD-M12 (pendingMove, derived `resolved` phase, restored offer `on` = event type [F-P2]), DD-M13 (respond target unchanged), DD-M14 (canReach preserved), DD-M18 (region-bounded search, in database.md). **Exact JSON paths S02 must mirror:** pack `$defs/spatial/properties/model` = `{"enum":["grid","hex"]}`; `$defs/spatial/properties/terrain` = object with `propertyNames` pattern `^[a-z][a-z0-9-]*$` and `additionalProperties.oneOf` [`{cost: integer ≥1}` required cost, closed; `{blocks: const true}` required blocks, closed] → `spatial.terrain.<kind>.cost` / `spatial.terrain.<kind>.blocks`; `formulas.speed` (a reserved id, documented in the `formulas` description; the schema shape is unchanged); snapshots `$defs/combatSnapshot/properties/combatants/items/properties/pendingMove` = `{actionId: string, to: {x: integer, y: integer} (closed, both required), remaining: integer ≥0}`, closed, all three required. **Final event names:** `move:leaving-reach` (actor mover, target threatener, payload `{at, next}`), `move:advanced {from, to, path, cost, remaining}`, `move:ended {reason: arrived|downed|restricted|blocked|forfeited, at}`. **Rejection kinds** (all `declare:rejected`, rule `E-SPAT-01`, nothing changes): `no-destination`, `blocked`, `occupied`, `unreachable`, `out-of-range`. Spent-slot take → `declare:rejected {kind:'slot-exhausted', resource:'reaction'}`, rule `E-ECON-01`. Reaction pattern: `move:leaving-reach[target=self]`.
- **delivered:** requirements.md FR-11: 6 new acceptance criteria (verbatim from the task) plus a Decision Log row. spatial.html: the verbatim `"spatial"` block plus a hex/grid geometry note; new sections "Movement is an action, not a verb", "Terrain" and "Leaving reach"; concrete `rooted` callout; theater-of-mind column. api-map.html: `rt.startCombat({ allies, enemies, positions?, terrain? }, opts?)`, `fight.declare(actionId, { targetId?, to? })`, `move:leaving-reach · move:advanced · move:ended` beside `sinceRound`. pack.schema.json: `model` enum, `terrain`, extended spatial description, `formulas` description. snapshots.schema.json: `pendingMove`. database.md: status v1.5; overview; §spatial; §formulas (movement budget table plus the verbatim compatibility note); registry prose plus E-SPAT-01 scope ("v1.5 adds no id"); Snapshot Envelopes (pendingMove, derived restore phase, restored offer `on`); Access Patterns; Version Registry row 6 (verbatim; does not say "purely additive").
- **verification:** both contracts parse; 0 `required` arrays changed; the diff is additive apart from the planned `model` widening (const → enum) and description text; prettier --check on contracts passes; `pnpm typecheck` exit 0; both mocks pass an HTMLParser tag-balance check; the spatial.html pack.json block parses and equals the prescribed anatomy; the cross-references hold; after each commit, `git show --name-only` listed only write-set paths; the tree is clean. The whole suite was not run, as instructed.
- **surprises:** (1) Role-rule tension: SPEC.md says Spec is never spawned and should stop when given an orchestration envelope. I proceeded on STATE.md's recorded human authorization; the FR-11 text was prescribed verbatim. Flagged so SPEC.md/AUTHOR.md can be reconciled with planned Author re-entry sessions. (2) Wording changes: database.md's E-SPAT-01 row and §spatial note, "outside the v1 set" → "outside the shipped set" (same meaning); spatial.html drops the old `// v1 set (FR-11)` comment after `shapes`; the `$defs/spatial` description now reads `{model: 'grid' | 'hex', …, shapes?, terrain?}`. (3) requirements.md had no trailing newline; that is preserved, so git shows the last line as 1 deletion and 1 re-addition with identical text. (4) One scripted edit hung on stdin and timed out without writing; I rewrote spatial.html directly. Lease revision used: 1.
- **followUp:** **S02:** E-FORM-02 applies when `move(formula)` is anywhere other than the root statement of a non-triggered `actions.<id>.effect`, or when its argument contains dice. E-REF-01 applies when `speed` appears at a formula position and there is no `formulas.speed`; `damage` arg 2, `applyCondition` arg 1, `target` arg 1 and `save` arg 1 are not references. Registry 13→14 (`move`, arity 1, kind effect, signature `['formula']`); `speed` joins the effect scalars and shadows a same-named ability. **S03:** implement exactly as written in database.md §spatial "Movement"/"Provoke" and §Snapshot Envelopes v1.5: per-call offers; no affordability filter (decline → one `trigger:declined`; take → one `declare:rejected {slot-exhausted, reaction}` E-ECON-01); resume on empty queue with the downed/restricted/blocked re-checks; `step()` while paused → `forfeited`; derived restore phase; restored offer `on` = the pattern base before `[`; a `pendingMove` with an unknown or non-move actionId → E-SNAP-01; `CombatRestoreRequest.terrain?` mirrors startCombat's refusals. Orchestrator: recheck CA-M1/M2/M4/M5 against `a134054` before S02. R-GM-1/R-GM-2 still carried. No arch fragment was written.
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:** program/Ruleswright/specs/requirements.md, program/Ruleswright/mocks/spatial.html, program/Ruleswright/mocks/api-map.html, program/Ruleswright/specs/database.md, src/schema/contracts/pack.schema.json, src/schema/contracts/snapshots.schema.json

### SESSION-02 — done 2026-09-30 (3/3 + correction: 21a0a5f, a2b4db3, 5d76126, 933c2fd)

Orchestrator receive: all commits inside the lease; typecheck/lint/format:check/build/isolation/security 0; `pnpm test` 689/689 (37 files). Arch delta integrated at 08a831b. CA-M1/M2 rechecked against committed types (`TerrainKind`, `model: grid|hex`, `terrain?`, `EffectApply.move?`, `MoveOutcome`, `REGISTRY.move`, `NON_FORMULA_ARGS` = DD-M19). No mapping change; S03 dispatched against the planned CA text plus S02 followUp.


- **session:** 02
- **status:** done
- **checkpoint:** 3
- **notes:** CAP-M1/M2/M3/M7 producer legs landed (M01 mirror + validator, M02 registry/executor/checker); CA-M1, CA-M2 (core + validator leg) and CA-M7 validator leg produced; no user capability proven yet (integration owners S03/S04). Commits: ck1 `21a0a5f`, ck2 `a2b4db3`, ck3 `5d76126`, ck3 correction `933c2fd` (base `3d52826`, lease revision 1). Exported symbols:
  - `TerrainKind`, `SpatialDef.model: 'grid' | 'hex'` and `SpatialDef.terrain?` (`pack.ts`);
  - `checkMovementDsl` (`validate/sections/cross.ts`, dispatched in `validate/index.ts` after `checkRestrictsTags`);
  - `REGISTRY.move = {arity:1, kind:'effect', signature:['formula']}` (13→14), with `EFFECT_VOCABULARY` + `move`;
  - `EFFECT_SCALARS = ['level','hp','ac','initiative','speed']`;
  - `EffectApply.move?(budget: number): void` (optional);
  - `MoveOutcome {kind:'move', budget}` in `EffectResolution`;
  - `ARG_CATEGORIES.move = ['formula']`.

  Message texts:
  - E-SPAT-01: `…the engine ships exactly {grid, hex} (grid: square, Chebyshev distance; hex: axial coordinates)…`
  - Core E-FORM-02 nesting: `move(...) must be the whole effect — it cannot be nested in sequence/target/save.`
  - Core E-FORM-02 dice: `move's budget must be dice-free (evaluated at declare time, before cost).`
  - Cross E-FORM-02: `move(...) is legal only as the root statement of a non-triggered actions.<id>.effect — not in {a triggered action | a spell effect | a feat effect | an item's use}.`
  - E-REF-01: `"speed" is referenced at a formula position, but the pack declares no formulas.speed — speed is a reserved optional formula id (v1.5 movement budget).`, hint `declare formulas.speed to give effects a speed to read.`
  - Executor throw: `move(...) needs host movement support (EffectApply.move) — combat supplies it; other callers cannot move (FR-11)`

  `NON_FORMULA_ARGS` as landed = `{damage:[1], applyCondition:[0], target:[0], save:[0]}`. It matches `ARG_CATEGORIES`.

  Pins re-keyed:
  - `validate.test.ts:473-481`: `'hex'` → `'isometric'`; the assertion is kept.
  - `checker.test.ts:12-29`: 13 → 14 entries, `'move'` between `'min'` and `'save'`, title → "v1.5 membership (14…)".
  - `effect.test.ts:355`: title only, adds `/speed`.

  The S02→S03 coverage window is open: the validator accepts hex, but `spatialFromPack` still builds square geometry until S03 ck1.
- **delivered:**
  - ck1: `SpatialDef` mirror for hex + terrain; `checkSpatial` accepts `{grid, hex}`, closes the key set to include `terrain`, and a private `checkTerrain` enforces the kind rules (E-SCHEMA-01 at `spatial.terrain.<kind>`).
  - ck2: registry `move`; the `speed` scalar; optional `EffectApply.move`; `MoveOutcome`; a fail-closed `execMove`; the `atRoot` root-only check and the dice-free check in `checkEffectAst`.
  - ck3: `checkMovementDsl` walks `actions.*.effect`, `content.spells.*.effect`, `content.feats.*.effect` and `content.items.*.use`. It checks root-`move` placement and runs a position-aware `speed` scan. The scan never throws and is silent on unbalanced input. The speed rule is silent when `formulas` is unreadable.
- **verification:**
  - Final HEAD `933c2fd`: typecheck, lint, format:check, build, check:isolation and check:security all exit 0.
  - `pnpm test` → 689/689 across 37 files (661 + 28 new).
  - `pnpm exec vitest run tests/schema tests/core` → 210/210 across 10 files.
  - `RULE_IDS` stays 15.
  - The CA-M1, CA-M2 core, CA-M2 validator and CA-M7 tests are listed in the runtime log.
  - Negative controls: with `NON_FORMULA_ARGS` emptied, the DD-M19 test failed, then passed once restored; the grouping-paren regression failed before `933c2fd` and passes after.
  - All boundaries are real production code; the executor tests use a recording `apply` fixture.
- **surprises:**
  - Correction commit `933c2fd`: the ck3 speed scan lost argument position across grouping parentheses. Fixed with a group frame plus a regression test, as a new commit; no amend.
  - Tokenizer deviation: the scan uses the core lexer grammar `[A-Za-z_][A-Za-z0-9_-]*` plus a catch-all operator token instead of the prompt's `[a-z][a-z0-9-]*`. This does not change the DD-M19 mapping.
  - The speed rule is silent when `formulas` is not an object.
  - The ck0 recheck against `a134054` found no contract delta.
  - Pre-existing and left as-is: `heal` is absent from `EFFECT_VOCABULARY`.
  - Lease revision 1 was used.
- **followUp:**
  - S03 must: bind `vars.speed` (`profile.speed ?? 0`) and supply `apply.move` in `executeAgainst`; bind `speed` in `useItem` vars (`scopedFormula` or 0); expect a `{kind:'move', budget}` `MoveOutcome` in effect resolutions (`combat.ts`/`resolve.ts` `if` chains); make runtime geometry hex-aware at ck1 (this closes the coverage window).
  - Orchestrator: recheck CA-M1/M2 against the committed types and `referencesSpeed`/`NON_FORMULA_ARGS` in `cross.ts` before S03.
  - Future proof owners: S03 `movement.test.ts` (runtime `apply.move`, `useItem` `heal(speed)`); S04 journey.
  - Arch fragment written to `.program/signal/SESSION-02.arch.md`.
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:** src/schema/pack.ts, src/schema/validate/sections/root.ts, src/schema/validate/sections/cross.ts, src/schema/validate/index.ts, src/core/dsl/registry.ts, src/core/dsl/effect.ts, tests/schema/validate.test.ts, tests/core/dsl/effect.test.ts, tests/core/dsl/checker.test.ts

### SESSION-03 — done 2026-09-30 (5/5: ea4e308, e5546bb, 3af4127, dd88f0c, 27c77f4)

Orchestrator receive:
- All commits are inside the lease. typecheck, lint, format:check, build, check:isolation and check:security all exit 0; `pnpm test` 729/729 across 39 files.
- The arch delta was integrated at e354139, including the v1-core.md:163 per-call offer delta.
- Auto-decisions (decisions.md): the resume re-provoke skip (R-GM-3 recorded), the square neighbor order, and the decline `setClock` fix.
- CA-M3/M4/M5 were rechecked for S04: the event names, the take pattern `respond(<reactor>.<reaction>, take, moverId)` and the restored `resolved` phase match database.md v1.5. No mapping changed.
- **Orchestrator correction:** the S01/S02 receive commits (3d52826, dfab1d9) wrote contract-leg notes into the CAP-M1/M5/M7 rows, because the row matcher also hit the CAP table's CA-ID cell, and they left CA-M1/M5/M7 unchanged. Both tables were rebuilt from the 4ef88f0 text plus the landed evidence in this commit.


- **session:** 03
- **status:** done
- **checkpoint:** 5
- **notes:** Runtime movement engine landed on lease revision 1 (base `dfab1d9`). Commits: ck1 `ea4e308`, ck2 `e5546bb`, ck3 `3af4127`, ck4 `dd88f0c`, ck5 `27c77f4`.
  - **Capabilities:** CAP-M2/CAP-M3 are proven on the real path at ck2, CAP-M5 at ck4 and CAP-M7 at ck2. The unit/fixture legs of CAP-M1 (ck1) and CAP-M4 (ck3) are proven. S04 still owns the generated-content legs.
  - **Contract Agreements:** the runtime producers for CA-M1, CA-M2, CA-M3, CA-M4, CA-M5 and CA-M7 have landed.
  - **Landed symbols, by file:**
    - `combat/spatial.ts`: `hexGeometry`, `SpatialGeometry.model?`, `SpatialGeometry.neighbors`, a model-dispatching `spatialFromPack`, `TerrainCell`, `PathQuery`, `PathResult`, `findPath`, `terrainAt`, `entryCost`, `MoveRejection`.
    - `combat/combat.ts`:
      - types: `DeclareOptions.to`, `StartCombatRequest.terrain`, `CombatState.terrain`, `CombatantState.speed?`, `CombatantState.pendingMove?`, `PendingMove`;
      - helpers: `copyTerrain`, `terrainRefusals`, `moveBudgetAst`;
      - re-export: `displayRoll`;
      - private methods: the movement gate, walk, resume, forfeit and per-call `collect`.
    - `combat/resolve.ts`: `CombatantProfile.speed?`, `effectVars`, and an optional `move` parameter on `executeAgainst`.
    - `character-profile.ts`: `speed`, emitted only when `formulas.speed` is declared.
    - `equipment.ts`: `useItem` binds `speed`; `rollText` is removed.
    - `snapshots.ts`: `CombatRestoreRequest.terrain`, `SnapshotCombatant.pendingMove`, the E-SNAP-01 refusal for a bad `pendingMove.actionId`, the derived phase, and restored `matchingEvent` equal to the event type.
    - New file `display-roll.ts`. The barrel exports every new public symbol.
  - **Event payloads as landed:**
    - `move:leaving-reach`: actor is the mover, target is the threatener, payload `{at:{x,y}, next:{x,y}}`.
    - `move:advanced {from, to, path:[…excl. from], cost, remaining}` per contiguous segment; it is omitted when the segment is empty.
    - `move:ended {reason: arrived|downed|restricted|blocked|forfeited, at}`.
    - All three carry `why.rule = actions.<moveId>` and `rolls: []`.
  - **Rejection messages** (all `declare:rejected`, rule E-SPAT-01):
    - `no-destination`: resource = actionId, message ``move action "<id>" needs a destination — declare it with { to: { x, y } }.``
    - `blocked`: resource `"x,y"`, message `destination (x,y) is a blocking terrain cell — it can never be entered (budget B).`
    - `occupied`: resource `"x,y"`, message `destination (x,y) is held by a standing combatant — a move cannot end on an occupied cell (budget B).`
    - `unreachable`: resource `"x,y"`, message `no legal path reaches (x,y) at any cost (budget B).`
    - `out-of-range`: resource `"x,y"`, message `the cheapest legal path to (x,y) costs C, but the movement budget is B.`
  - **Terrain refusal card paths:**
    - startCombat: `terrain[i].kind` (artifactId is the kind), `terrain[i].at`, `positions.<id>`;
    - restore: `restore.terrain[i].kind`, `restore.terrain[i].at`, `restore.<id>.position` (artifactId `(snapshot)`).
  - **Per-call offer mechanism as landed:**
    - `declare` and `resolveReactive` collect their own events with `collect()` (the `execute()` sink idiom) and surface only those; `use` is unchanged.
    - `surfaceOffers` skips events already surfaced (a facade-side `WeakSet`, not combat state) and returns how many offers it raised.
    - `declare`/`respond` still return the round window.
    - No outside-lease test depended on repeated offers: the whole suite ran at ck3 with 724/724.
  - **Checkpoint-0 axes:**
    - (a) all inputs exist in-tree: `evalPackFormula`, `resolveSlotGrants`, `offersForEvent`, `emitOffer`, `scopedFormula`, `evalFormula`/`valueOfFormula`;
    - (b) `apply.move(budget: number): void` fits a combat closure as-is;
    - (c) event names, kinds and reasons match database.md v1.5, spatial.html and `snapshots.schema.json` `pendingMove` verbatim;
    - (d) every CA row names its test (see `verification`).
  - **Coverage window:** S02 → S03 is closed at ck1 (`spatialFromPack` dispatches on `model`).
- **delivered:**
  - hex/grid geometry with fixed neighbor orders and the region-bounded exact pather;
  - the move column (speed on profiles and vars, movement gate, walk, the five rejection kinds, theater no-op);
  - terrain at startCombat and on restore, with refusals;
  - out-of-combat `useItem` `speed`;
  - leaving-reach provoke with pause, resume (downed/restricted/blocked re-checks) and forfeit;
  - per-call, once-only offer surfacing;
  - `pendingMove` snapshots, the derived `resolved` restore phase and restored `on`;
  - the `displayRoll` leaf and barrel exports;
  - the fixture `emberMarchesHexPack()`.
- **verification:**
  - **Final HEAD `27c77f4`:**
    - `pnpm typecheck`, `lint`, `format:check`, `build`, `check:isolation` and `check:security` all exit 0.
    - `pnpm exec vitest run tests/runtime/equipment.test.ts` → 15/15, 1 file.
    - `pnpm test` (after `pnpm build`) → **729/729 across 39 files**: 689 baseline + 13 (movement-geometry) + 21 (movement) + 6 (snapshots/combat, 18 → 24).
    - `snapshots.schema.json` still parses.
  - **Whole suite at each checkpoint:** ck2 713/713, ck3 724/724, ck4 729/729, ck5 729/729.
  - **Lease-scoped selectors** ran with the expected file and test counts, never over-selected:
    - ck1: 3 files, 39 tests;
    - ck2: 2 files, 29 tests;
    - ck4: 1 file, 24 tests.
  - **CA evidence (all on the production path; the only fixtures are packs and direct state setup):**
    - **CA-M1 (ck1 `ea4e308`)** — `movement-geometry.test.ts`:
      - "hex distance matches the known table";
      - "the 6 hex neighbors…"; "the 8 grid neighbors…";
      - "hex burst radius 1 covers exactly 7 cells";
      - "hex reach and adjacency…DD-M14";
      - "spatialFromPack dispatches on model";
      - "walks around a blocking wall";
      - "difficult terrain (cost 2) wins…";
      - "F-P9: a wall detour…out-of-range, never unreachable (grid + hex)" (grid cost 8, hex cost 9, budget 6);
      - "…fully enclosed…unreachable";
      - "each failure kind…".
      - The combat-spatial and spatial-triggers suites stay green.
    - **CA-M2/CA-M3/CA-M7 (ck2 `e5546bb`)** — `movement.test.ts`:
      - "a hero and a monster move…";
      - "a difficult (bramble) cell costs 2";
      - "each rejection…changes nothing" (all five kinds, including own cell → `occupied`; `serialize()` deep-equal, rng words equal, move slot still 1);
      - "rooted…restricted";
      - "speed shadows an ability named speed";
      - "…without formulas.speed carries no speed key";
      - "startCombat refuses bad terrain…" (3 cards, no `combat:start`, rng unchanged);
      - "F-P5: useItem…heal(speed)";
      - "theater of mind…";
      - "the first narrow journey leg…".
      - `tests/snapshots/combat.test.ts`: "v1.5: restore re-states terrain…".
    - **CA-M4 (ck3 `3af4127`)** — `movement.test.ts` describe "provoke":
      - "…pauses…take…resumes";
      - "a decline resumes…";
      - "F-P1 regression on a non-move fight";
      - "F-P10b…take refused (E-ECON-01)"; "F-P10b decline variant";
      - "two threateners…";
      - "…downed"; "…restricted"; "…blocked (direct state setup)";
      - "step() while paused forfeits…";
      - "…no matching reaction never pauses".
    - **CA-M5 (ck4 `dd88f0c`)** — `tests/snapshots/combat.test.ts` describe "v1.5 paused-move snapshots (CA-M5)":
      - "pendingMove serializes only when set…";
      - "resume parity (take)"; "resume parity (decline)";
      - "F-P2 forfeit parity…";
      - "a pendingMove naming an unknown or a non-move action refuses with E-SNAP-01…".
      - The CAP-G5 spatial restore tests are unchanged and green.
- **surprises:**
  1. **Resume re-provoke (my interpretation, following the mock).** A resumed walk skips the leaving-reach check for its first step out of the paused cell. Without that, re-planning would re-provoke the same threatener forever, and spatial.html shows the resume going straight to `arrived`. The rule is derivable from `pendingMove` alone, so restore parity holds.
  2. **Pre-existing restore defect fixed in the lease (`combat.ts`, ck4).** `respond(…, 'decline')` did not call `setClock()`. In a restored fight `trigger:declined` was stamped round 0, and `respond` returned `[undefined]` because `sinceRound(round)` missed the event. It now calls `setClock()` first, and a regression assertion covers it.
  3. **Unpinned square neighbor order.** I pinned `(+1,0), (+1,−1), (0,−1), (−1,−1), (−1,0), (−1,+1), (0,+1), (+1,+1)`: counter-clockwise from east, the hex order's rotation. It is tested.
  4. **A spatial mover with no position** (for example after a host deletes it) is rejected as the existing E-SPAT-01 kind `spatial` ("mover's position is missing"). The five move kinds don't cover that case.
  5. **Internal helpers kept out of the barrel.** `effectVars`, `copyTerrain`, `terrainRefusals` and `moveBudgetAst` are exported from their modules only for intra-runtime use.
  6. **`findPath` was refactored at ck2** to share `terrainAt`/`entryCost` with the walk; the ck1 tests still pass.
  7. **Two test expectations I got wrong by hand and corrected** (neither is an engine fault):
     - ck1's wall path costs 4, not 3;
     - ck3's two-threatener order follows initiative, which is seed-dependent.
  8. **Harness hazards:** none apply; no child process or transport harness was used.
  9. **S02 followUp point** "handle the `{kind:'move'}` MoveOutcome in the `if` chains": this needed no code. Both flatten chains fall through for non-wrapper kinds.
- **followUp:**
  - **For S04:**
    - Take harness pattern: `fight.respond('<reactor>.<reaction>', 'take', moverId)`. The path is planned at declare time (the gate) and re-planned from the paused cell on resume, using the current occupancy and the remaining budget.
    - A restored paused fight is in phase `resolved`, so `step()` forfeits and ends the turn.
    - Fixture pins for `emberMarchesHexPack`:
      - speed `3 + level`: hero 4, barrow-wight 5, grave-shambles 4;
      - bramble cost 2, standing-stone blocks, default reach 1;
      - the barrow-wight's attack always hits ac 10 (`byDefense['10'] = 9`).
    - `speed` appears on profiles only when `formulas.speed` is declared. S04 ck1 re-keys `character-profile.test.ts:309-329`, which was not touched and is green.
  - **Residuals (reported, not fixed):**
    - **R-GM-1:** confirmed at source. `offeredCount` is not in the envelope, so a post-restore `trigger:fired.offerIndex` restarts at 0. The CA-M5 parity tests compare no post-restore `trigger:fired`.
    - **R-GM-2:** confirmed at source. A `use`-raised offer restores to `resolved`. No test restores one.
    - Both belong to a future DB snapshot revision.
  - **Orchestrator:** recheck CA-M3/M4/M5 against `3af4127`/`dd88f0c` before S04. The arch delta for `v1-core.md:163` and the API delta are in `.program/signal/SESSION-03.arch.md`.
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:**
  - `src/runtime/combat/spatial.ts`
  - `src/runtime/combat/combat.ts`
  - `src/runtime/combat/resolve.ts`
  - `src/runtime/character-profile.ts`
  - `src/runtime/snapshots.ts`
  - `src/runtime/equipment.ts`
  - `src/runtime/display-roll.ts`
  - `src/runtime/index.ts`
  - `tests/runtime/combat/movement-geometry.test.ts`
  - `tests/runtime/combat/movement.test.ts`
  - `tests/runtime/fixtures/packs.ts`
  - `tests/snapshots/combat.test.ts`

### SESSION-04 — done 2026-09-30 (3/3: 40c4492, da9bf03, c23d563)

Orchestrator receive: all commits are inside the lease. typecheck, lint, format:check, build, check:isolation and check:security all exit 0; `pnpm test` 741/741 across 40 files; `pnpm exec vitest run tests/proofs/` 47/47 across 7 files. The arch delta was integrated. CAP-M1..M7 are verified against current sources at c23d563. The CI build-step hazard is closed.


- **session:** 04
- **status:** done
- **checkpoint:** 3
- **notes:** Generated themes move (CAP-M6) on lease revision 1, base `4ffa236`. Commits: ck1 `40c4492` (theme content + pin re-keys), ck2 `da9bf03` (movement journey), ck3 `c23d563` (README + CI). **CA-M6 producer landed.** Final content ids:
  - dark-fantasy: `stride` / `opportunist`, terrain `rubble {cost:2}` / `pillar {blocks:true}`, model `grid`, speed `4 + floor(grace / 4)`.
  - zombie-urban: `hustle` / `cheap-shot`, terrain `debris {cost:2}` / `barricade-wall {blocks:true}`, model `grid`, speed `4 + floor(vigor / 4)`.
  - wyldwood: `glide` / `bramble-snap`, terrain `bramble {cost:2}` / `standing-stone {blocks:true}`, model **`hex`**, speed `5 + floor(grace / 4)`.
  - Each reaction's effect is copied verbatim from the theme's melee action (`strike` / `baton-blow` / `strike`). The move action and then the reaction are appended to every class list and every statblock list: 7 lists in dark-fantasy, 7 in zombie-urban, 6 in wyldwood. Theme formulas use the `{expr}` form.
  - **Checkpoint 0:** no compiler source change was needed. `pipeline.ts` passes `spatial` and `formulas` through verbatim; the classes, bestiary and tables stages copy actions, classes and statblocks. All six abilities are present in every theme.
  - **CA-M3/M4/M5 at `4ffa236`:** event names, payloads, rejection kinds, the `respond(<reactor>.<reaction>, take, moverId)` pattern and the restored `resolved` phase all match the landed source.
  - **Capabilities:** CAP-M6 proven. Generated-content legs proven for CAP-M1 (wyldwood hex), CAP-M4 (generated reaction) and CAP-M7 (wyldwood minus spatial). CAP-M2, M3 and M5 re-exercised on generated content.
- **delivered:**
  - Theme content in the three JSONs, keeping each file's formatting style.
  - Pin re-keys (every assertion preserved except the pinned value):
    - `character-profile.test.ts:212-222` → inserted `'stride', 'opportunist'` after `'parry'`.
    - `character-profile.test.ts:309-329` → added `speed: evalPackFormula(rt.pack, 'speed', base)`.
    - `docs-run.test.ts:195` → appended `'stride', 'opportunist'` (Prettier wrapped it multi-line).
    - `grid-journey.test.ts:211-215` → dark-fantasy `+terrain {rubble:{cost:2}, pillar:{blocks:true}}`.
    - `grid-journey.test.ts:218-222` → zombie-urban `+terrain {debris:{cost:2}, 'barricade-wall':{blocks:true}}`.
    - `grid-journey.test.ts:223-227` → wyldwood `model 'grid'→'hex'` `+terrain {bramble:{cost:2}, 'standing-stone':{blocks:true}}`.
    - `pipeline.test.ts:430-432` → per-theme model (hex for wyldwood); the test title now reads "carries its model (grid; hex for wyldwood)"; reach assertions kept.
    - `coverage-floor.test.ts:167/:173` → per-theme `model`; header comment `:7-9` updated.
    - `docs-run.test.ts:49` unchanged (still 4 ```ts blocks).
  - New coverage-floor test per theme, "v1.5 movement": `formulas.speed` exists; exactly one move-tagged `move(...)` action and one `move:leaving-reach` reaction; the last two entries of every class and statblock list are `[move, reaction]`; `spatial.terrain` exists.
  - New `tests/proofs/movement-journey.test.ts` (9 tests).
  - README "Grid combat":
    - a "Movement, hex and terrain" subsection replaces the no-move-verb paragraph;
    - the restore-with-positions seam is kept as the host's teleport;
    - the dark-fantasy spatial example now shows its terrain;
    - the journey test is cited;
    - only ```json / ```text fences added.
  - ci.yml: `- run: pnpm build` added between typecheck and test in the `test` job, with a one-line comment.
- **verification:**
  - **Final HEAD `c23d563`:** `pnpm typecheck`, `lint`, `format:check`, `build`, `check:isolation` and `check:security` all exit 0.
  - `pnpm build && pnpm test` → **741/741, 40 files**: 729 baseline + 3 floor tests (ck1) + 9 journey tests (ck2). ck1 ran 732/732, 39 files.
  - `pnpm exec vitest run tests/proofs/` → 47/47, 7 files.
  - `pnpm exec vitest run tests/compiler/coverage-floor.test.ts` → 85/85, 1 file.
  - `pnpm exec vitest run tests/proofs/movement-journey.test.ts` → 9/9, 1 file (not over-selected).
  - ci.yml parsed with PyYAML: test job steps are install, typecheck, build, test.
  - **README block 03 held, proven by run:** docs-run passes after only the `:195` re-key (`d20[9]=9 < ac12` and the loot stack are unchanged), so adding actions consumed no RNG.
  - **Staged ck0 run (content applied, pins not yet re-keyed):** exactly the listed pins failed (7 tests), plus the `stages.test.ts` re-registration explained in surprises. `equipment-journey` and every other fight loop stayed green (F-P6g).
  - **Negative control:** with wyldwood switched back to `grid`, the journey fails steps 1–4; after restoring the file it is 9/9.
  - **Journey test → CAP/CA:**
    - step 1 (load: hex, terrain, speed, actions on every class and statblock) → CAP-M1 / CAP-M6 / CA-M6 (F-P4);
    - step 2 (hex glide around a standing-stone wall; path `(0,1),(1,1),(2,0)`, cost 4 including bramble 2, remaining 1; slot spent) → CAP-M1 / M2 / M3;
    - step 3 (the five kinds; each is one E-SPAT-01 rejection with `serialize()` byte-identical and the move slot still 1) → CA-M3;
    - step 4 (leaving reach → `foe.bramble-snap` offer → pause with `pendingMove {glide, (-3,0), 5}` → JSON snapshot → restore on a fresh runtime → phase `resolved` → offer `matchingEvent` `move:leaving-reach` → take in both fights → the hero's `ward-step` offer declined → the move resumes to `(-3,0)`; tails identical, with `trigger:fired` compared without `offerIndex`; `pendingTriggers` `[]` in both; `attack:rolled` and `damage:applied` present; only one `trigger:fired` after the take, the hero's own) → CAP-M4 / M5, CA-M4 / M5;
    - step 5 (rooted → `restricted`, nothing changes) → CA-M6 (rooted content);
    - step 6 (dark-fantasy grid: diagonal path `(1,1),(2,2),(3,3)` cost 3; the grave-shambles `opportunist` pauses, take, resume, arrives) → DD-M4 / CAP-M4 on grid;
    - step 7 (wyldwood minus spatial: glide is a no-op success, no `move:*` events, invalid terrain rides along) → CAP-M7 / CA-M7;
    - step 8 (two runs are byte-equal in events and state) → determinism;
    - step 9 (2v2, 4 hexes apart, the automated loop reaches `combat-over` within 200 steps, and wolves emit `move:advanced`) → DD16 retired.
  - **What was real:** everything runs on the production path — `generateCampaign` → Runtime → `profileFromCharacter` / `spawnMonster` → `startCombat` → `declare` / `respond` → `serializeCombat` / `deserializeCombat`. The only direct state setup is step 5's rooted condition push (S03's pattern).
- **surprises:**
  1. **`tests/compiler/stages.test.ts` also went red during the staged run.** It is not a separate pin: it imports `microTheme` from `./pipeline.test`, so vitest re-registers pipeline's tests under that file name. Re-keying `pipeline.test.ts` fixed both. No outside-lease edit was made.
  2. **Every hero class carries an `attack:rolled[target=self]` reaction** (ward-step / root-snare / parry). A taken opportunity attack therefore raises a second offer, and the move stays paused until that offer is also answered. The journey declines it explicitly, which is what makes the R-GM-1 `offerIndex` exclusion necessary.
  3. **An opportunity attack's `why.rule` is `actions.opportunist.attackBonus`**, not `actions.opportunist`. The journey matches on the prefix.
  4. **The journey uses seeded `Rng`, not `ScriptedRng`.** A restored fight rebuilds its dice stream from the snapshot's state words, so a scripted stream would break the take-parity leg. The rolled outcomes are asserted instead.
  5. **Seed-42 speeds:** wyldwood hero 5, thorn-wolf 5, briar-shade 6, hollow-wight 5; dark-fantasy hero 4, all four statblocks 4. Ability modifiers feed the formula; the profile shows raw scores of 10.
  6. **README wording:** "The grid is square" became "Dark-fantasy's grid is square", because wyldwood is now hex.
  7. **Harness hazards:** none apply; no child process or transport harness was used.
- **followUp:**
  - Carried items are still open, unchanged: F-M1, F-M2, the DD17a spells bridge, the browser determinism leg, and parse-once.
  - R-GM-1 (`offerIndex` restarts after restore) and R-GM-2 (a `use`-raised offer restores to `resolved`) remain with a future DB snapshot revision.
  - The arch delta (README "Grid combat" surface, theme content, CI step) is in `.program/signal/SESSION-04.arch.md`.
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:**
  - `src/compiler/themes/dark-fantasy.json`
  - `src/compiler/themes/zombie-urban.json`
  - `src/compiler/themes/wyldwood.json`
  - `tests/compiler/coverage-floor.test.ts`
  - `tests/compiler/pipeline.test.ts`
  - `tests/proofs/grid-journey.test.ts`
  - `tests/proofs/docs-run.test.ts`
  - `tests/runtime/combat/character-profile.test.ts`
  - `tests/proofs/movement-journey.test.ts`
  - `README.md`
  - `.github/workflows/ci.yml`
