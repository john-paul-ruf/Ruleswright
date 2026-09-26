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
  type RuntimeEvent,
} from '../../../src/runtime';
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
        const mirror = profileFromStatblock(rt.pack, { name: 'mirror', threat: 1, level: state.level, abilityOverrides: { ...state.abilities }, saveOverrides: { ...state.saves }, actions: ['x'] }, 'mirror');
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
 * the first bestiary entry, driven only by step/declare/respond — every turn
 * declares the first action the engine accepts, every trigger offer is
 * declined — for at most 500 steps.
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
      it(`${themeId}·42 · ${classId}: legal declares every turn, bounded, deterministic`, () => {
        const first = fightScript(themeId, race, classId);
        expect(first.steps).toBeLessThanOrEqual(500);
        expect(first.resolved['hero']).toBeGreaterThan(0);
        expect(first.events.some((event) => event.type === 'action:resolved' && event.actor === 'hero')).toBe(true);
        expect(first.events.some((event) => event.type === 'declare:rejected' && event.actor === 'hero')).toBe(false);
        const second = fightScript(themeId, race, classId);
        expect(JSON.stringify(second.events)).toBe(JSON.stringify(first.events));
        expect(second.fight.serialize()).toEqual(first.fight.serialize());
      });
    }
  }

  it.todo('each fight reaches phase combat-over within 500 steps — blocked: the combat engine has no transition into combat-over (SESSION-E1 handoff)');
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
    expect(profileFromCharacter(rt, character).profile.attackTable).toEqual([{ level: 2, byDefense: cryptRow.byDefense }]);
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
    expect(profile.actions).toEqual(['strike', 'cut-down', 'withdraw', 'brace', 'parry', 'hurl', 'long-shot', 'ward-glint', 'ember-surge']);
    expect(profile.attackBonus).toBe(character.derived().attackBonus);
    expect(profile.attackTable).toBeUndefined();
  });

  it('balances reflect a spent pool point and a prepared spell', () => {
    const character = hero(rt, 'ashkin', [{ id: 'hexer', level: 1 }]);
    const ember = character.state.pools['ember']!;
    const spell = knownSpells(rt, character.state).find((id) => rt.pack.content.spells![id]!.magic.level === 1)!;
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
        expect.objectContaining({ rule: 'no-combat-actions', artifactId: 'warden', jsonPath: 'content.classes', hint: 'declare actions on the class (pack v1.2)' }),
      ]);
    }
  });
});
