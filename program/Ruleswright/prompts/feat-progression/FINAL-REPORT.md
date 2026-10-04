# Final Report — Ruleswright / feat-progression

## Summary

FR-6's **feat-slot** item is built, with contract **v1.8**: `progression.<classId>.featSlots`, per-class per-level running totals that add up across a character's classes. A feat-slotted pack refuses every path that would leave a character holding more feats than its slots, with the runtime rule `feat-slots-exceeded`:
- `learnFeat`;
- `levelSet`, through `validateBuild`'s new optional `heldFeats` parameter;
- `awardXp`, which now computes, then checks, then applies;
- character and party restore. The human chose this on 2026-10-04, answering Q2 "refuse".

A pack that declares no `featSlots` keeps the v1.7 behaviour: no cap. All 9 bundled classes declare `[1, 1, 2, 2, 2, 3, 3, 3, 4, 4]`.

FR-6 "class features" is **not** built. It is carried as F-FP2, owned by DB.

- **Sessions done:** 2 / 2. S01 was a DB Author re-entry; S02 was the Coder session.
- **Base / end:** plan HEAD `d97f269` → feature end `b2db48b` (VERIFICATION.md commit; the last STATE commit is `8b1f224`).

## Files

Derived from `git diff --name-status d97f269..b2db48b`: **20 files**, of which 2 were added (A) and 18 modified (M). `git diff --shortstat`: 848 insertions, 51 deletions.

| Group | Count | Files |
|---|---:|---|
| Schema (M01) | 3 | M `src/schema/artifacts.ts`, M `src/schema/validate/sections/progression.ts`, M `src/schema/contracts/pack.schema.json` (DB-owned, S01) |
| Runtime (M03) | 3 | M `src/runtime/feats.ts`, M `src/runtime/progression.ts`, M `src/runtime/snapshots.ts` |
| Compiler content (M04) | 3 | M `src/compiler/themes/{dark-fantasy,zombie-urban,wyldwood}.json` |
| Tests | 6 | A `tests/proofs/feat-slots-journey.test.ts`; M `tests/schema/validate.test.ts`, `tests/runtime/feats.test.ts`, `tests/runtime/progression.test.ts`, `tests/snapshots/character.test.ts`, `tests/compiler/coverage-floor.test.ts` |
| Docs | 1 | M `README.md` |
| Program records | 4 | M `program/Ruleswright/specs/database.md` (S01), M `program/Ruleswright/arch/v1-core.md` (Orchestrator delta), M `.../feat-progression/STATE.md`, A `.../feat-progression/VERIFICATION.md` |
| **Total** | **20** | 3 + 3 + 3 + 6 + 1 + 4 = 20 |

## Architecture impact

- **No new module, no new cross-module edge, no new rule id, and no change to the public `index.ts` exports** (DD-F7).
- **New intra-M03 value edge `progression.ts → feats.ts`.** `feats.ts` is still a leaf: per `grep '^import' src/runtime/feats.ts`, its only value import is `./errors`; `./runtime`, `./character` and `./events` are type-only imports.
- **New module exports of `feats.ts`, not on the barrel:** `featSlotTally`, `FeatSlotTally`, `featSlotsExceeded`.
- **Public API change:** `validateBuild`'s optional 4th parameter `heldFeats`.
- **`awardXp` compute → check → apply.** Event order and payloads are unchanged. A side effect: `invalid-xp-table` is now all-or-nothing (S02 R1 deviation, F-P4).
- **Arch delta** appended at `3da588a`. It marks the "no feat-slot cap (FR-6 gap)" text at `arch/v1-core.md` l.272 and l.567 for retirement at Archivist synthesis.

## Verification

Orchestrator reran these at the S02 receive, reading exit codes:
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm build`: all 0.
- `pnpm test`: **49 files, 911/911**, against a baseline of 48 files, 878/878.
- `pnpm check:isolation` and `pnpm check:security`: both 0.

At the S01 receive: typecheck, lint and format were 0, and `tests/schema` passed 111/111. The S02 negative control (worker-reported): with the new `learnFeat` check removed, journey legs 2, 6 and 8 (×2) fail.

## Residual gaps

- **F-FP1 / F-P3 (human).** `awardXp` can lower a directly-set class level; this feature did not change that (DD-F10). Combined with the new cap, a directly levelled character at its feat cap has every XP award below its level's threshold refused, and small awards never accumulate. Is the level drop intended?
- **F-P7 (human).** A pack that declares `featSlots` only on a monster-only progression entry caps every player class at 0, under the approved "any entry" meaning. Should only player-class entries make a pack feat-slotted? No bundled content reaches this.
- **F-FP2 / F-P5 (DB, future human-authorized re-entry).** FR-6 "class features": `database.md`'s `features` row is in neither the schema nor the validator.
- **Carried, unchanged:**
  - the `mending` spells (3 sites; human content question);
  - restricts symmetry (human);
  - cone/line shapes (FR-11 deferral);
  - cleanup items C1, C2 and C14;
  - the `useItem` condition-duration display;
  - the 12 fail-branch-free `damage(half)` sites;
  - the `evalPackFormula` parse-once debt (F-P6).
- **CAP-F1 (optional).** The compiler-side refusal of a malformed `featSlots` has only an ad hoc probe (VERIFICATION P1), not a committed `tests/compiler` case.

## Follow-up

- Ask the human F-FP1/F-P3 and F-P7, batched with the carried mending/restricts questions.
- A future class-features feature (DB re-entry) closes F-FP2.
- An optional host-facing "slots remaining" query (DD-F7 follow-up).
- An optional `tests/compiler` malformed-`featSlots` case.

## Verification

**Feature Verification pass:** one envelope, 2026-10-04 (VERIFY-01, handle h-N8O8). Source: `program/Ruleswright/prompts/feat-progression/VERIFICATION.md`, committed at `b2db48b`. The worker could not commit it, because the path is gitignored and `commit_pathspec` does not force-add. Orchestrator committed the worker's file unchanged with `git add -f` and an explicit pathspec.

**Rows:** 7 verified · 0 present-unverified · 0 failed (none to route) · 0 blocked. The FR-6 row covers feat slots only. "Class features" is explicitly not verified (F-FP2).

### Behavior unverified — human review required (0 rows)
| ID | Exists | What is unproven | Why it could not be proved here |
|---|---|---|---|

none: the pass returned no `present-unverified` row.

## Orchestration

**Concurrency:** 3 (effective 1; serial plan)   **Wall clock:** ≈ 19 min (13:55 run start → 14:13 VERIFICATION commit, local time)
**Sessions run:** 2 (S01, S02), plus one planning-completeness Archivist, one verification Coder and the final Archivist.
**Checkpoints committed by workers:** 6. `git log --oneline d97f269..b2db48b --grep 'SESSION-0'` shows S01 2 (`3f63fd3`, `f4cc597`) and S02 4 (`45483c5`, `a32ded2`, `7bf5fa6`, `f7f6e88`).
**Binding:** Native (`mcp__demiurge__spawn_subagent` / `await_subagent_result`), no degradation.

### Wave plan as executed
| Wave | Sessions | Notes |
|---|---|---|
| W0 | ARCHIVIST-PREFLIGHT | planning completeness. D1–D7 all pass; F-P1..F-P8 dispositioned (STATE `7a7a8d3`) |
| W1 | S01 | DB v1.8. CA-F1..F3 rechecked: no meaning delta; the refusal-path lettering differs, so paths are now cited by name (STATE `3e3d384`) |
| W2 | S02 | dispatched with envelope amendments F-P1/F-P2/F-P4/F-P8 and the lettering note (STATE `8b1f224`) |
| — | VERIFY-01 | Feature Verification pass (`b2db48b`) |

### Blocked
none

### Blocker escalations
| S | Class | Action / human ask | Disposition |
|---|---|---|---|
| VERIFY-01 | mechanical owner seam | `commit_pathspec` cannot stage the gitignored VERIFICATION.md; Orchestrator committed it with `git add -f` and an explicit pathspec | cleared |

### Interim Archivist checks
| After wave | Sessions received | Result | Drift found | Actions |
|---|---|---|---|---|
| — | — | none (2-session run; cadence: planning completeness + final only) | — | — |

### Lease violations
none. `git show --name-only` was checked for every checkpoint commit. S02's two deviations were both R1 and inside the lease. VERIFY-01's R3 named its own writable path.

### Checkpoint shortfalls
none. S01 claimed 2 and git shows 2; S02 claimed 4 and git shows 4.

### Wave plan corrections
none. The plan declared no concurrent pairs.

### Granularity feedback for Planner
- The S02 ck2 prescribed test arrays (`featSlots [1, 2]`) did not fit the `cloneRuntimePack` fixture's 4-level ceiling. Planning completeness caught this (F-P1) before dispatch. Size fixture-dependent test data from the fixture's ceiling at planning time.
- The ck3 floor reused a `playerClasses` filter that skips 3 of 9 classes (F-P2), also caught before dispatch.
- The S02 ck1 validator snippet double-carded a negative entry (non-decreasing gated on `isInteger` only). The worker corrected it inside the lease (R1).
- SESSION-01's refusal-path lettering disagreed with STATE's DD-F6. Cite paths by name in plans.

### Process effectiveness
- **First-dispatch completion:** 2/2. Both sessions were accepted without redispatch or unplanned correction.
- **Unplanned corrections:** 0 owner-correction workers and 0 lease revisions. Pre-dispatch envelope amendments covered F-P1, F-P2, F-P4 and F-P8 (CAP-F1, CAP-F3, CAP-F4). The only Orchestrator mechanical action was committing VERIFICATION.md.
- **Integration rework:** 0 corrective commits after acceptance.
- **Durations** (commit and receive times): S01 13:58 → 14:03; S02 14:04 → 14:09.

### Capability completion
CAP-F1..F5 are **verified** against current sources: STATE Capability Readiness at `8b1f224` and VERIFICATION.md at `b2db48b`. CA-F1..F3 are proven. Product completion of FR-6 as a whole is **not** claimed: "class features" (F-FP2) is unbuilt.

### Follow-up closure ledger
| Source | Entry (verbatim/abridged) | Disposition |
|---|---|---|
| S01 surprise | "(c)/(d) lettering mismatch between SESSION-01 and STATE.md DD-F6" | **closed**: STATE CA recheck paragraph (`3e3d384`), paths cited by name; S02 envelope |
| S01 followUp | "Fix the lettering in the CA rows and STATE before S02 dispatches (Orchestrator)." | **closed**: `3e3d384` |
| S01 followUp | "F-FP2 (`features` row) and F-P7 … are still carried, untouched." | **carried**: F-FP2 → DB, future human-authorized re-entry; F-P7 → human question |
| S02 surprise | ck1 snippet double-carded a negative entry; gate now `isInteger(n) && n >= 0` | **closed**: S02 ck1 `45483c5` (R1) |
| S02 surprise | `arch/v1-core.md` l.272/l.567 stale "no feat-slot cap" | **closed** (delta `3da588a`), with synthesis (line retirement) handed to the final Archivist pass |
| S02 followUp | "F-FP1 is unchanged and human-owned (DD-F10) …" | **carried** → human (F-FP1/F-P3) |
| S02 followUp | "F-FP2: the `features` doc row, owner DB." | **carried** → DB |
| S02 followUp | "The arch fragment should retire the … lines in v1-core.md." | **closed** at `3da588a` (delta) and the final Archivist synthesis |
| VERIFY-01 followUp | commit VERIFICATION.md with `git add -f`, or give `commit_pathspec` a force option | **closed** at `b2db48b`; the tool option is **carried** → framework (Archivist "Proposed for the framework") |
| VERIFY-01 followUp | optional `tests/compiler` malformed-`featSlots` case (CAP-F1) | **carried** → next feature touching compiler tests (optional) |
| Preflight F-P6 | `useItem` condition-duration display; 12 `damage(half)` sites; `evalPackFormula` parse-once | **carried** → STATE Out of scope (`7a7a8d3`) |

### Archivist's Note
{pending: appended verbatim after the final Archivist pass}
