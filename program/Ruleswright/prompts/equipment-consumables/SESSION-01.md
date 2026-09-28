# SESSION-01 — Contract gate: schema v1.4 — equipment, slots, consumables, heal, snapshot fields

> **Program:** Ruleswright
> **Feature:** equipment-consumables
> **Modules:** M01 (DB-owned contracts only)
> **Depends on:** —
> **Concurrent with:** —
> **Owns:** `src/schema/contracts/pack.schema.json`, `src/schema/contracts/snapshots.schema.json`, `program/Ruleswright/specs/database.md`
> **Reads:** `program/Ruleswright/specs/requirements.md`, `program/Ruleswright/specs/design.md`, `src/schema/artifacts.ts`, `src/schema/pack.ts`, `src/schema/validate/sections/content.ts`, `src/schema/validate/sections/root.ts`, `src/core/dsl/registry.ts`, `src/core/dsl/effect.ts`, `src/core/dsl/formula.ts`, `src/core/dsl/shared.ts`, `src/runtime/snapshots.ts`, `src/runtime/combat/combat.ts`
> **Resources:** —
> **Checkpoints:** 3

**Role note:** this is an **Author re-entry session (schema-change class, DB role)**, following the grid-combat SESSION-01 precedent. Dispatch the DB role prompt (DB.md plus a tailored Author envelope), not CODER.md. Commit subjects keep the `equipment-consumables SESSION-01:` prefix for log consistency. The DB role's verification set is its own role-scoped evidence: JSON validity of both revised contracts plus database.md consistency. Whole-repo fast gates at receive are Orchestrator's (promoted convention).

## Module Context
| ID | Module | Read | Why |
|---|---|---|---|
| M01 | Schema surface | yes | The two contract files this session revises; the TS mirror that must follow (read to keep the contract mirror-implementable) |

## Context

The pack contract (v1.3) has `content.items` as `{name, kind?}`, which is inert data. Two approved requirements are still unrealized because the pack cannot express them:
- **FR-3:** derived-stat formulas must read "abilities, class, level, **and equipment**". Today `reserveValue` evaluates over `{...abilities, level}` only, and no equipment input exists.
- **FR-9:** `armorCasting` is declared on classes but has no runtime teeth.

The builder has decided this run also ships **slot-based equipment and consumables**.

You (DB role) extend the normative contract to v1.4 across **both** contract files:
- **`pack.schema.json`:** the item fields and `equipSlots`.
- **`snapshots.schema.json`:** the new character and combatant fields. Both `$defs/characterState` and the per-combatant item of `$defs/combatSnapshot` are `additionalProperties:false` at plan HEAD, so the runtime cannot emit a new field until the contract admits it.

Everything is additive-optional:
- no field is removed or renamed;
- `schemaVersion` stays `const 1`;
- snapshotVersion stays 1;
- no rule id is added.

This matches the v1.1–v1.3 registry discipline verbatim.

**The approved design (STATE.md DD-EG1..EG7; grant semantics per Orchestrator decision F-E2 option (b), recorded in `.program/decisions.md`):**

- **Slots:**
  - Optional top-level `equipSlots: string[]`: ≥1 entry, unique, kebab ids. This is the pack's declared slot vocabulary.
  - Slot ids are their own vocabulary, like economy slot names. They are **not** artifact ids and do not enter the global-uniqueness namespace.
  - `ItemDef.slots: string[]` (≥1 when present) lists the declared slots the item **may be equipped into**. One equip places the item in exactly one of them.
  - Each id must resolve in `equipSlots` (E-REF-01).
- **Grants (option (b); the engine never hard-codes a stat's direction):** `ItemDef.grants: object` maps grant key → integer. No dice (FR-1 determinism). The keys are:
  - **An ability id or a save id.** While the item is equipped, the value is **added** to that stat (never a replacement). A key naming both an ability and a save (e.g. `vigor` in all three themes) adds to both.
  - **A reserved key** `hp`, `ac`, `initiative` or `armor`. Its sum over every equipped item is exposed to the pack's `formulas` entries as the variable `gear-hp`, `gear-ac`, `gear-initiative` or `gear-armor`:
    - with nothing equipped, each variable is `0`;
    - the pack's formula decides what the value does. An ascending-AC pack writes `10 + gear-ac`; a descending-AC pack writes `12 - floor(level / 3) - gear-ac` (Q2: descending AC stays expressible);
    - the engine adds nothing on its own;
    - the variables are legal only inside the `formulas` section; every other DSL field keeps its current vocabulary.
  - **The armor marker.** `armor` also marks the item as armor (CA-EG3): an item is armor iff its `grants` include the key `armor`, with integer value ≥ 1.
- **Reserved names:** `stats.abilities` and `stats.saves` ids must not equal `gear-hp`, `gear-ac`, `gear-initiative` or `gear-armor` (E-SCHEMA-01). Otherwise a formula name would be ambiguous.
- **Consumables:** `ItemDef.use: DslString` is an effect-DSL string, in the same grammar actions and spells use. Its presence marks the item consumable. One use consumes one unit.
- **Heal:** the frozen effect registry grows 12 → 13 with `heal`: arity 1, kind `effect`, signature `['formula']`.
  - It executes as a negative-amount damage mutation. `resolve.ts`'s `MutationRequest.amount` already documents "the executor's honest total, positive or negative".
  - It clamps at the target's max hp:
    - character side: the derived `hp` with grants;
    - combat: the combatant's `maxHp`.
  - Record the registry growth in the v1.4 registry note: extension = schema event (CA-2/NFR-Security), and this is that event.
- **Snapshot fields (`snapshots.schema.json`):**
  - `$defs/characterState.properties.equipped`: optional array of `{slot, itemId}` objects, each `additionalProperties:false`, both strings (slot kebab, itemId kebab), with slots unique across entries.
    - Absent means nothing equipped.
    - The runtime emits the key only when the character's state carries it; that preserves the byte-exact round-trip of characters that never equipped.
  - Per-combatant `itemsUsed`: optional object mapping item id → integer ≥ 0. It records the units the combatant has **spent** in this fight, not the units remaining.
    - Restore takes the fight-start balances from the host's re-stated request, the same way pools and boundSlots come from `CombatRestoreRequest.balances` (`snapshots.ts:450-452`).
    - The snapshot's `itemsUsed` wins for the spend.
    - Remaining = restated balance − itemsUsed.
    - Note: `slotsUsed` is serialized as the **remaining** per-turn ledger at plan HEAD (`snapshots.ts:395`). `itemsUsed` deliberately means *spent*, because the host re-states fight-start balances. Say so in the description.
  - Per-combatant `maxHp`: optional integer ≥ 0. It is the combatant's heal cap, fixed at fight start: derived hp with grants for characters, the hp formula value for statblocks.
    - The snapshot value wins over the re-stated profile on restore.
    - When it is absent (a pre-v1.4 envelope), restore falls back to the profile's `maxHp`, then to the profile's `hp`.

## Capabilities

- **CAP-E1 (producer leg):** the contract admits equipment and consumable declarations, with named rejections at load. This session produces the contract; S02 mirrors and validates it; S03 and S04 consume it.
- **CAP-E5 (producer leg):** the snapshot contract admits `equipped`, `itemsUsed` and `maxHp`. S05 implements the serializer and restore.

## Contract Agreements

- **CA-EG1** (producer): the exact pack field set above.
  - Boundary mapping: pack.schema.json `$defs` → S02's validator sections and TS mirror → S04's themes → S03's runtime verbs.
  - Structural defects → E-SCHEMA-01; reference defects → E-REF-01.
- **CA-EG2** (contract leg): grant-key semantics as written above (add for ability/save; `gear-*` variables for reserved keys; 0 when nothing is equipped).
- **CA-EG4** (contract leg): the `heal` registry entry is recorded in the v1.4 registry note. Heal lives in the DSL, which is engine grammar, so no `$defs` change is needed for it. S02 implements it; S05 proves the combat path.
- **CA-EG6** (producer): the three snapshot fields, their meanings, and the restore precedence written above.

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `src/schema/contracts/pack.schema.json` | modify | `$defs` items entry (lines ~368–377 at plan HEAD) gains `slots`, `grants`, `use`; top-level properties gain optional `equipSlots` (array, minItems 1, uniqueItems, idPattern items), placed after `spatial`; the `formulas` description names the four `gear-*` variables; the `stats` description names the reserved ids. Descriptions carry the CA-EG1/EG2 semantics verbatim |
| `src/schema/contracts/snapshots.schema.json` | modify | `$defs/characterState.properties.equipped` (optional); `combatSnapshot` per-combatant item gains optional `itemsUsed` and `maxHp`. Each description states its meaning and restore precedence (CA-EG6) |
| `program/Ruleswright/specs/database.md` | modify | §The Pack Document: a short `equipSlots` section (spatial-style); the §content items row lists slots/grants/use with their duties, the armor marker and the no-dice rule; the §formulas section names the `gear-*` variables (0 when nothing equipped; the formula decides direction); the §stats section names the reserved ids; §Snapshot Envelopes documents the three new fields and restore precedence (itemsUsed = spent; balances host-restated; maxHp snapshot-wins); Version Registry row 5 |

## Implementation

### Checkpoint 1 — pack.schema.json v1.4
1. Read `pack.schema.json` end to end, including the `items` `$defs` block and the `formulas`/`stats` descriptions.
2. Add the three ItemDef properties:
   - `slots`: array, minItems 1, uniqueItems, kebab items;
   - `grants`: object, `additionalProperties: {type: integer}`, with the description carrying the key semantics and the `gear-*` mapping;
   - `use`: string, described as an effect-DSL string.
3. Add root `equipSlots` after `spatial`. It is **not** inside `content`; it sits alongside `actions`/`economy`/`spatial` at the pack root.
4. Update the `formulas` and `stats` descriptions.
5. Rule-duty language mirrors the existing `caps`/`armorCasting` descriptions.

**Commit when:** `node -e "JSON.parse(require('fs').readFileSync('src/schema/contracts/pack.schema.json','utf8'))"` exits 0; `git diff` shows only additive changes; the commit covers this file only.

### Checkpoint 2 — snapshots.schema.json v1.4
1. Read `snapshots.schema.json` (203 lines).
2. Add `equipped` to `$defs/characterState.properties`. Items are `{slot, itemId}` with `additionalProperties:false` and both required. It is not added to `required`.
3. Add `itemsUsed` (object; values integer ≥ 0) and `maxHp` (integer ≥ 0) to the per-combatant item. Neither is added to `required`.
4. Keep `additionalProperties:false` everywhere it already stands.

**Commit when:** both contract JSONs parse; `required` arrays are byte-identical to plan HEAD; the commit covers this file only.

### Checkpoint 3 — database.md v1.4 + Version Registry + self-check
Revise database.md as in the Files table. Add Version Registry row 5:

| # | schemaVersion | Description | Files |
|---|---|---|---|
| 5 | 1 (v1.4) | builder-authorized 2025-09-27: slot-based equipment + consumables + the `heal` effect (registry 12→13); purely additive-optional; no field removed or renamed; no rule id added; schemaVersion stays 1 | `pack.schema.json` · `snapshots.schema.json` revised |

State the CA-EG3 armor-marker rule in prose: *"an item is armor iff its grants include the reserved key `armor`; casting a slot-prepared spell while armor-equipped requires one of the character's classes to declare the item's `kind` in `armorCasting`"*.

Note the scope explicitly: point-pool spells have no cast verb in v1 (DD17a), so armorCasting governs slot casting only (DD-EG5).

Self-check:
- (a) both JSONs parse;
- (b) `schemaVersion` is still `const 1`;
- (c) no existing key is removed or renamed (diff review);
- (d) every new field is present with the correct type;
- (e) database.md rule duties name E-SCHEMA-01/E-REF-01 consistently with the existing prose.

**Commit when:** database.md carries the sections and row 5; both contracts are unchanged since ck1/ck2; the commit covers database.md only; `git diff --stat dadf461` lists exactly the three Owned files.

## Verification

- JSON validity: `node -e "JSON.parse(...)"` on both revised contracts. This is the DB role's evidence set (grid S01 precedent); whole-repo gates are Orchestrator's at receive.
- `git diff --stat` against plan HEAD `dadf461`: exactly the three Owned files.
- Additivity audit: no removed or renamed keys. Grep the diff for deleted non-whitespace lines.
- CA-EG1/EG2/EG6: the field set must match STATE.md exactly. Any deviation is a plan correction, not an improvisation.

## State Update

Report:
- the contract fields as landed (exact names);
- the registry-note wording;
- the `gear-*` variable names exactly as written;
- the `itemsUsed` meaning (spent) and the restore precedence;
- any deviation from CA-EG1/EG2/EG6 found while drafting. Return that for bounded prompt correction.

The handoff names S02's mirror duties:
- `Pack.equipSlots?` and `ItemDef.grants/slots/use`;
- the validator passes;
- the `gear-*` admission in the formula checker;
- the registry re-key.

It also names S05's snapshot duties: `equipped` / `itemsUsed` / `maxHp`.
