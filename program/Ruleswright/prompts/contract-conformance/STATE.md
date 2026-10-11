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
| S01 | DB re-entry: contract v1.11 — combatant hp has no lower bound | — (DB) | `program/Ruleswright/specs/database.md`, `src/schema/contracts/snapshots.schema.json` | pending | — | — | Author session; authorization quoted in envelope |
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

## Capability Readiness

| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|----|----|----|----|----|----|----|----|
| CAP-K1 | FR-14/FR-23/FR-2: published contracts admit everything the library writes (3 serializers) and ships (generated + fixture packs); override docs per §Override | writers: `snapshots/{character,combat}.ts` (committed); packs: `generateCampaign`, fixture builders (committed); contracts (DB; v1.11 by S01) | CA-K1, CA-K2; S01 done | S02 ck1 | planned | P1, P3, P5 at `bb61f91` | — |
| CAP-K2 | contract states hp semantics: no lower bound, ≤ 0 down | DB text + schema (S01) | CA-K2 | S01 ck1-2 (contract); proof S02 ck1 | planned | P3 (edit form) | — |
| CAP-K3 | FR-2: the runtime refuses the pre-v1.10 location at load | `Runtime` constructor → `validatePack` (committed) | — | S02 ck2 | planned | P4 | — |
| CAP-K4 | NFR-DX: the README states exactly what is proven and what docs-run checks | README (S02), docs-run (S02), `ci.yml` (unchanged) | CA-K3 | S02 ck3 | planned | `ci.yml:54,94`; `coverage-floor.test.ts:34,49` | — |

The first narrow journey is S02 ck1. It runs the real public writers (runtime barrel) and the compiler, takes their JSON text, and checks it with an independent validator against the committed contract files. That is the actual host boundary: a host stores the JSON text. There is no other transport in a headless library.

## Contract Agreements

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|----|----|----|----|----|----|----|----|
| CA-K1 | every published contract admits every writer/shipped artifact | compiler, fixtures, runtime writers → JSON text → Ajv(contract) | SESSION-02 *Contract Agreements* table: 3 generated + 7 fixture packs; 14 oracle envelopes + 6 per-theme; 2 override docs; JSON round-trip first; non-strict draft 2020 | producer + proof S02 ck1 | agreed | ready (committed writers) | planned (P1/P3 observed) |
| CA-K2 | combatant `hp`: integer, **no lower bound**; damage unfloored; hp ≤ 0 = down; written/restored as-is; `maxHp` keeps `minimum: 0` | engine `applyMutation` → `serializeCombat` → `snapshots.schema.json` | schema l.192 loses `minimum: 0`, gains a description; `database.md` v1.11 block + row 12 | correction S01 ck1-2 (DB); proof S02 ck1 (`some(hp<0)` valid; in-memory `minimum: 0` copy rejects; `1.5` rejects) | agreed (DD-K1) | planned (S01) — **provisional against S01 ck1**; Orchestrator rechecks the committed `hp` entry before dispatching S02 | planned |
| CA-K3 | README CI/docs-run claims are enforced | README ↔ docs-run ↔ `ci.yml` | README names `tests/proofs/contract-conformance.test.ts`; the file exists; `ci.yml` has `- run: pnpm test` and `- run: pnpm exec vitest run tests/proofs/`; the existing browser/Electron pins kept | S02 ck3 | agreed | planned | planned |

## Current Blockers

- **None for this feature.** No human decision is pending (DD-K1 is on record).
- **B-BD-1** (carried, non-blocking): GitHub Actions execution awaits the human push. Owner: the human, then the next Orchestrator/Archivist run.
- An Archivist planning-completeness pass before S01 is recommended (the convention used by the last five cycles). It is not blocking.

## Preflight — D1–D7 (advisory, Planner self-check; Archivist scores)

- **D1 requirement coverage:** the feature's scope is CAP-K1…K4. Each is routed to exactly one session and checkpoint (table above). The inherited items each have a disposition (*Scope Summary*). FR-14/FR-23 conformance is CAP-K1; the hp contract text is CAP-K2.
- **D2 fact origins:** every subject comes from a committed producer at a cited line: `LEG_RUNS` (`determinism-oracle.ts:351`), `PACK_THEMES` (`:412`), the fixture builders (`packs.ts:43/232/249/303/315`, `pack.ts:183`, `schema/fixtures.ts:158`) and `PackLoadError.errors` (`runtime.ts:55-56`). The one planned fact is the v1.11 schema (S01 ck1).
- **D3 ownership:** contract correction is S01 (DB, human-authorized). Proofs are S02 ck1-3. Archivist record items are DD-K6. B-BD-1 belongs to the human.
- **D4 lease coverage:** S01 and S02 Owns are disjoint and run serially anyway. Every file in each Files table is in its Owns. `ci.yml` is deliberately unleased (DD-K4). The weakest point is that S02 ck3's docs-run pin assumes `ci.yml:54,94` keep their exact `- run:` text; nothing in this feature changes them.
- **D5 declared vs real dependencies:** S02 → S01 is real. CA-K2's proof needs the committed v1.11 schema, and P3 showed the pre-v1.11 schema fails it.
- **D6 early integration:** S02 ck1 is the journey: public writers → JSON text → independent validator → committed contract. It is a test-only feature, so there is no UI or IPC transport.
- **D7 runtime wiring:** no new interface. The only new code is a test, which CI collects through two existing run steps (pinned by CA-K3).

## Handoff Notes

<!-- Orchestrator appends each session's notes / followUp here, verbatim. -->
