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
{pending — appended verbatim after the final Archivist pass}
