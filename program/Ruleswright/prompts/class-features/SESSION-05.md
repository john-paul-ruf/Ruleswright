# SESSION-05 — Author re-entry (Designer): `progression.html` F-R6 fix + class-features panel

> **Program:** Ruleswright
> **Feature:** class-features
> **Modules:** — (Author artifact: Designer)
> **Depends on:** S01 (v1.10 rules), S03 (landed bundled features)
> **Concurrent with:** S04 (lease disjoint), S02 (lease disjoint)
> **Owns:** `program/Ruleswright/mocks/progression.html`
> **Reads:** `program/Ruleswright/specs/design.md` (surface 06, visual language), `program/Ruleswright/specs/database.md` (v1.10 *Class features*), `src/compiler/themes/dark-fantasy.json` (`progression.warden`, `progression.crypt-warden` as S03 landed them), `program/Ruleswright/mocks/{magic,conditions}.html` (panel and callout patterns), `program/Ruleswright/prompts/class-features/STATE.md`
> **Resources:** —
> **Checkpoints:** 2

**Role.** This is an **Author re-entry** session for the Designer role, not a Coder session. You edit one existing mock. No `src/`, `tests/` or README change.

**Authorization (quote it; do not re-litigate it).** On 2026-10-04 Planner asked (Q5) whether the same run should also fix `mocks/progression.html:70-80` (F-R6). The human answered "**5 you have my auth for whatever you need**" (STATE.md *Human answers on record*). That covers both:
- **design-change** on the existing earned-path example, which is false under v1.9;
- the **class-features panel**: FR-6's last surface item, now that v1.10 defines it.

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| — | Designer | `progression.html` l.36-61 (leveling-table section), l.64-87 (two-paths section; F-R6 at l.70-80, the callout at l.82-85), l.90-114 (multi-class), l.117-128 (callouts) | edit sites; keep the visual language |
| — | DB | `database.md` *Class features (v1.10)* | the rules the panel states |

## Context

**F-R6 (builder-rulings).** The two-paths section creates Brynn at warden **level 4** and then shows `rt.awardXp(brynn, 2400)` → `level:reached warden 4`. Under v1.9, `awardXp` never lowers a level, so no `level:reached` fires for a level-4 Brynn.

The number is also wrong. **Planner probe** (`f36d4ae`, bundled dark-fantasy, seed 42):
- a level-1 warden given 2400 XP reaches level **2**;
- `levelForXp` gives 4000 → 3 and **6000 → 4**;
- `awardXp(level-1 warden, 6000)` emits `xp:awarded {amount: 6000, total: 6000, classXp: {warden: 6000}}` then `level:reached {classId: 'warden', level: 4}`.

The callout at l.82-85 also says the two paths produce "byte-identical state". That is false: the earned character carries `xp: 6000`, while the direct one carries 0. What FR-6 asks for is that both paths **validate identically**.

**Class features (v1.10)** are the last FR-6 table item and have no surface yet.

## Capabilities

CAP-C7, the Designer part. It integrates nothing.

## Contract Agreements

The panel restates CA-C1/CA-C3/CA-C4 meanings. Quote `database.md` v1.10 meanings exactly; do not invent behaviour.

**Checkpoint-0 recheck (read-only):**
- `sed -n 70,80p program/Ruleswright/mocks/progression.html` shows `level: <span class="num">4</span>` and `rt.awardXp(brynn, <span class="num">2400</span>)`.
- dark-fantasy `progression.crypt-warden.features` contains `barrow-rite` @2 and `crypt-vigil` @3, and `progression.warden.features` contains `oath-of-the-warden` @1 and `wardens-resolve` @3.

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `program/Ruleswright/mocks/progression.html` | modify | ck1: two-paths section and callout corrected. ck2: new "Class features" section after the leveling table |

## Implementation

### Checkpoint 1 — F-R6: the two-paths example is true again

- **Left panel:** unchanged (Brynn, warden level 4, direct level-set).
- **Right panel:** a separate character. `const ald = rt.createCharacter({ name: "Ald", race: "hillfolk", classes: [{ id: "warden", level: 1 }] });` then `rt.awardXp(ald, 6000);` with the comments:
  - `// → event: xp:awarded  why: host.grant`
  - `// → event: level:reached  warden 4 (pack thresholds)`
  - `// engine emits; it never decides awards (FR-6, FR-13)`

  Keep the existing span classes (`kw`, `str`, `num`, `com`).
- **Optional note** in the same panel's style: `// an award never lowers a level set directly (v1.9)`.
- **Callout (l.82-85):** "Both paths run the same build validator — a level-4 direct set and a level-4 earned set are judged by identical rules (FR-5, FR-6); only the XP bookkeeping differs."

**Commit when:** `git diff --name-only` = `progression.html`; the HTML is well-formed (every tag you opened is closed; diff reviewed). Message: `class-features SESSION-05: checkpoint 1 — F-R6 earned path`.

### Checkpoint 2 — the class-features panel

Add a new `<section class="mb-12">` after the leveling-table section, using the same component classes.
- **Heading:** "Class features are table rows too".
- **Lede:** "A class feature names a feat, an action or a spell, at a class level. The pack decides; the engine only checks the level (FR-6)."
- **Code panel** (header `progression.crypt-warden.features — sample pack, excerpt`) showing the landed JSON verbatim from dark-fantasy. Copy it from the theme file; do not retype it from this prompt.
- **A three-row table** of kinds:
  - feat → granted from that level: no feat slot, never stored, offered in combat if reactive;
  - action → declarable in combat from that level;
  - spell → known from that level.
- **Two callouts** in the existing ✓ / ◈ style:
  - "Granted is not learned — `learnFeat` refuses a feat your class grants (`feat-known`)";
  - "`classFeatures(rt, character)` lists every feature with its kind and whether it is active".

**Commit when:** the section is present; every id it shows exists in the landed theme (`grep` each); the diff touches only `progression.html`. Message: `class-features SESSION-05: checkpoint 2 — class-features panel`.

## Verification

- `git diff --name-only <dispatch base>..HEAD` = `program/Ruleswright/mocks/progression.html`.
- Each code sample is checked against source: the awardXp numbers against the Planner probe above, and the features excerpt against `src/compiler/themes/dark-fantasy.json`.
- No code gate applies (H8). Orchestrator runs V1–V3 at receive.

## State Update

Report:
- the before/after of l.70-85;
- the inserted section's ids;
- the commit SHAs.

The final Archivist records F-R6 as closed.
