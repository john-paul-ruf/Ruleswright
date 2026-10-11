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
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import type { ValidateFunction } from 'ajv';
import { describe, expect, it } from 'vitest';
import { generateCampaign, loadTheme } from '../../src/compiler';
import { Runtime, serializeCharacter, serializeParty } from '../../src/runtime/index';
import { LEG_RUNS, PACK_THEMES, type LegId } from './determinism-oracle';
import {
  emberMarchesAscendingPack,
  emberMarchesHexPack,
  emberMarchesNoEconomyPack,
  emberMarchesPack,
  emberMarchesSpatialPack,
} from '../runtime/fixtures/packs';
import { cloneRuntimePack } from '../runtime/fixtures/pack';
import { clonePack } from '../schema/fixtures';

type Contract = Record<string, unknown>;
type Doc = Record<string, unknown>;

function contract(name: 'pack' | 'snapshots' | 'override'): Contract {
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
