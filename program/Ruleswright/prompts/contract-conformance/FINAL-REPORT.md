# Final Report — Ruleswright / contract-conformance

## Summary

The three JSON Schema contracts in `src/schema/contracts/` are now checked by an independent validator (Ajv 8.20.0, draft 2020-12) against named outputs of the library: the three bundled themes' generated packs (seed 42), the seven fixture packs, the 14 snapshot envelopes of the determinism oracle's nine legs plus a level-1 character and party per theme, and two override documents. The one disagreement the plan-time probe found — the snapshot contract said combatant `hp` `minimum: 0`, while the engine has always written and restored unfloored negative hp — was fixed on the contract side by human decision DD-K1 ("a yes", 2026-10-11): contract **v1.11**, loosening only. Two carried items were closed: a dedicated test that `new Runtime` refuses the pre-v1.10 class-features location, and the README's overstated docs-run sentence (narrowed and pinned).

**Sessions done:** 2 / 2 (S01 DB Author re-entry, 2/2 checkpoints; S02 Coder, 3/3 checkpoints). Plus ARCH-PRE (planning completeness) and VERIFY-01 (feature verification).

## Files created/modified

Derived from `git diff --name-status bb61f91..9c8cdc3 -- . ':(exclude)program/Ruleswright/prompts'` and `--numstat` / `--shortstat` over the same range: **8 paths (1 A + 7 M), +316 / −14.** End SHA `9c8cdc3` (VERIFICATION.md commit; the implementation end is `bd4f753`, and nothing outside `prompts/` changed after it). Plan/run files under `program/Ruleswright/prompts/contract-conformance/` (gitignored, force-added) are excluded from the count.

| Group | Paths | A/M | +/− |
|---|---|---|---|
| DB contract (S01) | `src/schema/contracts/snapshots.schema.json`, `program/Ruleswright/specs/database.md` | 2 M | +14 / −2 |
| Tests (S02) | `tests/proofs/contract-conformance.test.ts` (A), `tests/proofs/docs-run.test.ts`, `tests/runtime/features.test.ts` | 1 A + 2 M | +259 / −8 |
| Packaging (S02) | `package.json`, `pnpm-lock.yaml` | 2 M | +30 / −0 |
| Docs (S02) | `README.md` | 1 M | +13 / −4 |
| **Total** | 2 + 3 + 2 + 1 = **8** | 1 A + 7 M | +316 / −14 |

Checkpoint commits: `git log --oneline bb61f91..9c8cdc3 --grep checkpoint` = **5** (`e815e74`, `bde9781`, `8e8c032`, `ae5b595`, `bd4f753`).

## Architecture impact

- **Contract v1.11** (DB, schema-change Author re-entry, builder-authorized 2026-10-11): combat-snapshot combatant `hp` loses `minimum: 0` and gains a description (`snapshots.schema.json:192-195`); `database.md` Status line (l.3), *v1.11 — combatant `hp`* block (l.699-705), Version Registry row 12 (l.822). `schemaVersion`/`snapshotVersion` stay 1; no rule id; no caveat. `pack.schema.json` and `override.schema.json` are byte-identical.
- **No module, edge or public-API change.** `git diff bb61f91..9c8cdc3 -- src` lists only the DB-owned `snapshots.schema.json`; no `src/**/*.ts` or theme JSON changed, and determinism digests are unchanged.
- **New dev dependency:** `ajv` exact `8.20.0` (devDependencies only; runtime `dependencies` still absent; `ajv@6.15.0` stays as ESLint's transitive).

## Gates (V1–V11)

Orchestrator ran these at HEAD `bd4f753` (S02 receive), unless noted:

| # | Command | Result |
|---|---|---|
| V1 | `pnpm typecheck` | 0 (also 0 at S01 receive, `bde9781`) |
| V2 | `pnpm lint` | 0 (also 0 at S01 receive) |
| V3 | `pnpm format:check` | 0 (also 0 at S01 receive) |
| V4 | `pnpm build` | 0 |
| V5 | `pnpm build && pnpm test` | `Test Files 57 passed (57)` / `Tests 1017 passed (1017)` (base 56 / 974 at `51839fe`; +1 file, +43 tests = 42 conformance + 1 refusal) |
| V6 / V7 | `pnpm check:isolation` / `pnpm check:security` | 0 / 0 |
| V8 | `pnpm test:browser` | 6 files / 74 tests ×3 engines, 0 — **worker-reported** (S02 ck3); not rerun by Orchestrator (does not collect the new file) |
| V9 | `pnpm build && pnpm test:electron` | `Test Files 57 passed (57)` / `Tests 1017 passed (1017)` (Electron 44.7.0) |
| V11 | clean copy outside `$HOME`, `pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm exec vitest run tests/proofs/contract-conformance.test.ts` | all 0, 42/42 — **worker-reported** (S02 ck1) |
| scoped | `pnpm exec vitest run` on the three S02 test files | 3 files / 51 tests (42 + 6 + 3) |

**Envelope count:** 14 oracle envelopes (kinds character/party/combat) + 6 per-theme. **Negative-hp subject:** `leg-3b[0]`, combatants `[[hexer,29],[wolf,-7],[shade,9]]` — valid under v1.11; an in-memory `minimum: 0` copy rejects it at `/combatants/1/hp` `minimum`.

## Residual gaps

- **B-BD-1** (carried): GitHub Actions execution — now including `tests/proofs/contract-conformance.test.ts` via `ci.yml:54` (Node 18/20/22 `test`) and `:94` (`package`) — is unobserved until the human pushes. Owner: the human, then the next Orchestrator/Archivist run. Figure tied to a moving ref: `git rev-list --count origin/main..9c8cdc3` = 217 at `9c8cdc3`.
- **H-R1** (owned residual): `ci.yml:23-24` (header comment "checks both directions"), `ci.yml:111` (step name "both themes"), `tests/compiler/coverage-floor.test.ts:509,582` (titles "both theme(s)"). Owner: Planner, the next feature touching `ci.yml` / `tests/compiler`.
- **README "nine combat legs"** (VERIFY-01 note): the oracle's `leg-8` is a character leg; pre-existing name (README l.589) reused in the new sentence. Not an overclaim (the test takes all nine legs). Owner: Planner, the next feature touching README determinism/CI prose.

## Follow-up (final Archivist; DD-K6 + DD-K6a)

- PROGRAM-CONFIG Stack *Test* row: add the conformance proof (`ajv@8.20.0`, dev-only).
- Stack *Runtime deps*: "no zod/ajv" → say *runtime* explicitly.
- Custom Rule 1: add the v1.11 event.
- Custom Rule 5: narrow "docs-run checks README ↔ `ci.yml` in both directions" to what README l.595-599 states.
- *Author Sources → Data source*: normative through v1.11.
- `arch/v1-core.md`: retire "byte-level snapshot conformance" from the v1.1 follow-ups (l.1681; schema conformance proven, byte-level round-trip stays as recorded); retire the class-features old-location hardening residual and the README docs-run overstatement residual.

## Verification

**Feature Verification pass:** one envelope, 2026-10-11. Source:
`program/Ruleswright/prompts/contract-conformance/VERIFICATION.md`, committed at `9c8cdc3`.
**Rows:** 20 verified · 1 present-unverified · 0 failed (all routed) · 0 blocked.

### Behavior unverified — human review required (1 row)

| ID | Exists | What is unproven | Why it could not be proved here |
|---|---|---|---|
| CAP-K1/K4 CI leg (B-BD-1) | `.github/workflows/ci.yml:54` (`test` job, Node 18/20/22), `:94` (`package` job) | that GitHub Actions actually runs `tests/proofs/contract-conformance.test.ts` and docs-run green in both jobs | no Actions run is observable from this host; nothing has been pushed since `bd4f753` |

## Orchestration

**Concurrency:** 3 (cap; every wave was a single member by plan — serial dependency chain)   **Wall clock:** 16:39:35 (ARCH-PRE spawn, session index) → 17:00:18 (last STATE commit before this report), by recorded spawn/commit times
**Sessions run:** 2 Planner sessions (S01, S02) + ARCH-PRE + VERIFY-01   **Checkpoints committed by workers:** 5 (`git log --oneline bb61f91..9c8cdc3 --grep checkpoint`)
**Binding:** Native (`mcp__demiurge__spawn_subagent` / `await_subagent_result`). One host await idle timeout (ARCH-PRE), re-awaited on the same handle, nothing lost.

### Wave plan as executed
| Wave | Sessions | Notes |
|---|---|---|
| W0 | ARCH-PRE (Archivist, h-IJVN) | D3/D4 fail, closed before dispatch (STATE `a236c1d`) |
| W1 | S01 (DB, h-H6RH) | spawned 16:48:12; 2/2; accepted (STATE `70164df`) |
| W2 | S02 (Coder, h-t0-R) | spawned 16:50:42; 3/3 with amendments A1–A5; accepted (STATE `07ba8c8`) |
| — | VERIFY-01 (Coder, verification envelope, h-XEny) | spawned 16:56:33; 20/1/0/0; file committed `9c8cdc3`; STATE `cf8f08c` |

### Blocked
none

### Blocker escalations
| S | Class | Action / human ask | Disposition |
|---|---|---|---|
| — | B-BD-1 (carried) | human push | open, non-blocking |
| — | run-start V2 red (host scratch) | Planner's plan-time probe `.program/tmp/conformance-probe/` made `eslint .` red; moved (preserved) to `/tmp/rw-contract-conformance-planner-probe/`; H11 recorded | cleared, no human ask |
| — | H-R1 (ARCH-PRE F-K3) | owned residual | carried |

### Interim Archivist checks
| After wave | Sessions received | Result | Drift found | Actions |
|---|---|---|---|---|
| W0 (planning completeness, pre-S01) | — | D1 pass, D2 pass, D3 fail, D4 fail (S02 ck3), D5 pass, D6 pass, D7 n/a; F-K1..F-K6 | yes: README sentence overclaim (F-K1), out-of-lease negative control (F-K2), DD-K6 omissions (F-K3), premise errors (F-K4), weak controls (F-K5), missing hazard (F-K6) | S02 amendments A1–A5; DD-K6a; H-R1; H11 (STATE `a236c1d`) |

(2-session build: no interim drift checks by cadence.)

### Lease violations
none (every commit's `git show --name-only` inside its session's `Owns`; S02's one deviation is R1, in-lease).

### Checkpoint shortfalls
none (S01 2/2, S02 3/3 in `git log`).

### Wave plan corrections
none (serial chain; S01 ∩ S02 `Owns` = ∅).

### Granularity feedback for Planner
none — every checkpoint committed; no context exhaustion. Planning defects (not granularity) were caught at ARCH-PRE: a prescribed README sentence overclaimed (F-K1, standing rec `47f092a4f076107c`), a prescribed negative control required editing an unleased file (F-K2, `0880dd5734025fd4`), and two call signatures were wrong (F-K4).

### Process effectiveness
First-dispatch completion: 2/2 sessions accepted without redispatch. Unplanned corrections: 0 (no owner-correction or lease revision; ARCH-PRE findings were closed by in-lease envelope amendments before dispatch, affecting CAP-K1, CAP-K4, CA-K1, CA-K3). Integration rework: 0 corrective commits after an acceptance. Product decisions: none mid-run (DD-K1 was settled at planning). Environment failures: one host await idle timeout; one host-scratch lint red at run start.

### Capability completion
- CAP-K1 verified (S02 ck1 `8e8c032`; local Node + Electron); CI execution present-unverified (B-BD-1).
- CAP-K2 verified (contract S01 `e815e74`/`bde9781`; Ajv proof S02 ck1).
- CAP-K3 verified (S02 ck2 `ae5b595`).
- CAP-K4 verified locally (S02 ck3 `bd4f753`); CI execution present-unverified (B-BD-1).
- CA-K1, CA-K2, CA-K3 proven. No required capability is planned, blocked or stale.

### Follow-up closure ledger
| Source | Item (verbatim gist) | Disposition |
|---|---|---|
| S01 followUp | "PROGRAM-CONFIG Custom Rule 1 needs the v1.11 event added." | carried → final Archivist (DD-K6) |
| S01 followUp | "*Author Sources → Data source* should name v1.11." | carried → final Archivist (DD-K6) |
| S01 followUp | "For S02: the Ajv proof that v1.11 admits leg 3b … S02 checkpoint 1 owns this" | **closed** — S02 ck1 `8e8c032` |
| S01 surprises | none | — |
| S02 followUp | Stack *Test* row (conformance proof, `ajv@8.20.0` dev-only); Stack *Runtime deps* "runtime"; Custom Rule 1 (v1.11); Custom Rule 5 narrowed; *Author Sources* v1.11; `arch/v1-core.md` retirements | carried → final Archivist (DD-K6/DD-K6a) |
| S02 followUp | "H-R1 is still carried: `ci.yml:23-24,111` and `coverage-floor.test.ts:509,582` say 'both'." | carried → Planner, next feature touching `ci.yml`/`tests/compiler` |
| S02 followUp | "B-BD-1 is still carried: the CI execution of the new file through `ci.yml:54,94` is unverified until the first push." | carried → human push, then next Orchestrator/Archivist run |
| S02 surprises | TS2677 on the envelope filter's type guard, fixed before commit | **closed** — in ck1 `8e8c032` |
| S02 surprises | "The README names the conformance file exactly once, so the single in-place rename is enough to fail docs-run." | **retired** — observation, no action needed |
| VERIFY-01 followUp | B-BD-1 | carried (as above) |
| VERIFY-01 followUp | "Final Archivist items DD-K6/DD-K6a and residual H-R1 stay as recorded in STATE." | carried (as above) |
| VERIFY-01 followUp | "Scratch backups remain in `/tmp/ruleswright-contract-conformance-verify/`" | **retired** — host scratch outside the repo |
| VERIFY-01 surprises | "nine combat legs" — `leg-8` is a character leg | carried → Planner, next feature touching README determinism/CI prose |
| VERIFY-01 surprises | commit refused (gitignored), V8 not run, V11 not rerun | **closed** — Orchestrator committed `9c8cdc3`; V8/V11 worker-reported in S02 |

### Archivist's Note
(final Archivist h-8omi / AWtkt; synthesis commit b47a611)

Final pass for contract-conformance is committed at `b47a611`. That commit holds only my three owned files, and the tree is clean. Every DD-K6 and DD-K6a item is done. All the Final Report's mechanical figures reproduce. Two conventions crossed the three-cycle bar and were promoted this pass.

- **role:** archivist
- **registryUpdated:** true. Checked, and no change. `git diff --name-status bb61f91..66d4efe -- src` lists only the DB-owned `snapshots.schema.json`. No `src/**/*.ts` file changed, so there is no new module, edge or rule id.
- **reconciled:**
  - `program/Ruleswright/arch/v1-core.md`:
    - **Header:** now at `66d4efe`, fourteen cycles. Gate results from this pass's own run are kept separate from figures copied from the Final Report.
    - **M01:** a new paragraph for the v1.11 contract change.
    - **M05:** new bullets for the Ajv conformance proof and the old-location refusal test. Also updated: the docs-run bullet (CA-K3), the README edits, and the gates line (57 files / 1017 tests).
    - **Retired:**
      - the class-features "old location at `new Runtime`" hardening item (closed by `ae5b595`);
      - the README docs-run overstatement (closed by `bd4f753`);
      - "byte-level snapshot conformance" from the v1.1 follow-ups. Schema conformance of named subjects is proven. Byte-exact round-trip stays as recorded (`tests/snapshots/character.test.ts` l.81, l.360, l.434).
    - **New contract-conformance residuals block:** H-R1, the README "nine combat legs" note, H11, and the byte-level round-trip record.
    - **B-BD-1:** stays carried. The `test` and `package` jobs now also run the new file; 217 unpushed commits at `9c8cdc3`.
  - `program/Ruleswright/PROGRAM-CONFIG.MD`:
    - **Stack *Test*:** adds the conformance proof (`ajv@8.20.0`, dev-only, draft 2020-12, `strict: false`).
    - **Stack *Runtime deps*:** now says no zod/ajv **at runtime**, citing `requirements.md:249` and `architecture.md:44`.
    - **Custom Rule 1:** adds the v1.11 event (Version Registry row 12).
    - **Custom Rule 5:** narrowed to exactly the strings `docs-run` checks, matching README l.595-599 and `docs-run.test.ts:241-261`.
    - **Author Sources → Data source:** normative through v1.11.
    - **Header note and registry blurb:** updated to `66d4efe`.
  - `program/Ruleswright/ARCHIVIST-LOG.md`: one dated entry appended.
- **Figures checked:**
  - 8 paths (1 A + 7 M), +316/−14 excluding `program/Ruleswright/prompts`. The group totals add up.
  - `--grep checkpoint` = 5.
  - `rev-list --count origin/main..9c8cdc3` = 217.
  - Fresh run at `66d4efe`: build, typecheck, lint, format:check, isolation and security all exit 0; `pnpm test` is 57 files / 1017 tests.
  - Not rerun by me: the browser and Electron legs. They are cited from the Final Report and labelled that way.
- **Deviation counts by rule (FR-19):**
  - R1: 2 — S02 ck3, and S01 ck2. S01 gave its entry no rule number, so I classified it.
  - R2: 0, R3: 0, R4: 0.
  - VERIFICATION.md and the Capability Readiness / Contract Agreements tables agree; no drift.
- **conventionsAdded:**
  - **The Verification Baseline carries known hazards forward** (`3092a46b564d1d36`). Crossed on program cycles: 3 cycles · 4 instances. This cycle's instance is ARCH-PRE F-K6 / H11: the `.program/` lint hazard from the row's first instance was missing again, and it turned V2 red at run start.
  - **Author re-entry deviations carry a rule number** (`d2415cb4497e0049`). Crossed on program cycles: 3 cycles · 4 instances. This cycle's instance is S01, which reported its deviations as prose with no rule.
  - Evidence notes updated on seven existing conventions. No clause added: the pin-lease rule (F-K3) and the factual-premise rule (F-K4, F-K5) already cover this cycle's findings.
- **proposedForFramework:**
  - **New `f229f492b7a1e737` (1 cycle · 1):** worker scratch has no safe location. Envelopes say `/tmp`, but the write tool only writes inside the repo, and `eslint .` lints the in-repo scratch directory `.program/`. Name one sanctioned scratch location, or let the write tool accept a declared scratch root.
  - **`47f092a4f076107c` (2 · 3):** a doc sentence claims more than its test checks. This cycle: F-K1, and S02's R1. Each quantifier in such a sentence should match a subject list the test asserts.
  - **`0880dd5734025fd4` (2 · 2):** a prescribed negative control edits a file outside the lease (F-K2). Each control should name the file it touches and be checked against `Owns`, or run in memory.
  - **Counts raised, wording unchanged:**
    - `3092a46b`: 3 · 4
    - `d2415cb4`: 3 · 4
    - `576a2816`: 12 · 54
    - `1cc46f93`: 9 · 11
    - `cecd2115`: 9 · 17
    - `a3680390`: 9 · 11
    - `c187bed6`: 6 · 6
  - **First-dispatch 2/2:** fits all three rows above. Every ARCH-PRE finding was closed by an in-lease amendment before dispatch, so none caused a redispatch.
  - **Adoption check:** none of these has been adopted. The role docs are gitignored, so there is no git history to check. All four were last modified 2026-10-04 13:41, before the prior pass. Their md5 sums are identical before and after this pass.
- **logEntry:** dated entry appended to ARCHIVIST-LOG.md (2026-10-11, contract-conformance).

#### cleanupBriefs

None. No cleanup group crosses a threshold. New candidate C17 is `tracking`: `eslint.config.mjs:17` ignores `program/` but not `.program/`. It is medium confidence and owned by a future lease on that file. C16 was re-checked and is unchanged.

#### standingRecommendations

| id | pattern | cycles | in-cycle instances | first seen | status |
|---|---|--:|--:|---|---|
| b32fc8d0c8c92d52 | Large single-session builds exhaust context on exhaustive checkpoint-0 read sweeps (empty-final crash; recovery = checkpoint-scoped reading) | 2 | 2 | v1-core | open (11 cycles without recurrence; a human may retire it) |
| f57dbe4d010638fe | Subagent model fabricates tool inputs (invented paths, invented project state, fabricated git output) under long-recovery prompts | 2 | 8 | v1-core | open (11 cycles without recurrence; a human may retire it) |
| b85c8f3e113a6764 | Public surface/barrel completeness gaps discovered at integration (lease gaps across wave-spanning modules) | 2 | 3 | v1-core | open |
| c1ed872bea557b96 | run tool drops/misroutes argv; workers pass whole command lines as single argv entries | 2 | 3 | v1-core | open (11 cycles without recurrence; a human may retire it) |
| 3658f327cc9cff2f | commit_pathspec-style single-command commits fail on deleted files | 2 | 2 | v1-core | open |
| 1cc46f93038f1d9a | Cross-suite pinning tests (docs-run block-count pin, registry-count pin) land without a named owner in the plan | 9 | 11 | loot-inventory | promoted; framework wording open |
| 576a281656f83b23 | Envelope factual premises (mock-vs-prompt anatomy, cross-suite counts) reach sessions unverified; mechanical premise verification at planning time is the fix | 12 | 54 | loot-inventory | promoted; framework wording open |
| 854ceecd39d4b0d3 | Whole-repo fast gates (typecheck/lint/format:check) go red at role-scoped receives; cleared by format-only owner corrections | 4 | 4 | v1-core | promoted |
| 17f4803c1b08da77 | Provider stream aborts / capacity failures kill subagents mid-session with zero commits; recovery resumes from the preserved tree | 3 | 5 | loot-inventory | open (promotion held: carried cycle attribution ambiguous) |
| 6f6b491bdbe37bf0 | Bare npx misresolves in this runtime; the working gate forms are pnpm exec vitest run <path> and node_modules/.bin/vitest | 3 | 4 | loot-inventory | open |
| 1d910de11732c6c4 | Final Archivist pass aborts on provider capacity leave the next cycle's pass a double synthesis (prior cycle's integrated fragments + record-debt) | 2 | 2 | loot-inventory | open |
| c172cd30e8dfc756 | Session commit gates hard-code a plan-time base SHA that a later replan makes stale | 1 | 1 | equipment-consumables | open |
| cecd211504587426 | Host await idle timeout (300 s) interrupts long subagent waits; re-awaiting the same handle reattaches with no work lost | 9 | 17 | equipment-consumables | promoted; framework wording open |
| f68c42a3f6224eb1 | Final Report mechanical facts (test-file counts, realized module edges) transcribed from handoffs rather than derived from the tree | 4 | 4 | v1-core | promoted; framework wording open |
| a368039028d463d6 | Role documents say Spec/DB are never spawned, while plans dispatch orchestrated Author re-entry sessions on recorded human authorization | 9 | 11 | grid-combat | promoted; framework wording open |
| 3983f8eb6d18a5f2 | Orchestrator STATE row matcher hits a CA-ID column inside the CAP table and writes contract-leg notes into the wrong rows | 1 | 2 | grid-movement | open |
| f4621ac12fba3456 | Pin audits enumerate count/shape pins but miss behavior pins: tests asserting a value whose derivation a decision changes surface red at a quiet boundary, some outside every lease | 3 | 4 | grid-combat | open |
| 760b67f17edbd346 | A feature opens a content class to a new execution path, and latent content hazards become reachable without a planning-time scan (damage(half) with no fail-branch damage, 12 spell sites) | 2 | 2 | spells-in-combat | open |
| 82b4e0abbda105d6 | Concurrent sessions on disjoint leases share one working tree: a sibling's uncommitted edits turn another worker's gates red or inflate its whole-suite counts | 1 | 2 | spells-in-combat | open |
| c3c94358b35f8316 | Final Report cites `git diff <base>..HEAD` while its own commit then moves HEAD, so the cited command no longer reproduces the reported count | 2 | 2 | action-targeting | open (this cycle's report anchored its moving-ref figure; done in practice, not yet in the template) |
| c187bed6bb5132a7 | A new file the role documents order committed through commit_pathspec lives under a gitignored path (VERIFICATION.md under program/<slug>/prompts/), and commit_pathspec cannot force-add it | 6 | 6 | feat-progression | promoted; framework wording open |
| 8039d6869169267c | Plan artifacts carry internal inconsistencies into sessions: refusal paths lettered differently in SESSION and STATE, and a prescribed validator snippet that double-cards a negative entry | 1 | 2 | feat-progression | open |
| d2415cb4497e0049 | Author/DB re-entry handoffs report deviations without an R1-R4 rule, so per-rule deviation counts cannot include them | 3 | 4 | feat-progression | **promoted 2026-10-11**; framework wording open |
| 3092a46b564d1d36 | A Verification Baseline records 'Hazards: none' while the inspected record already holds known hazards (dist/-importing journeys pass a stale build; ESLint lints the .program/ scratch directory) | 3 | 4 | combat-decomposition | **promoted 2026-10-11**; framework wording open |
| 2674d8c2f948ae0a | Plan-prescribed mechanical derivations are line-based greps that miss multi-line statements (value imports spread over several lines) | 1 | 1 | combat-decomposition | open |
| 0880dd5734025fd4 | A prescribed negative control perturbs a file outside the session's lease (scratch edit of a non-owned file), a D4 gap found only at preflight | 2 | 2 | combat-decomposition | open |
| 318c816b6920dd3d | A Final Report carries two `## Verification` sections (gates, then the FR-17 pass appended at the end), and the first cross-references the second as "below" | 1 | 1 | class-features | open |
| 47f092a4f076107c | A doc sentence claims a test checks more than the test enforces (README says docs-run checks "that this paragraph and ci.yml agree"; the pin reads only command strings) | 2 | 3 | browser-determinism | open |
| f229f492b7a1e737 | Envelopes direct worker scratch to /tmp while the worker write tool refuses paths outside the repo, and the in-repo scratch directory (.program/) is collected by eslint . | 1 | 1 | contract-conformance | open (new) |
