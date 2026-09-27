# State Tracker — Ruleswright / loot-inventory

## Program / Feature / Intent / Sessions

- **Program:** Ruleswright (`program/Ruleswright/`) — headless TypeScript library,
  one-line theme → complete playable d20-style campaign pack.
- **Feature:** `loot-inventory` — more themes, items, inventory management, and loot.
- **Intent:** characters can hold items; themes can grant them from seeded loot
  tables; a third showcase theme proves the format; docs keep the two-pass NFR-DX
  bar. Rides the already-normative DB contracts (`content.items` in pack.schema.json,
  `inventory` in snapshots.schema.json) — **zero contract changes, zero schemaVersion
  moves, zero DSL registry growth.**
- **Plan HEAD:** `72346a5` (verified gates at plan time: typecheck 0, lint 0,
  `pnpm test` 421/421 across 30 files, `pnpm build` 24 dist files, isolation 0,
  security 0).

## Session Status

| # | Session | Modules | Owns | Status | Checkpoint | Completed | Notes |
|---|---------|---------|------|--------|-----------|-----------|-------|
| 01 | Runtime inventory core | M03 | `src/runtime/inventory.ts`, `character.ts`, `progression.ts`, `snapshots.ts`, `index.ts`, `tests/runtime/inventory.test.ts`, `tests/snapshots/character.test.ts` | pending | — | — | Producer of CA-01/CA-02; all engine changes land together at ck1 (required-field hazard: a state field without snapshot fidelity breaks the existing round-trip test); ck2 is the dedicated CA-01 proof |
| 02 | Compiler loot flow + third theme | M04 | `src/compiler/stages/tables.ts`, `theme-loader.ts`, `index.ts`, `themes/wyldwood.json`, `tests/compiler/stages.test.ts`, `coverage-floor.test.ts`, `themes.test.ts` | pending | — | — | Closes the silent items-producer gap in stage 7; SRD-adjacent lint applies; ck0 = mandatory CA-02 recheck against S01's committed source |
| 03 | Integration proof + docs | M05 | `tests/proofs/loot-journey.test.ts`, `tests/proofs/docs-run.test.ts`, `README.md` | pending | — | — | Built-dist journey; docs two-pass discipline; no engine code |

## Wave Plan

| Wave | Sessions | Why concurrent |
|---|---|---|
| 1 | SESSION-01 | Solo: owns the runtime lease everything downstream consumes (inventory verbs + snapshot fidelity). S02's compiler paths are disjoint from S01's, but S02's checkpoint 0 must recheck S01's *committed* CA-02 text — running them concurrently risks S02 reading an uncommitted convention. Serialized on the agreement, not the lease. |
| 2 | SESSION-02 | Solo: depends on S01's committed `src/runtime/inventory.ts` (CA-02 recheck at ck0). |
| 3 | SESSION-03 | Solo: depends on both predecessors' committed proofs; runs the built-package journey. |

**Concurrency note:** S01 and S02 have genuinely disjoint `Owns` (verified
path-by-path: no overlap in src/ or tests/), but the CA relay (S02's theme loot
tables must match S01's *landed* convention, not the planned one) makes
serialization the honest schedule. If Orchestrator later amends CA-02 against
S01's actual land and re-dispatches S02 concurrently with S01, that is a plan
amendment, not a default.

## Dependency Graph

```
SESSION-01 (runtime inventory + snapshot fidelity)
    └── SESSION-02 (compiler items flow + wyldwood)   [CA-02 recheck at ck0]
            └── SESSION-03 (built-dist journey + docs) [CA-01/CA-02 proofs cited]
```

## Architecture Reference (feature-specific only; full config in PROGRAM-CONFIG)

- New module file: `src/runtime/inventory.ts` (M03). Public surface: `grantItem`,
  `dropItem`, `countItem`, `rollLoot`, `grantLoot`, `InventoryEntry`; facade
  methods `grant/drop/count/loot` on `Character`.
- New compiler artifact: `src/compiler/themes/wyldwood.json`; `WYLDWOOD` const +
  third `loadTheme` case + surface re-export in `src/compiler/index.ts`.
- Event types added (character-side, round 0 clock): `loot:rolled`,
  `item:granted`, `item:dropped` — payload/why anatomy per S01's prompt; the
  `EventStream` envelope itself is unchanged.
- Stage 7 (tables) additionally contributes `content.items` and rejects
  CA-02-checkable reference defects in `-loot` tables with E-REF-01 theme cards
  (narrowed by REPLAN-LOOT-01: objects with undeclared ids + missed
  `tables.`-prefixed nested refs; every other string in a `-loot` table is
  flavor, never an error).
- Module-registry delta after S01: M03 key files gain `inventory.ts` (realized
  edge: `runtime/index.ts → ./inventory` [R] at its landing commit).

## Scope Summary

| ID | Affected area | Change class |
|---|---|---|
| M03 | character state + inventory verbs + events + snapshot field | extend (field + verbs; no existing verb rejections) |
| M04 | stage 7 items contribution + loot integrity check + third theme + registry | extend + new data file |
| M05 | README loot section + docs-run re-key | docs (executed artifact) |
| M01 | none (types read-only) | none — contracts frozen |
| M02 | none (rollTable reused as-is) | none |

## Design Decisions

1. **Inventory as `{id, qty}` stacks, not item instances.** The snapshot contract
   already normative-izes `inventory: [{id, qty}]`; aggregates keep state tiny and
   match the contract verbatim. No new schema fields anywhere.
2. **Loot is a runtime verb over the one table engine, not a DSL effect.** Loot
   tables already exist and are already load-validated (stage 7 rolls every table
   once; the validator's E-TBL-01 family covers shape). Making loot an effect-DSL
   function would grow the closed registry (a schema event, Custom Rule 1) for
   something the table engine already expresses. The narrowest reversible path.
3. **CA-02 value convention (the mapping this feature introduces):** string value
   ⇒ item id resolving in `content.items` (qty 1); `{id, qty}` object ⇒ that
   stack; any other value ⇒ flavor, skipped; nothing grantable in a roll ⇒
   `loot-grants-nothing` rejection with no state change. Chosen so existing
   non-loot tables (`wandering-dread` with bestiary names, `weather` with prose)
   need no edits — the runtime's loot verb is opt-in per call site.
4. **Restore does not cross-validate item ids against the pack.** Consistent with
   pools/slots (verbatim state restoration); mutation-time validation is where
   unknown ids fail. Avoids inventing a new load-time refusal the contracts do
   not declare.
5. **Stage-7 loot-integrity check scoped to `-loot` tables.** A pack-wide
   "every table value must resolve somewhere" rule would reject the shipped
   themes' prose/mood tables. The suffix convention is narrow, documented, and
   reversible; a theme wanting stricter checking gets it by naming its tables.
6. **Third theme = wyldwood (coined).** Third proof of the format; a new
   *setting* family (fey/wilderness) rather than a variant of either showcase, so
   it exercises items/loot natively (charm/ward loot economy) instead of
   duplicating the vancian or drain showcases.
7. **Serialization of the wave plan (S01→S02) despite disjoint leases.** The
   CA-02 relay risk (a theme authored against a convention that later lands
   differently) outweighs the concurrency win for a three-session feature.
8. **Engine changes land atomically at S01 ck1 (state + verbs + snapshots).**
   `CharacterState.inventory` is a required field; landing it without
   `serializeCharacterState`/`restoreCharacterState` fidelity breaks the existing
   snapshot round-trip test at that checkpoint. Valid-state-at-every-checkpoint
   beats checkpoint granularity here; ck2 remains as the dedicated CA-01 proof.
9. **Docs change is bundled into SESSION-03, not a separate docs session.** The
   quickstart is an executed+typechecked artifact; the block count moves 3→4 in
   the same lease that adds the block (no verification-only/bookkeeping session).
10. **Replan (REPLAN-LOOT-01, from the W0 planning-completeness review):**
    stage-7 loot-integrity narrowed to checkable branches (object-with-undeclared-id
    + missed 'tables.'-prefixed refs); other strings in -loot tables are CA-02
    flavor — stricter string-grantable typo-protection is a deferred product
    decision, not a defect. grantLoot's resolver normalizes both reference spaces
    and maps failed roll outcomes to named rejections. No leases, owners,
    ordering, or product behavior changed.

## Verification Baseline

Effective commands (verified by execution at plan HEAD `72346a5`, Node v24.20.0,
pnpm 10.15.0, vitest 2.1.8 / @vitest/coverage-v8 2.1.8, typescript 5.6.3,
tsup 8.3.0, eslint 10.11.0):

| Command | Scope | Evidence at plan HEAD |
|---|---|---|
| `pnpm typecheck` | tsc --noEmit over src + tests | exit 0 (run) |
| `pnpm lint` | ESLint flat config incl. security bans | exit 0 (run) |
| `pnpm test` | vitest run, node env | **421/421 across 30 files** (run) |
| `pnpm build` | tsup dual ESM/CJS + dts | exit 0, 24 dist files (run) |
| `node scripts/check-runtime-isolation.mjs` | greps `dist/runtime.js`/`runtime.cjs` for `generateCampaign`; exits 1 if present, 1 (fail) if dist missing | exit 0 (run) |
| `node scripts/check-security-lint.mjs` | no eval/new Function/Math.random/Date.now in src/ + dist/ | exit 0 (run) |
| `npx vitest run <path>` | **the lease-scoped gate** — `pnpm test -- <pattern>` does NOT filter (documented hazard, PROGRAM-CONFIG) | inherited convention, not re-proven |

Known hazards (inherited, unchanged by this feature; do not rerun to reconfirm):
`pnpm test -- <pattern>` does not filter (use `npx vitest run <path>`);
browser-mode Vitest config is a tracked v1.1 follow-up (README + ci.yml say so —
keep those claims honest; S03 edits no workflow file). Coverage config exists
(`pnpm test --coverage` → v8 text-summary).

Affected proofs: CA-01 (snapshot round-trip + key pin), CA-02 (grant
determinism + mapping branches), the built-dist journey (CAP-05). Every gate a
session runs must record its actual pass counts in the Handoff.

## Capability Readiness

| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|----|--------------------------------|---------------------------------|------------------------|-------------------------------|--------|------------------------|-------------------------------|
| CAP-01 | Character grant/drop/count with named rejections + events | `content.items` defs (pack data, already validated) | — | S01 ck1 | planned | — | — |
| CAP-02 | `grantLoot` rolls a pack table through the one engine into inventory | table defs (pack data) + CA-02 mapping + grantLoot's normalized dual-space resolver + the failed-outcome → named-rejection mapping (producer S01 ck1, unchanged owner) | CA-02 | S01 ck1 (implementation) / ck1 tests | planned | — | — |
| CAP-01/02 restart leg | serialize → restore preserves inventory | snapshots contract `inventory` (committed) | CA-01 | S01 ck2 (proof) | planned | — | — |
| CAP-03 | Theme items reach generated packs; loot tables validate | stage 7 items contribution | CA-02 (committed text recheck) | S02 ck1 | planned | — | — |
| CAP-04 | Third theme passes the FR-21 coverage floor + determinism | wyldwood.json authored natively | CA-02 | S02 ck2–3 | planned | — | — |
| CAP-05 | Built-dist loot journey: generate → Runtime → loot → snapshot → restore | dist artifact (S03 builds it) | CA-01, CA-02 | S03 ck1 | planned | — | — |
| CAP-06 | README loot block runs + typechecks; outputs observed | README + docs-run re-key | — | S03 ck2 | planned | — | — |

## Contract Agreements

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|----|------------------------------|--------------------------------|-----------------------|------------------------------------------|-----------|----------|------------------------------------|
| CA-01 | Snapshot `inventory` = `{id: string, qty: int ≥ 1}[]` exactly; state only, lossless; identity gate unchanged | `src/runtime/snapshots.ts` (S01) → character envelope ⇄ host storage → `restoreCharacter` | Engine `state.inventory` ⇄ envelope `inventory` verbatim (fresh copies both ways); restore skips pack cross-validation; envelope keys unchanged (9) | Correction: S01 (snapshots.ts). Proof: S01 ck2 (round-trip + key-pin), cited by S03 | agreed | planned (S01 ck1 implementation, ck2 proof) | planned — planned against `src/schema/contracts/snapshots.schema.json` @72346a5 (read, committed) |
| CA-02 | Loot value convention: string ⇒ `content.items[id]` qty 1; `{id, qty}` ⇒ stack; other values flavor (skipped); nothing grantable ⇒ `loot-grants-nothing` (no change) | theme tables (S02) → generated pack `tables` → `grantLoot` (S01) → `state.inventory` | Resolves against `content.items` only; ids kebab + globally unique (E-DUP-01); deterministic per seed; no ambient entropy; stage-7 `-loot` integrity check enforces CA-02-checkable references at generation time (objects with undeclared ids + missed `tables.`-prefixed nested refs; every other string in a `-loot` table is flavor, never an error). Nested-table refs resolve in both spaces: bare id (theme-space, generation convention) and 'tables.'-prefixed (pack-space fixture/validator convention) — grantLoot's resolver normalizes. A failed roll outcome (TableOutcome.ok === false: unresolvable-ref / range-gap / depth-exceeded / malformed-entries) rejects as a named runtime rule card (not silent, no state change, no loot:rolled event). | Correction: S01 (inventory.ts). Consumers authoring against it: S02 (all theme loot tables). **Provisional against S01 ck1** — Orchestrator must re-check the mapping against the landed `src/runtime/inventory.ts` before dispatching S02; S02's ck0 recheck is mandatory, and divergence ⇒ blocked, not re-derivation | agreed | planned | planned — S01 ck1 branch tests + determinism, including the nested-branch proof for both reference forms (fixture pack for the `tables.`-prefixed form; local in-lease test pack for the bare-id form) + the failed-outcome rejection branch; S02 ck3 seam proof through generated wyldwood; S03 journey re-proof through dist |

Complex entries expanded:

**CA-02 full mapping (binding on S01's implementation and S02's authoring):**
- Value = string `X` and `pack.content.items[X]` exists ⇒ grant `{id: X, qty: 1}` (stacks with a prior grant of the same id).
- Value is a plain object with integer `qty ≥ 1` and string `id` resolving in `content.items` ⇒ grant `{id, qty}`.
- Anything else (prose, numbers, bestiary-style names, `null`) ⇒ skipped; contributes to `loot:rolled`'s `grants` as nothing.
- A roll where no entry produced a grant ⇒ `RuntimeRuleError` with rule `loot-grants-nothing`, jsonPath `tables.<tableId>`; state unchanged.
- Table id unresolved ⇒ rule `unknown-table` (mirror `unknown-theme`'s card shape).
- Rejections never throw for *content* the caller passed other than the table id — flavor values are data, not errors.
- Nested tables recurse through `rollTable`'s resolver; the resolved leaf value is mapped by the rules above.
- Nested-table refs resolve in both spaces: bare id (theme-space, generation convention) and 'tables.'-prefixed (pack-space fixture/validator convention) — grantLoot's resolver normalizes.
- A failed roll outcome (`TableOutcome.ok === false`: unresolvable-ref / range-gap / depth-exceeded / malformed-entries) rejects as a named runtime rule card (not silent, no state change, no loot:rolled event).

## Current Blockers

None at plan time. Standing carried items from v1-core (advisory, outside this
feature's scope): DB ratifications (MAX_TABLE_DEPTH=8, E-SPAT-01 mapping,
hp-minimum death mechanic, race allowed/multiMax fields) and the v1.1 follow-ups
(browser Vitest config, snapshot byte-conformance, first CI run) — owners
recorded in the v1-core Final Report; do not relist them here as blockers.

## Handoff Notes (Orchestrator writes here after each session — from Coder's Handoff section, verbatim)

*(none yet — accumulates during the run)*