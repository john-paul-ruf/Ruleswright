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
| S02 | Contract conformance proof, old-location refusal, honest docs | tests, M05 | `tests/proofs/contract-conformance.test.ts`, `tests/runtime/features.test.ts`, `tests/proofs/docs-run.test.ts`, `package.json`, `pnpm-lock.yaml`, `README.md` | done | 3/3 (`8e8c032`, `ae5b595`, `bd4f753`) | 2026-10-11 | amendments A1–A5 applied; R1 in-lease (docs-run inline comment); Orchestrator V1–V7, V9 0 at receive (57 files / 1017) |

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
| CAP-K1 | FR-14/FR-23/FR-2: published contracts admit everything the library writes (3 serializers) and ships (generated + fixture packs); override docs per §Override | writers: `snapshots/{character,combat}.ts` (committed); packs: `generateCampaign`, fixture builders (committed); contracts (DB; v1.11 by S01) | CA-K1, CA-K2; S01 done | S02 ck1 | **verified** (S02 ck1 `8e8c032`) | Orchestrator at `bd4f753`: `pnpm exec vitest run tests/proofs/contract-conformance.test.ts` 42/42 (3 generated + 7 fixture packs, 14 oracle + 6 per-theme envelopes, 2 override docs, 5 negative controls asserting instancePath+keyword); V5 57/1017; V9 Electron 57/1017; worker V11 clean copy 0 | CI execution via `ci.yml:54,94` awaits B-BD-1 (human push) |
| CAP-K2 | contract states hp semantics: no lower bound, ≤ 0 down | DB text + schema (S01) | CA-K2 | S01 ck1-2 (contract); proof S02 ck1 | **verified** — contract S01 `e815e74`/`bde9781`; Ajv proof S02 ck1 `8e8c032` (leg-3b[0] wolf hp -7 valid; in-memory `minimum: 0` copy rejects at `/combatants/1/hp` minimum; `1.5` rejects at `/combatants/0/hp` type) | P3 (edit form); Orchestrator recheck at `bde9781`: combatant `hp` = `{type: integer, description}`, no `minimum`; `maxHp` keeps `minimum: 0` | — |
| CAP-K3 | FR-2: the runtime refuses the pre-v1.10 location at load | `Runtime` constructor → `validatePack` (committed) | — | S02 ck2 | **verified** (S02 ck2 `ae5b595`) | `tests/runtime/features.test.ts` 6/6 at `bd4f753`; card list exactly `[[E-SCHEMA-02, content.classes.warden.features]]` | — |
| CAP-K4 | NFR-DX: the README states exactly what is proven and what docs-run checks | README (S02), docs-run (S02), `ci.yml` (unchanged) | CA-K3 | S02 ck3 | **verified** locally (S02 ck3 `bd4f753`) | README l.151-152, 579, 581-586 (A1 wording), 595-599; `docs-run.test.ts` 3/3 pins README names the file, file exists, `ci.yml` `- run: pnpm test` and `- run: pnpm exec vitest run tests/proofs/`; negative controls in memory for ci regexes (A2), `.github` untouched | H-R1 residual (`ci.yml:23-24,111`, coverage-floor titles; owner Planner, next feature touching ci.yml/tests/compiler) |

The first narrow journey is S02 ck1. It runs the real public writers (runtime barrel) and the compiler, takes their JSON text, and checks it with an independent validator against the committed contract files. That is the actual host boundary: a host stores the JSON text. There is no other transport in a headless library.

## Contract Agreements

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|----|----|----|----|----|----|----|----|
| CA-K1 | every published contract admits every writer/shipped artifact | compiler, fixtures, runtime writers → JSON text → Ajv(contract) | SESSION-02 *Contract Agreements* table: 3 generated + 7 fixture packs; 14 oracle envelopes + 6 per-theme; 2 override docs; JSON round-trip first; non-strict draft 2020 | producer + proof S02 ck1 | agreed | ready (committed writers) | **proven** S02 ck1 `8e8c032` (all subjects valid, count 14, kinds character/party/combat) |
| CA-K2 | combatant `hp`: integer, **no lower bound**; damage unfloored; hp ≤ 0 = down; written/restored as-is; `maxHp` keeps `minimum: 0` | engine `applyMutation` → `serializeCombat` → `snapshots.schema.json` | schema l.192 loses `minimum: 0`, gains a description; `database.md` v1.11 block + row 12 | correction S01 ck1-2 (DB); proof S02 ck1 (`some(hp<0)` valid; in-memory `minimum: 0` copy rejects; `1.5` rejects) | agreed (DD-K1); no wording delta (S01 handoff) | **ready** — S01 ck1 `e815e74` (schema), ck2 `bde9781` (database.md); Orchestrator recheck at `bde9781` passed (no `minimum` on combatant `hp`; pack/override schemas unchanged) | **proven** S02 ck1 `8e8c032` |
| CA-K3 | README CI/docs-run claims are enforced | README ↔ docs-run ↔ `ci.yml` | README names `tests/proofs/contract-conformance.test.ts`; the file exists; `ci.yml` has `- run: pnpm test` and `- run: pnpm exec vitest run tests/proofs/`; the existing browser/Electron pins kept | S02 ck3 | agreed | **landed** S02 ck3 `bd4f753` | **proven** S02 ck3 `bd4f753` (docs-run 3/3; README A1 sentence) |

## Current Blockers

- **None for this feature.** No human decision is pending (DD-K1 is on record).
- **B-BD-1** (carried, non-blocking): GitHub Actions execution awaits the human push. Owner: the human, then the next Orchestrator/Archivist run. VERIFY-01 (`9c8cdc3`) row "CAP-K1/K4 CI leg" is present-unverified on this account.
- **H-R1** (owned residual, carried): `ci.yml:23-24,111`, `coverage-floor.test.ts:509,582` "both" wording. Owner: Planner, next feature touching `ci.yml`/`tests/compiler`.
- **VERIFY-01 note (informational, carried):** README l.581-589 calls the oracle's nine legs "combat legs"; `leg-8` is a character leg (pre-existing name, l.589). Owner: Planner, next feature touching README determinism/CI prose.
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

### SESSION-02 — received 2026-10-11 (handle h-t0-R; Orchestrator: 3 checkpoint commits in lease, V1–V7 0, V5 57/1017, V9 57/1017, scoped 3 files 51/51)

All three checkpoints of SESSION-02 are committed and every required gate passed. The full suite is now 57 files and 1017 tests (974 + 43), and nothing in `src/` or `.github/` changed.

- **Checkpoint 1 (`8e8c032`):** a new test checks 42 named subjects with an independent validator (Ajv 8.20.0) against the three JSON Schema files. The subjects are 10 packs, 20 snapshot envelopes and 2 override documents. Every one is valid.
  - The determinism oracle yields exactly 14 envelopes.
  - The negative-hp envelope is `leg-3b[0]` (wolf at hp -7). It is accepted by the current schema and rejected by an in-memory copy with the old `minimum: 0` limit.
- **Checkpoint 2 (`ae5b595`):** a test confirms that loading a pack with the old class-features location throws `PackLoadError` with exactly one error card, for that path.
- **Checkpoint 3 (`bd4f753`):** three README edits, plus new checks in `docs-run` that keep the README's conformance claim honest.
  - Sentence about negative hp: line 151–152.
  - "all three sample themes": line 579.
  - Conformance sentence (the amendment A1 wording): lines 581–586.
  - Narrowed `docs-run` sentence: lines 595–599.

Every negative control was checked to fail on its specific rule, not just to fail. The two `ci.yml` checks were tested in memory, so `.github` was never edited.

One deviation from the prompt: besides the header comment I was asked to narrow, I also narrowed the matching "both directions" inline comment in `docs-run.test.ts`. It sits inside my lease and makes the same overclaim.

## Handoff

- **session:** SESSION-02 (contract-conformance)
- **status:** done
- **checkpoint:** 3 (ck1 `8e8c032`, ck2 `ae5b595`, ck3 `bd4f753`); lease revision 1
- **notes:** S02 done 3/3 (`8e8c032`, `ae5b595`, `bd4f753`). CAP-K1 proven, as producer and integrator. CA-K1: 3 generated + 7 fixture packs, 14 oracle envelopes covering character/party/combat, 6 per-theme envelopes and 2 override documents are all valid under Ajv 8.20.0 (`ajv/dist/2020`, `strict: false`, `allErrors: true`) against the committed `src/schema/contracts/*.schema.json`. CA-K2 proven: the negative-hp subject is `leg-3b[0]`, combatants `[[hexer,29],[wolf,-7],[shade,9]]`. It is valid under v1.11. The in-memory `minimum: 0` copy rejects it at `/combatants/1/hp` `minimum`, and `hp: 1.5` rejects at `/combatants/0/hp` `type`. CAP-K3 proven: `new Runtime` gives `[['E-SCHEMA-02','content.classes.warden.features']]`. CAP-K4 / CA-K3 proven: the README states the claim and docs-run pins it. README line numbers after the edit: hp sentence l.151-152; "all three sample themes" l.579; conformance sentence (A1 wording) l.581-586; narrowed docs-run sentence l.595-599.
- **delivered:**
  - `ajv@8.20.0`, exact pin, devDependency only. No `dependencies` block was added. `ajv@6.15.0` is kept in the lockfile.
  - `tests/proofs/contract-conformance.test.ts`, 42 tests:
    - pack: 3 generated + 7 fixture packs;
    - snapshots: a count/kinds check, 14 oracle envelopes, a 6-count check and 6 per-theme envelopes (A4: `serializeCharacter(rt, state)`, `serializeParty(rt, [state])`);
    - CA-K2: valid, the regression control, and 1.5 rejected;
    - 2 override documents;
    - 5 negative controls. Each asserts its `instancePath` + `keyword` (A5): `''` additionalProperties for `savedAt`; `/rng/a` maximum; pack root `''` additionalProperties; `/overrides/0/patch` minProperties; `/overrides/0` required.
    - The header comment lists only the named subjects (A1).
  - The `features.test.ts` old-location refusal case.
  - README: the hp sentence, "all three sample themes", the A1 conformance sentence, and the narrowed docs-run sentence.
  - `docs-run.test.ts`: four new assertions, the `existsSync` import, and the header comment narrowed (A3).
- **verification:**
  - Each checkpoint:
    - V1 `pnpm typecheck` 0, V2 `pnpm lint` 0, V3 `pnpm format:check` 0.
    - ck1: `pnpm exec vitest run tests/proofs/contract-conformance.test.ts` gave 1 file / 42 passed.
    - ck2: `pnpm exec vitest run tests/runtime/features.test.ts` gave 1 file / 6 passed.
    - ck3: `pnpm exec vitest run tests/proofs/docs-run.test.ts` gave 1 file / 3 passed.
  - V11 transcript (`/tmp/rw-contract-conformance`, copy made with `git ls-files -co` + tar; no `node_modules` or `dist` in the copy):
    - copy 0
    - `pnpm install --frozen-lockfile` 0
    - `pnpm build` 0
    - `pnpm typecheck` 0
    - `pnpm exec vitest run tests/proofs/contract-conformance.test.ts` 0, 42/42
  - ck3:
    - V4 `pnpm build` 0
    - V5 `pnpm test` 0: "Test Files 57 passed (57) / Tests 1017 passed (1017)" (974 + 42 + 1)
    - V6 `pnpm check:isolation` 0
    - V7 `pnpm check:security` 0
    - V9 `pnpm build && pnpm test:electron` 0: "Test Files 57 passed (57) / Tests 1017 passed (1017)"
    - V8 `pnpm test:browser` 0: 6 files / 74 tests ×3 engines. Port 63315 was free before the run and released after it.
    - Determinism oracle digests are unchanged; the oracle suites pass inside V5 and V9 (H5).
  - Negative controls:
    - **In-test mutation:** wrong expected path `/rng/b` and wrong keyword `type` for the missing target made exactly those 2 tests fail; the file was restored afterwards and gives 42/42.
    - **README, in place:** renamed the mention, docs-run failed on `toContain('tests/proofs/contract-conformance.test.ts')`. Restored it; the shasum matches the pre-control state.
    - **`ci.yml` regexes, in memory:** each matches once in `ci`, and neither matches with its `- run:` line removed.
    - **`existsSync`:** the wrong filename gives false.
  - `git diff --quiet 70164df -- src .github` is clean. Every `git show --name-only HEAD` listed lease paths only.
- **surprises:**
  - ck1's first typecheck failed with TS2677 on the envelope filter's type guard, because the template-literal key type was inferred narrowly. I fixed it before committing by annotating the map's return tuple as `readonly [string, unknown]`.
  - The README names the conformance file exactly once, so the single in-place rename is enough to fail docs-run.
- **deviations:**
  - **rule:** R1
    **checkpoint:** 3
    **paths:** `tests/proofs/docs-run.test.ts`
    **reason:** Besides the A3 header comment, I narrowed the inline comment "CI-claim honesty (NFR-DX), both directions" to "the README names these legs and files, and ci.yml runs them". It carried the same overclaim, and the file is in-lease.
- **followUp:**
  - For the final Archivist (DD-K6/DD-K6a):
    - PROGRAM-CONFIG Stack *Test* row: add the conformance proof (`ajv@8.20.0`, dev-only).
    - Stack *Runtime deps*: change "no zod/ajv" to say *runtime*.
    - Custom Rule 1: add the v1.11 event.
    - Custom Rule 5: narrow "in both directions" to match the README l.595-599 wording.
    - *Author Sources*: v1.11.
    - `arch/v1-core.md`: retire "byte-level snapshot conformance" from the v1.1 follow-ups. Schema conformance is now proven; byte-level round-trip stays as recorded. Also retire the class-features old-location hardening and the README docs-run overstatement from the residuals.
  - H-R1 is still carried: `ci.yml:23-24,111` and `coverage-floor.test.ts:509,582` say "both".
  - B-BD-1 is still carried: the CI execution of the new file through `ci.yml:54,94` is unverified until the first push.
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:**
  - `tests/proofs/contract-conformance.test.ts`
  - `package.json`
  - `pnpm-lock.yaml`
  - `tests/runtime/features.test.ts`
  - `README.md`
  - `tests/proofs/docs-run.test.ts`

### VERIFY-01 — received 2026-10-11 (handle h-XEny; 20 verified, 1 present-unverified, 0 failed, 0 blocked; VERIFICATION.md committed unchanged by Orchestrator at `9c8cdc3`, sha256 35310b48… matched)

Verification found no failures: 20 of the 21 rows are `verified`, and only the CI row is `present-unverified`. VERIFICATION.md is written but **not committed**. `commit_pathspec` refused it because `program/Ruleswright/prompts/` is gitignored (`.gitignore:29`), which is the hazard the prompt warned about. You need to commit it unchanged with `git add -f` and that exact path.

- **Tests I ran:**
  - the three relevant test files: 51 of 51 pass;
  - after `pnpm build`, the whole suite: 57 files, 1017 of 1017 pass;
  - the same 1017 under Electron 44.7.0: all pass;
  - typecheck, lint, format, isolation and security checks: all exit 0.
- **The tests can fail:** six scratch mutations and in-memory checks each made the targeted test fail. The three edited files were restored and `cmp`-confirmed. Nothing in `src/schema/contracts/**` or `.github/**` was touched, and the tree is clean apart from VERIFICATION.md.
- **CI row:** I could not observe any GitHub Actions run on this host, so the run of the new test file through `ci.yml:54,94` is unproven (B-BD-1).
- **README wording:** "nine combat legs" reuses the README's existing name for the determinism oracle, but `leg-8` is a character leg. The test does take all nine legs, so I did not count this as an overclaim.

## Handoff

- **session:** VERIFY-01 (contract-conformance)
- **status:** done
- **checkpoint:** 1 (single artifact; commit refused by gitignore, see notes)
- **notes:** VERIFICATION.md written at HEAD `07ba8c8`, **not committed**: `commit_pathspec` returned `GIT_FAILED` on `git add`, and `git check-ignore` shows `.gitignore:29:/program/Ruleswright/prompts/` (hazard H1). Orchestrator should commit it unchanged with `git add -f -- program/Ruleswright/prompts/contract-conformance/VERIFICATION.md` and an explicit pathspec commit. Verdict counts: verified 20, present-unverified 1, failed 0, blocked 0. Verified rows: CAP-K1, CAP-K2, CAP-K3, CAP-K4 (local), CA-K1, CA-K2, CA-K3, DD-K1, A1–A5, FR-14, FR-23, FR-2, NFR-DX, database.md v1.11 vs schema l.192-195, ajv dependency, determinism digests. Present-unverified: the CI leg through `ci.yml:54,94` (B-BD-1).
- **delivered:** a 21-row six-column table, a run log (R1–R7) and a negative-control log (N1–N6).
- **verification:**
  - R1 `pnpm exec vitest run` on the three relevant test files: 3 files / 51 tests (42 + 6 + 3), exit 0.
  - R2 verbose run of the conformance file: 42/42, every title read.
  - R3 `pnpm build && pnpm test`: 57 files / 1017 tests passed.
  - R4 typecheck, lint, format:check, check:isolation, check:security: all 0.
  - R5 `pnpm build && pnpm test:electron` (Electron 44.7.0): 57 files / 1017 tests passed.
  - R6 characterization + pack-identity: 2 files / 12 tests passed.
  - R7 `tests/snapshots`: 3 files / 63 tests passed.
  - N1 removing the regression `minimum` and N2 a wrong keyword for `rng.a`: 2 failed / 40 passed.
  - N3 a positive override doc changed to `patch: {}`: 1 failed.
  - N4 `featuresX` in place of `features`: 1 failed.
  - N5 README mention renamed: docs-run 1 failed.
  - N6 in-memory ci regexes: `true true false false`.
  - After the controls, all three files were restored, `cmp` was identical, and `git status` was clean.
  - `git diff bb61f91..HEAD -- src` lists only `snapshots.schema.json`; `.github` and the digest files show no diff.
- **surprises:**
  - The commit was refused because the path is gitignored (expected, H1).
  - "nine combat legs" in the README A1 sentence reuses the existing name for the oracle (README l.589), but `leg-8` is a character leg. The test does take all 9 legs, so this is not an overclaim. Recorded in the A1 row.
  - The browser leg (V8) was not run; it does not collect the new file.
  - I did not re-run V11 (the clean-copy frozen install); I relied on S02's report.
- **deviations:** —
- **followUp:**
  - B-BD-1: CI execution of `tests/proofs/contract-conformance.test.ts` through `ci.yml:54` (test matrix) and `:94` (package job) stays unproven until the human pushes. Then the next Orchestrator/Archivist run checks it.
  - Final Archivist items DD-K6/DD-K6a and residual H-R1 stay as recorded in STATE.
  - Scratch backups remain in `/tmp/ruleswright-contract-conformance-verify/`, outside the repo.
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:**
  - `program/Ruleswright/prompts/contract-conformance/VERIFICATION.md` (written, uncommitted: gitignored)
