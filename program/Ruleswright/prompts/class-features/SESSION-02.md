# SESSION-02 — Author re-entry (Architect): F-D8 file-location drift + `features.ts`

> **Program:** Ruleswright
> **Feature:** class-features
> **Modules:** — (Author artifact: Architect)
> **Depends on:** S04 (lists `src/runtime/features.ts`, which S04 creates)
> **Concurrent with:** S05 (lease disjoint: `mocks/progression.html`)
> **Owns:** `program/Ruleswright/specs/architecture.md`
> **Reads:** `src/schema/validate/**` (file list), `src/runtime/combat/*.ts` and `src/runtime/snapshots/*.ts` (file lists and header comments), `src/runtime/features.ts` (as S04 landed it), `program/Ruleswright/arch/v1-core.md` (*File layout* tables, combat-decomposition synthesis), `program/Ruleswright/prompts/class-features/STATE.md`
> **Resources:** —
> **Checkpoints:** 2

**Role.** This is an **Author re-entry** session for the Architect role, not a Coder session. You correct `specs/architecture.md` text only, and touch no other file.

**Authorization (quote it; do not re-litigate it).** On 2026-10-04 Planner asked (Q5) whether the same run should also fix the stale file names in `architecture.md:62,80,88,208` (F-D8). The human answered "**5 you have my auth for whatever you need**" (STATE.md *Human answers on record*). F-D8 was carried as a Spec re-entry in combat-decomposition's report. `architecture.md` is the Architect's one deliverable (`program-agents/ARCHITECT.md` rule 6), so the Architect owns it.

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| — | Architect | `architecture.md` l.52-110 (module tree), l.200-212 (mock → architecture mapping table; `snapshots.ts` row l.208) | the drift sites |
| M01 | Schema | `ls src/schema/validate src/schema/validate/sections` | `validate.ts` → `validate/` (v1-shell split) |
| M03 | Runtime | `ls src/runtime/combat src/runtime/snapshots`; each file's header comment | combat-decomposition split |
| M03 | Runtime | `src/runtime/features.ts` header | class-features leaf |

## Context

Three cycles of structural refactors left `architecture.md` naming files that no longer exist:
- l.62 `validate.ts`, split into `validate/` by v1-shell;
- l.80 `combat.ts` as the whole loop;
- l.88 and l.208 `snapshots.ts`, split into `snapshots/` by combat-decomposition.

This feature also adds `src/runtime/features.ts`. Behaviour and module boundaries are unchanged. This is file-location text only (FR-2 / FR-10 / FR-14 meanings stay as written).

## Capabilities

CAP-C7, the Architect part. It integrates nothing.

## Contract Agreements

None apply. No contract, type or behaviour is described differently. Make sure the text names no file that does not exist at HEAD.

**Checkpoint-0 recheck (read-only):**
- `sed -n '62p;80p;88p;208p' program/Ruleswright/specs/architecture.md` shows `validate.ts`, `combat.ts — Combat: stepwise loop`, `snapshots.ts — three serializers`, and the `snapshots.ts` owns-exactly-three-serializers row.
- `test -f src/runtime/features.ts`.

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `program/Ruleswright/specs/architecture.md` | modify | module tree l.62, l.79-85, l.88, a `features.ts` line; table row l.208; a dated revision note in the header status |

## Implementation

### Checkpoint 1 — the module tree

- **l.62-63:** `validate.ts` → `validate/` with the same duty: "structural + semantic validator (pure, all-at-once, never partial — FR-2), one module per pass/section (`index.ts`, `sections/*.ts`). The compiler imports this."
- **l.79-85 (`combat/`):** keep `action-economy.ts`, `resolve.ts`, `spatial.ts`. Replace the `combat.ts` line and extend the list so it reflects the split:
  - `combat.ts`: `startCombat`, `Combat`'s public verbs and the turn advance;
  - `fight.ts`: `FightCore`, the shared fight state;
  - `declare.ts`: declare gates;
  - `execute.ts`: effect execution;
  - `movement.ts`: movement/terrain;
  - `triggers.ts`: reactive actions and feats, trigger answering;
  - `types.ts`, `combatants.ts`: types, pure combatant facts.

  Take one-line duties from each file's header comment. The source of truth is `arch/v1-core.md` *File layout*.
- **l.88:** `snapshots.ts` → `snapshots/`: `index.ts` (the public names), `envelope.ts` (identity gate), `character.ts` (character/party), `combat.ts` (combat envelope). There are still three serializers with loud-refusal load (FR-14).
- **Add, in the runtime list after `progression.ts`:** `features.ts — class features: granted feats, unlocked actions/spells, derived from progression tables (FR-6, v1.10)`. Keep the tree-drawing characters consistent.
- Do not add other unlisted runtime files (`feats.ts`, `inventory.ts`, `equipment.ts`, …). The tree is an overview, and listing them is outside this re-entry. Mention the omission in your handoff as an observation.

**Commit when:**
- `git diff --name-only` lists only `architecture.md`;
- every path the edited lines name exists (`test -e` per path);
- `git diff --name-only f36d4ae..HEAD -- src` hasn't changed since dispatch.

Message: `class-features SESSION-02: checkpoint 1 — module tree file locations`.

### Checkpoint 2 — mapping table + status note

- **l.208:** "`snapshots/` (`index.ts` re-exports `envelope`/`character`/`combat`) owns exactly three serializers; refusal is ErrorCard `E-SNAP-01`; the runtime contains no I/O code".
- **Header status:** append a revision note: `revised 2026-10-04 — Architect re-entry (class-features, builder-authorized): file locations updated for the v1-shell validate/ split, the combat-decomposition combat/ and snapshots/ splits, and the class-features features.ts leaf; no boundary or contract change`.
- Re-grep: `grep -n 'validate\.ts\|snapshots\.ts\|combat\.ts' program/Ruleswright/specs/architecture.md`. Every remaining hit names an existing file or is historical text you mark as such.

**Commit when:** both edits are present, and the re-grep is clean as described. Message: `class-features SESSION-02: checkpoint 2 — mapping table and revision note`.

## Verification

- `git diff --name-only <dispatch base>..HEAD` = `program/Ruleswright/specs/architecture.md`.
- Every path named in the changed lines exists at HEAD.
- No code gate applies (`program/` is excluded from Prettier and ESLint, H8). Orchestrator runs V1–V3 at receive.

## State Update

Report:
- the changed lines (before → after);
- the re-grep output;
- observations (unlisted runtime files);
- the commit SHAs.

The final Archivist records F-D8 as closed.
