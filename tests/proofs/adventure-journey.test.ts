import { expect, it } from 'vitest';
import {
  generateCampaign,
  loadTheme,
  generateAdventure,
  loadAdventureTemplate,
} from '../../dist/compiler.js';
import { Runtime, serializeCharacter, createAdventure, restoreAdventure } from '../../dist/runtime.js';
import { finishEncounter } from '../runtime/adventure/fixtures';

it.each([false, true])(
  'CA-03 built generated encounter, rewards=%s, real settlement and JSON reopen',
  (rewards) => {
    const pack = generateCampaign({ theme: loadTheme('dark-fantasy'), seed: 42 }),
      original = loadAdventureTemplate('dark-fantasy', pack);
    const template = {
      ...original,
      locations: {
        ...original.locations,
        gate: {
          ...original.locations['gate']!,
          rewardIds: rewards ? original.locations['gate']!.rewardIds : [],
        },
      },
    };
    const definition = generateAdventure({ pack, template, seed: 42 }),
      runtime = new Runtime(pack),
      hero = runtime.createCharacter({ name: 'Warden', race: 'ashkin', classes: ['warden'] });
    let a = createAdventure(pack, definition, {
      adventureId: 'generated',
      seed: 42,
      members: [{ memberId: 'hero', character: serializeCharacter(runtime, hero.state) }],
    });
    const choice = a.view().choices.find((c) => c.toNodeId === 'gate')!;
    expect(
      a.dispatch({
        type: 'choose',
        adventureId: 'generated',
        expectedRevision: 0,
        nodeId: a.view().nodeId,
        choiceId: choice.choiceId,
      }).ok,
    ).toBe(true);
    expect(a.view().phase).toBe('encounter');
    expect(a.serialize().activeEncounter!.encounter.setup.seed).toBe('');
    a = restoreAdventure(pack, definition, JSON.parse(JSON.stringify(a.serialize())));
    finishEncounter(a);
    expect(a.view().phase).toBe(rewards ? 'reward-pending' : 'exploration');
    const saved = a.serialize();
    expect(saved.encounterReceipts[0]!.receipt.result).toBe('victory');
    expect(saved.rewards).toHaveLength(rewards ? 1 : 0);
    a = restoreAdventure(pack, definition, JSON.parse(JSON.stringify(saved)));
    expect(a.serialize()).toEqual(saved);
    expect(a.view().choices[0]!.available).toBe(!rewards);
  },
  10000,
);
