# SESSION-01 — DB author re-entry: pack.schema.json `spatial` (v1.3) + E-SPAT-01 registration

> **Program:** Ruleswright
> **Feature:** grid-combat
> **Modules:** — (Author artifacts: DB-owned contract + registry doc)
> **Depends on:** —
> **Concurrent with:** — (W1 runs alone)
> **Owns:** `src/schema/contracts/pack.schema.json`, `program/Ruleswright/specs/database.md`
> **Reads:** `program/Ruleswright/mocks/spatial.html`, `program/Ruleswright/specs/requirements.md` (FR-11), `program/Ruleswright/specs/database.md` (Version Registry discipline), `src/schema/contracts/snapshots.schema.json` (confirm no edit needed), `src/schema/contracts/pack.schema.json`, `src/core/dsl/registry.ts`
> **Resources:** —
> **Checkpoints:** 2

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| — | Author (DB) | `specs/database.md` — you own its revision | The Version Registry and ErrorCard Rule Registry are yours |
| — | M01 | `pack.schema.json` — you own the normative file | The `spatial` section joins the closed pack root |

## Context

The user has approved grid combat (FR-11's integration half). Nothing else may prescribe the contract shape: every TS session in this feature reads `pack.schema.json` §spatial as its source of truth, so this session lands first. Two DB artifacts change, both under the schema-change Author re-entry class, human-authorized in conversation 2026-09-27:

1. `pack.schema.json` gains an optional `spatial` section (currently impossible: the pack root is closed, unknown top-level key → E-SCHEMA-02).
2. `database.md`'s ErrorCard Rule Registry registers `E-SPAT-01` — the pending decision recorded verbatim since v1-core ("E-SPAT-01 (unregistered — DB decision pending)").

Both changes are **additive-optional** under database.md's versioning discipline: no field removed/renamed, no existing rule id renamed/retired, `schemaVersion` stays `1`. Pre-release discipline applies: v1 files are revisable by DB until first release; the registry entry says so.

## Capabilities

- **CAP-G1 (producer):** the contract section every later session consumes.
- **CA-G1 (producer):** the normative spatial declaration shape — mock-verbatim anatomy.
- **CA-G2 (producer):** E-SPAT-01 registration — additive rule id.

## Contract Agreements

You produce CA-G1 and CA-G2. Re-read `mocks/spatial.html`'s pack.json block at checkpoint 0 and confirm the field names below match it verbatim (`model`, `reach.default`, per-id reach, `shapes`). If the mock and this prompt disagree, the mock wins — report the delta in your handoff rather than implementing the prompt's shape.

## Files to Create/Modify

| File | Action | What Changes |
|------|--------|--------------|
| `src/schema/contracts/pack.schema.json` | modify | Add optional top-level `spatial` property (`$defs/spatial`), see checkpoint 1 |
| `program/Ruleswright/specs/database.md` | modify | §Pack Document: add `spatial` subsection; Registry: +E-SPAT-01 row; Version Registry: row #4 (v1.3); Access Patterns: +spatial row |

## Implementation

### Checkpoint 1 — contract §spatial

Add to `properties` (after `economy`, mock order) and to `$defs`:

```json
"spatial": {
  "$ref": "#/$defs/spatial",
  "description": "Optional spatial model (FR-11): positions/adjacency/reach for packs that want geometry. Absent = theater of mind; nothing else changes."
}
```

```json
"spatial": {
  "type": "object",
  "additionalProperties": false,
  "required": ["model", "reach"],
  "properties": {
    "model": {
      "const": "grid",
      "description": "v1 ships exactly the square grid (Chebyshev distance). Other models are future additive revisions, never silent aliases."
    },
    "reach": {
      "type": "object",
      "additionalProperties": false,
      "required": ["default"],
      "properties": {
        "default": { "type": "integer", "minimum": 1, "description": "Melee reach in grid steps (1 = adjacency)" },
        "keys": {
          "description": "Reach overrides keyed by combatant/artifact id or free-form label (e.g. \"weapons.long-spear\": 2 — spatial.html's example; v1 labels are documentation, runtime resolves by combatant id).",
          "type": "object",
          "propertyNames": { "type": "string", "minLength": 1 },
          "additionalProperties": { "type": "integer", "minimum": 1 }
        }
      }
    },
    "shapes": {
      "type": "array",
      "items": { "enum": ["single", "burst"] },
      "uniqueItems": true,
      "description": "Documented shape set (FR-11): v1 ships single + burst only; cone/line are deferred engine geometry and cannot be declared (E-SPAT-01 if attempted post-validation shape growth)."
    }
  },
  "description": "The spatial model (spatial.html verbatim): {model: 'grid', reach: {default, <label>: n}, shapes?}. Positions are host-declared per combatant; the engine never invents a grid."
}
```

**Read before write:** the full committed `pack.schema.json` (closed root, draft 2020-12) and `mocks/spatial.html`. Preserve existing formatting/indentation exactly; the file is DB-owned and its diff must be reviewable as additive.

**Commit when:** the revised schema is valid JSON, `spatial` is optional (packs without it still validate — confirm by inspection against the `required` array, which must NOT gain `spatial`), and no existing section changed.

### Checkpoint 2 — database.md v1.3

Edit `program/Ruleswright/specs/database.md`:

1. **Header status line:** v1.2 → v1.3 with a one-line revision note (spatial section + E-SPAT-01 registration, builder-authorized).
2. **Schema Overview tree:** `economy?` line gains a sibling `├── spatial?       OPTIONAL spatial model: grid reach + shape set (FR-11)`.
3. **Section Contracts:** new `### spatial — OPTIONAL (v1.3)` subsection after `economy`, table form matching the schema (model const grid; reach.default ≥1; reach overrides as free-form labels, runtime resolves by combatant id, dotted artifact paths documented as v2 seam; shapes ⊆ {single, burst}). State the theater-of-mind default explicitly: "absent section = no adjacency checks, no position state; packs without it pay nothing (FR-11)."
4. **ErrorCard Rule Registry:** add row `E-SPAT-01 | spatial | Pack declares geometry the engine does not ship (model/shape outside the v1 set), or a spatial-gate rejection at play time (out of reach)`. Update the "Unchanged by v1.1" note to a version-neutral one: v1.3 adds this id additively (compatible minor); no id renamed/retired.
5. **Version Registry:** row `| 4 | 1 (v1.3) | **grid-combat resolution (builder-authorized 2026-09-27):** optional spatial section (FR-11 opt-in: model/reach/shapes) + E-SPAT-01 registration (resolves the v1-core pending DB decision). Pre-release in-place revision: purely additive-optional, no field removed/renamed, no rule id added/renamed/retired except the new E-SPAT-01, schemaVersion stays 1 | pack.schema.json revised |`.
6. **Access Patterns:** add `| Spatial geometry | pack.spatial → engine geometry at load | SpatialModel → SpatialGeometry (grid, Chebyshev) |`.

Also **verify the snapshots contract needs no edit**: `snapshots.schema.json` `combatants[].position` already exists (`"type": ["null", "object"]`, "Present only when the pack declares a spatial model (FR-11)"). Record the confirmation in your handoff.

**Commit when:** both files updated, registry/version-discipline language consistent, and the two edits cross-reference each other (§spatial cites E-SPAT-01; the registry row cites the section). Repo still builds: `pnpm typecheck` (contract files are data — typecheck must be unaffected; run it to prove the tree is untouched elsewhere).

## Verification

- `python3 -c "import json;json.load(open('src/schema/contracts/pack.schema.json'))"` — contract parses.
- `git diff --stat src/schema/contracts/pack.schema.json` — additive only; eyeball the diff in the commit.
- `pnpm typecheck` — 0 (untouched TS).
- CA-G1/CA-G2 checkpoint: mock-vs-contract field-name comparison recorded in the handoff.

## State Update

Report: status, checkpoint count, CA-G1/CA-G2 producer status (committed shape + registered id), the mock-vs-contract verification result, the snapshots-contract no-edit confirmation, surprises. `followUp` for S02: the exact `$defs/spatial` JSON path names it must mirror (`spatial`, `spatial.model`, `spatial.reach.default`, `spatial.reach.keys`, `spatial.shapes`), and for S03: the `spatialFromPack` adapter contract (pack shape → `SpatialModel {defaultReach, reachOverrides}`) and the E-SPAT-01 semantic mapping (unshippable geometry + play-time gate rejections).