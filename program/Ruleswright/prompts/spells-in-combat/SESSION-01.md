# SESSION-01 — Author re-entry: FR-9/FR-11 spell range, magic/api-map/triggers/conditions mocks, contract v1.6

> **Program:** Ruleswright
> **Feature:** spells-in-combat
> **Modules:** — (Author artifacts: Spec, Designer, DB)
> **Depends on:** — (dispatch gate **B-S1**: the human confirms DD-S8's sub-defaults and DD-S9 … DD-S14)
> **Concurrent with:** —
> **Owns:** `program/Ruleswright/specs/requirements.md`, `program/Ruleswright/mocks/magic.html`, `program/Ruleswright/mocks/api-map.html`, `program/Ruleswright/mocks/triggers.html`, `program/Ruleswright/mocks/conditions.html`, `program/Ruleswright/specs/database.md`, `src/schema/contracts/pack.schema.json`, `src/schema/contracts/snapshots.schema.json`
> **Reads:** `program/Ruleswright/specs/design.md`, `program/Ruleswright/mocks/combat-loop.html`, `program/Ruleswright/mocks/spatial.html`, `src/runtime/combat/combat.ts`, `src/runtime/combat/spatial.ts`, `src/runtime/combat/triggers.ts`, `src/runtime/snapshots.ts`, `src/runtime/pools.ts`, `src/runtime/character-profile.ts`, `src/schema/validate/helpers.ts`, `program/Ruleswright/prompts/spells-in-combat/STATE.md` (Design Decisions, Contract Agreements)
> **Resources:** —
> **Checkpoints:** 3

**Role.** This is an **Author re-entry** session, not a Coder session. Spec runs ck1, the
Designer runs ck2, then the DB runs ck3.

**Authorization (quote it; do not re-litigate it).** On 2026-09-30 the human answered
"**1 approved 2 agreed 3 yes, agreed**":
1. one DB re-entry for the snapshot change (spell-slot record plus R-GM-1/R-GM-2);
2. only characters cast;
3. fix F-M1.

Also on 2026-09-30 the human answered DD-S8: "**8 spell need a range, can target empty
square for aoe blasts**". That answer authorizes the requirements-change class (Spec, ck1)
and the `targeting.range` schema field (DB, ck3), as DD-S8 in STATE.md spells out.

B-S1, the confirmation of DD-S8's sub-defaults and DD-S9 … DD-S14, is recorded in STATE.md's Intent section
before this session dispatches. **Orchestrator: paste that recorded answer here in the
envelope.** It authorizes the schema-change class (DB) and the design-change class (the
four mocks), both exactly as written below.

**Spec runs for one change only:** spell range and empty-cell area centers (DD-S8), which
no approved FR states. FR-5, FR-13 and FR-14 already cover the rest of the feature.

If Author judgment would change a value, write the changed version and report the delta
in the handoff, with its DD id.

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| — | Spec | `specs/requirements.md` FR-9 (l.92–101), FR-11 (l.113–125), Decision Log (l.283) | Add the range and area-center criteria |
| — | Designer | `mocks/magic.html`, `mocks/api-map.html`, `mocks/triggers.html`, `mocks/conditions.html` | Casting anatomy, the verb list, trigger anatomy, the condition/feat event row |
| — | DB | `specs/database.md` §formulas, §content (l.291–316), §Snapshot Envelopes (l.362–410), Registry (l.412–445), Access Patterns (l.447), Version Registry (l.480–503); both contracts | v1.6 revision |

## Context

Spells exist in every generated pack, but combat cannot cast them: `Combat.declare` only
looks in `pack.actions` (`combat.ts:521`). Feats with triggers exist, but they never
fire, for three reasons:
- their pattern `condition:applied[self]` does not match the `eventMatches` grammar
  (`triggers.ts:31-41`);
- feats are never registered for offers (`triggers.ts:44-54`);
- characters cannot hold feats at all (`snapshots.ts:26`).

The combat snapshot also loses three things:
- pool and vancian spend, because restore re-reads fight-start balances
  (`snapshots.ts:559-560`);
- every open offer after a combatant's first (`snapshots.ts:462-465`);
- the offer counter (R-GM-1) and the phase of a `use`-raised offer (R-GM-2).

Every later session mirrors what you write here, so this session lands first and alone.
The changes are additive-optional, with two documented compatibility caveats. Following
the v1.5 precedent, do **not** write "purely additive".

## Capabilities

This session writes the approved text for CAP-S1 … CAP-S9 and the contract legs of
CA-S2, CA-S7, CA-S8 and CA-S9 (STATE.md). It proves nothing at runtime.

## Contract Agreements

**Checkpoint-0 recheck.** Read STATE.md Design Decisions DD-S1 … DD-S19 and CA-S1 …
CA-S9; every value below comes from them.

**Facts verified by Planner at `55b294f`:**
- `snapshots.schema.json`:
  - the combat combatant item closes with `additionalProperties: false` (properties
    end with `pendingMove`, which starts at l.229);
  - `combatSnapshot` (from l.157) has `additionalProperties: false` and a `required`
    list;
  - `characterState.feats` already exists (l.74, an array of strings).
- `pack.schema.json`:
  - spells' `cost` is `$ref #/$defs/actionDef/properties/cost` (l.347), so `slots` is
    already allowed on a spell cost;
  - `actionDef` `trigger` is at l.147, and feats' `trigger` at l.319;
  - spells' `targeting` (l.349–366) is `additionalProperties: false`, `required:
    ["shape"]`, properties `shape` (`single | burst`) and `radius`, with an `allOf` that
    requires `radius` for `burst`. It has no `range`.
- `RULE_IDS` has 15 entries (`error-card.ts`). `E-FORM-01` already exists; reuse it.
- `checkTrigger` (`helpers.ts:296`) checks only that `on` is a non-empty string.
- database.md line 313 says "point-pool spells have no cast verb in v1 (DD17a)".

## Files to Create/Modify

| File | Action | What Changes |
|------|--------|--------------|
| `program/Ruleswright/specs/requirements.md` | modify | FR-9: spell range criterion; FR-11: empty-cell area center criterion; Decision Log row |
| `program/Ruleswright/mocks/magic.html` | modify | Step 3 "cast" shows the combat declare; a new section "Casting in a fight" with range and an empty-cell blast; `range` in the burst declaration |
| `program/Ruleswright/mocks/api-map.html` | modify | `fight.declare(actionOrSpellId, { targetId?, at?, to? })`; `settleSpellCasts`; `char.learnFeat`; new event names |
| `program/Ruleswright/mocks/triggers.html` | modify | Anatomy uses the real grammar; reactive feat as a pack feat; the no-chain note; `once` removed |
| `program/Ruleswright/mocks/conditions.html` | modify | l.109 copy `on:condition:applied[target=self]` |
| `src/schema/contracts/pack.schema.json` | modify | spells `targeting.range`; `trigger.on` `pattern` (actions and feats); descriptions (spell casting, feats held) |
| `src/schema/contracts/snapshots.schema.json` | modify | combatant `poolsSpent`, `slotsCast`; envelope `offers`, `phase`, `offeredCount`; `pendingTrigger` description |
| `program/Ruleswright/specs/database.md` | modify | status v1.6; §actions/§content trigger grammar, spells, feats; Snapshot Envelopes v1.6; Registry note; Access Patterns; Version Registry row 7 |

## Implementation

### Checkpoint 1 — Spec: FR-9 range, FR-11 area center

Keep every existing criterion byte-identical. Add:

- to **FR-9**, after the targeting criterion:
  - [ ] Spells declare a **range** as pack data. In a pack with a spatial model, a spell
    whose target (or area center) is farther than its range is rejected declaratively,
    with no state change. A spell that declares no range reaches as far as its caster's
    reach. Theater-of-mind packs never consult range.
- to **FR-11**, after the AoE criterion:
  - [ ] An area spell may be **centered on an empty cell**. Every combatant within the
    shape is affected, on both sides, each with its own save, and an area that catches
    nobody is still a legal cast.

Decision Log row: `2026-09-30 — spells-in-combat: spells declare a range (pack data;
absent = caster reach); area spells may be centered on an empty cell (human)`.

**Commit when:** the diff adds exactly these lines, and no other FR changed.

### Checkpoint 2 — Designer: four mocks

Keep each file's style, palette and structure exactly. Follow the HTML conventions
already in the file (`<span class="kw">` / `"str"` / `"com"` / `"num"`).

**`magic.html`.**
1. Step "3 · cast": the caption becomes `consume bound slot → effect DSL → events · in a
   fight: fight.declare(spellId)`.
2. Add a section **"Casting in a fight"** after "The slot lifecycle", showing:
   ```
   const brynn = profileFromCharacter(rt, hexer);           // spells = what hexer knows
   const fight = rt.startCombat({ allies: [{ id: 'hexer', ...brynn }], enemies, positions });
   fight.declare('ember-bloom', { targetId: 'wight' });      // a spell is an action (FR-9)
   ```
   ```
   // or blast an empty cell — the area spell's center needs no one standing in it
   fight.declare('ember-bloom', { at: { x: 6, y: 3 } });     // within range (FR-9, FR-11)
   ```
   with an output block:
   ```
   spell:cast        hexer → wight · ember-bloom · level-2 slot 0
   damage:applied    … per target, each with its own save (why: content.spells.ember-bloom)
   action:resolved   ember-bloom
   declare:rejected  out-of-range · ember-bloom has range 6; (12,3) is 8 away · E-SPAT-01
   ```
   In the existing "a burst spell — complete declaration" block, the targeting line
   becomes `"targeting": { "shape": "burst", "radius": 2, "range": 6 },   // range: pack
   data (FR-9)`.
3. Under it, a callout list:
   - the gates, in order: restricted (`actions.tagged:` / `spells.tagged:`) → target
     (any combatant, the caster included) or an `at` cell (burst spells only) → **range**
     (the spell's `targeting.range`; no range declared = the caster's reach; spells skip
     the reach gate) → armor (slot spells only) → cost (turn slot + bound slot / pool
     points);
   - an area centered on an empty cell hits everyone inside it, both sides; catching
     nobody is still a cast (the cost is spent); there is no line of sight in v1;
   - the binding rule: the lowest uncast slot bound to *that* spell (FR-8);
   - a rejected cast changes nothing.
4. A second callout: "The fight never writes the character. After `combat-over`,
   `settleSpellCasts(rt, character, fight)` empties the cast slots and draws the pool
   points (`slot:settled`, `pool:settled`). A mid-fight snapshot keeps the spend
   (`slotsCast`, `poolsSpent`)."
5. The CI proof callout stays, with one word added: "memorized, bound, and cast — in a
   fight too — with zero engine diffs".

**`api-map.html`.**
- `fight.declare(id, { targetId?, at?, to? })`, with the comment
  `// an action or a spell (FR-4, FR-9) · at = empty-cell area center (spells) · to = move destination (FR-11)`.
- Add `settleSpellCasts(rt, char, fight, id?)` next to the existing settle line if there
  is one, else after `fight.serialize()`, with the comment
  `// after combat-over: spell spend → character (FR-8)`.
- Add `char.learnFeat(featId)`, with the comment `// feats are character state (FR-5)`.
- Append `spell:cast · trigger:fired (action | feat)` to the provenance-stream comment.

**`triggers.html`.** Rewrite the anatomy block to the real data shapes:
```
"parry": {                                   // actions.parry
  "trigger": { "on": "attack:rolled[target=self]" },
  "cost": { "slots": { "reaction": 1 } },
  "effect": "sequence(attack(ac, grace), damage(1d6, sharp))"
}

// a feat can be reactive too — same substrate      // content.feats.second-gust
"second-gust": {
  "trigger": { "on": "condition:applied[target=self]" },
  "effect": "applyCondition(braced, 2)"      // a feat costs nothing; it acts on its holder
}
```
Add one sentence below it:
- the grammar is `<event>` or `<event>[target|actor=self|<id>]`; anything else is refused
  at load (`E-FORM-01`);
- events raised by a feat never offer feats, so a feat cannot trigger itself.

Remove the `"once"` line: no such field exists. Keep the timeline rows, but make the
fourth row (l.73) read
`trigger:declined   second-gust not taken · host prompt returned nothing`, and change the
proof block (l.84) to `declares parry + second-gust`.

**`conditions.html`.** Line 109: `second-wind offered (on:condition:applied[self])` →
`second-gust offered (on:condition:applied[target=self])`.

**Commit when:**
- all four mock files are well-formed (tags balanced);
- the anatomy blocks above appear verbatim apart from HTML escaping;
- `git diff --stat` touches only these four files.

### Checkpoint 3 — DB: contract v1.6 and database.md

**`pack.schema.json`** (read the whole file first, preserve its formatting, and keep the
diff reviewable):
1. For `$defs/actionDef/properties/trigger/properties/on` and the feats'
   `trigger.properties.on`, add:
   ```json
   "pattern": "^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)*(\\[(target|actor)=[a-z][a-z0-9-]*\\])?$"
   ```
   and the description: `"v1.6 — the eventMatches grammar: <eventType> or
   <eventType>[target|actor=self|<id>] (self = the reactor). Any other form can never
   fire and is E-FORM-01 at load."` Keep any existing `minLength`.
2. Spells' `targeting.properties`: add (do **not** touch `required` or the `allOf`)
   ```json
   "range": {
     "type": "integer",
     "minimum": 0,
     "description": "v1.6 — optional: the farthest distance (the pack's spatial distance: grid Chebyshev, hex axial) from the caster to the target or area center. Absent = the caster's reach. Spells are range-gated instead of reach-gated; theater-of-mind packs ignore it. A burst spell may be centered on an empty cell (declare option at)."
   }
   ```
3. Spells' description (or the spells map description): append `"v1.6 — declarable in
   combat via fight.declare(spellId, {targetId} | {at}) by a combatant that knows it, within targeting.range; the cost spends turn
   slots like an action's, then the bound slot holding that spell (vancian) or pool
   points. armorCasting gates vancian casts only (DD-EG5)."`
4. Feats' description: append `"v1.6 — characters hold feats (learnFeat). A reactive
   feat is offered in combat like a reactive action; it costs nothing and its effect
   targets its holder; events raised by a feat never offer feats."`

**`snapshots.schema.json`.**
1. Add to the combat combatant item `properties` (do **not** touch `required`):
   ```json
   "poolsSpent": {
     "type": "object",
     "propertyNames": { "pattern": "^[a-z][a-z0-9-]*$" },
     "additionalProperties": { "type": "integer", "minimum": 1 },
     "description": "v1.6 — optional: pool id -> points this combatant has SPENT in this fight (the itemsUsed precedent). Restore: pool = re-stated balances.pools - poolsSpent. Unknown pool or over-spend = E-SNAP-01. Absent = nothing spent."
   },
   "slotsCast": {
     "type": "object",
     "propertyNames": { "pattern": "^[1-9]$" },
     "additionalProperties": { "type": "array", "uniqueItems": true, "items": { "type": "integer", "minimum": 0 } },
     "description": "v1.6 — optional: spell level -> indices of the fight-start bindings consumed in this fight (by a spell, the lowest uncast index bound to it; by a vancian action, the lowest uncast non-null index, or the lowest uncast index below boundSlots for a count-only combatant). Restore: boundSlots = re-stated count - indices; an index out of range, on a null binding, or for a level with no re-stated slots = E-SNAP-01. Absent = nothing cast."
   }
   ```
2. Add to `combatSnapshot.properties` (do **not** touch `required`):
   ```json
   "phase": {
     "enum": ["awaiting-declare", "resolved", "awaiting-trigger-response", "combat-over"],
     "description": "v1.6 — optional: the fight's phase when frozen. Restore: frozen hp satisfying the end rule -> combat-over; else this value; else the v1.5 derivation. combat-over while no side is defeated = E-SNAP-01."
   },
   "offeredCount": {
     "type": "integer", "minimum": 0,
     "description": "v1.6 — optional: offers raised so far; the next trigger:fired.offerIndex continues from it. Absent = 0."
   },
   "offers": {
     "type": "array",
     "items": {
       "type": "object", "additionalProperties": false,
       "required": ["actorId", "source", "id", "on"],
       "properties": {
         "actorId": { "type": "string" },
         "source": { "enum": ["action", "feat"] },
         "id": { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
         "on": { "type": "string", "description": "The live event type that raised the offer" }
       }
     },
     "description": "v1.6 — optional: every open trigger offer, in queue order. v1.6 writers emit this (when non-empty) instead of the per-combatant pendingTrigger. Present together with any pendingTrigger = E-SNAP-01. An unknown actor, or an id that is not a reactive action/feat that actor holds = E-SNAP-01."
   }
   ```
3. Add to `pendingTrigger`'s description: `" v1.6: legacy — read on restore when offers is
   absent; v1.6 writers no longer emit it."`

Format with Prettier before committing: `pnpm exec prettier --write
src/schema/contracts/pack.schema.json src/schema/contracts/snapshots.schema.json`. The
grid-combat and equipment cycles each needed a format-only residual because this step
was skipped.

**`database.md`.**
1. Status line → **v1.6**, with the note "builder-authorized 2026-09-30,
   spells-in-combat: spells declarable in combat with a pack-declared range and empty-cell area centers, spend recorded in combat snapshots,
   characters hold feats, reactive feats offered, trigger grammar enforced, combat
   envelope offers/phase/offeredCount".
2. §actions: the `trigger` row gains the grammar and the `E-FORM-01` rule (DD-S13).
3. §content:
   - **spells:** add a v1.6 paragraph with DD-S4, DD-S5, DD-S8 (range, `at`, refusals,
     no line of sight, theater-of-mind), DD-S10, DD-S17, DD-S18 and DD-S19 in meaning, and
     add `range` to the spells field list (`targeting` = `{shape, radius?, range?}`). Rewrite the armor marker's scope sentence (l.311–316): "Scope:
     **vancian** casting only (DD-EG5, kept in v1.6). Point-pool spells are cast in
     combat (v1.6) and are not armor-gated." Delete "point-pool spells have no cast verb
     in v1 (DD17a)".
   - **feats:** add DD-S11 and DD-S12 in meaning, including the v1 limit "no feat-slot
     cap (progression declares none)".
4. §Snapshot Envelopes: a **v1.6 fields** table in the style of the v1.5 one. Use the
   rows `poolsSpent`, `slotsCast`, `phase`, `offeredCount`, `offers`, with the restore
   precedence exactly as in STATE CA-S2 and DD-S14. Add a paragraph on the spend
   asymmetry:
   - `itemsUsed`, `poolsSpent` and `slotsCast` all record **spend** against re-stated
     balances;
   - `slotsUsed` still records the remaining per-turn ledger;
   - the host settles spells with `settleSpellCasts` (a runtime verb, not a contract
     field), following CA-S3.

   Under `characterState`, note that `feats` is now written: it is emitted only when the
   character holds a feat, and restore refuses an unknown id (`E-SNAP-01`).
5. Registry prose: "v1.6 adds no id: the trigger grammar reuses `E-FORM-01`; snapshot
   refusals reuse `E-SNAP-01`; combat cast refusals reuse `E-REF-01`, `E-SPAT-01` (`out-of-range`), `E-VANC-01`,
   `E-POINTS-01` and `E-ECON-01`."
6. Access Patterns: add a row `Spell declare | content.spells[id] + index.spellEffects |
   action pipeline, rule base content.spells.<id>` and a row
   `Reactive offers | actions + feats with trigger.on | eventMatches, per call`.
7. Version Registry row `| 7 | 1 (v1.6) | builder-authorized 2026-09-30,
   spells-in-combat: combat spell casting, spells targeting.range (optional; absent = caster reach), snapshot combatant poolsSpent/slotsCast,
   envelope offers/phase/offeredCount, character feats written, trigger.on grammar
   pattern; no field removed/renamed, no rule id added, schemaVersion stays 1 — **two
   compatibility caveats:** (a) a trigger.on outside the eventMatches grammar now fails
   E-FORM-01 (bundled themes corrected in the same feature); (b) v1.6 writers emit
   offers instead of the per-combatant pendingTrigger, which v1.6 still reads | pack.schema.json · snapshots.schema.json revised |`.

**Commit when:**
- both JSON files parse:
  `python3 -c "import json;[json.load(open(p)) for p in ['src/schema/contracts/pack.schema.json','src/schema/contracts/snapshots.schema.json']]"`;
- every `required` array is unchanged (`git diff` shows no `required` line edited);
- `pnpm exec prettier --check src/schema/contracts/ program/Ruleswright/specs/database.md`
  is 0;
- `pnpm typecheck` is 0 (no TS touched);
- `pnpm exec vitest run tests/schema` passes. The hand-rolled validator does not read
  the contract files at run time, so this must stay green. If it is red, stop and
  report.

## Verification

- JSON parse of both contracts; `git diff --stat` covers only the eight lease files.
- **Cross-reference:** the FR-9/FR-11 criteria, `magic.html`, the `targeting.range`
  description and database.md agree on range semantics (absent = caster reach; spells
  skip the reach gate; empty-cell centers; theater-of-mind ignores range).
- **Cross-reference:**
  - `api-map.html` names equal database.md's (`settleSpellCasts`, `learnFeat`,
    `spell:cast`, `pool:settled`, `slot:settled`, `feat:learned`);
  - the `triggers.html` grammar sentence equals the `pattern` and the database.md text.
- **Cross-reference:** the DD-S4 … DD-S18 statements in database.md agree in meaning
  with STATE.md. Report every wording you changed.
- The whole-repo fast gates (`typecheck`, `lint`, `format:check`) are Orchestrator's
  receive check. You run the role-scoped set above.

## State Update

Report:
- the status and checkpoint count;
- the FR-9/FR-11 lines as written;
- each DD-S value as written, flagging any delta;
- the exact JSON paths S02/S03 must mirror: spells `targeting.range`; combatant
  `poolsSpent`, `slotsCast`;
  envelope `phase`, `offeredCount`, `offers[].{actorId,source,id,on}`; the `trigger.on`
  `pattern`;
- the final event names and the settle refusal names;
- surprises.

`followUp` for S02: the CA-S2 restore refusals and the CA-S9 range/`at` wording exactly as
written. `followUp` for S03: the
`offers`/`phase`/`offeredCount` precedence and the trigger grammar wording.
