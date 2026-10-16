import { expect, it } from 'vitest';
import { createAdventure, readNarration, restoreAdventure } from '../../../src/runtime';
import type { AdventureCommand } from '../../../src/runtime';
import {
  adventureFixture,
  combatFixture,
  rewardFixture,
  choose,
  dispatch,
  finishEncounter,
  rehash,
} from './fixtures';

it('projects exact message tuples, event-time node facts and literal text without reads consuming anything', () => {
  const f = adventureFixture();
  const definition = rehash({
    ...f.definition,
    facts: { place: 'world' },
    nodes: f.definition.nodes.map((n) => ({
      ...n,
      facts: n.id === 'start' ? { place: '<script>{type}</script>' } : n.facts,
    })),
    narration: {
      fragments: [
        {
          id: 'arrival',
          eventType: 'node:entered',
          text: '{kind}|{node}|{rule}|{rolls}|{place}',
          slots: [
            { name: 'kind', path: 'type' },
            { name: 'node', path: 'payload.nodeId' },
            { name: 'rule', path: 'why.rule' },
            { name: 'rolls', path: 'why.rolls' },
            { name: 'place', path: 'facts.place' },
          ],
        },
      ],
    },
  });
  const a = createAdventure(f.pack, definition, f.options);
  choose(a);
  const before = a.serialize(),
    messages = readNarration(a);
  expect(messages).toEqual(
    before.journal.map((entry, i) => ({
      messageId: JSON.stringify([before.adventureId, entry.sequence]),
      sequence: entry.sequence,
      templateId: 'arrival',
      event: entry.event,
      text:
        i === 0
          ? 'node:entered|start|nodes.start||<script>{type}</script>'
          : 'node:entered|clearing|nodes.clearing||world',
    })),
  );
  expect(readNarration(a)).toEqual(messages);
  (messages[0]!.event.payload as Record<string, unknown>)['nodeId'] = 'mutated';
  expect(a.serialize()).toEqual(before);
  expect(readNarration(restoreAdventure(f.pack, definition, JSON.parse(JSON.stringify(before))))).toEqual(
    readNarration(a),
  );
});

it('renders actual historical actor/target subjects and provenance after removing the encounter', () => {
  const f = combatFixture();
  const definition = rehash({
    ...f.definition,
    narration: {
      fragments: [
        {
          id: 'hit',
          eventType: 'damage:applied',
          text: '{actor} -> {target}: {amount} ({rule}; {rolls})',
          slots: [
            { name: 'actor', path: 'actor' },
            { name: 'target', path: 'target' },
            { name: 'amount', path: 'payload.amount' },
            { name: 'rule', path: 'why.rule' },
            { name: 'rolls', path: 'why.rolls' },
          ],
        },
      ],
    },
  });
  const a = createAdventure(f.pack, definition, f.options);
  choose(a);
  finishEncounter(a);
  choose(a);
  expect(a.serialize().activeEncounter).toBeNull();
  const hits = readNarration(a).filter((m) => m.event.type === 'damage:applied');
  expect(hits.length).toBeGreaterThan(0);
  for (const hit of hits) {
    const entry = a.serialize().journal[hit.sequence - 1]!;
    expect(hit.templateId).toBe('hit');
    expect(hit.text).toBe(
      `${entry.subjects.find((s) => s.id === hit.event.actor)!.name} -> ${entry.subjects.find((s) => s.id === hit.event.target)!.name}: ${hit.event.payload['amount']} (${hit.event.why.rule}; ${hit.event.why.rolls.join(', ')})`,
    );
  }
});

it('falls back factually for missing slots and unknown events, retaining the complete event', () => {
  const f = adventureFixture();
  const definition = rehash({
    ...f.definition,
    narration: {
      fragments: [
        {
          id: 'missing',
          eventType: 'node:entered',
          text: '{amount}',
          slots: [{ name: 'amount', path: 'payload.amount' }],
        },
      ],
    },
  });
  const a = createAdventure(f.pack, definition, f.options);
  const initial = readNarration(a)[0]!;
  expect(initial.templateId).toBeNull();
  expect(initial.text).toContain('node:entered');
  expect(initial.text).not.toContain('undefined');
  const saved = a.serialize();
  const unknown = {
    sequence: 2,
    revision: 0,
    subjects: [],
    event: {
      type: 'future:fact',
      at: { round: 0, turn: 0 },
      payload: { value: 3 },
      why: { rule: 'future', rolls: ['1d6 [3] = 3'] },
    },
  };
  const restored = restoreAdventure(f.pack, definition, {
    ...saved,
    sequence: 2,
    journal: [...saved.journal, unknown],
  });
  expect(readNarration(restored)[1]).toMatchObject({ templateId: null, event: unknown.event });
  expect(readNarration(restored)[1]!.text).toContain('1d6 [3] = 3');
});

it('renders actual negative damage as healing, never as a damage fragment', () => {
  const f = rewardFixture(0);
  const definition = rehash({
    ...f.definition,
    narration: {
      fragments: [
        {
          id: 'damage',
          eventType: 'damage:applied',
          text: 'Damage {amount}',
          slots: [{ name: 'amount', path: 'payload.amount' }],
        },
      ],
    },
  });
  const a = createAdventure(f.pack, definition, f.options);
  expect(
    dispatch(a, { type: 'use-item', nodeId: 'start', memberId: 'hero-1', itemId: 'mend-draught' }).ok,
  ).toBe(true);
  const healed = readNarration(a).find((m) => m.event.type === 'damage:applied')!;
  expect(healed.event.payload['amount']).toBeLessThan(0);
  expect(healed.templateId).toBeNull();
  expect(healed.text).toMatch(/^Healing/);
});

it('acks only revision and cursor with no event; equal ack is inert after identity/revision validation', () => {
  const f = adventureFixture(),
    a = createAdventure(f.pack, f.definition, f.options);
  choose(a);
  const before = a.serialize();
  const result = dispatch(a, { type: 'ack-narration', throughSequence: 1 });
  expect(result.ok).toBe(true);
  expect(result.events).toEqual([]);
  expect(a.serialize()).toEqual({ ...before, revision: before.revision + 1, narrationAck: 1 });
  const saved = a.serialize();
  expect(dispatch(a, { type: 'ack-narration', throughSequence: 1 }).ok).toBe(true);
  expect(a.serialize()).toEqual(saved);
  const reopened = restoreAdventure(f.pack, f.definition, JSON.parse(JSON.stringify(saved)));
  expect(readNarration(reopened)).toEqual(readNarration(a));
  expect(readNarration(reopened).map((m) => m.sequence)).toEqual([2]);
  for (const patch of [
    { throughSequence: 0 },
    { throughSequence: 3 },
    { expectedRevision: 0 },
    { adventureId: 'foreign' },
    { throughSequence: -1 },
    { throughSequence: 1.5 },
    { throughSequence: Infinity },
    { throughSequence: NaN },
    { throughSequence: Number.MAX_SAFE_INTEGER + 1 },
    { extra: true },
  ]) {
    const rejected = a.dispatch({
      type: 'ack-narration',
      adventureId: saved.adventureId,
      expectedRevision: saved.revision,
      throughSequence: 1,
      ...patch,
    } as AdventureCommand);
    expect(rejected.ok).toBe(false);
    expect(rejected.events).toEqual([]);
    expect(a.serialize()).toEqual(saved);
  }
  expect(dispatch(reopened, { type: 'ack-narration', throughSequence: 2 }).ok).toBe(true);
  expect(readNarration(reopened)).toEqual([]);
  expect(
    readNarration(restoreAdventure(f.pack, f.definition, JSON.parse(JSON.stringify(reopened.serialize())))),
  ).toEqual([]);
});

it.each(['completed', 'defeated', 'abandoned'] as const)('allows explicit acknowledgement in %s', (phase) => {
  const f = phase === 'defeated' ? combatFixture() : adventureFixture();
  const options =
    phase === 'defeated'
      ? {
          ...f.options,
          members: f.options.members.map((m) => ({
            ...m,
            character: { ...m.character, state: { ...m.character.state, hp: { current: 0, temp: 0 } } },
          })),
        }
      : f.options;
  const a = createAdventure(f.pack, f.definition, options);
  if (phase === 'abandoned') dispatch(a, { type: 'abandon' });
  else {
    choose(a);
    if (phase === 'completed') choose(a);
  }
  expect(a.view().phase).toBe(phase);
  expect(a.view().availableCommands).toContain('ack-narration');
  const before = a.serialize();
  expect(dispatch(a, { type: 'ack-narration', throughSequence: before.sequence })).toMatchObject({
    ok: true,
    events: [],
  });
  expect(a.serialize()).toEqual({ ...before, revision: before.revision + 1, narrationAck: before.sequence });
  expect(
    readNarration(restoreAdventure(f.pack, f.definition, JSON.parse(JSON.stringify(a.serialize())))),
  ).toEqual([]);
});
