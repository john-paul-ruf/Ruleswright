# SESSION-01 — Author re-entry (DB): contract v1.7 — `self` shape, self actions, `ability(name)`

> **Program:** Ruleswright
> **Feature:** action-targeting
> **Modules:** — (Author artifact: DB)
> **Depends on:** — (dispatch gate **B-AT-1**: human authorization, schema-change class)
> **Concurrent with:** —
> **Owns:** `program/Ruleswright/specs/database.md`, `src/schema/contracts/pack.schema.json`
> **Reads:** `program/Ruleswright/specs/requirements.md` (FR-3, FR-4, FR-9), `src/core/dsl/registry.ts`, `src/core/dsl/effect.ts`, `src/core/dsl/formula.ts`, `src/runtime/combat/combat.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/equipment.ts`, `src/schema/validate/sections/cross.ts`, `src/compiler/themes/*.json`, `program/Ruleswright/prompts/action-targeting/STATE.md` (Design Decisions DD-A1…A9, Contract Agreements CA-A1…A4)
> **Resources:** —
> **Checkpoints:** 2

**Role.** This is an **Author re-entry** session for the DB role, not a Coder session.

**Authorization (quote it; do not re-litigate it).** Orchestrator pastes the human's B-AT-1
answer here **verbatim**, with its date, before dispatch. Do not start without it. The
answer authorizes the schema-change class for exactly the three items below. If it narrows
them (for example, it declines `ability(name)`), write only what it authorizes and report
the delta in the handoff.

> *(B-AT-1 answer — Orchestrator inserts here)*

Earlier human answer on record (2026-10-01): "**med kit should use ability**".

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| — | DB | `specs/database.md` §actions (l.231-249), §formulas (l.251-298), §content spells (l.306-372), Version Registry (l.611-633) | v1.7 text |
| — | DB | `src/schema/contracts/pack.schema.json` `formulas` description (l.30) | registry note |
| M02 | Core | `registry.ts` (all), `effect.ts` `ARG_CATEGORIES` l.470-479, `checkEffectAst` bare-name branch (comment l.584) | proves the shape argument is an open name vocabulary today |
| M03 | Runtime | `combat.ts` `declare` l.572-735, `resolveTarget` l.886, `resolveShape` l.1273, `resolveReactive` l.1529; `resolve.ts` `effectVars` l.362; `equipment.ts` vars l.273 | the behavior being specified |

## Context

Every bundled self-buff action (`withdraw`, `brace`, `ward-glint`, `fall-back`, `barricade`,
`dodge-roll`, `adrenal-spike`, `circle-path`, `ward-step`) applies its condition to the
executor's bound target, which is an **opponent** (`combat.ts` `resolveTarget`, opponents only).
With several opponents and no `targetId` the declare is refused `no-target`. In a spatial
pack, a far opponent makes the reach gate refuse it. The effect DSL has no way to say "the
actor".

Separately, zombie-urban declares `vigor` as both an ability and a save (theme `stats`,
l.34-35). Both effect-var builders spread saves after abilities: `resolve.ts effectVars`, and
`equipment.ts useItem`. So `heal(2 + vigor)` reads the save (0 at level 1), and no content
spelling can reach the ability.

This session writes the contract for both mechanisms. No requirement changes: FR-3 ("the
effect DSL expresses … targeting") and FR-9 already cover them. No mock changes: no mock
text describes these effects (`combat-loop.html:72` shows `withdraw`'s effect as `"…"`;
`triggers.html:49` is a feat, which already acts on its holder).

## Capabilities

This session produces the contract text for CAP-A1…A5 (STATE.md). It integrates no
capability. Implementation and proof belong to S02 (CAP-A1…A3) and S03 (CAP-A4…A7).

## Contract Agreements

CA-A1, CA-A2 and CA-A3 (STATE.md) are the source for this session's text. Each is
**provisional** until this session lands. Write the meaning exactly as mapped there unless
Author judgment changes it. If it does, write the changed version, and report the delta with
its CA id so Orchestrator can amend the row before dispatching S02.

**Checkpoint-0 recheck (read-only):**
- `grep -n "'self'" src/runtime/combat/*.ts` → only `triggers.ts` (event grammar). No shape named `self` exists today.
- `registry.ts` → 14 entries, no `ability`.
- `cross.ts` `NON_FORMULA_ARGS` (l.82-87) → no `ability`.

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `program/Ruleswright/specs/database.md` | modify | §actions: a **Self actions (v1.7)** paragraph. §formulas: a **`ability(name)` (v1.7)** row and registry note (14 → 15). §content spells: a one-line note that `self` resolves to the caster and spell targeting is unchanged. Version Registry: row 8 |
| `src/schema/contracts/pack.schema.json` | modify | `formulas` `description` (l.30): append the v1.7 sentence on `ability(name)` and the `self` shape word. **No structural change**: no field, enum or pattern changes |

## Implementation

### Checkpoint 1 — database.md v1.7

Write, in DB voice, matching the v1.5/v1.6 paragraphs:

1. **§actions, after the trigger-grammar paragraph — "Self actions and the `self` shape (v1.7, DD-A1/A2)":**
   - `target(self, <effect>)` scopes `<effect>` to the **actor**: the declaring combatant, the reactor, the feat holder, or the item user. This holds in grid, hex and theater-of-mind packs, at any depth.
   - `self` is a shape word of the `target` statement, beside `adjacent` and `burst-<r>`. It is not a function and adds no registry entry. `hasTarget(self)` holds whenever the actor stands.
   - An **action** whose parse-once effect root is `target(self, …)` is a **self action**. Declared or taken as a reaction, it binds its actor as its target. It runs no opponent resolution, so there is no `no-target`, and no reach gate (as for move actions, DD-M9).
   - A self action still runs the restriction, validity and cost gates, in the same order.
   - A `targetId` other than the actor → `{kind: 'invalid-target', rule: 'E-REF-01', resource: <targetId>}`, and nothing changes.
   - Events: the effect's events name the actor as both actor and target. `action:resolved {actionId, targetId: <actor>}`.
   - Spells are not self actions. DD-S8 targeting applies, and a `self` inside a spell resolves to the caster.
   - **Compatibility caveat (c):** a v1.6 pack that wrote `target(self, …)` resolved it to nobody (spatial) or to the bound target (theater). v1.7 resolves it to the actor. No bundled theme used it.
2. **§formulas, after the `move` rows — "`ability(name)` (v1.7, DD-A4)":** registry **14 → 15**, `{arity 1, kind formula, signature ['ability-name']}`.
   - **Legal only inside effect-kind fields:** action, spell and feat `effect`, and item `use`. Anywhere else → `E-FORM-02`.
   - The argument is a bare name that must be declared in `stats.abilities`, else `E-FORM-03` with did-you-mean.
   - **Value:** the **actor's** ability, as the effect vars compose it (equipment grants included), never a save and never the target's.
   - **Why it exists:** abilities and saves share one namespace, and in effect vars a save shadows the same-named ability (needed by `save` recipes `d20 + <save>`).
   - No new rule id. The registry extension is a schema event (CA-2).
3. **§content spells (l.306 bullet):** one sentence, as above.
4. **Do not write the Version Registry row in ck1.** It is written in ck2 with the schema file.

**Commit when:** `database.md` contains the three edits; `git diff --stat` shows only `database.md`; the text names DD-A1, DD-A2 and DD-A4.

### Checkpoint 2 — pack.schema.json description + Version Registry row 8

1. `pack.schema.json` `formulas.description` (l.30): append a v1.7 sentence covering `ability(name)` (registry 14 → 15, effect fields only, actor's ability, unshadowed) and the `self` shape word of `target`. Keep the JSON valid: `node -e "JSON.parse(require('fs').readFileSync('src/schema/contracts/pack.schema.json','utf8'))"`.
2. `database.md` Version Registry, row 8: `| 8 | 1 (v1.7) | builder-authorized <B-AT-1 date>, action-targeting: target(self, …) shape word + self actions; ability(name) formula function (registry 14→15); no field added/removed/renamed, no rule id added, schemaVersion stays 1 — **one compatibility caveat:** (c) a target(self, …) now resolves to the actor | pack.schema.json revised (description only) |`.

**Commit when:** the JSON parses; `pnpm exec prettier --check src/schema/contracts/pack.schema.json` passes (`program/` is in `.prettierignore`, so `database.md` is not formatted); `pnpm exec vitest run tests/schema` passes (the contracts are read by schema tests).

## Verification

- `node -e "JSON.parse(require('fs').readFileSync('src/schema/contracts/pack.schema.json','utf8'))"` exits 0.
- `pnpm exec vitest run tests/schema` → green.
- `pnpm format:check` → 0. Orchestrator runs the whole-repo fast gates at receive (PROGRAM-CONFIG convention).
- No integration proof belongs to this session. CAP/CA proofs are S02 and S03 (STATE.md).

## State Update

Report in the handoff:
- the exact text written for CA-A1, CA-A2 and CA-A3, and any delta from STATE.md, by CA id;
- the B-AT-1 answer as applied, with the med-kit line the human chose, which S03 needs;
- the commit SHAs.

Orchestrator then re-checks CA-A1…A3 against the landed text before dispatching S02.
