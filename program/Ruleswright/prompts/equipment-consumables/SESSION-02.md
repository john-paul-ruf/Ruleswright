# SESSION-02 — TS mirror + validator + heal registry + equipment formula variables

> **Program:** Ruleswright
> **Feature:** equipment-consumables
> **Modules:** M01, M02
> **Depends on:** SESSION-01
> **Concurrent with:** — (S03 and S04 wait for this session's types and DSL changes)
> **Owns:** `src/schema/pack.ts`, `src/schema/artifacts.ts`, `src/schema/validate/sections/content.ts`, `src/schema/validate/sections/root.ts`, `src/schema/validate/index.ts`, `src/schema/validate/context.ts`, `src/schema/validate/collect.ts`, `src/core/dsl/registry.ts`, `src/core/dsl/effect.ts`, `src/core/dsl/formula.ts`, `tests/schema/validate.test.ts`, `tests/core/dsl/checker.test.ts`, `tests/core/dsl/effect.test.ts`, `tests/core/dsl/formula.test.ts`
> **Reads:** `src/schema/contracts/pack.schema.json`, `src/schema/contracts/snapshots.schema.json`, `program/Ruleswright/specs/database.md`, `src/schema/validate/helpers.ts`, `src/schema/validate/dsl.ts`, `src/core/dsl/shared.ts`, `src/core/dsl/checker.ts`, `tests/schema/fixtures.ts`, `tests/runtime/fixtures/pack.ts`
> **Resources:** —
> **Checkpoints:** 2 (plus a read-only ck0)

## Module Context
| ID | Module | Read | Why |
|---|---|---|---|
| M01 | Schema surface | write | Mirror types and the validator passes this session extends (including the pass-1 context) |
| M02 | Core mechanics | write | The registry (frozen, 12 → 13), the effect executor's new statement, and the formula checker/evaluator's `gear-*` variables |

## Context

S01 committed contract v1.4 in both `pack.schema.json` and `snapshots.schema.json`. You implement the pack side on the Coder side of the DB-owned boundary:
- the 1:1 TS mirror;
- the validator passes;
- the registry growth;
- the heal statement;
- the four equipment formula variables.

This is the session every later session types against, so the mirror must be exact. The snapshot TS types and serializer are **S05's**, in `src/runtime/snapshots.ts`. Do not touch them.

**Pin-lease ownership (promoted convention):**
- `tests/core/dsl/checker.test.ts:13-26` pins the frozen registry's exact membership (12 names). You own its re-key to 13 (add `heal`).
- No other E-FORM message pin is affected. The only E-FORM-01 assertion (`checker.test.ts:81-86`) matches `/offset/`, and nothing in this feature changes E-FORM-01 text.
- `EFFECT_VOCABULARY` (`registry.ts:43`) is the mock-pinned vocabulary. Do **not** add `heal` to it; no mock pins heal.
- `formula.test.ts:258` compares the registry keys with themselves and pins nothing.
- `tests/schema/registry.test.ts` pins `RULE_IDS`, and no rule id is added.

**Why `formula.ts` is in this lease (F-E2 option (b)):** themes (S04) will reference `gear-ac`/`gear-hp`/`gear-initiative` inside their `formulas` entries. Two things follow.

1. **Checking.** `checkFormula` (`formula.ts:550`) builds its context from `request.abilities` and `request.saves` only, so an unknown name → E-FORM-03. For `request.kind === 'formula'` the context must also admit the four `gear-*` names through `FormulaCheckContext.scalars`. Every other kind keeps its current vocabulary.
   - **There are two `kind:'formula'` callers** (corrected by REPLAN-EC-02, R-7): the validator's `formulas` section (`root.ts:192`) and the runtime re-check `checkPackDsl` (`resolve.ts:145`, its `pack.formulas` loop at `:171-172`). Both pass `kind:'formula'` only for `formulas` entries, so the admission behaves identically at both and you change neither caller. (`checkPackDsl` gains an item `use` check in S05; that is not yours.)
2. **Evaluation.** Many play-time sites evaluate `formulas` entries against contexts that carry no equipment:
   - `character.ts:220-248`, via `formulaValue`/`reserveValue`, from `progression.ts:152,206` and `snapshots.ts:328`;
   - `pools.ts:42`;
   - `resolve.ts:216-219` (statblocks);
   - `character-profile.ts:89`.

   So `evalFormula`'s name case (`formula.ts:284-289`) returns **0** for a name in `EQUIPMENT_SCALARS` that the context does not bind. That is the documented semantics: an unbound equipment variable means nothing is equipped. Any other unknown name still throws.

   This keeps every existing eval site byte-identical when nothing is equipped, with zero changes to them. It is also what lets S03 and S04 run concurrently: S04's formula strings evaluate identically whether or not S03 has landed. S03 binds real values for characters.

## Capabilities

- **CAP-E1 (implementation leg):** packs declaring equipment and consumables load, and bad ones reject with named rules. Proof: ck2 validator tests.
- **CAP-E2 (producer leg):** the `gear-*` variables are legal in `formulas` and evaluate to 0 when unbound. Proof: ck1 formula tests.
- **CAP-E4 (producer leg):** `heal` exists in the closed registry and executes as a negative-amount damage request. Proof: ck1 effect tests. The combat proof is S05's; do not claim it here.

## Contract Agreements

- **CA-EG1:** your leg is the mirror plus the validator.
  - `grants` keys resolve against `ctx.abilityIds ∪ ctx.saveIds ∪ {hp, ac, initiative, armor}`. Values must be integers. `armor` must be ≥ 1.
  - `slots` ids resolve in the pack's `equipSlots`.
  - `use` is routed through the existing `checkDslField` as kind `effect`.
  - Structural defects → E-SCHEMA-01; reference defects → E-REF-01, with nearestId hints per the existing section style.
  - Slot ids are **not** `registerId`'d; they are their own vocabulary (economy slot-name precedent).
- **CA-EG2 (DSL leg):**
  - `EQUIPMENT_SCALARS = ['gear-hp', 'gear-ac', 'gear-initiative', 'gear-armor']` lives in `formula.ts`, next to `BUILTIN_SCALARS` (`:65`).
  - `RESERVED_GRANT_KEYS = ['hp', 'ac', 'initiative', 'armor']` lives in `artifacts.ts`. Schema must not import a core value, so the two lists are declared separately.
  - A test in `formula.test.ts` asserts `EQUIPMENT_SCALARS` equals `RESERVED_GRANT_KEYS.map((k) => \`gear-${k}\`)`.
  - `root.ts` `checkStats` rejects a `stats.abilities`/`stats.saves` id equal to a `gear-*` name, with E-SCHEMA-01.
  - The identifier grammar is verified: `shared.ts` `isNameStart` is letter or `_`, and `isNameChar` also admits digits and `-`. So `gear-ac` lexes as **one** name, and subtraction around it needs spaces (the documented kebab rule, `shared.ts:8-10`).
- **CA-EG4:**
  - `REGISTRY` gains `heal: { arity: 1, kind: 'effect', signature: ['formula'] }`, placed in the effect-kind group right after `damage` (`registry.ts:12`; the table is grouped by kind, not alphabetical).
  - `ARG_CATEGORIES` (`effect.ts:388`) gains `heal: ['formula']`. With that, `checkEffectAst` (`effect.ts:442-500`) accepts `heal` with no other change.
  - `execStatement` gains `case 'heal'` → `execHeal`, mirroring `execDamage`: evaluate the formula, wrap it as a RollResult, **negate the total** in the `apply.damage` call, and return a `DamageOutcome` with `halved: false`.

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `src/schema/artifacts.ts` | modify | `ItemDef` (`:123`) gains `slots?: string[]`, `grants?: Record<string, number>`, `use?: DslString`; export `RESERVED_GRANT_KEYS`; docstrings carry CA-EG1/EG2/EG3 |
| `src/schema/pack.ts` | modify | `Pack` gains `equipSlots?: string[]` after `spatial?` (`:93`); header (`:3`) becomes "8 required + 3 optional … equipSlots v1.4" |
| `src/schema/validate/context.ts` | modify | `Ctx` gains `equipSlotNames: Set<string> \| null` with **absent and unreadable kept distinct** (R-8; the `progressionIds` precedent, `collect.ts:65-66`, not the `economySlotNames` one, whose null conflates both): **absent** root `equipSlots` → an **empty `Set`** (an item declaring `slots` then gets E-REF-01, "the pack declares no equipSlots"); **readable** → the declared names; **unreadable** → `null` (dependent item-slot reference checks are skipped, so no cascade). Docstring states the three cases |
| `src/schema/validate/collect.ts` | modify | pass 1 sets `ctx.equipSlotNames` for all three cases. **Readable** means: an array, ≥1 entry, every entry a string matching `ID_PATTERN`, no duplicates. Anything else (non-array, empty, a bad entry, a duplicate) is **unreadable** → `null`; `checkEquipSlots` reports those defects as E-SCHEMA-01 |
| `src/schema/validate/index.ts` | modify | the ctx literal gains `equipSlotNames: null` (the file's own "keep in sync" note; pass 1 overwrites it in every case); dispatch calls `checkEquipSlots(ctx, json['equipSlots'])` after `checkSpatial` |
| `src/schema/validate/sections/root.ts` | modify | `checkRootSections` (`:42`) admits `equipSlots`; new `checkEquipSlots`: array, ≥1, unique, idPattern (E-SCHEMA-01); `checkStats` rejects `gear-*` ids (E-SCHEMA-01) |
| `src/schema/validate/sections/content.ts` | modify | `checkItems` (`:618`): `forbidUnknown` list gains `slots`/`grants`/`use`; `checkItemGrants` (keys, integer values, `armor` ≥ 1, E-REF-01 with nearestId); `checkItemSlots` (non-empty unique array; each id in `ctx.equipSlotNames`; slots declared while the pack has no `equipSlots` (empty set) → E-REF-01; **skipped entirely when `ctx.equipSlotNames` is `null`**, i.e. `equipSlots` is unreadable, R-8); `use` → `checkDslField(ctx, def['use'], 'effect', id, \`${basePath}.use\`)` |
| `src/core/dsl/registry.ts` | modify | `heal` entry; docstring notes the v1.4 schema event |
| `src/core/dsl/effect.ts` | modify | `execHeal`; `ARG_CATEGORIES.heal`; module docstring notes the negative-amount discipline |
| `src/core/dsl/formula.ts` | modify | `EQUIPMENT_SCALARS`; `checkFormula` admits them for `kind === 'formula'` via `scalars`; `evalFormula`'s name case returns 0 for an unbound `EQUIPMENT_SCALARS` name (docstring updated; all other unknown names still throw) |
| `tests/core/dsl/checker.test.ts` | modify | **Pin re-key (named duty):** the membership list at `:13-26` gains `heal` (13 names). Nothing else changes |
| `tests/core/dsl/effect.test.ts` | modify | `heal(2 + might)` executes as a damage request with the negated total; `halved: false`; `why` rolls carried; an unknown function still → E-FORM-02 |
| `tests/core/dsl/formula.test.ts` | modify | `gear-ac` admitted in a `formula`-kind check, rejected (E-FORM-03) in an `attackBonus`/`effect`/`valid` check; `evalFormula('12 - gear-ac', {})` = 12, and with `{'gear-ac': 2}` = 10; `'10 + gear-ac'` with 2 = 12 (both directions); an unbound non-gear name still throws; lists correspond. **Lexing edge cases (R-11):** `'10-gear-ac'` with `{'gear-ac': 2}` = 8 (a digit-led term ends at the `-`, so it subtracts); `'level-gear-ac'` in a `formula`-kind check → E-FORM-03 (one unknown name, `shared.ts:106-120`) |
| `tests/schema/validate.test.ts` | modify | new coverage (below) built on an **isolated minimal pack** in the test file, **not** `VALID_PACK` (F-E14: `tests/schema/fixtures.ts` uses non-registry words `shift(1)`/`soak(1)` at `:40`/`:69`, which add E-FORM-02 cards under the real checker) |

**Not changed:** `tests/schema/fixtures.ts`. `tests/runtime/fixtures/pack.ts` imports it, so an edit would ripple into S03's lease.

## Implementation

### Checkpoint 0 — Contract re-check (read-only, no commit)
Read S01's committed `pack.schema.json` and `database.md`. Confirm:
- the exact field names and types;
- the reserved grant keys;
- the four `gear-*` names;
- the reserved stats ids.

Any mismatch with CA-EG1/EG2 → report a plan correction before writing code.

### Checkpoint 1 — Core DSL: heal + equipment variables + registry pin
Make the registry, `effect.ts` and `formula.ts` changes and write their tests, including the two lexing edge cases in the `formula.test.ts` row (`10-gear-ac` subtracts; `level-gear-ac` → E-FORM-03).

**Valid state:** everything compiles, and the freeze test is re-keyed in the same commit. Never land a 12/13 mismatch.

**Commit when:**
- `pnpm typecheck` is 0;
- `pnpm exec vitest run tests/core/dsl/` is green, including the re-keyed freeze test and the new heal/formula cases;
- the commit covers `registry.ts`, `effect.ts`, `formula.ts` and the three DSL test files.

### Checkpoint 2 — Mirror + validator + tests
1. Mirror `artifacts.ts` and `pack.ts` against the contract.
2. Validator plumbing: `context.ts`, `collect.ts`, `index.ts`, `root.ts`, `content.ts`.
3. Tests (isolated pack, real `packDslChecker` from `src/core/dsl/checker.ts`):
   - valid equipment and consumable items load with zero cards;
   - a non-integer grant value → E-SCHEMA-01;
   - an unknown grant key → E-REF-01 with a hint;
   - `armor: 0` → E-SCHEMA-01;
   - an unknown slot id → E-REF-01;
   - `slots` declared with no `equipSlots` (absent) → E-REF-01;
   - **malformed `equipSlots` (R-8 closing check):** `equipSlots: ['body', 'Bad Slot']` with an item declaring `slots: ['body']` → only the `equipSlots` E-SCHEMA-01 card(s); **no** E-REF-01 card for the item. Repeat with `equipSlots: 'body'` (not an array): same result;
   - `equipSlots: []` → E-SCHEMA-01;
   - a duplicate `equipSlots` entry → E-SCHEMA-01;
   - an ability named `gear-ac` → E-SCHEMA-01;
   - `use: 'heal(2 + might'` → E-FORM-01;
   - `use: 'mend(2)'` → E-FORM-02;
   - a `formulas.ac` of `'10 - gear-ac'` → zero cards;
   - `gear-ac` inside an action's `attackBonus` → E-FORM-03.

**Commit when:**
- `pnpm typecheck` is 0;
- `pnpm exec vitest run tests/schema/ tests/core/dsl/` is green;
- the commit covers the remaining lease.

Report the CAP-E1 proof result in the handoff.

## Verification

- Lease-scoped gates: `pnpm typecheck` and `pnpm exec vitest run tests/schema/ tests/core/dsl/` (the exact form; DD14e).
- Whole-repo fast gates are Orchestrator's at receive (promoted convention). Expected-unchanged evidence: `tests/runtime/`, `tests/compiler/` and `tests/proofs/` stay green, because no eval site changed behavior (the `gear-*` fallback returns 0 only for names no current pack uses).
- **Dist freshness (R-10):** this session changes `src/core/**`, which is bundled into `dist/runtime.*` and `dist/compiler.*`. `tests/proofs/loot-journey.test.ts` imports `dist/`, so Orchestrator runs `pnpm build` before the whole-suite receive (Verification Baseline). You need not build; if you run `tests/proofs/` yourself, build first.
- CA-EG1 boundary assertion: every contract field from S01 has exactly one TS mirror type and one validator pass. A contract field with neither is a blocked condition: return it, do not improvise.
- CA-EG4 proof (your leg): the freeze test names `heal` among 13 entries; the effect test proves the negative-amount mutation request.

## State Update

Report:
- the mirror fields as landed;
- the registry count (13);
- the `EQUIPMENT_SCALARS` / `RESERVED_GRANT_KEYS` exports;
- the validator rejection names as tested.

The handoff names:
- **S03's consumers:** the `ItemDef` fields, `Pack.equipSlots`, the `EQUIPMENT_SCALARS` names and the `heal` executor;
- **S04's facts:** the `gear-*` names are legal in theme `formulas` entries, and `equipSlots` is a root key.
