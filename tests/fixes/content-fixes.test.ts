/**
 * v1.8 content and starting-ability tests: class ability arrays, explicit request scores,
 * ascending AC, ability-scaled monster attacks, real encounter budgets and level-up XP.
 */
import { describe, expect, it } from 'vitest';
import { generateCampaign, loadTheme } from '../../src/compiler';
import { loadAdventureTemplate } from '../../src/compiler/adventure-templates';
import { Runtime } from '../../src/runtime/runtime';
import { CharacterBuildError } from '../../src/runtime/progression';
import { validatePack } from '../../src/schema/validate';
import { levelForXp } from '../../src/runtime';

const THEMES = ['dark-fantasy', 'zombie-urban', 'wyldwood'] as const;
const pack = (theme: (typeof THEMES)[number]) => generateCampaign({ theme: loadTheme(theme), seed: 42 });

describe('starting ability scores', () => {
  it('a character starts from its first class’s declared array', () => {
    const rt = new Runtime(pack('dark-fantasy'));
    const warden = rt.createCharacter({ name: 'W', race: 'hillfolk', classes: ['warden'] });
    expect(warden.state.abilities).toEqual(rt.pack.content.classes!['warden']!.abilities);
    expect(warden.derived().hp).toBe(6 + 1 + 2 * 2);
    const hexer = rt.createCharacter({ name: 'H', race: 'hillfolk', classes: ['hexer'] });
    expect(hexer.state.pools['ember']).toBe(8 + 3);
  });

  it('request scores override the class array; unlisted ones keep it', () => {
    const rt = new Runtime(pack('dark-fantasy'));
    const c = rt.createCharacter({
      name: 'C',
      race: 'hillfolk',
      classes: ['warden'],
      abilities: { vigor: 4 },
    });
    expect(c.state.abilities['vigor']).toBe(4);
    expect(c.state.abilities['might']).toBe(3);
    expect(c.derived().hp).toBe(6 + 1 + 4 * 2);
  });

  it('a class without an array keeps the engine default 10', () => {
    const p = pack('dark-fantasy');
    delete p.content.classes!['warden']!.abilities;
    const rt = new Runtime(p);
    const c = rt.createCharacter({ name: 'C', race: 'hillfolk', classes: ['warden'] });
    expect(Object.values(c.state.abilities).every((score) => score === 10)).toBe(true);
  });

  it('unknown or non-integer request scores are refused with named rules, nothing created', () => {
    const rt = new Runtime(pack('dark-fantasy'));
    const attempt = (abilities: Record<string, number>) => {
      try {
        rt.createCharacter({ name: 'X', race: 'hillfolk', classes: ['warden'], abilities });
      } catch (error) {
        expect(error).toBeInstanceOf(CharacterBuildError);
        return (error as CharacterBuildError).errors.map((card) => card.rule);
      }
      return [];
    };
    expect(attempt({ luck: 3 })).toEqual(['unknown-ability']);
    expect(attempt({ might: 2.5 })).toEqual(['invalid-build']);
  });

  it('the validator checks class arrays against stats.abilities', () => {
    const p = pack('wyldwood') as unknown as {
      content: { classes: Record<string, Record<string, unknown>> };
    };
    p.content.classes['warden']!['abilities'] = { luck: 3, might: 'high' };
    const cards = validatePack(p);
    expect(cards.some((c) => c.rule === 'E-REF-01' && c.jsonPath.endsWith('abilities.luck'))).toBe(true);
    expect(cards.some((c) => c.rule === 'E-SCHEMA-01' && c.jsonPath.endsWith('abilities.might'))).toBe(true);
  });
});

describe.each(THEMES)('%s bundled content', (theme) => {
  const p = pack(theme);

  it('every class declares a starting array over every ability', () => {
    for (const def of Object.values(p.content.classes ?? {}))
      expect(Object.keys(def.abilities ?? {}).sort()).toEqual([...p.stats.abilities].sort());
  });

  it('AC is ascending: armor and level raise it', () => {
    expect(p.formulas['ac']!.expr).toMatch(/\+ floor\(level \/ 3\) \+ gear-ac$/);
  });

  it('every monster damage attack scales with an ability; ranged weapons declare a range', () => {
    const monsterActions = new Set(Object.values(p.bestiary).flatMap((m) => m.actions));
    for (const id of monsterActions) {
      const effect = p.actions[id]?.effect ?? '';
      if (!/attack\(ac, /.test(effect)) continue;
      expect(effect, id).not.toMatch(/attack\(ac, 0\)/);
    }
    const RANGED = {
      'dark-fantasy': ['hurl', 'long-shot'],
      'zombie-urban': ['pistol-shot', 'crossbow-bolt'],
      wyldwood: ['bow-volley', 'glade-spear'],
    }[theme];
    for (const id of RANGED) expect(p.actions[id]!.range, id).toBeGreaterThan(1);
  });

  it('adventure fights can afford more than the cheapest monster, and the XP rewards level the party', () => {
    const template = loadAdventureTemplate(theme, p);
    const cheapest = Math.min(...Object.values(p.bestiary).map((m) => m.threat));
    const budgets = Object.values(template.locations)
      .filter((l) => l.encounter)
      .map((l) => l.encounter!.budget);
    expect(Math.max(...budgets)).toBeGreaterThanOrEqual(cheapest * 3);
    const xp = template.rewards.reduce((sum, r) => sum + r.xpPerMember, 0);
    const rt = new Runtime(p);
    expect(levelForXp(rt, xp)).toBeGreaterThanOrEqual(2);
  });
});
