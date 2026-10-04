/**
 * Effect execution (M03): the one shape resolver, a bound effect run through
 * the executor for one target (mutations land as `damage:applied` /
 * `condition:applied`, attack verdicts as `attack:rolled`), a declared or
 * taken action's resolution (`spell:cast` → effect → `action:resolved`),
 * and the end rule. Every function runs over the fight's `FightCore`.
 */
import type { ActionDef } from '../../schema/artifacts';
import type { Runtime } from '../runtime';
import type { RuntimeEvent } from '../events';
import { displayRoll } from '../display-roll';
import { executeAgainst, type BoundAction } from './resolve';
import type { Position } from './spatial';
import { applyMutation, defeatedSide, profileOf, reachOf, ruleBaseOf } from './combatants';
import type { FightCore } from './fight';
import type { CombatantState } from './types';

/**
 * The one shape resolver (CA-G4): the executor's resolveTargets, the
 * validity gate's hasTarget, and target() statements all resolve shapes
 * here — once, combat-side. A burst resolves around `center`: the bound
 * target's position, or an `at` cell (DD-S8). Theater-of-mind: every shape
 * answers with the bound targets (the no-op discipline — spatial.html's
 * absent-column).
 */
export function resolveShape(
  core: FightCore,
  shape: string,
  actor: CombatantState,
  center: Position | undefined,
  bound: CombatantState,
): readonly string[] {
  if (shape === 'self') return [actor.id]; // DD-A1: every pack, theater-of-mind included
  const geometry = core.runtime.spatial;
  if (!geometry.enabled) return [bound.id];
  if (shape === 'adjacent') {
    return core.state.order.filter((id) => {
      const other = core.state.combatants[id]!;
      return (
        other.side !== actor.side &&
        other.position !== undefined &&
        actor.position !== undefined &&
        reachOf(core.runtime, actor.id) !== undefined &&
        geometry.canReach(actor.position, other.position, reachOf(core.runtime, actor.id)!)
      );
    });
  }
  if (shape.startsWith('burst-')) {
    const radius = Number(shape.slice('burst-'.length));
    if (center === undefined) return [];
    const candidates: (readonly [string, Position])[] = [];
    for (const id of core.state.order) {
      const combatant = core.state.combatants[id]!;
      if (combatant.hp.current <= 0 || combatant.position === undefined) continue;
      candidates.push([id, combatant.position]);
    }
    return geometry.inBurst(center, radius, candidates);
  }
  return [];
}

/** Flatten nested effect resolutions (sequence/target wrappers) for the attack-event loop. */
export function flattenResolutions(
  outcomes: readonly import('../../core/dsl/effect').EffectResolution[],
): readonly import('../../core/dsl/effect').EffectResolution[] {
  const flat: import('../../core/dsl/effect').EffectResolution[] = [];
  for (const outcome of outcomes) {
    flat.push(outcome);
    if (outcome.kind === 'sequence') flat.push(...flattenResolutions(outcome.steps));
    else if (outcome.kind === 'target') flat.push(...flattenResolutions(outcome.outcomes));
    else if (outcome.kind === 'save') {
      for (const perTarget of outcome.perTarget) flat.push(...flattenResolutions(perTarget.outcomes));
    }
  }
  return flat;
}

/**
 * Run a bound effect for one target through the executor: mutations land on
 * state as `damage:applied` / `condition:applied`, attack verdicts as
 * `attack:rolled`, every event provenanced by `rule`. Returns the events it
 * emitted; the rng state is saved afterwards.
 */
export function executeBound(
  core: FightCore,
  actor: CombatantState,
  boundAction: BoundAction,
  target: CombatantState,
  rule: string,
  move?: (budget: number) => void,
  at?: Position,
): RuntimeEvent[] {
  const emitted: RuntimeEvent[] = [];
  const sink = (event: RuntimeEvent) => {
    emitted.push(event);
  };
  core.runtime.events.on(sink);
  try {
    core.setClock();
    // The attack gate: the executor's damage callbacks only land when the
    // pending attack for this target hit. One action = one attack verdict.
    let attackLanded: boolean | undefined;
    const outcomes = executeAgainst(
      boundAction,
      { id: actor.id, side: actor.side, profile: profileOf(actor) },
      { id: target.id, side: target.side, profile: profileOf(target) },
      core.rng,
      (request) => {
        // CA-G4: burst scopes reach ids outside the primary target — apply
        // each mutation to the combatant the executor named, not the bound
        // target. The attack gate stays: one action = one attack verdict.
        const subject = core.state.combatants[request.targetId] ?? target;
        const isDamage = request.kind === 'damage';
        if (isDamage && attackLanded === false) return; // onHit anatomy: gated damage never applies
        const hpBefore = subject.hp.current; // captured before the (possibly clamped) mutation
        applyMutation(core.runtime, subject, request);
        core.runtime.events.emit({
          type: isDamage ? 'damage:applied' : 'condition:applied',
          actor: actor.id,
          target: request.targetId,
          payload: isDamage
            ? {
                amount: request.amount,
                type: request.damageType,
                hp: `${hpBefore}→${subject.hp.current}`,
              }
            : { conditionId: request.conditionId, duration: request.duration },
          why: { rule, rolls: request.rolls.map((roll) => displayRoll(roll)) },
        });
      },
      (shape) => resolveShape(core, shape, actor, at ?? target.position, target),
      move,
      (id) => {
        // DD-S19: every target a shape scope names saves and defends with its own values.
        const combatant = core.state.combatants[id];
        return combatant === undefined ? undefined : profileOf(combatant);
      },
    );
    // Attack outcomes are events too (attack:rolled) — one per target, with the verdict.
    // The executor nests statements in sequence/target/save wrappers; flatten first.
    for (const outcome of flattenResolutions(outcomes)) {
      if (outcome.kind === 'attack') {
        attackLanded = outcome.hit;
        core.runtime.events.emit({
          type: 'attack:rolled',
          actor: actor.id,
          target: outcome.targetId,
          payload: { actionId: boundAction.id, verdict: outcome.roll.verdict, total: outcome.roll.total },
          why: { rule: `${rule}.attackBonus`, rolls: [displayRoll(outcome.roll)] },
        });
      }
    }
  } finally {
    core.runtime.events.off(sink);
  }
  core.state = { ...core.state, rng: core.rng.getState() };
  return emitted;
}

export function resolveAction(
  core: FightCore,
  actor: CombatantState,
  actionId: string,
  def: ActionDef,
  target: CombatantState,
  {
    move,
    cast,
    at,
  }: {
    readonly move?: ((budget: number) => void) | undefined;
    /** A spell's `spell:cast` payload (DD-S17); absent for actions. */
    readonly cast?: Readonly<Record<string, unknown>> | undefined;
    /** An empty-cell burst's center (DD-S8): `action:resolved` carries it instead of `targetId`. */
    readonly at?: Position | undefined;
  },
): readonly RuntimeEvent[] {
  if (cast !== undefined) {
    // DD-S17: `spell:cast` precedes the effect's events, inside the declare's own collection.
    core.setClock();
    core.runtime.events.emit({
      type: 'spell:cast',
      actor: actor.id,
      ...(typeof cast['targetId'] === 'string' ? { target: cast['targetId'] } : {}),
      payload: cast,
      why: { rule: ruleBaseOf(core.runtime, actionId), rolls: [] },
    });
  }
  executeBound(
    core,
    actor,
    boundActionOf(core.runtime, actionId, def),
    target,
    ruleBaseOf(core.runtime, actionId),
    move,
    at,
  );
  core.state = { ...core.state, phase: 'resolved' };
  core.runtime.events.emit({
    type: 'action:resolved',
    actor: actor.id,
    payload: at !== undefined ? { actionId, at: { x: at.x, y: at.y } } : { actionId, targetId: target.id },
    why: { rule: `${ruleBaseOf(core.runtime, actionId)}`, rolls: [] },
  });
  endIfSideDefeated(core);
  return core.runtime.events.sinceRound(core.state.round);
}

/** A declared id's bound action: its parse-once AST from the action index, else the spell index (CA-S1). */
export function boundActionOf(runtime: Runtime, actionId: string, def: ActionDef): BoundAction {
  const ast = runtime.index.actionEffects[actionId] ?? runtime.index.spellEffects[actionId];
  if (ast === undefined) {
    throw new Error(`action "${actionId}" has no parse-once AST — Runtime load compiles every action (CA-2)`);
  }
  return { id: actionId, def, ast };
}

/**
 * The end rule (engine-universal, not pack data): once every combatant on one
 * side is at hp ≤ 0, the fight is over — open offers lapse and one
 * `combat:ended` event names the winning side.
 */
export function endIfSideDefeated(core: FightCore): void {
  const defeated = defeatedSide(core.state.combatants);
  if (defeated === undefined) return;
  core.state = { ...core.state, phase: 'combat-over' };
  core.pendingTriggers.length = 0;
  core.runtime.events.emit({
    type: 'combat:ended',
    payload: { winner: defeated === 'allies' ? 'enemies' : 'allies', defeated },
    why: { rule: 'combat.sideDefeated', rolls: [] },
  });
}
