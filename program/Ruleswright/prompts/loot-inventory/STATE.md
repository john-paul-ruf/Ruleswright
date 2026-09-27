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
| 01 | Runtime inventory core | M03 | `src/runtime/inventory.ts`, `character.ts`, `progression.ts`, `snapshots.ts`, `index.ts`, `tests/runtime/inventory.test.ts`, `tests/snapshots/character.test.ts` | done | 2/2 | 2025-09-26 | Landed via RECOVERY-01 (attempt 1 lost to a provider stream abort mid-ck1, zero commits; attempt 2 resumed from the preserved tree). ck1 = 24b37c1 (state + verbs + snapshots + proof suite), ck2 = db531d5 (CA-01 proof). CA-01 passed; CA-02 verified against the landed source at this receive — no divergence |
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

**Current observed baseline (after SESSION-01, commit `db531d5`, Orchestrator-run at receive 2025-09-26):** `pnpm typecheck` exit 0 · `pnpm lint` exit 0 · `pnpm test` **456/456 across 31 files** (421 baseline + S01's 32 inventory + 3 snapshot tests, exactly 2 new/changed files). `pnpm build` still owes its S03 re-proof (24 dist files at plan HEAD; dist not rebuilt by S01 — the runtime-only-bundle isolation gate runs against the rebuilt dist at S03).

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
| CAP-01 | Character grant/drop/count with named rejections + events | `content.items` defs (pack data, already validated) | — | S01 ck1 | **verified** — S01 ck1 @24b37c1 (32/32 `tests/runtime/inventory.test.ts`; whole-repo 456/456 @db531d5, Orchestrator-run at receive) | grantItem/dropItem/countItem + InventoryEntry + facade grant/drop/count; every rejection rule asserted with state unchanged | — |
| CAP-02 | `grantLoot` rolls a pack table through the one engine into inventory | table defs (pack data) + CA-02 mapping + grantLoot's normalized dual-space resolver + the failed-outcome → named-rejection mapping (producer S01 ck1, unchanged owner) | CA-02 | S01 ck1 (implementation) / ck1 tests | **verified** — S01 ck1 @24b37c1: every CA-02 mapping branch + determinism + both nested reference forms (fixture `tables.`-prefixed; local bare-id) + failed-outcome rejections (`unresolvable-ref`/`table-roll-failed`), all asserted | grantLoot/rollLoot in `src/runtime/inventory.ts`; observed seed map recorded in Handoff Notes | — |
| CAP-01/02 restart leg | serialize → restore preserves inventory | snapshots contract `inventory` (committed) | CA-01 | S01 ck2 (proof) | **verified** — S01 ck2 @db531d5 (12/12 `tests/snapshots/character.test.ts`: round-trip deep-equal incl. loot-granted + partially-dropped inventory, no-aliasing, no zero-qty entries, key-pin untouched) | CA-01 proof cited by S03 | — |
| CAP-03 | Theme items reach generated packs; loot tables validate | stage 7 items contribution | CA-02 (committed text recheck) | S02 ck1 | planned | — | — |
| CAP-04 | Third theme passes the FR-21 coverage floor + determinism | wyldwood.json authored natively | CA-02 | S02 ck2–3 | planned | — | — |
| CAP-05 | Built-dist loot journey: generate → Runtime → loot → snapshot → restore | dist artifact (S03 builds it) | CA-01, CA-02 | S03 ck1 | planned | — | — |
| CAP-06 | README loot block runs + typechecks; outputs observed | README + docs-run re-key | — | S03 ck2 | planned | — | — |

## Contract Agreements

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|----|------------------------------|--------------------------------|-----------------------|------------------------------------------|-----------|----------|------------------------------------|
| CA-01 | Snapshot `inventory` = `{id: string, qty: int ≥ 1}[]` exactly; state only, lossless; identity gate unchanged | `src/runtime/snapshots.ts` (S01) → character envelope ⇄ host storage → `restoreCharacter` | Engine `state.inventory` ⇄ envelope `inventory` verbatim (fresh copies both ways); restore skips pack cross-validation; envelope keys unchanged (9) | Correction: S01 (snapshots.ts). Proof: S01 ck2 (round-trip + key-pin), cited by S03 | agreed | **landed** — S01 ck1 @24b37c1 (implementation), ck2 @db531d5 (proof) | **passed** — S01 ck2 @db531d5: round-trip serialize → JSON → restore on a fresh Runtime deep-equals state incl. non-empty inventory; envelope keys unchanged (9, key-pin untouched), 12/12 tests/snapshots/character.test.ts; rechecked at ck0 against the committed schema (inventory required, {id, qty}, qty ≥ 1, additionalProperties: false) |
| CA-02 | Loot value convention: string ⇒ `content.items[id]` qty 1; `{id, qty}` ⇒ stack; other values flavor (skipped); nothing grantable ⇒ `loot-grants-nothing` (no change) | theme tables (S02) → generated pack `tables` → `grantLoot` (S01) → `state.inventory` | Resolves against `content.items` only; ids kebab + globally unique (E-DUP-01); deterministic per seed; no ambient entropy; stage-7 `-loot` integrity check enforces CA-02-checkable references at generation time (objects with undeclared ids + missed `tables.`-prefixed nested refs; every other string in a `-loot` table is flavor, never an error). Nested-table refs resolve in both spaces: bare id (theme-space, generation convention) and 'tables.'-prefixed (pack-space fixture/validator convention) — grantLoot's resolver normalizes. A failed roll outcome (TableOutcome.ok === false: unresolvable-ref / range-gap / depth-exceeded / malformed-entries) rejects as a named runtime rule card (not silent, no state change, no loot:rolled event). | Correction: S01 (inventory.ts). Consumers authoring against it: S02 (all theme loot tables). **Provisional status RESOLVED at receive (Orchestrator, 2025-09-26):** the landed `src/runtime/inventory.ts` @24b37c1 matches this row + the full mapping verbatim — no divergence; S02's ck0 recheck remains mandatory and closes on the committed source | agreed | **landed** — S01 ck1 @24b37c1 | **passed (S01 leg)** — 32/32 tests/runtime/inventory.test.ts @24b37c1: every mapping branch + same-seed determinism + both nested reference forms (fixture `tables.`-prefixed `loot-chain`; local bare-id `barrow-chain`) + failed-outcome rejections; S02 ck3 seam proof (wyldwood, seed 7) and S03 journey re-proof (dist) still planned |

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

*(Orchestrator records Coder Handoff sections verbatim below.)*

### SESSION-01 — done (attempt 2 / RECOVERY-01; commits 24b37c1 + db531d5; received 2025-09-26)

(attempt 1 lost to a provider stream abort mid-ck1 — no handoff existed; its partial narrative is preserved at `.program/results/SESSION-01.result.attempt1-crash.md`. Attempt 2 resumed from the preserved tree and delivered the full session.)

**notes:** CAP-01/CAP-02 implemented + proven; CA-01 proved (round-trip + key-pin, `restoreCharacterState`/`serializeCharacterState` in `src/runtime/snapshots.ts`, commit db531d5); CA-02 proved branch-by-branch against committed fixtures (`grantLoot`/`rollLoot`/`grantItem`/`dropItem`/`countItem` + `InventoryEntry` in `src/runtime/inventory.ts`, facade `grant/drop/count/loot`, commit 24b37c1). CA-02 is no longer provisional: the landed mapping matches the STATE.md text verbatim (string ⇒ content.items qty 1; `{id, qty≥1}` ⇒ stack; other values flavor; nothing grantable ⇒ `loot-grants-nothing`; failed outcome ⇒ `unresolvable-ref` or `table-roll-failed`; dual-space normalized resolver; `opts.rng` wins, else `new Rng(seed ?? tableId)`). Observed deterministic `grantLoot` on `cloneRuntimePack()`: `district-scavenge` seed 0 → `loot:rolled` (`value {id:'rope', qty:1}`, `grants [{id:'rope', qty:1}]`, why `tables.district-scavenge`) then `item:granted` (`total 1`, why `content.items.rope`), inventory `[{id:'rope', qty:1}]`; seed 1 and seed 42 → `loot-grants-nothing`, state unchanged, no loot event; seed 4 → the same rope grant. `loot-chain`: seed 6 → rope grant (prefixed inner ref normalized), seed 1 → flavor ⇒ `loot-grants-nothing`, seed 0 → the weight-1 `'nothing'` branch ⇒ `unresolvable-ref` at jsonPath `tables.loot-chain.entries[1]`, artifactId `loot-chain`.

**verification:** `npx vitest run tests/runtime/inventory.test.ts` → 32/32; `npx vitest run tests/snapshots/character.test.ts` → 12/12; whole-repo `tsc --noEmit` → 0 errors, `eslint .` → 0 problems, `vitest run` → 456/456 across 31 files (baseline 421/30 + exactly this session's 32+3 in exactly 2 files; no over-selection, no regression). CA-02 assertions: every mapping branch, determinism, rejection paths with `JSON.stringify(state)` unchanged and no `loot:rolled` in the stream, both nested reference forms, bare-id dangling ref, load-guard for prefixed dangling ref (E-REF-01), depth-exceeded → `table-roll-failed` naming `MAX_TABLE_DEPTH (8)`. CA-01 assertions: serialize → JSON → restore on a fresh Runtime deep-equals original state including a loot-granted + partially-dropped inventory; no-aliasing both directions; envelope never carries a zero-qty entry; keys exactly `{id, qty}`.

**surprises:** (1) Recovery corrections beyond attempt 1's 8-fix plan (flavor-branch qty/value assertions, opts.rng unwrapped throw, cross-leaf qty comparison). (2) Leftover `let events: unknown[] | undefined` (TS4104 under tsc, vitest had passed) — stale mid-edit crash artifact; removed. (3) Two lint errors from the crashed edit state (unused destructure; `(ref)` → zero-arg resolver). (4) Missing trailing newline restored. (5) Prompt-premise corrections verified against core source: `loot-chain`'s `'nothing'` branch is the FAILING branch (`unresolvable-ref`), not a third grant kind; a `tables.`-prefixed dangling inner ref cannot reach the runtime (load validator rejects the pack, E-REF-01) — the failed-outcome branch is reachable via bare-id refs and `rollLoot` on hand-built defs; `district-scavenge` seed map is 0/4/6→rope-grant, 1/42→flavor-reject. Engine untouched (mirrors core's documented failure mapping). (6) Runtime quirk, repo-invisible: bare `npx vitest`/`npx tsc` misresolved in the sandbox — gates run via `node_modules/.bin/*` with identical CLIs/flags. (7) Attempt 1's predicted out-of-lease seam (`character-profile.test.ts` vs readonly `hp`) did NOT materialize — landed `hp` stays mutable, that file passes 20/20. (8) Scratch probe deleted after reading (its relative imports were wrong; could never have run). (9) Arch fragment written + integrated by Orchestrator (arch/v1-core.md @07813d6).

**followUp:** SESSION-02 may author against CA-02 as landed — no divergence between STATE.md's CA-02 text and the committed `src/runtime/inventory.ts` (pre-dispatch recheck closes on commit 24b37c1). SESSION-03 docs may quote exactly: `loot table "<tableId>" rolled nothing grantable — flavor values are skipped (CA-02), state unchanged.` (`loot-grants-nothing`); `unknown item "<id>" — not declared in content.items.` (`unknown-item`, jsonPath `content.items.<id>`, hint lists known items); `"<itemId>" is held x<held>; dropping <amount> would overdraw — rejected, no state changed.` (`insufficient-qty`); `loot roll failed: <core message>` for failed outcomes (`unresolvable-ref` keeps its name; other core reasons → `table-roll-failed`). The S03 dark-fantasy journey calls `grantLoot(rt, state, 'barrow-loot', { seed: 42 })` — grant-vs-nothing depends on that generated pack's table weights; docs should name the seed and the observed branch. M03 note: `character.ts → ./inventory` is a new realized intra-module value-import pair; `inventory.ts → ./character` is type-only (no third value-import cycle).
