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

import * as distRuntime from '../../dist/runtime.js';
import type * as SourceRuntime from '../../src/runtime';
// The two declarations carry distinct private class brands; functions still come from dist.
const builtRuntime = distRuntime as unknown as typeof SourceRuntime;
import * as builtCompiler from '../../dist/compiler.js';
import { createRequire } from 'node:module';
import { generatedJourney, fixtureJourney } from './adventure-oracle';
it('CAP-03/04 real built generated branch → two fights → level change → complete, continuous and reopened', () => {
  expect(generatedJourney(true, builtRuntime, builtCompiler)).toEqual(
    generatedJourney(false, builtRuntime, builtCompiler),
  );
}, 10000);
it('CA-04 real built reaction, pending/claimed/no-item restart, retry and preserved resources in second fight', () => {
  expect(fixtureJourney(true, builtRuntime)).toEqual(fixtureJourney(false, builtRuntime));
}, 10000);
it('the same complete manual journey runs through the built CJS exports', () => {
  const require = createRequire(import.meta.url);
  const cjs = require('../../dist/runtime.cjs') as typeof builtRuntime,
    compiler = require('../../dist/compiler.cjs') as typeof builtCompiler;
  expect(generatedJourney(true, cjs, compiler)).toEqual(generatedJourney(false, builtRuntime, builtCompiler));
}, 10000);
