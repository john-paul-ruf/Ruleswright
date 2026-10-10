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

*Final Archivist, handle h-9jse, 2026-10-10; synthesis `0b35392`. Return appended verbatim (its `## Archivist Note` heading is folded into this section heading).*

The browser-leg v1.1 follow-up is retired and the Electron proof is recorded in both `arch/v1-core.md` and `PROGRAM-CONFIG.MD`. B-BD-1 stays open with its owner. Every Final Report figure reproduces except one: "202 commits ahead of `origin/main`" holds only at `5c62f8d`, not at the cited end SHA. Committed as `0b35392`, which contains exactly the three owned paths.

- **role:** archivist
- **registryUpdated:** true. There is no new module, edge or rule id: `git diff --name-status 46bcf0c..6566236 -- src` is empty (I ran it). The registry is confirmed at tree HEAD `6566236`.
- **reconciled:**
  - `program/Ruleswright/arch/v1-core.md`:
    - **Header:** realized state now at `6566236`, 13 cycles, with a browser-determinism clause and this pass's fresh-run line.
    - **v1-shell history (old l.197):** the browser-leg follow-up is marked retired.
    - **M05:**
      - The heading credits browser-determinism.
      - The docs-run bullet records the bidirectional CA-B3 pin and its `- run:` anchoring (S01's R1). It also says the pin checks command strings, not the README's prose.
      - A new **Cross-runtime determinism** bullet covers the shared oracle, the browser leg (port 63315, `src/` via Vite), the Electron leg and DD-B13.
      - The `ci.yml` bullet (old l.1237) is rewritten as six jobs, with line citations.
      - The characterization paragraph records that the digests moved into the oracle unchanged.
      - The gates paragraph now reads 974/974 across 56 files, 74 per browser engine ×3, and 974 on Electron.
    - **OWNER corrections:** OWNER-M05-CI-ORDER added.
    - **Recorded drift:** a new browser-determinism residuals block holds:
      - B-BD-1, carried: the human pushes `main`, then the next Orchestrator run or Archivist records the Actions results. It clears when `test` is green on Node 18/20/22 (typecheck included), and `browser` (×3) and `electron` are green on `ubuntu-latest`.
      - the DD-B3 Electron renderer residual;
      - the browser leg running `src/` via Vite rather than `dist/`;
      - the README l.588-590 overstatement (owner: Planner);
      - the A1 `--preserveSymlinks` record.
    - **Old l.1596:** the browser leg moves from the v1.1 follow-ups to "Closed by browser-determinism", together with the Electron clause.
    - **Contradiction resolved against git:** the record said `ci.yml:45` runs "`pnpm build` between typecheck and `pnpm test`" and called it closed. In fact the build is at l.50 and has run before typecheck since `fb2bf0e`.
  - `program/Ruleswright/PROGRAM-CONFIG.MD`:
    - **Stack *Test* (l.24):** three legs (Node, browser mode, Electron), all run locally and in CI.
    - **Stack *Lint* (l.25):** the drift is corrected to the realized fact, `js.configs.recommended` + typescript-eslint `configs.recommended` (`eslint.config.mjs:19-20`). It was never "strict-type".
    - **Stack *CI* (l.27):** the six jobs with their Node versions, plus B-BD-1.
    - **Verification Commands:** added `pnpm test:browser` (port 63315, one browser-mode run at a time) and `pnpm build && pnpm test:electron`.
    - **Custom Rule 5 (l.165) rewritten:** determinism is proven on Node 18/20/22 (CI), Chromium/Firefox/WebKit and Electron's runtime. The Actions run is present-unverified (B-BD-1), and the renderer is a disclosed residual.
    - **Also updated:** the realized-state note, the registry blurb, and the convention evidence notes.
  - `program/Ruleswright/ARCHIVIST-LOG.md`: one dated entry appended.
- **Final Report figures:**
  - **Reproduce:**
    - 12 paths, 5 A + 7 M, +1335/−400, groups 6+2+2+1+1;
    - `--grep checkpoint` returns 5;
    - N 974: my fresh run gave 56 files, 974/974, and the +4 is 3 `it.each(PACK_THEMES)` cases plus 1 runtime-identity test. N₀ 970 is the inherited class-features close figure; I did not re-run it at `46bcf0c`.
  - **Does not reproduce at the cited end SHA:** "202 commits ahead" is 202 at `5c62f8d`, 204 at `6566236` and 205 at `main`. Nothing has been pushed either way.
- **Fresh gates at `da32716`:**
  - build, typecheck, lint, format:check, isolation and security all exit 0;
  - `pnpm test` 974/974;
  - `test:browser` 74/74 in each of the three engines;
  - `test:electron` 974/974 (Electron 44.7.0).
- **VERIFICATION.md vs STATE.md:** they agree (12 verified, 1 present-unverified, which is CAP-B4/B-BD-1).
- **Deviations by rule (FR-19):**
  - R1: 1 (S01 checkpoint 4, `docs-run.test.ts`);
  - R2: 1 (S01 checkpoint 3, `pnpm-lock.yaml`);
  - R3: 0. R4: 0.
- **conventionsAdded:**
  - None minted. Two promoted rules each gained one clause. Neither is a new convention: both parent rules crossed the threshold in earlier cycles.
  - **Factual-premise rule (576a2816, now 11 cycles · 52 instances):** a premise that depends on the environment must be probed in that environment. A host typecheck or bin lookup that resolves outside the repo (`~/node_modules`), or relies on host state CI lacks (a persistent `dist/`), proves nothing about a clean checkout. Probe from a frozen install in a copy outside `$HOME`, and run any prescribed proof command once before prescribing it.
  - **Pin-lease rule (1cc46f93, now 8 cycles · 10 instances):** when a feature adds a member to a list that prose enumerates, every such listing is a doc pin, and a retirement list must carry every audit hit. The Stack *CI* row (l.27) never named the browser leg but went stale by omission (F-B4).
- **proposedForFramework:**
  - **New, 47f092a4f076107c, 1 cycle · 1 instance:** a doc sentence describing what a test checks is a claim about that test. Either the test enforces it, or the sentence names exactly what is checked (README l.588 vs `docs-run`).
  - **576a2816, 11 · 52:** PLANNER.md and ORCHESTRATOR.md's envelope amendment step should say that host-resolved premises and prescribed proof commands must be probed before dispatch. The wrong A1 command was an amendment.
  - **1cc46f93, 8 · 10:** PLANNER.md's pin audit should name enumeration pins.
  - **3092a46b, 2 · 3:** a clean-checkout probe whenever a feature touches CI or dependencies. Yes, "local gates run with build artifacts a fresh CI checkout lacks" counts as recurrence: it is the same `dist/` hazard. It remains below threshold on both axes: 2 cycles, and 2 distinct returns (ARCH-PRE and S01).
  - **c3c94358, 2 · 2:** a figure relative to a moving ref must state its SHA.
  - **cecd2115, 8 · 16:** the role docs should say to re-await the same handle after the host idle timeout.
  - **c187bed6, 5 · 5:** the VERIFICATION.md forced commit.
- **Adoption check:** `program-agents/` is gitignored, so `git log` has no history for the role docs. Their file times are 2026-10-04 13:41, before the prior pass, so nothing can have been adopted since then. The role docs' md5 is identical before and after this pass.
- **logEntry:** a dated entry "2026-10-10 — final pass, cycle `browser-determinism`" appended to ARCHIVIST-LOG.md and committed at `0b35392`.

### cleanupBriefs

[] — no campaign crosses a threshold. One new low-confidence candidate is tracked:
- **C16:** `PackTheme` is exported from `tests/proofs/determinism-oracle.ts` and has no consumer outside the oracle.

### standingRecommendations

Open backlog, 28 rows:

| id | pattern | cycles | instances | first seen | status |
|---|---|---:|---:|---|---|
| b32fc8d0c8c92d52 | checkpoint-0 read sweeps exhaust context | 2 | 2 | v1-core | open (10 cycles quiet; retirable) |
| f57dbe4d010638fe | subagent fabricates tool inputs under long-recovery prompts | 2 | 8 | v1-core | open (10 cycles quiet; retirable) |
| b85c8f3e113a6764 | barrel/surface completeness gaps found at integration | 2 | 3 | v1-core | open |
| c1ed872bea557b96 | run tool argv misrouting | 2 | 3 | v1-core | open (10 cycles quiet; retirable) |
| 3658f327cc9cff2f | single-command commits fail on deleted files | 2 | 2 | v1-core | open |
| 1cc46f93038f1d9a | cross-suite pins land without a named owner | 8 | 10 | loot-inventory | promoted; framework wording open |
| 576a281656f83b23 | envelope factual premises reach sessions unverified | 11 | 52 | loot-inventory | promoted; framework wording open |
| 854ceecd39d4b0d3 | whole-repo fast gates go red at role-scoped receives | 4 | 4 | v1-core | promoted |
| 17f4803c1b08da77 | provider aborts kill subagents mid-session | 3 | 5 | loot-inventory | open (promotion held) |
| 6f6b491bdbe37bf0 | bare npx misresolves | 3 | 4 | loot-inventory | open |
| 1d910de11732c6c4 | aborted final passes leave a double synthesis | 2 | 2 | loot-inventory | open |
| c172cd30e8dfc756 | plan-time base SHA goes stale after replan | 1 | 1 | equipment-consumables | open |
| cecd211504587426 | host await idle timeout; re-await the same handle | 8 | 16 | equipment-consumables | promoted; framework wording open |
| f68c42a3f6224eb1 | Final Report facts transcribed, not derived | 4 | 4 | v1-core | promoted |
| a368039028d463d6 | "never spawned" wording vs orchestrated Author re-entries | 8 | 10 | grid-combat | promoted |
| 3983f8eb6d18a5f2 | STATE row matcher writes into the wrong rows | 1 | 2 | grid-movement | open |
| f4621ac12fba3456 | pin audits miss behaviour pins | 3 | 4 | grid-combat | open |
| 760b67f17edbd346 | latent content hazards reachable via a new execution path | 2 | 2 | spells-in-combat | open |
| 82b4e0abbda105d6 | concurrent sessions share one working tree | 1 | 2 | spells-in-combat | open (narrowed) |
| c3c94358b35f8316 | report figures cited against a moving HEAD/ref | 2 | 2 | action-targeting | open |
| c187bed6bb5132a7 | VERIFICATION.md under a gitignored path; `commit_pathspec` cannot force | 5 | 5 | feat-progression | promoted; framework wording open |
| 8039d6869169267c | plan artifacts internally inconsistent | 1 | 2 | feat-progression | open |
| d2415cb4497e0049 | Author handoffs have no R1–R4 rule | 2 | 3 | feat-progression | open |
| 3092a46b564d1d36 | Verification Baseline omits known or discoverable hazards | 2 | 3 | combat-decomposition | open |
| 2674d8c2f948ae0a | line-based greps miss multi-line statements | 1 | 1 | combat-decomposition | open |
| 0880dd5734025fd4 | negative control perturbs a file outside the lease | 1 | 1 | combat-decomposition | open |
| 318c816b6920dd3d | duplicate `## Verification` headings | 1 | 1 | class-features | open |
| 47f092a4f076107c | doc sentence claims a test checks more than it enforces | 1 | 1 | browser-determinism | open |
