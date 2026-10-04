# SESSION-02 — The feat-slot column: mirror + validator, the cap on every path, theme content, journey

> **Program:** Ruleswright
> **Feature:** feat-progression
> **Modules:** M01, M03, M04
> **Depends on:** SESSION-01 (and Orchestrator's CA-F1…F3 recheck against its landed text)
> **Concurrent with:** —
> **Owns:** `src/schema/artifacts.ts`, `src/schema/validate/sections/progression.ts`, `src/runtime/feats.ts`, `src/runtime/progression.ts`, `src/runtime/snapshots.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `README.md`, `tests/schema/validate.test.ts`, `tests/runtime/feats.test.ts`, `tests/runtime/progression.test.ts`, `tests/snapshots/character.test.ts`, `tests/compiler/coverage-floor.test.ts`, `tests/proofs/feat-slots-journey.test.ts`
> **Reads:** `program/Ruleswright/specs/database.md` (v1.8, §progression *Feat slots*), `src/schema/contracts/pack.schema.json` (`classProgression.featSlots`), `program/Ruleswright/mocks/progression.html`, `src/schema/validate/helpers.ts`, `src/runtime/character.ts`, `src/runtime/errors.ts`, `src/runtime/runtime.ts`, `src/runtime/index.ts`, `src/compiler/stages/classes.ts`, `tests/schema/fixtures.ts`, `tests/runtime/fixtures/pack.ts`, `tests/runtime/fixtures/packs.ts`, `tests/proofs/self-target-journey.test.ts`, `tests/proofs/docs-run.test.ts`, `program/Ruleswright/prompts/feat-progression/STATE.md`
> **Resources:** —
> **Checkpoints:** 4

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M01 | Schema | `artifacts.ts` `ClassProgression` l.154-162; `validate/sections/progression.ts` `checkProgression` l.25-161 (`forbidUnknown` l.59, `slots` block l.135-160); `helpers.ts` `isPlainObject` l.31, `isInteger` l.35, `checkIntegerArray` l.342 | mirror + load checks |
| M03 | Runtime | `feats.ts` (all, 32 lines); `progression.ts` `validateBuild` l.50-141, `deriveProgression` l.175, `tableLevelCeiling` l.240, `awardXp` l.261-316, `levelSet` l.322-350; `snapshots.ts` `restoreCharacter` l.291, `restoreParty` l.300, `characterStateRefusals` l.317-327; `character.ts` `ClassEntry` l.57, `createCharacter` l.229-257; `errors.ts` `ruleCard` | the cap and every path |
| M04 | Compiler | `themes/*.json` `progression` (9 classes, all `saves` arrays have length 10); `stages/classes.ts` l.53 (verbatim copy) | content only |

## Context

S01 landed contract v1.8: `progression.<classId>.featSlots`, an optional per-class-level array of running totals. Read `database.md` §progression *Feat slots* and the schema property first. **Where the landed text and this prompt differ, the landed text wins, as amended into STATE.md's CA rows by Orchestrator.** Report any difference you find.

Today `learnFeat` (`feats.ts` l.14) refuses only `unknown-feat` and `feat-known`. This session makes feat slots real on **every** path that changes what a character holds or how many slots it has:
- learn;
- level-set;
- XP award;
- character and party restore.

It also gives the bundled themes slots and proves the whole path on generated packs.

**F-FP1 (do not fix):** `awardXp` can lower a class level that was set directly. A warden created at level 5 drops to level 1 after `awardXp(100)`; this was probed at plan time. Changing that is a human question (DD-F10). This session only makes `awardXp` refuse when the levels it would derive leave the held feats over the slots (DD-F6d).

## Capabilities

| CAP | Owned here | Checkpoint |
|---|---|---|
| CAP-F1 load-time `featSlots` | mirror + validator + tests | ck1 |
| CAP-F2 `learnFeat` cap | cap helper + refusal + tests | ck2 |
| CAP-F3 `levelSet` / `awardXp` refuse | `validateBuild` param, `awardXp` compute-then-apply + tests | ck2 |
| CAP-F4 restore refuses over-cap | `characterStateRefusals` + tests | ck2 |
| CAP-F5 bundled themes + journey (**the first narrow journey**) | content, floor, README, journey | ck3, ck4 |

## Contract Agreements

CA-F1 (field meaning), CA-F2 (refusal semantics) and CA-F3 (restore). Use the STATE.md mapping tables as amended after S01.

**Checkpoint-0 recheck (read-only; report any mismatch, do not originate premises):**
- `pack.schema.json` `classProgression.properties.featSlots` exists: `{type: array, minItems: 1, items: {type: integer, minimum: 0}}`, not in `required`.
- `database.md` contains the v1.8 *Feat slots* paragraph and Version Registry row 9.
- `grep -rn featSlots src tests` gives only the contract hit.
- `validateBuild` has exactly 3 parameters, and its only callers are `character.ts` l.233, `progression.ts` l.327 and `snapshots.ts` l.319.
- `cloneRuntimePack()` and `emberMarchesPack()` declare no `featSlots`, so the existing feat tests stay uncapped and unchanged.

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `src/schema/artifacts.ts` | modify | `ClassProgression.featSlots?: number[]` with a doc comment |
| `src/schema/validate/sections/progression.ts` | modify | `forbidUnknown` gains `'featSlots'`; integer/≥0, non-decreasing and coverage checks (E-SCHEMA-01); header comment |
| `src/runtime/feats.ts` | modify | `featSlotTally` + `featSlotsExceeded` (module exports, **not** on the barrel); `learnFeat` slot refusal; header comment |
| `src/runtime/progression.ts` | modify | `validateBuild(…, heldFeats = [])`; `levelSet` passes `character.feats`; `awardXp` compute-then-apply with refusal; header rule list |
| `src/runtime/snapshots.ts` | modify | `characterStateRefusals` passes `saved.feats` to `validateBuild` |
| `src/compiler/themes/{dark-fantasy,zombie-urban,wyldwood}.json` | modify | `featSlots: [1, 1, 2, 2, 2, 3, 3, 3, 4, 4]` on all 9 classes (DD-F8) |
| `README.md` | modify | Feats bullet (l.346-348) and v1-limits line (l.380-381). Prose or ```text only |
| `tests/schema/validate.test.ts` | modify | load cases |
| `tests/runtime/feats.test.ts` | modify | learn cap cases |
| `tests/runtime/progression.test.ts` | modify | levelSet/awardXp cases |
| `tests/snapshots/character.test.ts` | modify | restore cases |
| `tests/compiler/coverage-floor.test.ts` | modify | featSlots floor per theme |
| `tests/proofs/feat-slots-journey.test.ts` | create | CAP-F5 journey on generated packs |

`src/runtime/character.ts`, `runtime.ts`, `index.ts` and all compiler `.ts` files need **no** change. If you find one does, return `blocked` naming the path. Do not widen the lease.

## Implementation

### Checkpoint 1 — the pack can declare feat slots (CAP-F1)

1. `artifacts.ts` `ClassProgression`, after `slots`:
   ```ts
   /** v1.8 (FR-6) — feats the class grants in total at each class level (index 0 = level 1); summed across classes. Absent in a pack that declares any = 0; a pack declaring none has no cap. */
   featSlots?: number[];
   ```
2. `validate/sections/progression.ts`:
   - Add `'featSlots'` to the `forbidUnknown` list (l.59).
   - After the `slots` block:
   ```ts
   const featSlots = prog['featSlots'];
   if (featSlots !== undefined) {
     checkIntegerArray(ctx, featSlots, classId, `${basePath}.featSlots`, 'feat slot progression', 0);
     if (Array.isArray(featSlots) && featSlots.length > 0 && featSlots.every(isInteger)) {
       // non-decreasing (DD-F4): a level-up never removes a slot
       for (let i = 1; i < featSlots.length; i += 1)
         if (featSlots[i]! < featSlots[i - 1]!) add(ctx, makeErrorCard('E-SCHEMA-01', classId, `${basePath}.featSlots[${i}]`, `feat slots must not decrease from one level to the next (level ${i} → ${i + 1}).`));
       // coverage (DD-F4): every readable level reads a value
       if (isPlainObject(saves)) {
         const lengths = Object.values(saves).filter(Array.isArray).map((values) => values.length);
         const ceiling = lengths.length > 0 ? Math.min(...lengths) : 0;
         if (featSlots.length < ceiling) add(ctx, makeErrorCard('E-SCHEMA-01', classId, `${basePath}.featSlots`, `feat slots cover ${featSlots.length} level(s); the class's tables read ${ceiling} — declare a value for every level (FR-6).`));
       }
     }
   }
   ```
   - Import `isInteger` and `isPlainObject` from `../helpers` (`isPlainObject`, `isInteger` and `checkIntegerArray` are already imported, so check before adding).
   - Update the header comment to mention feat slots.
3. `tests/schema/validate.test.ts`, in the file's existing `errorsFor` style. Read `tests/schema/fixtures.ts` for the base pack and its classes' `saves` lengths:
   - A pack whose classes all declare valid `featSlots` gives **zero cards**.
   - A class with `featSlots` alongside one without it gives zero cards (DD-F3: opt-in per class).
   - A negative entry gives `E-SCHEMA-01` at `progression.<id>.featSlots[i]`.
   - A non-integer entry gives the same.
   - `[]` gives `E-SCHEMA-01` at `…featSlots`.
   - A decrease gives `E-SCHEMA-01` at `…featSlots[i]`, the index of the lower value.
   - An array shorter than the shortest `saves` array gives `E-SCHEMA-01` at `…featSlots`.
   - `featSlots` given as a string gives `E-SCHEMA-01`.

**Commit when:** `pnpm typecheck` is 0, and `pnpm exec vitest run tests/schema tests/compiler/coverage-floor.test.ts` is green. The themes do not declare slots yet, so the floor is unchanged.

### Checkpoint 2 — the cap on every path (CAP-F2, CAP-F3, CAP-F4)

1. `feats.ts`. It stays a leaf: it may import types from `./character` and `./runtime`, and values only from `./errors`.
   ```ts
   import type { ErrorCard } from '../schema/error-card';
   import type { CharacterState, ClassEntry } from './character';

   /** DD-F1…F3 — a character's feat slots (summed across classes), or undefined when the pack declares none (no cap). */
   export interface FeatSlotTally { readonly total: number; readonly hint: string }
   export function featSlotTally(runtime: Runtime, classes: readonly ClassEntry[]): FeatSlotTally | undefined {
     const tables = runtime.pack.progression;
     if (!Object.values(tables).some((table) => table.featSlots !== undefined)) return undefined;
     let total = 0;
     const parts: string[] = [];
     for (const entry of classes) {
       const slots = tables[entry.id]?.featSlots?.[entry.level - 1] ?? 0;
       total += slots;
       parts.push(`${entry.id} ${entry.level} → ${slots}`);
     }
     return { total, hint: `feat slots by class: ${parts.join(', ')}` };
   }
   /** DD-F6 — the one refusal card: `feat-slots-exceeded` at `feats`. */
   export function featSlotsExceeded(artifactId: string, held: number, tally: FeatSlotTally): ErrorCard {
     return ruleCard('feat-slots-exceeded', artifactId, 'feats', `holding ${held} feat(s) needs ${held} feat slot(s); the character's classes grant ${tally.total} (FR-6).`, tally.hint);
   }
   ```
   - In `learnFeat`, after the `feat-known` check: compute `featSlotTally(runtime, character.classes)`. When it is defined and `held + 1 > tally.total` (where `held = character.feats?.length ?? 0`), throw `new RuntimeRuleError([featSlotsExceeded(featId, held + 1, tally)])`. Nothing changes and no event is emitted.
   - Rewrite the header comment: v1.8 caps learning by feat slots when the pack declares them.
   - **Do not add these to `src/runtime/index.ts`** (DD-F7).
2. `progression.ts`:
   - `validateBuild(runtime, race, entries, heldFeats: readonly string[] = [])`. After the per-class loop, when `cards.length === 0 && heldFeats.length > 0`: compute `featSlotTally(runtime, entries)`. If it is defined and `heldFeats.length > tally.total`, push `featSlotsExceeded('(character)', heldFeats.length, tally)`. Update the JSDoc.
   - `levelSet`: `validateBuild(runtime, character.race, entries, character.feats)`.
   - `awardXp`: restructure to **compute, check, then apply**:
     - (i) the `invalid-xp` check, unchanged;
     - (ii) compute `shares`, each class's new `classXp` and its `computed` level into locals, with no mutation;
     - (iii) `const tally = featSlotTally(runtime, nextEntries)`. If it is defined and `(character.feats?.length ?? 0) > tally.total`, throw `new CharacterBuildError([featSlotsExceeded('(character)', held, tally)])`;
     - (iv) apply exactly as today: `character.xp += amount`, `classXp`, `entry.level`, `applyProgression`, then the events. Event order and payloads must be **byte-identical** to today. `tests/runtime/progression.test.ts` pins them; leave those assertions untouched.
   - Header comment: add `feat-slots-exceeded` to the rule list (l.20-22) and one line on feat slots.
   - The new value import `./feats` → `progression.ts` is intra-module. `feats.ts` imports nothing back, so there is no cycle.
3. `snapshots.ts` `characterStateRefusals` (l.317): pass `saved.feats ?? []` as `validateBuild`'s 4th argument. Change nothing else. `featRefusals` (unknown id, `E-SNAP-01`) stays.
4. Tests. Make slotted variants by copying a fixture and adding `featSlots` to its `progression` entries. Never edit the fixture files, which are outside the lease.
   - **`tests/runtime/feats.test.ts`** (new `describe('feat slots (v1.8, CAP-F2)')`):
     - Warden `featSlots [1, 2]`: a level-1 warden learns one feat; the second is refused with `{rule: 'feat-slots-exceeded', artifactId: <featId>, jsonPath: 'feats'}`, `feats` is unchanged and no event is added.
     - At warden level 2, the second learn succeeds.
     - Multi-class warden 1 + hexer 1 with hexer `[1, 1]`: two learns succeed and the third is refused (slots sum, DD-F2).
     - In a slotted pack where hexer omits `featSlots`, a hexer-only character's first learn is refused (contributes 0, DD-F3).
     - The existing unslotted tests stay as they are; they prove "no cap".
     - The refusal's `hint` names each class's contribution.
   - **`tests/runtime/progression.test.ts`** (new `describe('feat slots on level changes (v1.8, CAP-F3)')`):
     - A level-2 warden holding 2 feats (`featSlots [1, 2]`): `levelSet` to level 1 throws a CharacterBuildError whose rules include `feat-slots-exceeded`. Level stays 2, saves and slots are unchanged, and no event is emitted.
     - `levelSet` to level 2 → 2 (same) succeeds.
     - **awardXp guard (F-FP1 path):** the same character (warden 2 set directly, `classXp` 0) gets `awardXp(100)`, which would derive level 1. It throws a CharacterBuildError `feat-slots-exceeded`; `xp`, `classXp` and levels are unchanged, and no `xp:awarded` is emitted.
     - A character within its cap still levels by XP, with the same events as before.
   - **`tests/snapshots/character.test.ts`** (new `describe('feat-slot restore (v1.8, CAP-F4)')`):
     - In a slotted pack, a 1-slot warden's snapshot round-trips byte-exact (serialize → JSON → restore → serialize).
     - The same snapshot with a second **declared** feat appended to `state.feats` (the hash covers the pack, not the snapshot) is refused. The cards are exactly `[['feat-slots-exceeded', 'feats']]`, and `target.nextCharacterId` is unchanged.
     - Appending an unknown and a declared feat gives both the `feat-slots-exceeded` card and the `E-SNAP-01` card.
     - `restoreParty` with one over-cap member refuses the party, and nothing is minted.

**Commit when:** `pnpm typecheck` is 0; `pnpm lint` is 0; `pnpm exec vitest run tests/runtime tests/snapshots tests/schema tests/proofs/rules-are-data.test.ts` is green.

### Checkpoint 3 — the bundled themes declare feat slots; floor; README (CAP-F5 content)

1. In each of the 9 `progression.<classId>` entries (dark-fantasy `warden`, `hexer`, `crypt-warden`; zombie-urban `scavenger`, `fixer`, `medic`; wyldwood `warden`, `hexer`, `hedge-mage`), add `"featSlots": [1, 1, 2, 2, 2, 3, 3, 3, 4, 4]` after `saves`/`slots` (DD-F8; levels 1–5 = `progression.html` warden column). Then run `pnpm exec prettier --write` on the three files.
2. `tests/compiler/coverage-floor.test.ts`: one new `it` per pack inside the existing `for (const { name, pack } of PACKS)` floor loop. Use the l.243 test's `playerClasses` filter. For every player class:
   - `prog.featSlots` is defined;
   - its length is ≥ the class ceiling;
   - `featSlots[0] >= 1`;
   - it is non-decreasing;
   - and `validatePack(pack, packDslChecker)` stays `[]`, which the existing dogfood test already asserts.
3. `README.md`:
   - **Feats bullet (l.346-348):** add "**Feat slots.** A pack's progression may declare `featSlots` per class per level; a character's slots add across its classes, and `learnFeat`, `levelSet`, `awardXp` and snapshot restore refuse a character holding more feats than its slots (`feat-slots-exceeded`). The sample themes grant 1 feat at level 1, 2 at level 3, 3 at level 6 and 4 at level 9." Keep the words `learnFeat`, `unknown-feat` and `feat-known`.
   - **l.380-381:** replace "v1 limits: there is no feat-slot cap (a character may learn any number of feats)." with a sentence saying that the cap is pack data, and that a pack that declares no `featSlots` is uncapped.
   - **Do not add a ```ts block.** `docs-run.test.ts` l.49 pins exactly 4. Do not remove `learnFeat` (l.234 pin).
4. **Doc-pin re-grep:** `grep -rni "feat-slot\|feat slot\|no feat" README.md src tests` should give no stale "no cap" statement anywhere in the lease. Report any hit outside the lease as a surprise.

**Commit when:** `pnpm exec vitest run tests/compiler tests/proofs/docs-run.test.ts tests/proofs/spells-journey.test.ts tests/proofs/self-target-journey.test.ts` is green (run `pnpm build` first: `spells-journey.test.ts` reads `dist/`), and `pnpm format:check` is 0.

### Checkpoint 4 — the journey on generated packs (CAP-F5)

Create `tests/proofs/feat-slots-journey.test.ts`. Import from `src/` the way `self-target-journey.test.ts` does (`generateCampaign`, `loadTheme`, `Runtime`, `serializeCharacter`, `restoreCharacter`, `restoreParty`, `CharacterBuildError`, `RuntimeRuleError`). Use seed 42 and a fresh `Runtime` per leg. There are no doubles. Header comment: CAP-F5, DD-F1…F8, CA-F1…F3.

Legs, on dark-fantasy unless stated:
1. **Load:** `generateCampaign` succeeds (its stage 8 is `validatePack`). Every class in `pack.progression` that is in `content.classes` carries `featSlots`.
2. **Learn:** a warden at level 1 (race `ashkin`, which has no caps) learns `ironhide`. `steady-hands` is then refused `feat-slots-exceeded`, `feats` equals `['ironhide']`, and `runtime.events.sinceRound(0)` has the same length as before the refusal.
3. **Level up:** `rt.levelSet(c, [{id: 'warden', level: 3}])` succeeds, and `steady-hands` now learns (2 slots).
4. **Level down refused:** `rt.levelSet(c, [{id: 'warden', level: 1}])` throws a CharacterBuildError with `feat-slots-exceeded`, and the level stays 3.
5. **XP guard (F-FP1):** `rt.awardXp(c, 100)` would derive level 1, so it throws `feat-slots-exceeded`, and `c.state.xp` stays 0.
6. **Multi-class:** a `hillfolk` warden 1 + hexer 1 learns 2 feats, and the third is refused.
7. **Snapshot:** `serializeCharacter` → `JSON.stringify` → `JSON.parse` → `restoreCharacter` on a fresh runtime of the same generated pack restores `feats` in order. The same JSON with a third declared feat appended is refused `feat-slots-exceeded`, with `nextCharacterId` unchanged. Party: one over-cap member refuses `restoreParty`.
8. **The other themes:** for zombie-urban and wyldwood, every class at level 1 learns exactly one of the theme's feats, and the second is refused.
9. **Unslotted control:** delete `featSlots` from every `progression` entry of a generated dark-fantasy pack. A level-1 warden then learns all 4 feats. This is the v1.7 behaviour: no cap without the data.

**Negative control (report it; do not commit it):** with `learnFeat`'s new check commented out, legs 2, 6 and 8 fail. Restore the check before committing.

**Commit when:**
- `pnpm build && pnpm test` is green: 49 files. Report the total; do not pin it.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm check:isolation` and `pnpm check:security` all exit 0.

## Verification

- **Gates (Verification Baseline, STATE.md):** lease-scoped `pnpm exec vitest run <paths>` at ck1–ck3. At ck4: `pnpm build && pnpm test`, then `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm check:isolation`, `pnpm check:security`. The baseline is 48 files, 878/878 at `2e69863`.
- **CA-F1 proof:**
  - `tests/schema/validate.test.ts`: the new cases (ck1);
  - `tests/compiler/coverage-floor.test.ts`: the featSlots floor (ck3);
  - journey leg 1.
- **CA-F2 proof:**
  - `tests/runtime/feats.test.ts`: slot cases;
  - `tests/runtime/progression.test.ts`: levelSet/awardXp cases (ck2);
  - journey legs 2–6 and 8.
- **CA-F3 proof:**
  - `tests/snapshots/character.test.ts`: restore cases (ck2);
  - journey leg 7.
- **Production path:** the journey goes through the real compiler, `validatePack` and the public runtime methods. Nothing is mocked; seed 42 is the only fixed input. There is no I/O, transport or port; the "restart" boundary is snapshot JSON → fresh `Runtime` → restore.
- **Architecture compliance:**
  - `feats.ts` stays a leaf (value imports: `./errors` only).
  - The new edge `progression.ts → feats.ts` is intra-M03.
  - No barrel change (DD-F7).
  - M01 still imports nothing internal.
  - No compiler `.ts` changes.

## State Update

Report in the handoff:
- **Commits:** the SHA of each checkpoint.
- **CA rechecks:** the result of the checkpoint-0 recheck, and any landed-contract delta, by CA id.
- **Gates:** the actual results with counts. Name any gate you did not run.
- **Negative control:** its result.
- **Doc pins:** the doc-pin re-grep result, including any hit outside the lease (owner: Orchestrator).
- **arch fragment:**
  - the `featSlotTally` / `featSlotsExceeded` module exports;
  - the `validateBuild` 4th parameter;
  - the `awardXp` compute-then-apply order;
  - the new intra-M03 edge `progression → feats`.
- **Carried items:**
  - F-FP1, unchanged and human-owned;
  - F-FP2, the `features` doc row, owner DB.
