/**
 * Pure combatant facts (M03): down and defeat, a combatant's profile view,
 * pack-declared reach and rule paths, the declare-time validity vars, the
 * economy balances, and the mutation a resolved effect lands on a combatant.
 * No value imports — every other combat file may depend on it.
 */
import type { Runtime } from '../runtime';
import type { EconomyBalances } from './action-economy';
import type { CombatantProfile, MutationRequest, Side } from './resolve';
import type { CombatantState } from './types';

/** A combatant at hp ≤ 0 is down: it takes no turns and is offered no triggers. */
export function isDowned(combatant: CombatantState): boolean {
  return combatant.hp.current <= 0;
}

/** The side whose every combatant is down, if any (a side with no combatants never counts as defeated). */
export function defeatedSide(combatants: Readonly<Record<string, CombatantState>>): Side | undefined {
  for (const side of ['allies', 'enemies'] as const) {
    const members = Object.values(combatants).filter((combatant) => combatant.side === side);
    if (members.length > 0 && members.every(isDowned)) return side;
  }
  return undefined;
}

/** The combatant `feats` field from a profile: present only when non-empty (DD-S12). */
export function combatantFeats(profile: CombatantProfile): { feats?: readonly string[] } {
  return profile.feats !== undefined && profile.feats.length > 0 ? { feats: [...profile.feats] } : {};
}

/** A plain-JSON copy of slot bindings (FR-14: state never aliases host objects). */
export function copyBindings(
  bindings: Readonly<Record<string, readonly (string | null)[]>>,
): Record<string, (string | null)[]> {
  const copy: Record<string, (string | null)[]> = {};
  for (const [level, slots] of Object.entries(bindings)) copy[level] = [...slots];
  return copy;
}

export function profileOf(state: CombatantState): CombatantProfile {
  return {
    id: state.id,
    abilities: state.abilities,
    saves: state.saves,
    level: state.level,
    hp: state.hp.current,
    maxHp: state.maxHp,
    ac: state.ac,
    initiativeBonus: state.initiativeBonus,
    ...(state.speed !== undefined ? { speed: state.speed } : {}),
    actions: state.actions,
    attackTable: state.attackTable,
    attackBonus: state.attackBonus,
  };
}

/** The actor's pack-declared reach: its override key, else the model's default (spatial.html). */
export function reachOf(runtime: Runtime, id: string): number | undefined {
  const reach = runtime.pack.spatial?.reach;
  if (reach === undefined) return undefined;
  return reach[id] ?? reach.default;
}

/** The pack path every `why.rule` of a declare names: `content.spells.<id>` for a spell, else `actions.<id>`. */
export function ruleBaseOf(runtime: Runtime, actionId: string): string {
  return runtime.pack.actions[actionId] === undefined && runtime.pack.content.spells?.[actionId] !== undefined
    ? `content.spells.${actionId}`
    : `actions.${actionId}`;
}

/** The declare-time validity context: abilities ∪ saves ∪ level (pack v1.1 names, FR-3). */
export function validityVars(actor: CombatantState): Readonly<Record<string, number>> {
  return { ...actor.abilities, ...actor.saves, level: actor.level };
}

export function balancesOf(actor: CombatantState): EconomyBalances {
  return { pools: actor.pools, boundSlots: actor.boundSlots };
}

export function applyMutation(runtime: Runtime, target: CombatantState, request: MutationRequest): void {
  if (request.kind === 'damage' && request.amount !== undefined) {
    // CA-EG4 (R-2): a heal is a negative amount — never above maxHp, never
    // lowering hp already above it. Damage keeps today's unfloored semantics.
    const current = target.hp.current;
    target.hp.current =
      request.amount >= 0
        ? current - request.amount
        : current >= target.maxHp
          ? current
          : Math.min(target.maxHp, current - request.amount);
  } else if (request.kind === 'condition' && request.conditionId !== undefined) {
    const def = runtime.pack.content.conditions?.[request.conditionId];
    target.conditions.push({
      conditionId: request.conditionId,
      duration: request.duration ?? def?.duration ?? 1,
    });
  }
}
