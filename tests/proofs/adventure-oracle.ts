/** Shared source/Vite oracle. Built journeys pass the actual dist entry explicitly. */
import * as runtimeApi from '../../src/runtime';
import * as compilerApi from '../../src/compiler';
import { packContentHash } from '../../src/schema';
import type { AdventureCommand, AdventureSnapshot } from '../../src/runtime';
import { encounterCommand, rewardFixture, rehash, soloRewardFixture } from '../runtime/adventure/fixtures';

function demand(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
// Generated combat now respects missed attacks and emits verdicts before damage.
// Re-keyed (generated only) for v1.8 bundled content: budgets, XP rewards, class ability arrays.
export const ADVENTURE_DIGESTS = { generated: '206fc28a', fixture: '73ce0727' };
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
        // v1.8 content: watch-cache 1000 XP + delivery-cache 1500 XP on top of the seeded 975.
        m.character.state.classes[0]!.level === 3 &&
        m.character.state.classes[0]!.xp === 3475 &&
        m.character.state.hp.current === 19 - i &&
        m.character.state.hp.temp === 3 + i &&
        JSON.stringify(m.character.state.slots['1']) === JSON.stringify([null, 'ward-sigil', null, null]),
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

export function soloJourney(
  reopen = false,
  api: Pick<
    typeof runtimeApi,
    'createAdventure' | 'restoreAdventure' | 'advanceSolo' | 'readNarration'
  > = runtimeApi,
  budget = 10,
) {
  const f = soloRewardFixture();
  let adventure = api.createAdventure(f.pack, f.definition, f.options);
  const snapshots: AdventureSnapshot[] = [adventure.serialize()],
    results: unknown[] = [];
  const messages: runtimeApi.NarrationMessage[] = [];
  let sawPlayerOffer = false,
    decisions = 0;
  const perform = (command: AdventureCommand) => {
    const result = adventure.dispatch(command);
    demand(result.ok, JSON.stringify(result));
    results.push(result);
    snapshots.push(adventure.serialize());
  };
  for (let step = 0; step < 1000; step++) {
    if (reopen)
      adventure = api.restoreAdventure(
        f.pack,
        f.definition,
        JSON.parse(JSON.stringify(adventure.serialize())),
      );
    const solo = api.advanceSolo(adventure, { maxSteps: budget });
    demand(solo.stepsUsed <= budget, 'Director exceeded caller budget');
    decisions += solo.stepsUsed;
    results.push(solo);
    snapshots.push(adventure.serialize());
    if (solo.reason === 'budget-exhausted') continue;
    const unread = api.readNarration(adventure),
      beforeRead = adventure.serialize();
    demand(
      JSON.stringify(api.readNarration(adventure)) === JSON.stringify(unread),
      'Reads must repeat exactly',
    );
    messages.push(...unread);
    if (unread.length) {
      perform({
        type: 'ack-narration',
        adventureId: beforeRead.adventureId,
        expectedRevision: beforeRead.revision,
        throughSequence: unread[unread.length - 1]!.sequence,
      });
      demand(
        JSON.stringify(adventure.serialize()) ===
          JSON.stringify({
            ...beforeRead,
            revision: beforeRead.revision + 1,
            narrationAck: beforeRead.sequence,
          }),
        'Ack changes only cursor and revision',
      );
      demand(api.readNarration(adventure).length === 0, 'Acknowledged messages must not repeat');
    }
    if (solo.reason === 'completed') break;
    demand(
      solo.reason === 'awaiting-player' || solo.reason === 'awaiting-choice',
      'Unexpected solo terminal/stall',
    );
    const view = adventure.view(),
      base = { adventureId: view.adventureId, expectedRevision: view.revision };
    if (view.phase === 'encounter') {
      const offer = view.combat!.pendingOffers.find(
        (o) => view.combat!.state.combatants[o.actorId]!.side === 'allies',
      );
      if (offer) sawPlayerOffer = true;
      perform(encounterCommand(adventure));
    } else if (view.phase === 'reward-pending') {
      const before = adventure.serialize(),
        r = view.pendingRewards[0]!;
      demand(
        api.advanceSolo(adventure, { maxSteps: budget }).reason === 'awaiting-choice' &&
          JSON.stringify(adventure.serialize()) === JSON.stringify(before),
        'Director must not claim rewards',
      );
      perform({
        ...base,
        type: 'claim-reward',
        nodeId: r.nodeId,
        rewardId: r.rewardId,
        claimId: r.claimId,
        ...(r.roll === null ? {} : { recipientMemberId: 'hero-2' }),
      });
      const after = adventure.serialize();
      demand(
        after.members.every(
          (m, i) =>
            JSON.stringify(m.character.state.hp) === JSON.stringify(before.members[i]!.character.state.hp) &&
            m.character.state.slots['1']![1] === 'grave-light' &&
            m.character.state.slots['2']![1] === 'high-light' &&
            m.character.state.pools['stamina'] === 4 + i,
        ),
        'Actual XP claim must preserve injury/temp/indexed preparation/resources',
      );
      if (r.rewardId === 'cache')
        demand(
          after.members.every(
            (m) => m.character.state.slots['1']!.length >= 3 && m.character.state.slots['1']![2] === null,
          ),
          'New slots must remain empty',
        );
    } else {
      demand(view.phase === 'exploration', 'Host route requires exploration');
      perform({ ...base, type: 'choose', nodeId: view.nodeId, choiceId: view.choices[0]!.choiceId });
    }
  }
  const final = adventure.serialize();
  demand(
    final.phase === 'completed' && final.encounterReceipts.length === 2 && sawPlayerOffer,
    'Solo must complete two real fights with a player offer',
  );
  demand(final.director.decisions === decisions && decisions > 0, 'All automated transitions must persist');
  demand(final.members[1]!.character.state.hp.current < 11, 'Enemy damage must survive settlement');
  demand(
    final.members[1]!.character.state.inventory.some((i) => i.id === 'rope' && i.qty === 4),
    'Actual host loot grant must survive both fights',
  );
  demand(
    messages.length === final.sequence && new Set(messages.map((m) => m.messageId)).size === final.sequence,
    'Exactly one factual message per committed event',
  );
  return { ...f, snapshots, results, messages, final };
}

export const SOLO_DIGEST = '10742931';
export function soloRecording(reopen = false, budget = 10) {
  const { snapshots, results, messages, final } = soloJourney(reopen, runtimeApi, budget);
  return { snapshots, results, messages, final };
}
