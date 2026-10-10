/**
 * browser-determinism CAP-B1 / CA-B1 — FR-17 byte identity, Node side.
 *
 * Each bundled theme generated at seed 42 (default knobs) must produce the
 * exact raw JSON text whose sha256 and `packContentHash` are pinned in
 * `determinism-oracle.ts`. The browser leg checks the same pins through
 * WebCrypto; together they prove the pack is byte-identical across engines.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { packContentHash } from '../../src/schema/version';
import { PACK_DIGESTS, PACK_THEMES, packRaw } from './determinism-oracle';

describe('FR-17 — generated packs are byte-identical (cross-engine oracle)', () => {
  it.each(PACK_THEMES)('%s (seed 42) reproduces its pinned digests', (theme) => {
    const raw = packRaw(theme);
    expect({
      sha256: createHash('sha256').update(raw).digest('hex'),
      contentHash: packContentHash(JSON.parse(raw)),
    }).toEqual(PACK_DIGESTS[theme]);
  });
});
