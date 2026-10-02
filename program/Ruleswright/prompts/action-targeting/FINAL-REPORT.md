# Final Report — Ruleswright / action-targeting

## Summary

Actions can now affect their user. Contract v1.7 adds the `self` shape word of `target(…)` and **self actions**: an action whose effect root is `target(self, …)` binds its actor, with no opponent resolution and no reach gate, whether declared or taken as a reaction. The 10 bundled self-buff actions now land on their user; `brace` roots its user (human-confirmed). v1.7 also adds the `ability(name)` formula function (registry 14 → 15), legal only in effects, which reads the actor's ability unshadowed by a same-named save. The zombie-urban med-kit now reads `heal(2 + ability(vigor))` and heals 12 at level 1, where it healed 2 (human-chosen). Two carried gaps are closed: `heal` is in `EFFECT_VOCABULARY`, and zombie-urban medic/fixer and wyldwood hedge-mage now know their spells.

- **Sessions done:** 3 / 3. S01 was a DB Author re-entry, S02 and S03 were Coder sessions.
- **Capabilities:** CAP-A1..A7 are all **verified** against current sources (see *Capability completion*).
- **Contract Agreements:** CA-A1..A4 are all **proven**.
- **Whole suite:** `pnpm build && pnpm test` gives 48 files, 878/878. This was observed by Orchestrator at the S03 receive on HEAD `3cce108`. The baseline was 44 files, 829/829.

## Files created and modified

Command: `git diff --name-status 0b5787e..ebf081c` (`0b5787e` = last commit before this feature; `ebf081c` = final STATE commit before this report — pinned per the final Archivist finding (b), since `..HEAD` also counts this report) → **26 paths: 9 added (A), 17 modified (M)**. Breakdowns:

| Group | Count | Paths |
|---|---:|---|
| Engine source | 7 | M `src/core/dsl/{effect,formula,registry}.ts`, M `src/runtime/combat/{combat,resolve}.ts`, M `src/runtime/equipment.ts`, M `src/schema/validate/sections/cross.ts` |
| Theme content | 3 | M `src/compiler/themes/{dark-fantasy,wyldwood,zombie-urban}.json` |
| Contract (DB-owned) | 1 | M `src/schema/contracts/pack.schema.json` (description only) |
| Tests | 7 | A `tests/compiler/spell-lists.test.ts`, A `tests/core/dsl/ability.test.ts`, A `tests/proofs/self-target-journey.test.ts`, A `tests/runtime/combat/self-target.test.ts`; M `tests/core/dsl/checker.test.ts`, M `tests/proofs/equipment-journey.test.ts`, M `tests/proofs/spells-journey.test.ts` |
| Docs | 1 | M `README.md` |
| Program bookkeeping | 7 | M `program/Ruleswright/specs/database.md`, M `program/Ruleswright/arch/v1-core.md`, A `program/Ruleswright/prompts/action-targeting/{MASTER,STATE,SESSION-01,SESSION-02,SESSION-03}.md` |
| **Total** | **26** | 7 + 3 + 1 + 7 + 1 + 7 = 26. Added: 4 tests + 5 prompts = 9. Modified: 17 |

Code diff, from `git diff --shortstat 0b5787e..ebf081c -- src tests README.md`: 19 files changed, 1035 insertions(+), 37 deletions(-). The 19 files are src 11 + tests 7 + README 1.

## Architecture impact

These claims are derived from the landed diffs (`git diff 0dfe8f8..HEAD`, `git diff 5b4abca..HEAD`). No module ID and no rule id was added. No new value import was added across modules: every edit uses imports that already existed. M01 still imports no core value, and `NON_FORMULA_ARGS` is a hand mirror.

- **M03 Runtime:** combat.ts adds the exported `isSelfAction(runtime, actionId)`. Inside it, `resolveShape('self')` → `[actor.id]` runs before the theater early return. `declare` and `resolveReactive` bind self actions, skip `resolveTarget` and `spatialGate`, and refuse a foreign `targetId` with `invalid-target` / `E-REF-01`. Two private helpers support this: `selfTargetRefusal` and `resolveReactiveAgainst`. Separately, `effectVars` (resolve.ts) and `useItem` (equipment.ts) bind the reserved var `ability:<name>`.
- **M02 Core:** `REGISTRY.ability` (15 entries). `EFFECT_VOCABULARY` gains `heal` and is now pinned to exactly the effect-kind entries. `FORMULA_VOCABULARY` gains `ability`. `FormulaCheckContext.allowAbility` is set only by `checkEffect`. `checkAbilityCall` returns E-FORM-02 / E-FORM-03, and `evalCall` fails closed.
- **M01 Schema:** `NON_FORMULA_ARGS.ability = [0]`.
- **M04 Compiler:** content only. 10 actions are wrapped in `target(self, …)`, the med-kit `use` line changed, and the spellLists changed for zombie-urban medic/fixer and wyldwood hedge-mage.
- **Contract:** database.md v1.7 and Version Registry row 8, with one compatibility caveat (c): `target(self, …)` now resolves to the actor. `pack.schema.json` changed its description only.
- **arch:** the deltas were appended mid-run at `a84dd52` (S02) and `42a1fd3` (S03). Synthesis belongs to Archivist.

## Verification

Orchestrator ran these at each receive and read the exit codes:

| Receive | Gates run | Result |
|---|---|---|
| S01 | `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm exec vitest run tests/schema` | 0, 0, 0; 4 files 111/111 |
| S02 | typecheck, lint, format:check, build, check:isolation, check:security; `pnpm test` (after build) | all 0; 46 files 854/854 |
| S03 | typecheck, lint, format:check, build, check:isolation, check:security; `pnpm test` (after build) | all 0; 48 files 878/878 |

Each count matches its parts. 854 = 829 + 12 (self-target) + 13 (journey). 878 = 854 + 12 (ability) + 2 (checker additions) + 10 (spell-lists). Both counts come from the vitest summary lines above.

**Negative controls (reported by the workers):**
- self-target: 11 of 12 fail against the old engine;
- the journey: 13 of 13 fail at `5b4abca`;
- ability: 3 of 12 fail without the binding and mirror;
- spell-lists: 6 of 10 fail with the pre-ck2 themes;
- equipment-journey: fails with the old med-kit line.

## Residual gaps

- **`mending` spells (carried to the human; content-meaning decision).** zombie-urban `bind-the-bite`, wyldwood `bind-wound` and dark-fantasy `bind-wound` (`dark-fantasy.json:273`, warden list, reachable before this feature; third site found by the final Archivist) are written as `damage(1d8 - vigor, mending)`-style lines: damage reduced by the target's vigor save, not a heal. S03 made `bind-the-bite` reachable for the medic. The open question is whether these should be heals.
- **Restricts symmetry (carried to the human).** Unchanged: it is still the open question from the spells-in-combat FINAL-REPORT.
- **Root-only self actions (documented limitation, database.md v1.7).** `sequence(target(self, …), …)` is still an ordinary action. No bundled content is affected.
- **Stale comment.** `tests/runtime/combat/character-profile.test.ts:381` ("med-kit = heal(2 + vigor)") is outside every lease. It was accepted as stale (auto-decision) and is carried to the next cleanup run.
- **Prior-ledger carries, not in scope (F-A8).** F-M2, R-GM-3, the `useItem` duration display, item tags, wyldwood charm armor, `evalPackFormula` parse-once and the browser determinism leg. Also FR-6 feat slots, `mocks/spatial.html:191` / `api-map.html` event names, and the cleanup items (`isLivePattern`, `MAX_TABLE_DEPTH`, `SnapshotOffer`).

## Follow-up

- Human: decide the `mending` spell meaning and the restricts symmetry question.
- Next cleanup run: the character-profile.test.ts:381 comment, plus the carried cleanup items.

## Orchestration

**Concurrency:** 3 configured. Effective 1: the plan is serial, no pair is declared concurrent, and S02/S03 share files.
**Binding:** Native (`mcp__demiurge__spawn_subagent` / `await_subagent_result`), run r-kw1N.
**Wall clock:** about 30 min, from the preflight Archivist (ended 22:11) to the final STATE commit `ebf081c` (22:34). The preflight launch time was not recorded. Worker end times, from the session logs: preflight 22:11:15, S01 22:21:48, S02 22:24:10, S03 22:30:04. The commit dates do not match these end times, so no per-session duration is claimed.
**Sessions run:** 3 planned sessions, plus 1 Archivist planning-completeness pass. The final Archivist pass follows this report.
**Checkpoints committed by Coder:** 8. Command: `git log --oneline --grep='SESSION-0[123]: checkpoint' 0b5787e..ebf081c | wc -l` → 8 = S01 2 + S02 3 + S03 3.

### Wave plan as executed
| Wave | Sessions | Notes |
|---|---|---|
| Pre | ARCHIVIST-PREFLIGHT | planning-completeness at `549b13d`. No blocking finding; F-A1..A10 dispositioned (STATE `a1d0174`) |
| W1 | S01 | DB re-entry, 2/2 (`64dc746`, `f622431`). CA-A1..A3 rechecked: no delta |
| W2 | S02 | 3/3 (`63f6e78`, `83c7939`, `05d4fbf`). CA-A2 rechecked against the landed code |
| W3 | S03 | 3/3 (`4c1e1e6`, `7c1b8b6`, `3cce108`) |

### Blocked
none

### Blocker escalations
| S | Class | Action / human ask | Disposition |
|---|---|---|---|
| S01 (pre-run) | product decision / schema-change | B-AT-1: DB v1.7, med-kit line, brace | cleared by the human 2026-10-01, before the run ("1 approved 2 12 3 confrim") |

The run itself raised no blockers.

### Interim Archivist checks
| After wave | Sessions received | Result | Drift found | Actions |
|---|---|---|---|---|
| (preflight) | — | done, no blocking finding | F-A1..A10 (informational) | routed through envelopes + STATE edits; no replan worker |

No interim checks were run: this is a 3-session build, so the cadence is final-only.

### Lease violations
none. `git show --name-only` on all 8 checkpoint commits showed only leased paths.

### Checkpoint shortfalls
none (2/2, 3/3, 3/3)

### Wave plan corrections
none

### Granularity feedback for Planner
- No checkpoint shortfalls, context exhaustion or redrawn boundaries.
- **One missed doc pin:** README l.381 said "zombie-urban's classes know no spells". The plan's pin audit missed it. The line became false at S03 ck2, and S03 corrected it inside its lease at ck3. This is a pin-audit miss (behavior/doc pin on content that moved), not a granularity defect.

### Process effectiveness
- **First-dispatch completion:** 3/3. Every session was accepted with no redispatch and no unplanned correction.
- **Unplanned corrections:** 0. No lease revisions and no owner corrections.
- **Integration rework:** 0 corrective commits after acceptance.
- **Preflight yield:** the review surfaced 10 informational findings, which went into the workers' envelopes:
  - F-A2: the self-buff now offers the actor's own feats. Documented in v1.7 and proven in S02.
  - F-A1: three journeys read `dist/`.
  - F-A5: the database.md Status line.
  - F-A7: the exact-membership vocabulary pin.
  - F-A3/F-A4: missing pin rows.
  - F-A6: the root-only limitation.
  - F-A8: carried items.
  - F-A10: journey turn spreading.
  - F-A9: citation drift.
- **Not planning defects:** no product decisions arose mid-run, and there were no environment failures. The await idle timeout fired once, on the preflight; per the convention it is not counted.

### Capability completion
| CAP | Status | Evidence |
|---|---|---|
| CAP-A1 self action on actor, any opponents/distance, spatial + theater | verified | self-target.test.ts + self-target-journey.test.ts @ `05d4fbf`; 878/878 at HEAD |
| CAP-A2 self reactions on the reactor | verified | same, ward-glint leg |
| CAP-A3 10 bundled self-buffs on their user | verified | `83c7939` + journey step 6 |
| CAP-A4 `ability(name)` in combat and out | verified | ability.test.ts @ `4c1e1e6`; equipment-journey @ `3cce108` |
| CAP-A5 med-kit heals 2 + vigor ability (12) | verified | equipment-journey steps 4-5, save 0 vs ability 10 |
| CAP-A6 `EFFECT_VOCABULARY` ⊇ `heal` (exact) | verified | checker.test.ts @ `4c1e1e6` |
| CAP-A7 medic/fixer/hedge-mage know their spells | verified | spell-lists.test.ts @ `7c1b8b6` |

No required capability is still planned, blocked or stale.

### Follow-up closure ledger
| Source | Item (verbatim gist) | Disposition |
|---|---|---|
| S01 followUp | "Orchestrator re-checks CA-A1 to CA-A3 against `f622431` before dispatching S02." | **closed**: rechecked at the S01 receive, no delta (STATE `5b4abca`) |
| S01 followUp | "S03 adds `ability: [0]` to `NON_FORMULA_ARGS`…" | **closed**: `4c1e1e6` |
| S01 surprises | none | — |
| S02 followUp | "CAP-A1, CAP-A2 and CAP-A3 are proven by the journey file above." | **closed**: verified at the receive, STATE `0dfe8f8` |
| S02 followUp | "Orchestrator should recheck CA-A2 against the landed `declare` / `resolveReactive` code before dispatching S03." | **closed**: rechecked at the S02 receive |
| S02 followUp | "S03 is the next owner… I did not touch the med-kit or the spell lists." | **closed**: S03 done |
| S02 followUp | "The arch fragment is at `.program/signal/SESSION-02.arch.md`." | **closed**: integrated at `a84dd52` |
| S02 surprises | prettier split `brace`'s line in dark-fantasy.json | **retired**: formatting only, in lease |
| S02 surprises | "Pins: none moved." | **retired**: confirmed by the 854/854 run |
| S03 followUp | Open content question: medic `bind-the-bite` / wyldwood `bind-wound` deal damage, not healing | **carried**: to the human (content-meaning decision). Owner: human |
| S03 followUp | character-profile.test.ts:381 stale comment | **carried**: to the next cleanup run (auto-decision register) |
| S03 followUp | "Orchestrator: integrate the arch fragment." | **closed**: `42a1fd3` |
| S03 surprises | README l.381 "zombie-urban's classes know no spells" missed by the pin audit; corrected in ck3 | **closed**: `3cce108`; recorded under granularity feedback |
| S03 surprises | the behavior pins moved exactly as planned | **retired**: confirmed by the 878/878 run |

### Archivist's Note
<!-- Final Archivist h-AZMv (ATcqx), synthesis b625ffa; return appended verbatim. Orchestrator applied its findings (a) third mending site and (b) end-SHA citation above. -->

- **role:** archivist
- **registryUpdated:** true. The module registry is reconciled to `535247d`. `git diff 0b5787e..535247d -- src` adds or removes no `import`/`export … from` line, so the value-import graph is unchanged from `94d40f3`. There is no new module ID, cross-module edge or rule id. M01→M04 key files now list the v1.7 additions.
- **reconciled:**
  - `program/Ruleswright/arch/v1-core.md`: the S02 and S03 delta sections (`a84dd52`, `42a1fd3`) are folded into the M01/M02/M03/M04/M05 sections and their markers removed. DD-A1..A9 are under Cross-cutting decisions, and the header and gates show the fresh run at `535247d`. Drift notes:
    - **Closed:** `heal` in the vocabulary, self-buffs, spell lists, and the med-kit shadowing question.
    - **Added:** an action-targeting residuals block.
  - `program/Ruleswright/PROGRAM-CONFIG.MD`:
    - header note and registry;
    - Custom Rule 1 (v1.7 contract and caveat c), Rule 2 (`ability(name)`; a save still hides a same-named ability) and Rule 4 (self actions are pack data);
    - Verification Commands, Git Config, Stack and Author Sources are unchanged.
  - `program/Ruleswright/ARCHIVIST-LOG.md`: the dated entry is appended. Everything is committed at `b625ffa`, by explicit pathspec.
- **conventionsAdded:**
  - **Pin-lease ownership widened to doc pins** (row 1cc46f93; cycles axis: 4 cycles, 6 instances). When a session changes a content fact, the pin audit now greps `README.md` and the docs as well as `tests/`.
    - The trigger was the README l.381 miss: "zombie-urban's classes know no spells" went false at S03 ck2 and S03 fixed it inside its lease at ck3.
  - Evidence notes only, no new rules:
    - premise verification held for a 6th cycle (30 instances);
    - authorization quoted in the envelope held for a 5th cycle.
- **proposedForFramework:**
  - **New, c3c94358 (1 cycle, 1 instance):** the Final Report should cite commands against an explicit end SHA, not `HEAD`. The report says `git diff --name-status 0b5787e..HEAD` gives 26 paths. That was true when written, but after the report's own commit the same command gives 27.
  - **f4621ac1 (3 cycles, 4 instances):** the PLANNER.md pin-audit grep should cover README and docs, not just `tests/`.
  - **760b67f1 (2 cycles, 2 instances):** when the "newly reachable content" scan raises a content question, grep the same pattern across all themes. This cycle the Planner ran the scan voluntarily and it worked, but it missed one site.
  - **a3680390 (5 cycles, 5 instances):** reconcile the "never spawned" wording in SPEC.md/AUTHOR.md with planned Author re-entry sessions.
  - **cecd2115 (4 cycles, ≥7 instances):** ORCHESTRATOR.md should name the 300 s await idle timeout as a non-crash.
  - No row is adopted. The role-doc mtimes are still 2026-09-25 and the content was checked row by row. PLANNER, CODER, UI-CODER and ORCHESTRATOR.md are byte-identical (sha1 checked before and after).
- **logEntry:** the 2026-10-01 entry, appended to ARCHIVIST-LOG.md. Findings for Orchestrator:
  - **(a) A third `mending` site.** The Final Report lists two `mending` spells. A source grep finds a third: dark-fantasy `bind-wound` (`dark-fantasy.json:273`, warden list, reachable before this feature). The human content question should name all three. It affects no capability.
  - **(b) The `..HEAD` path count no longer reproduces.** This is cosmetic and is the new row c3c94358 above.
  - **(c) Everything else checked out:**
    - contract agreements CA-A1..A4 match source with no mismatch (file:line citations are in the log);
    - CAP-A1..A7 are consistent;
    - lease audit clean on all 8 checkpoints;
    - +1035/−37 lines over 19 files, matching the report;
    - fresh gates: typecheck 0, build 0, isolation 0, 878/878 tests across 48 files, proofs 66/66 across 9;
    - lint, format and security were not re-run (taken from the Orchestrator receive at `3cce108`).

### cleanupBriefs

[] — no new campaign crosses a threshold. The 2026-09-28 duplicated-logic brief (C1 narrowed to `isLivePattern`, and C2 `MAX_TABLE_DEPTH`) carries forward unaccepted.
- **Closed:** C12 (`4c1e1e6`) and C13 (`0b5787e`).
- **New:** C14, the stale comment at `character-profile.test.ts:381`. It is tracking (high confidence, trivial), with the next cleanup run as owner.

### standingRecommendations

- **pattern:** large single-session builds exhaust context on checkpoint-0 read sweeps · **cycles:** 2 · **instances:** 2 · **firstSeen:** v1-core · **status:** open
- **pattern:** subagent fabricates tool inputs under long-recovery prompts · **cycles:** 2 · **instances:** 8 · **firstSeen:** v1-core · **status:** open
- **pattern:** public surface/barrel completeness gaps found at integration · **cycles:** 2 · **instances:** 3 · **firstSeen:** v1-core · **status:** open
- **pattern:** run tool drops/misroutes argv · **cycles:** 2 · **instances:** 3 · **firstSeen:** v1-core · **status:** open
- **pattern:** commit_pathspec-style commits fail on deleted files · **cycles:** 1 · **instances:** 1 · **firstSeen:** v1-core · **status:** open
- **pattern:** cross-suite/behavior/doc pins land without a named owner · **cycles:** 4 · **instances:** 6 · **firstSeen:** loot-inventory · **status:** promoted (widened to doc pins 2026-10-01)
- **pattern:** envelope factual premises reach sessions unverified · **cycles:** 6 · **instances:** 30 · **firstSeen:** loot-inventory · **status:** promoted
- **pattern:** whole-repo fast gates go red at role-scoped receives · **cycles:** 4 · **instances:** 4 · **firstSeen:** v1-core · **status:** promoted
- **pattern:** provider aborts kill subagents mid-session; recovery from preserved tree · **cycles:** 3 · **instances:** 5 · **firstSeen:** loot-inventory · **status:** open (promotion held because the cycle attribution is ambiguous)
- **pattern:** bare npx misresolves; use pnpm exec vitest run · **cycles:** 2 · **instances:** 3 · **firstSeen:** loot-inventory · **status:** open
- **pattern:** aborted final Archivist pass leaves a double synthesis · **cycles:** 2 · **instances:** 2 · **firstSeen:** loot-inventory · **status:** open
- **pattern:** session gates hard-code a plan-time base SHA made stale by replan · **cycles:** 1 · **instances:** 1 · **firstSeen:** equipment-consumables · **status:** open
- **pattern:** host await idle timeout (300 s); re-await reattaches · **cycles:** 4 · **instances:** 7 · **firstSeen:** equipment-consumables · **status:** promoted; framework wording open
- **pattern:** Final Report mechanical facts transcribed, not derived · **cycles:** 3 · **instances:** 3 · **firstSeen:** v1-core · **status:** promoted; framework wording open
- **pattern:** role docs say Spec/DB never spawned vs planned Author re-entry sessions · **cycles:** 5 · **instances:** 5 · **firstSeen:** grid-combat · **status:** promoted; framework wording open
- **pattern:** STATE row matcher hits a CA-ID column inside the CAP table · **cycles:** 1 · **instances:** 2 · **firstSeen:** grid-movement · **status:** open
- **pattern:** pin audits miss behavior pins (and doc pins) · **cycles:** 3 · **instances:** 4 · **firstSeen:** grid-combat · **status:** open
- **pattern:** newly reachable content hazards without a planning-time scan · **cycles:** 2 · **instances:** 2 · **firstSeen:** spells-in-combat · **status:** open
- **pattern:** concurrent disjoint-lease sessions share one working tree · **cycles:** 1 · **instances:** 2 · **firstSeen:** spells-in-combat · **status:** open
- **pattern:** Final Report cites `<base>..HEAD`, and its own commit moves HEAD so the command no longer reproduces the count · **cycles:** 1 · **instances:** 1 · **firstSeen:** action-targeting · **status:** open
