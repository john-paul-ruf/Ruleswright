/**
 * Content memoization for pure functions over JSON documents (perf; no semantic change).
 *
 * The play and adventure facades defensively deep-copy (`detached`) the pack on every
 * command, then re-validate and re-hash the copy. Those copies are JSON-clean by
 * construction (they come straight out of JSON.parse), so for them the JSON text is an
 * exact identity of the content: equal text ⇒ equal validation result and content hash.
 * Only objects registered here are memoized; anything a host passes in directly is
 * always computed in full. The key is taken at call time, so a later mutation of a
 * registered object can never be served a stale result.
 */
const jsonClean = new WeakSet<object>();
/** Deep-frozen JSON copies and the exact text they were parsed from. */
const frozenText = new WeakMap<object, string>();

/** Register a value produced by JSON.parse (or an equivalent JSON-only copy). Returns it. */
export function markJsonClean<T>(value: T): T {
  if (value !== null && typeof value === 'object') jsonClean.add(value as object);
  return value;
}

/** The memo key for a registered JSON-clean object, else undefined (no memoization). */
export function jsonMemoKey(value: unknown): string | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  const frozen = frozenText.get(value);
  if (frozen !== undefined) return frozen;
  return jsonClean.has(value) ? JSON.stringify(value) : undefined;
}

/**
 * An immutable JSON copy: deep-frozen, so it can be shared instead of re-copied and
 * its memo key is the text it was parsed from. A value that already is such a copy is
 * returned as-is (it cannot have changed).
 */
export function frozenJsonCopy<T>(value: T): T {
  if (value !== null && typeof value === 'object' && frozenText.has(value as object)) return value;
  const text = JSON.stringify(value);
  const copy = deepFreeze(JSON.parse(text) as T);
  if (copy !== null && typeof copy === 'object') {
    frozenText.set(copy as object, text);
    jsonClean.add(copy as object);
  }
  return copy;
}

/** Whether a value is an immutable JSON copy made by frozenJsonCopy. */
export function isFrozenJsonCopy(value: unknown): boolean {
  return value !== null && typeof value === 'object' && frozenText.has(value);
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as object)) deepFreeze(child);
  }
  return value;
}

/** A small insertion-ordered LRU keyed by JSON text. */
export class JsonMemo<V> {
  private readonly entries = new Map<string, V>();
  constructor(private readonly limit = 16) {}
  get(key: string): V | undefined {
    const hit = this.entries.get(key);
    if (hit !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, hit);
    }
    return hit;
  }
  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value as string);
  }
}
