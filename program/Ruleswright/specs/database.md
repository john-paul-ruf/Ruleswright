# Database Design — Ruleswright

> **Status:** v1.12, scoped Author re-entry (2026-10-16, AR-01–AR-06): optional lossless HP and exact departure history; three new portable play/adventure contract files; existing pack/override unchanged. Lease revision 2 resolves B-RA-XP through the already-approved injury/resource preservation contract below; contracts are not runtime implementation.
> Prior status: v1.11, revised — DB, schema-change Author re-entry (builder-authorized 2026-10-11, contract-conformance: combatant `hp` in combat snapshots has no lower bound — damage is not floored, hp ≤ 0 means down; loosening only, no rule id, no caveat); v1.10, revised — DB, schema-change Author re-entry (builder-authorized 2026-10-04, class-features: class features at `progression.<id>.features` grant a feat or unlock an action or spell at a class level; `content.classes.<id>.features` removed; refs resolve at load; no rule id; pre-release in-place revision, compatibility caveat (g); v1.9, revised — DB, Author re-entry (builder-authorized 2026-10-04, builder-rulings: out-of-combat restricts follow the in-combat rule; `awardXp` never lowers a class level; the feat-slotted predicate stated plainly; description only — no field, no rule id; two documented compatibility caveats (e) and (f); v1.8, revised — DB, schema-change Author re-entry (builder-authorized 2026-10-04, feat-progression: per-class feat slots `progression.<id>.featSlots`; additive-optional, no rule id added; one documented compatibility caveat (d) — a feat-slotted pack refuses learning past the cap and refuses to restore an over-cap character; v1.7: builder-authorized 2026-10-01, action-targeting: the `target(self, …)` shape word + self actions and the `ability(name)` formula function, registry 14→15; no field added, no rule id added, one documented compatibility caveat (c) — `target(self, …)` now resolves to the actor; v1.6: builder-authorized 2026-09-30, spells-in-combat: spells declarable in combat with a pack-declared range and empty-cell area centers, spend recorded in combat snapshots, characters hold feats, reactive feats offered, trigger grammar enforced, combat envelope offers/phase/offeredCount; additive-optional with two documented compatibility caveats — the `trigger.on` grammar and the legacy-read-only per-combatant `pendingTrigger` — no rule id added; v1.5: builder-authorized 2026-09-29, grid-movement: hex model, pack-declared terrain vocabulary, `move(formula)` + reserved `speed`, snapshot `pendingMove`; additive-optional with one documented `speed` compatibility caveat, no rule id added; v1.4: builder-authorized 2025-09-27, equipment-consumables: slot-based equipment + consumables + the `heal` effect, snapshot `equipped`/`itemsUsed`/`maxHp`; v1.3: optional spatial section (FR-11) + E-SPAT-01 registration; v1.2: UI B-1 class combat actions; v1.1: S-CONTRACT-GAP).
> v1.0 (phase `database`, final Author phase) approved; v1.1 adds the turn-economy
> declaration (`economy.turnSlots`) and action/spell `tags` with `restricts`
> reference semantics. Read with `specs/architecture.md` (approved),
> `specs/requirements.md` (approved), and `specs/design.md` (approved, v2).
> Rule ids referenced by the approved `validation-errors.html` mock are registered here verbatim.

---

## Engine

**None** — by Architect's decision, which binds this phase (DB.md: *never change the
architecture*). The engine performs no I/O of any kind (FR-14); hosts own all storage.
There are **no tables, no connections, no migrations** in the SQL sense.

What "persistence" means here, formally: the only documents that ever outlive a process
are **packs**, **overrides**, **adventure templates/definitions**, and **snapshots** — all plain JSON, all validated at load.
This document is the contract for those shapes. The equivalent of a migration path in
this stack idiom is the **versioned schema contract layer** in `src/schema/contracts/`:
JSON Schema documents that are the normative shape references for `schemaVersion 1`,
against which the hand-rolled validator (`src/schema/validate.ts`, Coder's) is
implemented and tested. The validator enforces; these files define.

**schemaVersion is the migration story** (FR-14, FR-23 — deferred by design in v1).
The discipline, formalized below: declare + validate at load, major = breaking,
no silent acceptance of foreign versions, loud refusal over mangling.

---

## Schema Overview

```
Pack (one JSON document, 8 required + 3 optional sections)
├── manifest        identity + schemaVersion + license/attribution + provenance
├── stats           name-keyed abilities and named saves
├── actions         action declarations: cost, validity, trigger?, tags?, effect
├── economy?        OPTIONAL turn-economy declaration: per-turn slot grants (FR-4)
├── spatial?        OPTIONAL spatial model: grid/hex model, reach, shapes, terrain vocabulary (FR-11)
├── equipSlots?     OPTIONAL declared equip-slot vocabulary (v1.4; FR-3/FR-9)
├── formulas        named formula-DSL expressions
├── content         classes · races · skills · feats · spells · conditions · items
├── progression     per-class tables: HD, attack table, saves, vancian slots, feat slots (v1.8)
├── bestiary        statblocks built from the same character machinery
└── tables          weighted / ranged / nested lookup tables (the one table engine)

Override document  — GM/author patches, merged at load (FR-19)
Snapshot envelopes — character · party · combat (FR-14; three independent serializers)
Play sidecars      — encounter session · adventure template/definition · whole adventure
```

All six contract files live at the real repo path:

```
src/schema/contracts/
├── pack.schema.json        — the pack document, schemaVersion 1 (v1.5)
├── snapshots.schema.json   — the three snapshot envelopes (v1.5)
├── override.schema.json    — the override/patch document
├── play-session.schema.json — complete encounter/session + restore inputs (v1.12)
├── adventure.schema.json — separate template + generated definition (v1.12)
└── adventure-snapshot.schema.json — progress/rewards/journal/director state (v1.12)
```

These are **data artifacts, not application code** — DB-owned permanently (see
*Version Registry*). The TypeScript validator, types, and ErrorCard registry in
`src/schema/*.ts` implement these contracts and belong to Coder.

---

## Artifact Identity & Reference Rules

These pack artifact rules are semantic validator duties (FR-2); every one maps to a registered rule id. Sidecar session/member ids below are opaque identities, not pack artifact ids.

| Rule | Contract |
|---|---|
| **Id grammar** | `^[a-z][a-z0-9-]*$` (kebab-case). Ids are the universal address; every artifact is addressable by stable id (FR-19). |
| **Global uniqueness** | An id must be unique **across the entire pack**, not merely within its section — overrides address artifacts by id, so a duplicate makes addressing ambiguous. → `E-DUP-01` |
| **Map-as-namespace** | Sections are JSON objects keyed by id (`content.spells["grave-light"]`). The key IS the id; a def object repeating a mismatched `id` field is an error. → `E-SCHEMA-02` |
| **Reference grammar** | Dotted paths from a section root: `bestiary.barrow-wight.claw`, `tables.district-scavenge`. Bare ids resolve within the consuming section's context. |
| **Referential integrity** | Every reference must resolve at validation time: action→condition, spell→class list, race cap→class, statblock→action/progression, table→table (nested), class feature `ref`→feat / action / spell (v1.10; see §progression *Class features (v1.10)*). → `E-REF-01`; unknown class specifically → `E-REF-02`; orphaned/missing progression for a declared class → `E-REF-03` |
| **Tag integrity (v1.1)** | A condition `restricts` pattern of the form `actions.tagged:<tag>` must reference a tag declared on at least one action or spell in the pack. → `E-REF-01`. This makes a condition's teeth statically checkable — a condition that can never bite is a broken reference, not a silent no-op. |
| **No ambient values** | **No timestamps, no ambient entropy, no environment reads anywhere in a generated pack.** Provenance is exactly `{theme, seed, knobs}` (FR-18). This is what makes byte-identical regeneration (FR-17) structurally possible rather than aspirational. |
| **Integers** | HP, slots, weights, durations, levels, and save entries are integers. Dice results are integer arithmetic throughout (sfc32, FR-1). |

---

## The Pack Document — Section Contracts

Canonical shape: `src/schema/contracts/pack.schema.json` (draft 2020-12, closed —
`additionalProperties: false` at every level; unknown fields are errors, → `E-SCHEMA-02`).

### `manifest`
| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | string | kebab id, required | Pack identity; snapshots bind to it |
| `schemaVersion` | integer | `const 1` | The FR-23 contract; validated against the engine's supported range |
| `title` | string | required | Human-facing |
| `license` | string? | — | **Carried and surfaced, never enforced** (FR-2, Q7) |
| `attribution` | string? | — | Same discipline |
| `provenance` | object? | `{theme, seed, knobs}` exactly | Knob values recorded (FR-18); no other keys permitted — determinism |

### `stats`
| Field | Type | Constraints | Notes |
|---|---|---|---|
| `abilities` | string[] | ≥ 1, unique, kebab | **Name-keyed**; the engine stores by string (FR-5). v1 validator enforces the six-ability convention |
| `saves` | string[] | ≥ 1, unique, kebab | Pack declares which named saves exist (five in the classic-CRPG sample) |

- **Reserved ids (v1.4):** no ability or save id may equal `gear-hp`, `gear-ac`,
  `gear-initiative` or `gear-armor` → `E-SCHEMA-01`. Those names are the equipment
  variables of the `formulas` section (see §formulas); a stat with the same name would make
  a formula reference ambiguous.

### `economy` — OPTIONAL (v1.1)
Turn-economy declaration: the grant source for the generic slot/points economy (FR-4).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `turnSlots` | object | required; ≥ 1 entry; keys kebab ids; values integer ≥ 1 | Slot name → slots granted **per turn**. e.g. `{"main": 1, "move": 1}` — the classic structure as data |

- **When `economy` is present:** every action `cost.slots` key must resolve to a
  `turnSlots` key → otherwise `E-ECON-01`. The economy is the pack's authority on
  slot names; the engine has no built-in slot vocabulary (FR-4).
- **When `economy` is absent (documented engine default):** each combatant is granted
  **1 of each slot name appearing in any action `cost.slots`** in the pack, per turn.
  The default is engine-documented, not schema-minted; packs that want other grants
  declare `economy`.
- **Slot *spending*** is per-turn and per-combatant: grants replenish at the start of
  the combatant's turn. Slot use is a combat transient; it is not character state and
  does not appear in character snapshots.

### `spatial` — OPTIONAL (v1.3; v1.5 hex + terrain)
Spatial model declaration (FR-11): positions/adjacency/reach for packs that want geometry.
Mock anatomy, verbatim from `mocks/spatial.html`: `{model: "hex" | "grid", reach: {default, <label>: n}, shapes?, terrain?}`.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `model` | string | enum `"grid"` \| `"hex"` (v1.5; was `const "grid"`) | `grid` = square grid, Chebyshev distance (v1.3, unchanged); square movement uses 8 neighbors and a diagonal step costs 1 (v1.5). `hex` (v1.5) = positions reuse `{x, y}` as axial `{q, r}` (no snapshot shape change); hex distance `(\|dq\| + \|dr\| + \|dq + dr\|) / 2`; 6 neighbors in the fixed order `(+1,0), (+1,−1), (0,−1), (−1,0), (−1,+1), (0,+1)`. Reach, `adjacent` and burst all use the pack's distance. Other models are future additive revisions, never silent aliases |
| `reach` | object | required | Melee reach map; `reach.default` (integer ≥ 1) is the base — 1 = adjacency |
| `reach.<override-id>` | integer | ≥ 1; free-form labels | Per-id reach overrides are **direct siblings of `default`** (spatial.html verbatim: `"weapons.long-spear": 2`). Runtime resolves a combatant's reach by combatant/artifact id: `reach[id] ?? reach.default`. Dotted artifact paths are a documented v2 seam; no idPattern constraint on override keys in v1 |
| `shapes` | string[]? | unique; values ⊆ {`single`, `burst`} | Documented shape set (FR-11): v1 ships single + burst only; cone/line are deferred engine geometry and cannot be declared (→ `E-SPAT-01`) |
| `terrain` | object? (v1.5) | keys kebab ids; each value exactly one of `{cost: integer ≥ 1}` or `{blocks: true}` (`additionalProperties: false`) | The terrain **vocabulary** (FR-11): kind id → `{cost}` (entering a cell of that kind costs this many movement points; plain cells cost 1) or `{blocks: true}` (never enterable). Cells are placed by the host per fight (`startCombat({ …, terrain: [{ at: {x, y}, kind }] })`), never by the pack; malformed kinds → `E-SCHEMA-01` |

- **Theater-of-mind default:** an **absent** section = no adjacency checks, no position
  state; packs without it pay nothing (FR-11). Same combat loop, same events — nothing
  else changes.
- **Positions are host-declared per combatant**; the engine never invents a grid. They ride
  the combat envelope's existing `combatants[].position` field (`snapshots.schema.json`,
  anticipated in v1.0) — no snapshot contract edit was needed for v1.3.
- **Validation split:** missing/mistyped `spatial` fields are structural (→ `E-SCHEMA-01`,
  consistent with `schemaVersion const 1` handling); declared-but-unshippable geometry —
  model or shape outside the shipped set — is semantic (→ `E-SPAT-01`: the pack opts into
  geometry the engine does not ship).
- **Terrain placement (v1.5):** the engine never invents a map (the same discipline as
  positions). `startCombat` refuses — one `E-SPAT-01` aggregate, nothing built — when a
  placed kind is unknown, a cell is placed twice, or a combatant starts on a blocking cell.
  Restore re-states terrain (`CombatRestoreRequest.terrain?` mirrors `startCombat`, with the
  same refusals). Terrain given to a pack with no spatial section rides along and is never
  consulted, like positions.
- **Movement (v1.5, FR-11):** movement is pack data — a move action whose effect is
  `move(<formula>)` (see §formulas), declared as `fight.declare(actionId, { to: {x, y} })`.
  There is no engine move verb. The engine computes the **cheapest legal path**: Dijkstra
  with the fixed neighbor order as tie-break (deterministic), exact over a region-bounded
  search (the bounding box of `from`, `to`, every placed terrain cell and every combatant
  position, expanded by one cell). Square movement uses 8 neighbors and a diagonal step
  costs 1; hex uses the 6 axial neighbors. Entering a cell of kind `k` costs
  `terrain[k].cost` (plain = 1); a `blocks` cell is never entered. Each declare is one move
  up to the budget; unspent budget is lost. **Occupancy:** a move cannot end on a cell held
  by a standing combatant — **this includes the mover itself**; it may pass through standing
  allies but not standing enemies; downed combatants (hp ≤ 0) never block. The movement gate
  runs where the reach gate runs, before cost; a move action targets its actor (no opponent
  resolution, no reach gate). Rejections are one `declare:rejected`, rule `E-SPAT-01`, with
  no state, RNG or ledger change. Kinds: `no-destination` (move action without `to`);
  `blocked` (destination is a blocking cell); `occupied` (a standing combatant is there,
  including the mover itself — a declare whose `to` is the mover's own cell is `occupied`:
  no new kind, no slot spent, nothing changes); `unreachable` (no legal path exists at any
  cost); `out-of-range` (a legal path exists, but its cheapest cost > budget). **A reachable
  destination is never reported `unreachable`, whatever its cost.** Events:
  `move:advanced {from, to, path, cost, remaining}` per contiguous segment, and
  `move:ended {reason: arrived | downed | restricted | blocked | forfeited, at}`. In a pack
  without `spatial`, a move action resolves as a no-op success: `to` is ignored and nothing
  is emitted beyond `action:resolved`; move content still loads.
- **Provoke (v1.5, FR-11):** before each step, if the mover's current cell is within reach
  of a standing opposing combatant and the next cell is not, the engine emits
  **`move:leaving-reach`** (actor = mover, target = threatener, payload `{at, next}`). Packs
  react with `trigger.on: "move:leaving-reach[target=self]"` (the existing `eventMatches`
  grammar; no grammar change). Reach is the existing `canReach` (`≤ max(reach,
  defaultReach)`, preserved).
  - **Offers are per call:** a call (`declare`, `respond`, `use`) offers reactions only for
    the events *that call* emitted, collected with a per-call sink; it never replays the
    round window. Each matching (reactor, event) pair is offered **exactly once**; after the
    only offer is taken or declined, `pendingTriggers` is `[]`. There is exactly one
    `trigger:fired` per matching event and at most one `trigger:declined` per offer. The
    return value of `declare`/`respond` is unchanged (still the round window).
  - **Pause:** if ≥ 1 offer surfaces, the move pauses at the current cell and the mover
    carries `pendingMove {actionId, to, remaining}` (see §Snapshot Envelopes).
  - **Offers are not filtered by affordability:** a threatener whose reaction slot is
    already spent still gets an offer, and the offer still pauses the move. The host
    answers it: `respond(id, 'decline')` removes the offer and emits one `trigger:declined`;
    `respond(id, 'take', moverId)` removes the offer first, then is refused at spend —
    exactly one `declare:rejected {kind: 'slot-exhausted', resource: 'reaction'}`, rule
    `E-ECON-01`; no slot, pool, hp or RNG changes, and no `trigger:declined` is emitted.
    Both answers count as answered: the offer has left the queue.
  - **Resume:** when the offer queue empties (every offer answered, take or decline,
    including a refused take), the move resumes automatically: mover downed → end, reason
    `downed`; an active condition now restricts the action's tags → end, reason
    `restricted`; otherwise re-plan from the current cell with the `remaining` budget, and
    no path → end, reason `blocked`.
  - **Forfeit:** `step()` while paused forfeits the move (reason `forfeited`) before its
    usual effect.
  - `respond` keeps its target resolution: to take an opportunity reaction with several
    opponents, the host passes the mover as `targetId`. Packs without matching reactions
    never pause.

### `equipSlots` — OPTIONAL (v1.4)
Declared equip-slot vocabulary (FR-3 "…and equipment", FR-9 armorCasting). A root-level
array alongside `actions`/`economy`/`spatial` — **not** inside `content`.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `equipSlots` | string[] | ≥ 1 entry, unique, kebab ids | e.g. `["body", "main-hand", "charm"]`. The pack's authority on slot names; the engine has no built-in slot vocabulary |

- **Own vocabulary:** slot ids are like economy slot names — they are **not** artifact ids
  and do not enter the global-uniqueness namespace (`E-DUP-01` does not apply; a slot may
  share a spelling with an artifact id).
- **Resolution:** every `content.items.<id>.slots` entry must resolve to an `equipSlots`
  entry → `E-REF-01`.
- **Validation split:** empty, duplicate or non-kebab entries are structural →
  `E-SCHEMA-01`; unresolved item slot references are `E-REF-01`.
- **Absent section:** the pack declares no equipment slots; no item can be equippable
  (any item `slots` would dangle → `E-REF-01`). Packs without it pay nothing.
- **Equipment state** (one item per slot) is character state — see §Snapshot Envelopes
  (`equipped`).

### `actions`
Map `actionId → ActionDef`:

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `cost` | object | ≥ 1 of: `slots` (map slotName→uint), `points` ({pool, amount}), `vancian` (uint level) | Generic slot/points economy (FR-4); `vancian` consumes a **bound** slot (FR-8) |
| `valid` | string? | formula DSL | Validity conditions, e.g. `hasTarget(adjacent)` |
| `trigger` | object? | `{on: eventPattern}` | Presence makes the action reactive; rides the event substrate (FR-4/13). **v1.6:** `on` must match the `eventMatches` grammar (DD-S13, below); any other form is `E-FORM-01` |
| `effect` | string | effect DSL, required | Parsed once at load → AST (FR-3); parse failure → `E-FORM-01` |
| `tags` | string[]? | unique, kebab ids | Coarse categories for `restricts` matching (FR-7) — e.g. `["main"]`, `["casting"]`. Not a targeting mechanism; the tag vocabulary is pack-local, engine-blind (v1.1) |

**Trigger grammar (v1.6, DD-S13).** `trigger.on` — on actions and feats alike — is the
`eventMatches` grammar: `<eventType>` or `<eventType>[target|actor=self|<id>]` (`self` = the
reactor), i.e. the regex `^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)*(\[(target|actor)=[a-z][a-z0-9-]*\])?$`
(the `pattern` in `pack.schema.json`). Any other form can never fire and is refused at
load with `E-FORM-01` at `<base>.trigger.on`; no new rule id. The bare forms
(`enemy-approaches`, `damaged`) still pass. This follows the v1.1 tag-integrity precedent:
a pattern that can never fire is a broken reference, not a silent no-op. Compatibility
caveat (a), Version Registry row 7.

**Self actions and the `self` shape (v1.7, DD-A1/A2).** Builder-authorized 2026-10-01
(action-targeting, B-AT-1).

- **The `self` shape (DD-A1).** `target(self, <effect>)` scopes `<effect>` to the **actor**: the
  declaring combatant, the reactor, the feat holder, or the item user. This holds in grid,
  hex and theater-of-mind packs alike, at any depth (the root, inside `sequence`, inside a
  `save` branch). `self` is a shape word of the `target` statement, beside `adjacent` and
  `burst-<r>`. It is not a function and adds no registry entry: the shape argument is already
  an open name vocabulary, so `target(self, …)` parses and validates as before, and only its
  play-time meaning is new. `hasTarget(self)` holds whenever the actor stands.
- **Self actions (DD-A2).** An **action** whose parse-once effect **root** is
  `target(self, …)` is a **self action**. Declared, or taken as a reaction, it binds its actor
  as its target. It runs no opponent resolution, so there is no `no-target`, and no reach
  gate (as for move actions, DD-M9).
- **Root-only rule (limitation).** Only an action whose parse-once effect **root** is
  `target(self, …)` is a self action. An action whose effect is
  `sequence(target(self, …), …)` (or nests `target(self, …)` anywhere below the root) is an
  ordinary action: it still binds an opponent through the usual opponent resolution and
  reach gate, and the inner `self` resolves to the actor.
- **Gates.** A self action still runs the restriction, validity and cost gates, in the same
  order. A `targetId` other than the actor → `{kind: 'invalid-target', rule: 'E-REF-01',
  resource: <targetId>}`, and nothing changes. A `targetId` equal to the actor's id is
  accepted.
- **Events.** The effect's events name the actor as both actor and target (`why.rule`
  `actions.<id>`), then `action:resolved {actionId, targetId: <actor>}`. A self action's
  `condition:applied` names the actor as target, so the actor's own
  `condition:applied[target=self]` feats are offered (existing trigger semantics, DD-S13; no
  new behavior).
- **Spells are not self actions.** DD-S8 targeting applies (see §content spells), and a
  `self` inside a spell's effect resolves to the caster.
- **Compatibility caveat (c), Version Registry row 8.** A v1.6 pack that wrote
  `target(self, …)` resolved it to nobody (grid/hex: an unknown shape) or to the bound target
  (theater-of-mind). v1.7 resolves it to the actor. No bundled theme used it.

### `formulas`
Map `formulaId → {params?: string[], expr: string}`. Pure data; the function registry is
closed and versioned with the schema — extension is a schema event, never an escape hatch
(NFR-Security). Unknown function → `E-FORM-02`; unknown ability/save name → `E-FORM-03`.

**Equipment variables (v1.4, FR-3):** expressions in the `formulas` section — and **only**
there — may read four variables:

| Variable | Value |
|---|---|
| `gear-hp` | sum of the reserved grant key `hp` over every equipped item |
| `gear-ac` | sum of `ac` over every equipped item |
| `gear-initiative` | sum of `initiative` over every equipped item |
| `gear-armor` | sum of `armor` over every equipped item |

- **0 when nothing is equipped**, and 0 wherever unbound (e.g. statblocks): a pack that
  never equips evaluates byte-identically to v1.3.
- **The formula decides direction; the engine adds nothing on its own** (Q2). An
  ascending-AC pack writes `10 + gear-ac`; a descending-AC pack writes
  `12 - floor(level / 3) - gear-ac`. Descending AC stays expressible.
- Every other DSL field (action `effect`/`valid`, spell `effect`, feat `passive`/`effect`,
  item `use`, `attackBonus`) keeps its v1.3 vocabulary; a `gear-*` name there is an
  unknown identifier (`E-FORM-03`).

**Registry note (v1.4):** the frozen effect registry grows **12 → 13** with
`heal(formula)` — arity 1, kind `effect`, signature `['formula']`. It executes as a
negative-amount `damage` mutation (the executor's honest total, positive or negative) and
clamps at the target's max hp: out of combat the character's derived `hp` with equipment
grants; in combat the combatant's `maxHp`. A heal never raises hp above the cap and never
lowers hp. Extension of the registry is a schema event (CA-2 / NFR-Security) — **this
revision is that event**. No new rule id: an unknown function remains `E-FORM-02`.

**Movement budget (v1.5, FR-11):**

| Id / statement | Contract |
|---|---|
| `formulas.speed` | **Reserved optional formula id** — a movement budget, evaluated like `initiative` into `CombatantProfile.speed` for characters and statblocks. The profile carries `speed` **only when `formulas.speed` is declared**; it is omitted otherwise |
| effect scalar `speed` | Engine-derived effect scalar (added to the effect scalars beside `hp`/`ac`; like them it shadows a same-named ability inside effect vars). **In combat** it binds to `profile.speed ?? 0`. **Out of combat**, item use (`useItem`) binds it too: the pack's `speed` formula evaluated for the character when `formulas.speed` is declared, otherwise `0` |
| `move(formula)` | Effect registry **13 → 14** (arity 1, kind `effect`, signature `['formula']`). Legal **only as the root statement** of a **non-triggered `actions.<id>.effect`**. Nested inside `sequence`/`target`/`save`, or used in spells, feats, items' `use`, or triggered actions → `E-FORM-02`. The argument must be **dice-free** — the budget is evaluated at declare time, before cost, and must not consume RNG → a dice argument is `E-FORM-02` |
| `speed` reference rule | An effect that references `speed` **at a formula position** in a pack with no `formulas.speed` → `E-REF-01` at load. A token `speed` at a non-formula position — a damage type (`damage` arg 2), a condition id (`applyCondition` arg 1), a shape (`target` arg 1) or a save name (`save` arg 1) — is **not** a reference |

- **Compatibility note (v1.5):** A pack that uses a token `speed` at a formula position in an
  effect without declaring `formulas.speed` (for example, through an ability named `speed`)
  loaded under v1.4 and now fails `E-REF-01`. Declare `formulas.speed` to restore it. No
  bundled theme is affected.
- Registry extension is a schema event (CA-2 / NFR-Security) — **this revision is that
  event** (13 → 14). No new rule id: misuse of `move` is `E-FORM-02`, an undeclared `speed`
  is `E-REF-01`.

**`ability(name)` (v1.7, DD-A4).** Builder-authorized 2026-10-01 (action-targeting,
B-AT-1). Formula registry **14 → 15**: `ability` — arity 1, kind `formula`, signature
`['ability-name']`.

| Aspect | Contract |
|---|---|
| Where legal | **Only inside effect-kind DSL fields:** action `effect`, spell `effect`, feat `effect`, and item `use`. Anywhere else (`valid`, feat `passive`, `attackBonus`, the `formulas` section, …) → `E-FORM-02` |
| Argument | A bare name (a name position, not a formula reference) that must be declared in `stats.abilities`, else `E-FORM-03` with did-you-mean. Because it is a name position, `ability(speed)` is not a `speed` reference under the v1.5 rule |
| Value | The **actor's** ability `name`, as the effect vars compose it (equipment grants included): in combat the combatant profile's abilities; out of combat (item `use`) the character's derived abilities. Never a save, never an effect scalar (`hp`, `ac`, `speed`), never the target's |
| Binding | The reserved effect-var key `ability:<name>`. A `:` can never appear in a DSL name, so the key cannot collide. A missing key at play time throws (fail closed) |

- **Why it exists.** Abilities and saves share one namespace. In effect vars a save shadows
  the same-named ability, which `save` recipes (`d20 + <save>`) need, so a bare `vigor` in an
  effect is the save wherever both are declared (zombie-urban declares `vigor` as both).
  `ability(vigor)` reads the ability; the bare-name meaning is unchanged.
- Registry extension is a schema event (CA-2 / NFR-Security) — **this revision is that
  event** (14 → 15). No new rule id: misuse is `E-FORM-02`, an undeclared name is
  `E-FORM-03`.

### `content`
Seven maps, keyed by id: `classes`, `races`, `skills`, `feats`, `spells`, `conditions`, `items`.
Highlights (full field lists in the JSON Schema):

- **conditions**: `duration` (uint ≥ 1), `stacking` (`refresh | stack | ignore` — pack-declared policy, FR-7), `restricts?` (array of action tag patterns — the "teeth", e.g. blocks casting actions). **v1.1:** each pattern `actions.tagged:<tag>` must reference a tag declared on at least one action or spell → `E-REF-01` (see *Tag integrity*). (v1.6: combat declares also match spells against `actions.tagged:`; v1.9: so do `isRestricted`/`restrictedIds` out of combat; see spells)
- **classes** (v1.2): optional `actions` — unique action ids a character of this class may declare in combat, the character-side mirror of `Statblock.actions` (FR-16: monsters and characters ride the same action machinery). Each id must be a key of the pack's `actions` map → `E-REF-01`. Absent = the class grants no combat actions. No level gating in v1 (all listed actions are available from class level 1); level-gated grants are a future additive field. **v1.10:** class features are not a class field; they live in `progression.<id>.features` (see §progression *Class features*). A level-gated action grant is a class feature whose `ref` is an action.
- **spells**: `magic` ({level: 1–9, lists: class ids}) + `cost` (vancian level or pool draw) + `effect` + optional `targeting` = `{shape, radius?, range?}` ({shape: `single | burst`, radius: uint, required iff burst; range: uint, optional, v1.6}) + optional `tags` (same matching semantics as action tags — spells participate in `restricts` checks through the same matcher as actions, in combat (v1.6) and out of combat (v1.9), FR-9).
  **v1.6 — spells in combat** (builder-authorized 2026-09-30; STATE DD-S2, DD-S4, DD-S5,
  DD-S8, DD-S10, DD-S17, DD-S18, DD-S19):

  - **No cast verb (DD-S4).** A spell is declared like an action:
    `fight.declare(spellId, { targetId? | at? })`. Lookup is `actions[id]` first, then
    `content.spells[id]` (one id namespace, `E-DUP-01`). A combatant may declare a spell only
    if the id is in its `spells` list (`profileFromCharacter` sets it to the character's known
    spells, emitted only when non-empty); otherwise `no-action` (`E-REF-01`),
    `combatant "<id>" does not know spell "<spellId>".` **Only characters cast (DD-S2):**
    statblocks gain no spell field, so a monster declaring a spell id is `no-action`.
    Every `why.rule` of the cast uses the rule base `content.spells.<id>`.
  - **Gate order:** restriction → target or `at` → **range** (spells; actions keep the reach
    gate) → armor (vancian only) → cost (turn slots, then the bound slot or pool points). A
    rejected declare is one `declare:rejected` and changes nothing — slots, pools,
    `slotsCast`, `poolsSpent`, RNG.
  - **Pool spells are cast in combat (DD-S5).** A `cost.points` spell draws from the
    combatant's pool and records `poolsSpent`. Out-of-combat pool casting is still not a verb.
  - **Range (DD-S8).** `targeting.range` is an optional integer ≥ 0 in the pack's own
    distance (`runtime.spatial.distance`: grid Chebyshev steps, hex axial steps), measured
    from the caster's position to the target combatant's position or to the `at` cell; range
    0 = the caster's own cell only. A spell declare never runs the reach gate; it runs the
    range gate instead. Out of range → `{kind: 'out-of-range', rule: 'E-SPAT-01', resource:
    <targetId> | "<x>,<y>"}`, message `spell "<id>" has range <r>; <target> is <d> away.`,
    nothing changes. **Range fallback (DD-S8 a):** absent `targeting.range` = the caster's
    effective reach: max(its reach entry, `spatial.reach.default`), the value the reach gate
    uses, so a pack without ranges behaves as it did under the reach gate.
  - **Empty-cell area centers (DD-S8).** A `burst` spell may be declared with
    `{ at: { x, y } }` instead of a `targetId`; the cell may be empty, occupied or terrain.
    The burst resolves every standing combatant within its radius of that cell, both sides
    (the caster included when inside). A blast that catches nobody is a legal cast: the cost
    is spent, `spell:cast` and `action:resolved` are emitted, and there are no effect events.
    **`at` refusals** (`invalid-target`, `E-REF-01`, nothing changes): `at` together with
    `targetId`; `at` on a spell whose shape is not `burst` (absent `targeting` = single);
    `at` on an action; `at` on a burst spell whose parse-once effect root is not
    `target(burst-…)`.
  - **Targets (DD-S8).** A spell's `targetId` may name any combatant, either side, the caster
    included. With neither `targetId` nor `at`: the only opponent, else `no-target`. **No line
    of sight** in v1; terrain never blocks a spell. **Theater-of-mind** packs never consult
    range, ignore `at`, and resolve a burst to the bound target. **v1.7 (DD-A2, DD-A6):** a
    spell is never a self action, so this targeting is unchanged, and a `self` inside a
    spell's effect resolves to the caster.
  - **Restricts and spells (DD-S10; symmetric since v1.9, builder-rulings DD-R3).** A spell
    is blocked while an active condition carries `actions.tagged:<t>` or `spells.tagged:<t>`
    and `<t>` is one of the spell's tags (a spell is an action, FR-9) — in a combat declare
    **and** out of combat: `isRestricted(runtime, character, 'spell', id)` and
    `restrictedIds(runtime, character, 'spell')` apply the same rule (v1.9; v1.6 matched by
    kind out of combat). Actions are unchanged everywhere: only `actions.tagged:` restricts an
    action. A pattern naming a tag no action or spell declares matches nothing. Load-time tag
    integrity still checks `actions.tagged:` patterns only.
  - **Binding pick (DD-S18).** A vancian spell at level `L = magic.level` consumes the
    **lowest** index `i` with `bindings[L][i] === spellId` and `i` not in `slotsCast[L]`; none
    → `{kind: 'vancian', rule: 'E-VANC-01', resource: L}`,
    `no uncast level-L slot is bound to "<spellId>"`. A vancian **action** consumes the
    lowest uncast index whose binding is non-null, or, for a count-only combatant (no
    `bindings`), the lowest uncast index `< boundSlots[L]`. The index is recorded in
    `slotsCast[L]` and `boundSlots[L]` decrements.
  - **Events (DD-S17).** A successful spell declare emits, in order: `spell:cast {spellId,
    targetId? | at?, cost: 'vancian' | 'points' | 'none', slotLevel?, slotIndex?, pool?,
    amount?}` (actor = caster; exactly one of `targetId`/`at`); the effect's events
    (`why.rule` `content.spells.<id>`); then `action:resolved {actionId: spellId, targetId}`
    — or `{actionId: spellId, at}` for an empty-cell cast. The out-of-combat `spell:cast`
    payload is unchanged.
  - **Per-target defender values (DD-S19).** Inside a shape scope, every scoped target saves
    with its **own** save value and an attack compares against its **own** defense, not the
    primary target's. **Consequence (no code change):** per-target values apply to saves and
    defenses inside a shape scope. A DC or an attack bonus is still evaluated from the
    caster's vars bound to the primary target, so it sees the primary target's saves (for an
    `at` cast, the caster's own). Evaluating a defense per target draws dice per target only
    when the defense formula rolls dice. No bundled pack's does, so bundled RNG order is
    unchanged.
  - **Spend and settlement.** The fight never writes the character; the spend is recorded on
    the combatant (`poolsSpent`, `slotsCast`; see Snapshot Envelopes v1.6) and the host
    settles it after `combat-over` with `settleSpellCasts` (CA-S3). A spell is an action with metadata — there is no magic subsystem (FR-9). Class/armor casting restrictions live on classes (pack data).
- **races**: `caps?` (map classId → uint max level — the classic cap curve, FR-6); unknown classId → `E-REF-02`. `size?` (`small | medium | large`, default medium, documented no-op for adjacency in v1 — FR-11 seam).
- **feats**: passive or reactive (`trigger.on`); the sample packs ship ≥ 1 reactive feat (FR-12 proof 2).
  **v1.6 — feats held and offered** (STATE DD-S11, DD-S12, DD-S13):
  - **Characters hold feats (DD-S11).** `learnFeat(runtime, state, featId)` (facade
    `character.learnFeat(id)`) rejects an unknown feat (`unknown-feat`) and a feat already
    held (`feat-known`; **v1.10:** also refused for a feat the character is currently granted by a class feature, see §progression *Class features (v1.10)*), and emits `feat:learned {featId}`. `CharacterState.feats` is absent
    until the first learn (the `equipped` presence rule). **v1.8:** learning is capped by the
    character's feat slots when the pack declares them (see §progression *Feat slots*); a
    pack that declares none keeps the uncapped v1.6 behaviour.
  - **Reactive feats in combat (DD-S12).** A combatant's `feats` hold every reactive feat
    the character has learned **or (v1.10) is granted by a class feature** (see §progression
    *Class features (v1.10)*). A matching event offers the feat exactly as a reactive action
    is offered (per call, once per (reactor, event), never to a downed combatant);
    `trigger:fired` carries `source: 'feat'` and `why.rule` `content.feats.<id>.trigger`.
    **Take:** the feat costs nothing and passes no restriction or reach gate; its parse-once
    effect runs with the **holder** as its target (`why.rule` `content.feats.<id>`); a
    `targetId` other than the holder is `invalid-target`. **Decline:** one
    `trigger:declined`. **No chain:** events emitted while a feat resolves never offer feats
    (reactive actions may still be offered), so a feat cannot trigger itself.
  - **Grammar (DD-S13):** feat `trigger.on` follows the same `eventMatches` grammar as
    actions (see §actions); anything else is `E-FORM-01`.
- **skills**: `ability` (must name an ability declared in `stats`).
- **items** (v1.4): `name`, `kind?` (free string; the armor type `armorCasting` names), plus
  three optional fields:

  | Field | Type | Constraints | Duty |
  |---|---|---|---|
  | `slots` | string[] | ≥ 1, unique, kebab | The declared slots the item **may** be equipped into; one equip places it in exactly one of them. Presence makes the item equippable. Each id must resolve in `equipSlots` → `E-REF-01` |
  | `grants` | object | key → integer; **no dice** (FR-1 determinism); `armor` ≥ 1 | Applied while equipped. **Ability or save key:** the value is **added** to that stat (never a replacement); a key naming both an ability and a save adds to both. **Reserved key** `hp` / `ac` / `initiative` / `armor`: summed over equipped items and exposed only to `formulas` as `gear-*` (see §formulas). Any other key → `E-REF-01`; non-integer value or `armor` < 1 → `E-SCHEMA-01` |
  | `use` | string | effect DSL | Same grammar actions and spells use (e.g. `heal(2 + vigor)`); parsed once at load. Presence makes the item consumable; one use consumes one unit. `E-FORM-01/02/03` as for any DSL field |

  **Armor marker (CA-EG3):** an item is armor iff its grants include the reserved key
  `armor`; casting a slot-prepared spell while armor-equipped requires one of the
  character's classes to declare the item's `kind` in `armorCasting`. Scope: **vancian** casting only (DD-EG5, kept in v1.6). Point-pool
  spells are cast in combat (v1.6) and are not armor-gated. Packs whose casters are
  point-pool-only carry armor content as validation coverage. In combat (v1.6, DD-S6) a
  vancian spell declared while the combatant's `castBlockedBy` is set is rejected
  `{kind: 'armor-not-castable', rule: 'E-REF-01', resource: <itemId>}`, after the
  target/range gates and before cost. The rejection is a runtime rule error
  (`armor-not-castable`), not a load-time card.

### `progression`
Map `classId → ClassProgression`, **required for every id in `content.classes`** (→ `E-REF-03`):

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `hd` | enum | `d6 | d8 | d10 | d12` | Hit die per level |
| `attackTable` | array? | rows: `{level, byDefense: {"<defense>": toHit}}` | The classic class attack table **as data**; defense keys are pack-convention (descending-AC tables are just keys `"2"…"9"`). The engine never knows which convention (FR-3) |
| `attackBonus` | string? | formula DSL | The ascending-AC alternative. **XOR with `attackTable`** (semantic rule) — a class declares exactly one convention |
| `saves` | map | saveName → per-level int array | Array length = max level; names must exist in `stats.saves` |
| `slots` | map? | spellLevel → per-level int array | Vancian slot tables (FR-8); levels need not be contiguous |
| `featSlots` | int array? | each ≥ 0; non-decreasing; length ≥ the class's level ceiling (its shortest `saves` array) | **v1.8.** Feats the class grants **in total** at each class level (index 0 = level 1) — a running total like `saves`, not an increment. See *Feat slots* below |
| `features` | array? | `{level, ref}`: `level` integer 1..the class's level ceiling; `ref` a feat, action or spell id; unique per class | **v1.10.** Granted feat or unlocked action/spell from that class level on. See *Class features* below |

**Feat slots (v1.8, feat-progression DD-F1…F6).** FR-6 lists feat slots among the
progression tables; v1.8 adds them as one optional field per class (builder-authorized
2026-10-04: "1 per class per level - 2 refuse - 3 approved").
- **Per class per level (DD-F1).** `featSlots[L - 1]` is the class's **total** at class
  level L — a level-indexed running total, like `saves`, not an increment.
- **Multi-class (DD-F2).** A character's feat slots are the **sum** over its classes of
  `featSlots[level - 1]`, as vancian slots add across classes.
- **Opt-in (DD-F3).** A pack is *feat-slotted* when **any** `progression` entry declares
  `featSlots`. In a feat-slotted pack, a class without the field contributes **0**. A pack
  that declares none has **no cap** — the v1.7 behaviour, unchanged. **Any** class counts,
  including one only statblocks use: the pack format has no player/monster class
  distinction (every progression entry pairs with a `content.classes` entry, E-REF-03), so a
  pack author who slots one class should slot every class a character may take (builder
  ruling 2026-10-04, builder-rulings DD-R5).
- **Every held feat (DD-F5)**, passive or reactive, occupies one slot.
- **Load (DD-F4).** A non-integer or negative entry, an empty array, a decrease from one
  level to the next, or an array shorter than the class's level ceiling (its shortest
  `saves` array) → `E-SCHEMA-01` at `progression.<id>.featSlots` (or `…featSlots[i]`).
  No rule id is added.
- **Refusal (DD-F6; runtime rule `feat-slots-exceeded`, not a `RULE_IDS` entry).** Card
  `{severity: 'error', rule: 'feat-slots-exceeded', jsonPath: 'feats', artifactId}`. Every
  path that would leave a character holding more feats than its slots is refused, and
  nothing changes (no state change, no event):
  - **(a)** `learnFeat` — RuntimeRuleError; `artifactId` = the feat id; checked after
    `unknown-feat` and `feat-known`; refuses when held + 1 > slots; no `feat:learned`.
  - **(b)** `levelSet`, through the shared build validator
    (`validateBuild(runtime, race, entries, heldFeats?)` — an optional 4th parameter,
    emitting the card only when the pack is feat-slotted and the build produced no other
    card) — CharacterBuildError, `artifactId '(character)'`; levels unchanged, no
    `level:reached`.
  - **(c)** `awardXp` when the levels it would derive leave the held feats over the slots —
    the new levels are computed before any mutation; CharacterBuildError,
    `artifactId '(character)'`; `xp`, `classXp`, levels and events unchanged.
  - **(d)** character and party **restore** (`restoreCharacter`, `restoreParty`; the build
    validator's third path, fed the snapshot's `feats`) — RuntimeRuleError, nothing
    minted. The unknown-feat `E-SNAP-01` card is unchanged and may appear alongside; the
    held count includes unknown ids.
- **XP never lowers a level (v1.9, builder ruling 2026-10-04, builder-rulings DD-R4).**
  `awardXp` adds the award to `xp` and the split shares to `classXp`, then sets each class to
  the **higher** of its current level and the level its class XP reaches (clamped, as before,
  by the race cap and the class's level ceiling). A level set directly (`createCharacter`,
  `levelSet`) is never lowered by an award; `level:reached` is emitted only for a class whose
  level rose. Because levels then only rise and `featSlots` never decrease, refusal (c) can
  fire only for a character already holding more feats than its slots (an edited state). It
  stays as a guard.
- **Compatibility caveat (d).** A pack that adds `featSlots` makes `learnFeat` refuse once
  a character's slots are full, and refuses to restore a snapshot holding more feats than
  its slots. Packs that declare no `featSlots` are unaffected. Bundled-theme snapshots
  taken before v1.8 already fail the `contentHash` identity check (FR-14), so this caveat
  is reachable only through a pack that adds slots without changing content, or through
  an edited snapshot.
- **Compatibility caveat (e) (v1.9).** Out of combat, a condition with `actions.tagged:<t>`
  now also restricts a spell tagged `<t>` in `isRestricted`/`restrictedIds`. Combat behaviour
  is unchanged. No bundled theme outcome changes: the bundled `actions.tagged:` patterns are
  `sapped` (`main`) and `rooted` (`move`), and every bundled spell is tagged only `casting`.
- **Compatibility caveat (f) (v1.9).** `awardXp` no longer lowers a class level that was set
  above the level its XP reaches. Such a character keeps its level, and its XP accumulates
  until the level is reached.

**Class features (v1.10, class-features DD-C1…C9).** FR-6 lists class features among the
progression tables; v1.10 defines what one does and moves the field here from
`content.classes` (builder-authorized 2026-10-04: "1 a,b 2 no 3 move it, fix packs, 4 fix
the broken packs, 5 you have my auth for whatever you need").
- **What a feature is (DD-C1).** `progression.<classId>.features[i] = {level, ref}`. Ids are
  unique pack-wide (`E-DUP-01`), so `ref` names exactly one artifact. Its map decides what the
  feature does, while the character's level **in that class** is ≥ `level`:
  - `content.feats` → the feat is **granted**;
  - `actions` → the action is **unlocked** (declarable in combat);
  - `content.spells` → the spell is **unlocked** (known).
- **Load rules (DD-C4).**
  - The ref resolves in none of the three maps → `E-REF-01` at
    `progression.<c>.features[i].ref`, with a did-you-mean hint over feats ∪ actions ∪ spells.
  - An action ref also listed in `content.classes.<c>.actions` → `E-REF-01` (that list grants
    it from level 1, so the level gate would be ignored).
  - A spell ref whose `magic.lists` intersect the class's `spellLists` → `E-REF-01` (already
    known; the unlock would be dead).
  - `level` not an integer in 1..the class's level ceiling (its shortest `saves` array, as
    for `featSlots`) → `E-SCHEMA-01`.
  - `ref` not a kebab id string → `E-SCHEMA-01`.
  - A `ref` repeated within one class → `E-SCHEMA-01`.
  - `content.classes.<id>.features` → `E-SCHEMA-02` (unknown field; the closed-contract card
    every `additionalProperties: false` object already uses; DD-C3).

  No new rule id; all cards at once (FR-2).
- **Granted feats (DD-C2, human answer "2 no").**
  - Granted feats are derived from the pack and the character's classes, like known spells.
    They are never written to `CharacterState.feats` and never serialized; the character
    snapshot is unchanged.
  - They occupy **no feat slot**: the cap counts held (learned) feats only.
  - Reactive granted feats are offered in combat exactly like learned ones (DD-S12 offer,
    take, decline, no chain). A combatant's `feats` are the held reactive feats in held
    order, then the granted reactive feats not already held (DD-C9).
  - `learnFeat` of a feat the character is currently granted refuses `feat-known`; the
    message names the granting class feature.
  - A feat learned before its class grants it stays held and keeps its slot (no refund in v1).
  - Lowering a class level (`levelSet`) removes the grant, and no event is emitted.
- **Unlocked actions and spells (DD-C8, DD-C9).**
  - An unlocked action joins the combat profile's actions after the class `actions` union
    (those not already present). An unlocked spell joins the known spells, in pack order
    (list match **or** active unlock).
  - Both then ride the unchanged pipeline: restricts, reach/range gates, costs,
    `armorCasting`, slot or pool spend. An unlocked vancian spell still needs a bound slot to
    cast.
  - `no-combat-actions` counts unlocked actions.
  - A character with no active feature gets a byte-identical profile and known-spell list.
- **Multi-class (DD-C5).** Each class contributes its own features at its own class level.
  Unions keep first-occurrence order (class order, then feature order).
- **Characters only (DD-C6).** Statblocks keep their explicit `actions` list, even when a
  statblock uses a class's `attackTable`.
- **Events and query (DD-C7).** There is no feature event; `level:reached` is unchanged. The
  host reads `classFeatures(runtime, character)` →
  `{classId, level, ref, kind: 'feat' | 'action' | 'spell', active}[]`, in DD-C5 order,
  including features not yet reached (`active: false`).
- **Compatibility caveat (g) (v1.10, DD-C3).** This is a pre-release in-place revision
  (*Versioning discipline*: "Until first release, v1 remains revisable by DB"); `schemaVersion`
  stays 1. Effects:
  - a pack declaring `content.classes.<id>.features` now fails `E-SCHEMA-02`;
  - a pack whose feature refs do not resolve, or are redundant, now fails `E-REF-01`;
  - the bundled themes are migrated in the same feature (DD-C10), so their generated packs'
    `contentHash` changes, and snapshots taken against pre-v1.10 bundled packs fail the
    identity check (FR-14), as under caveat (d).

### `bestiary`
Map `monsterId → Statblock`: `name`, `threat` (number — the FR-16 budget weight), `level?`,
`hd?`, optional per-field ability/save overrides, `actions` (array of action ids —
**same action machinery as characters**, FR-16), optional `attackTable` reference.

### `tables`
Map `tableId → TableDef`: `kind: weighted | ranged | nested` with matching `entries`
(weighted: `{weight: uint ≥ 1, value}`; ranged: `{min ≤ max, value}`; nested: entry whose
`value` is another table reference). One engine, shared by runtime and compiler (FR-15).
Nesting depth is bounded at load (documented limit; deeper → `E-TBL-01`), so a pathological
pack fails validation instead of hanging load (architecture: bounded work).

---

## Override Document (FR-19)

`src/schema/contracts/override.schema.json`:

```json
{ "overrides": [ { "target": "barrow-wight", "patch": { "hpBonus": 4,
                   "actions.claw.onHit": "damage(1d8+2)" } } ] }
```

| Rule | Contract |
|---|---|
| Shape | Array of `{target: artifactId, patch}`; `patch` is an object whose keys are **dotted paths into the artifact**, values are replacement scalars/objects |
| Merge semantics | Deep-merge per key, applied in array order, **after** base-pack load validation and **before** final validation of the merged document — so an override can never smuggle in a structurally invalid pack (FR-2 holds for merged packs too) |
| Unknown target | → `E-OVR-01` (hint: nearest ids, per the error design) |
| Theme composition | FR-20 patches (`add | remove | merge` with pointer paths) are the same vocabulary one level up, applied to theme templates — one merge model, learned once |

---

## Snapshot Envelopes (FR-14)

`src/schema/contracts/snapshots.schema.json` — three envelopes, `oneOf` on `kind`.
Common to all: `snapshotVersion: 1`, `pack: {id, schemaVersion, contentHash}`.

**State only — no timestamps, no captured environment.** A snapshot's meaning is exactly
its state; `savedAt` is host metadata if a host wants it, never engine state.

| Envelope | Carries |
|---|---|
| `character` | name, race, classes `[{id, level, xp?}]`, abilities (map name→score), skill ranks, feats, knownSpells, `pools` (map poolId→current), `slots` (per level: array of bindings — `null` or spell id), active conditions `[{id, remaining}]`, inventory `[{id, qty}]`, optional `equipped` `[{slot, itemId}]` (v1.4). All plain JSON — no class instances, no closures (FR-5) |
| `party` | `members` (array of character state) |
| `combat` | `pairsWith` (host pairing token; encounterId in the aggregate below), `round`, `turn`, `order`, per-combatant state incl. transients (optional `itemsUsed` and `maxHp`, v1.4; optional `pendingMove`, v1.5; optional `poolsSpent`/`slotsCast`, v1.6), optional envelope `phase`/`offeredCount`/`offers` (v1.6), **`rng: {a, b, c, d}`** — four uint32 sfc32 words (FR-1 state export; resume test: next roll equals the uninterrupted fight's next roll) |

**v1.4 fields** (additive-optional; `snapshotVersion` stays 1; no `required` array changed):

| Field | Where | Type | Meaning | Restore precedence |
|---|---|---|---|---|
| `equipped` | `characterState` | `[{slot, itemId}]`? — both kebab strings, `additionalProperties: false` | One entry per occupied slot (one item per slot). **Absent = nothing equipped** (≡ `[]`) | Emitted only when the character's state carries it (presence-preserving: never-equipped characters round-trip byte-exact). Restored only when present; each entry is validated — item exists, slot declared, slot eligible for the item, held quantity covers it, slot unique across entries — any failure → `E-SNAP-01`, all refusals collected before any application. Slot uniqueness cannot be expressed in JSON Schema (`uniqueItems` compares whole objects), so restore enforces it fail-closed. Inventory still restores verbatim (the documented CA-01 divergence) |
| `itemsUsed` | combatant | object? item id → integer ≥ 0 | Units this combatant has **spent** in this fight — **not** units remaining | Fight-start balances are not in the snapshot: the host re-states them in `CombatRestoreRequest.balances` (`items`), exactly as pools and boundSlots are re-stated. The snapshot wins for the spend; remaining = restated balance − `itemsUsed`. Unknown id or over-spend → `E-SNAP-01`. Absent = nothing spent |
| `maxHp` | combatant | integer? ≥ 0 | The combatant's heal cap, fixed at fight start: derived hp with grants for characters; the hp formula value for statblocks | Snapshot wins over the re-stated profile; when absent (pre-v1.4 envelope) → `profile.maxHp` → `profile.hp` (floored at 0). A heal never lowers hp: a combatant already above its cap stays unchanged |

**v1.5 field** (additive-optional; `snapshotVersion` stays 1; no `required` array changed):

| Field | Where | Type | Meaning | Restore precedence |
|---|---|---|---|---|
| `pendingMove` | combatant | `{actionId: string, to: {x: integer, y: integer}, remaining: integer ≥ 0}`? — all three required inside, `additionalProperties: false` | A move paused by open leaving-reach offers (FR-11); it resumes when the offer queue empties. **Absent = no paused move** | Serialized only when set. Restore refuses an unknown action id or a non-move action → `E-SNAP-01`. Positions and terrain keep the host-re-stated discipline (`CombatRestoreRequest.positions` / `terrain?`, the latter mirroring `startCombat` with the same refusals). Restore precedence is otherwise unchanged |

**v1.6 fields** (additive-optional; `snapshotVersion` stays 1; no `required` array changed):

| Field | Where | Type | Meaning | Restore precedence |
|---|---|---|---|---|
| `poolsSpent` | combatant | object? pool id → integer ≥ 1 | Points this combatant has **spent** in this fight (the `itemsUsed` precedent). Emitted only when non-empty. **Absent = nothing spent** | pool = re-stated `balances.pools` − `poolsSpent`. Unknown pool or over-spend → `E-SNAP-01` |
| `slotsCast` | combatant | object? spell level (`"1"`–`"9"`) → unique integers ≥ 0 | Indices of the fight-start bindings consumed in this fight (by a spell, the lowest uncast index bound to it; by a vancian action, the lowest uncast non-null index, or the lowest uncast index below `boundSlots` for a count-only combatant). Emitted only when non-empty. **Absent = nothing cast** | `boundSlots[L]` = re-stated count − `\|slotsCast[L]\|`; `bindings` re-stated. `E-SNAP-01` for: a level with no re-stated slots; an index ≥ the re-stated binding length (or ≥ `boundSlots[L]` with no bindings); an index whose re-stated binding is `null`; a duplicate index. All cards collected before any rebuild |
| `phase` | envelope | enum? `awaiting-declare \| resolved \| awaiting-trigger-response \| combat-over` | The fight's phase when frozen. v1.6 writers always emit it | 1) frozen hp satisfying the end rule → `combat-over`; 2) else this value; 3) else the v1.5 derivation. `combat-over` while no side is defeated → `E-SNAP-01` |
| `offeredCount` | envelope | integer? ≥ 0 | Offers raised so far | Restored into the fight's offer counter, so the next `trigger:fired.offerIndex` continues from it. **Absent = 0** |
| `offers` | envelope | `[{actorId, source: action \| feat, id, on}]`? — all four required, `additionalProperties: false` | Every open trigger offer, in queue order; `on` is the live event type that raised it. v1.6 writers emit it (when non-empty) **instead of** the per-combatant `pendingTrigger` | Read when present; otherwise the legacy per-combatant `pendingTrigger`. Both present → `E-SNAP-01`. An unknown actor, or an id that is not a reactive action/feat that actor holds → `E-SNAP-01` |

- **`characterState.feats` is now written (v1.6).** The field already existed; it is emitted
  only when the character holds a feat (absent until the first `learnFeat`), and restore
  refuses an unknown feat id (`E-SNAP-01`). v1.8: restore also refuses a character holding
  more feats than its feat slots (`feat-slots-exceeded`, see §progression).
- **`pendingTrigger` is legacy-read-only (v1.6).** It is still read on restore when `offers`
  is absent; v1.6 writers no longer emit it (compatibility caveat (b), Version Registry
  row 7).

- **Derived restore phase (v1.5):** v1.5 envelopes carry no phase. v1.6 adds the optional
  envelope `phase` (v1.6 fields above), and this derivation is the fallback when it is
  absent. Restore
  sets the phase to **`resolved`** when any restored combatant carries `pendingMove` or
  `pendingTrigger`; otherwise it keeps the existing rule (`awaiting-declare`, or
  `combat-over` when a side is defeated). A restored paused fight's `step()` therefore
  forfeits the move and ends the turn, exactly as the uninterrupted fight does.
- **Restored offer `on` (v1.5):** a restored offer's matching event is the live **event
  type** — the trigger pattern's base before `[` (the `eventMatches` base), the same value a
  live offer stores (`event.type`) — never the pattern string.
- Both points are description-level: the schema shape is unchanged by them.

**v1.11 — combatant `hp`** (loosening; `snapshotVersion` stays 1; no `required` array changed).
`hp` is an integer with **no lower bound**. Damage is not floored, so a downed combatant's
hp may be negative and keeps the exact overkill. `hp ≤ 0` means down: no turns, no trigger
offers, never blocks movement (§spatial), and it counts toward the end rule. The writer
emits the value as-is and restore reads it as-is. The heal cap is still `maxHp` (integer
≥ 0, v1.4). Before v1.11 the schema said `minimum: 0`, which every snapshot taken after an
overkill blow violated. The engine always wrote negative hp, and restore always accepted it.

Note the deliberate asymmetry: `slotsUsed` serializes the **remaining** per-turn ledger (it
has no host-stated source), whereas `itemsUsed` records the **spend** because the host
re-states fight-start item balances. A fight never writes back to character state; the
host settles item spend explicitly after `combat-over` (runtime verb, not a contract field).

**v1.6 spend asymmetry.** `itemsUsed`, `poolsSpent` and `slotsCast` all record **spend**
against host-re-stated fight-start balances; `slotsUsed` still records the **remaining**
per-turn ledger. The host settles spells with `settleSpellCasts(runtime, character, fight,
combatantId?)` — a runtime verb, not a contract field (CA-S3): it runs only at
`combat-over` (else `combat-not-over`; an unknown combatant is `unknown-target`); every
refusal is collected before any change — per spent pool, `unknown-pool` (the character
lacks it) or `insufficient-points`; per cast index, `slot-mismatch` (the character's
`slots[L][i]` no longer equals the combatant's binding) or `slot-unmapped` (a count-only
combatant has no bindings to map). It then draws `pools[p] -= spent` (`pool:settled
{combatantId, pool, amount}`, `why.rule` `pools.<p>`) and empties `slots[L][i] = null`
(`slot:settled {combatantId, slotLevel, slotIndex, spellId}`, `why.rule` `content.spells`),
clears the combatant's spend, and returns the events, so a second call returns `[]`.

**Load discipline:** pack identity check first — `id + schemaVersion + contentHash` must
all match. Mismatch → loud refusal `E-SNAP-01`; stale `snapshotVersion` → `E-SNAP-02`.
Never partial, never mangled (FR-14). No v1 migration — staleness is the documented API
answer (FR-23).

---

## Headless play contracts — v1.12 (AR-02–AR-05)

These portable contracts are the approved implementation target for FR-24–29, not
implemented runtime capabilities. Shapes are normative in the named `$defs`; the
semantic predicates below are equally required. JSON Schema alone cannot establish
pack references, legal progress, ledger conservation or whether a writer ran.

**Prior discovery and resolved disposition — B-RA-XP:** `src/runtime/progression.ts` calls
`applyProgression` on every positive `awardXp`, including awards with no level change;
it replaces every prepared slot with null and resets current HP to `reserveValue`.
The initial Author receipt reported R4 and a pending product question. That classification
is superseded in lease revision 2: approved AR-01/04 and FR-26/27 already require exact
injury/resource continuity and explicit rest/preparation. Adventure rewards therefore
stage the real writer and preserve current/temp HP and existing prepared bindings,
leaving newly gained capacity empty. Incompatible preparation refuses the whole claim.
This is fixed-contract adaptation, not a new product choice; no renewed approval is
pending. Low-level awardXp remains unchanged. S03 c3/c4 and CA-04 retain their
implementation/proof gates, not a B-RA-XP product-decision gate.

### Existing snapshots: precise compatible additions

| Definition / addition | Write and read contract | Compatibility |
|---|---|---|
| `snapshots.schema.json#/$defs/characterState/properties/hp` | Optional closed `{current: integer, temp: integer >= 0}`. New writers emit both exactly, including negative and above-derived-maximum current HP. Present malformed values refuse; absence alone uses the old `reserveValue` reconstruction and temp=0. Applies to independent character and party states. | No old required field changes; version remains 1. Old readers may ignore HP and therefore cannot promise lossless injury. No new temp-HP combat mechanic, healing or resurrection. |
| `combatSnapshot.properties.combatants.items.properties.pendingMove.properties.offeredDepartures` | Optional array of closed `{from:{x,y},to:{x,y},reactorId}`; integer coordinates, uniqueness by the **whole tuple**. New paused-move writers emit it, including an empty array if appropriate. | Absence retains legacy first-resumed-step suppression. Presence uses exact tuple suppression. Old incomplete snapshots cannot gain a history they never stored. No version change or removal. |

For departures, the containing mover and every reactor must exist on opposing sides.
Each tuple records an event already offered, including one whose offers are still in
the saved queue. The queue must be answered before resuming. A changed edge or reactor
is checked normally. Preserve earlier tuples until the move ends; then discard them.
Do not require earlier `from` to equal the current cell, or an earlier reactor to remain
standing: historical offers can precede movement/damage. Current departure offers must
agree with the paused mover, edge and matching reactive source. Decline and refused
`take` both answer an offer. Legacy suppression must not leak into a present empty list.

**Condition bridge:** no new character-state field is needed. Existing snapshot
`conditions:[{id,remaining}]` maps to optional start-entry
`conditions:[{conditionId,duration}]`, alongside profile/balances; omitted means empty.
Check pack ids and nonnegative integral durations before initiative. The reverse writes
actual remaining round durations after settlement; travel/rest do not tick them. The
new optional StartCombatRequest field and explicit `pass()` are S01 runtime work, not
implemented here. `pass()` ends the active turn through the existing lifecycle and
refuses open offers/terminal combat. No new unit, vocabulary or per-turn reset rule.

### PlaySessionSnapshot — `play-session.schema.json`

| `$defs` / fields | Meaning and constraints |
|---|---|
| `encounterSetup` | `{budget,seed,maxPartySize,maxEnemies,layout}`. Finite positive budget; positive safe party cap; enemy cap 1..12. `layout` is `{kind:'theater'}` or `{kind:'spatial',model,allies,enemies,terrain}`. Placement arrays are fixed capacity, not generated geometry. |
| `member`, `members`, `encounterSessionOptions` | Stable nonempty member ids and independent character envelopes. New aggregate members require hp/pools/slots, even though old independent snapshots may omit HP. Hosts can restore legacy characters with the documented fallback and then serialize with the new writer. Membership is ordered, unique and fixed. |
| `profile`, `balances`, `initialCondition`, `startEntry`, `startInputs` | Exact portable mirrors of the inspected combat source. Start entry has id/profile/balances and optional conditions; profile.id equals id. Required start sides/positions/terrain retain immutable fight-start inputs. Empty geometry for theater. `bindings` stores exact indexed slots; `boundSlots` counts non-null bindings, not total capacity. |
| `selection`, `enemyInstance`, `memberBinding` | Actual assembler groups/threat/budget/seedUsed/heuristic, stable enemy→statblock/instance mapping, original member→characterId/combatantId binding. Character ids are audit data and remap on reopen. |
| `rawCombatSnapshot`, `turnControl`, `encounter` | Raw combat envelope plus current positions/terrain and `{round,turn,activeId,turnStarted}`. Raw combatants are an **array**, HP is scalar, `slotsUsed` is remaining per-turn slots, and itemsUsed/poolsSpent/slotsCast are spends. Original inputs and current geometry have separate fields. |
| `runtimeEvent`, `eventSubject`, `journalEntry` | Existing `{type,at,actor?,target?,payload,why}` event; payload is JSON, why.rolls is string[]. Journal adds sequence/revision and event-time subject names, with memberId where applicable. No fabricated dice trace, Date or mutable Runtime values. |
| `settlementReceipt` | Receipt/session/encounter/index/result/revision/member subjects plus sourceHash, beforeMembersHash, afterMembersHash. Lives with the actual updated party. Receipt alone is not a ledger writer or external authorization. |
| `playSessionSnapshot` | Required kind/version/pack/sessionId/revision/seed/members/encounterIndex/encounter/phase/result/rng/sequence/journal/settlements. Phase `active` has null result; `terminal` is victory/defeat awaiting settlement; `settled` has its current encounter receipt. Abandon settles atomically. |

**Preflight and assembly.** Validate the full effective pack, references and all inputs
before exposing state or consuming live entropy. A spatial pack requires its matching
model, capacity at least maxPartySize/maxEnemies, unique cells across both sides, known
terrain kinds, no duplicate terrain cells and no blocking spawn. A theater setup requires
no pack spatial model. Actual party length must fit. At least one monster must be
positive-threat and affordable. Reject nonpositive/nonfinite threats in the assembly
menu. Use a conservative upper bound
`min(12, floor((budget + 1e-9) / minimumPositiveThreat))` for bodies; reject if it exceeds
maxEnemies. Every affordable integer-weight sum (`max(1,round(threat*100))`) must fit
1..2^32. Existing assembly is unchanged: no party scaling, truncation or retry/reroll.
Validate the resulting nonempty groups/counts and total threat against the same pack,
budget and tolerance. `selection.seedUsed` records the explicit seed supplied even when
an injected generation stream performs the draws.

**Identity and restore constraints.** Party combat ids are `m:<memberId>`, enemy ids
`e:<encounterIndex>:<ordinal>` (ordinal starts at 1, groups sorted by id and then instance
1..count). `encounterId = JSON.stringify([sessionId,encounterIndex])`; raw `pairsWith`
equals that id. Stable member ids, original character ids and all combatant ids must be
unique within their respective sets. Entry members, current members and bindings have
the same member order. Exact ally/enemy sets, profiles, selection instances, combatants
and initiative order agree, with no extra/missing/duplicate ids. Raw turn is in order
bounds; control round/turn/activeId match it. HP/conditions/profile/balance projections
must match original entry members and pack-derived enemy profiles; reminting a Runtime
id never changes a stable subject. Unknown actions/spells/conditions/items/pools refuse.

Restore uses immutable start profiles/balances/initial conditions but **current**
`encounter.positions` and terrain. The map agrees with every raw combatant.position;
terrain agrees with saved start terrain (no terrain mutation command exists). Spatial
occupancy/placement rules still apply. Raw maxHp is the saved fight-start heal cap;
original current HP can differ. Restore checks each spend against original balances,
nonnull indexed bindings and equipped-item constraints; it never substitutes the current
settled party for the original balances. All RNG words satisfy integer 0 <= word < 2^32,
including the low-level deserializer's previously underchecked upper boundary.

Validate raw phase precedence as documented above; a present phase and offers must be
consistent. Terminal victory means the enemy side is down and party not all down;
defeat means all party down (defeat wins if both sides are down). Terminal snapshots
cannot carry abandonment. Settled abandonment may retain nonterminal raw combat for
audit, but cannot be resumed. `turnStarted` is false before grants for a new turn, true
once granted; the aggregate must not call step to replenish an already-started turn.
Open offers block advance/pass and player intent cannot act for a different actor.

Before settlement, current members equal entryMembers; views project live injury and
resources from raw state without overwriting the baseline. Settlement stages every
member, carries raw current HP plus original temp bookkeeping, final conditions and
resource spends, then publishes party+receipt+events atomically. Existing terminal-only
settleItemUses/settleSpellCasts can work on staged copies. **Abandon needs the Architect's
explicit adapter** using existing inventory writer and pool/binding rules; never forge
combat-over to call those helpers. Keep raw pre-settlement spend for audit. The current
receipt's sourceHash is `H({pack,encounter})`; before/after hashes are H of ordered member
arrays. Receipt id is `JSON.stringify([sessionId,encounterId,'settlement'])`. Validate
result/subjects/hash/revision and recompute the current party projection before acceptance.
Historical receipt ids/indexes are unique and increasing, revisions <= current revision;
they do not purport to store old fights. `next` is legal only after settled victory,
increments encounterIndex once and starts with the settled party. Defeat/abandon cannot
be bypassed with next. Repeated finalize at the current revision returns the existing
receipt without spending or emitting again; stale expectedRevision still refuses first.

### Template and definition — `adventure.schema.json`

| `$defs` | Exact role |
|---|---|
| `templateIdentity`, `definitionIdentity`, `objective`, `facts` | Versioned template id; definition id/version/digest; explicit objective; declared scalar factual values. No unbounded prose interpretation. |
| `location`, `descriptorTable`, `nodeRecipe`, `branch`, `construction` | Weighted location descriptors; finite entry/spine/optional-detour recipes and one success terminal. Node recipe id is distinct from the descriptor/table id. |
| `reward` | Authored id, nonnegative safe xpPerMember, eligible:'party', loot:null or `{tableId,recipient:'host-choice'}`. Party distribution differs from the existing per-class XP split. |
| `directorPolicy`, `narration` | Ordered legal action/move/pass and reaction priority policy; bounded candidates/stall limit; factual text fragments and declared interpolation slots. |
| `template` | kind/schemaVersion/id/version/effective pack/nodeBounds/objective/tables/locations/fragments/construction/rewards/facts/director/narration. Closed separate document, not a ThemeTemplate or added Pack property. |
| `choice`, `node`, `definition` | Fully resolved graph, text, EncounterSetup, reward refs, facts and rest/preparation policy. Definition carries template identity, effective pack, canonical seed, startNodeId/successNodeId, objective/rewards/director/narration and contentHash. |
| `adventureStartOptions` | adventureId/seed/members; independently seeded runtime play, separate from definition-generation seed. |

`loadAdventureTemplate(id, pack)` binds a bundled recipe explicitly to the passed
validated effective pack; internal bundled JSON is template fields except `pack`.
The returned complete template must validate. `generateAdventure` requires the bound
identity to match; it never silently retargets a host template. No static file I/O or
Runtime dependency is introduced. A custom pack must actually supply every referenced
content id; a familiar theme name is insufficient proof of compatibility.

**Finite construction.** Base order is entry, spine in declared array order, terminal.
Recipe ids and terminal id are unique. Branch ids are unique; branch node ids are
unique across base and every branch. Branch anchors refer only to base nodes, with
from earlier than to; each branch adds an alternate detour, keeping the base route.
Every table/location/text/reward/action/condition/terrain reference resolves before
random draws. `nodeBounds.min <= base count`; `nodeBounds.max >= base count + sum of
all branch node counts`; min <= max. This conservative bound includes omitted branches.
All descriptor weights are finite positive integers and each total <= 2^32; branch
includeWeight + omitWeight <= 2^32. There is no retry-until-connected algorithm.

Generation rolls base recipes in base order (terminal has no roll), then branches in
declaration order: include/omit via the existing weighted rollTable, entries include
then omit; omitWeight=0 includes without a draw. For included branches, roll their
node descriptors in declared order. Generated node array is base order followed by
included branch nodes in declaration order. Nodes copy selected descriptor fields;
terminal has kind success, supplied title/description, empty rewardIds/choices/facts,
rest none and preparation false. Retain all declared rewards/facts/policies verbatim.
Each base/internal branch continuation choice has id `continue`; each branch entrance
choice has id `branch-<branchId>` and uses its choiceTextRef. Choice ids are unique
**within a node**, not across the graph. Base continuation comes first, branch entrances
in declaration order. Fragment refs must yield nonempty choice text. Graph validation
checks all nodes reachable from start, exactly one success node at successNodeId, a
success route from every node, no cycles, no choices on success and nonempty choices
on all others. Host-authored definitions may use other kebab choice ids but must meet
these same graph and policy constraints. Bundled templates must guarantee at least one meaningful alternate route (at least one branch with omitWeight=0), and exercise real encounters, rewards and eligible preparation/rest; a seed cannot remove their entire route-choice coverage.

Encounter nodes require EncounterSetup; other kinds forbid it. Rest/preparation are
explicit node policy, not inferred from prose/kind. Rewards resolve by id. Loot tables
and all nested table references are valid and safely bounded; item-shaped leaves must
refer to real items, while other JSON flavor values remain legitimate no-item outcomes.
No policy grants monster spells, pools or slots not supplied by its real profile/balances.
Director priorities end in one pass; action/move ids refer to the corresponding pack
action kinds; reactionPriority references real triggered actions/feats. `nearest`
requires spatial encounter layouts. Invalid random-dependent legality must be refused
for the new solo domain before play, not sampled in preview. maxCandidates and stallLimit
are explicit finite work bounds; exhausting either yields rather than silently choosing
an omitted candidate or running forever.

Narration fragment ids and eventType are unique; declared slot names are unique and
exactly match `{slot-name}` placeholders. `facts.*` resolves to definition facts, or
current node facts overriding the same key. Event slots resolve to the actual event
fields; unknown/missing event-specific slots fall back to generic factual rendering.
Actor/target names come from event-time journal subjects. Text is literal text, never
executed code/HTML, and cannot create or change facts. Negative damage is healing;
why.rolls is existing display text, not invented structured dice rolls.

### AdventureSnapshot — `adventure-snapshot.schema.json`

| `$defs` / fields | Persistence and authority |
|---|---|
| `grant`, `noItem`, `rewardRoll` | Actual rollLoot value, tableId, rngBefore/rngAfter, and item `{itemId,qty}` or explicit no-item result. No guessed roll trace. |
| `pendingReward`, `claimedReward`, `rewardState` | claimId/adventureId/nodeId/rewardId/eligibleMemberIds/xpPerMember/stagedRevision/roll plus pending or claimed status; only claimed carries a receipt. |
| `rewardReceipt` | Subject-bound definitionHash, claim, recipient, actual XP/grants/revision and before/after member hashes. Loot-bearing no-item still records chosen recipient; no-loot records null. |
| `choiceTrail`, `encounterReceipt` | Exact source choice and target/revision; resolved encounter node plus its settlement receipt. No invented completion when unavailable. |
| `directorState` | Policy id/version, decisions, stalledSteps, lastMechanicalHash. No-progress detection survives budget partitioning. |
| `adventureSnapshot` | Required identity/version/seed/revision/node/phase; visited/resolved/rested nodes and choice trail; members/activeEncounter/encounterReceipts; four streams; rewards; journal/sequence/encounterEventCursor/director/narrationAck. Definition is supplied separately and digest-checked. |

**Progress predicates.** Members are fixed ordered stable identities from creation;
all nested pack identities match the effective pack and definition. Start is visited
first; every choiceTrail step refers to an actual source-node choice and its exact
target, in traversal order, with increasing revisions <= aggregate revision. Visited
nodes equal that path (including current); resolved/rested nodes are unique subsets.
A non-encounter node resolves on entry; an encounter resolves only after a victorious
settlement receipt. Rested nodes must allow rest once and have been visited/resolved.
An encounter receipt has one node subject, an encounter session id
`JSON.stringify([adventureId,nodeId])`, index 0 and its matching settlement identity.
Do not use `next` within an adventure-owned session: each encounter node has its own.

`exploration` means resolved non-success current node with no active encounter and no
pending current reward. `encounter` means unresolved encounter node and a non-null
activeEncounter whose sessionId, setup, party and pairing agree; adventure members equal
that session's entry baseline. `reward-pending` means resolved current node with at
least one pending earned reward, no active encounter. Victory settlement archives its
receipt, updates members, clears activeEncounter/cursor and stages rewards in the same
outer transaction. Defeat settles partial injury/resources and terminates; abandonment
also settles an active encounter, archives its receipt and terminates without new rewards.
Terminal defeated/abandoned cannot grant/claim rewards, rest, prepare, equip, use items
or choose routes; previously earned records remain audit data, not fresh authority.
`completed` requires the explicit success node resolved and all earned rewards claimed;
it cannot coexist with a pending reward or active encounter. Reaching a host-authored
success node with rewards first yields reward-pending. A blocked route never implies
success. Acknowledgement remains available after terminal outcomes.

**Reward writer/readback.** Each resolved eligible node creates one record per rewardId
in authored order: `claimId = JSON.stringify([adventureId,nodeId,rewardId])`. The eligible
set is the fixed ordered member list; a downed member is not silently removed from an
authored party award. No rewards stage on defeated/abandoned transitions. A loot-bearing
reward calls existing rollLoot once on a staged rewards stream, preserving exact JSON
value and before/after stream states. String resolving to item => qty 1; valid object
`{id,qty}` resolving to item => that positive integer stack; other flavor => no-item.
A failed table roll refuses the outer transition, with no partial fight settlement,
RNG advance, journal append or claim. A reward without loot has roll:null and no draw.
On reopen, verify definition table/id/XP/eligible subjects, normalization and stream
endpoints (replay on a detached stream is validation, never a live reroll). Stored rolls
form the rewards stream chain in staged order; current rng.rewards is its final endpoint.

Claim validates current node/phase/revision and exact claim subject; loot requires an
explicit eligible recipient even on no-item. No-loot forbids a recipient. Stage positive
XP through real awardXp on isolated Runtime/member copies, skipping that call for zero
XP. Retain its XP totals, per-class split, caps, levels and saves calculations and its
resulting slot capacity. Capture each member's pre-award current/temp HP, bindings and
resources first; restore exact HP without clamping (including negative/above-derived-max
current HP), and preserve every old non-null binding at the same spell-level/index in
the resulting capacity. Existing empty positions and newly gained capacity remain null;
if any prepared binding no longer fits, refuse the entire transaction rather than move
or discard it. Preserve existing pool balances, conditions/durations, known spells,
held feats and equipment; inventory changes only by the explicit saved item grant via
real grantItem. No implicit rest, preparation, healing or condition ticking occurs.
Validate all members before publishing their envelopes and receipt together. Any writer
or capacity failure, including a later member's failure, leaves every member, pending
claim, saved roll, receipt, revision, RNG, journal and event sequence unchanged; staged
writer events never escape. The prior roll remains saved for retry, with no reroll.
Receipt id is `JSON.stringify([adventureId,claimId,'reward'])`; grant list has zero or one
entry matching normalized roll and recipient. Before/after hashes are H of member arrays;
the after hash covers the preserved post-adapter state, not the intermediate awardXp state.
Whole-save members carry that exact HP/slot/pool/condition/inventory state. Reopen uses
the character envelopes and existing subject/receipt checks without calling awardXp,
rest or prepare to reconstruct the claim; saves/levels derive from the saved progression.
A matching already-claimed command at current revision returns its receipt with no
mutation; altered subject/recipient and stale revisions refuse. Definition content,
never caller amounts or an emitted audit event, authorizes reward writes. Historic
hashes are consistency checks, not proof against a completely rewritten coherent history.

Rest uses the saved current resolved node's once policy and existing pools.rest: refill
pools, clear bindings, no HP heal/resurrection/condition time. Preparation/equipment/item
commands use explicit member ids and existing guards; preparation needs preparation:true.
No automatic preparatory command is run by the director. All successful mutation effects
are staged; event subscribers never observe failed private work.

**Journal/cursors.** Sequence starts at 0; entries are contiguous 1..sequence, ordered
and never trimmed in v1. Revisions are nondecreasing and <= current revision. Subject ids
are stable combat/member subjects with names captured at emission, including past enemy
names after the fight has been removed. Encounter events append exactly once to the
adventure journal using encounterEventCursor <= nested sequence; while active it equals
the already-copied prefix, and after removal it is 0. Never use round-local event windows
as adventure sequence. narrationAck is integer 0..sequence, monotonic; readNarration emits
one message for each later entry, id JSON.stringify([adventureId,sequence]), without RNG
or acknowledgement. Ack beyond sequence or backwards refuses; equal is an idempotent
no-op. Ack changes revision/cursor but emits no new journal event.

### Canonical hashes, streams and bounded work

`H(value)` is the existing `packContentHash` canonical JSON algorithm (sorted object keys,
array order preserved, FNV-1a over JavaScript UTF-16 code units, lowercase 8-digit hex).
Definition contentHash = H of the complete definition with only contentHash omitted;
id equals template.id. Snapshot definition identity stores id/schemaVersion/contentHash.
Pack hashes bind the effective merged pack, not only manifest id or theme name. These
are deterministic identity checks, **not** cryptographic authentication or cross-device
exactly-once protection. An older whole snapshot reopened independently is a replay branch.

Canonical seeds use `String(seed)`; nonfinite numbers and non-JSON inputs refuse. Let
`D(tag, ...parts) = JSON.stringify(['ruleswright',1,tag,...parts])`. Construct core Rng with:

| Stream | Seed and use |
|---|---|
| Definition generation | D('adventure-definition', template.id, template.version, H(template), String(seed)); used by the finite construction above. No runtime instance. |
| Encounter generation | D('encounter-generation', sessionId, String(seed), encounterIndex, String(setup.seed)); initialize once for each new encounter, inject into assembly, then save its advanced state. Pass String(setup.seed) as assembly seedUsed. Next initializes the next index's domain; restore does not reseed. |
| Encounter play | D('encounter-play', sessionId, String(seed)); on each new encounter take one uint32 draw and seed combat with D('combat', sessionId, encounterIndex, String(setup.seed), draw). Combat retains its own exact rng state. |
| Adventure generation | D('adventure-generation', adventureId, String(seed)); one uint32 draw on entering an encounter, used as that nested session seed. Saved setup.seed remains the definition's explicit input. |
| Adventure play | D('adventure-play', adventureId, String(seed)); explicit out-of-combat random item/effect work only. |
| Adventure rewards | D('adventure-rewards', adventureId, String(seed)); staged reward table rolls only, in authored reward order. |
| Adventure director | D('adventure-director', adventureId, String(seed)); only seeded ties after deterministic legal candidate enumeration. |

A uint32 draw means `int(4294967296)`; never use a larger maxExclusive. Restore initializes
from saved words, never from these seed strings or by replaying live commands. Pure views,
validation, rejected commands, lexical ties and narration consume no live entropy. All
new counters/coordinates use safe integers; reject overflow before commit. Raw legacy
snapshot numeric acceptance is unchanged. Director mechanical hash includes location,
phase, members, current raw combat/geometry/turn control, resolved/rested nodes and reward
statuses; omit rng, revisions, journal/sequence, acknowledgement and director counters.
A no-progress decision increments stalledSteps; actual mechanical progress resets it.
Policy version/id and saved hash/counters survive maxSteps calls and reopen.

### Access paths, rejection and implementation evidence

Build maps once after full validation: memberId→member/binding, combatantId→start/raw
entry, nodeId→node, (nodeId,choiceId)→choice, rewardId→definition reward,
claimId→rewardState, receiptId→receipt. Ordered arrays remain the serialized authority;
maps are derived and never saved. Direct sequence indexing serves journal/narration;
node/reward/receipt sets serve phase and duplicate guards. No SQL index or storage I/O.

Shape/unknown keys use existing schema error families, unresolved refs existing reference
families, inconsistent snapshots E-SNAP-01, unsupported snapshotVersion E-SNAP-02. Every
located refusal is collected before exposure; a failed second member leaves no first
member debit/mint visible, receipt, committed event or RNG advance. Counters and complete
cross-field validation precede construction of observable facade state.

Required runtime proofs remain with S01 c1/c3/c5, S02 c1/c2, S03 c3/c4 and S04 c2/c3/c4:
real producer→schema validation→JSON stringify/parse→fresh restore→consumer continuation;
wrong hash/identity/sides/order/balances/receipt/phase/cursor and RNG 2^32 rejection;
legacy HP/departure compatibility; multi-member atomic failure; actual second fight;
saved pending/no-item/claimed rewards; original conditioned action rejection; changed
movement threatener; bounded director and no duplicate narration. Contract-only Ajv
fixtures do not replace any of those proofs. No existing low-level API is changed here.

For resolved B-RA-XP, S03 c3/c4 must assert no-level positive XP and level-up separately:
exact current/temp HP and old bindings/resources survive both; real XP/class split/caps/
levels/saves remain authoritative and newly gained slots are null. Assert incompatible
preparation and later-member failure leave the whole pre-claim aggregate unchanged,
including the already-staged roll. Reopen pending and claimed saves, then retry without
reroll or duplicate award, preserving injury/preparation through the next consumer.
These are implementation obligations, not runtime capability supplied by this receipt.
Lease revision 2 changes no schema shape, version, pack/override field or low-level API;
the snapshots.schema.json correction is formatting only. Existing legacy HP/departure
fallbacks and whole-history receipt scope remain unchanged.

---


## ErrorCard Rule Registry — v1

One error shape everywhere (`schema/error-card.ts`); this registry is the DB-owned
enumeration of v1 rule ids. Mock-attested ids are **fixed by approved design**.
**Additive by discipline** — v1.3 adds `E-SPAT-01` (grid-combat spatial, FR-11) as a
compatible minor (see §spatial); earlier revisions (v1.1, v1.2) added no ids and reused
existing ids only. v1.4 (equipment-consumables) adds no id: its load-time duties reuse
`E-SCHEMA-01` (structure) and `E-REF-01` (slot/grant references), and restore reuses
`E-SNAP-01`. v1.5 (grid-movement) adds no id: `E-SPAT-01` gains documented scope (movement-gate
rejections and terrain placement), `move` misuse reuses `E-FORM-02`, an undeclared `speed`
reuses `E-REF-01`, and a bad `pendingMove` reuses `E-SNAP-01`. v1.6 (spells-in-combat) adds no id: the trigger grammar reuses `E-FORM-01`; snapshot refusals reuse `E-SNAP-01`; combat cast refusals reuse `E-REF-01`, `E-SPAT-01` (`out-of-range`), `E-VANC-01`, `E-POINTS-01` and `E-ECON-01`. No id has been renamed or retired.

| Rule id | Family | Meaning |
|---|---|---|
| `E-SCHEMA-01` | structure | Document fails structural shape (missing section, wrong type) |
| `E-SCHEMA-02` | structure | Unknown/forbidden field; key/id mismatch in a map section |
| `E-DUP-01` | identity | Duplicate artifact id across the pack (also defined at …) |
| `E-REF-01` | reference | Dangling reference (target does not exist in this pack) — includes v1.1 tag references from `restricts` patterns |
| `E-REF-02` | reference | Reference to unknown class (race cap, list membership, …) |
| `E-REF-03` | reference | Missing progression for a declared class / orphaned progression |
| `E-FORM-01` | DSL | Formula/effect parse error |
| `E-FORM-02` | DSL | Unknown function (closed registry) |
| `E-FORM-03` | DSL | Unknown ability/save identifier (hint: did you mean …) |
| `E-ECON-01` | economy | Action costs an undeclared slot name / unknown pool or slot level — v1.1: when `economy` is present, slot names must resolve to `economy.turnSlots` keys |
| `E-SPAT-01` | spatial | Pack declares geometry the engine does not ship (model/shape outside the shipped set), or a spatial-gate rejection at play time (out of reach), or a movement-gate rejection (no destination, blocked, occupied, unreachable, out of range) or an invalid terrain placement (v1.5 adds no id) |
| `E-TBL-01` | tables | Malformed weights/ranges; nesting depth exceeded |
| `E-OVR-01` | override | Override targets an unknown artifact id |
| `E-SNAP-01` | snapshot | Pack identity mismatch on load — loud refusal (FR-14) |
| `E-SNAP-02` | snapshot | Snapshot version stale/incompatible — documented staleness answer |

`W-*` (warnings) and `I-*` (info) prefixes are reserved; v1 registers none. Adding ids
is additive/compatible; renumbering or retiring a shipped id is a major schema event.

---

## Access Patterns

No SQL — the "index" column names the in-memory structure that serves each pattern,
all built or compiled once at load (architecture: parse once, play many):

| Pattern | Access shape | Structure |
|---|---|---|
| Validate a pack | single all-at-once pass, O(pack size), never partial | `validatePack` per contract files |
| Artifact by id / dotted path | `index.get("bestiary.barrow-wight")` | id→artifact **Map**, built at load (uniqueness guaranteed by `E-DUP-01`) |
| Resolve a formula during play | AST lookup + interpret — **no parsing during play** | per-artifact AST cache, compiled at load |
| Roll a table | seeded RNG stream through the one table engine | `Rng` (sfc32) + `TableDef` |
| Snapshot round-trip | `JSON.stringify` / structured revive over plain-JSON state | plain-JSON constraint (FR-5/14) |
| Trigger dispatch | event pattern → registered reactive actions | event→action index, built at load |
| Restricts matching (v1.1) | declared tag set per action/spell → condition patterns | tag index built at load; runtime matcher consults it |
| Turn-slot grants (v1.1) | `economy.turnSlots` or the documented per-cost default | grant table resolved at load |
| Spatial geometry | pack.spatial → engine geometry at load | SpatialModel → SpatialGeometry (grid: Chebyshev · hex: axial) |
| Movement (v1.5) | `declare(moveAction, {to})` → movement gate → cheapest legal path within `speed` | fixed-order neighbor set + region-bounded Dijkstra over positions and host-placed terrain (terrain map built per fight at `startCombat` / restore) |
| Equipment composition (v1.4) | equipped items → ability/save adds + `gear-*` sums → formulas | per-item grants read from the id→artifact Map; one composition site |
| Consumable use (v1.4) | item id → pre-parsed `use` effect | item-effect AST index, compiled once at load (items declaring `use` only) |
| Spell declare (v1.6) | content.spells[id] + index.spellEffects | action pipeline, rule base content.spells.<id> |
| Reactive offers (v1.6) | actions + feats with trigger.on | eventMatches, per call |

---

## Seed Data

The existing initial data include the **three sample theme templates**
(`src/compiler/themes/dark-fantasy.json`, `zombie-urban.json`, `wyldwood.json` — wyldwood since
loot-inventory) — JSON, not code (FR-21).
DB owns their **shape** (knob declarations, stage inputs, patch vocabulary, and the v1.1
fields: `economy.turnSlots` grants, action/spell `tags`, `restricts` patterns; from v1.10, class features at `progression.<id>.features`); their content
is authored coined material per the FR-21 coverage floor and expression policy (Q7/Q8).
S02 additionally owns original adventure recipe JSON in `src/compiler/adventure-templates/` for those three themes, conforming to the bound-template contract through the explicit pack-binding loader. These recipes are planned content, not supplied by this DB change. No database seeding exists — there is no database.

---

## Version Registry

The migration-history equivalent. **These paths are permanently DB-owned: no Planner
session's `Owns` may ever include `src/schema/contracts/**` — a schema change is a
request back to DB, never a scope adjustment for Coder** (DB.md contract).

| # | schemaVersion | Description | Files |
|---|---|---|---|
| 1 | 1 (v1.0) | Initial contract layer: pack document (8 sections), three snapshot envelopes, override document, ErrorCard rule registry | `src/schema/contracts/pack.schema.json` · `snapshots.schema.json` · `override.schema.json` |
| 2 | 1 (v1.1) | **S-CONTRACT-GAP resolution (builder Option A):** optional `economy.turnSlots` turn-economy declaration (FR-4 grant source); optional `tags` on actions and spells; `restricts` pattern `actions.tagged:<tag>` must reference a declared tag (`E-REF-01`). Pre-release in-place revision: purely additive-optional fields, no field removed/renamed, no rule id added/renamed/retired, `schemaVersion` stays 1 (registry discipline: additive optional = compatible) | same three files (pack.schema.json revised) |
| 3 | 1 (v1.2) | **UI B-1 resolution (builder Option A, 2026-09-26):** optional `content.classes.<id>.actions` (unique action ids; each must resolve in `actions` → `E-REF-01`). Pre-release in-place revision: purely additive-optional, no field removed/renamed, no rule id added/renamed/retired, `schemaVersion` stays 1 | `pack.schema.json` revised |
| 4 | 1 (v1.3) | **grid-combat resolution (builder-authorized 2026-09-27):** optional spatial section (FR-11 opt-in: model/reach/shapes) + E-SPAT-01 registration (resolves the v1-core pending DB decision). Pre-release in-place revision: purely additive-optional, no field removed/renamed, no rule id added/renamed/retired except the new E-SPAT-01, schemaVersion stays 1 | pack.schema.json revised |
| 5 | 1 (v1.4) | builder-authorized 2025-09-27: slot-based equipment + consumables + the `heal` effect (registry 12→13); purely additive-optional; no field removed or renamed; no rule id added; schemaVersion stays 1 | `pack.schema.json` · `snapshots.schema.json` revised |
| 6 | 1 (v1.5) | builder-authorized 2026-09-29, grid-movement: hex model, terrain vocabulary, move(formula) + reserved speed (registry 13→14), snapshot pendingMove; additive-optional fields, no field removed/renamed, no rule id added, schemaVersion stays 1 — **one compatibility caveat:** a pack using a formula-position token `speed` in an effect without `formulas.speed` now fails E-REF-01 (see §formulas); no bundled theme affected | pack.schema.json · snapshots.schema.json revised |
| 7 | 1 (v1.6) | builder-authorized 2026-09-30, spells-in-combat: combat spell casting, spells targeting.range (optional; absent = caster reach), snapshot combatant poolsSpent/slotsCast, envelope offers/phase/offeredCount, character feats written, trigger.on grammar pattern; no field removed/renamed, no rule id added, schemaVersion stays 1 — **two compatibility caveats:** (a) a trigger.on outside the eventMatches grammar now fails E-FORM-01 (bundled themes corrected in the same feature); (b) v1.6 writers emit offers instead of the per-combatant pendingTrigger, which v1.6 still reads | pack.schema.json · snapshots.schema.json revised |
| 8 | 1 (v1.7) | builder-authorized 2026-10-01, action-targeting: target(self, …) shape word + self actions; ability(name) formula function (registry 14→15); no field added/removed/renamed, no rule id added, schemaVersion stays 1 — **one compatibility caveat:** (c) a target(self, …) now resolves to the actor | pack.schema.json revised (description only) |
| 9 | 1 (v1.8) | builder-authorized 2026-10-04, feat-progression: optional per-class `progression.<id>.featSlots` (per-level running totals, summed across classes; feat-slotted packs cap learnFeat, levelSet, awardXp and restore with the runtime rule feat-slots-exceeded); purely additive-optional, no field removed/renamed, no rule id added, schemaVersion stays 1 — **one compatibility caveat:** (d) a pack that adds featSlots refuses learning past the cap and refuses to restore an over-cap character | pack.schema.json revised |
| 10 | 1 (v1.9) | builder-authorized 2026-10-04, builder-rulings: restricts symmetric in and out of combat (isRestricted/restrictedIds match a spell by actions.tagged: or spells.tagged:); awardXp never lowers a class level; the feat-slotted predicate stated plainly (any class); description only — no field added/removed/renamed, no rule id added, schemaVersion stays 1 — **two compatibility caveats:** (e) out-of-combat restricts now also match a spell by actions.tagged:; (f) awardXp keeps a directly set level above its XP level | database.md only (no contract file changed) |
| 11 | 1 (v1.10) | builder-authorized 2026-10-04, class-features: class features move to progression.<id>.features ({level, ref}; ref = feat granted / action or spell unlocked from that class level; granted feats use no feat slot and are never stored); content.classes.<id>.features removed (E-SCHEMA-02); refs, redundancy, level range and uniqueness checked at load (E-REF-01 / E-SCHEMA-01); no rule id added, schemaVersion stays 1 — pre-release in-place revision with **one compatibility caveat:** (g) packs using the old location or unresolved refs now fail load; bundled themes migrated, so their contentHash changes | pack.schema.json revised |
| 12 | 1 (v1.11) | builder-authorized 2026-10-11, contract-conformance: combat snapshot combatant `hp` loses `minimum: 0` — damage is not floored, hp ≤ 0 means down; the schema now admits what the engine always wrote and restore always read; loosening only — no field added/removed/renamed, no rule id, schemaVersion and snapshotVersion stay 1, no compatibility caveat (no previously valid document becomes invalid) | snapshots.schema.json revised |
| 13 | 1 (v1.12) | 2026-10-16 approved AR-02–05: optional character hp and paused-move offeredDepartures; three new closed sidecar contracts for whole encounter, finite adventure template/definition and whole adventure. No existing required field/version or rule id changes; pack/override byte-identical. Legacy absence follows documented fallback; old readers cannot guarantee new HP/departure semantics. Lease revision 2 resolves the previously reported B-RA-XP/R4 through the approved preservation adapter; prose clarification and snapshot formatting only, no new schema or runtime readiness claim. | `src/schema/contracts/snapshots.schema.json` revised; new `src/schema/contracts/play-session.schema.json`, `src/schema/contracts/adventure.schema.json`, `src/schema/contracts/adventure-snapshot.schema.json` |

**Versioning discipline (FR-23, formalized):**
- Additive optional fields within v1 = compatible (minor).
- Removing/renaming fields, tightening constraints, changing DSL grammar, retiring rule
  ids = breaking → **major** bump, new contract files, written compatibility note.
- v1 files are **frozen at first release**: changes never edit a released contract file;
  new change = new file under a new schemaVersion directory (`contracts/v2/…`), mirroring
  forward-only migration discipline. Until first release, v1 remains revisable by DB.

---

## v2 Seams (documented, not built)

- Snapshot migration machinery (FR-14 defers it; `E-SNAP-02` is the honest v1 answer).
- Pack schema extensions for cone/line AoE, material components, metamagic (Constraints).
- DSL grammar extensions (closed registry growth = schema event per architecture).
- SRD-shaped content packs under an actual license decision (v2 reach; zero obligations while no SRD text ships).
