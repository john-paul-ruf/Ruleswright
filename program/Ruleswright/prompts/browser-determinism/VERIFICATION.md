# Verification — Ruleswright / browser-determinism

- **Envelope:** FR-17 Feature Verification (first pass), read-only except this file.
- **Revision verified:** HEAD `5c62f8d` (tree clean). Implementation: S01 `1d929a7`, `da7bc47`, `48bd4b9`, `66af2e8`; OWNER-M05-CI-ORDER `fb2bf0e`. Plan base `46bcf0c`, plan commit `7dcc22e`.
- **Host:** macOS arm64, Node v24.20.0, pnpm 10.15.0. All runs below were made by this verifier in this pass. Scratch went to `/tmp/ruleswright-browser-determinism-verify/` only.
- **Verdicts:** 12 `verified`, 1 `present-unverified`, 0 `failed`, 0 `blocked` (13 rows).

## Gate runs (this pass)

| Gate | Command | Selected | Exit |
|---|---|---|---|
| V4 | `pnpm build` | — | 0 |
| V1 | `pnpm typecheck` | — | 0 |
| V2 | `pnpm lint` | — | 0 |
| V3 | `pnpm format:check` | — | 0 |
| V6 / V7 | `pnpm check:isolation` / `pnpm check:security` | — | 0 / 0 |
| V10 | `/usr/bin/ruby -ryaml` load of `ci.yml` | jobs `[test, lint, package, themes, browser, electron]` | 0 |
| scoped | `pnpm exec vitest run tests/proofs/{combat-characterization,pack-identity,runtime-identity,docs-run}.test.ts` | 4 files, 16 tests (9 + 3 + 1 + 3) | 0 |
| V5 | `pnpm build && pnpm test` | 56 files, 974/974; no `tests/browser/**` file selected | 0 |
| V8 per engine | `pnpm exec vitest run --config vitest.browser.config.ts --browser.name=<b>` | 6 files, 74/74 for each of chromium, firefox and webkit (determinism 13, rng 12, dice 11, tables 20, version 7, themes 11) | 0 ×3 |
| V8 script | `pnpm test:browser` | 74/74 ×3 | 0 |
| V9 | `pnpm build && pnpm test:electron` | 56 files, 974/974 | 0 |
| screenshots | `find tests -name __screenshots__` after every browser run | empty | — |

**Runtime identity lines quoted from the logs:**

- Chromium: `[determinism] userAgent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36`
- Firefox: `[determinism] userAgent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:153.0) Gecko/20100101 Firefox/153.0`
- WebKit: `[determinism] userAgent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15`
- Electron: `[determinism] runtime={"node":"24.21.0","v8":"15.2.124.28-electron.0","electron":"44.7.0"}`. The repo's `node_modules/electron` is 44.7.0, so the host `~/node_modules` electron ^41 did not win (H13).
- Node: `[determinism] runtime={"node":"24.20.0","v8":"13.6.233.17-node.53"}`

**Negative controls.** Each was a scratch edit of a tracked file. The file was backed up first, then restored and confirmed byte-identical with `cmp`. `git status` was clean afterwards.

- **NC1:** changed the oracle's `PACK_DIGESTS['dark-fantasy'].contentHash` from `21f4de6d` to `21f4de6e`.
  - Node: `vitest run tests/proofs/pack-identity.test.ts` exited 1 with 1 failed / 2 passed (3). Only the dark-fantasy test failed.
  - WebKit: `--browser.name=webkit tests/browser` exited 1 with 1 failed / 12 passed (13). Only `dark-fantasy pack (seed 42)` failed.
  - No screenshots were written.
- **NC2:** ran `RULESWRIGHT_EXPECT_RUNTIME=electron pnpm exec vitest run tests/proofs/runtime-identity.test.ts` under plain Node. It exited 1 with `expected 'undefined' to be 'string'` (1 failed / 1).
- **NC3a:** deleted `ci.yml`'s `- run: pnpm test:electron` line. `docs-run` exited 1 with 1 failed / 2 passed. The header comment still names the command, so this confirms the R1 anchoring.
- **NC3b:** deleted the README Development-block line `pnpm test:browser …`. `docs-run` exited 1 with 1 failed / 2 passed.
- **B-BD-2 simulation:** moved `dist/` aside; it is gitignored and was rebuilt afterwards.
  - `pnpm typecheck` exited 2 with 34 `error TS`.
  - `pnpm build && pnpm typecheck` then exited 0.
- **DD-B13 clean checkout:** extracted `git archive HEAD` to `/private/tmp/ruleswright-browser-determinism-verify/clean`, outside `$HOME` and without `node_modules`.
  - `pnpm install --frozen-lockfile`, `pnpm build` and `pnpm typecheck` all exited 0.
  - `tsc --listFiles` lists 0 files outside the copy and 0 under `/Users/`.
  - The `node` type reference resolves to `clean/node_modules/.pnpm/@types+node@24.19.2/…`.

**Pin integrity (H4).** The 18 digest literals in `46bcf0c:tests/proofs/combat-characterization.test.ts` all appear unchanged in `tests/proofs/determinism-oracle.ts`. The comparison was a sorted `comm` of the two literal sets: nothing appears only in the old set. The only new values are the 6 `PACK_DIGESTS` literals, and they equal the plan-time observations. No 64-hex literal exists in `tests/` or `src/` outside the oracle.

## Requirement table

| ID | Exists | Substantive | Wired | Behavior proof | Verdict |
|---|---|---|---|---|---|
| CAP-B1 | `tests/proofs/determinism-oracle.ts:351` (`LEG_RUNS`), `:373` (`CHARACTERIZATION_DIGESTS`), `:421` (`PACK_DIGESTS`); `tests/proofs/pack-identity.test.ts:15`; `tests/proofs/combat-characterization.test.ts:46-122` | **Oracle:** one module holds the 9 leg setups and 9 leg digest pairs, moved unchanged from `46bcf0c` (see Pin integrity), plus 3 pack digest pairs. It imports no `node:*` and does not read `process`. **Node consumers:** `combat-characterization` checks `toEqual(CHARACTERIZATION_DIGESTS[id])` through `node:crypto` sha256 plus `contentHashOfRaw`, and keeps its per-leg behavioural asserts. `pack-identity` checks the raw sha256 and `packContentHash` of `generateCampaign(theme, seed 42)` against `PACK_DIGESTS`. | `pnpm test` (`vitest.config.ts` includes `tests/**/*.test.ts`), which is CI job `test` on Node 18/20/22 (`ci.yml:33`) and the `package` job's `vitest run tests/proofs/` | Scoped run: 9/9 + 3/3, exit 0. V5: 56 files 974/974, exit 0. NC1 (Node): 1 failed / 2 passed on exactly the edited subject. | verified |
| CAP-B2 | `tests/browser/determinism.test.ts:43-61`; `vitest.browser.config.ts:1-23`; `package.json:51` (`test:browser`) | Runs the real `src/` oracle subjects (all 9 legs, 3 packs) inside each engine. It hashes them with WebCrypto `subtle.digest('SHA-256', TextEncoder)` (`:37`) and checks them with `toEqual` against the Node-pinned digests. The config includes 5 pure suites, uses the playwright provider, runs headless and sets `screenshotFailures: false`. **Limit:** this leg exercises `src/` transformed by Vite, not `dist/`; the README and `ci.yml` header both disclose this. | `pnpm test:browser`, and CI job `browser` matrix `[chromium, firefox, webkit]` (`ci.yml:113-132`) | V8 per engine: 6 files, 74/74 ×3, exit 0. `pnpm test:browser`: 74/74 ×3, exit 0. UAs quoted above. NC1 (WebKit): 1 failed / 12 passed on exactly the edited subject. Screenshots: none. | verified |
| CAP-B3 | `package.json:52` (`test:electron`), `:63` (`electron` 44.7.0); `tests/proofs/runtime-identity.test.ts:12-20` | `test:electron` runs `install.js`, then `ELECTRON_RUN_AS_NODE=1 RULESWRIGHT_EXPECT_RUNTIME=electron electron node_modules/vitest/vitest.mjs run`. That runs the whole suite, including the oracle, `combat-characterization`, `pack-identity` and the `dist/` journeys, on Electron's bundled Node/V8. The guard requires `typeof process.versions.electron === 'string'` when the variable is set. **Residual (DD-B3, disclosed):** nothing runs inside an Electron renderer process. | `pnpm build && pnpm test:electron`, and CI job `electron` (`ci.yml:134-150`) | V9: 56 files 974/974, exit 0, with the `"electron":"44.7.0"` runtime line. NC2: plain Node with the variable set exits 1. | verified |
| CAP-B4 (local: docs ↔ CI honesty) | `tests/proofs/docs-run.test.ts:236-253`; `README.md:11-13, 318-320, 564-565, 576-590`; `.github/workflows/ci.yml:13-27, 113-150` | **README direction:** requires `pnpm test:browser` and `pnpm test:electron`. **ci.yml direction:** anchors on the `- run:` lines for the browser config and `pnpm test:electron`, plus the matrix `[chromium, firefox, webkit]`. It also forbids the README's old `browser … v1.1 follow-up` wording. The README text matches what is built: 3 engines, the oracle plus pure suites, the src-via-Vite disclosure, the Electron whole suite and the renderer residual. **Limit:** the README direction checks only the command strings (in practice the Development block), not the prose claims at l.11-13, l.318-320 or the CI paragraph. So the README's sentence "`docs-run` checks that this paragraph and `ci.yml` agree" says more than the test enforces. | `pnpm test`, which runs `docs-run` | Scoped `docs-run`: 3/3, exit 0. NC3a (ci.yml step deleted) and NC3b (README line deleted) each fail 1/3. V10: 0. | verified |
| CAP-B4 / B-BD-1 (GitHub Actions execution) | `.github/workflows/ci.yml:33-56` (`test`), `:113-132` (`browser`), `:134-150` (`electron`) | The jobs parse (V10), and every command in them passed locally: frozen install, build, typecheck, test, the per-engine browser runs and `test:electron`. The Linux pieces cannot run on this host (H10): `playwright install --with-deps`, the Electron shared libraries, and the Node 18/20 legs. | The workflow only runs on push or PR. `git status -sb` shows `main...origin/main [ahead 202]`, and no remote branch contains `66af2e8`. The latest visible Actions run (`gh run list`) is for `dadf461`, 2026-09-27, ended `failure`, and predates this feature. | none (no Actions run of these jobs exists) | present-unverified |
| CA-B1 | `determinism-oracle.ts:364` (`recordingRaw`), `:369` (`contentHashOfRaw`), `:417` (`packRaw`) | **Same hash definitions on both routes:** sha256 is taken over the UTF-8 bytes of the same raw text. Node uses `createHash('sha256').update(raw)` (`combat-characterization.test.ts:43`, `pack-identity.test.ts:19`). Browsers use `subtle.digest` over `TextEncoder.encode(raw)`. contentHash is `packContentHash(JSON.parse(raw))` on both. **Single source:** no digest literal exists outside the oracle (grep). | Consumed by 3 test files across the node, browser and Electron configs | V5 (Node) and V8 ×3 (browsers) reproduce all 12 subjects. NC1 fails on both routes. | verified |
| CA-B2 | `tests/browser/determinism.test.ts:43-47`; `tests/proofs/runtime-identity.test.ts:12-20` | **Browser:** asserts `process?.versions?.node` is undefined and the UA matches `/Mozilla/`, and logs the UA. **Electron:** under the variable, requires `versions.electron` to be a string, and logs `{node, v8, electron}`. | Browser config include list; `test:electron` sets the variable | V8 ×3: guard passed, UAs quoted above. V9: guard passed, `electron 44.7.0`. NC2: exit 1. | verified |
| CA-B3 | `tests/proofs/docs-run.test.ts:236-253` | Covers both directions as specified, with the R1-tightened `- run:` anchoring. See the CAP-B4 limit on prose coverage. | `pnpm test` | 3/3, exit 0. NC3a and NC3b each fail. | verified |
| FR-1 ("same seed + same call sequence ⇒ identical results on every platform", `requirements.md:29`) | the oracle legs; `tests/core/rng.test.ts`, `dice.test.ts`, `tables.test.ts` in both configs | 9 seeded combat legs (`Rng` streams, events plus snapshots) reproduce byte-identical digests. The pure RNG, dice and table suites pass unmodified on Node, Chromium, Firefox, WebKit and Electron's Node/V8. The Node 18/20/22 matrix part is covered by the Actions row. | node config, browser config and `test:electron` | `combat-characterization` 9/9 (Node); determinism legs 9 ×3 engines; V9 974 (Electron); rng 12, dice 11 and tables 20 ×3 engines. All exit 0. | verified |
| FR-17 ("same theme + seed + knobs ⇒ byte-identical pack", `requirements.md:176`) | `determinism-oracle.ts:417-434`; `pack-identity.test.ts:15-22`; `determinism.test.ts:56-61` | Takes the raw `JSON.stringify` text of `generateCampaign` for 3 bundled themes at seed 42 with default knobs. It is pinned by sha256 of the UTF-8 bytes, so this is byte identity, not just canonical identity. The text is reproduced on Node, in 3 browser engines and on Electron. | node config, browser config and `test:electron` | `pack-identity` 3/3 (Node, Electron within 974); 3 pack tests ×3 engines. NC1 fails on Node and WebKit. | verified |
| NFR-Determinism (`requirements.md:245`: byte-identical packs and identical roll sequences on Node, browsers, Electron) | CAP-B1, CAP-B2, CAP-B3 artifacts | Each runtime named is exercised against one set of Node-pinned goldens. **Disclosed limits:** the browser leg runs `src/` via Vite rather than the shipped `dist/` bundle, and Electron covers its Node/V8 runtime, not a renderer process. Both limits are stated in the README and `ci.yml`. | `pnpm test`, `pnpm test:browser`, `pnpm test:electron` | V5 974/974; V8 74/74 ×3; V9 974/974 (electron 44.7.0). All exit 0. | verified |
| DD-B13 (`@types/node` explicit, in-repo) | `package.json:60` (`"@types/node": "24.19.2"`) | Exact pin, with a single `@types/node@24.19.2` entry in `pnpm-lock.yaml`. `package.json` has no `dependencies` key, so runtime dependencies stay empty. In the repo, `tsc --traceResolution` resolves `node` to `node_modules/.pnpm/@types+node@24.19.2/…`, not the host `~/node_modules/@types/node@25.5.0`. | `pnpm typecheck` (CI `test` job) | Clean `git archive` copy under `/private/tmp`: frozen install, build and typecheck all exit 0; `--listFiles` shows 0 files outside the copy. Repo V1: 0. | verified |
| B-BD-2 (CI `test` job builds before typecheck) | `.github/workflows/ci.yml:50-54` | The parsed `test` steps are `[checkout, pnpm-setup, setup-node, install, build, typecheck, test]`. **Behavioural check:** with `dist/` absent, typecheck-first exits 2 (34 `error TS`); build-then-typecheck exits 0. Running this on Actions is part of the B-BD-1 row. | CI job `test` (Node 18/20/22) | V10 parse 0. Local simulation: exit 2, then exit 0 (above). | verified |

## Observations for the record (no verdict change)

1. **CA-B3 prose coverage gap.** `docs-run` keys the README direction to command strings only. A future edit could change the l.11-13 or l.318-320 claims, or the CI paragraph, without failing, as long as the Development block keeps both commands. The README sentence "`docs-run` checks that this paragraph and `ci.yml` agree" overstates this slightly. Owner: the next feature touching `docs-run`/README (Planner), if tightening is wanted.
2. **"Verified in CI" (README l.12-13, l.319-320).** This wording describes the configured CI. Until the human pushes, no Actions run of the `browser` or `electron` jobs exists (B-BD-1). The last visible Actions run on `origin/main` (`dadf461`, 2026-09-27) failed. It predates this feature and is 202 commits behind HEAD, but whoever reads B-BD-1 should expect the first push to also surface any older CI drift.
3. **Node version coverage.** This host ran Node 24.20.0 (plus Electron's Node 24.21.0). The Node 18/20/22 legs claimed by the README run only on Actions (B-BD-1).
