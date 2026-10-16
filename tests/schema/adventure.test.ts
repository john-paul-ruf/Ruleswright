import { describe, expect, it } from 'vitest';
import {
  packContentHash,
  validateAdventureTemplate,
  validateAdventureDefinition,
  type AdventureTemplate,
  type AdventureDefinition,
} from '../../src/schema';
import { cloneRuntimePack } from '../runtime/fixtures/pack';

type Mutable<T> = T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
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

const paths = (errors: { jsonPath: string }[]) => errors.map((e) => e.jsonPath);
describe('CA-03 portable adventure inputs', () => {
  it('F-RA-01: preserves exact empty setup seeds in template and host definition after JSON', () => {
    const { pack, template, definition } = adventureFixture();
    for (const doc of [template, JSON.parse(JSON.stringify(template))]) {
      expect(validateAdventureTemplate(pack, doc)).toEqual([]);
      expect(doc.locations.watch.encounter.seed).toBe('');
    }
    for (const doc of [definition, JSON.parse(JSON.stringify(definition))]) {
      expect(validateAdventureDefinition(pack, doc)).toEqual([]);
      expect(doc.nodes[1]!.encounter!.seed).toBe('');
    }
  });
  it('collects multiple located shape and reference failures without partial acceptance', () => {
    const { pack, template } = adventureFixture();
    expect(
      paths(
        validateAdventureTemplate(pack, { ...template, version: 0, extra: true, facts: { bad: Infinity } }),
      ),
    ).toEqual(['facts.bad', 'version', 'extra']);
    const t = structuredClone(template) as Mutable<AdventureTemplate>;
    t.construction.entry.tableId = 'missing';
    t.locations.watch!.rewardIds = ['missing'];
    expect(paths(validateAdventureTemplate(pack, t))).toEqual(
      expect.arrayContaining(['construction.entry.tableId', 'locations.watch.rewardIds[0]']),
    );
  });
  const badTemplates: [string, (t: Mutable<AdventureTemplate>) => void, string][] = [
    [
      'foreign identity',
      (t) => {
        t.pack.contentHash = '00000000';
      },
      'pack',
    ],
    [
      'version',
      (t) => {
        t.schemaVersion = 2 as 1;
      },
      'schemaVersion',
    ],
    [
      'id grammar',
      (t) => {
        t.id = 'Bad';
      },
      'id',
    ],
    [
      'min too high',
      (t) => {
        t.nodeBounds.min = 4;
      },
      'nodeBounds',
    ],
    [
      'max too low',
      (t) => {
        t.nodeBounds.max = 3;
      },
      'nodeBounds',
    ],
    [
      'inverted bounds',
      (t) => {
        t.nodeBounds = { min: 5, max: 4 };
      },
      'nodeBounds',
    ],
    [
      'unsafe bound',
      (t) => {
        t.nodeBounds.max = Infinity;
      },
      'nodeBounds.max',
    ],
    [
      'duplicate base node',
      (t) => {
        t.construction.spine[0]!.id = 'start';
      },
      'construction.nodes[1]',
    ],
    [
      'duplicate branch node',
      (t) => {
        t.construction.branches[0]!.nodes[0]!.id = 'start';
      },
      'construction.nodes[3]',
    ],
    [
      'duplicate branches',
      (t) => {
        t.construction.branches.push(t.construction.branches[0]!);
      },
      'construction.branches[1]',
    ],
    [
      'backward branch',
      (t) => {
        t.construction.branches[0]!.fromNodeId = 'home';
      },
      'construction.branches[0]',
    ],
    [
      'branch anchor not base',
      (t) => {
        t.construction.branches[0]!.toNodeId = 'side';
      },
      'construction.branches[0]',
    ],
    [
      'empty branch',
      (t) => {
        t.construction.branches[0]!.nodes = [];
      },
      'construction.branches[0].nodes',
    ],
    [
      'missing branch table',
      (t) => {
        t.construction.branches[0]!.nodes[0]!.tableId = 'missing';
      },
      'construction.branches[0].nodes[0].tableId',
    ],
    [
      'zero descriptor weight',
      (t) => {
        t.tables.arrival!.entries[0]!.weight = 0;
      },
      'tables.arrival.entries[0].weight',
    ],
    [
      'fractional descriptor weight',
      (t) => {
        t.tables.arrival!.entries[0]!.weight = 1.5;
      },
      'tables.arrival.entries[0].weight',
    ],
    [
      'oversized descriptor total',
      (t) => {
        t.tables.arrival!.entries = [
          { weight: 4294967296, value: 'clearing' },
          { weight: 1, value: 'clearing' },
        ];
      },
      'tables.arrival',
    ],
    [
      'oversized branch total',
      (t) => {
        t.construction.branches[0]!.includeWeight = 4294967296;
        t.construction.branches[0]!.omitWeight = 1;
      },
      'construction.branches[0].includeWeight',
    ],
    [
      'zero include',
      (t) => {
        t.construction.branches[0]!.includeWeight = 0;
      },
      'construction.branches[0].includeWeight',
    ],
    [
      'negative omit',
      (t) => {
        t.construction.branches[0]!.omitWeight = -1;
      },
      'construction.branches[0].omitWeight',
    ],
    [
      'missing descriptor',
      (t) => {
        t.tables.arrival!.entries[0]!.value = 'missing';
      },
      'tables.arrival.entries[0].value',
    ],
    [
      'empty text ref',
      (t) => {
        t.fragments.forward = '';
      },
      'construction.continueTextRef',
    ],
    [
      'missing branch text',
      (t) => {
        t.construction.branches[0]!.choiceTextRef = 'missing';
      },
      'construction.branches[0].choiceTextRef',
    ],
    [
      'missing setup',
      (t) => {
        delete t.locations.watch!.encounter;
      },
      'locations.watch.encounter',
    ],
    [
      'forbidden setup',
      (t) => {
        t.locations.clearing!.encounter = t.locations.watch!.encounter;
      },
      'locations.clearing.encounter',
    ],
    [
      'unaffordable setup',
      (t) => {
        t.locations.watch!.encounter!.budget = 1;
      },
      'locations.watch.encounter.budget',
    ],
    [
      'capacity',
      (t) => {
        t.locations.watch!.encounter!.budget = 4;
      },
      'locations.watch.encounter.maxEnemies',
    ],
    [
      'nonfinite setup seed',
      (t) => {
        t.locations.watch!.encounter!.seed = Infinity;
      },
      'locations.watch.encounter.seed',
    ],
    [
      'duplicate reward',
      (t) => {
        t.rewards.push(t.rewards[0]!);
      },
      'rewards[1]',
    ],
    [
      'duplicate node reward',
      (t) => {
        t.locations.watch!.rewardIds.push('cache');
      },
      'locations.watch.rewardIds[1]',
    ],
    [
      'negative XP',
      (t) => {
        t.rewards[0]!.xpPerMember = -1;
      },
      'rewards[0].xpPerMember',
    ],
    [
      'unsafe XP',
      (t) => {
        t.rewards[0]!.xpPerMember = Number.MAX_SAFE_INTEGER + 1;
      },
      'rewards[0].xpPerMember',
    ],
    [
      'unknown loot',
      (t) => {
        t.rewards[0]!.loot = { tableId: 'missing', recipient: 'host-choice' };
      },
      'rewards[0].loot.tableId',
    ],
    [
      'missing final pass',
      (t) => {
        t.director.priorities.pop();
      },
      'director.priorities',
    ],
    [
      'duplicate pass',
      (t) => {
        t.director.priorities.unshift({ kind: 'pass' });
      },
      'director.priorities',
    ],
    [
      'unknown action',
      (t) => {
        t.director.priorities[0] = { kind: 'action', actionId: 'missing' };
      },
      'director.priorities[0].actionId',
    ],
    [
      'wrong move root',
      (t) => {
        t.director.priorities[0] = { kind: 'move', actionId: 'strike' };
      },
      'director.priorities[0].actionId',
    ],
    [
      'triggered priority',
      (t) => {
        t.director.priorities[0] = { kind: 'action', actionId: 'step-aside' };
      },
      'director.priorities[0].actionId',
    ],
    [
      'nontriggered reaction',
      (t) => {
        t.director.reactionPriority = ['strike'];
      },
      'director.reactionPriority[0]',
    ],
    [
      'duplicate reaction',
      (t) => {
        t.director.reactionPriority.push('vengeful-strike');
      },
      'director.reactionPriority[1]',
    ],
    [
      'nearest theater',
      (t) => {
        t.director.targetOrder = 'nearest';
      },
      'director.targetOrder',
    ],
    [
      'candidate bound',
      (t) => {
        t.director.maxCandidates = 0;
      },
      'director.maxCandidates',
    ],
    [
      'stall bound',
      (t) => {
        t.director.stallLimit = 1.5;
      },
      'director.stallLimit',
    ],
    [
      'duplicate narration',
      (t) => {
        t.narration.fragments.push(t.narration.fragments[0]!);
      },
      'narration.fragments[1]',
    ],
    [
      'duplicate event type',
      (t) => {
        t.narration.fragments.push({ ...t.narration.fragments[0]!, id: 'another' });
      },
      'narration.fragments.eventType[1]',
    ],
    [
      'duplicate slot',
      (t) => {
        t.narration.fragments[0]!.slots.push(t.narration.fragments[0]!.slots[0]!);
      },
      'narration.fragments[0].slots[1]',
    ],
    [
      'missing placeholder',
      (t) => {
        t.narration.fragments[0]!.text = 'Plain text';
      },
      'narration.fragments[0].slots',
    ],
    [
      'unknown placeholder',
      (t) => {
        t.narration.fragments[0]!.text += '{missing}';
      },
      'narration.fragments[0].slots',
    ],
    [
      'unknown fact',
      (t) => {
        t.narration.fragments[0]!.slots[0]!.path = 'facts.missing';
      },
      'narration.fragments[0].slots[0].path',
    ],
    [
      'arbitrary path',
      (t) => {
        t.narration.fragments[0]!.slots[0]!.path = 'actor.secret';
      },
      'narration.fragments[0].slots[0].path',
    ],
  ];
  it.each(badTemplates)('rejects %s at %s', (_name, edit, path) => {
    const { pack, template } = adventureFixture();
    edit(template as Mutable<AdventureTemplate>);
    expect(paths(validateAdventureTemplate(pack, template))).toContain(path);
  });
  const badDefinitions: [string, (d: Mutable<AdventureDefinition>) => void, string][] = [
    [
      'digest',
      (d) => {
        d.contentHash = '00000000';
      },
      'contentHash',
    ],
    [
      'foreign template',
      (d) => {
        d.template.id = 'foreign';
      },
      'template.id',
    ],
    [
      'missing start',
      (d) => {
        d.startNodeId = 'missing';
      },
      'startNodeId',
    ],
    [
      'missing success',
      (d) => {
        d.successNodeId = 'guard';
      },
      'successNodeId',
    ],
    [
      'duplicate node',
      (d) => {
        d.nodes[1]!.id = 'start';
      },
      'nodes[1]',
    ],
    [
      'duplicate choice',
      (d) => {
        d.nodes[0]!.choices.push(d.nodes[0]!.choices[0]!);
      },
      'nodes[0].choices[1]',
    ],
    [
      'unknown destination',
      (d) => {
        d.nodes[0]!.choices[0]!.toNodeId = 'missing';
      },
      'nodes[0].choices[0].toNodeId',
    ],
    [
      'unreachable node',
      (d) => {
        d.nodes[0]!.choices[0]!.toNodeId = 'home';
      },
      'nodes[1].id',
    ],
    [
      'dead end',
      (d) => {
        d.nodes[1]!.choices = [];
      },
      'nodes[1].choices',
    ],
    [
      'cycle',
      (d) => {
        d.nodes[1]!.choices[0]!.toNodeId = 'start';
      },
      'nodes',
    ],
    [
      'success edges',
      (d) => {
        d.nodes[2]!.choices = [{ id: 'continue', text: 'Back', toNodeId: 'start' }];
      },
      'nodes[2].choices',
    ],
    [
      'success rest',
      (d) => {
        d.nodes[2]!.rest = 'once';
      },
      'nodes[2]',
    ],
    [
      'success preparation',
      (d) => {
        d.nodes[2]!.preparation = true;
      },
      'nodes[2]',
    ],
    [
      'multiple success',
      (d) => {
        d.nodes[1]!.kind = 'success';
      },
      'successNodeId',
    ],
  ];
  it.each(badDefinitions)('rejects definition %s', (_name, edit, path) => {
    const { pack, definition } = adventureFixture();
    edit(definition as Mutable<AdventureDefinition>);
    expect(paths(validateAdventureDefinition(pack, definition))).toContain(path);
  });
  it('accepts the exact weight limit, fallback narration, scalar node overrides and reused continue ids', () => {
    const { pack, template, definition } = adventureFixture();
    const t = structuredClone(template) as Mutable<AdventureTemplate>;
    t.tables.arrival!.entries[0]!.weight = 4294967296;
    t.construction.branches[0]!.includeWeight = 4294967296;
    t.narration.fragments = [];
    expect(validateAdventureTemplate(pack, t)).toEqual([]);
    expect(validateAdventureDefinition(pack, definition)).toEqual([]);
  });
  it('delegates spatial capacity, terrain and model checks to EncounterSetup', () => {
    const { pack, template } = adventureFixture();
    pack.spatial = { model: 'hex', reach: { default: 1 }, terrain: { wall: { blocks: true } } };
    const t = template as Mutable<AdventureTemplate>;
    t.pack.contentHash = packContentHash(pack);
    t.locations.watch!.encounter!.layout = {
      kind: 'spatial',
      model: 'grid',
      allies: [{ x: 0, y: 0 }],
      enemies: [{ x: 0, y: 0 }],
      terrain: [{ at: { x: 0, y: 0 }, kind: 'missing' }],
    };
    expect(paths(validateAdventureTemplate(pack, t))).toEqual(
      expect.arrayContaining([
        'locations.watch.encounter.layout.model',
        'locations.watch.encounter.layout',
        'locations.watch.encounter.layout.terrain[0].kind',
      ]),
    );
    t.locations.watch!.encounter!.layout = {
      kind: 'spatial',
      model: 'hex',
      allies: [{ x: 0, y: 0 }],
      enemies: [{ x: 1, y: 0 }],
      terrain: [],
    };
    t.director.targetOrder = 'nearest';
    expect(validateAdventureTemplate(pack, t)).toEqual([]);
  });
  it.each(['weight', 'ref', 'item', 'qty', 'cycle', 'depth', 'range'])(
    'rejects unsafe nested loot %s before any roll',
    (kind) => {
      const { pack, template } = adventureFixture();
      pack.tables.root = { kind: 'nested', entries: [{ value: 'tables.leaf' }] };
      pack.tables.leaf = { kind: 'weighted', entries: [{ weight: 1, value: { id: 'rope', qty: 1 } }] };
      if (kind === 'weight')
        pack.tables.leaf.entries = [
          { weight: 4294967296, value: 'flavor' },
          { weight: 1, value: null },
        ];
      if (kind === 'ref') pack.tables.root.entries[0]!.value = 'missing';
      if (kind === 'item') pack.tables.leaf.entries[0]!.value = { id: 'missing', qty: 1 };
      if (kind === 'qty') pack.tables.leaf.entries[0]!.value = { id: 'rope', qty: 0 };
      if (kind === 'cycle') pack.tables.root.entries[0]!.value = 'root';
      if (kind === 'range')
        pack.tables.leaf = { kind: 'ranged', entries: [{ min: 1, max: 99, value: 'flavor' }] };
      if (kind === 'depth') {
        for (let i = 0; i < 8; i++)
          pack.tables[`level-${i}`] = {
            kind: 'nested',
            entries: [{ value: i === 7 ? 'leaf' : `level-${i + 1}` }],
          };
        pack.tables.root.entries[0]!.value = 'level-0';
      }
      const t = template as Mutable<AdventureTemplate>;
      t.pack.contentHash = packContentHash(pack);
      t.rewards[0]!.loot!.tableId = 'root';
      expect(validateAdventureTemplate(pack, t).some((e) => e.jsonPath.startsWith('tables.'))).toBe(true);
    },
  );
});
