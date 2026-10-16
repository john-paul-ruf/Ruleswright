# State Tracker — Ruleswright / random-adventures

## Program / Feature / Intent / Sessions

- Program: Ruleswright; existing authoritative root `program/Ruleswright/` and config `PROGRAM-CONFIG.MD` (case retained; no competing kebab-case root/config).
- Feature: random-adventures. REPLAN-RA-CONTRACTS revision 2; plan base `310397c4d1825d9163a5797addd73bc6d1f912d1`; implementation source `c8e526047b8186d35710965d5f210f858ab232a3`; protected Author contracts through `42bad6023e698bd430a7c50842a1882c5bd9f206` (F-RA-01 assertion-only addendum based on `44fac85625db8eb62ebddb795018f1ee12a97c22`; revision 2 leases/checkpoints unchanged); replan date 2026-10-16. The scoped replan commit is recorded in git and the returned Handoff (no self-referential hash).
- Intent: all three requested modes — standalone random encounters, complete headless adventures, and a solo director — through one UI-independent library.
- Four implementation sessions, 19 checkpoint commits planned. No implementation has been executed. Author AR-01–06 receipts are complete and reconciled here; no implementation checkpoint has begun. Scoped Archivist D3/D5 recheck remains due before execution; the received D1/D2/D4/D6/D7 review evidence is retained.
- Input authority: user's “plan all three” after the three scopes; original “regardless of ui”; current config and Author sources. On resume, the user's “start” in direct response to the concrete AR-01–AR-06 approval request is interpreted as approval of those amendments and deliberate Author re-entry; see Authorization Receipt below. Older narrative deferral is superseded in scope by that answer, while offline/no-I/O/rules-as-data remain.

## Session Status

| #   | Session                                                                                     | Modules  | Owns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Status  | Checkpoint | Completed | Notes                                                                        |
| --- | ------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- | --------- | ---------------------------------------------------------------------------- |
| 01  | [SESSION-01](SESSION-01.md) — Play and resume a random encounter                            | M01, M03 | `src/schema/play-session.ts`, `src/schema/index.ts`, `src/runtime/snapshots/character.ts`, `src/runtime/character-profile.ts`, `src/runtime/combat/types.ts`, `src/runtime/combat/combat.ts`, `src/runtime/conditions.ts`, `src/runtime/equipment.ts`, `src/runtime/play/session.ts`, `src/runtime/play/encounter.ts`, `src/runtime/play/settlement.ts`, `src/runtime/play/snapshot.ts`, `src/runtime/index.ts`, `tests/runtime/play/fixtures.ts`, `tests/runtime/play/session.test.ts`, `tests/runtime/combat/character-profile.test.ts`, `tests/runtime/combat/combat.test.ts`, `tests/runtime/conditions.test.ts`, `tests/runtime/equipment.test.ts`, `tests/runtime/combat/module-surface.test.ts`, `tests/snapshots/character.test.ts`, `tests/snapshots/play-session.test.ts`, `tests/proofs/encounter-session-journey.test.ts`, `tests/proofs/contract-conformance.test.ts`, `tests/proofs/determinism-oracle.ts`, `README.md`, `tests/proofs/docs-run.test.ts`                                                                                                                                                                                                                                                                                                                                                                                  | in-progress | 0/6 | — | W1 Native h-Xiqj; lease2; Coder owns checkpoints      |
| 02  | [SESSION-02](SESSION-02.md) — Generate finite adventures as portable data                   | M01, M04 | `src/schema/adventure.ts`, `src/schema/index.ts`, `src/compiler/adventure.ts`, `src/compiler/adventure-templates/dark-fantasy.json`, `src/compiler/adventure-templates/zombie-urban.json`, `src/compiler/adventure-templates/wyldwood.json`, `src/compiler/adventure-templates.ts`, `src/compiler/index.ts`, `tests/schema/adventure.test.ts`, `tests/compiler/adventure.test.ts`, `tests/compiler/coverage-floor.test.ts`, `tests/proofs/adventure-generation-journey.test.ts`, `scripts/check-runtime-isolation.mjs`, `tests/proofs/runtime-isolation-gate.test.ts`, `README.md`, `tests/proofs/docs-run.test.ts`, `tests/proofs/contract-conformance.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | pending | —          | —         | Depends on SESSION-01; required predecessor/CA proof gates below             |
| 03  | [SESSION-03](SESSION-03.md) — Play complete adventures with durable rewards and progression | M03      | `src/runtime/adventure/types.ts`, `src/runtime/adventure/adventure.ts`, `src/runtime/adventure/choices.ts`, `src/runtime/adventure/rewards.ts`, `src/runtime/adventure/snapshot.ts`, `src/runtime/index.ts`, `tests/runtime/adventure/fixtures.ts`, `tests/runtime/adventure/adventure.test.ts`, `tests/runtime/adventure/rewards.test.ts`, `tests/snapshots/adventure.test.ts`, `tests/runtime/combat/module-surface.test.ts`, `tests/proofs/adventure-journey.test.ts`, `tests/proofs/adventure-oracle.ts`, `tests/proofs/adventure-determinism.test.ts`, `tests/browser/adventure-determinism.test.ts`, `tests/proofs/contract-conformance.test.ts`, `README.md`, `tests/proofs/docs-run.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | pending | —          | —         | Depends on SESSION-01, SESSION-02; required predecessor/CA proof gates below |
| 04  | [SESSION-04](SESSION-04.md) — Run a bounded solo director with offline narration            | M03      | `src/runtime/combat/preview.ts`, `src/runtime/combat/combat.ts`, `src/runtime/combat/declare.ts`, `src/runtime/combat/movement.ts`, `src/runtime/play/session.ts`, `src/runtime/adventure/adventure.ts`, `src/runtime/adventure/types.ts`, `src/runtime/adventure/snapshot.ts`, `src/runtime/adventure/director.ts`, `src/runtime/adventure/narration.ts`, `src/runtime/index.ts`, `tests/runtime/adventure/director.test.ts`, `tests/runtime/adventure/narration.test.ts`, `tests/runtime/combat/preview.test.ts`, `tests/runtime/combat/movement.test.ts`, `tests/runtime/combat/module-surface.test.ts`, `tests/proofs/solo-adventure-journey.test.ts`, `tests/proofs/adventure-oracle.ts`, `tests/proofs/adventure-determinism.test.ts`, `tests/browser/adventure-determinism.test.ts`, `tests/snapshots/adventure.test.ts`, `tests/proofs/contract-conformance.test.ts`, `.github/workflows/ci.yml`, `README.md`, `tests/proofs/docs-run.test.ts`, `src/runtime/combat/types.ts`, `src/runtime/snapshots/combat.ts`, `tests/snapshots/combat.test.ts`, `tests/proofs/movement-journey.test.ts`, `tests/proofs/determinism-oracle.ts`, `tests/runtime/adventure/fixtures.ts`, `tests/runtime/play/session.test.ts`, `src/runtime/combat/triggers.ts`, `tests/runtime/combat/spatial-triggers.test.ts`, `tests/runtime/combat/feat-triggers.test.ts` | pending | —          | —         | Depends on SESSION-03; required predecessor/CA proof gates below             |

## Wave Plan

| Wave         | Sessions                                      | Why concurrent                                                                                                                     |
| ------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Prerequisite | Scoped Archivist planning-completeness review | Author correction 42bad60 and F-RA-01 assertion assignments are complete; Orchestrator routes scoped D3/D5 recheck before dispatch. D1/D2/D4/D6/D7 evidence retained |
| 1            | SESSION-01                                    | First connected encounter/save/reopen path. No concurrent Coder lease                                                              |
| 2            | SESSION-02                                    | Consumes committed EncounterSetup/validation from S01; produces portable graph and authoring templates                             |
| 3            | SESSION-03                                    | Consumes real encounter facade and real generated definitions; owns shared runtime export/README/conformance paths serially        |
| 4            | SESSION-04                                    | Consumes actual adventure dispatch/journal/reward contract; owns shared composition/proof paths serially                           |

All source/test leases are exact paths in session front matter and lease-manifest.json. Shared generated output uses exclusive build:dist; browser mode uses exclusive browser:63315. The only generated repository output is ignored dist under that resource; it is never force-added. No overlapping concurrent source lease or assertion-coverage window exists. Within each wave, checkpoints run serially and Coder commits its own lease. Do not treat implementation checkpoints as separate sessions.

## Dependency Graph

`AR-01 + AR-02 (committed) → S01 → S02 → S03 → S04`; `S01 → S03` also directly.
`AR-03 (committed) → S02`; `AR-04 (committed) → S03`; `AR-05 (committed) → S04 c2`; `AR-06 (committed) → documentation checkpoints`. All Author arrows are satisfied contract inputs; runtime predecessor arrows remain planned.
S01 produces EncounterSetup (c1), resumable session (c3), atomic settlement and second-fight proof (c4/c5).
S02 produces AdventureDefinition/template validator and real generated graphs (c1/c2).
S03 produces actual adventure dispatch/reward receipt/journal/snapshot (c2–c4).
S04 supplies legality preview and autonomous control itself; those are its outputs, not prerequisites that must exist before its dispatch.

## Architecture Reference

M01 `src/schema/` and M02 `src/core/` remain sibling leaves. M03 `src/runtime/` consumes M01/M02; M04 `src/compiler/` consumes M01/M02; M05 `src/index.ts` remains re-export only. All seven realized cross-module value edges were re-derived with TypeScript AST traversal across 77 committed non-test TS files at plan HEAD (type imports removed; value export-from counted); see EVIDENCE. No new module ID is needed. New `play/` and `adventure/` are precise session-owned paths within M03, not overlapping module leases.

Declared [D] additions: M03/play → M01/play-session; M04/adventure → M01/adventure and M02 tables/rng; M03/adventure → M01/adventure, M03/play and existing character writers. Existing module-level edges are [R]; these new files/symbols are planned, not realized. Under ten modules, the authoritative registry table suffices. Orchestrator/Archivist updates config/arch at receives, never Coder.

No database, backend service, network transport, renderer bridge, ports for product runtime, or storage adapter. The actual application boundary is exported synchronous JS/TS calls. JSON host storage and fresh facade reconstruction are the restart boundary. Runtime-only consumption must not bring either generator into the bundle.

## Scope Summary

| ID  | Scope                                                                                     | Owner/checkpoint                     | Explicit boundary                                                     |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| M01 | Additive HP/session, definition and aggregate contracts mirrored by code; validators      | DB receipts complete; S01 c1, S02 c1 | Frozen JSON schemas remain Author-owned; no new pack fields           |
| M02 | Existing RNG/table/DSL mechanisms                                                         | Read-only                            | No second table roller or ambient entropy                             |
| M03 | Encounter carryover/settlement; adventure progression; solo control/narration             | S01, S03, S04                        | No UI, storage service, new spell subsystem or artificial successes   |
| M04 | Separate deterministic adventure generator and original templates                         | S02 c2                               | generateCampaign and existing theme packs remain unchanged            |
| M05 | Existing root export composition; packaging/proofs/docs/CI support outside source modules | Owning sessions' exact paths         | Root entry itself unchanged; no new dependencies/subpaths/publication |

Feature acceptance additions (stable plan-local requirement ids): RA-01 playable seeded encounter → CAP-01/S01; RA-02 finite seeded graph/content → CAP-02/S02; RA-03 player choices/exploration/real combat/terminal → CAP-03/S03; RA-04 rewards/XP/preparation/save/reopen → CAP-04/S03; RA-05 enemy automation with player yields → CAP-05/S04; RA-06 factual offline narration → CAP-06/S04. These implement the current inline scope; Approved FR-24..29 now map respectively to RA-01..06/CAP-01..06; AR-01 source receipt is complete. Supporting existing requirements FR-1/5/7/10/13/14/16 feed CAP-01, FR-15/17/18/20/21 feed CAP-02, FR-6/8/9/19/23 feed CAP-04, FR-11/12 feed CAP-05, and FR-22/NFR-DX/Determinism apply across all sessions.

### Inspected inherited records and dispositions

Sources/revisions: six existing VERIFICATION.md files (feat-progression 8b1f224, builder-rulings f3ed463, combat-decomposition 5e642a1, class-features 69acc7a, browser-determinism 5c62f8d, contract-conformance 07ba8c8); contract-conformance STATE and its carried hazards; current .program/ledger.md, blockers.md, decisions.md; arch/v1-core.md current residuals; ARCHIVIST-LOG latest standing recommendations/cleanup; conversation findings. Source manifest/digests in EVIDENCE. Earlier verifier output is historical; no new blanket verified verdict follows from it. All six reports record zero failed rows; browser and contract-conformance carry B-BD-1 present-unverified. That is not proof all adventure behavior exists.

| Finding                                                                            | Disposition and evidence                                                                                                                                                          | CAP/CA / owner / dependents                                                                                                                                                        |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conversation: lost current HP                                                      | Confirmed: plan probe 3/2 → 27/0; writer/reader source traced                                                                                                                     | CAP-01, CA-01; DB AR-02 complete; S01 c1; blocks full encounter/adventure resume                                                                                                   |
| Conversation / F-R3: initial conditions absent                                     | Confirmed: profile lacks field, startCombat conditions=[]; probe sapped disappears                                                                                                | CAP-01/05, CA-01; S01 c2; blocks truthful restrictions in next fight                                                                                                               |
| Low-level settlement is live-object-only                                           | Confirmed by character-profile.ts docs and clearing spend; wrapper must add atomic receipt                                                                                        | CAP-01/04, CA-02/04; S01 c4/c5 and S03 c3/c4                                                                                                                                       |
| Character ids remint; fight restore needs start balances/current positions/terrain | Confirmed writer/reader contracts; no demand to change legitimate legacy id projection                                                                                            | CA-01/02; S01 c3/c5 stable member map and full aggregate                                                                                                                           |
| useItem condition-duration display                                                 | Confirmed equipment.ts emits applyCondition before duration override                                                                                                              | CAP-01/06, CA-01; S01 c2; narration reads actual duration afterward                                                                                                                |
| R-GM-3                                                                             | Current walk skips first resumed leaving-reach check, including changed next threatener                                                                                           | CAP-05, CA-05; AR-05 + S04 c2; solo movement proof blocked until fixed                                                                                                             |
| F-M2/DD-M14 smaller reach override                                                 | Deliberately preserved max(reach, defaultReach), database.md spatial/range mapping                                                                                                | No correction; documented design, not inferred enum/type defect; S04 preview uses same rule                                                                                        |
| F-FP1/F-P3, F-P7, F-FP2/F-P5                                                       | Closed by builder-rulings max-level/any-class policy and class-features grants. Current progression.ts/features.ts and latest verification confirm; old reports don't reopen them | No new implementation; S03 consumes current rules                                                                                                                                  |
| CAP-F1 compiler malformed featSlots proof                                          | Optional proof was ad hoc only; assigned on this compiler touch                                                                                                                   | S02 c3 tests/compiler/coverage-floor.test.ts; does not block S01                                                                                                                   |
| F-R6, F-D8, old-location Runtime refusal                                           | Closed by class-features Author corrections and contract-conformance features.test.ts                                                                                             | No competing backlog; preserved historical ids                                                                                                                                     |
| C1/C2, C6, C11/C12/C14                                                             | Existing public matcher retained; table depth cross-pin; parsePackEffects removed; trigger/heal/comment corrections closed per source/arch                                        | No cleanup implementation; retained published APIs                                                                                                                                 |
| C3/C4/C7 surface candidates                                                        | No evidence removal needed for this feature; keep exports                                                                                                                         | Deferred to future surface review owner Architect, resume if a breaking-surface proposal is approved; no CAP blocked                                                               |
| spells.tagged load-time integrity, 12 damage(half) content sites                   | Existing documented semantics; tightening tags/content behavior needs separate Author decision                                                                                    | Deferred Spec/DB/content owner, resume on that approved change. Templates/narrator must report existing outcomes, never assume these spells deal damage; no auto-fix in this scope |
| Out-of-combat point-pool cast, item tags, optional feat-slot query                 | Not required to deliver requested loop: combat spells remain usable; preparation/items use current verbs                                                                          | Deferred future magic/equipment/progression owner on explicit scope; no dependent required CAP                                                                                     |
| Architect overview omissions; C-S01-1 spatial mock phase; api-map missing events   | Closed by committed architecture amendment d68f258 and DX 5b88826/5b92b52; C-S01-1 preserves saved phase precedence and api-map lists all three missing events                    | Protected source corrections supplied; S01/S02/S03/S04 docs checkpoints consume them and prove their own runnable examples                                                         |
| H-R1                                                                               | Compiler title portion assigned S02 c3; ci comments/step label portion S04 c5                                                                                                     | Existing finding retained; no separate bookkeeping session                                                                                                                         |
| README 'nine combat legs'                                                          | leg-8 is a character leg; preserve actual coverage and correct terminology                                                                                                        | S04 c5, docs-run owner same lease                                                                                                                                                  |
| B-BD-1                                                                             | Present-unverified Actions execution; earlier local results do not clear it                                                                                                       | Human push/release owner, then Orchestrator records actual matrix. No publishing in this plan; blocks CI acceptance only                                                           |
| DD-B3 Electron renderer                                                            | Browser engine + Electron Node do not prove renderer host                                                                                                                         | Deferred host integration owner upon renderer-specific report; no native app/renderer added here                                                                                   |
| C15/C16 internal/test export candidates                                            | Deferred as unrelated cleanup; retaining exports changes no behavior                                                                                                              | Owner next internal-surface/fixture maintenance session, resume when that cleanup is explicitly scoped; no CAP blocked                                                             |
| C10 item-tags restriction gate                                                     | Intentional forward-compatible no-op for untagged items, preserved                                                                                                                | Future item-tags Author decision; no CAP blocked, director/narrator cannot claim item tag restrictions exist                                                                       |
| H11 / C17 .program scratch lint                                                    | Avoided: all code probes/logs in /tmp, no scratch TS/JS in repo                                                                                                                   | Baseline operational constraint; future eslint owner only if config change requested                                                                                               |

Inspection limits: no remote Actions lookup or new clean install/browser/Electron run during planning; no claim about all historical raw run transcripts, unreferenced old handoffs or third-party hosts. Supplied Planner protocol is authoritative in conversation. Ignored installed role files were found at program-agents/{CODER,ORCHESTRATOR,AUTHOR,ARCHIVIST}.md; Author was read in full, Coder envelope/handoff and Orchestrator planning-completeness sections were inspected. Full execution-role reading remains the executing role’s startup duty. Source-backed counterevidence here narrows older 'lossless snapshot' claims to their tested subjects; CAP-01 implementation/proof remains planned and execution awaits review, not a new Author decision. Archived initial Author discovery and handoffs below remain verbatim historical evidence.

## Design Decisions

| ID    | Choice                                                                          | Rationale / authority                                                                                                                     |
| ----- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| DD-01 | Preserve Ruleswright root/casing and existing config                            | Authoritative config wins over initial generic kebab-case rule                                                                            |
| DD-02 | One feature run with four capability sessions                                   | All three requested modes share encounter, state and reward context                                                                       |
| DD-03 | Offline deterministic narration/enemy AI                                        | Approved FR-28/29 and AR-01 keep no-network constraints; no provider decision remains in this scope                                       |
| DD-04 | Separate adventure documents/templates; do not alter rules packs                | Narrow reversible additive surface, hand-authored packs remain viable, existing pack bytes unaffected                                     |
| DD-05 | Host supplies choices/persistence; library owns one aggregate                   | Required UI independence, zero I/O and replayable atomic saves                                                                            |
| DD-06 | Explicit data for XP, loot recipient, layouts and rest points                   | Rules are data; no invented difficulty balancing, XP-from-threat or hidden healing policy                                                 |
| DD-07 | Stable member ids separate from minted character ids                            | Preserves legacy restore contract while making session binding deterministic                                                              |
| DD-08 | Separate saved generation/play/combat/director streams                          | Rendering/read calls cannot perturb mechanics; use current core Rng                                                                       |
| DD-09 | Committed Author contracts are immutable; runtime maps remain provisional       | AR-01–06 through fcec34d plus F-RA-01 at 42bad60 are agreed; recheck actual producer checkpoints before downstream dispatch, never require own future tests at c0 |
| DD-10 | No player autoplay, networking, procedural prose model, publication or app UI   | Minimum meaning of the three offered scopes; new provider/UX/release work needs its own intent                                            |
| DD-11 | Existing terminal defeat and explicit abandon; no new death system              | Preserve HP<=0/down semantics; do not infer resurrection/injury rules                                                                     |
| DD-12 | Receipts guarantee one aggregate history, not external exactly-once persistence | No I/O or external concurrency authority exists; old save restores are branches                                                           |

## Verification Baseline

Initial-plan results below are inherited from c8e5260, not rerun results at this replan. Current base/contract digests and actual replan checks: EVIDENCE.md. Author rev2 receive at 310397c independently recorded typecheck/lint/format and 42 conformance tests green; that closes format/contract receipt only, not runtime capabilities. Latest inherited receive at `44fac85625db8eb62ebddb795018f1ee12a97c22` independently records typecheck/lint/format and conformance 42/42 green at 42bad60, six local schemas compiled, seven real assembler seed cases including `""` preserved through JSON, six nonstring negatives rejected and unchanged identity constraints. These checks closed the contract counterexample only; Planner did not rerun them and S01 aggregate continuation/S02 generated-output proofs remain future. Existing scripts/configs read: package.json, tsconfig.json, tsup.config.ts, vitest.config.ts, vitest.browser.config.ts, scripts/check-runtime-isolation.mjs, scripts/check-security-lint.mjs, .github/workflows/ci.yml, docs-run and existing dist journeys/oracle. No new future test is described as already passing.

| ID               | Effective command/configuration                                                                                                                                                                              | Plan evidence / scope / owner                                                                                                                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V-BUILD          | `pnpm build` → tsup, four entries, ESM/CJS/dts into ignored dist                                                                                                                                             | Inherited initial-plan exit 0 at c8e5260; shared build:dist lock. Before each built proof rebuild intended working revision and record git HEAD plus dirty diff hash and SHA256 of dist/runtime.js/.cjs, compiler.js/.cjs, schema.js/.cjs and declarations consumed by typecheck. Do not reuse an unowned/stale output |
| V-TYPE           | `pnpm typecheck` → tsc --noEmit                                                                                                                                                                              | Inherited initial-plan exit 0 after fresh c8e5260 build; tsconfig includes src/tests and strict ES2020                                                                                                                                                                                                                 |
| V-TARGET         | `pnpm exec vitest run tests/snapshots tests/runtime/encounter.test.ts tests/runtime/combat/character-profile.test.ts tests/proofs/contract-conformance.test.ts tests/proofs/combat-characterization.test.ts` | Inherited initial-plan exit 0: 7 files, 159 tests; logs copied into EVIDENCE summary. This does not prove lost-HP/conditions are fixed                                                                                                                                                                                 |
| V-ALL            | Fresh V-BUILD, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm check:isolation`, `pnpm check:security`                                                                                | Unexecuted as a full plan-time bundle; latest inherited 57 files/1017 Node tests plus fast gates at 07ba8c8. Each session owns and runs relevant gate changes; Orchestrator runs whole-repo fast gates at receives                                                                                                     |
| V-BROWSER        | `pnpm test:browser`; per-engine `pnpm exec vitest run --config vitest.browser.config.ts --browser.name=<engine>`                                                                                             | Existing Vite src harness, playwright provider, headless, screenshotFailures false; exclusive 63315. Inherited 74 tests per engine, not a current result. New browser glob tests collected automatically; S03 c4/S04 c4 own oracle additions                                                                           |
| V-ELECTRON       | `pnpm build` then `pnpm test:electron`                                                                                                                                                                       | Script runs electron/install.js then ELECTRON_RUN_AS_NODE and runtime identity guard. Inherited 1017 tests at 07ba8c8; not run now. May download host binary; environment failure owner Orchestrator/M05, required platform proof remains blocked                                                                      |
| V-CLEAN          | Frozen install, build, typecheck in node_modules-free copy under /private/tmp outside HOME; inspect tsc --listFiles for resolution escaping copy                                                             | Not run now (no dependency/CI implementation changed). Required S04 c5 because CI is touched. Never use tsc --preserveSymlinks; preserve source revision/copy identity                                                                                                                                                 |
| V-DOCS           | `pnpm exec vitest run tests/proofs/docs-run.test.ts`                                                                                                                                                         | Existing extraction joins exactly four ts blocks; source-path virtual TS resolution, stripped-import execution. Every session modifying README owns extractor+behavioral controls and must preserve old output assertions                                                                                              |
| V-ISOLATION-SELF | `pnpm exec vitest run tests/proofs/runtime-isolation-gate.test.ts`                                                                                                                                           | Planned S02 c3; currently absent. Gate modification and behavioral self-tests land together before relying on expanded isolation guarantee                                                                                                                                                                             |

Execution bounds: node unit/journey proofs 120-second outer process limit (terminate only that owned process on hang); docs suite 180 seconds (its existing typecheck case allows 60 seconds); builds 180 seconds; each browser engine and Electron 300 seconds with progress reported while tools run, never a single silent blocking wait. CI/clean installation can take longer; Orchestrator tracks progress and cancels only owned work when environmental failure is established. Commands run once per relevant change, not repeated to reconfirm recorded failures. Test loops are bounded and zero discovery is failure. Evidence lives in worker Handoff with logs in unique OS-temp dirs; Orchestrator preserves necessary details in STATE/FINAL-REPORT.

Standing hazards carried: H1 ignored prompt artifacts require explicit force-add by Orchestrator for archival; H2 await idle timeout is not crash; H3 pnpm test -- pattern does not filter; H4 dist tests/typecheck require fresh build; H5 characterization pins change only with explained behavior; H6 installs may need network (none requested by Planner); H7 preserveSymlinks is invalid proof under pnpm; H8 browser 63315 exclusive; H9 contracts never Coder-owned even for negative controls; H10 Author receive whole-repo gates; H11 eslint collects .program scratch; host type/bin lookup can escape repository. No known hanging test is recorded in inspected baseline; no broader uninspected history is claimed clear. B-BD-1 remains environment/release evidence debt.

Initial-plan runtime identities (recheck resolved tools at execution): Node `/Users/the.phoenix/.nvm/versions/node/v24.20.0/bin/node` v24.20.0; pnpm at same bin directory v10.15.0; repository `node_modules/.bin/vitest` v2.1.8, help inspected (run/config/browser/testTimeout/outputFile supported). There is no new external vendor CLI/daemon or protocol premise to probe. At execution, record browser/Electron resolved executables and versions from the actual installed builds, not global PATH assumptions. EVIDENCE records repository CLI wrapper resolution.

## Capability Readiness

| ID     | Approved behavior / entry point                                                                  | Required facts + producer owners                                                                                                            | CA IDs / prerequisites      | Integration owner / checkpoint                           | Status  | Proof / checked sources                              | Open gaps + correction owners                                                                     |
| ------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------- | ------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| CAP-01 | RA-01: random encounter session via createEncounterSession/dispatch/restore (planned public API) | Pack via Runtime; party snapshots and stable member ids; seed; explicit EncounterSetup; start balances; real battle and terminal settlement | CA-01/02; AR-01/02          | S01 c3 first narrow journey, c5 full encounter carryover | planned | Inherited V-TARGET; future encounter-session journey | Runtime HP/conditions/aggregate/receipt absent; S01 owns corrections, dispatch awaits B-RA-REVIEW |
| CAP-02 | RA-02: generate portable finite adventure via generateAdventure                                  | Template + effective Pack + seed; core Rng/table engine; S01 EncounterSetup; original template data                                         | CA-03; AR-01/03, S01        | S02 c2                                                   | planned | Future adventure-generation journey and schema tests | Graph producer/template validator absent; S02                                                     |
| CAP-03 | RA-03: choose/explore/fight/complete through createAdventure/dispatch                            | Definition graph, member ids, current revision/phase, actual session outcome                                                                | CA-02/03/04; AR-04, S01/S02 | S03 c2 early generated path, c4 full journey             | planned | Future adventure-journey through built API           | Dispatch/composition/state readers absent; S03                                                    |
| CAP-04 | RA-04: rewards/progression/preparation and whole save/reopen                                     | Explicit reward policy, actual roll, eligible member, original balances, receipt/revision, HP/resources, graph/RNG identity                 | CA-01/02/04; AR-04          | S03 c3/c4                                                | planned | Future rewards/snapshots/adventure journey           | Reward writer, atomic ledger and aggregate reader absent; S03                                     |
| CAP-05 | RA-05: advanceSolo automates enemies and yields player control                                   | Stored policy, current combat actor/side, legal candidates, pending offers, bound, saved director state                                     | CA-04/05; AR-05, S03        | S04 c3                                                   | planned | Future preview/director/solo journey                 | Preview/control absent; R-GM-3 needs correction S04 c2                                            |
| CAP-06 | RA-06: factual offline messages/text independent of UI                                           | Actual committed event sequence and rule/roll facts, authored templates, stable names, saved ack cursor                                     | CA-04/05; S03 journal       | S04 c4                                                   | planned | Future narration/solo journey/browser oracle         | Projection/cursor absent; S04; duration event prerequisite S01 c2                                 |

For CAP-01 action→command→service→facts→writer→restart is exactly the S01 session journey; no server or DB boundary applies. CAP-02 is a read-only compiler action with a JSON output, not a game-state mutation. CAP-03/04 persist every progress/reward transition through one aggregate; rest/prepare/use/equip and choices each have their actual writer named in S03, not merely a command count. CAP-05 must call the same real mutation path; CAP-06 reads that path's journal and only its explicit acknowledgement command mutates a cursor. Wrong identity/phase/revision/choice refuses before committed change in each aggregate API. Read-only views/narration do not draw randomness. Reopening requires the same effective pack and, for adventures, definition identity; hostile or stale payloads never partially mint members or consume resources.

First narrow journey: S01 c3 built package encounter → real combat action → JSON persistence → fresh facade continuation. It is not a UI-over-double/core-only combination. S01 c5 closes terminal carryover, then S03 c2 reuses it in a generated graph. S02 depends on EncounterSetup, S03 on the completed encounter proof/definition, S04 on adventure dispatch/journal proof. On counterevidence, mark only affected CA/CAP evidence stale, retain old results and block actual consumers.

## Contract Agreements

| ID    | Required meaning / authority                                                         | Producer → boundary → consumer                                                                  | Mapping / constraints                                                                                                | Correction + proof owners / checkpoints      | Agreement                              | Producer                                     | Proof / evidence / checked sources                         |
| ----- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| CA-01 | Character injury/conditions/identity survive encounters and saves; FR-5/7/14 + RA-01 | character state → character envelope/profile/start input → play session                         | Exact HP/temp; conditionId/duration ↔ id/remaining; explicit memberId separate from reminted char id                 | AR-02 supplied; S01 c1/c2/c3                 | agreed (fcec34d; replan v2 reconciled) | planned (runtime); contract ready at fcec34d | planned; runtime S01 c1/c2/c3; inherited probe in EVIDENCE |
| CA-02 | One encounter aggregate has complete restore inputs and atomic terminal settlement   | Combat state+start inputs → aggregate snapshot/receipt → reconstructed party and next encounter | Spend is not remaining balance; frozen current positions supplied to restore; side/member/receipt identities checked | S01 c3/c4/c5                                 | agreed (42bad60; F-RA-01 assertions assigned) | planned (runtime); contract ready at 42bad60 | planned; provisional against S01 c5                        |
| CA-03 | A portable finite definition preserves pack/template identity and authored meaning   | S02 generator → AdventureDefinition → S03 adventure runtime                                     | EncounterSetup from S01; graph refs, objective, policy and reward refs retain distinct meanings                      | AR-03 supplied; S02 c1/c2; S03 c2 play proof | agreed (42bad60; F-RA-01 assertions assigned) | planned (runtime); contract ready at 42bad60 | planned; provisional against S02 c2; recheck before S03    |
| CA-04 | Choice/reward/rest eligibility derives from saved authoritative state and definition | S03 dispatch/writers → aggregate revision/receipt/journal → views/restored adventure/director   | Exact node/reward/member ids, per-member XP vs class split, one saved roll/claim, no implicit heal                   | AR-04 supplied; S03 c2/c3/c4                 | agreed (fcec34d; replan v2 reconciled) | planned (runtime); contract ready at fcec34d | planned; provisional against S03 c4; recheck before S04    |
| CA-05 | Automated actions legal and bounded; narration factual and separately acknowledged   | Pure gates + committed adventure state/events → director/renderer → actual commands/messages    | Player control preserved; no-action/stalled not victory; negative damage means healing; cursor can't exceed journal  | AR-05 supplied; S04 c1–c4                    | agreed (fcec34d; replan v2 reconciled) | planned (runtime); contract ready at fcec34d | planned; provisional against S04 c3/c4                     |

The human approved AR-01–AR-06 and explicitly authorized execution. Author contracts landed through fcec34d, with only selection.seedUsed.minLength removed at 42bad60. Existing string-seed meaning is unchanged; this bounded F-RA-01 addendum assigns its explicit assertions in S01/S02 without reopening other contracts. Runtime producers and boundary proofs remain planned; Author schema conformance does not verify a capability.

### CA-01 — defect, map and assertions

Required behavior is persistent injury and restrictions. Current behavior reconstructs hp and starts an empty conditions list (probe in EVIDENCE). Correct both writer and start consumer, not only DTO shape. Map state.hp.current→saved.hp.current→state.hp.current exactly (signed integer), state.hp.temp likewise (bookkeeping only); legacy absent hp→existing reconstruction by explicit compatibility rule. Conditions map conditionId/duration to id/remaining and back; combat receives detached initial conditions and returns remaining durations. memberId owns stable campaign identity; current Character.id is an internal runtime binding. No DB/check/FK boundary exists; JSON Schema and runtime validation are the constraints. Sources: character.ts, snapshots/character.ts, profileFromCharacter, startCombat, equipment.ts.

Tests: S01 V-CHAR + V-ENCOUNTER; wounded/negative/above-max/temp, equip-derived cap, active restriction through real start, malformed input with nextCharacterId and events unchanged, two members restored under differing mint order. Inherited useItem duration finding is assigned S01 c2; narration cannot read inaccurate payloads and call them facts.

CA-01 exact authority: snapshots.schema.json optional characterState.hp and play-session.schema.json member/startEntry/initialCondition. New aggregate members require hp/pools/slots; standalone legacy omission alone uses old reconstruction. S01 **Committed AR-02 map** owns exact profile/balance/condition projection and identity namespace; c1/c2/c3 tests prove each. All new numeric counters are safe; signed HP is preserved without clamp. No new Author gate.

### CA-02 — transaction/restore maps and assertions

assembleEncounter groups/threat are encounter facts, not XP; spawnEncounter instance ids must be safely namespaced by the wrapper. Require finite positive budget/affordable encounter. Start profiles/balances/bindings are retained before spend, while itemsUsed/poolsSpent/slotsCast are deltas; never subtract from already-debited current characters. slotsUsed in the legacy combat envelope is the remaining ledger, not a spend delta. Saved current position→restore.positions; terrain re-stated from aggregate. Combat hp/conditions→settled member; spend+party changes+receipt commit together. Receipt is scoped to the whole aggregate history, no claim of external global exactly-once storage.

Tests: S01 c3/c5 encounter-session journey, c4 session tests and conformance; first/middle/terminal restore, open offers, multi-member failed settlement atomicity, duplicate finalize after reopen, stale/foreign receipts and no-change RNG/events. Source ready implementations are legacy combat writers; new aggregate mapping is provisional, not assumed committed.

CA-02 exact mapping: S01 **Committed AR-02 map and proof allocation** enumerates all root/encounter/start/raw/control/journal/receipt fields, exact namespaces, hash and seed domains and every command/result/view. sourceHash=H({pack,encounter}); raw combat retains pre-settlement spend; current member baseline remains entryMembers until commit. S01 c4 owns **active abandonment adapter** because existing helpers refuse nonterminal combat; c5 owns terminal predicates, current receipt projection, legacy and next-after-victory rejection. Wrong/stale idempotent requests refuse before receipt lookup. S03 is blocked on this real producer/proof, not on missing Author work.

F-RA-01 / CA-02: the contract counterexample is **closed at 42bad60**; setup.seed admits `""`, real `assembleEncounter` returns `selection.seedUsed === ""` (`src/runtime/encounter.ts:55,87`), and the authoritative serialized string domain now accepts it. S01 c3 owns actual empty-seed aggregate/conformance and fresh exported-library JSON reopen with identical next-command continuation; c5 extends through settlement/next and malformed nonstring controls. Exact leased paths: `tests/runtime/play/fixtures.ts`, `tests/runtime/play/session.test.ts`, `tests/snapshots/play-session.test.ts`, `tests/proofs/encounter-session-journey.test.ts`, `tests/proofs/contract-conformance.test.ts`. Producer/proof remain planned; S02/S03 depend on the actual S01 producer/proof, and all dispatch still awaits Orchestrator’s scoped D3/D5 recheck.

### CA-03 — generated values and boundaries

Template id/version + packContentHash effective pack + seed → definition provenance; definition digest excludes itself. Node id/choice id/reward id are separate subjects; terminal objective is not inferred from running out of content. A lookup value is not automatically loot; reward table semantics are explicit. Compilers never instantiate Runtime; runtime never imports template compiler. Core rollTable is shared; schema stays core-free. Validation is structural+semantic and bounded; all referenced content/graph edges and supported layouts must fit. No database applies.

Tests: S02 schema/adventure, compiler/adventure and built generation journey; golden repeatability, multiple seed alternatives, hand-authored pack compatibility, invalid refs/graphs/layouts with exact errors. S03 c2 proves the generated encounter is consumed through production code. Until that checkpoint, generator output is usable authoring data but not proof of playable adventure parity.

CA-03 exact mapping: S02 **Committed AR-03 map and proof allocation** is the authoritative plan mapping for all template/definition/start-option/identity, graph/weight/ref, reward/director/narration fields. Loader is loadAdventureTemplate(id,pack), static recipe omits only pack, generation refuses foreign binding. c2 owns deterministic base/branch draw and output order, definition digest/seed, all three original recipes and generated-output conformance (lease added v2). S03 consumes actual generated definition after Orchestrator rechecks S02 c2 against this CA; S04 consumes the stored policy/narration after S03.

F-RA-01 / CA-03: S02 c1 owns explicit empty encounter-setup seed acceptance and authoritative template/definition conformance in `tests/schema/adventure.test.ts` and `tests/proofs/contract-conformance.test.ts`. S02 c2 owns preservation through real generated definitions and detached JSON with unchanged hash/exact seed in `tests/compiler/adventure.test.ts`, `tests/proofs/adventure-generation-journey.test.ts` and conformance. Fixtures stay in those leased tests; no generation-seed substitution or compiler→runtime dependency. These proofs are future, provisional against S02 c2, and remain prerequisites for S03’s generated-definition consumer.

### CA-04 — authority, persistence and adversarial cases

Definition policy + aggregate current node/phase/revision/party membership determine actions. Requested choice/recipient/XP is not authority. Node reward contains the authoritative XP amount; command cannot override it. Core table roll is staged once, stored as actual grant/flavor result, and claimed with real awardXp/grantItem writes. Two same-session rewards must have distinct receipt identities; one claim cannot clear another. Old expectedRevision cannot authorize a fresh mutation. No expiry/time policy is invented: authority is revision/state-based, not clock-based.

Tests: S03 rewards and adventure snapshots/journey; swapped member/node/reward, out-of-phase action, impossible complete/pending combination, tampered pack/definition digest, repeated claims, failed second recipient, pure available-choice reads and resume of stored pending roll. Close/reopen reconstructs classes/classXp/inventory/HP and journal, not just a success event.

CA-04 exact mapping: S03 **Committed AR-04 map, composition and proofs** binds every command (including complete nested encounter command with independent revision), view, required snapshot field, exact member/node/claim/receipt subject, RNG endpoint and journal/cursor predicate. S03 c2 now owns roll staging **in the same transaction** as victory/node resolution; c3 owns claim and rest/prepare/equipment/item writers, avoiding a temporary unowned reward-staging seam. c4 owns full reopen proofs and phase/reward/receipt validation.

B-RA-XP is closed at fcec34d by approved FR-26/27, not awaiting a human. S03 c3/c4 implements/tests real staged positive awardXp, skips zero, preserves exact current/temp HP and old bindings at identical levels/indices, leaves new capacity null, retains real XP/split/caps/levels/saves and resource continuity; incompatible preparation or later-member failure rejects all members/receipt/revision/RNG/journal while retaining the saved pending roll. Required no-level/level-up/control/reopen assertions are in the S03 map; S04 solo consumes that same writer and cannot waive these proofs. Low-level progression stays unchanged.

### CA-05 — legal control and truthful narration

Preview uses the same production gates as declare; candidates are bounded, guard results side-effect-free. Director executes actual commands, preserves player-owned turns/offers and returns bounded yield reasons. R-GM-3 correction must enforce the actual replanned departure. Committed pendingMove.offeredDepartures stores {from,to,reactorId} records when pausing; snapshots copy/validate them and resume suppresses only recorded departure tuples. AR-05 supplied the immutable schema/legacy meaning; S04 c2 owns types, writer/reader, movement consumers, exact-shape tests and permitted oracle deltas together. Narration uses committed event sequence and rule/roll provenance; templates never decide mechanics. Structured facts remain available even if optional prose projects several facts into one line; never invert prose into state. Saved ack cursor is monotonic within available sequence, no read-time mutation or RNG draw. No provider/permission/expiry boundaries apply.

Tests: S04 preview/director/narration, movement regression, built solo journey and shared browser oracle; rejected illegal actor/action, restricted/no-resources, zero-damage stalemate, pending player offer, different maxSteps partitioning, pause/reopen equality, healing text, unknown event fallback and no duplicate acknowledged messages. All planned until executed.

CA-05 exact mapping: S04 **Committed AR-05 API, policy state and proof allocation** owns actual policy fields, seven yields including abandoned, saved decisions/stalledSteps/lastMechanicalHash, complete departure-tuple semantics and explicit absent-versus-empty legacy fallback. c1 owns pure shared legality and bounded candidates, c2 movement restart, c3 persisted director and c4 factual messages/ack. Message ids are JSON.stringify([adventureId,sequence]); ack increments revision/cursor only, no journal event, including terminal ack. S03 initializes required director/cursor fields at c1; S04 implements their consuming writers. Its shared fixtures and candidate assertions are in the v2 lease.

## Current Blockers

| ID          | Affected                          | Next action / owner                                                                                                      | Evidence to clear                                                                                                     |
| ----------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| B-BD-1      | CI acceptance only, carried       | Human publication/push owner; Orchestrator later records actual Actions and assigns mechanical repair if needed          | Relevant Node 18/20/22, package, browser and Electron runs at implemented revision; no agent publish/push to clear it |

B-RA-AUTHOR is **closed**: approval and all eight Author commits through fcec34d received; exact mappings reconciled in replan v2; F-RA-01 follow-on contract correction is closed at 42bad60 and its assertion reconciliation is complete here. S01 c3/c5 and S02 c1/c2 still owe runtime/generated-output proofs. B-RA-DX is **closed as a source prerequisite** at 5b88826/5b92b52; each Coder still owns its docs/extractor proof. B-RA-XP and Author formatting are **closed at fcec34d**; preserving adapter and proof obligations remain S03 c3/c4, with dependent S04 blocked until those actual proofs are current. No unresolved Contract Agreement/product choice is known within this bounded comparison. Runtime producers/proofs remain planned; review is not runtime verification.

No live Coder/Author/Archivist worker or pending receive is reported at base. Scratch ledger/blocker/decision text contains older startup claims plus later accepted receipts; the canonical current sections here supersede those stale summaries without editing their history. Orchestrator must regenerate scratch summaries before dispatch. Prior Author discovery and all raw Handoff Notes below are preserved byte-for-byte. Config/arch/specs/mocks/contracts and implementation remain outside this replan write lease.

## Planning Handoff — D1–D7 (advisory, not a score)

D1: Approved requirements.md FR-24..29 map respectively to CAP-01..06 and S01/S02/S03/S04. The inherited findings table retains original IDs/dispositions; B-RA-XP is now the approved S03 c3/c4 adapter, and B-BD-1 remains carried CI debt.

D2: S01's committed-map section names original/current profiles, identities, streams, journal and receipt writers; S02's map names exact template/graph/weight/policy producers. S03 maps rolls, claims and authoritative member state; S04 maps actual policy/no-progress state, event-time subjects and ack, not just DTOs.

D3: S01 c4 owns abandonment settlement; S03 c2 owns transition-time roll staging and c3/c4 owns preservation/atomicity/reopen; S04 c2/c3/c4 owns departure/director/narration proofs. Completed Author contracts are separated from these planned runtime producers; Orchestrator owns review and carried platform evidence. F-RA-01 protected correction landed at 42bad60; S01 c3/c5 and S02 c1/c2 now explicitly own the remaining seed proofs. D3 recheck is still Orchestrator-routed, not self-cleared.

D4: Each Files table/front-matter Owns/STATE row equals lease-manifest v2. S02 adds conformance ownership; S04 adds its actual fixture/candidate paths plus triggers.ts and both reaction regression suites. All four waves are serial; build:dist and browser:63315 are exclusive resources, not force-added source leases.

D5: S02 consumes S01's actual EncounterSetup validator; S03 consumes completed encounter/settlement and generated definitions; S04 consumes adventure dispatch, preserving reward writer and journal. Mapping rechecks occur at S01 c5/S02 c2/S03 c4 before dependent dispatch; own future tests are not prerequisites. F-RA-01’s contract input now accepts the real empty seed output at 42bad60; generated setup preservation and aggregate continuation remain planned owner proofs. Orchestrator routes the scoped D5 recheck before dispatch.

D6: S01 c3 remains the first usable journey through fresh dist/runtime.js, real combat and detached JSON reopen; c5 adds next-fight carryover. S03 c2/c4 and S04 c3/c4 integrate later columns. Browser Vite source evidence is distinct from built ESM/CJS and no UI/backend transport is invented.

D7: Every new public shape family has a producer/proof row in EVIDENCE and exact consuming path in its session. S03 roll staging is moved forward to c2 so node transitions cannot outrun the producer; S03 initializes required director state at c1 and S04 supplies its consumer. These are planned assignments, not verified runtime behavior or an Archivist verdict.

## REPLAN-RA-CONTRACTS revision 2 batch

Four sessions and 19 checkpoints retained (6/3/5/5). No new bookkeeping session. Sequential splits follow actual EncounterSetup/session, generated-definition and adventure-dispatch/journal dependencies; no new context-ceiling split. c2 roll staging in S03 is a necessary in-session producer amendment; c3 retains claim mutation/preservation, c4 reopen. S04 c1 also owns triggers.ts and spatial/feat trigger regressions: pure enemy take decisions must share the actual response guards while preserving feat-only semantics and legacy offer removal. Exact leases: 27/17/18/35 paths; see manifest amendments. New S02 conformance and S04 fixture/candidate/reactive-guard pins are mechanical ownership corrections within approved behavior. First dispatch still awaits scoped Archivist review; producer/proof status is planned, not passing parity.

## Orchestration Startup — 2026-10-16

User instruction: “start”. This authorizes orchestration execution; AR-01–06 product/schema/design amendments are awaiting the concrete approval requested in this conversation. No Author receipt has landed and no implementation worker has been dispatched.

- Run selected: random-adventures, latest plan commit `fc75b71a333e00d31155ab6952c71da70908b9f0`; implementation source remains plan base `c8e526047b8186d35710965d5f210f858ab232a3`.
- Binding: Native, discovered in the full tool registry: `mcp__demiurge__spawn_subagent` / `mcp__demiurge__await_subagent_result`. Concurrency cap 3; no active handles or leases.
- All four session front matters read. Exact path intersections agree with the four serial waves; no claimed concurrent pair needs correction. Shared README, docs proof and other composition paths preclude concurrent execution.
- Gate wrapper/discovery inspection agrees with the recorded baseline: build before dist proofs/typecheck; Node glob excludes browser tests; browser glob includes future adventure tests; browser:63315 and build:dist are exclusive resources. No new executable proof result is claimed at this boundary.
- B-RA-AUTHOR remains blocking S01 and all downstream sessions. Human asked to approve the concrete AR-01–06 packet and deliberate Author re-entry, including compatibility and reward/rest/solo meaning. Alternatives rejected: auto-spawning protected Author roles or treating draft contracts as ready. Existing request to plan all three remains settled.
- B-RA-REVIEW remains pending: scoped Archivist D1–D7 review follows committed Author receipts and prompt/CA reconciliation, before affected Coder dispatch. No review score or readiness claim is fabricated.
- B-RA-DX remains scoped to documentation checkpoints; B-BD-1 remains carried CI evidence debt with the human publication owner.
- Next action: receive human disposition, route the approved protected revisions through deliberate Author re-entry, reconcile exact receipts, then complete preflight/review and dispatch S01. This is a paused run, not completion; no FINAL-REPORT or end_run has been issued.

## Authorization Receipt — 2026-10-16 resume

User response, verbatim: “start”.

Context: this response follows the concrete request to approve AR-01–AR-06 in AUTHOR-HANDOFF.md and authorize Author re-entry. Orchestrator interprets it as approval of that presented packet and re-entry, not merely a repetition of the earlier planning request. No further approval of the same packet is requested.

Current disposition supersedes the earlier startup approval blocker: B-RA-AUTHOR is **approved, awaiting committed Author receipt**. Source remains `a8f44884f9df523c69db1775709af40c5558174f`; no implementation or protected Author artifact changed. No worker launched, no live handle, no reserved lease, no pending receive. Native binding re-confirmed; cap 3; W1 S01 → W2 S02 → W3 S03 → W4 S04.

The supplied Orchestrator protocol says “Does not dispatch a Spec worker, or any worker that writes requirements.md, architecture.md, or database.md.” AUTHOR.md, Author Re-entry, says “Spec is never spawned” and requires the builder to start a separate Author session. Therefore Orchestrator cannot turn this approval into an automatic protected-author worker. This is an owner/role transition, not a renewed product approval or an implementation failure. Alternatives rejected: spawning a disguised owner-correction worker, writing protected contracts as Orchestrator, or dispatching S01 against draft schemas.

### Ready-to-use Author handoff

Read `program-agents/AUTHOR.md`. Perform deliberate Author re-entry for `program/Ruleswright/prompts/random-adventures/AUTHOR-HANDOFF.md`, AR-01–AR-06. The builder answered “start” to the concrete approval and re-entry request; that approval is recorded above and must not be requested again for the same scope. Preserve approved semantics and compatibility. Follow the relevant role phases for requirements, developer design, architecture and schema; keep implementation source/tests outside this Author work. Read `program/Ruleswright/PROGRAM-CONFIG.MD`, existing Author sources, and the packet's evidence references. Commit exact owned paths using explicit pathspecs; preserve unrelated work. Return commit IDs, exact paths, approved references, compatibility notes, verification and structured R1–R4 deviations (or “not a deviation”). Route genuinely new product decisions to the builder.

After receipts land, Orchestrator reconciles every affected CA/session assumption, requests the scoped Archivist D1–D7 review against exact plan/source revisions, refreshes the ledger and dispatches S01. CAP/CA producer and proof readiness remain blocked/planned until their actual evidence lands. No FINAL-REPORT or end_run is issued at this paused boundary.

## Handoff Notes

## Explicit Author Execution Authorization — 2026-10-16

User response, verbatim: “i authorize it”. This follows the explanation that a separate Author session is required. The builder explicitly authorizes initiating that scoped re-entry now, in addition to the already approved AR-01–AR-06 meanings. This supersedes the prior procedural pause and no-spawn restriction for this single deliberate Author session; it is not standing authority to invent product changes. No repeat approval is needed. Orchestrator remains scheduler and writes no implementation.

B-RA-AUTHOR: authorized Author re-entry being dispatched with exact protected paths from AUTHOR-HANDOFF, at base `470a777`. Implementation remains unready until committed receipts, reconciliation and planning-completeness review. No active implementation lease exists. Binding Native; cap 3; S01 → S02 → S03 → S04 unchanged. The alternative of asking the builder to restate authorization is rejected because the explicit authorization is now present.

## Author Receive — 2026-10-16, source 05dff11

Native h-4vGo / AvKBh ended normally (endedBy end_turn), raw reply saved verbatim in .program/results/AUTHOR-RANDOM-ADVENTURES.result.md. Declared-blocked, seven phase/correction commits: 6af52f1, 0686be0, 5b88826, d68f258, 5b92b52, 164a0c9, 05dff11. All 16 changed paths are within the exact Author write set; no lease violation. Clean working tree; no residual. Architecture fragment inapplicable to Author contract receipt. No implementation checkpoint accepted.

Orchestrator independently ran fresh pnpm build (0), pnpm typecheck (0), pnpm lint (0), contract-conformance --cache=false (0; 1 file, 42 tests), git diff --check (0). pnpm format:check returned 1 solely for src/schema/contracts/snapshots.schema.json, introduced by Author, assigned to the same Author correction. Pack/override diff empty. Browser and full suite not rerun at this receive; Author visual checks are self-reported.

B-RA-XP disposition: source-backed side effect in progression.ts applyProgression resets current HP and bindings. The approved AR-01/04 and FR-26/27 already require injury/resource continuity and explicit rest/preparation; retaining automatic heal/clear would change those approved semantics. Standing authority selects the narrow adapter preserving exact HP/temp and existing bindings around awardXp in adventure rewards, retaining its XP/class split/caps/level calculation and low-level behavior. Newly gained capacity remains empty; incompatible capacity refuses atomically rather than discarding preparation. No new product choice is made. Author's reported R4 is preserved below; Orchestrator classifies resolution as fixed-contract adaptation, not a new human approval. Protected documentation clarification stays with returned Author. Implementation/proof owner S03 c3/c4; CA-04/CAP-04 and dependent solo capabilities remain unready until contract reconciliation and actual proof.

Current receipt is fully reconciled as declared-blocked with named corrections, not done. B-RA-AUTHOR is contracts-landed/correction-pending; B-RA-DX source supplied; B-RA-REVIEW awaits Planner reconciliation. All producer implementations and CAP proofs remain planned/blocked. The seven Author commits do not establish runtime readiness.

### Author Handoff — verbatim (classification above is Orchestrator's)

## Handoff

```yaml
session: AUTHOR-RANDOM-ADVENTURES
status: blocked
checkpoints:
  idea: committed
  requirements: committed
  design: committed
  architecture: committed
  database: committed; positive-XP semantics unresolved
filesTouched:
  - program/Ruleswright/specs/idea.md
  - program/Ruleswright/specs/requirements.md
  - program/Ruleswright/specs/design.md
  - program/Ruleswright/specs/architecture.md
  - program/Ruleswright/specs/database.md
  - program/Ruleswright/mocks/random-encounters.html
  - program/Ruleswright/mocks/random-adventures.html
  - program/Ruleswright/mocks/solo-director.html
  - program/Ruleswright/mocks/snapshots.html
  - program/Ruleswright/mocks/api-map.html
  - program/Ruleswright/mocks/combat-loop.html
  - program/Ruleswright/mocks/spatial.html
  - src/schema/contracts/snapshots.schema.json
  - src/schema/contracts/play-session.schema.json
  - src/schema/contracts/adventure.schema.json
  - src/schema/contracts/adventure-snapshot.schema.json
verification:
  schemaCompilationAndReferences: passed
  structuralCompatibilityAssertions: 26 passed
  existingContractConformance: 42 passed
  commitScopeAndWhitespace: passed
  worktree: clean
notes: Contracts supplied only; no runtime implementation or readiness claim.
surprises:
  - Positive awardXp resets HP and prepared bindings even without leveling.
  - Static adventure recipes require explicit effective-pack binding.
followUp:
  - Resolve B-RA-XP, then reconcile its dependent Author contracts.
  - Planner/Orchestrator must reconcile all SESSION and CA mappings.
  - Run receive gates and planning-completeness review before dependent dispatch.
  - Runtime producer, restart and cross-platform proofs remain with S01–S04.
deviations:
  - rule: R4
    id: B-RA-XP
    meaning: Positive-reward injury/binding policy requires builder decision.
    action: Recorded blocker; no runtime or speculative policy change.
  - classification: not a deviation
    meaning: Explicit template binding and exact schema spelling refine the approved packet.
```

## Author Revision 2 Receive — 2026-10-16

Accepted contract correction fcec34d, one commit on exactly four authorized paths. Native h-IiAH/Ar5xi ended normally; raw final saved verbatim to .program/results/AUTHOR-RANDOM-ADVENTURES.rev2.result.md. No residual, lease violation or arch fragment. Independently reran typecheck/lint/format:check (all exit 0), contract-conformance (1 file, 42 tests, exit 0); prior fresh build remains valid because correction changed only docs/JSON formatting. Diff whitespace clean. Author's semantic-equality/schema compile checks are reported evidence, not runtime proof. No Coder checkpoint accepted.

B-RA-XP product-decision gate is closed by fcec34d; fixed-contract implementation/proof belongs to S03 c3/c4. Formatting gate closed. Author prerequisite source is ready; B-RA-AUTHOR now tracks plan reconciliation, not missing authorization or contracts. B-RA-DX source ready at 5b88826/5b92b52; docs implementation proofs future. CA-01..05 contract producers landed at 05dff11/fcec34d; runtime producers/proofs and CAP-01..06 remain unverified. Next owner is bounded Planner reconciliation, then scoped Archivist D1–D7. No workers or pending receives remain at this boundary.

### Author Revision 2 Handoff — verbatim

## Handoff

```yaml
session: AUTHOR-RANDOM-ADVENTURES
leaseRevision: 2
status: done
base: 5bba00770f031972009d36a703361f4b79320ed3
commit: fcec34d28f51f91c931e544d09d1a12f2423b0a9
checkpoints:
  requirements: FR-27 preservation contract clarified
  architecture: staged adapter and proof ownership clarified
  database: reward write/readback and discovery disposition corrected
  formatting: snapshot formatting corrected without semantic change
filesTouched:
  - program/Ruleswright/specs/requirements.md
  - program/Ruleswright/specs/architecture.md
  - program/Ruleswright/specs/database.md
  - src/schema/contracts/snapshots.schema.json
verification:
  formatCheck: exit 0
  contractConformance: 42/42; exit 0
  schemaCompilationAndReferences: six passed
  snapshotSemanticEquality: passed against base
  commitScopeAndWhitespace: passed
  worktree: clean
notes:
  - AR-01/04 and FR-26/27 supply existing approval.
  - Schema shapes, versions, legacy fallbacks and low-level APIs unchanged.
  - Contract correction only; runtime readiness remains unproven.
surprises:
  - No new discoveries.
  - Prior awardXp HP/binding reset discovery retained as factual history.
followUp:
  - Reconcile S03 c3/c4 and CA-04/CAP-04 with the preservation adapter.
  - Remove the B-RA-XP product-decision gate; retain implementation/proof gates.
  - S03 owns no-level, level-up, incompatible-capacity, multi-member-failure and reopen assertions.
  - Dependent solo reward paths consume the same contract.
  - Prior Planner reconciliation and receive/review obligations remain.
deviations:
  - classification: not a deviation
    id: B-RA-XP
    disposition: Prior R4 classification superseded by approved continuity; fixed-contract adaptation.
```

## Replan Receive — 2026-10-16

Accepted REPLAN-RA-CONTRACTS commit 6ec316f; Native h-suAI/P3eez ended normally. Raw final saved verbatim in .program/results/REPLAN-RA-CONTRACTS.result.md. One commit touches only eight authorized planning files; no source/Author/arch changes, residual or lease violation. Owns/File tables/manifest match exactly at 27/17/18/35 paths. Historical suffix beginning Orchestration Startup is byte-identical to base310397c. Independently reran typecheck, lint, format:check, git diff --check: all exit0. No runtime test rerun for plan-only edits; prior source gates remain at fcec34d. No implementation checkpoint/proof accepted. Arch fragment inapplicable.

Contract inputs and current blockers reconciled by replan v2. B-RA-AUTHOR/B-RA-DX/B-RA-XP are source-prerequisite closed; B-RA-REVIEW remains pending. S01 blocked only on review; S02–04 pending dependencies. CAP-01..06 implementations/proofs remain planned. No active worker or pending receive at this quiet boundary; next scoped Archivist D1–D7 against plan6ec316f and sourcefcec34d.

### Replan Handoff — verbatim

## Handoff

**Task:** REPLAN-RA-CONTRACTS  
**Commit:** `6ec316fb7c349cac82e9ba4fb6ae6894e5745953`  
**Base:** `310397c4d1825d9163a5797addd73bc6d1f912d1`  
**Implementation source:** `c8e5260`; **Author contracts:** through `fcec34d`.

**Mapped contracts and due proofs:**

| Session | Reconciled obligations | Proof owner |
|---|---|---|
| S01 | Exact snapshot/identity/RNG mappings, turn control, original/current inputs, abandonment settlement | c1–c5; first exported-library journey remains c3 |
| S02 | Explicit template binding, graph construction, weights, references, policy/narration fields | c1/c2 |
| S03 | Nested revisions, reward identities/streams, real awardXp preservation, atomic failures, terminal/reopen predicates | c2 roll staging; c3 claims; c4 reopen |
| S04 | Departure history/legacy fallback, shared reaction legality, persisted director state, abandoned yield, acknowledgement without journal events | c1–c4 |

**Lease amendments:** S02 adds `tests/proofs/contract-conformance.test.ts`. S04 adds shared adventure fixtures, encounter-session assertions, `combat/triggers.ts`, and spatial/feat trigger regression suites. Exact lease counts are **27/17/18/35**, synchronized across all records.

**Granularity:** Four sessions, **19 checkpoints (6/3/5/5)**, serialized **S01 → S02 → S03 → S04**. No new sessions. S03 reward staging moves to c2 because settlement must publish pending rewards atomically.

**filesTouched:**

```text
program/Ruleswright/prompts/random-adventures/MASTER.md
program/Ruleswright/prompts/random-adventures/STATE.md
program/Ruleswright/prompts/random-adventures/SESSION-01.md
program/Ruleswright/prompts/random-adventures/SESSION-02.md
program/Ruleswright/prompts/random-adventures/SESSION-03.md
program/Ruleswright/prompts/random-adventures/SESSION-04.md
program/Ruleswright/prompts/random-adventures/lease-manifest.json
program/Ruleswright/prompts/random-adventures/EVIDENCE.md
```

**Verification/checks:** Six schemas compiled locally; lease/table/manifest/STATE agreement, checkpoint counts, serialized overlaps, file actions, test ownership, input digests, formatting and `git diff --check` checked. Committed historical STATE suffix is byte-identical to base. Working tree clean. No implementation tests or source changes.

**Notes/surprises:** Terminal-only settlement helpers require the abandonment adapter. Positive awardXp resets HP/preparation even without leveling; **B-RA-XP is closed**, with preservation implementation/proofs retained in S03. Protected Author outputs and raw handoffs remain unchanged.

**followUp:** Orchestrator refreshes stale scratch summaries and requests scoped Archivist planning-completeness review before dispatch. D1–D7 remain advisory, unscored. B-BD-1 remains carried CI evidence debt; no push/publication performed.

**status: done** — bounded replan committed; implementation has not begun.

## Planning Completeness Receive — 2026-10-16

ARCH-PRE Native h-Mfjr/A7b_5 ended normally, read-only, HEAD unchanged cecb10e and clean tree. Raw result preserved in .program/results/ARCH-PRE-RANDOM-ADVENTURES.result.md and appended to archivist-notes. No arch delta, commit, residual or lease violation. No fast gates rerun for read-only review; last replan receipt type/lint/format all green. Review is not runtime proof.

Plan6ec316f, sourcefcec34d, runtimebasec8e5260: D1 pass, D2 pass, D3 fail, D4 pass, D5 fail, D6 pass, D7 pass, cited table below. F-RA-01 confirmed in play-session.schema.json: seed accepts empty string while selection.seedUsed minLength1 contradicts canonical String(setup.seed) and actual assembler. Affect CA02/03, CAP01/02, all waves transitively. Author/DB correction owns only seedUsed domain compatibility (remove nonempty restriction; preserve other identifiers); Planner adds specific S01 conformance/reopen and S02 generated-definition assertions. No new product meaning, no changed implementation lease needed. Until scoped recheck, B-RA-REVIEW blocks dispatch. All other review passes retained against their source references.

## Archivist Note

- **role:** archivist
- **mode:** planning-completeness
- **registryUpdated:** false
- **reconciled:** []
- **conventionsAdded:** []
- **logEntry:** Read-only review returned below; no files edited or committed.

**Reviewed revisions**

- Plan revision 2: `6ec316fb7c349cac82e9ba4fb6ae6894e5745953`
- STATE receipt: `cecb10e5eb640db6f35ad8ea2db2a33a10112773`
- Author contracts: `fcec34d28f51f91c931e544d09d1a12f2423b0a9`
- Runtime implementation: `c8e526047b8186d35710965d5f210f858ab232a3`

Below, `P` means `program/Ruleswright/prompts/random-adventures/`.

| # | Dimension | Verdict | Cited evidence |
|---|-----------|---------|----------------|
| D1 | requirement coverage | pass | `specs/requirements.md:244–291` maps FR-24–29 to CAP-01–06; `P/STATE.md` Scope Summary and Capability Readiness assign S01/S02/S03/S04. |
| D2 | fact origins | pass | `P/SESSION-01.md:43`, S02 **Committed AR-03 map**, S03 **Committed AR-04 map**, S04 **Committed AR-05 API** name identity, policy, revision, stream, journal, receipt and restore producers. Implementations remain planned. |
| D3 | ownership | fail | F-RA-01 has no assigned protected-contract correction checkpoint. `P/STATE.md` closes Author prerequisites, while S01 cannot amend `src/schema/contracts/play-session.schema.json`. |
| D4 | lease coverage | pass | Read-only comparison found front matter, Files tables, manifest and STATE identical: **27/17/18/35 paths**, **6/3/5/5 checkpoints**. `P/MASTER.md` serializes every shared path. The F-RA-01 correction requires separate Author ownership, not widened Coder authority. |
| D5 | declared vs real dependencies | fail | Accepted `encounterSetup.seed` can produce a selection rejected by its required serialized contract: `play-session.schema.json:24,139,482`; `src/runtime/encounter.ts:55,87`; `P/SESSION-01.md:51`. |
| D6 | early integration | pass | `P/SESSION-01.md` c3 and Verification own fresh built ESM/CJS → real combat → detached JSON → fresh facade continuation before downstream fan-out. `package.json` exports identify the actual library transport. |
| D7 | runtime wiring | pass | S01 c3/c4, S03 c2/c3 and S04 c3/c4 explicitly compose the new interfaces with production writers and consumers. S03 initializes required director/cursor state before S04 consumes it. This scores planned wiring, not implemented capability. |

**Consolidated finding — F-RA-01: accepted empty setup seed cannot produce a conforming save**

- **Affected:** CA-02/03, CAP-01/02 directly; CAP-03–06 through their encounter dependency.
- **Conflict:** The seed definition accepts `""`. Database canonicalization requires `String(setup.seed)` unchanged as `selection.seedUsed` (`specs/database.md:1021–1027`), copied into `P/SESSION-01.md:51`. But `play-session.schema.json:482–484` requires `seedUsed.minLength: 1`.
- **Observed:** Local Ajv accepted the empty seed and setup shape, then rejected selection at `/seedUsed` with `minLength`. A bounded real assembler probe using dark-fantasy, budget 2 and seed `""` produced two hill-spiders and `seedUsed:""`; that output failed the same constraint. Runtime/compiler artifact hashes matched EVIDENCE’s recorded c8e5260 artifacts.
- **Owner/route:** Orchestrator routes a bounded **Author/DB contract correction**, followed by Planner reconciliation of S01’s seed mapping and CA-02/03. Align the serialized field with the already accepted string-seed domain; do not silently substitute a seed or leave consumers to rediscover this at c0.
- **Closing assertion:** S01’s leased conformance and encounter-journey tests accept an empty setup seed, preserve its exact selection value, and prove JSON reopen produces identical continuation. S02 tests retain that setup through generated definitions.
- **Affected waves:** W1’s setup/serialization contract and W2–W4 transitively. Unrelated work is unaffected. This is a contract-consistency correction, not a renewed scope or XP-policy question.

**Verified dispositions and proof infrastructure**

B-RA-XP is correctly closed: S03 c3/c4 owns real positive `awardXp`, preservation, incompatible-capacity/later-member refusal and reopen proofs. S01 c4 explicitly owns active abandonment without forging terminal combat. S03 c2 now owns atomic reward-roll staging. S02 conformance and S04 fixture/candidate/reaction leases are present. R-GM-3 has live/restored tuple-history assertions at S04 c2.

Inspected wrappers distinguish fresh Node/Electron `dist` proofs from browser Vite-source proofs, reserve port 63315, discover the planned tests, and assign docs-run/isolation self-tests before their acceptance gates. The known oversized-RNG hang was not executed. B-BD-1 remains carried CI evidence debt, not a dispatch blocker.

**Scope/limits:** Reviewed the supplied plan/history/receipts, relevant architecture and ledger records, approved specs/mocks, committed schema predicates, affected constructors/writers/readers and proof infrastructure. No full cleanup audit, browser/Electron/remote-CI run, or future implementation proof was performed. Dispatch remains Orchestrator-owned.

## F-RA-01 Author Receive — 2026-10-16

Accepted 42bad60, exactly src/schema/contracts/play-session.schema.json; only selection.seedUsed.minLength removed. Native h-Exeu/AnK3E ended normally, raw result saved .program/results/AUTHOR-RA-EMPTY-SEED.result.md. Clean tree, no residual/arch delta/lease violation. Independently type/lint/format/conformance42 all exit0; inspected and reran /tmp/ruleswright-author-r3-verify.cjs --committed exit0: six schemas compile locally, seven real-assembler seed cases including empty survive JSON, old schema rejects empty, six nonstring outputs rejected, identity constraints preserved, dist hashes match EVIDENCE. This closes the contract counterexample; full aggregate/reopen behavior remains future S01/S02 proof.

F-RA-01 now awaits Planner's explicit assertion assignment and scoped D3/D5 recheck. Other D1/D2/D4/D6/D7 passes retain their source refs. No Coder dispatch before the scoped recheck. Author lease released, no pending receive.

## Handoff

```yaml
session: AUTHOR-RANDOM-ADVENTURES
leaseRevision: 3
status: done
finding: F-RA-01 contract corrected
commit: 42bad6023e698bd430a7c50842a1882c5bd9f206
filesTouched:
  - src/schema/contracts/play-session.schema.json
checkpoints:
  - Removed only selection.seedUsed.minLength.
  - String type and all other constraints unchanged.
  - Explicit pathspecs used for both add and commit.
verification:
  - "pnpm format:check — exit 0"
  - "pnpm exec vitest run tests/proofs/contract-conformance.test.ts --cache=false — exit 0; 42/42"
  - "node /tmp/ruleswright-author-r3-verify.cjs --committed — exit 0"
  - "git diff --check 522c6cb0de50679b7cba9858551e94274c8c8858..HEAD — exit 0"
  - Six schemas compiled with local references.
  - Seven real assembler seed cases passed, including empty string.
  - Six non-string outputs rejected; identity constraints preserved.
  - Exact single-file commit verified; worktree clean.
notes:
  - Previously valid documents remain valid; empty seed output now accepted.
  - Canonical String(setup.seed) preserved; no runtime implementation.
surprises: []
followUp:
  - Orchestrator routes assertion reconciliation to Planner.
  - S01 owns empty-seed conformance and JSON reopen/continuation proofs.
  - S02 owns empty-seed preservation through generated definitions.
  - Scoped D3/D5 recheck remains before affected dispatch.
deviations: []
```

## F-RA-01 Planner Receive — 2026-10-16

Accepted8826450, exactly four authorized prompt files. Native h-unte/PnBEw ended normally; raw result .program/results/REPLAN-RA-EMPTY-SEED.result.md preserved. No runtime/source/lease/dependency/checkpoint changes, residual, arch delta or lease violation. Historical suffix byte-identical to44fac85. Independent type/lint/format/diff checks exit0; no source tests repeated for plan-only edits. S01 c3/c5 and S02 c1/c2 now explicitly own empty-seed conformance/reopen/definition assertions; all paths already leased. Scoped Archivist recheck D3/D5 is the remaining dispatch gate; earlier five pass dimensions retained.

## Handoff

**status:** done  
**task:** REPLAN-RA-CONTRACTS — F-RA-01 assertion reconciliation  
**commit:** `8826450593e1957f029b31aace5041279e15d9a8`

**filesTouched:**

```text
program/Ruleswright/prompts/random-adventures/SESSION-01.md
program/Ruleswright/prompts/random-adventures/SESSION-02.md
program/Ruleswright/prompts/random-adventures/STATE.md
program/Ruleswright/prompts/random-adventures/EVIDENCE.md
```

**Assignments:**

- **S01 c3/c5:** empty setup seed → real `selection.seedUsed === ""` → authoritative conformance → JSON aggregate reopen with identical continuation.
- **S02 c1/c2:** empty setup seed acceptance and preservation through generated definitions, JSON and authoritative conformance.

**Verification/checks:** Exact four-file commit; unchanged leases, Files tables, checkpoints and dependencies; STATE history byte-identical; corrected schema digest verified; `git diff --check` clean. Working tree clean. No runtime tests rerun.

**notes:** Contract counterexample closed at `42bad60`; implementation proofs remain future. CA-02/03, current blocker references and evidence updated. D1/D2/D4/D6/D7 review evidence retained.

**surprises:** None.

**followUp:** Orchestrator routes the scoped D3/D5 recheck before dispatch. B-BD-1 remains carried CI evidence debt; no publication or push.

## Planning Recheck Receive — 2026-10-16

ARCH-RECHECK h-k5wi/AWuOd ended normally, read-only, HEAD47b6148 unchanged and clean. Raw result preserved; no commit/residual/arch delta, no gate rerun for read-only review. Plan8826450/source42bad60 D3/D5 pass; D1/D2/D4/D6/D7 retained against full review plan6ec316f/sourcefcec34d. F-RA-01 planning prerequisite closed; B-RA-REVIEW closed. Exact seed aggregate/generated proofs remain due S01c3/c5 and S02c1/c2. All source prerequisites for S01 ready; no human decision or missing producer input. S01 pending, S02–04 pending real predecessor outputs. CAP01–06 runtime proofs remain planned, not verified.

## Archivist Note

- **role:** archivist
- **mode:** planning-completeness — narrow F-RA-01 recheck
- **planRevision:** `8826450593e1957f029b31aace5041279e15d9a8`
- **sourceRevision:** `42bad6023e698bd430a7c50842a1882c5bd9f206`
- **runtimeBase:** `c8e526047b8186d35710965d5f210f858ab232a3`
- **logEntry:** F-RA-01’s ownership and dependency counterexample is closed for planning/dispatch purposes. No files edited, tests rerun, or subagents used.

`P` denotes `program/Ruleswright/prompts/random-adventures/`. Retained verdicts below belong to the prior full review of plan `6ec316f` / source `fcec34d`; they were not re-reviewed.

| # | Dimension | Verdict | Cited evidence |
|---|-----------|---------|----------------|
| D1 | requirement coverage | pass — retained | Prior review preserved in `P/STATE.md:463`. |
| D2 | fact origins | pass — retained | Prior review preserved in `P/STATE.md:464`. |
| D3 | ownership | **pass — rechecked** | Author correction committed at `42bad60`; S01 c3/c5 explicitly own aggregate conformance/reopen/continuation (`P/SESSION-01.md:129,147`); S02 c1/c2 own accepted-input and generated-definition preservation/conformance (`P/SESSION-02.md:88,111`). CA-02/03 reflect these assignments (`P/STATE.md:174,184`). |
| D4 | lease coverage | pass — retained | Prior review preserved in `P/STATE.md:466`. |
| D5 | declared vs real dependencies | **pass — rechecked** | `play-session.schema.json:482` now accepts every string, including `""`, matching `assembleEncounter`’s `String(request.seed)` output (`src/runtime/encounter.ts:55,87`) and approved canonicalization (`program/Ruleswright/specs/database.md:1021,1027`). |
| D6 | early integration | pass — retained | Prior review preserved in `P/STATE.md:468`. |
| D7 | runtime wiring | pass — retained | Prior review preserved in `P/STATE.md:469`. |

**F-RA-01 disposition:** Closed as a planning prerequisite for CA-02/03, CAP-01/02 and their downstream consumers. The inspected Author diff removes only `selection.seedUsed.minLength`; string typing and other constraints remain unchanged. The amended checkpoints require exact empty-seed preservation without substitution.

**Remaining ownership:** No unassigned correction remains. S01 c3/c5 still owes real aggregate conformance and JSON fresh-facade continuation; S02 c1/c2 still owes input acceptance and generated-definition preservation/conformance. These are explicitly owned future proofs, not prerequisites that must preexist for those owners’ dispatch.

**Evidence and limits:** Read both requested Author/Planner receipts, amended proof paragraphs, CA-02/03, EVIDENCE and the actual schema/producer mapping. Orchestrator’s independently received probe and gate results remain recorded evidence (`P/STATE.md:490`; `P/EVIDENCE.md:7`), not checks rerun here. No second full review or implementation-completion claim.

**Wave effect:** F-RA-01 leaves no remaining planning block on W1 or its W2–W4 dependencies. Actual predecessor producer/proof gates remain in force; Orchestrator owns dispatch.

## W1 Dispatch — 2026-10-16 19:35:01 UTC

SESSION01 Native h-Xiqj/CEKBB, default modelgpt-6-astra, base207c9e0, lease revision2 exactly27 paths in .program/prompts/SESSION-01.prompt.md and current manifest. Resources build:dist/browser:63315 reserved; test temp unique. All prerequisite receives complete; no other session eligible. Role/plan digests supplied in envelope. Coder commits own checkpoints; no live instructions/lease changes. Started 2026-10-16 19:35:01 UTC; final receive pending. CAP01/CA01/02 implementation/proofs in progress, not verified.
