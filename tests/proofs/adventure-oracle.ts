/** Shared source/Vite oracle. Built journeys pass the actual dist entry explicitly. */
import * as runtimeApi from '../../src/runtime';
import * as compilerApi from '../../src/compiler';
import { packContentHash } from '../../src/schema';
import type { AdventureCommand, AdventureSnapshot } from '../../src/runtime';
import { encounterCommand, rewardFixture, rehash } from '../runtime/adventure/fixtures';

function demand(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
export const ADVENTURE_DIGESTS = { generated: 'c1dd4968', fixture: 'a2f68c27' };
export function generatedJourney(reopen = false, api = runtimeApi, compiler = compilerApi) {
  const pack = compiler.generateCampaign({ theme: compiler.loadTheme('dark-fantasy'), seed: 42 });
  const definition = compiler.generateAdventure({
    pack,
    template: compiler.loadAdventureTemplate('dark-fantasy', pack),
    seed: 42,
  });
  const rt = new api.Runtime(pack);
  if (reopen) rt.createCharacter({ name: 'Not a member', race: 'ashkin', classes: ['warden'] });
  const members = [0, 1].map((i) => {
    const c = rt.createCharacter({ name: 'Warden', race: 'ashkin', classes: ['warden'] });
    api.awardXp(rt, c.state, 975);
    c.state.hp = { current: 19 - i, temp: 3 + i };
    c.prepare('ward-sigil', 1);
    return { memberId: `hero-${i + 1}`, character: api.serializeCharacter(rt, c.state) };
  });
  let adventure = api.createAdventure(pack, definition, {
    adventureId: 'generated-oracle',
    seed: 42,
    members,
  });
  const snapshots: AdventureSnapshot[] = [adventure.serialize()];
  const results: unknown[] = [];
  for (let step = 0; step < 1000; step++) {
    if (reopen)
      adventure = api.restoreAdventure(pack, definition, JSON.parse(JSON.stringify(adventure.serialize())));
    const view = adventure.view();
    if (view.phase === 'completed') break;
    let command: AdventureCommand;
    const base = { adventureId: view.adventureId, expectedRevision: view.revision };
    if (view.phase === 'encounter') command = encounterCommand(adventure);
    else if (view.phase === 'reward-pending') {
      const r = view.pendingRewards[0]!;
      command = {
        ...base,
        type: 'claim-reward',
        nodeId: r.nodeId,
        rewardId: r.rewardId,
        claimId: r.claimId,
        ...(r.roll === null ? {} : { recipientMemberId: 'hero-2' }),
      };
    } else {
      demand(
        view.phase === 'exploration',
        'Generated journey must not infer success from defeat or lack of choices',
      );
      const choice = view.choices.find((c) => c.toNodeId === 'passage') ?? view.choices[0]!;
      command = { ...base, type: 'choose', nodeId: view.nodeId, choiceId: choice.choiceId };
    }
    const result = adventure.dispatch(command);
    demand(result.ok, JSON.stringify(result));
    results.push(result);
    snapshots.push(adventure.serialize());
  }
  const final = adventure.serialize();
  demand(final.phase === 'completed', 'Generated journey exceeded 1000 commands');
  demand(final.encounterReceipts.length === 2, 'Two real fights must settle');
  demand(final.visitedNodeIds.includes('passage'), 'Must traverse the authored branch');
  demand(
    final.members.every(
      (m, i) =>
        m.character.state.classes[0]!.level === 2 &&
        m.character.state.classes[0]!.xp === 1050 &&
        m.character.state.hp.current === 19 - i &&
        m.character.state.hp.temp === 3 + i &&
        JSON.stringify(m.character.state.slots['1']) === JSON.stringify([null, 'ward-sigil', null]),
    ),
    'Real progression must retain injury and indexed preparation into the next fight',
  );
  demand(
    final.rewards.every((r) => r.status === 'claimed'),
    'All earned rewards must be claimed',
  );
  return { pack, definition, snapshots, results, final };
}
export function fixtureJourney(reopen = false, api = runtimeApi) {
  const f = rewardFixture(1000);
  f.pack.actions['strike']!.effect = 'damage(10)';
  f.pack.actions['echo'] = {
    cost: { slots: { move: 1 } },
    trigger: { on: 'damage:applied[actor=self]' },
    effect: 'damage(0)',
    tags: ['move'],
  };
  f.pack.content.classes!['warden']!.actions!.push('echo');
  for (const monster of Object.values(f.pack.bestiary))
    monster.abilityOverrides = { ...monster.abilityOverrides, vigor: 30 };
  const identity = { ...f.definition.pack, contentHash: packContentHash(f.pack) };
  const setup = { budget: 2, seed: '', maxPartySize: 2, maxEnemies: 1, layout: { kind: 'theater' as const } };
  const definition = rehash({
    ...f.definition,
    pack: identity,
    nodes: [
      f.definition.nodes[0]!,
      {
        ...f.definition.nodes[1]!,
        kind: 'encounter',
        encounter: setup,
        rewardIds: ['cache'],
        choices: [{ id: 'continue', text: 'Second watch', toNodeId: 'second' }],
      },
      {
        ...f.definition.nodes[1]!,
        id: 'second',
        kind: 'encounter',
        encounter: setup,
        rewardIds: [],
        choices: [{ id: 'continue', text: 'Home', toNodeId: 'home' }],
      },
      f.definition.nodes[2]!,
    ],
  });
  const options = {
    ...f.options,
    members: f.options.members.map((m) => ({ ...m, character: { ...m.character, pack: identity } })),
  };
  let adventure = api.createAdventure(f.pack, definition, options);
  const snapshots: AdventureSnapshot[] = [adventure.serialize()],
    results: unknown[] = [];
  let sawOffer = false;
  const perform = (command: AdventureCommand) => {
    const result = adventure.dispatch(command);
    demand(result.ok, JSON.stringify(result));
    results.push(result);
    snapshots.push(adventure.serialize());
  };
  for (let step = 0; step < 1000; step++) {
    if (reopen)
      adventure = api.restoreAdventure(f.pack, definition, JSON.parse(JSON.stringify(adventure.serialize())));
    const view = adventure.view(),
      base = { adventureId: view.adventureId, expectedRevision: view.revision };
    if (view.phase === 'completed') break;
    if (view.combat?.pendingOffers.length) sawOffer = true;
    if (view.phase === 'encounter') perform(encounterCommand(adventure));
    else if (view.phase === 'reward-pending') {
      const r = view.pendingRewards[0]!;
      perform({
        ...base,
        type: 'claim-reward',
        nodeId: r.nodeId,
        rewardId: r.rewardId,
        claimId: r.claimId,
        ...(r.roll === null ? {} : { recipientMemberId: 'hero-1' }),
      });
      const bytes = JSON.stringify(adventure.serialize());
      const retry = adventure.dispatch({
        ...base,
        expectedRevision: adventure.view().revision,
        type: 'claim-reward',
        nodeId: r.nodeId,
        rewardId: r.rewardId,
        claimId: r.claimId,
        ...(r.roll === null ? {} : { recipientMemberId: 'hero-1' }),
      });
      demand(
        retry.ok && retry.events.length === 0 && JSON.stringify(adventure.serialize()) === bytes,
        'Receipt retry must be inert',
      );
    } else {
      demand(view.phase === 'exploration', 'Unexpected terminal fixture');
      perform({ ...base, type: 'choose', nodeId: view.nodeId, choiceId: view.choices[0]!.choiceId });
    }
  }
  const final = adventure.serialize();
  demand(
    final.phase === 'completed' && final.encounterReceipts.length === 2 && sawOffer,
    'Fixture must finish two fights with an actual pending reaction',
  );
  demand(
    final.members.every(
      (m, i) =>
        m.character.state.hp.current === 7 - i &&
        m.character.state.hp.temp === 3 + i &&
        m.character.state.slots['1']![1] === 'grave-light' &&
        m.character.state.slots['2']![1] === 'high-light' &&
        m.character.state.pools['stamina'] === 4 + i,
    ),
    'Preserved reward state must enter and survive the second fight',
  );
  demand(
    final.rewards.some((r) => r.roll?.result.kind === 'no-item') &&
      final.rewards.some((r) => r.roll === null),
    'Must preserve no-item and no-loot records',
  );
  return { pack: f.pack, definition, snapshots, results, final };
}
export function oracleRecording(kind: 'generated' | 'fixture', reopen = false) {
  const journey = kind === 'generated' ? generatedJourney(reopen) : fixtureJourney(reopen);
  return { snapshots: journey.snapshots, results: journey.results, final: journey.final };
}
