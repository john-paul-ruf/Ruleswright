import type { PlayMembers, PlayJournalEntry, PlayEventSubject } from '../../schema/play-session';
import { packContentHash } from '../../schema/version';
import { restoreCharacter, serializeCharacter } from '../snapshots/character';
import { detached, same } from '../play/snapshot';
import { awardXp } from '../progression';
import type { Character } from '../character';
import type { Pack } from '../../schema/pack';
import type { AdventureDefinition } from '../../schema/adventure';
import type { PlayJsonValue } from '../../schema/play-session';
import { Rng } from '../../core/rng';
import { Runtime } from '../runtime';
import { grantItem, rollLoot } from '../inventory';
import { RuntimeRuleError, ruleCard } from '../errors';
import { isRecord } from '../snapshots/envelope';
import type { AdventureSnapshot, RewardRoll, RewardState, RewardReceipt } from './types';

export function normalizeLoot(pack: Pack, value: unknown): RewardRoll['result'] {
  if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(pack.content.items ?? {}, value))
    return { kind: 'item', itemId: value, qty: 1 };
  if (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    Object.prototype.hasOwnProperty.call(pack.content.items ?? {}, value['id']) &&
    Number.isSafeInteger(value['qty']) &&
    (value['qty'] as number) > 0
  )
    return { kind: 'item', itemId: value['id'], qty: value['qty'] as number };
  return { kind: 'no-item' };
}
export function stageRewards(
  pack: Pack,
  definition: AdventureDefinition,
  saved: AdventureSnapshot,
): AdventureSnapshot {
  const node = definition.nodes.find((n) => n.id === saved.nodeId)!,
    rng = new Rng(saved.rng.rewards),
    runtime = new Runtime(pack);
  const rewards: RewardState[] = [...saved.rewards];
  for (const rewardId of node.rewardIds) {
    const reward = definition.rewards.find((r) => r.id === rewardId)!;
    let roll: RewardRoll | null = null;
    if (reward.loot) {
      const rngBefore = rng.getState(),
        outcome = rollLoot(runtime, reward.loot.tableId, rng);
      if (!outcome.ok)
        throw new RuntimeRuleError([
          ruleCard(
            'table-roll-failed',
            reward.loot.tableId,
            outcome.failure.jsonPath,
            outcome.failure.message,
          ),
        ]);
      roll = {
        tableId: reward.loot.tableId,
        value: outcome.value as PlayJsonValue,
        rngBefore,
        rngAfter: rng.getState(),
        result: normalizeLoot(pack, outcome.value),
      };
    }
    rewards.push({
      claimId: JSON.stringify([saved.adventureId, node.id, rewardId]),
      adventureId: saved.adventureId,
      nodeId: node.id,
      rewardId,
      eligibleMemberIds: saved.members.map((m) => m.memberId),
      xpPerMember: reward.xpPerMember,
      stagedRevision: saved.revision,
      roll,
      status: 'pending',
    });
  }
  return {
    ...saved,
    rewards,
    rng: { ...saved.rng, rewards: rng.getState() },
    phase: node.rewardIds.length ? 'reward-pending' : node.kind === 'success' ? 'completed' : 'exploration',
  };
}

/** Private runtime and event buffer: nothing escapes until the complete aggregate validates. */
export function writeMembers(
  pack: Pack,
  before: PlayMembers,
  write: (runtime: Runtime, character: Character, memberId: string) => void,
) {
  const runtime = new Runtime(pack),
    characters = before.map((m) => restoreCharacter(runtime, m.character));
  const names = new Map<string, PlayEventSubject>(
    characters.map((c, i) => [
      c.state.id,
      { id: `m:${before[i]!.memberId}`, memberId: before[i]!.memberId, name: c.state.name },
    ]),
  );
  const events: Pick<PlayJournalEntry, 'event' | 'subjects'>[] = [];
  runtime.events.on((original) => {
    const event = detached({
      ...original,
      ...(original.actor ? { actor: names.get(original.actor)?.id ?? original.actor } : {}),
      ...(original.target ? { target: names.get(original.target)?.id ?? original.target } : {}),
    }) as PlayJournalEntry['event'];
    const ids = new Set([original.actor, original.target]);
    events.push({ event, subjects: [...names].filter(([id]) => ids.has(id)).map(([, subject]) => subject) });
  });
  const members = before.map((member, i) => {
    const character = characters[i]!;
    const baseline = serializeCharacter(runtime, character.state).state;
    write(runtime, character, member.memberId);
    const updated = serializeCharacter(runtime, character.state);
    const changes = Object.fromEntries(
      Object.entries(updated.state).filter(
        ([key, value]) => !same(value, baseline[key as keyof typeof baseline]),
      ),
    );
    const state = { ...member.character.state, ...changes };
    return { ...member, character: { ...updated, state } };
  });
  return { members, events };
}
export function claimReward(
  pack: Pack,
  definition: AdventureDefinition,
  saved: AdventureSnapshot,
  claim: RewardState,
  recipientMemberId: string | null,
) {
  const grant = claim.roll?.result.kind === 'item' ? claim.roll.result : null;
  const staged = writeMembers(pack, saved.members, (runtime, character, memberId) => {
    if (claim.xpPerMember > 0) {
      const before = detached(character.state);
      awardXp(runtime, character.state, claim.xpPerMember);
      character.state.hp = before.hp;
      for (const [level, bindings] of Object.entries(before.slots))
        for (const [index, spell] of bindings.entries()) {
          if (spell === null) continue;
          const slots = character.state.slots[level];
          if (!slots || index >= slots.length)
            throw new RuntimeRuleError([
              ruleCard(
                'E-VANC-01',
                memberId,
                `slots.${level}[${index}]`,
                'Prepared binding does not fit the awarded progression.',
              ),
            ]);
          slots[index] = spell;
        }
      character.state.pools = before.pools;
      character.state.conditions = before.conditions;
      character.state.spells = before.spells;
      character.state.inventory = before.inventory;
      character.state.feats = before.feats;
      character.state.equipped = before.equipped;
    }
    if (grant && memberId === recipientMemberId) grantItem(runtime, character.state, grant.itemId, grant.qty);
  });
  const receipt: RewardReceipt = {
    receiptId: JSON.stringify([saved.adventureId, claim.claimId, 'reward']),
    adventureId: saved.adventureId,
    definitionHash: definition.contentHash,
    claimId: claim.claimId,
    nodeId: claim.nodeId,
    rewardId: claim.rewardId,
    revision: saved.revision,
    eligibleMemberIds: claim.eligibleMemberIds,
    recipientMemberId,
    xpPerMember: claim.xpPerMember,
    grants: grant ? [{ memberId: recipientMemberId!, itemId: grant.itemId, qty: grant.qty }] : [],
    beforeMembersHash: packContentHash(saved.members),
    afterMembersHash: packContentHash(staged.members),
  };
  const rewards = saved.rewards.map((r): RewardState =>
    r.claimId === claim.claimId ? { ...r, status: 'claimed', receipt } : r,
  );
  const phase = rewards.some((r) => r.status === 'pending' && r.nodeId === saved.nodeId)
    ? 'reward-pending'
    : saved.nodeId === definition.successNodeId
      ? 'completed'
      : 'exploration';
  return {
    ...staged,
    receipt,
    saved: { ...saved, members: staged.members, rewards, phase } as AdventureSnapshot,
  };
}
