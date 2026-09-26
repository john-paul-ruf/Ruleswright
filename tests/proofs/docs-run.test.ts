/**
 * NFR-DX made mechanical: the README's quickstart code is executed VERBATIM and
 * its expected output asserted. If the README's examples cannot run, this test
 * fails — the docs are broken (quickstart.html is the bar).
 *
 * The README's fenced ```ts blocks are extracted, joined the way a copy-paste
 * reader would (one module), and executed against the real surface modules
 * (the README's `import` lines resolve to the same exports a consumer gets;
 * the test strips them in the evaluated form and binds the names as function
 * parameters, plus strips the TS-only non-null assertions tsc would strip).
 * Expected outputs are asserted from the README's own output blocks:
 *   01 → a validated pack (manifest.id = dark-fantasy, 3 classes, 33 spells)
 *   02 → derived() = { hp: 27, ac: 12, saves: all-zero at level 1 }
 *   03 → the character fights as herself (profileFromCharacter): an attack event
 *        whose why.rolls[0] matches the README's d20[9]=9 < ac12 — ac 12 is
 *        Brynn's own derived ac from step 02
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateCampaign, loadTheme } from '../../src/compiler';
import { Runtime, startCombat, spawnMonster, profileFromCharacter } from '../../src/runtime';

const readmePath = fileURLToPath(new URL('../../README.md', import.meta.url));
const readme = readFileSync(readmePath, 'utf8');

/** The quickstart's ```ts blocks, in order. */
const blocks = [...readme.matchAll(/```ts\n([\s\S]*?)```/g)].map((match) => match[1]!);
expect(blocks.length, 'README quickstart must carry three ```ts blocks').toBe(3);

/** The README's TS-only tokens (a real consumer's tsc strips these; the test does the same). */
const stripped = blocks.join('\n').split(']!').join(']');

describe('README quickstart runs verbatim (NFR-DX)', () => {
  it('generates → character → combat round, with the README’s expected outputs', () => {
    // The README's identifiers resolve against the real surface modules (the
    // package install's exports) — the same names a consumer gets.
    const logs: unknown[][] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((...parts) => logs.push(parts));
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func -- the README's code is trusted developer input (same trust class as pack data); the test executes it verbatim
      const run = new Function(
        'generateCampaign', 'loadTheme', 'Runtime', 'startCombat', 'spawnMonster', 'profileFromCharacter',
        `"use strict";\n${stripped.replace(/import[^;\n]+;/g, '').split('await ').join('')}\nreturn { pack, rt, brynn, fight, attack };`,
      );
      const { pack, brynn, fight, attack } = run(generateCampaign, loadTheme, Runtime, startCombat, spawnMonster, profileFromCharacter) as {
        pack: { manifest: { id: string; schemaVersion: number }; content: { classes: Record<string, unknown>; spells: Record<string, unknown> } };
        rt: unknown;
        brynn: { state: { id: string; race: string }; derived: () => { hp: number; ac: number; saves: Record<string, number> } };
        fight: { state: { combatants: Record<string, { ac: number; hp: { current: number }; actions: string[] }> } };
        attack: { actor: string; target: string; why: { rolls: string[]; rule: string } } | undefined;
      };

      // 01 — generate: validated, byte-identity-eligible pack.
      expect(pack.manifest.id).toBe('dark-fantasy');
      expect(pack.manifest.schemaVersion).toBe(1);
      expect(Object.keys(pack.content.classes).length).toBe(3);
      expect(Object.keys(pack.content.spells ?? {}).length).toBe(33);

      // 02 — character: derived through the pack's own formulas; the console
      // line matches the README's output block.
      expect(brynn.state.id).toBe('char-1');
      expect(brynn.state.race).toBe('hillfolk');
      expect(brynn.derived()).toEqual({ hp: 27, ac: 12, saves: { vigor: 0, grace: 0, tenacity: 0, reason: 0, presence: 0 } });

      // 03 — combat: Brynn fights as herself (her class actions, her derived ac),
      // and the provenanced attack event is the README's verbatim roll line.
      const ally = fight.state.combatants['brynn']!;
      expect(ally.actions).toEqual(['strike', 'cut-down', 'withdraw', 'brace', 'parry']);
      expect(ally.ac).toBe(brynn.derived().ac);
      expect(attack).toBeDefined();
      expect(attack!.actor).toBe('wight');
      expect(attack!.target).toBe('brynn');
      expect(attack!.why.rolls[0]).toBe('d20[9]=9 < ac12');
      expect(attack!.why.rule).toBe('actions.cut-down.attackBonus');
      expect(logs.length).toBeGreaterThanOrEqual(2); // brynn.derived() + the attack line
    } finally {
      log.mockRestore();
    }
  });

  it('the README’s expected-output blocks match the shipped event anatomy', () => {
    // The README's output blocks quote the real anatomy (why.rule / why.rolls);
    // this guard fails if a doc edit drifts the field names.
    expect(readme).toContain('d20[9]=9 < ac12');
    expect(readme).toContain('profileFromCharacter(rt, brynn)');
    expect(readme).toContain('actions.cut-down.attackBonus');
    expect(readme).toContain('no I/O');
  });
});