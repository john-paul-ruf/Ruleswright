/**
 * Checkpoint-4 suite — bestiary + encounters (FR-16, CAP-6 completion).
 * Determinism (same seed ⇒ same encounter), the documented heuristic's shape,
 * host bypass, and the NFR perf smoke: 10-combatant full round comfortably
 * under budget with the parse-once/eval-many architecture (generous 500 ms CI
 * bound; the budget itself is 50 ms).
 */
import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { emberMarchesPack } from './fixtures/packs';
import { Runtime } from '../../src/runtime/runtime';
import { spawnMonster, bestiaryIds } from '../../src/runtime/bestiary';
import { assembleEncounter, spawnEncounter } from '../../src/runtime/encounter';
import { startCombat, type StepOutcome } from '../../src/runtime/combat/combat';
import { profileFromStatblock, type CombatantProfile } from '../../src/runtime/combat/resolve';

const runtime = new Runtime(emberMarchesPack());

describe('bestiary (FR-16): statblocks through the same machinery', () => {
  it('spawns a statblock with overrides, referenced attack table, and shared actions', () => {
    const wight = spawnMonster(runtime, 'barrow-wight', 'wight');
    expect(wight.id).toBe('wight');
    expect(wight.abilities['might']).toBe(4); // abilityOverrides
    expect(wight.saves['reason']).toBe(3); // saveOverrides
    expect(wight.attackTable).toBeDefined(); // the referenced progression table
    expect(wight.actions).toEqual(['wight-claw', 'grave-gaze']);
    expect(wight.hp).toBe(12); // reserved hp formula at the statblock's level
    expect(wight.ac).toBe(9); // reserved ac formula
  });

  it('refuses an unknown statblock loudly (FR-16 spawns only declared monsters)', () => {
    expect(() => spawnMonster(runtime, 'city-god')).toThrow(/city-god/);
  });

  it('instance ids keep groups addressable; the menu is the sorted bestiary', () => {
    expect(bestiaryIds(runtime)).toEqual(['barrow-wight', 'grave-shambles']);
  });
});

describe('encounter assembly (FR-16): deterministic per seed', () => {
  it('same seed ⇒ identical groups; different seeds may differ', () => {
    const a = assembleEncounter(runtime, { budget: 6, seed: 42 });
    const again = assembleEncounter(runtime, { budget: 6, seed: 42 });
    expect(again).toEqual(a);
    expect(a.groups.length).toBeGreaterThan(0);
    expect(a.threat).toBeLessThanOrEqual(6);
    expect(a.heuristic).toBe('threat-weighted-uniform');
  });

  it('assembled encounters spawn into the same combat machinery (FR-16, no second path)', () => {
    const encounter = assembleEncounter(runtime, { budget: 4, seed: 7 });
    const monsters = spawnEncounter(runtime, encounter);
    expect(monsters.length).toBe(encounter.groups.reduce((sum, group) => sum + group.count, 0));
    for (const monster of monsters) {
      expect(monster.actions.length).toBeGreaterThan(0);
      expect(monster.hp).toBeGreaterThan(0);
    }
    const fight = startCombat(runtime, {
      allies: [{ id: 'brynn', profile: profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'brynn') }],
      enemies: monsters.map((profile) => ({ id: profile.id, profile })),
      rng: new Rng('assembled'),
    });
    expect(fight.state.order.length).toBe(1 + monsters.length);
  });

  it('a zero budget assembles nothing (documented edge)', () => {
    const encounter = assembleEncounter(runtime, { budget: 0, seed: 1 });
    expect(encounter.groups).toEqual([]);
    expect(encounter.threat).toBe(0);
  });

  it('spends the budget greedily but bounded (12-body cap, documented heuristic)', () => {
    const encounter = assembleEncounter(runtime, { budget: 60, seed: 9 });
    const bodies = encounter.groups.reduce((sum, group) => sum + group.count, 0);
    expect(bodies).toBeLessThanOrEqual(12);
  });
});

describe('NFR perf smoke (parse-once/eval-many)', () => {
  it('a 10-combatant full round resolves in well under the 50 ms budget (500 ms CI bound)', () => {
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
    const started = process.hrtime.bigint();
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
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    expect(elapsedMs).toBeLessThan(500);
  });
});