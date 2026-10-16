import { describe, it, expect } from 'vitest';
import { createEncounterSession, restoreEncounterSession } from '../../../src/runtime';
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
