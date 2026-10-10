# State Tracker — Ruleswright / browser-determinism

## Program / Feature / Intent / Sessions

- **Program:** Ruleswright (`program/Ruleswright/`)
- **Feature:** browser-determinism
- **Intent:** prove the approved determinism criteria on every runtime they name — FR-1 ("identical results on every platform"), FR-17 ("byte-identical pack") and NFR-Determinism ("byte-identical packs and identical roll sequences on Node, browsers, and Electron", `requirements.md:245`) — and make CI and the docs say exactly what is proven. Today only Node is proven; the browser leg has been a tracked v1.1 follow-up since v1-core (`ci.yml:14-18`, `README.md:13, 319-320, 577-578`, `vitest.config.ts:5`, PROGRAM-CONFIG Custom Rule 5, `arch/v1-core.md:1237, 1596`).
- **Sessions:** 1 (SESSION-01, 4 checkpoints). No `src/` change, no contract event, no Author re-entry.
- **Plan HEAD:** `46bcf0c` (2026-10-09). `src/` and `tests/` unchanged since `64a3231`.
- **Human input:** "yes" (2026-10-09) to "Should I plan `browser-determinism`". No product question arose; every choice below is a recorded auto-decision.

## Session Status

| # | Session | Modules | Owns | Status | Checkpoint | Completed | Notes |
|---|---|---|---|---|---|---|---|
| S01 | Determinism oracle, browser leg, Electron leg, CI and honest docs | tests, M05 | `tests/proofs/determinism-oracle.ts`, `tests/proofs/combat-characterization.test.ts`, `tests/proofs/pack-identity.test.ts`, `tests/proofs/runtime-identity.test.ts`, `tests/browser/determinism.test.ts`, `tests/proofs/docs-run.test.ts`, `vitest.config.ts`, `vitest.browser.config.ts`, `package.json`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`, `README.md` | pending | — | — | |

## Wave Plan

| Wave | Sessions | Why concurrent |
|---|---|---|
| W1 | S01 | Single member: every capability shares `package.json`, `pnpm-lock.yaml`, `ci.yml` and `README.md`. A split would only serialize the same files (Granularity Note). |
| — | VERIFY-01 | Feature verification after S01. |

## Dependency Graph

```
S01 ck1 (oracle, Node) ──► ck2 (browser leg) ──► ck3 (Electron leg) ──► ck4 (CI + docs + docs-run pin)
```
ck2 and ck3 consume ck1's oracle; ck4 documents and wires ck2/ck3's scripts. Strictly serial within one context.

## Architecture Reference (feature-specific)

- No module, edge or public API changes. `src/` is read-only for this feature; M01–M05 value edges are untouched.
- New test-only artifacts: `tests/proofs/determinism-oracle.ts` (non-test module, not collected by `tests/**/*.test.ts`; value-imports `src/compiler`, `src/runtime/index`, `src/core/rng`, `src/schema/version`, `tests/runtime/fixtures/packs` — the same set `combat-characterization.test.ts:21-47` imports today), `tests/browser/` (collected only by `vitest.browser.config.ts`).
- New devDependencies (exact): `@vitest/browser@2.1.8`, `playwright@1.62.1`, `electron@44.7.0`. Runtime `dependencies` stay empty (NFR-Dependencies holds).

## Scope Summary

| ID | Module | Effect |
|---|---|---|
| tests | `tests/proofs`, `tests/browser` | oracle extracted; pack-identity + runtime-identity tests; browser determinism file; docs-run honesty pin re-keyed |
| M05 | packaging/CI/docs | `vitest.config.ts`, `vitest.browser.config.ts`, `package.json`/lockfile, `ci.yml` (+2 jobs), `README.md` |
| — | PROGRAM-CONFIG, `arch/v1-core.md` | final Archivist only (not leased) |
| — | `specs/**`, `mocks/**` | read-only; claims hold (pin audit) |

**Inherited-work reconciliation** (sources inspected: class-features `FINAL-REPORT.md`, `STATE.md`, `VERIFICATION.md` 12/12 verified, `arch/v1-core.md` carried residuals l.1497-1601, `.program/blockers.md` (none open), `.program/decisions.md`, `PROGRAM-CONFIG.MD` conventions + Custom Rules):

| Inherited item | Disposition |
|---|---|
| v1.1 browser-mode Vitest config / CI browser leg (`arch/v1-core.md:1596`, Custom Rule 5) | **assigned** S01 ck2 (leg) + ck4 (CI); record retirement → final Archivist |
| NFR-Determinism "Electron" clause (never proven, never listed) | **assigned** S01 ck3 + ck4 |
| Optional hardening: `new Runtime` refuses `content.classes.<id>.features` (owner: Planner, next feature touching `tests/runtime`) | **carried** — this feature touches no `tests/runtime` file; owner unchanged |
| Byte-level snapshot conformance; `pnpm approve-builds` advisory; point-pool cast verb; item `tags` (v1.1 list) | **carried**, out of scope. Note: this feature adds `msw` to the "Ignored build scripts" list printed by pnpm (harmless, same advisory class) |
| `spells.tagged:` integrity, 12 `damage(half)` sites, mock copy items, Architect overview gaps, R-GM-3, F-M2, CAP-F1 compiler leg, slots-remaining query | **carried**, out of scope, owners as recorded in `arch/v1-core.md` |
| Standing recommendation "Plan-time base SHA goes stale after replan" | holds: ck0 recheck diffs against `46bcf0c` |

## Design Decisions

All auto-decided under Step 2 (no product behaviour, no destructive work).

- **DD-B1 — Toolchain: stay on Vitest 2.1.8.** Add `@vitest/browser@2.1.8` (peer `vitest: 2.1.8`, `playwright: *`) and `playwright@1.62.1`, exact. 1.62.1 uses chromium-headless-shell 1234, firefox 1538 and webkit 2336, all present in `~/Library/Caches/ms-playwright`, so local runs need no download. No Vitest upgrade (narrowest path).
- **DD-B2 — One browser per JS engine: Chromium (V8), Firefox (SpiderMonkey), WebKit (JavaScriptCore).** That is the cross-engine proof NFR-Determinism needs; three channels of one engine would add nothing.
- **DD-B3 — Electron proof = the whole suite under Electron's own runtime (`ELECTRON_RUN_AS_NODE=1`).** It runs Electron's bundled Node and V8, a separate build from both CI Node and Chromium. Its renderer is Chromium, covered by the Chromium leg's engine family.
  - **Disclosed residual, not a failure:** no test runs inside an Electron *renderer* process. Owner: a future feature, if a host reports a renderer-only discrepancy.
  - **Pin choice:** `electron@44.7.0`, the current stable dist-tag at plan time. 30.5.1 was also probed and passed, but it is end-of-life, so it was rejected.
- **DD-B4 — Electron binary is opt-in.** No `pnpm.onlyBuiltDependencies`. `test:electron` runs `node node_modules/electron/install.js`, which is idempotent (`isInstalled()`). Plain `pnpm install` (every other CI job) never downloads it. Probed: a clean install left no `dist/`, and an explicit `install.js` followed by the run passed.
- **DD-B5 — Reuse the existing golden pin; add only pack digests.** The 9 characterization digests move verbatim into `tests/proofs/determinism-oracle.ts`; this is not a re-key. Three `PACK_DIGESTS` rows (raw sha256 + `contentHash`, seed 42, default knobs) prove FR-17's byte identity directly.
  - **New pin cost:** a bundled-theme or compiler-output change re-keys `PACK_DIGESTS` under the same owner rule as the characterization pin. Those changes already re-key that pin, since snapshots carry pack identity, so the marginal cost is 3 strings per content feature.
- **DD-B6 — Browser suite scope:** the oracle file plus 5 pure suites (`tests/core/{rng,dice,tables}`, `tests/schema/version`, `tests/compiler/themes`). The rest of the suite uses `node:fs`, `node:crypto`, `dist/` or `process.hrtime`. The whole suite runs under Electron instead.
- **DD-B7 — `screenshotFailures: false`.** Without it, a failing browser test writes PNGs to `tests/**/__screenshots__/` (probed). No `.gitignore` change is needed.
- **DD-B8 — `tests/browser/**` is excluded from the node config.** Node 18 (a CI matrix leg) exposes no global WebCrypto without a flag, and browser tests must not count in `pnpm test`.
- **DD-B9 — No DOM lib.** `tsconfig.json` stays `lib: ["es2020"]`, keeping `src/` DOM-free. The browser test reaches `crypto.subtle`, `TextEncoder`, `navigator` and `process` through a local `BrowserGlobals` cast (typecheck verified at plan time).
- **DD-B10 — Bidirectional honesty pin.** `docs-run` reads `ci.yml` as well as the README (CA-B3), replacing the one-way "README must say v1.1 follow-up" pin.
- **DD-B11 — CI shape:** a `browser` job (matrix chromium/firefox/webkit, Node 22, `playwright install --with-deps <b>`) and an `electron` job (Node 22, `pnpm build`, `pnpm test:electron`). The existing jobs are unchanged.
- **DD-B12 — PROGRAM-CONFIG and the arch record are not leased.** Final Archivist owns the Stack *Test* row (l.24), Custom Rule 5 (l.165), the Verification Commands rows and `arch/v1-core.md:1237, 1596`. `specs/architecture.md:32,35,48,220,240` already describes browser-mode determinism (Chromium/Firefox/WebKit), so no Architect re-entry is needed.

## Verification Baseline

Observed by Planner at `46bcf0c`, 2026-10-09 ~21:20, Node v24.20.0, pnpm 10.15.0, macOS arm64.

| Gate | Effective command | Result |
|---|---|---|
| V1 | `pnpm typecheck` (`tsc --noEmit`, `include: [src, tests]`, `lib: [es2020]`) | 0 (observed) |
| V2 | `pnpm lint` (`eslint .`; ignores `dist/`, `node_modules/`, `coverage/`, `program/`; **not** `.program/`) | 0 (observed) |
| V3 | `pnpm format:check` (Prettier; formats `.yml`/`.md`; `.prettierignore` excludes `program/`, `.program/`, `pnpm-lock.yaml`) | 0 (observed) |
| V4 | `pnpm build` (tsup) | 0 (observed) |
| V5 | `pnpm test` (`vitest run`, `tests/**/*.test.ts`, node env) after V4 | **54 files, 970/970** (observed; N₀ = 970) |
| V6 | `pnpm check:isolation` | 0 (observed) |
| V7 | `pnpm check:security` | 0 (observed) |
| V8 | `pnpm test:browser` (new, ck2) | planned; plan-time probe equivalent passed (below) |
| V9 | `pnpm build && pnpm test:electron` (new, ck3) | planned; plan-time probe equivalent passed 970/970 |
| V10 | `ruby -ryaml -e 'YAML.load_file(".github/workflows/ci.yml")'` (`/usr/bin/ruby`) | 0 (observed on current file) |

**Plan-time probes** (scratch copy `/tmp/rw-probe` of `src/`, `tests/`, `tsconfig.json` at `46bcf0c`; never in the repo; Planner installed nothing in the repo):
- **Browsers:** Vitest 2.1.8 + `@vitest/browser` 2.1.8 + `playwright` 1.62.1.
  - Chromium: the characterization legs (sha256 masked) and `rng.test.ts` passed 21/21.
  - Firefox 153 (UA `rv:153.0 … Firefox/153.0`) and WebKit 26.5 (UA `Version/26.5 Safari/605.1.15`) passed 22/22 with the UA probe.
  - `globalThis.process?.versions?.node` was undefined in all three.
  - **All 9 pinned `contentHash` values reproduced.**
- **WebCrypto:** `crypto.subtle.digest('SHA-256', TextEncoder("abc"))` = `ba7816bf…15ad` in all three browsers.
- **Negative control:** with leg-1 `contentHash` flipped to `1cc2c132`, WebKit failed exactly that test. With `screenshotFailures: false`, no `__screenshots__` were written; without it, a PNG landed in `tests/proofs/__screenshots__/`.
- **Pure suites in WebKit:** rng 12, dice 11, tables 20, version 7, themes 11 = **61/61**, unmodified.
- **Generated packs** (seed 42, Node), each as raw sha256 / `contentHash` / chars. Firefox and WebKit reproduced both digests for all three.
  - dark-fantasy: `6f87f212…1f3e` / `21f4de6d` / 19674
  - zombie-urban: `fc80c83d…cafe4` / `c2bbbd7b` / 11504
  - wyldwood: `fc31b3a2…b190` / `273468f5` / 13017
- **Electron:**
  - **Leg probe:** `ELECTRON_RUN_AS_NODE=1 electron node_modules/vitest/vitest.mjs run` gave worker identity `{"node":"24.21.0","v8":"15.2.124.28-electron.0","electron":"44.7.0"}` and 9/9 characterization legs (30.5.1 was also probed: Node 20.16.0, 9/9).
  - **Whole-repo run:** the same command against the repo tree (scratch binary) gave **54 files, 970/970**.
  - **Opt-in install:** without `onlyBuiltDependencies`, `pnpm install` leaves no `electron/dist`. An explicit `node node_modules/electron/install.js` exits 0, and then the run passes.

**Hazards** (each with its working rule):
- **H1 `dist/` importers:** `tests/proofs/{spells,loot,equipment}-journey.test.ts` import `dist/`. Run `pnpm build` immediately before `pnpm test` **and before `pnpm test:electron`**.
- **H2 `.program/` is linted:** it holds `.py`/`.md` only. Scratch goes to `/tmp/ruleswright-browser-determinism/`, never into the repo.
- **H3 filtering:** `pnpm test -- <pattern>` does not filter. Use `pnpm exec vitest run <path>`.
- **H4 behaviour pin:** the characterization digests must move **unchanged** (ck1 commit condition). A changed digest is a regression, never a re-key. `PACK_DIGESTS` values that differ from the plan-time observation are a finding (stop and report).
- **H5 negative controls** are scratch edits. Keep a `/tmp` copy, revert, and confirm with `cmp` before the commit.
- **H6 gitignored plan:** `program/Ruleswright/prompts/` is gitignored (`.gitignore:29`). VERIFICATION.md and the plan files are force-added by Orchestrator (PROGRAM-CONFIG convention).
- **H7 host await idle timeout** (~300 s): re-await the same handle.
- **H8 browser port:** the Vitest browser server uses port 63315 by default. Never run two browser-mode invocations at once (`Resources: vitest-browser-port`). Orchestrator must not run V8 while S01 is in flight.
- **H9 failure screenshots:** mitigated by DD-B7. Check with `find tests -name __screenshots__` (must be empty) before every commit.
- **H10 Linux CI legs unverified locally:** `playwright install --with-deps webkit|firefox` on `ubuntu-latest` and the Electron 44 binary's shared libraries in `ELECTRON_RUN_AS_NODE` mode cannot be exercised on this macOS host. They are debt until the first Actions run (B-BD-1).
- **H11 network:** ck2/ck3 `pnpm add` and the first `test:electron` need the npm registry and GitHub releases. The registry was reachable at plan time (`pnpm view` succeeded).
- **H12 Node 18 has no global WebCrypto:** handled by DD-B8. Never let `tests/browser/**` into the node config.

**Pin audit** (PROGRAM-CONFIG pin-lease convention). Grep set: `tests/`, `README.md`, `src/`, `.github`, `scripts`, `vitest.config.ts`, `program/Ruleswright/{specs,mocks,arch}`, `PROGRAM-CONFIG.MD`. Patterns: `browser`, `Electron`, `v1.1 follow-up`, `determinis`, `characterization`, `package.json`/`devDependencies`/`scripts`, test-file enumeration of `tests/proofs`.

| Hit | Fact | Disposition / owner |
|---|---|---|
| `tests/proofs/combat-characterization.test.ts:358-450` (18 digest literals) | behaviour pin | **moves unchanged** into the oracle, S01 ck1 (H4) |
| `tests/proofs/docs-run.test.ts:22-25, 238-243` | README must say the browser leg is a "v1.1 follow-up" | **re-key**, S01 ck4 (CA-B3), in the same checkpoint as the README edit |
| `docs-run.test.ts:48-49` | README has 4 ```ts blocks (whole README) | **holds**: the README additions use a ```sh fence |
| `README.md:11-13, 318-320, 575-579` | "browser leg … v1.1 follow-up" | S01 ck4 |
| `README.md:557-568` Development block | command list | S01 ck4 (adds 2 lines) |
| `.github/workflows/ci.yml:11-18` | header: browser leg is a follow-up | S01 ck4 |
| `vitest.config.ts:5` | D4 comment | S01 ck2 |
| `PROGRAM-CONFIG.MD:24` (Stack *Test*), `:165` (Custom Rule 5), Verification Commands | browser leg = CI only / follow-up | **final Archivist** (DD-B12) |
| `arch/v1-core.md:1237, 1596` | browser leg is a v1.1 follow-up | **final Archivist** |
| `specs/architecture.md:32, 35, 48, 220, 240` | Vitest browser mode is the determinism vehicle; CI browser runs | **holds** (becomes true). l.220 "both FR-21 packs" is carried to the next Architect re-entry, unrelated |
| `specs/requirements.md:245, 247`; `specs/idea.md:28` | Node, browsers, Electron | **holds** (now proven) |
| `mocks/{quickstart,dice,packaging,quickstart-annotated}.html` (l.133, 33, 78, 112) | identical on Node/browsers/Electron | **holds** (claims become true; no Designer change) |
| `package.json` read by any test | — | none (grep empty) |
| test-file counts | V5 file count 54 → 56 | informational; no test pins the file count |

**Feature gates:** after S01, V1–V10 are green, with V5 = 56 files / **974** (N₀ 970 + 3 pack-identity + 1 runtime-identity), V8 = 74 per engine × 3, and V9 = 974.

## Capability Readiness

| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|---|---|---|---|---|---|---|---|
| CAP-B1 | FR-1/FR-17 on Node: one oracle module holds the 9 golden leg digests and 3 golden pack digests; the Node suite checks them on 18/20/22 | leg setups (`combat-characterization.test.ts:49-345`, committed); pack generation (`src/compiler` `generateCampaign`, committed); `packContentHash` (`src/schema/version.ts:46`, committed) | CA-B1 producer | S01 ck1 | planned | plan-time pack digests observed on Node (Baseline) | — |
| CAP-B2 | FR-1/FR-17/NFR-Determinism in browsers: `pnpm test:browser` reproduces all 12 digests and runs 5 pure suites in Chromium, Firefox, WebKit | oracle (S01 ck1); `@vitest/browser` + `playwright` (S01 ck2); cached browsers (host, observed) | CA-B1 consumer, CA-B2 | S01 ck2 — **first narrow journey** | planned | plan-time probe: all 3 engines, `contentHash` × 9, packs × 3, WebCrypto | — |
| CAP-B3 | NFR-Determinism on Electron: `pnpm test:electron` runs the whole suite on Electron's runtime with an identity guard | `electron@44.7.0` (S01 ck3); the suite (committed) | CA-B2 | S01 ck3 | planned | plan-time probe 970/970 under Electron 44.7.0 | Renderer-process run not covered (DD-B3, disclosed residual; owner: future feature on report) |
| CAP-B4 | NFR-DX honesty: CI runs every leg the README claims, checked in both directions | ck2/ck3 scripts | CA-B3 | S01 ck4 | planned | — | **GitHub Actions execution** of the new jobs is unverifiable locally (H10). B-BD-1: present-unverified until the first push |

## Contract Agreements

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|---|---|---|---|---|---|---|---|
| CA-B1 | One source of golden determinism values; both engines hash the same text | `tests/proofs/determinism-oracle.ts` (`LEG_RUNS`, `recordingRaw`, `packRaw`, `CHARACTERIZATION_DIGESTS`, `PACK_DIGESTS`) → `combat-characterization.test.ts`, `pack-identity.test.ts` (Node, `node:crypto`) and `tests/browser/determinism.test.ts` (WebCrypto) | **sha256** = hex(SHA-256(UTF-8(`raw`))): Node `createHash('sha256').update(raw)`, browser `subtle.digest('SHA-256', TextEncoder.encode(raw))`. **contentHash** = `packContentHash(JSON.parse(raw))`. Leg raw = `JSON.stringify({events, snapshots})`; pack raw = `JSON.stringify(pack)`. No digest literal outside the oracle. Oracle imports no `node:*` and does not use `process` | S01 ck1 (producer + Node proof), ck2 (browser proof) | agreed | planned (ck1) | plan-time: both routes agreed on all 12 subjects in Firefox/WebKit (`contentHash` also Chromium); `src/schema/version.ts:46-70` read |
| CA-B2 | A leg proves where it ran | browser test / `runtime-identity.test.ts` → CI log + handoff | browser: `globalThis.process?.versions?.node === undefined`, UA logged. Electron: if `RULESWRIGHT_EXPECT_RUNTIME === 'electron'` then `typeof process.versions.electron === 'string'`, identity logged. Negative control: same variable under plain Node → fail | S01 ck2, ck3 | agreed | planned | plan-time: `process` undefined in 3 browsers; `versions.electron` = 44.7.0 in Electron workers |
| CA-B3 | The README never promises a CI run CI does not perform, and names every leg CI runs | `README.md` ↔ `.github/workflows/ci.yml`, checked by `docs-run.test.ts` | README contains `pnpm test:browser`, `pnpm test:electron`. `ci.yml` contains `vitest.browser.config.ts`, `browser: [chromium, firefox, webkit]`, `pnpm test:electron`. README no longer matches `/browser[^.]*v1\.1 follow-up/` | S01 ck4 | agreed | planned | `docs-run.test.ts:220-243`, `ci.yml`, README l.11-13/318-320/570-579 read |

No database, serialized product contract, IPC or pack schema boundary applies: `src/` and `src/schema/contracts/**` are unchanged.

## Current Blockers

| ID | Affects | Next action | Owner | Evidence to clear |
|---|---|---|---|---|
| B-BD-1 | CAP-B4 (Actions execution only); does **not** block S01 or VERIFY-01 | After S01 lands, the human pushes (agents never push). The next Orchestrator run or the final Archivist reads the Actions result for jobs `browser (chromium/firefox/webkit)` and `electron` | human (push) → Archivist (record) | all four new jobs green on GitHub Actions. If WebKit/Firefox `--with-deps` or Electron shared libraries fail on `ubuntu-latest`, that is a mechanical CI owner-correction (H10), not a product question |
| — | Planning completeness | Optional scoped Archivist planning-completeness pass before S01 (one session, no Author files, all premises probed). Orchestrator's call | Orchestrator | ARCH-PRE result or recorded skip |

## Handoff Notes

<!-- Orchestrator appends Coder handoffs here verbatim. -->
