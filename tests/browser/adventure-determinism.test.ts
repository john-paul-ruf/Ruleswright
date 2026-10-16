import { expect, it } from 'vitest';
import { packContentHash } from '../../src/schema';
import { ADVENTURE_DIGESTS, oracleRecording } from '../proofs/adventure-oracle';
it.each(['generated', 'fixture'] as const)(
  '%s adventure matches Node and every-reopen script in a browser',
  (kind) => {
    const recording = oracleRecording(kind);
    expect(oracleRecording(kind, true)).toEqual(recording);
    expect(packContentHash(recording)).toBe(ADVENTURE_DIGESTS[kind]);
  },
  10000,
);
