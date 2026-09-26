/**
 * Perf budgets as tests (NFR budgets; CI-generous local bounds — the workflow
 * asserts the real thresholds in CI; Custom Rule 5 keeps the browser matrix out
 * of local config). The smoke mirrors encounter.test.ts's harness shape.
 *
 * Theme constants come from the theme-loader module (the surface barrel does
 * not re-export the loader — S08's correction note: add DARK_FANTASY/
 * ZOMBIE_URBAN to src/compiler/index.ts, or import from './theme-loader').
 */
import { describe, expect, it } from 'vitest';
import { Runtime } from '../../src/runtime/runtime';
import { validatePack } from '../../src/schema/validate';
import { packDslChecker } from '../../src/core/dsl/checker';
import { packContentHash } from '../../src/schema/version';
import { spawnMonster } from '../../src/runtime/bestiary';
import { startCombat, type StepOutcome } from '../../src/runtime/combat/combat';
import { profileFromStatblock, type CombatantProfile } from '../../src/runtime/combat/resolve';
import { serializeCombat, deserializeCombat } from '../../src/runtime/snapshots';
import { generateCampaign } from '../../src/compiler';
import { DARK_FANTASY } from '../../src/compiler/theme-loader';
import { Rng } from '../../src/core/rng';
import { emberMarchesPack } from '../runtime/fixtures/packs';

describe('perf budgets (CI-generous local bounds)', () => {
  it('generate: full dark-fantasy campaign < 2 s', () => {
    const started = performance.now();
    const pack = generateCampaign({ theme: DARK_FANTASY, seed: 42 });
    const elapsedMs = performance.now() - started;
    expect(pack.manifest.id).toBeTruthy();
    expect(elapsedMs).toBeLessThan(2000);
  });

  it('load + validate < 500 ms', () => {
    const pack = generateCampaign({ theme: DARK_FANTASY, seed: 42 });
    const started = performance.now();
    const cards = validatePack(pack, packDslChecker);
    const runtime = new Runtime(pack);
    const elapsedMs = performance.now() - started;
    expect(cards).toEqual([]);
    expect(runtime.pack.manifest.id).toBeTruthy();
    expect(elapsedMs).toBeLessThan(500);
  });

  it('10-combatant full round < 500 ms locally (real budget 50 ms, CI)', () => {
    const runtime = new Runtime(emberMarchesPack());
    const combatants: { id: string; profile: CombatantProfile }[] = [];
    for (let i = 0; i < 5; i += 1) {
      combatants.push({ id: `ally-${i}`, profile: { ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, `ally-${i}`), actions: ['strike', 'withdraw'] } });
      combatants.push({ id: `foe-${i}`, profile: { ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, `foe-${i}`), actions: ['wight-claw', 'withdraw'] } });
    }
    const fight = startCombat(runtime, {
      allies: combatants.filter((entry) => entry.id.startsWith('ally-')),
      enemies: combatants.filter((entry) => entry.id.startsWith('foe-')),
      rng: new Rng('perf'),
    });
    const started = performance.now();
    let guard = 0;
    while (fight.state.round === 1 && guard < 200) {
      guard += 1;
      if (fight.state.phase === 'awaiting-declare') {
        const active = fight.state.combatants[fight.state.active]!;
        const attack = active.side === 'allies' ? 'strike' : 'wight-claw';
        fight.declare(active.actions.includes(attack) ? attack : 'withdraw');
      }
      const outcome: StepOutcome = fight.step();
      if (outcome.kind === 'combat-over') break;
    }
    const elapsedMs = performance.now() - started;
    expect(elapsedMs).toBeLessThan(500);
  });

  it('snapshot round-trip < 50 ms', () => {
    const runtime = new Runtime(emberMarchesPack());
    const brynn: CombatantProfile = { ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'brynn'), actions: ['strike', 'withdraw'] };
    const wight: CombatantProfile = { ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'wight'), actions: ['wight-claw'] };
    const fight = startCombat(runtime, { allies: [{ id: 'brynn', profile: brynn }], enemies: [{ id: 'wight', profile: wight }], rng: new Rng('snap') });
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    const started = performance.now();
    const restored = deserializeCombat(runtime, snap, { allies: [{ id: 'brynn', profile: brynn }], enemies: [{ id: 'wight', profile: wight }] });
    const elapsedMs = performance.now() - started;
    expect(restored.state.round).toBe(fight.state.round);
    expect(elapsedMs).toBeLessThan(50);
    void packContentHash;
  });
});