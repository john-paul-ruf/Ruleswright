# Build — Ruleswright / combat-decomposition

## Agents

Planner planned this. Coder builds it (`./CODER.md`). Orchestrator schedules it (`./ORCHESTRATOR.md`).

**Solo run:** follow the protocol below. One agent works through the sessions serially.

**Parallel run:** hand this directory to Orchestrator. Orchestrator spawns Coder as subagents, using whatever subagent mechanism the agent or runtime executing Orchestrator provides, and awaits their results. It owns `STATE.md`, `MASTER.md` and the arch files. Coder commits its own lease at every checkpoint. See `./ORCHESTRATOR.md` and `./CODER.md` for the full contract.

This plan is serial (S01 → S02 → S03). No wave has more than one session (STATE *Wave Plan*).

**Dispatch gate:** none open.
- The human answered on 2026-10-04: "1 decomp first 2 recommend 3 none". STATE.md records it and maps it to DD-D1, DD-D9/DD-D10 and DD-D12. Each envelope quotes it.
- Scoped Archivist planning-completeness pass done 2026-10-04 (STATE *Planning Completeness Review*); findings F-D1..F-D9 dispositioned and carried in the session envelopes.

## Protocol — each iteration (solo mode)

1. Read `program/Ruleswright/PROGRAM-CONFIG.MD`: registry, stack, conventions, verification.
2. Read `STATE.md`: Session Status, Capability Readiness, Contract Agreements, Current Blockers, Verification Baseline (V1–V6 and their base values), Pin audit and the last checkpoint. Keep these separate from the historical Handoff Notes.
3. Pick the next pending session whose dependencies are done. CA-D1…D5 are agreed, with the base behaviour as the ready producer. Before S02, confirm S01 recorded N₁ and the characterization digests. Before S03, confirm S02's V4/V5 matched. Do not require a session's own future proof yet.
4. Read `SESSION-NN.md` fully, plus its Module Context line ranges, checkpoint by checkpoint, not as one sweep.
5. Read each affected file before modifying it.
6. Execute checkpoint by checkpoint. Commit each one with an explicit pathspec covering only the session's Owns, and stay inside Owns:
   ```
   git add -- <Owns>
   git commit -m "combat-decomposition SESSION-NN: checkpoint K — <name>" -- <Owns>
   ```
   S03 ck1 deletes `src/runtime/snapshots.ts`. Commit it with the git CLI, never through `commit_pathspec` (3658f327), and never with `git add -A` (`CODER.md` bans it; F-D3): `git rm -- src/runtime/snapshots.ts`, `git add -- src/runtime/snapshots src/schema/error-card.ts`, `git commit -m "…" -- src/runtime/snapshots.ts src/runtime/snapshots src/schema/error-card.ts`.
7. Verify:
   - the session checks;
   - PROGRAM-CONFIG compliance;
   - this checkpoint's CA proofs, using the Verification Baseline (`pnpm exec vitest run <paths>`; `pnpm build` immediately before V4/V5).

   Record actual results. Any change to a characterization digest, the module-surface pin, V4 or V5 is a behaviour change. Stop and return `blocked` with the diff; never re-key the pin.
8. Update STATE.md: status, checkpoint, date, notes, handoff.
9. Update the architecture record with each session's delta: new files and roles, `Combat`'s remaining responsibilities, the `snapshots/` directory, and the `arch/v1-core.md` citations into moved code.
10. Loop. When all sessions are done, write the Final Report. Report any required capability still unverified as incomplete, with its owner and the remaining proof.

## Crash Recovery

- Read STATE.md: find any in-progress session and its last committed checkpoint.
- Read the Handoff Notes, `git status` and `git log --oneline -- <lease paths>`. The log is authoritative: it shows which checkpoints actually landed.
- Resume from the checkpoint after the last committed one.
- Verify the previous worker has ended before taking its lease. Inspect and preserve uncommitted work, and validate and resume it where possible. Do not discard work merely because it lacks a checkpoint commit.
- Never `git reset --hard`: other sessions' commits live in the same history.
- A host await idle timeout (about 300 s) is not a crash. Re-await the same handle (PROGRAM-CONFIG convention).
- Update STATE.md before stopping, whether voluntary or forced.

## Stopping Conditions

- **All sessions done:** write the Final Report. Completion requires CAP-D1…D4 verified against current sources.
- **Blocked:** set the session to blocked. In this serial plan, a block stalls the later sessions.
- **Context limit:** commit the current checkpoint, update STATE.md, and stop clean.
- **User input needed:** only for product-design or destructive work. This feature has none planned; the `snapshots.ts` deletion is a planned move of code into `snapshots/`, not a data loss. Otherwise record the conservative default, owner correction, recovery or final-report debt, and continue.

## Final Report

Write it to `program/Ruleswright/prompts/combat-decomposition/FINAL-REPORT.md`, beside MASTER.md and STATE.md. Commit it with an explicit pathspec before returning. The path is gitignored, so use `git add -f -- <path>`. Never write it to `.program/`.

Contents:
- summary;
- sessions done / total;
- files created, modified and deleted, from `git diff --name-status 52d4d2a..<end-SHA>` with an explicit end SHA (the last non-report commit). Breakdowns must sum to the headline;
- line counts before and after (`wc -l`), cited by command;
- architecture impact, with value imports derived mechanically;
- verification: V1–V6, N₁ and N₁ + 1, the characterization digests and negative controls;
- residual gaps (carried): F-FP2 class features (the next feature; needs a human product decision and a human-authorized DB re-entry); F-R6 Designer re-entry; `spells.tagged:` load integrity; the carried ledger;
- follow-up.

Under Orchestrator, the Orchestration section is appended: concurrency, wall clock, checkpoints committed by Coder, lease violations, checkpoint shortfalls, and granularity feedback for Planner. See `./ORCHESTRATOR.md`.
