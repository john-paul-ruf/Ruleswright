/**
 * Checkpoint-4 suite — FR-20 composition semantics (base + patches with
 * add/remove/merge at pointer paths) and the compiler's entry surface
 * (`generateCampaign` / `listThemeKnobs` / stage types resolve from src).
 */
import { describe, expect, it } from 'vitest';
import { composeTheme, readPatch } from '../../src/compiler/compose';
import { generateCampaign } from '../../src/compiler/generate';
import { listThemeKnobs } from '../../src/compiler/knobs';
import { STAGE_ORDER, runPipeline } from '../../src/compiler/pipeline';
import { DARK_FANTASY, ZOMBIE_URBAN } from '../../src/compiler/theme-loader';
import { GenerationError } from '../../src/compiler/errors';
import type { ThemeTemplate, ThemePatch } from '../../src/compiler/theme';
import { validatePack } from '../../src/schema/validate';
import { packDslChecker } from '../../src/core/dsl/checker';
import { packContentHash } from '../../src/schema/version';

describe('patch merge semantics (FR-20, the mock\u2019s vocabulary)', () => {
  it('add sets a new path; merging into a missing container creates it', () => {
    const root: Record<string, unknown> = {};
    readPatch(root, { op: 'add', path: '/content/conditions/frostbitten', value: { name: 'Frostbitten', duration: 5, stacking: 'refresh' } }, 0);
    expect((root['content'] as Record<string, unknown>)['conditions']).toBeDefined();
  });

  it('add on an existing path is rejected — merge is the overwriting op', () => {
    const root: Record<string, unknown> = { title: 'base' };
    expect(() => readPatch(root, { op: 'add', path: '/title', value: 'x' }, 0)).toThrow(GenerationError);
  });

  it('merge deep-merges object values and replaces scalars, in array order (later wins)', () => {
    const root: Record<string, unknown> = { knobs: { threat: { type: 'enum', default: 'medium', desc: 'a' } } };
    readPatch(root, { op: 'merge', path: '/knobs', value: { threat: { default: 'high' }, cold: { type: 'range', default: 2, desc: 'b' } } }, 0);
    readPatch(root, { op: 'merge', path: '/knobs', value: { threat: { default: 'low' } } }, 1);
    const knobs = root['knobs'] as Record<string, Record<string, unknown>>;
    expect(knobs['threat']!.default).toBe('low'); // later patch wins
    expect(knobs['threat']!.type).toBe('enum'); // deep-merge kept untouched fields
    expect(knobs['cold']!.default).toBe(2);
  });

  it('remove deletes the path; removing a missing path is a located rejection', () => {
    const root: Record<string, unknown> = { bestiary: { 'barrow-wight': { threat: 3 } } };
    readPatch(root, { op: 'remove', path: '/bestiary/barrow-wight' }, 0);
    expect(Object.keys(root['bestiary'] as object)).toEqual([]);
    expect(() => readPatch(root, { op: 'remove', path: '/bestiary/barrow-wight' }, 1)).toThrow(GenerationError);
  });

  it('patch paths cannot descend through arrays or scalars (located)', () => {
    const root: Record<string, unknown> = { stats: { abilities: ['might'] } };
    expect(() => readPatch(root, { op: 'merge', path: '/stats/abilities/might', value: 1 }, 0)).toThrow(GenerationError);
    expect(() => readPatch(root, { op: 'merge', path: '/stats/abilities/x', value: 1 }, 0)).toThrow(GenerationError);
  });

  it('an empty pointer path is rejected', () => {
    const root: Record<string, unknown> = {};
    expect(() => readPatch(root, { op: 'merge', path: '/', value: {} }, 0)).toThrow(GenerationError);
  });
});

describe('composeTheme (FR-20 \u2014 base + patches, deterministic)', () => {
  it('the mock\u2019s winter-march: add + remove + merge over dark-fantasy composes and generates clean', () => {
    const patches: readonly ThemePatch[] = [
      { op: 'add', path: '/content/conditions/frostbitten', value: { name: 'Frostbitten', duration: 5, stacking: 'refresh' } },
      { op: 'remove', path: '/content/spells/suns-verdict' },
      { op: 'merge', path: '/knobs', value: { 'cold-severity': { type: 'range', min: 1, max: 3, default: 2, desc: 'Cold severity' } } },
    ];
    const derived: ThemeTemplate = { ...DARK_FANTASY, id: 'winter-march', title: 'The Winter March', base: 'dark-fantasy', patches };
    const composed = composeTheme(derived, DARK_FANTASY);
    expect(composed.id).toBe('winter-march');
    expect(composed.title).toBe('The Winter March');
    expect(composed.base).toBe('dark-fantasy');
    expect(composed.content?.conditions?.frostbitten).toEqual({ name: 'Frostbitten', duration: 5, stacking: 'refresh' });
    expect(composed.content?.spells?.['suns-verdict']).toBeUndefined();
    expect(composed.knobs?.['cold-severity']).toBeDefined();
    expect(composed.stats).toEqual(DARK_FANTASY.stats); // base fields carry through

    // The composed theme generates a validator-clean pack (composition is a real theme, FR-20)
    const pack = runPipeline(composed, 42);
    expect(validatePack(pack, packDslChecker)).toEqual([]);
    expect(pack.manifest.id).toBe('winter-march');
  });

  it('composition is deterministic: same base + patches \u21d2 byte-identical generated pack', () => {
    const patches: readonly ThemePatch[] = [{ op: 'add', path: '/content/items/snow-shroud', value: { name: 'Snow Shroud', kind: 'armor' } }];
    const derived: ThemeTemplate = { ...DARK_FANTASY, id: 'winter-march', title: 'w', base: 'dark-fantasy', patches };
    const a = runPipeline(composeTheme(derived, DARK_FANTASY), 42);
    const b = runPipeline(composeTheme(derived, DARK_FANTASY), 42);
    expect(packContentHash(a)).toBe(packContentHash(b));
  });

  it('the base template is not mutated by composition (read-only base)', () => {
    const before = packContentHash(runPipeline(DARK_FANTASY, 42));
    const derived: ThemeTemplate = { ...DARK_FANTASY, id: 'winter-march', title: 'w', base: 'dark-fantasy', patches: [{ op: 'add', path: '/content/items/x', value: { name: 'X' } }] };
    composeTheme(derived, DARK_FANTASY);
    expect(packContentHash(runPipeline(DARK_FANTASY, 42))).toBe(before);
  });

  it('a base mismatch is a typed rejection naming both ids', () => {
    const derived: ThemeTemplate = { ...DARK_FANTASY, id: 'x', title: 'x', base: 'zombie-urban' };
    try {
      composeTheme(derived, DARK_FANTASY);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(GenerationError);
      const card = (error as GenerationError).errors[0]!;
      expect(card.jsonPath).toBe('base');
      expect(card.message).toContain('zombie-urban');
    }
  });

  it('a standalone theme composes from itself with no patches (the shipped samples\u2019 shape)', () => {
    const standalone: ThemeTemplate = { ...ZOMBIE_URBAN };
    const composed = composeTheme(standalone, ZOMBIE_URBAN);
    expect(composed.id).toBe('zombie-urban');
    expect(composed.stats).toEqual(ZOMBIE_URBAN.stats);
  });
});

describe('entry surface (M04 \u2014 the compiler\u2019s public shape, api-map.html)', () => {
  it('generateCampaign({ theme, seed }) returns a complete valid pack \u2014 the quickstart\u2019s one call', () => {
    const pack = generateCampaign({ theme: DARK_FANTASY, seed: 42 });
    expect(validatePack(pack, packDslChecker)).toEqual([]);
    expect(pack.manifest.provenance).toEqual({ theme: 'dark-fantasy', seed: 42, knobs: { threat: 'medium', 'spell-density': 3, grittiness: 'heroic', 'demihuman-caps': 'on' } });
  });

  it('generateCampaign accepts knobs and records them verbatim in provenance (FR-18)', () => {
    const pack = generateCampaign({ theme: DARK_FANTASY, seed: 42, knobs: { threat: 'high' } });
    expect(pack.manifest.provenance?.knobs).toEqual({ threat: 'high', 'spell-density': 3, grittiness: 'heroic', 'demihuman-caps': 'on' });
    // a caller knob not declared by the theme is a typed rejection
    expect(() => generateCampaign({ theme: DARK_FANTASY, seed: 42, knobs: { danger: 3 } })).toThrow(GenerationError);
  });

  it('listThemeKnobs(theme) is machine-readable from the surface (FR-18: a host renders a form)', () => {
    const decls = listThemeKnobs(DARK_FANTASY);
    expect(decls.map((decl) => decl.id)).toEqual(['threat', 'spell-density', 'grittiness', 'demihuman-caps']);
    for (const decl of decls) {
      expect(decl.desc.length).toBeGreaterThan(0);
      expect(decl.default).toBeDefined();
    }
  });

  it('STAGE_ORDER is the stable, public stage chain (Extension Commitment 3)', () => {
    expect(STAGE_ORDER).toEqual(['stats', 'skills', 'feats', 'classes', 'magic', 'bestiary', 'tables']);
  });
});