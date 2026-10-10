# Final Report — Ruleswright / browser-determinism

## Summary

`browser-determinism` proves the determinism criteria on every runtime they name. The criteria are FR-1 ("identical results on every platform"), FR-17 ("byte-identical pack") and NFR-Determinism ("byte-identical packs and identical roll sequences on Node, browsers, and Electron", `specs/requirements.md:245`). CI and the README now say exactly what is proven.

- **One shared oracle** (`tests/proofs/determinism-oracle.ts`) holds the Node-pinned digests:
  - the 9 combat-characterization legs, moved over with **no re-key**;
  - the 3 generated bundled packs (new).
- **Where the oracle runs:**
  - on Node;
  - in Chromium, Firefox and WebKit (Vitest browser mode);
  - with the whole suite, under Electron 44.7.0's own Node/V8 runtime.
- **CI** gains a `browser` job (3-engine matrix) and an `electron` job. The docs-run honesty pin now checks README ↔ `ci.yml` in both directions.

**Sessions:** 1/1 planned session done (SESSION-01, 4/4 checkpoints), plus 1 unplanned owner correction (OWNER-M05-CI-ORDER, 1/1). **No `src/` change:** `git diff --name-status 46bcf0c..6566236 -- src` is empty.

## Files created / modified

Derived from `git diff --name-status 46bcf0c..6566236 -- . ':!program'`: 12 paths, 5 A + 7 M. `--shortstat` gives +1335/−400.

| Group | Paths | A/M |
|---|---|---|
| Proof tests (6) | `tests/proofs/determinism-oracle.ts` A, `tests/proofs/pack-identity.test.ts` A, `tests/proofs/runtime-identity.test.ts` A, `tests/browser/determinism.test.ts` A, `tests/proofs/combat-characterization.test.ts` M, `tests/proofs/docs-run.test.ts` M | 4 A + 2 M |
| Test config (2) | `vitest.browser.config.ts` A, `vitest.config.ts` M | 1 A + 1 M |
| Dependencies (2) | `package.json` M, `pnpm-lock.yaml` M | 2 M |
| CI (1) | `.github/workflows/ci.yml` M (S01 ck4 + OWNER-M05-CI-ORDER) | 1 M |
| Docs (1) | `README.md` M | 1 M |

The parts sum to the headline: 6 + 2 + 2 + 1 + 1 = 12, and 5 A + 7 M.

**New devDependencies (exact):** `@vitest/browser@2.1.8`, `playwright@1.62.1`, `electron@44.7.0`, `@types/node@24.19.2` (DD-B13). Runtime `dependencies` stay empty (NFR-Dependencies).

**Checkpoint commits:** `git log --oneline 46bcf0c..6566236 --grep checkpoint` returns 5 commits:
- S01: `1d929a7`, `da7bc47`, `48bd4b9`, `66af2e8`;
- OWNER-M05-CI-ORDER: `fb2bf0e`.

## Architecture impact

- There are no module, edge or public-API changes. `src/` is untouched, and no arch fragment was produced.
- **New test-only artifacts:** the oracle module, which no test glob collects, and `tests/browser/`, which only `vitest.browser.config.ts` collects.

## Verification (gates)

Orchestrator observed these at the S01 receive (`66af2e8`) and re-checked them after OWNER-M05-CI-ORDER (`fb2bf0e`):

| Gate | Result |
|---|---|
| V1 `pnpm typecheck` | 0. The type source is now in-repo: `@types/node@24.19.2` (DD-B13). |
| V2 `pnpm lint` / V3 `pnpm format:check` / V4 `pnpm build` | 0 / 0 / 0 |
| V5 `pnpm build && pnpm test` | **56 files, 974/974** (base 54 / 970; +3 pack-identity, +1 runtime-identity) |
| V6 `check:isolation` / V7 `check:security` | 0 / 0 |
| V8 `pnpm test:browser` | exit 0; 6 files, **74/74 per engine** |
| V9 `pnpm build && pnpm test:electron` | **56 files, 974/974** |
| V10 YAML parse of `ci.yml` | 0 |

**Runtimes, as logged by the tests:**
- **Chromium:** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36`
- **Firefox:** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:153.0) Gecko/20100101 Firefox/153.0`
- **WebKit:** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15`
- **Electron:** `runtime={"node":"24.21.0","v8":"15.2.124.28-electron.0","electron":"44.7.0"}`

**Behaviour pin:** no digest was re-keyed.
- An Orchestrator diff count over `git diff 46bcf0c -- tests/proofs/{combat-characterization.test.ts,determinism-oracle.ts}` found every characterization value as both a removed and an added line. The only additions without a removed match are the 6 new `PACK_DIGESTS` values.
- 64-hex digest literals: 12 in the oracle, 0 in any other test file.

**PACK_DIGESTS** were re-observed on Node and match the plan-time values exactly.

## Verification

**Feature Verification pass:** one envelope, 2026-10-10. Source: `program/Ruleswright/prompts/browser-determinism/VERIFICATION.md`. The worker could not commit it because the path is gitignored, so Orchestrator committed it unchanged with a forced, explicit pathspec at `8a80ec1`.
**Rows:** 12 verified · 1 present-unverified · 0 failed · 0 blocked.

### Behavior unverified — human review required (1 row)

| ID | Exists | What is unproven | Why it could not be proved here |
|---|---|---|---|
| CAP-B4 / B-BD-1 (GitHub Actions execution) | `.github/workflows/ci.yml:33-56` (`test`), `:113-132` (`browser`), `:134-150` (`electron`). The jobs parse (V10), and every command in them passed locally. | That the new `browser` (chromium/firefox/webkit) and `electron` jobs, and the reordered `test` job on Node 18/20/22, pass on `ubuntu-latest`. This covers `playwright install --with-deps`, Electron's Linux shared libraries in `ELECTRON_RUN_AS_NODE` mode, and the Node 18/20 legs. | Agents never push. `main` is 202 commits ahead of `origin/main`, and no remote branch contains `66af2e8`. The last visible Actions run (`dadf461`, 2026-09-27) ended `failure` and predates this feature, so expect older CI drift to show too. This macOS host cannot exercise the Linux pieces (H10). |

## Residual gaps

- **B-BD-1:** the human pushes, then the next Orchestrator run or the Archivist reads the Actions results for `test` (18/20/22), `browser` (×3) and `electron`. If a Linux `--with-deps` or Electron shared-library step fails, that is a mechanical CI owner correction, not a product question (H10).
- **DD-B3 residual:** no test runs inside an Electron *renderer* process. The renderer's engine family (Chromium) is covered by the Chromium leg. Owner: a future feature, if a host reports a renderer-only discrepancy.
- **The browser leg runs `src/` transformed by Vite, not the shipped `dist/` bundle** (ARCH-PRE F-B6). Node and Electron exercise `dist/` through the four `dist/` journeys. The README discloses this.

## Follow-up for the final Archivist

These are not leased to any worker (DD-B12/B12a):
- **PROGRAM-CONFIG:**
  - Stack *Test* row (l.24) and *CI* row (l.27);
  - Custom Rule 5 (l.165): the browser leg is no longer a v1.1 follow-up, and Electron is now proven;
  - Verification Commands: add `pnpm test:browser` and `pnpm build && pnpm test:electron`.
- **`arch/v1-core.md`:** retire the browser-leg v1.1 follow-up at l.197, l.1237 and l.1596.
- **Pre-existing drift:** `PROGRAM-CONFIG.MD:25` says "typescript-eslint strict-type", but `eslint.config.mjs:20` uses `configs.recommended`.
- **Record for the log:**
  - The A1 `--preserveSymlinks` typecheck command is wrong for pnpm. It cuts off `@vitest/runner` types and exits 2 regardless of `@types/node`. The accepted proof is a clean frozen install, build and typecheck outside `$HOME`.
  - The host `~/node_modules` leakage (H13) is a new sub-shape of the factual-premise convention: a premise "verified" in a host environment that resolves outside the repo.

## Orchestration

**Concurrency:** 3 (granted; 1 used — single-session plan).
**Wall clock:** about 17 min of commits, from `e3d4299` (18:24:19) to `6566236` (18:41:43, 2026-10-10). The run started about 18:15 with baseline re-observation and ARCH-PRE.
**Sessions run:** 1 Planner session, plus ARCH-PRE, 1 owner correction and VERIFY-01.
**Checkpoints committed by Coder:** 5 (`git log --grep checkpoint` over `46bcf0c..6566236`): 4 by S01 and 1 by the owner correction.
**Binding:** Native (`mcp__demiurge__spawn_subagent` / `await_subagent_result`). One host await idle timeout on S01 was re-awaited on the same handle with nothing lost.

### Wave plan as executed

| Wave | Sessions | Notes |
|---|---|---|
| W0 | ARCH-PRE | Scoped Archivist planning completeness (h-ctRQ). D2/D3 failed, reaching S01 ck3 only, and were closed before dispatch by DD-B13 and envelope amendments A1–A4. |
| W1 | SESSION-01 | h-KQ3x; done 4/4; accepted after Orchestrator ran V1–V10. |
| W1+ | OWNER-M05-CI-ORDER | h-8CmY; a pre-existing CI defect surfaced by S01 (B-BD-2); `ci.yml` only; accepted. |
| — | VERIFY-01 | h-TYfd; 12 verified / 1 present-unverified / 0 failed. |

### Blocked

none

### Blocker escalations

| S | Class | Action / human ask | Disposition |
|---|---|---|---|
| ARCH-PRE F-B1 | Planning defect: host `@types/node` leakage | DD-B13: S01 ck3 pins `@types/node@24.19.2`, and a clean typecheck runs outside `$HOME`. No human ask. | Closed (`48bd4b9`). |
| S01 surprise 2 (B-BD-2) | Pre-existing CI defect: the `test` job typechecks before it builds, so the `dist/` journeys fail TS2307 on a fresh checkout. Orchestrator reproduced it: 34 `error TS`. | OWNER-M05-CI-ORDER under standing authority. No human ask. | Cleared locally (`fb2bf0e`); Actions confirmation via B-BD-1. |
| B-BD-1 | Human push | The human pushes `main` (agents never push). | Open, non-blocking. |

### Interim Archivist checks

| After wave | Sessions received | Result | Drift found | Actions |
|---|---|---|---|---|
| — | — | none run (1–15 sessions: planning-completeness and final only) | — | — |

### Lease violations

none. Every commit was checked with `git show --name-only` against `Owns`. S01's R1 deviation (`docs-run.test.ts`) and R2 deviation (`pnpm-lock.yaml`) are in-lease.

### Checkpoint shortfalls

none

### Wave plan corrections

none (single-session plan)

### Granularity feedback for Planner

none. All four checkpoints were committed in order in one context.

### Process effectiveness

- **First-dispatch completion:** 1/1. S01 was accepted without redispatch.
- **Unplanned corrections:** 1, OWNER-M05-CI-ORDER, affecting CAP-B4. The cause was a pre-existing CI step-order defect hidden locally because `dist/` always exists; it is a planning-time verification gap, not caused by this feature. It was handled as a separate owner correction because S01 had already returned and the fix was one file.
- **Integration rework:** 0 corrective commits after acceptance.
- **Plan defects caught before dispatch** (ARCH-PRE): 6 findings (F-B1..F-B6). The blocking one, F-B1, was fixed in the envelope.
- **Plan defects that reached the worker:**
  - The prescribed A1 command (an Orchestrator amendment) was itself wrong for pnpm.
  - The prescribed CA-B3 `toContain` checks could be satisfied by the `ci.yml` header comment alone. S01 tightened them (R1).
- **Environment failures:** none. The registry, Electron download and cached browsers all worked.

### Capability completion

- **CAP-B1:** verified against current sources (VERIFY-01; Orchestrator V5).
- **CAP-B2:** verified (V8 ×3).
- **CAP-B3:** verified (V9; the guard's negative control bites).
- **CAP-B4:** verified locally. Its GitHub Actions execution is **present-unverified** (B-BD-1; owner: the human push, then the Archivist record).
- **CA-B1..B3:** proven.
- **Product completion:** the product determinism criteria FR-1, FR-17 and NFR-Determinism are verified locally on Node 24, three browser engines and Electron 44.7.0. The CI proof on Node 18/20/22 and Linux awaits B-BD-1.

### Follow-up closure ledger

| Source | Item (verbatim summary of receive record) | Disposition |
|---|---|---|
| ARCH-PRE F-B1 | V1 types resolve to host `~/node_modules/@types/node@25.5.0` | **closed**: DD-B13, `48bd4b9` |
| ARCH-PRE F-B2 | host `electron ^41` bin | **closed**: the ck3 identity line shows `"electron":"44.7.0"` (`48bd4b9`) |
| ARCH-PRE F-B3 | ck4 negative control cannot bite on a scratch copy | **closed**: in-place controls at ck4 (`66af2e8`) |
| ARCH-PRE F-B4 | DD-B12 retirement list incomplete (`PROGRAM-CONFIG.MD:27`, `arch/v1-core.md:197`, l.25 drift) | **carried**: final Archivist (this run) |
| ARCH-PRE F-B5 | citation drift | **closed**: corrected in the envelope; no work effect |
| ARCH-PRE F-B6 | browser leg runs `src/` via Vite, not `dist/` | **closed**: disclosed in the README CI paragraph (`66af2e8`) |
| S01 surprise 1 | `--preserveSymlinks` A1 command fails with pnpm | **closed**: substitute proof accepted (decision register), re-run by VERIFY-01; **carried** to the final Archivist log as a record item |
| S01 surprise 2 | CI `test` job typechecks before it builds | **closed**: OWNER-M05-CI-ORDER `fb2bf0e` |
| S01 surprise 3 | prescribed CA-B3 checks satisfiable by the header comment | **closed**: R1 anchoring at ck4 (`66af2e8`) |
| S01 surprise 4 | `msw` peer pulled `@types/node@26.6.5` | **closed**: `pnpm dedupe` (R2) left a single 24.19.2 copy (`48bd4b9`) |
| S01 surprise 5 | pnpm printed only "Ignored build scripts: msw" | **retired**: informational, harmless advisory class |
| S01 followUp | B-BD-1 Actions check (incl. the `test` job typecheck) | **carried**: human push, then the next Orchestrator run / Archivist |
| S01 followUp | DD-B3 renderer residual | **carried**: future feature, if a renderer-only discrepancy is reported |
| S01 followUp | PROGRAM-CONFIG l.24/27/165, Verification Commands; `arch/v1-core.md:197,1237,1596`; l.25 drift; A1 record | **carried**: final Archivist (this run) |
| S01 followUp | VERIFY-01: V8 only when port 63315 is free; build before V5/V9 | **closed**: VERIFY-01 honoured both |
| OWNER-M05-CI-ORDER followUp | B-BD-1 | **carried**: as above |
| VERIFY-01 surprise 1 | gitignore commit refusal | **closed**: Orchestrator forced commit `8a80ec1` (convention) |
| VERIFY-01 surprise 2 / followUp | README l.588 says docs-run checks "this paragraph", but it checks only command strings and `ci.yml` run lines, not the prose claims | **carried**: Planner, the next feature touching `docs-run`/README (tighten CA-B3 to the prose, or soften the sentence) |
| VERIFY-01 surprise 3 | last visible Actions run (`dadf461`) failed; HEAD 202 ahead | **carried**: B-BD-1 |
| VERIFY-01 surprise 4 | `/tmp` → `/private/tmp` false `--listFiles` count | **retired**: measurement artifact, recounted 0 |

### Archivist's Note

{pending — appended verbatim after the final Archivist returns}
