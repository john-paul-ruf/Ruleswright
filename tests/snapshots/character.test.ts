/**
 * CAP-7 checkpoint 1 — character snapshots (FR-14): envelope conformance,
 * round-trip losslessness, plain-JSON purity, no-aliasing, pack identity.
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
