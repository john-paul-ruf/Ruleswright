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
