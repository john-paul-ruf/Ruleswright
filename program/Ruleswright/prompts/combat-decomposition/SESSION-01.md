# SESSION-01 — Behaviour lock, combat spine, declare gates and effect execution

> **Program:** Ruleswright
> **Feature:** combat-decomposition
> **Modules:** M03 (internal only)
> **Depends on:** —
> **Concurrent with:** —
> **Owns:** `src/runtime/combat/combat.ts`, `src/runtime/combat/types.ts`, `src/runtime/combat/combatants.ts`, `src/runtime/combat/fight.ts`, `src/runtime/combat/declare.ts`, `src/runtime/combat/execute.ts`, `src/runtime/combat/triggers.ts`, `tests/proofs/combat-characterization.test.ts`, `tests/runtime/combat/module-surface.test.ts`
> **Reads:** `src/runtime/**`, `src/schema/version.ts`, `src/core/dsl/formula.ts`, `src/core/dsl/effect.ts`, `tests/**`, `program/Ruleswright/prompts/combat-decomposition/STATE.md`
> **Resources:** —
> **Checkpoints:** 5

**Authorization on record (quote it; do not re-litigate it).** On 2026-10-04 the human answered: "**1 decomp first 2 recommend 3 none**". STATE.md *Human answers on record* maps this to DD-D1, DD-D9/DD-D10 and DD-D12. This session changes no behaviour, no contract and no public export.

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M03 | Runtime | `combat/combat.ts`: types l.73-232, `startCombat` l.235-364, `copyBindings` l.367, `flattenResolutions` l.449, `rngStateOf` l.464, `class Combat` l.474-1730, free functions l.1733-1809 | the file being split |
| M03 | Runtime | `combat/triggers.ts` l.21-24 (type imports from `./combat`), `offersForEvent` l.78, `emitOffer` l.115, `emitDeclined` l.132 | `surfaceOffers` moves onto `FightCore`; type imports switch to `./types` |
| M03 | Runtime | `combat/resolve.ts` `executeAgainst` l.314, `effectVars` l.363 | `execute.ts` calls these |
| M03 | Runtime | `index.ts` l.85-100 (the barrel's `./combat/combat` block) | the surface that must not move |
| M01 | Schema | `version.ts` `packContentHash` l.45 | digest for the characterization test |

**Read by checkpoint, not all at once** (standing rec b32fc8d0: big read sweeps at checkpoint 0 have crashed long sessions). Checkpoint 0 reads only the line ranges named in *Contract Agreements* below.

## Context

`src/runtime/combat/combat.ts` is 1,809 lines. `class Combat` (l.474 to about l.1730) holds the turn loop, every declare gate, effect execution, movement, terrain and trigger answering. The small files beside it (`resolve.ts` 397, `spatial.ts` 375, `triggers.ts` 155, `action-economy.ts` 211) already hold the pure pieces. This feature moves the rest into files by responsibility. **Nothing a host can see changes.** That covers events, their order, payloads, `why`, the `at` clock, state, snapshots and exports.

This session does four things:
1. Locks today's behaviour with two new tests, before any source moves.
2. Moves the types and pure combatant helpers out of `combat.ts`.
3. Gives the class's mutable internals one home, `FightCore`. Free functions in other files can then operate on a fight without making `Combat` members public.
4. Moves the declare gates and the effect-execution code out of the class.

SESSION-02 moves movement/terrain and trigger answering. SESSION-03 splits `snapshots.ts`.

**Target layout after this session** (value-import DAG; type-only imports are free):

| File | Holds | Value-imports (internal) |
|---|---|---|
| `combat/types.ts` (new) | every type `combat.ts` exports today, plus `CastSlot` | none (`import type` only) |
| `combat/combatants.ts` (new) | `isDowned`, `defeatedSide`, `combatantFeats`, `copyBindings`, `profileOf`, `reachOf`, `ruleBaseOf`, `validityVars`, `applyMutation` | none |
| `combat/fight.ts` (new) | `class FightCore`: `runtime`, `state`, `rng`, `grants`, `pendingTriggers`, `offerCounter`, the surfaced `WeakSet`; `setClock`, `collect`, `reject`, `surfaceOffers` | `./triggers` (`offersForEvent`, `emitOffer`), `./combatants` (`isDowned`) |
| `combat/declare.ts` (new) | `restrictionRejection`, `resolveTarget`, `spatialGate`, `atRefusal`, `rangeGate`, `selfTargetRefusal`, `isSelfAction`, `pickSlot`, `applyNonSlotCosts`, `castPayload` | `../conditions`, `./spatial`, `./combatants` |
| `combat/execute.ts` (new) | `resolveShape`, `flattenResolutions`, `executeBound` (was `execute`), `resolveAction` (was `resolve`), `boundActionOf`, `endIfSideDefeated` | `./resolve`, `../display-roll`, `./combatants` |
| `combat/combat.ts` | `startCombat`, `rngStateOf`, `class Combat` (constructor, `step`, `declare`, `use`, `respond`, `serialize`, `eventsSince`, `declareReactive`, `endTurn`, `advanceFrom`, plus movement/trigger internals until SESSION-02), and the re-exports | all of the above |

**No file in this table value-imports `./combat`.** `triggers.ts` keeps only `import type { Combat } from './combat'` for `resolveTriggered`.

## Capabilities

| CAP | This session | Checkpoint |
|---|---|---|
| CAP-D1 combat behaviour unchanged | lands the lock (ck1); preserves it across the spine, gate and execution moves (ck2–ck5). **First narrow journey:** the characterization test runs through the real public entry (`src/runtime` barrel → `startCombat` → `declare`/`use`/`respond`/`step` → `serializeCombat` → JSON → `deserializeCombat` → continue). It lands at ck1 against unmodified source. | ck1, ck5 |
| CAP-D3 public surface unchanged | lands the pin (ck1); proves it at ck5 | ck1, ck5 |

Production path: host → `src/runtime/index.ts` → `combat/combat.ts` `Combat` → the moved helpers → `resolve.ts` executor → `events.ts` stream. It is an in-process library, so there is no transport and no storage. "Restart" is the snapshot JSON round trip, which the characterization test exercises.

## Contract Agreements

CA-D1 (public surface), CA-D2 (event/state equivalence) and CA-D4 (layering) apply. STATE.md has the full rows. **Checkpoint-0 recheck (read-only).** If any item fails, return `blocked` with the evidence:
- `git rev-parse --short HEAD` descends from `52d4d2a`, and `git diff --stat 52d4d2a -- src tests` is empty, or shows only this plan's sessions.
- `combat.ts` l.474 is `export class Combat {`, and l.1808 is `export type { SlotLedger, SlotGrants };`.
- `tests/runtime/combat/combat-spatial.test.ts` l.511-515 reads `combat.ts` source and asserts `toContain('this.runtime.index.validAsts[actionId]')`. **This is a behaviour pin:** the validity-gate block stays inline in `Combat.declare`, with that literal text (DD-D4).
- `tests/runtime/combat/movement.test.ts` l.560 assigns `fight.state = {…}`. `Combat.state` must stay assignable (DD-D3).
- `src/schema/version.ts` l.45 is `export function packContentHash(json: unknown): string`.

## Files to Create/Modify

| File | Action | What Changes | ck |
|---|---|---|---|
| `tests/runtime/combat/module-surface.test.ts` | create | value-export pins + the CA-2 discipline sweep | 1 |
| `tests/proofs/combat-characterization.test.ts` | create | whole-stream digests of scripted fights + snapshots | 1 |
| `src/runtime/combat/types.ts` | create | the moved types + `CastSlot` | 2 |
| `src/runtime/combat/combatants.ts` | create | the pure combatant helpers | 2 |
| `src/runtime/combat/triggers.ts` | modify | type imports from `./types` (l.24); no other change | 2 |
| `src/runtime/combat/fight.ts` | create | `FightCore` | 3 |
| `src/runtime/combat/declare.ts` | create | declare gates + spend helpers | 4 |
| `src/runtime/combat/execute.ts` | create | effect execution + end rule | 5 |
| `src/runtime/combat/combat.ts` | modify | shrinks; re-exports everything it exports today | 2–5 |

## Implementation

### Checkpoint 1 — Behaviour lock (tests only; no `src/` change)

**`tests/runtime/combat/module-surface.test.ts`:**
- `import * as runtimeSurface from '../../../src/runtime/index'`. Assert `Object.keys(runtimeSurface).sort()` `toEqual` a literal array captured at base, so value exports are pinned exactly.
- The same exact pin for `import * as combatModule from '../../../src/runtime/combat/combat'` and `import * as snapshotsModule from '../../../src/runtime/snapshots'`. Tests and `snapshots.ts` import from these paths directly (`tests/runtime/combat/self-target.test.ts:14` imports `isSelfAction`; `snapshots.ts:46-57` imports six helpers), so their value names must survive.
- `import * as triggersModule from '../../../src/runtime/combat/triggers'`: assert `expect.arrayContaining` over its seven current value exports. New internal exports may be added there in SESSION-02.
- **CA-2 discipline sweep:** for every `src/runtime/combat/*.ts` except `resolve.ts`, the source contains neither `parseFormula` nor `parseEffect`. Use the `readdirSync` pattern of `tests/core/dsl/formula.test.ts:302-307`. This extends `combat-spatial.test.ts:511-515`'s intent, "the combat loop never parses at play time", to the files the loop now spans. That existing test stays untouched.

**`tests/proofs/combat-characterization.test.ts`.** This is a characterization test. It runs scripted fights through the public barrel and pins a digest of everything a host observes.
- **Legs.** Copy the setups from the named existing tests (read them at ck1); do not invent fixtures:
  1. A theater-of-mind attack exchange with a reactive-action offer taken and one declined (`tests/runtime/combat/combat.test.ts`, `spatial-triggers.test.ts` `parryFight`).
  2. A spatial move that pauses on `move:leaving-reach`, is answered, then resumes and arrives (`tests/proofs/movement-journey.test.ts`, wyldwood hex).
  3. A spell cast with a vancian slot and one with a point pool, one of them centered with `at` (`tests/proofs/spells-journey.test.ts`, `tests/runtime/combat/spells.test.ts`).
  4. A consumable `use` (`tests/proofs/equipment-journey.test.ts`).
  5. A reactive feat offered and taken (`tests/runtime/combat/feat-triggers.test.ts`).
  6. A self action (`tests/proofs/self-target-journey.test.ts`).
  7. A mid-fight `serializeCombat` → `JSON.parse(JSON.stringify(…))` → `deserializeCombat` with an open offer, then continued for at least one more step.
  8. `serializeCharacter`/`serializeParty` → `restoreCharacter`/`restoreParty` of one generated character.
  
  Use seeded `new Rng(n)` streams, as `movement-journey.test.ts` explains.
- **Per leg:** record every event from `runtime.events.on(sink)`, plus every snapshot produced. Assert **presence** of the leg's defining events by type: `trigger:declined`, `move:leaving-reach`, `move:ended` with `reason: 'arrived'`, `spell:cast`, `item:used`, `trigger:fired` with `source: 'feat'`, and so on. A leg that silently stops exercising its path then fails instead of pinning a smaller stream. Then assert `packContentHash(JSON.parse(JSON.stringify({ events, snapshots })))` equals a hex literal captured from base source.
- **Header comment:** state that this is a behaviour pin, and that its re-key owner is any later feature that intentionally changes combat events or snapshot output, which must list it in the plan's pin audit (PROGRAM-CONFIG pin-lease convention).
- **Negative control (record it; do not commit it):** perturb `src` in a scratch edit. For example, swap the `damage:applied` payload's `amount` and `hp` key order at `combat.ts` l.1453-1461, or emit `action:resolved` before setting `phase`. Confirm at least one digest fails, then revert with `git checkout -- src` and confirm green. Report the perturbation and the failing leg in the handoff.

**Commit when:** both new files pass at **unmodified** `src`. `git diff --stat -- src` is empty. `pnpm typecheck`, `pnpm lint` and `pnpm format:check` exit 0. `pnpm test` is green with 52 files (record the new test count N₁; it must stay constant through SESSION-02).

### Checkpoint 2 — `types.ts` and `combatants.ts`

- Move verbatim, JSDoc included, from `combat.ts` to `types.ts`: `CombatantState` (l.74), `PendingMove` (l.120), `CombatState` (l.127), `CombatPhase` (l.140), `PendingAction` (l.143), `PendingTrigger` (l.149), `DeclareOptions` (l.160), `DeclareRejection` (l.170), `UseOptions` (l.204), `StepOutcome` (l.209), `StartCombatRequest` (l.217), and `CastSlot` (l.1738, now exported from `types.ts` only). `types.ts` uses `import type` only.
- `combat.ts`: `export type { CombatantState, PendingMove, CombatState, CombatPhase, PendingAction, PendingTrigger, DeclareOptions, DeclareRejection, UseOptions, StepOutcome, StartCombatRequest } from './types';`.
- `combatants.ts`: move `isDowned` (l.1791), `defeatedSide` (l.1796), `combatantFeats` (l.1733) and `copyBindings` (l.367) verbatim. Convert these private methods to explicit-argument functions:
  - `profileOf(state)` (l.1634);
  - `reachOf(runtime, id)` (l.1322);
  - `ruleBaseOf(runtime, actionId)` (l.1652);
  - `validityVars(actor)` (l.1317);
  - `applyMutation(runtime, target, request)` (l.1659).
- `combat.ts` re-exports `isDowned`, `defeatedSide`, `combatantFeats` and `copyBindings` from `./combatants`. Call sites become `profileOf(x)`, `reachOf(this.runtime, id)` and so on. Bodies stay byte-identical apart from `this.` → the explicit argument.
- `triggers.ts` l.24: `import type { CombatantState, PendingTrigger } from './types';` plus `import type { Combat } from './combat';`.

**Commit when:** `pnpm typecheck`, `pnpm lint`, `pnpm format:check` exit 0; `pnpm test` green at N₁ with both ck1 files unchanged.

### Checkpoint 3 — `FightCore`

`fight.ts`:
```ts
export class FightCore {
  readonly pendingTriggers: PendingTrigger[] = [];
  offerCounter: number;
  private readonly surfaced = new WeakSet<RuntimeEvent>();
  constructor(
    readonly runtime: Runtime,
    public state: CombatState,
    readonly rng: Rng,
    readonly grants: SlotGrants,
    offeredCount: number,
  ) { this.offerCounter = offeredCount; }
  setClock(): void { /* combat.ts l.849-851 */ }
  collect<T>(work: () => T): { result: T; emitted: RuntimeEvent[] } { /* l.1251-1262 */ }
  reject(actorId: string, rejection: DeclareRejection): RuntimeEvent { /* rejectionEvent l.1679-1687 */ }
  surfaceOffers(events: readonly RuntimeEvent[], options: { readonly feats?: boolean } = {}): number { /* l.1520-1536 */ }
}
```
(Illustrative. The bodies are the cited methods moved verbatim with `this.` unchanged; the acceptance assertions are the authority.)

`Combat`:
- `private readonly core: FightCore` is built in the constructor. The constructor signature stays exactly `(runtime, state, rng = new Rng(state.rng), options = {})`, and `resolveSlotGrants(runtime.pack)` and `options.offeredCount ?? 0` are passed in.
- Add `get state(): CombatState { return this.core.state; }` and `set state(next: CombatState) { this.core.state = next; }` (DD-D3).
- Keep `readonly pendingTriggers: PendingTrigger[]`, assigned `this.core.pendingTriggers`: the **same array instance**. `snapshots.ts` pushes into it, and `endIfSideDefeated` truncates it with `length = 0`.
- `get offeredCount()` returns `this.core.offerCounter`.
- Delete the private `offerCounter`, `surfaced`, `grants`, `rng`, `setClock`, `collect`, `rejectionEvent` and `surfaceOffers` members. Call sites use `this.core.…`.

**Commit when:** the ck2 gates pass, and the `declare class Combat` public members in `dist/runtime.d.ts` (STATE *Verification Baseline* command V5) equal the base list, apart from `state: CombatState;` → `get state(): CombatState;` + `set state(next: CombatState);`.

### Checkpoint 4 — Declare gates → `declare.ts`

Move these to explicit-argument functions (bodies verbatim; `this.runtime` → `runtime`, `this.state` → `state`, `this.reachOf` → `reachOf(runtime, …)`):
- `restrictionRejection(runtime, actor, def, kind = 'action')` (l.863);
- `resolveTarget(state, actor, targetId, anyCombatant = false)` (l.894);
- `spatialGate(runtime, actor, target)` (l.944);
- `atRefusal(runtime, actionId, targetId)` (l.959);
- `rangeGate(runtime, actor, spellId, declared, aim)` (l.1001);
- `pickSlot(actor, level, spellId?)` (l.1359);
- `applyNonSlotCosts(actor, cost, chosen?)` (l.1334). It calls `pickSlot`; it does not need `runtime`.
- Move `selfTargetRefusal` (l.1776), `isSelfAction` (l.1769) and `castPayload` (l.1744) verbatim. `combat.ts` re-exports `isSelfAction`.

`Combat.declare` (l.572-727) and `Combat.use` (l.739-811) **stay in the class** and call these. Their gate order is unchanged. The validity block (l.639-659) stays inline, with the literal `this.runtime.index.validAsts[actionId]` (DD-D4).

**Commit when:** the ck2 gates pass.

### Checkpoint 5 — Effect execution → `execute.ts`, then whole-repo proof

Move these to functions over `core: FightCore`:
- `resolveShape(core, shape, actor, center, bound)` (l.1281);
- `executeBound(core, actor, boundAction, target, rule, move?, at?)` (was `execute`, l.1420). It keeps its private event sink. Do **not** merge it with `core.collect`: the two sinks nest today, and nesting order is observable.
- `resolveAction(core, actor, actionId, def, target, { move, cast, at })` (was `resolve`, l.1374);
- `boundActionOf(runtime, actionId, def)` (l.1624);
- `endIfSideDefeated(core)` (l.1500).

Move `flattenResolutions` (l.449) verbatim.

The movement closures (`movementGate` → `walk`) and the reactive/feat resolvers still live in `Combat` until SESSION-02. They call these new functions.

Then run the full proof set (STATE *Verification Baseline* V1–V6) and report:
- the six gate exits and the `pnpm test` summary line (N₁ unchanged);
- the V4 digests: `dist/runtime.d.ts` 151 names, `b3a0b27d400a8289`; `dist/index.d.ts` 221 names, `be8f98762c3bdcad`. Both must match;
- V5, the Combat public members (only the `state` accessor delta);
- the value imports of each combat file, derived mechanically: `grep -nE "^import [^t]|^export .* from" src/runtime/combat/*.ts`. They must match the DAG table above, with no file importing `./combat` as a value;
- `wc -l src/runtime/combat/*.ts`.

**Commit when:** V1–V6 all pass as stated. `git diff --stat 52d4d2a -- tests` shows only the two ck1 files.

## Verification

- **Gates:** STATE *Verification Baseline* V1–V6. Lease-scoped form during checkpoints: `pnpm exec vitest run tests/runtime/combat tests/proofs/combat-characterization.test.ts tests/snapshots`. Never use bare `npx` (6f6b491b).
- **CAP-D1 proof:** `tests/proofs/combat-characterization.test.ts`, run with `pnpm exec vitest run tests/proofs/combat-characterization.test.ts`. Discovery is `vitest.config.ts` `include: ['tests/**/*.test.ts']`. The entry is the real `src/runtime` barrel. Every internal producer is real, and so are the generated packs (`generateCampaign`) and the seeded `Rng`. There is no I/O, no port and no exclusive resource. "Shutdown/reopen" is leg 7's JSON round trip, and evidence is the vitest summary line. Owners: harness and capability, this session, ck1 and ck5. Plus the whole existing suite, **unmodified** (no existing test file is in this lease).
- **CAP-D3 proof:** `module-surface.test.ts`, V4 and V5.
- **Architecture compliance:** no new cross-module edge (`git diff -G'^(import|export .* from)' 52d4d2a -- src` changes only intra-`combat/` paths); `pnpm check:isolation` passes.

## State Update

Return: status; the five checkpoint SHAs; N₁; the characterization digests and the negative-control result; the V4/V5 outputs; the derived value-import list per combat file; `wc -l` per file; any symbol whose move required more than `this.` → argument substitution (each one is a deviation to report); and the arch delta for Orchestrator: new files and their roles, and the line citations in `arch/v1-core.md` that now point into moved code.
