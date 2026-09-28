# SESSION-06 — The equipment journey + README

> **Program:** Ruleswright
> **Feature:** equipment-consumables
> **Modules:** proofs + docs (M03/M04 consumers; writes nothing in src/)
> **Depends on:** SESSION-05
> **Concurrent with:** —
> **Owns:** `tests/proofs/equipment-journey.test.ts`, `tests/proofs/docs-run.test.ts`, `README.md`
> **Reads:** everything landed, since the journey is the integration column: `src/runtime/**`, `src/compiler/themes/zombie-urban.json`, `src/compiler/themes/dark-fantasy.json`, `tests/proofs/grid-journey.test.ts` (harness precedent), `tests/proofs/loot-journey.test.ts` (dist-journey precedent), `.github/workflows/ci.yml`
> **Resources:** `dist-build` (runs `pnpm build`; solo wave)
> **Checkpoints:** 2

## Module Context
| ID | Module | Read | Why |
|---|---|---|---|
| M03 | Runtime | read | The composed transport the journey drives |
| M04 | Compiler | read | The generated packs the journey runs on |

## Context

This is the first narrow journey for the feature: connected paths from the real entry (`generateCampaign` → `new Runtime`) through:
- equip;
- derived math;
- the cast gate;
- heal;
- the real combat transport (`fight.use`);
- settlement back to the inventory;
- the snapshot round-trip.

There is no mocked boundary anywhere. Generated packs (seed 42) supply real content.
- **Harness precedents:** `grid-journey.test.ts` (byte-exact assertions; a fresh event sink on resumed legs, DD17e) and `loot-journey.test.ts` (imports `../../dist/*`).
- **Two legs:**
  - **zombie-urban:** equipment, heal, combat, settlement, snapshots. It has no slot casting.
  - **dark-fantasy:** the armorCasting leg. It is the only theme with slot (vancian) casting; armorCasting governs slot casting only (DD-EG5, F-E8).

**Ordering lesson (grid-combat REPLAN):** the journey checkpoint comes first, and the docs pin is paid inside the README checkpoint. No planned-debt window opens.

## Capabilities

- **CAP-E7 (the journey):** the complete behavior end to end. Integration: ck1. Layer tests do not substitute for it.
- **CAP-E3 end-to-end:** the dark-fantasy leg (ck1).
- **CAP-E8 end-to-end:** the post-fight inventory assertion (ck1).
- **NFR-DX:** README's runnable examples stay executed and typechecked. docs-run pins 4 ```ts blocks at `:49`, and you own that pin file.

## Contract Agreements

- **All of CA-EG1..EG6** are exercised here, as mapped in Verification below.

## Files to Create/Modify

| File | Action | What Changes |
|---|---|---|
| `tests/proofs/equipment-journey.test.ts` | create | The journey (below) |
| `tests/proofs/docs-run.test.ts` | modify | Only if the README's ```ts block count changes. Adding a fifth block → re-key `:49` from 4 to 5 in the same commit (pin owner). No new block → the file is untouched. Preferred: fence discipline (```json output + journey citation), which leaves the pin at 4 (grid F-G3 precedent) |
| `README.md` | modify | New short section after *Grid combat*: **Equipment & consumables**. It covers: equip/unequip over declared slots; grants (abilities/saves add, reserved `gear-*` formula variables with the pack's direction); armorCasting on slot casting (point-pool spells have no cast verb in v1); `useItem` / `fight.use` / `settleItemUses`; snapshot fields; journey cited |

## Implementation

### Checkpoint 1 — The journey
`tests/proofs/equipment-journey.test.ts` runs in the loot-journey form: `pnpm build` first, then every import comes from `../../dist/*.js`.

**Artifact freshness (F-E13, mechanical):** the first test asserts that the dist exports this feature's symbols. It fails if the dist is stale.
```ts
import * as runtimeDist from '../../dist/runtime.js';
expect(typeof runtimeDist.equipItem).toBe('function');
expect(typeof runtimeDist.useItem).toBe('function');
expect(typeof runtimeDist.settleItemUses).toBe('function');
```
Also assert that `generateCampaign({ theme: loadTheme('zombie-urban'), seed: 42 }).equipSlots` deep-equals `['body', 'main-hand']`. This proves the dist compiler carries S04's themes and the pass-through.

**zombie-urban leg** (seed 42). Read S04/S05's handoff numbers at ck0 and assert numbers, not mechanisms.
1. `new Runtime(pack)` throws nothing.
2. Create a character, then `grant('riot-plate')`, `grant('fire-axe')` and `grant('med-kit', 3)`.
3. `equip('riot-plate', 'body')` → `derived().ac` = base − 1 exactly (descending; the grant moves the stat by exactly the grant). `equip('fire-axe', 'main-hand')` → the profile's `might` = base + 1. Unequipping riot-plate → ac = base; re-equip it.
4. Wound the character (`state.hp.current = cap - 4`), then `useItem('med-kit')`:
   - hp = `min(cap, cap - 4 + heal)`, clamped;
   - med-kit qty is 2;
   - `item:used` is emitted before `damage:applied`, with provenance.
5. `startCombat` with the character (via `profileFromCharacter`; positions declared, because the pack is spatial) and a foe. Wound the ally so the heal is visible, then `fight.use('med-kit', { target: <ally id> })`:
   - a charge is spent;
   - `damage:applied` has a negative `amount` and a clamped `before→after`;
   - `why.rolls` carry the roll;
   - the foe is untouched.
6. Mid-fight `serializeCombat` → `deserializeCombat` on a fresh Runtime with the same restore request:
   - `itemsUsed` is `{ 'med-kit': 1 }` and `maxHp` is carried;
   - use a fresh event sink;
   - one more use spends the second charge, and a third → `no-charges`.
7. Finish the fight (to `combat-over`), then call `settleItemUses(rt, character, fight)`:
   - `character.state.inventory` med-kit qty is 0, so the entry is gone: 3 granted − 1 out-of-combat − 2 in combat;
   - `item:settled` is present;
   - a second settlement returns `[]`.
8. Serialize the character → restore on a fresh runtime → `equipped` is intact. Tamper the envelope's equipped `itemId` to an unknown id → a loud refusal, with the target runtime's state unchanged.

**dark-fantasy leg** (seed 42; the armorCasting teeth):
9. Create a **warden** (`armorCasting: ["mail"]`) and a **hexer** (`armorCasting: ["leather"]`). Grant each `warded-mail` (now `kind: "mail"`) and equip it in `body`. Prepare a level-1 spell from each class's list into a bound slot.
10. The hexer's `cast` → `armor-not-castable`, with the slot still bound. Unequip → the cast succeeds (the legal path through unequip).
11. The warden's `cast` while equipped succeeds (the in-armor legal path).

**Commit when:** `pnpm build` exits 0; `pnpm exec vitest run tests/proofs/equipment-journey.test.ts` is green (all steps); the commit covers the journey file.

### Checkpoint 2 — README + docs-run
1. Write the README section: a ```ts snippet runnable against dist imports, or ```json output per the fence discipline; an expected-output block quoting the real values the journey asserts; the journey cited.
2. Run `pnpm exec vitest run tests/proofs/docs-run.test.ts`. The blocks must be executed and typechecked. Re-key `:49` only if you added a block.
3. Run the full proof suite and the package gate battery as the feature's final verification.

**Commit when:** docs-run is green; `pnpm exec vitest run tests/proofs/` is green, including loot-journey and grid-journey; `pnpm typecheck` is 0; README and docs-run (if changed) are committed.

Report the seven-gate result, marked session-scoped. Orchestrator re-runs the battery at receive.

## Verification

- `pnpm build`, then `pnpm exec vitest run tests/proofs/` (DD14e form). The dist-freshness assertion is test 1 of the journey.
- Byte-exact on the generated packs (seed 42). Read S04's landed grants and med-kit effect string and S05's handoff at ck0.
- No mocked boundary: every step runs through `Runtime`, `Combat`, the settlement verb, and the real serializers. No fixture pack, no stub executor.
- CA boundary assertions, by step:
  - 1, 3 → EG1/EG2
  - 9–11 → EG3
  - 4 → EG4/EG5 (character side)
  - 5–6 → EG4/EG5 (combat)
  - 7 → EG5 (settlement)
  - 6, 8 → EG6
- **Inherited hazard, not yours to fix:** CI's `test` job (`ci.yml:43-45`) runs `pnpm test` without `pnpm build`, and dist-importing journeys (loot-journey, now equipment-journey) need a build. It is recorded in the STATE Verification Baseline with its deferral. Mention it in the handoff if you observe it; do not edit `ci.yml`.

## State Update

Report:
- journey step results (each CA leg);
- README block count;
- docs-run status;
- the seven-gate numbers.

Handoff:
- residual gaps (if any step could not be proven as specified, name the seam; do not relabel it);
- readiness claims for CAP-E1..E8, with the proof checkpoints that closed them.
