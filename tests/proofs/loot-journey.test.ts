/**
 * CAP-05 — the loot journey through the BUILT package (loot-inventory's
 * integration proof). Every import here is a direct dist path — the artifact a
 * consumer actually installs — never src/ (docs-run.test.ts's SURFACE_MODULES
 * map points the README's `ruleswright/*` specifiers at src/; this file
 * deliberately does not follow that style: it would prove src, not dist).
 *
 * Journey: generate wyldwood (seed 42) → validate → Runtime → character →
 * grantLoot twice (identical grants, CA-02 through real generated data) →
 * serializeCharacter → restoreCharacter on a fresh Runtime → lossless
 * round-trip. The item id below is S02's committed themes.test.ts seed map
 * (CA-02 recheck): `verge-gear` seed 7 ⇒ oaken-cudgel, stacked by id on the
 * second call. dist identity travels with these assertions (artifact
 * freshness — rebuild before running; this file is never committed against a
 * stale dist).
 *
 * This is the feature's first narrow journey proof — the S05 ck2 lineage: one
 * composed end-to-end pass through the built package's public exports, no
 * engine code touched.
 *
 * Note on the dogfood leg (dist-shape discovery, recorded here for the next
 * reader): a generated pack returns `Pack` — the pipeline already ran stage 8
 * = validatePack WITH the real checker (the gate that produced this pack), and
 * its failure mode is a GenerationError, not cards on the returned value. So
 * the journey's stage-8 re-proof through the public re-entry asserts the two
 * real forms: (1) validatePack(pack) — no checker wired, the un-wired default
 * fails closed: every DSL string becomes an E-FORM-01 deferred card, never a
 * silent pass; (2) validatePack(pack, a zero-returning checker) → zero cards —
 * the shape a pack-consumer's own checker takes through dist.
 */
import { describe, expect, it } from 'vitest';
import { generateCampaign, loadTheme } from '../../dist/compiler.js';
import {
  Runtime,
  createCharacter,
  grantLoot,
  serializeCharacter,
  restoreCharacter,
} from '../../dist/runtime.js';
import { validatePack } from '../../dist/index.js';
import type { RuntimeEvent } from '../../dist/runtime.js';
import type { Pack } from '../../dist/schema.js';

/** The generated pack under test — rebuilt dist, fixed theme + seed (FR-17). */
const pack: Pack = generateCampaign({ theme: loadTheme('wyldwood'), seed: 42 });

function runtimeForPack(): Runtime {
  return new Runtime(pack);
}

function eventTypes(events: readonly RuntimeEvent[]): string[] {
  return events.map((event) => event.type);
}

describe('CAP-05 — the built-dist loot journey (generate → validate → Runtime → loot → snapshot → restore)', () => {
  it('generates the wyldwood pack: manifest id, non-empty items, the loot-family tables', () => {
    expect(pack.manifest.id).toBe('wyldwood');
    expect(pack.manifest.schemaVersion).toBe(1);
    expect(Object.keys(pack.content.items ?? {}).length).toBeGreaterThan(0);
    expect(Object.keys(pack.tables)).toContain('glade-loot');
  });

  it('validatePack re-enters the dogfood gate through dist — fail-closed by default, clean under a zero-returning checker', () => {
    // Default (no checker arg): the un-wired-checker default fails closed —
    // every DSL string becomes an E-FORM-01 deferred card (never a silent pass).
    const deferred = validatePack(pack);
    expect(deferred.length).toBeGreaterThan(0);
    expect(deferred.every((card) => card.rule === 'E-FORM-01')).toBe(true);

    // With the pack's own checker (the zero-returning shape): zero cards.
    expect(validatePack(pack, () => [])).toEqual([]);
  });

  it('new Runtime(pack) loads — reserved formula ids hold', () => {
    const rt = runtimeForPack();
    expect(rt.pack.manifest.id).toBe('wyldwood');
    expect(Object.keys(rt.pack.formulas)).toEqual(expect.arrayContaining(['hp', 'ac']));
  });

  it('createCharacter mints an empty inventory', () => {
    const rt = runtimeForPack();
    const brynn = createCharacter(rt, { name: 'Brynn', race: 'verge-born', classes: ['warden'] });
    expect(brynn.state.inventory).toEqual([]);
  });

  it('grantLoot(verge-gear, seed 7) twice ⇒ identical grants, stacked inventory (CA-02 through dist)', () => {
    const rt = runtimeForPack();
    const brynn = createCharacter(rt, { name: 'Brynn', race: 'verge-born', classes: ['warden'] });

    const first = grantLoot(rt, brynn.state, 'verge-gear', { seed: 7 });
    expect(eventTypes(first)).toEqual(['loot:rolled', 'item:granted']);
    expect(brynn.state.inventory).toEqual([{ id: 'oaken-cudgel', qty: 1 }]);

    const second = grantLoot(rt, brynn.state, 'verge-gear', { seed: 7 });
    expect(eventTypes(second)).toEqual(eventTypes(first));
    expect(brynn.state.inventory).toEqual([{ id: 'oaken-cudgel', qty: 2 }]);
  });

  it('the loot events carry the committed anatomy: loot:rolled (tables.<tableId>) + item:granted (content.items.<id>)', () => {
    const rt = runtimeForPack();
    const brynn = createCharacter(rt, { name: 'Brynn', race: 'verge-born', classes: ['warden'] });
    const events = grantLoot(rt, brynn.state, 'verge-gear', { seed: 7 });

    expect(events[0]!.type).toBe('loot:rolled');
    expect(events[0]!.why.rule).toBe('tables.verge-gear');
    expect(events[0]!.payload.tableId).toBe('verge-gear');
    expect(events[0]!.payload.value).toBe('oaken-cudgel');
    expect(events[0]!.payload.grants).toEqual([{ id: 'oaken-cudgel', qty: 1 }]);

    expect(events[1]!.type).toBe('item:granted');
    expect(events[1]!.why.rule).toBe('content.items.oaken-cudgel');
    expect(events[1]!.payload).toEqual({ itemId: 'oaken-cudgel', qty: 1, total: 1 });
  });

  it('serializeCharacter carries exactly the granted stacks; restore on a fresh Runtime round-trips losslessly', () => {
    const rt = runtimeForPack();
    const brynn = createCharacter(rt, { name: 'Brynn', race: 'verge-born', classes: ['warden'] });
    grantLoot(rt, brynn.state, 'verge-gear', { seed: 7 });
    grantLoot(rt, brynn.state, 'verge-gear', { seed: 7 });

    const snap = serializeCharacter(rt, brynn.state);
    expect(snap.state.inventory).toEqual([{ id: 'oaken-cudgel', qty: 2 }]);

    const fresh = runtimeForPack();
    const restored = restoreCharacter(fresh, JSON.parse(JSON.stringify(snap)));
    expect(restored.state).toEqual(brynn.state);
    expect(restored.state.inventory).toEqual([{ id: 'oaken-cudgel', qty: 2 }]);
  });
});