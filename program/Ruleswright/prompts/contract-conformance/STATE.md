# State Tracker — Ruleswright / contract-conformance

## Program / Feature / Intent / Sessions

- **Program:** Ruleswright (`program/Ruleswright/`)
- **Feature:** contract-conformance
- **Intent:** prove that the three published JSON Schemas (`src/schema/contracts/{pack,snapshots,override}.schema.json`) admit what the library actually generates, ships and writes, using an independent validator. Fix the one disagreement this exposed, on the contract side (human decision A). Close two small carried test/doc items. This is the "snapshot conformance" follow-up that every cycle has carried since v1-core (`prompts/v1-core/FINAL-REPORT.md:74,79`).
- **Sessions:** 2. S01 is a DB Author re-entry (contract v1.11, 2 checkpoints). S02 is a Coder session (proof, refusal test and docs, 3 checkpoints).
- **Plan HEAD:** `bb61f91` (2026-10-11). Tree clean. `src/` unchanged since `64a3231`.
- **Human input on record:** on 2026-10-11 Planner asked "Reply **A** (or B), plus yes to plan `contract-conformance`". The human answered "**a yes**" (DD-K1).

## Session Status

| # | Session | Modules | Owns | Status | Checkpoint | Completed | Notes |
|---|---|---|---|---|---|---|---|
| S01 | DB re-entry: contract v1.11 — combatant hp has no lower bound | — (DB) | `program/Ruleswright/specs/database.md`, `src/schema/contracts/snapshots.schema.json` | done | 2/2 (`e815e74`, `bde9781`) | 2026-10-11 | Author session; no CA-K2 delta; Orchestrator V1–V3 0 at receive |
| S02 | Contract conformance proof, old-location refusal, honest docs | tests, M05 | `tests/proofs/contract-conformance.test.ts`, `tests/runtime/features.test.ts`, `tests/proofs/docs-run.test.ts`, `package.json`, `pnpm-lock.yaml`, `README.md` | pending | — | — | depends on S01 (CA-K2) |

## Wave Plan

| Wave | Sessions | Why concurrent |
|---|---|---|
| W1 | S01 | Single member: S02's ck1 asserts the v1.11 schema S01 produces (CA-K2). The leases are disjoint, but the dependency is real. |
| W2 | S02 | Single member: its three checkpoints share `README.md`/`docs-run` and need one context. |
| — | VERIFY-01 | Feature verification after S02. |

## Dependency Graph

```
S01 ck1 (schema hp) ─► ck2 (database.md text) ─► S02 ck1 (ajv + conformance; CA-K2 proof) ─► ck2 (old-location refusal) ─► ck3 (README + docs-run pin)
```

## Architecture Reference (feature-specific)

- No module, edge or public-API change. `src/**/*.ts` is untouched. The one `src/` change is the DB-owned contract file `src/schema/contracts/snapshots.schema.json` (Author artifact, not a module lease).
- New test-only artifact: `tests/proofs/contract-conformance.test.ts`. It value-imports `src/compiler`, `src/runtime/index`, `tests/proofs/determinism-oracle`, `tests/runtime/fixtures/{packs,pack}` and `tests/schema/fixtures`, and reads the contract JSON with `node:fs`. It is collected by `vitest.config.ts` (`tests/**/*.test.ts`), and so by Node, Electron, CI `test` (`ci.yml:54`) and CI `package` (`ci.yml:94`). It is **not** collected by `vitest.browser.config.ts`.
- New devDependency: `ajv@8.20.0` (exact). Runtime `dependencies` stay absent (NFR-Dependencies). `ajv@6.15.0` stays in the lockfile as ESLint's transitive dependency.

## Scope Summary

| ID | Module | Effect |
|---|---|---|
| — (DB) | `snapshots.schema.json`, `database.md` | v1.11: combatant `hp` loses `minimum: 0` (S01) |
| tests | `tests/proofs`, `tests/runtime` | conformance proof (new); old-location refusal case; docs-run pin |
| M05 | `package.json`/lockfile, `README.md` | ajv devDependency; three doc edits |
| — | `ci.yml` | **no change**: the new file runs in the existing `test` and `package` jobs |
| — | PROGRAM-CONFIG, `arch/v1-core.md` | final Archivist only (not leased) |

**Inherited-work reconciliation.** Sources inspected at `bb61f91`:
- browser-determinism: `FINAL-REPORT.md`, `STATE.md`, `VERIFICATION.md` (12 verified, 1 present-unverified, 0 failed);
- `arch/v1-core.md` residual blocks (l.1497-1690);
- `.program/{ledger,blockers,decisions}.md`;
- PROGRAM-CONFIG conventions and Custom Rules;
- v1-core `STATE.md:138` / `FINAL-REPORT.md:74-84`.

| Inherited item | Disposition |
|---|---|
| "Byte-level snapshot conformance test" (v1-core v1.1 follow-up, carried every cycle) | **assigned**: S02 ck1, as schema conformance of every writer's output by an independent validator. Byte-exact round-trip is already proven where the contract requires it (presence-preserving character snapshots, `tests/snapshots/character.test.ts`) and is not re-claimed here. The final Archivist records the retirement |
| v1-core advisory "combatant `hp minimum: 0` vs engine's unclamped negative hp (death-mechanic decision)", dropped from later carried lists | **resolved**: DD-K1 (human "a") → S01 v1.11. **Demonstrated defect:** the approved behaviour is that damage is not floored and hp ≤ 0 is down (`combatants.ts:12-15, 83-90`, `README.md:148-151`, `database.md:166`); the writer emits it as-is (`snapshots/combat.ts:131`). The contract said `minimum: 0` (`snapshots.schema.json:192`). Probe P1: Ajv rejects leg 3b (`hp -7`) and an end-of-fight snapshot on each of the 3 themes, on exactly that keyword, and nothing else |
| `new Runtime` old-location refusal hardening (class-features residual, owner "Planner, next feature touching `tests/runtime`") | **assigned**: S02 ck2 |
| README l.588-590 overstates docs-run (browser-determinism VERIFY-01; owner "Planner, next feature touching docs-run/README"; standing rec `47f092a4f076107c`) | **assigned**: S02 ck3 (narrowed sentence; the new claim is pinned) |
| README l.578 "both sample themes" (stale; `coverage-floor.test.ts:34,49` covers three) | **assigned**: S02 ck3 (doc pin found by this audit) |
| B-BD-1 — GitHub Actions execution (browser-determinism VERIFY-01 present-unverified) | **carried**, owner: the human push, then the next Orchestrator/Archivist run. This feature adds no job. Once B-BD-1 clears, the new file's CI run is covered by the same `test`/`package` jobs |
| DD-B3 Electron renderer residual; browser leg runs `src/` via Vite | **carried**, owners unchanged |
| Cleanup candidate C16 (`PackTheme` has no outside consumer) | **carried**: S02 imports `PACK_THEMES`, not `PackTheme`, so C16 is unchanged |
| `spells.tagged:` integrity, 12 `damage(half)` sites, point-pool cast verb, item `tags`, R-GM-3, F-M2, CAP-F1 compiler leg, slots-remaining query, Architect overview gaps, `pnpm approve-builds` advisory | **carried**, out of scope, owners as recorded in `arch/v1-core.md` |

## Design Decisions

- **DD-K1 — human decision (2026-10-11, "a yes"): the contract admits negative hp.** Option A: DB drops `minimum: 0` on the combat snapshot combatant `hp` (v1.11, loosening only, no caveat, `schemaVersion`/`snapshotVersion` 1). The engine is unchanged, and no determinism digest re-keys: no `src/**/*.ts` or theme changes, and `PACK_DIGESTS` hash packs, not snapshot schemas. B (floor in engine) and C (floor at save) were rejected; C breaks FR-14 resume equality.
- **DD-K2 — Ajv 8.20.0, draft 2020-12 (`ajv/dist/2020`), `strict: false`, `allErrors: true`.** All three contracts declare `$schema` draft 2020-12. Strict mode rejects the schemas' *style*: union `type` (`pack.schema.json` provenance.seed, `snapshots` `position`/`pendingTrigger`) and `required` inside an `if/then` (spells `targeting`). It does not reject their validity, and rewriting DB-owned schemas for linter taste is out of scope. Exact pin, dev-only (narrowest path; the most common draft-2020 validator; no new runtime dependency).
- **DD-K3 — subjects reuse existing producers.** The oracle legs (9 scripted fights, 14 envelopes, all three kinds, theater/grid/hex, paused moves, open offers, an overkill), the 3 generated packs, the 7 fixture packs, and a per-theme level-1 character and party. No new fight script: leg 3b already carries the overkill deterministically. Plan-time probe P1's end-of-fight script used try/catch declare loops and is not prescribed.
- **DD-K4 — no `ci.yml` change.** `- run: pnpm test` (`test` job, Node 18/20/22) and `- run: pnpm exec vitest run tests/proofs/` (`package` job) already collect the file. docs-run pins both run steps so the README claim stays enforced (CA-K3).
- **DD-K5 — the old-location refusal lives in `tests/runtime/features.test.ts`.** It is the runtime suite for class features, and `cloneRuntimePack` (warden) is already imported there.
- **DD-K6 — PROGRAM-CONFIG and `arch/` are not leased.** The final Archivist owns:
  - the Stack *Test* row (l.24: add the conformance proof);
  - Custom Rule 1 (v1.11 event);
  - *Author Sources → Data source* (normative through v1.11);
  - `arch/v1-core.md`: the v1.1 follow-ups line (l.1681, "byte-level snapshot conformance") and the class-features / browser-determinism residual entries this feature closes.

## Verification Baseline

Plan-time observations at `bb61f91`, in a clean `git archive` copy at `/tmp/rw-cc-probe` (outside `$HOME`, `pnpm install --frozen-lockfile`, then `pnpm add -D -E ajv@8.20.0`):

| # | Command | Scope | Evidence |
|---|---|---|---|
| V1 | `pnpm typecheck` | repo | 0 in the clean copy with the draft test (P3) |
| V2 | `pnpm lint` | repo | `eslint` on the draft test: 0 (P3); whole repo inherited 0 (browser-determinism final Archivist at `da32716`) |
| V3 | `pnpm format:check` | repo (Prettier ignores `program/`, `pnpm-lock.yaml`) | 0 in the clean copy after `prettier --write` on the draft test |
| V4 | `pnpm build` | tsup | 0 (clean copy) |
| V5 | `pnpm build && pnpm test` | whole Node suite | **base 56 files / 974** (inherited, Archivist fresh run at `da32716`). Clean copy with the v1.11 edit and the 2-`it` draft: 57 / 976 |
| V6/V7 | `pnpm check:isolation` / `pnpm check:security` | `dist/` / `src/` | inherited 0. Unaffected: no `src/**/*.ts` change |
| V8 | `pnpm test:browser` | 6 files ×3 engines | inherited 74/74 ×3. Does not collect the new file. One browser-mode run at a time (H8) |
| V9 | `pnpm build && pnpm test:electron` | whole suite under Electron 44.7.0 | inherited 974/974. **Not probed** with the new file; it uses only `node:fs`/`node:url`, which Electron's Node provides. S02 ck3 runs it |
| V10 | — | `ci.yml` unchanged | n/a |
| V11 | clean copy outside `$HOME` → `pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm exec vitest run tests/proofs/contract-conformance.test.ts` | dependency change | plan-time equivalent passed (P3, `pnpm add` form). S02 ck1 runs the frozen form |

**Plan-time probes:**
- **P1** (host, `.program/tmp/conformance-probe/`): Ajv against the oracle snapshots, end-of-fight snapshots on 3 themes, 3 generated packs, 7 fixture packs and an override sample. Every failure was `/combatants/N/hp minimum`, in leg 3b and the 3 end-of-fight snapshots. Everything else validated.
- **P2:** the `ajv` dist-tag `latest` = 8.20.0.
- **P3** (clean copy): the draft test failed on leg 3b before the v1.11 edit and passed after it (14 envelopes, 1 with negative hp). `pnpm typecheck` 0, `eslint` 0, `format:check` 0, whole suite 57/976. `docs-run` 3/3 unchanged.
- **P4** (clean copy): `new Runtime` on `cloneRuntimePack()` with `content.classes.warden.features` throws `PackLoadError` with `[["E-SCHEMA-02","content.classes.warden.features"]]`.
- **P5** (clean copy): negative controls. A snapshot plus `savedAt` is rejected, `hp: 1.5` is rejected, `rng.a = 2^32` is rejected, a pack plus `extra` is rejected, an override with `patch: {}` is rejected, an override with no `target` is rejected. The `database.md` §Override example is accepted. All 7 fixture packs are accepted.

**Pin audit** (grep set: `README.md`, `program/Ruleswright/{specs,mocks,arch}/**`, `PROGRAM-CONFIG.MD`, `tests/`, `src/`, `scripts/`, `.github/`; terms: `minimum: 0`, `hp ≥ 0`/`>= 0`, `hp ≤ 0`, `unfloored`, `snapshots.schema`, `contracts/`, `database.md`, `Version Registry`, `both sample`, `this paragraph and`):

| Hit | Fact | Owner / disposition |
|---|---|---|
| `snapshots.schema.json:192` | `hp minimum 0` | S01 ck1 (changes) |
| `database.md` §Snapshot Envelopes, l.3, Version Registry | no hp row; status v1.10 | S01 ck2 (adds) |
| `README.md:148-151`, `database.md:166`, `mocks/spatial.html:157`, `combatants.ts:12`, `combat.test.ts:287` | "hp ≤ 0 = down" | holds under v1.11; README gains one sentence (S02 ck3) |
| `snapshots/combat.ts:34` | "per-combatant def, verbatim" (TS `hp: number`) | holds: the TS type never had a bound |
| `tests/core/rng.test.ts:62,104`, `tests/snapshots/character.test.ts:2,133`, `src/**` comments | cite the schema by name only | hold; no test reads a contract file (`grep -rn contracts/ tests scripts`: comments only) |
| `README.md:578` | "both sample themes" | stale; S02 ck3 |
| `README.md:588-590` | docs-run checks "this paragraph" | overstatement; S02 ck3 |
| `docs-run.test.ts:50` | exactly 4 ```` ```ts ```` blocks | holds: S02 adds none |
| `docs-run.test.ts:245-246` | README contains both test commands | holds: S02 keeps them verbatim |
| `PROGRAM-CONFIG.MD` Stack *Test* (l.24), Custom Rule 1, *Author Sources*; `arch/v1-core.md:1681` | enumerations of test legs / contract events / follow-ups | final Archivist (DD-K6) |
| `determinism-oracle.ts` `CHARACTERIZATION_DIGESTS`/`PACK_DIGESTS` | behaviour pins | hold: no engine, theme or compiler change; S02 only imports |

**Hazards:**
- **H1:** VERIFICATION.md and every file under `program/Ruleswright/prompts/` are gitignored. `commit_pathspec` refuses them; Orchestrator force-adds with an explicit path (convention `c187bed6`).
- **H2:** `await_subagent_result` idle timeout after ~300 s. Re-await the same handle.
- **H3:** `pnpm test -- <pattern>` does not filter. Use `pnpm exec vitest run <path>`. Never use bare `npx`.
- **H4:** V5/V9 need `pnpm build` first (the `dist/` journeys).
- **H5:** a characterization or `PACK_DIGESTS` change is a regression here, never a re-key.
- **H6:** `pnpm add` needs the network (registry reachable at plan time).
- **H7:** `tsc --preserveSymlinks` is wrong under pnpm. Use the V11 form.
- **H8:** the browser-mode port 63315 allows one run at a time.
- **H9:** `src/schema/contracts/**` is DB-owned. S02 may not perturb it even temporarily; its negative control is in memory.
- **H10:** S01 is an Author session. Orchestrator runs V1–V3 whole-repo at its receive (convention).
- **H11:** `eslint .` collects `.ts`/`.js` scratch under `.program/` (`eslint.config.mjs:17` ignores `program/` only). Scratch goes to `/tmp` (ARCH-PRE F-K6).

## Capability Readiness

| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|----|----|----|----|----|----|----|----|
| CAP-K1 | FR-14/FR-23/FR-2: published contracts admit everything the library writes (3 serializers) and ships (generated + fixture packs); override docs per §Override | writers: `snapshots/{character,combat}.ts` (committed); packs: `generateCampaign`, fixture builders (committed); contracts (DB; v1.11 by S01) | CA-K1, CA-K2; S01 done | S02 ck1 | planned | P1, P3, P5 at `bb61f91` | — |
| CAP-K2 | contract states hp semantics: no lower bound, ≤ 0 down | DB text + schema (S01) | CA-K2 | S01 ck1-2 (contract); proof S02 ck1 | contract landed (S01 `e815e74` schema l.192-195, `bde9781` database.md l.3, l.699-705, row 12 l.822); Ajv proof planned S02 ck1 | P3 (edit form); Orchestrator recheck at `bde9781`: combatant `hp` = `{type: integer, description}`, no `minimum`; `maxHp` keeps `minimum: 0` | proof: S02 ck1 |
| CAP-K3 | FR-2: the runtime refuses the pre-v1.10 location at load | `Runtime` constructor → `validatePack` (committed) | — | S02 ck2 | planned | P4 | — |
| CAP-K4 | NFR-DX: the README states exactly what is proven and what docs-run checks | README (S02), docs-run (S02), `ci.yml` (unchanged) | CA-K3 | S02 ck3 | planned | `ci.yml:54,94`; `coverage-floor.test.ts:34,49` | — |

The first narrow journey is S02 ck1. It runs the real public writers (runtime barrel) and the compiler, takes their JSON text, and checks it with an independent validator against the committed contract files. That is the actual host boundary: a host stores the JSON text. There is no other transport in a headless library.

## Contract Agreements

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|----|----|----|----|----|----|----|----|
| CA-K1 | every published contract admits every writer/shipped artifact | compiler, fixtures, runtime writers → JSON text → Ajv(contract) | SESSION-02 *Contract Agreements* table: 3 generated + 7 fixture packs; 14 oracle envelopes + 6 per-theme; 2 override docs; JSON round-trip first; non-strict draft 2020 | producer + proof S02 ck1 | agreed | ready (committed writers) | planned (P1/P3 observed) |
| CA-K2 | combatant `hp`: integer, **no lower bound**; damage unfloored; hp ≤ 0 = down; written/restored as-is; `maxHp` keeps `minimum: 0` | engine `applyMutation` → `serializeCombat` → `snapshots.schema.json` | schema l.192 loses `minimum: 0`, gains a description; `database.md` v1.11 block + row 12 | correction S01 ck1-2 (DB); proof S02 ck1 (`some(hp<0)` valid; in-memory `minimum: 0` copy rejects; `1.5` rejects) | agreed (DD-K1); no wording delta (S01 handoff) | **ready** — S01 ck1 `e815e74` (schema), ck2 `bde9781` (database.md); Orchestrator recheck at `bde9781` passed (no `minimum` on combatant `hp`; pack/override schemas unchanged) | planned (S02 ck1) |
| CA-K3 | README CI/docs-run claims are enforced | README ↔ docs-run ↔ `ci.yml` | README names `tests/proofs/contract-conformance.test.ts`; the file exists; `ci.yml` has `- run: pnpm test` and `- run: pnpm exec vitest run tests/proofs/`; the existing browser/Electron pins kept | S02 ck3 | agreed | planned | planned |

## Current Blockers

- **None for this feature.** No human decision is pending (DD-K1 is on record).
- **B-BD-1** (carried, non-blocking): GitHub Actions execution awaits the human push. Owner: the human, then the next Orchestrator/Archivist run.
- ARCH-PRE planning-completeness ran at `51839fe` (see *Planning Completeness Review — ARCH-PRE*): D3/D4 fail, both closed before dispatch (DD-K6a, H-R1; S02 amendments A1–A5). Nothing blocks S01. S02 waits on S01 (CA-K2) only.

## Preflight — D1–D7 (advisory, Planner self-check; Archivist scores)

- **D1 requirement coverage:** the feature's scope is CAP-K1…K4. Each is routed to exactly one session and checkpoint (table above). The inherited items each have a disposition (*Scope Summary*). FR-14/FR-23 conformance is CAP-K1; the hp contract text is CAP-K2.
- **D2 fact origins:** every subject comes from a committed producer at a cited line: `LEG_RUNS` (`determinism-oracle.ts:351`), `PACK_THEMES` (`:412`), the fixture builders (`packs.ts:43/232/249/303/315`, `pack.ts:183`, `schema/fixtures.ts:158`) and `PackLoadError.errors` (`runtime.ts:55-56`). The one planned fact is the v1.11 schema (S01 ck1).
- **D3 ownership:** contract correction is S01 (DB, human-authorized). Proofs are S02 ck1-3. Archivist record items are DD-K6. B-BD-1 belongs to the human.
- **D4 lease coverage:** S01 and S02 Owns are disjoint and run serially anyway. Every file in each Files table is in its Owns. `ci.yml` is deliberately unleased (DD-K4). The weakest point is that S02 ck3's docs-run pin assumes `ci.yml:54,94` keep their exact `- run:` text; nothing in this feature changes them.
- **D5 declared vs real dependencies:** S02 → S01 is real. CA-K2's proof needs the committed v1.11 schema, and P3 showed the pre-v1.11 schema fails it.
- **D6 early integration:** S02 ck1 is the journey: public writers → JSON text → independent validator → committed contract. It is a test-only feature, so there is no UI or IPC transport.
- **D7 runtime wiring:** no new interface. The only new code is a test, which CI collects through two existing run steps (pinned by CA-K3).

## Planning Completeness Review — ARCH-PRE (Orchestrator-recorded, 2026-10-11)

- **Reviewed plan revision:** `51839fe` (STATE, MASTER, SESSION-01, SESSION-02). **Source revision:** `51839fe` (= `bb61f91` for `src`, `tests`, `README.md`, `package.json`, `pnpm-lock.yaml`, `.github`, `program/Ruleswright/specs`).
- **Reviewer:** Archivist, planning-completeness mode, read-only; clean-copy probe in `/tmp/ruleswright-contract-conformance-pre/` (V11 form + `pnpm add -D -E ajv@8.20.0` + S01's exact ck1 `hp` text).

| # | Dimension | Verdict | Evidence (summary) | Waves reached |
|---|---|---|---|---|
| D1 | requirement coverage | pass | CAP-K1..K4 each routed once; every inherited row dispositioned | — |
| D2 | fact origins | pass | all cited symbols exist at cited lines; probe: 14 envelopes, leg-7[0] array, leg-3b only `hp:-7` | — |
| D3 | ownership | **fail** | DD-K6 omitted PROGRAM-CONFIG Custom Rule 5 ("both directions") and Stack *Runtime deps* "no zod/ajv"; `ci.yml:23-24,111`, `coverage-floor.test.ts:509,582` unowned (F-K3) | none (final-Archivist list only) — **closed** by DD-K6a + H-R1 below |
| D4 | lease coverage | **fail (S02 ck3)** | ck3 step 4 in-place negative controls for the `ci.yml` regexes would edit unleased `ci.yml` (F-K2) | W2/S02 — **closed** by envelope amendment A2 |
| D5 | declared vs real dependencies | pass | committed schema rejects leg-3b on `hp >= 0`; after S01 text valid | — |
| D6 | early integration | pass | public writers + compiler → JSON text → Ajv vs committed contracts | — |
| D7 | runtime wiring | n/a | no new production interface; test collected by `vitest.config.ts`, `ci.yml:54,94` (regexes match exactly) | — |

**Findings and dispositions:**

| Finding | Class | Disposition |
|---|---|---|
| F-K1 README conformance sentence overclaims ("every … pack", "every snapshot", "published"); schemas are not in the npm `files` list (`package.json:40-43`) | blocking S02 ck3 | **S02 envelope amendment A1** (prescribed sentence replaced; ck1 header comment held to the same rule) |
| F-K2 in-place `ci.yml` negative controls outside lease | blocking S02 ck3 (D4) | **S02 envelope amendment A2** (controls in memory; `git diff --quiet -- .github` clean throughout) |
| F-K3 enumeration/doc pins missing from DD-K6 | informational (D3) | **DD-K6a** + **S02 amendment A3** (docs-run header comment l.22-26) + residual **H-R1** (owned) |
| F-K4 `serializeCharacter(runtime, state)` / `serializeParty(runtime, members)`; character constructor unnamed | informational | **S02 envelope amendment A4** (CA-K1 mapping corrected) |
| F-K5 negative controls assert only failure, not the failing rule | informational | **S02 envelope amendment A5** (assert `instancePath` + `keyword`) |
| F-K6 `eslint .` collects `.program/` scratch (`eslint.config.mjs:17`) | informational | **H11** added below |

- **DD-K6a (amends DD-K6; final Archivist also owns):** PROGRAM-CONFIG Custom Rule 5's sentence that `docs-run` checks README ↔ `ci.yml` "in both directions" (narrow to what S02 ck3 states), and the Stack *Runtime deps* row "no zod/ajv" (say *runtime*; Ajv 8.20.0 is a dev-only test dependency, consistent with `requirements.md:249`, `architecture.md:44`).
- **H-R1 (owned residual, carried):** `ci.yml:23-24` (header comment "checks both directions"), `ci.yml:111` (step name "both themes to the coverage floor"), `tests/compiler/coverage-floor.test.ts:509,582` (titles "both theme(s)"). Unleased in this feature. Owner: Planner, the next feature touching `ci.yml` / `tests/compiler`.
- **H11 (hazard):** `eslint.config.mjs:17` ignores `program/` but not `.program/`; `pnpm lint` collects `.ts`/`.js` scratch under `.program/`. All scratch goes to `/tmp`. Observed at run start: Planner's `.program/tmp/conformance-probe/` made V2 red; Orchestrator moved it (preserved) to `/tmp/rw-contract-conformance-planner-probe/`. A config fix belongs to a future lease owning `eslint.config.mjs`.
- **S02 envelope amendments (binding; inside S02's lease; rendered into its envelope at dispatch):**
  - **A1 (F-K1):** README ck3 step 2 sentence becomes: "`tests/proofs/contract-conformance.test.ts` checks the three bundled themes' generated packs (seed 42), the seven fixture packs, the snapshot envelopes from the determinism oracle's nine combat legs plus a level-1 character and party per theme, and two override documents against the JSON Schema contracts in `src/schema/contracts/` (repository files, not shipped in the npm package), with an independent validator (Ajv, a dev dependency only); it runs in the Node matrix and in the package job." Equivalent wording is acceptable if every quantifier matches a subject list in the test. The ck1 header comment states no broader claim.
  - **A2 (F-K2):** ck3 negative controls: in place only for the README mention (rename, see fail, restore, `git diff` clean); the two `ci.yml` regexes are controlled in memory (apply each regex to `ci` with its line removed, expect no match); `existsSync` against a wrong filename. Never edit `.github/**`; `git diff --quiet -- .github` stays clean throughout.
  - **A3 (F-K3):** ck3 also narrows `docs-run.test.ts`'s header comment (l.22-26, "in both directions") to what the `it` actually enforces.
  - **A4 (F-K4):** CA-K1 per-theme subjects: build the runtime over the generated pack as the oracle does, then `rt.createCharacter({ name, race: Object.keys(rt.pack.content.races ?? {})[0]!, classes: [{ id: <first class id>, level: 1 }] }).state` (pattern of `determinism-oracle.ts:135-137`); snapshots `serializeCharacter(rt, state)` and `serializeParty(rt, [state])` (`snapshots/character.ts:104,114`).
  - **A5 (F-K5):** each negative control (and the CA-K2 regression control and `hp: 1.5`) also asserts the failing rule: `validate.errors?.some(e => e.instancePath === '<path>' && e.keyword === '<keyword>')` (probe after v1.11: `/rng/a` `maximum`; `/combatants/0/hp` `type`; root `additionalProperties` for `savedAt`; `/combatants/1/hp` `minimum` for the regression copy; analogous for the pack `extra`, override `patch: {}` `minProperties`, missing `target` `required`).

## Handoff Notes

<!-- Orchestrator appends each session's notes / followUp here, verbatim. -->

### SESSION-01 — received 2026-10-11 (handle h-H6RH; Orchestrator: 2 checkpoint commits in lease, V1–V3 0, CA-K2 recheck passed)

Contract v1.11 is landed: combat snapshots now accept a combatant `hp` with no lower bound, and `database.md` documents it. Both checkpoints are committed. The build passes, and tests are unchanged at 56 files and 974/974.

## Handoff

- **session:** SESSION-01 (contract-conformance), Author re-entry, DB role, schema-change class, lease revision 1
- **status:** complete
- **checkpoint:** 2 of 2
  - ck1 `e815e74` — combatant hp has no lower bound (v1.11)
  - ck2 `bde9781` — database.md v1.11 text and Version Registry row 12
- **notes:**
  - Authorization quoted from the record: the human answered "**a yes**" (DD-K1, option A).
  - Contract v1.11 is a pre-release in-place revision. `schemaVersion` and `snapshotVersion` stay 1. It only loosens a constraint, so it needs no rule id and no compatibility caveat.
  - Checkpoint-0 recheck passed on every item:
    - `git diff --quiet bb61f91` over the contracts and `database.md` was clean.
    - `"hp"` sat at l.189 (`required`) and l.192.
    - There was no row 12, and row 11 was at l.813.
    - Line 3 started `> **Status:** v1.10, revised`.
  - I read the code before writing the text. It matches CA-K2:
    - `combatants.ts:13-15`: `isDowned` is `hp.current <= 0`.
    - `combatants.ts:80-92`: damage is `current - amount` and is never floored. Heals never go above `maxHp` and never lower hp.
    - `snapshots/combat.ts:131`: the writer emits `hp: combatant.hp.current`.
    - `snapshots/combat.ts:212`: restore reads `frozenState.hp` as-is.
    - `snapshots/combat.ts:547-552`: the end rule is `hp ≤ 0`.
  - The "never blocks movement (§spatial)" claim is backed by existing `database.md` l.166 ("downed combatants (hp ≤ 0) never block").
  - Exact `hp` JSON committed (after `prettier --write`, which made no further change):
    ```json
    "hp": {
      "type": "integer",
      "description": "v1.11 — current hit points, no lower bound. Damage is not floored: hp <= 0 means down (no turns, no trigger offers, never blocks movement; the end rule). Written as-is; restored as-is. The heal cap is maxHp."
    },
    ```
    It sits at `snapshots.schema.json` l.192-195. `required: ["id", "hp"]`, `maxHp` `minimum: 0` and everything else are untouched.
  - Line numbers in `database.md`:
    - The Status line (l.3) now starts `> **Status:** v1.11, revised`.
    - The new *v1.11 — combatant `hp`* block is l.699-705, followed by a blank l.706. "Note the deliberate asymmetry" moved to l.707.
    - Version Registry row 11 moved to l.821. Row 12 is l.822.
  - **CA-K2 wording delta: none.** CA-K2 and DD-K1 are transcribed exactly as STATE maps them.
- **delivered:**
  - The CAP-K2 contract text: the schema's `hp` constraint is loosened and documented.
  - The CA-K2 producer side is landed and ready for Orchestrator's recheck before S02.
- **verification:**
  - The schema parses as JSON (exit 0).
  - `pnpm exec prettier --check src/schema/contracts/snapshots.schema.json` passes.
  - `git diff bb61f91 -- src/schema/contracts/` touches only the combatant `hp` entry. `pack.schema.json` and `override.schema.json` are byte-identical.
  - `git diff --name-only bb61f91..HEAD -- src program/Ruleswright/specs` lists exactly the two Owns paths.
  - Each `git show --name-only HEAD` listed only lease paths.
  - `grep -c '^| 12 | 1 (v1.11)'` = 1.
  - `pnpm build`: success.
  - `pnpm test`: 56 files, 974/974 passed. Unchanged, so no finding.
  - The tree is clean.
- **surprises:** none.
- **followUp:**
  - For the final Archivist: PROGRAM-CONFIG Custom Rule 1 needs the v1.11 event added.
  - For the final Archivist: *Author Sources → Data source* should name v1.11.
  - For S02: the Ajv proof that v1.11 admits leg 3b (`$.combatants[1].hp = -7`) and the fights to the end on each bundled theme. S02 checkpoint 1 owns this as CA-K2 proof owner.
- **deviations:**
  - SESSION-01.md shows the new block with a leading `> `. I wrote it as a plain paragraph starting with a bold label, wrapped at about 90 columns, to match the nearby `**v1.4 fields**` paragraphs. The wording is unchanged.
  - The envelope says scratch goes in `/tmp/ruleswright-contract-conformance-s01/`, but the write tool refuses paths outside the repo. I did the edits with inline `node -e` instead, so no scratch file was created anywhere.
  - The ck1 commit used a pathspec over both Owns paths, as SESSION-01.md asks. Only the schema file had changes, so only it is in the commit.
- **needsOwnerCorrection:** none
- **needsDesignSource:** none
- **blockedReason:** —
- **filesTouched:**
  - `src/schema/contracts/snapshots.schema.json`
  - `program/Ruleswright/specs/database.md`
