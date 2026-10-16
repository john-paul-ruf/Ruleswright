import type { Pack } from '../../schema/pack';
import type { PlayMembers, PlaySessionSnapshot, PlaySettlementReceipt } from '../../schema/play-session';
import { packContentHash } from '../../schema/version';
import { restoreCharacter, serializeCharacter } from '../snapshots/character';
import { settleItemUses, settleSpellCasts } from '../character-profile';
import { dropItem } from '../inventory';
import { equippedUnits } from '../equipment';
import type { Character } from '../character';
import type { Runtime } from '../runtime';
import type { CombatantState } from '../combat/types';
import type { RuntimeEvent } from '../events';
import { RuntimeRuleError, ruleCard } from '../errors';
import { hydrateFight } from './snapshot';

function settleActive(runtime: Runtime, character: Character, combatant: CombatantState): void {
  const state = character.state;
  const errors = [];
  const items = Object.entries(combatant.itemsUsed)
    .filter(([, qty]) => qty > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const pools = Object.entries(combatant.poolsSpent).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const casts = Object.entries(combatant.slotsCast)
    .sort(([a], [b]) => Number(a) - Number(b))
    .flatMap(([level, indices]) => [...indices].sort((a, b) => a - b).map((index) => ({ level, index })));
  for (const [itemId, qty] of items) {
    const held = state.inventory.find((entry) => entry.id === itemId)?.qty ?? 0;
    if (!runtime.pack.content.items?.[itemId] || held < qty || held - qty < equippedUnits(state, itemId))
      errors.push(
        ruleCard(
          held < qty ? 'insufficient-qty' : 'item-equipped',
          itemId,
          'inventory',
          'Cannot settle item spend from this inventory.',
        ),
      );
  }
  for (const [pool, amount] of pools) {
    const held = state.pools[pool];
    if (held === undefined || held < amount)
      errors.push(
        ruleCard(
          held === undefined ? 'unknown-pool' : 'insufficient-points',
          pool,
          `pools.${pool}`,
          'Cannot settle pool spend from this balance.',
        ),
      );
  }
  for (const { level, index } of casts) {
    const spellId = combatant.bindings?.[level]?.[index];
    if (spellId == null || state.slots[level]?.[index] !== spellId)
      errors.push(
        ruleCard(
          combatant.bindings === undefined ? 'slot-unmapped' : 'slot-mismatch',
          combatant.id,
          `slots.${level}[${index}]`,
          'Cast does not match its original binding.',
        ),
      );
  }
  if (errors.length) throw new RuntimeRuleError(errors);
  for (const [itemId, qty] of items) {
    dropItem(runtime, state, itemId, qty);
    runtime.events.emit({
      type: 'item:settled',
      actor: state.id,
      payload: { combatantId: combatant.id, itemId, qty },
      why: { rule: `content.items.${itemId}`, rolls: [] },
    });
  }
  for (const [pool, amount] of pools) {
    state.pools[pool] = state.pools[pool]! - amount;
    runtime.events.emit({
      type: 'pool:settled',
      actor: state.id,
      payload: { combatantId: combatant.id, pool, amount },
      why: { rule: `pools.${pool}`, rolls: [] },
    });
  }
  for (const { level, index } of casts) {
    const spellId = state.slots[level]![index]!;
    state.slots[level]![index] = null;
    runtime.events.emit({
      type: 'slot:settled',
      actor: state.id,
      payload: { combatantId: combatant.id, slotLevel: level, slotIndex: index, spellId },
      why: { rule: 'content.spells', rolls: [] },
    });
  }
}

/** Stage the complete party transaction. Neither saved members nor raw fight spend is mutated. */
export function settleEncounter(
  pack: Pack,
  saved: PlaySessionSnapshot,
  result: PlaySettlementReceipt['result'],
  revision: number,
): { members: PlayMembers; receipt: PlaySettlementReceipt; events: readonly RuntimeEvent[] } {
  const { runtime, fight } = hydrateFight(pack, saved);
  const characters = saved.encounter.entryMembers.map((member) =>
    restoreCharacter(runtime, member.character),
  );
  const ids = new Map(
    characters.map((character, i) => [character.state.id, `m:${saved.encounter.entryMembers[i]!.memberId}`]),
  );
  const events: RuntimeEvent[] = [];
  runtime.events.setClock({ round: fight.state.round, turn: fight.state.turn });
  runtime.events.on((event) =>
    events.push({
      ...event,
      ...(event.actor ? { actor: ids.get(event.actor) ?? event.actor } : {}),
      ...(event.target ? { target: ids.get(event.target) ?? event.target } : {}),
    }),
  );
  const members = saved.encounter.entryMembers.map((member, i) => {
    const character = characters[i]!,
      id = `m:${member.memberId}`,
      combatant = fight.state.combatants[id]!;
    if (result === 'abandoned') settleActive(runtime, character, combatant);
    else {
      settleItemUses(runtime, character, fight, id);
      settleSpellCasts(runtime, character, fight, id);
    }
    character.state.hp.current = combatant.hp.current;
    character.state.conditions = combatant.conditions.map((condition) => ({ ...condition }));
    const { hp, conditions, inventory, pools, slots } = serializeCharacter(runtime, character.state).state;
    return {
      ...member,
      character: {
        ...member.character,
        state: { ...member.character.state, hp, conditions, inventory, pools, slots },
      },
    };
  });
  const encounterId = saved.encounter.encounterId;
  const receipt: PlaySettlementReceipt = {
    receiptId: JSON.stringify([saved.sessionId, encounterId, 'settlement']),
    sessionId: saved.sessionId,
    encounterId,
    encounterIndex: saved.encounterIndex,
    revision,
    result,
    memberIds: members.map((member) => member.memberId),
    sourceHash: packContentHash({ pack: saved.pack, encounter: saved.encounter }),
    beforeMembersHash: packContentHash(saved.encounter.entryMembers),
    afterMembersHash: packContentHash(members),
  };
  return { members, receipt, events };
}
