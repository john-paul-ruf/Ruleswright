# Final Report — Ruleswright / builder-rulings

## Summary

The human's four rulings from 2026-10-04 ("1 yes, heal 2 recommendation 3 no 4 recommendation") are applied, proven and documented:

1. **Healing `mending` spells (DD-R1, CAP-R1).**
   - zombie-urban `bind-the-bite`, dark-fantasy `bind-wound` and wyldwood `bind-wound` now read `heal(1d8 + ability(vigor))`, using the caster's vigor ability. The heal is capped at the target's `maxHp`.
   - Targeting is unchanged (DD-R2): the host names the ally with `{ targetId }`.
2. **Symmetric restricts (DD-R3, CAP-R2).** Out of combat, `isRestricted` and `restrictedIds` now block a spell by `actions.tagged:` **or** `spells.tagged:`, the same rule as a combat declare. Actions are still blocked only by `actions.tagged:`.
3. **XP never lowers a level (DD-R4, CAP-R3).** `awardXp` sets each class to `max(current, min(xpLevel, raceCap, ceiling))`. This closes F-FP1 and F-P3.
4. **"Feat-slotted" is documented as "any class" (DD-R5, CAP-R4).** This ruling changes no code. database.md DD-F3 and the README now state the rule plainly. It closes F-P7 as intended behaviour.

Contract **v1.9** is description only: no field, no rule id, `schemaVersion` stays 1. It adds compatibility caveats (e) and (f) and Version Registry row 10.

**Sessions done:** 2 / 2 (S01: 2/2 checkpoints; S02: 4/4 checkpoints).

## Files

Base `e7e5828` (plan commit) → end `6534364` (VERIFICATION.md commit). Source: `git diff --name-status e7e5828..6534364` and `--shortstat`.

**Totals:** 16 files changed (2 added, 14 modified), **+551 / −54**.

| Group | Files | Paths |
|---|---|---|
| Library source (`src/`) | 5 M | `src/runtime/progression.ts`, `src/runtime/conditions.ts`, `src/compiler/themes/{dark-fantasy,zombie-urban,wyldwood}.json` |
| Tests (`tests/`) | 1 A + 5 M | A `tests/proofs/rulings-journey.test.ts`; M `tests/runtime/progression.test.ts`, `tests/proofs/feat-slots-journey.test.ts`, `tests/runtime/conditions.test.ts`, `tests/runtime/combat/spells.test.ts`, `tests/runtime/combat/character-profile.test.ts` |
| Docs | 1 M | `README.md` |
| Program records (`program/`) | 1 A + 3 M | A `prompts/builder-rulings/VERIFICATION.md`; M `specs/database.md`, `arch/v1-core.md`, `prompts/builder-rulings/STATE.md` |

**Group check:** 5 + 6 + 1 + 4 = 16.
- Outside `program/`: 12 files, +367 / −30 (`git diff --shortstat e7e5828..6534364 -- . ':!program'`).
- Inside `program/`: 4 files, +184 / −24 (`-- program`).
- 367 + 184 = 551 and 30 + 24 = 54.

## Architecture impact

- No new module, no new export, and no import line changed. `src/runtime/index.ts` is untouched, and no cross-module edge was added.
- Two existing public functions in M03 changed behaviour: `awardXp` now uses the max-level rule, and `isRestricted`/`restrictedIds` apply the spell-kind rule.
- M04 changed content only: three effect lines. All three themes' `contentHash` changed. No test pins a literal hash.
- The architecture delta was appended under `<!-- builder-rulings SESSION-02 -->` in `arch/v1-core.md` (`4c74017`). It lists these stale lines to retire or rewrite at the final Archivist synthesis (F-R7): l.279, l.340, l.566-568, l.966, l.1072, l.1215-1220 (asymmetry part only; `spells.tagged:` load integrity stays carried), l.1236-1240, l.1244-1246, l.1247 and l.1249.

## Verification (gates)

Orchestrator ran these itself at the S02 receive (`c851de2`), reading exit codes:

| Command | Result |
|---|---|
| `pnpm typecheck` | 0 |
| `pnpm lint` | 0 |
| `pnpm format:check` | 0 |
| `pnpm build` | 0 |
| `pnpm check:isolation` | 0 |
| `pnpm check:security` | 0 |
| `pnpm test` | 50 files, **923/923** (baseline 49 / 911; +12 tests = 1 new file with 9, plus 2 in progression and 1 in conditions) |
| `pnpm exec vitest run tests/proofs/rulings-journey.test.ts` | 1 file, 9/9 |

At the S01 receive, Orchestrator ran typecheck, lint and format:check (all 0) and `pnpm exec vitest run tests/schema` (4 files, 119/119), and confirmed `src/schema/contracts` was unchanged.

S02 recorded negative controls; each was reverted temporarily and restored before its commit:
- reverting a theme line fails journey legs 1 and 4;
- reverting `isRestricted` gives 3 failures;
- removing `Math.max` gives 4 failures.

## Residual gaps (carried)

- **F-FP2, class features.** This is the next feature. It needs a human-authorized DB re-entry and a product decision on what a feature does. The bundled themes already carry `content.classes.<id>.features`.
- **Load-time integrity for `spells.tagged:` patterns.** Tightening it would be a breaking change, and it was not asked for.
- **F-R6, mock copy.** At `mocks/progression.html:70-80`, Brynn is created at level 4, then `awardXp(brynn, 2400)` shows `level:reached warden 4`. Under v1.9 the level stays 4 and no `level:reached` fires. This is Author-owned; it needs a Designer re-entry, and no session owns it.
- **Carried ledger:** `restricts` symmetry in `isLivePattern` (C1, no non-test consumer); cleanup C2; browser determinism leg; snapshot byte-conformance; cone/line shapes; `useItem` duration display; 12 `damage(half)` sites; `evalPackFormula` parse-once; R-GM-1..3; F-M2; the optional "slots remaining" query (DD-F7 follow-up); `database.md:700` naming only two theme templates (pre-existing drift, F-R7).

## Follow-up

- Next feature: F-FP2, class features. It needs a human-authorized DB re-entry and a product decision.
- Designer re-entry for the `mocks/progression.html:70-80` copy (F-R6).
- Final Archivist synthesis: retire the F-R7 lines and collapse the builder-rulings SESSION-02 marker.

## Verification

**Feature Verification pass:** one envelope (VERIFY-01, handle h-vctI), 2026-10-04. Source: `program/Ruleswright/prompts/builder-rulings/VERIFICATION.md`, committed at `6534364`. Orchestrator made the commit with `git add -f` and an explicit pathspec, because the prompts directory is gitignored and `commit_pathspec` refused it. The file content is the worker's, unchanged.

**Rows:** 8 verified · 0 present-unverified · 0 failed (none to route) · 0 blocked. The rows are CAP-R1..R4; FR-6 (XP never lowers; feat-slotted wording); FR-7 (out-of-combat restricts); and FR-9 (spells under restricts; healing `mending` spells).

The worker re-ran `pnpm test` (50 files, 923/923) and six targeted files (94/94). It relied on S02's recorded negative controls, because its lease is read-only. CAP-R4 is verified by text review plus `feats.test.ts` l.179; no test exercises a class used only by statblocks.

### Behavior unverified — human review required (0 rows)

| ID | Exists | What is unproven | Why it could not be proved here |
|---|---|---|---|

none. The pass returned no `present-unverified` row.

## Orchestration

**Concurrency:** 3 (effective 1; the plan is serial S01 → S02, and no pair was declared concurrent). **Binding:** Native (`mcp__demiurge__spawn_subagent` / `await_subagent_result`). **Wall clock:** about 17 minutes, from run start 14:58 to the VERIFICATION commit at 15:15 (`git log -1 --format=%ci 6534364`). This Final Report and the final Archivist come after that.

**Sessions run:** 2 planned sessions, plus 1 planning-completeness Archivist and 1 verification Coder. **Checkpoints committed by Coder:** 6 (`git log --oneline e7e5828..6534364 --grep checkpoint` → 6: S01 ×2, S02 ×4).

### Wave plan as executed

| Wave | Sessions | Notes |
|---|---|---|
| W0 | ARCHIVIST-PREFLIGHT (h-B643) | Planning completeness: D1–D7 all pass; F-R1..F-R9. STATE `bb32506`. One 300 s await idle timeout, re-awaited per the PROGRAM-CONFIG convention (not a crash). |
| W1 | SESSION-01 (h-jGwz) | DB Author re-entry, v1.9 text, 2/2 (`cfda5dc`, `9fdd0b9`). CA-R1..R3 rechecked: no meaning delta. STATE `8eae481`. |
| W2 | SESSION-02 (h-Bodu) | Coder, 4/4 (`1056f48`, `b9e52e3`, `4be2a57`, `c851de2`); envelope amendments F-R1..F-R5 and F-R7. Arch `4c74017`; STATE `f3ed463`. |
| — | VERIFY-01 (h-vctI) | Feature Verification: 8 verified. `6534364`. |

### Blocked

none

### Blocker escalations

| S | Class | Action / human ask | Disposition |
|---|---|---|---|
| VERIFY-01 | mechanical-owner-seam | `commit_pathspec` cannot stage the gitignored VERIFICATION.md. Orchestrator committed the worker's file unchanged with `git add -f` and an explicit pathspec. | cleared (`6534364`) |

No human interruption was needed. The STATE advisory about the human not yet having seen the answer-2 and answer-4 recommendations was cleared, because the human issued "start" after the plan summary (F-R9; decision register).

### Interim Archivist checks

| After wave | Sessions received | Result | Drift found | Actions |
|---|---|---|---|---|
| — | — | Not configured: 2 sessions, under the 16-session threshold. Only the planning-completeness pass (W0) and the final pass ran. | — | — |

### Lease violations

none. Every commit was checked with `git show --name-only --format=`: S01 touched only `specs/database.md`, and S02's four commits touched only its 12 leased paths.

### Checkpoint shortfalls

none. S01 had 2 commits against a declared 2; S02 had 4 against 4.

### Wave plan corrections

none. No pair was marked concurrent.

### Granularity feedback for Planner

none. Every checkpoint landed in one pass, and no worker reported a misdrawn boundary. The planning-completeness review corrected five journey premises in S02 ck3 and ck2 before dispatch: wound size, positions, how conditions are pushed, dice parsing, and the location of `hex-rite`. These were all test-setup facts that a plan-time probe on a composed journey would have surfaced.

### Process effectiveness

- **First-dispatch completion:** 2 / 2 sessions accepted without redispatch or unplanned correction.
- **Unplanned corrections:** 0. The F-R1..F-R5 amendments were carried in S02's envelope before dispatch (test data and wording inside the lease; affects CAP-R1 and CAP-R2). They were not post-dispatch corrections.
- **Integration rework:** 0 corrective commits after acceptance.
- **Durations, from commit times:** S01 checkpoints landed at 15:06; S02 ck4 landed at 15:11:44 (`git log -1 --format=%ci c851de2`).
- **Not planning defects:** the gitignore commit seam for VERIFICATION.md is environmental. It recurred from feat-progression.

### Capability completion

CAP-R1, CAP-R2, CAP-R3 and CAP-R4 are **verified** against current sources (`f3ed463` STATE; VERIFICATION `6534364`). CA-R1..R4 are proven. No required capability remains planned, blocked or stale. Class features (FR-6) are outside this feature's scope and remain unbuilt (F-FP2, carried).

### Follow-up closure ledger

| Source | Entry (verbatim summary) | Disposition |
|---|---|---|
| S01 followUp | "Before dispatching S02, Orchestrator should re-check CA-R1, CA-R2 and CA-R3 against `9fdd0b9`." | **closed**: rechecked at the S01 receive, no meaning delta (STATE `8eae481`) |
| S01 followUp | "S02 still owns the CAP-R2 and CAP-R3 runtime work and proofs … and the CAP-R4 README sentence." | **closed**: S02 `1056f48`, `b9e52e3`, `4be2a57`, `c851de2` |
| S01 / S02 followUp | "F-FP2 … remain[s a] carried item" | **carried**: next feature (class features); needs a human-authorized DB re-entry |
| S01 / S02 followUp | "`spells.tagged:` load integrity … carried" | **carried**: standing ledger; breaking under the versioning discipline; needs a human decision |
| S02 followUp | "Orchestrator integrates the arch fragment … stale `arch/v1-core.md` lines" | **closed** (delta appended `4c74017`); the line retirement is **carried** to the final Archivist synthesis (this run) |
| S02 followUp | "Still carried: … C1, C2" | **carried**: standing cleanup ledger |
| S02 followUp | "`mocks/progression.html:70-80` mock residual (F-R6, Author/Designer)" | **carried**: Designer re-entry (Author-owned; no session) |
| S02 followUp | "CAP-R4 needs only the text review at receive." | **closed**: reviewed at the S02 receive and in VERIFY-01 |
| S02 surprise | heal payload `{amount, type: undefined, hp}`; dice only in `why.rolls[0]` | **retired**: documented in the arch delta; the journey parses it, so no defect |
| S02 surprise | `CombatantProfile.maxHp` optional in the type; journey uses `maxHp!` | **retired**: test-only non-null assertion; the type is pre-existing and was not in scope |
| VERIFY-01 surprise | commit refused (gitignored prompts dir) | **closed**: Orchestrator committed `6534364` |
| VERIFY-01 surprise | CAP-R4 has no statblock-only-class test | **retired**: covered by the same rule `feats.test.ts` l.179 proves; recorded in VERIFICATION.md |

### Archivist's Note

{pending — appended verbatim after the final Archivist pass}
