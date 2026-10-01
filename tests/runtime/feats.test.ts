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
