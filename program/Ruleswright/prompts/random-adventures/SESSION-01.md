# SESSION-01 — Play and resume a random encounter

> **Program:** Ruleswright
> **Feature:** random-adventures
> **Modules:** M01, M03
> **Depends on:** —
> **Concurrent with:** —
> **Owns:** `src/schema/play-session.ts`, `src/schema/index.ts`, `src/runtime/snapshots/character.ts`, `src/runtime/character-profile.ts`, `src/runtime/combat/types.ts`, `src/runtime/combat/combat.ts`, `src/runtime/conditions.ts`, `src/runtime/equipment.ts`, `src/runtime/play/session.ts`, `src/runtime/play/encounter.ts`, `src/runtime/play/settlement.ts`, `src/runtime/play/snapshot.ts`, `src/runtime/index.ts`, `tests/runtime/play/fixtures.ts`, `tests/runtime/play/session.test.ts`, `tests/runtime/combat/character-profile.test.ts`, `tests/runtime/combat/combat.test.ts`, `tests/runtime/conditions.test.ts`, `tests/runtime/equipment.test.ts`, `tests/runtime/combat/module-surface.test.ts`, `tests/snapshots/character.test.ts`, `tests/snapshots/play-session.test.ts`, `tests/proofs/encounter-session-journey.test.ts`, `tests/proofs/contract-conformance.test.ts`, `tests/proofs/determinism-oracle.ts`, `README.md`, `tests/proofs/docs-run.test.ts`
> **Reads:** `program/Ruleswright/PROGRAM-CONFIG.MD`, `program/Ruleswright/prompts/random-adventures/STATE.md`, `program/Ruleswright/prompts/random-adventures/AUTHOR-HANDOFF.md`, `program/Ruleswright/prompts/random-adventures/EVIDENCE.md`, `program/Ruleswright/specs/*.md`, `program/Ruleswright/arch/v1-core.md`, `src/schema/contracts/*.json`, `src/core/*.ts`, `src/core/dsl/*.ts`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vitest*.ts`, `tsup.config.ts`, `program-agents/CODER.md`, `src/runtime/runtime.ts`, `src/runtime/events.ts`, `src/runtime/inventory.ts`, `src/runtime/progression.ts`, `src/runtime/pools.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/combat/action-economy.ts`, `src/runtime/combat/triggers.ts`, `src/runtime/snapshots/combat.ts`, `src/runtime/snapshots/envelope.ts`, `src/schema/version.ts`, `src/schema/error-card.ts`, `src/compiler/generate.ts`, `src/compiler/pipeline.ts`, `src/compiler/theme.ts`, `tests/runtime/fixtures/pack.ts`, `tests/runtime/fixtures/packs.ts`
> **Resources:** `build:dist`, `browser:63315`, `test:tmp` (unique per-test directories)
> **Checkpoints:** 6

## Execution Contract

Read every target before modifying it. All new paths/types below are **planned**, not symbols claimed to exist at plan HEAD. Existing symbols are indexed in EVIDENCE.md. Adopt the Author receipt and amend these prompts/CA mappings before dispatch if it changes a proposed shape. Do not guess a protected schema at checkpoint 0.

Checkpoint 0 is read-only: recheck the applicable CA axes (existence, output fit, meaning, real-path proof), dependency commits, runtime contracts, baseline and source identity. Known corrections below are implementation assignments, not checkpoint-0 investigations. No external vendor protocol is introduced; baseline tool path/version identities are in STATE.md. Stop only for a real missing prerequisite or newly discovered product decision.

Every numbered checkpoint is a Coder-owned git commit. Run `git add -- <touched existing paths within this session's explicit Owns>` and commit only those paths, subject `random-adventures SESSION-NN: checkpoint K — <name>`. Never stage `.` or `-A`. Generated `dist/` is ignored disposable output under exclusive `build:dist`, not an artifact to force-add. Source/test ownership is the exact Files table. Do not stage not-yet-created future files; no empty placeholder is required. Read targets in the Files table before edits even though they are not repeated under read-only Reads. Tests may create isolated OS-temp output under `test:tmp`; remove only what that test created. Orchestrator owns STATE/MASTER/arch and records results from your Handoff; do not edit those files.

No package installation, runtime dependency, network provider, application UI, service, database, migration or release step is needed. Preserve existing low-level APIs unless a specific correction below says otherwise. A mechanical fixture seam goes to Orchestrator's Controlled Lease Revision, retaining work; workers never widen leases themselves.

## Module Context

| ID  | Module  | Read                                                                                                                                                                           | Why                                                                            |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| M01 | Schema  | `src/schema/contracts/snapshots.schema.json`, DB AR-02 receipt, `src/schema/error-card.ts`, `src/schema/version.ts`                                                            | Frozen shapes, additive HP and new aggregate contract, identity                |
| M02 | Core    | `src/core/rng.ts`, `src/core/tables.ts`                                                                                                                                        | Stateful seeded randomness; sole table engine                                  |
| M03 | Runtime | `src/runtime/character-profile.ts`, `src/runtime/snapshots/{character,combat}.ts`, `src/runtime/combat/{combat,types}.ts`, `src/runtime/encounter.ts`, `src/runtime/events.ts` | Actual constructors, missing state transfer, restore inputs and event lifetime |

## Context

The current random encounter API returns monster groups; the host wires combat and settlements. The current character writer omits HP, restore regenerates it, and startCombat initializes conditions to []. Low-level settlements clear spend only in the live fight. This session supplies a complete independently usable random encounter mode without requiring an adventure or the compiler.

## Capabilities

Own CAP-01 and the shared producer contribution to CAP-03/04. Public package entry → session command → real assembleEncounter/spawnEncounter → profileFromCharacter/startCombat → actual declare/respond/pass → aggregate settlement → JSON → new runtime/restore → next encounter. The first narrow journey is checkpoint 3 (mid-fight reopen); checkpoint 5 proves terminal settlement and second-fight carryover. Use CA-01/02 for fact origins and exact mappings.

## Contract Agreements

CA-01/02 are provisional against AR-02 and S01 c1/c5. Axis (a): combat, snapshots, inventory/spell writers exist; aggregate writer and HP-preserving contract do not. (b): CharacterCombatant currently carries profile+balances only; add optional conditions to the start entry without inventing a condition field in CombatantProfile. (c): preserve signed HP, remaining condition duration, original resource balances and explicit member identity; old standalone character ids still mint on restore. (d): tests/proofs/encounter-session-journey.test.ts crosses the built public entry, not internal doubles. Required Author receipts must be committed before c1 starts.

## Files to Create/Modify

| File                                             | Action | What Changes                                                                                                                 |
| ------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/schema/play-session.ts`                     | Create | EncounterSetup and session snapshot DTOs; structural and semantic validation against the DB receipt.                         |
| `src/schema/index.ts`                            | Modify | Export the new session data contracts without runtime imports.                                                               |
| `src/runtime/snapshots/character.ts`             | Modify | Preserve current and temporary HP; validate the additive field before restoring any member; retain legacy omission behavior. |
| `src/runtime/character-profile.ts`               | Modify | Copy character conditions into the start request; keep existing item/spell settlement API behavior.                          |
| `src/runtime/combat/types.ts`                    | Modify | Optional initial conditions per combatant; expose the planned pass-turn contract.                                            |
| `src/runtime/combat/combat.ts`                   | Modify | Validate/copy initial conditions before initiative; explicit pass turn through existing end-turn machinery.                  |
| `src/runtime/conditions.ts`                      | Modify | Allow the item effect duration to be applied before emitting the condition event; preserve other callers.                    |
| `src/runtime/equipment.ts`                       | Modify | Pass the evaluated condition duration into the authoritative application, correcting the inherited display mismatch.         |
| `src/runtime/play/session.ts`                    | Create | Encounter facade, command routing, isolated state ownership, revisions and views.                                            |
| `src/runtime/play/encounter.ts`                  | Create | Budget assembly, unique member/enemy bindings, spatial setup and combat command adapter.                                     |
| `src/runtime/play/settlement.ts`                 | Create | Atomic party-wide HP/condition/item/spell settlement with persisted receipt.                                                 |
| `src/runtime/play/snapshot.ts`                   | Create | Complete encounter aggregate writer/reader, start inputs, current positions, terrain and RNG.                                |
| `src/runtime/index.ts`                           | Modify | Export playable encounters and their types.                                                                                  |
| `tests/runtime/play/fixtures.ts`                 | Create | Small valid packs, party seed facts and bounded driver shared by later journeys.                                             |
| `tests/runtime/play/session.test.ts`             | Create | Command, pass, identity, receipt, atomicity and failed-command tests.                                                        |
| `tests/runtime/combat/character-profile.test.ts` | Modify | Conditions transfer and isolation; existing profile consumers remain compatible.                                             |
| `tests/runtime/combat/combat.test.ts`            | Modify | Start-condition validation and explicit pass; no repeated step replenishment exploit in wrapper.                             |
| `tests/runtime/conditions.test.ts`               | Modify | Effective duration and stacking/event correspondence.                                                                        |
| `tests/runtime/equipment.test.ts`                | Modify | Inherited useItem duration display regression.                                                                               |
| `tests/runtime/combat/module-surface.test.ts`    | Modify | Add new runtime exports while preserving exact existing export assertions.                                                   |
| `tests/snapshots/character.test.ts`              | Modify | HP shape pin, wounded/temp/negative HP round trips and legacy omission.                                                      |
| `tests/snapshots/play-session.test.ts`           | Create | Aggregate shape, deep validation and restore no-change assertions.                                                           |
| `tests/proofs/encounter-session-journey.test.ts` | Create | First public built-package journey, JSON save/reopen and next-fight carryover.                                               |
| `tests/proofs/contract-conformance.test.ts`      | Modify | New HP and encounter outputs against DB schemas; preserve existing subjects and negative controls.                           |
| `tests/proofs/determinism-oracle.ts`             | Modify | Only documented character-envelope byte changes; retain pack digests and unrelated leg digests.                              |
| `README.md`                                      | Modify | Encounter API example, conditions/HP compatibility and aggregate vs low-level settlement limits.                             |
| `tests/proofs/docs-run.test.ts`                  | Modify | Execute/typecheck the new example and keep existing quickstart assertions; behavioral extractor controls.                    |

## Implementation

### Checkpoint 1 — Lossless character state and session data boundary

Implement the received optional `hp: {current, temp}` character field and new EncounterSetup/session DTOs in schema/play-session.ts. New writers always include exact HP; legacy absence retains the pre-feature reconstruction path, documented as legacy behavior, not recovered injury. Current HP is integer without clamping; temp is nonnegative integer bookkeeping, not a new damage-absorption mechanic. Validate before any ids/events/state changes. Add schema barrel export. Mirror AR-02 exactly, use existing ErrorCard families rather than minting registry codes.

Update exact character key pins, Ajv subjects, and **only the characterized character-envelope byte delta** in determinism-oracle; compare before/after raw JSON. Existing pack digests remain unchanged. Include wounded, negative, above-derived-max and temp HP; malformed HP rejection leaves nextCharacterId untouched.

**Commit when:** `pnpm build`, `pnpm typecheck` and V-CHAR pass, including contract conformance and characterization; every changed digest has a field-level explanation and no unrelated re-key.

### Checkpoint 2 — Transfer conditions and provide an explicit pass

Add optional initial conditions to each StartCombatRequest member and CharacterCombatant. profileFromCharacter returns a detached copy only when nonempty to preserve empty-profile shape. startCombat validates all ids/durations before initiative or events and copies them into combatant state. Add `Combat.pass(): StepOutcome` (planned) through existing endTurn/advanceFrom; refuse after terminal and while unanswered offers exist. Do not implement pass by repeatedly calling step: awaiting-declare step replenishes slots at current HEAD.

Correct inherited useItem condition-duration display in conditions.ts/equipment.ts: the evaluated duration must reach stacking/application before its event is emitted. Keep refresh/stack/ignore semantics; assert actual duration and event agree. No new conditions or duration policy.

**Commit when:** build/typecheck, V-CHAR and the conditions/equipment/combat tests pass; conditioned actors are restricted without post-start test mutation, pass advances once, and legacy character/profile callers compile.

### Checkpoint 3 — First playable encounter through the built entry and reopen

Implement session creation, detached views, commands and aggregate serialization together. Proposed API (types are new and must match Author receipt):

```ts
createEncounterSession(pack: Pack, options: EncounterSessionOptions): EncounterSession;
restoreEncounterSession(pack: Pack, snapshot: unknown): EncounterSession;
// facade: view(); dispatch(command); serialize();
// command carries expectedRevision and a stable memberId when acting for a player.
```

Options carry explicit stable session/member ids, character envelopes, seed and EncounterSetup. A session owns an isolated Runtime and copied party; do not publish mutable internal Character/Combat objects. Use a resumable Rng, not a RandomSource without export state. Capture fight-start profiles/balances, original bindings, side mapping, terrain and positions. During restore pass the **saved current** positions into deserializeCombat; its restore.positions wins over frozen position fields. Never reconstruct fight-start balances from already-settled characters. Generate deterministic namespaced enemy instance ids to avoid group suffix and party collisions. Reject nonfinite/nonpositive budget, empty party, no affordable monsters, duplicate ids and insufficient placement capacity before exposing a playable fight.

Commands map to declare/use/respond/pass and turn preparation. Track whether the current turn was started; never replenish an already-started turn. Preserve pending offers and movement. The host supplies explicit spatial layout policy in EncounterSetup; bundled generated layouts arrive later. No hidden grid invented by low-level startCombat.

Build the first journey in tests/proofs/encounter-session-journey.test.ts now. Generate the real dark-fantasy pack, seed one legal wounded/conditioned warden and a bounded setup, take a real action, serialize to JSON, drop references and restore with a fresh Runtime. Assert identical next command result/RNG/positions/conditions/resources. A two-member fixture must prove binding by memberId, including a runtime whose character serial was already advanced. Do not use names or array order as identity.

**Commit when:** V-ENCOUNTER and all prior tests pass after a fresh build; the public API can play, pause and restore an encounter. Finishing without settlement remains explicitly unready until c4/c5; no fake successful settlement response.

### Checkpoint 4 — Atomic terminal settlement

Implement play/settlement.ts and wire completion in session.ts. Reuse existing settleItemUses/settleSpellCasts on **staged isolated copies**, transfer final HP and condition durations, validate every member before replacing aggregate state, and emit staged events only after a successful commit. An insufficient balance on member two must not debit member one or clear any fight spend. Keep exact remaining durations and temp bookkeeping; don't introduce automatic healing/condition ticking between fights.

Persist a settlement receipt bound to session id, encounter id and command revision. A repeated finalize against the same aggregate is an idempotent receipt, without reapplying spend/events; a foreign receipt or stale command refuses with unchanged state/RNG. Independently restoring an old whole save creates a replay branch; this is not a cross-device exactly-once service. Do not claim the existing loose party+combat pair acquires this guarantee.

**Commit when:** settlement unit tests and V-ENCOUNTER prove item/pool/binding/HP/conditions applied exactly once and multi-member failures atomic; live and restored aggregate receipts agree.

### Checkpoint 5 — Consecutive fights, rejection and full restore proof

Complete the standalone encounter continuation API (explicit next setup from host, no story obligation). Reuse the settled party in a second encounter. Preserve conditions/resources/HP across both fight and aggregate restart. Validate complete unknown input before reconstructing: side/order membership, unique ids, valid condition references and durations, bounds on rng words (`0 <= word < 2**32`), original spend balances, pairing identity and receipts. The legacy deserializeCombat rng upper-bound check currently permits exactly 2**32; the aggregate validator must reject it before delegating. No broad unrelated snapshot rewrite.

Extend conformance with encounter schemas and negative controls that assert keyword/path, not merely false. Use no grantable loot, no-story and zero-reward encounters as supported standalone cases; XP/loot policy is a later adventure concern.

**Commit when:** V-ENCOUNTER proves second-fight continuity, foreign/malformed snapshots cause no visible mutation or events, and repeated finalize after reopen does not spend twice; V-CHAR stays green.

### Checkpoint 6 — Usable documented host boundary

Document a copy-paste encounter loop and atomic host-save boundary in README, replacing the current no-condition-transfer statement and disclosing legacy HP omission. Preserve the low-level settlement warning where still true. Adapt docs-run to group/run examples explicitly rather than stripping unknown imports or merely increasing its four-block count. Add self-tests where a wrong import/output or missing example fails; this is changed tooling and its own behavior must be tested. Run Node and existing browser characterization legs after HP changes.

**Commit when:** V-ALL passes locally where available, docs execute and typecheck, V-BROWSER passes or environment debt is assigned without claiming cross-runtime completion. Handoff contains actual receipts, checks and the early-journey evidence for S02/S03.

## Verification

V-CHAR: `pnpm exec vitest run tests/snapshots/character.test.ts tests/runtime/combat/character-profile.test.ts tests/proofs/contract-conformance.test.ts tests/proofs/combat-characterization.test.ts tests/runtime/combat/module-surface.test.ts`.
V-ENCOUNTER: `pnpm exec vitest run tests/runtime/play tests/snapshots/play-session.test.ts tests/proofs/encounter-session-journey.test.ts`.
At c2 also run `pnpm exec vitest run tests/runtime/conditions.test.ts tests/runtime/equipment.test.ts tests/runtime/combat/combat.test.ts`.
Use STATE V-BUILD before every built journey and V-ALL at final. Vitest node include already discovers new tests; do not add --passWithNoTests. Each new journey has a 10-second per-test timeout and bounded command loops (e.g. 500 steps, fail with state diagnostic on exhaustion). The bound is a test guard, not an agent turn limit.

Harness owner is S01 c3. Actual transport is the synchronous `dist/runtime.js` API (plus CJS smoke via createRequire); no native bridge/server exists. Seeds are real generated packs and legal createCharacter output; fixtures may author pack data, never replace production combat/storage code. Host persistence is JSON stringify/parse into a detached variable; discard the facade, construct a new one, compare continuation. No filesystem adapter or shutdown process is necessary. Collect command-scoped events, not sinceRound across multiple fights whose clocks restart. Evidence: source revision, fresh dist hashes, commands, selected test counts and assertions in Handoff. Resources: build:dist; browser:63315 when running V-BROWSER; per-test OS temp only for docs runner.

## State Update

Return Handoff with committed checkpoints, CA-01/02 mapping amendments, HP oracle deltas, source hashes, receipt format and V-ENCOUNTER proof. Orchestrator rechecks S02 EncounterSetup and S03 member/receipt mappings against the landed source before dispatch. Recheck after landing: current positions versus restore precedence, original balances versus remaining balances, stable identities and event cursors. Do not mark CAP-03/04 complete merely because S01 is done.
