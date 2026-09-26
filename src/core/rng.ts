/**
 * The one seeded RNG (FR-1): cyrb128-class string/number seed hashing → sfc32,
 * four uint32 words, state export/import. The roll path is all-integer arithmetic
 * (NFR-Determinism): same seed + same call sequence ⇒ identical results on every
 * platform. State shape is the snapshot contract — `rngState` in
 * src/schema/contracts/snapshots.schema.json is exactly {a,b,c,d} uint32 (FR-14).
 */

/** Four uint32 sfc32 words — exactly the snapshot schema's `rngState` def. */
export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

/**
 * Minimal entropy surface engine consumers take. `Rng` satisfies it; hosts may
 * inject any bounded-integer stream instead (rigged test streams, replays).
 */
export interface RandomSource {
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

const UINT32_MAX = 4294967296;

/**
 * cyrb128 string hash → four uint32 words, the recommended sfc32 seed.
 * Number seeds canonicalize through String() first, so `42` and `"42"` seed
 * identically — one canonical key per spelling.
 */
function cyrb128(seed: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ];
}

/**
 * sfc32 (four uint32 words) with injectable construction: seed with a string,
 * a number, or a previously exported `RngState` to resume mid-sequence.
 */
export class Rng implements RandomSource {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: string | number | RngState) {
    if (seed !== null && typeof seed === 'object') {
      const state = seed;
      validateRngState(state);
      this.a = state.a;
      this.b = state.b;
      this.c = state.c;
      this.d = state.d;
      return;
    }
    const [a, b, c, d] = cyrb128(typeof seed === 'number' ? String(seed) : seed);
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
  }

  /** One raw sfc32 step → the uint32 output word. All scaling stays integer. */
  private step(): number {
    const t = (this.a + this.b) | 0;
    this.a = (this.b ^ (this.b >>> 9)) >>> 0;
    this.b = (this.c + ((this.c << 3) | 0)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.d = (this.d + 1) >>> 0;
    const u = (t + this.d) | 0;
    this.c = (this.c + u) >>> 0;
    return u >>> 0;
  }

  /**
   * Uniform integer in [0, maxExclusive) — modulo scaling over the uint32 word
   * with rejection above the largest exact multiple, so the draw is unbiased
   * without float division.
   */
  int(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
      throw new RangeError(`int() needs an integer max >= 1, got ${maxExclusive}`);
    }
    const limit = UINT32_MAX - (UINT32_MAX % maxExclusive);
    let word = this.step();
    while (word >= limit) word = this.step();
    return word % maxExclusive;
  }

  /** Uniform float in [0, 1) — one IEEE-754 division; engine consumers use int(). */
  float(): number {
    return this.step() / UINT32_MAX;
  }

  /** Fresh plain-JSON state — S06 stores it verbatim in combat snapshots. */
  getState(): RngState {
    return { a: this.a, b: this.b, c: this.c, d: this.d };
  }

  /** Resume from exported state; malformed states are rejected loudly (FR-14 discipline). */
  setState(state: RngState): void {
    validateRngState(state);
    this.a = state.a;
    this.b = state.b;
    this.c = state.c;
    this.d = state.d;
  }
}

function validateRngState(state: RngState): void {
  if (state === null || typeof state !== 'object') {
    throw new TypeError('rng state must be an object');
  }
  for (const word of ['a', 'b', 'c', 'd'] as const) {
    const value = state[word];
    if (!Number.isInteger(value) || value < 0 || value >= UINT32_MAX) {
      throw new RangeError(`rng state.${word} must be a uint32, got ${value}`);
    }
  }
  for (const key of Object.keys(state)) {
    if (key !== 'a' && key !== 'b' && key !== 'c' && key !== 'd') {
      throw new RangeError(`rng state has unexpected key "${key}" — rngState is exactly {a,b,c,d}`);
    }
  }
}