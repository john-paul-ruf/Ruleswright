# Build — Ruleswright / grid-movement

## Agents

Planner planned this. Coder builds it (./CODER.md). Orchestrator schedules it
(./ORCHESTRATOR.md). **SESSION-01 is an Author re-entry session** (Spec → Designer → DB),
not a Coder session. It is human-gated: dispatch it only after the human confirms
DD-M2…DD-M13 in STATE.md (blocker B-M1).

**Solo run:** follow the protocol below. One agent works through the sessions serially.

**Parallel run:** hand this directory to Orchestrator. Orchestrator spawns Coder as
subagents using whatever subagent mechanism the agent/runtime executing Orchestrator
provides, awaits their results, and owns STATE.md / MASTER.md / arch files. Coder commits
its own lease at every checkpoint. This plan has no concurrent waves
(S01 → S02 → S03 → S04); STATE.md's Wave Plan says why.

## Protocol — each iteration (solo mode)

1. Read PROGRAM-CONFIG.MD (registry, stack, conventions, verification).
2. Read STATE.md: current sessions, Capability Readiness, Contract Agreements, Current
   Blockers, Verification Baseline, last checkpoint. Treat these as separate from the
   historical handoffs.
3. Pick the next pending session whose dependencies are done and whose required Contract
   Agreements are agreed with ready producer inputs. Re-check each provisional CA against
   the landed producer (STATE "Provisional" note) and amend the dependent prompt before
   starting. Do not require the session's own future proof yet.
4. Read SESSION-NN.md fully, plus its Module Context files.
5. Read affected files before modifying them.
6. Execute checkpoint by checkpoint. Commit each with an explicit pathspec covering only
   the session's Owns (`git add -- <lease>`; `git commit -- <lease>`). Stay inside Owns.
7. Verify the session checks, PROGRAM-CONFIG compliance and this checkpoint's CA proofs,
   using the Verification Baseline:
   - `pnpm exec vitest run <path>` for narrow gates;
   - `pnpm build` before whole-suite runs, because loot/equipment journeys read `dist/`.

   Record the actual results. Invalidate affected agreements and evidence when a contract
   changes or counterevidence disproves a claim.
8. Update STATE.md (status, checkpoint, date, notes, handoff).
9. Update the architecture if a public API changed (the M01/M02/M03/M04 deltas land in
   `arch/v1-core.md` under `<!-- grid-movement SESSION-NN -->`).
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

- **All sessions done** → Final Report. Product completion also requires CAP-M1…CAP-M7
  verified against current sources.
- **Blocked** → set the session to blocked and skip to the next eligible one. There are no
  parallel alternatives in this plan.
- **Context limit** → commit the current checkpoint, update STATE.md, stop cleanly.
- **User input needed** → only for product design or destructive work (B-M1 is the one
  planned instance). Otherwise record the conservative default and continue.

## Final Report

Write it to `program/Ruleswright/prompts/grid-movement/FINAL-REPORT.md` and commit it
with an explicit pathspec (force-add: `program/Ruleswright/prompts/` is gitignored, and
prior features force-added their records). Never write it to `.program/`.

Contents: summary, sessions done/total, files created/modified, architecture impact,
verification, residual gaps (F-M1, F-M2, the carried ledger), follow-up. Under
Orchestrator, append the Orchestration section (concurrency, wall clock, checkpoints
committed by Coder, lease violations, checkpoint shortfalls, granularity feedback for
Planner).
