# Build — Ruleswright / feat-progression

## Agents

Planner planned this. Coder builds it (`./CODER.md`). Orchestrator schedules it (`./ORCHESTRATOR.md`).

**Solo run:** follow the protocol below. One agent works through the sessions serially.

**Parallel run:** hand this directory to Orchestrator. Orchestrator:
- spawns Coder as subagents, using whatever subagent mechanism the agent or runtime executing Orchestrator provides;
- awaits their results;
- owns `STATE.md`, `MASTER.md` and the arch files.

Coder commits its own lease at every checkpoint. See `./ORCHESTRATOR.md` and `./CODER.md` for the full contract.

This plan is serial (S01 → S02). No wave has more than one session.

**Dispatch gate:** none open. The human authorized the DB re-entry on 2026-10-04 ("1 per class per level - 2 refuse - 3 approved"). The answer is recorded in STATE.md and quoted in S01's envelope. S01 is dispatchable.

## Protocol — each iteration (solo mode)

1. Read `program/Ruleswright/PROGRAM-CONFIG.MD`: registry, stack, conventions, verification.
2. Read `STATE.md`: Session Status, Capability Readiness, Contract Agreements, Current Blockers, Verification Baseline and the last checkpoint. Keep these separate from the historical Handoff Notes.
3. Pick the next pending session whose dependencies are done and whose required Contract Agreements are agreed, with ready producer inputs. Apply the Orchestrator recheck before starting: CA-F1…F3 are re-checked against S01's landed `database.md` v1.8 and `pack.schema.json` before S02, and any moved meaning is amended into the CA rows first. Do not require a session's own future proof yet.
4. Read `SESSION-NN.md` fully, plus its Module Context files.
5. Read each affected file before modifying it.
6. Execute checkpoint by checkpoint. Commit each one with an explicit pathspec covering only the session's Owns:
   ```
   git add -- <Owns>
   git commit -m "feat-progression SESSION-NN: checkpoint K — <name>" -- <Owns>
   ```
   Stay inside Owns.
7. Verify:
   - the session checks;
   - PROGRAM-CONFIG compliance;
   - this checkpoint's CA proofs, using the Verification Baseline (`pnpm exec vitest run <path>`; `pnpm build` before a whole `pnpm test`).

   Record actual results. Mark affected agreements and evidence `stale` when a contract changes or counterevidence disproves a claim.
8. Update STATE.md: status, checkpoint, date, notes, handoff.
9. Update the architecture record for the S02 deltas:
   - the `validateBuild` 4th parameter;
   - the `feats.ts` tally/card exports;
   - the `awardXp` compute-then-apply order;
   - the intra-M03 edge `progression → feats`;
   - retire "no feat-slot cap (FR-6 gap)".
10. Loop. When all sessions are done, write the Final Report. Report any required capability still unverified as incomplete, with its owner and the remaining proof.

## Crash Recovery

- Read STATE.md: find any in-progress session and its last committed checkpoint.
- Read the Handoff Notes, `git status` and `git log --oneline -- <lease paths>`. The log is authoritative: it shows which checkpoints actually landed.
- Resume from the checkpoint after the last committed one.
- Verify the previous worker has ended before taking its lease. Inspect and preserve uncommitted work, and validate and resume it where possible. Do not discard work merely because it lacks a checkpoint commit.
- Never `git reset --hard`: other sessions' commits live in the same history.
- Update STATE.md before stopping, whether voluntary or forced.

## Stopping Conditions

- **All sessions done:** write the Final Report. Product completion also requires CAP-F1…F5 verified against current sources.
- **Blocked:** set the session to blocked and skip to the next eligible one. In this serial plan, a block stalls S02.
- **Context limit:** commit the current checkpoint, update STATE.md, and stop clean.
- **User input needed:** only for product-design or destructive work. Otherwise record the conservative default, the owner correction, the recovery, or the final-report debt, and continue.

## Final Report

Write it to `program/Ruleswright/prompts/feat-progression/FINAL-REPORT.md`, beside MASTER.md and STATE.md. Commit it with an explicit pathspec before returning. Never write it to `.program/`, which is gitignored scratch.

Contents:
- summary;
- sessions done / total;
- files created and modified, derived from `git diff --name-status <base>..<end-SHA>`. Cite an explicit end SHA (the final STATE commit), not `HEAD`, so the count still reproduces after the report's own commit. Breakdowns must sum to the headline;
- architecture impact;
- verification;
- residual gaps:
  - F-FP1, the `awardXp` level-lowering human question;
  - F-FP2, the `features` doc row;
  - the carried `mending`-spell and restricts-symmetry questions;
- follow-up.

Under Orchestrator, the Orchestration section is appended: concurrency, wall clock, checkpoints committed by Coder, lease violations, checkpoint shortfalls, and granularity feedback for Planner. See `./ORCHESTRATOR.md`.
