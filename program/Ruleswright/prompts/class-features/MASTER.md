# Build — Ruleswright / class-features

## Agents

Planner planned this. Coder builds it (`./CODER.md`). Orchestrator schedules it (`./ORCHESTRATOR.md`).

**Solo run:** follow the protocol below. One agent works through the sessions in wave order.

**Parallel run:** hand this directory to Orchestrator. Orchestrator spawns Coder as subagents, using whatever subagent mechanism the agent or runtime executing Orchestrator provides, and awaits their results. It owns `STATE.md`, `MASTER.md` and the arch files. Coder commits its own lease at every checkpoint. See `./ORCHESTRATOR.md` and `./CODER.md` for the full contract.

**Wave order** (STATE *Wave Plan*): W1 S01 → W2 S03 → W3 S04 ∥ S05 → W4 S02.
- S01, S02 and S05 are **Author re-entries** (DB, Architect, Designer). Dispatch each with its role document (`DB.md`, `ARCHITECT.md`, `DESIGNER.md`) and the session envelope, which quotes the human authorization.
- S03 and S04 are Coder sessions.

**Dispatch gate:**
- The human answered on 2026-10-04: "1 a,b 2 no 3 move it, fix packs, 4 fix the broken packs, 5 you have my auth for whatever you need". STATE.md maps it to DD-C1…C3 and DD-C10, and records the authorization scope. Each envelope quotes it.
- **Open before S01:** the scoped Archivist planning-completeness pass (STATE *Current Blockers*). Its findings are dispositioned into the envelopes before dispatch.

## Protocol — each iteration (solo mode)

1. Read `program/Ruleswright/PROGRAM-CONFIG.MD`: registry, stack, conventions, verification.
2. Read `STATE.md`: Session Status, Capability Readiness, Contract Agreements, Current Blockers, Verification Baseline (V1–V7, hazards H1–H8, pin audit) and the last checkpoint. Keep these separate from the historical Handoff Notes.
3. Pick the next pending session whose dependencies are done and whose required Contract Agreements are agreed, with ready producer inputs:
   - **Before S03:** promote CA-C1/CA-C2 from provisional by re-checking them against S01's landed `database.md` and `pack.schema.json`. Amend STATE and S03's envelope with any DB delta.
   - **Before S04:** confirm S03 landed `ClassProgression.features`, the DD-C10 rows, and the CA-C5 re-key evidence.
   - **Before S05:** confirm the dark-fantasy features S03 landed.
   - **Before S02:** confirm `src/runtime/features.ts` exists.

   Do not require a session's own future proof yet.
4. Read `SESSION-NN.md` fully, plus its Module Context line ranges, checkpoint by checkpoint, not as one sweep.
5. Read each affected file before modifying it.
6. Execute checkpoint by checkpoint. Commit each one with an explicit pathspec covering only the session's Owns, and stay inside Owns:
   ```
   git add -- <Owns>
   git commit -m "class-features SESSION-NN: checkpoint K — <name>" -- <Owns>
   ```
   S03's scratch-only `tests/proofs/characterization-dump.scratch.test.ts` is **never** added. Delete it before gates and commits (H5). No session deletes a tracked file.
7. Verify:
   - the session checks;
   - PROGRAM-CONFIG compliance;
   - this checkpoint's CAP/CA proofs, using the Verification Baseline: `pnpm build` immediately before `pnpm test` (H1); `pnpm exec vitest run <paths>` for scoped runs (H3).

   Record actual results. A characterization digest may change **only** in S03, and only under the CA-C5 normalized-dump proof. Anywhere else, a digest change is a behaviour change: stop and return `blocked` with the diff.
8. Update STATE.md: status, checkpoint, date, notes, handoff. Keep Capability Readiness and the CA statuses current; producer `done` does not mark a consumer's proof verified.
9. Update the architecture record (`arch/v1-core.md`) with each session's delta:
   - S03: the `ClassProgression.features` move, validator `checkClassFeatures`, the bundled content;
   - S04: the `features.ts` leaf and its three consumers, the `classFeatures` export.

   Retire the "class features unbuilt" lines (`arch/v1-core.md:29`, `:1392`, `:1411-1414`) once CAP-C3…C6 are verified.
10. Loop. When all sessions are done, write the Final Report. Report any required capability still unverified as incomplete, with its owner and the remaining proof.

## Crash Recovery

- Read STATE.md: find any in-progress session and its last committed checkpoint.
- Read the Handoff Notes, `git status` and `git log --oneline -- <lease paths>`. The log is authoritative: it shows which checkpoints actually landed.
- Resume from the checkpoint after the last committed one.
- Verify the previous worker has ended before taking its lease. Inspect and preserve uncommitted work, and validate and resume it where possible. Do not discard work merely because it lacks a checkpoint commit. Exception: a leftover S03 scratch file is deleted, never committed.
- Never `git reset --hard`: other sessions' commits live in the same history.
- A host await idle timeout (about 300 s) is not a crash. Re-await the same handle (PROGRAM-CONFIG convention).
- Update STATE.md before stopping, whether voluntary or forced.

## Stopping Conditions

- **All sessions done:** write the Final Report. Completion requires CAP-C1…C7 verified against current sources.
- **Blocked:** set the session to blocked and skip to the next eligible session. S04 and S05 both depend on S03; S02 depends on S04.
- **Context limit:** commit the current checkpoint, update STATE.md, and stop clean.
- **User input needed:** only for product-design or destructive work. The human's answer 5 authorizes this feature's Author re-entries and schema change; nothing else destructive is planned. Otherwise record the conservative default, owner correction, recovery or final-report debt, and continue.

## Final Report

Write it to `program/Ruleswright/prompts/class-features/FINAL-REPORT.md`, beside MASTER.md and STATE.md. Commit it with an explicit pathspec before returning. The path is gitignored, so use `git add -f -- <path>`. Never write it to `.program/`.

Contents:
- summary;
- sessions done / total;
- files created and modified, from `git diff --name-status f36d4ae..<end-SHA>` with an explicit end SHA (the last non-report commit). Breakdowns must sum to the headline;
- architecture impact, with value imports derived per statement, `import type` excluded;
- verification: V1–V7, N₀ = 938 and the final N, the CA-C5 digest re-keys with their `cmp` evidence, the negative control;
- residual gaps (carried): `spells.tagged:` load integrity; the carried ledger; any DB delta from STATE;
- follow-up.

Under Orchestrator, the Orchestration section is appended: concurrency, wall clock, checkpoints committed by Coder, lease violations, checkpoint shortfalls, and granularity feedback for Planner. See `./ORCHESTRATOR.md`.
