/**
 * CAP-C6 / CA-C2 consumer / DD-C5 / DD-C6 — `features.ts`: the class-feature
 * views a character's classes yield (kind by map, active by class level), the
 * derived granted/unlocked lists in DD-C5 order, and statblocks untouched.
 */
import { describe, expect, it } from 'vitest';
import { generateCampaign, loadTheme } from '../../src/compiler';
import { Runtime, spawnMonster } from '../../src/runtime';
import { classFeatures, grantedFeats, unlockedActions, unlockedSpells } from '../../src/runtime/features';
import { cloneRuntimePack } from './fixtures/pack';

const darkFantasy = (): Runtime =>
  new Runtime(generateCampaign({ theme: loadTheme('dark-fantasy'), seed: 42 }));

describe('classFeatures (DD-C7)', () => {
  it('fixture warden L1: the passive feature-warden-oath is an active feat feature', () => {
    const rt = new Runtime(cloneRuntimePack());
    const warden = rt.createCharacter({ name: 'Brynn', race: 'ashkin', classes: ['warden'] });
    expect(classFeatures(rt, warden.state)).toEqual([
      { classId: 'warden', level: 1, ref: 'feature-warden-oath', kind: 'feat', active: true },
    ]);
    expect(grantedFeats(rt, warden.state.classes)).toEqual(['feature-warden-oath']);
    expect(classFeatures(rt, { classes: [{ id: 'hexer', level: 4 }] })).toEqual([]);
  });

  it('dark-fantasy crypt-warden at L1, L2, L3: kinds by map, active by class level', () => {
    const rt = darkFantasy();
    const at = (level: number) => classFeatures(rt, { classes: [{ id: 'crypt-warden', level }] });
    const rows = (l2: boolean, l3: boolean) => [
      { classId: 'crypt-warden', level: 2, ref: 'barrow-rite', kind: 'action', active: l2 },
      { classId: 'crypt-warden', level: 3, ref: 'crypt-vigil', kind: 'feat', active: l3 },
    ];
    expect(at(1)).toEqual(rows(false, false));
    expect(at(2)).toEqual(rows(true, false));
    expect(at(3)).toEqual(rows(true, true));
    const l2 = [{ id: 'crypt-warden', level: 2 }];
    expect(unlockedActions(rt, l2)).toEqual(['barrow-rite']);
    expect(grantedFeats(rt, l2)).toEqual([]);
    expect(unlockedSpells(rt, l2)).toEqual([]);
  });

  it('a spell ref is kind spell (zombie-urban medic rot-read @3)', () => {
    const rt = new Runtime(generateCampaign({ theme: loadTheme('zombie-urban'), seed: 42 }));
    expect(unlockedSpells(rt, [{ id: 'medic', level: 2 }])).toEqual([]);
    expect(unlockedSpells(rt, [{ id: 'medic', level: 3 }])).toEqual(['rot-read']);
  });

  it('multi-class: class order, then feature order; a ref two classes grant appears once (DD-C5)', () => {
    const rt = darkFantasy();
    const classes = [
      { id: 'crypt-warden', level: 3 },
      { id: 'warden', level: 3 },
    ];
    expect(classFeatures(rt, { classes }).map((view) => `${view.classId}:${view.ref}`)).toEqual([
      'crypt-warden:barrow-rite',
      'crypt-warden:crypt-vigil',
      'warden:oath-of-the-warden',
      'warden:wardens-resolve',
    ]);
    expect(grantedFeats(rt, classes)).toEqual(['crypt-vigil', 'oath-of-the-warden', 'wardens-resolve']);

    const pack = cloneRuntimePack();
    pack.progression['hexer']!.features = [{ level: 1, ref: 'feature-warden-oath' }];
    const twin = new Runtime(pack);
    const both = [
      { id: 'hexer', level: 1 },
      { id: 'warden', level: 1 },
    ];
    expect(classFeatures(twin, { classes: both }).map((view) => view.classId)).toEqual(['hexer', 'warden']);
    expect(grantedFeats(twin, both)).toEqual(['feature-warden-oath']);
  });

  it('a statblock using the warden attackTable carries no granted feat and no unlocked action (DD-C6)', () => {
    const pack = cloneRuntimePack();
    pack.progression['warden']!.features = [
      { level: 1, ref: 'feature-warden-oath' },
      { level: 1, ref: 'vengeful-strike' },
      { level: 1, ref: 'step-aside' },
    ];
    const rt = new Runtime(pack);
    expect(pack.bestiary['barrow-wight']!.attackTable).toBe('warden');
    const profile = spawnMonster(rt, 'barrow-wight', 'wight');
    expect(profile.actions).toEqual(['strike']);
    expect(profile.feats).toBeUndefined();
  });
});
