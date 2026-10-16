# SESSION-03 — Play complete adventures with durable rewards and progression

> **Program:** Ruleswright
> **Feature:** random-adventures
> **Modules:** M03
> **Depends on:** SESSION-01, SESSION-02
> **Concurrent with:** —
> **Owns:** `src/runtime/adventure/types.ts`, `src/runtime/adventure/adventure.ts`, `src/runtime/adventure/choices.ts`, `src/runtime/adventure/rewards.ts`, `src/runtime/adventure/snapshot.ts`, `src/runtime/index.ts`, `tests/runtime/adventure/fixtures.ts`, `tests/runtime/adventure/adventure.test.ts`, `tests/runtime/adventure/rewards.test.ts`, `tests/snapshots/adventure.test.ts`, `tests/runtime/combat/module-surface.test.ts`, `tests/proofs/adventure-journey.test.ts`, `tests/proofs/adventure-oracle.ts`, `tests/proofs/adventure-determinism.test.ts`, `tests/browser/adventure-determinism.test.ts`, `tests/proofs/contract-conformance.test.ts`, `README.md`, `tests/proofs/docs-run.test.ts`
> **Reads:** `program/Ruleswright/PROGRAM-CONFIG.MD`, `program/Ruleswright/prompts/random-adventures/STATE.md`, `program/Ruleswright/prompts/random-adventures/AUTHOR-HANDOFF.md`, `program/Ruleswright/prompts/random-adventures/EVIDENCE.md`, `program/Ruleswright/specs/*.md`, `program/Ruleswright/arch/v1-core.md`, `src/schema/contracts/*.json`, `src/core/*.ts`, `src/core/dsl/*.ts`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vitest*.ts`, `tsup.config.ts`, `program-agents/CODER.md`, `src/runtime/runtime.ts`, `src/runtime/events.ts`, `src/runtime/inventory.ts`, `src/runtime/progression.ts`, `src/runtime/pools.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/combat/action-economy.ts`, `src/runtime/combat/triggers.ts`, `src/runtime/snapshots/combat.ts`, `src/runtime/snapshots/envelope.ts`, `src/schema/version.ts`, `src/schema/error-card.ts`, `src/compiler/generate.ts`, `src/compiler/pipeline.ts`, `src/compiler/theme.ts`, `tests/runtime/fixtures/pack.ts`, `tests/runtime/fixtures/packs.ts`
> **Resources:** `build:dist`, `browser:63315`, `test:tmp` (unique per-test directories)
> **Checkpoints:** 5

## Execution Contract

Read every target before modifying it. All new paths/types below are **planned**, not symbols claimed to exist at plan HEAD. Existing symbols are indexed in EVIDENCE.md. Adopt the Author receipt and amend these prompts/CA mappings before dispatch if it changes a proposed shape. Do not guess a protected schema at checkpoint 0.

Checkpoint 0 is read-only: recheck the applicable CA axes (existence, output fit, meaning, real-path proof), dependency commits, runtime contracts, baseline and source identity. Known corrections below are implementation assignments, not checkpoint-0 investigations. No external vendor protocol is introduced; baseline tool path/version identities are in STATE.md. Stop only for a real missing prerequisite or newly discovered product decision.

Every numbered checkpoint is a Coder-owned git commit. Run `git add -- <touched existing paths within this session's explicit Owns>` and commit only those paths, subject `random-adventures SESSION-NN: checkpoint K — <name>`. Never stage `.` or `-A`. Generated `dist/` is ignored disposable output under exclusive `build:dist`, not an artifact to force-add. Source/test ownership is the exact Files table. Do not stage not-yet-created future files; no empty placeholder is required. Read targets in the Files table before edits even though they are not repeated under read-only Reads. Tests may create isolated OS-temp output under `test:tmp`; remove only what that test created. Orchestrator owns STATE/MASTER/arch and records results from your Handoff; do not edit those files.

No package installation, runtime dependency, network provider, application UI, service, database, migration or release step is needed. Preserve existing low-level APIs unless a specific correction below says otherwise. A mechanical fixture seam goes to Orchestrator's Controlled Lease Revision, retaining work; workers never widen leases themselves.

## Module Context

| ID  | Module   | Read                                                                               | Why                                                             |
| --- | -------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| M01 | Schema   | `src/schema/{adventure,play-session}.ts`, AR-03/04 receipt                         | Committed definition/aggregate mapping                          |
| M03 | Runtime  | S01 `src/runtime/play/*.ts`, `src/runtime/{progression,inventory,pools,events}.ts` | Real combat settlement, XP/loot/rest semantics and event clocks |
| M04 | Compiler | S02 generator/template exports                                                     | Test inputs only; never a production runtime import             |

## Context

S01 supplies complete playable encounters; S02 supplies finite adventure documents. Connect these into a manually driven adventure that any host can run. The host selects choices and combat commands; the library owns progress/reward bookkeeping and returns views/events. No UI framework, CLI or storage adapter is required.

## Capabilities

CAP-03 covers exploration, choices, encounters and terminal states. CAP-04 covers rewards, progression and complete save/resume. Integration owner is S03 c2 for the first generated location→real encounter→next-location path and c4 for the full branching/reward/restart journey. Required facts come from CA-01/02/03; rewards and choices are governed by CA-04. Readers must consult committed aggregate progress/receipts, never a hardcoded empty list.

## Contract Agreements

CA-02/03 must be agreed with ready producers and S01/S02 proofs current. CA-04 is provisional against S03 c3/c4 and AR-04. (a) existing awardXp, rollLoot/grantItem, rest and prepareSpell are real producers; adventure command/reward ledger missing, owned here. (b) grantLoot may throw loot-grants-nothing on flavor; interpret rollLoot outcome under the declared reward policy instead of assuming every roll grants an item. (c) xp belongs to specified party recipients; a class XP split uses existing awardXp and is distinct from party distribution. (d) the real adventure dispatch must cause real character rows in the saved aggregate to change, with reconstruction proof.

## Files to Create/Modify

| File                                          | Action | What Changes                                                                                               |
| --------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| `src/runtime/adventure/types.ts`              | Create | Commands, views and runtime state matching the DB adventure envelope.                                      |
| `src/runtime/adventure/adventure.ts`          | Create | createAdventure and dispatch; graph traversal, encounter composition, completion and defeat.               |
| `src/runtime/adventure/choices.ts`            | Create | Available choices and exact guards; exploration/preparation/rest command routing.                          |
| `src/runtime/adventure/rewards.ts`            | Create | Pack-backed XP/loot writer, explicit recipients, persisted claims and all-or-nothing transaction.          |
| `src/runtime/adventure/snapshot.ts`           | Create | Whole-adventure snapshot, content identity, active encounter and all deterministic cursors.                |
| `src/runtime/index.ts`                        | Modify | Export the adventure facade, snapshots and view types.                                                     |
| `tests/runtime/adventure/fixtures.ts`         | Create | Authored branching and rejection fixtures; no fake combat, inventory or XP services.                       |
| `tests/runtime/adventure/adventure.test.ts`   | Create | Choice guards, traversal, lifecycle and rest/preparation behavior.                                         |
| `tests/runtime/adventure/rewards.test.ts`     | Create | Recipients, exact grants, failed-member atomicity, duplicate and stale-revision refusal.                   |
| `tests/snapshots/adventure.test.ts`           | Create | Whole-envelope validation, pending/completed rewards, stable identities and deterministic resume.          |
| `tests/runtime/combat/module-surface.test.ts` | Modify | Add adventure public exports without weakening existing surface pins.                                      |
| `tests/proofs/adventure-journey.test.ts`      | Create | Built package: generated graph → choices → two fights → rewards → level change → reopen → terminal.        |
| `tests/proofs/adventure-oracle.ts`            | Create | Browser-safe shared script returning canonical state/event/choice records for new capabilities.            |
| `tests/proofs/adventure-determinism.test.ts`  | Create | Node baseline assertions over the shared adventure oracle.                                                 |
| `tests/browser/adventure-determinism.test.ts` | Create | Chromium/Firefox/WebKit replay using the real public source entry and shared oracle.                       |
| `tests/proofs/contract-conformance.test.ts`   | Modify | Generated whole-adventure envelopes against authoritative schema; semantic checks remain in runtime tests. |
| `README.md`                                   | Modify | Runnable manual adventure loop, persistence/reward boundaries, compatibility and no-I/O contract.          |
| `tests/proofs/docs-run.test.ts`               | Modify | Execute/typecheck manual adventure example and refusal expectations.                                       |

## Implementation

### Checkpoint 1 — Adventure facade, choice guards and aggregate writer

Planned public API:

```ts
createAdventure(pack: Pack, definition: AdventureDefinition,
  options: AdventureStartOptions): Adventure;
restoreAdventure(pack: Pack, definition: AdventureDefinition, snapshot: unknown): Adventure;
// facade: view(); dispatch(command); serialize();
```

Create the facade, detached views and JSON state without borrowing compiler internals. Bind effective pack identity and definition id/version/contentHash. Copy explicit stable member ids from options. Graph choices carry ids and expectedRevision; view exposes available ids and reasons for unavailable choices; dispatch validates against current node/phase, not caller-supplied eligibility. Store visited/resolved nodes and command sequence, seed streams, receipts and active encounter. A read does not consume RNG or mutate state.

Implement one noncombat entry→choice→terminal fixture and serialization from the same production path at this checkpoint. Combat nodes remain unavailable until c2, without falsely advancing past them.

**Commit when:** build/typecheck, adventure choice tests and snapshot tests pass; wrong node/choice/revision fails with unchanged state, RNG and committed event journal.

### Checkpoint 2 — Connect generated nodes to real resumable encounters

At an encounter node create S01 EncounterSession with the definition's EncounterSetup, stable member mapping and a deterministic encounter stream. Route manual commands through it, retaining pending player reactions and encounter revision. On real terminal result settle through S01 and update adventure membership from the settled snapshots. Victory resolves the encounter node; all-party defeat yields the declared terminal defeat; explicit abandon ends the adventure and never grants unearned rewards. Preserve actual partial member damage and resource spend in the saved terminal snapshot. No automatic resurrection, injury healing or XP from monster threat.

Add the early generated adventure journey at this checkpoint, using a bundled template and actual built public APIs: choose entry, resolve fight, settle, expose next location, save/reopen. No standalone mocked combat result may complete a node. Follow current positions, terrain, offers and fight-start balances through the nested snapshot.

**Commit when:** fresh build and tests/proofs/adventure-journey.test.ts prove a generated node reaches real combat and returns to exploration on victory, and defeat cannot expose a victory reward. S01 journey remains green.

### Checkpoint 3 — Rewards and character progression commit together

Implement rewards.ts with a staged transaction over the complete adventure state. Reward data is authoritative in the immutable definition: nonnegative explicit XP per member, loot table id, and required host-chosen eligible loot recipient (no implicit leader or active-actor award). Record a pending rolled result once, including flavor/no-loot and table provenance. Use rollLoot/core table outcomes once, then grantItem for valid grants; preserve flavor without pretending it is inventory. A retry never rerolls. Missing/bad refs reject at definition validation; a valid table's flavor result is an explicit no-item outcome.

Apply XP using awardXp (its existing per-class split/caps/max-level behavior), grant items, then atomically mark the node/reward claimed. Validate all member effects before publishing state or events. Persist exact reward id, node id, recipient, roll output and command revision. Already claimed reward yields its recorded receipt or explicit already-claimed outcome with no repeat grants; stale/foreign/altered claims reject. Do not use emitted audit events as the only receipt store.

Route between-encounter prepare/equip/unequip/useItem commands through existing Character operations on staged state. An allowed rest node invokes rest once per authored availability; it refills pools and **clears** bindings, does not heal HP, and does not prepare spells automatically. Player can prepare afterward. Condition time remains existing combat-round time; travel is not an implicit tick. Prove these distinctions.

**Commit when:** rewards tests prove exact per-member XP/classXp/level and inventory changes, source provenance, persisted claim, no second award after reopen, and failed second member leaves all state/events/RNG unchanged; preparatory commands and rest semantics pass.

### Checkpoint 4 — Full adventure restart and rejection proof

Deep-validate whole snapshots before accepting them: identity/version, known graph nodes, stable unique member ids, current location and legal phase, completed/rewarded relationships, receipt subjects, bounded sequence/cursors/RNG words, active encounter membership/identity and saved current positions/terrain. Runtime instances and event subscribers are never serialized. Persist adventure-scoped event sequence/journal required for later narration; don't infer a cursor from EventStream.sinceRound, whose round counters restart per fight.

Prove continuous vs restarted scripts after an exploration choice, during a fight with a pending reaction, immediately before and after reward claim, and after completion/defeat. Use JSON.stringify/parse, discard all original objects, restore into a fresh instance and compare state, next choices, event suffix, all streams and subsequent rolls. Two-player rewards and identity checks must survive a target Runtime with a different mint order. Restart only requires pack+definition+one aggregate document, not remembered start inputs.

Add shared browser-safe adventure-oracle.ts with explicit expected behavior as well as normalized serialized output, a Node driver and a browser test collected by the existing browser glob. No Node imports in the shared oracle. Keep Node/Electron built-dist journeys separate from browser source/Vite evidence.

**Commit when:** fresh built journey crosses two real encounters, a branch, reward, actual level change and completion; defeat and no-change rejection paths pass; all new envelopes pass DB conformance; shared oracle passes Node and each available browser engine.

### Checkpoint 5 — Manual host examples and capability handoff

Add a complete manually driven README example covering generation, available choice selection, player commands, reward recipient, save and reopen. Adapt docs-run with behavioral self-tests so the exact blocks execute and compile; retain existing quickstart checks. Explain single-aggregate save and replay-branch limitations, rest behavior and seed ownership. Run V-ALL and V-BROWSER; Electron is V-ELECTRON with explicit environment evidence. Do not claim CI ran merely because local commands pass.

**Commit when:** manual mode is usable through exported ESM/CJS APIs, all owned examples execute/typecheck, required local proofs pass, and unresolved platform debt is explicitly assigned with CAP readiness left unverified where needed.

## Verification

`pnpm exec vitest run tests/runtime/adventure/adventure.test.ts tests/runtime/adventure/rewards.test.ts tests/snapshots/adventure.test.ts tests/proofs/adventure-journey.test.ts tests/proofs/adventure-determinism.test.ts tests/proofs/contract-conformance.test.ts tests/runtime/combat/module-surface.test.ts tests/proofs/docs-run.test.ts` after V-BUILD. V-BROWSER discovers tests/browser/adventure-determinism.test.ts via existing glob; run the whole browser leg once per engine, no parallel port reuse.

Harness owners: S03 c2 built journey, c4 oracle/browser proof and fixtures. Transport is synchronous built runtime entry, using actual adventure/session/combat/progression/inventory implementations. Seeds: generateCampaign + generateAdventure + legal created characters; fixture packs may declare deterministic actions/XP thresholds, never fake internal services. Bound script to 1000 commands with 10-second tests; assert exhaustion fails rather than silently accepting incomplete adventure. JSON memory storage is the host adapter; teardown discards facades/event subscriptions, then reconstructs from stored bytes. No app-data directory, server or process exists. Build artifact identity and evidence follow STATE V-BUILD. All snapshot inputs and generated docs stay in test fixtures or per-test temp; no protected author file mutation.

## State Update

Return actual CA-04 mappings, receipt predicates, new public symbols, journal/cursor semantics, runtime wiring and proof outcomes. Orchestrator rechecks CA-04 at c4 and amends S04 against committed state/dispatch contracts before dispatch. CAP-03/04 are not verified by a generator test or by mere conformance. No later director session owns an unclosed manual adventure assertion.
