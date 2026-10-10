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
| S01 | Determinism oracle, browser leg, Electron leg, CI and honest docs | tests, M05 | `tests/proofs/determinism-oracle.ts`, `tests/proofs/combat-characterization.test.ts`, `tests/proofs/pack-identity.test.ts`, `tests/proofs/runtime-identity.test.ts`, `tests/browser/determinism.test.ts`, `tests/proofs/docs-run.test.ts`, `vitest.config.ts`, `vitest.browser.config.ts`, `package.json`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`, `README.md` | **done** | 4/4 | 2026-10-10 | ck1 `1d929a7`, ck2 `da7bc47`, ck3 `48bd4b9`, ck4 `66af2e8`; lease rev 1; R1 (docs-run anchoring) + R2 (lockfile dedupe), both in-lease. Orchestrator receive: V1–V7 0, V5 56 files 974/974, V8 74×3, V9 974/974 (electron 44.7.0), V10 0 |

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
- **DD-B12a (Orchestrator, 2026-10-10, ARCH-PRE F-B4) — retirement list widened.** The final Archivist also owns `PROGRAM-CONFIG.MD:27` (Stack *CI* row: Node matrix only) and `arch/v1-core.md:197` ("browser matrix leg documented as a v1.1 …"). Unrelated pre-existing drift, also final Archivist: `PROGRAM-CONFIG.MD:25` says "typescript-eslint strict-type", but `eslint.config.mjs:20` uses `configs.recommended`.
- **DD-B13 (Orchestrator auto-decision, 2026-10-10, ARCH-PRE F-B1) — make V1's Node type source explicit and in-repo.** Observed: the repo has no `node_modules/@types`, and `tsc --traceResolution` resolves the `node` type reference to `/Users/the.phoenix/node_modules/@types/node@25.5.0`, a home-dir package (verified by Orchestrator). A clean checkout (CI) is therefore expected to fail `pnpm typecheck` today (ARCH-PRE probe: 134 `error TS` in a copy outside `$HOME`). `electron@44.7.0` depends on `@types/node ^24.9.0`, so ck3 changes V1's type source implicitly. **Decision:** at ck3, after `pnpm add electron`, S01 pins `@types/node` explicitly: `pnpm add -D --save-exact @types/node@<the 24.x version the lockfile resolved for electron>`. This yields one copy, exact, and leaves runtime `dependencies` empty. The ck3 commit gains a closing assertion: a CI-like typecheck exits 0, run from a repo copy outside `$HOME` (`/tmp/ruleswright-browser-determinism/ci`) with `--preserveSymlinks`. Rationale: the narrowest change inside the lease (`package.json`, `pnpm-lock.yaml`). It is mechanical, reversible and not product design. Rollback: remove the devDependency. *(Receive 2026-10-10: landed at ck3 `48bd4b9`, `@types/node@24.19.2`; resolution now in-repo. The prescribed `--preserveSymlinks` command is itself wrong for pnpm — it cuts off `@vitest/runner` types, exit 2 independent of `@types/node`. Orchestrator accepts the Coder's substitute as the closing assertion: a clean `pnpm install --frozen-lockfile` + `pnpm build` + `pnpm typecheck` in a node_modules-free copy under `/tmp` exits 0 with 0 files resolved outside the copy. Record for the final Archivist.)*

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
| V8 | `pnpm test:browser` (new, ck2) | **74/74 × 3** (observed by Orchestrator at S01 receive, `66af2e8`) |
| V9 | `pnpm build && pnpm test:electron` (new, ck3) | **56 files 974/974**, `electron 44.7.0` (observed by Orchestrator at S01 receive, `66af2e8`) |
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
- **H13 host `~/node_modules` leakage (ARCH-PRE F-B1/F-B2):** TypeScript and bin resolution walk up past the repo into `/Users/the.phoenix/node_modules` (`@types/node@25.5.0`, `electron ^41` and its `.bin/electron`). Local V1 "0" is not evidence of a clean-checkout typecheck. Closed for V1 by DD-B13 at ck3. Electron mis-resolution is caught by ck3's `"electron":"44.7.0"` identity condition. The ck0 recheck records the `node` type resolution, and ck3 re-records it.

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
| CAP-B1 | FR-1/FR-17 on Node: one oracle module holds the 9 golden leg digests and 3 golden pack digests; the Node suite checks them on 18/20/22 | leg setups (`combat-characterization.test.ts:49-345`, committed); pack generation (`src/compiler` `generateCampaign`, committed); `packContentHash` (`src/schema/version.ts:46`, committed) | CA-B1 producer | S01 ck1 | **verified** (ck1 `1d929a7`) | Orchestrator receive @ `66af2e8`: `combat-characterization` 9/9 + `pack-identity` 3/3 inside V5 56 files 974/974; no-re-key diff (18 values moved, 6 new PACK_DIGESTS only); PACK_DIGESTS re-observed = plan; SEED 43 negative control 10/12 fail (legs 1/5 fixture pack, correctly unaffected) | — |
| CAP-B2 | FR-1/FR-17/NFR-Determinism in browsers: `pnpm test:browser` reproduces all 12 digests and runs 5 pure suites in Chromium, Firefox, WebKit | oracle (S01 ck1); `@vitest/browser` + `playwright` (S01 ck2); cached browsers (host, observed) | CA-B1 consumer, CA-B2 | S01 ck2 — **first narrow journey** | **verified** (ck2 `da7bc47`) | Orchestrator receive @ `66af2e8`: `pnpm test:browser` exit 0, 6 files 74/74 in each of HeadlessChrome/151.0.7922.34, Firefox/153.0, Safari/605.1.15 (Version/26.5); WebKit leg-1 negative control 1 fail/73 pass, no screenshots. Runs `src/` via Vite, not `dist/` (A4, disclosed in README) | — |
| CAP-B3 | NFR-Determinism on Electron: `pnpm test:electron` runs the whole suite on Electron's runtime with an identity guard | `electron@44.7.0` (S01 ck3); the suite (committed) | CA-B2 | S01 ck3 | **verified** (ck3 `48bd4b9`) | Orchestrator receive @ `66af2e8`: `pnpm build && pnpm test:electron` 56 files 974/974, `runtime={"node":"24.21.0","v8":"15.2.124.28-electron.0","electron":"44.7.0"}`; plain-Node guard negative control exit 1 (Coder) | Renderer-process run not covered (DD-B3, disclosed residual; owner: future feature on report) |
| CAP-B4 | NFR-DX honesty: CI runs every leg the README claims, checked in both directions | ck2/ck3 scripts | CA-B3 | S01 ck4 | **verified locally** (ck4 `66af2e8`); Actions **present-unverified** | docs-run 3/3 inside V5; V10 0; every new CI-job command passed locally (Coder + Orchestrator V8/V9); A3 in-place negative controls fail as required; pin tightened to `- run:` lines (R1) after the prescribed `toContain` was shown satisfiable by the header comment | **GitHub Actions execution** of the new jobs is unverifiable locally (H10). B-BD-1: present-unverified until the first push |

## Contract Agreements

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|---|---|---|---|---|---|---|---|
| CA-B1 | One source of golden determinism values; both engines hash the same text | `tests/proofs/determinism-oracle.ts` (`LEG_RUNS`, `recordingRaw`, `packRaw`, `CHARACTERIZATION_DIGESTS`, `PACK_DIGESTS`) → `combat-characterization.test.ts`, `pack-identity.test.ts` (Node, `node:crypto`) and `tests/browser/determinism.test.ts` (WebCrypto) | **sha256** = hex(SHA-256(UTF-8(`raw`))): Node `createHash('sha256').update(raw)`, browser `subtle.digest('SHA-256', TextEncoder.encode(raw))`. **contentHash** = `packContentHash(JSON.parse(raw))`. Leg raw = `JSON.stringify({events, snapshots})`; pack raw = `JSON.stringify(pack)`. No digest literal outside the oracle. Oracle imports no `node:*` and does not use `process` | S01 ck1 (producer + Node proof), ck2 (browser proof) | agreed | **landed** ck1 `1d929a7` | plan-time: both routes agreed on all 12 subjects in Firefox/WebKit (`contentHash` also Chromium); `src/schema/version.ts:46-70` read. **Proven** @ `66af2e8`: Node (V5) and 3 browsers (V8) reproduce all 12 subjects; digest literals only in the oracle (grep: 12 × 64-hex in `determinism-oracle.ts`, 0 elsewhere) |
| CA-B2 | A leg proves where it ran | browser test / `runtime-identity.test.ts` → CI log + handoff | browser: `globalThis.process?.versions?.node === undefined`, UA logged. Electron: if `RULESWRIGHT_EXPECT_RUNTIME === 'electron'` then `typeof process.versions.electron === 'string'`, identity logged. Negative control: same variable under plain Node → fail | S01 ck2, ck3 | agreed | **landed** ck2 `da7bc47`, ck3 `48bd4b9` | plan-time: `process` undefined in 3 browsers; `versions.electron` = 44.7.0 in Electron workers. **Proven** @ `66af2e8`: browser guard in V8 ×3 (UA logged); Electron guard in V9 (`"electron":"44.7.0"`); plain-Node negative control exit 1 |
| CA-B3 | The README never promises a CI run CI does not perform, and names every leg CI runs | `README.md` ↔ `.github/workflows/ci.yml`, checked by `docs-run.test.ts` | README contains `pnpm test:browser`, `pnpm test:electron`. `ci.yml` contains `vitest.browser.config.ts`, `browser: [chromium, firefox, webkit]`, `pnpm test:electron`. README no longer matches `/browser[^.]*v1\.1 follow-up/` | S01 ck4 | agreed | **landed** ck4 `66af2e8` | `docs-run.test.ts:220-243`, `ci.yml`, README l.11-13/318-320/570-579 read. **Proven locally** @ `66af2e8`: docs-run 3/3; `ci.yml` checks anchored to `- run:` lines (R1); in-place negative controls (rename, delete steps, README removal) fail |

No database, serialized product contract, IPC or pack schema boundary applies: `src/` and `src/schema/contracts/**` are unchanged.

## Planning Completeness Review

ARCH-PRE (Archivist, handle h-ctRQ, 2026-10-10). Reviewed plan revision `7dcc22e` (plan files on disk); source revision `7dcc22e`, with `src`/`tests`/configs identical to `46bcf0c`.

| # | Dimension | Verdict | Evidence (abridged) | Disposition |
|---|---|---|---|---|
| D1 | requirement coverage | pass | FR-1/FR-17 → CAP-B1; NFR-Determinism (`requirements.md:245`) → CAP-B2 + CAP-B3; NFR-DX → CAP-B4; the DD-B3 residual is disclosed | — |
| D2 | fact origins | **fail** | the ck3 typecheck premise and the `electron` bin resolve to `~/node_modules` (F-B1, F-B2) | closed for dispatch by DD-B13 and amendments A1/A2; proof at ck3 |
| D3 | ownership | **fail** | V1's type source had no owner; B-BD-1 omitted the existing `test` typecheck; the DD-B12 list was incomplete (F-B4) | DD-B13 (S01 ck3), B-BD-1 widened, DD-B12a |
| D4 | lease coverage | pass | all writes are in Owns; no `tsconfig`/eslint/`.gitignore` edit is needed; the scanners cover `src`/`dist` only | — |
| D5 | declared vs real dependencies | pass | ck2/ck3 consume ck1's oracle; the `@vitest/browser` peer `vitest 2.1.8` matches | — |
| D6 | early integration | pass | ck2 runs real `src/` in 3 engines against Node goldens; the oracle has no `node:`/`process` reach | — |
| D7 | runtime wiring | pass | the oracle has 3 consumers; the scripts and config are consumed by CI and the docs-run pin | — |

The D2/D3 failures affect S01 ck3 only, not ck1/ck2; no replan is needed. **Envelope amendments to S01 (lease rev 1):**
- A1 (F-B1/DD-B13): ck0 and ck3 record the `node` type resolution; ck3 pins `@types/node` exactly and passes a typecheck outside `$HOME` with `--preserveSymlinks`.
- A2 (F-B2): a host `electron ^41` bin exists in `~/node_modules/.bin`; the handoff quotes the resolved version.
- A3 (F-B3): the ck4 negative control edits the leased `ci.yml` **in place** (backed up to `/tmp/ruleswright-browser-determinism/`, reverted, `cmp`-confirmed), because the pin reads the repo path.
- A4 (F-B6): the README/handoff wording discloses that the browser leg runs `src/` through Vite, not `dist/`; Node/Electron run the `dist/` journeys.
- F-B5: corrected citations (digest literals l.357-450; `packContentHash` `version.ts:45-47`; FNV l.61-69; the honesty pin l.241-243).

## Current Blockers

| ID | Affects | Next action | Owner | Evidence to clear |
|---|---|---|---|---|
| B-BD-1 | CAP-B4 (Actions execution only); does **not** block S01 or VERIFY-01 | After S01 lands, the human pushes (agents never push). The next Orchestrator run or the final Archivist reads the Actions result for jobs `browser (chromium/firefox/webkit)` and `electron` | human (push) → Archivist (record) | all four new jobs green on GitHub Actions, **and** the existing `test` job's `pnpm typecheck` (`ci.yml:44`) green on 18/20/22, because before DD-B13 that typecheck depended on a host-only `@types/node` (H13). If WebKit/Firefox `--with-deps` or Electron shared libraries fail on `ubuntu-latest`, that is a mechanical CI owner-correction (H10), not a product question |
| B-BD-2 | CAP-B4 (existing `test` job typecheck) | **Cleared 2026-10-10** by OWNER-M05-CI-ORDER `fb2bf0e` (`ci.yml` only, +2/−1): `test` job now runs `pnpm build` before `pnpm typecheck`. Orchestrator recheck: with `dist/` absent, `pnpm build && pnpm typecheck` 0; V2/V3/V6/V7/V10 0; V5 56 files 974/974. Actions confirmation folds into B-BD-1 | — | cleared locally |
| — | Planning completeness | **Done:** ARCH-PRE 2026-10-10 (see *Planning Completeness Review*). D2/D3 failures reach ck3 only and are closed by DD-B13 plus envelope amendments A1–A4 | Orchestrator | cleared at dispatch; ck3 closing assertion (DD-B13) |

## Handoff Notes

<!-- Orchestrator appends Coder handoffs here verbatim. -->

### SESSION-01 — received 2026-10-10 (handle h-KQ3x; accepted done 4/4)

SESSION-01 is done. All four checkpoints are committed, all ten verification gates pass (V1–V10), and not one of the 9 characterization digest pairs changed.

Each finding below needs a decision from you:

1. **The `--preserveSymlinks` typecheck required by A1 fails, because of the flag itself.**
   - That command exits 2 with 14 errors.
   - **Cause:** with pnpm's install layout, the flag stops TypeScript from finding Vitest's own type packages (`@vitest/runner` is unresolved). The 14 errors include three files I never touched.
   - **What I ran instead:** a fresh `pnpm install --frozen-lockfile` in a copy under `/tmp`, then `pnpm build`, then `pnpm typecheck`. That exits 0, and no file resolves from outside the copy.
   - **Decision:** whether you accept this in place of the literal command.
2. **The existing `test` job in `ci.yml` will fail its typecheck on GitHub Actions.**
   - It runs `pnpm typecheck` before `pnpm build`.
   - **Cause:** four journey tests import `dist/`, which a fresh checkout doesn't have yet (TS2307).
   - **Existing gap:** this was already there before this session. Locally it never shows, because `dist/` is always present.
   - **Why I didn't fix it:** DD-B11 says existing jobs stay unchanged. The fix is to swap those two steps; it needs an owner before the first push (B-BD-1).
3. **I tightened the CI honesty check beyond the prescribed code (rule R1).**
   - The new `ci.yml` header comment contains `pnpm test:electron` and `vitest.browser.config.ts`.
   - So with both new run steps deleted, the prescribed `toContain` checks still passed. I tested that.
   - I anchored those two checks to the actual `- run:` lines. Deleting the steps, renaming `test:electron` to `test:electron-renamed`, and renaming it to `test:desktop` now all fail the test.

Two smaller surprises:
- At checkpoint 2, `msw` (pulled in by `@vitest/browser`) silently brought in `@types/node@26.6.5`. After pinning 24.19.2, `pnpm dedupe` removed it, so the lockfile has one copy.
- The `PACK_DIGESTS` I re-observed on Node match the planned values exactly.

As planned, two things stay unproven:
- The new GitHub Actions jobs are unproven until the first push.
- No test runs inside an Electron renderer process.

## Handoff

- **session:** 01 (browser-determinism)
- **status:** done
- **checkpoint:** 4
- **notes:** S01 done (lease rev 1). ck1 `1d929a7`, ck2 `da7bc47`, ck3 `48bd4b9`, ck4 `66af2e8`. CAP-B1, CAP-B2 and CAP-B3 are proven locally. CAP-B4 is proven locally; Actions execution stays present-unverified (B-BD-1). CA-B1: producer `tests/proofs/determinism-oracle.ts` (`LEG_RUNS`, `recordingRaw`, `contentHashOfRaw`, `CHARACTERIZATION_DIGESTS`, `PACK_THEMES`, `packRaw`, `PACK_DIGESTS`); Node and browser proofs pass. CA-B2: the browser guard and the Electron guard, with its plain-Node negative control, pass. CA-B3: both directions hold; the ci.yml checks were tightened to anchor on `- run:` steps (R1). Tests: 970 → 973 (ck1) → 974 (ck3); 74 per browser engine. `@types/node` is pinned at 24.19.2 (DD-B13).
- **delivered:**
  - **ck1:** created the shared oracle. Helpers and the 9 legs moved verbatim from `combat-characterization.test.ts`, minus `digests()`. The oracle has no `node:` import and no `process` use. `combat-characterization.test.ts` now checks against `CHARACTERIZATION_DIGESTS[...]`, with every title and non-digest assertion kept. Added `pack-identity.test.ts` with 3 FR-17 tests.
  - **ck2:** added `@vitest/browser@2.1.8` and `playwright@1.62.1`, exact versions. Created `vitest.browser.config.ts` (playwright, headless, `screenshotFailures: false`, 6-file include list). `vitest.config.ts` now excludes `tests/browser/**` and has a rewritten comment. Created `tests/browser/determinism.test.ts`: 13 tests using a `BrowserGlobals` cast, no DOM lib. Added the `test:browser` script.
  - **ck3:** added `electron@44.7.0` and `@types/node@24.19.2`, exact versions; runtime `dependencies` stay empty and there is no `onlyBuiltDependencies`. Added the `test:electron` script. Created `tests/proofs/runtime-identity.test.ts`.
  - **ck4:** rewrote the `ci.yml` header and added two jobs: `browser` (matrix chromium/firefox/webkit) and `electron` (build, then `test:electron`). README l.11-13, l.318-320, the Development block (```sh fence) and the CI paragraph now state facts. The CI paragraph discloses that the browser leg runs `src/` through Vite, not `dist/`, and states the DD-B3 renderer residual. In `docs-run`, rewrote the header and replaced the honesty pin with the bidirectional CA-B3 version.
- **verification:**
  - **ck0 recheck:**
    - `git diff --quiet 46bcf0c -- src tests vitest.config.ts package.json .github README.md` → 0.
    - sha256 literals = 9, contentHash literals = 9.
    - The Playwright cache has `chromium_headless_shell-1234`, `firefox-1538` and `webkit-2336`, so nothing was downloaded.
    - Baseline after build: 54 files, 970/970.
  - **A1 type-resolution line, before:** `Type reference directive 'node' was successfully resolved to '/Users/the.phoenix/node_modules/@types/node/ts5.6/index.d.ts' with Package ID '@types/node/ts5.6/index.d.ts@25.5.0'`.
  - **A1 type-resolution line, after:** `… resolved to '/Users/the.phoenix/WebstormProjects/Ruleswright/node_modules/.pnpm/@types+node@24.19.2/node_modules/@types/node/ts5.6/index.d.ts' with Package ID '@types/node/ts5.6/index.d.ts@24.19.2'`.
  - **A1 CI-like typecheck:**
    - Prescribed `node_modules/.bin/tsc -p tsconfig.json --noEmit --preserveSymlinks` in an rsync copy at `/tmp/ruleswright-browser-determinism/ci` → **exit 2**. These are 14 Vitest-type implicit-any errors, including untouched files (`rulings-journey`, `self-target-journey`, `validate.test`). The trace shows `Module name '@vitest/runner' was not resolved`, while `@types/node` 24.19.2 resolves inside the copy.
    - The same copy without the flag → **exit 0**.
    - Clean install from a node_modules-free copy at `/tmp/ruleswright-browser-determinism/ci-clean`: `pnpm install --frozen-lockfile`, then `pnpm build`, then `pnpm typecheck` → **exit 0**. `--listFiles` shows 0 files outside the copy.
  - **ck1:**
    - `pnpm exec vitest run tests/proofs/combat-characterization.test.ts tests/proofs/pack-identity.test.ts` → 2 files, 12/12.
    - `pnpm build && pnpm test` → 55 files, 973/973.
    - **No re-key:** `git diff 46bcf0c -- tests/proofs` has 18 `-` digest values. The `+` values are 24, which is the same 18 plus the 6 new `PACK_DIGESTS` values; nothing appears only on the `-` side.
    - **Re-observed `PACK_DIGESTS`** (Node, fresh `dist/`; they match the plan exactly):
      - dark-fantasy: `6f87f212e259460c1f0a464c277583102e7bead07ae8f01d3b95cf7cb57e1f3e` / `21f4de6d` / 19674 chars
      - zombie-urban: `fc80c83d7160ac147b00bf00341a6b1b5c8ea9c2bdf95f4094a036516b0cafe4` / `c2bbbd7b` / 11504 chars
      - wyldwood: `fc31b3a2c78f676c8307c208fc7543aac816bfacdb165084afc5f29e094bb190` / `273468f5` / 13017 chars
    - **Negative control** (SEED 42 → 43): 10 of 12 failed — all 3 packs plus legs 2, 3a, 3b, 4, 6, 7 and 8. Legs 1 and 5 use the fixture pack and are rightly unaffected. Restored and `cmp`-identical.
  - **ck2:**
    - `pnpm test:browser` → exit 0, 6 files and 74/74 per engine: determinism 13, rng 12, dice 11, tables 20, version 7, themes 11.
    - Chromium UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36`.
    - Firefox UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:153.0) Gecko/20100101 Firefox/153.0`.
    - WebKit UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15`.
    - `pnpm install --frozen-lockfile` → 0. Node suite still 55 files / 973.
    - **Negative control** (leg-1 contentHash → `1cc2c132`, WebKit): exactly that test failed, 1 failed / 73 passed. No `__screenshots__`. Restored and `cmp`-identical.
  - **ck3:**
    - `pnpm build && pnpm test:electron` → 56 files, 974/974. Runtime line: `{"node":"24.21.0","v8":"15.2.124.28-electron.0","electron":"44.7.0"}`. A2: the repo bin won over the host `electron ^41`.
    - `pnpm build && pnpm test` → 56 files, 974/974. Node line: `{"node":"24.20.0","v8":"13.6.233.17-node.53"}`.
    - **Negative control:** `RULESWRIGHT_EXPECT_RUNTIME=electron pnpm exec vitest run tests/proofs/runtime-identity.test.ts` under plain Node → exit 1, `expected 'undefined' to be 'string'`.
    - V8 (all 3 engines × 74) re-ran green.
  - **ck4:**
    - V10 YAML parse → 0.
    - `pnpm exec vitest run tests/proofs/docs-run.test.ts` → 3/3.
    - Each CI-job command run locally: `pnpm exec vitest run --config vitest.browser.config.ts --browser.name=chromium`, `=firefox` and `=webkit` → 74/74 each, exit 0; `pnpm build && pnpm test:electron` → 974/974.
    - **A3 negative controls** (`ci.yml` edited in place, backed up, restored, `cmp`-identical each time): renaming to `test:desktop` fails. Renaming to `test:electron-renamed` and deleting both run steps passed the *prescribed* pin but fail the tightened one. README direction: removing `pnpm test:browser` from the Development block fails; restored and `cmp`-identical.
  - **Every checkpoint:** V1 typecheck, V2 lint, V3 format:check, V4 build, V6 check:isolation and V7 check:security all → 0. `find tests -name __screenshots__` was empty before every commit. `git show --name-only HEAD` listed only lease paths each time.
  - **Clean state:** nothing listens on 63315, and no browser or Electron process from this session is left running.
- **surprises:**
  - (1) **The A1 `--preserveSymlinks` command doesn't work with pnpm.** It cuts Vitest's sibling type packages off, giving exit 2 regardless of `@types/node`. The no-host-leakage intent is proven instead by the clean frozen install, build and typecheck outside `$HOME` (exit 0, 0 outside files). It should be corrected in the record before it's reused.
  - (2) **The existing CI `test` job typechecks before it builds** (`ci.yml` `pnpm typecheck`, then `pnpm build`). The `dist/`-importing journeys (`class-features`, `equipment`, `loot`, `spells`) then fail with TS2307 on a fresh checkout. This was there before this session, hidden locally because `dist/` exists, and likely made up part of ARCH-PRE's 134 errors. DD-B11 leaves existing jobs unchanged, so I didn't touch it. B-BD-1's "`test` job typecheck green" condition will fail until the `typecheck` and `build` steps are swapped.
  - (3) **The prescribed CA-B3 ci.yml checks were satisfiable by the header comment alone,** which names the same commands. Tightened in place (R1).
  - (4) **ck2's `msw` peer auto-installed `@types/node@26.6.5`.** After the 24.19.2 pin, `pnpm dedupe` dropped it: `@types/set-cookie-parser`'s `*` dep moved to 24.19.2, leaving one copy in the lockfile.
  - (5) **pnpm printed only "Ignored build scripts: msw"**, not `esbuild`.
- **deviations:**
  - **rule:** R1
    **checkpoint:** 4
    **paths:** `tests/proofs/docs-run.test.ts`
    **reason:** the prescribed `expect(ci).toContain('vitest.browser.config.ts')` and `expect(ci).toContain('pnpm test:electron')` both matched the new header comment, so deleting both run steps still passed (demonstrated). They now read `toMatch(/^\s*- run: pnpm exec vitest run --config vitest\.browser\.config\.ts --browser\.name=/m)` and `toMatch(/^\s*- run: pnpm test:electron$/m)`, with a comment explaining the anchoring. The other prescribed assertions are unchanged.
  - **rule:** R2
    **checkpoint:** 3
    **paths:** `pnpm-lock.yaml`
    **reason:** ran `pnpm dedupe` after the `@types/node` pin. It only removed the orphaned 26.6.5 entry and its `undici-types@8.9.0` and re-pointed one `*` dependency to 24.19.2, giving A1's single explicit copy.
- **followUp:**
  - B-BD-1: after the human pushes, check the Actions results for `browser (chromium/firefox/webkit)` and `electron` (H10: Linux `--with-deps` and Electron shared libraries can't be checked on macOS). Also check the existing `test` job's typecheck, which fails until surprise (2) is fixed. Owner of the step swap: Orchestrator or Planner, a mechanical CI correction in `ci.yml`.
  - DD-B3 renderer residual: owner is a future feature, if a host reports a renderer-only discrepancy.
  - Final Archivist (do not touch here):
    - PROGRAM-CONFIG Stack *Test* row (l.24) and *CI* row (l.27), Custom Rule 5 (l.165), and Verification Commands (gain `test:browser` and `test:electron`);
    - `arch/v1-core.md:197`, `:1237` and `:1596`;
    - the drift at `PROGRAM-CONFIG.MD:25` (eslint strict-type vs `configs.recommended`);
    - record the A1 `--preserveSymlinks` correction.
  - VERIFY-01: run V8 only when no other browser-mode process holds port 63315; run `pnpm build` before V5 and V9.
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:**
  - `tests/proofs/determinism-oracle.ts`
  - `tests/proofs/combat-characterization.test.ts`
  - `tests/proofs/pack-identity.test.ts`
  - `tests/proofs/runtime-identity.test.ts`
  - `tests/browser/determinism.test.ts`
  - `tests/proofs/docs-run.test.ts`
  - `vitest.config.ts`
  - `vitest.browser.config.ts`
  - `package.json`
  - `pnpm-lock.yaml`
  - `.github/workflows/ci.yml`
  - `README.md`

### OWNER-M05-CI-ORDER — received 2026-10-10 (handle h-8CmY; accepted done 1/1)

I swapped the two steps in the CI `test` job so `pnpm build` runs before `pnpm typecheck`, which fixes B-BD-2. Every check you listed passed, and the change is committed as `fb2bf0e`. It touches only `.github/workflows/ci.yml`. It has only been checked on this Mac; GitHub Actions hasn't run it yet.

In a CI-order run with `dist/` moved aside, `pnpm typecheck` failed as before (exit 2, 34 `error TS`). Then `pnpm build && pnpm typecheck` exited 0.

## Handoff

- **session:** OWNER-M05-CI-ORDER (browser-determinism)
- **status:** done
- **checkpoint:** 1
- **notes:** B-BD-2 fixed under lease rev 1. Commit `fb2bf0e` (parent `84ac934`): the `ci.yml` `test` job now runs `pnpm build` before `pnpm typecheck`, so the `dist/`-importing journeys (H1) get a build before they are type-checked. Contributes to CAP-B4. GitHub Actions has not run it yet (B-BD-1).
- **delivered:** One change to the `test` job only.
  - Before (l.50–52): `      - run: pnpm typecheck` / `      - run: pnpm build` / `        # The loot/equipment journeys read dist/, so the suite needs a fresh build first.`
  - After (l.50–53): `      - run: pnpm build` / `        # The loot/equipment journeys read dist/, so the suite needs a fresh build first.` / `        # Build precedes typecheck too: the dist/-importing journeys fail TS2307 without it.` / `      - run: pnpm typecheck`
  - The header, step names, the other jobs, and the `browser`/`electron` `- run:` lines are unchanged. The diff is +2/−1.
- **verification:**
  - `/usr/bin/ruby -ryaml` load → exit 0. The parsed `test` steps are `[install, build, typecheck, test]`.
  - `pnpm format:check` → exit 0.
  - `pnpm exec vitest run tests/proofs/docs-run.test.ts` → 1 file, 3/3 passed, exit 0.
  - CI-order simulation: moved `dist/` to `/tmp/ruleswright-browser-determinism/dist-aside`.
    - `pnpm typecheck` → exit 2 with 34 `error TS` (15 TS2307, 14 TS7006, 3 TS7031, 2 TS18046). This matches the count the Orchestrator reproduced.
    - `pnpm build && pnpm typecheck` → exit 0.
    - `dist/` is rebuilt fresh, and the aside copy and logs are deleted.
  - `pnpm lint` → exit 0. `pnpm typecheck` → exit 0.
  - `git show --name-only --format= HEAD` → `.github/workflows/ci.yml` only. Working tree is clean.
- **surprises:** —
- **deviations:** —
- **followUp:** B-BD-1 is still open. After the human pushes, read the Actions results for the `test` job's typecheck on Node 18/20/22, plus the `browser` (chromium/firefox/webkit) and `electron` jobs. B-BD-2's acceptance condition holds locally: with `dist/` absent, build then typecheck exits 0, and lint, typecheck and docs-run pass.
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:**
  - `.github/workflows/ci.yml`

### VERIFY-01 — received 2026-10-10 (handle h-TYfd; 12 verified, 1 present-unverified (CAP-B4 Actions, B-BD-1), 0 failed, 0 blocked; VERIFICATION.md committed unchanged by Orchestrator at `8a80ec1`, sha256 933c84c5…e6d1)

I wrote VERIFICATION.md, but `commit_pathspec` refused to commit it because the path is gitignored. Every requirement in scope checks out locally. The only exception is the GitHub Actions run of the new CI jobs, which doesn't exist yet because nothing has been pushed.

**Result:** 13 rows: 12 verified, 1 present-unverified, 0 failed, 0 blocked.

**What I ran at HEAD `5c62f8d`:**
- **Static checks:** build, typecheck, lint, format check, isolation, security and the `ci.yml` parse all exit 0.
- **Node:** after a fresh build, `pnpm test` passes 56 files, 974/974. No `tests/browser` file is picked up by the Node config.
- **Browsers:** 74/74 in each of Chromium (HeadlessChrome/151.0.7922.34), Firefox (153.0) and WebKit (Version/26.5), both per engine and through `pnpm test:browser`. No `__screenshots__` were written.
- **Electron:** `pnpm test:electron` passes 56 files, 974/974, with runtime `{"node":"24.21.0","v8":"15.2.124.28-electron.0","electron":"44.7.0"}`.
- **Golden values:** all 18 characterization digests from `46bcf0c` are unchanged in the oracle. The only new values are the 6 pack digests, and no digest literal exists outside the oracle.
- **Proof the tests can fail:**
  - Changing one pack digest fails exactly that test on Node and in WebKit.
  - The Electron guard fails under plain Node.
  - Deleting the `test:electron` step from `ci.yml`, or the `test:browser` line from the README, fails `docs-run`.
  - Every edited file was restored and confirmed identical with `cmp`.
- **Type source (DD-B13):** in a clean copy of HEAD outside `$HOME`, frozen install, build and typecheck all exit 0, and no type file resolves from outside the copy.
- **CI step order (B-BD-2):** with `dist/` removed, typecheck-first fails (34 errors) and build-then-typecheck passes.

**Three things for the record (none changes a verdict):**
1. **`docs-run` checks less than the README says.** It only checks that the two command strings appear in the README, not the prose claims (l.11-13, l.318-320, the CI paragraph). The README's sentence that `docs-run` checks "this paragraph" and `ci.yml` agree is slightly overstated.
2. **"Verified in CI" is not true yet.** HEAD is 202 commits ahead of `origin/main`. The last visible Actions run (`dadf461`, 2026-09-27) failed, and it predates this feature.
3. **Node 18/20/22 were not run here.** This machine only ran Node 24; the older Node versions run only on Actions.

## Handoff

- **session:** VERIFY-01 (browser-determinism)
- **status:** done
- **checkpoint:** 1
- **notes:** VERIFICATION.md is written but **not committed**. `commit_pathspec` returned `GIT_FAILED` because `.gitignore:29` ignores `/program/Ruleswright/prompts/`. Orchestrator should run `git add -f -- program/Ruleswright/prompts/browser-determinism/VERIFICATION.md` and commit it unchanged (sha256 `933c84c5c7e34999ccdfa61e6c7ad0ffb3af6c5900cb414dd4c407d27b6ae6d1`). Verdicts: 12 verified (CAP-B1, CAP-B2, CAP-B3, CAP-B4 local, CA-B1, CA-B2, CA-B3, FR-1, FR-17, NFR-Determinism, DD-B13, B-BD-2) and 1 present-unverified (CAP-B4/B-BD-1, GitHub Actions execution). Revision `5c62f8d`.
- **delivered:** `program/Ruleswright/prompts/browser-determinism/VERIFICATION.md`: gate-run table, quoted runtime lines, negative controls, pin-integrity check, the 13-row six-column table and 3 observations.
- **verification:**
  - **Static gates:** V1, V2, V3, V4, V6, V7 and V10 all 0.
  - **Scoped Node run:** `pnpm exec vitest run` on the 4 proof files → 4 files, 16/16 (9+3+1+3), exit 0.
  - **V5:** `pnpm build && pnpm test` → 56 files, 974/974, exit 0. No browser test selected.
  - **V8:** 6 files, 74/74 per engine ×3, exit 0, both per engine and via `pnpm test:browser`. The three user-agent lines are quoted in the file.
  - **V9:** `pnpm build && pnpm test:electron` → 56 files, 974/974, exit 0, `electron 44.7.0`.
  - **Negative controls:**
    - NC1: one changed pack digest → Node 1 failed / 2 passed (3); WebKit 1 failed / 12 passed (13).
    - NC2: the Electron guard under plain Node → exit 1.
    - NC3a/b: `ci.yml` step deleted, or README line deleted → `docs-run` 1 failed / 2 passed (3) each.
    - All edited files restored and confirmed identical with `cmp`.
  - **B-BD-2 simulation:** with `dist/` absent, typecheck exits 2 (34 errors); `pnpm build && pnpm typecheck` then exits 0.
  - **DD-B13 clean copy:** `git archive` copy under `/private/tmp`, frozen install, build and typecheck → exit 0, with 0 files resolved outside the copy.
  - **Cleanup:** screenshots none, port 63315 free, tree clean apart from the ignored VERIFICATION.md.
- **surprises:**
  - (1) The gitignore refusal was the expected hazard.
  - (2) The `docs-run` README direction checks only the command strings, not the prose claims, so README l.588's statement about what `docs-run` checks says more than the test enforces.
  - (3) The last visible Actions run on `origin/main` (`dadf461`, 2026-09-27) ended in failure. It predates this feature, and HEAD is 202 commits ahead.
  - (4) The first `--listFiles` count was a false 381 because `/tmp` is a link to `/private/tmp`; recounted as 0 against the real path.
- **deviations:** —
- **followUp:**
  - B-BD-1 (human push, then Archivist): read the Actions results for the `test` job on Node 18/20/22, for `browser` (chromium/firefox/webkit) and for `electron`. Expect older CI drift to show up too.
  - Optional: tighten CA-B3 to cover the README prose claims (owner: Planner, next feature touching `docs-run`).
  - The DD-B3 Electron renderer residual is unchanged.
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:**
  - `program/Ruleswright/prompts/browser-determinism/VERIFICATION.md`
