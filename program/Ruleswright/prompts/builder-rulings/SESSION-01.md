# SESSION-01 — Author re-entry (DB): contract v1.9 — restricts symmetry, XP never lowers a level, feat-slotted wording

> **Program:** Ruleswright
> **Feature:** builder-rulings
> **Modules:** — (Author artifact: DB)
> **Depends on:** — (human answers on record, 2026-10-04)
> **Concurrent with:** —
> **Owns:** `program/Ruleswright/specs/database.md`
> **Reads:** `program/Ruleswright/specs/requirements.md` (FR-6, FR-7, FR-9), `program/Ruleswright/mocks/conditions.html`, `program/Ruleswright/mocks/magic.html`, `src/runtime/conditions.ts`, `src/runtime/combat/combat.ts`, `src/runtime/progression.ts`, `src/runtime/feats.ts`, `src/schema/contracts/pack.schema.json` (read only — not changed), `program/Ruleswright/prompts/builder-rulings/STATE.md` (DD-R1…R7, CA-R1…R4)
> **Resources:** —
> **Checkpoints:** 2

**Role.** This is an **Author re-entry** session for the DB role, not a Coder session. It writes description text only. **No schema file changes:** `pack.schema.json`, `snapshots.schema.json` and `override.schema.json` stay byte-identical.

**Authorization (quote it; do not re-litigate it).** On 2026-10-04 Planner listed four carried questions:
1. Should the three `mending` spells heal instead of reducing damage?
2. Should the restriction rules for spells outside combat match the ones in combat?
3. When `awardXp` is used after a character's level was set directly, it can lower that level. Is that intended (F-FP1)?
4. If a pack declares feat slots only on a monster's entry, every player class ends up with zero feat slots. Is that the intended reading (F-P7)?

The human answered: "**1 yes, heal 2 recommendation 3 no 4 recommendation**". Read against the questions (STATE.md, *Human answers on record*):
- **2 → recommendation = symmetric.** Out of combat, a spell is restricted exactly as in combat: by `actions.tagged:<t>` **or** `spells.tagged:<t>` (DD-R3). This changes the v1.6 DD-S10 text, so it needs this DB re-entry.
- **3 → no.** `awardXp` never lowers a class level (DD-R4). database.md gains one bullet stating it.
- **4 → recommendation = keep the v1.8 meaning and say it plainly.** Any class's `featSlots` makes the pack feat-slotted. The pack format has no player/monster class distinction (DD-R5). database.md gains one sentence.
- **1** is theme content (S02). It touches no database.md text.

This is contract **v1.9**: description-only, no field, no rule id, `schemaVersion` stays 1 (the v1.7 precedent). Use `2026-10-04` as the date in Version Registry row 10.

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| — | DB | `specs/database.md` l.3 (status), l.357 (§content conditions), l.359 (§content spells), l.401-406 (*Restricts and spells, scoped to combat (DD-S10)*), l.488-525 (*Feat slots (v1.8)*: l.491 *Opt-in (DD-F3)*, l.510-512 refusal **(c)**), l.712-726 (Version Registry) | the v1.9 text sites |
| M03 | Runtime | `conditions.ts` `isRestricted` l.186, `restrictedIds` l.206, `matchesRestriction` l.41; `combat/combat.ts` `restrictionRejection` l.863 | the in-combat rule the out-of-combat text now matches |
| M03 | Runtime | `progression.ts` `awardXp` l.282 (level computed l.302, applied l.320); `feats.ts` `featSlotTally` l.21 | the XP and feat-slotted behaviour being specified |

## Context

Three carried human questions resolve as contract text:
- **Restricts asymmetry** (spells-in-combat residual; DD-S10). In combat, `restrictionRejection` blocks a spell on either pattern kind. Out of combat, `isRestricted` and `restrictedIds` match by kind only, so a condition `restricts: ["actions.tagged:casting"]` blocks a casting spell in a fight but not in `isRestricted(rt, c, 'spell', id)`. database.md l.404-406 documents the asymmetry as deliberate. The human chose symmetry.
- **F-FP1.** `awardXp` sets each class level to the level its XP reaches, even when that is **lower** than a level set directly with `createCharacter`/`levelSet`. The human ruled it is not intended. database.md says nothing about it today; refusal **(c)** (l.510) is the only `awardXp` text.
- **F-P7.** l.491 already says "**any** `progression` entry". The human accepted the recommendation to keep it. Monster progressions are classes too (`content.classes` must pair with every progression entry, E-REF-03), and the bundled `warden`/`scavenger` are both player classes and statblock attack tables. So "player class" cannot be defined from the pack.

## Capabilities

This session writes the contract text for CAP-R2, CAP-R3 and CAP-R4 (STATE.md). It integrates nothing. S02 implements and proves them. CAP-R1 (heal spells) needs no contract text: `heal(formula)` is v1.4 vocabulary and spells already accept any effect.

## Contract Agreements

CA-R1 (restricts), CA-R2 (XP levels) and CA-R3 (feat-slotted predicate) in STATE.md are the source for this text. Each stays **provisional** until this session lands. Write the meaning exactly as mapped there. If Author judgment changes a meaning, write your version and report the delta by CA id, so Orchestrator can amend the row before it dispatches S02.

**Checkpoint-0 recheck (read-only):**
- database.md l.401 begins `- **Restricts and spells, scoped to combat (DD-S10).**`, and l.404-406 say out of combat "only `spells.tagged:` restricts a spell there".
- The Version Registry's last row is 9 (v1.8).
- `grep -n 'never lowers' program/Ruleswright/specs/database.md` returns nothing.
- `git diff --quiet -- src/schema/contracts` (contracts unchanged at start).

**Do not touch:**
- F-FP2, the §progression `features` row (l.482). It is carried to a future class-features re-entry.
- Load-time tag integrity. It still checks `actions.tagged:` patterns only (DD-R3; tightening it would be breaking under the versioning discipline).
- The theme content in l.700-705.

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `program/Ruleswright/specs/database.md` | modify | Status line → v1.9. l.357 + l.359 parentheticals. The DD-S10 bullet (l.401-406) is rewritten as symmetric. *Feat slots*: one F-P7 sentence and the XP bullet. Version Registry row 10 |

## Implementation

### Checkpoint 1 — the v1.9 text

Write in DB voice, matching the v1.7/v1.8 paragraphs:

1. **Status line (l.3):** prepend `v1.9, revised — DB, Author re-entry (builder-authorized 2026-10-04, builder-rulings: out-of-combat restricts follow the in-combat rule; \`awardXp\` never lowers a class level; the feat-slotted predicate stated plainly; description only — no field, no rule id; two documented compatibility caveats (e) and (f); ` and keep the existing `v1.8, …` history after it.
2. **§content conditions (l.357):** replace `(v1.6: combat declares also match spells against \`actions.tagged:\`; see spells)` with `(v1.6: combat declares also match spells against \`actions.tagged:\`; v1.9: so do \`isRestricted\`/\`restrictedIds\` out of combat; see spells)`.
3. **§content spells (l.359):** replace `through the same matcher as actions in combat (v1.6), FR-9` with `through the same matcher as actions, in combat (v1.6) and out of combat (v1.9), FR-9`.
4. **The DD-S10 bullet (l.401-406):** rename it to `**Restricts and spells (DD-S10; symmetric since v1.9, builder-rulings DD-R3).**` Its text becomes:
   > A spell is blocked while an active condition carries `actions.tagged:<t>` or `spells.tagged:<t>` and `<t>` is one of the spell's tags (a spell is an action, FR-9) — in a combat declare **and** out of combat: `isRestricted(runtime, character, 'spell', id)` and `restrictedIds(runtime, character, 'spell')` apply the same rule (v1.9; v1.6 matched by kind out of combat). Actions are unchanged everywhere: only `actions.tagged:` restricts an action. A pattern naming a tag no action or spell declares matches nothing. Load-time tag integrity still checks `actions.tagged:` patterns only.
5. **Feat slots, *Opt-in (DD-F3)* bullet (l.491-494):** append: `**Any** class counts, including one only statblocks use: the pack format has no player/monster class distinction (every progression entry pairs with a \`content.classes\` entry, E-REF-03), so a pack author who slots one class should slot every class a character may take (builder ruling 2026-10-04, builder-rulings DD-R5).`
6. **Feat slots, after the refusal list (after (d), before *Compatibility caveat (d)*):** add the bullet:
   > - **XP never lowers a level (v1.9, builder ruling 2026-10-04, builder-rulings DD-R4).** `awardXp` adds the award to `xp` and the split shares to `classXp`, then sets each class to the **higher** of its current level and the level its class XP reaches (clamped, as before, by the race cap and the class's level ceiling). A level set directly (`createCharacter`, `levelSet`) is never lowered by an award; `level:reached` is emitted only for a class whose level rose. Because levels then only rise and `featSlots` never decrease, refusal (c) can fire only for a character already holding more feats than its slots (an edited state). It stays as a guard.
7. **Compatibility caveats:** directly after the *Compatibility caveat (d)* bullet, add:
   > - **Compatibility caveat (e) (v1.9).** Out of combat, a condition with `actions.tagged:<t>` now also restricts a spell tagged `<t>` in `isRestricted`/`restrictedIds`. Combat behaviour is unchanged.
   > - **Compatibility caveat (f) (v1.9).** `awardXp` no longer lowers a class level that was set above the level its XP reaches. Such a character keeps its level, and its XP accumulates until the level is reached.
8. **Do not write the Version Registry row in ck1.** It goes in ck2.

**Commit when:** edits 1–7 are present; `git diff --stat` shows only `database.md`; the text names DD-R3, DD-R4 and DD-R5.

### Checkpoint 2 — Version Registry row 10

Add row 10 after row 9:

`| 10 | 1 (v1.9) | builder-authorized 2026-10-04, builder-rulings: restricts symmetric in and out of combat (isRestricted/restrictedIds match a spell by actions.tagged: or spells.tagged:); awardXp never lowers a class level; the feat-slotted predicate stated plainly (any class); description only — no field added/removed/renamed, no rule id added, schemaVersion stays 1 — **two compatibility caveats:** (e) out-of-combat restricts now also match a spell by actions.tagged:; (f) awardXp keeps a directly set level above its XP level | database.md only (no contract file changed) |`

**Commit when:**
- the row is present;
- `git diff --quiet -- src/schema/contracts` (no contract file changed);
- `pnpm exec vitest run tests/schema` passes: 4 files, all green (unchanged, since no code or schema changed). `program/` is in `.prettierignore`, so `database.md` is not formatted.

## Verification

- `git diff --name-only <base>..HEAD` lists only `program/Ruleswright/specs/database.md`.
- `pnpm exec vitest run tests/schema` is green.
- Orchestrator runs the whole-repo fast gates at receive (PROGRAM-CONFIG convention).
- No integration proof belongs to this session. CAP/CA proofs are S02's (STATE.md).

## State Update

Report in the handoff:
- the exact text written for CA-R1, CA-R2 and CA-R3, and any delta from STATE.md, by CA id;
- the human answer as applied ("1 yes, heal 2 recommendation 3 no 4 recommendation");
- the commit SHAs.

Orchestrator then re-checks CA-R1…R3 against the landed text before it dispatches S02.
