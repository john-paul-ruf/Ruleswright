# Build — Ruleswright / contract-conformance

## Agents

Planner planned this. Coder builds it (`./CODER.md`). Orchestrator schedules it (`./ORCHESTRATOR.md`). S01 is a **DB Author re-entry** (`program-agents/DB.md`), not a Coder session.

**Solo run:** follow the protocol below. There are two sessions, run serially: SESSION-01 (2 checkpoints), then SESSION-02 (3 checkpoints).

**Parallel run:** hand this directory to Orchestrator. Orchestrator spawns each worker as a subagent, using whatever subagent mechanism the agent or runtime executing Orchestrator provides, and awaits its result. It owns `STATE.md`, `MASTER.md` and the arch files. Each worker commits its own lease at every checkpoint. See `./ORCHESTRATOR.md` and `./CODER.md` for the full contract.

**Wave order** (STATE *Wave Plan*): optional ARCH-PRE → W1 S01 → W2 S02 → VERIFY-01 → Final Report → final Archivist.

**Dispatch gate:**
- No human decision is pending. The human answered "a yes" on 2026-10-11 (DD-K1). S01's envelope quotes it; the worker does not re-litigate it.
- Before dispatching S02, recheck CA-K2 against S01's committed `snapshots.schema.json`: the combatant `hp` has no `minimum`. Amend S02's envelope by CA id if S01 reported a wording delta.
- S02 needs the network once (`pnpm add`, H6).
- Run whole-repo V1–V3 at S01's receive (Author session, H10). Run V1–V7 and V9 at S02's receive.

## Protocol — each iteration (solo mode)

1. Read `program/Ruleswright/PROGRAM-CONFIG.MD`: registry, stack, conventions, verification.
2. Read `STATE.md`. Keep these separate from the historical Handoff Notes:
   - Session Status;
   - Capability Readiness (CAP-K1…K4);
   - Contract Agreements (CA-K1…K3);
   - Current Blockers;
   - Verification Baseline: V1–V11, probes P1–P5, the pin audit, hazards H1–H10.
3. Pick the next pending session whose dependencies are done and whose required CAs have ready producer inputs. S02 needs S01 done and CA-K2's producer committed. Run its checkpoint-0 recheck first.
4. Read `SESSION-NN.md` fully, plus its Module Context line ranges.
5. Read affected files before modifying them.
6. Execute checkpoint by checkpoint. Commit each one with `git add -- <Owns paths>` and `git commit -m "contract-conformance SESSION-NN: checkpoint K — <name>" -- <Owns paths>`. Stay inside Owns. Never touch PROGRAM-CONFIG, `arch/`, `mocks/`, or (in S02) `specs/` and `src/schema/contracts/**`.
7. Verify the checkpoint's gates and CA proofs. Record actual results. If any Ajv subject fails, that is a finding: stop and report it. Never loosen the test.
8. Update STATE.md: status, checkpoint, date, notes, handoff.
9. Architecture: no module or API change. The final Archivist records v1.11 and the retired follow-ups (DD-K6).
10. When all sessions are done → VERIFY-01 → Final Report. Report any capability still unverified as incomplete, with its owner.

## Crash Recovery

- Read STATE.md → the in-progress session and its last committed checkpoint.
- Read the Handoff Notes, then `git status` and `git log --oneline -- <Owns paths>`. The log is authoritative.
- Resume from the checkpoint after the last committed one.
- Before taking the lease, verify the previous worker has ended. Preserve uncommitted work; validate it and resume where possible.
- `git diff --quiet -- src/schema/contracts` must be clean outside S01 (H9).
- Never `git reset --hard`.
- Update STATE.md before stopping.

## Stopping Conditions

- **All sessions done:** run VERIFY-01, then the Final Report. Product completion requires CAP-K1…K4 verified against current sources. B-BD-1 (Actions) stays carried.
- **Blocked:** set the session to blocked and record the blocker. A failing Ajv subject routes to DB re-entry (contract) or an engine owner correction (writer), by evidence. Mechanical seams (registry or network) are cleared under standing authority.
- **Context limit:** commit the current checkpoint, update STATE.md, and stop cleanly.
- **User input needed:** only for product-design or destructive work. None is expected.

## Final Report

Write it to `program/Ruleswright/prompts/contract-conformance/FINAL-REPORT.md`, the run folder beside MASTER.md and STATE.md. Commit it with an explicit pathspec, force-added because the path is gitignored (H1), before returning. Never write it to `.program/`.

Contents:
- summary, and sessions done/total;
- files created/modified, derived from `git diff --name-status bb61f91..<end SHA>`, with parts that sum to the headline;
- architecture impact (contract v1.11; no module change);
- verification: V1–V9 and V11, with the envelope count and the negative-hp subject;
- residual gaps: B-BD-1;
- follow-up: the DD-K6 items for the final Archivist.

Under Orchestrator, append the Orchestration section (see `./ORCHESTRATOR.md`). Give the feature-verification block its own heading, not a second `## Verification` (standing recommendation `318c816b6920dd3d`). State the SHA any figure tied to a moving ref was taken at (`c3c94358b35f8316`).
