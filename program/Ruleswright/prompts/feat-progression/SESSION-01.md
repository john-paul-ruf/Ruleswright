# SESSION-01 — Author re-entry (DB): contract v1.8 — per-class feat slots

> **Program:** Ruleswright
> **Feature:** feat-progression
> **Modules:** — (Author artifact: DB)
> **Depends on:** — (human authorization on record, 2026-10-04)
> **Concurrent with:** —
> **Owns:** `program/Ruleswright/specs/database.md`, `src/schema/contracts/pack.schema.json`
> **Reads:** `program/Ruleswright/specs/requirements.md` (FR-5, FR-6), `program/Ruleswright/mocks/progression.html`, `src/schema/artifacts.ts`, `src/schema/validate/sections/progression.ts`, `src/runtime/feats.ts`, `src/runtime/progression.ts`, `src/runtime/snapshots.ts`, `program/Ruleswright/prompts/feat-progression/STATE.md` (Design Decisions DD-F1…F10, Contract Agreements CA-F1…F3)
> **Resources:** —
> **Checkpoints:** 2

**Role.** This is an **Author re-entry** session for the DB role, not a Coder session.

**Authorization (quote it; do not re-litigate it).** On 2026-10-04 Planner asked:
1. Feat slots per class per level (like save progressions), or one table for the whole character?
2. Saved characters that already hold more feats than the new limit allows: refuse to load them, or let them keep the extra feats?
3. Do you approve the contract change itself?

The human answered: "**1 per class per level - 2 refuse - 3 approved**". This authorizes:
1. **per class per level**: the field lives on `progression.<classId>` and is indexed by class level (DD-F1);
2. **refuse**: restore refuses a character holding more feats than its slots (DD-F6c);
3. **approved**: this DB re-entry (schema-change class) for contract **v1.8**.

Use `2026-10-04` as the date in Version Registry row 9.

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| — | DB | `specs/database.md` l.44 (overview), §content feats l.432-447, §progression l.470-479, Snapshot Envelopes l.552-554, Version Registry l.666-689 | the v1.8 text sites |
| — | DB | `src/schema/contracts/pack.schema.json` `$defs/classProgression` l.451-499 | the structural edit |
| — | Design | `mocks/progression.html` l.38, l.48-58, l.105 | design source: "feat slots" in the progression tables; warden feats column 1,1,2,2,2; per-class addition |
| M03 | Runtime | `progression.ts` `validateBuild` l.50, `deriveProgression` l.175, `awardXp` l.261, `levelSet` l.322; `feats.ts` `learnFeat` l.14; `snapshots.ts` `characterStateRefusals` l.317 | the behaviour being specified |

## Context

FR-6 says "progression tables in the pack define: HD, attack progression, save progressions, **feat slots**, class features, and vancian slot tables". Every other item on that list exists; feat slots do not. Today `learnFeat` has no cap, and `database.md` l.437-438 states it: "**v1 limit:** no feat-slot cap (progression declares none)". The design source (`progression.html`) already shows a `feats` column on the progression table.

This session writes the contract. It changes no requirement (FR-6 already asks for this) and no mock (the mock already shows it). `snapshots.schema.json` is **not** touched: `characterState.feats` already exists (DD-F9).

## Capabilities

This session produces the contract text for CAP-F1…F5 (STATE.md). It integrates no capability. Implementation and proof are S02's.

## Contract Agreements

CA-F1, CA-F2 and CA-F3 (STATE.md, with their mapping tables) are the source for this session's text. Each is **provisional** until this session lands. Write the meaning exactly as mapped there unless Author judgment changes it. If it does, write the changed version and report the delta by CA id, so that Orchestrator can amend the row before dispatching S02.

**Checkpoint-0 recheck (read-only):**
- `grep -n featSlots -r src program/Ruleswright/specs` returns no hits.
- `classProgression.properties` in `pack.schema.json` is exactly `hd`, `attackTable`, `attackBonus`, `saves`, `slots`, with `additionalProperties: false`.
- Version Registry's last row is 8 (v1.7).

**Do not touch F-FP2.** The §progression table's `features` row (l.479) is not in the schema or the validator. That is pre-existing drift carried to a later DB re-entry; leave the row as it is.

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `program/Ruleswright/specs/database.md` | modify | Status line → v1.8. l.44 overview gains "feat slots". §progression table gains a `featSlots` row plus a **Feat slots (v1.8)** paragraph. §content feats: replace the "v1 limit" sentence. Version Registry: row 9 |
| `src/schema/contracts/pack.schema.json` | modify | `$defs/classProgression.properties.featSlots` (structural, optional) |

## Implementation

### Checkpoint 1 — database.md v1.8

Write in DB voice, matching the v1.6/v1.7 paragraphs:

1. **Status line (l.3):** prepend `v1.8, revised — DB, schema-change Author re-entry (builder-authorized 2026-10-04, feat-progression: per-class feat slots \`progression.<id>.featSlots\`; additive-optional, no rule id added; one documented compatibility caveat (d))`. Keep the existing history after it, as earlier versions did.
2. **l.44 overview:** `progression     per-class tables: HD, attack table, saves, vancian slots, feat slots (v1.8)`.
3. **§progression table (l.472-479):** add a row after `slots`:
   `| \`featSlots\` | int array? | each ≥ 0; non-decreasing; length ≥ the class's level ceiling (its shortest \`saves\` array) | **v1.8.** Feats the class grants **in total** at each class level (index 0 = level 1) — a running total like \`saves\`, not an increment. See *Feat slots* below |`
4. **New paragraph after the table, "Feat slots (v1.8, feat-progression DD-F1…F6)":**
   - **Per class per level:** `featSlots[L - 1]` is the class's total at class level L (DD-F1).
   - **Multi-class:** a character's feat slots are the **sum** over its classes, as vancian slots add (DD-F2).
   - **Opt-in:** a pack is *feat-slotted* when any `progression` entry declares `featSlots`. In a feat-slotted pack, a class without the field contributes **0**. A pack that declares none has **no cap**, the v1.7 behaviour (DD-F3).
   - **Every held feat**, passive or reactive, occupies one slot (DD-F5).
   - **Load:** a non-integer or negative entry, an empty array, a decrease from one level to the next, or an array shorter than the class's level ceiling → `E-SCHEMA-01` at `progression.<id>.featSlots` (or `[i]`). No rule id is added (DD-F4).
   - **Refusal (runtime rule `feat-slots-exceeded`, card `jsonPath 'feats'`; DD-F6).** Every path that would leave a character holding more feats than its slots is refused, and nothing changes:
     - **(a)** `learnFeat` (RuntimeRuleError; `artifactId` = the feat id; checked after `unknown-feat` and `feat-known`; no `feat:learned`).
     - **(b)** `levelSet`, through the shared build validator (`validateBuild(runtime, race, entries, heldFeats?)`, CharacterBuildError, `artifactId '(character)'`).
     - **(c)** `awardXp` when the levels it would derive leave the held feats over the slots (CharacterBuildError; XP, levels and events unchanged).
     - **(d)** character and party **restore** (the build validator's third path; RuntimeRuleError, nothing minted). The unknown-feat `E-SNAP-01` card is unchanged and may appear alongside.
   - **Compatibility caveat (d):** a pack that adds `featSlots` makes `learnFeat` refuse once a character's slots are full, and refuses to restore a snapshot holding more feats than its slots. Packs that declare no `featSlots` are unaffected. Bundled-theme snapshots taken before v1.8 already fail the `contentHash` identity check (FR-14), so this caveat is reachable only through a pack that adds slots without changing content, or through an edited snapshot.
5. **§content feats (l.437-438):** replace "**v1 limit:** no feat-slot cap (progression declares none)." with "**v1.8:** learning is capped by the character's feat slots when the pack declares them (see §progression *Feat slots*); a pack that declares none keeps the uncapped v1.6 behaviour."
6. **Snapshot Envelopes, the v1.6 `characterState.feats` bullet (l.552-554):** append one sentence: "v1.8: restore also refuses a character holding more feats than its feat slots (`feat-slots-exceeded`, see §progression)."
7. **Do not write the Version Registry row in ck1.** It goes in ck2 with the schema file.

**Commit when:** `database.md` contains edits 1–6; `git diff --stat` shows only `database.md`; the text names DD-F1…F6.

### Checkpoint 2 — pack.schema.json `featSlots` + Version Registry row 9

1. In `$defs/classProgression.properties`, after `slots`, add:
   ```json
   "featSlots": {
     "type": "array",
     "minItems": 1,
     "items": { "type": "integer", "minimum": 0 },
     "description": "v1.8 (FR-6): feats the class grants in total at each class level (index 0 = level 1); a running total like saves, not an increment. Non-decreasing, and at least as long as the class's shortest saves array (semantic rules; E-SCHEMA-01). A character's feat slots are the sum over its classes. Optional: in a pack where any progression entry declares featSlots, a class without it contributes 0; a pack that declares none has no feat cap."
   }
   ```
   Do **not** add it to `required`. Keep `additionalProperties: false`. Change nothing else.
2. Check the JSON parses: `node -e "JSON.parse(require('fs').readFileSync('src/schema/contracts/pack.schema.json','utf8'))"`.
3. `database.md` Version Registry, add row 9 after row 8:
   `| 9 | 1 (v1.8) | builder-authorized 2026-10-04, feat-progression: optional per-class \`progression.<id>.featSlots\` (per-level running totals, summed across classes; feat-slotted packs cap learnFeat, levelSet, awardXp and restore with the runtime rule feat-slots-exceeded); purely additive-optional, no field removed/renamed, no rule id added, schemaVersion stays 1 — **one compatibility caveat:** (d) a pack that adds featSlots refuses learning past the cap and refuses to restore an over-cap character | pack.schema.json revised |`

**Commit when:**
- the JSON parses;
- `pnpm exec prettier --check src/schema/contracts/pack.schema.json` passes (`program/` is in `.prettierignore`, so `database.md` is not formatted);
- `pnpm exec vitest run tests/schema` passes: 4 files, 111/111 at baseline. Adding an optional property must not change any result.

## Verification

- `node -e "JSON.parse(require('fs').readFileSync('src/schema/contracts/pack.schema.json','utf8'))"` exits 0.
- `pnpm exec vitest run tests/schema` is green.
- `pnpm format:check` exits 0. Orchestrator runs the whole-repo fast gates at receive (PROGRAM-CONFIG convention).
- No integration proof belongs to this session. CAP/CA proofs are S02's (STATE.md).

## State Update

Report in the handoff:
- the exact text written for CA-F1, CA-F2 and CA-F3, and any delta from STATE.md, by CA id;
- the human answer as applied ("1 per class per level - 2 refuse - 3 approved");
- the commit SHAs.

Orchestrator then re-checks CA-F1…F3 against the landed text before dispatching S02.
