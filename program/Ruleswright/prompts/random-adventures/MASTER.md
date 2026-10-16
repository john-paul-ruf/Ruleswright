# Build — Ruleswright / random-adventures

## Agents

Planner planned this. Coder builds it ([CODER.md](../../../../program-agents/CODER.md)). Orchestrator schedules it ([ORCHESTRATOR.md](../../../../program-agents/ORCHESTRATOR.md)). Paths in leases/commands are repository-relative. The actual existing config is [PROGRAM-CONFIG.MD](../../PROGRAM-CONFIG.MD); preserve its casing.

**Solo run:** one agent follows the protocol below serially.

**Parallel run:** hand this directory to Orchestrator. It spawns Coder using the active runtime's subagent mechanism and awaits results; no shell process, pid file or environment handshake. Orchestrator owns STATE.md/MASTER.md/arch and inline Orchestration Envelopes. Coder commits its own lease at every checkpoint and returns the CODER.md Handoff. This plan has four serial capability waves, so a parallel runtime does not make their dependent leases concurrent.

**Dispatch status:** S01–S03 accepted; S04 checkpoints1–3 committed through178fe54 and independently tested1429/72. REPLAN-RA-STALL retires the disproved agent-imposed unchanged-transition prerequisite; S04 may resume c4/c5 under revision4, exact39paths and five checkpoints. c4 owns the explicit restored-counter reset assertion and narration/ack/oracle work; c5 owns docs/platform/clean-copy acceptance. Bounded production progress and defensive restored-stall yield do not establish reachable production stalemate detection (EVIDENCE current addendum). Prior attempts fully received, no human approval pending. STATE is current evidence authority; completed history preserved.

## Sessions

| File                           | Capability                                                    | Modules  | Owns                                                      | Depends on             | Checkpoints |
| ------------------------------ | ------------------------------------------------------------- | -------- | --------------------------------------------------------- | ---------------------- | ----------- |
| [SESSION-01.md](SESSION-01.md) | Play and resume a random encounter                            | M01, M03 | Exact 27-path lease in front matter / lease-manifest.json | —                      | 6           |
| [SESSION-02.md](SESSION-02.md) | Generate finite adventures as portable data                   | M01, M04 | Exact 17-path lease in front matter / lease-manifest.json | SESSION-01             | 3           |
| [SESSION-03.md](SESSION-03.md) | Play complete adventures with durable rewards and progression | M03      | Exact 18-path lease in front matter / lease-manifest.json | SESSION-01, SESSION-02 | 5           |
| [SESSION-04.md](SESSION-04.md) | Run a bounded solo director with offline narration            | M03      | Exact 39-path lease (revision4) in front matter / lease-manifest.json | SESSION-03             | 5           |

## Protocol — Each iteration (solo mode)

1. Read PROGRAM-CONFIG.MD: registry, stack, conventions, verification and protected Author ownership.
2. Read STATE.md's canonical Session Status, Capability Readiness, Contract Agreements, Current Blockers, Verification Baseline and checkpoint. Historical handoffs cannot override them.
3. Pick the next pending session whose dependency artifacts are committed and whose required agreements are agreed with ready producer inputs and current predecessor proofs. Recheck each provisional CA against the actual landed producer, then amend the dependent prompt before starting. Do not require this session's own future implementation/proof before starting.
4. Read the full SESSION-NN.md, Module Context, EVIDENCE.md and Author receipt. Recheck c0 without using it to defer a known planning gap.
5. Read every affected file before editing. Stay inside the exact Owns source/test lease; reserve build:dist/browser:63315 before generated-output or browser work. Protected Author files remain read-only.
6. Execute checkpoints in order. Each commit is Coder's responsibility: stage only touched paths in Owns and `git commit ... -- <same paths>`. Verify `git show --name-only --format= HEAD` is within lease. Newly planned files absent at earlier checkpoints must not be passed to git add until they exist; never create empty placeholders just to satisfy a pathspec. Never add shared bookkeeping or generated dist.
7. Run checkpoint checks and PROGRAM-CONFIG compliance using STATE's effective commands, replacements and resource limits. Record actual source/build identity and selected assertions, not only an exit code. Invalidate affected proof on contract changes or source-backed counterevidence; retain historical results.
8. In solo mode update STATE.md after the checkpoint/session (status, checkpoint/date, notes, verbatim Handoff), as a separate exact-path commit. Under orchestration only Orchestrator does this.
9. Update architecture/config after a changed public API or realized module edge through Orchestrator/Archivist ownership. Derive value imports mechanically; a symbol grep cannot prove a module edge.
10. Continue eligible work. All sessions done leads to Final Report, but product completion additionally requires every in-scope CAP verified with current CA/proofs. A completed producer is not a completed consumer.

## Wave Plan

Wave 1 S01 → Wave 2 S02 → Wave 3 S03 → Wave 4 S04. S01's EncounterSetup is S02's concrete input; S01's complete encounter and S02's definition are S03's inputs; S03's aggregate dispatch/journal is S04's input. Shared README/barrel/conformance/oracle paths are explicitly serialized. No concurrent session pairs are declared.

## Crash Recovery

- Read STATE's in-progress session and checkpoint, Handoff Notes, `git status`, and `git log --oneline -- <lease paths>`; the commit log establishes what landed.
- Confirm the previous worker ended before taking its lease. Preserve and inspect uncommitted work; validate/resume it where possible. Resume after the last committed checkpoint, not from scratch.
- Never `git reset --hard`, discard unrelated changes or rewrite historical handoffs. A host await idle timeout alone is not a dead worker; re-await the same handle.
- A discovered mechanical missing path goes to Controlled Lease Revision after ownership checks; Coder never silently widens Owns. Protected schema changes always route to Author.
- Update STATE before a voluntary stop; when interrupted, the next Orchestrator reconciles actual commits before dispatch.

## Stopping Conditions

- All sessions done: report completion only if every required capability and agreement/proof is current. Otherwise identify incomplete capability, correction/proof owner and condition to resume.
- Blocked: record concrete gap and owner, then run unrelated eligible work. Actual missing predecessor producers/proofs block their consumers; Author contracts for this run are complete.
- Context terminal: commit a valid checkpoint when possible, preserve work and return a usable Handoff. No turn/token ceilings are planned.
- Human input: only unresolved product decisions or destructive work. Non-product mechanical seams/environmental repairs use standing authority. Existing scope authorization persists.

## Final Report

Write `program/Ruleswright/prompts/random-adventures/FINAL-REPORT.md` beside this file and STATE. Never publish it only in .program scratch. Orchestrator (or solo owner) commits it with `git add -f -- program/Ruleswright/prompts/random-adventures/FINAL-REPORT.md` and an explicit-path commit; this directory is gitignored. A chat message alone does not end the execution run.

Include summary, sessions done/total, actual files changed (derived against an explicit base/end revision), architecture impact, verification and artifact identities, CAP/CA completion, residual gaps and owners/follow-up. Under Orchestrator append concurrency/wall-clock/checkpoint/lease/shortfall/granularity facts. Preserve B-BD-1 as unverified until observed Actions results; do not push or publish merely to clear it. Planned assertions or schema conformance do not establish playable parity.

## Granularity and first journey

Four sessions, 19 checkpoints. Each owns a coherent capability and its producer/consumer tests; splits reflect real artifacts rather than frontend/backend layers. S01 c3 proves a real public encounter and mid-fight reopen early; c5 proves atomic settlement and the next encounter. S03 c2/c4 integrates generated adventures and rewards; S04 c3/c4 integrates solo control/narration. No verification-only or bookkeeping-only session exists.

Revision 2 amendments are recorded in lease-manifest.json and STATE: S02 owns its actual generated-output conformance test; S04 owns the shared fixtures, encounter-candidate assertions and reactive guard/feat regression files it adapts. S03 stages reward rolls at c2 with node/settlement transitions, then claims at c3 and proves reopen at c4. No unresolved CA meaning or new product choice remains in this scope. B-BD-1 remains CI evidence debt, with no publication/push instruction.
