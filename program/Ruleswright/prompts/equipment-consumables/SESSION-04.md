# SESSION-04 — Themes: equipSlots pass-through + armor, weapons, consumables, gear formulas in all three packs

> **Program:** Ruleswright
> **Feature:** equipment-consumables
> **Modules:** M04
> **Depends on:** SESSION-02 (the mirror types; `gear-*` admission in `formulas`; unbound `gear-*` evaluates to 0)
> **Concurrent with:** SESSION-03. The leases are disjoint, verified path by path: this session writes only `src/compiler/theme.ts`, `src/compiler/pipeline.ts`, `src/compiler/themes/{dark-fantasy,zombie-urban,wyldwood}.json`, `tests/compiler/pipeline.test.ts` and `tests/compiler/coverage-floor.test.ts`. S03 writes only `src/runtime/{equipment,character,pools,inventory,runtime,index}.ts`, `tests/runtime/fixtures/**` and four `tests/runtime/*.test.ts` files. There is zero intersection.
> **Owns:** `src/compiler/theme.ts`, `src/compiler/pipeline.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `tests/compiler/pipeline.test.ts`, `tests/compiler/coverage-floor.test.ts`
> **Reads:** `src/schema/artifacts.ts`, `src/schema/pack.ts`, `src/core/dsl/formula.ts`, `src/core/dsl/registry.ts`, `src/compiler/theme-loader.ts`, `src/compiler/stages/tables.ts`, `tests/compiler/themes.test.ts`, `tests/compiler/stages.test.ts`, `tests/proofs/docs-run.test.ts`, `README.md`
> **Resources:** —
> **Checkpoints:** 4

## Module Context
| ID | Module | Read | Why |
|---|---|---|---|
| M04 | Compiler | write | The theme type, the pipeline's root pass-through, and the three theme templates. Stage 7 carries items verbatim and stage 8 validates |

## Context

The themes prove the format (FR-21): each new capability ships as the smallest content that exercises it at least once. You author coined content (Q7/Q8: no SRD names, "d20" never in a title).

**The pipeline must change (F-E3):**
- `runPipeline` (`pipeline.ts:140-150`) copies only `formulas` and `spatial` from the theme root into the pack.
- `ThemeTemplate` (`theme.ts:45-66`) has no `equipSlots`.
- The theme JSON is cast `as unknown as ThemeTemplate` (`theme-loader.ts:13-19`), so the omission raises no type error.

Without a pass-through, generated packs carry items with `slots` but no `equipSlots`, and stage 8 rejects them (E-REF-01). The grid-combat spatial pass-through is the exact precedent (`pipeline.ts:145-150`, `tests/compiler/pipeline.test.ts:340-357`).

**Grant semantics (F-E2 option (b)):**
- Reserved grants (`ac`, `hp`, `initiative`) reach a stat only through the theme's own formula referencing `gear-ac` / `gear-hp` / `gear-initiative`.
- All three themes use **descending AC**: the attack tables are keyed low-defense-hardest, e.g. dark-fantasy warden `byDefense {"2":20 … "10":12}`, and `ac` falls with level. So armor must **lower** AC: `ac = <base> - gear-ac`.
- Ability grants (`might`) add to the ability directly; no formula edit is needed.
- With nothing equipped, every `gear-*` is 0, so every formula evaluates exactly as today. docs-run block-03 (`hp: 27, ac: 12`, README:64) and every existing value pin stay unchanged.
- No test pins a theme formula string (grep at plan HEAD: `tests/**` has no `12 - floor(level / 3)` or `6 + level + vigor * 2`).
- The kebab lexing rule (`shared.ts:8-10`) needs spaces around `-` before `gear-ac`.

**Pins (F-E6):**
- `tests/compiler/themes.test.ts:74` pins wyldwood at **6** items, and you do not own it. So wyldwood gains **no new item**: extend the existing `hedge-charm`, which is already `kind: "charm"`, sits in `wyrd-charms`, and is asserted by `coverage-floor.test.ts:307`.
- `themes.test.ts:72` and `stages.test.ts:354` compare items verbatim against the theme file, so the new fields ride through.
- Loot tables are unchanged, so loot seeds are unchanged.

## Capabilities

- **CAP-E6:** all three themes exercise equipment, consumables and gear formulas; generated packs validate with zero cards; the coverage floor stays green; `equipSlots` reaches the pack. Integration: ck4.

## Contract Agreements

- **CA-EG1 consumer leg:** your content is the first real consumer of the S01/S02 field set. If stage 8 rejects a field you declare per CA-EG1, that is a **producer defect**: stop and report. Do not reshape content to dodge a validator bug.
- **CA-EG2 consumer leg:** the theme formulas reference the `gear-*` variables in the descending direction.
- **CA-EG3 consumer leg:**
  - **Legal pairing (dark-fantasy):** warden `armorCasting: ["mail"]` with `warded-mail` changed to `kind: "mail"`.
  - **Blocked pairing (dark-fantasy):** hexer `armorCasting: ["leather"]` with `warded-mail`.
  - **wyldwood charm armor** is content-only coverage. wyldwood casting is point-pool only (no slot progression), so the armorCasting gate is never reached there (DD-EG5 scope). Do not claim a runtime proof for it.

## Content plan (DD-EG8, corrected per F-E7)

**dark-fantasy** (vancian showcase; the only theme with slot casting):
- Root `equipSlots: ["body", "main-hand"]`, placed after `spatial`.
- `warded-mail` (exists, line ~448): **change `kind` from `"armor"` to `"mail"`** (explicit kind change; it makes the warden pairing legal). Add `"slots": ["body"]` and `"grants": {"ac": 2, "armor": 1}`. It stays in `warded-gear` (line ~654).
- `oaken-cudgel` (**exists**; extend, do not add): add `"slots": ["main-hand"]` and `"grants": {"might": 1}`.
- Formulas:
  - `hp`: `"6 + level + vigor * 2 + gear-hp"`
  - `ac`: `"12 - floor(level / 3) - gear-ac"`
  - `initiative`: `"d20 + grace + gear-initiative"`

**zombie-urban** (drain/table showcase):
- Root `equipSlots: ["body", "main-hand"]`, placed after `spatial`.
- `riot-plate` (**exists**, `kind: "armor"`; reuse, add no duplicate): add `"slots": ["body"]` and `"grants": {"ac": 1, "armor": 1}`.
- `fire-axe` (**exists**, `kind: "weapon"`; reuse): add `"slots": ["main-hand"]` and `"grants": {"might": 1}`.
- `med-kit` (line 233; in the `street-remnants` table at line 372, which is **not** a `-loot` table): add `"use": "heal(2 + vigor)"`. `vigor` is a declared ability.
- Formulas:
  - `hp`: `"6 + level + vigor * 2 + gear-hp"`
  - `ac`: `"11 - floor(level / 3) - gear-ac"`
  - `initiative`: `"d20 + grace + gear-initiative"`

**wyldwood** (loot showcase):
- Root `equipSlots: ["charm"]`, placed after `spatial`.
- `hedge-charm` (line ~547, exists): add `"slots": ["charm"]` and `"grants": {"ac": 1, "armor": 1}`. The item count stays 6.
- Formulas:
  - `hp`: `"6 + level + vigor * 2 + gear-hp"`
  - `ac`: `"12 - floor(level / 3) - gear-ac"`
  - `initiative`: `"d20 + grace + gear-initiative"`
- Keep the existing multi-line JSON layout.

**`scrap-plate` and `rebar-club` are not created**; the earlier plan text that named them is withdrawn.

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `src/compiler/theme.ts` | modify | `ThemeTemplate` gains `equipSlots?: readonly string[]` after `spatial?` (docstring: v1.4, section-keyed like the pack, no renaming) |
| `src/compiler/pipeline.ts` | modify | `STAGE_INPUT_SECTIONS` (`:52`) gains `'equipSlots'` after `'spatial'` (knob tokens resolve uniformly); after the spatial block (`:148-150`): `if (themeView.equipSlots !== undefined) pack['equipSlots'] = structuredClone(themeView.equipSlots);`. Absent means no key |
| `tests/compiler/pipeline.test.ts` | modify | a new `describe` after the spatial pass-through (`:340`): a theme with `equipSlots` → `pack.equipSlots` deep-equals it; a theme without it → no `equipSlots` key; the theme object is not mutated |
| `src/compiler/themes/dark-fantasy.json` | modify | per the content plan |
| `src/compiler/themes/zombie-urban.json` | modify | per the content plan |
| `src/compiler/themes/wyldwood.json` | modify | per the content plan |
| `tests/compiler/coverage-floor.test.ts` | modify | per theme: `pack.equipSlots` is non-empty; ≥1 item with `grants` including `armor`; ≥1 item with an ability grant (dark-fantasy, zombie-urban); zombie-urban ≥1 item with `use`; each `ac` formula references `gear-ac`. **Re-key no existing count** (the id pool at `:194` absorbs ids generically, and no ids are added anyway) |

## Implementation

### Checkpoint 1 — equipSlots pass-through
Make the `theme.ts` and `pipeline.ts` changes and write the pipeline test.

**Commit when:** `pnpm typecheck` is 0; `pnpm exec vitest run tests/compiler/` is green; the commit covers `theme.ts`, `pipeline.ts` and `pipeline.test.ts`.

### Checkpoint 2 — dark-fantasy
Edit the theme.

**Commit when:**
- `pnpm exec vitest run tests/compiler/ tests/proofs/docs-run.test.ts tests/proofs/grid-journey.test.ts` is green. Both proofs import from `src/`, so they see your theme. docs-run block-03 must still print `ac: 12` / `hp: 27`.
- Stage 8 shows zero cards for dark-fantasy.
- The commit covers the theme file only.

### Checkpoint 3 — zombie-urban
Edit the theme with the same discipline.

**Commit when:** the same gates are green; the commit covers the theme file only.

### Checkpoint 4 — wyldwood + floor close
Extend `hedge-charm` and update the formulas. Add the coverage-floor assertions. Byte-identity discipline: same theme + seed ⇒ byte-identical pack. The determinism proofs already assert this; grants are plain integers.

**Commit when:**
- `pnpm exec vitest run tests/compiler/ tests/proofs/docs-run.test.ts tests/proofs/grid-journey.test.ts` is fully green, including `themes.test.ts:74` still at 6;
- all three themes and the floor test are committed.

Report the stage-8 zero-card result ×3.

## Verification

- `pnpm exec vitest run tests/compiler/ tests/proofs/docs-run.test.ts tests/proofs/grid-journey.test.ts` (DD14e form).
- **Do not run `pnpm build`.** S03 edits `src/runtime/**` in the same working tree concurrently. `tests/proofs/loot-journey.test.ts` imports `dist/`, so it is stale until Orchestrator's receive build; it is not your evidence.
- **Shared-tree hazard (e), both directions (R-6).**
  - **Into your gates:** your proofs (`docs-run`, `grid-journey`) import `src/runtime/**`, which S03 edits concurrently. A red you trace to `src/runtime/**` or `tests/runtime/**` is **reported, not fixed**: re-run once S03's checkpoint commit lands (`git log --oneline -- src/runtime`), and name it in the handoff if it persists.
  - **Out of your edits:** S03's gates run `tests/runtime/combat/{combat,character-profile}.test.ts`, which generate packs from your theme files. Keep each theme edit a single complete write that you validate (stage 8, zero cards) before moving on, so a half-edited theme is on disk for as short a time as possible. S03 reports such a red to Orchestrator; it does not fix it.
  - Never edit S03's files, and do not weaken or skip a test to get green.
- Coined-content audit: no new ids; the ids used already exist in the tree.
- CA-EG1 consumer assertion: every field you declare exists in S02's mirror under the same name.
- No existing count is re-keyed; `themes.test.ts` is untouched.

## State Update

Report the per-theme items landed (ids, slots, grants, `use`), the formula strings as committed, stage-8 results, floor status, and pipeline pass-through proof.

The handoff names S05/S06's exact facts:
- zombie-urban `riot-plate` `{ac:1, armor:1}` in `body`;
- `fire-axe` `{might:1}` in `main-hand`;
- `med-kit` `heal(2 + vigor)`;
- dark-fantasy `warded-mail` kind `mail` `{ac:2, armor:1}`;
- warden/hexer `armorCasting`.
