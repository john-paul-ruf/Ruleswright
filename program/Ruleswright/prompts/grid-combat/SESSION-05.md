# SESSION-05 — Grid journey proof (real generated pack) + README

> **Program:** Ruleswright
> **Feature:** grid-combat
> **Modules:** M01–M04 (reads; writes M05 + proofs + README)
> **Depends on:** S03, S04
> **Concurrent with:** — (W4 runs alone)
> **Owns:** `tests/proofs/grid-journey.test.ts`, `README.md`
> **Reads:** `src/runtime/**`, `src/compiler/**`, `src/schema/**`, `program/Ruleswright/prompts/grid-combat/STATE.md`, `tests/runtime/combat/combat-spatial.test.ts`, `tests/runtime/fixtures/packs.ts`
> **Resources:** —
> **Checkpoints:** 2

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M04 | Compiler | generateCampaign API | The journey's entry point |
| M03 | Runtime | Runtime/Combat API | The journey's subject |
| M01 | Schema | validatePack | The journey's gate |

## Context

Every producer has landed (S01–S04). This session owns the first narrow journey (CAP-G7) across the real transport — generate → validate → load → fight with positions → gates → burst → snapshot/resume — on a **real generated pack** (dark-fantasy, seed 42, the existing determinism-fixture precedent), not a hand-built fixture. Then the README documents the spatial surface (NFR-DX: README examples are executed by tests — the journey test executes the README's grid-combat snippet).

## Capabilities

- **CAP-G7 (owner):** the full journey + its acceptance assertions; the feature's integration checkpoint.
- All CA proofs integrated here: G1 (pack loads with spatial), G2 (reach gate), G3 (positions round-trip), G4 (burst multi-target), G5 (validity gate).

## Contract Agreements

At checkpoint 0, re-read the committed sources for each provisional CA mapping and confirm the actual landed shapes match what the earlier sessions recorded in STATE.md Handoff Notes:

- **CA-G3:** positions in `StartCombatRequest` → `CombatantState.position` → envelope `combatants[].position` → restore re-states. The journey exercises every edge.
- **CA-G4:** burst around the declared target hits both sides within Chebyshev radius.
- **CA-G5:** `hasTarget(adjacent)` actions reject out-of-reach in a spatial pack, pass in theater.

If any landed shape differs from the CA mapping, do not improvise: record the delta as a CA amendment need in your handoff and adapt the journey to the *committed* behavior.

## Files to Create/Modify

| File | Action | What Changes |
|------|--------|--------------|
| `tests/proofs/grid-journey.test.ts` | create | The journey suite (below) |
| `README.md` | modify | Grid combat section with an executable example |

## Implementation

### Checkpoint 1 — the journey

`tests/proofs/grid-journey.test.ts`, deterministic (seed 42, the established fixture seed; no ambient entropy):

1. **Generate + load:** `generateCampaign({theme: loadTheme('dark-fantasy'), seed: 42})` → `new Runtime(pack)` (stage-8 validation inside the constructor is the load gate — reaching here proves CAP-G1/CA-G1 on a generated pack).
2. **Compose:** `profileFromCharacter` for the hero (an approved character path); `spawnMonster`/`profileFromStatblock` for a foe. `startCombat(runtime, {allies, enemies, positions: {...}, rng: new Rng(42)})`.
3. **Adjacency rejects:** place the two combatants 3 grid steps apart → `declare` the melee action → expect `declare:rejected` kind `spatial` (rule `E-SPAT-01`), state unchanged (serialize before/after deep-equal).
4. **Restore-close:** `serializeCombat` → `deserializeCombat` with the target's position moved adjacent (the v1 movement seam — the FR-10 between-steps boundary) → gates re-enforced: the same declare now resolves.
5. **Burst (CA-G4):** place a second combatant of the *actor's own side* within the burst radius of the target and one outside → declare a burst spell (`ember-bloom`-shape: `target(burst-N, save(…))`) → assert every in-radius combatant (both sides) received a save outcome (mixed branches are the effect's data), the out-of-radius one did not.
6. **Validity (CA-G5):** an action with `valid: 'hasTarget(adjacent)'` rejects when its shape resolves empty; passes when the target is in reach.
7. **Round-trip:** `serializeCombat` mid-fight → JSON.stringify/parse → `deserializeCombat` → gates hold (out-of-reach still rejects), `rng` state equal, positions restored.
8. **Perf budget:** assert the round-loop (declare+step over 10 combatants) completes well inside the documented budget — reuse the existing `tests/proofs/perf-budget.test.ts` measurement idiom, not a copy of its file.
9. **Theater parity (same test file):** the same journey on the *non-spatial* pack: no `positions` → no reach rejections, `hasTarget(adjacent)` passes, burst spell resolves to the bound target only.

**Commit when:** `pnpm exec vitest run tests/proofs/` green (the whole proof trio + perf budgets + your new journey).

### Checkpoint 2 — README + close

README gains a **Grid combat** section (after the combat section): the FR-11 opt-in story in one paragraph, a pack snippet showing the `spatial` section, a code example (generate → load → `startCombat` with `positions` → declare with gates → serialize → resume), and the theater-of-mind note. The journey test executes the README's snippet shape — keep them in sync (NFR-DX discipline: docs examples are tested; cite `tests/proofs/grid-journey.test.ts` in the section).

Then the full package gate: `pnpm typecheck` · `pnpm lint` · `pnpm test` (whole suite — the new baseline) · `pnpm build` · `pnpm check:isolation` · `pnpm check:security` · `pnpm format:check`.

**Commit when:** README section landed; all package gates green.

## Verification

- `pnpm exec vitest run tests/proofs/` — the proof trio + perf + journey (the CI package job's exact command).
- `pnpm test` — the new whole-suite baseline; record the count in the handoff (baseline was 503/503 pre-feature; S02–S04 add their suites).
- `pnpm build` + `pnpm check:isolation` + `pnpm check:security` — the runtime surface must not pull the compiler; your journey imports both *in tests only* (tests are not part of the bundle).
- Artifact freshness: the journey builds from source via `generateCampaign` at run time — no stale dist involved; state the seed and theme in the test name.
- Determinism: run the journey twice in one suite run (two identical fight scripts, byte-equal event streams) — the existing character-profile test's pattern.

## State Update

Report: status, checkpoints, journey assertions passing, new whole-suite baseline count, README section landed, any CA amendment needs surfaced by the journey (provisional CA-G3/G4/G5 rows: Orchestrator re-checks against committed producers before this session). `followUp`: none expected — this is the feature's last session; note any residual debt (e.g. movement verb decision, evalPackFormula parse-once debt from STATE.md Design Decision 10).