import * as runtimeApi from '../../../src/runtime';
import type { Pack } from '../../../src/schema/pack';
import type { EncounterSessionOptions } from '../../../src/schema/play-session';
import type { EncounterActor, EncounterCommand, EncounterSession } from '../../../src/runtime';
import { cloneRuntimePack } from '../fixtures/pack';

export function playPack(): Pack {
  const pack = cloneRuntimePack();
  pack.formulas['initiative'] = { expr: 'grace' };
  pack.bestiary['barrow-wight']!.abilityOverrides = { might: 14, grace: -100 };
  pack.content.classes!['warden']!.actions = ['strike'];
  pack.content.classes!['warden']!.spellLists = ['hexer'];
  return pack;
}

export function playFixture(pack = playPack(), count = 1): { pack: Pack; options: EncounterSessionOptions } {
  const runtime = new runtimeApi.Runtime(pack);
  runtime.createCharacter({ name: 'Unrelated', race: 'ashkin', classes: ['warden'] });
  const members = Array.from({ length: count }, (_, i) => {
    const character = runtime.createCharacter({
      name: 'Same name',
      race: 'ashkin',
      classes: ['warden'],
    });
    character.state.hp = { current: 18 - i, temp: i + 2 };
    character.applyCondition('dazzed');
    character.grant('mend-draught', 2);
    return { memberId: `hero-${i + 1}`, character: runtimeApi.serializeCharacter(runtime, character.state) };
  });
  const budget = Math.min(...Object.values(pack.bestiary).map((monster) => monster.threat));
  return {
    pack,
    options: {
      sessionId: 'journey',
      seed: 42,
      members,
      setup: {
        budget,
        seed: '',
        maxPartySize: count,
        maxEnemies: 1,
        layout: pack.spatial
          ? {
              kind: 'spatial',
              model: pack.spatial.model,
              allies: members.map((_, i) => ({ x: i, y: 0 })),
              enemies: [{ x: 0, y: 1 }],
              terrain: [],
            }
          : { kind: 'theater' },
      },
    },
  };
}

type Body<T = EncounterCommand> = T extends EncounterCommand
  ? Omit<T, 'sessionId' | 'expectedRevision'>
  : never;
export function send(session: EncounterSession, body: Body) {
  const view = session.view();
  return session.dispatch({
    ...body,
    sessionId: view.sessionId,
    expectedRevision: view.revision,
  } as EncounterCommand);
}
export function actor(id: string): EncounterActor {
  return id.startsWith('m:') ? { kind: 'member', memberId: id.slice(2) } : { kind: 'enemy', enemyId: id };
}
export function nextAction(session: EncounterSession): Body {
  const view = session.view();
  const offer = view.combat.pendingOffers[0];
  if (offer)
    return { type: 'respond', actor: actor(offer.actorId), triggerId: offer.triggerId, choice: 'decline' };
  if (view.availableCommands.includes('advance')) return { type: 'advance' };
  const active = view.combat.state.combatants[view.combat.state.active]!;
  const target = Object.values(view.combat.state.combatants).find(
    (c) => c.side !== active.side && c.hp.current > 0,
  )!;
  return {
    type: 'declare',
    actor: actor(active.id),
    actionId: active.actions[0]!,
    options: { targetId: target.id },
  };
}
export function finish(session: EncounterSession): void {
  for (let i = 0; i < 500; i++) {
    if (session.view().phase !== 'active') return;
    const result = send(session, nextAction(session));
    if (!result.ok) throw new Error(JSON.stringify(result));
  }
  throw new Error(`Encounter exceeded 500 commands: ${JSON.stringify(session.serialize())}`);
}

export function settlementFixture(count = 1, equippedLast = false) {
  const pack = playPack();
  pack.bestiary['barrow-wight']!.abilityOverrides!['vigor'] = 30;
  pack.actions['poke'] = {
    cost: { slots: { main: 1 } },
    effect: 'sequence(damage(1), applyCondition(dazzed, 4))',
    tags: ['main'],
  };
  pack.actions['retort'] = {
    cost: { slots: { main: 1 } },
    effect: 'damage(1)',
    trigger: { on: 'damage:applied[target=self]' },
    tags: ['main'],
  };
  pack.bestiary['barrow-wight']!.actions = ['poke'];
  pack.content.classes!['warden']!.actions!.push('retort');
  if (equippedLast) {
    pack.content.items!['mend-draught']!.slots = ['ring'];
    pack.content.items!['mend-draught']!.grants = { luck: 1 };
  }
  const { options } = playFixture(pack, count);
  const runtime = new runtimeApi.Runtime(pack);
  const members = options.members.map((member, i) => {
    const character = runtimeApi.restoreCharacter(runtime, member.character);
    character.prepare('grave-light');
    if (equippedLast && i === count - 1) character.equip('mend-draught', 'ring');
    return { ...member, character: runtimeApi.serializeCharacter(runtime, character.state) };
  });
  return { pack, options: { ...options, members } };
}

export function declineOffers(session: EncounterSession): void {
  for (let i = 0; i < 30; i++) {
    const offer = session.view().combat.pendingOffers[0];
    if (!offer) return;
    const result = send(session, {
      type: 'respond',
      actor: actor(offer.actorId),
      triggerId: offer.triggerId,
      choice: 'decline',
    });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
  }
  throw new Error('Offer driver exceeded 30 responses');
}
