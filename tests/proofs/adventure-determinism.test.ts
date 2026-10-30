import { expect, it } from 'vitest';
import { packContentHash } from '../../src/schema';
import { ADVENTURE_DIGESTS, oracleRecording, SOLO_DIGEST, soloRecording } from './adventure-oracle';
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

it('solo decisions, player offers, messages and acknowledgement match across JSON reopen and budgets', () => {
  const whole = soloRecording();
  expect(soloRecording(true)).toEqual(whole);
  expect(packContentHash(whole)).toBe(SOLO_DIGEST);
  const split = soloRecording(true, 1);
  expect(split.final).toEqual(whole.final);
  expect(split.messages).toEqual(whole.messages);
}, 10000);

it.each([
  // Re-keyed for v1.8 content (budgets, XP rewards, ability arrays), with ack-narration stripped.
  ['generated', '05752702'],
  ['fixture', 'a2f68c27'],
] as const)(
  '%s oracle delta is only the approved ack-narration available command',
  (kind, previous) => {
    const recording = oracleRecording(kind);
    for (const result of recording.results as { view: { availableCommands: string[] } }[]) {
      expect(result.view.availableCommands).toContain('ack-narration');
      result.view.availableCommands = result.view.availableCommands.filter(
        (type) => type !== 'ack-narration',
      );
    }
    expect(packContentHash(recording)).toBe(previous);
  },
  10000,
);
