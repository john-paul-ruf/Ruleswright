import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import * as api from '../../dist/runtime.js';
import { generateCampaign, loadTheme } from '../../dist/compiler.js';
import { playFixture, nextAction, send } from '../runtime/play/fixtures';

describe('CAP-01 fresh built public boundary', () => {
  it('real generated wounded/conditioned party, empty assembly seed and identical JSON continuation', () => {
    const pack = generateCampaign({ theme: loadTheme('dark-fantasy'), seed: 42 });
    const runtime = new api.Runtime(pack);
    const hero = runtime.createCharacter({ name: 'Warden', race: 'ashkin', classes: ['warden'] });
    hero.state.hp.current -= 3;
    hero.state.hp.temp = 2;
    hero.applyCondition('shaken');
    const fixture = {
      options: {
        sessionId: 'built-journey',
        seed: 42,
        members: [{ memberId: 'warden', character: api.serializeCharacter(runtime, hero.state) }],
        setup: {
          budget: 1,
          seed: '',
          maxPartySize: 1,
          maxEnemies: 1,
          layout: {
            kind: 'spatial' as const,
            model: 'grid' as const,
            allies: [{ x: 0, y: 0 }],
            enemies: [{ x: 0, y: 1 }],
            terrain: [],
          },
        },
      },
    };
    let running = api.createEncounterSession(pack, fixture.options);
    expect(send(running, { type: 'advance' }).ok).toBe(true);
    const command = nextAction(running);
    expect(send(running, command).ok).toBe(true);
    const json = JSON.stringify(running.serialize());
    expect(JSON.parse(json).encounter.selection.seedUsed).toBe('');
    expect(JSON.parse(json).encounter.setup.seed).toBe('');
    const uninterrupted = running;
    running = api.restoreEncounterSession(pack, JSON.parse(json));
    for (let i = 0; i < 8 && running.view().phase === 'active'; i++) {
      const next = nextAction(running);
      expect(send(running, next)).toEqual(send(uninterrupted, next));
      expect(running.serialize()).toEqual(uninterrupted.serialize());
    }
  }, 10000);
  it('CJS exposes the same synchronous boundary and cannot accept a foreign command', () => {
    const cjs = createRequire(import.meta.url)('../../dist/runtime.cjs') as typeof api;
    const { pack, options } = playFixture();
    const session = cjs.createEncounterSession(pack, options);
    const before = session.serialize();
    const result = session.dispatch({ type: 'advance', sessionId: 'foreign', expectedRevision: 0 });
    expect(result.ok).toBe(false);
    expect(session.serialize()).toEqual(before);
    expect(cjs.restoreEncounterSession(pack, JSON.parse(JSON.stringify(before))).serialize()).toEqual(before);
  }, 10000);
});
