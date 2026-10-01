# SESSION-03 — The feat column: trigger grammar, feats held and offered, snapshot envelope, README

> **Program:** Ruleswright
> **Feature:** spells-in-combat
> **Modules:** M01, M03, M04 (theme content only)
> **Depends on:** SESSION-02 (`CombatantState` spell fields, `profileFromCharacter` bridge, snapshot spend, `spells-journey.test.ts` landed; CA-S1 … S5 rechecked against them by Orchestrator)
> **Concurrent with:** —
> **Owns:** `src/schema/validate/helpers.ts`, `src/runtime/feats.ts`, `src/runtime/character.ts`, `src/runtime/runtime.ts`, `src/runtime/combat/triggers.ts`, `src/runtime/combat/combat.ts`, `src/runtime/combat/resolve.ts`, `src/runtime/character-profile.ts`, `src/runtime/snapshots.ts`, `src/runtime/index.ts`, `src/compiler/themes/dark-fantasy.json`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/wyldwood.json`, `tests/schema/validate.test.ts`, `tests/runtime/fixtures/packs.ts`, `tests/compiler/pipeline.test.ts`, `tests/compiler/stages.test.ts`, `tests/compiler/coverage-floor.test.ts`, `tests/runtime/feats.test.ts`, `tests/runtime/combat/feat-triggers.test.ts`, `tests/snapshots/character.test.ts`, `tests/snapshots/combat.test.ts`, `tests/proofs/movement-journey.test.ts`, `tests/proofs/rules-are-data.test.ts`, `tests/proofs/spells-journey.test.ts`, `tests/proofs/docs-run.test.ts`, `README.md`
> **Reads:** `program/Ruleswright/specs/database.md` (v1.6), `src/schema/contracts/{pack,snapshots}.schema.json`, `src/schema/validate/sections/{actions,content}.ts`, `src/runtime/conditions.ts`, `src/runtime/events.ts`, `program/Ruleswright/mocks/{triggers,conditions,magic,api-map}.html`, `program/Ruleswright/prompts/spells-in-combat/STATE.md`
> **Resources:** —
> **Checkpoints:** 5

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M01 | Schema validator | `validate/helpers.ts` `checkTrigger` (l.296–325); its callers `sections/actions.ts:61`, `sections/content.ts:393` | One site enforces the grammar for actions and feats |
| M03 | Runtime | `combat/triggers.ts` (all), `combat/combat.ts` (`respond` l.~619, `surfaceOffers` l.~1237, `resolveReactive` l.~1255, `offeredCount` l.439, constructor), `snapshots.ts` (character serialize/restore l.131–410; combat l.410–800), `character.ts` (`CharacterState` l.68, the `Character` facade l.~105–200), `runtime.ts` (`PackIndex`, `compileEffects`), `character-profile.ts` | Feats held, offered, resolved, snapshotted |
| M04 | Themes | `content.feats` in all three | Pattern fix |

Line numbers are those at `55b294f`. S02 shifts `combat.ts`, `snapshots.ts` and
`character-profile.ts`, so locate those by symbol.

## Context

Reactive feats exist in every theme but never fire, for three reasons:
1. their pattern `condition:applied[self]` fails `eventMatches`, which needs
   `[target=self]` (`triggers.ts:31-41`);
2. `reactiveActionsFor` walks actions only (`triggers.ts:44-54`);
3. characters hold no feats at all (`snapshots.ts:26`).

S02 made spells live, so a fight now produces `condition:applied` from the casting
spells and from monster actions such as dark-fantasy's `grave-gaze`, which is exactly
what the theme feats react to. This session makes feats live from end to end. It also
gives the combat snapshot the three envelope fields (DD-S14) that keep every open offer,
the offer counter (R-GM-1) and the phase (R-GM-2).

The **contract window** (STATE Wave Plan) closes here: S01 described `offers`/`phase`/
`offeredCount` and the trigger `pattern`, and ck1/ck4 implement them.

## Capabilities

This session is the integration owner of **CAP-S7** (ck1), **CAP-S5** (ck2), **CAP-S6**
(ck3 unit, ck5 journey) and **CAP-S8** (ck4). It extends CAP-S4's journey with the feat
leg.

**Required inputs:**
- S02's `CombatantState`, `profileFromCharacter` and serializer (landed, ready);
- the v1.6 contract (S01);
- `featEffects`, built here at ck2.

## Contract Agreements

CA-S4 (feat half), CA-S6, CA-S7 and CA-S8, plus a recheck of CA-S1 … S5 as S02 landed
them. Use STATE.md as amended at the S02 receive. If database.md v1.6 differs, database.md
wins: report the difference.

**Checkpoint-0 recheck:**
- `grep -rn "condition:applied\[self\]" src tests` lists exactly: the 3 themes (5 sites),
  `tests/runtime/fixtures/packs.ts:136`, `tests/compiler/pipeline.test.ts:67` and
  `tests/compiler/stages.test.ts:77`;
- every other `trigger.on` literal in `src/` and `tests/` matches the DD-S13 regex
  (fixtures `enemy-approaches` and `damaged` do);
- `serializeCombat` still writes the per-combatant `pendingTrigger`, keeping the first
  offer only.

## Files to Create/Modify

| File | Action | What Changes |
|------|--------|--------------|
| `src/schema/validate/helpers.ts` | modify | `TRIGGER_PATTERN` constant; `checkTrigger` emits `E-FORM-01` |
| `src/compiler/themes/*.json` | modify | 5 feat patterns → `condition:applied[target=self]` |
| `tests/runtime/fixtures/packs.ts`, `tests/compiler/pipeline.test.ts`, `tests/compiler/stages.test.ts` | modify | the same literal re-key (assertions otherwise unchanged) |
| `tests/schema/validate.test.ts` | modify | grammar accept/refuse cases |
| `tests/compiler/coverage-floor.test.ts` | modify | per theme: every `trigger.on` matches the grammar; each reactive feat's pattern targets `self` |
| `src/runtime/feats.ts` | create | `learnFeat` |
| `src/runtime/character.ts` | modify | `CharacterState.feats?`; `Character.learnFeat` |
| `src/runtime/runtime.ts` | modify | `PackIndex.featEffects` |
| `src/runtime/combat/resolve.ts` | modify | `CombatantProfile.feats?` |
| `src/runtime/character-profile.ts` | modify | `profile.feats` |
| `src/runtime/combat/triggers.ts` | modify | feat offers; `source`; offer/decline rule paths |
| `src/runtime/combat/combat.ts` | modify | `CombatantState.feats`; `PendingTrigger.source`; feat take/decline; the no-chain rule; offer counter restore |
| `src/runtime/snapshots.ts` | modify | character `feats`; envelope `offers`/`phase`/`offeredCount`; legacy read; refusals |
| `src/runtime/index.ts` | modify | export `learnFeat` |
| `tests/runtime/feats.test.ts` | create | CAP-S5 |
| `tests/runtime/combat/feat-triggers.test.ts` | create | CAP-S6 unit |
| `tests/snapshots/character.test.ts` | modify | feats round-trip; refusal; byte-exact without feats |
| `tests/snapshots/combat.test.ts` | modify | re-key l.123–125 and l.606 to `offers`; envelope tests |
| `tests/proofs/movement-journey.test.ts` | modify | remove the R-GM-1 workaround (l.263–264) |
| `tests/proofs/rules-are-data.test.ts` | modify | proof 2 adds the reactive feat |
| `tests/proofs/spells-journey.test.ts` | modify | the feat leg |
| `README.md`, `tests/proofs/docs-run.test.ts` | modify | spells/feats docs; anatomy guards (```ts count stays **4**) |

## Implementation

### Checkpoint 1 — Trigger grammar enforced at load (CAP-S7)

1. **`helpers.ts`:** add
   ```ts
   /** v1.6 — the eventMatches grammar (triggers.ts): <type>[:<sub>]* with an optional [target|actor=<self|id>] clause. */
   export const TRIGGER_PATTERN = /^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)*(\[(target|actor)=[a-z][a-z0-9-]*\])?$/;
   ```
   In `checkTrigger`, a string `on` that passes the length check but fails
   `TRIGGER_PATTERN` adds `E-FORM-01` at `${basePath}.on`, with the message
   `trigger pattern "<on>" can never fire — the grammar is <event> or <event>[target|actor=self|<id>].`
   and the hint `did you mean "<base>[target=self]"?` when the clause is `[self]`.
2. **Themes:** in all 5 sites, replace `condition:applied[self]` with
   `condition:applied[target=self]`.
3. **Re-key the literal** in `tests/runtime/fixtures/packs.ts:136`,
   `tests/compiler/pipeline.test.ts:67` and `tests/compiler/stages.test.ts:77`.
4. **Tests:**
   - `validate.test.ts`:
     - accepts `attack:rolled`, `attack:rolled[target=self]`, `x[actor=wight]` and
       `enemy-approaches`;
     - refuses `condition:applied[self]` (E-FORM-01, with the hint), `on:event(a, b)`,
       `a[target]` and `A:b`;
     - a feat and an action both report at their own `jsonPath`.
   - `coverage-floor.test.ts`: per theme, every `actions.*.trigger.on` and
     `content.feats.*.trigger.on` matches `TRIGGER_PATTERN`, and every reactive feat's
     pattern ends `[target=self]`.

**Commit when:**
- `pnpm build` then `pnpm test` green: the whole suite, because themes and the validator
  changed;
- `pnpm typecheck`, `pnpm lint` and prettier on the changed files are clean.

### Checkpoint 2 — Characters hold feats (CAP-S5)

1. **`src/runtime/feats.ts`** (a leaf: imports `./errors` and types only):
   ```ts
   export function learnFeat(runtime: Runtime, character: CharacterState, featId: string): RuntimeEvent
   ```
   - unknown id → `RuntimeRuleError([ruleCard('unknown-feat', featId, 'feats', …)])`;
   - already held → `feat-known`;
   - otherwise `character.feats = [...(character.feats ?? []), featId]` and emit
     `feat:learned {featId}` (`actor` = character id, `why.rule` `content.feats.<id>`).
2. **`character.ts`:**
   - `CharacterState` gains `feats?: string[]`, documented as "absent until the first
     learn (the `equipped` presence rule, DD-S11)";
   - `Character.learnFeat(featId): void` delegates, like `prepare`.
3. **`runtime.ts`:** `PackIndex.featEffects`, built with `compileEffects` over the feats
   that declare `effect`.
4. **`snapshots.ts` (character):**
   - serialize emits `feats` only when the state carries it;
   - restore copies it, refusing an unknown feat id (`E-SNAP-01`, `state.feats[<i>]`,
     with all cards before applying);
   - update the l.26 doc line.
5. **`resolve.ts`:** `CombatantProfile.feats?: readonly string[]`.
   **`character-profile.ts`:** `feats` = the character's held feats that declare a
   `trigger`, emitted only when non-empty (CA-S4).
6. **`index.ts`:** export `learnFeat`.
7. **Tests:**
   - `tests/runtime/feats.test.ts`: learn, `unknown-feat`, `feat-known`, the event, and
     a refusal changes nothing;
   - `tests/snapshots/character.test.ts`: round-trip with feats; byte-exact without
     them; the unknown-id refusal;
   - `profile.feats` present after learning a reactive feat, and absent for a passive
     one.

**Commit when:**
- `pnpm typecheck` 0;
- `pnpm exec vitest run tests/runtime tests/snapshots` green;
- prettier is clean.

### Checkpoint 3 — Feats are offered and resolved (CAP-S6)

1. **`combat.ts`:**
   - `CombatantState.feats: readonly string[]`, from the profile, `[]` when absent;
     emit it only when non-empty in any JSON form.
   - `PendingTrigger` gains `readonly source: 'action' | 'feat'`. Every existing
     construction sets `'action'`.
2. **`triggers.ts`:**
   - `reactiveActionsFor` stays as it is; add `reactiveFeatsFor` over `combatant.feats`
     (only feats with `trigger`);
   - `offersForEvent(runtime, combatants, event, options?: { feats?: boolean })` returns
     action offers, then feat offers (when `feats !== false`), per combatant in
     `Object.values` order as today;
   - `emitOffer` and `emitDeclined` add `source` to the payload, and use
     `why.rule` `content.feats.<id>.trigger` for feats.
3. **`respond`, take on a feat:**
   - a `targetId` other than the reactor → one `declare:rejected` `invalid-target`, and
     the offer has still left the queue (the F-P10b rule: an answer is an answer);
   - otherwise run `execute(reactor, {id, def: {cost: {}, effect}, ast:
     index.featEffects[id]}, reactor, 'content.feats.<id>')`;
   - no restriction, reach or cost gate;
   - then `endIfSideDefeated`, then `surfaceOffers(emitted, { feats: false })`. This is
     the **no-chain rule** (DD-S12).
4. **Decline** is unchanged apart from `source`. The paused-move resume rule
   (`pendingTriggers.length === 0` → `resumeMove`) applies to feat answers too.
5. **`tests/runtime/combat/feat-triggers.test.ts`** (`emberMarchesPack()`, whose
   `second-gust` was re-keyed at ck1; `hexbound` via `grave-gaze`):
   - a held feat is offered once on `condition:applied` targeting the holder, with
     `source: 'feat'` and the correct rule path;
   - not offered to a downed holder;
   - not offered when the event targets someone else;
   - take → `braced` applied to the **holder**, `why.rule` `content.feats.second-gust`,
     and **no new offer** (no chain);
   - decline → one `trigger:declined`;
   - `targetId` = an enemy → `invalid-target`, and the queue is empty;
   - a reactive action and a feat on the same event both queue, actions first;
   - the existing `tests/runtime/combat/movement.test.ts` suite stays green unchanged,
     which shows that the queue-empty resume rule still holds with `source` on every offer.

**Commit when:**
- `pnpm typecheck` 0;
- `pnpm exec vitest run tests/runtime tests/snapshots tests/proofs` green (`pnpm build`
  first);
- prettier is clean.

### Checkpoint 4 — The combat envelope keeps offers, counter and phase (CAP-S8)

1. **`combat.ts`:** the offer counter becomes restorable. Add a constructor option
   `{ offeredCount?: number }`, or a documented `restoreOfferCount(n)` used only by
   `snapshots.ts`, and a read-only getter `offeredCount` for the serializer.
2. **`snapshots.ts`:**
   - `CombatSnapshot` gains `phase?`, `offeredCount?` and
     `offers?: {actorId, source, id, on}[]`;
   - serialize always writes `phase` and `offeredCount`, writes `offers` when
     non-empty, and **stops writing** the per-combatant `pendingTrigger`;
   - restore follows DD-S14's precedence:
     - `offers` rebuilds `pendingTriggers` in order;
     - otherwise the legacy `pendingTrigger` is read, as today;
     - phase = `combat-over` by hp, else the envelope `phase`, else the v1.5
       derivation;
     - the counter comes from `offeredCount`.
   - Refusals (`E-SNAP-01`, collected with the others):
     - `offers` together with any `pendingTrigger`;
     - an unknown `actorId`;
     - an `id` that is not, for its `source`, a reactive action in that combatant's
       `actions` or a reactive feat in its `feats`;
     - `phase` `combat-over` while no side is defeated.
3. **Re-key:** `tests/snapshots/combat.test.ts:123-125` and `:606` now assert
   `snap.offers` entries (`{actorId, source: 'action', id: 'parry' | 'opportunist', on}`).
   **Remove the workaround** at `tests/proofs/movement-journey.test.ts:263-264`, and
   assert that `offerIndex` continues across the restore.
4. **New tests in `combat.test.ts`:**
   - two open offers for one combatant (an action and a feat) both survive the
     round-trip, in order;
   - **R-GM-2:** a `use`-raised offer restores into the live phase (`awaiting-declare`),
     not `resolved`;
   - a v1.5-shaped envelope (only `pendingTrigger`, no `phase`) restores as before;
   - each new refusal.

**Commit when:**
- `pnpm build` then `pnpm test` green (whole suite);
- `pnpm typecheck` and `pnpm lint` 0;
- prettier is clean.

### Checkpoint 5 — The feat leg, FR-12 proof 2, README (CAP-S6 end to end)

1. **`spells-journey.test.ts`**, new `describe` (the dist idiom, dark-fantasy seed 42):
   1. a hexer `character.learnFeat('second-gust')` and prepares `ember-bloom`;
   2. `profileFromCharacter`, then the fight with a `barrow-wight` adjacent. The wight
      acts first (pin initiative with the ±100 `initiativeBonus` profile override, as
      in grid-journey);
   3. `declare('grave-gaze', {targetId: hexer})`: `condition:applied {hexbound}` →
      `trigger:fired {source: 'feat', actionId|id: 'second-gust'}`;
   4. serialize → JSON → restore: `offers` holds it, and `offeredCount` is preserved;
   5. `respond(take)`: `condition:applied {braced}` on the hexer, and no second
      `trigger:fired`;
   6. on the hexer's turn, `declare('ember-bloom')` → `restricted` (hexbound carries
      `spells.tagged:casting`, `dark-fantasy.json:440`, DD-S10), with nothing spent;
   7. learn → `serializeCharacter` → `restoreCharacter` keeps `feats`.

   Use the payload field names exactly as ck3 landed them.
2. **`rules-are-data.test.ts` proof 2:** add the reactive feat on the fixture pack
   (data only). It is offered on `condition:applied[target=self]`, taken, and its effect
   lands on the holder, with zero engine diffs. The baseline is the same pack without the
   feat held: no offer.
3. **README** (no new ```ts block; the docs-run pin stays 4):
   - **l.139–142 (`profileFromCharacter`):** add "the spells it knows, its slot bindings,
     any armor that blocks slot casting, and its reactive feats".
   - **l.177–182 (Grid combat burst prose):** burst spells are declared like actions:
     `fight.declare('ember-bloom', { targetId })`.
   - **l.341–343 (armorCasting):** "armorCasting covers slot casting only: point-pool
     spells are cast in combat and are never armor-gated."
   - **A new section `## Spells and feats in combat`** after Grid combat, covering:
     - the declare;
     - the gate order;
     - spells may target any combatant;
     - the `main` turn cost in the sample themes;
     - snapshot spend;
     - `settleSpellCasts`;
     - `learnFeat`;
     - reactive feats (offered like reactions, free, act on the holder, never chain);
     - the trigger grammar;
     - the v1 limits (no feat-slot cap; zombie-urban classes know no spells).

     Put a ```text event-stream sample in it.
   - **`docs-run.test.ts`:** add `expect(readme).toContain('settleSpellCasts')` and
     `toContain('learnFeat')` to the anatomy guard.

**Commit when:**
- `pnpm build` then `pnpm test` green;
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm check:isolation` and
  `pnpm check:security` all 0.

## Verification

- **Gates:** the Verification Baseline commands; whole suite after `pnpm build` at
  ck1, ck4 and ck5.
- **CAP-S7 proof:**
  - test paths: `tests/schema/validate.test.ts` and `tests/compiler/coverage-floor.test.ts`;
  - entry: `validatePack` (the real validator), plus the generated packs from the real
    compiler;
  - assertions: `E-FORM-01` at the exact `jsonPath`; every generated pattern matches.
- **CAP-S5 proof:** `tests/runtime/feats.test.ts` and `tests/snapshots/character.test.ts`
  (serialize → JSON → restore), plus the journey's character round-trip.
- **CAP-S6 proof:**
  - `tests/runtime/combat/feat-triggers.test.ts` (unit) and the spells-journey feat leg
    through `dist/` (built at the ck5 tree; the freshness test also asserts
    `typeof runtimeDist.learnFeat === 'function'`);
  - production path: `learnFeat` → `profileFromCharacter` → `startCombat` → a monster
    `declare` → `offersForEvent` → `respond`;
  - every piece is real: no doubles.
- **CAP-S8 proof:**
  - `tests/snapshots/combat.test.ts` (both offers, counter continuity, R-GM-2 phase,
    legacy envelope);
  - `tests/proofs/movement-journey.test.ts` (no `offerIndex` workaround).
- **Architecture:**
  - `feats.ts` imports no runtime value module except `./errors`;
  - `helpers.ts` gains no import;
  - the runtime does not import the compiler;
  - `RULE_IDS` stays at 15 and the DSL `REGISTRY` at 14 (`tests/schema/registry.test.ts`
    unchanged).

## State Update

Report:
- the status and per-checkpoint SHAs;
- the landed symbols (`TRIGGER_PATTERN`, `learnFeat`, `featEffects`, `PendingTrigger.source`,
  the envelope fields, the offer-counter restore mechanism);
- the exact `trigger:fired`/`trigger:declined` payloads;
- the README sections changed;
- the final test count;
- whether any CA-S6 … S8 mapping changed (exact text);
- surprises.

Name every carried item that is still open (STATE Inherited findings) with its owner, for
the Final Report.
