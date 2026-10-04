# State Tracker — Ruleswright / feat-progression

## Program / Feature / Intent / Sessions

- **Program:** Ruleswright (`program/Ruleswright/`)
- **Feature:** `feat-progression`
- **Plan HEAD:** `2e69863` (source last changed at `3cce108`)
- **Planned:** 2026-10-04 by Planner
- **Intent:** close FR-6's feat-slot item (FR-6 "class features" remains unbuilt — F-FP2/F-P5). Pack progression tables declare **feat slots** per class per level. A character's slots are the sum over its classes. The engine refuses every path that would leave a character holding more feats than its slots: `learnFeat`, `levelSet`, `awardXp` and snapshot restore (FR-5: "illegal builds … rejected with the violated rule named").
- **Sessions:** 2, serial (S01 → S02).

**Human answers on record (2026-10-04).** Planner asked three questions before planning:
1. Do feat slots go per class per level (like save progressions), or in one table for the whole character?
2. Saved characters that already hold more feats than the new limit allows: refuse to load them, or let them keep the extra feats?
3. Do you approve the contract change itself?

The human answered: "**1 per class per level - 2 refuse - 3 approved**". Read against the questions:
1. **per class per level**: `progression.<classId>.featSlots`, one value per class level (DD-F1). Multi-class sums (DD-F2).
2. **refuse**: a character snapshot that holds more feats than its slots is refused on restore (DD-F6c).
3. **approved**: DB Author re-entry, schema-change class, contract **v1.8** (S01).

No blocker gates S01. S01 is dispatchable.

## Session Status

| # | Session | Modules | Owns | Status | Checkpoint | Completed | Notes |
|---|---|---|---|---|---|---|---|
| 01 | Author re-entry (DB): contract v1.8, `featSlots` | — (DB) | `program/Ruleswright/specs/database.md`, `src/schema/contracts/pack.schema.json` | done | 2/2 | 2026-10-04 | v1.8 landed: ck1 `3f63fd3`, ck2 `f4cc597`; CA-F1…F3 rechecked, no meaning delta |
| 02 | Feat-slot column: mirror + validator, engine cap on every path, theme content, journey | M01, M03, M04 | `src/schema/artifacts.ts`, `src/schema/validate/sections/progression.ts`, `src/runtime/feats.ts`, `src/runtime/progression.ts`, `src/runtime/snapshots.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `README.md`, `tests/schema/validate.test.ts`, `tests/runtime/feats.test.ts`, `tests/runtime/progression.test.ts`, `tests/snapshots/character.test.ts`, `tests/compiler/coverage-floor.test.ts`, `tests/proofs/feat-slots-journey.test.ts` | done | 4/4 | 2026-10-04 | ck1 `45483c5`, ck2 `a32ded2`, ck3 `7bf5fa6`, ck4 `f7f6e88`; 49 files 911/911; arch `3da588a` |

## Wave Plan

| Wave | Sessions | Why concurrent |
|---|---|---|
| W1 | S01 | Alone. It writes the contract S02 implements. |
| W2 | S02 | Alone. It is the only Coder session, and it needs S01's landed text. |

No pair is declared concurrent.

## Dependency Graph

```
S01 (DB v1.8: featSlots) ──► S02 (feat-slot column)
```

S02 needs S01's CA-F1/CA-F2/CA-F3 text in `database.md` and the `classProgression.featSlots` property in `pack.schema.json`. Orchestrator rechecks CA-F1…F3 against the landed text before dispatching S02.

## Architecture Reference (feature-specific)

These line numbers were checked at plan HEAD `2e69863`:

- **Contract:** `src/schema/contracts/pack.schema.json` `$defs/classProgression` (l.451-499). It has `additionalProperties: false` and the properties `hd`, `attackTable`, `attackBonus`, `saves`, `slots`. There is no feat field.
- **Mirror:** `src/schema/artifacts.ts` `interface ClassProgression` (l.154-162).
- **Validator:** `src/schema/validate/sections/progression.ts` `checkProgression` (l.25). `forbidUnknown(… ['hd','attackTable','attackBonus','saves','slots'] …)` is at l.59. `checkIntegerArray(ctx, value, artifactId, basePath, label, minimum)` is in `helpers.ts` l.342. Shape errors are `E-SCHEMA-01`.
- **Runtime feats leaf:** `src/runtime/feats.ts` `learnFeat` (l.14). It refuses `unknown-feat`, then `feat-known` (RuntimeRuleError, nothing changes). It value-imports only `./errors`.
- **Shared build validator:** `src/runtime/progression.ts` `validateBuild(runtime, race, entries)` (l.50). It is exported on the runtime barrel (`index.ts` l.29). Its callers are:
  - `character.ts` `createCharacter` l.233;
  - `progression.ts` `levelSet` l.327;
  - `snapshots.ts` `characterStateRefusals` l.317-327, which is used by `restoreCharacter` l.291 and `restoreParty` l.300.
- **`awardXp`** (`progression.ts` l.261) mutates `entry.level` inside its `forEach` and does not call `validateBuild`. `deriveProgression` (l.175) sums vancian slots across classes. That summation is the precedent for summing feat slots.
- **Snapshot identity:** `snapshots.ts` l.250 refuses a snapshot whose `contentHash` does not match the pack. Any theme content change therefore already refuses older bundled-pack snapshots.
- **Compiler:** `stages/classes.ts` l.53 copies `progression` verbatim (`structuredClone`). `theme-loader.ts` types the JSON with `as unknown as ThemeTemplate`. No compiler source changes.
- **Design source:** `mocks/progression.html` l.38 already lists "feat slots" among the pack's progression tables, and l.48-58 show a `feats` column for `progression.warden` levels 1–5: **1, 1, 2, 2, 2**.

## Scope Summary

| ID | Module | Change |
|---|---|---|
| — | DB (Author) | `database.md` v1.8 + Version Registry row 9; `pack.schema.json` `classProgression.featSlots` |
| M01 | Schema | `ClassProgression.featSlots?` mirror; validator checks (E-SCHEMA-01 only, no rule id) |
| M03 | Runtime | `feats.ts` cap helper + `learnFeat` refusal; `validateBuild` optional held-feats parameter; `levelSet` / `awardXp` refuse; restore refuses |
| M04 | Compiler | content only: `featSlots` on all 9 bundled classes |
| — | Docs | `README.md` Feats bullet and v1-limits line |
| M02, M05 | — | untouched |

**Out of scope (carried):**
- the `mending` spells (3 sites; human content question);
- restricts symmetry (human question);
- cone/line shapes (FR-11 deferral);
- cleanup items C1/C2/C14;
- prior-ledger carries listed in `arch/v1-core.md`, explicitly including the `useItem` condition-duration display (`arch/v1-core.md:1084-1086`), the 12 fail-branch-free `damage(half)` sites, and the `evalPackFormula` parse-once debt (F-P6);
- FR-6 "class features" / the `database.md` `features` row (F-FP2, F-P5): a future human-authorized DB re-entry.

## Design Decisions

- **DD-F1 (human, 2026-10-04 Q1): the field.** `progression.<classId>.featSlots?: integer[]`. Entry *i* is the number of feats the class grants **in total** at class level *i + 1*. It is a level-indexed running total, like `saves` and `slots` values, not an increment. The design source is `progression.html`'s feats column.
- **DD-F2: multi-class.** A character's feat slots are the sum, over its classes, of `featSlots[level - 1]`. This mirrors vancian slots, which add across classes (`progression.ts` `deriveProgression`; `progression.html` l.105).
- **DD-F3: opt-in, additive.** A pack is *feat-slotted* when **any** `progression` entry declares `featSlots`. In a feat-slotted pack, a class without `featSlots` contributes **0**. A pack with no `featSlots` has **no cap**: v1.7 behaviour is unchanged for every fixture pack and every external pack. This is an additive-optional contract event; `schemaVersion` stays 1.
  - *Rejected:* "every entry must declare it". Progression maps also hold monster-only entries (fixture `wight-frames`; `coverage-floor.test.ts` l.244-247 treats statblock-referenced tables as monster machinery). Requiring `featSlots` on those would be noise.
- **DD-F4: load constraints. All are `E-SCHEMA-01`; no rule id is added.**
  - Each entry is an integer ≥ 0, with at least one entry. The JSON Schema states these.
  - Values are **non-decreasing**, so a level-up never removes a slot. The validator enforces this.
  - The length must be at least the class's readable level ceiling (the shortest `saves` array, the same ceiling `validateBuild` and `tableLevelCeiling` use). This lets every reachable level read a value. The validator enforces this.
- **DD-F5: every held feat occupies one slot,** passive or reactive. FR-6 names one "feat slots" table and does not split feats by kind.
- **DD-F6: refusal.** The runtime rule name is **`feat-slots-exceeded`**. Like `feat-known` and `race-cap-exceeded`, it is a runtime rule name, not a `RULE_IDS` entry. Every refusal is all-or-nothing: no state change and no event.
  - **(a) `learnFeat`:** the slot check runs after `unknown-feat` and `feat-known`. It refuses when `held + 1 > slots`, throwing RuntimeRuleError.
  - **(b) `validateBuild(runtime, race, entries, heldFeats?)`:** a new optional 4th parameter (additive on a public function). When the pack is feat-slotted and the build produced no other card, it emits one card if `heldFeats.length > slots`. Through this, `levelSet` refuses with a CharacterBuildError and leaves levels unchanged.
  - **(c) Restore (human, Q2 "refuse"):** `characterStateRefusals` passes `saved.feats`. `restoreCharacter` and `restoreParty` refuse with a RuntimeRuleError and mint nothing. The unknown-feat `E-SNAP-01` card stays as is, and both cards may appear together.
  - **(d) `awardXp`:** compute the new class levels **before** mutating anything. If they would leave the held feats over the slots, throw a CharacterBuildError `feat-slots-exceeded`; XP, levels and events stay unchanged. This path is reachable only because of F-FP1.
  - **Card shape:** `{severity: 'error', rule: 'feat-slots-exceeded', jsonPath: 'feats', artifactId}`. `artifactId` is the feat id for `learnFeat` and `'(character)'` for the build paths. The message states held and available; the hint lists each class's contribution, e.g. `warden 1 → 1`.
- **DD-F7: no new public symbol.** The cap helper is a module-internal export of `feats.ts` (not on the barrel). The only surface change is `validateBuild`'s optional parameter. This is the conservative choice (less public API). A host-facing "slots remaining" query is a follow-up.
- **DD-F8: sample content.** All 9 bundled classes get `featSlots: [1, 1, 2, 2, 2, 3, 3, 3, 4, 4]`. Levels 1–5 are `progression.html`'s warden column verbatim. Levels 6–10 continue the same cadence, one more slot every third level, and reach the 4 feats each theme declares at level 9. This is pack data under the governing principle, so a pack author may change it.
- **DD-F9: unchanged surfaces.** `snapshots.schema.json` is unchanged (`characterState.feats` already exists). Combat profiles are unchanged: `CombatantProfile.feats` is host-restated and the cap governs characters. The compiler source is unchanged.
- **DD-F10: auto-decision (conservative; Step 2 rule 3).** The pre-existing `awardXp` level-lowering (F-FP1) is **not** changed here. Changing it would change observable progression behaviour, which is a product decision. DD-F6d makes the new invariant hold regardless.

**Findings from planning**
- **F-FP1 (pre-existing, probed at plan time):** `awardXp` can **lower** a class level that was set directly. The probe ran against the built package at `2e69863`:
  - setup: dark-fantasy seed 42, `createCharacter` warden **5**, then `awardXp(c, 100)`;
  - result: `classes [{warden, level 1}]`, plus a `level:reached {warden, 1}` event.
  - Cause: `progression.ts` l.282-291 sets `entry.level = min(levelForXp(classXp), cap, ceiling)` whenever that differs, including when it is lower.
  - Disposition: **carried to the human** (is a level drop on award intended?). This feature only guards the feat invariant against it (DD-F6d, proven in S02).
- **F-FP2 (doc drift, not ours):** `database.md` §progression (l.479) lists a `features` field (`{level, ref}`). It is absent from `pack.schema.json` and from the validator's `forbidUnknown`. S01 must not fix it as a side effect. **Carried** to the next DB re-entry; owner DB.
- **Newly reachable content scan:** the feature adds no effect, action or spell. It only *restricts* `learnFeat`. Every in-tree `learnFeat` call site was checked under DD-F8:
  - `spells-journey.test.ts` l.349: hexer level 3 learns 1 of 2 slots. Holds.
  - `rules-are-data.test.ts` l.180, `feats.test.ts`, `snapshots/character.test.ts` l.373-392: fixture packs, which are not feat-slotted, so uncapped. Hold.
  - README samples: the hexer holds 1 feat. Holds.

## Pin audit (behavior + doc pins; PROGRAM-CONFIG convention)

The fact being changed is "there is no feat-slot cap". Grep at `2e69863`: `grep -rni "feat.slot\|feat-slot\|no feat" program/Ruleswright/specs README.md src tests program/Ruleswright/mocks .github`, plus `learnFeat` call sites.

| Hit | Kind | Owner / checkpoint |
|---|---|---|
| `database.md` l.437-438 "**v1 limit:** no feat-slot cap (progression declares none)" | doc pin | S01 ck1 |
| `database.md` l.44 overview "per-class tables: HD, attack table, saves, vancian slots" | doc pin | S01 ck1 |
| `database.md` §progression table l.472-479 | doc pin | S01 ck1 (new row) |
| `README.md` l.346-348 Feats bullet (`unknown-feat` and `feat-known` refuse) | doc pin | S02 ck3 |
| `README.md` l.380-381 "v1 limits: there is no feat-slot cap …" | doc pin | S02 ck3 |
| `src/runtime/feats.ts` l.3-4 header "v1 has no feat-slot cap …" | doc pin (source comment) | S02 ck2 |
| `src/runtime/progression.ts` l.20-22 header (rule list) | doc pin (source comment) | S02 ck2 |
| `arch/v1-core.md` l.271-272, l.567, l.1149-1150 ("no feat-slot cap (FR-6 gap)") | arch | Orchestrator arch fragment at the S02 receive; Archivist synthesis |
| `PROGRAM-CONFIG.MD` registry/Custom Rule 1 (contract history) | config | Archivist final pass |
| `mocks/progression.html` l.38/l.48 | design source | **no change** (already states feat slots) |
| `tests/proofs/docs-run.test.ts` l.49 (README must carry exactly **4** ```ts blocks) and l.234 (`toContain('learnFeat')`) | count + doc pin | S02 ck3 keeps both: README edits use prose or ```text only, and keep `learnFeat` |
| `tests/proofs/spells-journey.test.ts` l.349 | behavior pin | holds under DD-F8 (hexer L3, 2 slots, 1 feat); no lease needed |
| `tests/compiler/coverage-floor.test.ts` | floor | S02 ck3 adds the featSlots floor |

## Verification Baseline

Observed by Planner at `2e69863` on 2026-10-04 (actual runs, not inherited):

| Command | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm format:check` | exit 0 ("All matched files use Prettier code style!") |
| `pnpm build` | exit 0 (tsup, 4 entries, ESM + CJS + DTS) |
| `pnpm test` (after build) | **48 files, 878/878**, 2.38 s |
| `pnpm exec vitest run tests/runtime/feats.test.ts tests/runtime/progression.test.ts tests/snapshots/character.test.ts tests/schema tests/compiler/coverage-floor.test.ts` | 8 files, 233/233 |

- **Lease-scoped gate:** `pnpm exec vitest run <path…>`. Do not use `pnpm test -- <pattern>`, which does not filter, and do not use bare `npx` (PROGRAM-CONFIG).
- **Whole suite:** `pnpm build` must run before `pnpm test`, because three journeys read `dist/` (action-targeting F-A1). The new journey imports `src/`, like `self-target-journey.test.ts`, so it does not need `dist/`.
- `pnpm check:isolation` and `pnpm check:security` were not run at plan time. Their last observed result was exit 0 at the S03 receive (`3cce108`). S02's final checkpoint runs them.
- **Known hazards:** no hangs, zero-discovery runs or port use are known. `docs-run.test.ts` compiles the README ```ts blocks (about 1 s).
- No vendor binary, port or exclusive resource is involved.

## Capability Readiness

| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|----|---|---|---|---|---|---|---|
| CAP-F1 | A pack may declare `progression.<id>.featSlots`. A malformed one is refused at load (`validatePack`, and the compiler's stage-8 dogfood) | contract property: S01 ck2; mirror + validator: S02 ck1 | CA-F1 | S02 ck1 | verified | `tests/schema/validate.test.ts` 8 load cases — S02 ck1 `45483c5`; floor over all 9 classes — ck3 `7bf5fa6`; journey leg 1 — ck4 `f7f6e88` | — |
| CAP-F2 | `learnFeat` refuses with `feat-slots-exceeded` when no slot is free. Slots sum across classes; an unslotted pack is uncapped | cap helper `feats.ts` (S02 ck2); `featSlots` data (pack) | CA-F1, CA-F2 | S02 ck2 | verified | `tests/runtime/feats.test.ts` 5 cases — S02 ck2 `a32ded2`; journey legs 2, 6, 8 — ck4 `f7f6e88` (negative control: those legs fail with the check removed) | — |
| CAP-F3 | `levelSet` and `awardXp` refuse any change that leaves held feats over the slots; nothing changes | `validateBuild` held-feats param, `awardXp` compute-then-apply (S02 ck2) | CA-F2 | S02 ck2 | verified | `tests/runtime/progression.test.ts` 5 cases (3 fail against pre-S02 code) — S02 ck2 `a32ded2`; journey legs 3–5 — ck4 `f7f6e88` | F-FP1 carried to the human |
| CAP-F4 | Character and party restore refuse an over-cap snapshot (human Q2), all cards at once, nothing minted | `characterStateRefusals` passes `saved.feats` (S02 ck2) | CA-F3 | S02 ck2 | verified | `tests/snapshots/character.test.ts` 4 cases — S02 ck2 `a32ded2`; journey leg 7 — ck4 `f7f6e88` | — |
| CAP-F5 | The bundled themes declare feat slots, so a generated character is capped end to end. **This is the feature's first narrow journey:** `generateCampaign` → `new Runtime` → `createCharacter` → `learnFeat` → `levelSet` / `awardXp` → `serializeCharacter` → JSON → `restoreCharacter` | theme content (S02 ck3) | CA-F1…F3 | S02 ck4 | verified | theme content + floor — S02 ck3 `7bf5fa6`; `tests/proofs/feat-slots-journey.test.ts` legs 1–9 on generated seed-42 packs — ck4 `f7f6e88`; whole suite 49 files 911/911 (Orchestrator rerun at receive) | — |

**Production path, all CAPs:** host → `Character.learnFeat` / `Runtime.levelSet` / `Runtime.awardXp` / `restoreCharacter` / `restoreParty` → `feats.ts` / `progression.ts` / `snapshots.ts` → `pack.progression[*].featSlots` (loaded through `validatePack`).
- **Restart behaviour:** the cap is derived and never stored; `feats` round-trips through the character snapshot.
- **No storage:** this library does no I/O; "durable" means the snapshot JSON.
- **No transport:** this is an in-process library; the "bridge" is the public runtime surface.

## Contract Agreements

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|----|---|---|---|---|---|---|---|
| CA-F1 | The meaning of `featSlots` (DD-F1…F5) | `pack.schema.json` `classProgression.featSlots` (S01) → `artifacts.ts` `ClassProgression.featSlots?` + `validate/sections/progression.ts` (S02 ck1) → `feats.ts` cap helper (S02 ck2) → theme JSON (S02 ck3) | see below | S01 ck1/ck2 text; S02 ck1/ck2/ck3 proofs | agreed (human Q1/Q3); landed v1.8, rechecked 2026-10-04 — no delta | contract: landed S01 ck1 `3f63fd3` (database.md §progression *Feat slots*) + ck2 `f4cc597` (`classProgression.featSlots`); mirror/validator: landed S02 ck1 `45483c5`; runtime helper: S02 ck2 `a32ded2`; theme data: ck3 `7bf5fa6` | **proven**: validate.test.ts (ck1 `45483c5`), coverage-floor 9/9 classes (ck3 `7bf5fa6`), journey leg 1 (ck4 `f7f6e88`) |
| CA-F2 | The refusal semantics (DD-F6a/b/d) | `feats.ts` `learnFeat`, `progression.ts` `validateBuild`/`levelSet`/`awardXp` → host | see below | S01 ck1 text; S02 ck2 proofs | agreed; landed v1.8, rechecked 2026-10-04 — no meaning delta (lettering, see below) | contract text: landed S01 ck1 `3f63fd3`; runtime: landed S02 ck2 `a32ded2` | **proven**: feats.test.ts + progression.test.ts (ck2 `a32ded2`), journey legs 2–6, 8 (ck4 `f7f6e88`) |
| CA-F3 | Restore refusal (DD-F6c, human Q2) | snapshot JSON → `snapshots.ts` `characterStateRefusals` → `validateBuild` → `restoreCharacter` / `restoreParty` | see below | S01 ck1 text; S02 ck2 proof | agreed (human Q2); landed v1.8, rechecked 2026-10-04 — no meaning delta | contract text: landed S01 ck1 `3f63fd3` (§progression (d) + Snapshot Envelopes bullet); runtime: landed S02 ck2 `a32ded2` | **proven**: snapshots/character.test.ts (ck2 `a32ded2`), journey leg 7 (ck4 `f7f6e88`) |

**CA-F1 mapping**

| Concept | Contract (S01) | Mirror / validator (S02 ck1) | Runtime (S02 ck2) |
|---|---|---|---|
| field | `classProgression.properties.featSlots`: `{type: array, minItems: 1, items: {type: integer, minimum: 0}, description: …}`. Not in `required`. | `featSlots?: number[]`; `forbidUnknown` list gains `'featSlots'`; `checkIntegerArray(…, 0)` | read as `progression[id].featSlots?.[level - 1]` |
| non-decreasing | description sentence + database.md | `E-SCHEMA-01` at `progression.<id>.featSlots[i]` where `v[i] < v[i-1]` | relied on (DD-F6d still guards) |
| coverage | description sentence + database.md | `E-SCHEMA-01` at `progression.<id>.featSlots` when `length < min(saves lengths)` (only when `saves` is a well-formed object) | relied on |
| feat-slotted pack | database.md (DD-F3) | — | `Object.values(pack.progression).some(p => p.featSlots !== undefined)` |
| absent on one class | database.md: contributes 0 in a feat-slotted pack | — | `?? 0` |
| unslotted pack | database.md: no cap (v1.7 behaviour) | — | helper returns `undefined` |
| multi-class | database.md: sum | — | sum over `classes` |
| every feat counts | database.md (DD-F5) | — | `feats?.length ?? 0` |

**CA-F2 mapping:** rule `feat-slots-exceeded`; `jsonPath: 'feats'`.

| Path | Error class | `artifactId` | Order / precondition | Nothing changes |
|---|---|---|---|---|
| `learnFeat` | RuntimeRuleError | the feat id | after `unknown-feat`, `feat-known` | `feats` unchanged; no `feat:learned` |
| `levelSet` | CharacterBuildError | `'(character)'` | inside `validateBuild`, only when no other card was produced (`cards` empty after the per-class loop) | classes, levels, saves, slots unchanged; no `level:reached` |
| `awardXp` | CharacterBuildError | `'(character)'` | after the `invalid-xp` check; new levels computed before any mutation | `xp`, `classXp`, levels unchanged; no `xp:awarded` / `level:reached` |
| `createCharacter` | — | — | holds no feats, so never fires | — |

**CA-F3 mapping:**
- `restoreCharacter` and `restoreParty` refuse with a RuntimeRuleError carrying the `validateBuild` card `feat-slots-exceeded` (`jsonPath 'feats'`, as for the other `validateBuild` cards in restore).
- An unknown feat id still produces `E-SNAP-01` at `<path>.feats[i]`. Both cards may appear together; the count includes unknown ids.
- `runtime.nextCharacterId` is unchanged on refusal (nothing minted).
- A snapshot at or under the cap round-trips byte-exact, and a snapshot with no `feats` key still has none.

**S01 recheck (Orchestrator, 2026-10-04, against `f4cc597`).** Every CA-F1/F2/F3 mapping row matches the landed `database.md` v1.8 *Feat slots* paragraph, the Snapshot Envelopes bullet, Version Registry row 9 and `pack.schema.json` `classProgression.featSlots` (`{type: array, minItems: 1, items: {type: integer, minimum: 0}}`, not in `required` (`[hd, saves]`), `additionalProperties: false`). No meaning moved. **Lettering delta:** `database.md` letters the refusal paths (a) `learnFeat`, (b) `levelSet`, (c) `awardXp`, (d) restore, while DD-F6 above uses (c) restore and (d) `awardXp`; and "compatibility caveat (d)" is a separate label. From here on, cite refusal paths **by name**, not by letter.

**Provisional rule (history):** all three CAs were provisional against **S01 ck1 (database.md)** and **S01 ck2 (pack.schema.json)**. Orchestrator re-reads the landed text and amends any row whose meaning moved **before** dispatching S02. S02 is dispatched against the amended text.

## Planning Completeness Review

Archivist, read-only, 2026-10-04 (handle h-ZxIS). **Reviewed plan revision `d97f269`; source revision `3cce108`.** Raw note: Orchestrator scratch (`.program/archivist-notes.md`).

| # | Dimension | Verdict | Evidence (abridged) |
|---|---|---|---|
| D1 | requirement coverage | pass | CAP-F1..F5 routed to S02 ck1–ck4; Q1/Q2/Q3 → DD-F1 / DD-F6c / S01 |
| D2 | fact origins | pass | held feats `feats.ts:25`; ceiling `progression.ts:119,243`; slot data passes `stages/classes.ts:53` |
| D3 | ownership | pass | arch → Orchestrator at S02 receive; Custom Rule 1 → Archivist final; F-FP1 human, F-FP2 DB |
| D4 | lease coverage | pass | no literal hash pins in `tests/`; README 4 ```ts blocks = docs-run l.49; serial waves |
| D5 | declared vs real deps | pass | S02 depends on S01's contract text only; no code reads `pack.schema.json` |
| D6 | early integration | pass | ck2 tests via `new Runtime` (`validatePack`, `runtime.ts:93`) + public methods; ck4 generated-pack journey |
| D7 | runtime wiring | pass | `featSlotTally` consumed by `learnFeat`/`validateBuild`/`awardXp`; 4th param passed by `levelSet` l.327 and `characterStateRefusals` l.319 |

No `fail`: no wave is blocked by the review.

**Findings and dispositions (Orchestrator, standing authority):**
- **F-P1 (fix before S02):** `cloneRuntimePack` warden `saves` length is 4 (`tests/runtime/fixtures/pack.ts:114-118`), so the prescribed `featSlots [1, 2]` in `progression.test.ts` and `snapshots/character.test.ts` fails DD-F4 coverage at load. `emberMarchesPack` (saves length 2) makes `feats.test.ts`'s `[1,2]`/`[1,1]` valid. **Disposition:** carried in S02's envelope: slotted arrays must be at least the fixture's ceiling long (e.g. `[1, 2, 2, 2]` on `cloneRuntimePack`). Test-data correction only; DD-F1…F6 unchanged.
- **F-P2 (fix before S02):** the coverage-floor `playerClasses` filter (l.244-247) drops dark-fantasy/wyldwood `warden` and zombie-urban `scavenger`. **Disposition:** carried in S02's envelope: the ck3 featSlots floor iterates every `content.classes` id (9/9).
- **F-P3 (human, folded into F-FP1):** with DD-F6d + DD-F10, a directly levelled character at its feat cap has every XP award below its level's threshold refused, and because refusal leaves `classXp` unchanged, small awards never accumulate. Added to the F-FP1 question below. Not blocking.
- **F-P4 (S02 reports):** compute-then-apply also makes `invalid-xp-table` all-or-nothing (today `xp` is mutated first, l.278). **Disposition:** S02 reports it as an R1 deviation and may add one nothing-changes assertion.
- **F-P5 (STATE wording):** FR-6 also asks for "class features" (requirements.md:68; `database.md:480` `features` row = F-FP2). The Intent is narrowed below to "FR-6 feat slots"; F-FP2 is deferred to a future human-authorized class-features DB re-entry (S01 stays told not to touch it). The §progression table is at database.md l.473-480 (STATE said 472-479).
- **F-P6 (carries):** explicit deferrals added to Out of scope: `useItem` condition-duration display (`arch/v1-core.md:1084-1086`), the 12 fail-branch-free `damage(half)` sites, the `evalPackFormula` parse-once debt. None is in this feature's scope.
- **F-P7 (design flag, human):** the "feat-slotted" predicate counts monster-only progression entries, so a pack declaring `featSlots` only on a monster table caps every player class at 0 with no load-time warning. **Disposition:** the approved meaning ("any progression entry", CA-F1) is kept unchanged; carried to the human as a pack-authoring question. Bundled themes declare it on every class, so this is unreachable in bundled content.
- **F-P8 (cosmetic):** merge the `./character` type imports in `feats.ts`; carried in S02's envelope.

## Current Blockers

None. S01 and S02 done 2026-10-04; nothing open blocks this feature.

Open human questions, carried; none blocks this feature:
- F-FP1: is `awardXp` lowering a directly-set level intended? Consequence under this plan (F-P3): a directly levelled character at its feat cap has every XP award below its level threshold refused, and small awards never accumulate (refusal leaves `classXp` unchanged).
- F-P7: should a pack that declares `featSlots` only on monster-only progression entries cap every player class at 0 (current approved meaning), or should only player-class entries make a pack feat-slotted?
- the `mending` spells (3 sites);
- restricts symmetry.

## Handoff Notes

### SESSION-01 — received 2026-10-04 (handle h-Snk5, base `7a7a8d3`) — done 2/2

Commits: ck1 `3f63fd3` (database.md), ck2 `f4cc597` (database.md + pack.schema.json), inside the lease. Orchestrator gates at receive: typecheck 0, lint 0, format:check 0, `pnpm exec vitest run tests/schema` 4 files 111/111; schema property checked by node.

Worker notes (verbatim): "Checkpoint-0 recheck passed: `grep -rn featSlots src program/Ruleswright/specs` returned nothing. `classProgression.properties` was exactly `hd`, `attackTable`, `attackBonus`, `saves`, `slots`, with `additionalProperties: false`. Version Registry's last row was 8 (v1.7). Human answer as applied: "1 per class per level - 2 refuse - 3 approved" → 1. the field is `progression.<classId>.featSlots`, indexed by class level (DD-F1); 2. restore refuses an over-cap character (refusal path "(d) restore" in `database.md`); 3. this re-entry is contract v1.8."

Surprises (verbatim): "The (c)/(d) lettering mismatch between SESSION-01 and STATE.md DD-F6" — SESSION-01 letters (c) `awardXp`, (d) restore; DD-F6 letters (c) restore, (d) `awardXp`.

followUp (verbatim): "Fix the lettering in the CA rows and STATE before S02 dispatches (Orchestrator). F-FP2 (`features` row) and F-P7 (feat-slotted predicate counts monster-only entries) are still carried, untouched."

Deviations (verbatim, wording only): "Status line: SESSION-01's text ended with ")". I replaced that with "; v1.7: …" so the history still follows, as earlier versions did. I also added a short clause saying what caveat (d) is. Feat slots paragraph: besides the SESSION text, it also states things already in STATE.md and the CA-F2/CA-F3 mapping tables: the card shape, the held + 1 > slots condition, the condition for (b)'s optional parameter, and that the held count includes unknown ids. It also quotes the human answer."

Disposition: accepted. Lettering resolved by citing paths by name (Contract Agreements, S01 recheck paragraph). No arch fragment (data and docs).

### SESSION-02 — received 2026-10-04 (handle h-9nCb, base `3e3d384`) — done 4/4

Commits: ck1 `45483c5`, ck2 `a32ded2`, ck3 `7bf5fa6`, ck4 `f7f6e88`. Every path inside the lease (`git show --name-only` per commit). Orchestrator gates at receive: typecheck 0, lint 0, format:check 0, build 0, `pnpm test` 49 files 911/911, check:isolation 0, check:security 0. `feats.ts` value-imports only `./errors`; `src/runtime/index.ts` and `character.ts` unchanged. Arch delta integrated at `3da588a`.

Worker notes (verbatim): "Feat slots are live on every path. CAP-F1 (`featSlots` checked at load), CAP-F2 (`learnFeat` cap), CAP-F3 (`levelSet`/`awardXp` refuse), CAP-F4 (restore refuses) and CAP-F5 (9 theme classes slotted plus the generated-pack journey) are proven. CA-F1/F2/F3 proofs landed. Producer symbols: `featSlotTally`, `FeatSlotTally`, `featSlotsExceeded` (exported from `feats.ts`, not the barrel); `validateBuild`'s optional 4th parameter `heldFeats`; `awardXp` compute → check → apply. Lease revision 1."

Checkpoint-0 recheck (worker): all five SESSION-02 checks held; no CA-F1..F3 meaning delta; paths cited by name.

Negative control (worker): with `learnFeat`'s new check commented out, the journey went 4 failed / 4 passed (leg 2, leg 6, leg 8 zombie-urban, leg 8 wyldwood fail); check restored before commit.

Surprises (verbatim): "The prompt's ck1 snippet gated the non-decreasing check on `every(isInteger)`, so a negative entry (for example `[1,-1,…]`) also counted as a decrease and gave two cards at the same path. The gate is now `isInteger(n) && n >= 0`, so each fault gives one card. This matches database.md's one-card-per-fault wording." / "`arch/v1-core.md` stale lines, as above (owner: Orchestrator)."

Deviations (verbatim): "rule: R1; checkpoint: 2; paths: `src/runtime/progression.ts`; reason: F-P4. Because `awardXp` now computes before applying, an `invalid-xp-table` refusal is all-or-nothing; before, `character.xp` was changed before `levelForXp` threw. The new assertion in `tests/runtime/progression.test.ts` proves no change." / "rule: R1; checkpoint: 1; paths: `src/schema/validate/sections/progression.ts`; reason: the duplicate-card fix to the prompt's gate, described in surprises." (Both in-lease.)

followUp (verbatim): "F-FP1 is unchanged and human-owned (DD-F10): `awardXp` can still lower a directly set level when no feat cap blocks it. Journey leg 5 and the `progression.test.ts` awardXp guard depend on that behaviour." / "F-FP2: the `features` doc row, owner DB." / "The arch fragment should retire the \"no feat-slot cap (FR-6 gap)\" lines in v1-core.md."

Disposition: accepted. Arch delta appended at `3da588a` (marks l.272/l.567 for retirement; synthesis is Archivist's final pass). Feature sessions complete; CAP-F1..F5 verified; CA-F1..F3 proven.

