# Final Report — Ruleswright / combat-decomposition

## Summary

A behaviour-preserving refactor. `src/runtime/combat/combat.ts` (1,809 lines) and `src/runtime/snapshots.ts` (1,086 lines) are split by responsibility, along the lines the human named: declare/resolve, movement/terrain, trigger handling, and the snapshot halves. The human's answers on record (2026-10-04): "**1 decomp first 2 recommend 3 none**" (DD-D1, DD-D9/DD-D10, DD-D12).

- `Combat` now keeps only `startCombat`, the constructor, the `state` accessor, the public verbs (`step`, `declare`, `use`, `respond`, `serialize`, `eventsSince`, `declareReactive`) and the turn advance (`endTurn`, `advanceFrom`). Its internals live in one `FightCore` (`fight.ts`). Declare gates are in `declare.ts`, effect execution in `execute.ts`, movement/terrain in `movement.ts`, and trigger answering in `triggers.ts`.
- `snapshots.ts` became `snapshots/{envelope,character,combat,index}.ts`. Importers keep the path `…/runtime/snapshots`.
- **Nothing a host can see changed.** Events, their order, payloads, `why` and `at`, state, snapshot JSON, export names and signatures are all unchanged. The proof is a 9-leg characterization test, captured from unmodified source at S01 ck1. It hashes the raw event and snapshot stream with sha256, and its digests are byte-identical at HEAD. The verification pass also showed it passes against base source. The only public `.d.ts` change is the approved DD-D3 `state` field → `get`/`set` accessor pair. It is type-compatible for every consumer.
- Cleanup: C1 (`isLivePattern`) is kept as public API with no code change. C2 (`MAX_TABLE_DEPTH`) is now two declarations pinned equal by a test, with a negative control.

**Sessions done:** 3 / 3. **Capabilities:** CAP-D1, CAP-D2, CAP-D3, CAP-D4 all verified against current sources. **Feature Verification:** 6 verified, 0 present-unverified, 0 failed, 0 blocked.

## Files

`git diff --no-renames --name-status 52d4d2a..db38f31 -- src tests` (end SHA `db38f31`, the last non-report commit) lists **17 paths: 12 A + 4 M + 1 D**. `git diff --no-renames --shortstat 52d4d2a..db38f31 -- src tests`: 17 files, +3,245 / −2,359.

| Group | A | M | D | Paths |
|---|---:|---:|---:|---|
| Runtime combat (M03) | 6 | 2 | 0 | A `combat/{types,combatants,fight,declare,execute,movement}.ts`; M `combat/combat.ts`, `combat/triggers.ts` |
| Runtime snapshots (M03) | 4 | 0 | 1 | A `snapshots/{index,envelope,character,combat}.ts`; D `snapshots.ts` |
| Schema (M01) | 0 | 1 | 0 | M `src/schema/error-card.ts` (l.46 comment only) |
| Tests | 2 | 1 | 0 | A `tests/proofs/combat-characterization.test.ts`, `tests/runtime/combat/module-surface.test.ts`; M `tests/core/tables.test.ts` (+5, one case) |
| **Total** | **12** | **4** | **1** | 6+4+0+2 = 12 A; 2+0+1+1 = 4 M; 1 D; 17 paths |

- `src` alone: 14 files, +2,617 / −2,359 (`git diff --no-renames --shortstat 52d4d2a..db38f31 -- src`).
- `tests` alone: 3 files, +628 (`git diff --no-renames --shortstat 52d4d2a..db38f31 -- tests`). No existing test assertion was changed.
- With rename detection (`git diff --name-status 52d4d2a..db38f31 -- src tests`), git reports 16 paths: `snapshots.ts → snapshots/combat.ts` appears as R059, by its similarity heuristic.
- Bookkeeping outside `src`/`tests`: `program/Ruleswright/arch/v1-core.md` (M, three Orchestrator delta appends) and `prompts/combat-decomposition/{MASTER,STATE,SESSION-01..03,VERIFICATION}.md` (A). That makes 23 paths in total (`git diff --name-status 52d4d2a..db38f31 | wc -l`).

## Line counts

Before (`git show 52d4d2a:<path> | wc -l`):
- `combat/combat.ts` 1,809
- `snapshots.ts` 1,086
- `combat/triggers.ts` 155
- `resolve.ts` 397, `spatial.ts` 375, `action-economy.ts` 211

After (`wc -l src/runtime/combat/*.ts src/runtime/snapshots/*.ts` at `db38f31`):

| File | Lines |
|---|---:|
| `combat/combat.ts` | 671 |
| `combat/types.ts` | 171 |
| `combat/combatants.ts` | 98 |
| `combat/fight.ts` | 90 |
| `combat/declare.ts` | 283 |
| `combat/execute.ts` | 233 |
| `combat/movement.ts` | 351 |
| `combat/triggers.ts` | 280 |
| `combat/resolve.ts`, `spatial.ts`, `action-economy.ts` | 397, 375, 211 (unchanged) |
| `snapshots/index.ts` | 35 |
| `snapshots/envelope.ts` | 123 |
| `snapshots/character.ts` | 302 |
| `snapshots/combat.ts` | 671 |
| **Total** | **4,291** |

Line counts were reported, not gated (DD-D12, "3 none").

## Architecture impact

No new module ID, no cross-module edge, and no public export change. Value imports are derived per statement: a `node -e` match on whole statements `/^(import|export)\s[\s\S]*?from\s+'([^']+)';/gm`, dropping `import type`/`export type` (F-D7). S02 reported them at `39d754d` and S03 at `0c56866`; the Orchestrator spot-checked them with greps on `'./fight'` and `'./combat'`.

| File | Internal value imports |
|---|---|
| `combat/combat.ts` | `../../core/rng`, `./triggers`, `./action-economy`, `../../core/dsl/formula`, `../errors`, `../display-roll`, `./combatants`, `./declare`, `./execute`, `./fight`, `./movement` |
| `combat/fight.ts` | `./combatants`, `./triggers` |
| `combat/declare.ts` | `../conditions`, `./spatial`, `./combatants` |
| `combat/execute.ts` | `../display-roll`, `./resolve`, `./combatants` |
| `combat/movement.ts` | `../../core/dsl/formula`, `../errors`, `./resolve`, `./spatial`, `./combatants`, `./declare` |
| `combat/triggers.ts` | `./action-economy`, `./combatants`, `./declare`, `./execute` |
| `combat/{types,combatants,spatial,action-economy}.ts` | none |
| `combat/resolve.ts` | `../../core/dsl/{checker,formula,effect}` (unchanged) |
| `snapshots/index.ts` | `./character`, `./combat` |
| `snapshots/envelope.ts` | `../../schema/version`, `../../schema/error-card` |
| `snapshots/character.ts` | `../../schema/error-card`, `../../core/rng`, `../errors`, `../progression`, `../character`, `./envelope` |
| `snapshots/combat.ts` | `../../schema/error-card`, `../errors`, `../combat/combat`, `./envelope` |

- The value DAG is acyclic.
- No file value-imports `./combat`; `triggers.ts → combat.ts` is type-only.
- Only `combat.ts` value-imports `fight.ts`.
- Two value edges were dropped and became type-only: `combat.ts → ./resolve` and `combat.ts → ./spatial`.
- The union of the `snapshots/*.ts` value edges equals base `snapshots.ts`'s edges.
- `pnpm check:isolation` is 0, so the runtime bundle carries no compiler strings.

## Gates and proofs (V1–V6, N₁, digests, negative controls)

| Gate | Base `52d4d2a` | After S01 `f82b2fe` | After S02 `39d754d` | Feature-final `0c56866` |
|---|---|---|---|---|
| V1 `pnpm typecheck` | 0 | 0 | 0 | 0 |
| V2 `pnpm lint` | 0 | 0 | 0 | 0 |
| V3 `pnpm format:check` | 0 | 0 | 0 | 0 |
| V4 `.d.ts` export lists | `1 151 b3a0b27d400a8289` / `1 221 be8f98762c3bdcad` | equal | equal | equal |
| V5 `Combat` public members | 13 | only the DD-D3 accessor delta | same | same |
| V6 `pnpm test` | 50 files 923/923 | 52 files 937/937 (N₁) | 52 / 937 | 52 / **938** (N₁ + 1) |
| `check:isolation` / `check:security` | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |

- The Orchestrator ran every column itself at receive (`pnpm build` immediately before V4/V5/V6). It re-observed the base at `db54362`, where `src`/`tests` are byte-identical to `52d4d2a`.
- **N₁ = 937** (S01 ck1: +14 tests in 2 new files). **N₁ + 1 = 938** (S03 ck2: the C2 case).
- **Characterization digests** (raw sha256 / `packContentHash`), captured at S01 ck1 `17f8f18` from unmodified `src` (`git diff --stat 52d4d2a 17f8f18 -- src` is empty):
  - leg1 `3e2e94f0…f6a2` / `1cc2c131`
  - leg2 `b7c89ee4…f6b1` / `1c81f3d7`
  - leg3a `4b79a4d1…e5ad` / `dbf35a57`
  - leg3b `49fed1e8…7c6c` / `04519945`
  - leg4 `1f015930…bcfb` / `008c2497`
  - leg5 `977b2fbe…eafb` / `fff7889a`
  - leg6 `d1b501cd…3377` / `5b854d01`
  - leg7 `f2f4a205…fc00` / `9b871c1e`
  - leg8 `62468c03…17fa` / `1c28bc2e`

  The full hex is in STATE.md *Handoff Notes* (SESSION-01).

  `git diff --stat 17f8f18 db38f31 -- tests` shows only `tables.test.ts`, so no digest was ever re-keyed.
- **Negative controls:**
  - S01 ck1: swapping the `amount`/`hp` key order in the `damage:applied` payload failed 6/9 legs (1, 2, 3a, 3b, 4, 7). After reverting, all 9 passed.
  - S03 ck2: `helpers.ts` `MAX_TABLE_DEPTH` → 9 failed the C2 case (`expected 8 to be 9`). It was reverted and never committed (`git diff --quiet 52d4d2a db38f31 -- src/schema/validate/helpers.ts`).
  - VERIFY-01: on a base copy, `'arrived'` → `'arrivedX'` failed legs 2 and 7.
- **Base cross-run (VERIFY-01):** HEAD's characterization and module-surface tests run against a `git archive 52d4d2a` extract pass 77/77 (5 files, with `tests/snapshots`). The pins equal base behaviour.

## Verification

**Feature Verification pass:** one envelope, 2026-10-04. Source: `program/Ruleswright/prompts/combat-decomposition/VERIFICATION.md`, committed at `db38f31`. The worker's `commit_pathspec` was refused because the path is gitignored, the known hazard. The Orchestrator committed the worker's file unchanged with `git add -f` and an explicit pathspec.

**Rows:** 6 verified · 0 present-unverified · 0 failed (all routed) · 0 blocked.

### Behavior unverified — human review required (0 rows)
| ID | Exists | What is unproven | Why it could not be proved here |
|---|---|---|---|

none. The pass returned no `present-unverified` row.

## Residual gaps (carried)

- **F-FP2 class features:** the next feature. It needs a human product decision and a human-authorized DB re-entry. Owner: the next Planner run.
- **F-R6:** the `mocks/progression.html:70-80` copy. Owner: Designer re-entry.
- **`spells.tagged:` load integrity:** needs a human decision.
- **F-D8 (new this cycle), spec drift:** `program/Ruleswright/specs/architecture.md:80`, `:88` and `:208` still name `combat.ts`/`snapshots.ts` as file locations. This spec is Author-owned and permanently outside every lease. Owner: Spec re-entry (human-authorized). Precedent: `architecture.md:62` still says `validate.ts`.
- **C3/C4/C7/C10, and the carried ledger in `arch/v1-core.md`:** unaffected. The final Archivist marks C1 (retired as public API) and C2 (resolved by the cross-pin).
- **Arch/registry re-key:** the three mid-run delta sections in `arch/v1-core.md` and the PROGRAM-CONFIG M03 *Key Files* / intra-module edges need synthesis. Owner: the final Archivist pass.

## Follow-up

- Next feature: F-FP2 (class features). The decomposition makes its `Combat` work cheaper (DD-D1).
- Any later feature that intentionally changes combat events or snapshot output must list `tests/proofs/combat-characterization.test.ts` in its pin audit as a behaviour pin, with a re-key owner (DD-D8; PROGRAM-CONFIG pin-lease convention).

## Orchestration

**Concurrency:** 3 configured. Effective concurrency was 1 because the plan is serial (S01 → S02 → S03; DD-D11). **Wall clock:** about 36 min, from the preflight dispatch at about 15:41 to `db38f31` at 16:16:12 (commit times, `git log --date=format:%H:%M:%S`).
**Sessions run:** 3 Coder sessions, plus 1 Archivist preflight and 1 verification Coder. **Checkpoints committed by Coder:** 11 (`git log --oneline 52d4d2a..db38f31 --grep checkpoint | wc -l`), matching 5 + 4 + 2 declared.

Binding: Native (`mcp__demiurge__spawn_subagent` / `await_subagent_result`). Three awaits hit the host's ~300 s idle timeout (ARCH-PRE, S01, S02). Each was re-awaited on the same handle with nothing lost. Per the PROGRAM-CONFIG convention, these are not crashes.

### Wave plan as executed
| Wave | Sessions | Notes |
|---|---|---|
| W0 | ARCH-PRE (Archivist, read-only) | planning completeness: D3/D4/D5 fail → corrected before dispatch |
| W1 | S01 | 5/5; dispatch about 15:50 → accepted 16:01 (`c2e6f53`) |
| W2 | S02 | 4/4; dispatch about 16:01 → accepted 16:08 (`aaf2542`) |
| W3 | S03 | 2/2; lease rev 2; dispatch about 16:09 → accepted 16:13 (`5e642a1`) |
| — | VERIFY-01 | 6 verified; committed `db38f31` |

### Blocked
none

### Blocker escalations
| S | Class | Action / human ask | Disposition |
|---|---|---|---|
| — | planning defect (F-D1..F-D9) | Corrected under standing authority: envelope amendments, MASTER step 6, and S03 lease rev 2. No human ask. | cleared before dispatch (`3ada167`, `8adde91`) |
| VERIFY-01 | mechanical owner seam | `commit_pathspec` cannot stage the gitignored VERIFICATION.md. The Orchestrator committed it with `git add -f` and an explicit pathspec. | cleared (`db38f31`) |

### Interim Archivist checks
| After wave | Sessions received | Result | Drift found | Actions |
|---|---|---|---|---|
| — | — | none: 3-session plan, cadence = planning completeness + final only | — | — |

### Lease violations
none. Every checkpoint commit's `git show --name-only` was inside its session's `Owns` (S03: lease rev 2). S02's two R2 deviations name in-lease paths only. `src/schema/validate/helpers.ts` (S03's scratch-only rev 2 path) was never committed.

### Checkpoint shortfalls
none (S01 5/5, S02 4/4, S03 2/2).

### Wave plan corrections
none. No pair was marked concurrent.

### Granularity feedback for Planner
none at the checkpoint level. Every session committed every checkpoint, and none exhausted context. Planning-premise feedback, counted by the final Archivist:
- **F-D1:** the digest choice (`packContentHash` canonicalizes keys) and both suggested negative controls could not detect what they claimed to lock.
- **F-D2:** a private helper (`balancesOf`) had no mover, which made S02's dependency on S01 unreal.
- **F-D3:** the prescribed deletion recipe (`git add -A`) collides with `CODER.md`'s ban. Standing rec 3658f327 should name `git rm`.
- **F-D4:** a negative control was outside its session's lease.
- **F-D5:** characterization legs were copied from `dist/`-importing tests.
- **F-D6:** the baseline said "no hazards", but the `dist/` journeys and linted `.program/` are hazards.
- **F-D7:** the import-derivation grep misses multi-line imports.
- **F-D8:** the pin-audit grep omitted `specs/`.

### Process effectiveness
- **First-dispatch completion:** 3/3. Every session was accepted on its first dispatch, with no redispatch and no unplanned correction worker.
- **Unplanned corrections:** 0 workers. There was 1 controlled lease revision (S03 rev 1 → 2, F-D4, CAP-D4), granted before dispatch, not mid-session. Nine preflight findings were carried as envelope amendments inside existing leases (CAP-D1, CAP-D3, CAP-D4).
- **Integration rework:** 0. No corrective commit or checkpoint after an earlier acceptance.
- **Durations:** from commit times, dispatch → accept was about 11 min for S01, about 7 min for S02 and about 5 min for S03.
- No product decision or environment failure occurred. The one tooling seam (the gitignored VERIFICATION.md) is known and recurring.

### Capability completion
- **CAP-D1, combat behaviour unchanged:** verified. Lock at S01 ck1 `17f8f18`; integration at S02 ck4 `39d754d`; digests unchanged at `db38f31`.
- **CAP-D2, snapshot behaviour unchanged:** verified at S03 ck1 `8b1ed0b`. Legs 7–8 are unchanged and `tests/snapshots/**` is unmodified, 63/63.
- **CAP-D3, public surface unchanged:** verified at S01 ck5, S02 ck4 and S03 ck2. `module-surface` passes, V4 is equal, and V5 differs only by the accessor.
- **CAP-D4, cleanup dispositions:** verified at S03 ck2 `0c56866`. The C2 cross-pin has a negative control; C1 is kept as public API.
- CA-D1..CA-D5 are all proven (STATE *Contract Agreements*).
- No required capability is still planned, blocked or stale.

### Follow-up closure ledger
| Source | Item (verbatim, abridged only by elision marks where long) | Disposition |
|---|---|---|
| S01 surprise 1 | "Leg 1 does not run take and decline in one fight … It mirrors `spatial-triggers.test.ts`, which also uses two `parryFight`s, one taken and one declined." | **retired.** It is a test-design fact; both branches are pinned (VERIFY-01 E5) |
| S01 surprise 2 | "`combat.ts` also exports `copyTerrain`, `terrainRefusals` and `moveBudgetAst`, which the plan's table did not list …" | **closed.** S02 moved them to `movement.ts` and re-exports them from `combat.ts` (`62c1418`); the module-surface pin is green |
| S01 surprise 3 | "`executeBound` and `endIfSideDefeated` replace `this.pendingTriggers`/`this.state` with `core.pendingTriggers`/`core.state`; `Combat.pendingTriggers` is the same array instance …" | **closed.** Behaviour lock green through `db38f31` |
| S01 followUp | "SESSION-02 imports `balancesOf` … from `./declare`/`./combatants` … Movement internals and `resolveReactive`/`resolveReactiveAgainst`/`resolveFeat` are still in `Combat`." | **closed** by S02 (`62c1418`..`39d754d`) |
| S01 followUp | "The characterization digests and module-surface pins must stay byte-identical through S02/S03 … N₁ = 937 holds through S03 ck1." | **closed.** `git diff --stat 17f8f18 db38f31 -- tests` = `tables.test.ts` only; 937 at S03 ck1 |
| S01 followUp | "… the `arch/v1-core.md` symbol citations now pointing into moved code; the final Archivist re-keys them." | **carried** to the final Archivist pass (this run) |
| S01 followUp | "CAP-D1 is completed only at S02 ck4, CAP-D2 at S03 ck1, CAP-D3 at S03 ck2." | **closed** (Capability completion above) |
| S02 surprise 1 | "`combat.ts`'s value edges to `./resolve` and `./spatial` became type-only …" | **closed.** Recorded in Architecture impact and the arch delta `576a307` |
| S02 surprise 2 | "`answerOffer` returns early instead of using `respond`'s `let events` branch. The same calls run in the same order …" | **retired.** Equivalence is proven by the unchanged digests |
| S02 surprise 3 | "No characterization digest, module-surface pin, V4 or V5 value changed." | **retired** (an observation) |
| S02 followUp | "SESSION-03 can rely on `combat.ts` still exporting `copyTerrain`, `terrainRefusals`, `moveBudgetAst`, … with every `snapshots.ts` import path unchanged." | **closed** by S03 ck1 `8b1ed0b` |
| S02 followUp | "CAP-D2 is still owed at S03 ck1. CAP-D3's feature-final proof is at S03 ck2." | **closed** |
| S02 followUp | "N₁ = 937 still holds for S03 ck1." | **closed** |
| S02 followUp | "The final Archivist re-keys the `arch/v1-core.md` citations … and the PROGRAM-CONFIG M03 key files and intra-module edges." | **carried** to the final Archivist pass (this run) |
| S03 surprise 1 | "The dropped `// ---- combat` section marker is the only non-import line that did not carry over …" | **retired.** A comment marker; no behaviour |
| S03 surprise 2 | "`snapshots/combat.ts` now imports only `RngState` (type) from `core/rng` …" | **closed.** Recorded in Architecture impact |
| S03 surprise 3 | "Git records ck1's deletion as a rename `snapshots.ts → snapshots/combat.ts` (R059) …" | **retired.** Files table counts both views |
| S03 surprise 4 | "No mapping changed. No digest, pin, V4 or V5 value changed." | **retired** (an observation) |
| S03 followUp | "The final Archivist re-keys `arch/v1-core.md` l.52, 68, 132, 624, 753, 770, 873, 1215 and 1222, plus PROGRAM-CONFIG l.82 and l.92 …" | **carried** to the final Archivist pass (this run) |
| S03 followUp | "The final Archivist marks C1/C2 in the cleanup ledger." | **carried** to the final Archivist pass (this run) |
| S03 followUp | "F-D8 spec drift (`specs/architecture.md:80,88,208`) goes to a Spec re-entry." | **carried** to a Spec re-entry (human-authorized; Author-owned file) |
| S03 followUp | "No proof owed by this session is left open." | **retired** (an observation) |
| VERIFY-01 surprise | "My characterization negative control also trips the explicit `move:ended` reason assertions … S01's recorded key-order swap is the control that does …" | **retired.** S01's digest-only control is on record |
| VERIFY-01 followUp | "F-FP2 stays queued." | **carried** to the next Planner run |

### Archivist's Note
*(Final Archivist, handle h-R3_o, returned 2026-10-04; commit `fcc7b90`. One host await idle timeout, re-awaited. Appended verbatim.)*

## Archivist Note

- **role:** archivist
- **registryUpdated:** true
- **reconciled:**
  - `program/Ruleswright/arch/v1-core.md`
    - **Delta sections merged:** the three combat-decomposition delta sections are merged into the main record, and their markers are gone. The original text is recoverable at `a2f117f`. Where SESSION-02 replaced parts of SESSION-01's section, the record follows git at `0c56866`.
    - **Combat engine:** new *File layout* table for all 11 `combat/*.ts` files, with each file's contents, line count and internal value imports, plus a map from old names to new ones.
    - **Snapshots:** new *File layout* for `snapshots/{index,envelope,character,combat}.ts`.
    - **Citations re-keyed:** every moved-code citation the fragments listed was located by content. Each one now points at the new file or is still true as written.
    - **C1/C2 drift notes:** C1 is retired (kept as public API, DD-D9). C2 is closed by the cross-pin test (DD-D10).
    - **Spec drift:** F-D8 is recorded with `architecture.md:62`. The `:62` `validate.ts` drift had never been recorded here before.
    - **Record correction:** three real value edges that no earlier list named: `character-profile → combat/resolve`, `bestiary → combat/resolve`, `encounter → bestiary`. All three already existed at `c39ef87`.
  - `program/Ruleswright/PROGRAM-CONFIG.MD`
    - **Registry:** reconciled to `a2f117f`. The M03 *Key Files* list now shows the combat split, and `snapshots/{index,envelope,character,combat}.ts` replaces `snapshots.ts`.
    - **Edges:** the intra-module edges were re-derived per import statement, `import type` excluded. For example, `combat/combat.ts → conditions.ts` became `combat/declare.ts → conditions.ts`, and the two `snapshots/*` edges replaced the single `snapshots.ts` edge.
  - `program/Ruleswright/ARCHIVIST-LOG.md`
- **Final Report figures:** all reproduce against `db38f31`:
  - 17 paths (12 A + 4 M + 1 D), +3,245/−2,359;
  - 16 paths with rename detection (R059), 23 in total;
  - every line count, totalling 4,291;
  - 11 checkpoint commits (`--grep checkpoint`).
- **Fresh gate run at `a2f117f`:** build, typecheck and check:isolation all exit 0. 938/938 tests pass across 52 files, and the proofs suite is 92/92 across 12 files.
- **conventionsAdded:**
  - **Minted, cycles axis crossed (feat-progression `b2db48b`, builder-rulings `6534364`, combat-decomposition `db38f31`):** VERIFICATION.md under the gitignored `prompts/` is committed by Orchestrator with `git add -f -- <path>` and an explicit pathspec. The worker reports the refused `commit_pathspec` as a surprise, not a deviation.
  - **Sharpened, pin-lease ownership (6 cycles, 8 instances; F-D8):** the doc-pin grep also covers `specs/**` and `arch/**`. Author-owned hits are listed with their re-entry owner.
  - **Evidence notes updated:**
    - factual-premise rule: 9 cycles, 41 instances (F-D1, F-D2, F-D5, F-D9 caught before dispatch);
    - Final Report facts rule: held;
    - idle-timeout rule: 6 cycles, 11 instances (three timeouts, each re-awaited).
- **proposedForFramework:**
  - **3092a46b (new; 1 cycle, 1 instance; F-D6):** the baseline said "Hazards: none" although `dist/`-importing journeys and the linted `.program/` were already known. PLANNER.md's baseline step should grep for `dist/` importers and check lint/format ignore lists before writing "none".
  - **2674d8c2 (new; 1 · 1; F-D7):** prescribed import derivations should match whole statements, not single lines.
  - **0880dd57 (new; 1 · 1; F-D4):** a prescribed negative control's target file goes in `Owns`, marked scratch-only, with a `git diff --quiet` revert check.
  - **3658f327 (reworded; 2 cycles, 2 instances; F-D3):** the tooling note should name `git rm -- <path>` and say never `git add -A`, even with a pathspec. The old "two-step" wording produced the banned recipe in SESSION-03 and MASTER.
  - **c187bed6 (3 · 3, now promoted for this program):** give `commit_pathspec` a `force` option limited to the write set, or have ORCHESTRATOR.md say Orchestrator force-adds the file.
  - **Carried with higher counts:** 576a2816 (9 · 41), 1cc46f93 (6 · 8), cecd2115 (6 · 11).
- **logEntry:** dated entry "2026-10-04 — final pass, cycle `combat-decomposition`" appended to ARCHIVIST-LOG.md.
  - **Deviations by rule (FR-19):** R1 0; R2 2 (both S02, both inside its lease); R3 0; R4 0.
  - **Adoption check:** the role docs' sha1 and mtime are unchanged since the prior pass, so no row is adopted.
  - **Commit:** `fcc7b90`, with an explicit pathspec.

### cleanupBriefs

None crossed a threshold. The 2026-09-28 duplicated-logic brief is closed: C1 is **retired** (kept as public API) and C2 is **accepted** (closed by `0c56866`).

One new candidate is tracking, not briefed. **C15:** eight helpers in the split files are exported but used only inside their own file — `execute.ts` `flattenResolutions`, `boundActionOf`; `movement.ts` `pathQuery`, `threatenersLeft`, `endMove`, `setPendingMove`; `triggers.ts` `resolveReactiveAgainst`, `resolveFeat`. Confidence is low; removing `export` would change no behaviour.

### standingRecommendations

| id | pattern | cycles | instances | firstSeen | status |
|---|---|---:|---:|---|---|
| b32fc8d0c8c92d52 | Exhaustive checkpoint-0 read sweeps exhaust context | 2 | 2 | v1-core | open |
| f57dbe4d010638fe | Subagent fabricates tool inputs under long-recovery prompts | 2 | 8 | v1-core | open |
| b85c8f3e113a6764 | Barrel completeness gaps found at integration | 2 | 3 | v1-core | open |
| c1ed872bea557b96 | run tool argv misrouting | 2 | 3 | v1-core | open |
| 3658f327cc9cff2f | Single-command commits fail on deleted files | 2 | 2 | v1-core | open (reworded: `git rm`) |
| 1cc46f93038f1d9a | Cross-suite pins land without a named owner | 6 | 8 | loot-inventory | promoted; framework wording open |
| 576a281656f83b23 | Envelope factual premises reach sessions unverified | 9 | 41 | loot-inventory | promoted; framework wording open |
| 854ceecd39d4b0d3 | Whole-repo fast gates red at role-scoped receives | 4 | 4 | v1-core | promoted |
| 17f4803c1b08da77 | Provider aborts kill subagents mid-session | 3 | 5 | loot-inventory | open |
| 6f6b491bdbe37bf0 | Bare npx misresolves; use pnpm exec vitest | 3 | 4 | loot-inventory | open |
| 1d910de11732c6c4 | Aborted final pass leaves a double synthesis | 2 | 2 | loot-inventory | open |
| c172cd30e8dfc756 | Commit gates hard-code a stale base SHA | 1 | 1 | equipment-consumables | open |
| cecd211504587426 | Host await idle timeout; re-await reattaches | 6 | 11 | equipment-consumables | promoted; framework wording open |
| f68c42a3f6224eb1 | Final Report facts transcribed, not derived | 4 | 4 | v1-core | promoted; framework wording open |
| a368039028d463d6 | Role docs say Spec/DB never spawned vs planned re-entries | 7 | 7 | grid-combat | promoted; framework wording open |
| 3983f8eb6d18a5f2 | STATE row matcher writes into the wrong rows | 1 | 2 | grid-movement | open |
| f4621ac12fba3456 | Pin audits miss behaviour pins | 3 | 4 | grid-combat | open |
| 760b67f17edbd346 | New execution path exposes latent content hazards | 2 | 2 | spells-in-combat | open |
| 82b4e0abbda105d6 | Concurrent sessions share one working tree | 1 | 2 | spells-in-combat | open (narrowed) |
| c3c94358b35f8316 | Cited `<base>..HEAD` stops reproducing after the report commit | 1 | 1 | action-targeting | open |
| c187bed6bb5132a7 | VERIFICATION.md under gitignored path; commit_pathspec cannot force-add | 3 | 3 | feat-progression | promoted (2026-10-04); framework wording open |
| 8039d6869169267c | Plan artifacts carry internal inconsistencies | 1 | 2 | feat-progression | open |
| d2415cb4497e0049 | Author/DB handoffs report deviations without R1–R4 | 1 | 1 | feat-progression | open |
| 3092a46b564d1d36 | Baseline "Hazards: none" despite known hazards | 1 | 1 | combat-decomposition | open |
| 2674d8c2f948ae0a | Prescribed derivations are line-based greps | 1 | 1 | combat-decomposition | open |
| 0880dd5734025fd4 | Negative control perturbs a file outside the lease | 1 | 1 | combat-decomposition | open |

The patterns above are shortened. The full wording of each row is in the log entry.
