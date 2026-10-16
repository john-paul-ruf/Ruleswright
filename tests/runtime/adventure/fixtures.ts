import type { AdventureDefinition, AdventureStartOptions } from '../../../src/schema/adventure';
import type { Adventure, AdventureCommand } from '../../../src/runtime/adventure/types';
import { packContentHash } from '../../../src/schema/version';
import { playFixture } from '../play/fixtures';

export function adventureFixture() {
  const { pack, options: encounterOptions } = playFixture();
  const body: Omit<AdventureDefinition, 'contentHash'> = {
    kind: 'adventure-definition',
    schemaVersion: 1,
    id: 'lantern-route',
    template: { id: 'lantern-route', version: 1 },
    pack: encounterOptions.members[0]!.character.pack,
    seed: 'definition',
    objective: { id: 'home', text: 'Carry the lantern home.' },
    startNodeId: 'start',
    successNodeId: 'home',
    nodes: ['start', 'clearing', 'home'].map((id, i, ids) => ({
      id,
      kind: i === 2 ? 'success' : 'discovery',
      title: id,
      description: '',
      choices: i === 2 ? [] : [{ id: 'continue', text: 'Continue', toNodeId: ids[i + 1]! }],
      rewardIds: [],
      rest: 'none',
      preparation: false,
      facts: {},
    })),
    rewards: [],
    facts: {},
    director: {
      id: 'manual',
      version: 1,
      priorities: [{ kind: 'action', actionId: 'strike' }, { kind: 'pass' }],
      targetOrder: 'id',
      tieBreak: 'lexical',
      reactionPriority: [],
      maxCandidates: 20,
      stallLimit: 5,
    },
    narration: { fragments: [] },
  };
  const definition = { ...body, contentHash: packContentHash(body) };
  const options: AdventureStartOptions = {
    adventureId: 'adventure',
    seed: 42,
    members: encounterOptions.members,
  };
  return { pack, definition, options, encounterOptions };
}
export function rehash(definition: AdventureDefinition): AdventureDefinition {
  const body: Partial<AdventureDefinition> = { ...definition };
  Reflect.deleteProperty(body, 'contentHash');
  return { ...definition, contentHash: packContentHash(body) };
}
type Body<T = AdventureCommand> = T extends AdventureCommand
  ? Omit<T, 'adventureId' | 'expectedRevision'>
  : never;
export function dispatch(adventure: Adventure, body: Body) {
  return adventure.dispatch({
    ...body,
    adventureId: adventure.view().adventureId,
    expectedRevision: adventure.view().revision,
  } as AdventureCommand);
}
export function choose(adventure: Adventure, choiceId = 'continue') {
  return dispatch(adventure, { type: 'choose', nodeId: adventure.view().nodeId, choiceId });
}

export function combatFixture(reward = false) {
  const f = adventureFixture();
  f.pack.actions['strike']!.effect = 'damage(100)';
  const identity = { ...f.definition.pack, contentHash: packContentHash(f.pack) };
  const options = {
    ...f.options,
    members: f.options.members.map((m) => ({ ...m, character: { ...m.character, pack: identity } })),
  };
  const definition = rehash({
    ...f.definition,
    pack: identity,
    nodes: f.definition.nodes.map((n) =>
      n.id === 'clearing'
        ? {
            ...n,
            kind: 'encounter' as const,
            encounter: f.encounterOptions.setup,
            rewardIds: reward ? ['cache'] : [],
          }
        : n,
    ),
    rewards: reward
      ? [
          {
            id: 'cache',
            xpPerMember: 25,
            eligible: 'party',
            loot: { tableId: 'district-scavenge', recipient: 'host-choice' },
          },
        ]
      : [],
  });
  return { ...f, definition, options };
}
export function encounterCommand(adventure: Adventure): Extract<AdventureCommand, { type: 'encounter' }> {
  const saved = adventure.serialize(),
    nested = saved.activeEncounter!,
    view = adventure.view(),
    combat = view.combat!;
  const base = { sessionId: nested.sessionId, expectedRevision: nested.revision };
  const offer = combat.pendingOffers[0];
  const actor = (id: string) =>
    id.startsWith('m:')
      ? { kind: 'member' as const, memberId: id.slice(2) }
      : { kind: 'enemy' as const, enemyId: id };
  const active = combat.state.combatants[combat.state.active]!;
  const target = Object.values(combat.state.combatants).find(
    (c) => c.side !== active.side && c.hp.current > 0,
  );
  const command = offer
    ? {
        ...base,
        type: 'respond' as const,
        actor: actor(offer.actorId),
        triggerId: offer.triggerId,
        choice: 'decline' as const,
      }
    : !nested.encounter.control.turnStarted || combat.state.phase === 'resolved'
      ? { ...base, type: 'advance' as const }
      : active.side === 'enemies'
        ? { ...base, type: 'pass' as const, actor: actor(active.id) }
        : {
            ...base,
            type: 'declare' as const,
            actor: actor(active.id),
            actionId: active.actions[0]!,
            options: { targetId: target!.id },
          };
  return {
    type: 'encounter',
    adventureId: saved.adventureId,
    expectedRevision: saved.revision,
    encounterId: nested.encounter.encounterId,
    command,
  };
}
export function finishEncounter(adventure: Adventure, limit = 1000) {
  for (let i = 0; i < limit; i++) {
    if (adventure.view().phase !== 'encounter') return;
    const result = adventure.dispatch(encounterCommand(adventure));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
  }
  throw new Error('Adventure encounter exceeded host step limit');
}

import { Runtime, serializeCharacter } from '../../../src/runtime';
export function rewardFixture(xp = 1000, hp = 7, decreasing = false) {
  const f = adventureFixture(),
    pack = f.pack;
  pack.progression['warden']!.slots = { '1': [2, 3, 3, 4], '2': [2, 3, 3, 4] };
  pack.progression['hexer']!.slots = { '1': decreasing ? [2, 1, 1, 1] : [2, 3, 3, 4], '2': [2, 3, 3, 4] };
  pack.content.spells!['high-light'] = {
    ...pack.content.spells!['grave-light']!,
    name: 'High Light',
    magic: { level: 2, lists: ['hexer'] },
  };
  pack.tables['prize'] = { kind: 'weighted', entries: [{ weight: 1, value: { id: 'rope', qty: 2 } }] };
  const rt = new Runtime(pack);
  rt.createCharacter({ name: 'Unrelated', race: 'ashkin', classes: ['warden'] });
  const members = ['warden', decreasing ? 'hexer' : 'warden'].map((id, i) => {
    const c = rt.createCharacter({ name: 'Same name', race: 'ashkin', classes: [id] });
    c.state.hp = { current: hp - i, temp: 3 + i };
    c.prepare('grave-light', 1);
    c.prepare('high-light', 1);
    c.state.pools['stamina'] = 4 + i;
    c.applyCondition('dazzed');
    c.learnFeat('ironhide');
    c.grant('ward-ring');
    c.equip('ward-ring', 'ring');
    c.grant('mend-draught', 2);
    return { memberId: `hero-${i + 1}`, character: serializeCharacter(rt, c.state) };
  });
  const identity = members[0]!.character.pack;
  const definition = rehash({
    ...f.definition,
    pack: identity,
    nodes: f.definition.nodes.map((n) =>
      n.id === 'start'
        ? { ...n, rewardIds: ['cache', 'flavor', 'nothing'], rest: 'once', preparation: true }
        : n,
    ),
    rewards: [
      {
        id: 'cache',
        xpPerMember: xp,
        eligible: 'party',
        loot: { tableId: 'prize', recipient: 'host-choice' },
      },
      {
        id: 'flavor',
        xpPerMember: 0,
        eligible: 'party',
        loot: { tableId: 'wandering-dread', recipient: 'host-choice' },
      },
      { id: 'nothing', xpPerMember: 0, eligible: 'party', loot: null },
    ],
  });
  return { pack, definition, options: { adventureId: 'reward-adventure', seed: 42, members }, runtime: rt };
}
export function claim(adventure: Adventure, index = 0, recipientMemberId?: string) {
  const r = adventure.serialize().rewards[index]!;
  return dispatch(adventure, {
    type: 'claim-reward',
    nodeId: r.nodeId,
    rewardId: r.rewardId,
    claimId: r.claimId,
    ...(recipientMemberId === undefined ? {} : { recipientMemberId }),
  });
}

export function departureFixture() {
  const f = combatFixture();
  f.pack.spatial = { model: 'hex', reach: { default: 1 }, shapes: ['single', 'burst'] };
  f.pack.formulas['speed'] = { expr: '3' };
  f.pack.economy!.turnSlots!['reaction'] = 1;
  f.pack.actions['stride'] = { cost: { slots: { move: 1 } }, effect: 'move(speed)', tags: ['move'] };
  f.pack.actions['departure'] = {
    cost: { slots: { reaction: 1 } },
    effect: 'damage(1)',
    tags: ['reaction'],
    trigger: { on: 'move:leaving-reach[target=self]' },
  };
  f.pack.content.classes!['warden']!.actions!.push('stride');
  for (const monster of Object.values(f.pack.bestiary)) monster.actions.push('departure');
  const identity = { ...f.definition.pack, contentHash: packContentHash(f.pack) };
  const definition = rehash({
    ...f.definition,
    pack: identity,
    nodes: f.definition.nodes.map((n) =>
      n.encounter
        ? {
            ...n,
            encounter: {
              ...n.encounter,
              layout: {
                kind: 'spatial' as const,
                model: 'hex' as const,
                allies: [{ x: 0, y: 0 }],
                enemies: [{ x: 0, y: 1 }],
                terrain: [],
              },
            },
          }
        : n,
    ),
  });
  return {
    pack: f.pack,
    definition,
    options: {
      ...f.options,
      members: f.options.members.map((m) => ({ ...m, character: { ...m.character, pack: identity } })),
    },
  };
}
