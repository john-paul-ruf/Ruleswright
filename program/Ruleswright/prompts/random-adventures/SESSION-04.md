# SESSION-04 — Run a bounded solo director with offline narration

> **Program:** Ruleswright
> **Feature:** random-adventures
> **Modules:** M03
> **Depends on:** SESSION-03
> **Concurrent with:** —
> **Owns:** `src/runtime/combat/preview.ts`, `src/runtime/combat/combat.ts`, `src/runtime/combat/declare.ts`, `src/runtime/combat/movement.ts`, `src/runtime/play/session.ts`, `src/runtime/adventure/adventure.ts`, `src/runtime/adventure/types.ts`, `src/runtime/adventure/snapshot.ts`, `src/runtime/adventure/director.ts`, `src/runtime/adventure/narration.ts`, `src/runtime/index.ts`, `tests/runtime/adventure/director.test.ts`, `tests/runtime/adventure/narration.test.ts`, `tests/runtime/combat/preview.test.ts`, `tests/runtime/combat/movement.test.ts`, `tests/runtime/combat/module-surface.test.ts`, `tests/proofs/solo-adventure-journey.test.ts`, `tests/proofs/adventure-oracle.ts`, `tests/proofs/adventure-determinism.test.ts`, `tests/browser/adventure-determinism.test.ts`, `tests/snapshots/adventure.test.ts`, `tests/proofs/contract-conformance.test.ts`, `.github/workflows/ci.yml`, `README.md`, `tests/proofs/docs-run.test.ts`, `src/runtime/combat/types.ts`, `src/runtime/snapshots/combat.ts`, `tests/snapshots/combat.test.ts`, `tests/proofs/movement-journey.test.ts`, `tests/proofs/determinism-oracle.ts`
> **Reads:** `program/Ruleswright/PROGRAM-CONFIG.MD`, `program/Ruleswright/prompts/random-adventures/STATE.md`, `program/Ruleswright/prompts/random-adventures/AUTHOR-HANDOFF.md`, `program/Ruleswright/prompts/random-adventures/EVIDENCE.md`, `program/Ruleswright/specs/*.md`, `program/Ruleswright/arch/v1-core.md`, `src/schema/contracts/*.json`, `src/core/*.ts`, `src/core/dsl/*.ts`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vitest*.ts`, `tsup.config.ts`, `program-agents/CODER.md`, `src/runtime/runtime.ts`, `src/runtime/events.ts`, `src/runtime/inventory.ts`, `src/runtime/progression.ts`, `src/runtime/pools.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/combat/action-economy.ts`, `src/runtime/combat/triggers.ts`, `src/runtime/snapshots/envelope.ts`, `src/schema/version.ts`, `src/schema/error-card.ts`, `src/compiler/generate.ts`, `src/compiler/pipeline.ts`, `src/compiler/theme.ts`, `tests/runtime/fixtures/pack.ts`, `tests/runtime/fixtures/packs.ts`
> **Resources:** `build:dist`, `browser:63315`, `test:tmp` (unique per-test directories)
> **Checkpoints:** 5

## Execution Contract

Read every target before modifying it. All new paths/types below are **planned**, not symbols claimed to exist at plan HEAD. Existing symbols are indexed in EVIDENCE.md. Adopt the Author receipt and amend these prompts/CA mappings before dispatch if it changes a proposed shape. Do not guess a protected schema at checkpoint 0.

Checkpoint 0 is read-only: recheck the applicable CA axes (existence, output fit, meaning, real-path proof), dependency commits, runtime contracts, baseline and source identity. Known corrections below are implementation assignments, not checkpoint-0 investigations. No external vendor protocol is introduced; baseline tool path/version identities are in STATE.md. Stop only for a real missing prerequisite or newly discovered product decision.

Every numbered checkpoint is a Coder-owned git commit. Run `git add -- <touched existing paths within this session's explicit Owns>` and commit only those paths, subject `random-adventures SESSION-NN: checkpoint K — <name>`. Never stage `.` or `-A`. Generated `dist/` is ignored disposable output under exclusive `build:dist`, not an artifact to force-add. Source/test ownership is the exact Files table. Do not stage not-yet-created future files; no empty placeholder is required. Read targets in the Files table before edits even though they are not repeated under read-only Reads. Tests may create isolated OS-temp output under `test:tmp`; remove only what that test created. Orchestrator owns STATE/MASTER/arch and records results from your Handoff; do not edit those files.

No package installation, runtime dependency, network provider, application UI, service, database, migration or release step is needed. Preserve existing low-level APIs unless a specific correction below says otherwise. A mechanical fixture seam goes to Orchestrator's Controlled Lease Revision, retaining work; workers never widen leases themselves.

## Module Context

| ID  | Module   | Read                                                                                                                              | Why                                                           |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| M03 | Runtime  | S03 `src/runtime/adventure/*.ts`, S01 `src/runtime/play/*.ts`, `src/runtime/combat/{combat,declare,movement,triggers,execute}.ts` | Actual turn/offer control, guards, state and narration inputs |
| M01 | Schema   | committed adventure/encounter DTOs and AR-05 receipt                                                                              | Director policy/cursor meaning and compatibility              |
| M04 | Compiler | bundled adventure templates                                                                                                       | Policy/narrative data only; runtime never imports compiler    |

## Context

Manual adventure mode already works. Add optional deterministic enemy control and authored, offline narration. The player still chooses character actions and route/reward choices. The director yields at those boundaries; it is not an omniscient autoplay bot. No hosted model/vendor SDK or network key is required under the existing offline constraint.

## Capabilities

CAP-05 automates enemy turns/reactions through the same legal command path used by a host, bounded by explicit steps. CAP-06 returns structured narrated facts and optional plain text from the adventure's committed journal; no UI required. Integration owner c3 for full solo progression and c4 for narration/resume. Rendering or requesting narration never changes combat randomness.

## Contract Agreements

CA-04's adventure/session/journal producers must be committed and ready. CA-05 provisional against S04 c3/c4. (a) actual declare gates exist but a pure legality query does not; implement it at c1 and reuse it in production declare, rather than duplicating rules in an AI. (b) enemies have actions, not character spell lists; don't manufacture monster spells or reaction slots. (c) a human-owned offer remains a player decision, and exhaustion/stalemate is a yield, never victory. (d) the built solo journey drives real combat, rewards and reopen; narration cites actual committed events.

## Files to Create/Modify

| File                                          | Action | What Changes                                                                                                                             |
| --------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/runtime/combat/preview.ts`               | Create | Pure legality adapter shared by actual declare and director candidates.                                                                  |
| `src/runtime/combat/combat.ts`                | Modify | Share validation with preview; keep spending/resolution exclusive to real commands.                                                      |
| `src/runtime/combat/declare.ts`               | Modify | Factor existing gate results for preview reuse; preserve order/meaning.                                                                  |
| `src/runtime/combat/movement.ts`              | Modify | Pure candidate path validation and R-GM-3 resumed-walk threatener correction.                                                            |
| `src/runtime/play/session.ts`                 | Modify | Planned SESSION-01 output; Expose bounded legal command candidates and pending choice/offer control to director.                         |
| `src/runtime/adventure/adventure.ts`          | Modify | Planned SESSION-03 output; Compose director state updates into the same aggregate revision/dispatch path.                                |
| `src/runtime/adventure/types.ts`              | Modify | Planned SESSION-03 output; S03-produced state/commands: implement director and narration acknowledgement variants against AR-04/05.      |
| `src/runtime/adventure/snapshot.ts`           | Modify | Planned SESSION-03 output; S03-produced writer/reader: serialize and validate director state and narration cursor in the same aggregate. |
| `src/runtime/adventure/director.ts`           | Create | advanceSolo: automated enemy actions/reactions, bounded stepping, explicit yield reasons.                                                |
| `src/runtime/adventure/narration.ts`          | Create | Deterministic text/structured message projection with persisted cursor and original templates.                                           |
| `src/runtime/index.ts`                        | Modify | Export solo director and host-neutral narration surface.                                                                                 |
| `tests/runtime/adventure/director.test.ts`    | Create | Enemy decisions, player boundaries, bounded no-progress, offers and resume equality.                                                     |
| `tests/runtime/adventure/narration.test.ts`   | Create | Facts/provenance, unknown event fallback, cursor resume, no RNG/state mutation on read.                                                  |
| `tests/runtime/combat/preview.test.ts`        | Create | Preview/declare gate equivalence; zero mutation/RNG/event emission from inspection.                                                      |
| `tests/runtime/combat/movement.test.ts`       | Modify | R-GM-3 new threatener after replanning; same threat not offered twice.                                                                   |
| `tests/runtime/combat/module-surface.test.ts` | Modify | Add director exports and preserve exact existing surface checks.                                                                         |
| `tests/proofs/solo-adventure-journey.test.ts` | Create | Built package player → director → actual battle → narration → restore → completion/defeat.                                               |
| `tests/proofs/adventure-oracle.ts`            | Modify | Planned SESSION-03 output; Add solo actions, open offers, narration and resume script.                                                   |
| `tests/proofs/adventure-determinism.test.ts`  | Modify | Planned SESSION-03 output; Node cross-runtime oracle subjects include solo path.                                                         |
| `tests/browser/adventure-determinism.test.ts` | Modify | Planned SESSION-03 output; Same solo oracle in all three browser engines.                                                                |
| `tests/snapshots/adventure.test.ts`           | Modify | Planned SESSION-03 output; Persisted director policy/cursor/command revision and open-offer restoration.                                 |
| `tests/proofs/contract-conformance.test.ts`   | Modify | Director-bearing adventure snapshots conform; preserve encounter and manual adventure subjects.                                          |
| `.github/workflows/ci.yml`                    | Modify | H-R1 comments/labels; pin existing discovery of new oracle/self-tests, no new service or publication.                                    |
| `README.md`                                   | Modify | Runnable solo example, all three modes, bound/yield behavior and honest verification claims; nine combat legs wording.                   |
| `tests/proofs/docs-run.test.ts`               | Modify | Execute/typecheck all three user modes and self-test new example grouping.                                                               |
| `src/runtime/combat/types.ts`                 | Modify | PendingMove offered-departure records from AR-05; additive optional compatibility field.                                                 |
| `src/runtime/snapshots/combat.ts`             | Modify | Copy and validate persisted departure records; preserve the explicit legacy absence path.                                                |
| `tests/snapshots/combat.test.ts`              | Modify | Exact pendingMove shape pin and departure-state round trip/refusals.                                                                     |
| `tests/proofs/movement-journey.test.ts`       | Modify | Adapt exact pendingMove assertion at line 225 while retaining real resume assertions.                                                    |
| `tests/proofs/determinism-oracle.ts`          | Modify | Documented paused-move snapshot byte deltas only; keep pack digests/unaffected leg digests.                                              |

## Implementation

### Checkpoint 1 — Shared pure legality and bounded candidate enumeration

Factor declaration checks in combat.ts/declare.ts into preview.ts, retaining existing order: action entitlement, restriction, target/self/at, valid, spatial/move/range, armor, cost/binding. Actual declare consumes that result before spending. A preview returns acceptance or the existing DeclareRejection and resolved intent; it never draws RNG, emits events, spends or executes effects. Use the parse-once AST and existing pure checks, not trial declares or engine-state rollback. Handle non-deterministic validity conservatively if discovered rather than sampling it as a fact.

Expose bounded candidates through play/session.ts: held non-reactive actions, valid target bindings, self targeting and finite reachable destinations within movement budget; existing pending offers are separate candidates. Use lexical/tie-order rules recorded in policy; terrain/occupancy/reach are authoritative. End-turn/pass is always represented when allowed. No scan over an unbounded coordinate plane.

**Commit when:** build/typecheck and preview tests compare previews to real declare accept/reject outcomes for no-action, restricts, self, reach/range, move, cost and armor, with pure-preview state/RNG/event equality; all existing combat tests/characterization pass unchanged.

### Checkpoint 2 — Correct the known resumed movement seam

Close inherited R-GM-3 in movement.ts: after a paused walk is replanned, a new first-step threatener must be checked, while the already-answered departure must not be offered twice. Read walk/resumeMove and event offer collection before modifying. Consume the committed AR-05 additive pendingMove.offeredDepartures contract. Each record binds from/to coordinates and reactorId for the departure already offered. Record it when pausing, preserve it through copyPendingMove/serializeCombat/deserializeCombat, carry it through resumeMove before clearing pendingMove, and suppress only the matching departure tuple. New threatener or changed edge is checked normally. Discard records when the move ends. AR-05 defines explicit legacy omission behavior; never infer this history from a current empty offer queue or unsaved private fields. Update exact pendingMove assertions in movement.test.ts, snapshots/combat.test.ts:604 and proofs/movement-journey.test.ts:225 in this checkpoint. Re-key only explained paused-move snapshot bytes in determinism-oracle; compare full before/after records, preserve all other event assertions and pack digests.

Regression: two threateners, terrain/occupancy changes while paused, same paused location but different first step; exactly one offer for the new threatener, no replay for the old. Repeat through snapshot+restore. This is an actual correction assigned now, not deferred to a later provoke feature.

**Commit when:** movement/snapshot tests and existing movement/grid/characterization proofs pass with only the authorized snapshot-byte deltas; the resumed path enforces the new threat and preserves once-only offers both live and reopened. Recheck the director candidate adapter immediately after landing.

### Checkpoint 3 — Bounded deterministic enemy director

Planned API:

```ts
advanceSolo(adventure: Adventure, options: { maxSteps: number }): SoloResult;
// result has emitted events, current view, steps used, and a discriminated yield reason
// awaiting-player | awaiting-choice | completed | defeated | budget-exhausted | stalled
```

Policy is plain authored adventure data; tie randomness, if used, has a separately saved director stream. Choose legal enemy actions with stable priority and tie ordering, move toward a reachable opponent when needed, pass when unable to act. Do not hardcode action names or assume slots named main/move/reaction. Execute real session commands; never edit enemy HP or synthesize successful events. Process enemy offers, leave player offers unanswered, and return immediately at a player turn/route/recipient/preparation choice. Maintain the session's turn-start flag; calling step repeatedly in awaiting-declare currently replenishes slots, so it is not a retry strategy.

Validate positive bounded maxSteps. Count command/transition work and terminate predictably on budget exhaustion; a no-progress state returns stalled without fabricating combat-over. Serial calls with smaller budgets must produce the same game results as one equivalent larger budget. Failed/stale commands do not advance RNG or narration cursor. Wire director state through Adventure's transaction path and serialize it atomically with game state.

**Commit when:** director tests and built solo journey show enemies acting/moving/reacting through real combat, player boundaries yielding, full victory/defeat on approved seeded examples, bounded zero-damage stalemate, and identical continued behavior after JSON restore.

### Checkpoint 4 — Offline narrated events with saved cursor

Project the committed adventure journal into structured messages with source event sequence, rule/roll provenance, actor/target identity and template id, plus optional plain text. Use authored templates from the definition; a missing/unknown event has a factual generic rendering, never invented lore/results. Resolve display names from saved definition/party/encounter bindings, not current array index. Never use raw flavor to award items/XP or drive enforcement.

Narration preview is pure; consumption/acknowledgment advances a saved cursor through an explicit adventure command, not a read. Acknowledge no farther than the available journal. On reopen, unconsumed messages remain available and acknowledged messages are not emitted twice. Preserve message ids across variable director step budgets. A heal's damage event uses negative amount; do not narrate it as damage or read nonexistent top-level roll fields (rolls are in why.rolls).

Update the shared oracle and browser consumer with actual solo commands/messages. Add conformance subjects with saved policy/cursor and a pending player offer. Do not re-key existing combat digests beyond c2’s documented departure-snapshot delta or a separately recorded intentional behavior change.

**Commit when:** factual narration, pure repeated reads, cursor rejection, consumed/unconsumed restore and cross-runtime oracle tests pass; completing the solo journey causes the same authoritative state as manual commands.

### Checkpoint 5 — Three complete host contracts and final local acceptance

Publish runnable encounter-only, manual-adventure and solo-director usage in README; no UI or storage code is required. Execute/typecheck the exact examples in docs-run and keep its behavioral controls. Correct inherited README 'nine combat legs' wording (leg-8 is a character leg). Correct H-R1 CI comments: docs-run checks named strings, and coverage covers all three themes. Existing test/browser globs already discover the new tests; assert the actual run steps and preserve matrix behavior, not comment-based claims.

Run V-ALL, V-BROWSER and V-ELECTRON with artifact identity. Since CI file is touched, run the established clean-copy frozen-install/build/typecheck proof outside HOME (V-CLEAN), using the exact lockfile and a copy including this session's final source. No publication/push is part of this session. If platform tooling is unavailable, report proof debt with repair owner Orchestrator/M05 and the affected CAPs unverified for that platform; local implementation remains completed only with its required local journey passing.

**Commit when:** three exported host modes are demonstrated, all local required proofs and tooling self-tests pass, and docs report actual platform scope. Return complete evidence, not a claim that configured CI ran.

## Verification

`pnpm exec vitest run tests/runtime/adventure/director.test.ts tests/runtime/adventure/narration.test.ts tests/runtime/combat/preview.test.ts tests/runtime/combat/movement.test.ts tests/proofs/solo-adventure-journey.test.ts tests/proofs/adventure-determinism.test.ts tests/snapshots/adventure.test.ts tests/proofs/contract-conformance.test.ts tests/runtime/combat/module-surface.test.ts tests/proofs/docs-run.test.ts` after V-BUILD. Also run existing `tests/proofs/movement-journey.test.ts`, `tests/proofs/grid-journey.test.ts` and `tests/proofs/combat-characterization.test.ts` for c1/c2.

Harness owner S04 c3/c4; fixtures reuse S03's real pack/definition construction. Built ESM and CJS package entries are actual host transport. No external AI fixture is needed because the selected mode is offline. Internal combat, rules, progression, inventory and restore implementations remain real. Fixed seeds, explicit placement/rewards and real open player/monster offers exercise control flow. Bound each test to 10 seconds and 1000 commands, director calls to requested maxSteps; assert exhaustion explicitly. Persistence is detached JSON, fresh facades and discarded old listeners, as S03. Browser proof uses source through Vite at exclusive port 63315; Node/Electron built proof uses fresh dist. Evidence records revision, configuration, artifact hashes, runtime identity, discovery counts and exact yield assertions.

## State Update

Return CA-05 observed mappings, R-GM-3 evidence, new API symbols, actual runtimes and remaining debts. Orchestrator updates all CAP/CA rows and requests the final scoped Archivist pass. No capability is verified by a docs string or schema conformance alone. Keep B-BD-1 open until actual Actions results are observed; do not push to clear it without separate user instruction.
