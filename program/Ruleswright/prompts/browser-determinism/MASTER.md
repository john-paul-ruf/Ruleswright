# Build — Ruleswright / browser-determinism

## Agents

Planner planned this. Coder builds it (`./CODER.md`). Orchestrator schedules it (`./ORCHESTRATOR.md`).

**Solo run:** follow the protocol below. There is one session, SESSION-01, with 4 checkpoints.

**Parallel run:** hand this directory to Orchestrator. Orchestrator spawns Coder as a subagent, using whatever subagent mechanism the agent or runtime executing Orchestrator provides, and awaits its result. It owns `STATE.md`, `MASTER.md` and the arch files. Coder commits its own lease at every checkpoint. See `./ORCHESTRATOR.md` and `./CODER.md` for the full contract.

**Wave order** (STATE *Wave Plan*): W1 S01 → VERIFY-01 → final Archivist.

**Dispatch gate:**
- No human decision is pending. The human approved planning on 2026-10-09 ("yes"), and every choice is a recorded auto-decision (STATE DD-B1…DD-B12).
- S01 needs the network: `pnpm add`, and the Electron binary via `install.js` (H11).
- While S01 is in flight, Orchestrator must not run any Vitest browser-mode command itself (H8, port 63315).
- An Archivist planning-completeness pass is optional (STATE *Current Blockers*).

## Protocol — each iteration (solo mode)

1. Read `program/Ruleswright/PROGRAM-CONFIG.MD`: registry, stack, conventions, verification.
2. Read `STATE.md`. Keep these separate from the historical Handoff Notes:
   - Session Status;
   - Capability Readiness (CAP-B1…B4);
   - Contract Agreements (CA-B1…B3);
   - Current Blockers (B-BD-1);
   - Verification Baseline: V1–V10, hazards H1–H12, plan-time probes, the pin audit.
3. Pick S01. It has no dependencies, and its CAs are agreed with planned producers inside the session. Run its checkpoint-0 recheck first.
4. Read `SESSION-01.md` fully, plus its Module Context line ranges, one checkpoint at a time.
5. Read affected files before modifying them.
6. Execute checkpoint by checkpoint. Commit each one with `git add -- <Owns paths>` and `git commit -m "browser-determinism SESSION-01: checkpoint K — <name>" -- <Owns paths>`. Stay inside Owns; never touch PROGRAM-CONFIG, `arch/` or `specs/`.
7. Verify the checkpoint's gates (V1–V7 whole-repo, plus V8/V9/V10 as they come online), its negative control and its CA proofs. Record actual results. A changed characterization digest is a regression (H4).
8. Update STATE.md: status, checkpoint, date, notes, handoff.
9. Architecture: no module or API change. The final Archivist records the retired follow-up (DD-B12).
10. When S01 is done → VERIFY-01 → Final Report.
    - CAP-B4's GitHub Actions execution stays *present-unverified* until the human pushes (B-BD-1). Report it as residual debt, not as verified.

## Crash Recovery

- Read STATE.md → the in-progress session and its last committed checkpoint.
- Read the Handoff Notes, then `git status` and `git log --oneline -- <Owns paths>`. The log is authoritative.
- Resume from the checkpoint after the last committed one.
- Before taking the lease, verify the previous worker has ended. Preserve uncommitted work; validate it and resume where possible.
- Check scratch state: `find tests -name __screenshots__` must be empty. Revert any un-`cmp`-confirmed negative-control edit, using the copy under `/tmp/ruleswright-browser-determinism/`.
- Never `git reset --hard`.
- Update STATE.md before stopping.

## Stopping Conditions

- **S01 done:** run VERIFY-01, then the Final Report. Product completion requires CAP-B1…B3 verified against current sources. CAP-B4 is verified locally; its Actions execution is carried as B-BD-1.
- **Blocked:** set the session to blocked and record the blocker.
  - Mechanical seams are cleared under standing authority: a registry or network failure, a missing cached browser (`pnpm exec playwright install <b>`), or Electron download trouble.
  - A `PACK_DIGESTS` mismatch at ck1 is a finding. Stop and report it.
- **Context limit:** commit the current checkpoint, update STATE.md, and stop cleanly.
- **User input needed:** only for product-design or destructive work. None is expected.

## Final Report

Write it to `program/Ruleswright/prompts/browser-determinism/FINAL-REPORT.md`, the run folder beside MASTER.md and STATE.md. Commit it with an explicit pathspec, force-added because the path is gitignored (H6), before returning. Never write it to `.program/`.

Contents:
- summary, and sessions done/total;
- files created/modified, derived from `git diff --name-status 46bcf0c..<end SHA>`;
- architecture impact (none in `src/`);
- verification: V1–V10 plus the three user agents and the Electron runtime line;
- residual gaps: B-BD-1, and the DD-B3 Electron-renderer residual;
- follow-up: the PROGRAM-CONFIG and arch retirement items for the final Archivist.

Under Orchestrator, append the Orchestration section (see `./ORCHESTRATOR.md`). Give the feature-verification block its own heading, not a second `## Verification`; this follows standing recommendation `318c816b6920dd3d`.
