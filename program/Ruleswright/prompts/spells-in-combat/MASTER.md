# Build — Ruleswright / spells-in-combat

## Agents

Planner planned this. Coder builds it (./CODER.md). Orchestrator schedules it
(./ORCHESTRATOR.md).

**SESSION-01 is an Author re-entry session** (Spec → Designer → DB), not a Coder session.
Its human gate, **B-S1**, was cleared on 2026-09-30 ("8a - yes 8b - fine 9 cost a turn 10 yes 11 yes 12 yes 13 yes 14 yes", recorded in STATE.md's
Intent section). S01 is dispatchable. If the human later edits a DD, amend the affected
CA rows and SESSION-01..03 before the affected session dispatches.

**Recommended before S01:** a scoped Archivist planning-completeness pass over
STATE.md and SESSION-01..03 (the promoted factual-premise convention). The Archivist envelope is ready at
`.program/prompts/ARCHIVIST-PREFLIGHT.spells-in-combat.prompt.md` (written by Planner at
`fd20cfa`; Orchestrator spawns Archivist with it and saves the note to
`.program/results/ARCHIVIST-PREFLIGHT.spells-in-combat.result.md`). Route its findings
through a bounded replan before dispatch.

**Solo run:** follow the protocol below. One agent works through the sessions serially.

**Parallel run:** hand this directory to Orchestrator. Orchestrator spawns Coder as
subagents using whatever subagent mechanism the agent/runtime executing Orchestrator
provides, awaits their results, and owns STATE.md, MASTER.md and the arch files. Coder
commits its own lease at every checkpoint. This plan has no concurrent waves
(S01 → S02 → S03); STATE.md's Wave Plan says why.

## Protocol — each iteration (solo mode)

1. Read PROGRAM-CONFIG.MD (registry, stack, conventions, verification).
2. Read STATE.md: current sessions, Capability Readiness, Contract Agreements, Current
   Blockers, Verification Baseline, last checkpoint. Treat these as separate from the
   historical handoffs.
3. Pick the next pending session whose dependencies are done and whose required Contract
   Agreements are agreed with ready producer inputs.
   - Every CA is provisional against S01 ck3. Re-check it against the landed
     database.md and contracts, and amend the dependent prompts before S02.
   - Re-check CA-S1 … S5 against S02's landed code before S03.
   - Do not require the session's own future proof yet.
4. Read SESSION-NN.md fully, plus its Module Context files.
5. Read the affected files before modifying them.
6. Execute checkpoint by checkpoint. Commit each with an explicit pathspec covering only
   the session's Owns (`git add -- <lease>`; `git commit -- <lease>`). Stay inside Owns.
7. Verify the session checks, PROGRAM-CONFIG compliance and this checkpoint's CA proofs,
   using the Verification Baseline:
   - `pnpm exec vitest run <path>` for narrow gates;
   - `pnpm build` before whole-suite or `dist` runs.

   Record the actual results. Invalidate affected agreements and evidence when a contract
   changes or counterevidence disproves a claim.
8. Update STATE.md (status, checkpoint, date, notes, handoff).
9. Update the architecture if a public API changed. The M01/M02/M03/M04 deltas land in
   `arch/v1-core.md` under `<!-- spells-in-combat SESSION-NN -->`. They are:
   - new runtime verbs `settleSpellCasts`, `learnFeat`, `armorBlockingCast`;
   - the new leaf `src/runtime/feats.ts`;
   - `parsePackEffects` removed;
   - `SpellTargeting.range` (M01), `EffectApply.varsFor` (M02), `DeclareOptions.at` (M03);
   - `TRIGGER_PATTERN` in M01.
10. Loop. When all sessions are done, write the Final Report. Report any required
    capability still unverified as incomplete, with its owner and remaining proof.

## Crash Recovery

- Read STATE.md: find any in-progress session and its last committed checkpoint.
- Read the Handoff Notes, `git status`, and `git log --oneline -- <lease paths>`. The log
  is authoritative.
- Resume from the checkpoint after the last committed one.
- Verify that the previous worker has ended before taking its lease. Inspect and preserve
  uncommitted work. Do not discard it merely because it lacks a checkpoint commit.
- Never `git reset --hard`.
- Update STATE.md before stopping.

## Stopping Conditions

- **All sessions done** → Final Report. Product completion also requires CAP-S1 … CAP-S9
  verified against current sources.
- **Blocked** → set the session to blocked and skip to the next eligible one. There are
  no parallel alternatives in this plan.
- **Context limit** → commit the current checkpoint, update STATE.md, stop cleanly.
- **User input needed** → only for product design or destructive work. B-S1 was the one
  planned instance (cleared). Otherwise record the conservative default and continue.

## Final Report

Write it to `program/Ruleswright/prompts/spells-in-combat/FINAL-REPORT.md` and commit it
with an explicit pathspec. Force-add it: `program/Ruleswright/prompts/` is gitignored,
and prior features force-added their records. Never write it to `.program/`.

Contents:
- summary;
- sessions done/total;
- files created/modified;
- architecture impact;
- verification;
- residual gaps: the carried rows in STATE "Inherited findings", especially action
  self-targeting, zombie-urban spell lists, FR-6 feat slots, R-GM-3 and F-M2;
- follow-up.

Derive the counts (tests, files, edges) from the tree, not from handoffs (Archivist row
f68c42a3). Under Orchestrator, append the Orchestration section: concurrency, wall
clock, checkpoints committed by Coder, lease violations, checkpoint shortfalls, and
granularity feedback for Planner.
