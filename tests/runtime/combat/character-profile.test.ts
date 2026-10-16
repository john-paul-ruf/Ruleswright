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
  prepareSpell,
  profileFromCharacter,
  profileFromStatblock,
  settleItemUses,
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
      'stride',
      'opportunist',
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
      speed: evalPackFormula(rt.pack, 'speed', base),
      actions: rt.pack.content.classes![classId]!.actions,
      ...(derived.attackBonus !== undefined ? { attackBonus: derived.attackBonus } : {}),
      ...(profile.attackTable !== undefined ? { attackTable: profile.attackTable } : {}),
    });
  });
});

describe('v1.6 — the spell bridge (CA-S4): spells, castBlockedBy, bindings', () => {
  const rt = new Runtime(packFor('dark-fantasy'));

  it("a hexer's profile.spells equals knownSpells; a non-caster emits none", () => {
    const hexer = hero(rt, 'ashkin', [{ id: 'hexer', level: 1 }]);
    const { profile } = profileFromCharacter(rt, hexer);
    expect(profile.spells).toEqual(knownSpells(rt, hexer.state));
    expect(profile.spells!.length).toBeGreaterThan(0);
    const survivor = new Runtime(packFor('zombie-urban'));
    const nonCaster = hero(survivor, 'mile-born', [
      { id: Object.keys(survivor.pack.content.classes ?? {})[0]!, level: 1 },
    ]);
    expect('spells' in profileFromCharacter(survivor, nonCaster).profile).toBe(false);
  });

  it("balances.bindings is a deep copy of the character's slots: a prepared level-2 spell is bound", () => {
    const hexer = hero(rt, 'ashkin', [{ id: 'hexer', level: 3 }]);
    prepareSpell(rt, hexer.state, 'ember-bloom');
    const { balances } = profileFromCharacter(rt, hexer);
    expect(balances.bindings!['2']).toEqual(['ember-bloom', null, null]);
    expect(balances.bindings).toEqual(hexer.state.slots);
    expect(balances.bindings!['2']).not.toBe(hexer.state.slots['2']);
  });

  it('a hexer in warded-mail (armorCasting [leather]) carries castBlockedBy; unarmored, none', () => {
    const hexer = hero(rt, 'ashkin', [{ id: 'hexer', level: 1 }]);
    expect(rt.pack.content.classes!['hexer']!.armorCasting).toEqual(['leather']);
    expect('castBlockedBy' in profileFromCharacter(rt, hexer).profile).toBe(false);
    hexer.grant('warded-mail');
    hexer.equip('warded-mail', 'body');
    expect(profileFromCharacter(rt, hexer).profile.castBlockedBy).toBe('warded-mail');
  });
});

/**
 * v1.10 (CA-C4, DD-C9) — class features compose onto the profile: unlocked
 * actions after the class-actions union, granted reactive feats after the held
 * ones. A character with no active non-passive feature is byte-identical to
 * the same character on a pack with every `progression.*.features` deleted.
 */
describe('v1.10 — class features compose byte-stably (CA-C4, DD-C9)', () => {
  function featureless(pack: Pack): Pack {
    const clone = structuredClone(pack);
    for (const table of Object.values(clone.progression)) delete table.features;
    return clone;
  }

  it('a dark-fantasy warden L1 (passive features only): profile and knownSpells are byte-identical', () => {
    const pack = packFor('dark-fantasy');
    expect(pack.progression['warden']!.features).toEqual([
      { level: 1, ref: 'oath-of-the-warden' },
      { level: 3, ref: 'wardens-resolve' },
    ]);
    const withFeatures = new Runtime(pack);
    const without = new Runtime(featureless(pack));
    const a = hero(withFeatures, 'ashkin', [{ id: 'warden', level: 1 }]);
    const b = hero(without, 'ashkin', [{ id: 'warden', level: 1 }]);
    expect(JSON.stringify(profileFromCharacter(withFeatures, a, 'hero'))).toBe(
      JSON.stringify(profileFromCharacter(without, b, 'hero')),
    );
    expect(JSON.stringify(knownSpells(withFeatures, a.state))).toBe(
      JSON.stringify(knownSpells(without, b.state)),
    );
  });

  it('crypt-warden L3: barrow-rite after the class actions; held reactive feats, then granted ones', () => {
    const rt = new Runtime(packFor('dark-fantasy'));
    const cw = hero(rt, 'ashkin', [{ id: 'crypt-warden', level: 3 }]);
    const classActions = rt.pack.content.classes!['crypt-warden']!.actions!;
    expect(profileFromCharacter(rt, cw).profile.actions).toEqual([...classActions, 'barrow-rite']);
    expect(profileFromCharacter(rt, cw).profile.feats).toEqual(['crypt-vigil']);
    cw.learnFeat('second-gust');
    expect(profileFromCharacter(rt, cw).profile.feats).toEqual(['second-gust', 'crypt-vigil']);
    const l1 = hero(rt, 'ashkin', [{ id: 'crypt-warden', level: 1 }]);
    expect(profileFromCharacter(rt, l1).profile.actions).toEqual(classActions);
  });

  it('no-combat-actions counts unlocked actions: a stripped crypt-warden fights from L2 on', () => {
    const pack = packFor('dark-fantasy');
    delete pack.content.classes!['crypt-warden']!.actions;
    const rt = new Runtime(pack);
    const l1 = hero(rt, 'ashkin', [{ id: 'crypt-warden', level: 1 }]);
    expect(() => profileFromCharacter(rt, l1)).toThrow(/no combat actions/);
    const l2 = hero(rt, 'ashkin', [{ id: 'crypt-warden', level: 2 }]);
    expect(profileFromCharacter(rt, l2).profile.actions).toEqual(['barrow-rite']);
  });
});

function startCombatWith(rt: Runtime, profile: CombatantProfile) {
  return startCombat(rt, {
    allies: [{ id: 'hero', profile }],
    enemies: [{ id: 'foe', profile: spawnMonster(rt, bestiaryIds(rt)[0]!, 'foe') }],
    positions: { hero: { x: 0, y: 0 }, foe: { x: 1, y: 0 } },
  });
}

/**
 * CA-EG5 settlement / CAP-E8 (S05 ck3): a finished fight's item spend is written
 * back to the character's inventory by the host-called `settleItemUses`. Real
 * zombie-urban pack (seed 42, `med-kit` = heal(2 + ability(vigor))) plus two in-test
 * items: `field-dose` (consumable) and `stim-belt` (equippable AND consumable).
 */
describe('CA-EG5 — settleItemUses writes the fight’s spend back to the inventory', () => {
  function settlementRuntime(): Runtime {
    const pack = packFor('zombie-urban');
    pack.content.items!['field-dose'] = { name: 'Field Dose', kind: 'consumable', use: 'heal(1)' };
    pack.content.items!['stim-belt'] = { name: 'Stim Belt', kind: 'gear', slots: ['body'], use: 'heal(1)' };
    return new Runtime(pack);
  }

  /** Hero uses `uses` on its first turn, then both sides fight to combat-over. */
  function settledFight(prepare: (character: Character) => void, uses: readonly string[], finish = true) {
    const rt = settlementRuntime();
    const classId = Object.keys(rt.pack.content.classes ?? {})[0]!;
    const character = hero(rt, 'mile-born', [{ id: classId, level: 1 }]);
    prepare(character);
    const fight = startCombat(rt, {
      allies: [{ id: character.state.id, ...profileFromCharacter(rt, character) }],
      enemies: [{ id: 'foe', profile: spawnMonster(rt, bestiaryIds(rt)[0]!, 'foe') }],
      positions: { [character.state.id]: { x: 0, y: 0 }, foe: { x: 1, y: 0 } },
    });
    let used = false;
    for (let steps = 0; finish && fight.state.phase !== 'combat-over' && steps < 500; steps += 1) {
      for (const offer of [...fight.pendingTriggers]) fight.respond(offer.triggerId, 'decline');
      if (fight.step().kind !== 'turn-started') continue;
      const active = fight.state.combatants[fight.state.active]!;
      if (active.id === character.state.id && !used) {
        used = true;
        for (const itemId of uses) expect(fight.use(itemId)[0]!.type).toBe('item:used');
      }
      for (const actionId of active.actions) {
        fight.declare(actionId);
        if (fight.state.phase !== 'awaiting-declare') break;
      }
    }
    if (finish) expect(fight.state.phase).toBe('combat-over');
    return { rt, character, fight };
  }

  function rejection(run: () => unknown): { rule: string; artifactId: string }[] {
    try {
      run();
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeRuleError);
      return (error as RuntimeRuleError).errors.map((card) => ({
        rule: card.rule,
        artifactId: card.artifactId,
      }));
    }
    throw new Error('expected a RuntimeRuleError');
  }

  it('two uses → the inventory drops by exactly 2, with item:dropped + item:settled; itemsUsed cleared', () => {
    const { rt, character, fight } = settledFight((c) => c.grant('med-kit', 3), ['med-kit', 'med-kit']);
    const id = character.state.id;
    expect(fight.state.combatants[id]!.itemsUsed).toEqual({ 'med-kit': 2 });
    expect(character.count('med-kit')).toBe(3);
    const events = settleItemUses(rt, character, fight);
    expect(events.map((event) => event.type)).toEqual(['item:dropped', 'item:settled']);
    expect(events[1]!.payload).toEqual({ combatantId: id, itemId: 'med-kit', qty: 2 });
    expect(events[1]!.why).toEqual({ rule: 'content.items.med-kit', rolls: [] });
    expect(character.state.inventory).toEqual([{ id: 'med-kit', qty: 1 }]);
    expect(fight.state.combatants[id]!.itemsUsed).toEqual({});

    // A second call settles nothing.
    expect(settleItemUses(rt, character, fight)).toEqual([]);
    expect(character.state.inventory).toEqual([{ id: 'med-kit', qty: 1 }]);
  });

  it('several items settle in id order; the last unit removes the entry', () => {
    const { rt, character, fight } = settledFight(
      (c) => {
        c.grant('med-kit', 1);
        c.grant('field-dose', 2);
      },
      ['med-kit', 'field-dose'],
    );
    const settled = settleItemUses(rt, character, fight).filter((event) => event.type === 'item:settled');
    expect(settled.map((event) => event.payload['itemId'])).toEqual(['field-dose', 'med-kit']);
    expect(character.state.inventory).toEqual([{ id: 'field-dose', qty: 1 }]);
  });

  it('a live fight → combat-not-over, no change', () => {
    const { rt, character, fight } = settledFight((c) => c.grant('med-kit', 2), [], false);
    const id = character.state.id;
    fight.step();
    if (fight.state.active === id) fight.use('med-kit');
    const before = JSON.stringify({ state: character.state, fight: fight.state });
    expect(rejection(() => settleItemUses(rt, character, fight))).toEqual([
      { rule: 'combat-not-over', artifactId: id },
    ]);
    expect(JSON.stringify({ state: character.state, fight: fight.state })).toBe(before);
  });

  it('items no longer held → every card at once, no change', () => {
    const { rt, character, fight } = settledFight(
      (c) => {
        c.grant('med-kit', 2);
        c.grant('field-dose', 2);
      },
      ['med-kit', 'med-kit', 'field-dose'],
    );
    character.drop('med-kit', 2); // none left
    character.drop('field-dose', 2); // none left
    character.grant('med-kit', 1); // one left, two used
    const before = JSON.stringify({ state: character.state, fight: fight.state });
    expect(rejection(() => settleItemUses(rt, character, fight))).toEqual([
      { rule: 'item-not-held', artifactId: 'field-dose' },
      { rule: 'insufficient-qty', artifactId: 'med-kit' },
    ]);
    expect(JSON.stringify({ state: character.state, fight: fight.state })).toBe(before);
  });

  it('a used unit that is also equipped (held − used < equippedUnits) → item-equipped, no change (R-5)', () => {
    const { rt, character, fight } = settledFight(
      (c) => {
        c.grant('stim-belt', 2);
        c.equip('stim-belt', 'body');
      },
      ['stim-belt', 'stim-belt'],
    );
    const before = JSON.stringify({ state: character.state, fight: fight.state });
    expect(rejection(() => settleItemUses(rt, character, fight))).toEqual([
      { rule: 'item-equipped', artifactId: 'stim-belt' },
    ]);
    expect(JSON.stringify({ state: character.state, fight: fight.state })).toBe(before);
    // The same rule as dropItem's guard: dropping the two units is refused too.
    expect(rejection(() => character.drop('stim-belt', 2))).toEqual([
      { rule: 'item-equipped', artifactId: 'stim-belt' },
    ]);
    character.unequip('body');
    expect(settleItemUses(rt, character, fight).map((event) => event.type)).toEqual([
      'item:dropped',
      'item:settled',
    ]);
    expect(character.state.inventory).toEqual([]);
  });

  it('an unknown combatant id is refused', () => {
    const { rt, character, fight } = settledFight((c) => c.grant('med-kit', 1), ['med-kit']);
    expect(rejection(() => settleItemUses(rt, character, fight, 'nobody'))).toEqual([
      { rule: 'unknown-target', artifactId: 'nobody' },
    ]);
  });
});

describe('CA-01 initial condition transfer', () => {
  it('copies remaining conditions only when nonempty, beside profile and balances', () => {
    const rt = new Runtime(packFor('dark-fantasy'));
    const character = hero(rt, 'ashkin', [{ id: 'warden', level: 1 }]);
    expect(Object.keys(profileFromCharacter(rt, character)).sort()).toEqual(['balances', 'profile']);
    character.applyCondition('sapped');
    character.tick();
    const pair = profileFromCharacter(rt, character, 'hero');
    expect(pair.conditions).toEqual(character.state.conditions);
    const fight = startCombat(rt, {
      allies: [{ id: 'hero', ...pair }],
      enemies: [{ id: 'foe', profile: spawnMonster(rt, 'hill-spider', 'foe') }],
      positions: { hero: { x: 0, y: 0 }, foe: { x: 1, y: 0 } },
    });
    expect(fight.state.combatants['hero']!.conditions).toEqual(character.state.conditions);
    character.state.conditions[0]!.duration = 99;
    expect(pair.conditions![0]!.duration).not.toBe(99);
    fight.state.combatants['hero']!.conditions[0]!.duration = 88;
    expect(pair.conditions![0]!.duration).not.toBe(88);
  });
});
