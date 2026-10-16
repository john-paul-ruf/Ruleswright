import type { Pack } from '../../schema/pack';
import type { AdventureDefinition } from '../../schema/adventure';
import type { PlayMembers } from '../../schema/play-session';
import { Rng } from '../../core/rng';
import { Runtime } from '../runtime';
import { RuntimeRuleError, ruleCard } from '../errors';
import { restoreCharacter } from '../snapshots/character';
import { isRecord, packIdentity } from '../snapshots/envelope';
import { detached, same } from '../play/snapshot';
import { exact } from './choices';
import type { AdventureSnapshot } from './types';

export function requireSaved(
  ok: boolean,
  path: string,
  message = 'Inconsistent adventure snapshot.',
): asserts ok {
  if (!ok)
    throw new RuntimeRuleError([
      ruleCard(path === 'snapshotVersion' ? 'E-SNAP-02' : 'E-SNAP-01', '(adventure)', path, message),
    ]);
}
export function jsonValue(value: unknown, path = '', ancestors = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    requireSaved(Number.isFinite(value), path);
    return;
  }
  requireSaved(
    typeof value === 'object' && !ancestors.has(value),
    path,
    'Expected finite, acyclic plain JSON.',
  );
  ancestors.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) jsonValue(value[i], `${path}[${i}]`, ancestors);
  } else {
    requireSaved(
      Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null,
      path,
    );
    for (const [key, entry] of Object.entries(value)) jsonValue(entry, `${path}.${key}`, ancestors);
  }
  ancestors.delete(value);
}
export function counter(value: unknown, path: string): void {
  requireSaved(Number.isSafeInteger(value) && (value as number) >= 0, path);
}
function strings(value: unknown, path: string): asserts value is string[] {
  requireSaved(
    Array.isArray(value) &&
      value.every((v) => typeof v === 'string' && v.length > 0) &&
      new Set(value).size === value.length,
    path,
  );
}
export function readMembers(pack: Pack, input: unknown): PlayMembers {
  requireSaved(Array.isArray(input) && input.length > 0, 'members');
  const runtime = new Runtime(pack),
    ids = new Set<string>();
  for (const [i, m] of input.entries()) {
    const p = `members[${i}]`;
    requireSaved(
      exact(m, ['memberId', 'character']) &&
        typeof m['memberId'] === 'string' &&
        m['memberId'].length > 0 &&
        !ids.has(m['memberId']),
      p,
    );
    ids.add(m['memberId'] as string);
    const c = m['character'];
    requireSaved(
      exact(c, ['kind', 'snapshotVersion', 'pack', 'state']) &&
        c['kind'] === 'character' &&
        c['snapshotVersion'] === 1 &&
        same(c['pack'], packIdentity(pack)),
      `${p}.character`,
    );
    const s = c['state'];
    requireSaved(
      exact(
        s,
        ['name', 'race', 'classes', 'abilities', 'conditions', 'inventory', 'hp', 'pools', 'slots'],
        ['skills', 'feats', 'knownSpells', 'equipped'],
      ),
      `${p}.character.state`,
    );
    requireSaved(
      typeof s['name'] === 'string' &&
        typeof s['race'] === 'string' &&
        Array.isArray(s['classes']) &&
        s['classes'].length > 0,
      p,
    );
    for (const cls of s['classes']) {
      requireSaved(
        exact(cls, ['id', 'level'], ['xp']) &&
          typeof cls['id'] === 'string' &&
          Number.isSafeInteger(cls['level']),
        `${p}.classes`,
      );
      if ('xp' in cls) counter(cls['xp'], `${p}.classes.xp`);
    }
    for (const field of ['abilities', 'pools', 'skills']) {
      if (field === 'skills' && !(field in s)) continue;
      requireSaved(isRecord(s[field]), `${p}.${field}`);
      for (const v of Object.values(s[field] as Record<string, unknown>))
        requireSaved(
          Number.isSafeInteger(v) && (field === 'abilities' || (v as number) >= 0),
          `${p}.${field}`,
        );
    }
    requireSaved(exact(s['hp'], ['current', 'temp']) && Number.isSafeInteger(s['hp']['current']), `${p}.hp`);
    counter(s['hp']['temp'], `${p}.hp.temp`);
    for (const field of ['conditions', 'inventory']) {
      requireSaved(Array.isArray(s[field]), `${p}.${field}`);
      const amount = field === 'conditions' ? 'remaining' : 'qty';
      for (const row of s[field]) {
        requireSaved(exact(row, ['id', amount]) && typeof row['id'] === 'string', `${p}.${field}`);
        counter(row[amount], `${p}.${field}.${amount}`);
        requireSaved(
          field === 'conditions'
            ? !!pack.content.conditions?.[row['id'] as string]
            : !!pack.content.items?.[row['id'] as string] && (row[amount] as number) > 0,
          `${p}.${field}.id`,
        );
      }
    }
    requireSaved(isRecord(s['slots']), `${p}.slots`);
    for (const [level, bindings] of Object.entries(s['slots']))
      requireSaved(
        Array.isArray(bindings) &&
          bindings.every(
            (v) =>
              v === null ||
              (typeof v === 'string' &&
                !!pack.content.spells?.[v] &&
                String(pack.content.spells[v]!.magic.level) === level),
          ),
        `${p}.slots.${level}`,
      );
    for (const field of ['feats', 'knownSpells'])
      if (field in s) {
        strings(s[field], `${p}.${field}`);
        requireSaved(
          (s[field] as string[]).every(
            (id) => !!(field === 'feats' ? pack.content.feats : pack.content.spells)?.[id],
          ),
          `${p}.${field}`,
        );
      }
    restoreCharacter(runtime, c as unknown as PlayMembers[number]['character']);
  }
  return detached(input as PlayMembers);
}
export function readAdventureSnapshot(
  pack: Pack,
  definition: AdventureDefinition,
  input: unknown,
): AdventureSnapshot {
  jsonValue(input);
  requireSaved(
    exact(input, [
      'kind',
      'snapshotVersion',
      'pack',
      'definition',
      'adventureId',
      'revision',
      'seed',
      'nodeId',
      'phase',
      'visitedNodeIds',
      'resolvedNodeIds',
      'choiceTrail',
      'restedNodeIds',
      'members',
      'activeEncounter',
      'encounterReceipts',
      'rng',
      'rewards',
      'sequence',
      'journal',
      'encounterEventCursor',
      'director',
      'narrationAck',
    ]),
    '',
  );
  requireSaved(input['snapshotVersion'] === 1, 'snapshotVersion');
  requireSaved(
    input['kind'] === 'adventure' &&
      typeof input['adventureId'] === 'string' &&
      input['adventureId'].length > 0 &&
      typeof input['seed'] === 'string',
    'kind',
  );
  requireSaved(same(input['pack'], packIdentity(pack)), 'pack');
  requireSaved(
    same(input['definition'], {
      id: definition.id,
      schemaVersion: definition.schemaVersion,
      contentHash: definition.contentHash,
    }),
    'definition',
  );
  for (const field of ['revision', 'sequence', 'encounterEventCursor', 'narrationAck'])
    counter(input[field], field);
  for (const field of ['visitedNodeIds', 'resolvedNodeIds', 'restedNodeIds']) strings(input[field], field);
  requireSaved(
    Array.isArray(input['choiceTrail']) &&
      Array.isArray(input['journal']) &&
      Array.isArray(input['rewards']) &&
      Array.isArray(input['encounterReceipts']),
    'arrays',
  );
  readMembers(pack, input['members']);
  requireSaved(exact(input['rng'], ['generation', 'play', 'rewards', 'director']), 'rng');
  for (const [stream, words] of Object.entries(input['rng'])) {
    requireSaved(
      exact(words, ['a', 'b', 'c', 'd']) &&
        Object.values(words).every(
          (v) => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) < 4294967296,
        ),
      `rng.${stream}`,
    );
    new Rng(words as unknown as AdventureSnapshot['rng']['play']);
  }
  const director = input['director'];
  requireSaved(
    exact(director, ['policy', 'decisions', 'stalledSteps', 'lastMechanicalHash']) &&
      same(director['policy'], { id: definition.director.id, version: definition.director.version }),
    'director',
  );
  counter(director['decisions'], 'director.decisions');
  counter(director['stalledSteps'], 'director.stalledSteps');
  requireSaved(
    director['lastMechanicalHash'] === null ||
      (typeof director['lastMechanicalHash'] === 'string' &&
        /^[0-9a-f]{8}$/.test(director['lastMechanicalHash'])),
    'director.lastMechanicalHash',
  );
  const saved = input as unknown as AdventureSnapshot;
  let nodeId = definition.startNodeId,
    revision = 0;
  const visited = [nodeId];
  for (const step of saved.choiceTrail) {
    requireSaved(exact(step, ['nodeId', 'choiceId', 'toNodeId', 'revision']), 'choiceTrail');
    counter(step.revision, 'choiceTrail.revision');
    const choice = definition.nodes.find((n) => n.id === nodeId)?.choices.find((c) => c.id === step.choiceId);
    requireSaved(
      step.nodeId === nodeId &&
        choice?.toNodeId === step.toNodeId &&
        step.revision > revision &&
        step.revision <= saved.revision,
      'choiceTrail',
    );
    revision = step.revision;
    nodeId = step.toNodeId;
    visited.push(nodeId);
  }
  requireSaved(nodeId === saved.nodeId && same(visited, saved.visitedNodeIds), 'visitedNodeIds');
  requireSaved(same(saved.resolvedNodeIds, visited) && saved.restedNodeIds.length === 0, 'resolvedNodeIds');
  requireSaved(
    saved.activeEncounter === null &&
      saved.encounterEventCursor === 0 &&
      saved.encounterReceipts.length === 0 &&
      saved.rewards.length === 0,
    'activeEncounter',
    'Encounter and reward transitions are not available yet.',
  );
  requireSaved(
    saved.phase === 'abandoned' ||
      saved.phase === (nodeId === definition.successNodeId ? 'completed' : 'exploration'),
    'phase',
  );
  requireSaved(saved.sequence === saved.journal.length && saved.narrationAck <= saved.sequence, 'sequence');
  let eventRevision = 0;
  for (const [i, entry] of saved.journal.entries()) {
    requireSaved(
      exact(entry, ['sequence', 'revision', 'event', 'subjects']) &&
        entry.sequence === i + 1 &&
        entry.revision >= eventRevision &&
        entry.revision <= saved.revision &&
        Array.isArray(entry.subjects),
      `journal[${i}]`,
    );
    eventRevision = entry.revision;
    requireSaved(
      exact(entry.event, ['type', 'at', 'payload', 'why'], ['actor', 'target']) &&
        typeof entry.event.type === 'string' &&
        exact(entry.event.at, ['round', 'turn']) &&
        isRecord(entry.event.payload) &&
        exact(entry.event.why, ['rule', 'rolls']) &&
        typeof entry.event.why.rule === 'string' &&
        Array.isArray(entry.event.why.rolls),
      `journal[${i}].event`,
    );
    counter(entry.event.at.round, 'journal.at.round');
    counter(entry.event.at.turn, 'journal.at.turn');
  }
  return detached(saved);
}
