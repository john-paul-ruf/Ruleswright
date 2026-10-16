import { expect, it } from 'vitest';
import { packContentHash } from '../../src/schema';
import { ADVENTURE_DIGESTS, oracleRecording, SOLO_DIGEST, soloRecording } from '../proofs/adventure-oracle';
it.each(['generated', 'fixture'] as const)(
  '%s adventure matches Node and every-reopen script in a browser',
  (kind) => {
    const recording = oracleRecording(kind);
    expect(oracleRecording(kind, true)).toEqual(recording);
    expect(packContentHash(recording)).toBe(ADVENTURE_DIGESTS[kind]);
  },
  10000,
);

it('solo decisions, player offers, messages and acknowledgement match across JSON reopen and budgets', () => {
  const whole = soloRecording();
  expect(soloRecording(true)).toEqual(whole);
  expect(packContentHash(whole)).toBe(SOLO_DIGEST);
  const split = soloRecording(true, 1);
  expect(split.final).toEqual(whole.final);
  expect(split.messages).toEqual(whole.messages);
}, 10000);
