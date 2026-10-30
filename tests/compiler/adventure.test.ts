import { describe, expect, it, vi } from 'vitest';
import {
  generateAdventure,
  generateCampaign,
  loadAdventureTemplate,
  loadTheme,
  GenerationError,
} from '../../src/compiler';
import { generateAdventure as builtGenerate } from '../../dist/compiler.js';
import { packContentHash, validateAdventureDefinition, validateAdventureTemplate } from '../../src/schema';
import { Rng } from '../../src/core/rng';

const themes = ['dark-fantasy', 'zombie-urban', 'wyldwood'] as const;
function fixture(theme: (typeof themes)[number] = 'dark-fantasy') {
  const pack = generateCampaign({ theme: loadTheme(theme), seed: 42 });
  return { pack, template: loadAdventureTemplate(theme, pack), seed: 2 };
}

describe('CA-03 finite seeded adventure generation', () => {
  it.each(themes)('%s retains pack identity, author policy and guaranteed route choices', (theme) => {
    const input = fixture(theme),
      before = JSON.stringify(input);
    const results = [0, 1, 2, 3, 4, 42].map((seed) => generateAdventure({ ...input, seed }));
    for (const definition of results) {
      expect(validateAdventureDefinition(input.pack, definition)).toEqual([]);
      expect(validateAdventureTemplate(input.pack, input.template)).toEqual([]);
      expect(JSON.stringify(generateAdventure({ ...input, seed: definition.seed }))).toBe(
        JSON.stringify(definition),
      );
      expect(definition.pack.contentHash).toBe(packContentHash(input.pack));
      expect(definition.template).toEqual({ id: theme, version: 1 });
      expect(definition.nodes[0]!.choices.map((c) => c.id)).toEqual(['continue', 'branch-passage']);
      expect(definition.nodes.filter((n) => n.kind === 'encounter').length).toBeGreaterThanOrEqual(2);
      expect(definition.nodes.some((n) => n.rest === 'once' && n.preparation)).toBe(true);
      expect(definition.nodes.some((n) => n.kind === 'discovery')).toBe(true);
      const terminal = definition.nodes.find((n) => n.id === definition.successNodeId)!;
      expect(terminal).toMatchObject({
        kind: 'success',
        rewardIds: [],
        choices: [],
        rest: 'none',
        preparation: false,
        facts: {},
      });
      for (const field of ['rewards', 'facts', 'director', 'narration', 'objective'] as const)
        expect(definition[field]).toEqual(input.template[field]);
    }
    expect(new Set(results.map((d) => d.nodes[0]!.title)).size).toBeGreaterThan(1);
    expect(new Set(results.map((d) => d.nodes.length)).size).toBe(2);
    expect(JSON.stringify(input)).toBe(before);
  });
  it('pins exact stream, draw order, output order and branch edges using the real RNG', () => {
    // Seed 12: the bundled recipe's v1.8 budgets changed its content hash (and so the
    // stream); 12 is the seed that again draws the full eight-node route with the dial branch.
    const input = { ...fixture(), seed: 12 },
      { template } = input;
    const expected = new Rng(
      JSON.stringify([
        'ruleswright',
        1,
        'adventure-definition',
        template.id,
        template.version,
        packContentHash(template),
        '12',
      ]),
    );
    const bounds = [2, 1, 1, 1, 1, 1, 2, 1];
    const expectedDraws = bounds.map((bound) => expected.int(bound));
    const actual: [number, number][] = [],
      original = Rng.prototype.int;
    const spy = vi.spyOn(Rng.prototype, 'int').mockImplementation(function (this: Rng, bound) {
      const value = original.call(this, bound);
      actual.push([bound, value]);
      return value;
    });
    try {
      const d = generateAdventure(input);
      expect(actual).toEqual(bounds.map((b, i) => [b, expectedDraws[i]]));
      expect(d.contentHash).toBe('9c236a19');
      expect(d.nodes.map((n) => n.id)).toEqual([
        'arrival',
        'gate',
        'refuge',
        'vault',
        'delivery',
        'passage',
        'sentry',
        'dial',
      ]);
      expect(d.nodes.map((n) => n.choices.map((c) => [c.id, c.toNodeId]))).toEqual([
        [
          ['continue', 'gate'],
          ['branch-passage', 'passage'],
        ],
        [['continue', 'refuge']],
        [
          ['continue', 'vault'],
          ['branch-dial', 'dial'],
        ],
        [['continue', 'delivery']],
        [],
        [['continue', 'sentry']],
        [['continue', 'refuge']],
        [['continue', 'vault']],
      ]);
      expect(d.nodes[0]!.title).toBe('The Wax Orchard');
      expect(d.nodes[0]!.choices[1]!.text).toBe(template.fragments['detour']);
    } finally {
      spy.mockRestore();
    }
  });
  it('omitWeight=0 adds no inclusion draw, even for a one-entry descriptor table', () => {
    const input = fixture();
    input.template = {
      ...input.template,
      construction: {
        ...input.template.construction,
        branches: input.template.construction.branches.map((b) => ({ ...b, omitWeight: 0 })),
      },
    };
    const spy = vi.spyOn(Rng.prototype, 'int');
    try {
      expect(generateAdventure(input).nodes).toHaveLength(8);
      expect(spy.mock.calls.map(([bound]) => bound)).toEqual([2, 1, 1, 1, 1, 1, 1]);
    } finally {
      spy.mockRestore();
    }
  });
  it('F-RA-01: source and fresh built generator preserve required empty seeds and reopened hashes', () => {
    const input = fixture();
    expect(input.template.locations['gate']!.encounter!.seed).toBe('');
    for (const run of [generateAdventure, builtGenerate])
      for (const seed of ['', 0, 'different-generation-seed']) {
        const definition = run({ ...input, seed }),
          reopened = JSON.parse(JSON.stringify(definition));
        expect(JSON.stringify(run({ ...input, seed }))).toBe(JSON.stringify(definition));
        expect(reopened.contentHash).toBe(definition.contentHash);
        for (const doc of [definition, reopened]) {
          expect(validateAdventureDefinition(input.pack, doc)).toEqual([]);
          expect(doc.nodes.find((n: { id: string }) => n.id === 'gate')!.encounter!.seed).toBe('');
        }
      }
  });
  it('returns detached loader and generated documents; binding is explicit, never silently changed', () => {
    const input = fixture(),
      before = JSON.stringify(input);
    const d = generateAdventure(input);
    (d.facts as Record<string, unknown>)['journey'] = 'changed';
    expect(JSON.stringify(input)).toBe(before);
    (input.template.facts as Record<string, unknown>)['journey'] = 'local';
    expect(loadAdventureTemplate('dark-fantasy', input.pack).facts['journey']).not.toBe('local');
    input.pack.manifest.title += ' revised';
    expect(() => generateAdventure(input)).toThrow(GenerationError);
    expect(loadAdventureTemplate('dark-fantasy', input.pack).pack.contentHash).toBe(
      packContentHash(input.pack),
    );
    expect(() => loadAdventureTemplate('constructor', input.pack)).toThrow(GenerationError);
  });
  it.each([NaN, Infinity, null, {}, true])('refuses invalid seed %s before draws', (seed) => {
    const input = fixture(),
      spy = vi.spyOn(Rng.prototype, 'int');
    try {
      expect(() => generateAdventure({ ...input, seed: seed as number })).toThrow(GenerationError);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
  it.each(['descriptor', 'branch', 'nested-loot', 'assembly'])(
    'refuses oversized %s bounds before RNG can hang',
    (kind) => {
      const input = fixture();
      if (kind === 'descriptor')
        input.template = {
          ...input.template,
          tables: {
            ...input.template.tables,
            arrival: {
              kind: 'weighted',
              entries: [
                { weight: 4294967296, value: 'threshold' },
                { weight: 1, value: 'landmark' },
              ],
            },
          },
        };
      if (kind === 'branch')
        input.template = {
          ...input.template,
          construction: {
            ...input.template.construction,
            branches: input.template.construction.branches.map((b) => ({
              ...b,
              includeWeight: 4294967296,
              omitWeight: 1,
            })),
          },
        };
      if (kind === 'nested-loot') {
        input.pack.tables['common-relics'] = {
          kind: 'nested',
          entries: [{ weight: 1, value: 'overflow-leaf' }],
        };
        input.pack.tables['overflow-leaf'] = {
          kind: 'weighted',
          entries: [
            { weight: 4294967296, value: 'flavor' },
            { weight: 1, value: null },
          ],
        };
      }
      if (kind === 'assembly') {
        for (const monster of Object.values(input.pack.bestiary)) monster.threat = 50000000;
        input.template = {
          ...input.template,
          locations: Object.fromEntries(
            Object.entries(input.template.locations).map(([id, loc]) => [
              id,
              loc.encounter ? { ...loc, encounter: { ...loc.encounter, budget: 50000000 } } : loc,
            ]),
          ),
        };
      }
      input.template = {
        ...input.template,
        pack: { ...input.template.pack, contentHash: packContentHash(input.pack) },
      };
      const spy = vi.spyOn(Rng.prototype, 'int');
      try {
        expect(() => generateAdventure(input)).toThrow(GenerationError);
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    },
  );
  it('refuses incompatible packs with located references and never substitutes another theme', () => {
    const input = fixture();
    delete input.pack.tables['common-relics'];
    try {
      loadAdventureTemplate('dark-fantasy', input.pack);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(GenerationError);
      expect((error as GenerationError).errors.some((e) => e.jsonPath === 'rewards[0].loot.tableId')).toBe(
        true,
      );
    }
  });
});
