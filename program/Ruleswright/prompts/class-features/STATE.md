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
| S01 | Author re-entry (DB): contract v1.10, class features | — (DB) | `program/Ruleswright/specs/database.md`, `src/schema/contracts/pack.schema.json` | pending | — | — | |
| S03 | Schema mirror, validator, bundled themes, fixtures, characterization re-key | M01, M04, tests | `src/schema/artifacts.ts`, `src/schema/error-card.ts`, `src/schema/validate/index.ts`, `src/schema/validate/sections/content.ts`, `src/schema/validate/sections/progression.ts`, `src/schema/validate/sections/cross.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `tests/runtime/fixtures/pack.ts`, `tests/schema/fixtures.ts`, `tests/schema/validate.test.ts`, `tests/compiler/coverage-floor.test.ts`, `tests/proofs/combat-characterization.test.ts`, `tests/proofs/feat-slots-journey.test.ts` (lease rev 2, F-C1); scratch-only, never committed: `tests/proofs/characterization-dump.scratch.test.ts` | pending | — | — | |
| S04 | Runtime: granted feats, unlocked actions and spells, host query, journey, README | M03, tests, docs | `src/runtime/features.ts`, `src/runtime/feats.ts`, `src/runtime/pools.ts`, `src/runtime/character-profile.ts`, `src/runtime/index.ts`, `tests/runtime/features.test.ts`, `tests/runtime/feats.test.ts`, `tests/runtime/pools.test.ts`, `tests/runtime/combat/character-profile.test.ts`, `tests/runtime/combat/module-surface.test.ts`, `tests/proofs/class-features-journey.test.ts`, `tests/proofs/docs-run.test.ts`, `README.md` | pending | — | — | |
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

**Feature gates:** after S04, V1–V7 green, and V5 = N₀ + the tests S03 and S04 add (each session reports its delta). Characterization digests change only as CA-C5 proves.

## Capability Readiness

| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|---|---|---|---|---|---|---|---|
| CAP-C1 | A pack author declares class features at `progression.<id>.features`. `new Runtime(pack)` / `validatePack` / compiler stage 8 accept valid ones and reject the old location, unknown or wrong-kind refs, redundant unlocks, out-of-range levels and duplicate refs, all at once, located (FR-2) | contract S01; mirror and validator S03 | CA-C1, CA-C2; S01 | S03 ck2 | planned | `tests/schema/validate.test.ts` (new `class features (v1.10)` describe); generated themes pass stage 8 | — |
| CAP-C2 | The bundled themes ship working features: all refs resolve, each theme has a reactive grant and an action unlock, and zombie-urban has a spell unlock | theme content S03 | CA-C2, DD-C10 | S03 ck2 | planned | `coverage-floor.test.ts` new case `v1.10 class features resolve` | — |
| CAP-C3 | A character with class level ≥ L holds the feature's feat. A reactive one is offered and taken in combat (also across a combat snapshot). `learnFeat` refuses it (`feat-known`). It uses no slot, is not stored, and the character snapshot round-trips unchanged | `grantedFeats` S04 ck1; profile S04 ck1; `learnFeat` S04 ck3 | CA-C3; S03 | S04 ck1 (first narrow journey) → ck3 | planned | `tests/proofs/class-features-journey.test.ts` legs 1, 4, 5 | — |
| CAP-C4 | An action-unlock feature makes the action declarable from level L. Below L, `declare` → `declare:rejected {kind: 'no-action'}`, nothing spent | `unlockedActions` S04 ck2 | CA-C4; S03 | S04 ck2 | planned | journey leg 2 | — |
| CAP-C5 | A spell-unlock feature makes the spell known from level L (`knownSpells`, `profile.spells`), so it can be declared in combat (points) and prepared (vancian). Below L it is not known | `unlockedSpells` S04 ck2 | CA-C4; S03 | S04 ck2 | planned | journey leg 3; `pools.test.ts` | — |
| CAP-C6 | The host lists a character's class features with kind and active flag (`classFeatures`) | `features.ts` S04 ck1/ck4 | CA-C3, CA-C4 | S04 ck4 | planned | `tests/runtime/features.test.ts`; module-surface | — |
| CAP-C7 | Docs match behaviour: `database.md` v1.10 (S01), README class-features section (S04), `progression.html` (S05), `architecture.md` (S02) | Author roles + S04 | CA-C1 | S02 (last) | planned | text review at receive; docs-run anatomy check (S04 ck4) | — |

**First narrow journey (S04 ck1).** Public API only, the real validator, compiler and combat engine, nothing mocked:
- `new Runtime(generateCampaign({theme: loadTheme('dark-fantasy'), seed: 42}))` → `createCharacter` crypt-warden L3 → `profileFromCharacter` (`profile.feats` contains granted `crypt-vigil`; `state.feats` stays absent).
- `startCombat` with the crypt-warden at initiative −100 and `spawnMonster(rt, 'barrow-wight', 'wight')` at +100, positions `{cw: {x: 0, y: 0}, wight: {x: 1, y: 0}}`.
- `step()` → `turn:began` (active = wight); the host then calls `fight.declare('grave-gaze', {targetId: 'cw'})` on the wight's turn (**corrected by ARCH-PRE F-C3**: `step()` alone does not declare; matches the characterization `featLeg`). `save(reason, 12, applyCondition(hexbound, 2), applyCondition(hexbound, 1))` applies `hexbound` on either branch.
- The offer `cw.crypt-vigil` opens → `respond('cw.crypt-vigil', 'take')` → `condition:applied braced`, `why.rule` `content.feats.crypt-vigil`.

**Planner probe (`f36d4ae` `dist/`, 2026-10-04):** the same script with today's `second-gust` *learned* by a crypt-warden L3 opens and takes `cw.second-gust`. A **self** condition (`declare('brace')`) raises **no** feat offer. Do not build the journey on a self action. CAP-C4/C5 legs and the README work build on this journey.

## Contract Agreements

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|---|---|---|---|---|---|---|---|
| CA-C1 | Feature location and shape (human Q3; DD-C3, DD-C4) | `database.md` §progression + `pack.schema.json` (S01) → `artifacts.ts` `ClassProgression.features` + `validate/sections/progression.ts` (S03) → themes, fixtures (S03) → `features.ts` (S04) | `progression.<id>.features: {level: int 1..ceiling, ref: kebab}[]`, unique `ref` per class. `content.classes.<id>.features` → `E-SCHEMA-02` (closed contract) | S01 ck2; S03 ck1 | agreed (provisional against S01 ck2) | planned | validate tests S03 ck1 |
| CA-C2 | `ref` resolution (human Q1; DD-C1, DD-C4) | `cross.ts` `checkClassFeatures` (S03) → `features.ts` kind lookup (S04) | ∈ `content.feats` → `feat`; ∈ `actions` → `action`; ∈ `content.spells` → `spell`; else `E-REF-01` (hint over all three). Redundant action / redundant spell → `E-REF-01`. At runtime the pack is valid, so `features.ts` checks feats, then actions, then spells, and treats "none" as unreachable | S01 ck1 text; S03 ck2; S04 ck1 | agreed (provisional against S01 ck2) | planned | validate tests S03 ck2; coverage-floor S03 ck2 |
| CA-C3 | Granted vs held feats (human Q2; DD-C2, DD-C9) | `features.ts` `grantedFeats` → `feats.ts` `learnFeat`, `character-profile.ts` → combat `profile.feats` → `snapshots/combat.ts` restore (profile re-stated) | `state.feats` = learned only (snapshot unchanged). Granted = active feat features of `state.classes`. `featSlotTally` counts held only. `learnFeat(granted)` → `feat-known`. `profile.feats` = held reactive, then granted reactive not held | S04 ck1, ck3 | agreed | planned | journey legs 1, 4, 5; `feats.test.ts` |
| CA-C4 | Unlocks (human Q1 b; DD-C8, DD-C9) | `features.ts` `unlockedActions`/`unlockedSpells` → `character-profile.ts` `actions`/`spells`, `pools.ts` `knownSpells` → combat declare, `prepareSpell` | Active action features are appended after the class-actions union. `knownSpells` = pack order, filtered by list ∪ active unlock. Byte-identical output when no feature is active | S04 ck2 | agreed | planned | journey legs 2, 3; `character-profile.test.ts` byte-stability case |
| CA-C5 | Characterization pin re-key (DD-C12) | theme bytes (S03) → generated pack `contentHash` → snapshot JSON in legs → digests | Normalized dump (every `contentHash` string value → `"<hash>"`) is byte-equal per leg, base vs checkpoint. Only then are the digest literals replaced with the new test output | S03 ck1, ck2 | agreed | planned | handoff lists old/new digests per leg and the dump `cmp` result |

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
