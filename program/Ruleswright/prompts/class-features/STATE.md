# State Tracker — Ruleswright / class-features

## Program / Feature / Intent / Sessions

- **Program:** Ruleswright (`program/Ruleswright/`)
- **Feature:** class-features (closes F-FP2 / F-P5: the FR-6 "class features" item)
- **Plan HEAD:** `f36d4ae`. Every gate is green there (*Verification Baseline*).
- **Planned:** 2026-10-04 by Planner
- **Intent:** a class feature `{level, ref}` moves to `progression.<classId>.features`. Its `ref` names exactly one pack id:
  - a **feat**: the character holds it while its class level ≥ `level`. Granted feats are worked out from the character's classes, never stored, and never use a feat slot. Reactive ones are offered in combat like learned feats.
  - an **action**: the action is declarable in combat from that class level on (level-gated class actions).
  - a **spell**: the spell is known from that class level on.

  The bundled themes and fixtures are migrated, and every broken `ref` is fixed. Contract v1.10 is a pre-release in-place revision; `schemaVersion` stays 1.
- **Sessions:** 5. Three are Author re-entries (S01 DB, S02 Architect, S05 Designer) and two are Coder sessions (S03, S04).

**Human answers on record (2026-10-04).** Planner asked:
1. What does a class feature do? (a) grant a feat; (b) unlock a pack action or spell at that level; (c) a new `content.features` artifact type; (d) label only.
2. If (a): do granted feats use feat slots? (recommended: no)
3. Where does the field live? Keep `content.classes.<id>.features` (recommended), or move it to `progression.<id>.features`?
4. Bundled content: fix the 11 broken refs with coined feats, with at least one reactive feature per theme, and rename `wardens-glyph`. OK?
5. Authorization: DB re-entry; also the Spec/Architect re-entry for `architecture.md:62,80,88,208` (F-D8) and the Designer re-entry for `mocks/progression.html:70-80` (F-R6)?

The human answered: "**1 a,b 2 no 3 move it, fix packs, 4 fix the broken packs, 5 you have my auth for whatever you need**". Read against the questions:
- **1 → a and b.** A feature's `ref` kind is decided by the map that declares the id (ids are unique pack-wide, E-DUP-01): feat → granted; action or spell → unlocked at that level (DD-C1). (c) and (d) are not built.
- **2 → no.** Granted feats never use feat slots (DD-C2).
- **3 → move it, fix packs.** The field lives at `progression.<id>.features`. `content.classes.<id>.features` is removed, and the bundled themes and test fixtures are migrated (DD-C3). This was against Planner's recommendation; it is the builder's call.
- **4 → fix the broken packs.** Every bundled feature `ref` resolves after this feature, including the two `wardens-glyph` refs that are now redundant spell unlocks (DD-C10).
- **5 → blanket authorization.** It covers the DB schema-change re-entry (S01), the Architect re-entry for F-D8 (S02) and the Designer re-entry for F-R6 (S05), plus the DB-owned seed-data drift at `database.md:721-722` (wyldwood unnamed), folded into S01. Planner reads it as authorization for this scope, not for unrelated destructive work.

## Session Status

| # | Session | Modules | Owns | Status | Checkpoint | Completed | Notes |
|---|---|---|---|---|---|---|---|
| S01 | Author re-entry (DB): contract v1.10, class features | — (DB) | `program/Ruleswright/specs/database.md`, `src/schema/contracts/pack.schema.json` | done | 2/2 | 2026-10-05 | ck1 `8d5828c`, ck2 `efa971d`; V1–V7 green, 938/938 |
| S03 | Schema mirror, validator, bundled themes, fixtures, characterization re-key | M01, M04, tests | `src/schema/artifacts.ts`, `src/schema/error-card.ts`, `src/schema/validate/index.ts`, `src/schema/validate/sections/content.ts`, `src/schema/validate/sections/progression.ts`, `src/schema/validate/sections/cross.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `tests/runtime/fixtures/pack.ts`, `tests/schema/fixtures.ts`, `tests/schema/validate.test.ts`, `tests/compiler/coverage-floor.test.ts`, `tests/proofs/combat-characterization.test.ts`, `tests/proofs/feat-slots-journey.test.ts` (lease rev 2, F-C1); scratch-only, never committed: `tests/proofs/characterization-dump.scratch.test.ts` | done | 2/2 | 2026-10-05 | ck1 `c3fc398`, ck2 `c0a23b1`; N 938 → 943 → 951; arch `c7d517f` |
| S04 | Runtime: granted feats, unlocked actions and spells, host query, journey, README | M03, tests, docs | `src/runtime/features.ts`, `src/runtime/feats.ts`, `src/runtime/pools.ts`, `src/runtime/character-profile.ts`, `src/runtime/index.ts`, `tests/runtime/features.test.ts`, `tests/runtime/feats.test.ts`, `tests/runtime/pools.test.ts`, `tests/runtime/combat/character-profile.test.ts`, `tests/runtime/combat/module-surface.test.ts`, `tests/proofs/class-features-journey.test.ts`, `tests/proofs/docs-run.test.ts`, `README.md` | done | 4/4 | 2026-10-05 | ck1 `3a49d9f`, ck2 `dd70d3e`, ck3 `32eaa35`, ck4 `64a3231`; N 951 → 970; arch `de67360` |
| S05 | Author re-entry (Designer): `progression.html` F-R6 + class-features panel | — (Designer) | `program/Ruleswright/mocks/progression.html` | pending | — | — | |
| S02 | Author re-entry (Architect): F-D8 file-location drift + `features.ts` | — (Architect) | `program/Ruleswright/specs/architecture.md` | pending | — | — | |

(Session numbers follow authoring order. The Wave Plan gives the execution order.)

## Wave Plan

| Wave | Sessions | Why concurrent |
|---|---|---|
| W1 | S01 | single. Every later session reads the v1.10 contract it writes. |
| W2 | S03 | single. It needs the landed contract (CA-C1/CA-C2 are provisional against S01 ck2), and S04 needs its types and content. |
| W3 | S04 ∥ S05 | Leases are disjoint (S04: `src/runtime/**` files, `tests/**` files, `README.md`; S05: `mocks/progression.html` only). S05 runs no code gate, so S04's uncommitted edits cannot turn S05's checks red (standing rec 82b4e0ab). S05 quotes the bundled content S03 landed, so it waits for S03. |
| W4 | S02 | Its lease is disjoint from everyone's, but it lists `src/runtime/features.ts`, which S04 creates. It runs after S04 lands, so the doc never names a file that does not yet exist. It may overlap S05. |

## Dependency Graph

```
S01 (DB v1.10) ──► S03 (schema/validator/themes) ──► S04 (runtime) ──► S02 (Architect)
                                      └──────────────► S05 (Designer)
```

- S03 → S01: the contract text and `pack.schema.json` shape S03 mirrors (CA-C1, CA-C2).
- S04 → S03: `ClassProgression.features` (type), the resolved bundled content and the fixture feat. Its journey runs on generated themes.
- S05 → S01, S03: the panel quotes the v1.10 rules and the landed dark-fantasy features.
- S02 → S04: the doc lists `src/runtime/features.ts`.

## Architecture Reference (feature-specific)

- **M01:** `artifacts.ts` `ClassDef` (l.75-88) loses `features`. `ClassProgression` (l.154-164) gains `features?: ClassFeature[]`. `ClassFeature` (l.68-72) is kept.
- **M01 validator:**
  - `sections/content.ts:81` drops `'features'` from the class `forbidUnknown`, and its shape block (l.85-134) moves to `sections/progression.ts`.
  - The `ref` resolution goes in a new `checkClassFeatures(ctx, json)` in `sections/cross.ts`, called from `validate/index.ts` after `checkProgressionPairing` (l.79).
- **M03:** a new **leaf** `src/runtime/features.ts` (type imports only). It holds `classFeatures` (public), plus `grantedFeats`, `unlockedActions` and `unlockedSpells` (internal, not on the barrel). Its consumers:
  - `feats.ts` (`learnFeat` refuses a granted feat);
  - `pools.ts` (`knownSpells` adds unlocked spells);
  - `character-profile.ts` (`profileFromCharacter`: actions, spells, feats).

  No new cross-module edge, no cycle: features.ts value-imports nothing.
- **M04:** theme JSON only (no compiler source change; stage 4 `classes.ts` passes `progression` through).
- No combat-engine change. The fight reads `profile.actions`, `profile.spells` and `profile.feats` as given (`combat/combatants.ts`, `combat/triggers.ts:73-86`, `snapshots/combat.ts:496-524` re-states profiles on restore).

## Scope Summary

| ID | Module | Change |
|---|---|---|
| — | DB (Author) | `database.md` v1.10 + `pack.schema.json` (S01) |
| — | Architect (Author) | `architecture.md` drift (S02) |
| — | Designer (Author) | `mocks/progression.html` (S05) |
| M01 | Schema | `artifacts.ts`, `error-card.ts` (l.12 comment), `validate/{index,sections/content,sections/progression,sections/cross}.ts` (S03) |
| M03 | Runtime | `features.ts` (new), `feats.ts`, `pools.ts`, `character-profile.ts`, `index.ts` (S04) |
| M04 | Compiler | `themes/{dark-fantasy,zombie-urban,wyldwood}.json` (S03) |
| M05 | Root | none (`src/index.ts` is `export * from './runtime'`, l.8) |

## Design Decisions

- **DD-C1 (human Q1 "a,b") — ref kinds.** `progression.<classId>.features[i] = {level, ref}`. `ref` must be a key of exactly one of `content.feats`, `actions` or `content.spells`. Ids are pack-unique (`helpers.ts:109-124` `registerId`, E-DUP-01), so the kind is unambiguous.
  - feat → **granted**;
  - action → **unlocked** (declarable in combat);
  - spell → **unlocked** (known);

  each while the character's level **in that class** ≥ `level`. Any other id, or an unknown one, is `E-REF-01` at `progression.<c>.features[i].ref`, with a did-you-mean hint over feats ∪ actions ∪ spells. No new rule id.
- **DD-C2 (human Q2 "no") — granted is not learned.**
  - Granted feats are derived from `(pack, classes)`, like `knownSpells` (`pools.ts:302-315`). They are never written to `CharacterState.feats`, never counted by `featSlotTally` (`feats.ts:21`), and never serialized: the character snapshot is unchanged, and `snapshots.schema.json` is not touched.
  - `learnFeat` of a currently granted feat refuses `feat-known`; the message names the granting class feature.
  - A feat learned earlier and granted later stays held and keeps its slot. There is no refund in v1; this is documented.
  - Lowering a class level with `levelSet` drops the grant with no event.
- **DD-C3 (human Q3 "move it, fix packs") — location and versioning.** `content.classes.<id>.features` is removed: a pack still using it gets `E-SCHEMA-02` at `content.classes.<id>.features` (the existing `forbidUnknown` closed-contract card, `helpers.ts:72-76`). This is a breaking change under the versioning discipline (`database.md:751-752`). It ships as a **pre-release in-place revision**, the v1.6 caveat (a) precedent:
  - `package.json` is at `0.1.0` and `git tag` is empty, and `database.md:753-755` says "Until first release, v1 remains revisable by DB";
  - `schemaVersion` stays 1, with **compatibility caveat (g)**.

  DB applies this under the human's blanket authorization (answer 5).
- **DD-C4 — load-time constraints** (`E-SCHEMA-01` unless stated):
  - `level` is an integer ≥ 1 and ≤ the class's level ceiling (its shortest `saves` array, the `featSlots` coverage rule at `progression.ts:189-207`);
  - `ref` is a kebab id string;
  - a `ref` appears at most once per class;
  - **redundancy is `E-REF-01`**:
    - an action `ref` that is also in `content.classes.<id>.actions` (available from level 1, so the gate would be ignored);
    - a spell `ref` whose `magic.lists` intersect the class's own `spellLists` (already known, so the unlock is dead).

  A feature must change something at its level.
- **DD-C5 — multi-class.** Each class entry contributes its own features at its own class level. Unions keep first-occurrence order (class order, then feature order), as the class `actions` union does (`character-profile.ts:75-80`).
- **DD-C6 — characters only.** Statblocks keep their explicit `actions` list. `spawnMonster` is unchanged, even when a statblock uses a class's `attackTable`.
- **DD-C7 — no new event, one host query.** No `feature:*` event: level events are unchanged, so FR-13 emission stays `level:reached` only. The host reads `classFeatures(runtime, character: CharacterState): readonly ClassFeatureView[]` with `ClassFeatureView = {classId, level, ref, kind: 'feat' | 'action' | 'spell', active: boolean}`, in DD-C5 order and including inactive (future) features. It is exported from the runtime barrel.
- **DD-C8 — unlocked artifacts ride the existing pipeline.** Restricts, reach/range gates, costs, `armorCasting` and slot/pool spend are all unchanged. An unlocked spell still needs a bound slot or pool points to cast.
- **DD-C9 — byte-stable composition.**
  - `profile.actions` = the existing class-actions union, **then** unlocked actions not already present.
  - `knownSpells` = pack spell order, filtered by list match **or** active unlock.
  - `profile.feats` = held reactive feats in held order, **then** granted reactive feats not already held.

  A character with no active feature gets a byte-identical profile and known-spell list. `no-combat-actions` counts unlocked actions.
- **DD-C10 (human Q4 "fix the broken packs") — bundled content.** Every row below is prescribed (ids verified unused at `f36d4ae`; ceilings are 10 for every class in all three themes). New feats and actions are **appended after** the existing entries of their maps. Display names are coined (Custom Rule 6).

  **Constraints:**
  - warden, hexer and scavenger carry **passive feats only**. They are the classes the tests, README and characterization legs build.
  - Each theme has ≥ 1 action unlock and ≥ 1 reactive granted feat, placed on a less-used class.
  - Reactive feats trigger on `condition:applied[target=self]` (coverage-floor l.296).
  - New actions cost `{slots: {main: 1}}`, have no `trigger`, are not move actions (coverage-floor l.196-197 counts exactly one move and one reaction) and are in no class `actions` or statblock list.
  - No new spells (docs-run l.180 pins 33 dark-fantasy spells).

  | Theme | Class | Level | `ref` | Kind | Note |
  |---|---|---|---|---|---|
  | dark-fantasy | warden | 1 | `oath-of-the-warden` | feat, passive (new) | was unresolved |
  | dark-fantasy | warden | 3 | `wardens-resolve` | feat, passive (new) | replaces `wardens-glyph` (redundant spell: warden list) |
  | dark-fantasy | hexer | 1 | `hexers-eye` | feat, passive (new) | was unresolved |
  | dark-fantasy | crypt-warden | 2 | `barrow-rite` | action (new) | replaces `wardens-glyph` (redundant: crypt-warden lists warden) |
  | dark-fantasy | crypt-warden | 3 | `crypt-vigil` | feat, reactive (new): `trigger.on` `condition:applied[target=self]`, `effect` `applyCondition(braced, 1)` | |
  | zombie-urban | scavenger | 1 | `scavengers-instinct` | feat, passive (new) | was unresolved |
  | zombie-urban | scavenger | 4 | `block-runner` | feat, passive (new) | was unresolved |
  | zombie-urban | fixer | 1 | `milers-read` | feat, passive (new) | was unresolved |
  | zombie-urban | fixer | 3 | `jury-rig` | action (new) | |
  | zombie-urban | medic | 2 | `field-surgery` | feat, passive (new) | was unresolved |
  | zombie-urban | medic | 3 | `rot-read` | spell (existing, fixer list, level 1, stamina 2 pts) | the bundled spell unlock |
  | zombie-urban | medic | 4 | `steady-pulse` | feat, reactive (new), same trigger/effect shape | |
  | wyldwood | warden | 1 | `oath-of-the-verge` | feat, passive (new) | was unresolved |
  | wyldwood | warden | 5 | `verges-glyph` | feat, passive (new) | was unresolved |
  | wyldwood | hexer | 1 | `hexers-eye` | feat, passive (new) | was unresolved |
  | wyldwood | hedge-mage | 2 | `hedges-eye` | feat, passive (new) | was unresolved |
  | wyldwood | hedge-mage | 3 | `thornward` | action (new) | |
  | wyldwood | hedge-mage | 4 | `bramble-vigil` | feat, reactive (new), same shape | |

  Passive feats use `"passive": "1"`, the existing bundled passive form (e.g. `ironhide`). `braced` exists in all three themes (second-gust uses it).
- **DD-C11 — test fixtures.** `tests/runtime/fixtures/pack.ts:52` and `tests/schema/fixtures.ts:56` move `features: [{level: 1, ref: 'feature-warden-oath'}]` to `progression.warden.features`. Each fixture gains a passive feat `feature-warden-oath` (`{name: 'Warden Oath'}`), so the ref resolves without granting a feat that existing tests learn (`ironhide`, `vengeful-strike`).
- **DD-C12 — characterization re-key.** Moving the field changes every generated pack's `contentHash`. That reaches the characterization digests through legs that serialize snapshots. Re-keying is allowed only with the normalized-dump proof (CA-C5) at each checkpoint that changes theme bytes. DD-C10 keeps every leg's profiles unchanged, so the proof expects a `contentHash`-only difference.
- **DD-C13 — sequencing.** S03 lands in two checkpoints so the tree is valid at both:
  - ck1 **moves** the field (validator accepts only the new location; refs not yet resolved);
  - ck2 **resolves** refs and fixes content in the same commit (enforcement and fixed content cannot land apart).

## Verification Baseline

Observed by Planner at `f36d4ae`, 2026-10-04 ~17:00. `src`/`tests` are identical to `db38f31`.

| Gate | Effective command | Result |
|---|---|---|
| V1 | `pnpm typecheck` (`tsc --noEmit`) | 0 |
| V2 | `pnpm lint` (`eslint .`; ignores `dist/`, `node_modules/`, `coverage/`, `program/`, **not** `.program/`) | 0 |
| V3 | `pnpm format:check` (`prettier --check .`; `.prettierignore` excludes `program/`, `.program/`) | 0 |
| V4 | `pnpm build` (tsup) | 0 |
| V5 | `pnpm test` (`vitest run`) | **52 files, 938/938** (N₀ = 938) |
| V6 | `pnpm check:isolation` | 0 |
| V7 | `pnpm check:security` | not run by Planner; inherited 0 from combat-decomposition FINAL-REPORT (`db38f31`) |

**Hazards** (each has a working rule):
- **H1 `dist/` importers.** `tests/proofs/{spells,loot,equipment}-journey.test.ts` import `dist/`. Always run `pnpm build` immediately before `pnpm test`, or those journeys test stale code.
- **H2 `.program/` is linted.** ESLint does not ignore it. At `f36d4ae` it holds only `.py`/`.md`. Never put `.ts`/`.js`/`.mjs` scratch there; scratch output goes to `/tmp/ruleswright-class-features/`.
- **H3 filtering.** `pnpm test -- <pattern>` does not filter. Use `pnpm exec vitest run <path>` (PROGRAM-CONFIG).
- **H4 behaviour pin.** `tests/proofs/combat-characterization.test.ts` pins sha256 digests of 9 legs. Bundled-theme byte changes alter `contentHash` → re-key only under CA-C5 (owner S03).
- **H5 scratch files.** `tests/proofs/characterization-dump.scratch.test.ts` matches vitest's include. It must be deleted before every commit and before the whole-repo gates, or V2/V5 pick it up. Revert check: `test ! -e tests/proofs/characterization-dump.scratch.test.ts`.
- **H6 gitignored plan.** `program/Ruleswright/prompts/` is gitignored (`.gitignore:29`). VERIFICATION.md is committed by Orchestrator with `git add -f -- <path>` (PROGRAM-CONFIG convention).
- **H7 host await idle timeout** (~300 s). Re-await the same handle; this is not a crash.
- **H8 Author sessions.** `program/` is excluded from Prettier and ESLint, so Author files are not formatted. Their receive check is `git diff --name-only` plus `pnpm exec vitest run tests/schema` (DB) or nothing (Architect/Designer). Orchestrator still runs V1–V3 at every receive.

**Pin audit** (PROGRAM-CONFIG pin-lease convention; grep set: `tests/`, `README.md`, `src/`, `.github`, `scripts`, `program/Ruleswright/{specs,mocks,arch}`, for `features`, `feature-warden-oath`, `learnFeat`/`feat-known`, `knownSpells`, class `actions`, theme counts):

| Hit | Fact | Disposition / owner |
|---|---|---|
| `tests/proofs/combat-characterization.test.ts` digests | pack bytes → snapshot `contentHash` | re-key, S03 ck1 and ck2 (CA-C5) |
| `tests/runtime/combat/module-surface.test.ts:26-` runtime barrel list | adds `classFeatures` | S04 ck4 |
| `tests/compiler/coverage-floor.test.ts:196-197` | exactly 1 move + 1 reaction action per theme | holds (DD-C10 constraint); S03 |
| `coverage-floor.test.ts:204` | class `actions` tails `[move, reaction]` | holds: class `actions` unchanged |
| `coverage-floor.test.ts:225-241` | pack-wide unique ids | holds: new ids verified unused |
| `coverage-floor.test.ts:276-278` | first reactive feat matches `/condition:applied/` | holds: new feats appended after `second-gust` |
| `coverage-floor.test.ts:296` | every reactive feat ends `[target=self]` | holds (DD-C10 shape) |
| `tests/proofs/docs-run.test.ts:49` | quickstart has 4 ```ts blocks | holds: the count is over the **whole** README (`docs-run.test.ts:48-49`, ARCH-PRE F-C9), so S04's README section adds no ```ts block anywhere (use a ```json fence) |
| `docs-run.test.ts:179-180` | dark-fantasy 3 classes, 33 spells | holds: no class or spell added |
| `tests/proofs/feat-slots-journey.test.ts:131-140` leg 9 | dark-fantasy `Object.keys(content.feats)` `toHaveLength(4)` + learn-all loop (ARCH-PRE F-C1; missed by the field grep) | S03 ck2 (lease rev 2): filter to feats no `progression.*.features[].ref` names, keep `toHaveLength(4)` and the loop, rename to "learnable feats"; forward-compatible with S04 ck3 |
| `tests/runtime/fixtures/pack.ts:52`, `tests/schema/fixtures.ts:56` | old location | S03 ck1 (move), ck2 (feat) |
| `src/schema/error-card.ts:12` | example path `content.classes.warden.features[0].level` | S03 ck1 (comment) |
| `src/schema/validate/sections/content.ts:81-134` | old-location validation | S03 ck1 |
| `README.md:139-144` | profile = class `actions` union | S04 ck4 (unlocked actions) |
| `README.md:322-325` | known spells | S04 ck4 |
| `README.md:353-355` | `feat-known` | S04 ck4 (also granted) |
| `specs/database.md:484` | `features` row | S01 |
| `specs/database.md:721-722` | "two sample theme templates" | S01 |
| `specs/requirements.md:68` | FR-6 lists "class features" | holds (now built); Author-owned, no change |
| `specs/architecture.md:62,80,88,208` | stale file locations (F-D8) | S02 |
| `mocks/progression.html:70-85` | `awardXp(brynn, 2400)` → `level:reached warden 4` is false under v1.9 (F-R6). Also false on the numbers: Planner probe at `f36d4ae`, a level-1 warden reaches 2 at 2400 XP and 4 at 6000. The l.82-85 "byte-identical state" claim is false too (`xp` differs) | S05 |
| `arch/v1-core.md:29, 1392, 1411-1414` | "class features unbuilt" | Orchestrator arch integration at S03/S04 receive; final Archivist |
| `PROGRAM-CONFIG.MD` Custom Rule 1, M01/M03 key files | v1.10 event, `features.ts` | final Archivist |

**Observed at S03 receive (`c7d517f`, Orchestrator 2026-10-05):** V1–V4 0, V5 52 files **951/951** (N₁ = 951), V6 0, V7 0.

**Observed at S04 receive (`de67360`, Orchestrator 2026-10-05):** V1–V4 0, V5 54 files **970/970**, V6 0, V7 0; `src/runtime/{combat,snapshots}`, characterization and feat-slots-journey unchanged since `c0a23b1`.

**Feature gates:** after S04, V1–V7 green, and V5 = N₀ + the tests S03 and S04 add (each session reports its delta). Characterization digests change only as CA-C5 proves.

## Capability Readiness

| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|---|---|---|---|---|---|---|---|
| CAP-C1 | A pack author declares class features at `progression.<id>.features`. `new Runtime(pack)` / `validatePack` / compiler stage 8 accept valid ones and reject the old location, unknown or wrong-kind refs, redundant unlocks, out-of-range levels and duplicate refs, all at once, located (FR-2) | contract S01; mirror and validator S03 | CA-C1, CA-C2; S01 | S03 ck2 | **verified** (S03 ck2 `c0a23b1`, Orchestrator re-run 2026-10-05) | `pnpm exec vitest run tests/schema/validate.test.ts -t 'class features'` 10 passed (cases a–j, real `validatePack` + `packDslChecker`); themes pass stage 8; negative control `oath-of-the-wardenx` → `E-REF-01` at `progression.warden.features[0].ref` (reverted) | — |
| CAP-C2 | The bundled themes ship working features: all refs resolve, each theme has a reactive grant and an action unlock, and zombie-urban has a spell unlock | theme content S03 | CA-C2, DD-C10 | S03 ck2 | **verified** (S03 ck2 `c0a23b1`, Orchestrator re-run 2026-10-05) | `coverage-floor.test.ts -t 'v1.10 class features resolve'` 3 passed (one per theme, `runPipeline` incl. stage 8); landed features match the DD-C10 table row for row (Orchestrator node dump) | — |
| CAP-C3 | A character with class level ≥ L holds the feature's feat. A reactive one is offered and taken in combat (also across a combat snapshot). `learnFeat` refuses it (`feat-known`). It uses no slot, is not stored, and the character snapshot round-trips unchanged | `grantedFeats` S04 ck1; profile S04 ck1; `learnFeat` S04 ck3 | CA-C3; S03 | S04 ck1 (first narrow journey) → ck3 | **verified** (S04 `3a49d9f`, `32eaa35`; Orchestrator re-run 2026-10-05 at `64a3231`) | journey legs 1 (+ L2 control), 4, 5 green; `feats.test.ts` granted cases; negative controls (granted-feats line, learnFeat check removed) fail as expected (S04 handoff) | — |
| CAP-C4 | An action-unlock feature makes the action declarable from level L. Below L, `declare` → `declare:rejected {kind: 'no-action'}`, nothing spent | `unlockedActions` S04 ck2 | CA-C4; S03 | S04 ck2 | **verified** (S04 `dd70d3e`; re-run at `64a3231`) | journey leg 2: L1 `barrow-rite` → one `declare:rejected` `no-action`, state unchanged; L2 `action:resolved` | — |
| CAP-C5 | A spell-unlock feature makes the spell known from level L (`knownSpells`, `profile.spells`), so it can be declared in combat (points) and prepared (vancian). Below L it is not known | `unlockedSpells` S04 ck2 | CA-C4; S03 | S04 ck2 | **verified** (S04 `dd70d3e`; re-run at `64a3231`) | journey leg 3 (medic L2 unknown → L3 `spell:cast` points/stamina −2); `pools.test.ts` vancian unlock with `grave-light` (F-C4) | — |
| CAP-C6 | The host lists a character's class features with kind and active flag (`classFeatures`) | `features.ts` S04 ck1/ck4 | CA-C3, CA-C4 | S04 ck4 | **verified** (S04 `3a49d9f`, `64a3231`; re-run) | `features.test.ts` (5); journey leg 6 via barrel; module-surface pin includes `classFeatures` | — |
| CAP-C7 | Docs match behaviour: `database.md` v1.10 (S01), README class-features section (S04), `progression.html` (S05), `architecture.md` (S02) | Author roles + S04 | CA-C1 | S02 (last) | in progress: DB (S01 `8d5828c`), README (S04 `64a3231`, docs-run anatomy green) done; Designer (S05) and Architect (S02) pending | text review at receive; docs-run anatomy check (S04 ck4) | — |

**First narrow journey (S04 ck1).** Public API only, the real validator, compiler and combat engine, nothing mocked:
- `new Runtime(generateCampaign({theme: loadTheme('dark-fantasy'), seed: 42}))` → `createCharacter` crypt-warden L3 → `profileFromCharacter` (`profile.feats` contains granted `crypt-vigil`; `state.feats` stays absent).
- `startCombat` with the crypt-warden at initiative −100 and `spawnMonster(rt, 'barrow-wight', 'wight')` at +100, positions `{cw: {x: 0, y: 0}, wight: {x: 1, y: 0}}`.
- `step()` → `turn:began` (active = wight); the host then calls `fight.declare('grave-gaze', {targetId: 'cw'})` on the wight's turn (**corrected by ARCH-PRE F-C3**: `step()` alone does not declare; matches the characterization `featLeg`). `save(reason, 12, applyCondition(hexbound, 2), applyCondition(hexbound, 1))` applies `hexbound` on either branch.
- The offer `cw.crypt-vigil` opens → `respond('cw.crypt-vigil', 'take')` → `condition:applied braced`, `why.rule` `content.feats.crypt-vigil`.

**Planner probe (`f36d4ae` `dist/`, 2026-10-04):** the same script with today's `second-gust` *learned* by a crypt-warden L3 opens and takes `cw.second-gust`. A **self** condition (`declare('brace')`) raises **no** feat offer. Do not build the journey on a self action. CAP-C4/C5 legs and the README work build on this journey.

## Contract Agreements

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|---|---|---|---|---|---|---|---|
| CA-C1 | Feature location and shape (human Q3; DD-C3, DD-C4) | `database.md` §progression + `pack.schema.json` (S01) → `artifacts.ts` `ClassProgression.features` + `validate/sections/progression.ts` (S03) → themes, fixtures (S03) → `features.ts` (S04) | `progression.<id>.features: {level: int 1..ceiling, ref: kebab}[]`, unique `ref` per class. `content.classes.<id>.features` → `E-SCHEMA-02` (closed contract) | S01 ck2; S03 ck1 | agreed (contract landed `efa971d`, rechecked by Orchestrator 2026-10-05: `database.md` §progression row + *Class features (v1.10)* load rules; `pack.schema.json` `$defs.classProgression.properties.features`, old class property deleted; `ref` uses `idPattern` → non-kebab is `E-SCHEMA-01`, as DD-C4) | contract: S01 `efa971d`; mirror/validator: S03 ck1 `c3fc398` (`ClassProgression.features`, `progression.ts` `checkFeatures`/`levelCeiling`; old location → `E-SCHEMA-02`) | **proven**: validate.test.ts cases (a)–(e) at `c3fc398`, re-run green at `c0a23b1` |
| CA-C2 | `ref` resolution (human Q1; DD-C1, DD-C4) | `cross.ts` `checkClassFeatures` (S03) → `features.ts` kind lookup (S04) | ∈ `content.feats` → `feat`; ∈ `actions` → `action`; ∈ `content.spells` → `spell`; else `E-REF-01` (hint over all three). Redundant action / redundant spell → `E-REF-01`. At runtime the pack is valid, so `features.ts` checks feats, then actions, then spells, and treats "none" as unreachable | S01 ck1 text; S03 ck2; S04 ck1 | agreed (contract landed `8d5828c`/`efa971d`; resolution, hint over feats ∪ actions ∪ spells, redundancy rules as DD-C4 — rechecked 2026-10-05) | contract: S01 `efa971d`; `checkClassFeatures`: S03 ck2 `c0a23b1` (`cross.ts`, called in `validate/index.ts` after `checkProgressionPairing`); runtime kind lookup (S04 ck1): planned | validate cases (f)–(j) + coverage-floor CAP-C2 case: **proven** at `c0a23b1`; S04 consumer side **proven** (`features.ts` kind lookup feats → actions → spells, skip none; S04 `3a49d9f`) |
| CA-C3 | Granted vs held feats (human Q2; DD-C2, DD-C9) | `features.ts` `grantedFeats` → `feats.ts` `learnFeat`, `character-profile.ts` → combat `profile.feats` → `snapshots/combat.ts` restore (profile re-stated) | `state.feats` = learned only (snapshot unchanged). Granted = active feat features of `state.classes`. `featSlotTally` counts held only. `learnFeat(granted)` → `feat-known`. `profile.feats` = held reactive, then granted reactive not held | S04 ck1, ck3 | agreed | done: S04 `3a49d9f` (`grantedFeats`, profile feats), `32eaa35` (`learnFeat` refusal) | **proven**: journey legs 1, 4, 5; `feats.test.ts`; `feat-slots-journey` leg 9 green unedited after ck3 (F-C1 closed) |
| CA-C4 | Unlocks (human Q1 b; DD-C8, DD-C9) | `features.ts` `unlockedActions`/`unlockedSpells` → `character-profile.ts` `actions`/`spells`, `pools.ts` `knownSpells` → combat declare, `prepareSpell` | Active action features are appended after the class-actions union. `knownSpells` = pack order, filtered by list ∪ active unlock. Byte-identical output when no feature is active | S04 ck2 | agreed | done: S04 `3a49d9f` (`unlockedActions` in profile), `dd70d3e` (`knownSpells`) | **proven**: journey legs 2, 3; `character-profile.test.ts` byte-stability (warden L1 profile + knownSpells identical to features-stripped clone); characterization 9/9 digests unchanged |
| CA-C5 | Characterization pin re-key (DD-C12) | theme bytes (S03) → generated pack `contentHash` → snapshot JSON in legs → digests | Normalized dump (every `contentHash` string value → `"<hash>"`) is byte-equal per leg, base vs checkpoint. Only then are the digest literals replaced with the new test output | S03 ck1, ck2 | agreed | done: S03 ck1 `c3fc398`, ck2 `c0a23b1` | **proven**: 9/9 legs `cmp`-equal at ck1 and ck2; 7 bundled-theme digests re-keyed (legs 2, 3a, 3b, 4, 6, 7, 8), legs 1/5 (`emberMarchesPack`) unchanged; old → ck1 → ck2 digests in S03 Handoff Notes. From here on, any digest change is a behaviour change (S04 has no re-key authority) |

**Checked sources (Planner, `f36d4ae`):**
- `src/schema/artifacts.ts:68-87,154-164`;
- `src/schema/validate/sections/content.ts:81-134,155-185`, `progression.ts:60-66,166-208`, `cross.ts:1-60`;
- `src/schema/validate/helpers.ts:109-124`, `context.ts`, `index.ts:67-81`;
- `src/schema/contracts/pack.schema.json:258-266,480-503`;
- `src/runtime/feats.ts`, `pools.ts:134-160,230-315`, `character-profile.ts:66-130`, `progression.ts:275-384`, `combat/combatants.ts`, `snapshots/combat.ts:466-530`, `index.ts`;
- `src/compiler/stages/{feats,classes}.ts`;
- the three theme JSONs (class/feature blocks, spells by list, conditions, ceilings, statblock tables);
- `tests/compiler/coverage-floor.test.ts:195-298`, `tests/proofs/combat-characterization.test.ts:56-345`, `tests/proofs/docs-run.test.ts:49,179-180`, `tests/runtime/combat/module-surface.test.ts:20-60`, fixtures;
- `specs/database.md:3,473-544,719-757`, `specs/requirements.md:66-72`, `mocks/progression.html:60-90`, `specs/architecture.md:60-90,205-210`.

**Ref probe (`f36d4ae`):** ~~13 bundled refs; 11 resolve to nothing~~ **corrected by ARCH-PRE F-C2 (2026-10-05): 12 bundled refs; 10 resolve to nothing** (`dark-fantasy.json:130,140,146`, `zombie-urban.json:129,138,152`, `wyldwood.json:237,252,271`); dark-fantasy warden L3 and crypt-warden L2 `wardens-glyph` resolve to a warden-list spell both classes already know. The DD-C10 table (ten "was unresolved" rows) is unchanged.

## Planning Completeness Review (ARCH-PRE, 2026-10-05)

Archivist h-mTx3. Reviewed plan revision `f1fa3f9`; source revision `f1fa3f9` (`src`/`tests` = `db38f31`).

| # | Dimension | Verdict | Evidence (summary) |
|---|---|---|---|
| D1 | requirement coverage | pass | FR-6 (`requirements.md:68`) → CAP-C1..C7, one integration owner each; human answers 1–5 mapped |
| D2 | fact origins | pass | `registerId` pack-wide over actions/feats/spells; ceiling = shortest `saves`; granted feats ride `profile.feats` (`triggers.ts:73-83`, `snapshots/combat.ts:515-517`); journey probed |
| D3 | ownership | fail | `tests/proofs/feat-slots-journey.test.ts:131-140` correction unowned (F-C1) |
| D4 | lease coverage | fail | S03 ck2 forced outside lease by the same pin (F-C1) |
| D5 | declared vs real dependencies | pass | S03→S01, S04→S03, S05→S03, S02→S04; compiler passes content through (`structuredClone`) |
| D6 | early integration | pass | S04 ck1 leg 1 crosses validator → Runtime → combat via public API |
| D7 | runtime wiring | pass | `checkClassFeatures` in `validate/index.ts`; `features.ts` consumed by feats/pools/character-profile; barrel export ck4 |

Fails reach W2 (S03) only. Dispositions (Orchestrator, 2026-10-05):
- **F-C1** (blocking S03): controlled lease revision S03 rev 1 → rev 2, `+ tests/proofs/feat-slots-journey.test.ts`; ck2 edit prescribed in the pin audit row; closing assertion: the file is green after S03 ck2 and after S04 ck3. **Cleared by lease revision** (D3/D4 → routed).
- **F-C2** (blocking S03 ck0): counts corrected above (12/10); carried as S01 and S03 envelope amendments (S01 must not write "11"/"13" into `database.md`).
- **F-C3**: journey setup corrected above; S04 envelope amendment.
- **F-C4** (`pools.test.ts` vancian case uses `grave-light`), **F-C5** (`pools.ts:14-17` import-discipline comment): S04 envelope amendments inside its lease.
- **F-C6** (`database.md:77,437-438,441-442` cross-refs), **F-C7** (Prettier check of `pack.schema.json` at S01 ck2), **F-C12** (DD-C4 spell-redundancy wording): S01 envelope amendments.
- **F-C8** (`architecture.md` themes line missing wyldwood; l.73 `knownSpells` location): S02 envelope amendment.
- **F-C9**: pin row wording corrected above. **F-C10**: S05 receive attributes whole-repo reds to S04 (standing rec 82b4e0ab). **F-C11**: Orchestrator replaces `arch/v1-core.md:1411-1413` when retiring the "unbuilt" lines.

## Current Blockers

none open. ARCH-PRE F-C1/F-C2 (blocking S03) routed: lease rev 2 and envelope amendments (see *Planning Completeness Review*).

## Handoff Notes

(Orchestrator writes here after each session — from Coder's Handoff section, verbatim.)

### SESSION-01 (DB re-entry) — received 2026-10-05, done 2/2 (8d5828c, efa971d)

- **session:** SESSION-01 (class-features), Author re-entry, DB role (schema-change class), lease rev 1
- **status:** complete
- **checkpoint:** 2 of 2
- **notes:**
  - **Checkpoint-0 recheck:** all four points passed at `afb054a`.
    - `database.md:484` was the `features` row.
    - `grep -c '^| 1[01] |'` returned 1.
    - `"features"` appeared in `pack.schema.json` only at l.258.
    - `git diff --quiet f36d4ae -- src/schema/contracts program/Ruleswright/specs/database.md` was clean.
  - **Facts I checked before writing:**
    - `package.json` is at `0.1.0` and `git tag` is empty, so this is still pre-release.
    - The class level ceiling is the shortest `saves` array (`progression.ts:189-207`).
    - `forbidUnknown` emits the `E-SCHEMA-02` closed-contract card.
    - `registerId` enforces pack-wide uniqueness (`E-DUP-01`).
    - `#/$defs/idPattern` exists at `pack.schema.json:60`.
  - **Human answer as applied:** "1 a,b 2 no 3 move it, fix packs, 4 fix the broken packs, 5 you have my auth for whatever you need". The answer is quoted verbatim in the new subsection.
    - 1 → DD-C1: a feature `ref` grants a feat, or unlocks an action or spell.
    - 2 → DD-C2: granted feats use no feat slot and are never stored.
    - 3 → DD-C3: the field is now `progression.<id>.features`; `content.classes.<id>.features` now fails `E-SCHEMA-02`, under caveat (g).
    - 4 → DD-C10: the fix to the bundled packs is cited in caveat (g) but left to S03.
    - 5 → authorization for this re-entry and for the seed-data fix.
  - **CA-C1 as written (`database.md` §progression row):** `| \`features\` | array? | \`{level, ref}\`: \`level\` integer 1..the class's level ceiling; \`ref\` a feat, action or spell id; unique per class | **v1.10.** Granted feat or unlocked action/spell from that class level on. See *Class features* below |`
    - Load-rule bullets for CA-C1: "`level` not an integer in 1..the class's level ceiling (its shortest `saves` array, as for `featSlots`) → `E-SCHEMA-01`." / "`ref` not a kebab id string → `E-SCHEMA-01`." / "A `ref` repeated within one class → `E-SCHEMA-01`." / "`content.classes.<id>.features` → `E-SCHEMA-02` (unknown field; the closed-contract card every `additionalProperties: false` object already uses; DD-C3)."
    - Schema for CA-C1: `$defs.classProgression.properties.features` = array of `{level: integer ≥1, ref: $ref idPattern}`, with `additionalProperties: false` and `required` `[level, ref]`. The class-level `features` property is deleted, so the old location falls to `additionalProperties: false`.
  - **CA-C2 as written:**
    - "Ids are unique pack-wide (`E-DUP-01`), so `ref` names exactly one artifact. Its map decides what the feature does, while the character's level **in that class** is ≥ `level`: `content.feats` → the feat is **granted**; `actions` → the action is **unlocked** (declarable in combat); `content.spells` → the spell is **unlocked** (known)."
    - "The ref resolves in none of the three maps → `E-REF-01` at `progression.<c>.features[i].ref`, with a did-you-mean hint over feats ∪ actions ∪ spells."
    - "An action ref also listed in `content.classes.<c>.actions` → `E-REF-01` (that list grants it from level 1, so the level gate would be ignored)."
    - "A spell ref whose `magic.lists` intersect the class's `spellLists` → `E-REF-01` (already known; the unlock would be dead)." This is the F-C12 wording.
    - "No new rule id; all cards at once (FR-2)."
  - **CA-C3 and CA-C4** are described in the *Granted feats* and *Unlocked actions and spells* bullets, exactly as STATE.md maps them.
- **delivered:**
  - **Status line:** now v1.10.
  - **F-C6 cross-references:** added at l.77 (referential integrity), l.438 (`feat-known`) and l.443-444 (combatant `feats` held **or granted**).
  - **§content classes bullet:** has the v1.10 note.
  - **§progression `features` row:** rewritten as above.
  - **New subsection:** *Class features (v1.10, class-features DD-C1…C9)*, which includes caveat (g).
  - **Seed Data:** now names three templates, adding `wyldwood.json` (since loot-inventory), and adds class features to the shape DB owns.
  - **Version Registry:** row 11 added, verbatim from SESSION-01.
  - **`pack.schema.json`:** `features` moved from `content.classes` to `classProgression`, with a description.
  - I did not write any bundled-ref count (F-C2).
- **verification:**
  - `node -e "JSON.parse(…pack.schema.json…)"` exits 0.
  - `pnpm exec prettier --check src/schema/contracts/pack.schema.json` passes (F-C7).
  - `pnpm exec vitest run tests/schema`: 4 files, 119/119 passed.
  - `git diff --name-only f36d4ae -- src/schema/contracts` lists only `pack.schema.json`; `snapshots.schema.json` and `override.schema.json` are unchanged.
  - `git show --name-only HEAD` stays inside the write set for both commits.
  - `git diff --name-only f36d4ae..HEAD` over `src tests program/Ruleswright/{specs,mocks}` shows only my two lease paths. The full range also includes Orchestrator's own `prompts/class-features/` commits (`f1fa3f9`, `afb054a`).
  - The tree is clean.
- **surprises:** none. One thing for S03: the old `content.ts` shape check allowed any string for `ref`. The new schema uses `idPattern`, and the contract text makes a non-kebab `ref` an `E-SCHEMA-01`, as DD-C4 says. S03's validator should mirror that.
- **followUp:**
  - Orchestrator should re-check CA-C1 and CA-C2 against `efa971d` and promote them from provisional before dispatching S03.
  - S03 mirrors the contract (`artifacts.ts`, `progression.ts`, `cross.ts` `checkClassFeatures`).
  - Archivist owns `arch/v1-core.md` and the PROGRAM-CONFIG notes.
- **deviations:** none in meaning. A few small additions, all taken from approved DD text:
  - The classes bullet gets an extra sentence: "A level-gated action grant is a class feature whose `ref` is an action." The old "future additive field" sentence would otherwise read as still unbuilt.
  - The `learnFeat` bullet adds "the message names the granting class feature" (from DD-C2).
  - The granted-feats and unlocks bullets add the combatant `feats` order, the "not already present" condition and the byte-identical no-active-feature sentence (from DD-C9).
  - The query bullet adds "in DD-C5 order" (from DD-C7).
  - The schema description words the redundancy rule per F-C12 and adds "Replaces content.classes.<id>.features, now an unknown field (E-SCHEMA-02)."
  - No CA or DD meaning changed, so there is no delta to report by id.
- **needsOwnerCorrection:** none
- **needsDesignSource:** none
- **blockedReason:** —
- **filesTouched:** `program/Ruleswright/specs/database.md`, `src/schema/contracts/pack.schema.json`. Scratch went only to `/tmp/ruleswright-class-features/subsection.md`.
- **commits:** ck1 `8d5828c` "class-features SESSION-01: checkpoint 1 — v1.10 text"; ck2 `efa971d` "class-features SESSION-01: checkpoint 2 — pack.schema.json + registry row 11"

Orchestrator receive: commits inside lease; no arch fragment; V1–V4 0, V5 52 files 938/938, V6 0, V7 0 at `efa971d`. CA-C1/CA-C2 promoted from provisional. CAP-C7 DB part delivered (text review).

### SESSION-03 — received 2026-10-05, done 2/2 (c3fc398, c0a23b1), lease rev 2

- **session:** 03
- **status:** done
- **checkpoint:** 2
- **notes:** class-features S03 done 2/2 (ck1 `c3fc398`, ck2 `c0a23b1`), lease rev 2. CAP-C1 and CAP-C2 proved here (integration owner). CA-C1 and CA-C2 are implemented exactly as mapped in STATE; CA-C5 was re-keyed at both checkpoints with proof. Producer symbols for S04: `ClassProgression.features?: ClassFeature[]` (`src/schema/artifacts.ts`), `checkClassFeatures(ctx, json)` (`src/schema/validate/sections/cross.ts`, called in `validate/index.ts` after `checkProgressionPairing`), and private `checkFeatures`/`levelCeiling` in `sections/progression.ts`. **N₀ = 938 → N after ck1 = 943 (+5) → N after ck2 = 951 (+8).** Checkpoint-0 recheck passed against the F-C2-amended expectations: 12 refs, 10 unresolved (at the listed lines), `wardens-glyph` → `content.spells` twice (lists `["warden"]`), the 7 new ids unused, the other new feat ids only as feature refs, `pack.schema.json` `"features"` only at l.495 (`classProgression`), `content.ts` hits only at l.81/85-134, baseline 52 files 938/938.
- **delivered:**
  - **ck1:**
    - `ClassDef.features` removed; `ClassProgression.features` added with the v1.10 doc comment; `ClassFeature` doc comment updated.
    - `content.ts`: `features` dropped from the class allow-list and its old shape block deleted. The old location now gets `E-SCHEMA-02` at `content.classes.<id>.features` with message `unknown field "features" — the contract is closed (additionalProperties: false).`
    - `progression.ts`: `features` added to the allow-list. New checks, all `E-SCHEMA-01`: array of `{level, ref}`; `level` integer ≥ 1; `level` ≤ the shortest `saves` array (message `feature level <L> is above the class's level ceiling <C> (FR-6).`); `ref` must be a lowercase-hyphenated id; `ref` unique per class, flagged at the repeat's `.ref`.
    - The ceiling is computed by a shared helper, `levelCeiling`, which the existing `featSlots` coverage rule now uses too (behaviour unchanged).
    - `error-card.ts` comment example updated.
    - 3 themes and 2 fixtures: `features` moved without changing any ref, as the last key of each progression entry (checked by script: same JSON, nothing else in the class changed).
    - `validate.test.ts`: cases (a)–(e).
  - **ck2:**
    - `checkClassFeatures` raises `E-REF-01` at `progression.<c>.features[i].ref` (artifactId `<c>`), with the prescribed messages and a did-you-mean hint over feats ∪ actions ∪ spells (`declared feats, actions and spells: (none)` when there are none).
    - It skips a container it cannot read, and skips malformed or wrongly formatted refs because the structural card already exists.
    - Themes per DD-C10, with every new feat/action appended after the existing entries.
    - Fixture feat `feature-warden-oath` added to both fixture packs.
    - `validate.test.ts` cases (f)–(j); coverage-floor per-theme case; feat-slots-journey leg 9 per F-C1.
  - **Coined display names (feats):**
    - dark-fantasy: "Oath of the Warden", "Warden's Resolve", "Hexer's Eye", "Crypt Vigil"
    - zombie-urban: "Scavenger's Instinct", "Block Runner", "Miler's Read", "Field Surgery", "Steady Pulse"
    - wyldwood: "Oath of the Verge", "Verge's Glyph", "Hexer's Eye", "Hedge's Eye", "Bramble Vigil"
  - **New actions** (no name field), each `sequence(attack(ac, might), damage(1d6 + might, <type>))`, adjacent, cost `main: 1`, tag `main`: `barrow-rite` (sharp), `jury-rig` (bludgeon), `thornward` (pierce).
- **verification:**
  - **Whole-repo gates at ck1 and at ck2:** V1 `pnpm typecheck` 0, V2 `pnpm lint` 0, V3 `pnpm format:check` 0, V4 `pnpm build` 0, V5 `pnpm test` → 52 files, 943/943 (ck1) and 951/951 (ck2), V6 `check:isolation` 0, V7 `check:security` 0. Build ran immediately before test (H1); the scratch file was absent for every gate and commit.
  - **CAP-C1:** `pnpm exec vitest run tests/schema/validate.test.ts` → 109/109. With `-t 'class features \(v1.10, CAP-C1\)'` it selects exactly 10 (99 skipped), cases (a)–(j). Real `validatePack`; (a) and (h) also run `cloneRuntimePack()` through the real `packDslChecker`.
  - **CAP-C2:** `pnpm exec vitest run tests/compiler/coverage-floor.test.ts` → 94/94. `-t 'v1.10 class features resolve'` selects 3 (one per theme) on `runPipeline` packs, which include stage-8 `validatePack`. The existing dogfood case also gives zero cards with `packDslChecker` for all three themes.
  - **F-C1 closing assertion:** `pnpm exec vitest run tests/proofs/feat-slots-journey.test.ts` → 8/8; `-t 'learnable feats'` selects 1. The learnable set is ironhide, steady-hands, woodwise, second-gust (`toHaveLength(4)` kept).
  - **CA-C5:** `cmp` was byte-equal on 9/9 normalized leg dumps at ck1 (`ck1-before` vs `ck1-after`) and at ck2 (`ck2-before`, taken from committed ck1, vs `ck2-after`). Dumps are in `/tmp/ruleswright-class-features/<phase>/leg-*.json`; the normalizer replaced every `contentHash` (counts checked per file). Legs 1 and 5 use the fixture `emberMarchesPack`, not a bundled theme, so their digests did not change.
  - **Digests, sha256 / contentHash, old (base) → ck1 → ck2:**
    - leg 2: `b7c89ee4…f6b1`/`1c81f3d7` → `1bbcd2d2…3792`/`6c8558c7` → `007a5567…be1f`/`28ee4afb`
    - leg 3a: `4b79a4d1…e5ad`/`dbf35a57` → `ec107e2f…f530`/`d6bc9ea8` → `6356cff8…0b2c`/`002ae008`
    - leg 3b: `49fed1e8…7c6c`/`04519945` → `a3721aa0…61df`/`3a990bff` → `82597d99…916f`/`ccd332b0`
    - leg 4: `1f015930…bcfb`/`008c2497` → `10fbaf25…bb2c`/`007b3cc3` → `b47296c7…2552`/`73fe4790`
    - leg 6: `d1b501cd…7c3377`/`5b854d01` → `f1d8a33a…31f2`/`e5e992e2` → `11f27e47…6b86`/`23ab3692`
    - leg 7: `f2f4a205…fc00`/`9b871c1e` → `7ccd2b0d…dde4`/`c0e47550` → `650be776…5607`/`f8690e3f`
    - leg 8: `62468c03…17fa`/`1c28bc2e` → `a05217b2…6d84`/`e2f20ba2` → `23a287f1…01a5`/`7f898d06`
    - leg 1 `3e2e94f0…f6a2`/`1cc2c131` and leg 5 `977b2fbe…eafb`/`fff7889a` unchanged.
    - Characterization file: 9/9 green after each re-key.
  - **Negative control (ck2, scratch, reverted):** dark-fantasy warden ref → `oath-of-the-wardenx` makes coverage-floor fail at load (stage 8 `GenerationError`). The card read through `dist` `generateCampaign` is `[E-REF-01, progression.warden.features[0].ref, did you mean "oath-of-the-warden"?]`. Restored file `cmp`-equal; after commit, `git diff --quiet HEAD -- src/compiler/themes` is clean.
  - **Runtime untouched:** `git diff --quiet f36d4ae -- src/runtime` is clean.
  - Every commit, checked with `git show --name-only --format= HEAD`, lists only lease paths.
- **surprises:**
  1. **Prompt negative control (F-C2-style premise):** the prescribed `oath-of-the-wardenX` contains an uppercase letter, so it fails the id-format check (`E-SCHEMA-01`, "feature.ref must be a feat, action or spell id matching ^[a-z][a-z0-9-]*$."), not `E-REF-01`. This matches the contract (DD-C4 / S01: a ref that is not a lowercase-hyphenated id → `E-SCHEMA-01`), so I left the code as it is. I ran both values: X → `E-SCHEMA-01`, lowercase x → `E-REF-01` at the path. `checkClassFeatures` deliberately skips refs in the wrong format so they don't also get an `E-REF-01` card. The SESSION-03 wording should be corrected.
  2. **Error-card comment line:** the `error-card.ts` example sits at l.12 as cited; it is in the `jsonPath` doc comment.
  3. **Wording I chose where STATE gave none:** the uniqueness message (`class feature "<ref>" repeats in class "<c>" — a ref appears at most once per class.`) and the wrong-format ref message. No CA-C1/CA-C2 meaning changed.
  4. **Non-integer `level`:** when `level` is not an integer, the ceiling check is skipped, so you get one card per entry.
  5. **Lease:** rev 2 used; the F-C1 path was edited at ck2 only.
- **deviations:**
  - **rule:** R1. **checkpoint:** 1. **paths:** `src/schema/validate/sections/progression.ts`. **reason:** pulled the `featSlots` ceiling calculation into `levelCeiling(saves)` so `featSlots` and `features` share it (same results for `featSlots`). Done inside the lease to avoid writing the same calculation twice.
- **followUp:**
  - S04 consumes `ClassProgression.features`, the landed DD-C10 ids above and the fixture feat `feature-warden-oath`, which is passive and never learned by existing tests. The F-C1 leg 9 already filters out feats named by any `progression.*.features[].ref`, so it should stay green after S04 ck3's `learnFeat` refusal with no further edit; S04 should confirm.
  - CAP-C3..C6 proofs remain with S04.
  - S05 can quote the dark-fantasy features: warden L1 `oath-of-the-warden`, L3 `wardens-resolve`; hexer L1 `hexers-eye`; crypt-warden L2 `barrow-rite` (action), L3 `crypt-vigil` (reactive).
  - Archivist / Orchestrator: `arch/v1-core.md` "class features unbuilt" lines, and the PROGRAM-CONFIG M01/M04 key-file notes (cross.ts `checkClassFeatures`, progression.ts features checks, themes' features).
  - The arch fragment is at `.program/signal/SESSION-03.arch.md`.
  - SESSION-03.md's negative-control value needs a lowercase-hyphenated id (surprise 1).
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:**
  - `src/schema/artifacts.ts`
  - `src/schema/error-card.ts`
  - `src/schema/validate/index.ts`
  - `src/schema/validate/sections/content.ts`
  - `src/schema/validate/sections/progression.ts`
  - `src/schema/validate/sections/cross.ts`
  - `src/compiler/themes/dark-fantasy.json`
  - `src/compiler/themes/zombie-urban.json`
  - `src/compiler/themes/wyldwood.json`
  - `tests/runtime/fixtures/pack.ts`
  - `tests/schema/fixtures.ts`
  - `tests/schema/validate.test.ts`
  - `tests/compiler/coverage-floor.test.ts`
  - `tests/proofs/combat-characterization.test.ts`
  - `tests/proofs/feat-slots-journey.test.ts`

Orchestrator receive: both commits inside lease rev 2 (`git show --name-only`); scratch file absent; `src/runtime` untouched since `f36d4ae`. Gates at `c0a23b1`: V1–V4 0, V5 52 files 951/951, V6/V7 0; CAP-C1 (10), CAP-C2 (3), feat-slots-journey + characterization (17) re-run green. Arch delta integrated `c7d517f`. CAP-C1/C2 verified; CA-C1, CA-C5 proven; CA-C2 producer proven (S04 consumer planned). SESSION-03.md negative-control value `oath-of-the-wardenX` is a disproved premise (uppercase → `E-SCHEMA-01` per DD-C4); recorded, no code change, Planner-facing granularity feedback.

### SESSION-04 — received 2026-10-05, done 4/4 (3a49d9f, dd70d3e, 32eaa35, 64a3231)

- **session:** 04 (class-features)
- **status:** done
- **checkpoint:** 4
- **notes:** S04 done 4/4, lease rev 1.
  - **Commits and N:** ck1 `3a49d9f` (N 951 → 958, +7), ck2 `dd70d3e` (→ 965, +7), ck3 `32eaa35` (→ 969, +4), ck4 `64a3231` (→ 970, +1). N₁ = 951 → 970 (+19).
  - **Capabilities:** CAP-C3, C4, C5 and C6 proved here as integration owner. The README part of CAP-C7 is delivered.
  - **CA-C3 and CA-C4:** producer and proof landed.
  - **CA-C2 (consumer side):** the kind lookup checks `content.feats`, then `actions`, then `content.spells`, and skips a ref found in none of them (no throw).
  - **Landed signatures (`src/runtime/features.ts`, a leaf with type imports only):**
    - `interface ClassFeatureView { readonly classId: string; readonly level: number; readonly ref: string; readonly kind: 'feat' | 'action' | 'spell'; readonly active: boolean }`
    - `classFeatures(runtime: Runtime, character: { readonly classes: readonly ClassEntry[] }): readonly ClassFeatureView[]`
    - `grantedFeats`, `unlockedActions`, `unlockedSpells`, each `(runtime: Runtime, classes: readonly ClassEntry[]): readonly string[]`. These three are internal; only `classFeatures` and `ClassFeatureView` are exported from the barrel.
  - **Checkpoint-0 recheck (at `d1cc6f7`):** passed.
    - `features?: ClassFeature[]` is at `artifacts.ts:164`, inside `ClassProgression`.
    - A dump of the generated packs (seed 42) shows crypt-warden `barrow-rite`@2 and `crypt-vigil`@3, and medic `field-surgery`@2, `rot-read`@3 and `steady-pulse`@4.
    - `crypt-vigil.trigger.on` is `condition:applied[target=self]`.
    - The crypt-warden's `featSlots` is `[1,1,2,2,…]`.
    - Baseline was 52 files, 951/951.
- **delivered:**
  - **ck1:**
    - New `features.ts` leaf.
    - `profileFromCharacter` appends unlocked actions after the class-actions union. The `no-combat-actions` check now runs after that.
    - Profile `feats` = held reactive feats, then granted reactive feats not already held.
    - Doc comments updated.
    - New `tests/runtime/features.test.ts` (5 tests).
    - Journey leg 1 plus its L2 control.
  - **ck2:**
    - `knownSpells` filters by list match or an active unlock, keeping pack order.
    - F-C5: the `pools.ts` import-discipline comment is rewritten.
    - `prepareSpell` doc and its `spell-not-known` message now mention class-feature unlocks.
    - Journey legs 2 and 3.
    - 3 byte-stability and composition cases in `character-profile.test.ts`.
    - 2 vancian-unlock cases in `pools.test.ts`, using `grave-light` per F-C4.
  - **ck3:**
    - `learnFeat` refuses a granted feat with `feat-known` and the message `"<id>" is granted feat "<f>" by a class feature (FR-6).`. `featSlotTally` is untouched.
    - F-C5: the `feats.ts` header comment is rewritten.
    - Journey legs 4 and 5.
    - 2 cases in `feats.test.ts`.
  - **ck4:**
    - Barrel export of `classFeatures` and `ClassFeatureView`.
    - `module-surface` pin: `'classFeatures'` added to the sorted list.
    - Journey leg 6.
    - README changes:
      - new `## Class features` section between *Spells and feats in combat* and *Equipment & consumables*, with one ```json block and no ```ts block (F-C9);
      - `profileFromCharacter` bullet (old l.139-144): unlocked actions, and reactive feats learned then granted;
      - spell-known sentence (old l.322-325);
      - Feats bullet (old l.353-355): `feat-known` also refuses a granted feat;
      - Reactive feats bullet: "held or granted".
    - The README ```ts block count stays 4.
    - `docs-run` anatomy now asserts the README contains `progression.<id>.features` and `classFeatures`.
- **verification:**
  - **Gates at `64a3231`:** V1 typecheck, V2 lint, V3 format:check and V4 build all exit 0. V5 `pnpm test` (run right after build, H1) → 54 files, 970/970. V6 check:isolation 0, V7 check:security 0.
  - **Per checkpoint:** V1–V4 were 0 at every checkpoint, with full suites of 958, 965, 969 and 970.
  - **Scoped run** (`pnpm exec vitest run <9 paths>`): 9 files, 103 tests, all passed. As intended:
    - class-features-journey 7
    - features 5
    - feats 14
    - pools 15
    - character-profile 37
    - module-surface 5
    - docs-run 3
    - combat-characterization 9
    - feat-slots-journey 8
  - **CA-C3 evidence by leg** (`tests/proofs/class-features-journey.test.ts`, from `src/`, no doubles; pipeline is `generateCampaign` → Runtime → `startCombat` with a real `spawnMonster` barrow-wight, `Rng('class-features-journey')`):
    - Leg 1: `profile.feats` = `['crypt-vigil']` while `state.feats` is undefined. After `declare('grave-gaze', {targetId:'cw'})` (F-C3), `hexbound` lands on cw and exactly one `trigger:fired` appears (`cw.crypt-vigil`, source `feat`). `respond(take)` → `condition:applied` braced, `why.rule` `content.feats.crypt-vigil`.
    - Leg 1 control (L2): no feat `trigger:fired`, and `respond` throws `no pending trigger`.
    - Leg 4:
      - `learnFeat(crypt-vigil)` → `feat-known`, and `feats` stays undefined.
      - `featSlots[2]` = 2 is asserted. ironhide and second-gust are then learned; woodwise → `feat-slots-exceeded`.
      - Learned at L2, then `levelSet` to L3 → `feats` `['crypt-vigil']`, held once.
      - `levelSet` to L1 → no active features, and only `level:reached` is emitted.
    - Leg 5: the serialized character has no `feats` key; `restoreCharacter` on a fresh Runtime → profile `feats` `['crypt-vigil']`. A combat snapshot with the offer open → JSON → `deserializeCombat` on a fresh Runtime with a re-stated profile → `respond` lands braced with the feat rule.
    - Unit: `feats.test.ts` covers granted `feature-warden-oath` → `feat-known` with no events and the field absent; the granted feat uses no slot.
  - **CA-C4 evidence by leg:**
    - Leg 2: at L1, `declare('barrow-rite')` returns exactly one `declare:rejected` (`no-action`, `E-REF-01`, "does not have action"). No other event appears and `serialize()` is unchanged. At L2, `action:resolved` `barrow-rite`.
    - Leg 3: at medic L2, `rot-read` is absent from `profile.spells` and `knownSpells`; the declare gives `no-action` "does not know spell", no `spell:cast`, state unchanged. At L3 it is present in both; `spell:cast` payload has `{cost:'points', pool:'stamina'}` and stamina drops by 2.
    - Byte-stability: for a dark-fantasy warden L1, `JSON.stringify` of both the profile and `knownSpells` is identical to a clone with every `progression.*.features` deleted.
    - `no-combat-actions` counts unlocked actions: a stripped crypt-warden throws at L1 and has actions `['barrow-rite']` at L2.
    - `pools.test.ts`: warden L1 with `grave-light`@2 → `spell-not-known`, state unchanged. At L2 it is known and `spell:prepared` binds it.
  - **CAP-C6:** leg 6 deep-equals the 3 medic rows, imported through the barrel.
  - **Negative controls** (scratch copies in `/tmp/ruleswright-class-features/`, restored and checked with `cmp`):
    - Removing the granted-feats line in `profileFromCharacter` → leg 1 fails.
    - Disabling the `learnFeat` grant check → leg 4 and the `feats.test.ts` granted case fail.
  - **Untouched code and pins:**
    - `git diff --quiet c0a23b1 -- src/runtime/combat src/runtime/snapshots` → clean.
    - `git diff --quiet c0a23b1 -- tests/proofs/combat-characterization.test.ts tests/proofs/feat-slots-journey.test.ts` → clean, and both are green: 9/9 digests unchanged; F-C1 closing assertion holds with 8/8 after ck3.
  - Every commit, checked with `git show --name-only --format= HEAD`, lists only lease paths.
- **surprises:**
  - I made 3 changes the session prompt did not list (all in-lease, wording only):
    - `prepareSpell`'s `spell-not-known` message gains "and no class feature unlocks it". No test or README pinned the old text.
    - `prepareSpell`'s doc comment now mentions class-feature unlocks.
    - The README *Reactive feats* bullet now says "held or granted".
  - The README ```ts fence count is over the whole file (F-C9) and stays 4.
  - S05's commits (`e5850e2`, `7298b73`) are in the log, as expected.
- **deviations:** —
- **followUp:**
  - S02 (Architect): `architecture.md` can now name `src/runtime/features.ts` and its consumers (see the arch fragment).
  - Archivist / Orchestrator should update:
    - `arch/v1-core.md`: retire the "class features unbuilt" lines; replace l.1411-1413 per F-C11;
    - PROGRAM-CONFIG M03 key files: `features.ts` leaf; `feats.ts` is no longer a leaf (it now value-imports `./features`); the `pools.ts` value-import note;
    - M03 intra-module edges: `{feats, pools, character-profile, index} → features`.
  - The `mocks/progression.html` panel (S05) can quote the README `## Class features` section.
  - No proofs remain open for CAP-C3–C6, CA-C3 or CA-C4. The CA-C2 consumer side is done.
- **needsOwnerCorrection:** —
- **needsDesignSource:** —
- **blockedReason:** —
- **filesTouched:**
  - `src/runtime/features.ts`
  - `src/runtime/character-profile.ts`
  - `src/runtime/pools.ts`
  - `src/runtime/feats.ts`
  - `src/runtime/index.ts`
  - `tests/runtime/features.test.ts`
  - `tests/runtime/pools.test.ts`
  - `tests/runtime/feats.test.ts`
  - `tests/runtime/combat/character-profile.test.ts`
  - `tests/runtime/combat/module-surface.test.ts`
  - `tests/proofs/class-features-journey.test.ts`
  - `tests/proofs/docs-run.test.ts`
  - `README.md`
  - (not committed, envelope-authorized: `.program/signal/SESSION-04.arch.md`)

Orchestrator receive: all four commits inside lease rev 1; S05 commits `e5850e2`, `7298b73` interleaved (its own lease, not attributed to S04). Gates at `64a3231`: V1–V4 0, V5 54 files 970/970, V6/V7 0; 7 S04 test files 86/86 re-run. Value imports derived per statement: `feats.ts:18`, `pools.ts:27`, `character-profile.ts:28` → `./features`; `features.ts` type-only. Arch delta integrated and "class features unbuilt" lines retired (F-C11) `de67360`. CAP-C3..C6 verified; CA-C2 (both sides), CA-C3, CA-C4 proven.
