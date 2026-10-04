# SESSION-02 — Movement, terrain and trigger handling out of `Combat`

> **Program:** Ruleswright
> **Feature:** combat-decomposition
> **Modules:** M03 (internal only)
> **Depends on:** SESSION-01 (`types.ts`, `combatants.ts`, `fight.ts`, `declare.ts`, `execute.ts` landed; the characterization digests and N₁ recorded in STATE)
> **Concurrent with:** —
> **Owns:** `src/runtime/combat/combat.ts`, `src/runtime/combat/movement.ts`, `src/runtime/combat/triggers.ts`
> **Reads:** `src/runtime/combat/{types,combatants,fight,declare,execute,spatial,resolve,action-economy}.ts`, `src/runtime/snapshots.ts`, `src/runtime/index.ts`, `tests/**`, `program/Ruleswright/prompts/combat-decomposition/STATE.md`
> **Resources:** —
> **Checkpoints:** 4

**Authorization on record (quote it; do not re-litigate it).** On 2026-10-04 the human answered: "**1 decomp first 2 recommend 3 none**" (STATE.md DD-D1, DD-D12). This session changes no behaviour, no contract and no public export.

## Module Context

Line numbers are **base `52d4d2a`** positions. SESSION-01 shifted them, so locate each item by symbol name.

| ID | Module | Read | Why |
|----|--------|------|-----|
| M03 | Runtime | `combat.ts` `copyTerrain` (base l.376), `terrainRefusals` (l.386), `forfeitMove` (l.557), `movementGate` (l.1040), `pathQuery` (l.1093), `walk` (l.1125), `threatenersLeft` (l.1183), `resumeMove` (l.1202), `endMove` (l.1225), `setPendingMove` (l.1241), `place` (l.1265), `ZERO_RNG` (l.1760), `moveBudgetAst` (l.1763) | movement + terrain move out |
| M03 | Runtime | `combat.ts` `respond` (l.814), `resolveReactive` (l.1538), `resolveReactiveAgainst` (l.1563), `resolveFeat` (l.1592), `declareReactive` (l.1619) | trigger answering moves out |
| M03 | Runtime | `combat/fight.ts` (`FightCore`: `collect`, `reject`, `surfaceOffers`, `setClock`), `combat/declare.ts`, `combat/execute.ts` as landed by S01 | the primitives the moved code calls |
| M03 | Runtime | `snapshots.ts` l.46-57 | imports `copyTerrain`, `terrainRefusals`, `moveBudgetAst` from `./combat/combat`; they stay re-exported there |

## Context

After SESSION-01, `Combat` still holds two clusters:
- **Movement and terrain** (DD-M5…M12): the movement gate, path query, cell-by-cell walk with leaving-reach pauses, resume, forfeit, the paused-move bookkeeping, and the terrain placement refusals shared with snapshot restore.
- **Trigger answering** (FR-4/FR-13, DD-S12): resolving a taken reactive action or feat, and declining.

This session moves movement and terrain into a new `movement.ts` beside `spatial.ts`. `spatial.ts` keeps pure geometry and path-finding and is unchanged. Trigger answering joins the offer machinery already in `triggers.ts`.

`Combat` ends as `startCombat`, the constructor, the public verbs (`step`, `declare`, `use`, `respond`, `serialize`, `eventsSince`, `declareReactive`) and the turn advance (`endTurn`, `advanceFrom`). `declare`/`use` stay in the class (DD-D4).

**Target value-import DAG after this session** (adds to S01's table):

| File | Holds | Value-imports (internal) |
|---|---|---|
| `combat/movement.ts` (new) | `copyTerrain`, `terrainRefusals`, `moveBudgetAst`, `ZERO_RNG`, `movementGate`, `pathQuery`, `walk`, `threatenersLeft`, `resumeMove`, `endMove`, `setPendingMove`, `place`, `forfeitMove` | `./spatial`, `./resolve` (`effectVars`), `../../core/dsl/formula`, `../errors` (`ruleCard`), `./declare` (`restrictionRejection`), `./combatants` |
| `combat/triggers.ts` | today's exports, plus `resolveReactive`, `resolveReactiveAgainst`, `resolveFeat`, `answerOffer` | `./declare`, `./execute`, `./action-economy`, `./combatants` |

`fight.ts` → `triggers.ts` (S01) plus `triggers.ts` → `declare`/`execute`/`combatants` is acyclic, provided **none of `declare.ts`, `execute.ts`, `combatants.ts` or `movement.ts` value-imports `fight.ts`**. They take `FightCore` as `import type`. No file value-imports `./combat`.

## Capabilities

| CAP | This session | Checkpoint |
|---|---|---|
| CAP-D1 combat behaviour unchanged | preserves it across the movement and trigger moves, and integrates the complete combat split: after ck4 every combat cluster the human named is out of `Combat` | ck4 |
| CAP-D3 public surface unchanged | re-proves it at ck4 | ck4 |

The production path, the first narrow journey and its proof are SESSION-01's characterization test, unchanged.

## Contract Agreements

CA-D1, CA-D2 and CA-D4 apply (STATE.md). **Checkpoint-0 recheck (read-only):**
- STATE records SESSION-01 `done`, the characterization digests and N₁. `pnpm exec vitest run tests/proofs/combat-characterization.test.ts tests/runtime/combat/module-surface.test.ts` passes at HEAD.
- `fight.ts` exports `FightCore` with `collect`, `reject`, `surfaceOffers` and `setClock`. `declare.ts` exports `restrictionRejection`, `resolveTarget`, `spatialGate`, `selfTargetRefusal`, `isSelfAction` and `applyNonSlotCosts`. `execute.ts` exports `resolveAction`, `executeBound` and `endIfSideDefeated`.
- No combat file value-imports `fight.ts` except `combat.ts`: `grep -nE "^import \{[^}]*\} from './fight'" src/runtime/combat/*.ts` hits `combat.ts` only.

If any item fails, return `blocked` with the evidence.

## Files to Create/Modify

| File | Action | What Changes | ck |
|---|---|---|---|
| `src/runtime/combat/movement.ts` | create | movement + terrain functions over `FightCore` | 1–2 |
| `src/runtime/combat/triggers.ts` | modify | adds the trigger-answering functions; header doc keeps the grammar | 3 |
| `src/runtime/combat/combat.ts` | modify | delegations; re-exports `copyTerrain`, `terrainRefusals`, `moveBudgetAst`; header doc trimmed to the loop | 1–4 |

## Implementation

### Checkpoint 1 — Terrain and paused-move bookkeeping

- Move `copyTerrain` and `terrainRefusals` verbatim. `startCombat` and `snapshots.ts` call them, and `combat.ts` re-exports both.
- Move `moveBudgetAst` and `ZERO_RNG` verbatim. `combat.ts` re-exports `moveBudgetAst`.
- Convert `place(core, id, at)`, `setPendingMove(core, id, pending)`, `endMove(core, moverId, actionId, reason)`, `pathQuery(core, mover, from, to, budget)` and `threatenersLeft(core, moverId, at, next)` to functions over `core`. Each body is verbatim, with `this.state` → `core.state` and `this.runtime` → `core.runtime`. State replacement stays a whole-object reassignment of `core.state`, exactly as today: `setPendingMove` (base l.1241-1248) and `place` (l.1265-1271) build a new `combatants` record.

**Commit when:** `pnpm typecheck`, `pnpm lint`, `pnpm format:check` exit 0; `pnpm test` green at N₁; the characterization digests unchanged.

### Checkpoint 2 — Gate, walk, resume, forfeit

- Convert to functions over `core`:
  - `movementGate(core, actor, actionId, budgetAst, to)`: it returns `{ move: (walked) => walk(core, …) }` exactly as base l.1089;
  - `walk(core, moverId, actionId, to, path, budget, resumed = false)`: it calls `core.surfaceOffers([leaving])` per threatener, in the same order as base l.1154-1166;
  - `resumeMove(core)`: `core.collect(…)`, then `core.surfaceOffers(emitted)`;
  - `forfeitMove(core)`.
- `Combat.step` calls `forfeitMove(this.core)`; `Combat.declare` calls `movementGate(this.core, …)`; `Combat.respond` calls `resumeMove(this.core)`.

**Commit when:** the ck1 gates pass, and `pnpm exec vitest run tests/runtime/combat/movement.test.ts tests/proofs/movement-journey.test.ts tests/snapshots/combat.test.ts` is green.

### Checkpoint 3 — Trigger answering → `triggers.ts`

- Convert to functions over `core`:
  - `resolveReactive(core, offer, targetId)` (base l.1538);
  - `resolveReactiveAgainst(core, offer, def, reactor, target)` (l.1563);
  - `resolveFeat(core, offer, targetId)` (l.1592).
  
  Gate order is unchanged: restriction → self → target → reach for reactions; holder check → effect for feats. The no-chain rule `core.surfaceOffers(emitted, { feats: false })` is kept.
- `answerOffer(core, offer, choice, targetId)` takes the decline branch of `respond` (base l.822-827: `core.setClock()`, `emitDeclined`, the last `sinceRound` event) and otherwise calls `resolveFeat`/`resolveReactive`.
- `Combat.respond` keeps the lookup and `splice` (l.815-820) and calls `answerOffer`. When the queue is empty it appends `resumeMove(this.core)` (l.833).
- `Combat.declareReactive` calls `resolveReactive(this.core, offer, targetId)`. `resolveTriggered` is unchanged.
- **New `triggers.ts` exports are not added to `src/runtime/index.ts`.** That file is outside this lease, and the barrel pin forbids new names.

**Commit when:** the ck1 gates pass, and `pnpm exec vitest run tests/runtime/combat/spatial-triggers.test.ts tests/runtime/combat/feat-triggers.test.ts tests/runtime/combat/self-target.test.ts` is green.

### Checkpoint 4 — Docs travel with the code; whole-repo proof

- `combat.ts`'s module header (base l.1-31) describes movement and consumables. Move each paragraph to the header of the file that now holds that code: the movement paragraph to `movement.ts`, and the trigger points to `triggers.ts`. `combat.ts` keeps the loop, events and consumables paragraphs. No wording change beyond the move.
- Run STATE *Verification Baseline* V1–V6 and report everything SESSION-01 ck5 reported: gate exits, the summary line at N₁, the V4 digests (151 / `b3a0b27d400a8289`, 221 / `be8f98762c3bdcad`), V5, the derived value imports per combat file against both DAG tables, and `wc -l src/runtime/combat/*.ts`.

**Commit when:** V1–V6 pass. `git diff --stat 52d4d2a -- tests` still shows only SESSION-01's two files. `Combat` holds no private method whose body is movement, terrain or trigger answering.

## Verification

- STATE *Verification Baseline* V1–V6. The lease-scoped form is `pnpm exec vitest run tests/runtime/combat tests/proofs tests/snapshots`.
- **CAP-D1 proof:** SESSION-01's `tests/proofs/combat-characterization.test.ts`, unchanged, plus the whole existing suite, unmodified (no test file is in this lease). It covers legs 2 (paused move, resume), 1 and 5 (take/decline, feat) and 7 (restore with an open offer), which are exactly the paths this session moves.
- **CAP-D3 proof:** `module-surface.test.ts`, V4 and V5.
- **Architecture:** no cross-module edge added: `git diff -G'^(import|export .* from)' 52d4d2a -- src` adds only `combat/`-internal paths, plus `combat/movement.ts` → `../errors` and `../../core/dsl/formula`. `combat.ts` already has both edges, so neither is new at module level.

## State Update

Return: status; the four checkpoint SHAs; the V1–V6 outputs; the derived value-import list per combat file; `wc -l` per file; any move that needed more than `this.` → `core.`/argument substitution (each one is a deviation to report); and the arch delta: the final roles of `movement.ts` and `triggers.ts`, `Combat`'s remaining responsibilities, and the `arch/v1-core.md` citations now pointing at moved code.
