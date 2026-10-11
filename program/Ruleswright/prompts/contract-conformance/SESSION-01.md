# SESSION-01 — Author re-entry (DB): contract v1.11 — combatant hp has no lower bound

> **Program:** Ruleswright
> **Feature:** contract-conformance
> **Modules:** — (Author artifact: DB)
> **Depends on:** — (human answer on record, 2026-10-11)
> **Concurrent with:** —
> **Owns:** `program/Ruleswright/specs/database.md`, `src/schema/contracts/snapshots.schema.json`
> **Reads:** `program/Ruleswright/specs/requirements.md` (FR-10, FR-14, FR-23), `program/Ruleswright/prompts/contract-conformance/STATE.md` (DD-K1, CA-K2), `src/runtime/combat/combatants.ts:12-15, 80-92`, `src/runtime/snapshots/combat.ts:34-40, 125-135, 205-215, 545-552`
> **Resources:** —
> **Checkpoints:** 2

**Role.** This is an **Author re-entry** session for the DB role, not a Coder session. You change contract text in `database.md` and one constraint in `snapshots.schema.json`. `pack.schema.json` and `override.schema.json` stay byte-identical. You touch no `src/**/*.ts`, no theme JSON and no test.

**Authorization (quote it; do not re-litigate it).** On 2026-10-11 Planner asked how the contract and the engine should agree on combatant hp. The options were: A, the schema admits negative hp; B, the engine floors hp at 0; C, hp is floored only when saving. The human answered: "**a yes**". STATE.md DD-K1 reads this as option A plus approval to plan `contract-conformance`. This is a schema-change re-entry (AUTHOR.md *Author Re-entry*), and it is authorized.

This is contract **v1.11**: a pre-release in-place revision. `schemaVersion` and `snapshotVersion` stay 1. There is **no new rule id** and **no compatibility caveat**: the change only loosens a constraint, so no document that was valid becomes invalid. Use `2026-10-11` as the date in Version Registry row 12.

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| — | DB | `database.md` l.3 (Status line, starts "v1.10, revised"), l.641-704 (*Snapshot Envelopes*; the `combat` row l.653; the v1.6 bullets end before "Note the deliberate asymmetry" at l.699), l.795-822 (Version Registry; row 11 at l.813; *Versioning discipline* at l.815) | the v1.11 text sites |
| — | DB | `snapshots.schema.json` l.184-194 (`combatSnapshot.properties.combatants.items`; `"hp": { "type": "integer", "minimum": 0 }` at l.192) | the one constraint |
| M03 | Runtime | `combatants.ts:12-15` (`hp ≤ 0` is down), `combatants.ts:80-92` (`applyMutation`: damage is `current - amount`, never floored; heals clamp to `maxHp`), `snapshots/combat.ts:131` (the writer emits `hp: combatant.hp.current`), `:212` (restore reads it as-is), `:547-552` (the end rule `hp ≤ 0`) | the behaviour the contract must describe |

## Context

The engine has never floored damage at 0. A combatant's hp can go negative, and `hp ≤ 0` means down (FR-10's end rule, `README.md:148-151`). The combat writer stores that value, and restore reads it back without checking. The schema says `minimum: 0`, so every combat snapshot saved after an overkill blow breaks the library's own published contract. Planner's probe at `bb61f91` (STATE *Verification Baseline*, P1) confirmed this with Ajv 8.20.0 (draft 2020-12): oracle leg 3b (`$.combatants[1].hp = -7`) and a fight to the end on each bundled theme all fail on `/combatants/N/hp minimum`, and nothing else fails. v1-core recorded this as a "death-mechanic decision" (`prompts/v1-core/STATE.md:138`), and later cycles dropped it. The human has now decided it (DD-K1).

## Capabilities

This session writes the contract for **CAP-K2** ("the published contract states the engine's hp semantics"). It integrates nothing. S02 proves CAP-K1 against your schema.

## Contract Agreements

You are the producer for **CA-K2**. Write it exactly as STATE.md maps it:

- combatant `hp`: an integer with no lower bound.
- Damage is not floored. `hp ≤ 0` means the combatant is down: it takes no turns, is offered no triggers, never blocks movement, and counts toward the end rule.
- The writer emits the value as-is and restore reads it as-is.
- `maxHp` keeps `minimum: 0`. A heal still never raises hp above `maxHp` and never lowers it. Unchanged.

If your Author judgment changes any of this, write your version and report the change **by CA id and DD id** in your handoff. Orchestrator then amends STATE before it dispatches S02.

**Checkpoint-0 recheck (read-only):**
- `git diff --quiet bb61f91 -- src/schema/contracts program/Ruleswright/specs/database.md` is clean.
- `grep -n '"hp"' src/schema/contracts/snapshots.schema.json` returns l.189 (`required`) and l.192 (`"hp": { "type": "integer", "minimum": 0 },`).
- `grep -c '^| 12 |' program/Ruleswright/specs/database.md` = 0, and `^| 11 |` sits at l.813.
- `sed -n 3p program/Ruleswright/specs/database.md` starts `> **Status:** v1.10, revised`.

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `src/schema/contracts/snapshots.schema.json` | modify | Combatant `hp`: drop `"minimum": 0` and add a v1.11 `description` |
| `program/Ruleswright/specs/database.md` | modify | Status line → v1.11; a *v1.11 — combatant `hp`* note in *Snapshot Envelopes*; Version Registry row 12 |

## Implementation

### Checkpoint 1 — the schema constraint

Replace l.192 with:

```json
"hp": {
  "type": "integer",
  "description": "v1.11 — current hit points, no lower bound. Damage is not floored: hp <= 0 means down (no turns, no trigger offers, never blocks movement; the end rule). Written as-is; restored as-is. The heal cap is maxHp."
},
```

Leave `required: ["id", "hp"]`, `maxHp`'s `minimum: 0` and everything else unchanged. Run `pnpm exec prettier --write src/schema/contracts/snapshots.schema.json` to apply the repo layout.

**Commit when:**
- `node -e "JSON.parse(require('fs').readFileSync('src/schema/contracts/snapshots.schema.json','utf8'))"` exits 0;
- `pnpm exec prettier --check src/schema/contracts/snapshots.schema.json` exits 0;
- `git diff bb61f91 -- src/schema/contracts/snapshots.schema.json` touches only the combatant `hp` entry.

Commit: `contract-conformance SESSION-01: checkpoint 1 — combatant hp has no lower bound (v1.11)`, with an explicit pathspec over both Owns paths.

### Checkpoint 2 — the v1.11 text in `database.md`

1. **Status line (l.3):** prepend `v1.11, revised — DB, schema-change Author re-entry (builder-authorized 2026-10-11, contract-conformance: combatant \`hp\` in combat snapshots has no lower bound — damage is not floored, hp ≤ 0 means down; loosening only, no rule id, no caveat); ` before `v1.10, revised`.
2. **Snapshot Envelopes:** add a block just before "Note the deliberate asymmetry" (l.699):

   > **v1.11 — combatant `hp`** (loosening; `snapshotVersion` stays 1; no `required` array changed). `hp` is an integer with **no lower bound**. Damage is not floored, so a downed combatant's hp may be negative and keeps the exact overkill. `hp ≤ 0` means down: no turns, no trigger offers, never blocks movement (§spatial), and it counts toward the end rule. The writer emits the value as-is and restore reads it as-is. The heal cap is still `maxHp` (integer ≥ 0, v1.4). Before v1.11 the schema said `minimum: 0`, which every snapshot taken after an overkill blow violated. The engine always wrote negative hp, and restore always accepted it.

3. **Version Registry:** add row 12 after l.813:

   `| 12 | 1 (v1.11) | builder-authorized 2026-10-11, contract-conformance: combat snapshot combatant \`hp\` loses \`minimum: 0\` — damage is not floored, hp ≤ 0 means down; the schema now admits what the engine always wrote and restore always read; loosening only — no field added/removed/renamed, no rule id, schemaVersion and snapshotVersion stay 1, no compatibility caveat (no previously valid document becomes invalid) | snapshots.schema.json revised |`

**Commit when:**
- `grep -c '^| 12 | 1 (v1.11)' program/Ruleswright/specs/database.md` = 1;
- `sed -n 3p` starts `> **Status:** v1.11, revised`;
- No Prettier check: `.prettierignore` excludes `program/` (verified at plan time), so `database.md` is outside `pnpm format:check`. Keep the existing table style by hand.

Commit: `contract-conformance SESSION-01: checkpoint 2 — database.md v1.11 text and Version Registry row 12`.

## Verification

- Role-scoped: JSON parse, Prettier on the schema file, and `git diff --name-only bb61f91..HEAD` = exactly the two Owns paths.
- Run `pnpm build && pnpm test` once at the end. Expect 56 files, 974/974, unchanged: no test reads the contract files (pin audit, STATE *Verification Baseline*). A change in that count is a finding.
- Orchestrator runs the whole-repo fast gates (V1–V3) at receive, per the PROGRAM-CONFIG convention.
- Not yours: the Ajv proof that v1.11 admits leg 3b. That is S02 checkpoint 1 (CA-K2 proof owner).

## State Update

Report: status; the checkpoint SHAs; the exact `hp` JSON you committed; the database.md line numbers of the new block and row 12; and any CA-K2 wording delta (by CA/DD id). Under `followUp`, for the final Archivist: PROGRAM-CONFIG Custom Rule 1 gains the v1.11 event, and *Author Sources → Data source* names v1.11.
