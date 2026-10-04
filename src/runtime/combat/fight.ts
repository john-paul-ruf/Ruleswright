/**
 * The fight's mutable internals (M03, DD-D3): the combat state, the dice
 * stream, the slot grants, the offer queue and counter, and the per-event
 * offer guard — plus the primitives every combat file shares: the event
 * clock, the per-call event sink, the declare rejection and offer surfacing.
 * `Combat` holds one privately; the free functions in the other combat files
 * take it, so no `Combat` member widens the public surface.
 */
import type { Rng } from '../../core/rng';
import type { Runtime } from '../runtime';
import type { RuntimeEvent } from '../events';
import type { SlotGrants } from './action-economy';
import { isDowned } from './combatants';
import { emitOffer, offersForEvent } from './triggers';
import type { CombatState, DeclareRejection, PendingTrigger } from './types';

export class FightCore {
  readonly runtime: Runtime;
  state: CombatState;
  /** The fight's own dice stream — snapshot-resumable via state.rng (FR-14). */
  readonly rng: Rng;
  readonly grants: SlotGrants;
  /** Open trigger offers (triggers.html): the host answers each via respond(). */
  readonly pendingTriggers: PendingTrigger[] = [];
  /** How many offers this fight has raised — the next `trigger:fired.offerIndex` (R-GM-1: restorable). */
  offerCounter: number;
  /** Events already offered against — each (reactor, event) pair is offered once (F-P1). */
  private readonly surfaced = new WeakSet<RuntimeEvent>();

  constructor(runtime: Runtime, state: CombatState, rng: Rng, grants: SlotGrants, offeredCount: number) {
    this.runtime = runtime;
    this.state = state;
    this.rng = rng;
    this.grants = grants;
    this.offerCounter = offeredCount;
  }

  setClock(): void {
    this.runtime.events.setClock({ round: this.state.round, turn: this.state.turn });
  }

  /** Run `work`, collecting every event it emits — the per-call sink (the `execute()` idiom, F-P1). */
  collect<T>(work: () => T): { result: T; emitted: RuntimeEvent[] } {
    const emitted: RuntimeEvent[] = [];
    const sink = (event: RuntimeEvent) => {
      emitted.push(event);
    };
    this.runtime.events.on(sink);
    try {
      return { result: work(), emitted };
    } finally {
      this.runtime.events.off(sink);
    }
  }

  reject(actorId: string, rejection: DeclareRejection): RuntimeEvent {
    this.setClock();
    return this.runtime.events.emit({
      type: 'declare:rejected',
      actor: actorId,
      payload: { kind: rejection.kind, resource: rejection.resource, message: rejection.message },
      why: { rule: rejection.rule, rolls: [] },
    });
  }

  /**
   * Offer every matching reactive action to standing combatants (FR-13
   * substrate); none once the fight is over. Callers pass only the events
   * their own call emitted (per-call surfacing, F-P1), and an event already
   * surfaced is skipped, so each (reactor, event) pair is offered once.
   * Returns how many offers were raised. `feats: false` is the no-chain rule
   * (DD-S12): events a taken feat emitted offer reactive actions only.
   */
  surfaceOffers(events: readonly RuntimeEvent[], options: { readonly feats?: boolean } = {}): number {
    if (this.state.phase === 'combat-over') return 0;
    let raised = 0;
    for (const event of events) {
      if (this.surfaced.has(event)) continue;
      this.surfaced.add(event);
      for (const offer of offersForEvent(this.runtime, this.state.combatants, event, options)) {
        if (isDowned(this.state.combatants[offer.actorId]!)) continue;
        this.pendingTriggers.push(offer);
        emitOffer(this.runtime, offer, this.offerCounter);
        this.offerCounter += 1;
        raised += 1;
      }
    }
    return raised;
  }
}
