/**
 * SESSION-02's focused wyldwood suite: the third theme generates a complete,
 * validator-clean pack (CAP-04), determinism holds (same seed ⇒ byte-identity,
 * different seed ⇒ divergent hash), the theme registry resolves all three
 * names and rejects an unknown one with the existing error shape, and every
 * loot table rolls through the one engine for a fixed seed (rollability).
 * The compiler↔runtime CA-02 seam proof closes at checkpoint 3 (below).
 */
import { describe, expect, it } from 'vitest';
import { runPipeline } from '../../src/compiler/pipeline';
import { loadTheme, DARK_FANTASY, ZOMBIE_URBAN, WYLDWOOD } from '../../src/compiler/theme-loader';
import { generateCampaign } from '../../src/compiler/generate';
import { validatePack } from '../../src/schema/validate';
import { packDslChecker } from '../../src/core/dsl/checker';
import { packContentHash } from '../../src/schema/version';
import { Rng } from '../../src/core/rng';
import { rollTable, type TableDef } from '../../src/core/tables';
import { Runtime } from '../../src/runtime/runtime';
import { grantLoot } from '../../src/runtime/inventory';

const SEED = 42;

/** The registry triple resolves; an unknown name keeps the existing error shape. */
describe('theme registry (FR-17): three names resolve, unknown names fail shaped', () => {
  it('loadTheme resolves dark-fantasy, zombie-urban, and wyldwood (WYLDWOOD beside the other two)', () => {
    expect(loadTheme('dark-fantasy')).toBe(DARK_FANTASY);
    expect(loadTheme('zombie-urban')).toBe(ZOMBIE_URBAN);
    expect(loadTheme('wyldwood')).toBe(WYLDWOOD);
    expect(loadTheme('wyldwood').id).toBe('wyldwood');
  });

  it('an unknown theme name keeps the existing error shape (the FR-17 message, verbatim discipline)', () => {
    try {
      loadTheme('no-such-theme');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('unknown built-in theme "no-such-theme"');
      expect((error as Error).message).toContain('src/compiler/themes');
    }
  });
});

describe('CAP-04 — wyldwood generates a complete, validator-clean pack', () => {
  it('generateCampaign({ theme: WYLDWOOD }) → zero cards, full manifest, provenance exact', () => {
    const pack = generateCampaign({ theme: loadTheme('wyldwood'), seed: SEED });
    expect(validatePack(pack, packDslChecker)).toEqual([]);
    expect(pack.manifest.id).toBe('wyldwood');
    expect(pack.manifest.schemaVersion).toBe(1);
    expect(pack.manifest.title).toBe('The Wyldwood Verge');
    expect(pack.manifest.provenance).toEqual({
      theme: 'wyldwood',
      seed: SEED,
      knobs: { threat: 'medium', 'briar-density': 2, 'hedge-magic': 3, 'ward-depth': 'deep', 'mote-base': 6 },
    });
    // the pack is complete: all eight required sections + the declared economy
    for (const section of ['manifest', 'stats', 'actions', 'formulas', 'content', 'progression', 'bestiary', 'tables'] as const)
      expect(pack[section], section).toBeDefined();
    expect(pack.economy?.turnSlots).toEqual({ main: 1, move: 1, reaction: 1 });
  });

  it('the theme’s items reach the pack verbatim and every loot id resolves (CAP-03 through wyldwood)', () => {
    const pack = generateCampaign({ theme: loadTheme('wyldwood'), seed: SEED });
    expect(pack.content.items).toEqual(WYLDWOOD.content?.items);
    expect(Object.keys(pack.content.items ?? {}).length).toBe(6);
    const itemIds = new Set(Object.keys(pack.content.items ?? {}));
    const tableIds = new Set(Object.keys(pack.tables));
    for (const tableId of ['glade-loot', 'wyrd-charms', 'verge-gear', 'briar-sting'] as const) {
      expect(tableIds.has(tableId), tableId).toBe(true);
      for (const entry of pack.tables[tableId]!.entries) {
        const value = entry.value;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          const id = (value as { id?: unknown }).id;
          if (typeof id === 'string') expect(itemIds.has(id), `${tableId} → ${id}`).toBe(true);
        }
        if (typeof value === 'string' && value.startsWith('tables.'))
          expect(tableIds.has(value.slice('tables.'.length)), `${tableId} → ${value}`).toBe(true);
      }
    }
  });
});

describe('CAP-04 — determinism (CA-5 over the third theme)', () => {
  it('same theme + seed twice ⇒ byte-identical pack AND packContentHash equal', () => {
    const a = runPipeline(WYLDWOOD, SEED);
    const b = runPipeline(WYLDWOOD, SEED);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(packContentHash(a)).toBe(packContentHash(b));
  });

  it('generateCampaign({ theme: loadTheme("wyldwood"), seed: 42 }) twice ⇒ identical bytes and hashes', () => {
    const a = generateCampaign({ theme: loadTheme('wyldwood'), seed: 42 });
    const b = generateCampaign({ theme: loadTheme('wyldwood'), seed: 42 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(packContentHash(a)).toBe(packContentHash(b));
  });

  it('a different seed diverges (the change actually varies)', () => {
    const a = runPipeline(WYLDWOOD, SEED);
    const b = runPipeline(WYLDWOOD, SEED + 1);
    expect(packContentHash(a)).not.toBe(packContentHash(b));
  });
});

describe('loot rollability — every table rolls through the one engine for a fixed seed', () => {
  it('every wyldwood table rolls clean (a nested chain included) with the theme-space resolver', () => {
    const pack = generateCampaign({ theme: loadTheme('wyldwood'), seed: SEED });
    const tables = pack.tables as Record<string, TableDef>;
    for (const [id, def] of Object.entries(tables)) {
      const outcome = rollTable(def, rngFor(SEED), {
        jsonPath: `tables.${id}`,
        resolve: (ref: unknown) => (typeof ref === 'string' ? tables[ref] : undefined),
      });
      expect(outcome.ok, `table ${id}`).toBe(true);
      expect(Object.keys(tables).length, 'the full theme table map rolled').toBe(
        Object.keys(WYLDWOOD.tables ?? {}).length,
      );
    }
  });

  it('glade-loot rolls a declared item id for a fixed seed (the loot path is alive end to end)', () => {
    const pack = generateCampaign({ theme: loadTheme('wyldwood'), seed: SEED });
    const tables = pack.tables as Record<string, TableDef>;
    const itemIds = new Set(Object.keys(pack.content.items ?? {}));
    const outcome = rollTable(tables['glade-loot']!, rngFor(7), {
      jsonPath: 'tables.glade-loot',
      resolve: (ref: unknown) => (typeof ref === 'string' ? tables[ref] : undefined),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const value = outcome.value;
    if (typeof value === 'string')
      expect(itemIds.has(value) || value.startsWith('tables.'), `rolled "${value}"`).toBe(true);
  });
});

/** The compiler↔runtime seam (ck3, CAP-04): real generated data, the real runtime, the real grantLoot. */
describe('CAP-04 ck3 — grantLoot over the generated pack closes the CA-02 seam', () => {
  it('generate → new Runtime → createCharacter → grantLoot("verge-gear", { seed: 7 }) twice ⇒ identical stacks', () => {
    const pack = generateCampaign({ theme: loadTheme('wyldwood'), seed: SEED });
    const rt = new Runtime(pack);
    const brynn = rt.createCharacter({ name: 'Brynn', race: 'verge-born', classes: ['warden'] });
    const events = grantLoot(rt, brynn.state, 'verge-gear', { seed: 7 });
    expect(events.map((event) => event.type)).toEqual(['loot:rolled', 'item:granted']);
    expect(events[0]!.type === 'loot:rolled' && events[0]!.why.rule).toBe('tables.verge-gear');
    expect(events[1]!.why.rule).toBe('content.items.oaken-cudgel');
    expect(brynn.state.inventory).toEqual([{ id: 'oaken-cudgel', qty: 1 }]);

    const again = grantLoot(rt, brynn.state, 'verge-gear', { seed: 7 });
    expect(again.map((event) => event.type)).toEqual(['loot:rolled', 'item:granted']);
    expect(brynn.state.inventory).toEqual([{ id: 'oaken-cudgel', qty: 2 }]); // stacked by id

    // the seam through the facade too (char.loot delegates to grantLoot)
    const mirror = new Runtime(structuredClone(pack));
    const echo = mirror.createCharacter({ name: 'Echo', race: 'verge-born', classes: ['warden'] });
    echo.loot('verge-gear', { seed: 7 });
    expect(echo.state.inventory).toEqual([{ id: 'oaken-cudgel', qty: 1 }]);
  });

  it('flavor-ledger loot: briar-sting’s ranged values are data — CA-02 flavor, never an error', () => {
    const pack = generateCampaign({ theme: loadTheme('wyldwood'), seed: SEED });
    const rt = new Runtime(pack);
    const briar = rt.createCharacter({ name: 'Briar', race: 'thicket-folk', classes: ['hexer'] });
    expect(() => grantLoot(rt, briar.state, 'briar-sting', { seed: 3 })).toThrow(/nothing grantable/);
    expect(briar.state.inventory).toEqual([]);
  });
});

/** A fresh Rng per roll — the fixed-seed discipline grantLoot itself uses (seed ?? tableId). */
function rngFor(seed: number | string): Rng {
  return new Rng(seed);
}