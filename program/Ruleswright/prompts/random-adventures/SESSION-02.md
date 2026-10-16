# SESSION-02 — Generate finite adventures as portable data

> **Program:** Ruleswright
> **Feature:** random-adventures
> **Modules:** M01, M04
> **Depends on:** SESSION-01
> **Concurrent with:** —
> **Owns:** `src/schema/adventure.ts`, `src/schema/index.ts`, `src/compiler/adventure.ts`, `src/compiler/adventure-templates/dark-fantasy.json`, `src/compiler/adventure-templates/zombie-urban.json`, `src/compiler/adventure-templates/wyldwood.json`, `src/compiler/adventure-templates.ts`, `src/compiler/index.ts`, `tests/schema/adventure.test.ts`, `tests/compiler/adventure.test.ts`, `tests/compiler/coverage-floor.test.ts`, `tests/proofs/adventure-generation-journey.test.ts`, `scripts/check-runtime-isolation.mjs`, `tests/proofs/runtime-isolation-gate.test.ts`, `README.md`, `tests/proofs/docs-run.test.ts`
> **Reads:** `program/Ruleswright/PROGRAM-CONFIG.MD`, `program/Ruleswright/prompts/random-adventures/STATE.md`, `program/Ruleswright/prompts/random-adventures/AUTHOR-HANDOFF.md`, `program/Ruleswright/prompts/random-adventures/EVIDENCE.md`, `program/Ruleswright/specs/*.md`, `program/Ruleswright/arch/v1-core.md`, `src/schema/contracts/*.json`, `src/core/*.ts`, `src/core/dsl/*.ts`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vitest*.ts`, `tsup.config.ts`, `program-agents/CODER.md`, `src/runtime/runtime.ts`, `src/runtime/events.ts`, `src/runtime/inventory.ts`, `src/runtime/progression.ts`, `src/runtime/pools.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/combat/action-economy.ts`, `src/runtime/combat/triggers.ts`, `src/runtime/snapshots/combat.ts`, `src/runtime/snapshots/envelope.ts`, `src/schema/version.ts`, `src/schema/error-card.ts`, `src/compiler/generate.ts`, `src/compiler/pipeline.ts`, `src/compiler/theme.ts`, `tests/runtime/fixtures/pack.ts`, `tests/runtime/fixtures/packs.ts`
> **Resources:** `build:dist`, `browser:63315`, `test:tmp` (unique per-test directories)
> **Checkpoints:** 3

## Execution Contract

Read every target before modifying it. All new paths/types below are **planned**, not symbols claimed to exist at plan HEAD. Existing symbols are indexed in EVIDENCE.md. Adopt the Author receipt and amend these prompts/CA mappings before dispatch if it changes a proposed shape. Do not guess a protected schema at checkpoint 0.

Checkpoint 0 is read-only: recheck the applicable CA axes (existence, output fit, meaning, real-path proof), dependency commits, runtime contracts, baseline and source identity. Known corrections below are implementation assignments, not checkpoint-0 investigations. No external vendor protocol is introduced; baseline tool path/version identities are in STATE.md. Stop only for a real missing prerequisite or newly discovered product decision.

Every numbered checkpoint is a Coder-owned git commit. Run `git add -- <touched existing paths within this session's explicit Owns>` and commit only those paths, subject `random-adventures SESSION-NN: checkpoint K — <name>`. Never stage `.` or `-A`. Generated `dist/` is ignored disposable output under exclusive `build:dist`, not an artifact to force-add. Source/test ownership is the exact Files table. Do not stage not-yet-created future files; no empty placeholder is required. Read targets in the Files table before edits even though they are not repeated under read-only Reads. Tests may create isolated OS-temp output under `test:tmp`; remove only what that test created. Orchestrator owns STATE/MASTER/arch and records results from your Handoff; do not edit those files.

No package installation, runtime dependency, network provider, application UI, service, database, migration or release step is needed. Preserve existing low-level APIs unless a specific correction below says otherwise. A mechanical fixture seam goes to Orchestrator's Controlled Lease Revision, retaining work; workers never widen leases themselves.

## Module Context

| ID  | Module   | Read                                                                                       | Why                                                                    |
| --- | -------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| M01 | Schema   | S01 `src/schema/play-session.ts`, `src/schema/{version,error-card}.ts`, AR-02/03 contracts | Concrete EncounterSetup consumed by generated nodes; portable identity |
| M02 | Core     | `src/core/tables.ts`, `src/core/rng.ts`                                                    | One table engine and bounded seeded generation                         |
| M04 | Compiler | `src/compiler/{generate,pipeline,stage,theme,theme-loader,index}.ts`                       | Keep existing pack pipeline intact; mirror static template lookup      |

## Context

A generated campaign is currently a rules pack, not a traversable adventure. Add a separately generated, pack-bound plain-JSON adventure definition. Existing packs remain first-class; the runtime consumes the document and never imports the compiler. This session delivers the usable content-generation capability; S03 supplies its play consumer.

## Capabilities

CAP-02: author/template + pack + seed → finite connected locations, choices, encounter setups and declared rewards → validated portable document. Same inputs yield byte-identical output. Bind to actual effective pack id/schemaVersion/contentHash, not a theme name alone. Generation is read-only with respect to game state; JSON artifact is the durable output hosts may save.

## Contract Agreements

CA-03 provisional against AR-03 and S02 c2. (a) Rng/rollTable/packContentHash exist; graph/template producer missing, owned here. S01 EncounterSetup and its validator must be committed/ready. (b) each encounter node emits that exact setup shape, not a loosely shaped DTO. (c) route edges, objective terminal, reward refs and original narrative facts stay distinct. Template reward values are authority; a monster threat is not XP. (d) generation journey proves public compiler output and schema validator; play integration remains S03 c2/c4, not a claim of this session.

## Files to Create/Modify

| File                                                 | Action | What Changes                                                                                                 |
| ---------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| `src/schema/adventure.ts`                            | Create | AdventureTemplate and AdventureDefinition DTOs and validators, composing S01 EncounterSetup.                 |
| `src/schema/index.ts`                                | Modify | Export adventure data types/validation only.                                                                 |
| `src/compiler/adventure.ts`                          | Create | generateAdventure using the one table engine and isolated seeded generation stream.                          |
| `src/compiler/adventure-templates/dark-fantasy.json` | Create | Coined location, choice, reward, placement and narration data for dark-fantasy.                              |
| `src/compiler/adventure-templates/zombie-urban.json` | Create | Coined location, choice, reward, placement and narration data for zombie-urban.                              |
| `src/compiler/adventure-templates/wyldwood.json`     | Create | Coined location, choice, reward, hex placement and narration data for wyldwood.                              |
| `src/compiler/adventure-templates.ts`                | Create | Static bundled template registry; explicit lookup without dynamic imports.                                   |
| `src/compiler/index.ts`                              | Modify | Export generator and template loader; keep generateCampaign unchanged.                                       |
| `tests/schema/adventure.test.ts`                     | Create | Template/definition validation and exact ErrorCard paths, graph/ref/layout constraints.                      |
| `tests/compiler/adventure.test.ts`                   | Create | Determinism, graph reachability, table semantics and schema conformance using real generator.                |
| `tests/compiler/coverage-floor.test.ts`              | Modify | Assign inherited optional CAP-F1 compiler refusal proof and H-R1 theme-title correction.                     |
| `tests/proofs/adventure-generation-journey.test.ts`  | Create | Built compiler/schema surfaces produce validated pack-bound definitions for all bundled themes.              |
| `scripts/check-runtime-isolation.mjs`                | Modify | Check generateAdventure as well as generateCampaign in runtime bundles; support isolated test fixtures.      |
| `tests/proofs/runtime-isolation-gate.test.ts`        | Create | Behavioral subprocess self-tests: each forbidden generator, absent artifacts, dual format and clean outputs. |
| `README.md`                                          | Modify | Runnable generateAdventure example and sidecar compatibility/limits.                                         |
| `tests/proofs/docs-run.test.ts`                      | Modify | Run/typecheck new compiler example and preserve prior examples.                                              |

## Implementation

### Checkpoint 1 — Validate authored adventure inputs and outputs

Implement schema/adventure.ts from the committed Author receipt. Define separate template and generated-definition identities and versions, bounded node count, explicit start/terminal ids, edges/choice ids, encounter setup, declared XP per member and loot-table/recipient rules, rest/preparation availability, and narrative template references. Validate template/definition refs and structure with ErrorCards before exposing output. Validate all referenced nodes reachable from start and a required success terminal reachable; reject dangling refs, duplicate identities, invalid budgets, impossible placement capacity, nonfinite numbers and nonpositive weights. Explicit defeat/abandon outcomes need not be graph edges.

The definition holds no Runtime or Character. Use S01 EncounterSetup rather than a second setup type. Do not add fields to Pack or ThemeTemplate or weaken their closed schemas. The sidecar's schema and template vocabulary are DB-owned AR-03 inputs. The core/schema sibling boundary remains: schema validation may inspect table declarations but may not import core to roll them.

**Commit when:** build/typecheck and `pnpm exec vitest run tests/schema/adventure.test.ts` pass, including multiple errors collected and unknown-reference paths; existing schema/root tests pass.

### Checkpoint 2 — Seeded generation and three bundled templates

Planned public API:

```ts
generateAdventure(request: {
  pack: Pack;
  template: AdventureTemplate;
  seed: string | number;
}): AdventureDefinition;
loadAdventureTemplate(id: string): AdventureTemplate;
```

Use core Rng with a documented seed domain and rollTable for weighted location/encounter/flavor choices. Keep generation entropy separate from play/combat/director streams. Use a bounded finite branching DAG: choose a fixed required spine and optional branches from template data, connect every node at generation time; never retry random graphs until one happens to work. Every required combat has affordable monsters and a supplied placement policy; no empty encounter may masquerade as a victory. Weighted tables select descriptors; assembleEncounter remains a runtime operation and compiler must not import it. A generator may validate affordability from pack.bestiary threat values without inventing a second battle assembler.

Provide original small templates for all three existing themes. Select class/race/item/table/action refs by explicit authored ids confirmed against generated packs in tests. Include an objective, a meaningful branch, a noncombat discovery, a rest opportunity and at least two potential encounters with declared XP/loot. Rest calls existing pool/slot rest policy only; it does not heal HP or resurrect. All new content lives in sidecar JSON, so existing generated packs/hashes remain unchanged. Allow hosts to pass their own template for any valid compatible hand-authored pack; absent required support is a located validation error, never silent fallback to a bundled theme.

Add a built compiler/schema journey using all three real packs plus one hand-authored fixture. Compare repeated output bytes and vary a small fixed seed set to establish randomized choice diversity; don't assert every pair of seeds differs. Reuse generated definitions unchanged in the validator. Generation conformance tests read the DB schema directly via existing dev-only Ajv.

**Commit when:** fresh build, schema/compiler adventure tests and `tests/proofs/adventure-generation-journey.test.ts` pass; every generated graph validates and reaches its objective, references resolve and pack digests are unchanged.

### Checkpoint 3 — Isolation gate, inherited compiler proof and runnable docs

Extend scripts/check-runtime-isolation.mjs to reject either generator symbol in either runtime artifact. Preserve its normal default `dist` behavior; permit a narrowly explicit fixture output directory for its own subprocess tests. Own and execute tests/proofs/runtime-isolation-gate.test.ts: a clean dual-format directory passes; missing runtime outputs fail; each forbidden symbol in ESM or CJS fails; absent declarations fail. Use mkdtemp in OS temp, bounded spawn and finally cleanup. Never mutate real out-of-lease bundles for negative controls.

Assign inherited optional CAP-F1 to tests/compiler/coverage-floor.test.ts: a malformed featSlots theme must fail the actual generateCampaign stage-8 path with the expected E-SCHEMA-01 location. Correct its H-R1 'both themes' titles. Do not alter the existing pack content (including the twelve damage(half) content sites).

Document the new generator, separate pack/definition identity and template override seam; execute/typecheck the exact README example through docs-run and preserve extractor self-tests. Generation is not yet playable by the adventure facade; say so until S03 lands.

**Commit when:** V-ALL, isolation-gate self-tests, adventure generator journey, compiler coverage-floor and existing pack-identity tests pass; no runtime→compiler value edge is introduced.

## Verification

`pnpm exec vitest run tests/schema/adventure.test.ts tests/compiler/adventure.test.ts tests/proofs/adventure-generation-journey.test.ts tests/proofs/runtime-isolation-gate.test.ts tests/compiler/coverage-floor.test.ts tests/proofs/pack-identity.test.ts tests/proofs/docs-run.test.ts` after V-BUILD. Discovery is existing Vitest Node configuration. No server or provider; actual entry is built compiler/schema ESM plus CJS smoke. Generator state is pure and persisted by JSON stringify/parse; no application-data directory. Fixed seeds and declared templates are the authoritative inputs; tests use real Rng, rollTable, generator and validator. Test timeout 10 seconds, generation finite by template node bound; subprocess self-tests use a 10-second timeout and remove only their mkdtemp directory. Evidence and freshness follow STATE V-BUILD. Harness/fixtures owner S02 c2; gate self-tests S02 c3. No proof about S03 play is claimed here.

## State Update

Report actual generated schema/version/digests, template ids, sample refs and gate self-test outcomes. Recheck after landing: Orchestrator compares CA-03 to generated definitions and all three template outputs, then amends S03 mappings before dispatch. The old pack pipeline and pack digests must remain unchanged. CAP-02 can be verified independently; CAP-03/04 remain planned.
