import type { Pack } from '../../schema/pack';
import type { AdventureDefinition } from '../../schema/adventure';
import type { PlayMembers } from '../../schema/play-session';
import { packContentHash } from '../../schema/version';
import { Rng } from '../../core/rng';
import { Runtime } from '../runtime';
import { RuntimeRuleError, ruleCard } from '../errors';
import { restoreCharacter } from '../snapshots/character';
import { isRecord, packIdentity } from '../snapshots/envelope';
import { detached, same } from '../play/snapshot';
import { exact } from './choices';
import { restoreEncounterSession } from '../play/session';
import { streamKey } from '../play/encounter';
import { assembleEncounter } from '../encounter';
import { poolVocabulary } from '../pools';
import { CharacterBuildError } from '../progression';
import { rollLoot } from '../inventory';
import { normalizeLoot } from './rewards';
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
          Number.isSafeInteger(cls['level']) &&
          (cls['level'] as number) >= 1 &&
          (cls['level'] as number) <= 10,
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
    requireSaved(
      Object.keys(s['pools'] as Record<string, unknown>).every((id) => poolVocabulary(runtime).includes(id)),
      `${p}.pools`,
    );
    if ('equipped' in s) {
      requireSaved(
        Array.isArray(s['equipped']) &&
          s['equipped'].every(
            (row) =>
              exact(row, ['slot', 'itemId']) &&
              typeof row['slot'] === 'string' &&
              typeof row['itemId'] === 'string',
          ),
        `${p}.equipped`,
      );
    }
    try {
      restoreCharacter(runtime, c as unknown as PlayMembers[number]['character']);
    } catch (error) {
      if (error instanceof CharacterBuildError) throw new RuntimeRuleError(error.errors);
      throw error;
    }
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
  requireSaved(
    ['exploration', 'encounter', 'reward-pending', 'completed', 'defeated', 'abandoned'].includes(
      saved.phase,
    ),
    'phase',
  );
  for (const [i, row] of saved.encounterReceipts.entries())
    requireSaved(
      exact(row, ['nodeId', 'receipt']) && typeof row.nodeId === 'string' && isRecord(row.receipt),
      `encounterReceipts[${i}]`,
    );
  for (const [i, r] of saved.rewards.entries()) {
    requireSaved(isRecord(r) && (r.status === 'pending' || r.status === 'claimed'), `rewards[${i}]`);
    if (r.roll !== null)
      requireSaved(
        exact(r.roll, ['tableId', 'value', 'rngBefore', 'rngAfter', 'result']) && isRecord(r.roll.result),
        `rewards[${i}].roll`,
      );
  }

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
  const nodes = new Map(definition.nodes.map((n) => [n.id, n]));
  const current = nodes.get(saved.nodeId)!;
  const expectedResolved = visited.filter(
    (id) =>
      nodes.get(id)!.kind !== 'encounter' ||
      saved.encounterReceipts.some((r) => r.nodeId === id && r.receipt.result === 'victory'),
  );
  requireSaved(
    same(saved.resolvedNodeIds, expectedResolved) &&
      saved.restedNodeIds.every((id) => expectedResolved.includes(id) && nodes.get(id)!.rest === 'once'),
    'resolvedNodeIds',
  );
  const generation = new Rng(streamKey('adventure-generation', saved.adventureId, saved.seed));
  let nestedSeed: number | undefined;
  for (const id of visited) if (nodes.get(id)!.kind === 'encounter') nestedSeed = generation.int(4294967296);
  requireSaved(same(saved.rng.generation, generation.getState()), 'rng.generation');
  if (saved.activeEncounter !== null) {
    const nested = restoreEncounterSession(pack, saved.activeEncounter).serialize();
    requireSaved(
      saved.phase === 'encounter' &&
        current.kind === 'encounter' &&
        !saved.resolvedNodeIds.includes(current.id) &&
        nested.phase === 'active' &&
        nested.encounterIndex === 0 &&
        nested.sessionId === JSON.stringify([saved.adventureId, current.id]) &&
        nested.seed === String(nestedSeed) &&
        same(nested.encounter.setup, current.encounter) &&
        same(nested.members, saved.members),
      'activeEncounter',
    );
    requireSaved(saved.encounterEventCursor === nested.sequence, 'encounterEventCursor');
  } else requireSaved(saved.phase !== 'encounter' && saved.encounterEventCursor === 0, 'activeEncounter');
  const receiptNodes = new Set<string>();
  for (const [i, row] of saved.encounterReceipts.entries()) {
    const sessionId = JSON.stringify([saved.adventureId, row.nodeId]),
      encounterId = JSON.stringify([sessionId, 0]);
    requireSaved(
      exact(row, ['nodeId', 'receipt']) &&
        visited.includes(row.nodeId) &&
        nodes.get(row.nodeId)?.kind === 'encounter' &&
        !receiptNodes.has(row.nodeId),
      `encounterReceipts[${i}]`,
    );
    receiptNodes.add(row.nodeId);
    const r = row.receipt;
    requireSaved(
      exact(r, [
        'receiptId',
        'sessionId',
        'encounterId',
        'encounterIndex',
        'revision',
        'result',
        'memberIds',
        'sourceHash',
        'beforeMembersHash',
        'afterMembersHash',
      ]) &&
        r.sessionId === sessionId &&
        r.encounterId === encounterId &&
        r.receiptId === JSON.stringify([sessionId, encounterId, 'settlement']) &&
        r.encounterIndex === 0 &&
        same(
          r.memberIds,
          saved.members.map((m) => m.memberId),
        ),
      `encounterReceipts[${i}].receipt`,
    );
    counter(r.revision, 'encounterReceipts.revision');
    requireSaved(
      ['victory', 'defeat', 'abandoned'].includes(r.result) &&
        [r.sourceHash, r.beforeMembersHash, r.afterMembersHash].every(
          (h) => typeof h === 'string' && /^[0-9a-f]{8}$/.test(h),
        ),
      'encounterReceipts',
    );
    requireSaved(
      r.result === 'victory' ||
        (row.nodeId === saved.nodeId && saved.phase === (r.result === 'defeat' ? 'defeated' : 'abandoned')),
      'encounterReceipts.result',
    );
  }
  requireSaved(
    visited
      .filter((id) => nodes.get(id)!.kind === 'encounter')
      .every((id) => (id === saved.nodeId && saved.activeEncounter !== null) || receiptNodes.has(id)),
    'encounterReceipts',
  );
  const expectedRewards = expectedResolved.flatMap((id) =>
    nodes.get(id)!.rewardIds.map((rewardId) => [id, rewardId]),
  );
  requireSaved(saved.rewards.length === expectedRewards.length, 'rewards');
  let rewardWords = new Rng(streamKey('adventure-rewards', saved.adventureId, saved.seed)).getState();
  const runtime = new Runtime(pack);
  for (const [i, r] of saved.rewards.entries()) {
    const path = `rewards[${i}]`,
      pair = expectedRewards[i]!;
    requireSaved(
      exact(
        r,
        [
          'claimId',
          'adventureId',
          'nodeId',
          'rewardId',
          'eligibleMemberIds',
          'xpPerMember',
          'stagedRevision',
          'roll',
          'status',
        ],
        r.status === 'claimed' ? ['receipt'] : [],
      ) &&
        (r.status === 'pending' || r.status === 'claimed'),
      path,
    );
    const authored = definition.rewards.find((reward) => reward.id === r.rewardId);
    requireSaved(
      !!authored &&
        r.nodeId === pair[0] &&
        r.rewardId === pair[1] &&
        r.adventureId === saved.adventureId &&
        r.claimId === JSON.stringify([saved.adventureId, r.nodeId, r.rewardId]) &&
        r.xpPerMember === authored.xpPerMember &&
        same(
          r.eligibleMemberIds,
          saved.members.map((m) => m.memberId),
        ),
      path,
    );
    if (r.status === 'claimed') {
      const receipt = r.receipt,
        grant = r.roll?.result.kind === 'item' ? r.roll.result : null;
      requireSaved(
        exact(receipt, [
          'receiptId',
          'adventureId',
          'definitionHash',
          'claimId',
          'nodeId',
          'rewardId',
          'revision',
          'eligibleMemberIds',
          'recipientMemberId',
          'xpPerMember',
          'grants',
          'beforeMembersHash',
          'afterMembersHash',
        ]),
        `${path}.receipt`,
      );
      counter(receipt.revision, `${path}.receipt.revision`);
      requireSaved(
        receipt.receiptId === JSON.stringify([saved.adventureId, r.claimId, 'reward']) &&
          receipt.adventureId === saved.adventureId &&
          receipt.definitionHash === definition.contentHash &&
          receipt.claimId === r.claimId &&
          receipt.nodeId === r.nodeId &&
          receipt.rewardId === r.rewardId &&
          receipt.xpPerMember === authored.xpPerMember &&
          same(receipt.eligibleMemberIds, r.eligibleMemberIds) &&
          receipt.revision > r.stagedRevision &&
          receipt.revision <= saved.revision,
        `${path}.receipt`,
      );
      requireSaved(
        authored.loot === null
          ? receipt.recipientMemberId === null
          : typeof receipt.recipientMemberId === 'string' &&
              r.eligibleMemberIds.includes(receipt.recipientMemberId),
        `${path}.receipt.recipientMemberId`,
      );
      requireSaved(
        same(
          receipt.grants,
          grant ? [{ memberId: receipt.recipientMemberId, itemId: grant.itemId, qty: grant.qty }] : [],
        ) &&
          [receipt.beforeMembersHash, receipt.afterMembersHash].every(
            (h) => typeof h === 'string' && /^[0-9a-f]{8}$/.test(h),
          ),
        `${path}.receipt.grants`,
      );
      if (receipt.revision === saved.revision)
        requireSaved(
          receipt.afterMembersHash === packContentHash(saved.members),
          `${path}.receipt.afterMembersHash`,
        );
    }
    counter(r.stagedRevision, `${path}.stagedRevision`);
    requireSaved(r.stagedRevision <= saved.revision, path);
    if (authored.loot === null) requireSaved(r.roll === null, `${path}.roll`);
    else {
      requireSaved(
        exact(r.roll, ['tableId', 'value', 'rngBefore', 'rngAfter', 'result']) &&
          r.roll.tableId === authored.loot.tableId &&
          same(r.roll.rngBefore, rewardWords),
        `${path}.roll`,
      );
      const rng = new Rng(rewardWords),
        outcome = rollLoot(runtime, authored.loot.tableId, rng);
      requireSaved(
        outcome.ok &&
          same(outcome.value, r.roll.value) &&
          same(r.roll.result, normalizeLoot(pack, r.roll.value)) &&
          same(r.roll.rngAfter, rng.getState()),
        `${path}.roll`,
      );
      rewardWords = rng.getState();
    }
  }
  requireSaved(same(saved.rng.rewards, rewardWords), 'rng.rewards');
  requireSaved(!saved.rewards.some((r) => r.status === 'pending' && r.nodeId !== saved.nodeId), 'rewards');
  const pending = saved.rewards.some((r) => r.nodeId === saved.nodeId && r.status === 'pending');
  if (saved.phase !== 'abandoned' && saved.phase !== 'defeated' && saved.phase !== 'encounter')
    requireSaved(
      saved.resolvedNodeIds.includes(saved.nodeId) &&
        saved.phase ===
          (pending ? 'reward-pending' : current.kind === 'success' ? 'completed' : 'exploration'),
      'phase',
    );
  if (saved.phase === 'defeated')
    requireSaved(
      saved.encounterReceipts.some((r) => r.nodeId === saved.nodeId && r.receipt.result === 'defeat'),
      'phase',
    );
  requireSaved(saved.sequence === saved.journal.length && saved.narrationAck <= saved.sequence, 'sequence');
  let eventRevision = 0;
  let journalNode = '';
  let enteredIndex = 0;
  let encounterStart = -1;
  const encounterSeeds = new Map<string, number>();
  const checkGeneration = new Rng(streamKey('adventure-generation', saved.adventureId, saved.seed));
  for (const id of visited)
    if (nodes.get(id)!.kind === 'encounter') encounterSeeds.set(id, checkGeneration.int(4294967296));
  const memberSubjects = new Map(
    saved.members.map((m) => [
      `m:${m.memberId}`,
      { id: `m:${m.memberId}`, memberId: m.memberId, name: m.character.state.name },
    ]),
  );
  let enemySubjects = new Map<string, { id: string; name: string }>();
  const entered = new Map<string, number>();
  const ended = new Map<string, number>();
  let membersHash: string | undefined;
  const claimedIds = new Set<string>();
  const settledIds = new Set<string>();
  const startedIds = new Set<string>();

  for (const [i, entry] of saved.journal.entries()) {
    requireSaved(
      exact(entry, ['sequence', 'revision', 'event', 'subjects']) &&
        Number.isSafeInteger(entry.revision) &&
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
        entry.event.type.length > 0 &&
        exact(entry.event.at, ['round', 'turn']) &&
        isRecord(entry.event.payload) &&
        exact(entry.event.why, ['rule', 'rolls']) &&
        typeof entry.event.why.rule === 'string' &&
        entry.event.why.rule.length > 0 &&
        Array.isArray(entry.event.why.rolls) &&
        entry.event.why.rolls.every((v) => typeof v === 'string') &&
        [entry.event.actor, entry.event.target].every(
          (v) => v === undefined || (typeof v === 'string' && v.length > 0),
        ),
      `journal[${i}].event`,
    );
    counter(entry.event.at.round, 'journal.at.round');
    counter(entry.event.at.turn, 'journal.at.turn');
    if (entry.event.type === 'node:entered') {
      const id = entry.event.payload['nodeId'];
      requireSaved(
        id === visited[enteredIndex] &&
          entry.revision === (enteredIndex === 0 ? 0 : saved.choiceTrail[enteredIndex - 1]!.revision),
        `journal[${i}].event.payload.nodeId`,
      );
      journalNode = id as string;
      entered.set(journalNode, entry.revision);
      enteredIndex++;
      enemySubjects = new Map();
    }
    requireSaved(journalNode.length > 0, `journal[${i}]`);
    if (entry.event.type === 'combat:start') {
      const node = nodes.get(journalNode)!;
      requireSaved(node.kind === 'encounter' && !startedIds.has(journalNode), `journal[${i}]`);
      startedIds.add(journalNode);
      const setup = node.encounter!,
        seed = encounterSeeds.get(journalNode)!;
      const selected = assembleEncounter(runtime, {
        budget: setup.budget,
        seed: String(setup.seed),
        rng: new Rng(
          streamKey(
            'encounter-generation',
            JSON.stringify([saved.adventureId, node.id]),
            String(seed),
            0,
            String(setup.seed),
          ),
        ),
      });
      const monsters = selected.groups.flatMap((g) => Array.from({ length: g.count }, () => g.id));
      enemySubjects = new Map(
        monsters.map((id, j) => {
          const enemyId = `e:0:${j + 1}`;
          return [enemyId, { id: enemyId, name: pack.bestiary[id]!.name }];
        }),
      );
      encounterStart = i;
    }
    if (
      entry.event.type === 'encounter:settled' ||
      entry.event.type === 'reward:claimed' ||
      entry.event.type === 'members:updated'
    ) {
      const payload = entry.event.payload;
      let before: unknown, after: unknown;
      if (entry.event.type === 'members:updated') {
        requireSaved(
          payload['nodeId'] === journalNode &&
            ['rest', 'prepare', 'equip', 'unequip', 'use-item'].includes(String(payload['command'])),
          `journal[${i}].event.payload`,
        );
        before = payload['beforeMembersHash'];
        after = payload['afterMembersHash'];
      } else {
        const r = payload['receipt'];
        requireSaved(isRecord(r), `journal[${i}].event.payload.receipt`);
        before = r['beforeMembersHash'];
        after = r['afterMembersHash'];
        if (entry.event.type === 'reward:claimed') {
          const reward = saved.rewards.find((reward) => reward.claimId === r['claimId']);
          requireSaved(
            reward?.status === 'claimed' &&
              same(reward.receipt, r) &&
              reward.receipt.revision === entry.revision &&
              reward.nodeId === journalNode &&
              !claimedIds.has(reward.claimId),
            `journal[${i}].event.payload.receipt`,
          );
          claimedIds.add(reward.claimId);
        } else {
          const row = saved.encounterReceipts.find((row) => row.nodeId === journalNode);
          requireSaved(
            payload['nodeId'] === journalNode &&
              row !== undefined &&
              same(row.receipt, r) &&
              !settledIds.has(journalNode),
            `journal[${i}].event.payload.receipt`,
          );
          ended.set(journalNode, entry.revision);
          settledIds.add(journalNode);
        }
      }
      requireSaved(
        typeof before === 'string' &&
          typeof after === 'string' &&
          /^[0-9a-f]{8}$/.test(before) &&
          /^[0-9a-f]{8}$/.test(after) &&
          (membersHash === undefined || before === membersHash),
        `journal[${i}].event.payload`,
      );
      membersHash = after;
    }
    const subjects = new Map([...memberSubjects, ...enemySubjects]);
    const referenced = new Set<string>();
    const visit = (v: unknown): void => {
      if (typeof v === 'string') referenced.add(v);
      else if (Array.isArray(v)) v.forEach(visit);
      else if (isRecord(v)) Object.values(v).forEach(visit);
    };
    // Receipt memberIds are opaque host ids, not combatant references.
    visit(
      ['encounter:settled', 'reward:claimed', 'members:updated'].includes(entry.event.type)
        ? [entry.event.actor, entry.event.target]
        : entry.event,
    );
    requireSaved(
      new Set(entry.subjects.map((subject) => (isRecord(subject) ? subject.id : null))).size ===
        entry.subjects.length,
      `journal[${i}].subjects`,
    );
    for (const subject of entry.subjects)
      requireSaved(
        exact(subject, ['id', 'name'], ['memberId']) &&
          typeof subject.id === 'string' &&
          same(subjects.get(subject.id), subject) &&
          referenced.has(subject.id),
        `journal[${i}].subjects`,
      );
    for (const id of [
      entry.event.actor,
      entry.event.target,
      ...[...referenced].filter((id) => subjects.has(id)),
    ])
      if (id !== undefined)
        requireSaved(
          entry.subjects.some((subject) => subject.id === id),
          `journal[${i}].subjects`,
        );
  }
  requireSaved(enteredIndex === visited.length, 'journal');
  requireSaved(membersHash === undefined || membersHash === packContentHash(saved.members), 'members');
  requireSaved(
    claimedIds.size === saved.rewards.filter((r) => r.status === 'claimed').length &&
      settledIds.size === saved.encounterReceipts.length,
    'journal',
  );
  if (saved.activeEncounter) {
    requireSaved(encounterStart >= 0, 'journal');
    const copied = saved.journal.slice(encounterStart).map(({ event, subjects }) => ({ event, subjects }));
    const nested = saved.activeEncounter.journal
      .slice(0, saved.encounterEventCursor)
      .map(({ event, subjects }) => ({ event, subjects }));
    requireSaved(
      same(copied, nested),
      'encounterEventCursor',
      'Copied journal prefix differs from the active encounter.',
    );
  }
  const expectedReceiptNodes = visited.filter(
    (id) => nodes.get(id)!.kind === 'encounter' && !(id === saved.nodeId && saved.activeEncounter),
  );
  requireSaved(
    same(
      saved.encounterReceipts.map((r) => r.nodeId),
      expectedReceiptNodes,
    ),
    'encounterReceipts',
  );
  for (const row of saved.encounterReceipts) {
    const r = row.receipt;
    requireSaved(r.revision <= saved.revision - entered.get(row.nodeId)! + 1, 'encounterReceipts.revision');
    if (r.result !== 'abandoned') requireSaved(ended.has(row.nodeId), 'encounterReceipts.result');
  }
  for (const r of saved.rewards) {
    const resolvedAt =
      nodes.get(r.nodeId)!.kind === 'encounter' ? ended.get(r.nodeId) : entered.get(r.nodeId);
    requireSaved(r.stagedRevision === resolvedAt, 'rewards.stagedRevision');
    const nextStep = saved.choiceTrail.find((step) => step.nodeId === r.nodeId);
    if (r.status === 'claimed' && nextStep)
      requireSaved(r.receipt.revision < nextStep.revision, 'rewards.receipt.revision');
  }
  if (saved.phase === 'abandoned') requireSaved(current.kind !== 'success' || pending, 'phase');
  return detached(saved);
}

/** Mechanical progress excludes entropy, transport revisions and presentation cursors. */
export function mechanicalHash(saved: AdventureSnapshot): string {
  const encounter = saved.activeEncounter?.encounter;
  let combat = null;
  if (encounter) {
    const raw = { ...encounter.combat };
    Reflect.deleteProperty(raw, 'rng');
    combat = { raw, positions: encounter.positions, terrain: encounter.terrain, control: encounter.control };
  }
  return packContentHash({
    nodeId: saved.nodeId,
    phase: saved.phase,
    members: saved.members,
    combat,
    resolvedNodeIds: saved.resolvedNodeIds,
    restedNodeIds: saved.restedNodeIds,
    rewards: saved.rewards.map((r) => ({ claimId: r.claimId, status: r.status })),
  });
}
