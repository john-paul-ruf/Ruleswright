/**
 * The closed function registry (CA-2 / NFR-Security): frozen at module load,
 * versioned with the schema — extension is a schema event, never an escape
 * hatch. One table for both grammars: formula functions return scalars, effect
 * functions produce actions/resolutions, comparator words gate validity
 * expressions. `half` is not a call — it is the reserved save-for-half marker
 * grammar accepts inside damage() (magic.html perTarget anatomy).
 */
export const REGISTRY: Readonly<Record<string, FunctionSpec>> = Object.freeze({
  attack: { arity: 2, kind: 'effect', signature: ['formula', 'formula'] },
  save: { arity: 4, kind: 'effect', signature: ['save-name', 'formula', 'effect', 'effect'] },
  damage: { arity: [1, 2], kind: 'effect', signature: ['formula', 'type?'] },
  applyCondition: { arity: 2, kind: 'effect', signature: ['condition-id', 'formula'] },
  target: { arity: 2, kind: 'effect', signature: ['shape', 'effect'] },
  sequence: { arity: [2, 8], kind: 'effect', signature: ['effect', 'effect'] },
  hasTarget: { arity: 1, kind: 'validity', signature: ['shape'] },
  min: { arity: 2, kind: 'formula', signature: ['formula', 'formula'] },
  max: { arity: 2, kind: 'formula', signature: ['formula', 'formula'] },
  floor: { arity: 1, kind: 'formula', signature: ['formula'] },
  ceil: { arity: 1, kind: 'formula', signature: ['formula'] },
  half: { arity: 0, kind: 'reserved', signature: [] },
});

export interface FunctionSpec {
  /** Exact arity, or an inclusive [min, max] range (variadic sequence). */
  readonly arity: number | readonly [number, number];
  readonly kind: 'formula' | 'effect' | 'validity' | 'reserved';
  /** Positional argument categories, for the AST and the executor. */
  readonly signature: readonly string[];
}

/** Registry miss = E-FORM-02; the vocabulary is closed (database.md). */
export function lookupFunction(name: string): FunctionSpec | undefined {
  return REGISTRY[name];
}

/** Reserved marker (`half`): grammar-legal inside damage(), never a callable. */
export function isReservedWord(name: string): boolean {
  return REGISTRY[name] !== undefined && REGISTRY[name]!.kind === 'reserved';
}

/** Effect vocabulary the registry must cover — asserted by the freeze test (CA-2). */
export const EFFECT_VOCABULARY: readonly string[] = [
  'attack',
  'save',
  'damage',
  'applyCondition',
  'target',
  'sequence',
];

/** Validity vocabulary the registry must cover (S01's `valid` kind). */
export const VALIDITY_VOCABULARY: readonly string[] = ['hasTarget'];

/** Formula vocabulary the registry must cover. */
export const FORMULA_VOCABULARY: readonly string[] = ['min', 'max', 'floor', 'ceil'];
