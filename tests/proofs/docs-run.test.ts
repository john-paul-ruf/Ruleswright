/**
 * NFR-DX made mechanical, two independent passes:
 *
 * 1. EXECUTION — the README's quickstart code runs VERBATIM and its expected
 *    output is asserted. If the README's examples cannot run, this test fails —
 *    the docs are broken (quickstart.html is the bar).
 *
 * 2. TYPECHECK — the same fenced ```ts blocks compile under the consumer's
 *    strict tsc (strict + noUncheckedIndexedAccess, mirroring tsconfig.json).
 *    Executing stripped JS proves the code runs; only a typecheck proves it
 *    compiles — "copy-paste runnable" means both. A README line that fails
 *    strict tsc (e.g. TS18048 on a possibly-undefined `.find()` result) fails
 *    here even though the executed form runs.
 *
 * The README's fenced ```ts blocks are extracted and joined the way a
 * copy-paste reader would (one module). The execution pass strips the import
 * lines (binding the names as function parameters) and the TS-only non-null
 * assertions; the typecheck pass keeps both and maps the package specifiers to
 * the real source entries — a consumer's `ruleswright/*` resolves through the
 * package exports to the same compiled source.
 *
 * The anatomy test additionally pins the README's CI claims against what
 * ci.yml actually does: the browser determinism leg is a tracked v1.1
 * follow-up, and the README must say so — never promise a CI run CI does
 * not perform.
 *
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
import ts from 'typescript';
import { generateCampaign, loadTheme } from '../../src/compiler';
import { Runtime, startCombat, spawnMonster, profileFromCharacter } from '../../src/runtime';

const readmePath = fileURLToPath(new URL('../../README.md', import.meta.url));
const readme = readFileSync(readmePath, 'utf8');

/** The quickstart's ```ts blocks, in order. */
const blocks = [...readme.matchAll(/```ts\n([\s\S]*?)```/g)].map((match) => match[1]!);
expect(blocks.length, 'README quickstart must carry three ```ts blocks').toBe(3);

/** The README's TS-only tokens (a real consumer's tsc strips these; the execution pass does the same). */
const stripped = blocks.join('\n').split(']!').join(']');

// ------------------------------------------------------------- typecheck pass

/** Repository root (this file is tests/proofs/docs-run.test.ts). */
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** The README's package specifiers → the same modules a consumer's install resolves (source form). */
const SURFACE_MODULES: Readonly<Record<string, string>> = {
  ruleswright: `${REPO_ROOT}src/index.ts`,
  'ruleswright/schema': `${REPO_ROOT}src/schema/index.ts`,
  'ruleswright/runtime': `${REPO_ROOT}src/runtime/index.ts`,
  'ruleswright/compiler': `${REPO_ROOT}src/compiler/index.ts`,
};

/** The virtual in-memory module the joined blocks are typechecked as. */
const DOC_FILE = 'ruleswright-quickstart.doc.ts';

/** The consumer's strictness — tsconfig.json's flags, nothing looser. */
const DOC_OPTIONS: ts.CompilerOptions = {
  strict: true,
  noUncheckedIndexedAccess: true,
  noFallthroughCasesInSwitch: true,
  noImplicitOverride: true,
  target: ts.ScriptTarget.ES2020,
  lib: ['es2020'],
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  esModuleInterop: true,
  resolveJsonModule: true,
  isolatedModules: true,
  skipLibCheck: true,
  noEmit: true,
};

/**
 * Typecheck the joined blocks without writing to disk: an in-memory SourceFile
 * behind a delegating compiler host whose resolveModuleNames maps the README's
 * package specifiers to the real source entries. Returns "line:col message
 * (tsNNNN)" strings — empty means the docs compile under strict tsc.
 */
function typecheckQuickstart(source: string): readonly string[] {
  const host = ts.createCompilerHost(DOC_OPTIONS);
  const sourceFile = ts.createSourceFile(DOC_FILE, source, ts.ScriptTarget.ES2020, true);
  const docHost: ts.CompilerHost = {
    ...host,
    // The newer resolveModuleNameLiterals API would bypass resolveModuleNames;
    // clearing it routes the README's package specifiers through the map below.
    resolveModuleNameLiterals: undefined,
    getSourceFile(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile) {
      return fileName === DOC_FILE ? sourceFile : host.getSourceFile(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile);
    },
    fileExists(fileName) {
      return fileName === DOC_FILE || host.fileExists!(fileName);
    },
    readFile(fileName) {
      return fileName === DOC_FILE ? source : host.readFile!(fileName);
    },
    resolveModuleNames(moduleNames, containingFile) {
      return moduleNames.map((name) => {
        const surface = SURFACE_MODULES[name];
        if (surface !== undefined) return { resolvedFileName: surface, extension: '.ts' as const, isExternalLibraryImport: false };
        return ts.resolveModuleName(name, containingFile, DOC_OPTIONS, host).resolvedModule;
      });
    },
  };
  const program = ts.createProgram([DOC_FILE], DOC_OPTIONS, docHost);
  return ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.file?.fileName === DOC_FILE)
    .map((diagnostic) => {
      const { line, character } = diagnostic.file!.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
      return `${line + 1}:${character + 1} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')} (ts${diagnostic.code})`;
    });
}

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
    // CI-claim honesty (NFR-DX): the README must never promise a CI run CI
    // does not perform. The browser determinism leg is a tracked v1.1
    // follow-up — ci.yml runs the Node matrix only, and says so.
    expect(readme).toContain('browser leg');
    expect(readme).toContain('v1.1 follow-up');
    expect(readme).not.toContain('browser matrix runs in CI');
  });

  it('the README’s fenced ```ts blocks compile under the consumer’s strict tsc (NFR-DX)', () => {
    const problems = typecheckQuickstart(blocks.join('\n'));
    expect(problems, 'README quickstart must compile under strict tsc — code that runs but does not compile is half copy-paste-runnable').toEqual([]);
  }, 60_000);
});