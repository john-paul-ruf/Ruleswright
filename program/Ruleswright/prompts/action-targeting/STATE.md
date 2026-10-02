# State Tracker — Ruleswright / action-targeting

## Program / Feature / Intent / Sessions

- **Program:** Ruleswright (`program/Ruleswright/`)
- **Feature:** `action-targeting`
- **Plan HEAD:** `0b5787e` (source last changed at `c6128bd`)
- **Planned:** 2026-10-01 by Planner
- **Intent:** let actions affect the actor. Today every bundled self-buff action puts its condition on an enemy. Also:
  - give effects a way to read an ability that a save of the same name hides, and use it for the med-kit;
  - close two small carried gaps: `heal` missing from `EFFECT_VOCABULARY`, and the spell lists that match no spells.
- **Sessions:** 3, serial (S01 → S02 → S03).

**Human answers on record (2026-10-01):**
- Asked "Shall I go ahead and plan `action-targeting` this way? If yes, please also say whether the med-kit should be included." The human answered: "**med kit should use ability**". This is read as approval to plan the feature, with the med-kit included and reading the vigor **ability**.
- That answer was given on the premise "a content fix instead of an engine change". Planning **disproved** that premise (see DD-A5). So **B-AT-1** asked the human to authorize the DB re-entry before S01 is dispatched.
- **B-AT-1 answered 2026-10-01:** "**1 approved 2 12 3 confrim**" ("confrim" = confirm). Read against the three numbered questions:
  1. **approved** — DB re-entry, schema-change class, contract v1.7: the `self` shape word + self actions (DD-A1/A2) and `ability(name)`, registry 14 → 15 (DD-A4).
  2. **12** — the med-kit line is `heal(2 + ability(vigor))`, which heals 12 for the level-1 scavenger (DD-A5). The modifier-style alternative is rejected.
  3. **confirm** — `brace` roots its user (DD-A3).
  B-AT-1 is cleared; S01 is dispatchable.

## Session Status

| # | Session | Modules | Owns | Status | Checkpoint | Completed | Notes |
|---|---|---|---|---|---|---|---|
| 01 | Author re-entry (DB): contract v1.7 (`self` shape, self actions, `ability(name)`) | — (DB) | `program/Ruleswright/specs/database.md`, `src/schema/contracts/pack.schema.json` | pending | — | — | B-AT-1 cleared 2026-10-01; dispatchable |
| 02 | Self-targeting column: `target(self, …)`, self actions and reactions, 10 theme actions, first journey | M03, M04 | `src/runtime/combat/combat.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `README.md`, `tests/runtime/combat/self-target.test.ts`, `tests/proofs/self-target-journey.test.ts` | pending | — | — | depends on S01 |
| 03 | Ability column: `ability(name)`, med-kit, `heal` vocabulary, spell lists | M01, M02, M03, M04 | `src/core/dsl/registry.ts`, `src/core/dsl/formula.ts`, `src/core/dsl/effect.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/equipment.ts`, `src/schema/validate/sections/cross.ts`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `README.md`, `tests/core/dsl/checker.test.ts`, `tests/core/dsl/ability.test.ts`, `tests/proofs/equipment-journey.test.ts`, `tests/proofs/spells-journey.test.ts`, `tests/compiler/spell-lists.test.ts` | pending | — | — | depends on S01, S02 (shared theme files and README) |

## Wave Plan

| Wave | Sessions | Why concurrent |
|---|---|---|
| W1 | S01 | Alone. It writes the contract both later sessions implement (B-AT-1 cleared 2026-10-01). |
| W2 | S02 | Alone. Its lease shares `zombie-urban.json`, `wyldwood.json` and `README.md` with S03. |
| W3 | S03 | Alone, for the same shared files. |

No pair is declared concurrent.

## Dependency Graph

```
S01 (DB v1.7) ──► S02 (self column) ──► S03 (ability column)
        └────────────────────────────────►┘
```

- S02 needs S01's CA-A1/CA-A2 text.
- S03 needs S01's CA-A3 text, and S02's landed theme and README files because their leases share paths.

## Architecture Reference (feature-specific)

- **Effect executor:** `src/core/dsl/effect.ts`.
  - `execTarget` (l.401-410) calls `ctx.apply.resolveTargets(shape)`.
  - The shape argument of `target` is an **open name vocabulary**: `ARG_CATEGORIES` (l.470-479) and the bare-name branch of `checkEffectAst` (comment at l.584). `target(self, …)` therefore already parses and validates; only its play-time meaning is new.
- **Combat shape resolver:** `src/runtime/combat/combat.ts` `resolveShape` (l.1273-1302).
  - Theater-of-mind returns `[bound.id]` first.
  - In a spatial pack, an unknown shape (today: `self`) resolves to `[]`.
- **Declare target binding:** `combat.ts` `declare` (l.572-735).
  - Move actions bind the actor with no reach gate (l.623-630, DD-M9; `moveBudgetAst` l.1738).
  - Every other action goes through `resolveTarget` (l.886-930, opponents only; with several opponents and no `targetId` it returns `no-target`) and then `spatialGate` (reach).
  - Reactive take: `resolveReactive` (l.1529-1560) runs `resolveTarget` and `spatialGate` the same way.
  - Feats already act on the holder (`resolveFeat`, l.1567-1597).
- **Effect vars:**
  - `resolve.ts` `effectVars` (l.362-377) spreads actor abilities, then actor saves, then target saves. A save therefore shadows the same-named ability.
  - `equipment.ts` `useItem` vars (l.273-281) spread abilities, then saves.
  - `evalFormula`'s `name` case (`formula.ts` l.296-302) reads the flat map.
- **Registry:** `src/core/dsl/registry.ts`.
  - `REGISTRY` has 14 entries, frozen.
  - `EFFECT_VOCABULARY` (l.53-61) lacks `heal`.
  - `FORMULA_VOCABULARY` (l.67).
- **M01 mirror:** `src/schema/validate/sections/cross.ts` `NON_FORMULA_ARGS` (l.82-87) mirrors core's `ARG_CATEGORIES` name positions for the speed scan. M01 imports no core value.
- **Known spells:** `src/runtime/pools.ts` `knownSpells` (l.307-315) matches `classes.<id>.spellLists` against `spells.<id>.magic.lists` by exact string.

## Scope Summary

| ID | Module | Touched by | What |
|---|---|---|---|
| — | DB (Author) | S01 | `database.md` v1.7; `pack.schema.json` §formulas description and Version Registry row 8 |
| M01 | Schema surface | S03 | `cross.ts` `NON_FORMULA_ARGS` gains `ability: [0]` |
| M02 | Core | S03 | `registry.ts` (+`ability`, `EFFECT_VOCABULARY` +`heal`, `FORMULA_VOCABULARY` +`ability`); `formula.ts` (check and eval `ability`); `effect.ts` (`checkEffect` allows `ability`) |
| M03 | Runtime | S02, S03 | S02: `combat.ts` (`self` shape, self-action binding in `declare` and `resolveReactive`). S03: `resolve.ts` `effectVars` and `equipment.ts` `useItem` bind `ability:<name>` |
| M04 | Compiler content | S02, S03 | S02: 10 actions → `target(self, …)`. S03: med-kit `use`, zombie-urban medic/fixer `spellLists`, wyldwood hedge-mage `spellLists` |
| M05 | Root entry | — | unchanged |

**Out of scope (dispositions):**
- **CI build fix (carried from equipment-consumables S06):** **disproved / already closed.** `.github/workflows/ci.yml` test job runs `pnpm build` before `pnpm test` (lines 46-48, with the comment "The loot/equipment journeys read dist/"). No work.
- **Restricts symmetry:** waits on the human question in the spells-in-combat FINAL-REPORT. Not planned.
- **Feat slots (FR-6):** schema event. Not planned.
- **`mocks/spatial.html:191`, `api-map.html` event names:** design-change class. Not planned.
- **Duplicated logic (`isLivePattern`, `MAX_TABLE_DEPTH`), `SnapshotOffer` barrel export:** cleanup run. Not planned.
- **Spells that buff (ward-sigil, iron-skin, …):** unchanged. A spell may already name any combatant, the caster included (DD-S8). See DD-A6.
- **Prior-ledger carries (F-A8):** F-M2, R-GM-3, the `useItem` duration display, item tags, wyldwood charm armor, `evalPackFormula` parse-once, the browser determinism leg (spells-in-combat FINAL-REPORT l.92/l.186; cleanup ledger C3, C4, C7, C10, C13) — carried, prior ledgers, not in scope.
- **`mending` spells** (`bind-the-bite`, wyldwood `bind-wound` / l.418 `damage(1d8 - vigor, mending)`): these are written as *damage* minus the target's vigor save, not as a heal. S03 makes zombie-urban `bind-the-bite` reachable for the medic. This is a content-meaning question, **carried to the human** (Final Report). It is not fixed here.

## Design Decisions

| ID | Decision | Rationale |
|---|---|---|
| DD-A1 | **`self` shape word.** `target(self, <effect>)` scopes `<effect>` to the actor, in grid, hex and theater-of-mind packs alike, at any depth (root, inside `sequence`, inside a save branch). `hasTarget(self)` is true whenever the actor stands. No registry change: the shape argument is already an open name vocabulary. | Narrowest mechanism that reuses the existing `target(shape, …)` statement and the one combat shape resolver (CA-G4). It adds no new statement, no new field and no rule id. |
| DD-A2 | **Self actions.** An **action** (not a spell) whose parse-once effect **root** is `target(self, …)` binds its actor as the executor target, both when declared and when taken as a reaction: no opponent resolution, no reach gate. That is the DD-M9 move-action precedent. A `targetId` other than the actor → `invalid-target`, `E-REF-01`, nothing changes. The restriction, validity and cost gates are unchanged and keep their order. A spell keeps DD-S8 targeting even if it uses `self` inside: `self` still resolves to the caster. | With several opponents and no `targetId`, a self-buff today is refused `no-target`; out of reach it is refused by the reach gate. Neither makes sense for an effect on yourself. |
| DD-A3 | **Content retarget (10 actions).** Wrap the existing effect in `target(self, …)` for: dark-fantasy `withdraw`, `brace`, `ward-glint`; zombie-urban `fall-back`, `barricade`, `dodge-roll`, `adrenal-spike`; wyldwood `fall-back`, `circle-path`, `ward-step`. Unchanged: `gloam-light` (dazzles a foe), every spell, every feat, every save/attack action. **`brace` roots its user** (`rooted` restricts `actions.tagged:move`); the spells-in-combat FINAL-REPORT already lists it as a self-buff. **Confirmed by the human, B-AT-1 item 3 (2026-10-01).** | Names and condition semantics (braced, warded, fortified, spiked) are self-states. Each one is condition-only with no RNG, so roll order is unchanged. |
| DD-A4 | **`ability(name)`** is a formula function, registry 14 → 15: `{ arity: 1, kind: 'formula', signature: ['ability-name'] }`. It is legal **only inside effect-kind DSL fields** (action/spell/feat effects, item `use`); anywhere else → `E-FORM-02`. The argument must be a bare name declared in `stats.abilities`, else `E-FORM-03` with did-you-mean. It evaluates to the **actor's** ability value as the effect vars already compose it (equipment grants included), unshadowed by any save. The binding is the reserved var key `ability:<name>`. A `:` can never appear in a DSL name, so it cannot collide. A missing key at play time throws (fail closed). | There is no content spelling of the ability today. `effectVars` and `useItem` spread saves after abilities, so `vigor` is always the save. Swapping that order would break every save recipe (`d20 + <save>`). Keeping `ability()` to effect fields limits consumers to the two effect-var builders (`effectVars`, `useItem`). |
| DD-A5 | **Premise correction:** "med-kit → ability is a content fix" is **disproved**. zombie-urban declares `vigor` both as an ability and as a save (`stats`, l.34-35), and the save wins in both effect-var builders. **Content after S03:** `"use": "heal(2 + ability(vigor))"`. Probe (existing `dist/`, build revision not established; recorded as planning evidence only): a level-1 mile-born scavenger at seed 42 has abilities all 10 and hp 27, so the med-kit heals **12** (was 2). **Human chose 12, B-AT-1 item 2 (2026-10-01):** S03 writes exactly `heal(2 + ability(vigor))`. The modifier-style alternative (`heal(2 + floor((ability(vigor) - 10) / 2))`) is rejected. | User answer "med kit should use ability" (2026-10-01). |
| DD-A6 | Spells are not retargeted. DD-S8 already lets a spell name any combatant, the caster included, so a caster wards itself with `{ targetId: <self> }`. Spells default to the only opponent when no target is given; this is unchanged and documented. | Keeps ally-buff spells possible; changing spell defaults is a separate design question. |
| DD-A7 | **Spell lists.** zombie-urban `medic.spellLists: ["medic"]`, `fixer.spellLists: ["fixer"]`; `scavenger` stays `[]`. wyldwood `hedge-mage.spellLists: ["hedge-mage"]` (was `["hedge"]`; its 4 spells list `hedge-mage`). | The class edit is narrower than renaming spell lists. medic and fixer already hold `adrenaline` and `stamina` pools (probe: 18 / 18 at level 1), so their point-pool spells are payable. |
| DD-A8 | Journeys use the **src public barrels** (`src/compiler`, `src/runtime`, the movement-journey precedent), not `dist/`. | Avoids a build-freshness dependency inside the new proofs. `spells-journey` still reads `dist/`, so whole-suite runs build first (Verification Baseline). |
| DD-A9 | `README.md`: S02 adds one prose paragraph (self actions); S03 rewrites the med-kit lines. **Neither adds a fenced ```ts block**, so the docs-run block pin (`tests/proofs/docs-run.test.ts`) is not re-keyed and is not in any lease. | Keeps the docs-run pin out of both leases. |

## Verification Baseline

| Command | Scope | Evidence | Revision |
|---|---|---|---|
| `pnpm test` | whole suite (vitest run) | **actual, this planning run:** 44 files, 829/829 passed, 2.39 s | `0b5787e` |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm check:isolation`, `pnpm check:security` | whole repo | **inherited** (spells-in-combat FINAL-REPORT, all 0 at `5cfad48`; Archivist re-ran typecheck, build and isolation at `94d40f3`). Not re-run here. Source is unchanged since `c6128bd`. | `5cfad48` / `94d40f3` |
| `pnpm exec vitest run <path>` | lease-scoped gate | working form (PROGRAM-CONFIG). `pnpm test -- <pattern>` does **not** filter; bare `npx vitest` misresolves | — |

**Hazards and constraints:**
- `tests/proofs/spells-journey.test.ts`, **`tests/proofs/equipment-journey.test.ts`** and **`tests/proofs/loot-journey.test.ts`** import `../../dist/*` (corrected by the planning-completeness review, F-A1). A whole-suite `pnpm test`, or any re-derivation of those journeys after a source/theme change, must run **`pnpm build` first**; otherwise they read a stale `dist/`. This is the CI order (`ci.yml` l.45-47).
- The await idle timeout (~300 s) is not a crash (PROGRAM-CONFIG convention).
- No ports or exclusive resources. No session uses a fixed output path.
- Concurrency: none. The plan is serial.

**Behavior-pin audit (PROGRAM-CONFIG pin-lease convention, widened to behavior pins).**

Commands run at plan HEAD:
- `grep -rnE "withdraw|brace|ward-glint|fall-back|barricade|dodge-roll|adrenal-spike|circle-path|ward-step" tests`
- `grep -rnE "med-kit|heal\(" tests`
- `grep -rnE "REGISTRY\)|EFFECT_VOCABULARY|FORMULA_VOCABULARY" tests`
- `grep -rnE "knownSpells|spellLists|hedge" tests`

| Pin | What it asserts | Affected by | Owner |
|---|---|---|---|
| `tests/proofs/equipment-journey.test.ts:145-155` | out-of-combat med-kit `amount: -2`, `'23→25'`, `'d0[]-2=-2'`, `Math.min(cap, cap - 4 + 2)` | DD-A5 | S03 ck3 (in lease) |
| `tests/proofs/equipment-journey.test.ts:166-185` | in-combat med-kit `amount -2`, `'26→27'`, `'d0[]-2=-2'` | DD-A5 | S03 ck3 (in lease) |
| `README.md:390`, `:430-441` | med-kit line and expected-output block ("heals 2", the shadowing sentence) | DD-A5 | S03 ck3 (in lease) |
| `tests/core/dsl/checker.test.ts:12-28` | registry membership, exactly 14 ids | DD-A4 | S03 ck1 (in lease) |
| `tests/proofs/spells-journey.test.ts:249-250` | comment "hedge-mage knows nothing (its lists match no spell, carried)" | DD-A7 | S03 ck2 (in lease) |
| `tests/runtime/combat/character-profile.test.ts:339-349` | zombie-urban's **first** class (`scavenger`) is a non-caster | DD-A7 | **unaffected**: scavenger stays `[]`. S03 ck2 re-runs the file |
| `tests/proofs/movement-journey.test.ts:250-252` | wyldwood `hero.ward-step` offered, then declined | DD-A3 | **unaffected**: trigger unchanged; a declined offer runs no effect. S02 ck2 re-runs the file |
| `tests/runtime/fixtures/packs.ts:63-65` (`withdraw` in the emberMarches fixture), used as the skip action by `combat.test.ts`, `snapshots/combat.test.ts`, `perf-budget.test.ts`, `encounter.test.ts`, `rules-are-data.test.ts`, `spatial-triggers.test.ts` | fixture behavior | — | **unaffected**: fixtures are **not** edited (S02 must not edit them) |
| `tests/proofs/docs-run.test.ts:198-199`, `tests/runtime/combat/character-profile.test.ts:216-223` | class action **id** lists | — | unaffected (ids unchanged) |
| `tests/schema/validate.test.ts:652, 742-745` | fixture med-kit `heal(2 + vigor)` | — | unaffected (test fixture, not theme) |
| `tests/proofs/equipment-journey.test.ts:72-82` `fightToTheEnd`; `tests/runtime/combat/character-profile.test.ts:393-418` `settledFight` | first accepted action per turn; med-kit at full hp | DD-A3, DD-A5 | **unaffected** (F-A3a): `baton-blow` always accepted first with one adjacent foe; heal at full hp clamps |
| `tests/runtime/combat/character-profile.test.ts:99-150` `fightScript` (l.146-148 no hero `declare:rejected`) | every class in every theme | DD-A3 | **unaffected** (F-A3b): first action always accepted, self actions never reached |
| `tests/proofs/grid-journey.test.ts:533-541` | enemy `targetId` passed to every hexer action; asserts only `resolvedActions > 0` | DD-A2 | **unaffected** (F-A3c): `withdraw` would now be `invalid-target`, but `hurl` comes first and only the count is asserted |
| `tests/proofs/equipment-journey.test.ts` step 6 (`'27→27'`) | heal at cap | DD-A5 | **unaffected** (F-A3d): clamps at cap |
| `tests/compiler/themes.test.ts:71` | items reach the pack verbatim | DD-A5 | **unaffected** (F-A3e): moves with the theme |
| `tests/proofs/equipment-journey.test.ts:13-17` (header comment "heals 2") | comment | DD-A5 | S03 ck3 (in lease) — update the header (F-A4) |
| `tests/runtime/combat/character-profile.test.ts:381` (comment "med-kit = heal(2 + vigor)") | comment only | DD-A5 | **accepted stale comment**, outside every lease (F-A4; auto-decision 2026-10-01, no lease change for a comment) — carried to the next cleanup run |

**Newly reachable content scan (Archivist recommendation, spells-in-combat):**
- S02 opens self scope to 10 actions. All are condition-only (`applyCondition(<id>, n)`), with no damage and no RNG, so no `damage(half)`-style hazard.
- S03 makes four zombie-urban spells known: `bind-the-bite`, `clean-sear`, `quietsong`, `rot-read`. Plus wyldwood `gloam-veil`, `wyrd-bloom`, `verge-light` and `briar-word` for the hedge-mage. Every one parses and validates today (the packs load at plan HEAD).
- `bind-the-bite` is a "mending" spell that deals damage. That is a carried content question; see Scope Summary.

## Capability Readiness

| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|---|---|---|---|---|---|---|---|
| CAP-A1 | FR-3/FR-9 targeting: `fight.declare('<self action>')` puts its condition on the actor, with any number of opponents at any distance, in spatial and theater packs | actor identity (combat `state.active`); effect root (`runtime.index.actionEffects`); condition apply (`applyMutation`) — S02 ck1 | CA-A1, CA-A2; S01 | S02 ck1 (unit), ck3 (journey) | planned | — | — |
| CAP-A2 | FR-4 reactions: taking `ward-glint` / `dodge-roll` / `ward-step` puts the condition on the reactor, with no reach gate | offer (`triggers.ts`, unchanged); `resolveReactive` binding — S02 ck1 | CA-A2; S01 | S02 ck1, ck3 | planned | — | — |
| CAP-A3 | Bundled content: the 10 self-buff actions affect their user (DD-A3) | theme JSON — S02 ck2 | CA-A1; S01 | S02 ck2, ck3 | planned | — | — (`brace` confirmed, B-AT-1) |
| CAP-A4 | FR-3: an effect can read an ability hidden by a same-named save, via `ability(name)`, in combat and out | registry/check/eval — S03 ck1; var bindings `effectVars` / `useItem` — S03 ck1 | CA-A3; S01 | S03 ck1 | planned | — | — |
| CAP-A5 | Med-kit heals `2 + vigor ability` (human 2026-10-01) | theme JSON — S03 ck3 | CA-A3; CAP-A4 | S03 ck3 | planned | — | — (line fixed: `heal(2 + ability(vigor))`, heals 12; B-AT-1) |
| CAP-A6 | `EFFECT_VOCABULARY` covers `heal` | registry — S03 ck1 | — | S03 ck1 | planned | — | — |
| CAP-A7 | FR-9 known spells: medic/fixer know their spells; hedge-mage knows its 4 | theme JSON — S03 ck2 | CA-A4 | S03 ck2 | planned | — | — |

**Production paths and assertions:**
- **CAP-A1/A2/A3 (first narrow journey, S02 ck3):** `generateCampaign({theme: loadTheme('dark-fantasy'), seed: 42})` → `new Runtime(pack)` → `createCharacter` warden and hexer → `profileFromCharacter` → `startCombat` with two enemies placed **beyond reach** → `declare('withdraw')` with no `targetId`.
  - Assert: no `declare:rejected`; `condition:applied` with actor = target = warden and `why.rule` `actions.withdraw`; `action:resolved` with `targetId` = warden; the enemies' conditions are unchanged; the `move` slot is spent.
  - `declare('brace')`: `rooted` lands on the warden, and that warden's later `declare('stride', { to })` is refused by the restriction gate.
  - Enemy attacks the hexer → `ward-glint` offered → take → `warded` on the hexer.
  - `serializeCombat` → `deserializeCombat` on a fresh `Runtime`: the actor's conditions survive.
  - Theater leg: the same pack with `spatial` deleted; `withdraw` lands on the actor.
  - `declare('withdraw', { targetId: <enemy> })` → `invalid-target`, state unchanged (deep-equal before and after).
- **CAP-A4/A5 (S03 ck3):** the zombie-urban journey (`equipment-journey.test.ts` steps 4-5) through `useItem` and `fight.use`. The heal amount equals `2 + <the vigor ability>` = 12, **not** `2 + <the save>` = 2. Assert that the save and the ability differ for the character (10 vs 0), so the proof discriminates.

## Contract Agreements

| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|---|---|---|---|---|---|---|---|
| CA-A1 | `self` names the acting combatant, never a foe | `combat.ts resolveShape` → `EffectApply.resolveTargets` (`resolve.ts` l.327) → `effect.ts execTarget` | `'self'` → `[actor.id]` before the theater early-return; every other shape unchanged; a downed actor never acts, so there is no special case | DB S01 ck1; implementation and proof S02 ck1 | agreed (B-AT-1, 2026-10-01; provisional vs S01 text) | planned | planned: `tests/runtime/combat/self-target.test.ts` |
| CA-A2 | A self action's target is its actor (authority: the actor) | `combat.ts declare` / `resolveReactive` → `execute(actor, bound, target = actor)` → events | root `target(self, …)` on an action ⇒ skip `resolveTarget` and `spatialGate`; `targetId` ∉ {undefined, actor.id} ⇒ `{kind: 'invalid-target', rule: 'E-REF-01', resource: targetId}`; restriction → validity → cost order unchanged; spells excluded | DB S01 ck1; implementation and proof S02 ck1; journey S02 ck3 | agreed (B-AT-1, 2026-10-01; provisional vs S01 text) | planned | planned |
| CA-A3 | `ability(n)` = the actor's composed ability `n`; never a save; never the target's | `registry.ts` / `formula.ts` (check + eval) → var builders `resolve.ts effectVars`, `equipment.ts useItem` → `evalFormula` | vars key `ability:<n>` = `actor.abilities[n]` (combat profile: equipment-composed) / `view.abilities[n]` (`useItem`); checker: effect-kind only (`E-FORM-02` elsewhere), `n ∈ stats.abilities` (`E-FORM-03`); missing key at play → throw; M01 mirror `NON_FORMULA_ARGS.ability = [0]` | DB S01 ck1-2; implementation and proof S03 ck1; content S03 ck3 | agreed (B-AT-1, 2026-10-01; provisional vs S01 text) | planned | planned: `tests/core/dsl/ability.test.ts`, `equipment-journey.test.ts` |
| CA-A4 | A class knows a spell iff a spellList string equals a spell's `magic.lists` entry | theme JSON → `pools.ts knownSpells` → `profileFromCharacter().profile.spells` | exact string match (no change to `knownSpells`) | S03 ck2 | agreed (existing behavior, no contract change) | ready (`pools.ts:307`) | planned: `tests/compiler/spell-lists.test.ts` |

**Provisional rows:** CA-A1 … CA-A3 are provisional against S01's landed text.
- After S01, Orchestrator re-checks each mapping above against `database.md` v1.7 before dispatching S02, and dispatches S02/S03 against the **amended** text.
- After S02 ck1, Orchestrator re-checks CA-A2 against the landed `declare`/`resolveReactive` code before S03.

## Current Blockers

| ID | Affects | Next action | Owner | Evidence to clear |
|---|---|---|---|---|
| — | none open | S01 is dispatchable. | — | — |

**Cleared:**

| ID | Affects | Request | Owner | Clearing evidence |
|---|---|---|---|---|
| B-AT-1 | S01 (and so S02, S03); CA-A1…A3; CAP-A3, CAP-A5 | Human authorizes a DB re-entry (schema-change class) for contract v1.7: (1) the `self` shape word and the self-action rule (DD-A1/A2); (2) `ability(name)`, registry 14 → 15 (DD-A4). The same answer also confirms (3) the med-kit line: `heal(2 + ability(vigor))`, which heals **12** at level 1, or the modifier-style alternative (DD-A5), and (4) `brace` roots its user (DD-A3). | human | **cleared 2026-10-01:** "**1 approved 2 12 3 confrim**" → (1) approved, (2) 12 / `heal(2 + ability(vigor))`, (3) brace confirmed |

## Planning Completeness Review

- **Pass:** Archivist planning-completeness, 2026-10-01, handle h-j20l (AqfUt), read-only, at HEAD `549b13d` (source unchanged since `c6128bd`). Probes: 4 lease-scoped files 63/63; node probes against `dist/` (build revision likely fresh, not proven). Whole suite and fast gates not re-run (inherited).
- **Result:** no blocking finding. All Architecture Reference line numbers within ±2; DD-A1/A5/A7 premises, the 10 actions, the `gloam-light` exclusion, the CI disproof and every behavior-pin row confirmed. S02 needs nothing outside `combat.ts`; S03's "effect-kind only" is enforceable via `checkEffect` alone; `EFFECT_VOCABULARY`'s only consumer is `checker.test.ts:32`.
- **Dispositions (Orchestrator, standing authority; carried to workers through their envelopes):**

| Finding | Disposition | Owner |
|---|---|---|
| F-A1 dist hazard covers 3 suites | STATE hazard list corrected (above); S03 envelope: `pnpm build` before re-deriving equipment-journey | Orchestrator / S03 ck3 |
| F-A2 self-buffs now offer the actor's own `condition:applied[target=self]` feats (second-gust, last-legs, gloam-step) | S01 envelope: one sentence in §actions self-action text (product behavior unchanged; documents it). S02 envelope: one ck1 case — a character who learned second-gust declares withdraw → offer `<id>.second-gust`, take it, nothing chains | S01 ck1 / S02 ck1 |
| F-A3 missing behavior pins | added to the pin table as unaffected (above) | Orchestrator |
| F-A4 stale med-kit comments | equipment-journey header → S03 ck3 (in lease); character-profile.test.ts:381 accepted stale comment, carried to cleanup | S03 ck3 / cleanup |
| F-A5 database.md Status line still "v1.6" | S01 envelope: update the Status line to v1.7 at ck2 (file already in Owns) | S01 ck2 |
| F-A6 only the effect root makes a self action | S01 envelope: state the root-only rule as an explicit limitation | S01 ck1 |
| F-A7 C12 exact-membership check | S03 envelope: add an exact-membership assertion pairing `EFFECT_VOCABULARY` with effect-kind registry entries in `checker.test.ts` (in lease) | S03 ck1 |
| F-A8 prior-ledger carries undisposed | Scope Summary line added (above) | Orchestrator |
| F-A9 citation drift | none; workers re-read at checkpoint 0 | — |
| F-A10 move-cost actions need separate turns/fights in the journey | S02 envelope note | S02 ck3 |

## Handoff Notes

<!-- Orchestrator writes here after each session — Coder's Handoff, verbatim. -->
