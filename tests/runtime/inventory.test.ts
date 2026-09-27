/**
 * CAP-01/CA-02 suite — inventory lifecycle + loot resolution: stacks, drops,
 * counts, the named-rejection vocabulary, grantLoot's CA-02 value mapping
 * (string item id / {id, qty} object / flavor), determinism per seed, the
 * normalized dual-space nested resolver (the fixture's `tables.`-prefixed
 * chain + a local bare-id chain mirroring the shipped themes), the
 * failed-outcome → named-rejection mapping, and the restart leg's serialize
 * half (state purity + lossless envelope contents).
 *
 * Seed choices are RECORDED OBSERVATIONS over the committed fixture tables
 * (Rng is deterministic per seed — same seed, same branch, always):
 *   district-scavenge (weighted 3×'bandage' flavor / 1×{id:'rope', qty:1}):
 *     seed 0 → the rope grant; seed 1 → 'bandage' flavor ⇒ loot-grants-nothing;
 *     seed 42 → 'bandage' too (the table's one grantable entry hides at most
 *     seeds — grant-vs-nothing, never a second grantable kind).
 *   loot-chain (nested: 'tables.district-scavenge' + weight-1 'nothing'):
 *     seed 6 → rope grant, seed 1 → 'bandage' flavor skip, seed 0 → the
 *     'nothing' entry selected ⇒ unresolvable-ref (see the failed-outcome
 *     describe block).
 */
import { describe, expect, it } from 'vitest';
import { Runtime } from '../../src/runtime/runtime';
import { RuntimeRuleError } from '../../src/runtime/errors';
import type { ErrorCard } from '../../src/schema/error-card';
import {
  grantItem,
  dropItem,
  countItem,
  rollLoot,
  grantLoot,
} from '../../src/runtime/inventory';
import { createCharacter } from '../../src/runtime/character';
import { serializeCharacter } from '../../src/runtime/snapshots';
import { Rng } from '../../src/core/rng';
import { rollTable, type TableOutcome } from '../../src/core/tables';
import { cloneRuntimePack } from './fixtures/pack';
import type { CharacterState } from '../../src/runtime/runtime';
import type { Pack } from '../../src/schema/pack';

function vale(): { runtime: Runtime; character: CharacterState } {
  const runtime = new Runtime(cloneRuntimePack());
  const character = createCharacter(runtime, { name: 'Brynn', race: 'hillfolk', classes: ['warden'] });
  return { runtime, character: character.state };
}

function ruleOf(error: unknown): string {
  return ((error as RuntimeRuleError).errors as readonly ErrorCard[])[0]!.rule;
}

describe('CAP-01 — grant / drop / count over {id, qty} stacks', () => {
  it('grants a default qty of 1 and emits item:granted provenanced by the item declaration', () => {
    const { runtime, character } = vale();
    const event = grantItem(runtime, character, 'rope');
    expect(character.inventory).toEqual([{ id: 'rope', qty: 1 }]);
    expect(event.type).toBe('item:granted');
    expect(event.actor).toBe(character.id);
    expect(event.payload).toEqual({ itemId: 'rope', qty: 1, total: 1 });
    expect(event.why).toEqual({ rule: 'content.items.rope', rolls: [] });
  });

  it('stacks repeated grants by id and reports the running total', () => {
    const { runtime, character } = vale();
    grantItem(runtime, character, 'rope', 2);
    const event = grantItem(runtime, character, 'rope', 3);
    expect(character.inventory).toEqual([{ id: 'rope', qty: 5 }]);
    expect(event.payload).toEqual({ itemId: 'rope', qty: 3, total: 5 });
  });

  it('drops to removal at qty 0 and emits item:dropped with the remaining stack', () => {
    const { runtime, character } = vale();
    grantItem(runtime, character, 'rope', 4);
    const event = dropItem(runtime, character, 'rope', 3);
    expect(character.inventory).toEqual([{ id: 'rope', qty: 1 }]);
    expect(event.type).toBe('item:dropped');
    expect(event.payload).toEqual({ itemId: 'rope', qty: 3, remaining: 1 });
    dropItem(runtime, character, 'rope');
    expect(character.inventory).toEqual([]);
    expect(countItem(runtime, character, 'rope')).toBe(0);
  });

  it('drops exactly the held qty: partial drops keep the stack, the last drop removes it', () => {
    const { runtime, character } = vale();
    grantItem(runtime, character, 'rope', 2);
    dropItem(runtime, character, 'rope', 1);
    expect(character.inventory).toEqual([{ id: 'rope', qty: 1 }]);
    dropItem(runtime, character, 'rope', 1);
    expect(character.inventory).toEqual([]);
  });

  it('rejects an unknown item with no durable change (unknown-item)', () => {
    const { runtime, character } = vale();
    expect(() => grantItem(runtime, character, 'bandage', 1)).toThrow(RuntimeRuleError);
    try {
      grantItem(runtime, character, 'bandage', 1);
      expect.unreachable();
    } catch (error) {
      expect(ruleOf(error)).toBe('unknown-item');
      expect(((error as RuntimeRuleError).errors[0] as ErrorCard).jsonPath).toBe('content.items.bandage');
    }
    expect(character.inventory).toEqual([]);
    expect(() => dropItem(runtime, character, 'bandage')).toThrow(/unknown item/);
    expect(() => countItem(runtime, character, 'bandage')).toThrow(/unknown item/);
  });

  it('rejects dropping a declared item never held (item-not-held) with no durable change', () => {
    const { runtime, character } = vale();
    grantItem(runtime, character, 'rope');
    dropItem(runtime, character, 'rope', 1);
    try {
      dropItem(runtime, character, 'rope', 1);
      expect.unreachable();
    } catch (error) {
      expect(ruleOf(error)).toBe('item-not-held');
    }
    expect(character.inventory).toEqual([]);
  });

  it('rejects an overdraw with named held vs requested qty (insufficient-qty), state unchanged', () => {
    const { runtime, character } = vale();
    grantItem(runtime, character, 'rope', 2);
    try {
      dropItem(runtime, character, 'rope', 3);
      expect.unreachable();
    } catch (error) {
      expect(ruleOf(error)).toBe('insufficient-qty');
      expect(String(error)).toMatch(/held x2/);
      expect(String(error)).toMatch(/dropping 3/);
    }
    expect(character.inventory).toEqual([{ id: 'rope', qty: 2 }]);
  });

  it('rejects non-positive-integer amounts with the invalid-amount rule (mirrors invalid-spend)', () => {
    const { runtime, character } = vale();
    for (const bad of [0, -2, 1.5, Number.NaN]) {
      expect(() => grantItem(runtime, character, 'rope', bad)).toThrow(RuntimeRuleError);
      expect(() => dropItem(runtime, character, 'rope', bad)).toThrow(RuntimeRuleError);
      try {
        grantItem(runtime, character, 'rope', bad);
        expect.unreachable();
      } catch (error) {
        expect(ruleOf(error)).toBe('invalid-amount');
      }
    }
    expect(character.inventory).toEqual([]);
  });

  it('counts zero for a declared item never held (a read, no event, no mutation)', () => {
    const { runtime, character } = vale();
    expect(countItem(runtime, character, 'rope')).toBe(0);
    expect(runtime.events.sinceRound(0).length).toBe(1); // only character:created
  });

  it('facade methods delegate one-to-one to the module verbs', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = createCharacter(runtime, { name: 'Brynn', race: 'hillfolk', classes: ['warden'] });
    character.grant('rope', 2);
    expect(character.count('rope')).toBe(2);
    character.drop('rope', 1);
    expect(character.state.inventory).toEqual([{ id: 'rope', qty: 1 }]);
    expect(() => character.drop('rope', 5)).toThrow(RuntimeRuleError);
    expect(() => character.drop('rope-x')).toThrow(RuntimeRuleError);
    expect(() => character.grant('rope', 0)).toThrow(RuntimeRuleError);
  });
});

describe('CAP-02 — grantLoot rolls the one table engine into inventory (CA-02)', () => {
  it('the district-scavenge roll is deterministic per seed and maps {id, qty} to a grant (seed 0)', () => {
    const { runtime, character } = vale();
    const events = grantLoot(runtime, character, 'district-scavenge', { seed: 0 });
    expect(events.map((event) => event.type)).toEqual(['loot:rolled', 'item:granted']);
    expect(character.inventory).toEqual([{ id: 'rope', qty: 1 }]);
    const rolled = events[0]!;
    expect(rolled.type).toBe('loot:rolled');
    expect(rolled.actor).toBe(character.id);
    expect(rolled.why).toEqual({ rule: 'tables.district-scavenge', rolls: [] });
    expect(rolled.payload.tableId).toBe('district-scavenge');
    expect(rolled.payload.grants).toEqual([{ id: 'rope', qty: 1 }]);
    expect(rolled.payload.value).toEqual({ id: 'rope', qty: 1 });
    expect(events[1]!.payload).toEqual({ itemId: 'rope', qty: 1, total: 1 });
    expect(events[1]!.why.rule).toBe('content.items.rope');
  });

  it('same seed ⇒ identical grants; the recorded different-seed observation stays stable', () => {
    const first = vale();
    const second = vale();
    const a = grantLoot(first.runtime, first.character, 'district-scavenge', { seed: 0 });
    const b = grantLoot(second.runtime, second.character, 'district-scavenge', { seed: 0 });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(second.character.inventory).toEqual(first.character.inventory);

    // Seed 4's recorded branch is the same rope grant — the table's only
    // grantable entry is the rope object (3×bandage flavor is the rest), so
    // cross-seed divergence here is grant-vs-nothing, not grant-vs-grant.
    const third = vale();
    grantLoot(third.runtime, third.character, 'district-scavenge', { seed: 4 });
    expect(third.character.inventory).toEqual([{ id: 'rope', qty: 1 }]);
  });

  it('a roll yielding no grantable value rejects loot-grants-nothing with state unchanged and no loot event', () => {
    const { runtime, character } = vale();
    const before = JSON.stringify(character);
    try {
      grantLoot(runtime, character, 'district-scavenge', { seed: 1 }); // recorded: 'bandage'
      expect.unreachable();
    } catch (error) {
      expect(ruleOf(error)).toBe('loot-grants-nothing');
      expect(((error as RuntimeRuleError).errors[0] as ErrorCard).jsonPath).toBe('tables.district-scavenge');
    }
    expect(JSON.stringify(character)).toBe(before);
    expect(runtime.events.sinceRound(0).some((event) => event.type === 'loot:rolled')).toBe(false);
  });

  it('CA-02 branch: a bare string resolving in content.items grants qty 1 (seeded string branch)', () => {
    const pack = cloneRuntimePack();
    pack.tables['leaf-loot'] = {
      kind: 'weighted',
      entries: [{ weight: 1, value: 'rope' }], // a bare item id — CA-02 string branch
    };
    const runtime = new Runtime(pack);
    const character = createCharacter(runtime, { name: 'A', race: 'ashkin', classes: ['warden'] }).state;
    grantLoot(runtime, character, 'leaf-loot', { seed: 1 });
    expect(character.inventory).toEqual([{ id: 'rope', qty: 1 }]);
    const events = runtime.events.sinceRound(0).filter((event) => event.type !== 'character:created');
    expect(events[0]!.payload.value).toBe('rope');
    expect(events[0]!.payload.grants).toEqual([{ id: 'rope', qty: 1 }]);
  });

  it('CA-02 branch: flavor values are skipped, not errors — a roll that also grants succeeds', () => {
    const pack = cloneRuntimePack();
    pack.tables['flavored'] = {
      kind: 'weighted',
      entries: [
        { weight: 1, value: 'bandage' }, // a string not in content.items — flavor
        { weight: 1, value: { id: 'rope', qty: 2 } }, // a real grant
      ],
    };
    const runtime = new Runtime(pack);
    const character = createCharacter(runtime, { name: 'B', race: 'ashkin', classes: ['warden'] }).state;
    grantLoot(runtime, character, 'flavored', { rng: { int: () => 1 } });// draw 1 selects the rope entry
    expect(character.inventory).toEqual([{ id: 'rope', qty: 2 }]);
    const events = runtime.events.sinceRound(0).filter((event) => event.type !== 'character:created');
    expect(events.map((event) => event.type)).toEqual(['loot:rolled', 'item:granted']);
    expect(events[0]!.payload.value).toEqual({ id: 'rope', qty: 2 });
    expect(events[0]!.payload.grants).toEqual([{ id: 'rope', qty: 2 }]);
  });

  it('CA-02 branch: {id, qty} stacks by id with a prior grant', () => {
    const { runtime, character } = vale();
    grantItem(runtime, character, 'rope', 1);
    grantLoot(runtime, character, 'district-scavenge', { seed: 0 });
    expect(character.inventory).toEqual([{ id: 'rope', qty: 2 }]);
  });

  it('CA-02 keeps vocabularies distinct: a string condition id in a loot table is flavor, not a condition', () => {
    const { runtime, character } = vale();
    expect(() => grantLoot(runtime, character, 'wandering-dread', { seed: 0 })).toThrow(
      /nothing grantable/,
    );
    expect(character.conditions).toEqual([]);
    expect(character.inventory).toEqual([]);
  });

  it('rejects an unresolved table id (unknown-table, mirror of unknown-theme) with state unchanged', () => {
    const { runtime, character } = vale();
    expect(() => grantLoot(runtime, character, 'no-such-table', { seed: 0 })).toThrow(RuntimeRuleError);
    try {
      grantLoot(runtime, character, 'no-such-table', { seed: 0 });
      expect.unreachable();
    } catch (error) {
      expect(ruleOf(error)).toBe('unknown-table');
      expect(((error as RuntimeRuleError).errors[0] as ErrorCard).artifactId).toBe('no-such-table');
    }
    expect(character.inventory).toEqual([]);
  });

  it('rollLoot rejects an unresolved table id too (the raw inspection seam shares the gate)', () => {
    const { runtime } = vale();
    expect(() => rollLoot(runtime, 'no-such-table', new Rng(0))).toThrow(/unknown table/);
  });

  it('opts.rng wins over the seed; an injected stream steers the roll (FR-1 injection)', () => {
    const { runtime, character } = vale();
    grantLoot(runtime, character, 'district-scavenge', { rng: { int: () => 3 } });
    expect(character.inventory).toEqual([{ id: 'rope', qty: 1 }]);

    const flavored = vale();
    expect(() =>
      grantLoot(flavored.runtime, flavored.character, 'district-scavenge', { rng: { int: () => 0 } }),
    ).toThrow(/nothing grantable/);
    expect(flavored.character.inventory).toEqual([]); // flavor branch rejected, state unchanged
    expect(() =>
      grantLoot(flavored.runtime, flavored.character, 'district-scavenge', { rng: { int: () => 0 } }),
    ).toThrow(/nothing grantable/);
  });

  it('seeded determinism holds through the facade (char.loot) and across seeds', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const brynn = createCharacter(runtime, { name: 'Brynn', race: 'hillfolk', classes: ['warden'] });
    const events = brynn.loot('district-scavenge', { seed: 0 });
    expect(brynn.state.inventory).toEqual([{ id: 'rope', qty: 1 }]);
    expect(events.length).toBe(2);
    expect(() => brynn.loot('wandering-dread', { seed: 0 })).toThrow(RuntimeRuleError);
  });
});

describe('CAP-02 — nested recursion resolves in BOTH reference spaces (CA-02, REPLAN-LOOT-01)', () => {
  it('the committed fixture chain resolves its tables.-prefixed inner ref (seed 6 → the rope grant)', () => {
    const { runtime, character } = vale();
    const events = grantLoot(runtime, character, 'loot-chain', { seed: 6 });
    expect(character.inventory).toEqual([{ id: 'rope', qty: 1 }]);
    const rolled = events[0]!;
    expect(rolled.type).toBe('loot:rolled');
    expect(rolled.why.rule).toBe('tables.loot-chain');
    expect(rolled.payload.tableId).toBe('loot-chain');
    expect(rolled.payload.value).toEqual({ id: 'rope', qty: 1 });
    expect(rolled.payload.grants).toEqual([{ id: 'rope', qty: 1 }]);
    expect(events[1]!.why.rule).toBe('content.items.rope');
  });

  it('a bare-id nested ref resolves too - the shipped themes barrow-loot to common-relics shape (any seed grants)', () => {
    const runtime = new Runtime(inventoryValePack());
    const character = createCharacter(runtime, { name: 'C', race: 'hillfolk', classes: ['warden'] }).state;
    grantLoot(runtime, character, 'barrow-chain', { seed: 1 });
    expect(character.inventory).toEqual([{ id: 'rope', qty: 2 }]);
  });

  it('both forms land the same grant for the same leaf — the resolver is the only space-aware piece', () => {
    const prefixed = vale();
    grantLoot(prefixed.runtime, prefixed.character, 'loot-chain', { seed: 6 });
    const bare = new Runtime(inventoryValePack());
    const bareChar = createCharacter(bare, { name: 'D', race: 'hillfolk', classes: ['warden'] }).state;
    grantLoot(bare, bareChar, 'barrow-chain', { seed: 6 });
    expect(bareChar.inventory).toEqual([{ id: 'rope', qty: 2 }]); // the bare chain's own leaf value
    expect(prefixed.character.inventory).toEqual([{ id: 'rope', qty: 1 }]); // the prefixed chain's own leaf value
  });
});

describe('CAP-02 — failed roll outcomes map to named rejections, state unchanged (no loot event)', () => {
  it('the committed chain’s weight-1 nothing branch rejects unresolvable-ref with the failure jsonPath, state unchanged (seed 0)', () => {
    // The committed loot-chain entry value 'nothing' is not a table id: when
    // the roll lands it, the nested roll fails with the engine's typed
    // unresolvable-ref outcome — grantLoot maps it to the named rejection
    // instead of being silent. This IS the failed-outcome branch, reached
    // through the committed fixture, deterministically at seed 0.
    const { runtime, character } = vale();
    const before = JSON.stringify(character);
    expect(() => grantLoot(runtime, character, 'loot-chain', { seed: 0 })).toThrow(RuntimeRuleError);
    try {
      grantLoot(runtime, character, 'loot-chain', { seed: 0 });
      expect.unreachable();
    } catch (error) {
      expect(ruleOf(error)).toBe('unresolvable-ref');
      expect(((error as RuntimeRuleError).errors[0] as ErrorCard).artifactId).toBe('loot-chain');
      expect(((error as RuntimeRuleError).errors[0] as ErrorCard).jsonPath).toBe(
        'tables.loot-chain.entries[1]',
      );
    }
    expect(JSON.stringify(character)).toBe(before);
    expect(runtime.events.sinceRound(0).some((event) => event.type === 'loot:rolled')).toBe(false);
  });

  it('a dangling BARE-id inner ref rejects unresolvable-ref with the failure’s jsonPath, state unchanged', () => {
    const pack = cloneRuntimePack();
    pack.tables['dangling'] = {
      kind: 'nested',
      entries: [{ value: 'no-such-table' }], // bare id — not declared; load validation cannot catch it (E-REF-01 checks only tables.-prefixed strings)
    };
    const runtime = new Runtime(pack);
    const character = createCharacter(runtime, { name: 'E', race: 'hillfolk', classes: ['warden'] }).state;
    const before = JSON.stringify(character);
    expect(() => grantLoot(runtime, character, 'dangling', { seed: 0 })).toThrow(RuntimeRuleError);
    try {
      grantLoot(runtime, character, 'dangling', { seed: 0 });
      expect.unreachable();
    } catch (error) {
      expect(ruleOf(error)).toBe('unresolvable-ref');
      expect(((error as RuntimeRuleError).errors[0] as ErrorCard).artifactId).toBe('dangling');
      expect(((error as RuntimeRuleError).errors[0] as ErrorCard).jsonPath).toBe('tables.dangling.entries[0]');
    }
    expect(JSON.stringify(character)).toBe(before);
    expect(runtime.events.sinceRound(0).some((event) => event.type === 'loot:rolled')).toBe(false);
  });

  it('a tables.-prefixed dangling inner ref is guarded at LOAD (E-REF-01) — the runtime branch is the second net', () => {
    const pack = cloneRuntimePack();
    pack.tables['dangling-prefixed'] = {
      kind: 'nested',
      entries: [{ value: 'tables.no-such-table' }],
    };
    expect(() => new Runtime(pack)).toThrow(/does not exist in this pack/);
  });

  it('the raw table roll surfaces a malformed nested def as the typed outcome (the second net’s inspection seam)', () => {
    const outcome = rollTableDirect();
    expect(outcome.ok).toBe(false);
    expect(outcome.ok ? undefined : outcome.failure.reason).toBe('unresolvable-ref');
    expect(outcome.ok ? undefined : outcome.failure.jsonPath).toBe('tables.malformed-ref.entries[0]');
  });

  it('a depth-exceeded roll rejects table-roll-failed naming the core reason (no silent skip)', () => {
    const pack = inventoryValePack();
    // Self-referencing nested table: the roll recurses until MAX_TABLE_DEPTH
    // (8) is exceeded — the engine's typed depth-exceeded outcome, mapped to
    // the named runtime rejection. (The load validator would refuse this pack
    // for its cycle; Runtime's fail-closed recheck is bypassed by building
    // the def in place — the negative control needs the raw def, and load
    // rejection of this exact shape is proven in the schema suite.)
    pack.tables['deep-loop'] = { kind: 'nested', entries: [{ value: 'deep-loop' }] };
    const runtime = new Runtime(pack);
    const character = createCharacter(runtime, { name: 'G', race: 'hillfolk', classes: ['warden'] }).state;
    try {
      grantLoot(runtime, character, 'deep-loop', { seed: 0 });
      expect.unreachable();
    } catch (error) {
      expect(ruleOf(error)).toBe('table-roll-failed');
      expect(String(error)).toMatch(/MAX_TABLE_DEPTH/);
    }
    expect(character.inventory).toEqual([]);
  });
});

describe('CAP-01/CA-01 — inventory state is plain JSON and serializes losslessly (the restart leg’s first half)', () => {
  it('inventory survives structuredClone / JSON.stringify equality (no class leakage)', () => {
    const { runtime, character } = vale();
    grantItem(runtime, character, 'rope', 2);
    grantItem(runtime, character, 'rope', 1);
    dropItem(runtime, character, 'rope', 1);
    expect(structuredClone(character)).toEqual(character);
    expect(JSON.parse(JSON.stringify(character))).toEqual(character);
  });

  it('serializeCharacter carries the exact held stacks into the envelope', () => {
    const { runtime, character } = vale();
    grantItem(runtime, character, 'rope', 3);
    const snap = serializeCharacter(runtime, character);
    expect(snap.state.inventory).toEqual([{ id: 'rope', qty: 3 }]);
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
  });

  it('loot then grant compose into one stacked inventory, and the envelope shows it', () => {
    const { runtime, character } = vale();
    grantLoot(runtime, character, 'district-scavenge', { seed: 0 });
    grantItem(runtime, character, 'rope', 2);
    expect(character.inventory).toEqual([{ id: 'rope', qty: 3 }]);
    expect(serializeCharacter(runtime, character).state.inventory).toEqual([{ id: 'rope', qty: 3 }]);
  });
});

/**
 * A local in-lease pack for the bare-id nested-ref proof (theme-space
 * convention): every nested ref is a bare table id, no `tables.` prefixes —
 * mirroring dark-fantasy.json's `barrow-loot → common-relics` chain. This
 * pack must still pass load validation (built by mutating the validating
 * fixture clone before the Runtime sees it).
 */
function inventoryValePack(): Pack {
  const pack = cloneRuntimePack();
  pack.tables['common-relics'] = {
    kind: 'weighted',
    entries: [{ weight: 1, value: { id: 'rope', qty: 2 } }],
  };
  pack.tables['barrow-chain'] = {
    kind: 'nested',
    entries: [{ value: 'common-relics' }],
  };
  return pack;
}

function rollTableDirect(): TableOutcome {
  return rollTable(
    { kind: 'nested', entries: [{ value: 'tables.no-such-table' }] },
    new Rng(0),
    { jsonPath: 'tables.malformed-ref', resolve: () => undefined },
  );
}
