/**
 * The declare gates and spend helpers (M03): restriction, target resolution,
 * reach, `at`, range and self-target refusals, the vancian slot pick, the
 * non-slot spend and the `spell:cast` payload. Each gate returns a
 * `DeclareRejection` (or nothing) and changes nothing; `Combat.declare`,
 * `Combat.use` and reactive resolution call them in their fixed order.
 */
import type { ActionCost, ActionDef } from '../../schema/artifacts';
import type { Runtime } from '../runtime';
import { declaredTags, matchesRestriction } from '../conditions';
import { checkReach, type Position } from './spatial';
import { reachOf } from './combatants';
import type { CastSlot, CombatantState, CombatState, DeclareRejection } from './types';

/**
 * The restricts gate (v1.1 matcher, `conditions.ts`): the first active
 * condition pattern, in condition order, matching one of the declared tags
 * blocks the declare. A spell is an action (FR-9): in combat either pattern
 * kind blocks it (DD-S10); an action matches `actions.tagged:` only.
 */
export function restrictionRejection(
  runtime: Runtime,
  actor: CombatantState,
  def: ActionDef,
  kind: 'action' | 'spell' = 'action',
): DeclareRejection | undefined {
  const tags = def.tags ?? [];
  if (tags.length === 0 || actor.conditions.length === 0) return undefined;
  const declared = declaredTags(runtime);
  for (const active of actor.conditions) {
    for (const pattern of runtime.pack.content.conditions?.[active.conditionId]?.restricts ?? []) {
      const hit =
        matchesRestriction(pattern, 'action', tags, declared) ||
        (kind === 'spell' && matchesRestriction(pattern, 'spell', tags, declared));
      if (!hit) continue;
      const tag = pattern.slice(pattern.indexOf(':') + 1);
      return {
        kind: 'restricted',
        rule: 'E-REF-01',
        resource: tag,
        message: `action "${tags.join(',')}" carries tag "${tag}", which an active condition restricts (v1.1 restricts matcher).`,
      };
    }
  }
  return undefined;
}

/**
 * The declared target, else the only opponent. An action targets opponents
 * only; a spell (`anyCombatant`) may name any combatant in the fight — either
 * side, the caster included (DD-S8).
 */
export function resolveTarget(
  state: CombatState,
  actor: CombatantState,
  targetId: string | undefined,
  anyCombatant = false,
): { combatant: CombatantState } | { rejection: DeclareRejection } {
  const opponents = state.order.filter((id) => state.combatants[id]!.side !== actor.side);
  if (opponents.length === 0) {
    return { combatant: actor };
  }
  const chosen = targetId ?? (opponents.length === 1 ? opponents[0]! : undefined);
  if (chosen === undefined) {
    return {
      rejection: {
        kind: 'no-target',
        rule: 'E-REF-01',
        resource: '',
        message: 'action needs a target — several opponents remain and none was declared.',
      },
    };
  }
  const target = state.combatants[chosen];
  if (target === undefined) {
    return {
      rejection: {
        kind: 'unknown-target',
        rule: 'E-REF-01',
        resource: chosen,
        message: `target "${chosen}" is not in this fight.`,
      },
    };
  }
  if (target.side === actor.side && !anyCombatant) {
    return {
      rejection: {
        kind: 'invalid-target',
        rule: 'E-REF-01',
        resource: chosen,
        message: `target "${chosen}" is not an opponent.`,
      },
    };
  }
  return { combatant: target };
}

/**
 * The one spatial declare-gate (CAP-G2): a spatial pack's reach gate runs
 * after the target resolves and before any cost is spent — shared by
 * declare() and reactive resolution (triggers ride the same pipeline).
 * Theater-of-mind packs never reject: checkReach is a no-op there.
 */
export function spatialGate(
  runtime: Runtime,
  actor: CombatantState,
  target: CombatantState,
): DeclareRejection | undefined {
  return checkReach(
    runtime.spatial,
    { position: actor.position, reach: reachOf(runtime, actor.id) },
    { id: target.id, position: target.position },
    runtime.pack.spatial?.reach.default ?? 1,
  );
}

/**
 * Why an `at` declare is refused (DD-S8, CA-S9): `at` with a `targetId`; `at`
 * on an action; `at` on a spell that is not a burst (absent targeting =
 * single); `at` on a burst spell whose parse-once root is not
 * `target(burst-…)`. Each is `invalid-target`, nothing changes.
 */
export function atRefusal(
  runtime: Runtime,
  actionId: string,
  targetId: string | undefined,
): DeclareRejection | undefined {
  const refuse = (resource: string, message: string): DeclareRejection => ({
    kind: 'invalid-target',
    rule: 'E-REF-01',
    resource,
    message,
  });
  if (targetId !== undefined) {
    return refuse(targetId, `declare "${actionId}" with either targetId or at, not both.`);
  }
  const spell = runtime.pack.content.spells?.[actionId];
  if (runtime.pack.actions[actionId] !== undefined || spell === undefined) {
    return refuse(
      actionId,
      `action "${actionId}" cannot be centered on a cell — only a burst spell takes at.`,
    );
  }
  if (spell.targeting?.shape !== 'burst') {
    return refuse(
      actionId,
      `spell "${actionId}" is not a burst (shape ${spell.targeting?.shape ?? 'single'}) — only a burst spell takes at.`,
    );
  }
  const root = runtime.index.spellEffects[actionId];
  const shape = root?.kind === 'call' && root.text === 'target' ? root.args?.[0] : undefined;
  if (shape?.kind !== 'name' || !(shape.text ?? '').startsWith('burst-')) {
    return refuse(
      actionId,
      `spell "${actionId}" cannot be centered on a cell — its effect root is not target(burst-…).`,
    );
  }
  return undefined;
}

/**
 * The range gate (CA-S9), where an action passes the reach gate: the
 * distance from the caster to the center — the target's position or the
 * `at` cell — must not exceed the spell's `targeting.range`, else the
 * caster's effective reach `max(reach, spatial.reach.default)` (the
 * `canReach` value, so absent-range packs behave as under the reach gate).
 * Theater-of-mind packs never consult range.
 */
export function rangeGate(
  runtime: Runtime,
  actor: CombatantState,
  spellId: string,
  declared: number | undefined,
  aim: CombatantState | Position,
): DeclareRejection | undefined {
  const geometry = runtime.spatial;
  if (!geometry.enabled) return undefined;
  const isCell = !('id' in aim);
  const center = isCell ? aim : aim.position;
  const resource = isCell ? `${aim.x},${aim.y}` : aim.id;
  if (actor.position === undefined || center === undefined) {
    return {
      kind: 'spatial',
      rule: 'E-SPAT-01',
      resource,
      message: `this pack declares a spatial model, but combatant positions are missing (from: ${actor.position === undefined ? 'absent' : 'set'}, target ${resource}: ${center === undefined ? 'absent' : 'set'}).`,
    };
  }
  const floor = runtime.pack.spatial?.reach.default ?? 1;
  const range = declared ?? Math.max(reachOf(runtime, actor.id) ?? floor, floor);
  const distance = geometry.distance(actor.position, center);
  if (distance <= range) return undefined;
  return {
    kind: 'out-of-range',
    rule: 'E-SPAT-01',
    resource,
    message: `spell "${spellId}" has range ${range}; ${isCell ? `(${resource})` : resource} is ${distance} away.`,
  };
}

/** A self action names no target but its actor (DD-A2): any other `targetId` is `invalid-target`. */
export function selfTargetRefusal(
  actionId: string,
  actorId: string,
  targetId: string | undefined,
): DeclareRejection | undefined {
  if (targetId === undefined || targetId === actorId) return undefined;
  return {
    kind: 'invalid-target',
    rule: 'E-REF-01',
    resource: targetId,
    message: `"${actionId}" is a self action — it targets its actor "${actorId}" only (DD-A2).`,
  };
}

/** A self action (v1.7, DD-A2): an action whose parse-once effect root is `target(self, …)`. Spells are never self actions. */
export function isSelfAction(runtime: Runtime, actionId: string): boolean {
  const ast = runtime.index.actionEffects[actionId];
  const shape = ast?.kind === 'call' && ast.text === 'target' ? ast.args?.[0] : undefined;
  return shape?.kind === 'name' && shape.text === 'self';
}

/**
 * DD-S18 — the slot index a vancian cost consumes at `level`: for a spell,
 * the lowest uncast index bound to it (count-only combatants have none);
 * for an action, the lowest uncast non-null binding, or — without bindings —
 * the lowest uncast index below the fight-start count.
 */
export function pickSlot(actor: CombatantState, level: string, spellId?: string): number | undefined {
  const cast = actor.slotsCast[level] ?? [];
  const bindings = actor.bindings === undefined ? undefined : (actor.bindings[level] ?? []);
  if (bindings !== undefined) {
    const index = bindings.findIndex(
      (binding, i) => !cast.includes(i) && (spellId === undefined ? binding !== null : binding === spellId),
    );
    return index === -1 ? undefined : index;
  }
  if (spellId !== undefined) return undefined;
  const start = (actor.boundSlots[level] ?? 0) + cast.length;
  for (let i = 0; i < start; i += 1) if (!cast.includes(i)) return i;
  return undefined;
}

/**
 * Spend the non-slot costs and record them (CA-S2): pool points into
 * `poolsSpent`, a vancian slot index into `slotsCast`; the live `pools` and
 * `boundSlots` decrement as before. A spell passes its pre-chosen slot; a
 * vancian action's slot is chosen here (DD-S18). Returns the slot consumed.
 */
export function applyNonSlotCosts(
  actor: CombatantState,
  cost: ActionCost,
  chosen?: CastSlot,
): CastSlot | undefined {
  if (cost.points !== undefined) {
    const { pool, amount } = cost.points;
    actor.pools = { ...actor.pools, [pool]: (actor.pools[pool] ?? 0) - amount };
    actor.poolsSpent = { ...actor.poolsSpent, [pool]: (actor.poolsSpent[pool] ?? 0) + amount };
  }
  if (cost.vancian === undefined) return undefined;
  const level = chosen?.level ?? String(cost.vancian);
  const index = chosen?.index ?? pickSlot(actor, level);
  actor.boundSlots = { ...actor.boundSlots, [level]: (actor.boundSlots[level] ?? 0) - 1 };
  if (index === undefined) return undefined;
  actor.slotsCast = { ...actor.slotsCast, [level]: [...(actor.slotsCast[level] ?? []), index] };
  return { level, index };
}

/** The `spell:cast` payload (DD-S17): the spell, its aim, and what the cast spent. */
export function castPayload(
  spellId: string,
  cost: ActionCost,
  aim: { readonly targetId: string } | { readonly at: Position },
  slot: CastSlot | undefined,
): Record<string, unknown> {
  return {
    spellId,
    ...aim,
    cost: cost.vancian !== undefined ? 'vancian' : cost.points !== undefined ? 'points' : 'none',
    ...(slot !== undefined ? { slotLevel: slot.level, slotIndex: slot.index } : {}),
    ...(cost.points !== undefined ? { pool: cost.points.pool, amount: cost.points.amount } : {}),
  };
}
