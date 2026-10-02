/**
 * CAP-A7 / CA-A4 — spell lists reach their spells (DD-A7). `knownSpells` matches
 * a class `spellLists` entry against a spell's `magic.lists` by exact string;
 * the bundled content must satisfy that match. Every theme is generated at
 * seed 42 through the compiler's public barrel and read through the runtime's.
 */
import { describe, expect, it } from 'vitest';
import { generateCampaign, loadTheme } from '../../src/compiler';
import { Runtime, knownSpells } from '../../src/runtime';
import type { Pack } from '../../src/schema/pack';

const THEMES = ['dark-fantasy', 'zombie-urban', 'wyldwood'] as const;

function generated(themeId: (typeof THEMES)[number]): Pack {
  return generateCampaign({ theme: loadTheme(themeId), seed: 42 });
}

function spellListsOf(pack: Pack): Set<string> {
  return new Set(Object.values(pack.content.spells ?? {}).flatMap((spell) => spell.magic.lists));
}

describe('CA-A4 content invariant: class spell lists and spell lists meet', () => {
  for (const themeId of THEMES) {
    it(`${themeId}: every class spellLists entry names a list some spell is on`, () => {
      const pack = generated(themeId);
      const lists = spellListsOf(pack);
      for (const [classId, def] of Object.entries(pack.content.classes ?? {})) {
        for (const list of def.spellLists ?? []) expect(lists.has(list), `${classId} → ${list}`).toBe(true);
      }
    });

    it(`${themeId}: every spell list is drawn by at least one class`, () => {
      const pack = generated(themeId);
      const drawn = new Set(Object.values(pack.content.classes ?? {}).flatMap((def) => def.spellLists ?? []));
      for (const list of spellListsOf(pack)) expect(drawn.has(list), list).toBe(true);
    });
  }
});

describe('CAP-A7: known spells per class (knownSpells, FR-9)', () => {
  function known(themeId: (typeof THEMES)[number], classId: string): readonly string[] {
    const rt = new Runtime(generated(themeId));
    const race = Object.entries(rt.pack.content.races ?? {}).find(
      ([, def]) => def.caps === undefined || def.caps[classId] !== undefined,
    )![0];
    const character = rt.createCharacter({ name: classId, race, classes: [{ id: classId, level: 1 }] });
    return knownSpells(rt, character.state);
  }

  it('zombie-urban medic knows bind-the-bite and clean-sear', () => {
    expect(known('zombie-urban', 'medic')).toEqual(expect.arrayContaining(['bind-the-bite', 'clean-sear']));
  });

  it('zombie-urban fixer knows quietsong and rot-read', () => {
    expect(known('zombie-urban', 'fixer')).toEqual(expect.arrayContaining(['quietsong', 'rot-read']));
  });

  it('zombie-urban scavenger stays a non-caster', () => {
    expect(known('zombie-urban', 'scavenger')).toEqual([]);
  });

  it('wyldwood hedge-mage knows its 4 spells', () => {
    expect(known('wyldwood', 'hedge-mage')).toEqual(
      expect.arrayContaining(['gloam-veil', 'wyrd-bloom', 'verge-light', 'briar-word']),
    );
  });
});
