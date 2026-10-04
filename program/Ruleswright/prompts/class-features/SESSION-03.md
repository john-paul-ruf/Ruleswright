# SESSION-03 — Schema mirror, validator, bundled themes and fixtures, characterization re-key

> **Program:** Ruleswright
> **Feature:** class-features
> **Modules:** M01, M04, tests
> **Depends on:** S01
> **Concurrent with:** —
> **Owns:** `src/schema/artifacts.ts`, `src/schema/error-card.ts`, `src/schema/validate/index.ts`, `src/schema/validate/sections/content.ts`, `src/schema/validate/sections/progression.ts`, `src/schema/validate/sections/cross.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `tests/runtime/fixtures/pack.ts`, `tests/schema/fixtures.ts`, `tests/schema/validate.test.ts`, `tests/compiler/coverage-floor.test.ts`, `tests/proofs/combat-characterization.test.ts` — plus **scratch-only, never committed:** `tests/proofs/characterization-dump.scratch.test.ts`
> **Reads:** `program/Ruleswright/specs/database.md` (v1.10 *Class features*, as landed by S01), `src/schema/contracts/pack.schema.json`, `src/schema/validate/{helpers,context}.ts`, `src/schema/pack.ts`, `src/compiler/stages/{feats,classes}.ts`, `program/Ruleswright/prompts/class-features/STATE.md`
> **Resources:** —
> **Checkpoints:** 2

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M01 | Schema | `artifacts.ts:68-88` (`ClassFeature`, `ClassDef`), `:154-164` (`ClassProgression`) | move the type |
| M01 | Validator | `sections/content.ts:81` (class `forbidUnknown`), `:85-134` (feature shape block) | remove the old location |
| M01 | Validator | `sections/progression.ts:60-66` (`forbidUnknown`), `:166-208` (`featSlots` + ceiling) | add the new location |
| M01 | Validator | `sections/cross.ts` (`checkRestrictsTags` pattern: reads `json['content']` directly), `helpers.ts` (`nearestId`, `ID_PATTERN`, `add`, `isPlainObject`), `validate/index.ts:67-81` | ref resolution |
| M04 | Themes | `dark-fantasy.json:125-149` (classes), `zombie-urban.json:125-155`, `wyldwood.json:232-287`; each theme's `"feats"` and `"progression"` maps, `actions` map | content migration (DD-C10) |
| tests | — | `tests/proofs/combat-characterization.test.ts:56-345` (legs, `digests`, the `generated()` themes), `tests/compiler/coverage-floor.test.ts:195-298` | pins |

## Context

S01 landed contract v1.10. Class features move from `content.classes.<id>.features` to `progression.<id>.features`, and `ref` must resolve to a feat, an action or a spell (DD-C1, DD-C4). This session makes the schema surface, the validator, the three bundled themes and the two test fixtures agree with it. It also fixes every broken bundled ref (DD-C10). **No runtime behaviour changes here:** nothing in `src/runtime` reads features until S04. The only observable change in generated packs is their bytes, and therefore their `contentHash`. That is why the characterization pin needs a proven re-key (CA-C5).

## Capabilities

- **CAP-C1** (load rules): integration owner, **ck2**. ck1 lands location and shape; ck2 lands resolution.
- **CAP-C2** (bundled content works at load): owner, **ck2**.
- Producer for CAP-C3–C6 (S04): `ClassProgression.features` type and resolved content.

## Contract Agreements

- **CA-C1** (location/shape), **CA-C2** (resolution). Implement exactly the STATE.md mapping as amended after S01's receive. Precedence: Orchestrator's envelope amendments, then STATE CA text, then this prompt.
- **CA-C5** (re-key): owner, both checkpoints.

**Checkpoint-0 recheck (read-only; report any mismatch before editing):**
- `database.md` contains `**Class features (v1.10` and Version Registry row 11. `grep -n '"features"' src/schema/contracts/pack.schema.json` hits only inside the `progression` entry.
- `grep -n 'features' src/schema/validate/sections/content.ts` hits at l.81 and l.85-134 only.
- The ref probe: every bundled `features[].ref` → which map holds it. Expected: 11 unresolved; `wardens-glyph` → `content.spells` twice (dark-fantasy warden L3, crypt-warden L2).
- The DD-C10 new ids are unused: for each of `wardens-resolve barrow-rite crypt-vigil jury-rig steady-pulse thornward bramble-vigil`, `grep -rn '"<id>"' src/compiler/themes tests` is empty. The other new feat ids appear only as today's feature refs.
- Baseline: `pnpm build && pnpm test` → 52 files, 938/938.

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `src/schema/artifacts.ts` | modify | `ClassDef.features` removed. `ClassProgression.features?: ClassFeature[]` added with a v1.10 doc comment. The `ClassFeature` doc comment is updated |
| `src/schema/error-card.ts` | modify | l.12 example path → `progression.warden.features[0].level` (comment only) |
| `src/schema/validate/sections/content.ts` | modify | `'features'` dropped from l.81; the l.85-134 block deleted |
| `src/schema/validate/sections/progression.ts` | modify | `'features'` added to `forbidUnknown`; shape, level-range and uniqueness checks (`E-SCHEMA-01`) |
| `src/schema/validate/sections/cross.ts` | modify (ck2) | `checkClassFeatures(ctx, json)`: resolution + redundancy (`E-REF-01`) |
| `src/schema/validate/index.ts` | modify (ck2) | call `checkClassFeatures(ctx, json)` after `checkProgressionPairing(ctx)` |
| `src/compiler/themes/*.json` (3) | modify | ck1: move each class's `features` array verbatim to `progression.<id>.features`. ck2: DD-C10 refs + new feats/actions |
| `tests/runtime/fixtures/pack.ts`, `tests/schema/fixtures.ts` | modify | ck1: move `features` to `progression.warden`. ck2: add feat `feature-warden-oath` (DD-C11) |
| `tests/schema/validate.test.ts` | modify | new `describe('class features (v1.10, CAP-C1)')` |
| `tests/compiler/coverage-floor.test.ts` | modify (ck2) | new per-theme case `v1.10 class features resolve (CAP-C2)` |
| `tests/proofs/combat-characterization.test.ts` | modify | digest literals re-keyed at ck1 and ck2, only after the CA-C5 proof |

## Implementation

### The CA-C5 re-key procedure (used at both checkpoints)

1. **Before any theme edit in the checkpoint:**
   - Create the scratch file `tests/proofs/characterization-dump.scratch.test.ts`: a copy of `combat-characterization.test.ts` in which each leg's `it` writes `JSON.stringify(recording, normalize)` to `/tmp/ruleswright-class-features/<phase>/<leg>.json`, where `normalize` replaces the value of every `contentHash` key with `"<hash>"`. Use `node:fs` `mkdirSync`/`writeFileSync`. It is a test file, so the `src/`-only no-I/O lint rule does not apply. If lint objects, it is deleted before lint runs anyway.
   - Run it once with `<phase>` = `ck<N>-before`: `pnpm exec vitest run tests/proofs/characterization-dump.scratch.test.ts`.
2. **After the checkpoint's edits,** run it again with `<phase>` = `ck<N>-after`. Then `cmp` every leg file pair. **All 9 legs must be byte-equal.** If any differ, stop: a leg's behaviour changed, which DD-C10 says cannot happen. Report it as `blocked` with the first differing bytes; do not re-key.
3. Run the real test. Replace only the failing digest literals with the values the failure prints, and re-run until green. Record the old → new digest per leg for the handoff.
4. Delete the scratch file (`rm tests/proofs/characterization-dump.scratch.test.ts`; verify `test ! -e` on it) **before** the whole-repo gates and before `git add`. It is never committed (STATE H5).

Steps 1–2 bracket each checkpoint's theme edits. Capture `before` at ck1 start, and `before` again at ck2 start, from ck1's committed state.

### Checkpoint 1 — move the field (location and shape)

1. **Types (`artifacts.ts`).** Remove `features?: ClassFeature[]` from `ClassDef`. Add to `ClassProgression` after `featSlots`:
   ```ts
   /** v1.10 (FR-6) — class features: `ref` names a content.feats id (granted while the class level >= level), an actions id or a content.spells id (unlocked from that level). */
   features?: ClassFeature[];
   ```
2. **`content.ts`:** remove `'features'` from the l.81 `forbidUnknown` list and delete the l.85-134 block. A pack still declaring `content.classes.<id>.features` then gets the existing closed-contract card from `forbidUnknown` (`helpers.ts:72-76`): `E-SCHEMA-02` at `content.classes.<id>.features`, message `unknown field "features" — the contract is closed (additionalProperties: false).`
3. **`progression.ts`:**
   - Add `'features'` to the l.60-66 `forbidUnknown` list.
   - Port the deleted shape block, re-pathed to `${basePath}.features[...]` (`basePath` = `progression.<classId>`): array check; per entry object, `reqFields`/`forbidUnknown` `['level','ref']`; `level` integer ≥ 1; `ref` a string matching `ID_PATTERN`.
   - Then add:
     - **level ceiling:** with `saves` readable, `level` > the shortest `saves` length → `E-SCHEMA-01` at `.level`, message `feature level <L> is above the class's level ceiling <C> (FR-6).`;
     - **uniqueness:** a `ref` repeated within the class → `E-SCHEMA-01` at the repeat's `.ref`.
4. **`error-card.ts:12`** comment example → `"progression.warden.features[0].level"`.
5. **Themes (3) and fixtures (2):** move each class's `features` array **verbatim** (same refs, same order) into that class's `progression` entry, as its last key. Remove it from the class. Do not fix refs yet.
6. **Tests (`validate.test.ts`), new describe `class features (v1.10, CAP-C1)`.** Base the cases on the `tests/schema/fixtures.ts` valid pack:
   - (a) the moved fixture validates clean;
   - (b) `content.classes.warden.features` present → exactly one card, `E-SCHEMA-02` at `content.classes.warden.features`;
   - (c) `level: 0`, `level: 1.5`, `level` above the ceiling → `E-SCHEMA-01` at `progression.warden.features[0].level`;
   - (d) a repeated `ref` → `E-SCHEMA-01`;
   - (e) all-at-once: (b) + (c) in one pack yields both cards.
7. **CA-C5** for the theme move.

**Commit when:**
- `pnpm typecheck`, `pnpm lint` and `pnpm format:check` are 0;
- `pnpm build && pnpm test` is green (N₀ + this checkpoint's new cases);
- the CA-C5 `cmp` is equal for all 9 legs and the characterization test is green after re-key;
- the scratch file is gone;
- `git status --porcelain` shows only lease paths.

Commit `git add -- <lease paths> && git commit -m "class-features SESSION-03: checkpoint 1 — features move to progression" -- <lease paths>`.

### Checkpoint 2 — resolve refs and fix the bundled content

1. **`cross.ts` → `checkClassFeatures(ctx: Ctx, json: Record<string, unknown>): void`.**
   - Read `json['progression']`, `json['content']` (`feats`, `spells`, `classes`) and `json['actions']` directly, as `checkRestrictsTags` does. Skip silently if a container is unreadable (structural cards already exist).
   - For each `progression.<c>.features[i]` with a string `ref`:
     - `ref` ∉ feats ∪ actions ∪ spells → `E-REF-01` at `progression.<c>.features[i].ref`, artifactId `<c>`. Message: `class feature "<ref>" (class "<c>", level <L>) names no feat, action or spell.` Hint: `did you mean "<nearestId over the union>"?`, else a list of nothing.
     - `ref` ∈ actions and ∈ `content.classes.<c>.actions` → `E-REF-01`: `class feature "<ref>" unlocks an action class "<c>" already grants from level 1 (content.classes.<c>.actions) — remove one.`
     - `ref` ∈ spells and its `magic.lists` intersect `content.classes.<c>.spellLists` → `E-REF-01`: `class feature "<ref>" unlocks a spell class "<c>" already knows through its spellLists.`
   - Call it in `validate/index.ts` after `checkProgressionPairing(ctx)` (l.79).
2. **Themes:** apply the DD-C10 table exactly (STATE.md *Design Decisions*). Every row's `progression.<class>.features` entry, in level order.
   - **New passive feats:** `{"name": "<coined>", "passive": "1"}`.
   - **New reactive feats** (`crypt-vigil`, `steady-pulse`, `bramble-vigil`): `{"name": "<coined>", "trigger": {"on": "condition:applied[target=self]"}, "effect": "applyCondition(braced, 1)"}`.
   - **New actions** (`barrow-rite`, `jury-rig`, `thornward`): `{"cost": {"slots": {"main": 1}}, "valid": "hasTarget(adjacent)", "effect": "sequence(attack(ac, might), damage(1d6 + might, <type>))", "tags": ["main"]}`. Use the theme's own ability and damage-type vocabulary; read its `strike`/`baton-blow` equivalent. Each must pass stage 8 and the DSL checker.
   - Append every new entry **after** the existing entries of `content.feats` / `actions`. Then confirm the coverage-floor pins in STATE's audit still hold.
3. **Fixtures (DD-C11):** add `'feature-warden-oath': { name: 'Warden Oath' }` to `content.feats` in both fixture packs.
4. **Tests:**
   - `validate.test.ts`, the same describe:
     - (f) an unresolved ref → `E-REF-01` with the did-you-mean hint;
     - (g) a ref naming a non-feat/action/spell id (e.g. a condition id) → `E-REF-01`;
     - (h) a feat, an action and a spell ref each validate clean (the spell on another class's list);
     - (i) a redundant action → `E-REF-01`;
     - (j) a redundant spell → `E-REF-01`.
   - `coverage-floor.test.ts`, per theme: `${name}: v1.10 class features resolve (CAP-C2)`:
     - every `progression.*.features[].ref` is a key of exactly one of feats/actions/spells;
     - no class has `features` in `content.classes`;
     - the theme has ≥ 1 feature naming a reactive feat and ≥ 1 naming an action;
     - zombie-urban has ≥ 1 naming a spell;
     - warden/hexer/scavenger features name passive feats only (the DD-C10 constraint, pinned).
5. **CA-C5** for the content change.

**Commit when:** the ck1 conditions hold again. Also each generated theme loads: `generateCampaign` for all three themes passes stage 8 (the existing themes/coverage-floor suites cover it). Commit message `class-features SESSION-03: checkpoint 2 — refs resolve, bundled content fixed`.

## Verification

- Effective gates per STATE *Verification Baseline*: V1–V6 at each commit, `pnpm build` immediately before `pnpm test` (H1). Use `pnpm exec vitest run <path>` for scoped runs (H3).
- **CAP-C1 proof:** `pnpm exec vitest run tests/schema/validate.test.ts`. The `class features (v1.10, CAP-C1)` describe passes cases (a)–(j). The real `validatePack` and the real DSL checker are used, with no doubles.
- **CAP-C2 proof:** `pnpm exec vitest run tests/compiler/coverage-floor.test.ts`. The new case passes for all three themes through the real `runPipeline`/`generateCampaign`, including stage 8.
- **CA-C5:** 9/9 legs `cmp`-equal after normalization at ck1 and ck2. Old → new digests are recorded.
- **Negative control (ck2, scratch, reverted):** change one bundled feature ref to `oath-of-the-wardenX`. The coverage-floor/themes suite must fail with `E-REF-01` at that path. Revert, then `git diff --quiet -- src/compiler/themes` against the commit you are about to make.

## State Update

Report:
- N after each checkpoint;
- the new test names;
- the CA-C5 old → new digests per leg and the `cmp` result;
- the final display names coined;
- any CA-C1/CA-C2 wording delta from S01's text;
- confirmation that `src/runtime/**` is untouched (`git diff --quiet f36d4ae -- src/runtime`).

The S04 dependency facts are `ClassProgression.features` and the DD-C10 ids as landed.
