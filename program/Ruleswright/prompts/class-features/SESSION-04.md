# SESSION-04 — Runtime: granted feats, unlocked actions and spells, host query, journey, README

> **Program:** Ruleswright
> **Feature:** class-features
> **Modules:** M03, tests, docs
> **Depends on:** S03
> **Concurrent with:** S05 (lease disjoint: `program/Ruleswright/mocks/progression.html` only)
> **Owns:** `src/runtime/features.ts`, `src/runtime/feats.ts`, `src/runtime/pools.ts`, `src/runtime/character-profile.ts`, `src/runtime/index.ts`, `tests/runtime/features.test.ts`, `tests/runtime/feats.test.ts`, `tests/runtime/pools.test.ts`, `tests/runtime/combat/character-profile.test.ts`, `tests/runtime/combat/module-surface.test.ts`, `tests/proofs/class-features-journey.test.ts`, `tests/proofs/docs-run.test.ts`, `README.md`
> **Reads:** `program/Ruleswright/specs/database.md` (v1.10 *Class features*), `src/schema/artifacts.ts` (`ClassProgression.features`, `ClassFeature`), `src/runtime/{runtime,character,progression,events,errors}.ts`, `src/runtime/combat/{combat,triggers,resolve,types}.ts`, `src/runtime/snapshots/{character,combat}.ts`, `src/compiler/themes/*.json` (as S03 landed them), `tests/proofs/self-target-journey.test.ts` (fight setup pattern), `program/Ruleswright/prompts/class-features/STATE.md`
> **Resources:** —
> **Checkpoints:** 4

## Module Context

| ID | Module | Read | Why |
|----|--------|------|-----|
| M03 | Runtime | `feats.ts:21-37` (`featSlotTally`), `:45-71` (`learnFeat`) | granted-feat refusal; the tally stays held-only |
| M03 | Runtime | `pools.ts:134-160` (`prepareSpell` uses `knownSpells`), `:302-315` (`knownSpells`) | spell unlock |
| M03 | Runtime | `character-profile.ts:66-130` (`profileFromCharacter`: actions union l.75-80, `no-combat-actions` l.81-93, spells l.106, feats l.109) | composition point for the fight |
| M03 | Combat | `combat/combat.ts:345-372` (`no-action` rejections), `combat/triggers.ts:73-86` (`reactiveFeatsFor` reads `combatant.feats`), `snapshots/combat.ts:496-524` (offer check against re-stated `profile.feats`) | unchanged consumers. Granted feats must ride `profile.feats` |
| M03 | Barrel | `index.ts:28` (`learnFeat` export) | `classFeatures` export |

## Context

After S03, every pack declares class features at `progression.<id>.features`, with refs resolved at load. Nothing in the runtime reads them yet. This session adds a leaf `features.ts` that derives a character's features from `(pack, state.classes)` and wires it into the three existing consumers. **No combat-engine file changes:** the fight already takes `profile.actions`, `profile.spells` and `profile.feats` as given.
- `learnFeat` refuses a granted feat.
- `knownSpells` gains unlocked spells.
- `profileFromCharacter` gains unlocked actions and granted reactive feats.

## Capabilities

- **CAP-C3** granted feats: ck1 (first narrow journey) and ck3.
- **CAP-C4** action unlock: ck2.
- **CAP-C5** spell unlock: ck2.
- **CAP-C6** host query: ck4 (export).
- **CAP-C7** README part: ck4.

**First narrow journey: ck1.** Use STATE.md *Capability Readiness* exactly, including the Planner probe note: a **self** condition raises no feat offer. Use the barrow-wight's `grave-gaze`.

## Contract Agreements

- **CA-C3** (granted vs held) and **CA-C4** (unlocks, byte-stability): this session is the producer and the proof owner.
- **CA-C2:** at runtime the pack is valid. `features.ts` looks a ref up in `content.feats`, then `actions`, then `content.spells`, and skips a ref found in none (unreachable after load; no throw).

**Checkpoint-0 recheck (read-only):**
- `grep -n 'features' src/schema/artifacts.ts` shows `features?: ClassFeature[]` inside `ClassProgression`, not `ClassDef`.
- The S03-landed DD-C10 rows exist: dark-fantasy `progression.crypt-warden.features` contains `barrow-rite` @2 and `crypt-vigil` @3; zombie-urban `progression.medic.features` contains `rot-read` @3 and `steady-pulse` @4; `content.feats.crypt-vigil.trigger.on` is `condition:applied[target=self]`.
- Baseline: `pnpm build && pnpm test` is green at S03's final SHA. Record N.

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `src/runtime/features.ts` | create | Leaf (type imports only): `ClassFeatureView`, `classFeatures`, `grantedFeats`, `unlockedActions`, `unlockedSpells` |
| `src/runtime/character-profile.ts` | modify | Unlocked actions appended to `actions`; granted reactive feats appended to `feats`; doc comment |
| `src/runtime/pools.ts` | modify | `knownSpells` includes active spell unlocks (pack order) |
| `src/runtime/feats.ts` | modify | `learnFeat` refuses a granted feat `feat-known` |
| `src/runtime/index.ts` | modify | `export { classFeatures, type ClassFeatureView } from './features';` |
| `tests/runtime/features.test.ts` | create | unit: views, active flags, multi-class order, statblock untouched |
| `tests/runtime/combat/character-profile.test.ts` | modify | byte-stability with no active feature; unlock/grant composition |
| `tests/runtime/pools.test.ts` | modify | `knownSpells`/`prepareSpell` with a vancian spell unlock (fixture) |
| `tests/runtime/feats.test.ts` | modify | `feat-known` for granted; slots ignore granted |
| `tests/proofs/class-features-journey.test.ts` | create | the integration journey (legs 1–6) |
| `tests/runtime/combat/module-surface.test.ts` | modify | barrel list + `classFeatures` (pin re-key) |
| `README.md` | modify | new `## Class features` section; l.139-144, l.322-325, l.353-355 updated |
| `tests/proofs/docs-run.test.ts` | modify | anatomy check: README documents `progression.<id>.features` and `classFeatures` |

## Implementation

### Checkpoint 1 — `features.ts` + granted feats in the fight (first narrow journey)

```ts
/**
 * M03 — class features (FR-6, contract v1.10, DD-C1…C9). A leaf: type imports only.
 * A feature `{level, ref}` at `progression.<classId>.features` grants a feat or unlocks an
 * action or spell while the character's level in that class is >= level. Derived, never stored.
 */
import type { Runtime } from './runtime';
import type { ClassEntry } from './character';

export interface ClassFeatureView {
  readonly classId: string;
  readonly level: number;
  readonly ref: string;
  readonly kind: 'feat' | 'action' | 'spell';
  readonly active: boolean;
}

export function classFeatures(runtime: Runtime, character: { readonly classes: readonly ClassEntry[] }): readonly ClassFeatureView[];
export function grantedFeats(runtime: Runtime, classes: readonly ClassEntry[]): readonly string[];   // active feat refs, DD-C5 order, de-duplicated
export function unlockedActions(runtime: Runtime, classes: readonly ClassEntry[]): readonly string[];
export function unlockedSpells(runtime: Runtime, classes: readonly ClassEntry[]): readonly string[];
```

- `classFeatures` walks `classes` in order, then `runtime.pack.progression[entry.id]?.features ?? []` in order. Kind lookup is feats → actions → spells (CA-C2); `active = entry.level >= feature.level`. Typing `character` structurally lets `CharacterState` pass without a value import.
- `character-profile.ts`:
  - after the class-actions loop (l.75-80), append `unlockedActions(runtime, state.classes)` entries not already present. Move the `no-combat-actions` check after that.
  - feats (l.109) become: held-with-trigger, then `grantedFeats(...)` entries with a `trigger` that are not held (DD-C9).
  - Update the doc comment's `actions`/`feats` bullets.
- **Journey leg 1** (`tests/proofs/class-features-journey.test.ts`, `describe('class features journey (CAP-C3…C6)')`): exactly the STATE *First narrow journey*. Assert:
  - the profile's `feats` equals `['crypt-vigil']` while `cw.state.feats` is `undefined`;
  - the events after `respond` include `condition:applied` with payload condition `braced` and `why.rule` `content.feats.crypt-vigil`;
  - the offer existed: `respond` did not throw, and a `trigger:fired` with `source: 'feat'` is in the runtime's recorded events. Record events through the stream the way `combat-characterization.test.ts` `recorded()` does.
  - Control: the same setup at crypt-warden **L2** opens no `cw.crypt-vigil` offer (`respond` throws or no `trigger:fired` with source feat).
- `tests/runtime/features.test.ts`, using `RUNTIME_PACK` (warden L1 `feature-warden-oath` from S03) and generated dark-fantasy:
  - kinds and `active` flags for crypt-warden at L1/L2/L3;
  - multi-class order;
  - a statblock profile (`spawnMonster(rt, <a statblock using the warden attackTable>, id)`) carries no granted feat and no unlocked action (DD-C6).

**Commit when:** V1–V3 are 0; `pnpm build && pnpm test` is green; journey leg 1 passes. Message: `class-features SESSION-04: checkpoint 1 — features leaf, granted feats in the fight`.

### Checkpoint 2 — unlocked actions and spells

- `pools.ts` `knownSpells`: build `unlocked = new Set(unlockedSpells(runtime, character.classes))`, then filter pack spells by `lists match || unlocked.has(id)`. Pack order is kept (DD-C9). Update the FR-9 doc comment. `prepareSpell` needs no change; it calls `knownSpells`.
- `character-profile.ts` already composes actions (ck1); spells come through `knownSpells`.
- **Journey leg 2 (CAP-C4),** dark-fantasy crypt-warden vs barrow-wight, with the crypt-warden acting first (initiative +100):
  - at L1, `declare('barrow-rite', {targetId: 'wight'})` → one `declare:rejected` with `kind: 'no-action'`, `rule: 'E-REF-01'`, message containing `does not have action`, and no other event;
  - at L2, the same declare resolves (`action:resolved` with `actionId: 'barrow-rite'`).
- **Journey leg 3 (CAP-C5),** zombie-urban medic vs its first bestiary statblock, positions adjacent:
  - at L2, `profile.spells` excludes `rot-read`, and `declare('rot-read', {targetId})` → `no-action` with `does not know spell`;
  - at L3, `profile.spells` contains `rot-read`, `knownSpells(rt, state)` contains it, and the declare emits `spell:cast` with `cost: 'points'` and `pool: 'stamina'`.

  Planner probe at `f36d4ae`: a medic L3 has stamina 18 and today's rejection is exactly this `no-action` message.
- **Byte-stability (CA-C4)** in `character-profile.test.ts`, warden L1 dark-fantasy (only passive features):
  - `JSON.stringify(profileFromCharacter(...))` equals the profile built with `pack.progression.*.features` deleted from a cloned pack;
  - the same for `knownSpells`.
- `pools.test.ts`, vancian unlock: clone with the file's existing `cloneRuntimePack()` and append `{level: 2, ref: 'hex-bolt'}` to `progression.warden.features`. This is valid under S03's rules: `hex-bolt` is `magic.level 1`, lists `['hexer']`; the warden's `spellLists` is `['warden']`, and warden `slots: {'1': [1, 2, 2, 3]}` (verified at `f36d4ae`, `tests/runtime/fixtures/pack.ts`).
  - warden L1: `knownSpells` excludes `hex-bolt`, and `prepareSpell(rt, state, 'hex-bolt')` throws rule `spell-not-known` (`pools.ts:154`);
  - warden L2: `knownSpells` includes it, and `prepareSpell` succeeds and emits `spell:prepared` (`pools.ts:196`).

**Commit when:** the ck1 conditions hold, plus legs 2–3 and the byte-stability cases. Message: `class-features SESSION-04: checkpoint 2 — unlocked actions and spells`.

### Checkpoint 3 — granted is not learned (refusals, slots, snapshots)

- `feats.ts` `learnFeat`: after `unknown-feat` and the existing `feat-known` held check, add a check: if `grantedFeats(runtime, character.classes).includes(featId)`, throw `RuntimeRuleError([ruleCard('feat-known', featId, 'feats', \`"${character.id}" is granted feat "${featId}" by a class feature (FR-6).\`)])`. The slot tally stays held-only (DD-C2); do not touch `featSlotTally`. Update the module doc comment.
- **Journey leg 4 (CA-C3, slots and learning):**
  - crypt-warden L3: `learnFeat(rt, cw.state, 'crypt-vigil')` throws with rule `feat-known`, and `cw.state.feats` stays `undefined`;
  - with `featSlots` at L3 = 2 for crypt-warden (read the value from the generated pack and assert it), learning two other feats succeeds: the granted one uses no slot. A third throws `feat-slots-exceeded`.
  - crypt-warden **L2** learns `crypt-vigil` (allowed). `levelSet` to L3 succeeds, and the feat appears once in `profile.feats` (held, not duplicated).
  - `levelSet` back to L1 → `classFeatures(...).filter(v => v.active)` contains no `crypt-vigil`. No new event type appears (DD-C7): only `level:reached`.
- **Journey leg 5 (snapshots):**
  - `serializeCharacter` of the crypt-warden L3 (no learned feats) has no `feats` key → JSON → `restoreCharacter` on a fresh Runtime → `profileFromCharacter` again carries `crypt-vigil`;
  - a combat snapshot taken with the `cw.crypt-vigil` offer open → JSON → `deserializeCombat` on a fresh Runtime with the re-stated profile from `profileFromCharacter` (the `self-target-journey.test.ts:200-215` pattern) → `respond('cw.crypt-vigil', 'take')` lands `braced`.
- `feats.test.ts` covers the `feat-known` (granted) unit case on `RUNTIME_PACK`: warden L1 is granted `feature-warden-oath`.

**Commit when:** the ck1 conditions hold, plus legs 4–5. Message: `class-features SESSION-04: checkpoint 3 — granted feats are not learned`.

### Checkpoint 4 — public query, barrel pin, README

- `index.ts`: `export { classFeatures, type ClassFeatureView } from './features';` next to `learnFeat`. Do **not** export `grantedFeats`, `unlockedActions` or `unlockedSpells`.
- `module-surface.test.ts:26-`: add `'classFeatures'` to the sorted barrel list. This is the only pin change in that file.
- **Journey leg 6 (CAP-C6):** `classFeatures(rt, medicL3.state)` deep-equals the three medic rows (`field-surgery` feat active, `rot-read` spell active, `steady-pulse` feat inactive), in DD-C5 order.
- **README:**
  - **New section `## Class features`,** placed after `## Spells and feats in combat` and before `## Equipment & consumables`. Prose plus at most one non-```ts example. Use a ```json block for the pack shape, so the quickstart ```ts block count (docs-run l.49) is unaffected. Cover: where features live; the three kinds; "granted is not learned" (no slot, not stored, `feat-known`); unlocks ride the normal pipeline; `classFeatures`; the bundled examples (crypt-warden `barrow-rite`/`crypt-vigil`, medic `rot-read`).
  - Update l.139-144: actions = class `actions` + actions unlocked by class features; reactive feats = learned + granted.
  - Update l.322-325: known spells include class-feature unlocks.
  - Update l.353-355: `feat-known` also refuses a granted feat.
- `docs-run.test.ts`: in the anatomy block that checks documented verbs (near l.232), add an assertion that the README contains `progression.<id>.features` (or the literal you write) and `classFeatures`.
- Doc-pin re-grep: `grep -n -i 'class feature\|features' README.md` is consistent with v1.10, and no sentence still says features are unbuilt.

**Commit when:** V1–V7 are green (`pnpm build && pnpm check:isolation && pnpm check:security`); the full suite is green; `git status --porcelain` is lease-only. Message: `class-features SESSION-04: checkpoint 4 — classFeatures export, README`.

## Verification

Gates per STATE *Verification Baseline*: `pnpm build` before every `pnpm test` (H1); scoped runs with `pnpm exec vitest run <path>` (H3).

**Integration proof** `tests/proofs/class-features-journey.test.ts` (CAP-C3/C4/C5/C6, CA-C3/C4):
- invocation: `pnpm build && pnpm exec vitest run tests/proofs/class-features-journey.test.ts`;
- discovery: default vitest include (`tests/**/*.test.ts`);
- path: public runtime/compiler imports from `src/` (`../../src/runtime`, `../../src/compiler`), as `self-target-journey.test.ts` does. **Not `dist/`.**

The path crosses: theme JSON → `generateCampaign` (real pipeline, stage 8 `validatePack`) → `new Runtime` → `createCharacter` → `profileFromCharacter` → `startCombat`/`step`/`declare`/`respond` → `serializeCombat` → JSON → `deserializeCombat` (fresh Runtime) → `respond`.
- **Doubles:** none. The foe is a real statblock via `spawnMonster`. Randomness is fixed by default `Rng(0)` or a named seed. `grave-gaze` applies `hexbound` on both save branches, so the leg does not depend on the roll.
- **Isolation:** each leg builds its own Runtime. There is no I/O and no ports.

**Assertions per leg** as written above. Rejections assert "nothing changed": no `action:resolved`/`spell:cast`, pools and slots unchanged.

Feature-final: the full suite is N(S03 end) + this session's additions. V6 isolation 0. Characterization digests are **unchanged** in this session (`git diff --quiet <S03 end> -- tests/proofs/combat-characterization.test.ts`): no generated pack bytes change here, and DD-C10 keeps every leg's characters without active non-passive features. If it goes red, stop and report; do not re-key.

## State Update

Report:
- N per checkpoint, new tests and commit SHAs;
- the landed `features.ts` signatures;
- CA-C3/C4 evidence by leg;
- the README sections changed;
- confirmation that `src/runtime/combat/**` and `src/runtime/snapshots/**` are untouched (`git diff --quiet <S03 end> -- src/runtime/combat src/runtime/snapshots`);
- an arch fragment for Orchestrator: the new leaf `features.ts`, its consumers `feats.ts`/`pools.ts`/`character-profile.ts`, and the barrel export.
