import { expect, it } from 'vitest';
import { Combat, Rng, Runtime, startCombat } from '../../src/runtime';
import { emberMarchesPack } from './fixtures/packs';

it('public RNG and Combat exports resume the exact future roll stream', () => {
  const rng = new Rng('public-host');
  rng.int(20);
  const resumed = new Rng(rng.getState());
  expect(Array.from({ length: 20 }, () => resumed.int(20))).toEqual(Array.from({ length: 20 }, () => rng.int(20)));
  const runtime = new Runtime(emberMarchesPack());
  const profile = { id: 'hero', abilities: { might: 3 }, saves: {}, level: 1, hp: 100, ac: 10, initiativeBonus: 0, actions: ['strike'] };
  const fight = startCombat(runtime, { allies: [{ id: 'hero', profile }], enemies: [{ id: 'enemy', profile }], rng: new Rng(42) });
  fight.step();
  const reopened = new Combat(new Runtime(emberMarchesPack()), JSON.parse(JSON.stringify(fight.serialize())));
  fight.declare('strike');
  reopened.declare('strike');
  expect(reopened.serialize()).toEqual(fight.serialize());
});
