/** Portable AR-03 contracts; schema stays independent of core and runtime. */
import type { Pack } from './pack';
import type { EncounterSetup, PlayPackIdentity, PlaySeed, PlayMembers } from './play-session';
import { validateEncounterSetup } from './play-session';
import { makeErrorCard, type ErrorCard, type RuleId } from './error-card';
import { packContentHash } from './version';
import { ID_PATTERN, MAX_TABLE_DEPTH } from './validate/helpers';

export type AdventureTemplateIdentity = { readonly id: string; readonly version: number };

export type AdventureDefinitionIdentity = {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly contentHash: string;
};

export type AdventureReward = {
  readonly id: string;
  readonly xpPerMember: number;
  readonly eligible: 'party';
  readonly loot: null | { readonly tableId: string; readonly recipient: 'host-choice' };
};

export type AdventureFacts = Readonly<Record<string, string | number | boolean | null>>;

export type AdventureDirectorPolicy = {
  readonly id: string;
  readonly version: number;
  readonly priorities: readonly (
    { readonly kind: 'action' | 'move'; readonly actionId: string } | { readonly kind: 'pass' }
  )[];
  readonly targetOrder: 'id' | 'nearest' | 'lowest-hp';
  readonly tieBreak: 'lexical' | 'seeded';
  readonly reactionPriority: readonly string[];
  readonly maxCandidates: number;
  readonly stallLimit: number;
};

export type AdventureNarration = {
  readonly fragments: readonly {
    readonly id: string;
    readonly eventType: string;
    readonly text: string;
    readonly slots: readonly { readonly name: string; readonly path: string }[];
  }[];
};

export type AdventureLocation = {
  readonly kind: 'discovery' | 'encounter' | 'rest';
  readonly title: string;
  readonly description: string;
  readonly encounter?: EncounterSetup;
  readonly rewardIds: readonly string[];
  readonly rest: 'none' | 'once';
  readonly preparation: boolean;
  readonly facts: AdventureFacts;
};

export type AdventureDescriptorTable = {
  readonly kind: 'weighted';
  readonly entries: readonly { readonly weight: number; readonly value: string }[];
};

export type AdventureNodeRecipe = { readonly id: string; readonly tableId: string };

export type AdventureBranch = {
  readonly id: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly nodes: readonly AdventureNodeRecipe[];
  readonly includeWeight: number;
  readonly omitWeight: number;
  readonly choiceTextRef: string;
};

export type AdventureConstruction = {
  readonly entry: AdventureNodeRecipe;
  readonly spine: readonly AdventureNodeRecipe[];
  readonly terminal: { readonly id: string; readonly title: string; readonly description: string };
  readonly branches: readonly AdventureBranch[];
  readonly continueTextRef: string;
};

export type AdventureObjective = { readonly id: string; readonly text: string };

export type AdventureTemplate = {
  readonly kind: 'adventure-template';
  readonly schemaVersion: 1;
  readonly id: string;
  readonly version: number;
  readonly pack: PlayPackIdentity;
  readonly nodeBounds: { readonly min: number; readonly max: number };
  readonly objective: AdventureObjective;
  readonly tables: Readonly<Record<string, AdventureDescriptorTable>>;
  readonly locations: Readonly<Record<string, AdventureLocation>>;
  readonly fragments: Readonly<Record<string, string>>;
  readonly construction: AdventureConstruction;
  readonly rewards: readonly AdventureReward[];
  readonly facts: AdventureFacts;
  readonly director: AdventureDirectorPolicy;
  readonly narration: AdventureNarration;
};

export type AdventureChoice = { readonly id: string; readonly text: string; readonly toNodeId: string };

export type AdventureNode = {
  readonly id: string;
  readonly kind: 'discovery' | 'encounter' | 'rest' | 'success';
  readonly title: string;
  readonly description: string;
  readonly choices: readonly AdventureChoice[];
  readonly encounter?: EncounterSetup;
  readonly rewardIds: readonly string[];
  readonly rest: 'none' | 'once';
  readonly preparation: boolean;
  readonly facts: AdventureFacts;
};

export type AdventureDefinition = {
  readonly kind: 'adventure-definition';
  readonly schemaVersion: 1;
  readonly id: string;
  readonly template: AdventureTemplateIdentity;
  readonly pack: PlayPackIdentity;
  readonly seed: string;
  readonly objective: AdventureObjective;
  readonly startNodeId: string;
  readonly successNodeId: string;
  readonly nodes: readonly AdventureNode[];
  readonly rewards: readonly AdventureReward[];
  readonly facts: AdventureFacts;
  readonly director: AdventureDirectorPolicy;
  readonly narration: AdventureNarration;
  readonly contentHash: string;
};

export type AdventureStartOptions = {
  readonly adventureId: string;
  readonly seed: PlaySeed;
  readonly members: PlayMembers;
};

type Check = (value: unknown, path: string, errors: string[]) => void;
const text: Check = (v, p, e) => {
  if (typeof v !== 'string') e.push(p);
};
const nonempty: Check = (v, p, e) => {
  if (typeof v !== 'string' || !v.length) e.push(p);
};
const id: Check = (v, p, e) => {
  if (typeof v !== 'string' || !ID_PATTERN.test(v)) e.push(p);
};
const integer =
  (min: number, max = Number.MAX_SAFE_INTEGER): Check =>
  (v, p, e) => {
    if (!Number.isSafeInteger(v) || (v as number) < min || (v as number) > max) e.push(p);
  };
const oneOf =
  (...values: unknown[]): Check =>
  (v, p, e) => {
    if (!values.includes(v)) e.push(p);
  };
const array =
  (check: Check, min = 0): Check =>
  (v, p, e) => {
    if (!Array.isArray(v)) {
      e.push(p);
      return;
    }
    if (v.length < min) e.push(p);
    v.forEach((item, i) => check(item, `${p}[${i}]`, e));
  };
function isRecord(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)
  );
}
const record =
  (check: Check): Check =>
  (v, p, e) => {
    if (!isRecord(v)) {
      e.push(p);
      return;
    }
    for (const [key, item] of Object.entries(v)) {
      id(key, `${p}.${key}`, e);
      check(item, `${p}.${key}`, e);
    }
  };
const object =
  (required: Record<string, Check>, optional: Record<string, Check> = {}): Check =>
  (v, p, e) => {
    if (!isRecord(v)) {
      e.push(p);
      return;
    }
    const at = (k: string) => (p ? `${p}.${k}` : k);
    for (const [key, check] of Object.entries(required)) check(v[key], at(key), e);
    for (const key of Object.keys(v)) {
      if (Object.prototype.hasOwnProperty.call(required, key)) continue;
      if (Object.prototype.hasOwnProperty.call(optional, key)) optional[key]!(v[key], at(key), e);
      else e.push(at(key));
    }
  };
const facts = record((v, p, e) => {
  if (
    v !== null &&
    typeof v !== 'string' &&
    typeof v !== 'boolean' &&
    !(typeof v === 'number' && Number.isFinite(v))
  )
    e.push(p);
});
const hash: Check = (v, p, e) => {
  if (typeof v !== 'string' || !/^[0-9a-f]{8}$/.test(v)) e.push(p);
};
const identity = object({ id: text, schemaVersion: integer(1), contentHash: nonempty });
const templateIdentity = object({ id, version: integer(1) });
const reward = object({
  id,
  xpPerMember: integer(0),
  eligible: oneOf('party'),
  loot: (v, p, e) => {
    if (v !== null) object({ tableId: id, recipient: oneOf('host-choice') })(v, p, e);
  },
});
const director = object({
  id,
  version: integer(1),
  priorities: array((v, p, e) => {
    if (isRecord(v) && v['kind'] === 'pass') object({ kind: oneOf('pass') })(v, p, e);
    else object({ kind: oneOf('action', 'move'), actionId: id })(v, p, e);
  }, 1),
  targetOrder: oneOf('id', 'nearest', 'lowest-hp'),
  tieBreak: oneOf('lexical', 'seeded'),
  reactionPriority: array(id),
  maxCandidates: integer(1),
  stallLimit: integer(1),
});
const narration = object({
  fragments: array(
    object({
      id,
      eventType: nonempty,
      text,
      slots: array(
        object({
          name: id,
          path: (v, p, e) => {
            if (
              typeof v !== 'string' ||
              !/^(type|actor|target|why\.rule|why\.rolls|payload\.[A-Za-z][A-Za-z0-9-]*|facts\.[a-z][a-z0-9-]*)$/.test(
                v,
              )
            )
              e.push(p);
          },
        }),
      ),
    }),
  ),
});
const objective = object({ id, text: nonempty });
const locationFields = {
  title: nonempty,
  description: text,
  rewardIds: array(id),
  rest: oneOf('none', 'once'),
  preparation: oneOf(true, false),
  facts,
};
const encounter: Check = (v, p, e) => {
  if (!isRecord(v)) e.push(p);
};
const location = object({ kind: oneOf('discovery', 'encounter', 'rest'), ...locationFields }, { encounter });
const recipe = object({ id, tableId: id });
const construction = object({
  entry: recipe,
  spine: array(recipe, 1),
  terminal: object({ id, title: nonempty, description: text }),
  branches: array(
    object({
      id,
      fromNodeId: id,
      toNodeId: id,
      nodes: array(recipe, 1),
      includeWeight: integer(1, 4294967296),
      omitWeight: integer(0, 4294967296),
      choiceTextRef: id,
    }),
  ),
  continueTextRef: id,
});
const common = {
  schemaVersion: oneOf(1),
  id,
  pack: identity,
  objective,
  rewards: array(reward),
  facts,
  director,
  narration,
};
const templateShape = object({
  kind: oneOf('adventure-template'),
  ...common,
  version: integer(1),
  nodeBounds: object({ min: integer(3), max: integer(3) }),
  tables: record(
    object({
      kind: oneOf('weighted'),
      entries: array(object({ weight: integer(1, 4294967296), value: id }), 1),
    }),
  ),
  locations: record(location),
  fragments: record(text),
  construction,
});
const definitionShape = object({
  kind: oneOf('adventure-definition'),
  ...common,
  template: templateIdentity,
  seed: text,
  startNodeId: id,
  successNodeId: id,
  nodes: array(
    object(
      {
        id,
        kind: oneOf('discovery', 'encounter', 'rest', 'success'),
        ...locationFields,
        choices: array(object({ id, text: nonempty, toNodeId: id })),
      },
      { encounter },
    ),
    3,
  ),
  contentHash: hash,
});

function shapeErrors(pack: Pack, value: unknown, check: Check): ErrorCard[] {
  const paths: string[] = [];
  check(value, '', paths);
  return [...new Set(paths)].map((path) =>
    makeErrorCard('E-SCHEMA-01', pack.manifest.id, path, 'Invalid or unexpected adventure field.'),
  );
}

type Refuse = (path: string, message: string, rule?: RuleId) => void;
function unique(values: readonly string[], path: string, refuse: Refuse): void {
  const seen = new Set<string>();
  values.forEach((value, i) => {
    if (seen.has(value)) refuse(`${path}[${i}]`, 'Duplicate identity.', 'E-DUP-01');
    seen.add(value);
  });
}

function checkLoot(
  pack: Pack,
  tableId: string,
  path: string,
  refuse: Refuse,
  ancestors: readonly string[] = [],
): void {
  const table = pack.tables[tableId];
  if (!table) {
    refuse(path, 'Unknown loot table.', 'E-REF-01');
    return;
  }
  if (ancestors.includes(tableId) || ancestors.length >= MAX_TABLE_DEPTH) {
    refuse(path, 'Loot nesting exceeds its depth bound or contains a cycle.', 'E-TBL-01');
    return;
  }
  const at = `tables.${tableId}`;
  if (
    !['weighted', 'ranged', 'nested'].includes(table.kind) ||
    !Array.isArray(table.entries) ||
    !table.entries.length
  ) {
    refuse(at, 'Loot table must have a supported kind and nonempty entries.', 'E-TBL-01');
    return;
  }
  let total = 0;
  const faces = new Set<number>();
  table.entries.forEach((entry, i) => {
    const ep = `${at}.entries[${i}]`;
    if (!isRecord(entry)) {
      refuse(ep, 'Invalid table entry.', 'E-TBL-01');
      return;
    }
    if (table.kind !== 'ranged') {
      const weight = entry.weight ?? (table.kind === 'nested' ? 1 : 0);
      if (!Number.isSafeInteger(weight) || weight < 1)
        refuse(`${ep}.weight`, 'Weight must be a positive safe integer.', 'E-TBL-01');
      total += weight;
    } else {
      if (!Number.isSafeInteger(entry.min) || !Number.isSafeInteger(entry.max) || entry.min! > entry.max!)
        refuse(ep, 'Invalid range.', 'E-TBL-01');
      else
        for (let face = 1; face <= 100; face++) if (entry.min! <= face && face <= entry.max!) faces.add(face);
    }
    const value = entry.value;
    if (table.kind === 'nested') {
      if (typeof value !== 'string')
        refuse(`${ep}.value`, 'Nested value must resolve to a table.', 'E-REF-01');
      else
        checkLoot(
          pack,
          Object.prototype.hasOwnProperty.call(pack.tables, value) ? value : value.replace(/^tables\./, ''),
          `${ep}.value`,
          refuse,
          [...ancestors, tableId],
        );
    } else if (isRecord(value) && ('id' in value || 'qty' in value)) {
      if (
        typeof value['id'] !== 'string' ||
        !Object.prototype.hasOwnProperty.call(pack.content.items ?? {}, value['id'])
      )
        refuse(`${ep}.value.id`, 'Unknown loot item.', 'E-REF-01');
      if (!Number.isSafeInteger(value['qty']) || (value['qty'] as number) < 1)
        refuse(`${ep}.value.qty`, 'Item quantity must be a positive safe integer.');
    }
  });
  if (
    table.kind === 'ranged'
      ? faces.size !== 100
      : !Number.isSafeInteger(total) || total < 1 || total > 4294967296
  )
    refuse(at, 'Loot table must cover d100 or have total weight in 1..2^32.', 'E-TBL-01');
}

function checkCommon(
  pack: Pack,
  doc: AdventureTemplate | AdventureDefinition,
  locations: readonly [string, AdventureLocation | AdventureNode][],
  errors: ErrorCard[],
): Refuse {
  const refuse: Refuse = (path, message, rule = 'E-SCHEMA-01') =>
    errors.push(makeErrorCard(rule, doc.id, path, message));
  const expected = {
    id: pack.manifest.id,
    schemaVersion: pack.manifest.schemaVersion,
    contentHash: packContentHash(pack),
  };
  if (packContentHash(doc.pack) !== packContentHash(expected))
    refuse('pack', 'Adventure belongs to a different effective pack.', 'E-SNAP-01');
  unique(
    doc.rewards.map((r) => r.id),
    'rewards',
    refuse,
  );
  const rewards = new Set(doc.rewards.map((r) => r.id));
  doc.rewards.forEach((r, i) => {
    if (r.loot) checkLoot(pack, r.loot.tableId, `rewards[${i}].loot.tableId`, refuse);
  });
  for (const [path, loc] of locations) {
    if (loc.kind === 'encounter')
      errors.push(...validateEncounterSetup(pack, loc.encounter, `${path}.encounter`));
    else if (loc.encounter !== undefined) refuse(`${path}.encounter`, 'Only encounter nodes permit a setup.');
    unique(loc.rewardIds, `${path}.rewardIds`, refuse);
    loc.rewardIds.forEach((rewardId, i) => {
      if (!rewards.has(rewardId)) refuse(`${path}.rewardIds[${i}]`, 'Unknown reward.', 'E-REF-01');
    });
  }
  const policy = doc.director;
  if (
    policy.priorities.filter((p) => p.kind === 'pass').length !== 1 ||
    policy.priorities[policy.priorities.length - 1]?.kind !== 'pass'
  )
    refuse('director.priorities', 'Exactly one final pass is required.');
  policy.priorities.forEach((priority, i) => {
    if (priority.kind === 'pass') return;
    const action = pack.actions[priority.actionId];
    if (
      !Object.prototype.hasOwnProperty.call(pack.actions, priority.actionId) ||
      !action ||
      action.trigger ||
      (priority.kind === 'move') !== /^\s*move\s*\(/.test(action.effect)
    )
      refuse(
        `director.priorities[${i}].actionId`,
        'Priority must reference a matching untriggered action root.',
        'E-REF-01',
      );
  });
  unique(policy.reactionPriority, 'director.reactionPriority', refuse);
  policy.reactionPriority.forEach((ref, i) => {
    if (!pack.actions[ref]?.trigger && !pack.content.feats?.[ref]?.trigger)
      refuse(
        `director.reactionPriority[${i}]`,
        'Reaction must reference a triggered action or feat.',
        'E-REF-01',
      );
  });
  if (
    policy.targetOrder === 'nearest' &&
    (!pack.spatial ||
      locations.some(([, loc]) => loc.kind === 'encounter' && loc.encounter?.layout?.kind !== 'spatial'))
  )
    refuse('director.targetOrder', 'Nearest requires spatial encounter layouts.');
  const fragments = doc.narration.fragments;
  unique(
    fragments.map((f) => f.id),
    'narration.fragments',
    refuse,
  );
  unique(
    fragments.map((f) => f.eventType),
    'narration.fragments.eventType',
    refuse,
  );
  const factIds = new Set([
    ...Object.keys(doc.facts),
    ...locations.flatMap(([, loc]) => Object.keys(loc.facts)),
  ]);
  fragments.forEach((fragment, i) => {
    const path = `narration.fragments[${i}]`;
    unique(
      fragment.slots.map((s) => s.name),
      `${path}.slots`,
      refuse,
    );
    const names = new Set(fragment.slots.map((s) => s.name));
    const placeholders = [...fragment.text.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]!);
    if (placeholders.some((p) => !names.has(p)) || [...names].some((n) => !placeholders.includes(n)))
      refuse(`${path}.slots`, 'Slots must exactly match text placeholders.');
    fragment.slots.forEach((slot, j) => {
      if (slot.path.startsWith('facts.') && !factIds.has(slot.path.slice(6)))
        refuse(`${path}.slots[${j}].path`, 'Unknown narration fact.', 'E-REF-01');
    });
  });
  return refuse;
}

/** Validate every possible recipe before a generator consumes entropy. */
export function validateAdventureTemplate(pack: Pack, value: unknown): ErrorCard[] {
  const errors = shapeErrors(pack, value, templateShape);
  if (errors.length) return errors;
  const doc = value as AdventureTemplate;
  const refuse = checkCommon(
    pack,
    doc,
    Object.entries(doc.locations).map(([key, loc]) => [`locations.${key}`, loc]),
    errors,
  );
  const c = doc.construction;
  const base = [c.entry, ...c.spine, c.terminal];
  const all = [...base, ...c.branches.flatMap((b) => b.nodes)];
  unique(
    all.map((n) => n.id),
    'construction.nodes',
    refuse,
  );
  unique(
    c.branches.map((b) => b.id),
    'construction.branches',
    refuse,
  );
  if (
    doc.nodeBounds.min > doc.nodeBounds.max ||
    doc.nodeBounds.min > base.length ||
    doc.nodeBounds.max < all.length
  )
    refuse('nodeBounds', 'Bounds must contain the base and all possible branch nodes.');
  const textRef = (ref: string, path: string) => {
    if (!Object.prototype.hasOwnProperty.call(doc.fragments, ref) || !doc.fragments[ref]?.length)
      refuse(path, 'Choice text must resolve to nonempty text.', 'E-REF-01');
  };
  textRef(c.continueTextRef, 'construction.continueTextRef');
  const recipeRef = (r: AdventureNodeRecipe, path: string) => {
    if (!Object.prototype.hasOwnProperty.call(doc.tables, r.tableId))
      refuse(`${path}.tableId`, 'Unknown descriptor table.', 'E-REF-01');
  };
  recipeRef(c.entry, 'construction.entry');
  c.spine.forEach((r, i) => recipeRef(r, `construction.spine[${i}]`));
  c.branches.forEach((b, i) => {
    const path = `construction.branches[${i}]`;
    const from = base.findIndex((n) => n.id === b.fromNodeId),
      to = base.findIndex((n) => n.id === b.toNodeId);
    if (from < 0 || to < 0 || from >= to)
      refuse(path, 'Branch anchors must be earlier and later base nodes.', 'E-REF-01');
    if (b.includeWeight + b.omitWeight > 4294967296)
      refuse(`${path}.includeWeight`, 'Branch weight total exceeds 2^32.', 'E-TBL-01');
    textRef(b.choiceTextRef, `${path}.choiceTextRef`);
    b.nodes.forEach((r, j) => recipeRef(r, `${path}.nodes[${j}]`));
  });
  for (const [key, table] of Object.entries(doc.tables)) {
    if (table.entries.reduce((sum, e) => sum + e.weight, 0) > 4294967296)
      refuse(`tables.${key}`, 'Descriptor weight total exceeds 2^32.', 'E-TBL-01');
    table.entries.forEach((entry, i) => {
      if (!Object.prototype.hasOwnProperty.call(doc.locations, entry.value))
        refuse(`tables.${key}.entries[${i}].value`, 'Unknown location descriptor.', 'E-REF-01');
    });
  }
  return errors;
}

/** Validate a resolved DAG and its exact portable identity without drawing randomness. */
export function validateAdventureDefinition(pack: Pack, value: unknown): ErrorCard[] {
  const errors = shapeErrors(pack, value, definitionShape);
  if (errors.length) return errors;
  const doc = value as AdventureDefinition;
  const refuse = checkCommon(
    pack,
    doc,
    doc.nodes.map((n, i) => [`nodes[${i}]`, n]),
    errors,
  );
  const { contentHash, ...body } = doc;
  if (contentHash !== packContentHash(body))
    refuse('contentHash', 'Definition digest does not match its complete content.', 'E-SNAP-01');
  if (doc.id !== doc.template.id) refuse('template.id', 'Definition id must equal its template id.');
  unique(
    doc.nodes.map((n) => n.id),
    'nodes',
    refuse,
  );
  const nodes = new Map(doc.nodes.map((n) => [n.id, n]));
  if (!nodes.has(doc.startNodeId)) refuse('startNodeId', 'Unknown start node.', 'E-REF-01');
  if (
    nodes.get(doc.successNodeId)?.kind !== 'success' ||
    doc.nodes.filter((n) => n.kind === 'success').length !== 1
  )
    refuse('successNodeId', 'Exactly one named success node is required.');
  doc.nodes.forEach((n, i) => {
    const path = `nodes[${i}]`;
    unique(
      n.choices.map((c) => c.id),
      `${path}.choices`,
      refuse,
    );
    if (n.kind === 'success' ? n.choices.length !== 0 : n.choices.length === 0)
      refuse(`${path}.choices`, 'Only success may have no choices.');
    if (n.kind === 'success' && (n.rest !== 'none' || n.preparation))
      refuse(path, 'Success permits neither rest nor preparation.');
    n.choices.forEach((c, j) => {
      if (!nodes.has(c.toNodeId))
        refuse(`${path}.choices[${j}].toNodeId`, 'Unknown destination.', 'E-REF-01');
    });
  });
  const reached = new Set<string>(),
    pending = [doc.startNodeId];
  while (pending.length) {
    const id = pending.pop()!;
    if (reached.has(id)) continue;
    reached.add(id);
    for (const choice of nodes.get(id)?.choices ?? []) pending.push(choice.toNodeId);
  }
  const incoming = new Map(doc.nodes.map((n) => [n.id, 0]));
  const predecessors = new Map(doc.nodes.map((n) => [n.id, [] as string[]]));
  for (const n of doc.nodes)
    for (const c of n.choices)
      if (nodes.has(c.toNodeId)) {
        incoming.set(c.toNodeId, incoming.get(c.toNodeId)! + 1);
        predecessors.get(c.toNodeId)!.push(n.id);
      }
  const ready = [...incoming].filter(([, count]) => count === 0).map(([id]) => id);
  let visited = 0;
  while (ready.length) {
    const node = nodes.get(ready.pop()!)!;
    visited++;
    for (const c of node.choices)
      if (incoming.has(c.toNodeId)) {
        const count = incoming.get(c.toNodeId)! - 1;
        incoming.set(c.toNodeId, count);
        if (count === 0) ready.push(c.toNodeId);
      }
  }
  if (visited !== nodes.size) refuse('nodes', 'Graph must be acyclic.');
  const succeeds = new Set<string>(),
    reverse = [doc.successNodeId];
  while (reverse.length) {
    const id = reverse.pop()!;
    if (succeeds.has(id)) continue;
    succeeds.add(id);
    reverse.push(...(predecessors.get(id) ?? []));
  }
  doc.nodes.forEach((n, i) => {
    if (!reached.has(n.id)) refuse(`nodes[${i}].id`, 'Node is unreachable from start.');
    if (!succeeds.has(n.id)) refuse(`nodes[${i}].choices`, 'Node has no route to success.');
  });
  return errors;
}
