# SESSION-01 — Author re-entry (DB): contract v1.10 — class features

> **Program:** Ruleswright
> **Feature:** class-features
> **Modules:** — (Author artifact: DB)
> **Depends on:** — (human answers on record, 2026-10-04)
> **Concurrent with:** —
> **Owns:** `program/Ruleswright/specs/database.md`, `src/schema/contracts/pack.schema.json`
> **Reads:** `program/Ruleswright/specs/requirements.md` (FR-2, FR-5, FR-6, FR-9), `program/Ruleswright/prompts/class-features/STATE.md` (DD-C1…C13, CA-C1, CA-C2), `src/schema/validate/sections/{content,progression,cross}.ts`, `src/schema/validate/helpers.ts`, `src/runtime/{feats,pools,character-profile}.ts`, `src/compiler/themes/*.json` (class blocks)
> **Resources:** —
> **Checkpoints:** 2

**Role.** This is an **Author re-entry** session for the DB role, not a Coder session. You change contract text and `pack.schema.json` only. `snapshots.schema.json` and `override.schema.json` stay byte-identical. No `src/**/*.ts` and no theme JSON is touched here; S03 mirrors your contract.

**Authorization (quote it; do not re-litigate it).** On 2026-10-04 Planner asked five questions about F-FP2, the FR-6 class features: what a feature does, whether granted feats use slots, where the field lives, the bundled content, and authorization. The human answered: "**1 a,b 2 no 3 move it, fix packs, 4 fix the broken packs, 5 you have my auth for whatever you need**". STATE.md *Human answers on record* reads it as:
- a feature `ref` grants a feat **or** unlocks an action or spell at its level (DD-C1);
- granted feats use no feat slot (DD-C2);
- the field moves to `progression.<id>.features` and `content.classes.<id>.features` is removed (DD-C3);
- every bundled ref is fixed (DD-C10, S03's work);
- blanket authorization, including this schema-change re-entry and the `database.md:721-722` seed-data drift.

This is contract **v1.10**: a pre-release in-place revision (DD-C3), `schemaVersion` stays 1, **no new rule id**, with compatibility caveat **(g)**. Use `2026-10-04` as the date in Version Registry row 11.

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| — | DB | `database.md` l.3 (status), l.353-362 (§content; the classes bullet l.358), l.473-484 (§progression table; `features` row l.484), l.486-544 (*Feat slots*, caveats (d)–(f)), l.660-694 (rule registry: no change), l.719-726 (*Seed Data*), l.730-757 (Version Registry + discipline) | the v1.10 text sites |
| — | DB | `pack.schema.json` l.258-266 (`content.classes.*.features`), l.480-503 (`progression` entry, `featSlots` l.498-503) | the schema move |
| M01 | Schema | `content.ts:81-134` (today's feature validation), `progression.ts:189-207` (level-ceiling rule), `helpers.ts:109-124` (pack-unique ids) | what S03 will mirror |
| M03 | Runtime | `feats.ts:21-37` (`featSlotTally`), `feats.ts:45-` (`learnFeat`), `pools.ts:302-315` (`knownSpells`), `character-profile.ts:75-130` | the behaviour the contract text describes |

## Context

`database.md:484` already places `features` under `progression`. `pack.schema.json` and the validator put it under `content.classes.<id>`, and nothing resolves `ref`. 11 of the 13 bundled refs point at nothing. The other 2 (`wardens-glyph`) name a spell their class already knows. No runtime code reads features. v1.10 defines what a feature does and makes the schema agree with `database.md`.

## Capabilities

This session writes the contract for CAP-C1 (load rules), CAP-C3 (granted feats), CAP-C4/C5 (unlocks) and CAP-C6 (host query) and the CAP-C7 DB doc. It integrates nothing; S03/S04 implement and prove.

## Contract Agreements

CA-C1 (location/shape) and CA-C2 (ref resolution) are provisional until this session lands; you are their producer. CA-C3 and CA-C4 are runtime meaning you describe. Write the meanings exactly as STATE.md maps them. If Author judgment changes any meaning (for example, you prefer allowing redundant spell unlocks), write your version and report the delta **by CA id and DD id** in your handoff. Orchestrator then amends STATE before it dispatches S03.

**Checkpoint-0 recheck (read-only):**
- `sed -n 484p program/Ruleswright/specs/database.md` is the `| \`features\` | array? | \`{level, ref}\` | …` row.
- The Version Registry's last row is 10 (v1.9); `grep -c '^| 1[01] |' program/Ruleswright/specs/database.md` = 1.
- `pack.schema.json` has `"features"` only at l.258 (`grep -n '"features"' src/schema/contracts/pack.schema.json`).
- `git diff --quiet f36d4ae -- src/schema/contracts program/Ruleswright/specs/database.md` is clean.

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `program/Ruleswright/specs/database.md` | modify | Status line → v1.10; §content classes bullet note; §progression `features` row and a new *Class features (v1.10)* subsection; caveat (g); *Seed Data* names three templates; Version Registry row 11 |
| `src/schema/contracts/pack.schema.json` | modify | Remove `content.classes.*.features`; add `progression.*.features` with a description |

## Implementation

### Checkpoint 1 — the v1.10 text in `database.md`

Write in DB voice, matching the v1.8 *Feat slots* paragraphs.

1. **Status line (l.3):** prepend `v1.10, revised — DB, schema-change Author re-entry (builder-authorized 2026-10-04, class-features: class features at \`progression.<id>.features\` grant a feat or unlock an action or spell at a class level; \`content.classes.<id>.features\` removed; refs resolve at load; no rule id; pre-release in-place revision, compatibility caveat (g); ` and keep the `v1.9, …` history after it.
2. **§content classes bullet (l.358):** append `**v1.10:** class features are not a class field; they live in \`progression.<id>.features\` (see §progression *Class features*).`
3. **§progression `features` row (l.484):** constraints `{level, ref}`: `level` integer 1..the class's level ceiling; `ref` a feat, action or spell id; unique per class. Notes: `**v1.10.** Granted feat or unlocked action/spell from that class level on. See *Class features* below`.
4. **New subsection, after the *Feat slots* block and its caveats (after caveat (f), before `### \`bestiary\``):** `**Class features (v1.10, class-features DD-C1…C9).**` with these bullets:
   - **What a feature is (DD-C1).** `progression.<classId>.features[i] = {level, ref}`. Ids are unique pack-wide (E-DUP-01), so `ref` names exactly one artifact. Its map decides what the feature does, while the character's level **in that class** is ≥ `level`:
     - `content.feats` → the feat is **granted**;
     - `actions` → the action is **unlocked** (declarable in combat);
     - `content.spells` → the spell is **unlocked** (known).
   - **Load rules (DD-C4).**
     - The ref resolves in none of the three maps → `E-REF-01` at `progression.<c>.features[i].ref`, with a did-you-mean hint.
     - An action ref also listed in `content.classes.<c>.actions` → `E-REF-01` (that list grants it from level 1, so the level gate would be ignored).
     - A spell ref whose `magic.lists` intersect the class's `spellLists` → `E-REF-01` (already known; the unlock would be dead).
     - `level` not an integer in 1..the class's level ceiling (its shortest `saves` array, as for `featSlots`) → `E-SCHEMA-01`.
     - A `ref` repeated within one class → `E-SCHEMA-01`.
     - `content.classes.<id>.features` → `E-SCHEMA-02` (unknown field; the closed-contract card every `additionalProperties: false` object already uses).

     No new rule id; all cards at once (FR-2).
   - **Granted feats (DD-C2, human answer "2 no").**
     - Granted feats are derived from the pack and the character's classes, like known spells. They are never written to `CharacterState.feats` and never serialized; the character snapshot is unchanged.
     - They occupy **no feat slot**: the cap counts held (learned) feats only.
     - Reactive granted feats are offered in combat exactly like learned ones (DD-S12 offer, take, decline, no chain).
     - `learnFeat` of a feat the character is currently granted refuses `feat-known`.
     - A feat learned before its class grants it stays held and keeps its slot (no refund in v1).
     - Lowering a class level (`levelSet`) removes the grant, and no event is emitted.
   - **Unlocked actions and spells (DD-C8, DD-C9).**
     - An unlocked action joins the combat profile's actions after the class `actions` union. An unlocked spell joins the known spells, in pack order.
     - Both then ride the unchanged pipeline: restricts, reach/range gates, costs, `armorCasting`, slot or pool spend. An unlocked vancian spell still needs a bound slot to cast.
     - `no-combat-actions` counts unlocked actions.
   - **Multi-class (DD-C5).** Each class contributes its own features at its own class level. Unions keep first-occurrence order (class order, then feature order).
   - **Characters only (DD-C6).** Statblocks keep their explicit `actions` list, even when a statblock uses a class's `attackTable`.
   - **Events and query (DD-C7).** There is no feature event; `level:reached` is unchanged. The host reads `classFeatures(runtime, character)` → `{classId, level, ref, kind: 'feat' | 'action' | 'spell', active}[]`, including features not yet reached (`active: false`).
   - **Compatibility caveat (g) (v1.10).** This is a pre-release in-place revision (database.md *Versioning discipline*: "Until first release, v1 remains revisable by DB"). Effects:
     - a pack declaring `content.classes.<id>.features` now fails `E-SCHEMA-02`;
     - a pack whose feature refs do not resolve, or are redundant, now fails `E-REF-01`;
     - the bundled themes are migrated in the same feature, so their generated packs' `contentHash` changes, and snapshots taken against pre-v1.10 bundled packs fail the identity check (FR-14), as under caveat (d).
5. **Seed Data (l.721-722):** fix the pre-existing drift: three sample theme templates, `dark-fantasy.json`, `zombie-urban.json`, `wyldwood.json` (wyldwood since loot-inventory).
6. **Do not write the Version Registry row in ck1.**

**Commit when:** edits 1–5 are present; `git diff --stat` shows only `database.md`; the text names DD-C1…C8 and caveat (g). Commit message: `class-features SESSION-01: checkpoint 1 — v1.10 text`.

### Checkpoint 2 — `pack.schema.json` + Version Registry row 11

1. **`pack.schema.json`:**
   - Delete the `"features"` property of `content.classes.additionalProperties.properties` (l.258-266).
   - Add to the `progression` entry's `properties` (after `featSlots`, l.498-503):
     ```json
     "features": {
       "type": "array",
       "items": {
         "type": "object",
         "additionalProperties": false,
         "required": ["level", "ref"],
         "properties": {
           "level": { "type": "integer", "minimum": 1 },
           "ref": { "$ref": "#/$defs/idPattern" }
         }
       },
       "description": "v1.10 (FR-6): class features. ref names a content.feats id (granted while the class level >= level; no feat slot), an actions id (unlocked for combat) or a content.spells id (unlocked: known). Semantic rules (validator): ref resolves (E-REF-01); an action ref not also in the class's actions, a spell ref not on the class's spellLists (E-REF-01); level <= the class's level ceiling and ref unique per class (E-SCHEMA-01)."
     }
     ```
     Confirm `#/$defs/idPattern` exists (`grep -n '"idPattern"' src/schema/contracts/pack.schema.json`). It is used at the `content.classes` `propertyNames`.
   - The file must stay valid JSON: `node -e "JSON.parse(require('fs').readFileSync('src/schema/contracts/pack.schema.json','utf8'))"` exits 0.
2. **Version Registry row 11**, after row 10:

   `| 11 | 1 (v1.10) | builder-authorized 2026-10-04, class-features: class features move to progression.<id>.features ({level, ref}; ref = feat granted / action or spell unlocked from that class level; granted feats use no feat slot and are never stored); content.classes.<id>.features removed (E-SCHEMA-02); refs, redundancy, level range and uniqueness checked at load (E-REF-01 / E-SCHEMA-01); no rule id added, schemaVersion stays 1 — pre-release in-place revision with **one compatibility caveat:** (g) packs using the old location or unresolved refs now fail load; bundled themes migrated, so their contentHash changes | pack.schema.json revised |`

**Commit when:**
- the row is present;
- `git diff --name-only f36d4ae -- src/schema/contracts` lists only `pack.schema.json`;
- the JSON parse check exits 0;
- `pnpm exec vitest run tests/schema` passes (4 files, all green; no test reads the contract file, so it is unchanged by this edit).

Commit message: `class-features SESSION-01: checkpoint 2 — pack.schema.json + registry row 11`.

## Verification

- `git diff --name-only f36d4ae..HEAD` lists only `program/Ruleswright/specs/database.md` and `src/schema/contracts/pack.schema.json`.
- `pnpm exec vitest run tests/schema` is green. Orchestrator runs V1–V3 at receive (STATE *Verification Baseline*, H8).
- No integration proof belongs to this session. CAP/CA proofs are S03's and S04's.

## State Update

Report in the handoff:
- the exact rule text written for CA-C1 and CA-C2, and any delta from STATE.md by CA/DD id;
- the human answer as applied;
- the commit SHAs.

Orchestrator re-checks CA-C1/CA-C2 against the landed text and schema (promoting them from provisional) before it dispatches S03.
