/**
 * CAP-7 checkpoint 3 — the root surface (M05, FR-22): `ruleswright` resolves
 * the three subpath surfaces through the dumb re-export entry. No logic, no
 * cross-surface barrel.
 */
import { describe, expect, it } from 'vitest';
import * as root from '../../src/index';
import * as schemaSurface from '../../src/schema/index';
import * as runtimeSurface from '../../src/runtime/index';
import * as compilerSurface from '../../src/compiler/index';

describe('the root surface (M05, FR-22)', () => {
  it('resolves the runtime surface through the root entry (snapshot round-trip included)', () => {
    expect(typeof root.Runtime).toBe('function');
    expect(typeof root.Character).toBe('function');
    expect(typeof root.serializeCharacter).toBe('function');
    expect(typeof root.deserializeCombat).toBe('function');
    expect(root.Runtime).toBe(runtimeSurface.Runtime);
    expect(root.Character).toBe(runtimeSurface.Character);
    expect(root.serializeCharacter).toBe(runtimeSurface.serializeCharacter);
    expect(root.deserializeCombat).toBe(runtimeSurface.deserializeCombat);
  });

  it('resolves the schema surface through the root entry', () => {
    expect(typeof root.validatePack).toBe('function');
    expect(typeof root.packContentHash).toBe('function');
    expect(Array.isArray(root.RULE_IDS)).toBe(true);
    expect(root.validatePack).toBe(schemaSurface.validatePack);
    expect(root.packContentHash).toBe(schemaSurface.packContentHash);
    expect(root.RULE_IDS).toBe(schemaSurface.RULE_IDS);
  });

  it('resolves the compiler surface through the root entry', () => {
    expect(typeof root.generateCampaign).toBe('function');
    expect(typeof root.listThemeKnobs).toBe('function');
    expect(typeof root.GenerationError).toBe('function');
    expect(root.generateCampaign).toBe(compilerSurface.generateCampaign);
    expect(root.listThemeKnobs).toBe(compilerSurface.listThemeKnobs);
    expect(root.GenerationError).toBe(compilerSurface.GenerationError);
  });

  it('is a dumb re-export: it adds no logic of its own', () => {
    const known = new Set([
      ...Object.keys(schemaSurface),
      ...Object.keys(runtimeSurface),
      ...Object.keys(compilerSurface),
    ]);
    const ownKeys = Object.getOwnPropertyNames(root).filter((key) => key !== '__esModule' && !known.has(key));
    expect(ownKeys).toEqual([]);
  });
});
