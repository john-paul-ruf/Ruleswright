/**
 * CAP-F5 — the feat-slot journey on generated content (v1.8, DD-F1…F8;
 * CA-F1 field meaning, CA-F2 refusal semantics, CA-F3 restore):
 * `generateCampaign({theme, seed: 42})` (stage 8 is `validatePack`) →
 * `new Runtime(pack)` → `createCharacter` → `learnFeat` / `levelSet` /
 * `awardXp` → `serializeCharacter` / `serializeParty` → JSON → `restoreCharacter`
 * / `restoreParty` on a fresh Runtime.
 *
 * No fixture stands in for production data: every pack is generated, every leg
 * runs on a fresh Runtime. The bundled themes grant 1 feat at level 1, 2 at
 * level 3 (DD-F8); the unslotted control strips the data and gets v1.7 back.
 */
import { describe, expect, it } from 'vitest';
import { generateCampaign, loadTheme } from '../../src/compiler';
import {
  CharacterBuildError,
  Runtime,
  RuntimeRuleError,
  restoreCharacter,
  restoreParty,
  serializeCharacter,
  serializeParty,
  type Character,
} from '../../src/runtime';
import type { Pack } from '../../src/schema/pack';

type ThemeId = 'dark-fantasy' | 'zombie-urban' | 'wyldwood';

const SEED = 42;

function generated(themeId: ThemeId): Pack {
  return generateCampaign({ theme: loadTheme(themeId), seed: SEED });
}

function warden(rt: Runtime, level: number, race = 'ashkin'): Character {
  return rt.createCharacter({ name: 'Brynn', race, classes: [{ id: 'warden', level }] });
}

/** The refusal's rules (RuntimeRuleError or CharacterBuildError). */
function refusedRules(run: () => unknown): string[] {
  try {
    run();
  } catch (error) {
    if (error instanceof RuntimeRuleError || error instanceof CharacterBuildError) {
      return error.errors.map((card) => card.rule);
    }
    throw error;
  }
  throw new Error('expected a refusal');
}

describe('feat-slot journey (CAP-F5) — dark-fantasy, seed 42', () => {
  const pack = generated('dark-fantasy');

  it('leg 1 — load: the generated pack validates and every class carries featSlots', () => {
    const classIds = Object.keys(pack.content.classes ?? {});
    expect(classIds).toHaveLength(3);
    for (const classId of classIds) expect(pack.progression[classId]?.featSlots, classId).toBeDefined();
    expect(() => new Runtime(pack)).not.toThrow();
  });

  it('leg 2 — learn: a level-1 warden learns one feat; the second is refused and nothing changes', () => {
    const rt = new Runtime(pack);
    const c = warden(rt, 1);
    c.learnFeat('ironhide');
    const before = rt.events.sinceRound(0).length;
    expect(refusedRules(() => c.learnFeat('steady-hands'))).toEqual(['feat-slots-exceeded']);
    expect(c.state.feats).toEqual(['ironhide']);
    expect(rt.events.sinceRound(0)).toHaveLength(before);
  });

  it('legs 3–5 — level up opens a slot; level down is refused; an XP award never lowers the level', () => {
    const rt = new Runtime(pack);
    const c = warden(rt, 1);
    c.learnFeat('ironhide');
    rt.levelSet(c, [{ id: 'warden', level: 3 }]);
    c.learnFeat('steady-hands');
    expect(c.state.feats).toEqual(['ironhide', 'steady-hands']);

    expect(refusedRules(() => rt.levelSet(c, [{ id: 'warden', level: 1 }]))).toEqual(['feat-slots-exceeded']);
    expect(c.state.classes).toEqual([{ id: 'warden', level: 3 }]);

    // v1.9 (DD-R4): 100 XP reaches level 1, below the directly set level 3 — the level is kept
    expect(() => rt.awardXp(c, 100)).not.toThrow();
    expect(c.state.xp).toBe(100);
    expect(c.state.classes).toEqual([{ id: 'warden', level: 3 }]);
    expect(c.state.feats).toEqual(['ironhide', 'steady-hands']);
  });

  it('leg 6 — multi-class: warden 1 + hexer 1 learns two feats, the third is refused', () => {
    const rt = new Runtime(pack);
    const c = rt.createCharacter({
      name: 'Twin',
      race: 'hillfolk',
      classes: [
        { id: 'warden', level: 1 },
        { id: 'hexer', level: 1 },
      ],
    });
    c.learnFeat('ironhide');
    c.learnFeat('steady-hands');
    expect(refusedRules(() => c.learnFeat('woodwise'))).toEqual(['feat-slots-exceeded']);
    expect(c.state.feats).toEqual(['ironhide', 'steady-hands']);
  });

  it('leg 7 — snapshot: feats restore in order; an over-cap character or party member is refused', () => {
    const rt = new Runtime(pack);
    const c = warden(rt, 3);
    c.learnFeat('steady-hands');
    c.learnFeat('ironhide');
    const text = JSON.stringify(serializeCharacter(rt, c.state));
    expect(restoreCharacter(new Runtime(pack), JSON.parse(text)).state.feats).toEqual([
      'steady-hands',
      'ironhide',
    ]);

    const over = JSON.parse(text) as { state: { feats: string[] } };
    over.state.feats.push('woodwise');
    const target = new Runtime(pack);
    expect(refusedRules(() => restoreCharacter(target, over as never))).toEqual(['feat-slots-exceeded']);
    expect(target.nextCharacterId).toBe(1);

    const party = JSON.parse(JSON.stringify(serializeParty(rt, [c.state, warden(rt, 1).state]))) as {
      members: { feats?: string[] }[];
    };
    party.members[1]!.feats = ['ironhide', 'woodwise'];
    expect(refusedRules(() => restoreParty(target, party as never))).toEqual(['feat-slots-exceeded']);
    expect(target.nextCharacterId).toBe(1);
  });

  it('leg 9 — unslotted control: with featSlots stripped, a level-1 warden learns all 4 learnable feats', () => {
    const stripped = generated('dark-fantasy');
    for (const table of Object.values(stripped.progression)) delete table.featSlots;
    const rt = new Runtime(stripped);
    const c = warden(rt, 1);
    // a feat some class feature names is granted, not learned (v1.10, DD-C2)
    const featureRefs = new Set(
      Object.values(stripped.progression).flatMap((table) =>
        (table.features ?? []).map((feature) => feature.ref),
      ),
    );
    const feats = Object.keys(stripped.content.feats ?? {}).filter((featId) => !featureRefs.has(featId));
    expect(feats).toHaveLength(4);
    for (const featId of feats) c.learnFeat(featId);
    expect(c.state.feats).toEqual(feats);
  });
});

describe('feat-slot journey (CAP-F5) — leg 8, the other themes', () => {
  for (const themeId of ['zombie-urban', 'wyldwood'] as const) {
    it(`${themeId}: every class at level 1 learns exactly one feat; the second is refused`, () => {
      const pack = generated(themeId);
      const [first, second] = Object.keys(pack.content.feats ?? {});
      const race = Object.keys(pack.content.races ?? {})[0]!;
      const classIds = Object.keys(pack.content.classes ?? {});
      expect(classIds).toHaveLength(3);
      for (const classId of classIds) {
        const rt = new Runtime(pack);
        const c = rt.createCharacter({ name: classId, race, classes: [{ id: classId, level: 1 }] });
        c.learnFeat(first!);
        expect(
          refusedRules(() => c.learnFeat(second!)),
          classId,
        ).toEqual(['feat-slots-exceeded']);
        expect(c.state.feats, classId).toEqual([first]);
      }
    });
  }
});
