# State Tracker — Ruleswright / combat-decomposition

## Program / Feature / Intent / Sessions

- **Program:** Ruleswright (`program/Ruleswright/`)
- **Feature:** combat-decomposition
- **Plan HEAD:** `52d4d2a` (source last changed at `c851de2`). Every gate is green there (*Verification Baseline*).
- **Planned:** 2026-10-04 by Planner
- **Intent:** a refactor that changes no behaviour. `src/runtime/combat/combat.ts` (1,809 lines; `class Combat` l.474 to about l.1730) and `src/runtime/snapshots.ts` (1,086 lines) are split by responsibility, along the lines the human named: declare/resolve, movement/terrain, and trigger handling, plus the snapshot halves. Events, their order, payloads, `why`, the `at` clock, combat state, snapshot JSON, and every export name and public signature stay as they are.
- **Sessions:** 3, serial (S01 → S02 → S03).

**Human answers on record (2026-10-04).** Planner asked three questions:
1. Plan combat-decomposition now and leave F-FP2 queued, or do F-FP2 first?
2. Include C1 (drop or keep `isLivePattern` as a public export) and C2 (one copy of `MAX_TABLE_DEPTH`)?
3. Is there a target size per file?

The human answered: "**1 decomp first 2 recommend 3 none**". Read against the questions:
- **1:** decomposition first; F-FP2 stays queued (DD-D1).
- **2:** adopt Planner's recommendation for each item (DD-D9 keeps C1 as public API, no code; DD-D10 adds the C2 cross-pin test).
- **3:** no line target; split by responsibility (DD-D12).

## Session Status

| # | Session | Modules | Owns | Status | Checkpoint | Completed | Notes |
|---|---|---|---|---|---|---|---|
| S01 | Behaviour lock, combat spine, declare gates and effect execution | M03 | `src/runtime/combat/combat.ts`, `src/runtime/combat/types.ts`, `src/runtime/combat/combatants.ts`, `src/runtime/combat/fight.ts`, `src/runtime/combat/declare.ts`, `src/runtime/combat/execute.ts`, `src/runtime/combat/triggers.ts`, `tests/proofs/combat-characterization.test.ts`, `tests/runtime/combat/module-surface.test.ts` | pending | — | — | 5 checkpoints; ck1 changes tests only |
| S02 | Movement, terrain and trigger handling out of `Combat` | M03 | `src/runtime/combat/combat.ts`, `src/runtime/combat/movement.ts`, `src/runtime/combat/triggers.ts` | pending | — | — | 4 checkpoints |
| S03 | Split `snapshots.ts`; C2 cross-pin | M03, M01 (one comment), tests | `src/runtime/snapshots.ts`, `src/runtime/snapshots/index.ts`, `src/runtime/snapshots/envelope.ts`, `src/runtime/snapshots/character.ts`, `src/runtime/snapshots/combat.ts`, `src/schema/error-card.ts`, `tests/core/tables.test.ts` | pending | — | — | 2 checkpoints; deletes `snapshots.ts` (git CLI commit) |

## Wave Plan

| Wave | Sessions | Why concurrent |
|---|---|---|
| W1 | S01 | single: every combat session edits `combat.ts` |
| W2 | S02 | single: edits `combat.ts` and `triggers.ts`, which S01 also owns |
| W3 | S03 | single by choice. Its lease is disjoint from S01/S02, but `snapshots.ts` imports `./combat/combat`, and its gates (`tests/snapshots`, characterization legs 7–8) run the combat code S01/S02 rewrite in the same working tree. Standing rec 82b4e0ab: a sibling's uncommitted edits turn another worker's gates red. The cost is one short serial session. |

## Dependency Graph

```
S01 (types/combatants/fight/declare/execute + behaviour lock)
  └─► S02 (movement.ts, trigger answering in triggers.ts — needs FightCore, declare.ts, execute.ts)
        └─► S03 (snapshots/ split — imports ./combat/combat re-exports, final after S02)
```

## Architecture Reference (feature-specific)

Final layout of `src/runtime/combat/` (M03 internal; no new module ID; no cross-module edge):

| File | Responsibility | Value-imports (internal) |
|---|---|---|
| `types.ts` (S01) | all combat types (`CombatantState` … `StartCombatRequest`, `CastSlot`) | none |
| `combatants.ts` (S01) | pure combatant facts: `isDowned`, `defeatedSide`, `combatantFeats`, `copyBindings`, `profileOf`, `reachOf`, `ruleBaseOf`, `validityVars`, `applyMutation` | none |
| `fight.ts` (S01) | `FightCore`: the fight's mutable internals and shared primitives (`setClock`, `collect`, `reject`, `surfaceOffers`) | `./triggers`, `./combatants` |
| `declare.ts` (S01) | declare gates and spend helpers | `../conditions`, `./spatial`, `./combatants` |
| `execute.ts` (S01) | effect execution, shape resolution, end rule | `./resolve`, `../display-roll`, `./combatants` |
| `movement.ts` (S02) | movement gate, walk, pause/resume/forfeit, terrain refusals | `./spatial`, `./resolve`, `../../core/dsl/formula`, `../errors`, `./declare`, `./combatants` |
| `triggers.ts` (S01/S02) | offer grammar and emission (unchanged), plus answering offers | `./declare`, `./execute`, `./action-economy`, `./combatants` |
| `combat.ts` | `startCombat`, `class Combat` (public verbs, turn advance), re-exports | all of the above |
| `resolve.ts`, `spatial.ts`, `action-economy.ts` | unchanged | unchanged |

`src/runtime/snapshots/` (S03): `envelope.ts` (identity gate and shared helpers), `character.ts`, `combat.ts` (value-imports `../combat/combat`), `index.ts` (re-exports). `src/runtime/index.ts` is not edited.

## Scope Summary

| ID | Module | Change |
|---|---|---|
| M03 | Runtime | `combat/` gains 6 files; `combat.ts` shrinks; `snapshots.ts` → `snapshots/` (4 files). No export, signature, event or snapshot change. |
| M01 | Schema | `error-card.ts` l.46 comment only (S03) |
| — | tests | 2 new files (S01), 1 added case (S03). No existing assertion changed. |

Out of scope, carried with their owners:
- **F-FP2 class features:** the next feature. It needs a human product decision and a human-authorized DB re-entry; owner: next Planner run.
- **F-R6:** the `mocks/progression.html:70-80` copy; owner: Designer re-entry.
- **`spells.tagged:` load integrity:** needs a human decision.
- **C3/C4/C7/C10:** surface/item-tags tracking, unaffected.
- **The carried ledger in `arch/v1-core.md`:** unaffected.

**Inherited reconciliation.** Sources inspected:
- builder-rulings `FINAL-REPORT.md`, `VERIFICATION.md` (8 verified, 0 failed, 0 present-unverified, 0 blocked: no inherited shortfall), MASTER and STATE;
- `ARCHIVIST-LOG.md` (standing recommendations and the cleanup ledger at `12ca6ac`);
- PROGRAM-CONFIG at `52d4d2a`.

`.program/ledger.md` and `.program/blockers.md` were not inspected. They are gitignored scratch, and they are a limitation of this inspection, not a reconciled source.

Dispositions:
- **C1** (`isLivePattern`, no non-test consumer): disproved as cleanup and kept as public API (DD-D9). No code; Archivist marks the ledger row.
- **C2** (`MAX_TABLE_DEPTH` twice): resolved by a cross-pin test, S03 ck2 (DD-D10). The ledger row closes on landing.
- **Standing recs that shape this plan:**
  - b32fc8d0: checkpoint-scoped reading;
  - 82b4e0ab: serial waves;
  - 3658f327: deletion committed with the git CLI;
  - 6f6b491b: `pnpm exec vitest`, never bare `npx`;
  - c187bed6: Orchestrator force-adds gitignored prompts files;
  - f4621ac1: behaviour/doc pin audit below;
  - 8039d686: cases cited by name, snippets marked illustrative.

## Design Decisions

- **DD-D1 (human Q1):** decomposition before F-FP2. Class features would add more code to `Combat`; splitting first makes that feature cheaper.
- **DD-D2:** a refactor with no behaviour change. No contract file, mock, spec, README, `src/runtime/index.ts` or existing test assertion changes. S01–S02 leases contain no existing test file, so the lease mechanically freezes the suite. S03 adds one case to `tests/core/tables.test.ts`.
- **DD-D3: `FightCore` + `state` accessor.** Moving stateful private methods into free functions needs one object that holds the fight's internals: `state`, `rng`, `grants`, the offer queue, counter and surfaced set. Making `Combat` members public would widen the `.d.ts` surface. `Combat` therefore holds `private readonly core: FightCore` and exposes `get state()`/`set state()`.
  - The setter is required: `tests/runtime/combat/movement.test.ts:560` assigns `fight.state`.
  - `pendingTriggers` stays a readonly field holding the same array instance, because `snapshots.ts` pushes into it.
  - The only public `.d.ts` delta is `state: CombatState;` → `get state(): CombatState; set state(next: CombatState);`. It is type-compatible for every consumer, and V5 checks it.
  - *Rejected:* `@internal` public members (they leak into `dist/*.d.ts`, since tsup does not strip them); `this` casts (type-unsafe).
- **DD-D4:** `Combat.declare`/`use`/`respond`/`step`, `startCombat` and the turn advance stay in `combat.ts`.
  - The validity-gate block stays inline in `declare`, with the literal `this.runtime.index.validAsts[actionId]`. **Behaviour pin:** `tests/runtime/combat/combat-spatial.test.ts:511-515` reads `combat.ts`'s source and asserts that literal is present and that `parseFormula`/`parseEffect` are absent.
  - Moving the declare pipeline itself would also create a `declare.ts` ⇄ `movement.ts` cycle (the pipeline calls the movement gate; the resume calls the restriction gate).
- **DD-D5:** `combat.ts` keeps exporting every value and type it exports today, as re-exports where the symbol moved. Tests import from `src/runtime/combat/combat` directly (STATE *Pin audit*), and `snapshots.ts` imports six helpers from it. New internal helpers are **not** added to `src/runtime/index.ts`.
- **DD-D6:** the value-import DAG in *Architecture Reference*. No moved file value-imports `combat.ts`. `fight.ts` is value-imported only by `combat.ts`; the others take `FightCore` as a type.
- **DD-D7:** `snapshots.ts` → `snapshots/` directory, following the v1-shell `validate.ts` → `validate/` precedent. Importers keep the path `…/runtime/snapshots` (`moduleResolution: "bundler"`). The deletion is committed with the git CLI (3658f327).
- **DD-D8: characterization test.**
  - `tests/proofs/combat-characterization.test.ts` pins `packContentHash` digests of the whole event stream and the snapshots for 8 scripted legs through the public barrel. Each leg also asserts its defining events are present.
  - The digests are captured from unmodified source at S01 ck1, and a negative control is required.
  - **It is a behaviour pin.** Its re-key owner is any later feature that intentionally changes combat events or snapshot output; that feature's pin audit lists it.
- **DD-D9 (human Q2 → recommendation): C1 retired, kept as public API.** `isLivePattern` is on the runtime barrel (`index.ts:56`) of a published package, and `conditions.test.ts:78-79` pins it. Removing it is a breaking surface change, and this feature promises none.
- **DD-D10 (human Q2 → recommendation): C2 resolved by cross-pin.**
  - A single source would need M01 → M02 or M02 → M01 value imports, and the layering forbids both: "M01 imports nothing internal" and "M02→M01 remains type-only".
  - The precedent is EQUIPMENT_SCALARS ↔ RESERVED_GRANT_KEYS: declared separately and pinned together (`tests/core/dsl/formula.test.ts:248-250`).
- **DD-D11:** serial waves (see *Wave Plan*).
- **DD-D12 (human Q3):** no line target. S01's gate/execution moves and S02's movement/trigger moves are split by responsibility. Line counts are reported, not gated.

## Pin audit (behaviour + doc pins; PROGRAM-CONFIG convention)

The facts being changed are *where symbols live* and *how `Combat` holds its internals*. Greps at `52d4d2a`:
- `grep -rnE "from '[./]*(src/)?runtime/(combat/|snapshots)" tests src README.md scripts`
- `grep -rnE "readFileSync\(|readdirSync\(" tests`
- `grep -rnE "\.state = " tests src`
- `grep -rnE "combat\.ts|snapshots\.ts|combat/combat|runtime/snapshots" README.md .github scripts src program/Ruleswright/mocks`

| Hit | Fact pinned | Disposition / owner |
|---|---|---|
| 12 test files import `src/runtime/combat/combat`: `combat.test.ts`, `combat-spatial.test.ts`, `spatial-triggers.test.ts`, `self-target.test.ts` (`isSelfAction`), `movement.test.ts`, `feat-triggers.test.ts`, `spells.test.ts`, `snapshots/combat.test.ts`, `proofs/{grid-journey,perf-budget,rules-are-data}.test.ts`, `runtime/encounter.test.ts` | those names are exported from that path | holds under DD-D5 (re-exports); S01 ck1 pins the value names exactly |
| 7 test files import `src/runtime/snapshots`: `snapshots/{character,combat}.test.ts`, `runtime/inventory.test.ts`, `runtime/combat/{spells,movement,combat}.test.ts`, `proofs/perf-budget.test.ts` | the path resolves, with today's names | holds under DD-D7 (dir index); S01 ck1 pins the value names; S03 proves it |
| `tests/runtime/combat/spatial-triggers.test.ts:28` imports `eventMatches`, `reactiveActionsFor` from `combat/triggers` | names stay | holds; `triggers.ts` keeps all 7 exports (S01 ck1 `arrayContaining` pin) |
| `tests/runtime/combat/combat-spatial.test.ts:511-515` reads `combat.ts` source | literal `this.runtime.index.validAsts[actionId]` present; no `parseFormula`/`parseEffect` | **holds by construction** (DD-D4); owner S01 ck4. S01 ck1 widens the no-parse intent to all `combat/*.ts` except `resolve.ts`, in a new file |
| `tests/runtime/combat/movement.test.ts:560` `fight.state = {…}` | `Combat.state` is assignable | holds via the DD-D3 setter; owner S01 ck3 |
| `tests/snapshots/root.test.ts:42-48` | root adds no names beyond the three surfaces | holds (no barrel change) |
| `src/runtime/index.ts:84`, `:100` | barrel paths `./snapshots`, `./combat/combat` | hold; file not edited |
| `src/schema/error-card.ts:46` comment "enforced by runtime/snapshots.ts" | doc pin | **becomes stale at S03 ck1**; S03 owns it (comment → `runtime/snapshots/`) |
| `mocks/dice.html:40` "combat.ts — API illustrative" | illustrative label | holds (`combat.ts` still exists); Author-owned, no action |
| `arch/v1-core.md` (23 lines name `combat.ts`/`snapshots.ts`/`triggers.ts`, many with line numbers) | arch citations | Orchestrator integrates each session's arch delta; final Archivist re-keys them |
| PROGRAM-CONFIG Module Registry M03 *Key Files* and intra-module notes (`snapshots.ts → {character, progression, combat/combat}`, `combat/combat.ts → combat/triggers.ts`) | registry facts | final Archivist pass re-derives them from value imports |
| README | no hit for any moved path or symbol location | — |

The count/shape pins touched are `tests/runtime/combat/module-surface.test.ts` (new) and the characterization digests (new). Both are owned by S01, and neither is re-keyed in this feature. No existing count pin (docs-run, registry, coverage-floor) is affected: no README block, rule id or content changes.

## Verification Baseline

Recorded at `52d4d2a`, 2026-10-04, by Planner. Every result below was **actually run** in this planning pass.

| # | Command (argv) | Scope | Result at `52d4d2a` |
|---|---|---|---|
| V1 | `pnpm typecheck` | `tsc --noEmit` over `src` + `tests` | exit 0 |
| V2 | `pnpm lint` | ESLint, whole repo | exit 0 |
| V3 | `pnpm format:check` | Prettier, whole repo | exit 0 |
| V4 | `pnpm build`, then `node -e "const fs=require('fs');const crypto=require('crypto');for(const f of ['dist/runtime.d.ts','dist/index.d.ts']){const s=fs.readFileSync(f,'utf8');const m=[...s.matchAll(/^export \{([^}]*)\};?$/gms)];const names=m.flatMap(x=>x[1].split(',').map(t=>t.trim()).filter(Boolean)).map(t=>t.replace(/^type /,'')).sort();console.log(f,m.length,names.length,crypto.createHash('sha256').update(names.join('\n')).digest('hex').slice(0,16));}"` | the rolled `.d.ts` export lists (values + types) | `dist/runtime.d.ts 1 151 b3a0b27d400a8289`; `dist/index.d.ts 1 221 be8f98762c3bdcad` |
| V5 | after V4: `node -e "const fs=require('fs');const s=fs.readFileSync('dist/runtime.d.ts','utf8');const i=s.indexOf('declare class Combat {');const j=s.indexOf('\n}\n',i);console.log(s.slice(i,j).split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('/**')&&!l.startsWith('*')&&!l.startsWith('private ')).join('\n'))"` | `Combat`'s public members | 13 members: `readonly runtime: Runtime;` · `state: CombatState;` · `readonly pendingTriggers: PendingTrigger[];` · `constructor(runtime: Runtime, state: CombatState, rng?: Rng, options?: { readonly offeredCount?: number; });` · `get offeredCount(): number;` · `get roundComplete(): boolean;` · `step(): StepOutcome;` · `declare(actionId: string, options?: DeclareOptions): readonly RuntimeEvent[];` · `use(itemId: string, options?: UseOptions): readonly RuntimeEvent[];` · `respond(triggerId: string, choice: 'take' \| 'decline', targetId?: string): readonly RuntimeEvent[];` · `serialize(): CombatState;` · `eventsSince(round: number): readonly RuntimeEvent[];` · `declareReactive(offer: PendingTrigger, targetId: string \| undefined): readonly RuntimeEvent[];`. **Allowed delta (DD-D3):** `state: CombatState;` → `get state(): CombatState;` + `set state(next: CombatState);` |
| V6 | `pnpm test`; `pnpm check:isolation`; `pnpm check:security` | whole suite; runtime bundle carries no compiler strings; no banned calls | `Test Files 50 passed (50)`, `Tests 923 passed (923)`, 2.09 s; isolation ✓ (24 dist files); security ✓ |

- **Lease-scoped gate form:** `pnpm exec vitest run <paths>` (PROGRAM-CONFIG). `pnpm test -- <pattern>` does not filter. Bare `npx` misresolves here (6f6b491b).
- **Expected counts:**
  - After S01 ck1: 52 files and N₁ tests. S01 records N₁, which stays constant through S02 and S03 ck1.
  - After S03 ck2: N₁ + 1.
- **Hazards:**
  - None known for these gates. No hang or zero-discovery is recorded for these commands in the inspected run records.
  - The `docs-run` README compile leg takes about 0.8 s.
  - `dist/` is gitignored build output. V4/V5 read the build just produced, so run `pnpm build` immediately before them in the same checkpoint (artifact freshness).
- **Inspected and not run:** CI (`.github/workflows/ci.yml`: Node 18/20/22 matrix) is CI's job (Custom Rule 5). Locally the runtime is Node v24.20.0.

## Capability Readiness

| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|---|---|---|---|---|---|---|---|
| CAP-D1 | Combat behaviour unchanged: `startCombat`, `Combat.step/declare/use/respond/declareReactive/serialize` produce the same events (type, order, payload, `why`, `at`), state and offers as at `52d4d2a` | the base behaviour itself (`combat.ts` at `52d4d2a`); the lock is the S01 ck1 characterization test | CA-D1, CA-D2, CA-D4 | S02 ck4 (the last combat move); first lock at S01 ck1 | planned | `tests/proofs/combat-characterization.test.ts` (planned, S01 ck1) + the 50 existing files unmodified; checked sources: `combat.ts`, `triggers.ts`, `resolve.ts` at `52d4d2a` | — |
| CAP-D2 | Snapshot behaviour unchanged: `serializeCharacter/Party/Combat`, `restoreCharacter/Party`, `deserializeCombat` produce/accept/refuse identical JSON | `snapshots.ts` at `52d4d2a` | CA-D1, CA-D3 | S03 ck1 | planned | characterization legs 7–8 (S01 ck1) + `tests/snapshots/**` unmodified | — |
| CAP-D3 | Public surface unchanged: value exports of the runtime barrel, `combat/combat`, `snapshots`; the `.d.ts` export lists; `Combat`'s public members | V4/V5 base values above; `src/runtime/index.ts` | CA-D1 | S03 ck2 (feature-final); also S01 ck5 and S02 ck4 | planned | `module-surface.test.ts` (S01 ck1), V4, V5 | — |
| CAP-D4 | Cleanup dispositions: C1 retired as public API; C2 constants pinned equal | `core/tables.ts:32`, `schema/validate/helpers.ts:544` | CA-D5 | S03 ck2 | planned | new case in `tests/core/tables.test.ts` + negative control | Archivist updates the ledger rows C1/C2 at the final pass |

**First narrow journey:** S01 ck1's characterization test goes host → `src/runtime` barrel → `startCombat` → declare/use/respond/step → `serializeCombat` → JSON → `deserializeCombat` → continue. It is the real public entry over real generated packs and seeded `Rng`, and it lands before any source moves. Every later checkpoint depends on it staying green unchanged.

## Contract Agreements

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|---|---|---|---|---|---|---|---|
| CA-D1 | Public surface identical (DD-D2, DD-D5) | moved symbols → `combat.ts`/`snapshots/index.ts` re-exports → `src/runtime/index.ts`, tests, `dist/*.d.ts` | every value and type name exported today from `src/runtime/index.ts`, `src/runtime/combat/combat`, `src/runtime/snapshots` stays exported under the same name; `triggers.ts`'s 7 values stay; the only public `.d.ts` member delta is the `state` accessor | S01 (pin ck1, proof ck5), S02 ck4, S03 ck1/ck2 | agreed | ready (base) | planned: `module-surface.test.ts`, V4, V5; checked `index.ts` l.1-170, `dist/runtime.d.ts` at `52d4d2a` |
| CA-D2 | Event stream and state equivalent (FR-10/FR-13 provenance; DD-M10 pause/resume; DD-S12 no-chain; DD-S14 offer counter) | `Combat` verbs → moved functions over `FightCore` → `EventStream` → host | each moved body is verbatim except `this.` → `core.`/argument; the nesting order of `core.collect` and `executeBound`'s sink unchanged; `surfaceOffers` per-call order unchanged; `setClock` call sites unchanged; `state` replaced by whole-object reassignment exactly where it is today | S01 ck1–ck5, S02 ck1–ck4 | agreed | ready (base) | planned: characterization digests (S01 ck1, negative control required) + full suite unmodified |
| CA-D3 | Snapshot JSON and refusals equivalent (FR-14, CA-1, DD-S14) | `snapshots/{character,combat}.ts` → envelope JSON → host / `deserializeCombat` | verbatim move; `SNAPSHOT_VERSION`, `COMBAT_PHASES`, `UINT32_MAX_WORD`, refusal card order unchanged; `snapshots.schema.json` untouched | S03 ck1 | agreed | ready (base) | planned: characterization legs 7–8 + `tests/snapshots/**` unmodified |
| CA-D4 | Layering preserved (PROGRAM-CONFIG Architecture; runtime never imports compiler) | new files → value imports | the DAG in *Architecture Reference*; no value cycle among `combat/*.ts`; no new cross-module edge; `combat/*.ts` except `resolve.ts` never names `parseFormula`/`parseEffect` (CA-2 discipline) | S01 ck5, S02 ck4, S03 ck1 (each derives its imports mechanically) | agreed | ready (base) | planned: grep derivation per session; `module-surface.test.ts` no-parse sweep; `pnpm check:isolation` |
| CA-D5 | The table-depth bound is one value in both layers (database.md: bounded at load, E-TBL-01) | `core/tables.ts:32` and `schema/validate/helpers.ts:544` → `rollTable` / `checkTables` | equal; declared separately (layering) and pinned together | S03 ck2 | agreed | ready (both 8 at `52d4d2a`) | planned: new `tables.test.ts` case + negative control |

No CA is provisional: every producer is the committed base behaviour.

## Current Blockers

None. No human input is outstanding. Before S01 dispatches, request a scoped Archivist planning-completeness pass (D1–D7). If it finds a defect, correct the affected session before dispatch.

## Handoff Notes

<!-- Orchestrator appends each session's Handoff (notes + followUp) verbatim here. Do not pre-fill. -->
