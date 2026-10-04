# State Tracker — Ruleswright / builder-rulings

## Program / Feature / Intent / Sessions

- **Program:** Ruleswright (`program/Ruleswright/`)
- **Feature:** `builder-rulings`
- **Plan HEAD:** `eb042d5` (source last changed at `7bf5fa6`; `dist/` built 14:15, after it)
- **Planned:** 2026-10-04 by Planner
- **Intent:** apply the human's rulings on the four carried questions:
  - the `mending` spells heal;
  - out-of-combat restricts match the in-combat rule;
  - `awardXp` never lowers a level;
  - the feat-slotted predicate is kept and documented.
- **Sessions:** 2, serial (S01 → S02).

**Human answers on record (2026-10-04).** Planner listed four carried questions:
1. Should the three `mending` spells heal instead of reducing damage?
2. Should the restriction rules for spells outside combat match the ones in combat?
3. When `awardXp` is used after a character's level was set directly, it can lower that level. Is that intended (F-FP1)?
4. If a pack declares feat slots only on a monster's entry, every player class ends up with zero feat slots. Is that the intended reading (F-P7)?

The human answered: "**1 yes, heal 2 recommendation 3 no 4 recommendation**". Read against the questions:
1. **yes, heal** → DD-R1. Theme content, no contract text.
2. **recommendation** → Planner's recommendation is **symmetric** (DD-R3). It changes the v1.6 DD-S10 text, so it authorizes a DB re-entry for that text (S01).
3. **no** → `awardXp` never lowers a class level (DD-R4). A runtime fix (S02), plus one database.md bullet (S01).
4. **recommendation** → Planner's recommendation is **keep the v1.8 "any class" meaning and document it** (DD-R5), because the pack format cannot tell a player class from a monster class. One database.md sentence (S01) and one README sentence (S02); no code.

The recommendations for answers 2 and 4 were stated to the human in the plan summary, after the answer was given. If the human objects before S01 dispatches, replan S01/S02. Otherwise no blocker gates S01.

## Session Status

| # | Session | Modules | Owns | Status | Checkpoint | Completed | Notes |
|---|---|---|---|---|---|---|---|
| 01 | Author re-entry (DB): contract v1.9 text (restricts symmetry, XP never lowers, feat-slotted wording) | — (DB) | `program/Ruleswright/specs/database.md` | pending | — | — | description only; no contract file |
| 02 | The four rulings in code and content + journey + README | M03, M04 (content), README | `src/runtime/progression.ts`, `src/runtime/conditions.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `README.md`, `tests/runtime/progression.test.ts`, `tests/proofs/feat-slots-journey.test.ts`, `tests/runtime/conditions.test.ts`, `tests/runtime/combat/spells.test.ts`, `tests/runtime/combat/character-profile.test.ts`, `tests/proofs/rulings-journey.test.ts` | pending | — | — | depends on S01 + CA recheck |

## Wave Plan

| Wave | Sessions | Why concurrent |
|---|---|---|
| W1 | S01 | Alone. It writes the contract text S02 implements. |
| W2 | S02 | Alone. It is the only Coder session and it needs S01's landed text. |

No pair is declared concurrent.

## Dependency Graph

```
S01 (database.md v1.9) ──► S02 (progression.ts, conditions.ts, themes, tests, README)
```

Before dispatching S02, Orchestrator rechecks CA-R1…R3 against the landed database.md and amends any row whose meaning moved.

## Architecture Reference (feature-specific)

All facts were checked at `eb042d5`.

- **Restricts.**
  - `src/runtime/conditions.ts`: `matchesRestriction` (l.41) is kind-prefixed. `isRestricted` (l.186) calls it with the caller's kind only. `restrictedIds` (l.206) filters through `isRestricted`.
  - In combat, `combat/combat.ts` `restrictionRejection` (l.863) blocks a spell on `actions.tagged:` **or** `spells.tagged:` (DD-S10).
  - `database.md` l.401-406 documents the asymmetry.
  - Exported on the runtime barrel (`index.ts` l.60-61).
- **XP.**
  - `src/runtime/progression.ts` `awardXp` (l.282) computes `level = Math.min(levelForXp(classXp), raceCap, tableLevelCeiling)` (l.302). Apply (l.320) sets any different level, **including a lower one** (F-FP1, probed in feat-progression).
  - Feat guard (l.309-313): `feat-slots-exceeded`.
  - dark-fantasy declares `tables.xp` (`dark-fantasy.json` l.723): level 3 at 3000, level 4 at 6000.
- **Heal.**
  - `heal(formula)` is registry entry 13 (v1.4), and spells accept any effect.
  - In combat, a negative-amount mutation is clamped to `maxHp` (`combat.ts` l.1659).
  - `damage:applied` payload is `{amount, type, hp: 'before→after'}` (l.1452-1460).
  - `ability:<name>` binds the **actor's** abilities (`resolve.ts` l.377).
- **Spell targeting (DD-S8, unchanged).** With no `targetId`, a spell targets the only opponent. A heal spell must name its ally.
- **Feat-slotted predicate.** `feats.ts` `featSlotTally` (l.21): `Object.values(pack.progression).some(t => t.featSlots !== undefined)`.
  - Every progression entry pairs with a `content.classes` entry (E-REF-03; fixture `packs.ts` l.119-123 lists `wight-frames` as a class).
  - In the bundled themes, `warden`/`scavenger` are both player classes and statblock attack tables (feat-progression F-P2).
- **Plan-time probe (built `dist/`, seed 42).** With each `mending` line replaced by `heal(1d8 + ability(vigor))`, `new Runtime(generateCampaign({theme: loadTheme(t), seed: 42}))` loads for all three themes. The probe script was deleted afterwards.

## Scope Summary

| ID | Module | Change |
|---|---|---|
| — | DB (Author) | `database.md` v1.9: DD-S10 symmetric, XP bullet, F-P7 sentence, caveats (e)/(f), registry row 10 |
| M03 | Runtime | `progression.ts` `awardXp` max rule; `conditions.ts` `isRestricted` spell rule |
| M04 | Compiler | content only: 3 spell effect lines |
| — | Docs | README four additions |
| M01, M02, M05 | — | untouched; no contract file, no mock, no compiler `.ts` |

**Out of scope (carried):**
- F-FP2 (class features / `database.md` `features` row): the next feature, which needs a human-authorized DB re-entry and a product decision on what a feature does. Note that the bundled themes already carry `content.classes.<id>.features` (`dark-fantasy.json` warden: `oath-of-the-warden`, `wardens-glyph`).
- Load-time integrity for `spells.tagged:` patterns. Tightening it is breaking under the versioning discipline, and it was not asked.
- `restricts` symmetry in `isLivePattern` (C1, no non-test consumer).
- Cleanup C2.
- Browser determinism leg; snapshot byte-conformance; cone/line shapes; `useItem` duration display; 12 `damage(half)` sites; `evalPackFormula` parse-once; R-GM-1..3; F-M2.
- Optional "slots remaining" query (DD-F7 follow-up).

## Design Decisions

- **DD-R1 (human Q1 "yes, heal").** The three `mending` spells (zombie-urban `bind-the-bite`, dark-fantasy `bind-wound`, wyldwood `bind-wound`) become `heal(1d8 + ability(vigor))`.
  - **Auto-decision on the amount** (Step 2 rules 1 and 3): keep the authored dice and the authored vigor term, with the sign flipped to a heal, reading vigor explicitly as an ability. This is the med-kit precedent `heal(2 + ability(vigor))` (action-targeting DD-A5).
  - It is pack data, so it is reversible. With the bundled vigor of about 10 (README l.453), a cast heals about 11–18, comparable to the med-kit's 12. The cap always applies.
  - Cost, range, tags and lists are unchanged.
- **DD-R2 (auto, conservative).** No targeting change. A spell with no `targetId` still picks the only opponent (DD-S8), so the README tells hosts to name the ally. Making heal spells default to an ally would be an engine/product change that nobody asked for.
- **DD-R3 (human Q2 "recommendation" = symmetric).** Out of combat, `isRestricted`/`restrictedIds` block a spell by `actions.tagged:<t>` or `spells.tagged:<t>`, exactly as a combat declare does.
  - Actions are unchanged: `actions.tagged:` only.
  - `matchesRestriction` is unchanged, and so is load integrity (`actions.tagged:` only).
- **DD-R4 (human Q3 "no").** `awardXp` sets each class to `max(current, min(xpLevel, raceCap, ceiling))`.
  - XP and classXp always accumulate, and `level:reached` fires only on a rise.
  - The feat guard stays and is now reachable only from an edited over-cap state.
  - Closes F-FP1 and F-P3.
- **DD-R5 (human Q4 "recommendation" = keep "any class", document).** The pack has no player/monster class distinction (E-REF-03 pairs every progression entry with a class; bundled `warden` is both). "Only player classes count" cannot be computed without a new schema field, which would be a larger design event than the trap warrants. database.md and the README state the rule plainly. Closes F-P7 as intended behaviour.
- **DD-R6.** Contract **v1.9** is description-only, following the v1.7 precedent: registry row 10, caveats (e) and (f), no rule id, `schemaVersion` 1. No contract file changes.
- **DD-R7 (auto).** Cleanup C14, the stale comment at `character-profile.test.ts:381`, folds into S02 ck3. It is a one-line comment about the same heal vocabulary, so there is no reason to give it its own run.

## Pin audit (behavior + doc pins; PROGRAM-CONFIG convention)

The greps ran at `eb042d5` over `program/Ruleswright/specs`, `README.md`, `src`, `tests`, `program/Ruleswright/mocks` and `.github`.

| Fact changed | Hit | Kind | Owner / checkpoint |
|---|---|---|---|
| mending = damage | 3 theme `effect` lines | content | S02 ck3 |
| | `tests/compiler/spell-lists.test.ts` l.50-51 (medic knows `bind-the-bite`) | name pin | holds; no edit |
| | contentHash of all three themes changes | identity | no literal hash pin in `tests/` (`snapshots/combat.test.ts` l.204 `'9a02b1c4'` is a deliberate mismatch); README carries no hash |
| | `arch/v1-core.md` mending residual | arch | Orchestrator arch fragment at the S02 receive; Archivist final pass |
| restricts asymmetry | `database.md` l.357, l.359, l.401-406 | contract text | S01 ck1 |
| | `src/runtime/conditions.ts` header l.15-16 + `isRestricted` JSDoc | source comment | S02 ck2 |
| | `tests/runtime/combat/spells.test.ts` l.408-413 (`toBe(false)`, "carried asymmetry") | behavior pin | S02 ck2 (flip) |
| | `tests/runtime/conditions.test.ts` l.36-44 (`spells.tagged:` hexbound; action `strike` false) | behavior pin | holds; no edit |
| | `mocks/conditions.html`, `mocks/magic.html` l.107 (in-combat gates) | design source | no change: neither states the out-of-combat kind rule |
| | `arch/v1-core.md` restricts residual; PROGRAM-CONFIG none | arch | Orchestrator / Archivist |
| awardXp lowers | `tests/runtime/progression.test.ts` l.205-215 | behavior pin | S02 ck1 (re-key) |
| | `tests/proofs/feat-slots-journey.test.ts` l.71-87 (leg 5) | behavior pin | S02 ck1 (re-key) |
| | `progression.test.ts` l.34-41; `snapshots/character.test.ts` l.60-80 | behavior pin | hold (max = same value); no edit |
| | `README.md` l.349-353 (`awardXp` among refusers) | doc pin | S02 ck4 (kept, sentence appended) |
| | `database.md` l.510-512 refusal (c) | contract text | S01 ck1 (XP bullet beside it) |
| | `progression.ts` header l.19-22, `awardXp` JSDoc | source comment | S02 ck1 |
| | `mocks/progression.html` l.78-80 (`awardXp(brynn, 2400)` → warden 4) | design source | holds |
| feat-slotted wording | `database.md` l.491-494; `README.md` l.385-386 | doc | S01 ck1; S02 ck4 |
| README ```ts count | `tests/proofs/docs-run.test.ts` l.49 (exactly 4), l.234 (`learnFeat`) | count pin | S02 ck4 keeps both (prose/```text only) |

## Verification Baseline

Planner observed these at `eb042d5` on 2026-10-04 (actual runs):

| Command | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0. A first run was **red**, on Planner's own scratch probe `.program/tmp/probe-heal.mjs` (`no-undef console`). ESLint lints `.program/tmp/*.mjs`. After the file was deleted, lint was 0 |
| `pnpm format:check` | exit 0 |
| `pnpm test` (dist fresh: built 14:15, after the last `src` commit at 14:08) | **49 files, 911/911** |
| `pnpm exec vitest run tests/runtime/conditions.test.ts tests/runtime/combat/spells.test.ts tests/runtime/progression.test.ts tests/runtime/feats.test.ts tests/proofs/feat-slots-journey.test.ts tests/compiler/spell-lists.test.ts` | 6 files, 92/92 |

- **Not run at plan time:**
  - `pnpm build`. `dist/` was current by mtime.
  - `pnpm check:isolation` and `pnpm check:security`. Last observed exit 0 at the feat-progression S02 receive (`f7f6e88`).
  - S02 ck4 runs all three.
- **Lease-scoped gate:** `pnpm exec vitest run <paths>`. Do not use `pnpm test -- <pattern>`, which does not filter, and do not use bare `npx`.
- **Whole suite:** `pnpm build` must come before `pnpm test`, because three journeys read `dist/`. The new journey imports `src/`.
- **Known hazards:**
  - **New:** ESLint lints `.program/tmp/*.mjs`, so a worker's scratch `.mjs` there turns the whole-repo lint red.
  - No hangs, zero-discovery runs, ports or vendor binaries.
- **Commit hazard:** `program/Ruleswright/prompts/` is gitignored (`.gitignore` l.29). Plan files and FINAL-REPORT/VERIFICATION need `git add -f` with an explicit pathspec (ledger row c187bed6).

## Capability Readiness

| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|----|---|---|---|---|---|---|---|
| CAP-R1 | The `mending` spells heal an ally in combat: `fight.declare('bind-wound' \| 'bind-the-bite', { targetId })` → negative `damage:applied` on the target, capped at `maxHp`. **First narrow journey** (generate → Runtime → character → prepare (vancian) → profile → startCombat → declare → heal) | theme `effect` lines (S02 ck3); `heal` executor (v1.4, exists); `ability:<name>` actor binding (exists, `resolve.ts:377`) | CA-R4 | S02 ck3 | planned | `tests/proofs/rulings-journey.test.ts` legs 1–4 (planned) | — |
| CAP-R2 | Out of combat, `isRestricted`/`restrictedIds` match a spell by `actions.tagged:` or `spells.tagged:`; same answer as a combat declare | contract text (S01 ck1); `conditions.ts` (S02 ck2) | CA-R1 | S02 ck2 (unit), ck3 (journey leg 5) | planned | `conditions.test.ts`, `spells.test.ts`, journey leg 5 (planned) | — |
| CAP-R3 | `awardXp` never lowers a class level; XP accumulates; it rises once XP passes it | contract text (S01 ck1); `progression.ts` (S02 ck1) | CA-R2 | S02 ck1 (unit), ck3 (journey leg 6) | planned | `progression.test.ts`, `feat-slots-journey.test.ts` leg 5, journey leg 6 (planned) | — |
| CAP-R4 | The feat-slotted rule (any class counts) is stated in the contract and the README | contract text (S01 ck1); README (S02 ck4) | CA-R3 | S02 ck4 | planned | text review at receive (existing `feats.test.ts` l.179 "class without featSlots contributes 0" already proves the behaviour) | — |

**Restart behaviour.** None of the four changes stored state.
- Snapshot schemas are unchanged.
- The heal content changes each theme's `contentHash`, so older bundled-theme snapshots are already refused by identity (FR-14). This is the same caveat every content feature has carried.

## Contract Agreements

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|----|---|---|---|---|---|---|---|
| CA-R1 | Restricts symmetric (human Q2, DD-R3) | database.md DD-S10 (S01) → `conditions.ts` `isRestricted`/`restrictedIds` (S02 ck2) → host | see below | S01 ck1; S02 ck2/ck3 | agreed (human Q2), **provisional** against S01 ck1 | planned | planned |
| CA-R2 | XP never lowers a level (human Q3, DD-R4) | database.md *Feat slots* XP bullet (S01) → `progression.ts` `awardXp` (S02 ck1) → host | see below | S01 ck1; S02 ck1/ck3 | agreed (human Q3), **provisional** against S01 ck1 | planned | planned |
| CA-R3 | Feat-slotted = any class (human Q4, DD-R5) | database.md DD-F3 bullet (S01) → `feats.ts` `featSlotTally` (exists, unchanged) → README (S02 ck4) | the predicate is unchanged | S01 ck1; S02 ck4 | agreed (human Q4), **provisional** against S01 ck1 | ready (code unchanged) | existing `feats.test.ts` l.179 |
| CA-R4 | Heal spell meaning (human Q1, DD-R1) | theme JSON (S02 ck3) → compiler (verbatim) → `validatePack` → combat executor → `damage:applied` | see below | S02 ck3 | agreed (human Q1; amount auto-decided, DD-R1) | planned | planned |

**CA-R1 mapping**

| Call | Pattern on an active condition | v1.8 result | v1.9 result |
|---|---|---|---|
| `isRestricted(…, 'spell', id)` | `spells.tagged:<t>`, spell tagged `<t>` | true | true |
| `isRestricted(…, 'spell', id)` | `actions.tagged:<t>`, spell tagged `<t>` | **false** | **true** |
| `isRestricted(…, 'action', id)` | `actions.tagged:<t>`, action tagged `<t>` | true | true |
| `isRestricted(…, 'action', id)` | `spells.tagged:<t>`, action tagged `<t>` | false | false |
| any | `<t>` declared by no action or spell | false | false |
| `restrictedIds(…, kind)` | — | filter by `isRestricted` | unchanged definition |
| combat `declare` | — | DD-S10 | unchanged |

**CA-R2 mapping:**
- `level' = max(level, min(levelForXp(classXp'), raceCap ?? ∞, ceiling))`.
- `xp' = xp + amount`.
- `classXp'` follows the even split (unchanged).
- Events: `xp:awarded`, then `level:reached` for each class where `level' > level`.
- Refusals: `invalid-xp` and `invalid-xp-table` are unchanged. `feat-slots-exceeded` is unchanged in shape and now fires only when `held > slots(level')`, which needs an edited state.

**CA-R4 mapping:**
- The effect line is `heal(1d8 + ability(vigor))`. `ability(vigor)` is the **caster's** vigor ability (`ability:vigor` from the actor's abilities).
- The heal is a negative-amount mutation on the declared target, clamped: `after = current >= maxHp ? current : min(maxHp, current + heal)`.
- Gates are unchanged: restricted → target → range 6 → armor (vancian only) → cost → binding.
- Bound by `targetId`; DD-S8 default unchanged (DD-R2).

**Provisional rule:** CA-R1…R3 are provisional against **S01 ck1**. Orchestrator re-reads the landed database.md and amends any row whose meaning moved **before** dispatching S02. S02 is dispatched against the amended text.

## Planning Completeness Review

Archivist, scoped planning-completeness pass (handle h-B643, 2026-10-04 15:04), read-only. **Reviewed plan revision `e7e5828`; source revision `7bf5fa6`** (`tests/`, `README.md` at `f7f6e88`); tree clean.

| # | Dimension | Verdict | Evidence (summary) |
|---|---|---|---|
| D1 | requirement coverage | pass | CAP-R1 → S02 ck3; CAP-R2 → S02 ck2/ck3; CAP-R3 → S02 ck1/ck3; CAP-R4 → S01 ck1 + S02 ck4; out-of-scope items owned |
| D2 | fact origins | pass | heal clamp `combat.ts:1659`, payload `:1453-1460`, `resolve.ts:377`, `combat.ts:863`, `feats.ts:21`, `progression.ts:282/302/320`; probe: `heal(1d8 + ability(vigor))` on an ally in all three seed-42 packs → `damage:applied {amount:-12, hp:"17→27"}` |
| D3 | ownership | pass | S02 ck1–ck4; S01 ck1/ck2; arch residuals → Orchestrator at S02 receive + final Archivist; C14 in S02 ck3 |
| D4 | lease coverage | pass | every S02 write in Owns incl. 4 behaviour pins; no other caller of `isRestricted`/`restrictedIds`/`awardXp`; serial plan |
| D5 | declared vs real dependencies | pass | S02 → S01 real (ck0 reads v1.9; CA-R1..R3 provisional on S01 ck1) |
| D6 | early integration | pass | S02 ck3 journey through `src` barrels, composed path probed (with positions, F-R2) |
| D7 | runtime wiring | pass | no new interface; `runtime.ts:147-148`, `index.ts:60-61` |

**Findings and dispositions:**
- **F-R1** (legs 1–3 wound always fully healed: min heal 11 vs wound 10) → S02 envelope amendment: wound the ally by 20 (`hp = maxHp − 20`), assert the uncapped `after = before − amount`.
- **F-R2** (spatial packs need positions; range 6) → S02 envelope: caster (0,0), ally (1,0), foe (5,0).
- **F-R3** (profiles carry no conditions) → S02 envelope: leg 5 in-combat pushes the condition onto `fight.state.combatants[id].conditions` (precedent `spells.test.ts:361`).
- **F-R4** (dice total only in `why.rolls[0]`, e.g. `"d8[-2]-10=-12"`) → S02 envelope: parse `why.rolls[0]` or assert `amount ∈ [−18, −11]` with the rolls string.
- **F-R5** (`hex-rite` is defined at `spells.test.ts:81`, tagged `casting`, not in `packs.ts`) → S02 envelope note.
- **F-R6** (`mocks/progression.html:70-80` `awardXp(brynn, 2400)` → `level:reached warden 4` after creating Brynn at 4) → carried mock-copy residual, Designer re-entry class; no session owns it. Final-report debt.
- **F-R7** (arch lines stating old behaviour beyond the residuals: `arch/v1-core.md:279`, `:340`, `:966`, `:1072`; keep `spells.tagged:` load-integrity carried at `:1215`) → Orchestrator arch delta at S02 receive + final Archivist.
- **F-R8** (no bundled content reaches caveat (e)) → S01 envelope: optional sentence in caveat (e).
- **F-R9** (human "start" after the recommendation summary) → advisory cleared below.

Inherited carried items: F-FP1/F-P3 (DD-R4), F-P7 (DD-R5), mending (DD-R1), restricts symmetry (DD-R3), C14 (S02 ck3) close in this plan; F-FP2, C1, C2, `spells.tagged:` load integrity remain carried with owners.

## Current Blockers

None.
- S01 is dispatchable on the recorded answer.
- **Advisory cleared (2026-10-04):** the human issued "start" after the plan summary carrying the answer-2 and answer-4 recommendations (F-R9).
- Planning-completeness review done: D1–D7 pass (see above).

## Handoff Notes

