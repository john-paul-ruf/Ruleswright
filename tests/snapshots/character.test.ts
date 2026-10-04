/**
 * CAP-7 checkpoint 1 — character snapshots (FR-14): envelope conformance,
 * round-trip losslessness, plain-JSON purity, no-aliasing, pack identity.
 * Loot-inventory SESSION-01 ck2 adds the inventory fidelity proofs (CAP-01/CA-01):
 * held stacks serialize verbatim and restore round-trips them losslessly.
 */
import { describe, expect, it } from 'vitest';
import { Runtime } from '../../src/runtime/runtime';
import { createCharacter } from '../../src/runtime/character';
import {
  serializeCharacter,
  serializeParty,
  restoreCharacter,
  restoreParty,
} from '../../src/runtime/snapshots';
import type { CharacterState } from '../../src/runtime/runtime';
import { cloneRuntimePack } from '../runtime/fixtures/pack';
import { packContentHash } from '../../src/schema/version';

/**
 * A hexer with a prepared level-1 slot and spent pool points — the snapshot's
 * non-trivial state. Level 2: the fixture's hexer table grants zero level-1
 * slots at hexer level 1 (progression is pack data, FR-6).
 */
function hexer(runtime: Runtime): CharacterState {
  const character = createCharacter(runtime, {
    name: 'Vex',
    race: 'ashkin',
    classes: [{ id: 'hexer', level: 2 }],
  });
  character.prepare('hex-bolt', 0);
  character.spend('stamina', 3);
  character.state.spells.push('hex-bolt');
  return character.state;
}

describe('character snapshots (FR-14, CAP-7)', () => {
  it('the envelope carries exactly the contract fields — no extras, no omissions', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const snap = serializeCharacter(runtime, hexer(runtime));
    expect(Object.keys(snap).sort()).toEqual(['kind', 'pack', 'snapshotVersion', 'state']);
    expect(snap.kind).toBe('character');
    expect(snap.snapshotVersion).toBe(1);
    expect(Object.keys(snap.pack).sort()).toEqual(['contentHash', 'id', 'schemaVersion']);
    expect(Object.keys(snap.state).sort()).toEqual([
      'abilities',
      'classes',
      'conditions',
      'inventory',
      'knownSpells',
      'name',
      'pools',
      'race',
      'slots',
    ]);
    expect(snap.pack.id).toBe('test-vale');
    expect(snap.pack.schemaVersion).toBe(1);
    expect(snap.pack.contentHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('the classes + XP split field is lossless (FR-6/FR-14: per-class xp ⇄ classXp)', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = createCharacter(runtime, {
      name: 'Ald',
      race: 'hillfolk',
      classes: [
        { id: 'warden', level: 3 },
        { id: 'hexer', level: 2 },
      ],
    });
    runtime.awardXp(character, 5500);
    const snap = serializeCharacter(runtime, character.state);
    // Documented v1 split: even shares (5500/2 = 2750 each); the warden's
    // share keeps level 3, the hexer's share clamps at the hillfolk cap (2).
    expect(snap.state.classes).toEqual([
      { id: 'warden', level: 3, xp: 2750 },
      { id: 'hexer', level: 2, xp: 2750 },
    ]);
  });

  it('serialize → JSON → deserialize deep-equals the original state (round-trip losslessness)', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const state = hexer(runtime);
    const snap = serializeCharacter(runtime, state);
    const roundTrip = JSON.parse(JSON.stringify(snap)) as typeof snap;
    const restored = restoreCharacter(new Runtime(cloneRuntimePack()), roundTrip);
    expect(restored.state).toEqual(state);
  });

  it('plain-JSON purity: structuredClone / JSON equality — no class leakage', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const snap = serializeCharacter(runtime, hexer(runtime));
    expect(snap).toEqual(structuredClone(snap));
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
    expect(snap.state.slots['1']).toEqual(['hex-bolt']);
  });

  it('no aliasing: mutating the restored state leaves the snapshot untouched', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const state = hexer(runtime);
    const snap = serializeCharacter(runtime, state);
    const restored = restoreCharacter(new Runtime(cloneRuntimePack()), snap);
    restored.state.pools['stamina'] = 0;
    restored.state.slots['1']![0] = null;
    restored.state.conditions.push({ conditionId: 'sapped', duration: 2 });
    restored.state.spells.push('grave-light');
    // The snapshot froze the post-spend balance; live state and snapshot are
    // independent JSON trees after restore.
    expect(snap.state.pools['stamina']).toBe(state.pools['stamina']);
    expect(snap.state.slots['1']).toEqual(['hex-bolt']);
    expect(snap.state.conditions).toEqual([]);
    expect(snap.state.knownSpells).toEqual(['hex-bolt']);
  });

  it('the pack identity is the canonical-JSON hash — any content change, different hash', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const state = createCharacter(runtime, { name: 'Ald', race: 'hillfolk', classes: ['warden'] }).state;
    const hashA = serializeCharacter(runtime, state).pack.contentHash;
    const pack2 = cloneRuntimePack();
    pack2.manifest.title = 'A Different Vale';
    const hashB = serializeCharacter(new Runtime(pack2), state).pack.contentHash;
    const pack3 = cloneRuntimePack();
    pack3.actions['strike']!.tags = ['strike', 'main'];
    const hashC = serializeCharacter(new Runtime(pack3), state).pack.contentHash;
    expect(hashA).not.toBe(hashB);
    expect(hashA).not.toBe(hashC);
  });
});

/**
 * CAP-01/CA-01 — inventory fidelity: held stacks serialize verbatim, restore
 * round-trips them losslessly (loot-granted stacks included), and the envelope
 * never carries a zero-qty entry (snapshots.schema.json: qty integer >= 1).
 */
describe('inventory fidelity (CAP-01/CA-01 — loot-inventory ck2)', () => {
  /** The fixture vale plus one more declared item — two stack ids for per-entry proofs. */
  function valeWithLantern() {
    const pack = cloneRuntimePack();
    pack.content.items!['lantern'] = { name: 'Lantern', kind: 'gear' };
    return pack;
  }

  it('held stacks serialize verbatim and restore losslessly — loot-granted stacks included', () => {
    const runtime = new Runtime(valeWithLantern());
    const character = createCharacter(runtime, { name: 'Brynn', race: 'hillfolk', classes: ['warden'] });
    character.grant('lantern', 2);
    character.loot('district-scavenge', { seed: 0 }); // rope x1 through the CA-02 mapping
    character.drop('lantern', 1); // a partial drop keeps the stack at qty 1
    const state = character.state;
    expect(state.inventory).toEqual([
      { id: 'lantern', qty: 1 },
      { id: 'rope', qty: 1 },
    ]);

    const snap = serializeCharacter(runtime, state);
    expect(snap.state.inventory).toEqual([
      { id: 'lantern', qty: 1 },
      { id: 'rope', qty: 1 },
    ]);
    const roundTrip = JSON.parse(JSON.stringify(snap)) as typeof snap;
    // The target runtime carries the same pack content (the identity gate
    // hashes it) — restore replays the stacks verbatim, no mutation-time
    // cross-validation on the load path (CA-01 discipline).
    const restored = restoreCharacter(new Runtime(valeWithLantern()), roundTrip);
    expect(restored.state).toEqual(state);
    expect(restored.state.inventory).toEqual([
      { id: 'lantern', qty: 1 },
      { id: 'rope', qty: 1 },
    ]);
  });

  it('no aliasing: mutating the restored inventory leaves the snapshot and source state untouched', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = createCharacter(runtime, { name: 'Brynn', race: 'hillfolk', classes: ['warden'] });
    character.grant('rope', 2);
    const snap = serializeCharacter(runtime, character.state);
    const restored = restoreCharacter(new Runtime(cloneRuntimePack()), snap);
    restored.state.inventory[0]!.qty = 99;
    restored.state.inventory.push({ id: 'rope', qty: 1 });
    expect(snap.state.inventory).toEqual([{ id: 'rope', qty: 2 }]);
    expect(character.state.inventory).toEqual([{ id: 'rope', qty: 2 }]);
  });

  it('the envelope never carries a zero-qty entry: drops to 0 remove the stack entirely', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = createCharacter(runtime, { name: 'Brynn', race: 'hillfolk', classes: ['warden'] });
    character.grant('rope', 5);
    character.drop('rope', 4);
    const snapPartial = serializeCharacter(runtime, character.state);
    expect(snapPartial.state.inventory).toEqual([{ id: 'rope', qty: 1 }]);
    for (const entry of snapPartial.state.inventory) {
      expect(Object.keys(entry).sort()).toEqual(['id', 'qty']);
      expect(Number.isInteger(entry.qty)).toBe(true);
      expect(entry.qty).toBeGreaterThanOrEqual(1);
    }
    character.drop('rope', 1);
    const snapEmpty = serializeCharacter(runtime, character.state);
    expect(snapEmpty.state.inventory).toEqual([]);
  });
});

describe('party snapshots (FR-14)', () => {
  it('members serialize as character states under one pack identity', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const ald = createCharacter(runtime, { name: 'Ald', race: 'hillfolk', classes: ['warden'] }).state;
    const vex = hexer(runtime);
    const snap = serializeParty(runtime, [ald, vex]);
    expect(snap.kind).toBe('party');
    expect(snap.snapshotVersion).toBe(1);
    expect(Object.keys(snap).sort()).toEqual(['kind', 'members', 'pack', 'snapshotVersion']);
    expect(snap.members).toHaveLength(2);
    expect(snap.members[0]?.name).toBe('Ald');
    expect(snap.members[1]!.pools['stamina']).toBe(vex.pools['stamina']);
    expect(snap.pack.id).toBe('test-vale');
  });

  it('a party member restores with the same fidelity as a solo character', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const ald = createCharacter(runtime, { name: 'Ald', race: 'hillfolk', classes: ['warden'] }).state;
    const vex = hexer(runtime);
    const snap = JSON.parse(JSON.stringify(serializeParty(runtime, [ald, vex]))) as ReturnType<
      typeof serializeParty
    >;
    const [restoredAld, restoredVex] = restoreParty(new Runtime(cloneRuntimePack()), snap);
    expect(restoredAld).toEqual(ald);
    expect(restoredVex).toEqual(vex);
  });
});

describe('restore rejects builds that no longer fit the pack (FR-5 discipline on restore)', () => {
  it('a snapshot whose classes no longer fit the pack is refused with named rules', () => {
    const sourceRuntime = new Runtime(cloneRuntimePack());
    const snap = serializeCharacter(
      sourceRuntime,
      createCharacter(sourceRuntime, { name: 'Ald', race: 'ashkin', classes: [{ id: 'warden', level: 4 }] })
        .state,
    );
    // A pack revision shortened its progression tables: the warden table now
    // reads only two levels, so the saved level-4 build is unreadable —
    // restore refuses with the shared validator's named rule, never mangles.
    const revised = cloneRuntimePack();
    const warden = revised.progression['warden']!;
    revised.progression['warden'] = {
      ...warden,
      saves: { fortitude: [0, 0], reflex: [0, 1], will: [0, 1], toughness: [1, 1], luck: [0, 0] },
      slots: { '1': [1, 2] },
    };
    (snap as { pack: { contentHash: string } }).pack.contentHash = packContentHash(revised);
    expect(() => restoreCharacter(new Runtime(revised), snap)).toThrow();
    try {
      restoreCharacter(new Runtime(revised), snap);
    } catch (error) {
      expect((error as Error).name).toBe('RuntimeRuleError');
      expect(String(error)).toMatch(/missing-progression/);
    }
  });
});

/**
 * CA-EG6 character leg (equipment-consumables S05 ck4): `equipped` is
 * presence-preserving, and restore validates every entry (item, slot,
 * eligibility, slot uniqueness, held) with E-SNAP-01 — all cards before any
 * application. Fixture items: chain-shirt (body), ashwood-blade
 * (main-hand/off-hand), ward-ring (ring).
 */
describe('equipped snapshots (CA-EG6)', () => {
  function armed(runtime: Runtime): CharacterState {
    const character = createCharacter(runtime, { name: 'Brynn', race: 'hillfolk', classes: ['warden'] });
    character.grant('chain-shirt');
    character.grant('ashwood-blade', 2);
    character.equip('chain-shirt', 'body');
    character.equip('ashwood-blade', 'main-hand');
    character.equip('ashwood-blade', 'off-hand');
    return character.state;
  }

  function refusal(run: () => unknown): { rule: string; jsonPath: string }[] {
    try {
      run();
    } catch (error) {
      expect((error as Error).name).toBe('RuntimeRuleError');
      return (error as { errors: readonly { rule: string; jsonPath: string }[] }).errors.map((card) => ({
        rule: card.rule,
        jsonPath: card.jsonPath,
      }));
    }
    throw new Error('expected a refusal');
  }

  it('a never-equipped character carries no equipped key; an equipped one round-trips losslessly', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const plain = createCharacter(runtime, { name: 'Ald', race: 'hillfolk', classes: ['warden'] }).state;
    expect('equipped' in serializeCharacter(runtime, plain).state).toBe(false);
    expect(
      'equipped' in
        restoreCharacter(new Runtime(cloneRuntimePack()), serializeCharacter(runtime, plain)).state,
    ).toBe(false);

    const source = new Runtime(cloneRuntimePack());
    const state = armed(source);
    const snap = JSON.parse(JSON.stringify(serializeCharacter(source, state))) as ReturnType<
      typeof serializeCharacter
    >;
    expect(snap.state.equipped).toEqual([
      { slot: 'body', itemId: 'chain-shirt' },
      { slot: 'main-hand', itemId: 'ashwood-blade' },
      { slot: 'off-hand', itemId: 'ashwood-blade' },
    ]);
    const restored = restoreCharacter(new Runtime(cloneRuntimePack()), snap);
    expect(restored.state).toEqual(state);
  });

  it('an emptied equipment list round-trips as [] (presence preserved)', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = createCharacter(runtime, { name: 'Brynn', race: 'hillfolk', classes: ['warden'] });
    character.grant('ward-ring');
    character.equip('ward-ring', 'ring');
    character.unequip('ring');
    const snap = serializeCharacter(runtime, character.state);
    expect(snap.state.equipped).toEqual([]);
    expect(restoreCharacter(new Runtime(cloneRuntimePack()), snap).state).toEqual(character.state);
  });

  it('dangling or illegal entries refuse loudly with every card; the target runtime is untouched', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const snap = JSON.parse(JSON.stringify(serializeCharacter(runtime, armed(runtime)))) as {
      state: { equipped: { slot: string; itemId: string }[] };
    };
    snap.state.equipped = [
      { slot: 'body', itemId: 'chain-shirt' },
      { slot: 'body', itemId: 'chain-shirt' }, // slot twice + a second unit that is not held
      { slot: 'ring', itemId: 'ashwood-blade' }, // slot the item does not admit
      { slot: 'cloak', itemId: 'ward-ring' }, // undeclared slot + not held
      { slot: 'off-hand', itemId: 'moon-rock' }, // undeclared item + not held
    ];
    const target = new Runtime(cloneRuntimePack());
    expect(refusal(() => restoreCharacter(target, snap as never))).toEqual([
      { rule: 'E-SNAP-01', jsonPath: 'state.equipped[1].slot' },
      { rule: 'E-SNAP-01', jsonPath: 'state.equipped[1]' },
      { rule: 'E-SNAP-01', jsonPath: 'state.equipped[2].slot' },
      { rule: 'E-SNAP-01', jsonPath: 'state.equipped[3].slot' },
      { rule: 'E-SNAP-01', jsonPath: 'state.equipped[3]' },
      { rule: 'E-SNAP-01', jsonPath: 'state.equipped[4].itemId' },
      { rule: 'E-SNAP-01', jsonPath: 'state.equipped[4]' },
    ]);
    expect(target.nextCharacterId).toBe(1);

    const party = JSON.parse(JSON.stringify(serializeParty(runtime, [armed(runtime)]))) as {
      members: { equipped: { slot: string; itemId: string }[] }[];
    };
    party.members[0]!.equipped = [{ slot: 'body', itemId: 'ashwood-blade' }];
    expect(refusal(() => restoreParty(target, party as never))).toEqual([
      { rule: 'E-SNAP-01', jsonPath: 'members[0].equipped[0].slot' },
    ]);
    expect(target.nextCharacterId).toBe(1);
  });
});

describe('feat snapshots (DD-S11, CAP-S5)', () => {
  it('a never-learned character serializes byte-exact with no feats key, and restores without one', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const state = hexer(runtime);
    const text = JSON.stringify(serializeCharacter(runtime, state));
    expect(text).not.toContain('"feats"');
    const restored = restoreCharacter(new Runtime(cloneRuntimePack()), JSON.parse(text));
    expect('feats' in restored.state).toBe(false);
    expect(JSON.stringify(serializeCharacter(runtime, restored.state))).toBe(text);
  });

  it('held feats survive serialize → JSON → restore, in learn order', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = createCharacter(runtime, { name: 'Ald', race: 'hillfolk', classes: ['warden'] });
    character.learnFeat('vengeful-strike');
    character.learnFeat('ironhide');
    const snap = JSON.parse(JSON.stringify(serializeCharacter(runtime, character.state))) as ReturnType<
      typeof serializeCharacter
    >;
    expect(snap.state.feats).toEqual(['vengeful-strike', 'ironhide']);
    const restored = restoreCharacter(new Runtime(cloneRuntimePack()), snap);
    expect(restored.state).toEqual(character.state);
    restored.state.feats!.push('extra');
    expect(snap.state.feats).toEqual(['vengeful-strike', 'ironhide']);
  });

  it('an unknown feat id is refused (E-SNAP-01 at state.feats[i]), every card at once, nothing minted', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = createCharacter(runtime, { name: 'Ald', race: 'hillfolk', classes: ['warden'] });
    character.learnFeat('ironhide');
    const snap = JSON.parse(JSON.stringify(serializeCharacter(runtime, character.state))) as {
      state: { feats: string[] };
    };
    snap.state.feats = ['ironhide', 'moon-step', 'sky-leap'];
    const target = new Runtime(cloneRuntimePack());
    let cards: readonly { rule: string; jsonPath: string }[] = [];
    try {
      restoreCharacter(target, snap as never);
    } catch (error) {
      cards = (error as { errors: readonly { rule: string; jsonPath: string }[] }).errors;
    }
    expect(cards.map((card) => [card.rule, card.jsonPath])).toEqual([
      ['E-SNAP-01', 'state.feats[1]'],
      ['E-SNAP-01', 'state.feats[2]'],
    ]);
    expect(target.nextCharacterId).toBe(1);
  });
});

describe('feat-slot restore (v1.8, CAP-F4)', () => {
  /** cloneRuntimePack with warden feat slots covering its 4 readable levels (pack data only). */
  function slottedRuntime(): Runtime {
    const pack = cloneRuntimePack();
    pack.progression['warden']!.featSlots = [1, 2, 2, 2];
    return new Runtime(pack);
  }

  function oneSlotWarden(runtime: Runtime): CharacterState {
    const character = createCharacter(runtime, { name: 'Ald', race: 'ashkin', classes: ['warden'] });
    character.learnFeat('ironhide');
    return character.state;
  }

  function cardsOf(run: () => unknown): string[][] {
    try {
      run();
    } catch (error) {
      return (error as { errors: readonly { rule: string; jsonPath: string }[] }).errors.map((card) => [
        card.rule,
        card.jsonPath,
      ]);
    }
    throw new Error('expected a refusal');
  }

  it("a 1-slot warden's snapshot round-trips byte-exact", () => {
    const runtime = slottedRuntime();
    const text = JSON.stringify(serializeCharacter(runtime, oneSlotWarden(runtime)));
    const restored = restoreCharacter(slottedRuntime(), JSON.parse(text));
    expect(restored.state.feats).toEqual(['ironhide']);
    expect(JSON.stringify(serializeCharacter(runtime, restored.state))).toBe(text);
  });

  it('a second declared feat appended is refused (feat-slots-exceeded at feats), nothing minted', () => {
    const runtime = slottedRuntime();
    const snap = JSON.parse(JSON.stringify(serializeCharacter(runtime, oneSlotWarden(runtime)))) as {
      state: { feats: string[] };
    };
    snap.state.feats.push('vengeful-strike');
    const target = slottedRuntime();
    expect(cardsOf(() => restoreCharacter(target, snap as never))).toEqual([
      ['feat-slots-exceeded', 'feats'],
    ]);
    expect(target.nextCharacterId).toBe(1);
  });

  it('an unknown and a declared feat appended give both feat-slots-exceeded and E-SNAP-01', () => {
    const runtime = slottedRuntime();
    const snap = JSON.parse(JSON.stringify(serializeCharacter(runtime, oneSlotWarden(runtime)))) as {
      state: { feats: string[] };
    };
    snap.state.feats.push('moon-step', 'vengeful-strike');
    const target = slottedRuntime();
    expect(cardsOf(() => restoreCharacter(target, snap as never))).toEqual([
      ['feat-slots-exceeded', 'feats'],
      ['E-SNAP-01', 'state.feats[1]'],
    ]);
    expect(target.nextCharacterId).toBe(1);
  });

  it('restoreParty with one over-cap member refuses the party; nothing is minted', () => {
    const runtime = slottedRuntime();
    const party = JSON.parse(
      JSON.stringify(serializeParty(runtime, [oneSlotWarden(runtime), oneSlotWarden(runtime)])),
    ) as { members: { feats: string[] }[] };
    party.members[1]!.feats.push('vengeful-strike');
    const target = slottedRuntime();
    expect(cardsOf(() => restoreParty(target, party as never))).toEqual([['feat-slots-exceeded', 'feats']]);
    expect(target.nextCharacterId).toBe(1);
  });
});
