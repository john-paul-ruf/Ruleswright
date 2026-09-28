/**
 * CA-08 (UI B-1, pack v1.2) — `profileFromCharacter`: a created character
 * becomes a combatant through the same machinery as a statblock. Real
 * generated packs (seed 42) for both bundled themes; no fixtures stand in for
 * the production mapping.
 */
import { describe, expect, it } from 'vitest';
import { generateCampaign, loadTheme } from '../../../src/compiler';
import {
  Runtime,
  RuntimeRuleError,
  attackBonusAgainst,
  bestiaryIds,
  knownSpells,
  profileFromCharacter,
  profileFromStatblock,
  spawnMonster,
  startCombat,
  type Character,
  type CombatantProfile,
  type RuntimeEvent,
} from '../../../src/runtime';
import { evalPackFormula } from '../../../src/runtime/combat/resolve';
import type { Pack } from '../../../src/schema/pack';

const SEED = 42;
const THEMES = [
  { themeId: 'dark-fantasy', race: 'ashkin' },
  { themeId: 'zombie-urban', race: 'mile-born' },
] as const;

function packFor(themeId: string): Pack {
  return generateCampaign({ theme: loadTheme(themeId), seed: SEED });
}

function hero(rt: Runtime, race: string, classes: { id: string; level: number }[]): Character {
  return rt.createCharacter({ name: 'Hero', race, classes });
}

describe('CA-08 — every bundled class at level 1 maps through the production path', () => {
  for (const { themeId, race } of THEMES) {
    const rt = new Runtime(packFor(themeId));
    for (const [classId, def] of Object.entries(rt.pack.content.classes ?? {})) {
      it(`${themeId} · ${classId}`, () => {
        const character = hero(rt, race, [{ id: classId, level: 1 }]);
        const { profile, balances } = profileFromCharacter(rt, character);
        const state = character.state;
        const derived = character.derived();

        expect(profile.id).toBe(state.id);
        expect(profileFromCharacter(rt, character, 'hero').profile.id).toBe('hero');
        expect(profile.actions).toEqual(def.actions);
        expect(profile.level).toBe(1);
        expect(profile.hp).toBe(state.hp.current);
        expect(profile.ac).toBe(derived.ac);
        expect(profile.abilities).toEqual(state.abilities);
        expect(profile.saves).toEqual(state.saves);
        expect(profile.attackBonus).toBe(derived.attackBonus);

        // The statblock path over the same vars yields the same initiative bonus.
        const mirror = profileFromStatblock(
          rt.pack,
          {
            name: 'mirror',
            threat: 1,
            level: state.level,
            abilityOverrides: { ...state.abilities },
            saveOverrides: { ...state.saves },
            actions: ['x'],
          },
          'mirror',
        );
        expect(profile.initiativeBonus).toBe(mirror.initiativeBonus);

        expect(balances.pools).toEqual(state.pools);
        expect(Object.keys(balances.boundSlots ?? {})).toEqual(Object.keys(state.slots));
      });
    }
  }

  it('hp is the current hp, not the formula cap', () => {
    const rt = new Runtime(packFor('dark-fantasy'));
    const character = hero(rt, 'ashkin', [{ id: 'warden', level: 1 }]);
    character.state.hp.current -= 5;
    expect(profileFromCharacter(rt, character).profile.hp).toBe(character.derived().hp - 5);
  });
});

/**
 * The engine-side acceptance script: the hero (a level-1 character) against
 * the first bestiary entry at host-declared grid positions (FR-11 — every
 * combatant needs one when the pack declares a spatial model), driven only by
 * step/declare/respond — every turn declares the first action the engine
 * accepts, every trigger offer is declined — until `combat-over` (the
 * side-defeated end rule) or 500 steps.
 */
function fightScript(themeId: string, race: string, classId: string) {
  const rt = new Runtime(packFor(themeId));
  const events: RuntimeEvent[] = [];
  rt.events.on((event) => {
    events.push(event);
  });
  const character = hero(rt, race, [{ id: classId, level: 1 }]);
  const fight = startCombat(rt, {
    allies: [{ id: 'hero', ...profileFromCharacter(rt, character) }],
    enemies: [{ id: 'foe', profile: spawnMonster(rt, bestiaryIds(rt)[0]!, 'foe') }],
    positions: { hero: { x: 0, y: 0 }, foe: { x: 1, y: 0 } },
  });
  const resolved: Record<string, number> = { hero: 0, foe: 0 };
  let steps = 0;
  while (fight.state.phase !== 'combat-over' && steps < 500) {
    for (const offer of [...fight.pendingTriggers]) fight.respond(offer.triggerId, 'decline');
    const outcome = fight.step();
    steps += 1;
    if (outcome.kind !== 'turn-started') continue;
    const active = fight.state.combatants[fight.state.active]!;
    for (const actionId of active.actions) {
      fight.declare(actionId);
      if (fight.state.phase !== 'awaiting-declare') {
        resolved[active.id] = (resolved[active.id] ?? 0) + 1;
        break;
      }
    }
  }
  return { fight, events, steps, resolved };
}

describe('CA-08 / CAP-09 engine acceptance — every level-1 class fights through declare/step/respond', () => {
  for (const { themeId, race } of THEMES) {
    const classIds = Object.keys(new Runtime(packFor(themeId)).pack.content.classes ?? {});
    for (const classId of classIds) {
      it(`${themeId}·42 · ${classId}: legal declares every turn, reaches combat-over within 500 steps, deterministic`, () => {
        const first = fightScript(themeId, race, classId);
        expect(first.fight.state.phase).toBe('combat-over');
        expect(first.steps).toBeLessThanOrEqual(500);
        const ended = first.events.filter((event) => event.type === 'combat:ended');
        expect(ended).toHaveLength(1);
        expect(ended[0]!.why.rule).toBe('combat.sideDefeated');
        expect(first.resolved['hero']).toBeGreaterThan(0);
        expect(first.events.some((event) => event.type === 'action:resolved' && event.actor === 'hero')).toBe(
          true,
        );
        expect(
          first.events.some((event) => event.type === 'declare:rejected' && event.actor === 'hero'),
        ).toBe(false);
        const second = fightScript(themeId, race, classId);
        expect(JSON.stringify(second.events)).toBe(JSON.stringify(first.events));
        expect(second.fight.serialize()).toEqual(first.fight.serialize());
      });
    }
  }
});

describe('CA-08 — attack conventions', () => {
  const rt = new Runtime(packFor('dark-fantasy'));

  it('a hexer (bonus convention) carries attackBonus and no table', () => {
    const character = hero(rt, 'ashkin', [{ id: 'hexer', level: 1 }]);
    const { profile } = profileFromCharacter(rt, character);
    expect(profile.attackBonus).toBeDefined();
    expect(profile.attackBonus).toBe(character.derived().attackBonus);
    expect(profile.attackTable).toBeUndefined();
  });

  it('a warden (table convention) carries its progression rows, and the row at its level resolves', () => {
    const character = hero(rt, 'ashkin', [{ id: 'warden', level: 1 }]);
    const { profile } = profileFromCharacter(rt, character);
    const rows = rt.pack.progression['warden']!.attackTable!;
    expect(profile.attackBonus).toBeUndefined();
    expect(profile.attackTable).toEqual(rows);
    const row = rows.find((candidate) => candidate.level === profile.level)!;
    for (const [defense, toHit] of Object.entries(row.byDefense)) {
      expect(attackBonusAgainst(profile, Number(defense))).toBe(toHit);
    }
  });

  it('multiclass table convention: the highest-level table class row, re-keyed to the total level', () => {
    const character = hero(rt, 'ashkin', [
      { id: 'crypt-warden', level: 1 },
      { id: 'warden', level: 2 },
    ]);
    const { profile } = profileFromCharacter(rt, character);
    const wardenRow = rt.pack.progression['warden']!.attackTable!.find((row) => row.level === 2)!;
    expect(profile.level).toBe(3);
    expect(profile.attackTable).toEqual([{ level: 3, byDefense: wardenRow.byDefense }]);
    const [defense, toHit] = Object.entries(wardenRow.byDefense)[0]!;
    expect(attackBonusAgainst(profile, Number(defense))).toBe(toHit);
  });

  it('multiclass table convention tie: the first class in state.classes wins', () => {
    const character = hero(rt, 'ashkin', [
      { id: 'crypt-warden', level: 1 },
      { id: 'warden', level: 1 },
    ]);
    const cryptRow = rt.pack.progression['crypt-warden']!.attackTable!.find((row) => row.level === 1)!;
    expect(profileFromCharacter(rt, character).profile.attackTable).toEqual([
      { level: 2, byDefense: cryptRow.byDefense },
    ]);
  });
});

describe('CA-08 — actions and balances', () => {
  const rt = new Runtime(packFor('dark-fantasy'));

  it('a multiclass warden/hexer declares the union of class actions, first occurrence wins', () => {
    const character = hero(rt, 'ashkin', [
      { id: 'warden', level: 1 },
      { id: 'hexer', level: 1 },
    ]);
    const { profile } = profileFromCharacter(rt, character);
    expect(profile.actions).toEqual([
      'strike',
      'cut-down',
      'withdraw',
      'brace',
      'parry',
      'hurl',
      'long-shot',
      'ward-glint',
      'ember-surge',
    ]);
    expect(profile.attackBonus).toBe(character.derived().attackBonus);
    expect(profile.attackTable).toBeUndefined();
  });

  it('balances reflect a spent pool point and a prepared spell', () => {
    const character = hero(rt, 'ashkin', [{ id: 'hexer', level: 1 }]);
    const ember = character.state.pools['ember']!;
    const spell = knownSpells(rt, character.state).find(
      (id) => rt.pack.content.spells![id]!.magic.level === 1,
    )!;
    expect(profileFromCharacter(rt, character).balances.boundSlots?.['1']).toBe(0);
    character.spend('ember', 1);
    character.prepare(spell);
    const { balances } = profileFromCharacter(rt, character);
    expect(balances.pools?.['ember']).toBe(ember - 1);
    expect(balances.boundSlots?.['1']).toBe(1);
  });

  it('a class stripped of actions is rejected with no-combat-actions', () => {
    const pack = packFor('dark-fantasy');
    delete pack.content.classes!['warden']!.actions;
    const stripped = new Runtime(pack);
    const character = hero(stripped, 'ashkin', [{ id: 'warden', level: 1 }]);
    expect(() => profileFromCharacter(stripped, character)).toThrow(RuntimeRuleError);
    try {
      profileFromCharacter(stripped, character);
    } catch (error) {
      expect((error as RuntimeRuleError).errors).toEqual([
        expect.objectContaining({
          rule: 'no-combat-actions',
          artifactId: 'warden',
          jsonPath: 'content.classes',
          hint: 'declare actions on the class (pack v1.2)',
        }),
      ]);
    }
  });
});

/**
 * CA-EG2 profile leg (equipment-consumables S05 ck1): the combatant carries the
 * character's equipment — grants through `equipmentView`, the pack's `gear-*`
 * formula terms through `derived()`, and the heal cap `maxHp` = `derived().hp`.
 * Real generated zombie-urban pack (seed 42): riot-plate {ac:1, armor:1},
 * fire-axe {might:1}, ac formula `11 - floor(level / 3) - gear-ac`.
 */
describe('CA-EG2 — profiles carry equipment grants and maxHp', () => {
  const rt = new Runtime(packFor('zombie-urban'));
  const classId = Object.keys(rt.pack.content.classes ?? {})[0]!;
  const survivor = () => hero(rt, 'mile-born', [{ id: classId, level: 1 }]);

  it('an equipped armor shifts ac by exactly the pack formula response (descending: − gear-ac)', () => {
    const character = survivor();
    const before = profileFromCharacter(rt, character).profile;
    character.grant('riot-plate');
    character.equip('riot-plate', 'body');
    const after = profileFromCharacter(rt, character).profile;
    expect(before.ac).toBe(11 - Math.floor(1 / 3));
    expect(after.ac).toBe(before.ac - 1);
    expect(after.ac).toBe(character.derived().ac);
  });

  it('a might grant raises profile.abilities.might by 1, and the effect vars see it', () => {
    const character = survivor();
    const base = character.state.abilities['might']!;
    character.grant('fire-axe');
    character.equip('fire-axe', 'main-hand');
    const { profile } = profileFromCharacter(rt, character);
    expect(profile.abilities['might']).toBe(base + 1);
    expect(character.state.abilities['might']).toBe(base);
    expect(startCombatWith(rt, profile).state.combatants['hero']!.abilities['might']).toBe(base + 1);
  });

  it('maxHp = derived().hp; hp stays the current hp', () => {
    const character = survivor();
    character.state.hp.current -= 3;
    const { profile } = profileFromCharacter(rt, character);
    expect(profile.maxHp).toBe(character.derived().hp);
    expect(profile.hp).toBe(character.derived().hp - 3);
  });

  it('a statblock profile carries maxHp = its evaluated hp', () => {
    const profile = spawnMonster(rt, bestiaryIds(rt)[0]!, 'foe');
    expect(profile.maxHp).toBe(profile.hp);
  });

  it('nothing equipped: the profile is the pre-equipment profile plus maxHp', () => {
    const character = survivor();
    const state = character.state;
    const derived = character.derived();
    const { profile } = profileFromCharacter(rt, character);
    const { maxHp, ...rest } = profile;
    const base = { ...state.abilities, ...state.saves, level: state.level };
    expect(maxHp).toBe(derived.hp);
    expect(rest).toEqual({
      id: state.id,
      abilities: state.abilities,
      saves: state.saves,
      level: state.level,
      hp: state.hp.current,
      ac: derived.ac,
      initiativeBonus: evalPackFormula(rt.pack, 'initiative', base),
      actions: rt.pack.content.classes![classId]!.actions,
      ...(derived.attackBonus !== undefined ? { attackBonus: derived.attackBonus } : {}),
      ...(profile.attackTable !== undefined ? { attackTable: profile.attackTable } : {}),
    });
  });
});

function startCombatWith(rt: Runtime, profile: CombatantProfile) {
  return startCombat(rt, {
    allies: [{ id: 'hero', profile }],
    enemies: [{ id: 'foe', profile: spawnMonster(rt, bestiaryIds(rt)[0]!, 'foe') }],
    positions: { hero: { x: 0, y: 0 }, foe: { x: 1, y: 0 } },
  });
}
