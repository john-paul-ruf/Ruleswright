import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import * as esm from '../../dist/runtime.js';
import { soloJourney } from './adventure-oracle';
const cjs = createRequire(import.meta.url)('../../dist/runtime.cjs') as typeof esm;

it.each([
  ['ESM', esm],
  ['CJS', cjs],
] as const)(
  'fresh built %s drives actual solo combat, host claims, the next fight and reopen',
  (_label, api) => {
    const whole = soloJourney(false, api);
    const reopened = soloJourney(true, api);
    expect(reopened.snapshots).toEqual(whole.snapshots);
    expect(reopened.results).toEqual(whole.results);
    expect(reopened.messages).toEqual(whole.messages);
    expect(reopened.final).toEqual(whole.final);
    expect(whole.final.rewards.every((r) => r.status === 'claimed')).toBe(true);
  },
  10000,
);

it('budget partitioning preserves the final authoritative state and every committed event', () => {
  const whole = soloJourney(false, esm, 20),
    split = soloJourney(true, esm, 1);
  expect(split.final).toEqual(whole.final);
  expect(split.messages).toEqual(whole.messages);
  expect(split.final.journal).toEqual(whole.final.journal);
}, 10000);
