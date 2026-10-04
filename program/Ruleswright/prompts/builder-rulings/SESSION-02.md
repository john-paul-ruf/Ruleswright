# SESSION-02 — The four rulings in code and content: XP never lowers, symmetric restricts, healing spells, documented feat-slotted rule

> **Program:** Ruleswright
> **Feature:** builder-rulings
> **Modules:** M03, M04 (content only), README
> **Depends on:** SESSION-01 (database.md v1.9 text; CA-R1…R3 rechecked by Orchestrator)
> **Concurrent with:** —
> **Owns:** `src/runtime/progression.ts`, `src/runtime/conditions.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `README.md`, `tests/runtime/progression.test.ts`, `tests/proofs/feat-slots-journey.test.ts`, `tests/runtime/conditions.test.ts`, `tests/runtime/combat/spells.test.ts`, `tests/runtime/combat/character-profile.test.ts`, `tests/proofs/rulings-journey.test.ts`
> **Reads:** `program/Ruleswright/specs/database.md` (v1.9, as landed by S01), `src/runtime/combat/combat.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/feats.ts`, `src/runtime/pools.ts`, `src/runtime/index.ts`, `src/core/dsl/effect.ts`, `tests/proofs/self-target-journey.test.ts`, `tests/proofs/docs-run.test.ts`, `tests/runtime/fixtures/pack.ts`, `tests/runtime/fixtures/packs.ts`, `tests/compiler/spell-lists.test.ts`, `program/Ruleswright/prompts/builder-rulings/STATE.md`
> **Resources:** —
> **Checkpoints:** 4

**Authorization (quote it; do not re-litigate it).** The human answered the four carried questions on 2026-10-04: "**1 yes, heal 2 recommendation 3 no 4 recommendation**". STATE.md *Human answers on record* maps each answer to DD-R1…R5. S01 landed the contract text (database.md v1.9).

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M03 | Runtime | `progression.ts` header l.1-27, `levelForXp` l.229, `tableLevelCeiling` l.258, `awardXp` l.272-351 (level computed l.302-306, applied l.318-323) | CAP-R3 |
| M03 | Runtime | `conditions.ts` header l.7-18, `matchesRestriction` l.41, `declaredTags` l.55, `isRestricted` l.181-204, `restrictedIds` l.206-214 | CAP-R2 |
| M03 | Runtime | `combat/combat.ts` `restrictionRejection` l.857-891 (the in-combat rule to match; **do not modify**), `applyMutation` l.1659 (heal clamp), `damage:applied` payload l.1452-1460 | CAP-R1/R2 reference |
| M03 | Runtime | `combat/resolve.ts` l.360-377 (`ability:<name>` binds the **actor's** abilities) | CAP-R1 meaning (CA-R4) |
| M04 | Compiler content | `themes/zombie-urban.json` l.193-200 (`bind-the-bite`), `themes/dark-fantasy.json` l.268-275 (`bind-wound`, vancian), `themes/wyldwood.json` l.398-420 (`bind-wound`, `motes` pool) | CAP-R1 |
| — | Docs | `README.md` l.320-390 (*Spells and feats in combat*), l.349-353 (*Feat slots* bullet), l.385-386 | doc pins |

## Context

Four human rulings land here (STATE.md DD-R1…R5):
1. **Heal (DD-R1).** The three `mending` spells read `damage(1d8 - vigor, mending)`, which deals damage. They become `heal(1d8 + ability(vigor))`.
2. **Symmetric restricts (DD-R3).** Out of combat, `isRestricted(…, 'spell', id)` and `restrictedIds(…, 'spell')` match `actions.tagged:` as well as `spells.tagged:`, which is what a combat declare already does.
3. **XP never lowers a level (DD-R4).** `awardXp` keeps the higher of the current level and the XP level.
4. **Feat-slotted, documented (DD-R5).** No code change. The README says plainly that once any class declares `featSlots`, a class without it grants none.

No contract file, mock, or compiler `.ts` source changes. `src/runtime/index.ts` is unchanged: no new export.

## Capabilities

| CAP | This session | Checkpoint |
|---|---|---|
| CAP-R3 `awardXp` never lowers | owns and integrates | ck1 (unit), ck3 (journey leg 6) |
| CAP-R2 symmetric restricts | owns and integrates | ck2 (unit), ck3 (journey leg 5) |
| CAP-R1 heal spells | owns and integrates. **First narrow journey:** `generateCampaign` → `new Runtime` → `createCharacter` → (`prepareSpell` for the vancian theme) → `profileFromCharacter` → `startCombat` → `fight.declare(spellId, { targetId: ally })` → `damage:applied` with a negative amount, applied to the ally | ck3 |
| CAP-R4 feat-slotted rule documented | owns (README) | ck4 |

Production path: host → `Runtime.awardXp` / `isRestricted` / `restrictedIds` / `Combat.declare` → `progression.ts` / `conditions.ts` / `combat.ts` → pack data loaded through `validatePack`. No I/O, no transport, no storage (in-process library); "restart" = snapshot JSON, which this feature does not change.

## Contract Agreements

CA-R1…R4 (STATE.md) apply. **Checkpoint-0 recheck (read-only):**
- database.md v1.9 is landed. Its DD-S10 bullet says out of combat a spell is blocked by `actions.tagged:` or `spells.tagged:` (CA-R1). Its *XP never lowers a level* bullet says `awardXp` keeps the higher level (CA-R2). Its *Opt-in (DD-F3)* bullet says any class counts (CA-R3).
- `combat.ts` `restrictionRejection` still tests `matchesRestriction(pattern, 'action', …) || (kind === 'spell' && matchesRestriction(pattern, 'spell', …))`. That is the rule to mirror.
- `progression.ts` l.302 still reads `const level = Math.min(` with no `Math.max`.
- The three theme lines still read `"effect": "damage(1d8 - vigor, mending)"`, and `grep -rn mending src tests README.md` hits only them.
- `resolve.ts` l.377 binds `ability:<name>` from `actor.abilities`: the **caster's** vigor (CA-R4).

If any of these fails, stop and return `blocked` with the evidence. Do not reinterpret it.

## Files to Create/Modify

| File | Action | What Changes | ck |
|---|---|---|---|
| `src/runtime/progression.ts` | modify | `awardXp`: `level = Math.max(entry.level, Math.min(levelForXp, cap, ceiling))`; doc comments (header bullet + `awardXp` JSDoc) | 1 |
| `tests/runtime/progression.test.ts` | modify | re-key l.205-215 (F-FP1 path) to the new behaviour; add the guard test and the "never lowers, later rises" test | 1 |
| `tests/proofs/feat-slots-journey.test.ts` | modify | legs 3–5 (l.71-87): the `awardXp(c, 100)` assertion becomes "accepted, level kept" | 1 |
| `src/runtime/conditions.ts` | modify | `isRestricted`: kind `'spell'` also matches `actions.tagged:`; module header l.15-16 and JSDoc | 2 |
| `tests/runtime/conditions.test.ts` | modify | add the symmetric case | 2 |
| `tests/runtime/combat/spells.test.ts` | modify | l.408-413: the "carried asymmetry" pin flips to `true`, renamed | 2 |
| `src/compiler/themes/{zombie-urban,dark-fantasy,wyldwood}.json` | modify | the three `effect` lines → `"heal(1d8 + ability(vigor))"` | 3 |
| `tests/runtime/combat/character-profile.test.ts` | modify | l.381 comment: `heal(2 + vigor)` → `heal(2 + ability(vigor))` (cleanup C14; no assertion change) | 3 |
| `tests/proofs/rulings-journey.test.ts` | create | the journey (legs 1–6) on generated seed-42 packs | 3 |
| `README.md` | modify | heal spells, symmetric restricts, XP never lowers, feat-slotted wording (prose / ```text only) | 4 |

## Implementation

### Checkpoint 1 — `awardXp` never lowers a level (CAP-R3, CA-R2)

1. In `awardXp` (l.300-307), change the level computation to:
   ```ts
   const level = Math.max(
     entry.level,
     Math.min(levelForXp(runtime, classXp), cap ?? Number.MAX_SAFE_INTEGER, tableLevelCeiling(runtime, entry.id)),
   );
   ```
   Nothing else in the compute → check → apply order changes. The feat-slot check (l.309-313) stays as a guard. The apply loop's `if (level !== entry.level)` now fires only on a rise.
2. Update the JSDoc above `awardXp` (l.272-281): "…derives each class's level from pack thresholds (race caps clamp) and keeps the higher of that and the current level — an award never lowers a level (v1.9, DD-R4)…; `feat-slots-exceeded` can then fire only for a character already over its slots". Add a header bullet (after l.22): `- XP never lowers a level (v1.9, DD-R4): a level set directly stays until its XP passes it.`
3. `tests/runtime/progression.test.ts`:
   - **Re-key l.205-215** (`'awardXp whose derived level leaves the feats over the slots is refused (F-FP1 path)'`). Rename it `'awardXp never lowers a directly set level; XP accumulates (v1.9, DD-R4)'`. Use `wardenTwoHoldingTwo` + `awardXp(character, 100)`. Expect no throw, `xp` 100, `classXp { warden: 100 }`, `classes [{warden, 2}]`, events exactly `[xp:awarded]` (no `level:reached`).
   - **Add** `'an over-cap character (edited state) is still refused by awardXp and nothing changes'`. Build `slottedRuntime()`, a level-1 warden, then push two feat ids directly onto `character.state.feats` (an edited state; 1 slot at level 1). `awardXp(character, 100)` must return `['feat-slots-exceeded']`, with xp, classXp, classes and the event count unchanged. This keeps refusal (c) proven.
   - **Add** `'a directly set level rises only once XP passes it'`. Use `cloneRuntimePack()` (fallback curve, 1000 per level) with a warden set directly to level 3. `awardXp(1000)` → level 3, no `level:reached`. `awardXp(2000)` (classXp 3000 → level 4) → level 4, and `level:reached {warden, 4}`. Check that the fixture's warden ceiling is ≥ 4 (`saves` length 4, per F-P1 of feat-progression).
4. `tests/proofs/feat-slots-journey.test.ts`, legs 3–5 (l.71-87). Rename the test `'legs 3–5 — level up opens a slot; level down is refused; an XP award never lowers the level'`. Replace l.83-86 with: `rt.awardXp(c, 100)` does not throw; `c.state.xp` is 100; `c.state.classes` is `[{warden, 3}]`; `c.state.feats` is unchanged.

**Behaviour pins checked at plan time** (all hold, no edit): `progression.test.ts` l.34-41 (race-cap clamp: direct 2, XP level 3, cap 2 → 2); l.53-70, l.113-126, l.140-152 (level-1 starts); `tests/snapshots/character.test.ts` l.60-80 (warden 3 + 2750 → 3; hexer 2 cap 2).

**Commit when:** `pnpm typecheck` exits 0, and `pnpm exec vitest run tests/runtime/progression.test.ts tests/proofs/feat-slots-journey.test.ts tests/snapshots/character.test.ts tests/runtime/feats.test.ts` is green.

### Checkpoint 2 — symmetric restricts out of combat (CAP-R2, CA-R1)

1. `conditions.ts` `isRestricted` (l.186-204): a spell is blocked by either pattern kind; an action only by `actions.tagged:`:
   ```ts
   for (const pattern of …restricts ?? []) {
     if (matchesRestriction(pattern, 'action', tags, declared)) return true;
     if (kind === 'spell' && matchesRestriction(pattern, 'spell', tags, declared)) return true;
   }
   ```
   `tags` keep their kind-specific lookup (action tags for `'action'`, spell tags for `'spell'`). Do not change `matchesRestriction`, `declaredTags` or `isLivePattern`. `restrictedIds` follows automatically.
2. Docs: the module header l.15-16 becomes "While the condition is active, an action is blocked iff its `tags` include an `actions.tagged:` tag; a spell is blocked by an `actions.tagged:` **or** `spells.tagged:` tag — in and out of combat (v1.9, DD-R3; a spell is an action, FR-9)". Update `isRestricted`'s JSDoc to match.
3. `tests/runtime/combat/spells.test.ts` l.408-413. Rename to `'out of combat a spell follows the in-combat rule: the fixture hexbound (actions.tagged:casting) restricts it (v1.9, DD-R3)'` and change `.toBe(false)` to `.toBe(true)`. The fixture `packs.ts` l.159 hexbound restricts `actions.tagged:casting`. Also assert `isRestricted(rt, state, 'action', 'hex-rite')` is `true` when `hex-rite` carries `casting`. Check its tags in `packs.ts` first; if it is not tagged `casting`, drop that extra assertion.
4. `tests/runtime/conditions.test.ts`. Add `'an actions.tagged: pattern also restricts a spell carrying the tag, out of combat (v1.9, DD-R3)'`. On `cloneRuntimePack()`, add a test-setup condition `silenced: { name: 'Silenced', duration: 2, stacking: 'refresh', restricts: ['actions.tagged:casting'] }` (tag `casting` is declared on the fixture spells, per l.40-41). Apply it to a hexer. Expect `isRestricted(…, 'spell', 'grave-light')` and `'hex-bolt'` to be `true`, `restrictedIds(…, 'spell')` to equal the fixture's casting-tagged spells in pack order, and `isRestricted(…, 'action', 'strike')` to be `false`. The existing l.36-44 case (`spells.tagged:` restricts no action) must stay green unchanged.

**Commit when:** `pnpm typecheck` 0; `pnpm exec vitest run tests/runtime/conditions.test.ts tests/runtime/combat` green.

### Checkpoint 3 — healing spells + the journey (CAP-R1, CA-R4; journey legs for CAP-R2/R3)

1. In each theme JSON, change only the `effect` value of `bind-the-bite` (zombie-urban l.198), `bind-wound` (dark-fantasy l.273) and `bind-wound` (wyldwood l.418) to `"heal(1d8 + ability(vigor))"`. Name, cost, targeting, tags and lists are unchanged. Planner probed this at plan time: with the new line, each seed-42 generated pack constructs `new Runtime(pack)` cleanly.
2. `character-profile.test.ts` l.381: comment only, `` `med-kit` = heal(2 + vigor) `` → `` `med-kit` = heal(2 + ability(vigor)) ``.
3. Create `tests/proofs/rulings-journey.test.ts`. Import from `src/` (as `self-target-journey.test.ts` does; no `dist/` needed), on `generateCampaign({ theme: loadTheme(id), seed: 42 })`, a fresh `Runtime` per leg and a seeded `Rng`. Reuse that file's harness shape (hero acts first via `initiativeBonus` +100, foes −100). Legs:
   - **Leg 1 — zombie-urban `bind-the-bite`.** A level-1 `medic` (it knows the spell; `spell-lists.test.ts` l.50) and a level-1 ally `scavenger` start the fight wounded: restate the ally's profile with `hp` = its `maxHp` − 10, keeping `maxHp`. Use one statblock foe. The medic declares `bind-the-bite` with `{ targetId: <ally> }`. Assert:
     - `spell:cast` precedes one `damage:applied` whose `target` is the ally;
     - `amount` is negative and equals −(the heal roll's dice total + the **medic's** `vigor` ability) (CA-R4);
     - the ally's `hp` payload reads `before→after` with `after = min(maxHp, before − amount)`;
     - the foe's hp is unchanged;
     - the medic's `adrenaline` dropped by 4.
   - **Leg 2 — dark-fantasy `bind-wound` (vancian).** A level-1 `warden` uses `prepareSpell` to bind `bind-wound` into a level-1 slot, then heals a wounded ally `warden`. Assert the same as leg 1, plus `slotCast`/`slotsCast` recording the slot and nothing spent from a pool.
   - **Leg 3 — wyldwood `bind-wound` (`motes` pool).** As leg 1, with the `motes` cost of 2.
   - **Leg 4 — the cap.** An unwounded ally healed by any of the three stays at `maxHp` (the `damage:applied` payload reads `maxHp→maxHp`).
   - **Leg 5 — symmetric restricts on a generated pack (CAP-R2).** Take the dark-fantasy pack and add a test-setup condition `silenced` restricting `actions.tagged:casting` (pack data added at setup: rules-are-data, zero engine diff). Out of combat, after `applyCondition(rt, warden.state, 'silenced')`:
     - `isRestricted(rt, state, 'spell', 'bind-wound')` is `true`;
     - `restrictedIds(rt, state, 'spell')` contains every spell tagged `casting`;
     - `isRestricted(rt, state, 'action', 'strike')` is `false`.

     In combat, with the same condition on the warden's combatant, `fight.declare('bind-wound', …)` is one `declare:rejected` (`kind 'restricted'`) and nothing is spent. **Same answer in and out of combat.**
   - **Leg 6 — XP never lowers on a generated pack (CAP-R3).** On dark-fantasy, take a `hillfolk` warden set directly to level 3 (warden cap 10; `tables.xp`: level 3 from 3000, level 4 from 6000). It learns 2 feats (`featSlots[2]` = 2).
     - `rt.awardXp(c, 100)` → events `[xp:awarded]` only; level 3; feats unchanged.
     - `rt.awardXp(c, 5900)` (classXp 6000) → `level:reached {warden, 4}`; level 4.
4. **Negative control (report it, do not commit it).** Temporarily revert each source change, one at a time: the `Math.max` (leg 6 and the ck1 tests must fail), the `isRestricted` change (leg 5's out-of-combat assertions must fail) and one theme line (its heal leg must fail). Restore each before committing. Report which assertions failed.

**Commit when:** `pnpm typecheck` 0; `pnpm exec vitest run tests/proofs/rulings-journey.test.ts tests/compiler tests/runtime tests/proofs/self-target-journey.test.ts tests/proofs/feat-slots-journey.test.ts` green.

### Checkpoint 4 — README + whole-repo gates (CAP-R4 and doc pins)

`README.md`, prose or ```text only. `tests/proofs/docs-run.test.ts` l.49 pins **exactly 4** ```ts blocks, and l.234 needs `learnFeat` to stay. Do not add a ```ts block.
1. **Spells section (after the *Targeting* bullet, l.334-336):** add a *Healing spells* bullet:
   > zombie-urban `bind-the-bite` and the `warden`'s `bind-wound` in dark-fantasy and wyldwood heal: `heal(1d8 + ability(vigor))`, read from the caster's vigor ability, never above the target's `maxHp`. Name the ally (`{ targetId }`); a spell declared with no target picks the only opponent.
2. **Restricts:** after the gate-order paragraph (l.325-333), add one sentence:
   > Out of combat, `isRestricted(rt, state, 'spell', id)` and `restrictedIds` apply the same rule as a combat declare: a spell is blocked by `actions.tagged:` or `spells.tagged:` (an action only by `actions.tagged:`).
3. **Feat slots bullet (l.349-353):** keep `awardXp` in the list of refusers. Append:
   > An XP award never lowers a level: a character set directly to level 3 keeps level 3 until its XP reaches level 4.
4. **l.385-386:** after "a pack that declares no `featSlots` leaves feats uncapped …", add:
   > Once any class declares `featSlots`, a class that declares none grants 0 — including a class only statblocks use, since the pack has no player/monster class distinction. Slot every class a character may take.
5. **Doc-pin audit.** Grep README for `mending`, `bind-wound`, `bind-the-bite`, `kind`, `lower` and `out of combat`. Fix any other sentence these changes make false, inside this lease, and report each hit.

**Commit when** (whole-repo gates, in this order; record each result):
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` → 0. **Hazard:** ESLint also lints `.program/tmp/*.mjs`, so keep no scratch `.mjs` there.
- `pnpm build` → 0.
- `pnpm test` → all green (baseline 49 files / 911 before this feature).
- `pnpm check:isolation` and `pnpm check:security` → 0.

## Verification

Commands and hazards: STATE.md *Verification Baseline*. Run the lease-scoped gate as `pnpm exec vitest run <paths>`; never `pnpm test -- <pattern>` and never bare `npx`. Run `pnpm build` before a whole `pnpm test`, because three journeys read `dist/`.

| Proof | Path / invocation | Asserts | CAP / CA | ck |
|---|---|---|---|---|
| XP never lowers | `pnpm exec vitest run tests/runtime/progression.test.ts` | ck1 items 3a–3c | CAP-R3 / CA-R2 | 1 |
| guard (c) kept | same file, edited-state test | `feat-slots-exceeded`; nothing changes | CA-R2 | 1 |
| symmetric restricts (unit) | `pnpm exec vitest run tests/runtime/conditions.test.ts tests/runtime/combat/spells.test.ts` | ck2 items 3–4 | CAP-R2 / CA-R1 | 2 |
| heal journey + legs 5–6 | `pnpm exec vitest run tests/proofs/rulings-journey.test.ts` | legs 1–6; real generated packs, real `Runtime`, real combat executor; only the Rng is seeded | CAP-R1/R2/R3 / CA-R1, R2, R4 | 3 |
| whole repo | ck4 gate list | — | all | 4 |

No external provider, port, vendor binary or exclusive resource is involved. The proofs run in-process, in about 3 s.

## State Update

Report:
- commit SHAs per checkpoint;
- the ck0 recheck result by CA id;
- the negative-control results;
- the doc-pin audit hits and their dispositions;
- any deviation, as R1–R4 with its paths;
- the arch-fragment notes for Orchestrator: `awardXp` level rule; `isRestricted` spell-kind rule; theme heal content; that the F-FP1/F-P3 and restricts-asymmetry lines in `arch/v1-core.md` retire; that cleanup C14 closes.
