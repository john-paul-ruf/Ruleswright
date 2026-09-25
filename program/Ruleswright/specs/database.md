# Database Design — Ruleswright

> **Status:** draft for builder approval — DB, phase `database` (final Author phase).
> Read with `specs/architecture.md` (approved), `specs/requirements.md` (approved),
> and `specs/design.md` (approved, v2). Rule ids referenced by the approved
> `validation-errors.html` mock are registered here verbatim.

---

## Engine

**None** — by Architect's decision, which binds this phase (DB.md: *never change the
architecture*). The engine performs no I/O of any kind (FR-14); hosts own all storage.
There are **no tables, no connections, no migrations** in the SQL sense.

What "persistence" means here, formally: the only documents that ever outlive a process
are **packs**, **overrides**, and **snapshots** — all plain JSON, all validated at load.
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
Pack (one JSON document, 8 sections)
├── manifest        identity + schemaVersion + license/attribution + provenance
├── stats           name-keyed abilities and named saves
├── actions         action declarations: cost, validity, trigger?, effect
├── formulas        named formula-DSL expressions
├── content         classes · races · skills · feats · spells · conditions · items
├── progression     per-class tables: HD, attack table, saves, vancian slots
├── bestiary        statblocks built from the same character machinery
└── tables          weighted / ranged / nested lookup tables (the one table engine)

Override document  — GM/author patches, merged at load (FR-19)
Snapshot envelopes — character · party · combat (FR-14; three serializers)
```

All four contract files live at the real repo path:

```
src/schema/contracts/
├── pack.schema.json        — the pack document, schemaVersion 1
├── snapshots.schema.json   — the three snapshot envelopes
└── override.schema.json    — the override/patch document
```

These are **data artifacts, not application code** — DB-owned permanently (see
*Version Registry*). The TypeScript validator, types, and ErrorCard registry in
`src/schema/*.ts` implement these contracts and belong to Coder.

---

## Artifact Identity & Reference Rules

These rules are semantic validator duties (FR-2); every one maps to a registered rule id.

| Rule | Contract |
|---|---|
| **Id grammar** | `^[a-z][a-z0-9-]*$` (kebab-case). Ids are the universal address; every artifact is addressable by stable id (FR-19). |
| **Global uniqueness** | An id must be unique **across the entire pack**, not merely within its section — overrides address artifacts by id, so a duplicate makes addressing ambiguous. → `E-DUP-01` |
| **Map-as-namespace** | Sections are JSON objects keyed by id (`content.spells["grave-light"]`). The key IS the id; a def object repeating a mismatched `id` field is an error. → `E-SCHEMA-02` |
| **Reference grammar** | Dotted paths from a section root: `bestiary.barrow-wight.claw`, `tables.district-scavenge`. Bare ids resolve within the consuming section's context. |
| **Referential integrity** | Every reference must resolve at validation time: action→condition, spell→class list, race cap→class, statblock→action/progression, table→table (nested). → `E-REF-01`; unknown class specifically → `E-REF-02`; orphaned/missing progression for a declared class → `E-REF-03` |
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

### `actions`
Map `actionId → ActionDef`:

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `cost` | object | ≥ 1 of: `slots` (map slotName→uint), `points` ({pool, amount}), `vancian` (uint level) | Generic slot/points economy (FR-4); `vancian` consumes a **bound** slot (FR-8) |
| `valid` | string? | formula DSL | Validity conditions, e.g. `hasTarget(adjacent)` |
| `trigger` | object? | `{on: eventPattern}` | Presence makes the action reactive; rides the event substrate (FR-4/13) |
| `effect` | string | effect DSL, required | Parsed once at load → AST (FR-3); parse failure → `E-FORM-01` |

### `formulas`
Map `formulaId → {params?: string[], expr: string}`. Pure data; the function registry is
closed and versioned with the schema — extension is a schema event, never an escape hatch
(NFR-Security). Unknown function → `E-FORM-02`; unknown ability/save name → `E-FORM-03`.

### `content`
Seven maps, keyed by id: `classes`, `races`, `skills`, `feats`, `spells`, `conditions`, `items`.
Highlights (full field lists in the JSON Schema):

- **conditions**: `duration` (uint ≥ 1), `stacking` (`refresh | stack | ignore` — pack-declared policy, FR-7), `restricts?` (array of action tag patterns — the "teeth", e.g. blocks casting actions).
- **spells**: `magic` ({level: 1–9, lists: class ids}) + `cost` (vancian level or pool draw) + `effect` + optional `targeting` ({shape: `single | burst`, radius: uint, required iff burst}). A spell is an action with metadata — there is no magic subsystem (FR-9). Class/armor casting restrictions live on classes (pack data).
- **races**: `caps?` (map classId → uint max level — the classic cap curve, FR-6); unknown classId → `E-REF-02`.
- **feats**: passive or reactive (`trigger.on`); the sample packs ship ≥ 1 reactive feat (FR-12 proof 2).
- **skills**: `ability` (must name an ability declared in `stats`).

### `progression`
Map `classId → ClassProgression`, **required for every id in `content.classes`** (→ `E-REF-03`):

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `hd` | enum | `d6 | d8 | d10 | d12` | Hit die per level |
| `attackTable` | array? | rows: `{level, byDefense: {"<defense>": toHit}}` | The classic class attack table **as data**; defense keys are pack-convention (descending-AC tables are just keys `"2"…"9"`). The engine never knows which convention (FR-3) |
| `attackBonus` | string? | formula DSL | The ascending-AC alternative. **XOR with `attackTable`** (semantic rule) — a class declares exactly one convention |
| `saves` | map | saveName → per-level int array | Array length = max level; names must exist in `stats.saves` |
| `slots` | map? | spellLevel → per-level int array | Vancian slot tables (FR-8); levels need not be contiguous |
| `features` | array? | `{level, ref}` | Class features granted at level, referenced by id |

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
| `character` | name, race, classes `[{id, level, xp?}]`, abilities (map name→score), skill ranks, feats, knownSpells, `pools` (map poolId→current), `slots` (per level: array of bindings — `null` or spell id), active conditions `[{id, remaining}]`, inventory `[{id, qty}]`. All plain JSON — no class instances, no closures (FR-5) |
| `party` | `members` (array of character state) |
| `combat` | `pairsWith` (party snapshot id — the documented pairing), `round`, `turn`, `order`, per-combatant state incl. transients, **`rng: {a, b, c, d}`** — four uint32 sfc32 words (FR-1 state export; resume test: next roll equals the uninterrupted fight's next roll) |

**Load discipline:** pack identity check first — `id + schemaVersion + contentHash` must
all match. Mismatch → loud refusal `E-SNAP-01`; stale `snapshotVersion` → `E-SNAP-02`.
Never partial, never mangled (FR-14). No v1 migration — staleness is the documented API
answer (FR-23).

---

## ErrorCard Rule Registry — v1

One error shape everywhere (`schema/error-card.ts`); this registry is the DB-owned
enumeration of v1 rule ids. Mock-attested ids are **fixed by approved design**.

| Rule id | Family | Meaning |
|---|---|---|
| `E-SCHEMA-01` | structure | Document fails structural shape (missing section, wrong type) |
| `E-SCHEMA-02` | structure | Unknown/forbidden field; key/id mismatch in a map section |
| `E-DUP-01` | identity | Duplicate artifact id across the pack (also defined at …) |
| `E-REF-01` | reference | Dangling reference (target does not exist in this pack) |
| `E-REF-02` | reference | Reference to unknown class (race cap, list membership, …) |
| `E-REF-03` | reference | Missing progression for a declared class / orphaned progression |
| `E-FORM-01` | DSL | Formula/effect parse error |
| `E-FORM-02` | DSL | Unknown function (closed registry) |
| `E-FORM-03` | DSL | Unknown ability/save identifier (hint: did you mean …) |
| `E-ECON-01` | economy | Action costs an undeclared slot name / unknown pool or slot level |
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

---

## Seed Data

The only initial data in the repository are the **two sample theme templates**
(`src/compiler/themes/dark-fantasy.json`, `zombie-urban.json`) — JSON, not code (FR-21).
DB owns their **shape** (knob declarations, stage inputs, patch vocabulary); their content
is authored coined material per the FR-21 coverage floor and expression policy (Q7/Q8).
No database seeding exists — there is no database.

---

## Version Registry

The migration-history equivalent. **These paths are permanently DB-owned: no Planner
session's `Owns` may ever include `src/schema/contracts/**` — a schema change is a
request back to DB, never a scope adjustment for Coder** (DB.md contract).

| # | schemaVersion | Description | Files |
|---|---|---|---|
| 1 | 1 | Initial contract layer: pack document (8 sections), three snapshot envelopes, override document, ErrorCard rule registry | `src/schema/contracts/pack.schema.json` · `snapshots.schema.json` · `override.schema.json` |

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