# Build — Ruleswright / grid-combat

## Agents

Planner planned this. Coder builds it (./CODER.md). Orchestrator schedules it (./ORCHESTRATOR.md).

**Solo run:** follow the protocol below. One agent works through sessions serially.

**Parallel run:** hand this directory to Orchestrator. Orchestrator spawns Coder as subagents using whatever subagent mechanism is provided by the agent/runtime executing Orchestrator, awaits their results, and owns STATE.md / MASTER.md / arch files. Coder commits its own lease at every checkpoint. See ./ORCHESTRATOR.md and ./CODER.md for the full contract.

**Author note for this feature:** S01 is a DB author re-entry (schema-change class, human-authorized 2026-09-27). It is the only session leased on `src/schema/contracts/**` or `program/Ruleswright/specs/**`. Every other session treats those paths as read-only. S03 additionally owns the E-SPAT-01 switch in `spatial.ts` — the registration (S01/S02) and the consumer switch (S03) are sequenced so the registered id exists before any TS session emits it.

## Protocol — Each iteration (solo mode):

1. Read PROGRAM-CONFIG.md (registry, stack, conventions, verification)
2. Read STATE.md (current sessions, capability readiness, agreements, blockers, Verification Baseline, last checkpoint; distinguish these from historical handoffs)
3. Pick next pending session whose dependencies are done and whose required Contract Agreements are agreed with ready producer inputs; use the same recheck as Orchestrator before starting, including capability input origins and proofs required from predecessors; do not require its own future proof yet
4. Read SESSION-NN.md fully + Module Context files
5. Read affected files before modifying
6. Execute checkpoint by checkpoint. Commit each with an explicit pathspec covering only the session's Owns. Stay inside Owns.
7. Verify session checks, PROGRAM-CONFIG compliance, and this checkpoint's Contract Agreement proofs using the Verification Baseline's replacements and execution constraints. Record actual results and invalidate affected agreements/evidence when a contract changes or counterevidence disproves a claim
8. Update STATE.md (status, checkpoint, date, notes, handoff)
9. Update architecture if new module or changed public API
10. Loop. All sessions done → Final Report; report any required capability still unverified as incomplete, with its owner and remaining proof.

## Crash Recovery

- Read STATE.md → any in-progress session, and its last committed checkpoint
- Read Handoff Notes + `git status` / `git log --oneline -- <lease paths>` (the log is authoritative — it shows which checkpoints actually landed)
- Resume from the checkpoint after the last committed one
- Verify the previous worker has ended before taking its lease. Inspect and preserve uncommitted work; validate and resume it where possible. Do not discard work merely because it lacks a checkpoint commit.
- Never `git reset --hard` — other sessions' commits live in the same history
- Update STATE.md before stopping (voluntary or forced)

## Stopping Conditions

- All sessions done → Final Report; product completion also requires every in-scope required capability verified against current sources
- Blocked → set blocked, skip to next eligible
- Context limit → commit the current checkpoint, update STATE.md, stop clean
- User input needed → only for product-design or destructive work. Otherwise record the conservative default, owner-correction, recovery, or final-report debt and continue.

## Stopping Conditions — feature-specific

- **S01 is the contract gate.** If S01 blocks (Author capacity failure, contract-shape dispute), S02–S05 stay pending; do not dispatch a TS session against an uncommitted contract (prescribed-facts rule).
- **W3 (S03 ∥ S04) requires CA-G1's producer recheck to pass** — Orchestrator re-checks the contract-vs-mapping before W2 dispatch (STATE.md Contract Agreements, provisional rows).
- **Movement verb (STATE.md Design Decision 1):** if the human approves a `move()` combat verb later, it is a *new feature* (api-map product decision), not a grid-combat scope adjustment. The current plan's movement seam is serialize → restore.

## Final Report

Write it to `program/Ruleswright/prompts/grid-combat/FINAL-REPORT.md` — the run folder, beside MASTER.md and STATE.md — and commit it with an explicit pathspec before returning. Never `.program/`: that is gitignored scratch and publishes nothing. The committed file is what ends the run; a final message alone does not.

Summary, sessions done/total, files created/modified, architecture impact, verification (with the new whole-suite baseline count), residual gap (movement verb decision; `evalPackFormula` parse-once debt; cone/line v2 seam), follow-up.

Under Orchestrator, the Orchestration section is appended (concurrency, wall clock, checkpoints committed by Coder, lease violations, checkpoint shortfalls, granularity feedback for Planner). See ./ORCHESTRATOR.md.