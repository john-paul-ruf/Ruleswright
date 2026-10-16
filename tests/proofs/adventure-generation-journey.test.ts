/** CAP-02 real built surfaces; host JSON persistence, no runtime/play stand-in. */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import {
  generateCampaign,
  loadTheme,
  generateAdventure,
  loadAdventureTemplate,
} from '../../dist/compiler.js';
import {
  packContentHash,
  validateAdventureDefinition,
  validateAdventureTemplate,
  type AdventureTemplate,
  type AdventureDefinition,
} from '../../dist/schema.js';
import { cloneRuntimePack } from '../runtime/fixtures/pack';
function adventureFixture() {
  const pack = cloneRuntimePack();
  const template: AdventureTemplate = {
    kind: 'adventure-template',
    schemaVersion: 1,
    id: 'lantern-route',
    version: 1,
    pack: { id: pack.manifest.id, schemaVersion: 1, contentHash: packContentHash(pack) },
    nodeBounds: { min: 3, max: 4 },
    objective: { id: 'return', text: 'Return the signal lantern.' },
    tables: {
      arrival: { kind: 'weighted', entries: [{ weight: 1, value: 'clearing' }] },
      danger: { kind: 'weighted', entries: [{ weight: 1, value: 'watch' }] },
    },
    locations: {
      clearing: {
        kind: 'discovery',
        title: 'Lantern clearing',
        description: '',
        rewardIds: [],
        rest: 'once',
        preparation: true,
        facts: { place: 'clearing' },
      },
      watch: {
        kind: 'encounter',
        title: 'The silent watch',
        description: '',
        rewardIds: ['cache'],
        rest: 'none',
        preparation: false,
        facts: {},
        encounter: { budget: 2, seed: '', maxPartySize: 1, maxEnemies: 1, layout: { kind: 'theater' } },
      },
    },
    fragments: { forward: 'Follow the lanterns.', detour: 'Search the old watch.' },
    construction: {
      entry: { id: 'start', tableId: 'arrival' },
      spine: [{ id: 'guard', tableId: 'danger' }],
      terminal: { id: 'home', title: 'Home', description: '' },
      branches: [
        {
          id: 'watch',
          fromNodeId: 'start',
          toNodeId: 'home',
          nodes: [{ id: 'side', tableId: 'danger' }],
          includeWeight: 1,
          omitWeight: 0,
          choiceTextRef: 'detour',
        },
      ],
      continueTextRef: 'forward',
    },
    rewards: [
      {
        id: 'cache',
        xpPerMember: 0,
        eligible: 'party',
        loot: { tableId: 'district-scavenge', recipient: 'host-choice' },
      },
    ],
    facts: { place: 'vale' },
    director: {
      id: 'watch-policy',
      version: 1,
      priorities: [{ kind: 'action', actionId: 'strike' }, { kind: 'pass' }],
      targetOrder: 'id',
      tieBreak: 'lexical',
      reactionPriority: ['vengeful-strike'],
      maxCandidates: 30,
      stallLimit: 5,
    },
    narration: {
      fragments: [
        {
          id: 'arrival',
          eventType: 'node:entered',
          text: 'Arrived at {place}.',
          slots: [{ name: 'place', path: 'facts.place' }],
        },
      ],
    },
  };
  const body: Omit<AdventureDefinition, 'contentHash'> = {
    kind: 'adventure-definition',
    schemaVersion: 1,
    id: template.id,
    template: { id: template.id, version: 1 },
    pack: template.pack,
    seed: 'host',
    objective: template.objective,
    startNodeId: 'start',
    successNodeId: 'home',
    nodes: [
      {
        ...template.locations['clearing']!,
        id: 'start',
        choices: [{ id: 'continue', text: 'Forward', toNodeId: 'guard' }],
      },
      {
        ...template.locations['watch']!,
        id: 'guard',
        choices: [{ id: 'continue', text: 'Home', toNodeId: 'home' }],
      },
      {
        id: 'home',
        kind: 'success',
        title: 'Home',
        description: '',
        choices: [],
        rewardIds: ['cache'],
        rest: 'none',
        preparation: false,
        facts: {},
      },
    ],
    rewards: template.rewards,
    facts: template.facts,
    director: template.director,
    narration: template.narration,
  };
  return { pack, template, definition: { ...body, contentHash: packContentHash(body) } };
}

const require = createRequire(import.meta.url);
const cjs = require('../../dist/compiler.cjs') as typeof import('../../dist/compiler.js');
const cjsSchema = require('../../dist/schema.cjs') as typeof import('../../dist/schema.js');
describe('CAP-02 built ESM/CJS generation → JSON → schema boundary', () => {
  it.each(['dark-fantasy', 'zombie-urban', 'wyldwood'])(
    '%s binds and generates identical portable documents in both formats',
    (theme) => {
      const pack = generateCampaign({ theme: loadTheme(theme), seed: 42 }),
        packBytes = JSON.stringify(pack);
      const template = loadAdventureTemplate(theme, pack);
      expect(validateAdventureTemplate(pack, template)).toEqual([]);
      const outputs = [0, 1, 2, 42].map((seed) => {
        const definition = generateAdventure({ pack, template, seed });
        expect(
          JSON.stringify(
            cjs.generateAdventure({ pack, template: cjs.loadAdventureTemplate(theme, pack), seed }),
          ),
        ).toBe(JSON.stringify(definition));
        expect(JSON.stringify(generateAdventure({ pack, template, seed }))).toBe(JSON.stringify(definition));
        const reopened = JSON.parse(JSON.stringify(definition)) as AdventureDefinition;
        expect(reopened.contentHash).toBe(definition.contentHash);
        const { contentHash, ...body } = reopened;
        expect(contentHash).toBe(packContentHash(body));
        expect(validateAdventureDefinition(pack, reopened)).toEqual([]);
        expect(cjsSchema.validateAdventureDefinition(pack, reopened)).toEqual([]);
        expect(reopened.nodes.find((n) => n.id === 'gate')!.encounter!.seed).toBe('');
        expect(reopened.pack.contentHash).toBe(packContentHash(pack));
        return reopened;
      });
      expect(new Set(outputs.map((d) => d.nodes[0]!.title)).size).toBeGreaterThan(1);
      expect(new Set(outputs.map((d) => d.nodes.length)).size).toBe(2);
      expect(JSON.stringify(pack)).toBe(packBytes);
    },
    10000,
  );
  it('supports a compatible hand-authored theater pack and template, including exact empty setup seeds', () => {
    const { pack, template } = adventureFixture();
    const first = generateAdventure({ pack, template, seed: 'host-definition' });
    expect(first.id).toBe('lantern-route');
    expect(first.pack.id).toBe('test-vale');
    expect(first.nodes.find((n) => n.id === 'guard')!.encounter!.seed).toBe('');
    const saved = JSON.stringify(first),
      reopened = JSON.parse(saved);
    expect(JSON.stringify(generateAdventure({ pack, template, seed: 'host-definition' }))).toBe(saved);
    expect(JSON.stringify(cjs.generateAdventure({ pack, template, seed: 'host-definition' }))).toBe(saved);
    expect(validateAdventureDefinition(pack, reopened)).toEqual([]);
    expect(reopened.contentHash).toBe(first.contentHash);
    expect(reopened.nodes[1].encounter.seed).toBe('');
    const changed = generateAdventure({ pack, template, seed: 'other-domain' });
    expect(changed.seed).not.toBe(first.seed);
    expect(changed.nodes[1]!.encounter!.seed).toBe('');
    const bad = JSON.parse(saved);
    bad.nodes[1].encounter.seed = null;
    expect(validateAdventureDefinition(pack, bad).some((e) => e.jsonPath === 'nodes[1].encounter.seed')).toBe(
      true,
    );
  }, 10000);
});
