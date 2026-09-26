/**
 * Checkpoint-2 suite — the seven generation stages: each stage contributes its
 * pack section (through the real pipeline, the production path); a theme
 * omitting a stage-required input fails with a located error; knob tokens
 * (`#knob/<id>`) feed generation; both attack conventions exercise.
 */
import { describe, expect, it } from 'vitest';
import { runPipeline, defaultStages } from '../../src/compiler/pipeline';
import { GenerationError } from '../../src/compiler/errors';
import type { Stage } from '../../src/compiler/stage';
import type { ThemeTemplate } from '../../src/compiler/theme';
import { validatePack } from '../../src/schema/validate';
import { packDslChecker } from '../../src/core/dsl/checker';
import { packContentHash } from '../../src/schema/version';
import { microTheme } from './pipeline.test';

function generate(theme: ThemeTemplate, seed: number | string = 42) {
  return runPipeline(theme, seed);
}

function without(theme: ThemeTemplate, section: 'economy' | 'actions' | 'formulas' | 'content' | 'progression' | 'bestiary' | 'tables' | 'stats'): ThemeTemplate {
  const rest = { ...theme } as Record<string, unknown>;
  delete rest[section];
  return rest as unknown as ThemeTemplate;
}

describe('stage 1 · stats', () => {
  it('contributes the pack stats verbatim (name-keyed abilities + named saves)', () => {
    const pack = generate(microTheme());
    expect(pack.stats).toEqual(microTheme().stats);
    expect(pack.stats.abilities).toEqual(['might', 'grace', 'vigor', 'reason', 'insight', 'presence']);
    expect(pack.stats.saves).toEqual(['vigor', 'grace', 'tenacity', 'reason', 'presence']);
  });

  it('a theme omitting stats fails located', () => {
    try {
      generate(without(microTheme(), 'stats'));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(GenerationError);
      const card = (error as GenerationError).errors[0]!;
      expect(card.jsonPath.length).toBeGreaterThan(0);
      expect(card.rule).toMatch(/^E-/);
    }
  });
});

describe('stage 2 · skills', () => {
  it('contributes content.skills from the theme', () => {
    const pack = generate(microTheme());
    expect(pack.content.skills?.climb).toEqual({ name: 'Climb', ability: 'grace' });
    expect(pack.content.skills?.lore).toEqual({ name: 'Lore', ability: 'insight' });
  });

  it('a theme omitting skills fails located', () => {
    const theme = microTheme();
    theme.content = { ...theme.content!, skills: undefined };
    try {
      generate(theme);
      expect.unreachable();
    } catch (error) {
      const card = (error as GenerationError).errors[0]!;
      expect(card.jsonPath.length).toBeGreaterThan(0);
      expect(error).toBeInstanceOf(GenerationError);
    }
  });
});

describe('stage 3 · feats', () => {
  it('contributes content.feats including the reactive one (FR-12 proof 2 shape)', () => {
    const pack = generate(microTheme());
    expect(pack.content.feats?.ironhide).toBeDefined();
    expect(pack.content.feats?.['second-gust']?.trigger?.on).toBe('condition:applied[self]');
  });

  it('a theme with no reactive feat is rejected, located (FR-21 floor)', () => {
    const theme = microTheme();
    theme.content = { ...theme.content!, feats: { ironhide: { name: 'Ironhide' } } };
    try {
      generate(theme);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(GenerationError);
      const card = (error as GenerationError).errors[0]!;
      expect(card.jsonPath.length).toBeGreaterThan(0);
      expect(card.message).toContain('reactive');
    }
  });
});

describe('stage 4 · classes', () => {
  it('contributes content.classes + progression (levels 1\u20132 tables; both conventions exercise)', () => {
    const pack = generate(microTheme());
    expect(pack.content.classes?.warden?.name).toBe('Warden');
    // descending-AC table convention: byDefense keys "2".."10"
    expect(pack.progression.warden?.attackTable?.[0]?.byDefense['2']).toBe(18);
    // ascending attackBonus convention: a formula, engine-blind
    expect(pack.progression.hexer?.attackBonus).toBe('floor(level / 2) + might');
    expect(pack.progression.warden?.attackBonus).toBeUndefined(); // XOR holds
  });

  it('a class without progression fails located (E-REF-03 territory, before stage 8)', () => {
    const theme = microTheme();
    theme.content = { ...theme.content!, classes: { ...theme.content!.classes, orphan: { name: 'Orphan' } } };
    try {
      generate(theme);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(GenerationError);
      const card = (error as GenerationError).errors[0]!;
      expect(card.jsonPath.length).toBeGreaterThan(0);
    }
  });
});

describe('stage 5 · magic', () => {
  it('contributes content.spells + the declared economy + spell pool capacity formulas', () => {
    const pack = generate(microTheme());
    expect(pack.content.spells?.['hex-bolt']?.cost.points?.pool).toBe('stamina');
    expect(pack.economy?.turnSlots).toEqual({ main: 1, move: 1, reaction: 1 }); // v1.1 economy authored natively
    expect(pack.formulas.stamina).toEqual({ expr: '8 + vigor' }); // the drain pool's capacity formula
  });

  it('a spell point cost naming an undeclared pool formula fails located (E-ECON-01 territory)', () => {
    const theme = microTheme();
    theme.content = {
      ...theme.content!,
      spells: {
        ...theme.content!.spells,
        'drain-blast': { name: 'Drain Blast', magic: { level: 1, lists: ['hexer'] }, cost: { points: { pool: 'ghost-pool', amount: 2 } }, effect: 'damage(1d6)' },
      },
    };
    try {
      generate(theme);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(GenerationError);
      const card = (error as GenerationError).errors[0]!;
      expect(card.jsonPath.length).toBeGreaterThan(0);
      expect(card.message).toContain('ghost-pool');
    }
  });

  it('a spell claiming an undeclared list fails located (E-REF-01 territory)', () => {
    const theme = microTheme();
    theme.content = {
      ...theme.content!,
      spells: {
        ...theme.content!.spells,
        'orphan-rite': { name: 'Orphan Rite', magic: { level: 1, lists: ['no-such-class'] }, cost: { vancian: 1 }, effect: 'damage(1d6)' },
      },
    };
    try {
      generate(theme);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(GenerationError);
      const card = (error as GenerationError).errors[0]!;
      expect(card.jsonPath.length).toBeGreaterThan(0);
      expect(card.message).toContain('no-such-class');
    }
  });
});

describe('stage 6 · bestiary', () => {
  it('contributes statblocks with threat weights and referenced attack tables', () => {
    const pack = generate(microTheme());
    expect(pack.bestiary['barrow-wight']?.threat).toBe(3);
    expect(pack.bestiary['barrow-wight']?.attackTable).toBe('warden');
    expect(pack.bestiary['grave-shambles']?.actions).toEqual(['withdraw']);
  });

  it('a statblock referencing an undeclared action fails located (E-REF-01 territory)', () => {
    const theme = microTheme();
    theme.bestiary = {
      ...theme.bestiary,
      'phantom-clawer': { name: 'Phantom Clawer', threat: 1, actions: ['no-such-action'], attackTable: 'warden' },
    };
    try {
      generate(theme);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(GenerationError);
      const card = (error as GenerationError).errors[0]!;
      expect(card.jsonPath.length).toBeGreaterThan(0);
      expect(card.message).toContain('no-such-action');
    }
  });
});

describe('stage 7 · tables', () => {
  it('contributes tables + actions, proven rolled through S02\u2019s engine', () => {
    const pack = generate(microTheme());
    expect(pack.tables.weather?.kind).toBe('ranged');
    expect(pack.actions.strike?.effect).toBe('sequence(attack(ac, might), damage(1d8 + might, sharp))');
    expect(pack.tables['wandering-dread']?.entries.length).toBe(2);
  });

  it('a table that cannot roll (range gap) fails located with the d100 face in the message', () => {
    const theme = microTheme();
    theme.tables = {
      ...theme.tables,
      'gapped-table': { kind: 'ranged', entries: [{ min: 1, max: 50, value: 'low' }] },
    };
    try {
      generate(theme);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(GenerationError);
      const card = (error as GenerationError).errors[0]!;
      expect(card.jsonPath.length).toBeGreaterThan(0);
      expect(card.message).toContain('gapped-table');
    }
  });
});

describe('knob tokens feed generation (FR-18: knob values reach the pack)', () => {
  it('a #knob/<id> token in a stage input resolves to the knob\u2019s value', () => {
    const theme = microTheme();
    theme.knobs = { 'hp-base': { type: 'range', min: 4, max: 12, default: 8, desc: 'HP base' } };
    theme.formulas = { ...theme.formulas, hp: { expr: '#knob/hp-base + vigor * 2' } as never };
    const pack = generate(theme);
    expect(pack.formulas['hp']!['expr']).toBe('8 + vigor * 2'); // default substituted into the expression
    expect(validatePack(pack, packDslChecker)).toEqual([]);
  });

  it('a token naming an undeclared knob fails located, before stages run', () => {
    const theme = microTheme();
    theme.formulas = { ...theme.formulas, hp: { expr: '#knob/ghost-knob' } as never };
    try {
      generate(theme);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(GenerationError);
      const card = (error as GenerationError).errors[0]!;
      expect(card.jsonPath.length).toBeGreaterThan(0);
      expect(card.message).toContain('ghost-knob');
    }
  });
});

describe('stage composition order (sections build up across the pipeline)', () => {
  it('the full pack holds all eight required sections + the v1.1 optional economy', () => {
    const pack = generate(microTheme());
    for (const section of ['manifest', 'stats', 'actions', 'formulas', 'content', 'progression', 'bestiary', 'tables'] as const) {
      expect(pack[section], section).toBeDefined();
    }
    expect(pack.economy).toBeDefined();
  });

  it('the generated pack clears the validator AND the version contract (CA-1 consumer edges)', () => {
    const pack = generate(microTheme(), 'seed-string');
    expect(validatePack(pack, packDslChecker)).toEqual([]);
    const cards = validatePack(pack, packDslChecker);
    void cards;
    expect(pack.manifest.provenance).toEqual({ theme: 'micro-vale', seed: 'seed-string', knobs: {} });
  });

  it('stage streams stay independent of section content: reordering stages cannot shift another stage\u2019s draws', () => {
    // Probe stage between skills and feats draws from its own named stream; the
    // pack's content must be unchanged vs. the default pipeline's.
    const probe: Stage = {
      name: 'probe-stage',
      run(ctx) {
        void ctx.stream.int(1_000_000);
        ctx.own = undefined;
      },
    };
    const withProbe = runPipeline(microTheme(), 42, [...defaultStages().slice(0, 2), probe, ...defaultStages().slice(2)]);
    const baseline = runPipeline(microTheme(), 42);
    expect(packContentHash(withProbe)).toBe(packContentHash(baseline));
  });
});