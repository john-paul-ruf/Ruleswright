# SESSION-04 — Generated content moves: themes, movement journey, README, CI

> **Program:** Ruleswright
> **Feature:** grid-movement
> **Modules:** M04 (+ proofs, README, CI)
> **Depends on:** SESSION-03
> **Concurrent with:** —
> **Owns:** `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `tests/compiler/coverage-floor.test.ts`, `tests/compiler/pipeline.test.ts`, `tests/proofs/grid-journey.test.ts`, `tests/proofs/docs-run.test.ts`, `tests/runtime/combat/character-profile.test.ts`, `tests/proofs/movement-journey.test.ts`, `README.md`, `.github/workflows/ci.yml`
> **Reads:** `tests/proofs/equipment-journey.test.ts` (fight loop l.72-81), `src/compiler/theme.ts`, `src/compiler/pipeline.ts`, `src/compiler/theme-loader.ts`, `src/runtime/index.ts`, `src/runtime/combat/combat.ts`, `src/runtime/combat/spatial.ts`, `program/Ruleswright/mocks/spatial.html`, `program/Ruleswright/specs/database.md`, `tests/runtime/combat/movement.test.ts` (S03 harness patterns)
> **Resources:** —
> **Checkpoints:** 3

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M04 | Compiler themes | the three theme JSONs (`spatial` l.37/37/51; `actions`; class `actions` l.121-134 / 124-136 / 215-237; bestiary `actions` l.604-632 / 324-353 / 754-789; `formulas`; `rooted` restricts `actions.tagged:move`) | Content |
| M03 | Runtime (read) | S03's landed surface: `declare(id, {to})`, `startCombat({terrain})`, `deserializeCombat(..., {positions, terrain})`, `move:*` events, `pendingMove`, per-call offers, the derived `resolved` restore phase | What the journey drives |

## Context

The engine moves (S03). No generated campaign can yet, because no theme declares `speed`,
a move action, terrain kinds or an opportunity reaction. This session:
- adds that content (dark-fantasy and zombie-urban stay `grid`, wyldwood switches to
  `hex`, per DD-M3);
- re-keys every pin the content change breaks;
- proves the whole capability on generated content through the real transport;
- documents it (replacing the README's "There is no move verb in v1" paragraph);
- folds in the carried CI owner correction.

The pipeline already passes `spatial` through verbatim (`pipeline.ts:149-150`, typed
`SpatialDef`), so no compiler source changes. **Checkpoint 0:** confirm that by reading
`pipeline.ts`/`theme.ts`. If a source change turns out to be needed, return `blocked`
naming the path. Do not widen the lease.

## Capabilities

- **CAP-M6** (generated themes move): integration owner at ck2.
- **CAP-M1…M5, M7:** generated-content legs at ck2 (the journey).

The journey is the capability's acceptance proof. Unit legs were proven at S03.

## Contract Agreements

- **Checkpoint-0 recheck:** read S03's handoff in STATE.md and the landed
  `combat.ts`/`spatial.ts`. Confirm the event names, payload shapes, rejection kinds and
  resume reasons. **Committed source beats this prompt.**
- **CA-M6 content** (ids are kebab, coined per Custom Rule 6, no SRD names):

  | Artifact | dark-fantasy | zombie-urban | wyldwood |
  |---|---|---|---|
  | `formulas.speed` | `{ "expr": "4 + floor(grace / 4)" }` | `{ "expr": "4 + floor(vigor / 4)" }` | `{ "expr": "5 + floor(grace / 4)" }` |
  | move action (tag `move`, cost `{slots:{move:1}}`, effect `move(speed)`) | `stride` | `hustle` | `glide` |
  | reaction (cost `{slots:{reaction:1}}`, `trigger.on` `move:leaving-reach[target=self]`, `effect` = that theme's basic melee attack sequence) | `opportunist` | `cheap-shot` | `bramble-snap` |
  | `spatial.terrain` | `rubble {cost:2}`, `pillar {blocks:true}` | `debris {cost:2}`, `barricade-wall {blocks:true}` | `bramble {cost:2}`, `standing-stone {blocks:true}` |
  | `spatial.model` | `grid` (unchanged) | `grid` (unchanged) | **`hex`** |

  - REPLAN-GM-01 verified at `67f383b`: all three themes declare the abilities
    `might, grace, vigor, reason, insight, presence` (`stats.abilities[].id`), and theme
    formulas use the `{ "expr": ... }` object form (e.g. `initiative`). Keep the `speed`
    formulas exactly as tabled. Re-check at ck0; committed source wins.
  - Copy the reaction effect from the theme's own melee action. Do not invent new
    mechanics.
  - Append the move action and then the reaction at the **end** of every class `actions`
    list **and of every bestiary statblock's `actions` list** (F-P4, CA-M6 amended
    2026-09-30). Monsters must be able to close distance (the DD16 stalemate lesson), and
    they must hold the reaction. Journey step 1 asserts it on statblocks, step 4 needs the
    monster's `bramble-snap` offered, and step 6 needs a monster's `opportunist`.
- **CA-M7 leg:** grid-journey's `stripSpatial` wyldwood parity leg must still load and pass
  now that wyldwood carries `glide` (move content without `spatial` = no-op, CA-M7).

**Pins you re-key** (Pin-lease ownership convention; each is listed in the STATE
Verification Baseline). Every assertion is preserved except the pinned value itself.

| Pin | Re-key |
|---|---|
| `tests/proofs/docs-run.test.ts:195` warden actions | append `'stride', 'opportunist'` |
| `tests/runtime/combat/character-profile.test.ts:212-222` (test l.206-226) warden/hexer class-action **union**, first occurrence wins | **insert** `'stride', 'opportunist'` **after `'parry'`**, not at the end (F-P6c): `strike, cut-down, withdraw, brace, parry, stride, opportunist, hurl, long-shot, ward-glint, ember-surge`. Both classes end with the pair, and the union keeps the first occurrence |
| `tests/runtime/combat/character-profile.test.ts:309-329` whole zombie-urban profile deep-equal | add `speed: evalPackFormula(rt.pack, 'speed', base)` to the expected object (F-P6b). S03 emits `speed` only when `formulas.speed` is declared, so this pin goes red exactly when your content lands |
| `tests/proofs/grid-journey.test.ts:211-215` dark-fantasy `rt.pack.spatial` deep-equal | add `terrain: { rubble: { cost: 2 }, pillar: { blocks: true } }` (F-P6a) |
| `tests/proofs/grid-journey.test.ts:218-222` zombie-urban `spatial` deep-equal | add `terrain: { debris: { cost: 2 }, 'barricade-wall': { blocks: true } }` (F-P6a) |
| `tests/proofs/grid-journey.test.ts:223-227` wyldwood `spatial` deep-equal (`model` l.224) | `model: 'hex'` + `terrain: { bramble: { cost: 2 }, 'standing-stone': { blocks: true } }` |
| `tests/compiler/pipeline.test.ts:430-432` "each generated pack carries model grid" | per-theme expectation (`hex` for wyldwood); keep the reach assertions. `pipeline.test.ts:340-356` uses a hand-set theme spatial and is **unaffected** |
| `tests/compiler/coverage-floor.test.ts:167`, `:173` `model === 'grid'` | per-theme model (`hex` for wyldwood); the header comment l.9 |
| `docs-run.test.ts:49` exactly 4 ```ts blocks | **unchanged**: README additions use ```json / ```text fences only |

The terrain values above are the CA-M6 table's. If you coin different ids at ck0 (for
example, because of an id collision), the pins follow your content. Report it.

Run `pnpm build && pnpm test` at ck0 with the content change applied locally (not
committed), to discover any **other** pin. An unlisted pin inside this lease → re-key it
and report it. An unlisted pin outside the lease → return `blocked` naming it
(Orchestrator uses Controlled Lease Revision). This staged run also covers **F-P6g**:
fight loops outside the lease (e.g. `equipment-journey.test.ts:72-81`) try each of a
combatant's actions in order. The new actions are appended last, so they are only reached
when every earlier action fails. A move declared without `to` is a `no-destination`
rejection that changes nothing, so the loop moves on. If such a loop's outcome changes
anyway, return `blocked` naming it.

## Files to Create/Modify

| File | Action | What Changes |
|------|--------|--------------|
| `src/compiler/themes/dark-fantasy.json` | modify | `speed`, `stride`, `opportunist`, terrain; both appended to every class **and every statblock** action list |
| `src/compiler/themes/zombie-urban.json` | modify | `speed`, `hustle`, `cheap-shot`, terrain; both appended to every class and every statblock list |
| `src/compiler/themes/wyldwood.json` | modify | `model: "hex"`, `speed`, `glide`, `bramble-snap`, terrain; both appended to every class and every statblock list |
| `tests/compiler/coverage-floor.test.ts` | modify | model pins per theme; floor: every theme declares `formulas.speed`, a `move`-tagged `move(...)` action and a `move:leaving-reach` reaction |
| `tests/compiler/pipeline.test.ts` | modify | model pin re-key |
| `tests/proofs/grid-journey.test.ts` | modify | the three `spatial` pin re-keys (l.211-215, l.218-222, l.223-227) only |
| `tests/proofs/docs-run.test.ts` | modify | warden actions pin re-key only |
| `tests/runtime/combat/character-profile.test.ts` | modify | union pin l.212-222 (insertion after `parry`) + whole-profile pin l.309-329 (`speed`) only |
| `tests/proofs/movement-journey.test.ts` | create | CAP-M1…M7 on generated content |
| `README.md` | modify | "Grid combat": the movement/hex/terrain/leaving-reach section replaces the no-move-verb paragraph |
| `.github/workflows/ci.yml` | modify | `test` job: `- run: pnpm build` between `pnpm typecheck` and `pnpm test` |

## Implementation

### Checkpoint 1 — theme content + pin re-keys

Add the content in the table above. Keep each JSON file's formatting style: dark-fantasy
uses compact inline objects, wyldwood uses expanded ones. Re-key the listed pins.

**Commit when:** `pnpm typecheck` is 0; `pnpm build` passes; and `pnpm test` (whole suite)
is green. Specifically:
- coverage-floor passes with the new floor assertions;
- generation is deterministic (the existing two-run byte-equality tests still pass);
- the README quickstart block 03 expected output is unchanged: adding actions consumes no
  RNG. **Prove this by run, not assumption.** If it changes, return `blocked`: the README
  output is a doc pin, and re-keying it is in-lease, but it must be reported.

### Checkpoint 2 — the movement journey

`tests/proofs/movement-journey.test.ts`. Mirror grid-journey's header/`ScriptedRng`
idioms. Use generated packs only (`generateCampaign({theme: loadTheme(...), seed: 42})` →
`new Runtime(pack)`); no hand-built fixture stands in for production data.

1. **wyldwood (hex) load:** `rt.pack.spatial.model === 'hex'`; terrain kinds present;
   `formulas.speed` present; `glide`/`bramble-snap` present on **every** class and
   **every** statblock (F-P4).
2. **Hex move around terrain:**
   - hero (`profileFromCharacter`) vs a statblock (`spawnMonster`);
   - positions, plus terrain with a `standing-stone` wall and a `bramble` patch;
   - `declare('glide', {to})` → the path avoids the wall; bramble costs 2 (assert
     `move:advanced.cost` and `path`);
   - the position is updated; the move slot is spent.
3. **Rejections:** `out-of-range`, `occupied`, `blocked`, `unreachable`, `no-destination`,
   each with serialize-identical no-change.
4. **Leaving reach:**
   - the hero starts adjacent to the monster and glides away → `move:leaving-reach` → the
     monster's `bramble-snap` offered → the move is paused (`pendingMove` set);
   - **snapshot here** → JSON → restore (positions from the snapshot, same terrain);
   - the restored fight is in phase `resolved`, and its offer's `matchingEvent` is
     `'move:leaving-reach'` (S03 ck4, F-P2);
   - in both fights, `respond(offer, 'take', heroId)` resolves the attack at P, then the
     move resumes to the destination;
   - after the answer, `pendingTriggers` is `[]` in both fights, and no offer is
     re-raised (F-P1);
   - `move:*`, `attack:rolled` and `damage:applied` payloads and the final positions are
     identical across the two fights. Compare post-restore `trigger:fired` without
     `offerIndex` (R-GM-1).
5. **`rooted`:** a hero with `rooted` applied → `declare('glide')` rejects `restricted`.
6. **Square grid parity (dark-fantasy):** `stride` diagonal steps cost 1; a monster's
   `opportunist` fires the same way. grid-journey's verified assertions do not change,
   apart from the three `spatial` pins re-keyed at ck1.
7. **Theater parity:** wyldwood minus `spatial` loads; `glide` resolves as a no-op with no
   `move:*` events; terrain given → accepted and never consulted.
8. **Two-run determinism:** the same seed and script → byte-equal events and state.
9. **Monsters close the gap:** in a 2-vs-2 fight started 4 cells apart, an automated loop
   (glide/stride toward the nearest foe, else strike) ends in `combat-over` within 200
   steps. This is the DD16 stalemate retired by movement.

**Commit when:** `pnpm exec vitest run tests/proofs/movement-journey.test.ts` and the whole
`pnpm test` (after `pnpm build`) are green.

### Checkpoint 3 — README + CI

- README "Grid combat":
  - replace the "There is no move verb in v1" paragraph (around l.183-190) with the
    movement story: move actions as pack data, `speed`, `declare(id, {to})`, hex model,
    terrain placement, occupancy, the rejection kinds, leaving reach with pause/resume, and
    the snapshot `pendingMove`;
  - keep the restore-with-updated-positions sentence as the host's still-valid teleport
    seam;
  - cite `tests/proofs/movement-journey.test.ts`;
  - snippets use ```json / ```text only (**docs-run pins exactly 4 ```ts blocks**);
  - run Prettier on README.md.
- ci.yml: add `- run: pnpm build` to the `test` job before `- run: pnpm test`, with a
  one-line comment saying the loot/equipment journeys read `dist/`.

**Commit when:** `pnpm format:check` is 0 and `pnpm test` is green (docs-run included).
Also confirm ci.yml still parses:
`python3 -c "import yaml,sys;yaml.safe_load(open('.github/workflows/ci.yml'))"` if PyYAML is
present; otherwise inspect the indentation by eye and say so in the handoff.

## Verification

- All seven package gates: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`,
  `pnpm check:isolation`, `pnpm check:security`, `pnpm format:check`.
- CI proof commands as run in ci.yml: `pnpm exec vitest run tests/proofs/` and
  `pnpm exec vitest run tests/compiler/coverage-floor.test.ts`.
- For each of CAP-M1…M7, name the journey test that proves it.

## State Update

Report:
- status and checkpoints;
- the final content ids;
- every pin re-keyed (file:line, old → new), including grid-journey l.211-227 and
  character-profile l.212-222 / l.309-329;
- whether README block 03 output held;
- the journey test list mapped to each CAP/CA;
- the whole-suite count;
- surprises.

`followUp`: any carried item still open (F-M1, F-M2, DD17a spells bridge, browser leg,
parse-once), unchanged.
