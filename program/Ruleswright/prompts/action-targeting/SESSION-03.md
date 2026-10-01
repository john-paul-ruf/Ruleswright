# SESSION-03 — Ability column: `ability(name)`, the med-kit, `heal` in the vocabulary, spell lists

> **Program:** Ruleswright
> **Feature:** action-targeting
> **Modules:** M01, M02, M03, M04
> **Depends on:** SESSION-01 (contract v1.7: CA-A3; the med-kit line from B-AT-1), SESSION-02 (shared `zombie-urban.json`, `wyldwood.json`, `README.md`)
> **Concurrent with:** —
> **Owns:** `src/core/dsl/registry.ts`, `src/core/dsl/formula.ts`, `src/core/dsl/effect.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/equipment.ts`, `src/schema/validate/sections/cross.ts`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `README.md`, `tests/core/dsl/checker.test.ts`, `tests/core/dsl/ability.test.ts`, `tests/proofs/equipment-journey.test.ts`, `tests/proofs/spells-journey.test.ts`, `tests/compiler/spell-lists.test.ts`
> **Reads:** `program/Ruleswright/specs/database.md` (v1.7 §formulas "`ability(name)`"), `src/schema/validate/index.ts`, `src/schema/validate/dsl.ts`, `src/core/dsl/checker.ts`, `src/runtime/pools.ts`, `src/runtime/combat/combat.ts`, `tests/schema/fixtures.ts`, `tests/runtime/fixtures/packs.ts`, `tests/runtime/combat/character-profile.test.ts`, `program/Ruleswright/prompts/action-targeting/STATE.md`
> **Resources:** —
> **Checkpoints:** 3

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M02 | Core | `registry.ts` (all); `formula.ts` `FormulaCheckContext` (l.55-62), `evalFormula` (l.292-319), `evalCall` (l.370-388), `checkFormulaAst` (l.461-545), `checkFormula` (l.563-585); `effect.ts` `checkEffect` (l.487-503) | registry entry, check, eval |
| M03 | Runtime | `resolve.ts` `executeAgainst` (l.314-360), `effectVars` (l.362-377); `equipment.ts` `useItem` vars (l.273-281), `executeEffect` call (l.332) | the only two effect-var builders (`grep -rn "executeEffect(" src` → `resolve.ts:347`, `equipment.ts:332`) |
| M01 | Schema | `cross.ts` `NON_FORMULA_ARGS` (l.82-87), `referencesSpeed` | the speed-scan mirror |
| M04 | Compiler | `zombie-urban.json` `content.items.med-kit` (l.259), `content.classes` (l.125-156); `wyldwood.json` `content.classes.hedge-mage.spellLists` (l.270) | content |

## Context

zombie-urban declares `vigor` as an ability **and** a save. Both effect-var builders spread
saves after abilities, so `heal(2 + vigor)` reads the save (0 at level 1). There is no
content spelling for the ability (DD-A5). DB v1.7 adds `ability(name)`, a formula function
legal only in effects that reads the actor's ability unshadowed. This session implements it,
switches the med-kit to it, and closes two carried gaps:
- `EFFECT_VOCABULARY` lacks `heal`;
- two theme classes have spell lists that match no spell (zombie-urban medic/fixer `[]`, wyldwood hedge-mage `["hedge"]`).

## Capabilities

- **CAP-A4 (owned, ck1):** `ability(n)` checks and evaluates, in combat (`effectVars`) and out (`useItem`).
- **CAP-A6 (owned, ck1):** `EFFECT_VOCABULARY` covers `heal`.
- **CAP-A7 (owned, ck2):** medic/fixer know their spells; hedge-mage knows its 4; scavenger stays a non-caster.
- **CAP-A5 (owned, ck3):** the med-kit heals by the vigor **ability** through `useItem` and `fight.use`.

Required facts: the actor's composed abilities. In combat, `actor.abilities` in `effectVars` (the profile, equipment-composed, as `profileFromCharacter` builds it). Out of combat, `view.abilities` in `useItem`. Both already exist.

## Contract Agreements

**CA-A3 (STATE.md), as amended after S01.** Use the envelope's amended text if it differs.

- Registry: `ability: { arity: 1, kind: 'formula', signature: ['ability-name'] }` (15 entries).
- Check:
  - legal only when the request kind is `effect` → else `E-FORM-02` ("`ability(...)` is legal only inside effects");
  - the argument must be a bare name in `request.abilities` → else `E-FORM-03` with did-you-mean over abilities;
  - wrong arity → `E-FORM-02`.
- Eval: `ctx['ability:' + name]`; `undefined` → throw (fail closed, "validate before evaluation").
- Bind: both builders set `vars['ability:' + n] = <actor ability n>` for every actor ability. Never the target's.
- M01 mirror: `NON_FORMULA_ARGS.ability = [0]`, so `ability(speed)` is never read as a `speed` reference.

**CA-A4 (agreed, producer ready):** `pools.ts knownSpells` (l.307-315) is unchanged. The content must satisfy its exact string match.

**Checkpoint-0 recheck (read-only):**
- `database.md` v1.7 §formulas matches the CA-A3 bullets.
- `registry.ts` still has 14 entries.
- `grep -rn "executeEffect(" src` still shows exactly 2 non-definition callers.
- S02 has landed (`git log --oneline -- src/compiler/themes/zombie-urban.json` shows S02's ck2).
- The med-kit line to write is in the envelope (S01 handoff / B-AT-1). The default is `heal(2 + ability(vigor))`.

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `src/core/dsl/registry.ts` | modify | the `ability` entry; a header note (v1.7, 14 → 15); `EFFECT_VOCABULARY` += `'heal'`; `FORMULA_VOCABULARY` += `'ability'` |
| `src/core/dsl/formula.ts` | modify | `FormulaCheckContext.allowAbility?: boolean`; the `checkFormulaAst` `ability` branch; the `evalCall` `ability` case (before the scalar map) |
| `src/core/dsl/effect.ts` | modify | `checkEffect`'s ctx gains `allowAbility: true` |
| `src/runtime/combat/resolve.ts` | modify | `effectVars`: bind `ability:<n>` from `actor.abilities` |
| `src/runtime/equipment.ts` | modify | `useItem` vars: bind `ability:<n>` from `view.abilities` |
| `src/schema/validate/sections/cross.ts` | modify | `NON_FORMULA_ARGS` += `ability: [0]`; update the mirror comment |
| `tests/core/dsl/checker.test.ts` | modify | registry membership pin → 15 (adds `'ability'`); title "v1.7"; assert `EFFECT_VOCABULARY` contains `heal` and `REGISTRY.ability` |
| `tests/core/dsl/ability.test.ts` | create | check, eval, binding, and mirror tests (ck1 item 6) |
| `src/compiler/themes/zombie-urban.json` | modify | `medic.spellLists: ["medic"]`, `fixer.spellLists: ["fixer"]` (ck2); the med-kit `use` (ck3) |
| `src/compiler/themes/wyldwood.json` | modify | `hedge-mage.spellLists: ["hedge-mage"]` |
| `tests/compiler/spell-lists.test.ts` | create | the CA-A4 content invariant plus known-spell assertions |
| `tests/proofs/spells-journey.test.ts` | modify | l.249-250 comment: hedge-mage now knows its 4 spells. No assertion change |
| `tests/proofs/equipment-journey.test.ts` | modify | steps 4-5: med-kit amounts re-keyed; a discriminating save-vs-ability assertion |
| `README.md` | modify | l.390 med-kit JSON line; l.430-441 prose and the expected-output block. **No new ```ts block** (DD-A9) |

## Implementation

### Checkpoint 1 — `ability(name)` checks, evaluates and binds; `heal` in the vocabulary

1. Read every file in Module Context before editing.
2. `registry.ts`:
   ```ts
   ability: { arity: 1, kind: 'formula', signature: ['ability-name'] },
   ```
   Add it in the formula group. Add `'heal'` to `EFFECT_VOCABULARY` (after `'damage'`) and `'ability'` to `FORMULA_VOCABULARY`. Extend the header comment with a v1.7 paragraph.
3. `formula.ts`:
   - `FormulaCheckContext` gains `/** v1.7 — ability(name) is legal (effect fields only, DD-A4). */ readonly allowAbility?: boolean;`.
   - In `checkFormulaAst`'s `call` branch, after the `spec.kind !== 'formula'` guard and the arity check, add `if (name === 'ability') return checkAbilityCall(ast, ctx);`. That helper:
     - returns `E-FORM-02` when `!ctx.allowAbility`;
     - returns `E-FORM-02` when the argument is not `kind === 'name'`;
     - returns `E-FORM-03` with `nearestName(arg, ctx.abilities)` when the name is not in `ctx.abilities`.
   - `evalCall`: before `const scalars = …`, handle `ability`:
     ```ts
     if (ast.text === 'ability') {
       const name = ast.args?.[0]?.text ?? '';
       const value = ctx[`ability:${name}`];
       if (value === undefined)
         throw new Error(`ability("${name}") has no binding — effects bind ability:<name> (DD-A4); validate before evaluation (E-FORM-03)`);
       return value;
     }
     ```
4. `effect.ts` `checkEffect`: `const ctx: FormulaCheckContext = { abilities, saves, scalars: EFFECT_SCALARS, allowAbility: true };`.
5. `resolve.ts` `effectVars`: after the target-save loop, `for (const [name, value] of Object.entries(actor.abilities)) vars[`ability:${name}`] = value;`. `equipment.ts`: the same over `view.abilities`, inside the `vars` literal or right after it.
6. `cross.ts`: `ability: [0], // ability name (v1.7)`.
7. Tests. `tests/core/dsl/checker.test.ts`: the pin edits. `tests/core/dsl/ability.test.ts`:
   - (a) `packDslChecker` with kind `effect`: `heal(2 + ability(vigor))` → `[]`.
   - (b) kinds `formula`, `valid`, `passive`, `attackBonus` → `E-FORM-02`.
   - (c) `ability(vigr)` → `E-FORM-03` with hint `did you mean "vigor"?`.
   - (d) `ability(1)` and `ability(vigor, might)` → `E-FORM-02`.
   - (e) `evalFormula` reads `ability:vigor`, not `vigor`; a missing key throws.
   - (f) `executeAgainst` with an actor profile whose `abilities.vigor = 10` and `saves.vigor = 0`, effect `heal(2 + ability(vigor))` → a damage request with amount `-12`. With `heal(2 + vigor)` → `-2` (the shadowing stays).
   - (g) on an ally target whose ability differs: the actor's value is used.
   - (h) `validatePack(clonePack-with-ability-speed…, packDslChecker)`: a pack whose `stats.abilities` includes `speed`, with no `formulas.speed` and an item `use` of `heal(ability(speed))` → no `E-REF-01`. Build it from `tests/schema/fixtures.ts` `clonePack()`.

**Commit when:** `pnpm typecheck` = 0; `pnpm exec vitest run tests/core tests/schema tests/runtime` passes; `pnpm lint` = 0.

### Checkpoint 2 — Spell lists reach their spells

1. zombie-urban: `medic.spellLists` → `["medic"]`, `fixer.spellLists` → `["fixer"]`, `scavenger` unchanged (`[]`). wyldwood: `hedge-mage.spellLists` → `["hedge-mage"]`.
2. `tests/compiler/spell-lists.test.ts`, generating each theme at seed 42 through `../../src/compiler`:
   - (a) every class `spellLists` entry matches at least one spell's `magic.lists` in all three themes;
   - (b) every spell list is drawn by at least one class;
   - (c) `knownSpells` (from `../../src/runtime`): medic ⊇ {`bind-the-bite`, `clean-sear`}, fixer ⊇ {`quietsong`, `rot-read`}, scavenger = `[]`, hedge-mage ⊇ {`gloam-veil`, `wyrd-bloom`, `verge-light`, `briar-word`}.
3. `spells-journey.test.ts` l.249-250: fix the comment only.

**Commit when:** `pnpm exec vitest run tests/compiler tests/runtime/combat/character-profile.test.ts` passes (the l.339-349 non-caster pin still holds: the first class is `scavenger`, probe-confirmed at plan time); `pnpm build && pnpm exec vitest run tests/proofs` passes; `pnpm format:check` = 0.

### Checkpoint 3 — The med-kit reads the ability

1. `zombie-urban.json` l.259: `"use"` → the line from the envelope. Default: `"heal(2 + ability(vigor))"`.
2. `equipment-journey.test.ts`. Re-key the derived values with the default line and the level-1 scavenger (abilities all 10, vigor save 0, cap 27; plan-time probe, re-derive by running):
   - step 4: `amount: -12`, `hp: '23→27'`, rolls `['d0[]-12=-12']`, `Math.min(cap, cap - 4 + 12)`;
   - step 5: `amount -12`, `'26→27'`, `'d0[]-12=-12'`.
   - Add one assertion that discriminates: the profile's `saves.vigor` (0) ≠ `abilities.vigor` (10).
   - **If the human chose the modifier line** (heals 2 at vigor 10), the amounts stay; the discrimination lives in `ability.test.ts` (f). Record which line applies in the test's doc comment.
3. README: l.390 JSON line; l.430-433 prose ("heals 12: `ability(vigor)` reads the vigor ability, 10, not the same-named save"); the l.437-441 output lines, kept consistent with the test. Add one sentence to the effect-DSL / consumables prose describing `ability(name)`. No ```ts block.

**Commit when:** `pnpm build && pnpm test` passes whole-suite; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm check:isolation` and `pnpm check:security` = 0.

## Verification

- Commands: STATE.md Verification Baseline (`pnpm exec vitest run <path>`; `pnpm build` before a whole `pnpm test`).
- **CAP-A4 / CA-A3 proof:** `tests/core/dsl/ability.test.ts` (a)-(h), through the real checker (`packDslChecker`), the real executor (`executeAgainst`) and the real validator (`validatePack`). No doubles except hand-built profiles.
- **CAP-A5 proof:** `tests/proofs/equipment-journey.test.ts` steps 4-5. The real path is generated pack → `Runtime` → `useItem` and `startCombat` → `fight.use`. The snapshot step 6 (existing) proves restore unchanged.
- **CAP-A6:** `tests/core/dsl/checker.test.ts`.
- **CAP-A7 / CA-A4:** `tests/compiler/spell-lists.test.ts`.
- Whole-repo fast gates at ck3.

## State Update

Report in the handoff:
- the CA-A3 recheck, and any amended mapping;
- the landed symbols and commit SHAs;
- the vitest summary counts;
- the med-kit line used;
- every re-keyed pin (expected: `checker.test.ts` 14 → 15, `equipment-journey` steps 4-5, the `spells-journey` comment).

Note the carried content question for the Final Report: `bind-the-bite` (`damage(1d8 - vigor, mending)`) is now known by the medic. It deals damage, reduced by the **target's** vigor save. Owner: the human, a content-meaning decision.
