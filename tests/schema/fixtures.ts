/**
 * Shared fixture pack for the schema test suite: a minimal VALID pack exercising
 * every section plus the v1.1 optional fields (economy.turnSlots, tags). Tests
 * mutate a structured clone per case, so each rule fires on a purpose-built
 * broken fixture against an otherwise-clean document.
 *
 * All names coined (Q7/Q8).
 */
import type { Pack } from '../../src/schema/pack';
import type { ErrorCard } from '../../src/schema/error-card';
import { validatePack, type DslChecker } from '../../src/schema/validate';

/** The "S03 landed" stand-in: a wired checker that accepts every expression. */
export const stubDslChecker: DslChecker = () => [];

export const VALID_PACK: Pack = {
  manifest: {
    id: 'test-vale',
    schemaVersion: 1,
    title: 'The Test Vale',
    license: 'CC0',
    attribution: 'Ruleswright test fixture',
    provenance: { theme: 'test-theme', seed: 42, knobs: { danger: 3 } },
  },
  stats: {
    abilities: ['might', 'grace', 'vigor', 'reason', 'insight', 'presence'],
    saves: ['fortitude', 'reflex', 'will', 'toughness', 'luck'],
  },
  economy: { turnSlots: { main: 1, move: 1 } },
  actions: {
    strike: {
      cost: { slots: { main: 1 } },
      valid: 'hasTarget(adjacent)',
      effect: 'damage(1d8 + might)',
      tags: ['main'],
    },
    'step-aside': {
      cost: { slots: { move: 1 } },
      trigger: { on: 'enemy-approaches' },
      effect: 'shift(1)',
      tags: ['move'],
    },
  },
  formulas: {
    hp: { expr: '10 + vigor' },
    ac: { expr: '10 + grace' },
    initiative: { expr: '1d20 + grace' },
    stamina: { expr: '12 + vigor * 2' },
  },
  content: {
    classes: {
      warden: { name: 'Warden', spellLists: ['warden'], armorCasting: ['mail'], features: [{ level: 1, ref: 'feature-warden-oath' }] },
      hexer: { name: 'Hexer', spellLists: ['hexer'] },
    },
    races: {
      hillfolk: { name: 'Hillfolk', caps: { warden: 8, hexer: 6 }, size: 'medium' },
      ashkin: { name: 'Ashkin' },
    },
    skills: {
      climb: { name: 'Climb', ability: 'grace' },
      lore: { name: 'Lore', ability: 'insight' },
    },
    feats: {
      ironhide: { name: 'Ironhide', passive: 'soak(1)' },
      'vengeful-strike': { name: 'Vengeful Strike', trigger: { on: 'damaged' }, effect: 'damage(1d4)' },
    },
    spells: {
      'grave-light': {
        name: 'Grave Light',
        magic: { level: 1, lists: ['hexer'] },
        cost: { vancian: 1 },
        effect: 'condition(dazzed, 3)',
        targeting: { shape: 'burst', radius: 2 },
        tags: ['casting'],
      },
    },
    conditions: {
      sapped: { name: 'Sapped', duration: 3, stacking: 'refresh', restricts: ['actions.tagged:main'] },
      dazzed: { name: 'Dazzed', duration: 2, stacking: 'ignore' },
    },
    items: {
      rope: { name: 'Rope', kind: 'gear' },
    },
  },
  progression: {
    warden: {
      hd: 'd8',
      attackTable: [
        { level: 1, byDefense: { '2': 20, '9': 13 } },
        { level: 4, byDefense: { '2': 17, '9': 10 } },
      ],
      saves: { fortitude: [0, 0, 1, 1], reflex: [0, 1, 1, 2], will: [0, 1, 1, 2], toughness: [1, 1, 2, 2], luck: [0, 0, 1, 1] },
      slots: { '1': [1, 2, 2, 3] },
    },
    hexer: {
      hd: 'd6',
      attackBonus: '1 + level / 2',
      saves: { will: [0, 1, 1, 2], luck: [0, 0, 1, 1] },
      slots: { '1': [0, 1, 2, 2], '2': [0, 0, 1, 2] },
    },
  },
  bestiary: {
    'barrow-wight': {
      name: 'Barrow Wight',
      threat: 2,
      level: 3,
      hd: 'd8',
      abilityOverrides: { might: 14 },
      saveOverrides: { will: 3 },
      attackTable: 'warden',
      actions: ['strike'],
    },
  },
  tables: {
    'district-scavenge': {
      kind: 'weighted',
      entries: [
        { weight: 3, value: 'bandage' },
        { weight: 1, value: { id: 'rope', qty: 1 } },
      ],
    },
    weather: {
      kind: 'ranged',
      entries: [
        { min: 1, max: 3, value: 'clear' },
        { min: 4, max: 6, value: 'rain' },
      ],
    },
    'loot-chain': {
      kind: 'nested',
      entries: [{ value: 'tables.district-scavenge' }, { value: 'nothing' }],
    },
  },
};

/** A chain of `depth` nested tables ending in one weighted leaf. */
export function nestedChain(depth: number): Record<string, Pack['tables'][string]> {
  const tables: Record<string, Pack['tables'][string]> = {};
  for (let i = 1; i <= depth; i += 1) {
    tables[`t${i}`] = { kind: 'nested', entries: [{ value: `tables.t${i + 1}` }] };
  }
  tables[`t${depth + 1}`] = { kind: 'weighted', entries: [{ weight: 1, value: 'dust' }] };
  return tables;
}

export function clonePack(): Pack {
  return structuredClone(VALID_PACK);
}

/** Mutate a fresh clone, validate with the stub checker, return the cards. */
export function errorsFor(mutate: (pack: Pack) => void, checker: DslChecker = stubDslChecker): ErrorCard[] {
  const pack = clonePack();
  mutate(pack as Pack);
  return validatePack(pack, checker);
}

export function firstRule(cards: ErrorCard[], rule: string): ErrorCard | undefined {
  return cards.find((card) => card.rule === rule);
}