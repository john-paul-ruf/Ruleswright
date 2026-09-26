/**
 * The generic slot/points action economy (FR-4, CA-4): the engine has no
 * built-in slot vocabulary — "main" is no more engine-known than "windup"
 * would be. Grants resolve from the v1.1 pack economy: `economy.turnSlots`
 * when the pack declares it (the pack is the authority on slot names), or the
 * documented engine default when absent — 1 of each slot name appearing in
 * any action or spell `cost.slots` in the pack, per turn.
 *
 * The ledger is a combat transient: plain-JSON counters keyed by slot name,
 * replenished at the start of the owner's turn (database.md §economy). It is
 * never character state and never enters a character snapshot; combat
 * snapshots (S06) read it from the combat state's per-combatant transients.
 *
 * Costs also carry the pack's non-slot economy: drain pools (FR-8) spend
 * points from a character pool, and vancian costs (FR-8) consume one bound
 * slot of the declared level — an empty slot cannot cast. Those balances live
 * in the owner's character state (S04's pools/bindings machinery); this
 * module validates against it and reports the violated resource, it does not
 * store it.
 */
import type { Pack } from '../../schema/pack';
import type { ActionCost } from '../../schema/artifacts';

/** Pack-declared or default-derived per-turn slot grants, by slot name. */
export interface SlotGrants {
  readonly slots: Readonly<Record<string, number>>;
  /** True when the grants came from a declared `economy.turnSlots` section. */
  readonly fromPackEconomy: boolean;
}

/**
 * Resolve the grant table the v1.1 way: declared `economy.turnSlots` wins
 * outright; absent, the documented default derives 1 of each slot name seen
 * in any action or spell cost, per turn (a pack with no slotted actions gets
 * an empty grant table — nothing can spend slots it never declared).
 */
export function resolveSlotGrants(pack: Pack): SlotGrants {
  const declared = pack.economy?.turnSlots;
  if (declared !== undefined) {
    return { slots: { ...declared }, fromPackEconomy: true };
  }
  const derived: Record<string, number> = {};
  for (const cost of collectCosts(pack)) {
    for (const name of Object.keys(cost.slots ?? {})) {
      derived[name] = 1;
    }
  }
  return { slots: derived, fromPackEconomy: false };
}

function collectCosts(pack: Pack): readonly ActionCost[] {
  const costs: ActionCost[] = [];
  for (const action of Object.values(pack.actions)) costs.push(action.cost);
  for (const spell of Object.values(pack.content.spells ?? {})) costs.push(spell.cost);
  return costs;
}

/** A cost this combatant cannot pay right now, with the violated resource named. */
export interface CostRejection {
  readonly kind: 'slot-ungranted' | 'slot-exhausted' | 'points' | 'vancian';
  /** E-ECON-01 for ungranted slot names; the other kinds are play-time economy rejections. */
  readonly rule: 'E-ECON-01' | 'E-POINTS-01' | 'E-VANC-01';
  /** The slot name, pool id, or spell level that failed. */
  readonly resource: string;
  readonly message: string;
}

/** A combatant's payable balances: current drain pools and vancian bindings (plain JSON, host-owned). */
export interface EconomyBalances {
  /** Pool id -> current points. */
  readonly pools?: Readonly<Record<string, number>>;
  /** Spell level -> remaining bound slots (each binding holds a memorized spell id; casting consumes one). */
  readonly boundSlots?: Readonly<Record<string, number>>;
}

/** Why an unaffordable action cannot fire: the exact resource and how much is missing. */
export interface CostClaim {
  kind: 'slot-ungranted' | 'slot-exhausted' | 'points' | 'vancian';
  /** E-ECON-01 for both slot failures; the other kinds name the play-time economy family. */
  rule: 'E-ECON-01' | 'E-POINTS-01' | 'E-VANC-01';
  /** The slot name, pool id, or spell level that failed. */
  resource: string;
  message: string;
}

/**
 * Validate `cost` against the grant table and the combatant's balances.
 * Pure read — spend applies the same check to the live ledger (with the
 * exhausted-slot case discriminated there).
 */
export function checkCost(
  cost: ActionCost,
  grants: SlotGrants,
  balances: EconomyBalances,
): CostRejection | undefined {
  for (const [name, amount] of Object.entries(cost.slots ?? {})) {
    const granted = grants.slots[name];
    if (granted === undefined) {
      return {
        kind: 'slot-ungranted',
        resource: name,
        rule: 'E-ECON-01',
        message: `action costs slot "${name}", which the grant table never declared — the pack's slot vocabulary is ${summarize(grants)}.`,
      };
    }
    if (granted < amount) {
      return {
        kind: 'slot-ungranted',
        resource: name,
        rule: 'E-ECON-01',
        message: `action costs ${amount} of slot "${name}", but the pack grants only ${granted} per turn — the pack's slot vocabulary is ${summarize(grants)}.`,
      };
    }
  }
  for (const [poolId, amount] of cost.points ? [[cost.points.pool, cost.points.amount] as const] : []) {
    const current = balances.pools?.[poolId];
    if (current === undefined || current < amount) {
      return {
        kind: 'points',
        resource: poolId,
        rule: 'E-POINTS-01',
        message: `action draws ${amount} from pool "${poolId}"${current === undefined ? ', which this combatant does not have' : `, but only ${current} point(s) remain`}.`,
      };
    }
  }
  if (cost.vancian !== undefined) {
    const level = String(cost.vancian);
    const bound = balances.boundSlots?.[level];
    if (bound === undefined || bound < 1) {
      return {
        kind: 'vancian',
        resource: level,
        rule: 'E-VANC-01',
        message: `spell needs a bound slot of level ${level}${bound === undefined ? ', but this combatant has no level-' + level + ' slots' : ', but every level-' + level + ' slot is spent'} — an empty slot cannot cast (FR-8).`,
      };
    }
  }
  return undefined;
}

/** One combatant's per-turn transient ledger. Plain JSON — snapshot-ready (S06). */
export interface SlotLedger {
  /** Slot name -> uses remaining this turn. */
  remaining: Record<string, number>;
}

export function freshLedger(grants: SlotGrants): SlotLedger {
  const remaining: Record<string, number> = {};
  for (const [name, count] of Object.entries(grants.slots)) remaining[name] = count;
  return { remaining };
}

/** Replenish at turn start: every granted slot returns to its full grant (per-turn grants, database.md §economy). */
export function replenish(ledger: SlotLedger, grants: SlotGrants): void {
  ledger.remaining = {};
  for (const [name, count] of Object.entries(grants.slots)) ledger.remaining[name] = count;
}

/**
 * Spend `cost.slots` from the ledger. Throws only on a caller bug (an
 * unvalidated spend); declare-time rejections return typed, and the combat
 * loop checks `canSpend` before mutating. Exhaustion names the violated slot.
 */
export function spend(ledger: SlotLedger, grants: SlotGrants, cost: ActionCost): CostClaim | undefined {
  for (const [name, amount] of Object.entries(cost.slots ?? {})) {
    const granted = grants.slots[name];
    const remaining = ledger.remaining[name];
    if (granted === undefined || remaining === undefined) {
      return {
        kind: 'slot-ungranted',
        resource: name,
        rule: 'E-ECON-01',
        message: `action costs slot "${name}", which the grant table never declared — the pack's slot vocabulary is ${summarize(grants)}.`,
      };
    }
    if (remaining < amount) {
      return {
        kind: 'slot-exhausted',
        resource: name,
        rule: 'E-ECON-01',
        message: `slot "${name}" is spent: ${remaining} of ${amount} needed remain this turn.`,
      };
    }
  }
  for (const [name, amount] of Object.entries(cost.slots ?? {})) {
    ledger.remaining[name] = (ledger.remaining[name] ?? 0) - amount;
  }
  return undefined;
}

/** Refund a spent action (host-directed rewind); never above the grant. */
export function refund(ledger: SlotLedger, grants: SlotGrants, cost: ActionCost): void {
  for (const [name, amount] of Object.entries(cost.slots ?? {})) {
    const granted = grants.slots[name];
    if (granted === undefined) continue;
    ledger.remaining[name] = Math.min(granted, (ledger.remaining[name] ?? 0) + amount);
  }
}

function summarize(grants: SlotGrants): string {
  const names = Object.keys(grants.slots).sort();
  return names.length === 0 ? '(empty — the pack declares no slot costs)' : `[${names.join(', ')}]`;
}
