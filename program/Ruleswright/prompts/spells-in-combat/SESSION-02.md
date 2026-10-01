# SESSION-02 — The spell column: declare spells, range + empty-cell bursts, spend + snapshot, settlement, generated spells, spell journey

> **Program:** Ruleswright
> **Feature:** spells-in-combat
> **Modules:** M01 (`targeting.range` mirror + validator), M02 (executor `varsFor`), M03, M04 (theme content only)
> **Depends on:** SESSION-01 (FR-9/FR-11 criteria, contract v1.6 and database.md landed; CA-S1 … CA-S5 and CA-S9 rechecked against them by Orchestrator)
> **Concurrent with:** —
> **Owns:** `src/schema/artifacts.ts`, `src/schema/validate/sections/content.ts`, `src/core/dsl/effect.ts`, `src/runtime/combat/combat.ts`, `src/runtime/combat/action-economy.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/character-profile.ts`, `src/runtime/pools.ts`, `src/runtime/snapshots.ts`, `src/runtime/index.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `tests/schema/validate.test.ts`, `tests/core/dsl/effect.test.ts`, `tests/runtime/combat/spells.test.ts`, `tests/runtime/combat/combat-spatial.test.ts`, `tests/runtime/combat/character-profile.test.ts`, `tests/runtime/fixtures/packs.ts`, `tests/snapshots/combat.test.ts`, `tests/proofs/grid-journey.test.ts`, `tests/proofs/rules-are-data.test.ts`, `tests/proofs/spells-journey.test.ts`
> **Reads:** `program/Ruleswright/specs/requirements.md` (FR-9, FR-11), `program/Ruleswright/specs/database.md` (v1.6), `src/schema/contracts/pack.schema.json`, `src/schema/contracts/snapshots.schema.json`, `src/runtime/runtime.ts`, `src/runtime/conditions.ts`, `src/runtime/character.ts`, `src/runtime/equipment.ts`, `src/runtime/combat/spatial.ts`, `src/runtime/combat/triggers.ts`, `tests/proofs/equipment-journey.test.ts` (the dist-journey idiom), `program/Ruleswright/prompts/spells-in-combat/STATE.md`
> **Resources:** —
> **Checkpoints:** 5

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M01 | Schema | `artifacts.ts` (`SpellTargeting` l.48–55), `validate/sections/content.ts` (`checkTargeting` l.497–530) | `targeting.range` mirror and validator |
| M02 | Core | `dsl/effect.ts` (`EffectApply` l.67–75, `execAttack` l.250–275, `execSave` l.279–307, `execTarget` l.383–393) | per-target defender values (DD-S19) |
| M03 | Runtime | `combat/combat.ts` (`declare` l.515–604, `restrictionRejection` l.732, `resolveTarget` l.759, `spatialGate` l.808, `resolveShape` l.1064, `reachOf` l.1099, `applyNonSlotCosts` l.1105, `resolve` l.1119, `execute` l.1144, `boundActionOf` l.1291, `profileOf` l.1301, `ruleBaseOf` l.1318), `combat/spatial.ts` (`SpatialGeometry.distance` l.45), `combat/action-economy.ts` (`EconomyBalances` l.91, `checkCost` l.108), `combat/resolve.ts` (`CombatantProfile`, `parsePackEffects` l.115, `executeAgainst`, `effectVars`), `character-profile.ts` (all), `pools.ts` (`prepareSpell`, `armorBlockingCast` l.208, `castSpell` l.230, `knownSpells`), `snapshots.ts` (l.410–632, refusals l.633–800), `runtime.ts` (`PackIndex.spellEffects`) | The whole spell path |
| M04 | Compiler content | `themes/*.json` `content.spells` | DD-S9 turn cost; DD-S8(b) range |

## Context

`Combat.declare` resolves only `pack.actions` (`combat.ts:521`). A spell in
`pack.content.spells` therefore cannot be cast in a fight, and the grid-combat journey
works around this by copying the spell into a test-only action
(`grid-journey.test.ts:82-92`, DD17a). This session makes a spell declarable through the
same pipeline, **within its pack-declared range**, and lets a **burst spell be centered on
an empty cell** (human answer, 2026-09-30, DD-S8). It records the spend so that it
survives a snapshot, adds the host settlement verb, gives the sample spells a turn cost
and a range, and proves the whole path on the generated pack through `dist/`.

An empty-cell blast has no primary target, and today the executor rolls every burst
target's save with the **primary target's** save value (`effect.ts:292-296`, `resolve.ts`
`effectVars`). DD-S19 fixes that with one optional executor hook; it is part of this
column, not a separate change.

**Already in place, so do not rebuild it:**
- `runtime.index.spellEffects` holds every spell's parse-once AST;
- `runtime.spatial.distance` (grid Chebyshev, hex axial; theater returns 0);
- `checkCost` already handles `vancian`/`points` against `EconomyBalances`;
- `knownSpells` and `prepareSpell` exist;
- `E-DUP-01` guarantees that action, spell and feat ids never collide.

## Capabilities

This session is the integration owner of **CAP-S1** (ck3), **CAP-S9** (ck2 unit, ck5
journey), **CAP-S2** and **CAP-S3** (ck4), and **CAP-S4**, the first narrow journey (ck5).
Its proof is the base S03's feat leg extends.

**Required inputs and their origins:**
- known spells: `pools.ts` `knownSpells` (landed);
- bindings: `CharacterState.slots` (landed);
- armor: `pools.ts` `armorBlockingCast` (landed but private; exported at ck3);
- spell AST: `PackIndex.spellEffects` (landed);
- range: `targeting.range` in the v1.6 contract (S01); mirrored and validated here (ck2);
- distance: `SpatialGeometry.distance` (landed);
- the spend fields: v1.6 contract (S01).

## Contract Agreements

CA-S1, CA-S2, CA-S3, CA-S4 (spell half), CA-S5 and CA-S9. **Use the mappings in STATE.md
as amended at the S01 receive.** If the landed database.md differs from STATE,
database.md wins: report the difference.

**Checkpoint-0 recheck (read, do not rediscover):**
- `combat.ts:521` is `const def = pack.actions[actionId];`;
- `combat.ts:737` matches only `actions.tagged:`;
- `snapshots.ts:559-560` rebuild `pools`/`boundSlots` from re-stated balances;
- `resolve.ts:115` `parsePackEffects` has zero references outside its definition
  (`grep -rn parsePackEffects src tests`);
- `pools.ts:208` `armorBlockingCast` is not exported;
- `content.ts:514` `checkTargeting` forbids every key but `shape`/`radius`;
- `effect.ts` `execSave` rolls with `ctx.vars` for every scoped target, and `execAttack`
  evaluates the defense once from `ctx.vars`;
- the landed `pack.schema.json` spells `targeting.range` is `{integer, minimum 0}`.

Report any mismatch before changing code.

## Files to Create/Modify

| File | Action | What Changes |
|------|--------|--------------|
| `src/schema/artifacts.ts` | modify | `SpellTargeting.range?: number` |
| `src/schema/validate/sections/content.ts` | modify | `checkTargeting` admits `range` (integer ≥ 0, else `E-SCHEMA-01`) |
| `src/core/dsl/effect.ts` | modify | optional `EffectApply.varsFor`; per-target save/defense values (DD-S19) |
| `src/runtime/combat/resolve.ts` | modify | `CombatantProfile.spells?`, `castBlockedBy?`; `executeAgainst` `profileFor` → `varsFor`; delete `parsePackEffects` |
| `src/runtime/combat/action-economy.ts` | modify | `EconomyBalances.bindings?`; `CostRejection` unchanged |
| `src/runtime/combat/combat.ts` | modify | `CombatantState` spell fields; spell lookup, membership, target rule, `at`, range gate, `resolveShape(center)`, armor gate, binding pick, spend recording, `spell:cast`, rule base; restricts for spells; `DeclareOptions.at`; `DeclareRejection` kinds `armor-not-castable`, `out-of-range` |
| `src/runtime/pools.ts` | modify | export `armorBlockingCast` (unchanged body) |
| `src/runtime/character-profile.ts` | modify | profile `spells`/`castBlockedBy`, balances `bindings`; `settleSpellCasts` |
| `src/runtime/snapshots.ts` | modify | `SnapshotCombatant.poolsSpent/slotsCast`; serialize; restore = re-stated − spend; refusals |
| `src/runtime/index.ts` | modify | export `settleSpellCasts`, `armorBlockingCast` |
| `src/compiler/themes/{dark-fantasy,zombie-urban,wyldwood}.json` | modify | every spell cost gains `"slots": { "main": 1 }` (DD-S9); every spell gains `targeting.range: 6` (DD-S8 b) |
| `tests/schema/validate.test.ts` | modify | `range` accepted; non-integer / negative refused |
| `tests/core/dsl/effect.test.ts` | modify | `varsFor` per-target save and defense; absent `varsFor` unchanged |
| `tests/runtime/combat/spells.test.ts` | create | unit proofs for CAP-S1, S2, S3, S9 on `emberMarchesPack()` |
| `tests/runtime/combat/combat-spatial.test.ts` | modify | re-key the burst save pins for per-target values (DD-S19) |
| `tests/runtime/fixtures/packs.ts` | modify (only if needed) | e.g. a ranged spell, a spell with `cost.points`, a leather item; extend, never change existing values |
| `tests/runtime/combat/character-profile.test.ts` | modify | new assertions (`spells`, `castBlockedBy`, `bindings`); re-key the l.313–330 pin only if red |
| `tests/snapshots/combat.test.ts` | modify | spend round-trip and refusals |
| `tests/proofs/grid-journey.test.ts` | modify | ck2: re-key burst save pins; ck5: cast the real `ember-bloom`, delete `packWithBurstAction`, `main` 1 → 0 |
| `tests/proofs/rules-are-data.test.ts` | modify | proof 3 gains a combat leg |
| `tests/proofs/spells-journey.test.ts` | create | CAP-S4 through `dist/`, including an empty-cell blast |

## Implementation

### Checkpoint 1 — A spell is declarable (combat core)

1. **`resolve.ts` — `CombatantProfile`:** add
   ```ts
   /** v1.6 — spell ids this combatant may declare (characters: knownSpells; absent = none, DD-S2/S4). */
   readonly spells?: readonly string[];
   /** v1.6 — the equipped armor item that blocks vancian casting (CA-EG3); absent = not blocked (DD-S6). */
   readonly castBlockedBy?: string;
   ```
   Delete `parsePackEffects` (l.115–147) and any import it alone used (DD-S15).
2. **`action-economy.ts` — `EconomyBalances`:** add
   `readonly bindings?: Readonly<Record<string, readonly (string | null)[]>>;`, with a doc
   comment saying it is the character's `slots` at fight start (FR-8) and is needed for
   spell casts.
3. **`combat.ts` — `CombatantState`:** add
   - `readonly spells: readonly string[]`;
   - `readonly bindings?: Readonly<Record<string, readonly (string | null)[]>>`;
   - `slotsCast: Record<string, number[]>`;
   - `poolsSpent: Record<string, number>`;
   - `readonly castBlockedBy?: string`.

   `startCombat` fills them from the profile and balances (deep-copy the bindings; the
   spend fields start as `{}`). Emit `bindings` and `castBlockedBy` only when present,
   so serialized fights without them stay byte-identical.
4. **`declare`:**
   - Resolve `def` from `pack.actions[actionId]`, else from the spell, as
     `{cost: spell.cost, effect: spell.effect, tags: spell.tags}`, with
     `isSpell = true`.
   - Membership: an action uses `actor.actions` (unchanged); a spell uses
     `actor.spells`, else `no-action` with the message
     `combatant "<id>" does not know spell "<spellId>".`
   - Then apply CA-S1's gate order. At this checkpoint a spell still passes the existing
     `spatialGate` (ck2 replaces it with the range gate). For a spell:
     - `resolveTarget` permits any combatant in the fight when `targetId` is given
       (DD-S8). Add a parameter; do not fork the function.
     - The validity gate is skipped (spells have no `valid`).
     - After the spatial gate: the armor gate, when `cost.vancian !== undefined &&
       actor.castBlockedBy !== undefined`.
     - After `checkCost`: the binding pick (DD-S18). A failed pick is one
       `declare:rejected`, with nothing spent.
   - Keep the order "check everything, then commit": the binding index is chosen before
     `spend` and recorded after it.
5. **`applyNonSlotCosts`** gains the recording:
   - `poolsSpent[pool] += amount`;
   - the chosen index is pushed to `slotsCast[L]`.

   It also handles vancian **actions** (DD-S18), where the index is chosen inside the
   function when the caller passes none. Live `pools`/`boundSlots` decrement exactly as
   today.
6. **`resolve` / `boundActionOf` / `ruleBaseOf`:**
   - a spell's bound action is `{id, def, ast: index.spellEffects[id]}`;
   - its rule base is `content.spells.<id>`;
   - emit `spell:cast` (DD-S17 payload) **before** `execute`, inside the same per-call
     collection, so `surfaceOffers` sees it;
   - `action:resolved` keeps `{actionId, targetId}`.
7. **`restrictionRejection(actor, def, kind)`:** for a spell, read both
   `actions.tagged:` and `spells.tagged:` patterns (DD-S10). For an action, the behavior
   is unchanged.
8. **`DeclareRejection`:** add
   `{kind: 'armor-not-castable'; rule: 'E-REF-01'; resource: string; message: string}`.
9. **`tests/runtime/combat/spells.test.ts`** (hand-built profiles on
   `emberMarchesPack()`; it already has the hexer list, `grave-light` L1, `ember-bloom`
   L2, and `hexbound` restricting `actions.tagged:casting`):
   - **Success:** the event order is `spell:cast` → `damage:applied`/`condition:applied`
     → `action:resolved`. `why.rule` is `content.spells.grave-light`. `slotsCast['1']`
     is `[0]`, `boundSlots['1']` drops by 1, and `slots.remaining.main` is unchanged
     (that fixture spell has no slot cost).
   - **Binding pick:**
     - `bindings {'1': ['other', 'grave-light']}` → index 1;
     - a second cast is rejected `vancian`/`E-VANC-01`;
     - a count-only combatant (no `bindings`) casting a vancian *spell* is rejected;
     - a vancian *action* on a count-only combatant consumes index 0.
   - **Rejections, each one `declare:rejected` with `serialize()` unchanged:**
     - not in `spells` → `no-action`;
     - under `hexbound` → `restricted`;
     - `castBlockedBy` set, vancian → `armor-not-castable`;
     - `castBlockedBy` set, points spell → succeeds;
     - a pool short → `points`/`E-POINTS-01`;
     - a statblock profile → `no-action`.
   - **Targets:** an ally `targetId` succeeds for a spell; the same `targetId` on an
     action is still `invalid-target`.

**Commit when:**
- `pnpm typecheck` 0;
- `pnpm exec vitest run tests/runtime` green (the existing combat suites stay green
  unchanged);
- `pnpm exec prettier --check <changed files>` 0.

### Checkpoint 2 — Range and area targeting (CAP-S9, DD-S8, DD-S19)

1. **M01 mirror + validator (CA-S9 contract leg):**
   - `artifacts.ts` `SpellTargeting`: add
     `/** v1.6 — max distance to the target or area center (pack spatial distance); absent = caster reach (DD-S8). */ range?: number;`
   - `content.ts` `checkTargeting`: add `'range'` to the `forbidUnknown` list (l.514);
     a present `range` that is not an integer ≥ 0 is `E-SCHEMA-01` at
     `<base>.targeting.range`, message `targeting.range must be an integer >= 0.`
     Update the l.509 shape message to `{shape, radius?, range?}`.
   - `tests/schema/validate.test.ts`: `range: 0` and `range: 6` load clean; `range: -1`,
     `range: 1.5` and `range: "6"` each give exactly one `E-SCHEMA-01` at that path;
     re-key any existing assertion that pinned the closed `targeting` key set.
2. **M02 executor hook (DD-S19):**
   - `EffectApply` gains
     ```ts
     /** v1.6 — per-target vars for statements inside a shape scope (FR-9 per-target saves). Absent = ctx.vars for every target. */
     varsFor?(target: EffectTargetRef): Readonly<Record<string, number>>;
     ```
   - `execSave`: roll each scoped target's save with
     `ctx.apply.varsFor?.(target) ?? ctx.vars`. The DC stays `ctx.vars`.
   - `execAttack`: evaluate the defense formula per scoped target with the same
     expression; the bonus stays `ctx.vars`.
   - `tests/core/dsl/effect.test.ts`: two scoped targets with different save values roll
     against their own value; two with different `ac` get their own defense; without
     `varsFor` every existing executor assertion is unchanged.
3. **`resolve.ts`:** `executeAgainst` gains an optional trailing
   `profileFor?: (id: string) => CombatantProfile | undefined` and supplies
   `varsFor: (ref) => { const p = profileFor?.(ref.id); return p === undefined ? vars : effectVars(actor.profile, p); }`.
   Keep the parameter order of the existing arguments (the `move` callback stays where it
   is).
4. **`combat.ts`:**
   - `DeclareOptions` gains `readonly at?: Position` (doc: "v1.6 — a burst spell's area
     center; may be an empty cell (DD-S8). Spatial packs only; theater packs ignore it.").
   - `DeclareRejection` gains `{kind: 'out-of-range'; rule: 'E-SPAT-01'; resource: string;
     message: string}`.
   - **`at` legality** (spells only, spatial packs only, before target resolution):
     `at` + `targetId` → `invalid-target`; `at` on an action → `invalid-target`; the
     spell's `targeting?.shape !== 'burst'` → `invalid-target`; the AST root is not a
     `target` call whose first argument starts with `burst-` → `invalid-target`. All are
     `E-REF-01`, with messages naming the reason. In a theater pack `at` is dropped and
     the declare proceeds as if it were absent.
   - **Range gate** (spells, spatial packs, replaces `spatialGate` for spells):
     `range = spell.targeting?.range ?? this.reachOf(actor.id) ?? spatial.reach.default`;
     `center = at ?? target.position`; when `distance(actor.position, center) > range`
     → `out-of-range`, resource `targetId` or `"x,y"`, message
     `spell "<id>" has range <r>; <targetId | (x,y)> is <d> away.` Actions keep
     `spatialGate` untouched.
   - **`resolveShape(shape, actor, center, bound)`:** `burst-N` resolves around `center`
     (the bound target's position, or `at`); `adjacent` and the theater branch are
     unchanged. Update the three callers (validity gate, `execute`'s shape callback, and
     any other) to pass the bound target's position as the center.
   - **An `at` cast:** binds the caster as the nominal executor target, passes `at` as the
     center, and passes `id => this.profileOf(this.state.combatants[id]!)` as
     `profileFor`. Every cast and action passes `profileFor` too (so DD-S19 applies to all
     bursts). `spell:cast` and `action:resolved` carry `at` instead of `targetId`
     (DD-S17). A blast that resolves zero combatants is a success: the cost is spent and
     there are no effect events.
5. **Pin re-keys (owned here):** the burst tests in
   `tests/runtime/combat/combat-spatial.test.ts` (l.294–362) and
   `tests/proofs/grid-journey.test.ts` (l.342–410) pin save totals and branches computed
   from the primary target's save. Recompute each expected value from the **target's own**
   save value, keep the dice scripts unchanged where possible, and keep every
   non-save assertion byte-exact. Record each changed expectation in the handoff.
6. **`spells.test.ts` — CAP-S9** (on `emberMarchesSpatialPack()`; extend
   `tests/runtime/fixtures/packs.ts` with a ranged variant only if needed):
   - a spell with `range: 3` at distance 3 succeeds; at distance 4 it is one
     `declare:rejected {kind: 'out-of-range', rule: 'E-SPAT-01'}` with `serialize()`
     unchanged;
   - no `range` → the caster's reach applies (reach-1 caster: distance 2 is
     `out-of-range`);
   - `ember-bloom` with `{ at }` on an empty cell: exactly the standing combatants within
     radius 2 of the cell, both sides, take per-target saves, each against its own save
     value (scripted dice); the out-of-radius combatant is untouched; `spell:cast` and
     `action:resolved` carry `at`;
   - a blast that catches nobody: the bound slot and `main` are spent, no
     `damage:applied`/`condition:applied`;
   - each `at` refusal (`at` + `targetId`, single spell, action, non-`target` root via a
     fixture burst spell) is one `invalid-target` with no change;
   - an `at` beyond range is `out-of-range` with resource `"x,y"`;
   - **theater-of-mind** (`emberMarchesPack()`): any distance passes, and `at` is ignored.

**Commit when:**
- `pnpm typecheck` 0;
- `pnpm exec vitest run tests/schema tests/core tests/runtime tests/proofs/grid-journey.test.ts`
  green;
- prettier is clean on the changed files.

### Checkpoint 3 — The character bridge (CAP-S1 integrated)

1. **`pools.ts`:** `export function armorBlockingCast` (body unchanged).
2. **`character-profile.ts` `profileFromCharacter`:**
   - `spells: knownSpells(runtime, state)`, only when non-empty;
   - `castBlockedBy: armorBlockingCast(runtime, state)`, only when defined;
   - `balances.bindings`: a deep copy of `state.slots`.

   `boundSlots` is unchanged. Update the doc comment.
3. **`index.ts`:** export `armorBlockingCast`. `settleSpellCasts` comes at ck4.
4. **Tests:**
   - `character-profile.test.ts`:
     - a hexer's `profile.spells` equals `knownSpells`;
     - after `prepareSpell`, `balances.bindings['2']` holds the spell;
     - a warded-mail hexer has `castBlockedBy: 'warded-mail'` (dark-fantasy, where the
       hexer's `armorCasting` is `['leather']`);
     - re-key the l.313–330 whole-profile pin only if it goes red.
   - `spells.test.ts`: a **src integration** case:
     `rt.createCharacter` (hexer) → `character.prepare('grave-light')` →
     `profileFromCharacter` → `startCombat` → `declare('grave-light', {targetId})`
     succeeds. A character that never prepared it is rejected `vancian`.

**Commit when:**
- `pnpm typecheck` 0;
- `pnpm exec vitest run tests/runtime tests/proofs/grid-journey.test.ts
  tests/proofs/equipment-journey.test.ts` green (run `pnpm build` first for the
  equipment journey);
- prettier is clean.

### Checkpoint 4 — Spend survives snapshots; settlement (CAP-S2, CAP-S3)

1. **`snapshots.ts`:**
   - `SnapshotCombatant` gains `poolsSpent?` and `slotsCast?`, emitted only when
     non-empty.
   - `deserializeCombat`:
     - `pools = restated − poolsSpent`;
     - `boundSlots[L] = restated[L] − |slotsCast[L]|`;
     - `bindings` from the re-stated balances;
     - `spells`/`castBlockedBy` from the re-stated profile;
     - spends copied.
   - Add the CA-S2 refusals to `combatRestoreRefusals`: all cards before any rebuild,
     `E-SNAP-01`, jsonPath `combatants[<i>].poolsSpent.<p>` / `combatants[<i>].slotsCast.<L>[<k>]`.
2. **`character-profile.ts`:** `settleSpellCasts(runtime, character, fight,
   combatantId?)`, exactly CA-S3: the precondition and refusal names, all refusals
   before change, the event payloads, clearing the spend. Document the same v1 limits
   as `settleItemUses` (abandoned fights; per-object idempotence).
3. **`index.ts`:** export `settleSpellCasts`.
4. **Tests:**
   - `tests/snapshots/combat.test.ts`:
     - **round-trip:** cast mid-fight → serialize → JSON text → restore with the
       **fight-start** balances. Pools, `boundSlots` and spends equal the live fight,
       a second cast of the same binding is rejected, and the next roll equals the
       uninterrupted fight's;
     - each CA-S2 refusal, one test each;
     - an envelope without the new fields restores exactly as v1.5.
   - `spells.test.ts` settlement:
     - pools and slots written;
     - the character snapshot round-trip keeps them;
     - a second settle returns `[]`;
     - `combat-not-over`;
     - `slot-mismatch` after the character re-binds that slot mid-fight;
     - `insufficient-points`;
     - each refusal leaves the character unchanged (`structuredClone` compare).

**Commit when:**
- `pnpm typecheck` 0;
- `pnpm exec vitest run tests/runtime tests/snapshots` green;
- prettier is clean.

### Checkpoint 5 — Generated spells cost a turn and declare a range; the journey (CAP-S4)

1. **Themes (DD-S9, DD-S8 b):** in each of the three themes, for every
   `content.spells.<id>`:
   - add `"slots": { "main": 1 }` to `cost`, keeping the existing keys;
   - a spell with a `targeting` block gains `"range": 6` inside it (shape and radius
     unchanged); a spell without one gains `"targeting": { "shape": "single", "range": 6 }`.

   Do it mechanically (a one-off script outside the lease, deleted before commit, or
   careful edits) and preserve each file's formatting. Then confirm with a one-liner that
   every spell cost has `slots.main === 1` and every spell has `targeting.range === 6`
   (47 spells: dark-fantasy 33, zombie-urban 4, wyldwood 10 at `55b294f`).
2. **`grid-journey.test.ts`:**
   - delete `packWithBurstAction` and its DD17a header paragraph (l.23–31);
   - the burst and vancian-gate tests load `darkFantasyPack()` directly and declare the
     real `ember-bloom`. The caster's spells come from `profileFromCharacter` (`hexer`
     knows `ember-bloom`, as the existing guard at l.145 checks), so `extraAction` is no
     longer needed for spells;
   - the assertion at l.409 becomes `main` **0**, because the spell now costs main;
   - the positions already put the target within range 6 (hexer (4,2) → wight (4,3));
   - every other assertion as re-keyed at ck2 must hold unchanged. Dice: the spell adds
     no roll before the save.
3. **`rules-are-data.test.ts` proof 3:** append a combat leg on the same mutated pack:
   prepare `wither-light` → `profileFromCharacter` → `startCombat` →
   `declare('wither-light', {targetId})` → `spell:cast` with
   `why.rule === 'content.spells.wither-light'`. The baseline pack has no such spell, so
   the declare is `no-action`. The engine still has zero diffs inside the proof.
4. **`tests/proofs/spells-journey.test.ts`** (new; the dist idiom of
   `equipment-journey.test.ts`: import from `../../dist/runtime.js` and
   `../../dist/compiler.js`):
   - **Freshness:** `typeof runtimeDist.settleSpellCasts === 'function'`, and the
     generated dark-fantasy `ember-bloom` has cost `{ vancian: 2, slots: { main: 1 } }`
     and `targeting` `{ shape: 'burst', radius: 2, range: 6 }`.
   - **Vancian leg** (dark-fantasy seed 42, grid, positions as in grid-journey's burst
     test):
     1. a level-3 hexer prepares `ember-bloom` **twice** if its level-2 slots allow it
        (assert the slot count from the generated progression at ck0; with one slot, the
        empty-cell blast in step 5 runs in a second fight instead);
     2. `profileFromCharacter`;
     3. `startCombat` with a `barrow-wight` adjacent to the target;
     4. `declare('ember-bloom', {targetId})`, which emits `spell:cast {slotLevel: '2',
        slotIndex: 0}`;
     5. **empty-cell blast:** on the hexer's next turn, `declare('ember-bloom', { at })` on
        an empty cell within range 6 whose radius 2 covers the wight: the wight is hit,
        `spell:cast` carries `at`; then an `at` 8 steps away is `out-of-range` with
        nothing changed;
     6. `serializeCombat` → JSON → `deserializeCombat` with the **same** fight-start
        request; the restored `slotsCast['2']` equals the live fight's, and another
        declare is `vancian`;
     7. drive the fight to `combat-over` with plain `strike`/`hurl` declares and
        `step()`. If it does not end in a bounded loop (≤ 50 steps), set hp via
        restore: build the snapshot with the target's `hp: 0`, a documented harness
        move;
     8. `settleSpellCasts`: the character's cast `slots['2'][i]` become `null`;
     9. `serializeCharacter` → `restoreCharacter` keeps them `null`.
   - **Pool leg** (wyldwood seed 42, hex): a character of a class whose `spellLists`
     include a list a pool spell belongs to. **Pick the class and spell at ck0 from the
     generated pack, and assert that choice in the test.** Cast it within range;
     `poolsSpent` equals the spell's amount; snapshot/restore; settle draws the pool.
   - Dice are not scripted. Assert structure and spend only, plus determinism: two runs
     with the same seed produce `JSON.stringify`-equal event streams.

**Commit when:**
- `pnpm build` then `pnpm test` green: the whole suite, 741 + new;
- `pnpm typecheck`, `pnpm lint` and `pnpm format:check` 0;
- `pnpm check:isolation` and `pnpm check:security` 0.

If a test outside the lease goes red because of the theme cost or range change, stop and
return `blocked`, naming the file and the mechanical fix. Orchestrator applies a
Controlled Lease Revision; do not widen the lease yourself.

## Verification

- **Gates:** the Verification Baseline commands (STATE.md): `pnpm exec vitest run
  <path>` for narrow gates, and `pnpm build` before any whole-suite or `dist` run.
- **CAP-S1 proof:**
  - test paths: `tests/runtime/combat/spells.test.ts` and
    `tests/proofs/spells-journey.test.ts`;
  - entry: `Combat.declare` reached from `profileFromCharacter` + `startCombat`. These
    are the real implementations, with no doubles: the executor, the economy and the
    spatial geometry are all production code;
  - assertions: the event order, the spend deltas, and no change on each rejection.
- **CAP-S9 proof:** `spells.test.ts` (range, `at`, refusals, theater), `effect.test.ts`
  (`varsFor`), `validate.test.ts` (`range`), and the journey's empty-cell leg on the
  generated pack through `dist/`. Real geometry (`gridGeometry`/`hexGeometry`), real
  executor; dice scripted only in the unit tests.
- **CAP-S2 proof:** `tests/snapshots/combat.test.ts` plus the journey's restore step.
  The seed fact is the fight-start request the host re-states, and storage is JSON text.
- **CAP-S3 proof:** `spells.test.ts` settlement plus the journey's settle, then the
  character snapshot round-trip.
- **CAP-S4 artifact identity:** the journey imports `dist/` built by `pnpm build` at the
  checkpoint's tree. The freshness test fails on a stale build. Record the HEAD SHA the
  build ran at in the handoff.
- **Architecture:** the runtime never imports the compiler (`check:isolation`). M02 gains
  only an optional callback type (no runtime import). No new module. `pools.ts` stays
  free of `character-profile` imports.

## State Update

Report:
- the status and per-checkpoint SHAs;
- the landed symbols (`CombatantState` fields, `DeclareOptions.at`, `EffectApply.varsFor`,
  `SpellTargeting.range`, `settleSpellCasts`, the `armorBlockingCast` export, the
  `armor-not-castable` and `out-of-range` kinds);
- every burst pin re-keyed at ck2, old → new value;
- the wyldwood class/spell chosen for the pool leg, and how the empty-cell leg was staged;
- the new test count;
- any CA-S1 … S5 / CA-S9 mapping that changed while you implemented it (exact text);
- surprises.

`followUp` for S03:
- the exact `CombatantState` shape it extends (`feats` comes next);
- the spells-journey file layout, so S03 can append the feat leg;
- whether `resolveTarget`'s new parameter suits the feat target rule;
- the README facts for range and `at` (names, default, refusal kinds).
