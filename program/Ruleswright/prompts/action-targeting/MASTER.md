# Build — Ruleswright / action-targeting

## Agents

Planner planned this. Coder builds it (`./CODER.md`). Orchestrator schedules it (`./ORCHESTRATOR.md`).

**Solo run:** follow the protocol below. One agent works through the sessions serially.

**Parallel run:** hand this directory to Orchestrator. Orchestrator:
- spawns Coder as subagents, using whatever subagent mechanism the agent or runtime executing Orchestrator provides;
- awaits their results;
- owns `STATE.md`, `MASTER.md` and the arch files.

Coder commits its own lease at every checkpoint. See `./ORCHESTRATOR.md` and `./CODER.md` for the full contract.

This plan is serial (S01 → S02 → S03). No wave has more than one session.

**Dispatch gate:** **B-AT-1** was cleared on 2026-10-01 ("1 approved 2 12 3 confrim"). The answer is recorded in STATE.md and quoted in S01's envelope. S01 is dispatchable.

## Protocol — each iteration (solo mode)

1. Read `program/Ruleswright/PROGRAM-CONFIG.MD`: registry, stack, conventions, verification.
2. Read `STATE.md`: Session Status, Capability Readiness, Contract Agreements, Current Blockers, Verification Baseline and the last checkpoint. Keep these separate from the historical Handoff Notes.
3. Pick the next pending session whose dependencies are done and whose required Contract Agreements are agreed, with ready producer inputs. Apply the Orchestrator recheck before starting:
   - CA-A1…A3 are re-checked against S01's landed `database.md` v1.7 before S02/S03;
   - CA-A2 is re-checked against S02 ck1 before S03.
   Do not require a session's own future proof yet.
4. Read `SESSION-NN.md` fully, plus its Module Context files.
5. Read each affected file before modifying it.
6. Execute checkpoint by checkpoint. Commit each one with an explicit pathspec covering only the session's Owns (`git add -- <Owns>` then `git commit -m "action-targeting SESSION-NN: checkpoint K — <name>" -- <Owns>`). Stay inside Owns.
7. Verify:
   - the session checks;
   - PROGRAM-CONFIG compliance;
   - this checkpoint's CA proofs, using the Verification Baseline (`pnpm exec vitest run <path>`; `pnpm build` before a whole `pnpm test`).
   Record actual results. Mark affected agreements and evidence `stale` when a contract changes or counterevidence disproves a claim.
8. Update STATE.md: status, checkpoint, date, notes, handoff.
9. Update the architecture record if a public API changed: `isSelfAction`, `REGISTRY.ability`, the `ability:<name>` var binding.
10. Loop. When all sessions are done, write the Final Report. Report any required capability still unverified as incomplete, with its owner and the remaining proof.

## Crash Recovery

- Read STATE.md: find any in-progress session and its last committed checkpoint.
- Read the Handoff Notes, `git status` and `git log --oneline -- <lease paths>`. The log is authoritative: it shows which checkpoints actually landed.
- Resume from the checkpoint after the last committed one.
- Verify the previous worker has ended before taking its lease. Inspect and preserve uncommitted work, and validate and resume it where possible. Do not discard work merely because it lacks a checkpoint commit.
- Never `git reset --hard`: other sessions' commits live in the same history.
- Update STATE.md before stopping, whether voluntary or forced.

## Stopping Conditions

- **All sessions done:** write the Final Report. Product completion also requires CAP-A1…A7 verified against current sources.
- **Blocked:** set the session to blocked and skip to the next eligible one. In this serial plan, a block stalls its dependents.
- **Context limit:** commit the current checkpoint, update STATE.md, and stop clean.
- **User input needed:** only for product-design or destructive work. B-AT-1 was such a case (cleared). Otherwise record the conservative default, the owner correction, the recovery, or the final-report debt, and continue.

## Final Report

Write it to `program/Ruleswright/prompts/action-targeting/FINAL-REPORT.md`, beside MASTER.md and STATE.md. Commit it with an explicit pathspec before returning. Never write it to `.program/`, which is gitignored scratch.

Contents:
- summary;
- sessions done / total;
- files created and modified, derived from `git diff --name-status <base>..HEAD` (PROGRAM-CONFIG convention: cite the command; breakdowns sum to the headline);
- architecture impact;
- verification;
- residual gaps, including the carried `mending`-spell content question and the restricts-symmetry question;
- follow-up.

Under Orchestrator, the Orchestration section is appended: concurrency, wall clock, checkpoints committed by Coder, lease violations, checkpoint shortfalls, and granularity feedback for Planner. See `./ORCHESTRATOR.md`.
