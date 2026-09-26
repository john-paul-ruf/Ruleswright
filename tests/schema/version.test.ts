import { describe, expect, it } from 'vitest';
import type { Pack } from '../../src/schema/pack';
import { packContentHash, checkSchemaVersion } from '../../src/schema/version';
import { clonePack, VALID_PACK } from './fixtures';

function deepReverseKeyOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepReverseKeyOrder);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).reverse()) {
      out[key] = deepReverseKeyOrder((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

describe('packContentHash (FR-17/FR-19 determinism)', () => {
  it('is stable across key reordering', () => {
    const reversed = deepReverseKeyOrder(VALID_PACK) as Pack;
    expect(packContentHash(VALID_PACK)).toBe(packContentHash(reversed));
  });

  it('is identical across two calls and differs when content changes', () => {
    const first = packContentHash(VALID_PACK);
    expect(packContentHash(VALID_PACK)).toBe(first);
    const changed = clonePack();
    changed.actions.strike!.effect = 'damage(1d10 + might)';
    expect(packContentHash(changed)).not.toBe(first);
  });

  it('matches the snapshot contentHash format (minLength 8)', () => {
    const hash = packContentHash(VALID_PACK);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
    expect(hash.length).toBeGreaterThanOrEqual(8);
  });
});

describe('checkSchemaVersion (FR-23)', () => {
  it('accepts schemaVersion 1 within the engine range', () => {
    expect(checkSchemaVersion(VALID_PACK, { min: 1, max: 1 })).toEqual([]);
  });

  it('rejects schemaVersion 2 as outside the supported range', () => {
    const pack = clonePack() as unknown as { manifest: { schemaVersion: number } };
    pack.manifest.schemaVersion = 2;
    const cards = checkSchemaVersion(pack, { min: 1, max: 1 });
    expect(cards).toHaveLength(1);
    expect(cards[0]!.rule).toBe('E-SCHEMA-01');
    expect(cards[0]!.message).toContain('supported range');
  });

  it('rejects a non-integer version without assuming one', () => {
    const cards = checkSchemaVersion({ manifest: { id: 'x', schemaVersion: '1' } }, { min: 1, max: 1 });
    expect(cards[0]!.message).toContain('integer');
  });

  it('handles a missing manifest without throwing', () => {
    expect(() => checkSchemaVersion({}, { min: 1, max: 1 })).not.toThrow();
  });
});
