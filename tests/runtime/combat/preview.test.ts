import { expect, it } from 'vitest';
import { Runtime } from '../../../src/runtime/runtime';
import { startCombat } from '../../../src/runtime/combat/combat';
import { FightCore } from '../../../src/runtime/combat/fight';
import { resolveSlotGrants } from '../../../src/runtime/combat/action-economy';
import { previewDeclaration, previewUse } from '../../../src/runtime/combat/preview';
import { profileFromStatblock } from '../../../src/runtime/combat/resolve';
import type { CombatantState, DeclareOptions } from '../../../src/runtime/combat/types';
import { Rng } from '../../../src/core/rng';
import { emberMarchesHexPack } from '../fixtures/packs';
import type { RuntimeEvent } from '../../../src/runtime/events';

function fixture(patch: Partial<CombatantState> = {}, valid?: string) {
  const pack = emberMarchesHexPack();
  pack.actions['self-test'] = {
    cost: { slots: { main: 1 } },
    effect: 'target(self, heal(1))',
    tags: ['free'],
  };
  if (valid) pack.actions['strike'] = { ...pack.actions['strike']!, valid };
  const runtime = new Runtime(pack);
  const profile = profileFromStatblock(pack, pack.bestiary['barrow-wight']!, 'hero');
  const fight = startCombat(runtime, {
    allies: [
      {
        id: 'hero',
        profile: {
          ...profile,
          initiativeBonus: 100,
          actions: ['strike', 'stride', 'self-test'],
          spells: ['grave-light'],
          speed: 3,
        },
        balances: { items: { 'mend-salve': 1 } },
      },
    ],
    enemies: [{ id: 'enemy', profile: { ...profile, initiativeBonus: -100 } }],
    positions: { hero: { x: 0, y: 0 }, enemy: { x: 1, y: 0 } },
    rng: new Rng(2),
  });
  fight.step();
  fight.state = {
    ...fight.state,
    combatants: { ...fight.state.combatants, hero: { ...fight.state.combatants['hero']!, ...patch } },
  };
  const core = new FightCore(runtime, fight.state, new Rng(fight.state.rng), resolveSlotGrants(pack), 0);
  const events: RuntimeEvent[] = [];
  runtime.events.on((event) => events.push(event));
  return { fight, core, events };
}

it.each<{
  name: string;
  action: string;
  options?: DeclareOptions;
  patch?: Partial<CombatantState>;
  valid?: string;
  rejection?: string;
}>([
  { name: 'unknown action', action: 'missing', rejection: 'no-action' },
  { name: 'unheld action', action: 'parry', rejection: 'no-action' },
  {
    name: 'restriction before target',
    action: 'strike',
    options: { targetId: 'missing' },
    patch: { conditions: [{ conditionId: 'shaken', duration: 2 }] },
    rejection: 'restricted',
  },
  { name: 'unknown target', action: 'strike', options: { targetId: 'missing' }, rejection: 'unknown-target' },
  {
    name: 'self rejection',
    action: 'self-test',
    options: { targetId: 'enemy' },
    rejection: 'invalid-target',
  },
  { name: 'self acceptance', action: 'self-test' },
  { name: 'reach', action: 'strike', patch: { position: { x: 20, y: 0 } }, rejection: 'spatial' },
  {
    name: 'spell range',
    action: 'grave-light',
    patch: { position: { x: 20, y: 0 } },
    rejection: 'out-of-range',
  },
  { name: 'invalid center', action: 'strike', options: { at: { x: 1, y: 0 } }, rejection: 'invalid-target' },
  { name: 'missing destination', action: 'stride', rejection: 'no-destination' },
  { name: 'occupied destination', action: 'stride', options: { to: { x: 1, y: 0 } }, rejection: 'occupied' },
  { name: 'legal movement', action: 'stride', options: { to: { x: -1, y: 0 } } },
  {
    name: 'exhausted ledger',
    action: 'strike',
    patch: { slots: { remaining: { main: 0 } } },
    rejection: 'slot-exhausted',
  },
  {
    name: 'armor before spell cost',
    action: 'grave-light',
    patch: { castBlockedBy: 'scale-coat' },
    rejection: 'armor-not-castable',
  },
  {
    name: 'validity before reach',
    action: 'strike',
    patch: { position: { x: 20, y: 0 } },
    valid: 'level > 100',
    rejection: 'valid',
  },
  { name: 'legal attack', action: 'strike' },
])('$name: pure preview agrees with real declaration', ({ action, options, patch, valid, rejection }) => {
  const { fight, core, events } = fixture(patch, valid);
  const before = fight.serialize(),
    rng = core.rng.getState();
  const preview = previewDeclaration(core, action, options);
  expect(fight.serialize()).toEqual(before);
  expect(core.rng.getState()).toEqual(rng);
  expect(events).toEqual([]);
  expect(preview.rejection?.kind).toBe(rejection);
  const result = fight.declare(action, options);
  if (preview.rejection) {
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'declare:rejected',
      payload: {
        kind: preview.rejection.kind,
        resource: preview.rejection.resource,
        message: preview.rejection.message,
      },
      why: { rule: preview.rejection.rule },
    });
    expect(fight.serialize()).toEqual(before);
  } else expect(result.some((event) => event.type === 'declare:rejected')).toBe(false);
});

it('refuses random-dependent validity without a draw while manual declarations stay compatible', () => {
  const { fight, core, events } = fixture({}, '1d6 > 0');
  const before = fight.serialize();
  expect(() => previewDeclaration(core, 'strike')).toThrow('Solo play requires deterministic');
  expect(fight.serialize()).toEqual(before);
  expect(events).toEqual([]);
  expect(fight.declare('strike').some((event) => event.type === 'declare:rejected')).toBe(false);
});

it.each(['missing', 'mend-salve'])('pure item inspection maps the actual target option: %s', (itemId) => {
  const { fight, core, events } = fixture();
  const before = fight.serialize();
  const preview = previewUse(core, itemId, { target: 'hero' });
  expect(fight.serialize()).toEqual(before);
  expect(events).toEqual([]);
  const result = fight.use(itemId, { target: 'hero' });
  if (preview.rejection)
    expect(result[0]).toMatchObject({
      type: 'declare:rejected',
      payload: {
        kind: preview.rejection.kind,
        resource: preview.rejection.resource,
        message: preview.rejection.message,
      },
      why: { rule: preview.rejection.rule },
    });
  else expect(result[0]).toMatchObject({ type: 'item:used', target: 'hero' });
});
