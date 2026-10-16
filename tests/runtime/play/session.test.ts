import { describe, it, expect } from 'vitest';
import { createEncounterSession, restoreEncounterSession } from '../../../src/runtime';
import { packContentHash } from '../../../src/schema/version';
import { Rng } from '../../../src/core/rng';
import { actor, nextAction, playFixture, send } from './fixtures';

describe('CAP-01 command boundary and real midfight persistence', () => {
  it('preserves empty setup seeds and original members while projecting use and HP', () => {
    const { pack, options } = playFixture();
    const session = createEncounterSession(pack, options);
    const original = session.serialize();
    expect(original.encounter.setup.seed).toBe('');
    expect(original.encounter.selection.seedUsed).toBe('');
    expect(original.encounter.memberBindings).toEqual([
      { memberId: 'hero-1', characterId: 'char-1', combatantId: 'm:hero-1' },
    ]);
    expect(send(session, { type: 'advance' }).ok).toBe(true);
    const id = session.view().combat.state.active;
    expect(id).toBe('m:hero-1');
    expect(send(session, { type: 'use', actor: actor(id), itemId: 'mend-draught', targetId: id }).ok).toBe(
      true,
    );
    expect(session.serialize().members).toEqual(original.members);
    expect(session.view().members[0]!.character.state.inventory).toEqual([{ id: 'mend-draught', qty: 1 }]);
    expect(session.view().members[0]!.character.state.hp.current).toBeGreaterThan(18);
    expect(session.serialize().encounter.combat.combatants.find((c) => c.id === id)!.itemsUsed).toEqual({
      'mend-draught': 1,
    });
  });
  it('refuses repeat advance, wrong actor, unknown action and malformed commands without state/RNG/events', () => {
    const { pack, options } = playFixture();
    const session = createEncounterSession(pack, options);
    send(session, { type: 'advance' });
    const before = session.serialize();
    for (const body of [
      { type: 'advance' },
      { type: 'pass', actor: { kind: 'enemy', enemyId: 'e:0:1' } },
      { type: 'declare', actor: { kind: 'member', memberId: 'hero-1' }, actionId: 'unknown' },
      {
        type: 'use',
        actor: { kind: 'member', memberId: 'hero-1' },
        itemId: 'mend-draught',
        targetId: 'unknown',
      },
      { type: 'advance', extra: 1 },
    ]) {
      const result = session.dispatch({
        ...body,
        sessionId: options.sessionId,
        expectedRevision: before.revision,
      } as never);
      expect(result.ok).toBe(false);
      expect(result.events).toEqual([]);
      expect(session.serialize()).toEqual(before);
    }
    expect(send(session, { type: 'pass', actor: actor(session.view().combat.state.active) }).ok).toBe(true);
    expect(session.serialize().encounter.control.turnStarted).toBe(false);
    expect(session.view().combat.state.active).not.toBe('m:hero-1');
  });
  it('owns pack, options, snapshots and view copies, with same-named members bound by memberId', () => {
    const { pack, options } = playFixture(undefined, 2);
    const session = createEncounterSession(pack, options);
    const original = session.serialize();
    expect(original.encounter.memberBindings.map((b) => [b.memberId, b.combatantId])).toEqual([
      ['hero-1', 'm:hero-1'],
      ['hero-2', 'm:hero-2'],
    ]);
    (options.members[0]!.character.state.hp as { current: number }).current = 999;
    pack.actions['strike']!.effect = 'damage(999)';
    const view = session.view();
    view.combat.state.combatants['m:hero-1']!.hp.current = 888;
    const snapshot = session.serialize();
    (snapshot.members as unknown[]).pop();
    expect(session.serialize()).toEqual(original);
  });
  it('reopens actual raw combat with identical command results, journal suffix, resources and RNG', () => {
    const { pack, options } = playFixture();
    const session = createEncounterSession(pack, options);
    send(session, { type: 'advance' });
    send(session, nextAction(session));
    const saved = JSON.parse(JSON.stringify(session.serialize()));
    const restored = restoreEncounterSession(pack, saved);
    expect(restored.view()).toEqual(session.view());
    for (let i = 0; i < 8 && session.view().phase === 'active'; i++) {
      const command = nextAction(session);
      expect(send(restored, command)).toEqual(send(session, command));
      expect(restored.serialize()).toEqual(session.serialize());
    }
  });
  it('uses the approved streams and canonical seed spellings', () => {
    const { pack, options } = playFixture();
    const session = createEncounterSession(pack, options);
    const saved = session.serialize();
    expect(createEncounterSession(pack, { ...options, seed: '42' }).serialize()).toEqual(saved);
    const play = new Rng(JSON.stringify(['ruleswright', 1, 'encounter-play', options.sessionId, '42']));
    play.int(4294967296);
    expect(saved.rng.play).toEqual(play.getState());
    const generation = new Rng(
      JSON.stringify(['ruleswright', 1, 'encounter-generation', options.sessionId, '42', 0, '']),
    );
    generation.int(200);
    expect(saved.rng.generation).toEqual(generation.getState());
  });
});

it('preserves paused movement and offers, rejects a refused take transaction, then resumes from current geometry', () => {
  const { pack } = playFixture();
  pack.spatial = { model: 'grid', reach: { default: 1 }, shapes: ['single'] };
  pack.formulas['speed'] = { expr: '3' };
  pack.actions['stride'] = { cost: { slots: { move: 1 } }, effect: 'move(speed)', tags: ['move'] };
  pack.actions['opportunist'] = {
    cost: { slots: { main: 1 } },
    trigger: { on: 'move:leaving-reach[target=self]' },
    effect: 'damage(1)',
    tags: ['main'],
  };
  pack.content.classes!['warden']!.actions!.push('stride');
  pack.bestiary['barrow-wight']!.actions.push('opportunist');
  const { options } = playFixture(pack);
  const session = createEncounterSession(pack, options);
  send(session, { type: 'advance' });
  expect(
    send(session, {
      type: 'declare',
      actor: { kind: 'member', memberId: 'hero-1' },
      actionId: 'stride',
      options: { to: { x: 0, y: -2 } },
    }).ok,
  ).toBe(true);
  const saved = session.serialize();
  expect(saved.encounter.combat.combatants.find((c) => c.id === 'm:hero-1')!.pendingMove).toBeDefined();
  const reopened = restoreEncounterSession(pack, JSON.parse(JSON.stringify(saved)));
  const offer = reopened.view().combat.pendingOffers[0]!;
  expect(offer).toBeDefined();
  for (const branch of [session, reopened]) {
    const before = branch.serialize();
    expect(send(branch, { type: 'advance' }).ok).toBe(false);
    expect(send(branch, { type: 'pass', actor: { kind: 'member', memberId: 'hero-1' } }).ok).toBe(false);
    expect(
      send(branch, {
        type: 'respond',
        actor: actor(offer.actorId),
        triggerId: offer.triggerId,
        choice: 'take',
        targetId: 'unknown',
      }).ok,
    ).toBe(false);
    expect(branch.serialize()).toEqual(before);
  }
  const take = {
    type: 'respond' as const,
    actor: actor(offer.actorId),
    triggerId: offer.triggerId,
    choice: 'take' as const,
    targetId: 'm:hero-1',
  };
  expect(send(session, take)).toEqual(send(reopened, take));
  expect(session.view().combat.pendingOffers).toEqual([]);
  expect(session.serialize().encounter.positions['m:hero-1']).toEqual({ x: 0, y: -2 });
  expect(session.serialize().encounter.start.positions['m:hero-1']).toEqual({ x: 0, y: 0 });
  expect(restoreEncounterSession(pack, session.serialize()).view()).toEqual(session.view());
});

describe('CA-02 atomic settlement', () => {
  it.each(['victory', 'defeat', 'abandoned'] as const)(
    'settles %s exactly once and reopens the receipt',
    async (result) => {
      const { settlementFixture, finish, declineOffers } = await import('./fixtures');
      const { pack, options } = settlementFixture();
      const session = createEncounterSession(pack, options);
      send(session, { type: 'advance' });
      const player = { kind: 'member' as const, memberId: 'hero-1' };
      for (const body of [
        { type: 'use' as const, actor: player, itemId: 'mend-draught' },
        { type: 'declare' as const, actor: player, actionId: 'hex-bolt', options: { targetId: 'e:0:1' } },
        { type: 'declare' as const, actor: player, actionId: 'grave-light', options: { targetId: 'e:0:1' } },
      ]) {
        const response = send(session, body);
        expect(response.ok, JSON.stringify(response)).toBe(true);
        declineOffers(session);
      }
      if (result === 'victory') finish(session);
      else {
        for (let i = 0; i < 500; i++) {
          if (session.view().phase === 'terminal') break;
          const view = session.view();
          if (result === 'abandoned' && view.combat.pendingOffers.length) break;
          const body = view.combat.pendingOffers.length
            ? nextAction(session)
            : view.availableCommands.includes('advance')
              ? { type: 'advance' as const }
              : view.combat.state.active.startsWith('m:')
                ? { type: 'pass' as const, actor: player }
                : nextAction(session);
          expect(send(session, body).ok).toBe(true);
          if (i === 499) throw new Error('settlement driver exhausted');
        }
      }
      if (result === 'abandoned') expect(session.view().combat.pendingOffers.length).toBeGreaterThan(0);
      else expect(session.view().result).toBe(result);
      const before = session.serialize();
      const reopened = restoreEncounterSession(pack, JSON.parse(JSON.stringify(before)));
      const body = { type: result === 'abandoned' ? ('abandon' as const) : ('finalize' as const) };
      const answer = send(session, body);
      expect(answer.ok).toBe(true);
      expect(send(reopened, body)).toEqual(answer);
      const after = session.serialize();
      expect(after.encounter).toEqual(before.encounter);
      expect(after.settlements[0]).toMatchObject({
        receiptId: JSON.stringify([before.sessionId, before.encounter.encounterId, 'settlement']),
        sourceHash: packContentHash({ pack: before.pack, encounter: before.encounter }),
        beforeMembersHash: packContentHash(before.members),
        afterMembersHash: packContentHash(after.members),
      });
      expect(after.members[0]!.character.state.pools['stamina']).toBe(
        options.members[0]!.character.state.pools['stamina']! - 3,
      );
      expect(after.members[0]!.character.state.slots['1']).toEqual([null]);
      expect(after.members[0]!.character.state.inventory).toEqual([{ id: 'mend-draught', qty: 1 }]);
      const raw = before.encounter.combat.combatants.find((c) => c.id === 'm:hero-1')!;
      expect(after.members[0]!.character.state.hp).toEqual({ current: raw.hp, temp: 2 });
      expect(after.members[0]!.character.state.conditions).toEqual(raw.conditions);
      expect(after.journal.slice(before.sequence).every((entry) => entry.event.actor === 'm:hero-1')).toBe(
        true,
      );
      const restored = restoreEncounterSession(pack, JSON.parse(JSON.stringify(after)));
      const repeated = send(restored, { type: 'finalize' });
      expect(repeated.ok).toBe(true);
      expect(repeated.events).toEqual([]);
      expect(restored.serialize()).toEqual(after);
      expect(
        restored.dispatch({
          type: 'finalize',
          sessionId: options.sessionId,
          expectedRevision: before.revision,
        }).ok,
      ).toBe(false);
    },
  );
  it.each(['abandon', 'finalize'] as const)(
    'rolls back earlier member debits when a later equipped spend blocks %s',
    async (type) => {
      const { settlementFixture, finish, declineOffers } = await import('./fixtures');
      const { pack, options } = settlementFixture(2, true);
      const session = createEncounterSession(pack, options);
      for (let member = 0; member < 2; member++) {
        expect(send(session, { type: 'advance' }).ok).toBe(true);
        const id = session.view().combat.state.active;
        expect(id.startsWith('m:')).toBe(true);
        expect(send(session, { type: 'use', actor: actor(id), itemId: 'mend-draught' }).ok).toBe(true);
        declineOffers(session);
        if (id === 'm:hero-2') {
          const response = send(session, { type: 'use', actor: actor(id), itemId: 'mend-draught' });
          expect(response.ok, JSON.stringify(response)).toBe(true);
          declineOffers(session);
        }
        expect(send(session, { type: 'pass', actor: actor(id) }).ok).toBe(true);
      }
      if (type === 'finalize') finish(session);
      const before = session.serialize();
      const result = send(session, { type });
      expect(result.ok).toBe(false);
      expect(result.events).toEqual([]);
      if (!result.ok) expect(result.errors.some((e) => e.rule === 'item-equipped')).toBe(true);
      expect(session.serialize()).toEqual(before);
      const restored = restoreEncounterSession(pack, JSON.parse(JSON.stringify(before)));
      expect(send(restored, { type })).toEqual(result);
      expect(restored.serialize()).toEqual(before);
    },
  );
});
