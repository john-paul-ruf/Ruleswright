/**
 * Contract conformance (contract-conformance CAP-K1, CA-K1, CA-K2): the JSON
 * Schema contracts in `src/schema/contracts/` admit the named subjects below,
 * checked by an independent validator (Ajv, draft 2020-12) against the
 * committed contract files themselves — not against the hand-written
 * `validatePack` mirror. The subjects are exactly:
 *   - pack.schema.json: the three bundled themes' generated packs (seed 42) and
 *     the seven fixture packs;
 *   - snapshots.schema.json: the snapshot envelopes from the determinism
 *     oracle's nine combat legs, plus a level-1 character and party per theme;
 *   - override.schema.json: two override documents.
 * Every subject goes through JSON text first, because the JSON text is what a
 * host stores. Negative controls show the validator bites, each on its rule.
 *
 * Ajv runs with `strict: false` (DD-K2): strict mode rejects the contracts'
 * *style* (union `type`, `required` inside an `if/then`), not their validity,
 * and the contracts are DB-owned.
 *
 * Re-key rule: a new writer field, fixture or theme must keep validating. A
 * failure here is a contract↔engine disagreement: it goes back to DB (Author
 * re-entry) or is an engine bug. It is never fixed by loosening this test.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import type { ValidateFunction } from 'ajv';
import { describe, expect, it } from 'vitest';
import { generateCampaign, loadTheme } from '../../src/compiler';
import { generateAdventure, loadAdventureTemplate } from '../../dist/compiler.js';
import {
  createEncounterSession,
  restoreEncounterSession,
  Runtime,
  serializeCharacter,
  serializeParty,
} from '../../src/runtime/index';
import { LEG_RUNS, PACK_THEMES, recordingRaw, contentHashOfRaw, type LegId } from './determinism-oracle';
import {
  emberMarchesAscendingPack,
  emberMarchesHexPack,
  emberMarchesNoEconomyPack,
  emberMarchesPack,
  emberMarchesSpatialPack,
} from '../runtime/fixtures/packs';
import { cloneRuntimePack } from '../runtime/fixtures/pack';
import { clonePack } from '../schema/fixtures';
import { playFixture, send, finish } from '../runtime/play/fixtures';

import {
  packContentHash,
  validateAdventureTemplate,
  validateAdventureDefinition,
  type AdventureTemplate,
  type AdventureDefinition,
} from '../../src/schema';

type Contract = Record<string, unknown>;
type Doc = Record<string, unknown>;

function contract(name: 'pack' | 'snapshots' | 'override' | 'play-session'): Contract {
  const url = new URL(`../../src/schema/contracts/${name}.schema.json`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as Contract;
}
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function compile(schema: Contract): { validate: ValidateFunction; errorsText: () => string } {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  return { validate, errorsText: () => ajv.errorsText(validate.errors) };
}

const packContract = compile(contract('pack'));
const snapshotContract = compile(contract('snapshots'));
const overrideContract = compile(contract('override'));

/** True when the last validation reported `keyword` at `instancePath`. */
function failedOn(validate: ValidateFunction, instancePath: string, keyword: string): boolean {
  return validate.errors?.some((e) => e.instancePath === instancePath && e.keyword === keyword) ?? false;
}

const generated = (theme: (typeof PACK_THEMES)[number]) =>
  generateCampaign({ theme: loadTheme(theme), seed: 42 });

const FIXTURE_PACKS: readonly (readonly [string, () => unknown])[] = [
  ['emberMarchesPack', emberMarchesPack],
  ['emberMarchesSpatialPack', emberMarchesSpatialPack],
  ['emberMarchesHexPack', emberMarchesHexPack],
  ['emberMarchesNoEconomyPack', emberMarchesNoEconomyPack],
  ['emberMarchesAscendingPack', emberMarchesAscendingPack],
  ['cloneRuntimePack', cloneRuntimePack],
  ['clonePack', clonePack],
];

interface Envelope extends Doc {
  readonly kind: string;
}

function isEnvelope(value: unknown): value is Envelope {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'kind' in value;
}

/** Every oracle snapshot that is an envelope (leg-7's first element is an offer-id array). */
const ORACLE_ENVELOPES: readonly (readonly [string, Envelope])[] = (Object.keys(LEG_RUNS) as LegId[]).flatMap(
  (leg) =>
    LEG_RUNS[leg]()
      .snapshots.map((snapshot, index): readonly [string, unknown] => [`${leg}[${index}]`, json(snapshot)])
      .filter((entry): entry is readonly [string, Envelope] => isEnvelope(entry[1])),
);

/** A level-1 character of each theme's first race and class, as a character and a party envelope. */
const THEME_ENVELOPES: readonly (readonly [string, Envelope])[] = PACK_THEMES.flatMap((theme) => {
  const rt = new Runtime(generated(theme));
  const state = rt.createCharacter({
    name: 'hero',
    race: Object.keys(rt.pack.content.races ?? {})[0]!,
    classes: [{ id: Object.keys(rt.pack.content.classes ?? {})[0]!, level: 1 }],
  }).state;
  return [
    [`${theme} character`, json(serializeCharacter(rt, state)) as unknown as Envelope],
    [`${theme} party`, json(serializeParty(rt, [state])) as unknown as Envelope],
  ] as const;
});

interface CombatantDoc extends Doc {
  hp: number;
}

const combatantsOf = (envelope: Envelope): CombatantDoc[] => envelope['combatants'] as CombatantDoc[];

/** CA-K2's subject: the first oracle combat envelope carrying a combatant with negative hp. */
const NEGATIVE_HP = ORACLE_ENVELOPES.find(
  ([, envelope]) => envelope.kind === 'combat' && combatantsOf(envelope).some((c) => c.hp < 0),
);

const OVERRIDE_DOCS: readonly (readonly [string, Doc])[] = [
  [
    'database.md §Override example',
    { overrides: [{ target: 'barrow-wight', patch: { hpBonus: 4, 'actions.claw.onHit': 'damage(1d8+2)' } }] },
  ],
  ['threat patch', { overrides: [{ target: 'barrow-wight', patch: { threat: 9 } }] }],
];

describe('pack.schema.json admits the generated and fixture packs (CA-K1)', () => {
  it.each(PACK_THEMES.map((theme) => [theme] as const))('generated %s (seed 42)', (theme) => {
    expect(packContract.validate(json(generated(theme))), packContract.errorsText()).toBe(true);
  });

  it.each(FIXTURE_PACKS)('fixture %s', (_name, build) => {
    expect(packContract.validate(json(build())), packContract.errorsText()).toBe(true);
  });
});

describe('snapshots.schema.json admits the envelopes the serializers write (CA-K1)', () => {
  it('the oracle legs yield 14 envelopes covering character, party and combat', () => {
    expect(ORACLE_ENVELOPES).toHaveLength(14);
    expect(new Set(ORACLE_ENVELOPES.map(([, envelope]) => envelope.kind))).toEqual(
      new Set(['character', 'party', 'combat']),
    );
  });

  it.each(ORACLE_ENVELOPES)('oracle %s', (_name, envelope) => {
    expect(snapshotContract.validate(envelope), snapshotContract.errorsText()).toBe(true);
  });

  it('the per-theme subjects are 6 envelopes', () => {
    expect(THEME_ENVELOPES).toHaveLength(6);
  });

  it.each(THEME_ENVELOPES)('%s', (_name, envelope) => {
    expect(snapshotContract.validate(envelope), snapshotContract.errorsText()).toBe(true);
  });
});

describe('combatant hp has no lower bound (CA-K2, v1.11)', () => {
  it('an oracle combat envelope with a negative-hp combatant validates', () => {
    expect(NEGATIVE_HP, 'no oracle combat envelope carries a combatant with hp < 0').toBeDefined();
    const [, envelope] = NEGATIVE_HP!;
    expect(combatantsOf(envelope).some((c) => c.hp < 0)).toBe(true);
    expect(snapshotContract.validate(envelope), snapshotContract.errorsText()).toBe(true);
  });

  it('regression control: the pre-v1.11 `minimum: 0` (in memory) rejects that envelope', () => {
    const [, envelope] = NEGATIVE_HP!;
    const legacy = structuredClone(contract('snapshots')) as {
      $defs: {
        combatSnapshot: {
          properties: { combatants: { items: { properties: { hp: Record<string, unknown> } } } };
        };
      };
    };
    legacy.$defs.combatSnapshot.properties.combatants.items.properties.hp['minimum'] = 0;
    const { validate } = compile(legacy as unknown as Contract);
    const index = combatantsOf(envelope).findIndex((c) => c.hp < 0);
    expect(validate(envelope)).toBe(false);
    expect(failedOn(validate, `/combatants/${index}/hp`, 'minimum')).toBe(true);
  });

  it('hp stays an integer: 1.5 is rejected', () => {
    const envelope = structuredClone(NEGATIVE_HP![1]);
    combatantsOf(envelope)[0]!.hp = 1.5;
    expect(snapshotContract.validate(envelope)).toBe(false);
    expect(failedOn(snapshotContract.validate, '/combatants/0/hp', 'type')).toBe(true);
  });
});

describe('override.schema.json admits the override documents (CA-K1)', () => {
  it.each(OVERRIDE_DOCS)('%s', (_name, doc) => {
    expect(overrideContract.validate(json(doc)), overrideContract.errorsText()).toBe(true);
  });
});

describe('negative controls: the validator bites, on the expected rule', () => {
  const combat = (): Envelope => structuredClone(NEGATIVE_HP![1]);

  it('a combat envelope with an extra savedAt is rejected (closed envelope)', () => {
    const envelope = { ...combat(), savedAt: 1 };
    expect(snapshotContract.validate(envelope)).toBe(false);
    expect(failedOn(snapshotContract.validate, '', 'additionalProperties')).toBe(true);
  });

  it('rng.a = 2^32 is rejected (uint32 bound)', () => {
    const envelope = combat();
    (envelope['rng'] as Doc)['a'] = 4294967296;
    expect(snapshotContract.validate(envelope)).toBe(false);
    expect(failedOn(snapshotContract.validate, '/rng/a', 'maximum')).toBe(true);
  });

  it('a pack with a top-level extra is rejected (closed pack root)', () => {
    const pack = { ...json(emberMarchesPack()), extra: {} };
    expect(packContract.validate(pack)).toBe(false);
    expect(failedOn(packContract.validate, '', 'additionalProperties')).toBe(true);
  });

  it('an override with an empty patch is rejected (minProperties 1)', () => {
    expect(overrideContract.validate({ overrides: [{ target: 'barrow-wight', patch: {} }] })).toBe(false);
    expect(failedOn(overrideContract.validate, '/overrides/0/patch', 'minProperties')).toBe(true);
  });

  it('an override item with no target is rejected (required)', () => {
    expect(overrideContract.validate({ overrides: [{ patch: { threat: 9 } }] })).toBe(false);
    expect(failedOn(overrideContract.validate, '/overrides/0', 'required')).toBe(true);
  });
});

describe('CA-01 character HP conformance', () => {
  it.each([-4, 0, 3, 99])('the actual character and party writers preserve hp=%s', (current) => {
    const rt = new Runtime(cloneRuntimePack());
    const hero = rt.createCharacter({ name: 'Hero', race: 'ashkin', classes: ['warden'] });
    hero.state.hp = { current, temp: 2 };
    const character = json(serializeCharacter(rt, hero.state));
    expect(character.state.hp).toEqual({ current, temp: 2 });
    expect(snapshotContract.validate(character), snapshotContract.errorsText()).toBe(true);
    expect(
      snapshotContract.validate(json(serializeParty(rt, [hero.state]))),
      snapshotContract.errorsText(),
    ).toBe(true);
    const bad = json(character);
    (bad.state.hp as { temp: number }).temp = -1;
    expect(snapshotContract.validate(bad)).toBe(false);
    expect(failedOn(snapshotContract.validate, '/state/hp/temp', 'minimum')).toBe(true);
  });
});

it('CA-01 oracle delta is exactly four added HP envelopes, with every old byte retained', () => {
  const recording = json(LEG_RUNS['leg-8']());
  let count = 0;
  for (const value of recording.snapshots) {
    const envelope = value as { state?: Record<string, unknown>; members?: Record<string, unknown>[] };
    for (const state of envelope.state ? [envelope.state] : envelope.members!) {
      expect(state['hp']).toEqual({ current: 29, temp: 0 });
      delete state['hp'];
      count += 1;
    }
  }
  expect(count).toBe(4);
  const raw = recordingRaw(recording);
  expect(contentHashOfRaw(raw)).toBe('7f898d06');
  expect(createHash('sha256').update(raw).digest('hex')).toBe(
    '23a287f174b5da23e962c6bacd9f0022cb1923280298941858be9390ba5e01a5',
  );
});

describe('CA-02 actual aggregate conformance and F-RA-01 empty seed', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ajv.addSchema(contract('snapshots'));
  const validate = ajv.compile(contract('play-session'));
  it('validates real initial/action and JSON-reopened aggregates with exact empty seeds', () => {
    const { pack, options } = playFixture();
    const session = createEncounterSession(pack, options);
    const initial = session.serialize();
    send(session, { type: 'advance' });
    send(session, { type: 'use', actor: { kind: 'member', memberId: 'hero-1' }, itemId: 'mend-draught' });
    const saved = session.serialize();
    const restored = restoreEncounterSession(pack, json(saved));
    for (const subject of [initial, saved, restored.serialize()]) {
      expect(subject.encounter.setup.seed).toBe('');
      expect(subject.encounter.selection.seedUsed).toBe('');
      expect(validate(json(subject)), ajv.errorsText(validate.errors)).toBe(true);
    }
    expect(send(restored, { type: 'pass', actor: { kind: 'member', memberId: 'hero-1' } })).toEqual(
      send(session, { type: 'pass', actor: { kind: 'member', memberId: 'hero-1' } }),
    );
  });
  it('validates settled/reopened and second-encounter empty-seed continuations', () => {
    const { pack, options } = playFixture();
    const session = createEncounterSession(pack, options);
    finish(session);
    expect(send(session, { type: 'finalize' }).ok).toBe(true);
    const settled = session.serialize(),
      restored = restoreEncounterSession(pack, json(settled));
    expect(send(session, { type: 'next', setup: options.setup })).toEqual(
      send(restored, { type: 'next', setup: options.setup }),
    );
    const second = session.serialize(),
      reopened = restoreEncounterSession(pack, json(second));
    for (const value of [
      settled,
      restoreEncounterSession(pack, json(settled)).serialize(),
      second,
      reopened.serialize(),
    ]) {
      expect(value.encounter.setup.seed).toBe('');
      expect(value.encounter.selection.seedUsed).toBe('');
      expect(validate(json(value)), ajv.errorsText(validate.errors)).toBe(true);
    }
    expect(send(session, { type: 'advance' })).toEqual(send(reopened, { type: 'advance' }));
  });
  it('rejects nonstring seedUsed at the selection field', () => {
    const { pack, options } = playFixture();
    const saved = json(createEncounterSession(pack, options).serialize());
    (saved.encounter.selection as unknown as Doc)['seedUsed'] = 42;
    expect(validate(saved)).toBe(false);
    expect(failedOn(validate, '/encounter/selection/seedUsed', 'type')).toBe(true);
  });
});
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

describe('CA-03 / F-RA-01 authoritative adventure input conformance', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  for (const name of ['snapshots', 'play-session', 'adventure'])
    ajv.addSchema(
      JSON.parse(
        readFileSync(new URL(`../../src/schema/contracts/${name}.schema.json`, import.meta.url), 'utf8'),
      ),
    );
  const validate = ajv.getSchema('https://ruleswright.dev/schemas/1/adventure.schema.json')!;
  it('accepts host template and definition with exact empty setup seeds through JSON', () => {
    const { pack, template, definition } = adventureFixture();
    expect(validateAdventureTemplate(pack, template)).toEqual([]);
    expect(validateAdventureDefinition(pack, definition)).toEqual([]);
    for (const doc of [template, definition])
      expect(validate(json(doc)), ajv.errorsText(validate.errors)).toBe(true);
    expect(json(template).locations['watch']!.encounter!.seed).toBe('');
    expect(json(definition).nodes[1]!.encounter!.seed).toBe('');
  });
  it.each(['dark-fantasy', 'zombie-urban', 'wyldwood', 'hand-authored'])(
    '%s actual bound and generated output conforms through JSON',
    (theme) => {
      const custom = adventureFixture();
      const pack =
        theme === 'hand-authored' ? custom.pack : generateCampaign({ theme: loadTheme(theme), seed: 42 });
      const template = theme === 'hand-authored' ? custom.template : loadAdventureTemplate(theme, pack);
      expect(validate(json(template)), ajv.errorsText(validate.errors)).toBe(true);
      const definition = generateAdventure({ pack, template, seed: 'conformance' });
      for (const doc of [definition, json(definition)]) {
        expect(validate(doc), ajv.errorsText(validate.errors)).toBe(true);
        expect(validateAdventureDefinition(pack, doc)).toEqual([]);
        expect(doc.nodes.filter((n) => n.kind === 'encounter').every((n) => n.encounter!.seed === '')).toBe(
          true,
        );
      }
      expect(json(definition).contentHash).toBe(definition.contentHash);
      const bad = json(definition) as unknown as { nodes: Doc[] };
      const index = definition.nodes.findIndex((n) => n.kind === 'encounter');
      (bad.nodes[index]!['encounter'] as Doc)['seed'] = null;
      expect(validate(bad)).toBe(false);
      expect(failedOn(validate, `/nodes/${index}/encounter/seed`, 'type')).toBe(true);
    },
  );
  it('rejects non-JSON setup seed and extra fields at their authoritative locations', () => {
    const { template, definition } = adventureFixture();
    const bad = json(template);
    (bad.locations['watch']!.encounter as unknown as Doc)['seed'] = null;
    expect(validate(bad)).toBe(false);
    expect(failedOn(validate, '/locations/watch/encounter/seed', 'type')).toBe(true);
    expect(validate({ ...definition, extra: true })).toBe(false);
    expect(failedOn(validate, '', 'additionalProperties')).toBe(true);
  });
});

import { generatedJourney, fixtureJourney } from './adventure-oracle';
describe('CA-04 real adventure aggregate writers conform to the approved database contract', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  for (const name of ['snapshots', 'play-session', 'adventure', 'adventure-snapshot'])
    ajv.addSchema(
      JSON.parse(
        readFileSync(new URL(`../../src/schema/contracts/${name}.schema.json`, import.meta.url), 'utf8'),
      ),
    );
  const validate = ajv.getSchema('https://ruleswright.dev/schemas/1/adventure-snapshot.schema.json')!;
  it.each([
    ['generated', generatedJourney],
    ['fixture', fixtureJourney],
  ] as const)(
    '%s actual pending/claimed/active/completed writers validate through JSON',
    (_name, run) => {
      const { snapshots } = run(true);
      expect(snapshots.length).toBeGreaterThan(10);
      expect(snapshots.some((s) => s.activeEncounter)).toBe(true);
      expect(snapshots.some((s) => s.rewards.some((r) => r.status === 'pending'))).toBe(true);
      expect(snapshots.some((s) => s.rewards.some((r) => r.status === 'claimed'))).toBe(true);
      for (const snapshot of snapshots)
        expect(validate(json(snapshot)), ajv.errorsText(validate.errors)).toBe(true);
    },
    10000,
  );
  it('negative controls reject excess RNG words, malformed receipts and unknown root fields', () => {
    const saved = generatedJourney().final;
    for (const bad of [
      { ...saved, extra: true },
      { ...saved, rng: { ...saved.rng, play: { ...saved.rng.play, a: 4294967296 } } },
      { ...saved, rewards: [{ ...saved.rewards[0], receipt: {} }] },
    ])
      expect(validate(json(bad))).toBe(false);
  });
});
