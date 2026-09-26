/**
 * CA-3 — the event envelope and its stream. Every mutation the runtime makes
 * emits one provenanced event (FR-13); UIs, replays, and the triggered-action
 * substrate all read the same stream. The shape is the mock's event anatomy
 * verbatim (combat-loop.html): `{ type, at: {round, turn}, actor?, target?,
 * payload, why: {rule, rolls} }`. S05's combat rows add event *types* only —
 * this envelope is owned here (shared-file window, STATE.md).
 *
 * Round/turn counters are host-supplied: combat paces the loop and sets the
 * clock before stepping; character-side events run at round 0. Subscriber
 * absence never blocks play (FR-13) — emit() delivers to zero or more sinks
 * and always records the event.
 */

/** Combat clock — the host paces rounds/turns; the stream stamps events with it. */
export interface EventClock {
  readonly round: number;
  readonly turn: number;
}

/** Provenance (FR-13): the pack artifact that ruled, plus the roll trail as display strings. */
export interface EventWhy {
  readonly rule: string;
  readonly rolls: readonly string[];
}

/** The CA-3 envelope — exactly the combat-loop.html event anatomy. */
export interface RuntimeEvent {
  readonly type: string;
  readonly at: EventClock;
  readonly actor?: string;
  readonly target?: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly why: EventWhy;
}

/** What a caller supplies to emit(); the stream stamps `at` from its clock. */
export interface EventSeed {
  readonly type: string;
  readonly actor?: string;
  readonly target?: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly why: EventWhy;
}

export type EventSink = (event: RuntimeEvent) => void;

/**
 * The provenance stream (CA-3): stamp → record → deliver. Emitting with no
 * subscribers is the normal case for headless play; `sinceRound(n)` is the
 * replay window (api-map: fight.events.sinceRound).
 */
export class EventStream {
  private clock: EventClock = { round: 0, turn: 0 };
  private readonly history: RuntimeEvent[] = [];
  private readonly sinks: EventSink[] = [];

  /** Set the clock before the next emit — combat advances round/turn between steps. */
  setClock(clock: EventClock): void {
    this.clock = clock;
  }

  /** Stamp, record, deliver. Returns the completed event (api-map: awardXp → Event[]). */
  emit(seed: EventSeed): RuntimeEvent {
    const event: RuntimeEvent = {
      type: seed.type,
      at: { round: this.clock.round, turn: this.clock.turn },
      payload: seed.payload,
      why: seed.why,
      ...(seed.actor !== undefined ? { actor: seed.actor } : {}),
      ...(seed.target !== undefined ? { target: seed.target } : {}),
    };
    this.history.push(event);
    for (const sink of this.sinks) sink(event);
    return event;
  }

  /** Subscribe (api-map: fight.on(fn)); the same sink may be added twice — off removes all copies. */
  on(sink: EventSink): void {
    this.sinks.push(sink);
  }

  /** Unsubscribe; unknown sinks are a no-op. */
  off(sink: EventSink): void {
    for (let i = this.sinks.length - 1; i >= 0; i -= 1) {
      if (this.sinks[i] === sink) this.sinks.splice(i, 1);
    }
  }

  /** Events at or after `round` — the provenance stream (FR-13). */
  sinceRound(round: number): readonly RuntimeEvent[] {
    return this.history.filter((event) => event.at.round >= round);
  }
}
