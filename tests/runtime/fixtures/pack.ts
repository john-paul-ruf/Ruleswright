/**
 * Runtime test fixture pack — adapted from tests/schema/fixtures.ts VALID_PACK
 * to the real S03 function registry: `shift`/`condition`/`soak` are not registry
 * words, so effects speak the closed effect vocabulary and the bare feat drops
 * its passive. Names coined (Q7/Q8).
 */
import type { Pack } from '../../../src/schema/pack';
import { validatePack } from '../../../src/schema/validate';
import { packDslChecker } from '../../../src/core/dsl/checker';

export const RUNTIME_PACK: Pack = {
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
      effect: 'applyCondition(dazzed, 2)',
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
      hillfolk: { name: 'Hillfolk', caps: { warden: 3, hexer: 2 }, size: 'medium' },
      ashkin: { name: 'Ashkin' },
    },
    skills: {
      climb: { name: 'Climb', ability: 'grace' },
      lore: { name: 'Lore', ability: 'insight' },
    },
    feats: {
      ironhide: { name: 'Ironhide' },
      'vengeful-strike': { name: 'Vengeful Strike', trigger: { on: 'damaged' }, effect: 'damage(1d4)' },
    },
    spells: {
      'hex-bolt': {
        name: 'Hex Bolt',
        magic: { level: 1, lists: ['hexer'] },
        cost: { points: { pool: 'stamina', amount: 3 } },
        effect: 'damage(1d6 + insight)',
        tags: ['casting'],
      },
      'grave-light': {
        name: 'Grave Light',
        magic: { level: 1, lists: ['hexer'] },
        cost: { vancian: 1 },
        effect: 'applyCondition(dazzed, 3)',
        targeting: { shape: 'burst', radius: 2 },
        tags: ['casting'],
      },
    },
    conditions: {
      sapped: { name: 'Sapped', duration: 3, stacking: 'refresh', restricts: ['actions.tagged:main'] },
      hexbound: { name: 'Hexbound', duration: 2, stacking: 'stack', restricts: ['spells.tagged:casting'] },
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
    'wandering-dread': {
      kind: 'weighted',
      entries: [
        { weight: 1, value: 'sapped' },
        { weight: 1, value: 'dazzed' },
      ],
    },
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

/** A pack that fails validation in several sections at once — FR-2 aggregate target. */
export const BROKEN_PACK: Record<string, unknown> = {
  manifest: { id: 'broken-vale', schemaVersion: 1, title: 'The Broken Vale' },
  stats: { abilities: ['might'], saves: [] },
  actions: { strike: { cost: { slots: { main: 1 } } } },
  formulas: { hp: { expr: '10 + vigor' } },
  content: {},
  progression: {},
  bestiary: {},
  tables: {},
};

export function cloneRuntimePack(): Pack {
  return structuredClone(RUNTIME_PACK);
}

/** Negative-control tripwire: the fixture must be a clean pack under the real checker. */
if (validatePack(structuredClone(RUNTIME_PACK), packDslChecker).length > 0) {
  throw new Error('tests/runtime/fixtures/pack.ts: RUNTIME_PACK does not validate — fix the fixture before running the suite');
}