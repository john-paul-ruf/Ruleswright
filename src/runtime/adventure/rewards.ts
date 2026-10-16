import type { Pack } from '../../schema/pack';
import type { AdventureDefinition } from '../../schema/adventure';
import type { PlayJsonValue } from '../../schema/play-session';
import { Rng } from '../../core/rng';
import { Runtime } from '../runtime';
import { rollLoot } from '../inventory';
import { RuntimeRuleError, ruleCard } from '../errors';
import { isRecord } from '../snapshots/envelope';
import type { AdventureSnapshot, RewardRoll, RewardState } from './types';
import { currentNode } from './choices';

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
  const node = currentNode(definition, saved),
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
