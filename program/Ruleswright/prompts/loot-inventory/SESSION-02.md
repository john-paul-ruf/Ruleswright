# SESSION-02 — Compiler Loot Flow + Third Theme

> **Program:** Ruleswright
> **Feature:** loot-inventory
> **Modules:** M04 (compiler), M01 (schema — types only, no contract files)
> **Depends on:** SESSION-01 (consumes `grantLoot` + CA-02; both rechecked at checkpoint 0)
> **Concurrent with:** — (serialized behind S01; its lease would not overlap any concurrent session anyway)
> **Owns:** `src/compiler/stages/tables.ts`, `src/compiler/theme-loader.ts`, `src/compiler/index.ts`, `src/compiler/themes/wyldwood.json`, `tests/compiler/stages.test.ts`, `tests/compiler/coverage-floor.test.ts`, `tests/compiler/themes.test.ts`
> **Reads:** `src/compiler/pipeline.ts`, `src/compiler/stages/*.ts`, `src/compiler/theme.ts`, `src/compiler/knobs.ts`, `src/compiler/errors.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/schema/artifacts.ts`, `src/schema/contracts/pack.schema.json`, `src/core/tables.ts`, `src/runtime/inventory.ts` (S01's committed API + CA-02), `tests/compiler/pipeline.test.ts`
> **Resources:** —
> **Checkpoints:** 3

## Module Context
| ID | Module | Read | Why |
|----|--------|------|-----|
| M04 | Compiler `src/compiler/**` | yes (modify subset) | The items producer gap and the theme registry live here |
| M01 | Schema `src/schema/artifacts.ts` | yes | `ItemDef`/`PackContent.items` types you mirror in the theme — **do not modify; type-only import** |
| M03 | Runtime `src/runtime/inventory.ts` | yes (read-only) | CA-02's committed text is the loot convention your theme tables must satisfy |

## Context
The compiler's seven stages copy `stats`, `skills`, `feats`, `classes` +
`progression`, `spells` + `economy` + pools, `bestiary` + `races` + `conditions`,
and `tables` + `actions` — but **no stage contributes `content.items`**. The proof:
`src/compiler/stages/tables.ts` ends with
`ctx.own = { tables: ctx.pack['tables'], actions: ctx.pack['actions'] }` and never
touches `ctx.theme.content?.items`, while both shipped themes declare items blocks
(dark-fantasy.json "items" after "conditions"; zombie-urban.json likewise) and
`coverage-floor.test.ts`'s kebab-unique check iterates
`Object.keys(pack.content.items ?? {})` — which silently passes on the empty
object the stage leaves. Loot tables roll item names into a void.

Fix that, register a third showcase theme (coined **wyldwood** — fey/wilderness,
the format's third proof), and re-key the acceptance spine for three themes.

**Theme shape authority:** `src/compiler/theme.ts` `ThemeTemplate` — items ride
the existing `content?: PackContent` field. **No new theme-template field is
needed or allowed** (the theme type mirrors the pack sections; adding a parallel
items map would create two sources of truth). Items are authored inside
`content.items` exactly like the two shipped themes already do.

## Capabilities
- **CAP-03 — Items flow generation:** a theme's `content.items` reaches the
  generated pack's `content.items` verbatim, and loot tables that reference
  those ids validate (E-REF-01 clean). Producer contribution (stage 7); the
  composed behavior's proof owner is this session's checkpoint 1 for both
  shipped themes + the new one.
- **CAP-04 — Third theme:** `loadTheme('wyldwood')` generates a complete,
  validator-clean pack exercising the same coverage floor as the other two
  (the file-list test at coverage-floor.test.ts:324 is re-keyed to the
  three-theme registry; no bullet is dropped). Integration owner/checkpoint:
  this session, checkpoint 2.

Production path: theme JSON → stage 7 copies items → stage 8
`validatePack` → `Pack.content.items` → (runtime side, SESSION-01)
`grantLoot('tables.<loot table>')`. The journey's runtime leg is proven in
SESSION-01; this session proves the compiler leg and the seam between them.

## Contract Agreements
- **CA-02 (recheck at checkpoint 0):** read the committed
  `src/runtime/inventory.ts` + `tests/runtime/inventory.test.ts` and confirm the
  value convention as landed: string ⇒ item id resolving in `content.items`
  (qty 1); `{id, qty}` object ⇒ that stack; other values = flavor, skipped;
  nothing grantable ⇒ `loot-grants-nothing`. Author every new loot-table entry in
  the theme against exactly that mapping. If the committed source diverges from
  STATE.md's recorded CA-02 mapping, **stop and report `blocked`** with the
  divergent lines — do not re-derive the convention in the theme.
- **No CA touches schemaVersion or contract files.** The pack schema already
  carries `content.items` (pack.schema.json $defs/content/properties/items) and
  the validator already checks items (validate/sections/content.ts
  `checkItems`): name required, optional `kind`, unknown-field rejection,
  global id uniqueness (E-DUP-01), kebab ids. Custom Rule 1 holds —
  `src/schema/contracts/**` is not in this lease.
- **No registry growth:** loot stays table-shaped; no new DSL function, no new
  event from the compiler side.

## Files to Create/Modify
| File | Action | What Changes |
|---|---|---|
| `src/compiler/stages/tables.ts` | modify | Stage 7 gains the items contribution + a located rejection when a rolled loot table's grantable values reference undeclared item ids |
| `src/compiler/theme-loader.ts` | modify | Import + register `WYLDWOOD`, third `loadTheme` case |
| `src/compiler/index.ts` | modify | Re-export `WYLDWOOD` beside `DARK_FANTASY`/`ZOMBIE_URBAN` (the D20 lesson — surface completeness in the same lease) |
| `src/compiler/themes/wyldwood.json` | create | The third theme (authoring constraints below) |
| `tests/compiler/stages.test.ts` | modify | Stage-7 items suite: flow-through + undeclared-item rejection |
| `tests/compiler/coverage-floor.test.ts` | modify | File-list test re-keyed to 3 files; PACKS + the showcase-split sections extended for wyldwood |
| `tests/compiler/themes.test.ts` | create | Focused wyldwood suite: generation, validation, determinism, loot-table rollability through the one engine |

## Implementation

### Checkpoint 0 — premise recheck (no commit unless facts differ)
Read the committed `src/runtime/inventory.ts` (CA-02 mapping + `grantLoot`
signatures + rejection rules) and STATE.md's Contract Agreements. Confirm the
stage-7 gap by reading `src/compiler/stages/tables.ts` and one theme's items
block. **If CA-02's committed source diverges from STATE.md, stop, set
`blocked`, report the divergent lines.** No commit unless a documented premise
is wrong (then commit nothing — the correction is Orchestrator's).

### Checkpoint 1 — items flow through stage 7
1. Read `src/compiler/stages/tables.ts` fully and
   `tests/compiler/stages.test.ts`'s stage-7 describe block.
2. In stage 7, after the tables/actions contributions, add the items
   contribution guarded like races/conditions in stage 6 (bestiary.ts):
   ```ts
   const items = ctx.theme.content?.items;
   ...
   if (items !== undefined)
     content['items'] = structuredClone(items) as NonNullable<Pack['content']>['items'];
   if (Object.keys(content).length > 0) ctx.pack['content'] = content;
   ctx.own = { tables: ctx.pack['tables'], actions: ctx.pack['actions'], items: content['items'] };
   ```
   (Keep the existing early throws for missing tables/actions untouched; items
   stay optional — a theme with no items simply contributes nothing.)
3. Add the located loot-integrity check (theme-side, same style as
   bestiaryStage's action checks), restricted to tables whose id ends in
   `-loot`, in deterministic `Object.entries` iteration order (theme
   declaration order — the pipeline's convention), with the same card style
   and located message fields as the other stage checks. Per entry:
   - (b) an object with an `id` key that is not a declared item id ⇒ one
     `themeCard('E-REF-01', …)` GenerationError naming the table id, entry
     index, and the undeclared id.
   - (a) a string that resolves as an **intended nested-table reference but
     misses** — i.e. a string starting with `tables.` whose suffix is not a
     declared table id (mirrors the load-validator's semantic check at
     `src/schema/validate/sections/tables.ts:170-185`) ⇒ the same
     `themeCard('E-REF-01', …)` with the same located message fields. Bare-id
     nested refs need no re-check here: they are covered at generation time by
     stage 7's existing every-table-rolls proof, which already fails located
     (E-TBL-01/E-REF-01 cards) on unresolvable refs through `resolverOf`.
   - **Every other string in a `-loot` table — `nothing`, item ids not yet
     declared, bestiary-style names, prose — is CA-02 flavor, never an error.**
     State this explicitly in the check's code comment so the check cannot
     swallow the shipped themes' `nothing` branches
     (dark-fantasy.json:634 `barrow-loot`, zombie-urban.json:360
     `district-scavenge`). Keep this restriction to `-loot`-suffixed tables so
     `wandering-dread`'s bestiary-name values and `weather`'s flavor strings
     stay out of scope — CA-02's flavor clause.
   - Wyldwood's ranged `-loot` table with flavor values (required by ck2) must
     pass this check — flavor values are data.
4. `tests/compiler/stages.test.ts`: extend the stage-7 block — items verbatim in
   the pack; a loot-table entry naming an undeclared id fails located
   (GenerationError, message contains the table id); a theme without items
   still generates (build the no-items case from `structuredClone(microTheme())`
   with `delete …content.items` — microTheme itself carries
   `content.items = {'ember-oil'}`, tests/compiler/pipeline.test.ts:93).

**Commit when:** `pnpm typecheck` exit 0, `npx vitest run tests/compiler/stages.test.ts`
green, whole `pnpm test` green — and the closing assertion is explicit: both
shipped themes still generate with **zero cards** and **byte-identical existing
sections** (the new contribution must not change their existing sections; they
only gain `content.items`). Pathspec: `git add -- src/compiler/stages/tables.ts
tests/compiler/stages.test.ts`.

### Checkpoint 2 — wyldwood theme
1. Author `src/compiler/themes/wyldwood.json` mirroring the shipped themes'
   shape (id/title/knobs/stats/economy/actions/formulas/content/progression/
   bestiary/tables + `readme` naming a documented example override — the FR-21
   readme assertion greps `overrides` and `target`).
2. **Coverage floor (FR-21) is load-bearing — the theme must satisfy it
   natively:** ≥2 classes each with a progression entry covering levels 1–10
   (attackTable XOR attackBonus; save arrays length 10); ≥1 multi-class race cap
   table; the five named saves `vigor, grace, tenacity, reason, presence`;
   ≥2 skills; ≥1 reactive feat (trigger.on present — featsStage enforces); ≥3
   conditions with ≥1 carrying `restricts` referencing a declared tag
   (cross-section E-REF-01); ≥1 melee action with `hasTarget(adjacent)`, ≥1
   ranged action (`attack(ac, 0)` pattern the floor greps), ≥1 burst spell; ≥2
   tables spanning all three kinds (weighted + ranged + nested); knobs ≥2; a
   `tables.xp` ranged table (progression's XP path reads it); kebab-unique ids
   pack-wide; **coined names only** — the SRD-adjacent lint list in
   coverage-floor.test.ts applies to this file's text too (`strength`,
   `dexterity`, `constitution`, `intelligence`, `wisdom`, `charisma`,
   `fireball`, `magic missile`, `lightning bolt`, `cure light`, `raise dead`,
   `kobold`, `beholder`, `mind flayer`, `lich`, `saving throw`, `hit dice`,
   `armor class`, `spells per day`, `spell slots`, `fortitude save`,
   `reflex save`, `will save`, `d20 system`, `dungeons`, `dragons`,
   `pathfinder`, … — grep your file against the full list before committing;
   "d20" only inside DSL body text, never the title).
3. Items + loot: an items block (≥4 items, kinds coined e.g. weapon/armor/
   charm/provision — keep ids distinct from every other id in the pack,
   E-DUP-01) and at least three loot tables exercising CA-02: one weighted
   leaf, one nested chain (`"value": "tables.<other>"`), one ranged with flavor
   values (skipped per CA-02 — this table must pass the ck1 integrity check;
   flavor values are data). At least one `#knob/<id>` token reaching an item
   table's weight or a formula (knob visibility).
4. Register: `theme-loader.ts` import (the .json import needs only
   `resolveJsonModule`, already enabled — OWNER-04-TSCONFIG's lesson is paid),
   `loadTheme` case, `WYLDWOOD` const; `src/compiler/index.ts` re-export.
5. Re-key `coverage-floor.test.ts:324`'s file-list assertion to
   `['dark-fantasy.json', 'wyldwood.json', 'zombie-urban.json']`; add wyldwood
   to the `PACKS` array and the `for (const themeId of [...])` loops so the
   shared bullets run against it; add a small showcase-split describe for
   wyldwood (its own identity: e.g. charm/ward-focused loot, hedge-magic list
   size assertion).
6. `tests/compiler/themes.test.ts`: wyldwood generates + validates zero cards
   (`validatePack(pack, packDslChecker)`), same-seed byte-identity +
   `packContentHash` equality, different-seed hash divergence, `loadTheme`
   resolves all three names and rejects an unknown one with the existing error
   shape, and every loot table rolls through `rollTable` deterministically for
   a fixed seed.

**Commit when:** typecheck + lint exit 0; `npx vitest run
tests/compiler/coverage-floor.test.ts` and `npx vitest run
tests/compiler/themes.test.ts` green; whole `pnpm test` green. Pathspec:
`git add -- src/compiler/themes/wyldwood.json src/compiler/theme-loader.ts src/compiler/index.ts tests/compiler/coverage-floor.test.ts tests/compiler/themes.test.ts`.

### Checkpoint 3 — seam proof + barrel sanity
1. A seam test in `tests/compiler/themes.test.ts` (or extending it) composing
   both halves of CA-02 end-to-end: generate wyldwood → `new Runtime(pack)` →
   `createCharacter` → `grantLoot(rt, state, '<loot table>', { seed: 7 })`
   twice ⇒ identical stacks (the compiler↔runtime seam closed through real
   generated data, not fixtures).
2. Whole-repo gates: `pnpm typecheck && pnpm lint && pnpm test`.

**Commit when:** all three gates exit 0. Pathspec:
`git add -- tests/compiler/themes.test.ts` (plus any same-lease file the seam
test forced you to touch — never beyond `Owns`).

## Verification
- Scoped: `npx vitest run tests/compiler/stages.test.ts`,
  `npx vitest run tests/compiler/themes.test.ts`,
  `npx vitest run tests/compiler/coverage-floor.test.ts`,
  `npx vitest run tests/compiler/composition.test.ts` (compose path untouched
  but adjacent), then `pnpm typecheck && pnpm lint && pnpm test`
  (baseline at plan HEAD: 421/421 — this session grows it; no regression).
- Freshness rule: the themes CI job and the built-package proofs in SESSION-03
  run against the **rebuilt** dist — do not edit `.github/workflows/ci.yml`
  (not in lease); SESSION-03 verifies the CI claims stay honest.
- CA-02 seam proof (ck3): the same generated pack, same seed ⇒ same grants via
  `grantLoot` — assert the exact `state.inventory` contents for seed 7.
- Determinism proof (ck2): `generateCampaign({theme: loadTheme('wyldwood'), seed: 42})`
  twice ⇒ identical bytes and hashes.

## State Update
Return a Handoff with: status; checkpoint commits; the wyldwood loot-table →
item-id map (id list + which tables roll them); the observed deterministic
`grantLoot` output for the seam test's seed; checks run + counts; surprises;
followUp for SESSION-03 (docs will quote the wyldwood generation line and the
`loadTheme` triple — name the exact counts: classes/spells/tables/items — so
the docs block pins real output).

Record as deferred product debt in this section's closing note: stricter
string-grantable typo-protection for non-`tables.` strings in `-loot` tables
(warning-class card or a declared grantable-vocabulary convention) is a product
decision deferred with final-report debt — not a defect in this checkpoint
(REPLAN-LOOT-01, from the W0 planning-completeness review).