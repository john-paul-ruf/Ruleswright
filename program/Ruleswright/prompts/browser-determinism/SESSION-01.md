# SESSION-01 — Determinism oracle, browser leg, Electron leg, CI and honest docs

> **Program:** Ruleswright
> **Feature:** browser-determinism
> **Modules:** tests, M05 (packaging/CI/docs) — no `src/` change
> **Depends on:** —
> **Concurrent with:** —
> **Owns:** `tests/proofs/determinism-oracle.ts`, `tests/proofs/combat-characterization.test.ts`, `tests/proofs/pack-identity.test.ts`, `tests/proofs/runtime-identity.test.ts`, `tests/browser/determinism.test.ts`, `tests/proofs/docs-run.test.ts`, `vitest.config.ts`, `vitest.browser.config.ts`, `package.json`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`, `README.md`. **Scratch only, never committed:** `/tmp/ruleswright-browser-determinism/**`
> **Reads:** `src/schema/version.ts`, `src/compiler/index.ts`, `src/runtime/index.ts`, `src/core/rng.ts`, `tests/runtime/fixtures/packs.ts`, `tests/core/{rng,dice,tables}.test.ts`, `tests/schema/version.test.ts`, `tests/compiler/themes.test.ts`, `tsconfig.json`, `eslint.config.mjs`, `.prettierignore`, `program/Ruleswright/PROGRAM-CONFIG.MD`, `program/Ruleswright/prompts/browser-determinism/STATE.md`
> **Resources:** `vitest-browser-port` (Vitest browser-mode server, default port 63315 — never run two browser-mode invocations at once); network (`pnpm add`, Electron binary download)
> **Checkpoints:** 4

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| tests | Behaviour pin | `tests/proofs/combat-characterization.test.ts:1-18` (header, re-key owner rule), `:19-47` (imports), `:49-345` (helpers + 9 legs), `:348-453` (assertions + pinned digests) | move the legs and digests into the shared oracle **without changing one digest** |
| tests | Docs pin | `tests/proofs/docs-run.test.ts:15-26` (header), `:44-45` (`readme`), `:220-243` (anatomy + CI-claim honesty pin) | re-key the honesty pin in the same checkpoint as the README edit |
| M01 | Version | `src/schema/version.ts:46-48` (`packContentHash`), `:62-70` (FNV-1a, pure integer math) | the cross-engine digest that needs no `node:crypto` |
| M05 | CI | `.github/workflows/ci.yml:1-18` (header), `:27-48` (Node matrix job) | add the browser and Electron jobs, rewrite the header |
| M05 | Docs | `README.md:11-13`, `:316-320`, `:555-568` (Development block), `:570-579` (CI paragraph) | the four "v1.1 follow-up" claims become true statements |
| M05 | Config | `vitest.config.ts` (whole file, 16 lines), `package.json` `scripts`/`devDependencies`, `tsconfig.json` (`lib: ["es2020"]`, no DOM) | the node config excludes the browser file; new scripts; no DOM lib |

## Context

FR-1 says "identical results on every platform". NFR-Determinism says "byte-identical packs and identical roll sequences on Node, browsers, and Electron". Today only Node is proven: CI runs the whole suite on Node 18/20/22. The browser leg has been a tracked v1.1 follow-up since v1-core (`ci.yml:14-18`, `README.md:13, 319-320, 577-578`, `vitest.config.ts:5`, PROGRAM-CONFIG Custom Rule 5). Electron is not mentioned anywhere as a proof.

**No product or engine code changes.** This session adds proof machinery and makes the docs say what CI does.

The cross-engine oracle already exists. `combat-characterization.test.ts` pins two digests per leg for 9 scripted legs: raw sha256 and `packContentHash`, a pure-JS FNV-1a over canonical JSON. These are golden values captured on Node. Reproducing them on another engine proves that engine produces the same events and snapshots. Planner probed this end to end at plan HEAD `46bcf0c` in a scratch copy (`/tmp/rw-probe`, outside the repo). Results are in STATE *Verification Baseline → Plan-time probes*:

- **Browsers:** Vitest 2.1.8 browser mode + `@vitest/browser@2.1.8` + `playwright@1.62.1` passed in Chromium 151, Firefox 153 and WebKit 26.5.
  - All 9 pinned `contentHash` values matched.
  - WebCrypto `crypto.subtle.digest('SHA-256', TextEncoder.encode(raw))` matched a known vector.
  - The 3 generated packs gave identical raw sha256 and `contentHash` on Node, Firefox and WebKit.
  - The pure suites `tests/core/{rng,dice,tables}.test.ts`, `tests/schema/version.test.ts` and `tests/compiler/themes.test.ts` passed unchanged in WebKit (61 tests).
- **Electron:** the **whole** repo suite passed 970/970 under `ELECTRON_RUN_AS_NODE=1` with `electron@44.7.0` (Node 24.21.0, V8 15.2.124.28-electron.0).

## Capabilities

- **CAP-B1** (shared determinism oracle on Node): integration owner, **ck1**. The 9 leg digests are unchanged, and 3 generated-pack digests are added (FR-17 byte identity).
- **CAP-B2** (browser leg): integration owner, **ck2**. `pnpm test:browser` reproduces every oracle digest in Chromium, Firefox and WebKit, and runs the 5 pure suites there.
- **CAP-B3** (Electron leg): integration owner, **ck3**. `pnpm test:electron` runs the whole suite under Electron's runtime, with a guard proving it ran there.
- **CAP-B4** (CI + honest docs): integration owner, **ck4**. `ci.yml` runs both legs. README, the `ci.yml` header and the `docs-run` pin agree with what CI does, checked in both directions.
  - **Local proof:** every CI command runs locally.
  - **GitHub Actions execution:** stays *present-unverified* until the first push. That push is outside this session; see STATE *Current Blockers* B-BD-1.

First narrow journey: ck2. The real compiler and runtime (`src/`) run inside a real browser engine and are checked against Node-captured golden digests. No doubles.

## Contract Agreements

- **CA-B1** (one oracle, two hash routes): owner, ck1 (producer) and ck2 (browser consumer).
  - **Rule:** subjects and expected digests live **only** in `tests/proofs/determinism-oracle.ts`. Never duplicate a digest literal into another file.
  - **Raw route:** `raw = JSON.stringify(...)`. Node hashes it with `createHash('sha256').update(raw).digest('hex')` (UTF-8). Browsers hash it with `crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))` → lowercase hex.
  - **Canonical route:** `contentHash` is `packContentHash(JSON.parse(raw))` for legs and `packContentHash(pack)` for packs.
- **CA-B2** (a leg proves where it ran): owner, ck2 (browser) and ck3 (Electron).
  - **Browser:** `globalThis.process?.versions?.node` is `undefined`, and `navigator.userAgent` is logged.
  - **Electron:** when `RULESWRIGHT_EXPECT_RUNTIME === 'electron'`, `process.versions.electron` is a string and is logged. Under plain Node with the variable set, the guard **fails** (negative control).
- **CA-B3** (README ↔ CI honesty): owner, ck4. `docs-run` reads both `README.md` and `.github/workflows/ci.yml`. Every determinism leg the README names, `ci.yml` runs, and the old follow-up wording is gone.
- No database, IPC or serialized product contract is touched: `src/` is unchanged, and so are the snapshot and pack schemas.

**Checkpoint-0 recheck (read-only; report any mismatch before editing):**
- `git diff --quiet 46bcf0c -- src tests vitest.config.ts package.json .github README.md` exits 0. Otherwise re-read the moved regions before editing.
- `grep -c "sha256: '" tests/proofs/combat-characterization.test.ts` = 9, and `grep -c "contentHash: '" …` = 9.
- `ls ~/Library/Caches/ms-playwright` lists `chromium_headless_shell-1234`, `firefox-1538` and `webkit-2336`, the revisions `playwright@1.62.1` uses. If any is missing, run `pnpm exec playwright install <browser>` after ck2's `pnpm add` and record the download.
- `pnpm test` = 54 files, 970/970 (after `pnpm build`, H1).

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `tests/proofs/determinism-oracle.ts` | create (ck1) | leg helpers and the 9 legs moved verbatim; `LEG_RUNS`, `CHARACTERIZATION_DIGESTS`, `PACK_THEMES`, `packRaw`, `PACK_DIGESTS`, `recordingRaw`, `contentHashOfRaw`, `ofType`; no `node:` import |
| `tests/proofs/combat-characterization.test.ts` | modify (ck1) | imports from the oracle; keeps every per-leg assertion; compares to `CHARACTERIZATION_DIGESTS[...]` |
| `tests/proofs/pack-identity.test.ts` | create (ck1) | 3 tests: each theme's raw sha256 + `contentHash` equals `PACK_DIGESTS` |
| `vitest.config.ts` | modify (ck2) | `exclude: [...configDefaults.exclude, 'tests/browser/**']`; comment rewritten |
| `vitest.browser.config.ts` | create (ck2) | browser-mode config (playwright, headless, `screenshotFailures: false`, explicit include list) |
| `tests/browser/determinism.test.ts` | create (ck2) | 13 tests: runtime-identity guard, 9 legs, 3 packs |
| `package.json` / `pnpm-lock.yaml` | modify (ck2, ck3) | exact devDeps `@vitest/browser@2.1.8`, `playwright@1.62.1` (ck2), `electron@44.7.0` (ck3); scripts `test:browser` (ck2), `test:electron` (ck3) |
| `tests/proofs/runtime-identity.test.ts` | create (ck3) | logs `{node, v8, electron}`; Electron guard under `RULESWRIGHT_EXPECT_RUNTIME` |
| `.github/workflows/ci.yml` | modify (ck4) | header rewritten; jobs `browser` (matrix chromium/firefox/webkit) and `electron` |
| `README.md` | modify (ck4) | l.11-13, l.318-320, l.570-579 claims made true; Development block gains `test:browser`/`test:electron` and the one-time `playwright install` |
| `tests/proofs/docs-run.test.ts` | modify (ck4) | header l.22-25; honesty pin l.238-243 re-keyed to read `ci.yml` too (CA-B3) |

## Implementation

### Checkpoint 1 — the shared oracle, Node-side

1. Create `tests/proofs/determinism-oracle.ts`.
   - **Header:** this is the cross-engine determinism oracle (FR-1, FR-17, NFR-Determinism) and the home of the combat-characterization behaviour pin. Carry the **re-key owner rule** from `combat-characterization.test.ts:12-15` verbatim, and extend it with one sentence: `PACK_DIGESTS` re-keys whenever a bundled theme or the compiler output changes, by the same rule.
   - **Move verbatim** from `combat-characterization.test.ts:21-345`: the value imports (`src/compiler`, `src/runtime/index`, `src/core/rng`, `src/schema/version`, `src/schema/pack` type, `../runtime/fixtures/packs`) and everything from `SEED` through `characterLeg`, **except** `digests()` (l.77-83, which uses `node:crypto`).
   - **Export** `Recording`, `ofType`, and the leg functions the Node test calls directly (`parryLeg`, `leavingReachLeg`, `restoreLeg`, `vancianLeg`, `poolLeg`, `useLeg`, `featLeg`, `selfLeg`, `characterLeg`).
   - **Add:**
     ```ts
     export type LegId = 'leg-1' | 'leg-2' | 'leg-3a' | 'leg-3b' | 'leg-4' | 'leg-5' | 'leg-6' | 'leg-7' | 'leg-8';
     export interface Digest { readonly sha256: string; readonly contentHash: string }
     export const LEG_RUNS: Readonly<Record<LegId, () => Recording>> = {
       'leg-1': parryLeg, 'leg-2': leavingReachLeg, 'leg-3a': vancianLeg, 'leg-3b': poolLeg,
       'leg-4': useLeg, 'leg-5': featLeg, 'leg-6': selfLeg,
       'leg-7': () => restoreLeg(leavingReachLeg().paused), 'leg-8': characterLeg,
     };
     /** Raw, key-order-sensitive text the sha256 half is taken over. */
     export function recordingRaw(r: Recording): string { return JSON.stringify({ events: r.events, snapshots: r.snapshots }); }
     export function contentHashOfRaw(raw: string): string { return packContentHash(JSON.parse(raw)); }
     export const CHARACTERIZATION_DIGESTS: Readonly<Record<LegId, Digest>> = { /* the 9 pairs, copied character-for-character from l.358-450 */ };
     export const PACK_THEMES = ['dark-fantasy', 'zombie-urban', 'wyldwood'] as const;
     export function packRaw(theme: (typeof PACK_THEMES)[number]): string { return JSON.stringify(generated(theme)); }
     export const PACK_DIGESTS: Readonly<Record<(typeof PACK_THEMES)[number], Digest>> = {
       'dark-fantasy': { sha256: '6f87f212e259460c1f0a464c277583102e7bead07ae8f01d3b95cf7cb57e1f3e', contentHash: '21f4de6d' },
       'zombie-urban': { sha256: 'fc80c83d7160ac147b00bf00341a6b1b5c8ea9c2bdf95f4094a036516b0cafe4', contentHash: 'c2bbbd7b' },
       wyldwood: { sha256: 'fc31b3a2c78f676c8307c208fc7543aac816bfacdb165084afc5f29e094bb190', contentHash: '273468f5' },
     };
     ```
   - The `PACK_DIGESTS` values are Planner's plan-time observation (seed 42, default knobs, `46bcf0c`; Node, Firefox and WebKit agreed). **Re-observe them on Node before pinning.** If they differ, stop: that is a finding, not a re-key.
   - The file must not import `node:*` and must not use `process`, because ck2 imports it in browsers.
2. Rewrite `combat-characterization.test.ts`.
   - Keep the header, but say that the legs and digests now live in `determinism-oracle.ts`.
   - Keep `import { createHash } from 'node:crypto'` and a local `digests(r)` that returns `{ sha256: createHash('sha256').update(recordingRaw(r)).digest('hex'), contentHash: contentHashOfRaw(recordingRaw(r)) }`.
   - Keep every `it(...)` title and every non-digest assertion exactly. Each `expect(digests(leg)).toEqual({...literal...})` becomes `toEqual(CHARACTERIZATION_DIGESTS['leg-N'])`.
3. Create `tests/proofs/pack-identity.test.ts`: `describe('FR-17 — generated packs are byte-identical (cross-engine oracle)')`, with one `it` per theme over `PACK_THEMES`. It asserts `{ sha256 of packRaw(theme) via node:crypto, contentHash: packContentHash(JSON.parse(packRaw(theme))) }` equals `PACK_DIGESTS[theme]`.

**Commit when:**
- `pnpm build && pnpm test` = 55 files, **973/973** (970 + 3).
- `pnpm exec vitest run tests/proofs/combat-characterization.test.ts` passes 9/9.
- **No re-key:** `git diff 46bcf0c -- tests/proofs | grep -E "^[-+].*'[0-9a-f]{8}'|^[-+].*'[0-9a-f]{64}'"` shows each of the 18 characterization literals only as a `-` line in the test and a `+` line in the oracle. Same value set: compare sorted lists of `-` and `+` values, ignoring the 6 new `PACK_DIGESTS` values.
- `pnpm typecheck`, `pnpm lint` and `pnpm format:check` all exit 0.
- **Negative control** (scratch, reverted, confirmed with `cmp` against a `/tmp/ruleswright-browser-determinism/` copy): change `SEED = 42` to `43` in the oracle → both `pack-identity` and the generated-pack legs fail.

### Checkpoint 2 — the browser leg (Chromium, Firefox, WebKit)

1. Run `pnpm add -D --save-exact @vitest/browser@2.1.8 playwright@1.62.1`.
   - pnpm 10 will print "Ignored build scripts: esbuild, msw". That is expected; leave it.
   - Do **not** upgrade `vitest`.
   - Confirm that `pnpm install --frozen-lockfile` then exits 0.
2. Edit `vitest.config.ts`: `import { configDefaults, defineConfig } from 'vitest/config'` and add `exclude: [...configDefaults.exclude, 'tests/browser/**']`.
   - **Why:** the browser file uses global WebCrypto, which Node 18 (a CI matrix leg) does not expose without a flag. It also must not count in `pnpm test`.
   - Replace the D4 comment: node env here; the browser leg is `vitest.browser.config.ts`.
3. Create `vitest.browser.config.ts`:
   ```ts
   import { defineConfig } from 'vitest/config';
   // Browser determinism leg (FR-1, NFR-Determinism). One engine per run: `--browser.name=chromium|firefox|webkit`.
   export default defineConfig({
     test: {
       include: [
         'tests/browser/**/*.test.ts',
         'tests/core/rng.test.ts', 'tests/core/dice.test.ts', 'tests/core/tables.test.ts',
         'tests/schema/version.test.ts', 'tests/compiler/themes.test.ts',
       ],
       browser: { enabled: true, provider: 'playwright', name: 'chromium', headless: true, screenshotFailures: false },
     },
   });
   ```
   - `screenshotFailures: false` is required. Without it, a failing test writes PNGs into `tests/**/__screenshots__/` (probed: H9).
   - The CLI flag `--browser.name=<b>` overrides `name` (probed: the Firefox and WebKit user agents were observed).
4. Create `tests/browser/determinism.test.ts`.
   - **No DOM lib:** `tsconfig.json` is `lib: ["es2020"]`, which keeps `src/` DOM-free. Do not add `/// <reference lib="dom" />`. Reach browser globals through a local type:
     ```ts
     interface BrowserGlobals {
       readonly crypto: { readonly subtle: { digest(algorithm: 'SHA-256', data: Uint8Array): Promise<ArrayBuffer> } };
       readonly TextEncoder: new () => { encode(text: string): Uint8Array };
       readonly navigator: { readonly userAgent: string };
       readonly process?: { readonly versions?: { readonly node?: string } };
     }
     const g = globalThis as unknown as BrowserGlobals;
     async function sha256Hex(text: string): Promise<string> {
       const bytes = new Uint8Array(await g.crypto.subtle.digest('SHA-256', new g.TextEncoder().encode(text)));
       return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
     }
     ```
   - **Tests:**
     - `it('runs in a browser engine, not Node (CA-B2)')`: `expect(g.process?.versions?.node).toBeUndefined()`, `expect(g.navigator.userAgent).toMatch(/Mozilla/)`, then `console.log('[determinism] userAgent=' + g.navigator.userAgent)`.
     - `it.each(Object.keys(LEG_RUNS) as LegId[])('%s reproduces its Node-pinned digests', async (id) => { const raw = recordingRaw(LEG_RUNS[id]()); expect({ sha256: await sha256Hex(raw), contentHash: contentHashOfRaw(raw) }).toEqual(CHARACTERIZATION_DIGESTS[id]); })`.
     - `it.each(PACK_THEMES)` does the same with `packRaw(theme)` / `PACK_DIGESTS[theme]`, using `packContentHash(JSON.parse(raw))`.
5. Add the `package.json` script `"test:browser": "vitest run --config vitest.browser.config.ts --browser.name=chromium && vitest run --config vitest.browser.config.ts --browser.name=firefox && vitest run --config vitest.browser.config.ts --browser.name=webkit"`.

**Commit when:**
- `pnpm test:browser` exits 0 with **74 tests per engine** (13 + rng 12 + dice 11 + tables 20 + version 7 + themes 11), and the three logged user agents name Chrome/HeadlessChrome, Firefox and Safari/AppleWebKit. Record them.
- `pnpm build && pnpm test` is still 55 files / 973 (the browser file is excluded).
- `pnpm typecheck`, `lint` and `format:check` all exit 0.
- **Negative control** (scratch, reverted, `cmp`-confirmed): in the oracle, change `'leg-1'`'s `contentHash` to `'1cc2c132'` → `pnpm exec vitest run --config vitest.browser.config.ts --browser.name=webkit` fails on leg-1, and no `__screenshots__` directory appears (`find tests -name __screenshots__` is empty).

### Checkpoint 3 — the Electron leg (whole suite under Electron's runtime)

1. Run `pnpm add -D --save-exact electron@44.7.0`.
   - Do **not** add `pnpm.onlyBuiltDependencies`. The binary is opt-in (DD-B4): plain `pnpm install` must not download it, so the Node, lint, package and themes CI jobs stay unchanged.
   - Then run `pnpm install --frozen-lockfile` → 0.
2. Add the `package.json` script `"test:electron": "node node_modules/electron/install.js && ELECTRON_RUN_AS_NODE=1 RULESWRIGHT_EXPECT_RUNTIME=electron electron node_modules/vitest/vitest.mjs run"`.
   - `install.js` exits early when the pinned binary is already installed (`isInstalled()`), so the script is idempotent.
   - Vitest's forked workers inherit Electron as `execPath` together with the environment (probed: the workers reported `electron: 44.7.0`).
3. Create `tests/proofs/runtime-identity.test.ts`:
   ```ts
   import { describe, expect, it } from 'vitest';
   describe('runtime identity (CA-B2)', () => {
     it('records the engine this suite ran on; under RULESWRIGHT_EXPECT_RUNTIME=electron it must be Electron', () => {
       const versions = process.versions as NodeJS.ProcessVersions & { electron?: string };
       console.log('[determinism] runtime=' + JSON.stringify({ node: versions.node, v8: versions.v8, electron: versions.electron }));
       if (process.env['RULESWRIGHT_EXPECT_RUNTIME'] === 'electron') expect(typeof versions.electron).toBe('string');
     });
   });
   ```
   - `@types/node` is **not** installed. Even so, Planner verified that inside this repo's program (the repo tsconfig, together with `tests/runtime/encounter.test.ts`) `process`, `NodeJS.ProcessVersions`, `process.env['…']` and `console` all typecheck (`tsc --noEmit` → 0). The `BrowserGlobals` cast from ck2 typechecks too.

**Commit when:**
- `pnpm build && pnpm test:electron` passes **974/974** (55 + 1 = 56 files), and the log line shows `"electron":"44.7.0"`.
- `pnpm build && pnpm test` passes 56 files / **974/974** on Node.
- **Negative control:** `RULESWRIGHT_EXPECT_RUNTIME=electron pnpm exec vitest run tests/proofs/runtime-identity.test.ts` under plain Node **fails** (the guard bites).
- `pnpm typecheck`, `lint` and `format:check` all exit 0.

### Checkpoint 4 — CI jobs and honest docs (CA-B3)

1. Edit `.github/workflows/ci.yml`.
   - Rewrite the header l.11-18. Determinism is proven on three runtimes:
     - the whole suite on Node 18/20/22;
     - the oracle plus the pure suites in Chromium, Firefox and WebKit (`vitest.browser.config.ts`);
     - the whole suite under Electron's runtime (`pnpm test:electron`).
     
     Electron's renderer is Chromium, which the Chromium leg covers (DD-B3).
   - Add two jobs, copying the existing jobs' checkout / pnpm 10.15.0 / Node 22 / `pnpm install --frozen-lockfile` steps:
     ```yaml
     browser:
       name: determinism · browser (${{ matrix.browser }})
       runs-on: ubuntu-latest
       strategy:
         fail-fast: false
         matrix:
           browser: [chromium, firefox, webkit]
       steps:
         # …checkout, pnpm, node 22, install…
         - run: pnpm exec playwright install --with-deps ${{ matrix.browser }}
         - run: pnpm exec vitest run --config vitest.browser.config.ts --browser.name=${{ matrix.browser }}
           name: the Node-pinned oracle digests + pure suites reproduce in a real browser engine (FR-1, NFR-Determinism)
     electron:
       name: determinism · electron runtime (whole suite)
       runs-on: ubuntu-latest
       steps:
         # …checkout, pnpm, node 22, install…
         - run: pnpm build
         - run: pnpm test:electron
           name: the whole suite under Electron's own Node/V8 (ELECTRON_RUN_AS_NODE)
     ```
2. Edit `README.md`. Wording is yours; the facts are fixed:
   - **l.11-13:** verified on the Node 18/20/22 CI matrix, in Chromium, Firefox and WebKit (Vitest browser mode), and under Electron's runtime.
   - **l.318-320:** the same parenthetical, without "v1.1 follow-up".
   - **l.570-579 (CI paragraph):** name the `browser` job and the `electron` job. Add one sentence that Electron is proven under its own Node/V8 runtime and that its renderer engine is covered by the Chromium leg.
   - **Development block (l.557-568), a ```sh fence (never ```ts, see the pin audit):** add `pnpm test:browser   # determinism oracle + pure suites in Chromium, Firefox, WebKit (first run: pnpm exec playwright install chromium firefox webkit)` and `pnpm test:electron  # the whole suite under Electron's runtime (run pnpm build first)`.
3. Edit `tests/proofs/docs-run.test.ts`.
   - Header l.22-25: the honesty pin now checks both directions against `ci.yml`.
   - Replace l.238-243 with:
     ```ts
     // CI-claim honesty (NFR-DX), both directions: every determinism leg the README names, ci.yml runs.
     const ci = readFileSync(fileURLToPath(new URL('../../.github/workflows/ci.yml', import.meta.url)), 'utf8');
     expect(readme).toContain('pnpm test:browser');
     expect(readme).toContain('pnpm test:electron');
     expect(ci).toContain('vitest.browser.config.ts');
     expect(ci).toMatch(/browser:\s*\[chromium, firefox, webkit\]/);
     expect(ci).toContain('pnpm test:electron');
     expect(readme).not.toMatch(/browser[^.]*v1\.1 follow-up/);
     expect(readme).not.toContain('browser matrix runs in CI');
     ```
     `readFileSync` and `fileURLToPath` are already imported at l.38-39.

**Commit when:**
- `ruby -ryaml -e 'YAML.load_file(".github/workflows/ci.yml")'` exits 0.
- `pnpm format:check` exits 0 (Prettier formats YAML and Markdown).
- `pnpm typecheck` and `lint` exit 0.
- `pnpm build && pnpm test` = 56 files, **974/974**; `docs-run` passes.
- **Every command the two new jobs run passes locally:** `pnpm exec vitest run --config vitest.browser.config.ts --browser.name=<b>` for all three browsers, and `pnpm build && pnpm test:electron`. Skip `playwright install --with-deps`, which is Linux-only; the browsers are cached.
- `pnpm check:isolation` and `check:security` exit 0.
- **Negative control:** temporarily rename `test:electron` in a scratch copy of `ci.yml` → `docs-run` fails. Revert and confirm with `cmp`.

## Verification

Gates V1–V10 are in STATE *Verification Baseline*. Run whole-repo V1–V7 at every checkpoint. Run V8 (`pnpm test:browser`) from ck2 on, V9 (`pnpm build && pnpm test:electron`) from ck3 on, and V10 (YAML parse) at ck4.

| Proof | Invocation | Real path | Assertion | Owner |
|---|---|---|---|---|
| CAP-B1 / CA-B1 producer | `pnpm exec vitest run tests/proofs/combat-characterization.test.ts tests/proofs/pack-identity.test.ts` | real compiler + runtime from `src/`, real generated packs, seeded `Rng` | 9 leg digests unchanged; 3 pack digests | ck1 |
| CAP-B2 / CA-B1 consumer / CA-B2 | `pnpm test:browser` (Vitest browser server on port 63315, headless Playwright; `src/` transformed by Vite, no `dist/`) | the same oracle module runs in V8 (Chromium 151), SpiderMonkey (Firefox 153) and JSC (WebKit 26.5) | 12 digests equal; `process` undefined; UA logged | ck2 |
| CAP-B3 / CA-B2 | `pnpm build && pnpm test:electron` (`dist/` freshness: build immediately before, H1) | Electron 44.7.0's Node 24.21 + V8 15.2 run the whole suite | 974/974; `electron` version logged; guard negative control | ck3 |
| CAP-B4 / CA-B3 | `pnpm exec vitest run tests/proofs/docs-run.test.ts` + V10 + every CI-job command locally | README and `ci.yml` read from disk | both directions hold | ck4 |

No storage, seed isolation or restart boundary applies. The oracle is pure in-memory, with seeds fixed in the module. Evidence: vitest summary lines and the logged UA/runtime lines, quoted in the handoff.

## State Update

Report in the handoff:
- per-checkpoint SHAs;
- test counts (973 → 974; 74 per browser);
- the three user agents and the Electron runtime line;
- the re-observed `PACK_DIGESTS`, and whether they matched the planned values;
- each negative control's result;
- any deviation, by rule.

Follow-ups for the final Archivist:
- PROGRAM-CONFIG Stack *Test* row (l.24), Custom Rule 5 (l.165) and Verification Commands, which gain `test:browser` and `test:electron`;
- `arch/v1-core.md:1237`, `:1596`, which retire the browser-leg v1.1 follow-up.

Do not touch them yourself.
