# SESSION-03 — Split `snapshots.ts` into character / combat / envelope; C2 cross-pin

> **Program:** Ruleswright
> **Feature:** combat-decomposition
> **Modules:** M03 (internal only), M01 (one comment line), tests
> **Depends on:** SESSION-02 (the combat split is done, so `./combat/combat`'s re-exports are final)
> **Concurrent with:** —
> **Owns:** `src/runtime/snapshots.ts` (deleted here), `src/runtime/snapshots/index.ts`, `src/runtime/snapshots/envelope.ts`, `src/runtime/snapshots/character.ts`, `src/runtime/snapshots/combat.ts`, `src/schema/error-card.ts`, `tests/core/tables.test.ts`
> **Reads:** `src/runtime/combat/*.ts`, `src/runtime/{index,progression,character,errors,runtime}.ts`, `src/schema/{version,error-card,pack}.ts`, `src/schema/validate/{index,helpers}.ts`, `src/core/tables.ts`, `src/schema/contracts/snapshots.schema.json`, `tests/**`, `program/Ruleswright/prompts/combat-decomposition/STATE.md`
> **Resources:** —
> **Checkpoints:** 2

**Authorization on record (quote it; do not re-litigate it).** On 2026-10-04 the human answered: "**1 decomp first 2 recommend 3 none**". Answer 2 adopts Planner's recommendations:
- **C1:** keep `isLivePattern` as public API, with no code change (DD-D9).
- **C2:** pin the two `MAX_TABLE_DEPTH` constants equal by test, as the RESERVED_GRANT_KEYS precedent does (DD-D10).

This session changes no behaviour, no contract, no snapshot byte and no public export.

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M03 | Runtime | `snapshots.ts` (base `52d4d2a`): header l.1-37, imports l.39-61, character types l.63-128, constants l.129-132, character serialize l.136-195, `envelopeRefusals` l.197-273, `declaredIdentityId` l.275, character restore l.291-434, combat section l.436-1075 (`COMBAT_PHASES` l.863, `validateRngWords` l.1059), shared l.1077-1086 | the file being split |
| M03 | Runtime | `index.ts` l.66-84 | `from './snapshots'` resolves to `snapshots/index.ts` once the file is gone; `index.ts` is not edited |
| M01 | Schema | `error-card.ts` l.46 | comment names `runtime/snapshots.ts` |
| M01/M02 | Schema/Core | `schema/validate/helpers.ts` l.544, `schema/validate/index.ts` l.36, `core/tables.ts` l.32 | C2 |

## Context

`snapshots.ts` (1,086 lines) holds two independent envelopes:
- character/party, base l.63-434;
- combat, base l.436-1075.

They share only the envelope gate (`packIdentity`, `envelopeRefusals`, `declaredIdentityId`, `SNAPSHOT_VERSION`) and two helpers (`display`, `isRecord`). The split follows the v1-shell precedent, which turned `schema/validate.ts` into a `validate/` directory with an `index.ts` and kept the same public surface. Every importer uses the path `…/runtime/snapshots`, which resolves to `snapshots/index.ts` under `moduleResolution: "bundler"` (`tsconfig.json`) and esbuild. **No importer changes.** The importers are `src/runtime/index.ts:84` and seven test files (STATE *Pin audit*).

## Capabilities

| CAP | This session | Checkpoint |
|---|---|---|
| CAP-D2 snapshot behaviour unchanged | owns and integrates | ck1 |
| CAP-D3 public surface unchanged | final proof for the feature | ck2 |
| CAP-D4 cleanup dispositions | C2 cross-pin (C1 needs no code) | ck2 |

## Contract Agreements

CA-D1, CA-D3, CA-D4 and CA-D5 apply (STATE.md). **Checkpoint-0 recheck (read-only):**
- SESSION-02 is `done` in STATE.
- `snapshots.ts` is byte-identical to base: `git diff --quiet 52d4d2a -- src/runtime/snapshots.ts`.
- `snapshots.ts` l.46-57 imports `Combat`, `combatantFeats`, `copyBindings`, `copyTerrain`, `defeatedSide`, `moveBudgetAst`, `terrainRefusals` and the three types from `./combat/combat`, and `combat.ts` still exports each of them (re-exports count).
- `src/runtime/snapshots/` does not exist.
- `helpers.ts` l.544 and `tables.ts` l.32 both read `export const MAX_TABLE_DEPTH = 8;`, and `schema/validate/index.ts` l.36 re-exports it.

If any item fails, return `blocked` with the evidence.

## Files to Create/Modify

| File | Action | What Changes | ck |
|---|---|---|---|
| `src/runtime/snapshots/envelope.ts` | create | `SnapshotPackIdentity`, `SNAPSHOT_VERSION`, `packIdentity`, `envelopeRefusals`, `declaredIdentityId`, `display`, `isRecord` | 1 |
| `src/runtime/snapshots/character.ts` | create | character/party types, serializers, restore, refusals | 1 |
| `src/runtime/snapshots/combat.ts` | create | combat types (incl. `SnapshotOffer`), `serializeCombat`, `deserializeCombat`, refusals, `COMBAT_PHASES`, `UINT32_MAX_WORD`, copy/remaining helpers, `validateRngWords` | 1 |
| `src/runtime/snapshots/index.ts` | create | re-exports exactly today's export names (values and types) | 1 |
| `src/runtime/snapshots.ts` | delete | — | 1 |
| `src/schema/error-card.ts` | modify | l.46 comment: `runtime/snapshots.ts` → `runtime/snapshots/` | 1 |
| `tests/core/tables.test.ts` | modify | one added case (C2) | 2 |

## Implementation

### Checkpoint 1 — The split

- Move code **verbatim**. Function bodies and JSDoc do not change. Only import lines change: `../combat/combat`, `../progression`, `../../schema/…`.
  - `snapshots/combat.ts` imports from `../combat/combat`, the same names as base l.46-57. It also imports `SnapshotActiveCondition` as a type from `./character` (base l.79; the combat def reuses it) and the envelope helpers from `./envelope`.
  - `snapshots/character.ts` imports from `./envelope`.
  - Neither imports the other as a value. `combat.ts` → `character.ts` is `import type` only.
- Split the module header (base l.1-37). The general paragraphs (three envelopes, identity gate, no migration) go to `index.ts`. The field-mapping list goes to `character.ts`. Each combat function keeps its own JSDoc.
- `index.ts` uses `export { … } from './character'`, `'./combat'` and `'./envelope'`, covering **every** name `snapshots.ts` exports today: the values `serializeCharacter`, `serializeParty`, `restoreCharacter`, `restoreParty`, `serializeCombat`, `deserializeCombat`, and the types `SnapshotPackIdentity`, `SnapshotClassEntry`, `SnapshotActiveCondition`, `SnapshotInventoryEntry`, `SnapshotEquippedEntry`, `SnapshotCharacterState`, `CharacterSnapshot`, `PartySnapshot`, `SnapshotCombatant`, `SnapshotOffer`, `CombatSnapshot`, `CombatRestoreRequest`. Re-derive the list with `grep -n "^export" src/runtime/snapshots.ts` before deleting the file. Re-export nothing more.
- Delete `snapshots.ts`. **Commit with the git CLI**, not `commit_pathspec`. Single-command pathspec commits fail on deleted files (standing rec 3658f327):
  ```
  git add -A -- src/runtime/snapshots.ts src/runtime/snapshots src/schema/error-card.ts
  git commit -m "combat-decomposition SESSION-03: checkpoint 1 — snapshots split" -- src/runtime/snapshots.ts src/runtime/snapshots src/schema/error-card.ts
  ```
  (`-A` limited by the pathspec stages the deletion; never run it unscoped.)

**Commit when:**
- `pnpm typecheck`, `pnpm lint` and `pnpm format:check` exit 0.
- `pnpm test` is green at N₁, with `tests/snapshots/**`, `module-surface.test.ts` (snapshots value pin) and `combat-characterization.test.ts` (legs 7 and 8: snapshot digests) all unchanged.
- `pnpm build && pnpm check:isolation` exit 0.
- `wc -l src/runtime/snapshots/*.ts` is reported.

### Checkpoint 2 — C2 cross-pin; feature-final proof

- `tests/core/tables.test.ts`: add one case, beside the existing `MAX_TABLE_DEPTH` negative control (l.215-217):
  ```ts
  import { MAX_TABLE_DEPTH as SCHEMA_MAX_TABLE_DEPTH } from '../../src/schema/validate';
  // …
  it('MAX_TABLE_DEPTH is the schema validator’s bound — two declarations pinned together (C2)', () => {
    expect(MAX_TABLE_DEPTH).toBe(SCHEMA_MAX_TABLE_DEPTH);
  });
  ```
  (Illustrative; the assertion is the authority.) This mirrors `tests/core/dsl/formula.test.ts:248-250`, where EQUIPMENT_SCALARS ↔ RESERVED_GRANT_KEYS are declared separately because M01/M02 import nothing from each other, and pinned together by a test.
- **Negative control:** temporarily set `helpers.ts`'s constant to 9 (a scratch edit outside the lease; never committed). Confirm the new case fails, then revert with `git checkout -- src/schema/validate/helpers.ts`. Report the result.
- Run STATE *Verification Baseline* V1–V6 for the whole feature and report:
  - the summary line at N₁ + 1;
  - the V4 digests (151 / `b3a0b27d400a8289`, 221 / `be8f98762c3bdcad`);
  - V5;
  - `wc -l src/runtime/combat/*.ts src/runtime/snapshots/*.ts`;
  - `git diff --stat 52d4d2a -- tests`. It must show exactly the two SESSION-01 files plus `tests/core/tables.test.ts`.

**Commit when:** V1–V6 pass with those values.

## Verification

- STATE *Verification Baseline* V1–V6. The lease-scoped form is `pnpm exec vitest run tests/snapshots tests/runtime/combat tests/proofs tests/core/tables.test.ts`.
- **CAP-D2 proof:** `tests/snapshots/{character,combat,root}.test.ts`, unmodified, plus characterization legs 7 and 8 (whole-envelope digests through the public barrel; leg 7 restores a fight with an open offer and continues).
- **CAP-D3 proof:** `module-surface.test.ts`, V4 and V5. The snapshots module's value names are pinned exactly, and its type names are covered by V4 (barrel-facing) and by typecheck of every test that imports them.
- **CAP-D4 proof:** the new `tables.test.ts` case plus its negative control. C1 needs no proof: `isLivePattern` stays exported and `conditions.test.ts:78-79` still pins it.

## State Update

Return: status; both checkpoint SHAs; V1–V6 outputs; N₁ + 1; `wc -l` per file; the negative-control result; the derived value imports of each `snapshots/*.ts` file; and the arch delta: the `snapshots/` directory and its files' roles, and the `arch/v1-core.md` / PROGRAM-CONFIG registry citations that name `snapshots.ts`.
