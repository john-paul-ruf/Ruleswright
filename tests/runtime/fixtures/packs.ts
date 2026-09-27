/** Fixture packs for the combat suite (D5: test fixtures live under tests/).
 * Built against the v1.3 contract surface: `economy.turnSlots`, `tags` on
 * actions/spells, and the optional `spatial` section (inline reach map —
 * `default` + sibling overrides, spatial.html verbatim) are declared natively.
 *
 * Expression policy (Q7/Q8): all names are coined; "d20" appears only as the
 * generic body-text term inside DSL expressions.
 *
 * `ember-marches` declares the descending-AC class attack-table convention
 * (byDefense keys "2".."10", lower defense = harder to hit — pack data); the
 * hexer class declares the ascending `attackBonus` alternative. The engine
 * looks up `byDefense[defenseValue]` without interpreting either (FR-3).
 */
import type { Pack, SpatialDef } from '../../../src/schema/pack';

/** The optional spatial declaration a pack may carry (v1.3, FR-11; CA-G1). */
export type SpatialPack = { spatial?: SpatialDef };

/** Attach a spatial model to a pack (test helper — the engine reads whatever the pack declares). */
export function withSpatial(pack: Pack, spatial: SpatialDef): Pack & SpatialPack {
  return { ...pack, spatial } as Pack & SpatialPack;
}

export const EMBER_MARCHES_MANIFEST = {
  id: 'ember-marches',
  schemaVersion: 1,
  title: 'Ember Marches',
  license: 'CC-BY-4.0',
  attribution: 'Ruleswright fixture pack',
} as const;

const WARDEN_TABLE = [
  {
    level: 1,
    byDefense: { '2': 18, '3': 17, '4': 16, '5': 15, '6': 14, '7': 13, '8': 12, '9': 11, '10': 10 },
  },
  {
    level: 2,
    byDefense: { '2': 17, '3': 16, '4': 15, '5': 14, '6': 13, '7': 12, '8': 11, '9': 10, '10': 9 },
  },
];

export function emberMarchesPack(): Pack {
  return {
    manifest: { ...EMBER_MARCHES_MANIFEST },
    stats: {
      abilities: ['might', 'grace', 'vigor', 'reason', 'insight', 'presence'],
      saves: ['vigor', 'reflexes', 'reason', 'tenacity', 'grit'],
    },
    economy: { turnSlots: { main: 1, move: 1, reaction: 1 } },
    actions: {
      strike: {
        cost: { slots: { main: 1 } },
        effect: 'sequence(attack(ac, might), damage(1d8 + might, sharp))',
        tags: ['main'],
      },
      hurl: {
        cost: { slots: { main: 1 } },
        effect: 'sequence(attack(ac, might), damage(1d6, pierce))',
        tags: ['main'],
      },
      withdraw: {
        cost: { slots: { move: 1 } },
        effect: 'applyCondition(braced, 2)',
        tags: ['move'],
      },
      parry: {
        cost: { slots: { reaction: 1 } },
        trigger: { on: 'attack:rolled[target=self]' },
        effect: 'sequence(attack(ac, grace), damage(1d6, sharp))',
        tags: ['reaction'],
      },
      surge: {
        cost: { points: { pool: 'stamina', amount: 2 } },
        effect: 'damage(2d6, force)',
        tags: ['free'],
      },
      'wight-claw': {
        cost: { slots: { main: 1 } },
        effect: 'sequence(attack(ac, 0), damage(1d6, grave-touch))',
        tags: ['main'],
      },
      'ember-bloom-rite': {
        cost: { slots: { main: 1 } },
        effect: 'target(burst-2, save(reason, 12, damage(3d6, fire), damage(half)))',
        tags: ['casting'],
      },
      'seize-opening': {
        cost: { slots: { main: 1 } },
        valid: 'hasTarget(adjacent)',
        effect: 'sequence(attack(ac, might), damage(1d6, sharp))',
        tags: ['main'],
      },
      'veterans-censure': {
        cost: { slots: { move: 1 } },
        valid: 'level >= 3',
        effect: 'applyCondition(braced, 2)',
        tags: ['move'],
      },
      'grave-gaze': {
        cost: { slots: { main: 1 } },
        effect: 'save(reason, 12, applyCondition(hexbound, 2), applyCondition(hexbound, 1))',
        tags: ['casting'],
      },
      'shamble-swing': {
        cost: { slots: { main: 1 } },
        effect: 'sequence(attack(ac, 0), damage(1d6, bludgeon))',
        tags: ['main'],
      },
    },
    formulas: {
      hp: { expr: '6 + vigor * 2' },
      ac: { expr: '10 - floor(level / 2)' },
      initiative: { expr: 'd20 + grace' },
      stamina: { expr: '8 + vigor' },
    },
    content: {
      classes: {
        warden: { name: 'Warden', spellLists: [] },
        hexer: { name: 'Hexer', spellLists: ['hexer'] },
        'wight-frames': { name: 'Wight Frames' },
        'shamble-frames': { name: 'Shamble Frames' },
      },
      races: {
        ashling: { name: 'Ashling' },
        dwindle: { name: 'Dwindle', caps: { hexer: 2 }, size: 'small' },
      },
      skills: {
        'blade-work': { name: 'Blade Work', ability: 'might' },
        'lore-keeping': { name: 'Lore Keeping', ability: 'reason' },
      },
      feats: {
        'second-gust': {
          name: 'Second Gust',
          trigger: { on: 'condition:applied[self]' },
          effect: 'applyCondition(braced, 2)',
        },
      },
      spells: {
        'grave-light': {
          name: 'Grave Light',
          magic: { level: 1, lists: ['hexer'] },
          cost: { vancian: 1 },
          effect: 'sequence(damage(1d6, radiance), applyCondition(shaken, 1))',
          tags: ['casting'],
        },
        'ember-bloom': {
          name: 'Ember Bloom',
          magic: { level: 2, lists: ['hexer'] },
          cost: { vancian: 2 },
          targeting: { shape: 'burst', radius: 2 },
          effect: 'target(burst-2, save(reason, 12, damage(3d6, fire), damage(half)))',
          tags: ['casting'],
        },
      },
      conditions: {
        shaken: { name: 'Shaken', duration: 2, stacking: 'refresh', restricts: ['actions.tagged:main'] },
        hexbound: { name: 'Hexbound', duration: 3, stacking: 'stack', restricts: ['actions.tagged:casting'] },
        braced: { name: 'Braced', duration: 2, stacking: 'refresh' },
      },
      items: {
        'ember-oil': { name: 'Ember Oil', kind: 'consumable' },
      },
    },
    progression: {
      warden: {
        hd: 'd10',
        attackTable: WARDEN_TABLE,
        saves: { vigor: [2, 3], reflexes: [1, 2], grit: [1, 1] },
      },
      hexer: {
        hd: 'd6',
        attackBonus: 'floor(level / 2) + might',
        saves: { reason: [2, 4], reflexes: [0, 1] },
        slots: { '1': [2, 3], '2': [0, 1] },
      },
      // Monster progressions are valid pack entries (E-REF-03 fires on orphaned ones);
      // they carry the attack tables the statblocks reference.
      'wight-frames': {
        hd: 'd10',
        attackTable: WARDEN_TABLE,
        saves: { vigor: [2, 3], reason: [3, 4] },
      },
      'shamble-frames': {
        hd: 'd8',
        attackTable: WARDEN_TABLE,
        saves: { vigor: [1, 2], reason: [0, 0] },
      },
    },
    bestiary: {
      'barrow-wight': {
        name: 'Barrow Wight',
        threat: 3,
        level: 2,
        hd: 'd10',
        abilityOverrides: { might: 4, vigor: 3, grace: 2 },
        saveOverrides: { reason: 3 },
        attackTable: 'wight-frames',
        actions: ['wight-claw', 'grave-gaze'],
      },
      'grave-shambles': {
        name: 'Grave Shambles',
        threat: 1.5,
        level: 1,
        hd: 'd8',
        abilityOverrides: { might: 3 },
        attackTable: 'shamble-frames',
        actions: ['shamble-swing'],
      },
    },
    tables: {
      'barrowland-threats': {
        kind: 'weighted',
        entries: [
          { weight: 4, value: 'bestiary.grave-shambles' },
          { weight: 2, value: 'bestiary.barrow-wight' },
        ],
      },
    },
  };
}

/**
 * The default-grant branch: same pack minus the optional `economy` section.
 * The engine default grants 1 of each slot name appearing in any action or
 * spell cost (`main`, `move`, `reaction`) per turn.
 */
export function emberMarchesNoEconomyPack(): Pack {
  const pack = emberMarchesPack();
  const rest = { ...pack } as Partial<Pick<Pack, 'economy'>> & Pack;
  delete rest.economy;
  return rest as Pack;
}

/**
 * Ascending-AC companion pack for the resolution tests: attackBonus classes
 * judge `d20 + bonus >= defenseValue` where the defense value is the
 * defender's evaluated `ac` formula, ascending (higher = harder).
 */
export function emberMarchesAscendingPack(): Pack {
  const pack = emberMarchesPack();
  return {
    ...pack,
    formulas: { ...pack.formulas, ac: { expr: '10 + level' } },
    progression: {
      ...pack.progression,
      warden: {
        hd: 'd10',
        attackBonus: 'level + might',
        saves: { vigor: [2, 3], reflexes: [1, 2], grit: [1, 1] },
      },
      hexer: {
        hd: 'd6',
        attackBonus: 'floor(level / 2) + might',
        saves: { reason: [2, 4], reflexes: [0, 1] },
        slots: { '1': [2, 3], '2': [0, 1] },
      },
      'wight-frames': { hd: 'd10', attackBonus: 'level', saves: { vigor: [2, 3], reason: [3, 4] } },
      'shamble-frames': { hd: 'd8', attackBonus: 'level - 1', saves: { vigor: [1, 2], reason: [0, 0] } },
    },
  };
}
