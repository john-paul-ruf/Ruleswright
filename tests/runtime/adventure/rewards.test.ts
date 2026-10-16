import { expect, it } from 'vitest';
import { createAdventure, restoreAdventure, Runtime, rollLoot } from '../../../src/runtime';
import { Rng } from '../../../src/core/rng';
import { combatFixture, choose, finishEncounter } from './fixtures';

it('stages an exact real roll with victory and reopens pending without consuming entropy', () => {
  const f = combatFixture(true),
    a = createAdventure(f.pack, f.definition, f.options);
  choose(a);
  const before = a.serialize().rng.rewards;
  finishEncounter(a);
  expect(a.view().phase).toBe('reward-pending');
  expect(choose(a).ok).toBe(false);
  const saved = a.serialize(),
    reward = saved.rewards[0]!,
    rng = new Rng(before),
    outcome = rollLoot(new Runtime(f.pack), 'district-scavenge', rng);
  expect(outcome.ok).toBe(true);
  expect(reward.roll).toMatchObject({
    tableId: 'district-scavenge',
    rngBefore: before,
    rngAfter: rng.getState(),
    value: outcome.ok ? outcome.value : null,
  });
  expect(reward.claimId).toBe(JSON.stringify(['adventure', 'clearing', 'cache']));
  expect(reward.stagedRevision).toBe(saved.revision);
  expect(restoreAdventure(f.pack, f.definition, JSON.parse(JSON.stringify(saved))).serialize()).toEqual(
    saved,
  );
});

import { stageRewards } from '../../../src/runtime/adventure/rewards';
import { rehash } from './fixtures';
it.each([null, 'flavor', 'item'])('stages %s without granting XP or inventory', (kind) => {
  const f = combatFixture(true);
  const pack = {
    ...f.pack,
    tables: {
      ...f.pack.tables,
      prize: {
        kind: 'weighted' as const,
        entries: [{ weight: 1, value: kind === 'item' ? { id: 'rope', qty: 2 } : 'A quiet echo' }],
      },
    },
  };
  const identity = { ...f.definition.pack, contentHash: packContentHash(pack) };
  const definition = rehash({
    ...f.definition,
    pack: identity,
    rewards: [
      {
        id: 'cache',
        xpPerMember: 0,
        eligible: 'party',
        loot: kind === null ? null : { tableId: 'prize', recipient: 'host-choice' },
      },
    ],
  });
  const options = {
    ...f.options,
    members: f.options.members.map((m) => ({ ...m, character: { ...m.character, pack: identity } })),
  };
  const a = createAdventure(pack, definition, options);
  choose(a);
  finishEncounter(a);
  const saved = a.serialize(),
    r = saved.rewards[0]!;
  expect(r.roll?.result ?? null).toEqual(
    kind === null ? null : kind === 'item' ? { kind: 'item', itemId: 'rope', qty: 2 } : { kind: 'no-item' },
  );
  expect(saved.members[0]!.character.state.inventory).toEqual(options.members[0]!.character.state.inventory);
  expect(saved.members[0]!.character.state.classes).toEqual(options.members[0]!.character.state.classes);
  expect(restoreAdventure(pack, definition, JSON.parse(JSON.stringify(saved))).serialize()).toEqual(saved);
});
import { packContentHash } from '../../../src/schema/version';
it('a real table failure discards earlier privately staged rolls; public validation rejects the bad recipe before entry', () => {
  const f = combatFixture(false),
    a = createAdventure(f.pack, f.definition, f.options);
  choose(a);
  finishEncounter(a);
  const before = a.serialize();
  const definition = rehash({
    ...f.definition,
    nodes: f.definition.nodes.map((n) => (n.id === 'clearing' ? { ...n, rewardIds: ['good', 'bad'] } : n)),
    rewards: [
      {
        id: 'good',
        xpPerMember: 1,
        eligible: 'party',
        loot: { tableId: 'district-scavenge', recipient: 'host-choice' },
      },
      {
        id: 'bad',
        xpPerMember: 1,
        eligible: 'party',
        loot: { tableId: 'loot-chain', recipient: 'host-choice' },
      },
    ],
  });
  // This legacy pack table is valid to Runtime but not to the adventure definition gate.
  const pack = {
    ...f.pack,
    tables: { ...f.pack.tables, 'loot-chain': { kind: 'nested' as const, entries: [{ value: 'nothing' }] } },
  };
  expect(() => stageRewards(pack, definition, before)).toThrow(/table-roll-failed/);
  expect(a.serialize()).toEqual(before);
  expect(() => createAdventure(pack, definition, f.options)).toThrow();
});

import { rewardFixture, claim, dispatch } from './fixtures';
import { awardXp, restoreCharacter } from '../../../src/runtime';
it.each([0, 25, 1000])(
  'real XP=%s preserves exact injury/preparation/resources and claims only one reward',
  (xp) => {
    const f = rewardFixture(xp),
      a = createAdventure(f.pack, f.definition, f.options),
      before = a.serialize(),
      result = claim(a, 0, 'hero-1');
    expect(result.ok).toBe(true);
    const after = a.serialize();
    expect(after.rewards.map((r) => r.status)).toEqual(['claimed', 'pending', 'pending']);
    expect(after.rng).toEqual(before.rng);
    for (const [i, m] of after.members.entries()) {
      const old = before.members[i]!.character.state,
        state = m.character.state;
      for (const key of [
        'hp',
        'pools',
        'conditions',
        'knownSpells',
        'feats',
        'equipped',
        'abilities',
      ] as const)
        expect(state[key], key).toEqual(old[key]);
      expect(state.classes).toEqual([{ id: 'warden', level: xp === 1000 ? 2 : 1, xp }]);
      expect(state.slots).toEqual({
        '1': xp === 1000 ? [null, 'grave-light', null] : [null, 'grave-light'],
        '2': xp === 1000 ? [null, 'high-light', null] : [null, 'high-light'],
      });
      expect(state.inventory).toEqual(i === 0 ? [...old.inventory, { id: 'rope', qty: 2 }] : old.inventory);
      const restored = restoreCharacter(new Runtime(f.pack), m.character);
      expect(restored.state.xp).toBe(xp);
      expect(restored.state.saves.reflex).toBe(xp === 1000 ? 1 : 0);
    }
    expect(after.journal.filter((e) => e.event.type === 'xp:awarded')).toHaveLength(xp === 0 ? 0 : 2);
    const r = after.rewards[0]!;
    expect(r.status).toBe('claimed');
    if (r.status === 'claimed') {
      expect(r.receipt.beforeMembersHash).toBe(packContentHash(before.members));
      expect(r.receipt.afterMembersHash).toBe(packContentHash(after.members));
      expect(r.receipt.grants).toEqual([{ memberId: 'hero-1', itemId: 'rope', qty: 2 }]);
    }
    const reopened = restoreAdventure(f.pack, f.definition, JSON.parse(JSON.stringify(after)));
    const repeat = claim(reopened, 0, 'hero-1');
    expect(repeat.ok).toBe(true);
    expect(repeat.events).toEqual([]);
    expect(reopened.serialize()).toEqual(after);
    expect(claim(reopened, 0, 'hero-2').ok).toBe(false);
  },
);
it.each([-7, 0, 99])('keeps signed/above-max HP %s with temp and downed eligibility', (hp) => {
  const f = rewardFixture(1000, hp),
    a = createAdventure(f.pack, f.definition, f.options);
  expect(claim(a, 0, 'hero-2').ok).toBe(true);
  expect(a.serialize().members.map((m) => m.character.state.hp)).toEqual(
    f.options.members.map((m) => m.character.state.hp),
  );
});
it('later incompatible member discards first-member XP/item events and every byte of the claim transaction', () => {
  const f = rewardFixture(1000, 7, true),
    a = createAdventure(f.pack, f.definition, f.options),
    before = JSON.stringify(a.serialize());
  // Establish the actual first-member writer succeeds in isolation with the same saved roll.
  const one = createAdventure(f.pack, f.definition, { ...f.options, members: [f.options.members[0]!] });
  const good = claim(one, 0, 'hero-1');
  expect(good.ok).toBe(true);
  expect(good.events.some((e) => e.event.type === 'xp:awarded')).toBe(true);
  expect(good.events.some((e) => e.event.type === 'item:granted')).toBe(true);
  const result = claim(a, 0, 'hero-1');
  expect(result.ok).toBe(false);
  expect(result.events).toEqual([]);
  if (!result.ok)
    expect(result.errors[0]).toMatchObject({
      rule: 'E-VANC-01',
      artifactId: 'hero-2',
      jsonPath: 'slots.1[1]',
    });
  expect(JSON.stringify(a.serialize())).toBe(before);
  const reopened = restoreAdventure(f.pack, f.definition, JSON.parse(before));
  expect(claim(reopened, 0, 'hero-1')).toEqual(result);
  expect(JSON.stringify(reopened.serialize())).toBe(before);
});
it('direct low-level awardXp still heals and clears bindings while adventure preserves them', () => {
  const f = rewardFixture(25),
    rt = new Runtime(f.pack),
    c = restoreCharacter(rt, f.options.members[0]!.character);
  awardXp(rt, c.state, 25);
  expect(c.state.hp.current).toBe(20);
  expect(c.state.slots).toEqual({ '1': [null, null], '2': [null, null] });
  const a = createAdventure(f.pack, f.definition, f.options);
  expect(claim(a, 0, 'hero-1').ok).toBe(true);
  expect(a.serialize().members[0]!.character.state.hp.current).toBe(7);
});
it('flavor requires a chosen recipient, no-loot forbids one, stale/foreign claims cannot award twice', () => {
  const f = rewardFixture(0),
    a = createAdventure(f.pack, f.definition, f.options);
  const before = a.serialize();
  expect(claim(a, 1).ok).toBe(false);
  expect(claim(a, 2, 'hero-1').ok).toBe(false);
  expect(claim(a, 0, 'unknown').ok).toBe(false);
  expect(a.serialize()).toEqual(before);
  expect(claim(a, 1, 'hero-2').ok).toBe(true);
  expect(claim(a, 2).ok).toBe(true);
  expect(a.view().phase).toBe('reward-pending');
  const stale = {
    type: 'claim-reward' as const,
    adventureId: a.view().adventureId,
    expectedRevision: 0,
    nodeId: 'start',
    rewardId: 'flavor',
    claimId: before.rewards[1]!.claimId,
    recipientMemberId: 'hero-2',
  };
  expect(a.dispatch(stale).ok).toBe(false);
  expect(dispatch(a, { ...stale, nodeId: 'clearing' }).ok).toBe(false);
  expect(claim(a, 0, 'hero-1').ok).toBe(true);
  expect(a.view().phase).toBe('exploration');
});
it('real multiclass split and racial caps survive the adapter', () => {
  const f = rewardFixture(9001),
    rt = new Runtime(f.pack),
    c = rt.createCharacter({ name: 'Capped', race: 'hillfolk', classes: ['warden', 'hexer'] });
  c.state.hp = { current: 3, temp: 4 };
  const a = createAdventure(f.pack, f.definition, {
    ...f.options,
    members: [{ memberId: 'hero-1', character: serializeCharacter(rt, c.state) }],
  });
  expect(claim(a, 0, 'hero-1').ok).toBe(true);
  expect(a.serialize().members[0]!.character.state.classes).toEqual([
    { id: 'warden', level: 3, xp: 4501 },
    { id: 'hexer', level: 2, xp: 4500 },
  ]);
});
import { serializeCharacter } from '../../../src/runtime';
