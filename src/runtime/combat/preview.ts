import type { ActionCost, ActionDef } from '../../schema/artifacts';
import { evalValidity, type FormulaAst } from '../../core/dsl/formula';
import type { Runtime } from '../runtime';
import { RuntimeRuleError, ruleCard } from '../errors';
import { balancesOf, validityVars } from './combatants';
import { checkCost } from './action-economy';
import {
  atRefusal,
  isSelfAction,
  pickSlot,
  rangeGate,
  resolveTarget,
  restrictionRejection,
  selfTargetRefusal,
  spatialGate,
} from './declare';
import { resolveShape } from './execute';
import type { FightCore } from './fight';
import { moveBudgetAst, movementGate } from './movement';
import type {
  CastSlot,
  CombatantState,
  DeclareOptions,
  DeclareRejection,
  PendingTrigger,
  UseOptions,
} from './types';

export function assertDeterministicValidity(runtime: Runtime, actionIds: readonly string[]): void {
  const hasDice = (ast: FormulaAst | undefined): boolean =>
    ast !== undefined &&
    (ast.kind === 'dice' ||
      hasDice(ast.left) ||
      hasDice(ast.right) ||
      hasDice(ast.operand) ||
      (ast.args ?? []).some(hasDice));
  const errors = actionIds
    .filter((id) => hasDice(runtime.index.validAsts[id]))
    .map((id) =>
      ruleCard('E-REF-01', id, `actions.${id}.valid`, 'Solo play requires deterministic action validity.'),
    );
  if (errors.length) throw new RuntimeRuleError(errors);
}

export function previewSlots(
  core: FightCore,
  actor: CombatantState,
  cost: ActionCost,
): DeclareRejection | undefined {
  for (const [name, amount] of Object.entries(cost.slots ?? {})) {
    const remaining = actor.slots.remaining[name];
    if (core.grants.slots[name] === undefined || remaining === undefined) {
      const names = Object.keys(core.grants.slots).sort();
      const vocabulary = names.length ? `[${names.join(', ')}]` : '(empty — the pack declares no slot costs)';
      return {
        kind: 'slot-ungranted',
        resource: name,
        rule: 'E-ECON-01',
        message: `action costs slot "${name}", which the grant table never declared — the pack's slot vocabulary is ${vocabulary}.`,
      };
    }
    if (remaining < amount)
      return {
        kind: 'slot-exhausted',
        resource: name,
        rule: 'E-ECON-01',
        message: `slot "${name}" is spent: ${remaining} of ${amount} needed remain this turn.`,
      };
  }
  return undefined;
}

export function previewDeclaration(
  core: FightCore,
  actionId: string,
  options: DeclareOptions = {},
  manual?: { validity: FormulaAst | undefined },
) {
  if (core.state.phase === 'combat-over') throw new Error('combat is over');
  const actorId = core.state.active;
  const actor = core.state.combatants[actorId]!;
  const pack = core.runtime.pack;
  // A spell is an action plus metadata (FR-9, CA-S1): ids are unique across
  // actions and spells (E-DUP-01), so at most one lookup hits.
  const spell = pack.actions[actionId] === undefined ? pack.content.spells?.[actionId] : undefined;
  const def: ActionDef | undefined =
    spell === undefined
      ? pack.actions[actionId]
      : {
          cost: spell.cost,
          effect: spell.effect,
          ...(spell.tags !== undefined ? { tags: spell.tags } : {}),
        };
  if (def === undefined) {
    return {
      rejection: {
        kind: 'no-action',
        rule: 'E-REF-01',
        resource: actionId,
        message: `action "${actionId}" is not declared in the pack.`,
      } as DeclareRejection,
    };
  }
  if (spell === undefined ? !actor.actions.includes(actionId) : !actor.spells.includes(actionId)) {
    return {
      rejection: {
        kind: 'no-action',
        rule: 'E-REF-01',
        resource: actionId,
        message:
          spell === undefined
            ? `combatant "${actorId}" does not have action "${actionId}".`
            : `combatant "${actorId}" does not know spell "${actionId}".`,
      } as DeclareRejection,
    };
  }
  const restriction = restrictionRejection(
    core.runtime,
    actor,
    def,
    spell === undefined ? 'action' : 'spell',
  );
  if (restriction !== undefined) {
    return { rejection: restriction as DeclareRejection };
  }
  // DD-S8: `at` centers a burst spell on a cell (spatial packs only; theater packs drop it).
  // An `at` cast binds the caster as the nominal executor target — no statement reads it.
  const at = core.runtime.spatial.enabled ? options.at : undefined;
  if (at !== undefined) {
    const refusal = atRefusal(core.runtime, actionId, options.targetId);
    if (refusal !== undefined) return { rejection: refusal as DeclareRejection };
  }
  // A move action targets its actor: no opponent resolution, no reach gate (DD-M9).
  // Spells never move (a spell `move` is E-FORM-02), so the budget is action-only.
  const budgetAst = moveBudgetAst(core.runtime, actionId);
  // A self action targets its actor too (v1.7, DD-A2): no opponent resolution, no reach gate.
  const selfAction = spell === undefined && isSelfAction(core.runtime, actionId);
  if (selfAction) {
    const refusal = selfTargetRefusal(actionId, actorId, options.targetId);
    if (refusal !== undefined) return { rejection: refusal as DeclareRejection };
  }
  const target =
    budgetAst !== undefined || at !== undefined || selfAction
      ? { combatant: actor }
      : resolveTarget(core.state, actor, options.targetId, spell !== undefined);
  if ('rejection' in target) {
    return { rejection: target.rejection as DeclareRejection };
  }
  // The validity gate speaks before the spatial gate (validity-into-grid.html:
  // the hasTarget failure is what the declarative gate reports; reach is
  // consulted after the action's own clause passes). Both run before cost.
  const validity = manual === undefined ? core.runtime.index.validAsts[actionId] : manual.validity;
  if (validity !== undefined) {
    if (manual === undefined) assertDeterministicValidity(core.runtime, [actionId]);
    const ok = evalValidity(
      validity,
      validityVars(actor),
      (shape) => resolveShape(core, shape, actor, target.combatant.position, target.combatant).length > 0,
    );
    if (!ok) {
      return {
        rejection: {
          kind: 'valid',
          rule: 'E-REF-01',
          resource: actionId,
          message: `action "${actionId}" is not valid right now — its valid clause failed (hasTarget: no combatant resolves for the declared shape).`,
        } as DeclareRejection,
      };
    }
  }
  let move: ((budget: number) => void) | undefined;
  if (budgetAst !== undefined) {
    const gate = movementGate(core, actor, actionId, budgetAst, options.to);
    if ('rejection' in gate) {
      return { rejection: gate.rejection as DeclareRejection };
    }
    move = gate.move;
  } else if (selfAction) {
    // DD-A2: a self action passes no reach gate.
  } else if (spell !== undefined) {
    // CA-S9: a spell passes the range gate where an action passes the reach gate.
    const range = rangeGate(core.runtime, actor, actionId, spell.targeting?.range, at ?? target.combatant);
    if (range !== undefined) {
      return { rejection: range as DeclareRejection };
    }
  } else {
    const spatial = spatialGate(core.runtime, actor, target.combatant);
    if (spatial !== undefined) {
      return { rejection: spatial as DeclareRejection };
    }
  }
  // DD-S6: equipped armor blocks a vancian spell exactly as outside combat.
  if (spell !== undefined && def.cost.vancian !== undefined && actor.castBlockedBy !== undefined) {
    return {
      rejection: {
        kind: 'armor-not-castable',
        rule: 'E-REF-01',
        resource: actor.castBlockedBy,
        message: `"${actor.castBlockedBy}" is equipped armor of a kind none of the caster's classes lists in armorCasting — no slot cast (FR-9).`,
      } as DeclareRejection,
    };
  }
  const costRejection = checkCost(def.cost, core.grants, balancesOf(actor));
  if (costRejection !== undefined) {
    return { rejection: costRejection as DeclareRejection };
  }
  // DD-S18: a vancian spell consumes a slot bound to it — chosen before any spend, recorded after.
  let slot: CastSlot | undefined;
  if (spell !== undefined && def.cost.vancian !== undefined) {
    const level = String(spell.magic.level);
    const index = pickSlot(actor, level, actionId);
    if (index === undefined) {
      return {
        rejection: {
          kind: 'vancian',
          rule: 'E-VANC-01',
          resource: level,
          message: `no uncast level-${level} slot is bound to "${actionId}"`,
        } as DeclareRejection,
      };
    }
    slot = { level, index };
  }
  const slots = previewSlots(core, actor, def.cost);
  if (slots) return { rejection: slots as DeclareRejection };
  return { actorId, actor, def, spell, at, target: target.combatant, move, slot };
}

export function previewUse(core: FightCore, itemId: string, options: UseOptions = {}) {
  if (core.state.phase === 'combat-over') throw new Error('combat is over');
  const actorId = core.state.active;
  const actor = core.state.combatants[actorId]!;
  const item = core.runtime.pack.content.items?.[itemId];
  if (item === undefined) {
    return {
      rejection: {
        kind: 'unknown-item',
        rule: 'E-REF-01',
        resource: itemId,
        message: `item "${itemId}" is not declared in content.items.`,
      } as DeclareRejection,
    };
  }
  const ast = core.runtime.index.itemEffects[itemId];
  if (ast === undefined || item.use === undefined) {
    return {
      rejection: {
        kind: 'not-consumable',
        rule: 'E-REF-01',
        resource: itemId,
        message: `item "${itemId}" declares no use effect — it cannot be used.`,
      } as DeclareRejection,
    };
  }
  // F-E15: an item-only synthetic action; spells are declared through declare() (v1.6), never use().
  const def: ActionDef = { cost: {}, effect: item.use };
  const restriction = restrictionRejection(core.runtime, actor, def);
  if (restriction !== undefined) {
    return { rejection: restriction as DeclareRejection };
  }
  const targetId = options.target ?? actorId;
  const target = core.state.combatants[targetId];
  if (target === undefined) {
    return {
      rejection: {
        kind: 'unknown-target',
        rule: 'E-REF-01',
        resource: targetId,
        message: `target "${targetId}" is not in this fight.`,
      } as DeclareRejection,
    };
  }
  const used = actor.itemsUsed[itemId] ?? 0;
  const remaining = (actor.itemBalances[itemId] ?? 0) - used;
  if (remaining <= 0) {
    return {
      rejection: {
        kind: 'no-charges',
        rule: 'E-REF-01',
        resource: itemId,
        message: `combatant "${actorId}" has no "${itemId}" charges left (${used} of ${actor.itemBalances[itemId] ?? 0} spent).`,
      } as DeclareRejection,
    };
  }

  return { actorId, actor, targetId, target, def, ast, used, remaining };
}

export function previewReaction(core: FightCore, offer: PendingTrigger, targetId?: string) {
  const reactor = core.state.combatants[offer.actorId]!;
  const def = core.runtime.pack.actions[offer.actionId]!;
  const restriction = restrictionRejection(core.runtime, reactor, def);
  if (restriction) return { rejection: restriction };
  const self = isSelfAction(core.runtime, offer.actionId);
  if (self) {
    const rejection = selfTargetRefusal(offer.actionId, reactor.id, targetId);
    if (rejection) return { rejection };
  }
  const target = self ? { combatant: reactor } : resolveTarget(core.state, reactor, targetId);
  if ('rejection' in target) return { rejection: target.rejection };
  if (!self) {
    const rejection = spatialGate(core.runtime, reactor, target.combatant);
    if (rejection) return { rejection };
  }
  const rejection = previewReactionCost(core, reactor, def);
  if (rejection) return { rejection };
  return { reactor, def, target: target.combatant };
}

export function previewReactionCost(core: FightCore, reactor: CombatantState, def: ActionDef) {
  return checkCost(def.cost, core.grants, balancesOf(reactor)) ?? previewSlots(core, reactor, def.cost);
}

export function previewFeat(core: FightCore, offer: PendingTrigger, targetId?: string) {
  const holder = core.state.combatants[offer.actorId]!;
  if (targetId !== undefined && targetId !== holder.id) {
    return {
      rejection: {
        kind: 'invalid-target',
        rule: 'E-REF-01',
        resource: targetId,
        message: `feat "${offer.actionId}" acts on its holder "${holder.id}" only (DD-S12).`,
      } as DeclareRejection,
    };
  }
  return { holder };
}
