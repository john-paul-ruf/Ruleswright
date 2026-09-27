/**
 * Checkpoint-1 suite — the named-stage pipeline (FR-17's machinery behind the
 * one call): stage order/replacement, per-stage stream independence (the same
 * stage name across two runs consumes the identical stream), and knob
 * validation + provenance (FR-18).
 */
import { describe, expect, it } from 'vitest';
import { validatePack } from '../../src/schema/validate';
import { packDslChecker } from '../../src/core/dsl/checker';
import { Rng } from '../../src/core/rng';
import { runPipeline, defaultStages, STAGE_ORDER } from '../../src/compiler/pipeline';
import { stageRng } from '../../src/compiler/rng-stream';
import { listThemeKnobs, resolveKnobs } from '../../src/compiler/knobs';
import { GenerationError } from '../../src/compiler/errors';
import { composeTheme, readPatch } from '../../src/compiler/compose';
import { DARK_FANTASY, ZOMBIE_URBAN, WYLDWOOD } from '../../src/compiler/theme-loader';
import type { Stage, GenerationContext } from '../../src/compiler/stage';
import type { ThemeTemplate, ThemePatch } from '../../src/compiler/theme';

/** A minimal theme that clears every stage: one of everything the stages read. */
export function microTheme(): ThemeTemplate {
  return {
    id: 'micro-vale',
    title: 'The Micro Vale',
    stats: {
      abilities: ['might', 'grace', 'vigor', 'reason', 'insight', 'presence'],
      saves: ['vigor', 'grace', 'tenacity', 'reason', 'presence'],
    },
    economy: { turnSlots: { main: 1, move: 1, reaction: 1 } },
    actions: {
      strike: {
        cost: { slots: { main: 1 } },
        effect: 'sequence(attack(ac, might), damage(1d8 + might, sharp))',
        tags: ['main'],
      },
      withdraw: { cost: { slots: { move: 1 } }, effect: 'applyCondition(braced, 2)', tags: ['move'] },
      parry: {
        cost: { slots: { reaction: 1 } },
        trigger: { on: 'attack:rolled[target=self]' },
        effect: 'sequence(attack(ac, grace), damage(1d6, sharp))',
        tags: ['reaction'],
      },
    },
    formulas: {
      hp: { expr: '8 + vigor * 2' },
      ac: { expr: '12 - floor(level / 2)' },
      initiative: { expr: 'd20 + grace' },
      stamina: { expr: '8 + vigor' },
    },
    content: {
      classes: {
        warden: { name: 'Warden', spellLists: ['warden'], armorCasting: ['mail'] },
        hexer: { name: 'Hexer', spellLists: ['hexer'] },
      },
      races: {
        hillfolk: { name: 'Hillfolk', caps: { hexer: 4 }, size: 'medium' },
        ashkin: { name: 'Ashkin' },
      },
      skills: {
        climb: { name: 'Climb', ability: 'grace' },
        lore: { name: 'Lore', ability: 'insight' },
      },
      feats: {
        ironhide: { name: 'Ironhide' },
        'second-gust': {
          name: 'Second Gust',
          trigger: { on: 'condition:applied[self]' },
          effect: 'applyCondition(braced, 2)',
        },
      },
      spells: {
        'hex-bolt': {
          name: 'Hex Bolt',
          magic: { level: 1, lists: ['hexer'] },
          cost: { points: { pool: 'stamina', amount: 3 } },
          effect: 'damage(1d6 + insight)',
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
        sapped: { name: 'Sapped', duration: 3, stacking: 'refresh', restricts: ['actions.tagged:main'] },
        hexbound: { name: 'Hexbound', duration: 2, stacking: 'stack', restricts: ['spells.tagged:casting'] },
        braced: { name: 'Braced', duration: 2, stacking: 'refresh' },
      },
      items: {
        'ember-oil': { name: 'Ember Oil', kind: 'consumable' },
      },
    },
    progression: {
      warden: {
        hd: 'd10',
        attackTable: [
          {
            level: 1,
            byDefense: { '2': 18, '3': 17, '4': 16, '5': 15, '6': 14, '7': 13, '8': 12, '9': 11, '10': 10 },
          },
          {
            level: 2,
            byDefense: { '2': 17, '3': 16, '4': 15, '5': 14, '6': 13, '7': 12, '8': 11, '9': 10, '10': 9 },
          },
        ],
        saves: { vigor: [2, 3], grace: [1, 2], tenacity: [1, 1] },
        slots: { '1': [2, 3], '2': [0, 1] },
      },
      hexer: {
        hd: 'd6',
        attackBonus: 'floor(level / 2) + might',
        saves: { reason: [2, 4], presence: [0, 1] },
        slots: { '1': [2, 3], '2': [0, 1] },
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
        attackTable: 'warden',
        actions: ['strike'],
      },
      'grave-shambles': {
        name: 'Grave Shambles',
        threat: 1.5,
        level: 1,
        hd: 'd8',
        abilityOverrides: { might: 3 },
        attackTable: 'warden',
        actions: ['withdraw'],
      },
    },
    tables: {
      'wandering-dread': {
        kind: 'weighted',
        entries: [
          { weight: 1, value: 'sapped' },
          { weight: 1, value: 'braced' },
        ],
      },
      weather: {
        kind: 'ranged',
        entries: [
          { min: 1, max: 50, value: 'clear' },
          { min: 51, max: 100, value: 'rain' },
        ],
      },
      'loot-chain': {
        kind: 'nested',
        entries: [{ value: 'weather' }, { value: 'nothing' }],
      },
    },
  };
}

describe('stage order and replacement (pipeline discipline)', () => {
  it('exposes the seven named code stages in pipeline order (validate is stage 8, schema\u2019s)', () => {
    expect(STAGE_ORDER).toEqual(['stats', 'skills', 'feats', 'classes', 'magic', 'bestiary', 'tables']);
    expect(defaultStages().map((stage) => stage.name)).toEqual(STAGE_ORDER);
  });

  it('a caller-supplied registry replaces stages by order, not by name-match magic', () => {
    const probe: Stage = {
      name: 'probe',
      run(ctx) {
        ctx.own = 'probed';
      },
    };
    expect(() =>
      runPipeline(microTheme(), 42, [...defaultStages().slice(0, 2), probe, ...defaultStages().slice(2)]),
    ).not.toThrow();
  });
});

describe('per-stage streams (FR-17 determinism discipline)', () => {
  it('the same stage name across two runs derives the identical stream (seed + ":" + stage name)', () => {
    const a = stageRng(42, 'stats');
    const b = stageRng(42, 'stats');
    const drawsA = [a.int(20), a.int(20), a.int(20)];
    const drawsB = [b.int(20), b.int(20), b.int(20)];
    expect(drawsB).toEqual(drawsA);
  });

  it('different stage names derive independent streams; the seed salts them', () => {
    const stats = stageRng(42, 'stats');
    const tables = stageRng(42, 'tables');
    expect([stats.int(100), stats.int(100)]).not.toEqual([tables.int(100), tables.int(100)]);
    const otherSeed = stageRng(43, 'stats');
    expect([stats.int(100), stats.int(100)]).not.toEqual([otherSeed.int(100), otherSeed.int(100)]);
  });

  it('stage streams are Rng instances (S02\u2019s sfc32 — one entropy implementation)', () => {
    expect(stageRng('seed', 'stats')).toBeInstanceOf(Rng);
  });
});

describe('knobs (FR-18)', () => {
  const knobs = {
    threat: {
      type: 'enum',
      values: ['low', 'medium', 'high'],
      default: 'medium',
      desc: 'Bestiary threat budget',
    },
    spellDensity: { type: 'range', min: 1, max: 5, default: 3, desc: 'Spells per level, L1\u20133' },
  } as const;

  function themed(): ThemeTemplate {
    return { ...microTheme(), knobs };
  }

  it('listThemeKnobs returns the declarations machine-readable, complete (a host renders a form from them)', () => {
    const declarations = listThemeKnobs(themed());
    expect(declarations.map((decl) => decl.id)).toEqual(['threat', 'spellDensity']);
    for (const decl of declarations) {
      expect(typeof decl.id).toBe('string');
      expect(['enum', 'range']).toContain(decl.type);
      expect(decl.desc.length).toBeGreaterThan(0);
      expect(decl.default).toBeDefined();
      if (decl.type === 'enum') expect(decl.values?.length).toBeGreaterThan(0);
      if (decl.type === 'range') expect(decl.min).toBeDefined();
    }
  });

  it('a theme with no knobs lists none; resolveKnobs fills defaults from declarations', () => {
    expect(listThemeKnobs(microTheme())).toEqual([]);
    const resolved = resolveKnobs(themed());
    expect(resolved).toEqual({ threat: 'medium', spellDensity: 3 });
  });

  it('caller values are validated: an out-of-vocabulary enum and an out-of-range value are typed rejections', () => {
    expect(() => resolveKnobs(themed(), { threat: 'extreme' })).toThrow(GenerationError);
    expect(() => resolveKnobs(themed(), { spellDensity: 9 })).toThrow(GenerationError);
    expect(() => resolveKnobs(themed(), { threat: 'high', spellDensity: 2 })).not.toThrow();
  });

  it('an unknown knob id is rejected with a did-you-mean hint (named like the build validators)', () => {
    try {
      resolveKnobs(themed(), { thret: 'high' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(GenerationError);
      const card = (error as GenerationError).errors[0]!;
      expect(card.jsonPath).toBe('knobs.thret');
      expect(card.hint).toBe('did you mean "threat"?');
    }
  });
});

describe('theme composition (FR-20 \u2014 the patch vocabulary)', () => {
  it('base + add/remove/merge patches compose a deterministic derived theme (the mock\u2019s winter-march shape)', () => {
    const patches: readonly ThemePatch[] = [
      {
        op: 'add',
        path: '/content/conditions/frostbitten',
        value: { name: 'Frostbitten', duration: 5, stacking: 'refresh' },
      },
      { op: 'remove', path: '/bestiary/barrow-wight' },
      {
        op: 'merge',
        path: '/knobs',
        value: { coldSeverity: { type: 'range', min: 1, max: 3, default: 2, desc: 'Cold severity' } },
      },
    ];
    const derived: ThemeTemplate = {
      ...microTheme(),
      id: 'winter-march',
      title: 'The Winter March',
      base: 'micro-vale',
      patches,
    };
    const composed = composeTheme(derived, microTheme());
    expect(composed.id).toBe('winter-march');
    expect(composed.content?.conditions?.frostbitten).toBeDefined();
    expect(composed.bestiary?.['barrow-wight']).toBeUndefined();
    expect(composed.knobs?.coldSeverity).toBeDefined();
    expect(composed.stats).toEqual(microTheme().stats); // untouched base fields carry through
    const pack = runPipeline(composed, 42);
    expect(pack.manifest.id).toBe('winter-march');
  });

  it('readPatch applies one patch to a plain root (the shared merge model, FR-19 one level up)', () => {
    const root: Record<string, unknown> = { knobs: {} };
    readPatch(root, { op: 'merge', path: '/knobs', value: { threat: { type: 'enum' } } }, 0);
    expect((root['knobs'] as Record<string, unknown>)['threat']).toEqual({ type: 'enum' });
  });

  it('an unknown base mismatch is a typed rejection', () => {
    const derived: ThemeTemplate = { ...microTheme(), id: 'winter-march', title: 'w', base: 'no-such-base' };
    expect(() => composeTheme(derived, microTheme())).toThrow(GenerationError);
  });

  it('remove of a missing path is rejected (no silent no-op patches)', () => {
    const derived: ThemeTemplate = {
      ...microTheme(),
      id: 'winter-march',
      title: 'w',
      base: 'micro-vale',
      patches: [{ op: 'remove', path: '/content/conditions/no-such-condition' }],
    };
    expect(() => composeTheme(derived, microTheme())).toThrow(GenerationError);
  });
});

describe('pipeline output is validator-clean (the dogfood contract, CA-1)', () => {
  it('the micro theme generates a pack that clears schema.validatePack with the real checker', () => {
    const pack = runPipeline(microTheme(), 42);
    expect(validatePack(pack, packDslChecker)).toEqual([]);
    expect(pack.manifest.id).toBe('micro-vale');
    expect(pack.stats.abilities).toEqual(['might', 'grace', 'vigor', 'reason', 'insight', 'presence']);
  });

  it('the same inputs twice produce structurally identical packs (byte-identity is ck3\u2019s deep proof; shape here)', () => {
    const a = runPipeline(microTheme(), 42);
    const b = runPipeline(microTheme(), 42);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('a theme omitting a stage-required input fails with a located error', () => {
    const { tables, ...themeless } = microTheme();
    void tables;
    expect(() => runPipeline(themeless as ThemeTemplate, 42)).toThrow(GenerationError);
    try {
      runPipeline(themeless as ThemeTemplate, 42);
    } catch (error) {
      const card = (error as GenerationError).errors[0]!;
      expect(card.jsonPath.length).toBeGreaterThan(0);
    }
  });
});

describe('spatial pass-through (v1.3, FR-11) — theme input to pack section (CA-G1)', () => {
  it('a theme with spatial: the generated pack.spatial deep-equals the declaration, and the JSON keys mirror SpatialDef’s fields (no renaming at any layer)', () => {
    const theme = microTheme();
    theme.spatial = { model: 'grid', reach: { default: 1, 'barrow-wight': 2 }, shapes: ['single', 'burst'] };
    const pack = runPipeline(theme, 42);
    expect(pack.spatial).toEqual({
      model: 'grid',
      reach: { default: 1, 'barrow-wight': 2 },
      shapes: ['single', 'burst'],
    });
    // CA-G1 boundary: the theme-side input is the pack's own SpatialDef vocabulary —
    // model/reach/shapes with reach.default plus sibling overrides. No theme-side renaming.
    expect(Object.keys(pack.spatial!).sort()).toEqual(['model', 'reach', 'shapes']);
    expect(Object.keys(pack.spatial!.reach).sort()).toEqual(['barrow-wight', 'default']);
    expect(pack.spatial!.model).toBe('grid');
    expect(pack.spatial!.reach.default).toBe(1);
    expect(pack.spatial!.reach['barrow-wight']).toBe(2);
    expect(pack.spatial!.shapes).toEqual(['single', 'burst']);
  });

  it('a #knob token inside the spatial declaration resolves before the section lands in the pack', () => {
    // Tokens stringify their value (the engine’s substitution discipline), so the legal
    // placement inside a stage-8-valid section is a shape-valued enum knob: reach’s
    // integer fields and the shape set itself cannot carry a tokenized number.
    const theme = microTheme();
    theme.knobs = {
      'lead-shape': { type: 'enum', values: ['single'], default: 'single', desc: 'first declared shape' },
    };
    theme.spatial = {
      model: 'grid',
      reach: { default: 1, 'barrow-wight': 2 },
      shapes: ['#knob/lead-shape', 'burst'] as never,
    };
    const pack = runPipeline(theme, 42);
    // resolution, not pass-through: the theme declared the token, the pack carries the value
    expect(theme.spatial!.shapes).toEqual(['#knob/lead-shape', 'burst']);
    expect(pack.spatial!.shapes).toEqual(['single', 'burst']);
    expect(pack.spatial!.reach).toEqual({ default: 1, 'barrow-wight': 2 });
    expect(validatePack(pack, packDslChecker)).toEqual([]);
  });

  it('a theme without spatial: the generated pack carries no spatial key (absent = theater of mind)', () => {
    const pack = runPipeline(microTheme(), 42);
    expect('spatial' in pack).toBe(false);
    expect(pack.spatial).toBeUndefined();
    expect(validatePack(pack, packDslChecker)).toEqual([]);
  });

  it('generation never mutates the theme’s spatial declaration (the clone discipline)', () => {
    const theme = microTheme();
    theme.spatial = { model: 'grid', reach: { default: 1 }, shapes: ['single', 'burst'] };
    const declaration = structuredClone(theme.spatial);
    runPipeline(theme, 42);
    expect(theme.spatial).toEqual(declaration);
  });
});

describe('the bundled themes ship spatial (CAP-G6)', () => {
  it('each generated pack carries model grid with an integer >= 1 at every reach key', () => {
    for (const theme of [DARK_FANTASY, ZOMBIE_URBAN, WYLDWOOD]) {
      const pack = runPipeline(theme, 42);
      expect(pack.spatial, theme.id).toBeDefined();
      expect(pack.spatial!.model).toBe('grid');
      expect(pack.spatial!.reach.default).toBeGreaterThanOrEqual(1);
      for (const [key, steps] of Object.entries(pack.spatial!.reach))
        expect(steps, `spatial.reach.${key} (${theme.id})`).toBeGreaterThanOrEqual(1);
    }
  });

  it('the generated sections deep-equal the themes’ declarations (the pass-through is verbatim)', () => {
    for (const theme of [DARK_FANTASY, ZOMBIE_URBAN, WYLDWOOD]) {
      const pack = runPipeline(theme, 42);
      expect(pack.spatial).toEqual(theme.spatial);
    }
  });

  it('the reach overrides name bestiary ids the themes declare, with integer >= 1 steps', () => {
    expect(DARK_FANTASY.spatial?.reach).toEqual({ default: 1, 'barrow-wight': 2 });
    expect(ZOMBIE_URBAN.spatial?.reach).toEqual({ default: 1, 'slab-brute': 2 });
    expect(WYLDWOOD.spatial?.reach).toEqual({ default: 1, 'hollow-wight': 2 });
    for (const theme of [DARK_FANTASY, ZOMBIE_URBAN, WYLDWOOD]) {
      for (const key of Object.keys(theme.spatial!.reach))
        if (key !== 'default') expect(theme.bestiary?.[key], key).toBeDefined();
    }
  });
});

describe('generation context purity (CA-5: no ambient values in stage execution)', () => {
  it('a stage sees only resolved knobs, the theme, its stream, and the document under construction', () => {
    const seen: string[] = [];
    const probe: Stage = {
      name: 'probe',
      run(ctx: GenerationContext) {
        seen.push(...Object.keys(ctx).sort());
        ctx.own = undefined;
      },
    };
    const stages = [...defaultStages().slice(0, 2), probe, ...defaultStages().slice(2)];
    try {
      runPipeline(microTheme(), 42, stages);
    } catch {
      // probe contributes no section; a later stage's rejection is expected — the keys are the subject
    }
    expect(seen).toEqual(['knobs', 'own', 'pack', 'seed', 'stream', 'theme']);
  });
});
