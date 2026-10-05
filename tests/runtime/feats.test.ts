/**
 * CAP-S5 (DD-S11, CA-S4 feats half) — a character learns a pack-declared feat:
 * `learnFeat` and the `character.learnFeat` facade, the `feat:learned` event,
 * the `unknown-feat` / `feat-known` refusals (nothing changes), and the bridge
 * into combat: `profileFromCharacter` carries the held feats that declare a
 * `trigger`, and only those.
 */
import { describe, expect, it } from 'vitest';
import {
  Runtime,
  RuntimeRuleError,
  learnFeat,
  profileFromCharacter,
  type Character,
} from '../../src/runtime';
import { emberMarchesPack } from './fixtures/packs';
import { cloneRuntimePack } from './fixtures/pack';
import type { Pack } from '../../src/schema/pack';

/** The fixture pack plus a passive feat and warden combat actions (pack data only). */
function featPack(): Pack {
  const pack = emberMarchesPack();
  pack.content.feats!['iron-will'] = { name: 'Iron Will' };
  pack.content.classes!['warden']!.actions = ['strike'];
  return pack;
}

function brynn(runtime: Runtime): Character {
  return runtime.createCharacter({ name: 'Brynn', race: 'ashling', classes: [{ id: 'warden', level: 1 }] });
}

function refusal(run: () => unknown): { rule: string; artifactId: string; jsonPath: string } {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(RuntimeRuleError);
    const cards = (error as RuntimeRuleError).errors;
    expect(cards).toHaveLength(1);
    return { rule: cards[0]!.rule, artifactId: cards[0]!.artifactId, jsonPath: cards[0]!.jsonPath };
  }
  throw new Error('expected a refusal');
}

describe('learnFeat (DD-S11, CAP-S5)', () => {
  it('a new character holds no feats — the field is absent until the first learn', () => {
    const runtime = new Runtime(featPack());
    expect('feats' in brynn(runtime).state).toBe(false);
  });

  it('learning appends the feat and emits feat:learned {featId} with provenance', () => {
    const runtime = new Runtime(featPack());
    const character = brynn(runtime);
    const event = learnFeat(runtime, character.state, 'second-gust');
    expect(character.state.feats).toEqual(['second-gust']);
    expect(event).toMatchObject({
      type: 'feat:learned',
      actor: character.state.id,
      payload: { featId: 'second-gust' },
      why: { rule: 'content.feats.second-gust', rolls: [] },
    });
    character.learnFeat('iron-will');
    expect(character.state.feats).toEqual(['second-gust', 'iron-will']);
    expect(runtime.events.sinceRound(0).filter((e) => e.type === 'feat:learned')).toHaveLength(2);
  });

  it('an unknown feat is refused (unknown-feat) and nothing changes', () => {
    const runtime = new Runtime(featPack());
    const character = brynn(runtime);
    const before = runtime.events.sinceRound(0).length;
    expect(refusal(() => character.learnFeat('moon-step'))).toEqual({
      rule: 'unknown-feat',
      artifactId: 'moon-step',
      jsonPath: 'feats',
    });
    expect('feats' in character.state).toBe(false);
    expect(runtime.events.sinceRound(0)).toHaveLength(before);
  });

  it('a feat already held is refused (feat-known) and nothing changes', () => {
    const runtime = new Runtime(featPack());
    const character = brynn(runtime);
    character.learnFeat('second-gust');
    const before = runtime.events.sinceRound(0).length;
    expect(refusal(() => character.learnFeat('second-gust'))).toEqual({
      rule: 'feat-known',
      artifactId: 'second-gust',
      jsonPath: 'feats',
    });
    expect(character.state.feats).toEqual(['second-gust']);
    expect(runtime.events.sinceRound(0)).toHaveLength(before);
  });
});

describe('profile.feats (CA-S4 feats half)', () => {
  it('a learned reactive feat reaches the combat profile', () => {
    const runtime = new Runtime(featPack());
    const character = brynn(runtime);
    character.learnFeat('second-gust');
    character.learnFeat('iron-will');
    expect(profileFromCharacter(runtime, character).profile.feats).toEqual(['second-gust']);
  });

  it('a passive feat alone, or no feat at all, leaves profile.feats absent', () => {
    const runtime = new Runtime(featPack());
    const none = brynn(runtime);
    expect('feats' in profileFromCharacter(runtime, none).profile).toBe(false);
    const passive = brynn(runtime);
    passive.learnFeat('iron-will');
    expect('feats' in profileFromCharacter(runtime, passive).profile).toBe(false);
  });

  it('featEffects holds the parse-once AST of every feat declaring an effect, and only those', () => {
    const runtime = new Runtime(featPack());
    expect(Object.keys(runtime.index.featEffects)).toEqual(['second-gust']);
  });
});

describe('feat slots (v1.8, CAP-F2)', () => {
  /** featPack plus warden `featSlots [1, 2]` (and hexer when given) and a third feat — pack data only. */
  function slottedPack(hexerSlots?: number[]): Pack {
    const pack = featPack();
    pack.content.feats!['deep-root'] = { name: 'Deep Root' };
    pack.progression['warden']!.featSlots = [1, 2];
    if (hexerSlots !== undefined) pack.progression['hexer']!.featSlots = hexerSlots;
    return pack;
  }

  function slotRefusal(run: () => unknown): RuntimeRuleError {
    try {
      run();
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeRuleError);
      return error as RuntimeRuleError;
    }
    throw new Error('expected a refusal');
  }

  it('a level-1 warden learns one feat; the second is refused and nothing changes', () => {
    const runtime = new Runtime(slottedPack());
    const character = brynn(runtime);
    character.learnFeat('iron-will');
    const before = runtime.events.sinceRound(0).length;
    expect(refusal(() => character.learnFeat('second-gust'))).toEqual({
      rule: 'feat-slots-exceeded',
      artifactId: 'second-gust',
      jsonPath: 'feats',
    });
    expect(character.state.feats).toEqual(['iron-will']);
    expect(runtime.events.sinceRound(0)).toHaveLength(before);
  });

  it('at warden level 2 the second learn succeeds', () => {
    const runtime = new Runtime(slottedPack());
    const character = runtime.createCharacter({
      name: 'Brynn',
      race: 'ashling',
      classes: [{ id: 'warden', level: 2 }],
    });
    character.learnFeat('iron-will');
    character.learnFeat('second-gust');
    expect(character.state.feats).toEqual(['iron-will', 'second-gust']);
  });

  it('slots sum across classes (DD-F2): warden 1 + hexer 1 learns two, the third is refused', () => {
    const runtime = new Runtime(slottedPack([1, 1]));
    const character = runtime.createCharacter({
      name: 'Twin',
      race: 'ashling',
      classes: [
        { id: 'warden', level: 1 },
        { id: 'hexer', level: 1 },
      ],
    });
    character.learnFeat('iron-will');
    character.learnFeat('second-gust');
    expect(refusal(() => character.learnFeat('deep-root')).rule).toBe('feat-slots-exceeded');
    expect(character.state.feats).toEqual(['iron-will', 'second-gust']);
  });

  it('in a slotted pack a class without featSlots contributes 0 (DD-F3)', () => {
    const runtime = new Runtime(slottedPack());
    const character = runtime.createCharacter({ name: 'Hex', race: 'ashling', classes: ['hexer'] });
    expect(refusal(() => character.learnFeat('iron-will'))).toEqual({
      rule: 'feat-slots-exceeded',
      artifactId: 'iron-will',
      jsonPath: 'feats',
    });
    expect('feats' in character.state).toBe(false);
  });

  it("the refusal's hint names each class's contribution", () => {
    const runtime = new Runtime(slottedPack([0, 1]));
    const character = runtime.createCharacter({
      name: 'Twin',
      race: 'ashling',
      classes: [
        { id: 'warden', level: 1 },
        { id: 'hexer', level: 1 },
      ],
    });
    character.learnFeat('iron-will');
    const card = slotRefusal(() => character.learnFeat('deep-root')).errors[0]!;
    expect(card.hint).toBe('feat slots by class: warden 1 → 1, hexer 1 → 0');
    expect(card.message).toContain('grant 1');
  });
});

describe('granted is not learned (v1.10, DD-C2, CA-C3)', () => {
  /** RUNTIME_PACK: warden L1 is granted the passive `feature-warden-oath`; featSlots added (pack data only). */
  function grantingRuntime(): Runtime {
    const pack = cloneRuntimePack();
    expect(pack.progression['warden']!.features).toEqual([{ level: 1, ref: 'feature-warden-oath' }]);
    pack.progression['warden']!.featSlots = [1, 1, 2, 2];
    return new Runtime(pack);
  }

  it('learning a granted feat is refused feat-known, naming the class feature; nothing changes', () => {
    const runtime = grantingRuntime();
    const warden = runtime.createCharacter({ name: 'Brynn', race: 'ashkin', classes: ['warden'] });
    const before = runtime.events.sinceRound(0).length;
    try {
      learnFeat(runtime, warden.state, 'feature-warden-oath');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeRuleError);
      const cards = (error as RuntimeRuleError).errors;
      expect(cards.map((card) => [card.rule, card.artifactId, card.jsonPath])).toEqual([
        ['feat-known', 'feature-warden-oath', 'feats'],
      ]);
      expect(cards[0]!.message).toContain('by a class feature');
    }
    expect('feats' in warden.state).toBe(false);
    expect(runtime.events.sinceRound(0)).toHaveLength(before);
  });

  it('the granted feat uses no slot: a warden L1 (1 slot) still learns one feat', () => {
    const runtime = grantingRuntime();
    const warden = runtime.createCharacter({ name: 'Brynn', race: 'ashkin', classes: ['warden'] });
    warden.learnFeat('ironhide');
    expect(warden.state.feats).toEqual(['ironhide']);
    expect(refusal(() => warden.learnFeat('vengeful-strike')).rule).toBe('feat-slots-exceeded');
  });
});
