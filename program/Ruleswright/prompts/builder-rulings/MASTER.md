# Build — Ruleswright / builder-rulings

## Agents

Planner planned this. Coder builds it (`./CODER.md`). Orchestrator schedules it (`./ORCHESTRATOR.md`).

**Solo run:** follow the protocol below. One agent works through the sessions serially.

**Parallel run:** hand this directory to Orchestrator. Orchestrator spawns Coder as subagents, using whatever subagent mechanism the agent or runtime executing Orchestrator provides, and awaits their results. It owns `STATE.md`, `MASTER.md` and the arch files. Coder commits its own lease at every checkpoint. See `./ORCHESTRATOR.md` and `./CODER.md` for the full contract.

This plan is serial (S01 → S02). No wave has more than one session.

**Dispatch gate:** none open.
- The human answered on 2026-10-04: "1 yes, heal 2 recommendation 3 no 4 recommendation". STATE.md records it and maps it to DD-R1…R5; S01's envelope quotes it.
- Request a scoped Archivist planning-completeness pass before S01.
- If the human objects to the stated recommendations for answers 2 or 4 before S01 dispatches, replan S01/S02.

## Protocol — each iteration (solo mode)

1. Read `program/Ruleswright/PROGRAM-CONFIG.MD`: registry, stack, conventions, verification.
2. Read `STATE.md`: Session Status, Capability Readiness, Contract Agreements, Current Blockers, Verification Baseline and the last checkpoint. Keep these separate from the historical Handoff Notes.
3. Pick the next pending session whose dependencies are done and whose required Contract Agreements are agreed, with ready producer inputs. Before S02, re-check CA-R1…R3 against S01's landed `database.md` v1.9 and amend any moved meaning into the CA rows first. Do not require a session's own future proof yet.
4. Read `SESSION-NN.md` fully, plus its Module Context files.
5. Read each affected file before modifying it.
6. Execute checkpoint by checkpoint. Commit each one with an explicit pathspec covering only the session's Owns, and stay inside Owns:
   ```
   git add -- <Owns>
   git commit -m "builder-rulings SESSION-NN: checkpoint K — <name>" -- <Owns>
   ```
7. Verify:
   - the session checks;
   - PROGRAM-CONFIG compliance;
   - this checkpoint's CA proofs, using the Verification Baseline (`pnpm exec vitest run <paths>`; `pnpm build` before a whole `pnpm test`; no scratch `.mjs` in `.program/tmp`).

   Record actual results. Mark affected evidence `stale` when a contract changes or counterevidence disproves a claim.
8. Update STATE.md: status, checkpoint, date, notes, handoff.
9. Update the architecture record for the S02 deltas, then retire the F-FP1/F-P3, F-P7, restricts-asymmetry and `mending` residual lines in `arch/v1-core.md`. The deltas are:
   - the `awardXp` max-level rule;
   - the `isRestricted` spell-kind rule;
   - the theme heal content.
10. Loop. When all sessions are done, write the Final Report. Report any required capability still unverified as incomplete, with its owner and the remaining proof.

## Crash Recovery

- Read STATE.md: find any in-progress session and its last committed checkpoint.
- Read the Handoff Notes, `git status` and `git log --oneline -- <lease paths>`. The log is authoritative: it shows which checkpoints actually landed.
- Resume from the checkpoint after the last committed one.
- Verify the previous worker has ended before taking its lease. Inspect and preserve uncommitted work, and validate and resume it where possible. Do not discard work merely because it lacks a checkpoint commit.
- Never `git reset --hard`: other sessions' commits live in the same history.
- Update STATE.md before stopping, whether voluntary or forced.

## Stopping Conditions

- **All sessions done:** write the Final Report. Product completion also requires CAP-R1…R4 verified against current sources.
- **Blocked:** set the session to blocked and skip to the next eligible one. In this serial plan, a block stalls S02.
- **Context limit:** commit the current checkpoint, update STATE.md, and stop clean.
- **User input needed:** only for product-design or destructive work. Otherwise record the conservative default, owner correction, recovery or final-report debt, and continue.

## Final Report

Write it to `program/Ruleswright/prompts/builder-rulings/FINAL-REPORT.md`, beside MASTER.md and STATE.md. Commit it with an explicit pathspec before returning. The path is gitignored, so use `git add -f -- <path>`. Never write it to `.program/`.

Contents:
- summary;
- sessions done / total;
- files created and modified, from `git diff --name-status <base>..<end-SHA>` with an explicit end SHA (the final STATE commit). Breakdowns must sum to the headline;
- architecture impact;
- verification;
- residual gaps (carried): F-FP2 class features (the next feature; needs human-authorized DB re-entry); `spells.tagged:` load integrity; the carried ledger;
- follow-up.

Under Orchestrator, the Orchestration section is appended: concurrency, wall clock, checkpoints committed by Coder, lease violations, checkpoint shortfalls, and granularity feedback for Planner. See `./ORCHESTRATOR.md`.
