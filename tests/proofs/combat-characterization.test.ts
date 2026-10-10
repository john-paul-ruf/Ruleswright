/**
 * combat-decomposition CAP-D1 / CA-D2 — the combat characterization test.
 *
 * BEHAVIOUR PIN. Each leg runs a scripted fight through the public runtime
 * barrel (`src/runtime/index`) on real packs and seeded `Rng` streams, records
 * every event the host's sink sees plus every snapshot produced, asserts the
 * leg's defining events are present, and pins sha256 of the raw (key-order
 * sensitive) `JSON.stringify({ events, snapshots })` — `packContentHash`
 * (canonical, sorted keys) is kept as a second digest. The digests were
 * captured from the unmodified source at combat-decomposition SESSION-01 ck1.
 *
 * Re-key owner: any later feature that intentionally changes combat events
 * (type, order, payload, `why`, `at`) or snapshot output. That feature lists
 * this file in its plan's pin audit (PROGRAM-CONFIG pin-lease convention).
 * A refactor never re-keys it.
 *
 * The legs and their pinned digests live in `determinism-oracle.ts`, shared
 * with the browser determinism leg (browser-determinism CA-B1); this file is
 * the Node consumer and brings `node:crypto` for the sha256 half.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CHARACTERIZATION_DIGESTS,
  characterLeg,
  contentHashOfRaw,
  featLeg,
  leavingReachLeg,
  ofType,
  parryLeg,
  poolLeg,
  recordingRaw,
  restoreLeg,
  selfLeg,
  useLeg,
  vancianLeg,
  type Digest,
  type Recording,
} from './determinism-oracle';

function digests(recording: Recording): Digest {
  const raw = recordingRaw(recording);
  return { sha256: createHash('sha256').update(raw).digest('hex'), contentHash: contentHashOfRaw(raw) };
}

describe('CAP-D1 — combat characterization (behaviour pin)', () => {
  it('leg 1 — theater-of-mind exchange: a reactive offer taken, one declined', () => {
    const leg = parryLeg();
    expect(ofType(leg.events, 'trigger:fired').length).toBeGreaterThanOrEqual(2);
    expect(ofType(leg.events, 'trigger:declined')).toHaveLength(1);
    expect(ofType(leg.events, 'damage:applied').some((event) => event.why.rule === 'actions.parry')).toBe(
      true,
    );
    expect(digests(leg)).toEqual(CHARACTERIZATION_DIGESTS['leg-1']);
  });

  it('leg 2 — a hex move pauses on move:leaving-reach, is answered, resumes and arrives', () => {
    const leg = leavingReachLeg();
    expect(ofType(leg.events, 'move:leaving-reach')).toHaveLength(1);
    expect(ofType(leg.events, 'move:ended').map((event) => event.payload['reason'])).toEqual(['arrived']);
    expect(digests(leg)).toEqual(CHARACTERIZATION_DIGESTS['leg-2']);
  });

  it('leg 3a — a vancian slot spell centered with `at`, after an out-of-range refusal', () => {
    const leg = vancianLeg();
    const casts = ofType(leg.events, 'spell:cast');
    expect(casts).toHaveLength(1);
    expect(casts[0]!.payload).toMatchObject({ spellId: 'ember-bloom', at: { x: 4, y: 1 }, slotLevel: '2' });
    expect(ofType(leg.events, 'declare:rejected').map((event) => event.payload['kind'])).toEqual([
      'out-of-range',
      'slot-exhausted',
    ]);
    expect(digests(leg)).toEqual(CHARACTERIZATION_DIGESTS['leg-3a']);
  });

  it('leg 3b — a point-pool spell on a target', () => {
    const leg = poolLeg();
    expect(ofType(leg.events, 'spell:cast').map((event) => event.payload['cost'])).toEqual(['points']);
    expect(digests(leg)).toEqual(CHARACTERIZATION_DIGESTS['leg-3b']);
  });

  it('leg 4 — a consumable use', () => {
    const leg = useLeg();
    expect(ofType(leg.events, 'item:used')).toHaveLength(2);
    expect(digests(leg)).toEqual(CHARACTERIZATION_DIGESTS['leg-4']);
  });

  it('leg 5 — a reactive feat offered and taken', () => {
    const leg = featLeg();
    expect(ofType(leg.events, 'trigger:fired').map((event) => event.payload['source'])).toEqual(['feat']);
    expect(
      ofType(leg.events, 'condition:applied').some((event) => event.why.rule === 'content.feats.second-gust'),
    ).toBe(true);
    expect(digests(leg)).toEqual(CHARACTERIZATION_DIGESTS['leg-5']);
  });

  it('leg 6 — a self action lands on its actor; naming a foe is refused', () => {
    const leg = selfLeg();
    expect(ofType(leg.events, 'declare:rejected').map((event) => event.payload['kind'])).toEqual([
      'invalid-target',
    ]);
    expect(
      ofType(leg.events, 'condition:applied').map((event) => [event.actor, event.target, event.why.rule]),
    ).toEqual([['warden', 'warden', 'actions.withdraw']]);
    expect(digests(leg)).toEqual(CHARACTERIZATION_DIGESTS['leg-6']);
  });

  it('leg 7 — a mid-fight snapshot with an open offer → JSON → restore → answered and continued', () => {
    const leg = restoreLeg(leavingReachLeg().paused);
    expect(leg.snapshots[0]).toEqual(['foe.bramble-snap']);
    expect(ofType(leg.events, 'move:ended').map((event) => event.payload['reason'])).toEqual(['arrived']);
    expect(
      ofType(leg.events, 'turn:ended').length + ofType(leg.events, 'turn:started').length,
    ).toBeGreaterThan(0);
    expect(digests(leg)).toEqual(CHARACTERIZATION_DIGESTS['leg-7']);
  });

  it('leg 8 — a generated character and party through the snapshots and back', () => {
    const leg = characterLeg();
    expect(leg.snapshots).toHaveLength(4);
    expect(leg.snapshots[1]).toEqual(leg.snapshots[0]);
    expect(digests(leg)).toEqual(CHARACTERIZATION_DIGESTS['leg-8']);
  });
});
