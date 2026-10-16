import { expect, it } from 'vitest';
import { packContentHash } from '../../src/schema';
import { ADVENTURE_DIGESTS, oracleRecording } from './adventure-oracle';
it.each(['generated', 'fixture'] as const)(
  '%s adventure exactly reproduces after every JSON boundary',
  (kind) => {
    const continuous = oracleRecording(kind),
      reopened = oracleRecording(kind, true);
    expect(reopened).toEqual(continuous);
    expect(packContentHash(continuous)).toBe(ADVENTURE_DIGESTS[kind]);
  },
  10000,
);
