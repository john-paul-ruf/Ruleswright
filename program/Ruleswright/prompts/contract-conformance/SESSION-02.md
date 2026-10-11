# SESSION-02 — Contract conformance proof, old-location refusal, honest docs

> **Program:** Ruleswright
> **Feature:** contract-conformance
> **Modules:** tests, M05 (packaging/docs)
> **Depends on:** SESSION-01 (CA-K2 producer: `snapshots.schema.json` v1.11)
> **Concurrent with:** —
> **Owns:** `tests/proofs/contract-conformance.test.ts`, `tests/runtime/features.test.ts`, `tests/proofs/docs-run.test.ts`, `package.json`, `pnpm-lock.yaml`, `README.md`
> **Reads:** `src/schema/contracts/{pack,snapshots,override}.schema.json`, `tests/proofs/determinism-oracle.ts`, `tests/runtime/fixtures/{packs,pack}.ts`, `tests/schema/fixtures.ts`, `src/runtime/{index,runtime}.ts`, `src/compiler/index.ts`, `.github/workflows/ci.yml`, `program/Ruleswright/specs/database.md` (§Snapshot Envelopes, §Override Document), `program/Ruleswright/prompts/contract-conformance/STATE.md`
> **Resources:** —
> **Checkpoints:** 3

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| tests | proofs | `determinism-oracle.ts:55-58` (`Recording`), `:351` (`LEG_RUNS`), `:412` (`PACK_THEMES`); `docs-run.test.ts:38-45` (imports, `readmePath`), `:222-254` (the anatomy/CI-honesty `it`) | the subjects, and the existing honesty pin |
| tests | fixtures | `tests/runtime/fixtures/packs.ts:43, 232, 249, 303, 315` (the five `emberMarches*Pack()` builders), `tests/runtime/fixtures/pack.ts:183` (`cloneRuntimePack`), `tests/schema/fixtures.ts:158` (`clonePack`) | the seven fixture packs |
| tests | runtime | `tests/runtime/features.test.ts:1-15` (imports, `cloneRuntimePack`) | where the old-location refusal case goes |
| M03 | Runtime | `runtime.ts:55-62` (`PackLoadError.errors`), `:92-94` (the constructor validates with `packDslChecker`); barrel `index.ts:16` exports `PackLoadError` | the refusal path |
| M05 | docs | `README.md:146-151` (end rule; "A combat snapshot taken at the end restores as `combat-over`"), `:576-579` (CI paragraph; "for both sample themes" is stale: `coverage-floor.test.ts:34, 49` covers three), `:581-590` (determinism paragraph; l.588-590 overstate docs-run) | the doc sites |
| — | CI | `ci.yml:54` (`- run: pnpm test`, the Node 18/20/22 matrix), `:94` (`- run: pnpm exec vitest run tests/proofs/`, the `package` job) | the new file runs in both, with **no `ci.yml` change** |

## Context

Three JSON Schemas are published in `src/schema/contracts/`. They are DB-owned, normative, and quoted by `database.md`. No test or script has ever checked anything against them: `grep -rn 'contracts/' tests scripts` finds comments only. The hand-written validator (`validatePack`) is the load gate, but it is a *mirror* of the contract, not the contract. This session adds the missing proof. An **independent** validator (Ajv 8.20.0, JSON Schema draft 2020-12) checks every pack the library generates or ships as a fixture, every snapshot envelope its three writers produce, and representative override documents against the published files. S01's v1.11 removed the one disagreement the plan-time probe found. This session's checkpoint 1 is the proof that it is gone.

The session also closes two carried items, both owned by "Planner, the next feature touching tests/runtime / docs-run / README":
- `new Runtime` refusing the pre-v1.10 class-features location gets a dedicated repo test.
- `README.md:588-590` says docs-run checks "that this paragraph and `ci.yml` agree"; it checks less. Narrow the sentence to what is enforced.

## Capabilities

- **CAP-K1** (owner and integrator: this session, ck1): every published contract admits what the library writes and ships, proven by an independent validator, with negative controls that show the validator bites. Path: compiler `generateCampaign` / fixture builders → JSON text → `pack.schema.json`; the runtime barrel's writers (`serializeCharacter`, `serializeParty`, `serializeCombat` via the oracle legs) → JSON text → `snapshots.schema.json`; documents → `override.schema.json`. There is no I/O in `src/`; the test reads the contract files with `node:fs`, the docs-run way.
- **CAP-K3** (this session, ck2): `new Runtime(pack)` with `content.classes.<id>.features` throws `PackLoadError` with exactly `[['E-SCHEMA-02', 'content.classes.warden.features']]`.
- **CAP-K4** (this session, ck3): the README states the conformance proof, the three sample themes and exactly what docs-run checks, and docs-run enforces the new claim.
- CAP-K2 (the contract text) is S01's. Its Ajv proof is this session's ck1 (CA-K2).

## Contract Agreements

- **CA-K1 — subjects → contract, mapping (this session is producer and proof owner).**

  | Subject | Source | Count | Contract | Expected |
  |---|---|---|---|---|
  | Generated packs | `generateCampaign({ theme: loadTheme(t), seed: 42 })` for `t` of `PACK_THEMES` | 3 | `pack.schema.json` | valid |
  | Fixture packs | `emberMarchesPack`, `emberMarchesSpatialPack`, `emberMarchesHexPack`, `emberMarchesNoEconomyPack`, `emberMarchesAscendingPack`, `cloneRuntimePack`, `clonePack` | 7 | `pack.schema.json` | valid (probed: all 7). `clonePack` (VALID_PACK) yields 3 cards under the *real* DSL checker; Ajv checks structure only. Do not "fix" that here |
  | Oracle envelopes | every element of `LEG_RUNS[leg]().snapshots` that is an object carrying `kind` | **14** (9 legs; leg-7's first element is the `restoredOffers` id array, not an envelope) | `snapshots.schema.json` | valid; assert the count is 14 and the kinds cover `character`, `party`, `combat` |
  | Per-theme character | a level-1 character of each theme's first race and class: `serializeCharacter`, `serializeParty([state])` | 6 | `snapshots.schema.json` | valid |
  | Override documents | the `database.md` §Override example `{ overrides: [{ target: 'barrow-wight', patch: { hpBonus: 4, 'actions.claw.onHit': 'damage(1d8+2)' } }] }`, and `{ overrides: [{ target: 'barrow-wight', patch: { threat: 9 } }] }` | 2 | `override.schema.json` | valid |

  Every subject goes through `JSON.parse(JSON.stringify(x))` first, because what a host stores is the JSON text. Ajv options: `new Ajv2020({ allErrors: true, strict: false })` (DD-K2). Failure messages use `ajv.errorsText(validate.errors)`.

- **CA-K2 — combatant `hp` (S01 is producer; this session is proof owner).** Assert all of the following. At least one oracle combat envelope carries a combatant with `hp < 0`: leg 3b, `combatants[1].hp = -7` at plan time. Assert `some(hp < 0)`, not the literal. That envelope validates against the committed schema. **Regression control:** a `structuredClone` of the committed snapshots schema with `$defs.combatSnapshot.properties.combatants.items.properties.hp.minimum = 0` restored, compiled by a fresh `Ajv2020`, **rejects** that same envelope. This proves the test would have caught the pre-v1.11 defect. Also, `hp: 1.5` is rejected (integer kept).

- **Negative controls (probed at plan time, all reject):** a combat envelope plus `savedAt: 1` (closed envelope), `rng.a = 4294967296` (uint32 bound), an `emberMarchesPack()` copy plus a top-level `extra: {}` (closed pack root), an override with `patch: {}` (`minProperties: 1`), and an override item with no `target`.

**Checkpoint-0 recheck (read-only):**
- S01 has landed: `grep -n '"hp"' src/schema/contracts/snapshots.schema.json` shows no `"minimum": 0` on the combatant `hp`, and `grep -c '^| 12 | 1 (v1.11)' program/Ruleswright/specs/database.md` = 1. If not, return `blocked`.
- `git diff --quiet bb61f91 -- src tests README.md package.json pnpm-lock.yaml .github` is clean.
- The symbols above exist at the cited lines: `grep -n 'export const LEG_RUNS\|export const PACK_THEMES' tests/proofs/determinism-oracle.ts`; `grep -n '^export function' tests/runtime/fixtures/packs.ts tests/runtime/fixtures/pack.ts tests/schema/fixtures.ts`.
- `grep -n 'both sample' README.md` = l.578, and `sed -n 588,590p README.md` is the docs-run sentence.

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `package.json` | modify | devDependency `"ajv": "8.20.0"` (exact). `dependencies` stays absent |
| `pnpm-lock.yaml` | modify | by `pnpm add -D -E ajv@8.20.0` only |
| `tests/proofs/contract-conformance.test.ts` | create | CA-K1 + CA-K2 + negative controls |
| `tests/runtime/features.test.ts` | modify | one `it`: old location refused at `new Runtime` (CAP-K3) |
| `README.md` | modify | l.150-151 hp sentence; l.576-579 "all three sample themes" + conformance sentence; l.588-590 narrowed docs-run sentence |
| `tests/proofs/docs-run.test.ts` | modify | inside the existing CI-honesty `it` (l.222-254): pin the conformance claim (README names the file; the file exists; `ci.yml` runs it via `- run: pnpm test` and `- run: pnpm exec vitest run tests/proofs/`) |

## Implementation

### Checkpoint 1 — Ajv and the conformance proof (CAP-K1, CA-K1, CA-K2)

1. `pnpm add -D -E ajv@8.20.0`. The lockfile already holds `ajv@6.15.0` for ESLint; pnpm keeps both, and the test's import resolves the direct 8.20.0. Do not touch other entries (no `pnpm dedupe`).
2. Create `tests/proofs/contract-conformance.test.ts`. This import shape passed `pnpm typecheck` and `eslint` in a clean copy at plan time (P3):

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import type { ValidateFunction } from 'ajv';
import { describe, expect, it } from 'vitest';
import { generateCampaign, loadTheme } from '../../src/compiler';
import { Runtime, serializeCharacter, serializeParty } from '../../src/runtime/index';
import { LEG_RUNS, PACK_THEMES } from './determinism-oracle';
import {
  emberMarchesAscendingPack, emberMarchesHexPack, emberMarchesNoEconomyPack,
  emberMarchesPack, emberMarchesSpatialPack,
} from '../runtime/fixtures/packs';
import { cloneRuntimePack } from '../runtime/fixtures/pack';
import { clonePack } from '../schema/fixtures';

function contract(name: 'pack' | 'snapshots' | 'override'): Record<string, unknown> {
  const url = new URL(`../../src/schema/contracts/${name}.schema.json`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as Record<string, unknown>;
}
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
```

   Structure: one `describe` per contract plus `describe('negative controls')`. Use `it.each` over the named subjects so a failure names the subject. Each passing assertion is `expect(validate(doc), ajv.errorsText(validate.errors)).toBe(true)`. Use no `any` (lint), and narrow envelopes with a type guard on `'kind' in x`.
3. Header comment: what the file proves; that Ajv is an independent check of the DB-owned contracts against writer output; the DD-K2 non-strict reason (strict mode rejects schema *style*: union `type`, `required` inside `then`, not schema validity); and the re-key rule. A new writer field or a new fixture/theme must keep validating. A failure is a contract↔engine disagreement, so it goes back to DB (Author re-entry) or is an engine bug. It is never a loosened test.

**Commit when:**
- `pnpm exec vitest run tests/proofs/contract-conformance.test.ts` passes, and the envelope count assertion reads 14;
- `pnpm typecheck`, `pnpm lint` and `pnpm format:check` exit 0;
- **clean-checkout proof (V11):** once, before committing, from the repo root: `sh -c 'rm -rf /tmp/rw-contract-conformance && mkdir -p /tmp/rw-contract-conformance && git ls-files -co --exclude-standard -z | tar --null -T - -cf - | tar -xf - -C /tmp/rw-contract-conformance'`. This copies the tracked and new files, with no `node_modules` and no `dist/`, outside `$HOME` (form probed at plan time). Then, in `/tmp/rw-contract-conformance`: `pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm exec vitest run tests/proofs/contract-conformance.test.ts`. All must exit 0. Do **not** use `--preserveSymlinks` (H7). Planner ran the equivalent at plan time from `git archive bb61f91` plus `pnpm add` (P3);
- the CA-K2 regression control (an in-memory schema copy with `minimum: 0` restored rejects the negative-hp envelope) passes. **Never perturb `src/schema/contracts/**` itself, even temporarily.** It is DB-owned and outside this lease (standing recommendation `0880dd5734025fd4`). The in-memory control is the negative control.

Commit: `contract-conformance SESSION-02: checkpoint 1 — Ajv conformance proof over packs, snapshots and overrides`.

### Checkpoint 2 — old-location refusal at `new Runtime` (CAP-K3)

Add to `tests/runtime/features.test.ts` (import `PackLoadError` from `../../src/runtime`):

```ts
it('new Runtime refuses the pre-v1.10 content.classes.<id>.features location (E-SCHEMA-02)', () => {
  const pack = cloneRuntimePack();
  (pack.content.classes!['warden'] as unknown as Record<string, unknown>)['features'] = [
    { level: 1, ref: 'feature-warden-oath' },
  ];
  let caught: unknown;
  try { new Runtime(pack); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(PackLoadError);
  expect((caught as PackLoadError).errors.map((card) => [card.rule, card.jsonPath])).toEqual([
    ['E-SCHEMA-02', 'content.classes.warden.features'],
  ]);
});
```

Plan-time probe P4 gives exactly that card list.

**Commit when:** `pnpm exec vitest run tests/runtime/features.test.ts` passes, and V1–V3 exit 0.

Commit: `contract-conformance SESSION-02: checkpoint 2 — new Runtime refuses the old class-features location`.

### Checkpoint 3 — honest docs and the docs-run pin (CAP-K4)

1. `README.md:150-151`: after "A combat snapshot taken at the end restores as `combat-over`." add: "Damage is not floored: a downed combatant's hp can be negative, and the combat snapshot stores it as-is (snapshot contract v1.11)."
2. `README.md:576-579`: "for both sample themes" → "for all three sample themes". Then add a sentence: "`tests/proofs/contract-conformance.test.ts` checks every generated and fixture pack, every snapshot the three serializers write, and sample override documents against the published JSON Schemas in `src/schema/contracts/`, with an independent validator (Ajv, a dev dependency only); it runs in the Node matrix and in the package job."
3. `README.md:588-590`: replace "`docs-run` checks that this paragraph and `ci.yml` agree, so the README never promises a CI run CI does not perform." with a sentence stating exactly what is enforced. `docs-run` checks that the README names `pnpm test:browser`, `pnpm test:electron` and the conformance test file; that `ci.yml` runs the browser matrix, the Electron job, `pnpm test` and `tests/proofs/` as `run` steps; and that the conformance file exists. It does not check the rest of this prose. Keep both command strings verbatim (`docs-run.test.ts:245-246`). Add no ```` ```ts ```` block (`docs-run.test.ts:50` pins exactly 4).
4. `docs-run.test.ts`, inside the existing `it` after l.251: `expect(readme).toContain('tests/proofs/contract-conformance.test.ts')`; `expect(existsSync(fileURLToPath(new URL('./contract-conformance.test.ts', import.meta.url)))).toBe(true)` (import `existsSync` from `node:fs`); `expect(ci).toMatch(/^\s*- run: pnpm test$/m)`; `expect(ci).toMatch(/^\s*- run: pnpm exec vitest run tests\/proofs\/$/m)`. Run each new assertion's negative control once in place: rename the README mention and see the test fail, then restore it and `git diff` it clean.

**Commit when:** `pnpm exec vitest run tests/proofs/docs-run.test.ts` passes, then the full V1–V7 and V9 pass.

Commit: `contract-conformance SESSION-02: checkpoint 3 — README conformance, three themes, narrowed docs-run sentence; docs-run pins the claim`.

## Verification

Use STATE *Verification Baseline* V1–V11 and hazards H1–H10. At every checkpoint: V1 `pnpm typecheck`, V2 `pnpm lint`, V3 `pnpm format:check`, plus the scoped `pnpm exec vitest run <file>` (never `pnpm test -- <pattern>`, H3). At ck3: V4 `pnpm build`, V5 `pnpm build && pnpm test` (base 56 files / 974; expect 57 files and 974 + the new tests; report the exact line), V6 `pnpm check:isolation`, V7 `pnpm check:security`, V9 `pnpm build && pnpm test:electron` (the conformance file runs under Electron's Node too; `node:fs` is available there). V8 `pnpm test:browser` is unaffected: `vitest.browser.config.ts` does not collect the new file. Run it once at ck3 only if port 63315 is free (H8), and report it either way. V11 is the clean-copy proof at ck1.

CA proofs: CA-K1 (all subjects valid, count 14), CA-K2 (`some(hp < 0)` valid, regression control rejects, `1.5` rejects), negative controls.

## State Update

Report:
- status, and the checkpoint SHAs;
- the V5 and V9 summary lines;
- the envelope count and the negative-hp subject;
- the V11 transcript (exit codes);
- the README line numbers after the edit.

Surprises: any subject that fails Ajv is a **finding**, not something to suppress. Report the subject, the `instancePath` and the keyword, and stop that checkpoint (`blocked`, owner: DB re-entry or engine).

`followUp` for the final Archivist:
- PROGRAM-CONFIG Stack *Test* row (the conformance proof, `ajv@8.20.0` dev-only) and Custom Rule 1 (v1.11);
- `arch/v1-core.md`: retire "byte-level snapshot conformance" from the v1.1 follow-ups, recording that schema conformance is proven and byte-level round-trip stays as recorded; retire the class-features old-location hardening and the README l.588 overstatement from the residuals.
