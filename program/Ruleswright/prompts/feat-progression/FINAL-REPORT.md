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

## Verification (gates)

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
**Checkpoints committed by workers:** 6. `git log --oneline d97f269..b2db48b --grep checkpoint` returns 6 (corrected after the final Archivist pass; `--grep 'SESSION-0'` also matches two STATE commits and the arch-delta commit): S01 2 (`3f63fd3`, `f4cc597`) and S02 4 (`45483c5`, `a32ded2`, `7bf5fa6`, `f7f6e88`).
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
Final Archivist, handle h--AYU (Ax9z0), 2026-10-04; synthesis commit `3018224` (arch/v1-core.md, PROGRAM-CONFIG.MD, ARCHIVIST-LOG.md only). The two report findings below (checkpoint command, duplicate heading) were applied in this same commit. Verbatim return:

## Archivist Note

I folded this cycle's changes into the arch record and the module registry, and committed them at `3018224`. The pass found no drift against the code. One cited command in the Final Report needs fixing, and the four role documents (PLANNER, CODER, UI-CODER, ORCHESTRATOR) are unchanged by this pass.

- **role:** archivist
- **registryUpdated:** true
- **reconciled:**
  - `program/Ruleswright/arch/v1-core.md`
    - Folded the feat-progression SESSION-02 delta (`3da588a`) into the main record and removed its marker.
    - Retired "no feat-slot cap (FR-6 gap)", formerly at l.272 and l.567.
    - Added the new code: `featSlots`, the `feats.ts` cap helpers, `validateBuild`'s optional `heldFeats` parameter, `awardXp` compute → check → apply, the restore refusal, the theme content and the feat-slot journey.
    - Summarized decisions DD-F1..DD-F10. Marked the spells-in-combat "FR-6 feat slots" residual closed, and added a feat-progression residuals block.
    - Added the new value edge inside M03 (`progression.ts → feats.ts`). It creates no cycle, and `feats.ts` is still a leaf.
    - The record header now points at `ad2cbe3`, nine cycles.
  - `program/Ruleswright/PROGRAM-CONFIG.MD`
    - Updated the realized-state note and the module registry through this cycle (M01 schema field and validator; M03 feats/progression/snapshots; M04 theme content only). No new module, edge or rule id.
    - Custom Rule 1 now records contract v1.8: Version Registry row 9 and caveat (d).
    - Updated the evidence notes on four existing conventions. No convention was minted or widened.
  - `program/Ruleswright/ARCHIVIST-LOG.md`: appended the 2026-10-04 entry.
- **Checks this pass ran at `ad2cbe3`:**
  - typecheck 0, build 0, isolation 0, format:check 0;
  - `pnpm test` 911/911 across 49 files;
  - proofs 74/74 across 10 files.
  - Lint and security were not re-run; they come from Orchestrator's receive at `f7f6e88`.
- **Record checks:**
  - **Contract agreements:** CA-F1..F3 match source.
  - **Verification:** STATE's Capability Readiness and VERIFICATION.md agree (7 verified, 0 present-unverified, 0 failed, 0 blocked).
  - **Final Report:** its Files table matches `git diff --name-status d97f269..b2db48b`: 20 paths (2 added, 18 modified), 3+3+3+6+1+4 = 20.
- **Finding for Orchestrator, which owns the Final Report:**
  - **Checkpoint command:** the report cites `git log --oneline d97f269..b2db48b --grep 'SESSION-0'` for its 6 checkpoints, but that command returns 9: two STATE commits and the arch-delta commit also contain "SESSION-0". `--grep checkpoint` returns the 6.
  - **Duplicate heading (cosmetic):** the report has two `## Verification` headings.
- **Deviations by rule (FR-19):**
  - **R1: 2**, both S02 and inside the lease (ck1 `45483c5` validator gate; ck2 `a32ded2`, F-P4).
  - **R2: 0.**
  - **R3: 1**, VERIFY-01 (the gitignored VERIFICATION.md).
  - **R4: 0.**
  - **Unclassified:** S01's (the DB re-entry) wording deviations carried no R-number.
- **Convention thresholds:**
  - **`npx` row (6f6b491b) crossed the three-cycle mark.** No convention was minted: the program rule already sits in Verification Commands, which this role doesn't own. The remaining fault is in the role docs, so it goes to the framework instead.
  - **Derived-facts convention:** sharpened by one sentence: "a cited command must reproduce the figure it is cited for."
- **conventionsAdded:**
  - — (no new convention)
- **proposedForFramework:**
  - **New (1 cycle · 1 instance):** `CODER.md:630-632` tells the verification worker to commit `program/{P_SLUG}/prompts/{F_NAME}/VERIFICATION.md` with `commit_pathspec`. That path is gitignored here and the tool can't force-add. Either add a `force` option limited to the envelope's writable paths, or have ORCHESTRATOR.md's verification step say Orchestrator force-adds the file.
  - **New (1 cycle · 2 instances):** PLANNER.md should require plans to cite cases by name, not by letter: SESSION-01 and STATE lettered the refusal paths differently. Prescribed code snippets should be probed or marked illustrative: the ck1 snippet produced two error cards for one negative entry.
  - **New (1 cycle · 1 instance):** DB.md and AUTHOR.md handoffs should use CODER.md's `deviations` shape (R1–R4), or say why Author sessions are exempt.
  - **Count raised (3 cycles · 4 instances):** `CODER.md:186/623` and `ORCHESTRATOR.md:380` still say `npx vitest run`. VERIFY-01 had to substitute `pnpm exec vitest run`.
  - **Count raised (6 cycles · 6 instances):** SPEC.md and AUTHOR.md still say Spec/DB are "never spawned", but plans keep dispatching orchestrated DB re-entries.
  - **Count raised (4 cycles · 4 instances):** ORCHESTRATOR.md's Final Report step should require each cited command to reproduce its figure.
  - **Narrowed (1 cycle · 2 instances):** row 82b4e0ab now covers only the temporary-worktree half. The wave-close re-verify half is in `ORCHESTRATOR.md:374-391`; the history is gitignored, so this pass can't tell whether that text is new.
- **logEntry:** appended the dated entry "2026-10-04 — final pass, cycle `feat-progression`" to `program/Ruleswright/ARCHIVIST-LOG.md`.

### cleanupBriefs

No new brief. The 2026-09-28 duplicated-logic brief still stands, unaccepted:

- **title:** Single-source duplicated logic (C1 `isLivePattern` surface decision; C2 `MAX_TABLE_DEPTH` constant)
- **targetArea:** `src/runtime/conditions.ts` + `src/runtime/index.ts`; `src/core/tables.ts` + `src/schema/validate/helpers.ts`
- **confidence:** medium
- **proposedPlannerTask:** build a cleanup program that settles whether C1 belongs on the public surface and single-sources C2 without giving M01 an internal import.
- **requiredChecks:**
  - `pnpm typecheck && pnpm build && pnpm test` (911/911)
  - `pnpm check:isolation`
  - M01 still imports nothing internal
- **risks:**
  - Dropping `isLivePattern` from the barrel is a public API change.
  - A naive re-export of the constant from core into schema breaks M01's leaf rule.

The scout of this cycle's diff found no new candidates.

### standingRecommendations

| id | pattern (short) | cycles | instances | first seen | status |
|---|---|--:|--:|---|---|
| b32fc8d0c8c92d52 | checkpoint-0 read sweeps exhaust context | 2 | 2 | v1-core | open |
| f57dbe4d010638fe | subagent fabricates tool inputs | 2 | 8 | v1-core | open |
| b85c8f3e113a6764 | barrel completeness gaps found at integration | 2 | 3 | v1-core | open |
| c1ed872bea557b96 | run tool argv misrouting | 2 | 3 | v1-core | open |
| 3658f327cc9cff2f | commit_pathspec fails on deleted files | 1 | 1 | v1-core | open |
| 1cc46f93038f1d9a | cross-suite pins land without an owner | 4 | 6 | loot-inventory | promoted (held) |
| 576a281656f83b23 | envelope factual premises reach sessions unverified | 7 | 32 | loot-inventory | promoted |
| 854ceecd39d4b0d3 | whole-repo fast gates red at role-scoped receives | 4 | 4 | v1-core | promoted (held) |
| 17f4803c1b08da77 | provider aborts kill subagents mid-session | 3 | 5 | loot-inventory | open (promotion held) |
| 6f6b491bdbe37bf0 | bare npx misresolves | 3 | 4 | loot-inventory | open (cycles axis crossed; rule already in Verification Commands) |
| 1d910de11732c6c4 | aborted final Archivist pass leaves a double synthesis | 2 | 2 | loot-inventory | open |
| c172cd30e8dfc756 | commit gates hard-code a stale base SHA | 1 | 1 | equipment-consumables | open |
| cecd211504587426 | host await idle timeout | 4 | 7 | equipment-consumables | promoted; framework wording open |
| f68c42a3f6224eb1 | Final Report facts transcribed, not derived | 4 | 4 | v1-core | promoted (sharpened); framework wording open |
| a368039028d463d6 | role docs say Spec/DB never spawned | 6 | 6 | grid-combat | promoted; framework wording open |
| 3983f8eb6d18a5f2 | STATE row matcher writes into wrong rows | 1 | 2 | grid-movement | open |
| f4621ac12fba3456 | pin audits miss behavior pins | 3 | 4 | grid-combat | open |
| 760b67f17edbd346 | newly reachable content goes unscanned | 2 | 2 | spells-in-combat | open |
| 82b4e0abbda105d6 | shared working tree under concurrency | 1 | 2 | spells-in-combat | open (narrowed to worktree half) |
| c3c94358b35f8316 | Final Report cites `..HEAD` | 1 | 1 | action-targeting | open |
| c187bed6bb5132a7 | gitignored VERIFICATION.md vs commit_pathspec | 1 | 1 | feat-progression | open |
| 8039d6869169267c | plan artifacts inconsistent (lettering, snippet) | 1 | 2 | feat-progression | open |
| d2415cb4497e0049 | Author/DB deviations carry no rule number | 1 | 1 | feat-progression | open |
