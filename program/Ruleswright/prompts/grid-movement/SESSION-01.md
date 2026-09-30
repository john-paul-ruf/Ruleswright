# SESSION-01 — Author re-entry: FR-11 movement amendment, spatial/api-map design, contract v1.5

> **Program:** Ruleswright
> **Feature:** grid-movement
> **Modules:** — (Author artifacts: Spec, Designer, DB)
> **Depends on:** — (dispatch gate B-M1 cleared 2026-09-30: DD-M2…DD-M13 confirmed; REPLAN-GM-01 amendments to DD-M6/M7/M9/M10/M12 applied)
> **Concurrent with:** —
> **Owns:** `program/Ruleswright/specs/requirements.md`, `program/Ruleswright/mocks/spatial.html`, `program/Ruleswright/mocks/api-map.html`, `program/Ruleswright/specs/database.md`, `src/schema/contracts/pack.schema.json`, `src/schema/contracts/snapshots.schema.json`
> **Reads:** `program/Ruleswright/specs/design.md`, `program/Ruleswright/mocks/combat-loop.html`, `program/Ruleswright/mocks/triggers.html`, `program/Ruleswright/mocks/conditions.html`, `src/runtime/combat/combat.ts`, `src/runtime/combat/spatial.ts`, `src/runtime/combat/triggers.ts`, `src/core/dsl/registry.ts`, `program/Ruleswright/prompts/grid-movement/STATE.md` (Design Decisions)
> **Resources:** —
> **Checkpoints:** 3

**Role:** this is an **Author re-entry** session, run by the Author roles in order: Spec
(ck1), Designer (ck2), DB (ck3). It is not a Coder session. The requirements-change,
design-change and schema-change classes are human-gated. The human authorized the
direction on 2026-09-29 (Option B, hex, pack-defined terrain, pack-defined reactions).
The human confirmed the Planner defaults DD-M2…DD-M13 on 2026-09-30. Orchestrator then
applied auto-decisions (2026-09-30, REPLAN-GM-01) that refine DD-M6, DD-M7, DD-M9, DD-M10
and DD-M12 without changing product direction or schema scope. Their markers are
**[F-P1]**, **[F-P2]**, **[F-P5]**, **[F-P9]**, **[F-P10a/b]** and **[F-P11]** in STATE.md
Design Decisions. Write the amended text. If Author judgment would change a value, write
the changed version and report the delta in the handoff.

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| — | Spec | `specs/requirements.md` FR-11 (lines 113–119), Constraints "Deferred" line 249 | You amend FR-11. Movement was never listed as deferred, so this is an addition |
| — | Designer | `mocks/spatial.html`, `mocks/api-map.html` | Spatial anatomy + the combat verb list |
| — | DB | `specs/database.md` §spatial (l.128–148), §formulas (l.181), Registry (l.318–346), Access Patterns (l.351–366), Version Registry (l.383–395); both contract files | v1.5 additive revision |

## Context

The engine has no way to move a combatant. Today the only way is for the host to restore a
snapshot with new positions (grid-combat DD1/DD16). The human chose **movement as pack
data**:
- packs declare move actions whose effect is a new `move(<formula>)` statement, budgeted
  by a reserved `speed` formula and spent through the normal action slots;
- packs may use a **hex** grid;
- **terrain** (blocking and difficult) is pack-declared and placed by the host per fight;
- **opportunity reactions** are pack-declared reactions to a new `move:leaving-reach` event.

Every later session mirrors what you write here, so this session lands first and alone.
All changes are **additive-optional**. `schemaVersion` stays `1` and no rule id is added
(`E-SPAT-01` gains documented scope). This follows the v1.1–v1.4 precedent (Version
Registry rows 2–5).

## Capabilities

This session produces the approved text for CAP-M1…CAP-M7 and the contract legs of
CA-M1, CA-M2, CA-M3, CA-M4, CA-M5 and CA-M7 (STATE.md). It proves nothing at runtime.

## Contract Agreements

- **Checkpoint-0 recheck:** read STATE.md Design Decisions DD-M1…DD-M19 (including the
  [F-P…] amendments) and the "Planning completeness review (2026-09-30)" section. Every value below
  comes from them. If Spec/Designer/DB judgment or the human changes one, write the
  changed version and list each delta in the handoff with its DD id. Orchestrator then
  amends the CA rows and S02–S04 before S02 dispatch.
- **Facts verified by Planner at `02f8196`, re-verified by REPLAN-GM-01 at `67f383b`:**
  - `pack.schema.json` `$defs/spatial` is at line 185, with `model` `const "grid"`.
  - `snapshots.schema.json` combat combatant items close with `additionalProperties:
    false` at lines 185–226.
  - `REGISTRY` has 13 entries (`registry.ts`).
  - `RULE_IDS` has 15 entries, the last being `E-SPAT-01`.
  - The trigger grammar is `<type>[key=value]`, e.g. `[target=self]` (`triggers.ts:31-41`).
  - `offersForEvent` (`triggers.ts:62-81`) does not check whether the reactor can afford
    the reaction. `respond` removes the offer before any gate (`combat.ts:551`). A take
    whose reaction slot is spent is refused at `spend` (`action-economy.ts:178-185`),
    with one `declare:rejected {kind: 'slot-exhausted', resource: 'reaction'}`, rule
    `E-ECON-01`, and nothing else changed. A decline emits one `trigger:declined`.
  - Combat restore always sets phase `awaiting-declare` today (`snapshots.ts:554`), and a
    restored offer stores the trigger *pattern* as its matching event
    (`snapshots.ts:565`). DD-M12 [F-P2] documents the corrected behavior, which S03 will
    implement.
  - `rooted` restricts `actions.tagged:move` in all three themes.

## Files to Create/Modify

| File | Action | What Changes |
|------|--------|--------------|
| `program/Ruleswright/specs/requirements.md` | modify | FR-11: movement/hex/terrain/provoke acceptance criteria; Decision Log row |
| `program/Ruleswright/mocks/spatial.html` | modify | `model: "hex"`, `terrain` in the pack.json block; new sections: movement as a pack action, terrain, leaving reach; the `rooted` callout made concrete |
| `program/Ruleswright/mocks/api-map.html` | modify | `startCombat` terrain option; `declare(actionId, { targetId?, to? })`; `move:*` event names |
| `src/schema/contracts/pack.schema.json` | modify | `$defs/spatial`: `model` enum, `terrain`; `formulas` description: reserved `speed`, the `move` rules |
| `src/schema/contracts/snapshots.schema.json` | modify | combat combatant item: optional `pendingMove` |
| `program/Ruleswright/specs/database.md` | modify | status line v1.5; §spatial; §formulas; registry 13 → 14 note; E-SPAT-01 row scope; Snapshot Envelopes; Access Patterns; Version Registry row 6 |

## Implementation

### Checkpoint 1 — Spec: FR-11 amendment

Add these acceptance criteria to FR-11 (keep the existing four byte-identical):

- [ ] Packs may declare a **hex** spatial model beside the square grid. Hex positions are
  axial coordinates, and distance, reach and burst use hex distance.
- [ ] **Movement is pack data:** a pack declares move actions whose effect is `move(<formula>)`,
  budgeted by the pack's optional `speed` formula. A move is declared like any action,
  with a destination. It spends the pack's declared slots and is restricted by conditions
  like any tagged action (e.g. `rooted` restricts `actions.tagged:move`).
- [ ] The engine moves along the cheapest legal path. A move that cannot reach its
  destination within budget is rejected declaratively, with no state change.
- [ ] **Terrain is pack-declared:** kinds are either blocking or cost-per-cell (difficult).
  The host places terrain per fight, just as it places positions. The engine never invents
  a map.
- [ ] **Leaving reach is an event** (`move:leaving-reach`). Packs may declare reactions to it
  (opportunity attacks). A move pauses while such offers are open and resumes when they
  are answered.
- [ ] Theater-of-mind packs pay nothing: move actions resolve as no-ops, and packs with move
  content still load without a spatial model.

Add a Decision Log row: `2026-09-29 — grid-movement: movement as pack data (Option B); hex
model additive; terrain pack-declared + host-placed; provoke via pack reactions (human)`.

**Commit when:** FR-11's original four criteria are unchanged in the diff, the new ones are
present, and no other FR changed.

### Checkpoint 2 — Designer: spatial.html + api-map.html

Keep the file's style and palette exactly. In `spatial.html`:

1. Extend the pack.json block (verbatim anatomy S02 will mirror):
   ```
   "spatial": {
     "model": "hex",                 // or "grid" (square) — or omit the block
     "reach": { "default": 1, "weapons.long-spear": 2 },
     "shapes": ["single", "burst"],
     "terrain": { "bramble": { "cost": 2 }, "standing-stone": { "blocks": true } }
   }
   ```
2. New section **"Movement is an action, not a verb"**:
   - the `stride` action `{cost:{slots:{move:1}}, tags:["move"], effect:"move(speed)"}`;
   - `formulas.speed`;
   - `fight.declare('stride', { to: { x: 3, y: -1 } })`;
   - output block with `move:advanced` / `move:ended`;
   - rejection kinds (`no-destination`, `blocked`, `occupied`, `unreachable`,
     `out-of-range`: E-SPAT-01, nothing changes). Say plainly that:
     - `unreachable` means no legal path exists at any cost;
     - `out-of-range` means a legal path exists, but its cheapest cost exceeds the budget.
       A reachable destination is never `unreachable` [F-P9];
     - a declare whose `to` is the mover's own cell is `occupied`: the mover holds that
       cell (DD-M6). There is no new kind, no slot is spent and nothing changes
       [F-P10a].
3. New section **"Terrain"**:
   - kinds come from the pack; cells are placed by the host at `startCombat({ terrain:
     [{ at, kind }] })` and re-stated on restore;
   - occupancy rule DD-M6 (including the mover's own cell).
4. New section **"Leaving reach"**:
   - `move:leaving-reach` (actor = mover, target = threatener);
   - the `opportunist` reaction with `trigger.on: "move:leaving-reach[target=self]"`;
   - pause → `respond` → resume;
   - offers are raised once, only for the events of the call that produced them. Answering
     an offer never brings it back [F-P1];
   - offers are not filtered by affordability [F-P10b]. A threatener whose reaction slot
     is spent is still offered, and the move still pauses. The host answers:
     - `decline` → one `trigger:declined`;
     - `take` → one `declare:rejected` (`slot-exhausted`, `E-ECON-01`), nothing spent.

     Either answer clears the offer, and the move resumes once none remain;
   - resume re-checks: `downed` / `restricted` / `blocked`; `forfeited` on `step()`;
   - a paused move survives a snapshot: restore resumes in the resolved phase, so
     `step()` forfeits exactly as it would have without the restart [F-P2].
5. Make the `rooted` callout concrete: it restricts `stride` through its tag.
6. Theater-of-mind column: move = no-op success; terrain, like positions, rides along
   unconsulted.

In `api-map.html`:
- `rt.startCombat({ allies, enemies, positions?, terrain? }, opts?)`;
- `fight.declare(actionId, { targetId?, to? })`;
- add the three `move:*` event names beside the provenance-stream line.

**Commit when:** both files are well-formed HTML (open tags balanced; the pack.json block
parses as JSON once comments are stripped, checked by eye), and the anatomy above
appears verbatim.

### Checkpoint 3 — DB: contract v1.5 + database.md

**`pack.schema.json`** (read the whole file first; preserve formatting; the diff must be
reviewable as additive):

```json
"model": {
  "enum": ["grid", "hex"],
  "description": "grid = square grid, Chebyshev distance (v1.3). hex (v1.5) = axial coordinates {x: q, y: r}, hex distance (|dq|+|dr|+|dq+dr|)/2. Other models are future additive revisions, never silent aliases."
},
"terrain": {
  "type": "object",
  "propertyNames": { "pattern": "^[a-z][a-z0-9-]*$" },
  "additionalProperties": {
    "oneOf": [
      { "type": "object", "additionalProperties": false, "required": ["cost"], "properties": { "cost": { "type": "integer", "minimum": 1 } } },
      { "type": "object", "additionalProperties": false, "required": ["blocks"], "properties": { "blocks": { "const": true } } }
    ]
  },
  "description": "v1.5 — terrain vocabulary (FR-11): kind id -> {cost} (entering a cell costs this many movement points; plain cells cost 1) or {blocks: true} (never enterable). Cells are placed by the host per fight (startCombat terrain), never by the pack."
}
```

Add `terrain` to `$defs/spatial.properties`. Do not add it to `required`. Extend the
`formulas` description:
- reserved optional id `speed` (a movement budget; profiles evaluate it like
  `initiative`);
- effect scalar `speed`;
- the `move(formula)` rules: root statement of a non-triggered `actions.<id>.effect`
  only; dice-free argument; misuse `E-FORM-02`; `speed` referenced with no
  `formulas.speed` → `E-REF-01`.

**`snapshots.schema.json`:** add to the combat combatant item's `properties`:

```json
"pendingMove": {
  "type": "object",
  "additionalProperties": false,
  "required": ["actionId", "to", "remaining"],
  "properties": {
    "actionId": { "type": "string" },
    "to": { "type": "object", "additionalProperties": false, "required": ["x", "y"], "properties": { "x": { "type": "integer" }, "y": { "type": "integer" } } },
    "remaining": { "type": "integer", "minimum": 0 }
  },
  "description": "v1.5 — optional: a move paused by open leaving-reach offers (FR-11). Resumes when the offer queue empties. Unknown or non-move actionId = E-SNAP-01. Absent = no paused move. Restore derives the resolved phase when any combatant carries pendingMove or pendingTrigger (no envelope field)."
}
```

**`database.md`:**
1. Status line → v1.5, with a one-line note.
2. Schema Overview `spatial?` line: "grid/hex model, reach, shapes, terrain vocabulary".
3. §spatial table: `model` enum row, a `terrain` row, a movement paragraph (DD-M4/5/6/9,
   including own-cell = `occupied` [F-P10a], and `unreachable` vs `out-of-range` [F-P9]),
   and a provoke paragraph (DD-M10, including per-call offers [F-P1] and the
   spent-reaction-slot answer semantics [F-P10b], exactly as in STATE DD-M10).
4. §formulas: the reserved `speed` row + the `move` rules. `speed` is bound in combat
   (`profile.speed ?? 0`) and in out-of-combat item use (the pack's `speed` formula, else
   0) [F-P5]. The `E-REF-01` rule applies only to `speed` at a **formula position**; a
   damage type, condition id, shape or save name spelled `speed` is not a reference
   [F-P11]. Add a **compatibility note** [F-P11]: "A pack that uses a token `speed` at a
   formula position in an effect without declaring `formulas.speed` (for example, through
   an ability named `speed`) loaded under v1.4 and now fails `E-REF-01`. Declare
   `formulas.speed` to restore it. No bundled theme is affected."
5. Registry prose: E-SPAT-01's description gains "or a movement-gate rejection (no
   destination, blocked, occupied, unreachable, out of range) or an invalid terrain
   placement". Note "v1.5 adds no id".
6. Snapshot Envelopes: `pendingMove`. Add the derived restore phase and the restored offer
   `on` rule, exactly as in STATE DD-M12 [F-P2]:
   - the phase is `resolved` when any combatant carries `pendingMove` or
     `pendingTrigger`;
   - the restored offer's `on` is the trigger pattern's event type (its base before `[`).
7. Access Patterns: `Spatial geometry` → `(grid: Chebyshev · hex: axial)`, plus a
   `Movement` row.
8. Version Registry row `| 6 | 1 (v1.5) | builder-authorized 2026-09-29, grid-movement:
   hex model, terrain vocabulary, move(formula) + reserved speed (registry 13→14), snapshot
   pendingMove; additive-optional fields, no field removed/renamed, no rule id added,
   schemaVersion stays 1 — **one compatibility caveat:** a pack using a formula-position
   token `speed` in an effect without `formulas.speed` now fails E-REF-01 (see §formulas);
   no bundled theme affected | pack.schema.json · snapshots.schema.json revised |`.
   Do **not** write "purely additive" in this row [F-P11].

**Commit when:**
- both JSON files parse
  (`python3 -c "import json;[json.load(open(p)) for p in ['src/schema/contracts/pack.schema.json','src/schema/contracts/snapshots.schema.json']]"`);
- `required` arrays are unchanged;
- `pnpm typecheck` is 0 and `pnpm format:check` is 0 on the two JSON files (run
  `pnpm exec prettier --check src/schema/contracts/`). Grid-combat and equipment both
  needed a format-only residual, so format **before** committing.

## Verification

- JSON parse of both contracts; `git diff --stat` shows additive diffs only.
- `pnpm typecheck` 0 (no TS touched). `pnpm exec prettier --check src/schema/contracts/`.
- Cross-reference: `spatial.html`'s pack.json keys equal `$defs/spatial` properties;
  `api-map.html`'s option names equal database.md's.
- Cross-reference: the F-P1/F-P2/F-P9/F-P10a/F-P10b/F-P11 statements in spatial.html and
  database.md agree with STATE DD-M6/M7/M9/M10/M12 word for word in meaning. Report any
  wording you changed.

## State Update

Report:
- status and checkpoint count;
- each DD-M value as written (flag any delta);
- the exact JSON paths S02 must mirror: `spatial.model`, `spatial.terrain.<kind>.cost`,
  `spatial.terrain.<kind>.blocks`, `formulas.speed`, and the `pendingMove` fields;
- the final event names and rejection kinds;
- surprises.

`followUp` for S02: the `E-FORM-02` / `E-REF-01` wording for the `move`/`speed` rules.
`followUp` for S03: the provoke, per-call offer, spent-slot, resume and derived-phase
semantics exactly as written.
