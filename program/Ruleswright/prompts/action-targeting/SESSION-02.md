# SESSION-02 — Self-targeting column: `target(self, …)`, self actions and reactions, 10 theme actions, first journey

> **Program:** Ruleswright
> **Feature:** action-targeting
> **Modules:** M03, M04
> **Depends on:** SESSION-01 (contract v1.7: CA-A1, CA-A2)
> **Concurrent with:** —
> **Owns:** `src/runtime/combat/combat.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `README.md`, `tests/runtime/combat/self-target.test.ts`, `tests/proofs/self-target-journey.test.ts`
> **Reads:** `program/Ruleswright/specs/database.md` (v1.7 §actions "Self actions"), `src/core/dsl/effect.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/combat/triggers.ts`, `src/runtime/runtime.ts`, `src/runtime/snapshots.ts`, `src/runtime/index.ts`, `src/compiler/index.ts`, `tests/proofs/movement-journey.test.ts` (harness pattern), `tests/runtime/combat/combat.test.ts`, `tests/runtime/fixtures/packs.ts`, `program/Ruleswright/prompts/action-targeting/STATE.md`
> **Resources:** —
> **Checkpoints:** 3

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M03 | Runtime | `combat.ts` `declare` (l.572-735), `resolveTarget` (l.886-930), `spatialGate` (l.936), `resolveShape` (l.1273-1302), `execute` (l.1411), `resolveReactive` (l.1529-1560), `resolveFeat` (l.1567), `moveBudgetAst` (l.1738-1741) | where self binding goes |
| M03 | Runtime | `resolve.ts` `executeAgainst` (l.314-360) | `resolveTargets` → combat's resolver; `varsFor` |
| M02 | Core | `effect.ts` `execTarget` (l.401-410) | `self` reaches combat as a plain shape string |
| M04 | Compiler | the three theme files' `actions` sections | content retarget |

## Context

Self-buff actions land on an opponent today. DB v1.7 (S01) defines the `self` shape word and
**self actions**. This session implements both in the one combat shape resolver and the two
target-binding sites (`declare`, `resolveReactive`). It retargets the 10 bundled self-buff
actions and proves the result end to end.

**This is the feature's first narrow journey (CAP-A1…A3).** The path is: generated pack →
`Runtime` → character → `profileFromCharacter` → `startCombat` → `declare` / `respond` →
condition on the actor → snapshot → restore.

**Do not edit test fixtures.** `tests/runtime/fixtures/packs.ts` keeps `withdraw:
applyCondition(braced, 2)`. Six suites use it as a skip action (STATE.md pin audit).
Changing it would move pins outside this lease.

## Capabilities

- **CAP-A1 (owned here; integration ck1, journey ck3):** `fight.declare('<self action>')` → condition on the actor, with any number of opponents at any distance, in spatial and theater packs.
- **CAP-A2 (owned here):** taking a self reaction → condition on the reactor, no reach gate.
- **CAP-A3 (owned here, ck2):** the 10 bundled actions (DD-A3) are self actions.

Required facts and their origins:
- the actor id: `this.state.active` in `declare`, `offer.actorId` in `resolveReactive`;
- the effect root: `this.runtime.index.actionEffects[actionId]`, parse-once, from `runtime.ts` l.122;
- the condition mutation: the existing `applyMutation` path in `execute`.

No new producer is needed.

## Contract Agreements

**CA-A1 and CA-A2 (STATE.md), as amended by Orchestrator after S01.** Use the envelope's
amended text if it differs from the mapping below.

- **CA-A1.** `resolveShape('self', actor, …)` → `[actor.id]`. This is checked **before** the `!geometry.enabled` early return, so theater packs get the actor too. Every other shape is unchanged.
- **CA-A2.** An action (`pack.actions[id]`, never a spell) whose parse-once root is `target(self, …)`:
  - binds `target = { combatant: actor }`;
  - skips `resolveTarget` and `spatialGate`;
  - refuses `targetId !== undefined && targetId !== actor.id` with `{kind: 'invalid-target', rule: 'E-REF-01', resource: targetId, message: ...}` before any spend;
  - keeps the restriction → validity → cost order.
  - The same holds in `resolveReactive`.
  - A spell whose effect contains `target(self, …)` keeps DD-S8 binding. Its `self` scope still resolves to the caster through CA-A1.

**Checkpoint-0 recheck (read-only, record in the handoff):**
- `database.md` v1.7 text matches the two bullets above.
- `grep -n "'self'" src/runtime/combat/combat.ts` → no hits before your edit.
- `moveBudgetAst` is still at `combat.ts` l.1738.
- The behavior-pin greps in STATE.md (Verification Baseline) still show no generated-pack test asserting where one of the 10 actions lands.

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `src/runtime/combat/combat.ts` | modify | `resolveShape`: the `self` case. New exported helper `isSelfAction(runtime, actionId)` beside `moveBudgetAst`. `declare`: self binding plus the `targetId` refusal. `resolveReactive`: the same |
| `tests/runtime/combat/self-target.test.ts` | create | unit and integration over the emberMarches fixture **copied in-test** with self effects (the fixture file is not edited) |
| `src/compiler/themes/dark-fantasy.json` | modify | `withdraw`, `brace`, `ward-glint` effects → `target(self, <existing effect>)` |
| `src/compiler/themes/zombie-urban.json` | modify | `fall-back`, `barricade`, `dodge-roll`, `adrenal-spike` → `target(self, …)` |
| `src/compiler/themes/wyldwood.json` | modify | `fall-back`, `circle-path`, `ward-step` → `target(self, …)` |
| `tests/proofs/self-target-journey.test.ts` | create | the first narrow journey (generated packs, src public barrels) |
| `README.md` | modify | one prose paragraph in the combat section (near l.179-181, the `hasTarget` / burst paragraph): self actions, `target(self, …)`, the `invalid-target` refusal. **No new fenced ```ts block** (DD-A9) |

## Implementation

### Checkpoint 1 — The engine resolves `self` and binds self actions

1. Read `combat.ts` l.572-735, l.886-950, l.1273-1302, l.1529-1560 and l.1738-1741 before editing.
2. Helper, next to `moveBudgetAst`:
   ```ts
   /** A self action (v1.7, DD-A2): an action whose parse-once effect root is `target(self, …)`. Spells are never self actions. */
   export function isSelfAction(runtime: Runtime, actionId: string): boolean {
     const ast = runtime.index.actionEffects[actionId];
     const shape = ast?.kind === 'call' && ast.text === 'target' ? ast.args?.[0] : undefined;
     return shape?.kind === 'name' && shape.text === 'self';
   }
   ```
3. `resolveShape`: the first statement becomes `if (shape === 'self') return [actor.id];`.
4. `declare`:
   - Compute `const selfAction = spell === undefined && isSelfAction(this.runtime, actionId);`.
   - When `selfAction` and `options.targetId` is set and differs from `actorId`, return the `invalid-target` rejection. Place this where the target is resolved (after the restriction gate and the `at` refusal, before validity), so the gate order stays restriction → target → validity → spatial → cost.
   - Extend the existing binding: `budgetAst !== undefined || at !== undefined || selfAction ? { combatant: actor } : this.resolveTarget(...)`.
   - In the gate block, a self action takes neither the movement gate, nor the range gate, nor `spatialGate`. Add `else if (selfAction) { /* DD-A2: no reach gate */ }` before the final `else`.
   - An `at` on an action is already refused by `atRefusal`; do not change it.
5. `resolveReactive`: if `isSelfAction(this.runtime, offer.actionId)`, apply the same `targetId` refusal, bind `reactor`, and skip `spatialGate`. Otherwise the code is unchanged.
6. `tests/runtime/combat/self-target.test.ts`. Build a pack in-test from `emberMarchesPack()` / `emberMarchesSpatialPack()` (`tests/runtime/fixtures/packs.ts`) by overriding the effect strings of `withdraw` and of one reaction to `target(self, applyCondition(braced, 2))`. Do not edit the fixture file. Assert:
   - (a) two enemies, no `targetId` → no `declare:rejected`; `condition:applied` with `actor === target === <declarer>`; `action:resolved.payload.targetId === <declarer>`.
   - (b) spatial, enemies at distance > reach → same result, with no `spatial` rejection.
   - (c) `{ targetId: <enemy> }` → `invalid-target`, and `fight.serialize()` deep-equals the pre-declare value.
   - (d) theater (no `spatial`) → lands on the actor.
   - (e) `sequence(attack(ac, might), target(self, applyCondition(braced, 1)))` on a normal action → the attack targets the foe and `braced` lands on the actor (nested `self`).
   - (f) a reaction effect `target(self, …)` taken via `respond(id, 'take')` with the attacker beyond the reactor's reach → condition on the reactor, no rejection.
   - (g) restriction still bites: a self action tagged `move` while the actor is `rooted` → `restricted`.
   - (h) unchanged control: a plain `applyCondition(braced, 2)` action with one foe still lands on the foe.

**Commit when:** `pnpm typecheck` = 0; `pnpm exec vitest run tests/runtime/combat` passes (self-target included; the existing combat suites unchanged); `pnpm lint` = 0.

### Checkpoint 2 — The bundled self-buffs act on their user

1. Edit the 10 effects exactly (DD-A3). Example: `"applyCondition(braced, 2)"` → `"target(self, applyCondition(braced, 2))"`. Change nothing else in these files (no cost, tag, trigger or id changes). Keep the existing formatting of each entry.
2. Re-run the generation and validation suites: `pnpm exec vitest run tests/compiler tests/proofs/movement-journey.test.ts tests/proofs/grid-journey.test.ts tests/runtime/combat/character-profile.test.ts`. Expected green with no assertion edits (STATE.md pin audit: `movement-journey` l.250-252 offers and declines `ward-step`, and its trigger is unchanged).

**Commit when:** those suites pass; `pnpm format:check` = 0.

### Checkpoint 3 — The first narrow journey + README

`tests/proofs/self-target-journey.test.ts`. Import `generateCampaign` and `loadTheme` from `../../src/compiler`, and the runtime API from `../../src/runtime` (DD-A8). Seed 42. Follow `movement-journey.test.ts`'s `duelFight` harness: hero `initiativeBonus: 100`, foes `-100`, `rng: new Rng('self-target-journey')`, `fight.step()` to the hero's turn.

1. **dark-fantasy, spatial grid, withdraw.** A warden at (0,0); two `barrow-wight`s at (6,0) and (0,6), out of reach. `declare('withdraw')` with no target.
   - Assert: no rejection; `condition:applied` with actor = target = the warden and `why.rule === 'actions.withdraw'`; neither wight has conditions; the warden's `move` slot is spent.
2. **brace roots its user.** Next turn, or a fresh fight: `declare('brace')` → `rooted` on the warden. Then `declare('stride', { to: { x: 1, y: 0 } })` → `declare:rejected` with kind `restricted`.
3. **ward-glint reaction.** A hexer and an adjacent foe; the foe acts first. The foe declares `cut-down` with `{ targetId: <hexer> }` → `pendingTriggers` contains `<hexer>.ward-glint` → `respond(..., 'take')` → `warded` on the hexer.
4. **Snapshot / restore.** After step 1: `serializeCombat(fight, { pairsWith: 'party-1' })` → JSON round-trip → `deserializeCombat` on a fresh `Runtime` of the same pack (see `movement-journey.test.ts` for the restore request shape) → the warden's conditions include `braced`.
5. **Theater.** The same generated pack with `spatial` deleted (movement-journey's `stripped` helper pattern): `withdraw` lands on the actor.
6. **zombie-urban and wyldwood smoke.** In each pack, every one of its retargeted actions (DD-A3) declared by a hero of a class that lists it → lands on the declarer.
7. **Refusal.** `declare('withdraw', { targetId: <a wight> })` → `invalid-target`; state unchanged.

README: the one paragraph (DD-A9).

**Commit when:** `pnpm exec vitest run tests/proofs/self-target-journey.test.ts tests/proofs/docs-run.test.ts` passes; `pnpm build && pnpm test` passes whole-suite (expected 829 + the new tests); `pnpm typecheck`, `pnpm lint` and `pnpm format:check` = 0.

## Verification

- Effective commands: STATE.md Verification Baseline. Use `pnpm exec vitest run <path>` for scoped runs, and `pnpm build` before a whole `pnpm test` (`spells-journey` reads `dist/`).
- **CAP-A1/A2/A3 proof:** `tests/proofs/self-target-journey.test.ts`, run with `pnpm exec vitest run tests/proofs/self-target-journey.test.ts`. Discovery is the default vitest include (it lives under `tests/`).
  - Real path: compiler → runtime → combat. No doubles.
  - Seed data: `generateCampaign` at seed 42; isolation is a fresh `Runtime` per leg; no I/O.
  - Restore: a fresh `Runtime` from the same pack object.
  - Assertions: as in ck3 steps 1-7.
- **CA-A1/CA-A2 proof:** `tests/runtime/combat/self-target.test.ts` cases (a)-(h).
- Whole-repo fast gates at the end: typecheck, lint, format:check, build, test, check:isolation, check:security.

## State Update

Report in the handoff:
- the CA-A1/CA-A2 recheck result;
- the landed symbols (`isSelfAction`, the `resolveShape` case) and the commit SHAs;
- the exact test counts from the vitest summary line;
- any pin that moved (expected: none outside this lease).

Name S03 as the next owner: it shares `zombie-urban.json`, `wyldwood.json` and `README.md`.
