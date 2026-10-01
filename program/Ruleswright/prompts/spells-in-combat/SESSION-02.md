# SESSION-02 — The spell column: declare spells, spend + snapshot, settlement, generated spells, spell journey

> **Program:** Ruleswright
> **Feature:** spells-in-combat
> **Modules:** M03, M04 (theme content only)
> **Depends on:** SESSION-01 (contract v1.6 + database.md landed; CA-S1 … CA-S5 rechecked against them by Orchestrator)
> **Concurrent with:** —
> **Owns:** `src/runtime/combat/combat.ts`, `src/runtime/combat/action-economy.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/character-profile.ts`, `src/runtime/pools.ts`, `src/runtime/snapshots.ts`, `src/runtime/index.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `tests/runtime/combat/spells.test.ts`, `tests/runtime/combat/character-profile.test.ts`, `tests/runtime/fixtures/packs.ts`, `tests/snapshots/combat.test.ts`, `tests/proofs/grid-journey.test.ts`, `tests/proofs/rules-are-data.test.ts`, `tests/proofs/spells-journey.test.ts`
> **Reads:** `program/Ruleswright/specs/database.md` (v1.6), `src/schema/contracts/snapshots.schema.json`, `src/runtime/runtime.ts`, `src/runtime/conditions.ts`, `src/runtime/character.ts`, `src/runtime/equipment.ts`, `src/runtime/combat/spatial.ts`, `src/runtime/combat/triggers.ts`, `tests/proofs/equipment-journey.test.ts` (the dist-journey idiom), `program/Ruleswright/prompts/spells-in-combat/STATE.md`
> **Resources:** —
> **Checkpoints:** 4

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M03 | Runtime | `combat/combat.ts` (`declare` l.515–604, `restrictionRejection` l.732, `resolveTarget` l.759, `spatialGate` l.808, `applyNonSlotCosts` l.1105, `resolve` l.1119, `boundActionOf` l.1291, `ruleBaseOf` l.1318), `combat/action-economy.ts` (`EconomyBalances` l.91, `checkCost` l.108), `combat/resolve.ts` (`CombatantProfile`, `parsePackEffects` l.115), `character-profile.ts` (all), `pools.ts` (`prepareSpell` l.~150, `armorBlockingCast` l.208, `castSpell` l.230, `knownSpells`), `snapshots.ts` (l.410–632, refusals l.633–800), `runtime.ts` (`PackIndex.spellEffects`) | The whole spell path |
| M04 | Compiler content | `themes/*.json` `content.spells` | DD-S9 turn cost |

## Context

`Combat.declare` resolves only `pack.actions` (`combat.ts:521`). A spell in
`pack.content.spells` therefore cannot be cast in a fight, and the grid-combat journey
works around this by copying the spell into a test-only action
(`grid-journey.test.ts:82-92`, DD17a). This session makes a spell declarable through the
same pipeline. It records the spend so that it survives a snapshot, adds the host
settlement verb, gives the sample spells a turn cost, and proves the whole path on the
generated pack through `dist/`.

**Already in place, so do not rebuild it:**
- `runtime.index.spellEffects` holds every spell's parse-once AST;
- `checkCost` already handles `vancian`/`points` against `EconomyBalances`;
- `knownSpells` and `prepareSpell` exist;
- `E-DUP-01` guarantees that action, spell and feat ids never collide.

## Capabilities

This session is the integration owner of **CAP-S1** (ck2), **CAP-S2** and **CAP-S3**
(ck3), and **CAP-S4**, the first narrow journey (ck4). Its proof is the base S03's feat
leg extends.

**Required inputs and their origins:**
- known spells: `pools.ts` `knownSpells` (landed);
- bindings: `CharacterState.slots` (landed);
- armor: `pools.ts` `armorBlockingCast` (landed but private; exported at ck2);
- spell AST: `PackIndex.spellEffects` (landed);
- the spend fields: v1.6 contract (S01).

## Contract Agreements

CA-S1, CA-S2, CA-S3, CA-S4 (spell half) and CA-S5. **Use the mappings in STATE.md as
amended at the S01 receive.** If the landed database.md differs from STATE, database.md
wins: report the difference.

**Checkpoint-0 recheck (read, do not rediscover):**
- `combat.ts:521` is `const def = pack.actions[actionId];`;
- `combat.ts:737` matches only `actions.tagged:`;
- `snapshots.ts:559-560` rebuild `pools`/`boundSlots` from re-stated balances;
- `resolve.ts:115` `parsePackEffects` has zero references outside its definition
  (`grep -rn parsePackEffects src tests`);
- `pools.ts:208` `armorBlockingCast` is not exported.

Report any mismatch before changing code.

## Files to Create/Modify

| File | Action | What Changes |
|------|--------|--------------|
| `src/runtime/combat/resolve.ts` | modify | `CombatantProfile.spells?`, `castBlockedBy?`; delete `parsePackEffects` |
| `src/runtime/combat/action-economy.ts` | modify | `EconomyBalances.bindings?`; `CostRejection` unchanged |
| `src/runtime/combat/combat.ts` | modify | `CombatantState` spell fields; spell lookup, membership, target rule, armor gate, binding pick, spend recording, `spell:cast`, rule base; restricts for spells; `DeclareRejection` kind `armor-not-castable` |
| `src/runtime/pools.ts` | modify | export `armorBlockingCast` (unchanged body) |
| `src/runtime/character-profile.ts` | modify | profile `spells`/`castBlockedBy`, balances `bindings`; `settleSpellCasts` |
| `src/runtime/snapshots.ts` | modify | `SnapshotCombatant.poolsSpent/slotsCast`; serialize; restore = re-stated − spend; refusals |
| `src/runtime/index.ts` | modify | export `settleSpellCasts`, `armorBlockingCast` |
| `src/compiler/themes/{dark-fantasy,zombie-urban,wyldwood}.json` | modify | every `content.spells.*.cost` gains `"slots": { "main": 1 }` (DD-S9) |
| `tests/runtime/combat/spells.test.ts` | create | unit proofs for CAP-S1 … S3 on `emberMarchesPack()` |
| `tests/runtime/fixtures/packs.ts` | modify (only if needed) | e.g. a spell with `cost.points`, or a leather item; extend, never change existing values |
| `tests/runtime/combat/character-profile.test.ts` | modify | new assertions (`spells`, `castBlockedBy`, `bindings`); re-key the l.313–330 pin only if red |
| `tests/snapshots/combat.test.ts` | modify | spend round-trip and refusals |
| `tests/proofs/grid-journey.test.ts` | modify | cast the real `ember-bloom`; delete `packWithBurstAction`; `main` 1 → 0 |
| `tests/proofs/rules-are-data.test.ts` | modify | proof 3 gains a combat leg |
| `tests/proofs/spells-journey.test.ts` | create | CAP-S4 through `dist/` |

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
   - Then apply CA-S1's gate order exactly. For a spell:
     - `resolveTarget` permits any combatant in the fight when `targetId` is given
       (DD-S8). Add a parameter; do not fork the function.
     - The validity gate is skipped (spells have no `valid`).
     - After `spatialGate`: the armor gate, when `cost.vancian !== undefined &&
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
   - **Spatial:** a spell at a non-adjacent target in `emberMarchesSpatialPack()` →
     `spatial`/`E-SPAT-01`.

**Commit when:**
- `pnpm typecheck` 0;
- `pnpm exec vitest run tests/runtime` green (the existing combat suites stay green
  unchanged);
- `pnpm exec prettier --check <changed files>` 0.

### Checkpoint 2 — The character bridge (CAP-S1 integrated)

1. **`pools.ts`:** `export function armorBlockingCast` (body unchanged).
2. **`character-profile.ts` `profileFromCharacter`:**
   - `spells: knownSpells(runtime, state)`, only when non-empty;
   - `castBlockedBy: armorBlockingCast(runtime, state)`, only when defined;
   - `balances.bindings`: a deep copy of `state.slots`.

   `boundSlots` is unchanged. Update the doc comment.
3. **`index.ts`:** export `armorBlockingCast`. `settleSpellCasts` comes at ck3.
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

### Checkpoint 3 — Spend survives snapshots; settlement (CAP-S2, CAP-S3)

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

### Checkpoint 4 — Generated spells cost a turn; the journey (CAP-S4)

1. **Themes (DD-S9):** in each of the three themes, add `"slots": { "main": 1 }` to every
   `content.spells.<id>.cost`, keeping the existing keys. Do it mechanically (a one-off
   script outside the lease, deleted before commit, or careful edits) and preserve each
   file's formatting. Then confirm with a one-liner that every spell cost has
   `slots.main === 1`.
2. **`grid-journey.test.ts`:**
   - delete `packWithBurstAction` and its DD17a header paragraph (l.23–31);
   - the burst and vancian-gate tests load `darkFantasyPack()` directly and declare the
     real `ember-bloom`. The caster's spells come from `profileFromCharacter` (`hexer`
     knows `ember-bloom`, as the existing guard at l.145 checks), so `extraAction` is no
     longer needed for spells;
   - the assertion at l.409 becomes `main` **0**, because the spell now costs main;
   - every other byte-exact assertion must hold unchanged. Dice: the spell adds no roll
     before the save.
3. **`rules-are-data.test.ts` proof 3:** append a combat leg on the same mutated pack:
   prepare `wither-light` → `profileFromCharacter` → `startCombat` →
   `declare('wither-light', {targetId})` → `spell:cast` with
   `why.rule === 'content.spells.wither-light'`. The baseline pack has no such spell, so
   the declare is `no-action`. The engine still has zero diffs inside the proof.
4. **`tests/proofs/spells-journey.test.ts`** (new; the dist idiom of
   `equipment-journey.test.ts`: import from `../../dist/runtime.js` and
   `../../dist/compiler.js`):
   - **Freshness:** `typeof runtimeDist.settleSpellCasts === 'function'`, and the
     generated dark-fantasy `ember-bloom` cost equals
     `{ vancian: 2, slots: { main: 1 } }`.
   - **Vancian leg** (dark-fantasy seed 42, grid, positions as in grid-journey's burst
     test):
     1. a level-3 hexer `character.prepare('ember-bloom')`;
     2. `profileFromCharacter`;
     3. `startCombat` with a `barrow-wight` adjacent to the target;
     4. `declare('ember-bloom', {targetId})`, which emits `spell:cast {slotLevel: '2',
        slotIndex: 0}`;
     5. `serializeCombat` → JSON → `deserializeCombat` with the **same** fight-start
        request;
     6. the restored combatant's `slotsCast` is `{'2': [0]}`, and a second declare is
        `vancian`;
     7. drive the fight to `combat-over` with plain `strike`/`hurl` declares and
        `step()`. If it does not end in a bounded loop (≤ 50 steps), set hp via
        restore: build the snapshot with the target's `hp: 0`, a documented harness
        move;
     8. `settleSpellCasts`: the character's `slots['2'][0]` becomes `null`;
     9. `serializeCharacter` → `restoreCharacter` keeps `null`.
   - **Pool leg** (wyldwood seed 42, hex): a character of a class whose `spellLists`
     include a list a pool spell belongs to. **Pick the class and spell at ck0 from the
     generated pack, and assert that choice in the test.** Cast it; `poolsSpent` equals
     the spell's amount; snapshot/restore; settle draws the pool.
   - Dice are not scripted. Assert structure and spend only, plus determinism: two runs
     with the same seed produce `JSON.stringify`-equal event streams.

**Commit when:**
- `pnpm build` then `pnpm test` green: the whole suite, 741 + new;
- `pnpm typecheck`, `pnpm lint` and `pnpm format:check` 0;
- `pnpm check:isolation` and `pnpm check:security` 0.

If a test outside the lease goes red because of the theme cost change, stop and return
`blocked`, naming the file and the mechanical fix. Orchestrator applies a Controlled
Lease Revision; do not widen the lease yourself.

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
- **CAP-S2 proof:** `tests/snapshots/combat.test.ts` plus the journey's restore step.
  The seed fact is the fight-start request the host re-states, and storage is JSON text.
- **CAP-S3 proof:** `spells.test.ts` settlement plus the journey's settle, then the
  character snapshot round-trip.
- **CAP-S4 artifact identity:** the journey imports `dist/` built by `pnpm build` at the
  checkpoint's tree. The freshness test fails on a stale build. Record the HEAD SHA the
  build ran at in the handoff.
- **Architecture:** the runtime never imports the compiler (`check:isolation`). No new
  module. `pools.ts` stays free of `character-profile` imports.

## State Update

Report:
- the status and per-checkpoint SHAs;
- the landed symbols (`CombatantState` fields, `settleSpellCasts`, the `armorBlockingCast`
  export, the `armor-not-castable` kind);
- the wyldwood class/spell chosen for the pool leg;
- the new test count;
- any CA-S1 … S5 mapping that changed while you implemented it (exact text);
- surprises.

`followUp` for S03:
- the exact `CombatantState` shape it extends (`feats` comes next);
- the spells-journey file layout, so S03 can append the feat leg;
- whether `resolveTarget`'s new parameter suits the feat target rule.
