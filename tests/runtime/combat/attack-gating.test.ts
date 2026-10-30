import { describe, expect, it } from 'vitest';
import { Rng } from '../../../src/core/rng';
import { Runtime } from '../../../src/runtime/runtime';
import { Combat, startCombat } from '../../../src/runtime/combat/combat';
import { profileFromStatblock } from '../../../src/runtime/combat/resolve';
import { emberMarchesPack } from '../fixtures/packs';

class ScriptedRng extends Rng {
  constructor(private readonly faces: number[]) {
    super(0);
  }
  override int(maxExclusive: number): number {
    const face = this.faces.shift();
    if (face === undefined || face < 1 || face > maxExclusive) throw new Error('Unexpected die draw');
    return face - 1;
  }
}

function resolve(effect: string, faces: number[], defenses = [12]) {
  const pack = emberMarchesPack();
  pack.actions['strike'] = { ...pack.actions['strike']!, effect };
  if (defenses.length > 1)
    pack.spatial = { model: 'grid', reach: { default: 100 }, shapes: ['single', 'burst'] };
  const runtime = new Runtime(pack);
  const base = profileFromStatblock(pack, pack.bestiary['barrow-wight']!, 'hero');
  const profile = { ...base, hp: 50, maxHp: 100, actions: ['strike'], saves: { reason: 0 } };
  const rng = new ScriptedRng([1, ...defenses.map(() => 1), ...faces]);
  const started = startCombat(runtime, {
    allies: [{ id: 'hero', profile: { ...profile, id: 'hero', initiativeBonus: 100 } }],
    enemies: defenses.map((ac, i) => ({
      id: `enemy-${i}`,
      profile: { ...profile, id: `enemy-${i}`, initiativeBonus: 0, ac },
    })),
    ...(defenses.length > 1
      ? {
          positions: {
            hero: { x: -10, y: 0 },
            ...Object.fromEntries(defenses.map((_, i) => [`enemy-${i}`, { x: i, y: 0 }])),
          },
        }
      : {}),
    rng,
  });
  const fight = new Combat(runtime, started.state, rng);
  fight.step();
  const events = fight.declare('strike', { targetId: 'enemy-0' });
  expect(events.some((e) => e.type === 'declare:rejected')).toBe(false);
  return { fight, events, damage: events.filter((e) => e.type === 'damage:applied') };
}

describe('damage follows the attack verdict at execution time', () => {
  it('a miss leaves HP intact and emits no damage event', () => {
    const { fight, events, damage } = resolve('sequence(attack(ac, 0), damage(7, sharp))', [1]);
    expect(fight.state.combatants['enemy-0']!.hp.current).toBe(50);
    expect(damage).toEqual([]);
    expect(events.find((e) => e.type === 'attack:rolled')!.payload['verdict']).toMatchObject({
      result: 'miss',
    });
  });

  it('a hit reports its verdict before applying damage', () => {
    const { fight, events, damage } = resolve('sequence(attack(ac, 0), damage(7, sharp))', [20]);
    expect(fight.state.combatants['enemy-0']!.hp.current).toBe(43);
    expect(damage).toHaveLength(1);
    expect(events.findIndex((e) => e.type === 'attack:rolled')).toBeLessThan(
      events.findIndex((e) => e.type === 'damage:applied'),
    );
  });

  it.each([
    [1, 20, 7],
    [20, 1, 4],
  ])('uses each successive attack verdict (%s, %s)', (first, second, expected) => {
    const { damage } = resolve('sequence(attack(ac, 0), damage(4, sharp), attack(ac, 0), damage(7, sharp))', [
      first!,
      second!,
    ]);
    expect(damage.map((e) => e.payload['amount'])).toEqual([expected]);
  });

  it('records attacks inside a save branch before that branch requests damage', () => {
    const effect = 'save(reason, 10, sequence(attack(ac, 0), damage(5, sharp)), damage(2, sharp))';
    expect(resolve(effect, [1, 1]).damage).toEqual([]);
    const passed = resolve(effect, [20]);
    expect(passed.damage.map((e) => e.payload['amount'])).toEqual([2]);
    expect(passed.events.some((e) => e.type === 'attack:rolled')).toBe(false);
  });

  it('gates a burst independently for each target and its defense', () => {
    const { fight, events, damage } = resolve(
      'target(burst-2, sequence(attack(ac, 0), damage(7, sharp)))',
      [5, 5],
      [12, 4],
    );
    expect(fight.state.combatants['enemy-0']!.hp.current).toBe(50);
    expect(fight.state.combatants['enemy-1']!.hp.current).toBe(43);
    expect(damage.map((e) => e.target)).toEqual(['enemy-1']);
    expect(events.filter((e) => e.type === 'attack:rolled')).toHaveLength(2);
  });

  it('preserves explicit healing and self effects after a missed attack', () => {
    const { fight, damage } = resolve(
      'sequence(attack(ac, 0), damage(7, sharp), heal(3), target(self, heal(4)))',
      [1],
    );
    expect(fight.state.combatants['enemy-0']!.hp.current).toBe(53);
    expect(fight.state.combatants['hero']!.hp.current).toBe(54);
    expect(damage.map((e) => e.payload['amount'])).toEqual([-3, -4]);
  });

  it('keeps damage without an attack unconditional', () => {
    expect(resolve('damage(7, sharp)', []).damage.map((e) => e.payload['amount'])).toEqual([7]);
  });
});
