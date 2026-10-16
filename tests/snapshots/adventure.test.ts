import { expect, it } from 'vitest';
import { createAdventure, restoreAdventure, RuntimeRuleError } from '../../src/runtime';
import { adventureFixture, choose } from '../runtime/adventure/fixtures';

it('reopens using only pack, definition and detached aggregate JSON', () => {
  const { pack, definition, options } = adventureFixture(),
    a = createAdventure(pack, definition, options);
  choose(a);
  const saved = JSON.parse(JSON.stringify(a.serialize()));
  expect(restoreAdventure(pack, definition, saved).serialize()).toEqual(saved);
});
it.each([
  ['snapshotVersion', 2],
  ['kind', 'combat'],
  ['adventureId', ''],
  ['revision', Number.MAX_SAFE_INTEGER + 1],
  ['nodeId', 'unknown'],
  ['phase', 'completed'],
  ['visitedNodeIds', ['clearing']],
  ['resolvedNodeIds', []],
  ['narrationAck', 999],
  ['encounterEventCursor', 1],
  ['pack', {}],
  ['definition', {}],
  ['rng', {}],
  ['members', []],
  ['journal', []],
  ['extra', true],
])('rejects invalid %s before exposing any state', (field, value) => {
  const { pack, definition, options } = adventureFixture(),
    a = createAdventure(pack, definition, options),
    saved = a.serialize();
  expect(() => restoreAdventure(pack, definition, { ...saved, [field]: value })).toThrow(RuntimeRuleError);
  expect(a.serialize()).toEqual(saved);
});

import { fixtureJourney } from '../proofs/adventure-oracle';
import { combatFixture, dispatch } from '../runtime/adventure/fixtures';
import type { AdventureSnapshot } from '../../src/runtime';
const journey = fixtureJourney();
const active = journey.snapshots.find((s) => s.activeEncounter?.encounter.combat.offers?.length)!;
const pending = journey.snapshots[0]!;
const claimed = journey.snapshots.find((s) => s.rewards[0]?.status === 'claimed')!;
function replacePath(subject: unknown, path: string, value: unknown): void {
  const parts = path.split('.');
  let record = subject as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) record = record[part] as Record<string, unknown>;
  record[parts[parts.length - 1]!] = value;
}
const corruptions: readonly [string, AdventureSnapshot, string, unknown][] = [
  ['definition hash', pending, 'definition.contentHash', '00000000'],
  ['pack hash', pending, 'pack.contentHash', '00000000'],
  ['duplicate member', pending, 'members.1.memberId', 'hero-1'],
  ['bad character subject', pending, 'members.0.character.kind', 'party'],
  ['bad character version', pending, 'members.0.character.snapshotVersion', 2],
  ['unknown class', pending, 'members.0.character.state.classes.0.id', 'absent'],
  ['invalid class level', pending, 'members.0.character.state.classes.0.level', 11],
  ['bad pool vocabulary', pending, 'members.0.character.state.pools.absent', 1],
  ['unknown known spell', pending, 'members.0.character.state.knownSpells', ['absent']],
  ['overflow generation', pending, 'rng.generation.a', 4294967296],
  ['overflow play', pending, 'rng.play.d', -1],
  ['overflow director', pending, 'rng.director.c', 4294967296],
  ['overflow counter', pending, 'director.decisions', 9007199254740992],
  ['wrong policy', pending, 'director.policy.version', 999],
  ['invalid narration ack', pending, 'narrationAck', -1],
  ['unknown phase', pending, 'phase', 'ready'],
  ['impossible completion', pending, 'phase', 'completed'],
  ['impossible defeat', pending, 'phase', 'defeated'],
  ['missing pending rewards', pending, 'rewards', []],
  ['null reward row', pending, 'rewards.0', null],
  ['foreign claim', pending, 'rewards.0.claimId', 'wrong'],
  ['foreign reward', pending, 'rewards.0.rewardId', 'flavor'],
  ['swapped recipient authority', pending, 'rewards.0.eligibleMemberIds', ['hero-2', 'hero-1']],
  ['invented xp', pending, 'rewards.0.xpPerMember', 9000],
  ['invented stage revision', pending, 'rewards.0.stagedRevision', 1],
  ['roll endpoint', pending, 'rewards.0.roll.rngAfter.a', 0],
  ['roll origin', pending, 'rewards.0.roll.rngBefore.a', 0],
  ['roll normalized result', pending, 'rewards.0.roll.result', { kind: 'no-item' }],
  ['roll value', pending, 'rewards.0.roll.value', 'different'],
  ['null roll', pending, 'rewards.0.roll', null],
  ['receipt subject', claimed, 'rewards.0.receipt.claimId', 'foreign'],
  ['receipt grant', claimed, 'rewards.0.receipt.grants.0.qty', 100],
  ['receipt final hash', claimed, 'rewards.0.receipt.afterMembersHash', '00000000'],
  ['nested session pairing', active, 'activeEncounter.sessionId', 'foreign'],
  ['nested revision', active, 'activeEncounter.revision', -1],
  ['nested baseline', active, 'activeEncounter.members.0.character.state.hp.current', 100],
  ['cursor overrun', active, 'encounterEventCursor', 9007199254740991],
  ['cursor omitted prefix', active, 'encounterEventCursor', 0],
  ['journal gap', active, 'journal.0.sequence', 2],
  ['journal revision', active, 'journal.0.revision', 9007199254740991],
  ['journal invalid event', active, 'journal.0.event.type', ''],
  ['journal null row', active, 'journal.0', null],
  ['false path', active, 'choiceTrail.0.toNodeId', 'home'],
  ['false path revision', active, 'choiceTrail.0.revision', 0],
  ['false rest', active, 'restedNodeIds', ['home']],
  ['receipt identity', journey.final, 'encounterReceipts.0.receipt.sessionId', 'foreign'],
  ['receipt result', journey.final, 'encounterReceipts.0.receipt.result', 'defeat'],
  ['receipt null row', journey.final, 'encounterReceipts.0', null],
  ['receipt party', journey.final, 'encounterReceipts.0.receipt.memberIds', ['hero-2']],
  ['receipt order', journey.final, 'encounterReceipts', [...journey.final.encounterReceipts].reverse()],
  ['post-claim member tampering', journey.final, 'members.0.character.state.hp.current', 100],
];
it.each(corruptions)(
  'rejects %s without mutating the caller or an existing facade',
  (_label, snapshot, path, value) => {
    const facade = restoreAdventure(journey.pack, journey.definition, JSON.parse(JSON.stringify(snapshot)));
    const bad = JSON.parse(JSON.stringify(snapshot));
    replacePath(bad, path, value);
    const bytes = JSON.stringify(bad);
    expect(() => restoreAdventure(journey.pack, journey.definition, bad)).toThrow(RuntimeRuleError);
    expect(JSON.stringify(bad)).toBe(bytes);
    expect(facade.serialize()).toEqual(snapshot);
  },
);
it('rejects missing/duplicate/historical enemy subjects and a forged copied prefix', () => {
  const index = active.journal.findIndex((entry) => entry.subjects.length > 0);
  expect(index).toBeGreaterThanOrEqual(0);
  const enemyIndex = active.journal.findIndex((entry) => entry.subjects.some((s) => s.id.startsWith('e:')));
  expect(enemyIndex).toBeGreaterThanOrEqual(0);
  for (const [path, value] of [
    [`journal.${index}.subjects`, []],
    [`journal.${index}.subjects`, [...active.journal[index]!.subjects, active.journal[index]!.subjects[0]]],
    [
      `journal.${enemyIndex}.subjects`,
      active.journal[enemyIndex]!.subjects.map((s) => ({ ...s, name: 'forged' })),
    ],
    [`journal.${active.journal.length - 1}.event.why.rule`, 'forged'],
  ] as const) {
    const bad = JSON.parse(JSON.stringify(active));
    replacePath(bad, path, value);
    expect(() => restoreAdventure(journey.pack, journey.definition, bad)).toThrow(RuntimeRuleError);
  }
});
it.each(['defeated', 'abandoned'] as const)(
  'reopens %s and rejects further abandonment without effects',
  (phase) => {
    const f = combatFixture(true);
    if (phase === 'defeated') replacePath(f.options, 'members.0.character.state.hp.current', -4);
    const a = createAdventure(f.pack, f.definition, f.options);
    choose(a);
    if (phase === 'abandoned') expect(dispatch(a, { type: 'abandon' }).ok).toBe(true);
    expect(a.view().phase).toBe(phase);
    const saved = a.serialize(),
      reopened = restoreAdventure(f.pack, f.definition, JSON.parse(JSON.stringify(saved)));
    expect(reopened.serialize()).toEqual(saved);
    expect(reopened.view()).toEqual(a.view());
    expect(dispatch(reopened, { type: 'abandon' }).ok).toBe(false);
    expect(reopened.serialize()).toEqual(saved);
  },
);
it('creation reports located runtime cards for an invalid pack or character', () => {
  const f = adventureFixture();
  expect(() => createAdventure({ ...f.pack, extra: true } as typeof f.pack, f.definition, f.options)).toThrow(
    RuntimeRuleError,
  );
  replacePath(f.options, 'members.0.character.state.classes.0.id', 'unknown');
  expect(() => createAdventure(f.pack, f.definition, f.options)).toThrow(RuntimeRuleError);
});

it('keeps host member ids opaque even when they resemble a different combatant id', () => {
  const f = journey;
  const saved = JSON.parse(JSON.stringify(f.snapshots[0]!));
  // Create afresh so all claim authorities and hashes come from production writers.
  const members = saved.members as {
    memberId: string;
    character: AdventureSnapshot['members'][number]['character'];
  }[];
  members[1]!.memberId = 'm:hero-1';
  const a = createAdventure(f.pack, f.definition, { adventureId: 'opaque', seed: 42, members });
  const r = a.view().pendingRewards[0]!;
  expect(
    dispatch(a, {
      type: 'claim-reward',
      nodeId: r.nodeId,
      rewardId: r.rewardId,
      claimId: r.claimId,
      recipientMemberId: 'm:hero-1',
    }).ok,
  ).toBe(true);
  expect(
    restoreAdventure(f.pack, f.definition, JSON.parse(JSON.stringify(a.serialize()))).serialize(),
  ).toEqual(a.serialize());
});

it('retains committed policy, decisions, mechanical hash and tie entropy, rejecting malformed director data', async () => {
  const { directorFixture } = await import('../runtime/adventure/fixtures');
  const { advanceSolo } = await import('../../src/runtime');
  const f = directorFixture({ tieBreak: 'seeded' }),
    adventure = createAdventure(f.pack, f.definition, f.options);
  choose(adventure);
  advanceSolo(adventure, { maxSteps: 2 });
  const saved = adventure.serialize();
  expect(saved.director.decisions).toBe(2);
  expect(saved.director.lastMechanicalHash).toMatch(/^[0-9a-f]{8}$/);
  expect(restoreAdventure(f.pack, f.definition, JSON.parse(JSON.stringify(saved))).serialize()).toEqual(
    saved,
  );
  for (const [path, value] of [
    ['director.policy.id', 'other'],
    ['director.decisions', -1],
    ['director.stalledSteps', 1.5],
    ['director.lastMechanicalHash', 'invalid'],
    ['rng.director.a', -1],
  ] as const) {
    const bad = JSON.parse(JSON.stringify(saved));
    replacePath(bad, path, value);
    expect(() => restoreAdventure(f.pack, f.definition, bad)).toThrow(RuntimeRuleError);
  }
});
