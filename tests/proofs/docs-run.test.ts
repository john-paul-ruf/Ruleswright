/** README examples execute with real built imports and typecheck against shipped declarations. */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createRequire } from 'node:module';

const readmePath = fileURLToPath(new URL('../../README.md', import.meta.url));
const readme = readFileSync(readmePath, 'utf8');

const EXAMPLES = [
  'quickstart/generate',
  'quickstart/character',
  'quickstart/combat',
  'quickstart/loot',
  'encounter/play',
  'adventure/generate',
  'adventure/play',
  'adventure/solo',
] as const;
function extractExamples(markdown: string): {
  quickstart: string;
  encounter: string;
  adventure: string;
  play: string;
  solo: string;
} {
  const blocks = [...markdown.matchAll(/<!-- example: ([a-z/-]+) -->\s*```ts\n([\s\S]*?)```/g)];
  if (blocks.length !== [...markdown.matchAll(/```ts\n/g)].length)
    throw new Error('Unlabelled TypeScript example');
  const examples = new Map<string, string>();
  for (const match of blocks) {
    const name = match[1]!;
    if (!EXAMPLES.some((expected) => expected === name) || examples.has(name))
      throw new Error(`Unknown or duplicate example: ${name}`);
    examples.set(name, match[2]!);
  }
  for (const name of EXAMPLES) if (!examples.has(name)) throw new Error(`Missing example: ${name}`);
  return {
    quickstart: EXAMPLES.filter((name) => name.startsWith('quickstart/'))
      .map((name) => examples.get(name)!)
      .join('\n'),
    encounter: examples.get('encounter/play')!,
    adventure: examples.get('adventure/generate')!,
    play: examples.get('adventure/play')!,
    solo: examples.get('adventure/solo')!,
  };
}
const examples = extractExamples(readme);
const require = createRequire(import.meta.url);
function runExample(source: string, exports: readonly string[] = []) {
  const logs: unknown[][] = [];
  const output = ts.transpileModule(`${source}\nexport {${exports.join(',')}};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const bindings: Record<string, unknown> = {};
  const modules: Record<string, string> = {
    ruleswright: 'index',
    'ruleswright/runtime': 'runtime',
    'ruleswright/compiler': 'compiler',
    'ruleswright/schema': 'schema',
  };
  const load = (name: string): unknown => {
    const entry = modules[name];
    if (entry === undefined) throw new Error(`Unsupported example import: ${name}`);
    return require(fileURLToPath(new URL(`../../dist/${entry}.cjs`, import.meta.url)));
  };
  new Function('require', 'exports', 'console', output)(load, bindings, {
    log: (...parts: unknown[]) => logs.push(parts),
  });
  return { bindings, logs };
}
function checkQuickstartOutput(logs: unknown[][]): void {
  expect(logs).toEqual([
    [{ hp: 11, ac: 12, saves: { vigor: 0, grace: 0, tenacity: 0, reason: 0, presence: 0 } }],
    ['d20[9]+4=13 ≥ ac12', 'actions.cut-down.attackBonus'],
    [[{ id: 'grave-ward', qty: 1 }]],
  ]);
}

// ------------------------------------------------------------- typecheck pass

/** Repository root (this file is tests/proofs/docs-run.test.ts). */
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** The README's package imports resolve against the freshly built declarations. */
const SURFACE_MODULES: Readonly<Record<string, string>> = {
  ruleswright: `${REPO_ROOT}dist/index.d.ts`,
  'ruleswright/schema': `${REPO_ROOT}dist/schema.d.ts`,
  'ruleswright/runtime': `${REPO_ROOT}dist/runtime.d.ts`,
  'ruleswright/compiler': `${REPO_ROOT}dist/compiler.d.ts`,
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
 * package specifiers to the built declarations. Returns "line:col message
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
      return fileName === DOC_FILE
        ? sourceFile
        : host.getSourceFile(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile);
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
        if (surface !== undefined)
          return { resolvedFileName: surface, extension: ts.Extension.Dts, isExternalLibraryImport: false };
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
  it('generates → character → combat round → loot, with the README’s expected outputs', () => {
    const { bindings, logs } = runExample(examples.quickstart, ['pack', 'rt', 'brynn', 'fight', 'attack']);
    checkQuickstartOutput(logs);
    const { pack, brynn, fight, attack } = bindings as {
      pack: {
        manifest: { id: string; schemaVersion: number };
        content: { classes: Record<string, unknown>; spells: Record<string, unknown> };
      };
      rt: unknown;
      brynn: {
        state: { id: string; race: string; inventory: { id: string; qty: number }[] };
        derived: () => { hp: number; ac: number; saves: Record<string, number> };
      };
      fight: {
        state: { combatants: Record<string, { ac: number; hp: { current: number }; actions: string[] }> };
      };
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
    expect(brynn.derived()).toEqual({
      hp: 11,
      ac: 12,
      saves: { vigor: 0, grace: 0, tenacity: 0, reason: 0, presence: 0 },
    });

    // 03 — combat: Brynn fights as herself (her class actions, her derived ac),
    // and the provenanced attack event is the README's verbatim roll line.
    const ally = fight.state.combatants['brynn']!;
    expect(ally.actions).toEqual([
      'strike',
      'cut-down',
      'withdraw',
      'brace',
      'parry',
      'stride',
      'opportunist',
    ]);
    expect(ally.ac).toBe(brynn.derived().ac);
    expect(attack).toBeDefined();
    expect(attack!.actor).toBe('wight');
    expect(attack!.target).toBe('brynn');
    expect(attack!.why.rolls[0]).toBe('d20[9]+4=13 ≥ ac12');
    expect(attack!.why.rule).toBe('actions.cut-down.attackBonus');

    // 04 — loot: the grantLoot call ran through the generated pack's own
    // tables and left Brynn holding the stack the README quotes (the
    // recorded seed-42 barrow-loot roll; CA-02 through dark-fantasy data).
    expect(brynn.state.inventory).toEqual([{ id: 'grave-ward', qty: 1 }]);
  });

  it('the README’s expected-output blocks match the shipped event anatomy', () => {
    // The README's output blocks quote the real anatomy (why.rule / why.rolls);
    // this guard fails if a doc edit drifts the field names.
    expect(readme).toContain('d20[9]+4=13 ≥ ac12');
    expect(readme).toContain('profileFromCharacter(rt, brynn)');
    expect(readme).toContain('actions.cut-down.attackBonus');
    expect(readme).toContain('no I/O');
    // 04 — the loot section names its own table + seed (the same honesty the
    // combat block carries for its roll).
    expect(readme).toContain("'barrow-loot'");
    expect(readme).toContain('seed: 42');
    // Spells and feats in combat (spells-in-combat): the settlement and feat verbs are documented.
    expect(readme).toContain('settleSpellCasts');
    expect(readme).toContain('learnFeat');
    // Class features (class-features, v1.10): where they live and the host query are documented.
    expect(readme).toContain('progression.<id>.features');
    expect(readme).toContain('classFeatures');
    // CI-claim honesty (NFR-DX): the README names these legs and files, and ci.yml runs them.
    // The ci.yml checks anchor on `- run:` steps: its header comment names the same commands.
    const ci = readFileSync(
      fileURLToPath(new URL('../../.github/workflows/ci.yml', import.meta.url)),
      'utf8',
    );
    expect(readme).toContain('pnpm test:browser');
    expect(readme).toContain('pnpm test:electron');
    expect(ci).toMatch(
      /^\s*- run: pnpm exec vitest run --config vitest\.browser\.config\.ts --browser\.name=/m,
    );
    expect(ci).toMatch(/browser:\s*\[chromium, firefox, webkit\]/);
    expect(ci).toMatch(/^\s*- run: pnpm test:electron$/m);
    // Contract conformance (CA-K3): the README names the proof, it exists, and both CI jobs that collect it run.
    expect(readme).toContain('tests/proofs/contract-conformance.test.ts');
    expect(existsSync(fileURLToPath(new URL('./contract-conformance.test.ts', import.meta.url)))).toBe(true);
    expect(ci).toMatch(/^\s*- run: pnpm test$/m);
    expect(ci).toMatch(/^\s*- run: pnpm exec vitest run tests\/proofs\/$/m);
    expect(readme).not.toMatch(/browser[^.]*v1\.1 follow-up/);
    expect(readme).not.toContain('browser matrix runs in CI');
  });

  it('the README’s fenced ```ts blocks compile under the consumer’s strict tsc (NFR-DX)', () => {
    const problems = [
      ...typecheckQuickstart(examples.quickstart),
      ...typecheckQuickstart(examples.encounter),
      ...typecheckQuickstart(examples.adventure),
      ...typecheckQuickstart(examples.play),
      ...typecheckQuickstart(examples.solo),
    ];
    expect(
      problems,
      'README quickstart must compile under strict tsc — code that runs but does not compile is half copy-paste-runnable',
    ).toEqual([]);
  }, 60_000);
});

describe('documentation runner self-tests and encounter example', () => {
  it('executes the independent encounter loop, settles and reopens the host save', () => {
    const { bindings, logs } = runExample(examples.encounter, ['session', 'saved']);
    expect(logs).toEqual([['settled', 'victory', 1]]);
    const snapshot = JSON.parse(bindings['saved'] as string);
    expect(snapshot.encounter.selection.seedUsed).toBe('');
    expect(snapshot.settlements).toHaveLength(1);
    expect((bindings['session'] as { serialize(): unknown }).serialize()).toEqual(snapshot);
    expect(readme).toContain('settled victory 1');
  });
  it('rejects a missing example or an unlabelled block', () => {
    expect(() =>
      extractExamples(readme.replace(/<!-- example: encounter\/play -->\s*```ts\n[\s\S]*?```/, '')),
    ).toThrow(/Missing example/);
    expect(() => extractExamples(readme.replace('<!-- example: quickstart/generate -->', ''))).toThrow(
      /Unlabelled/,
    );
  });
  it('preserves import resolution failures instead of stripping unknown imports', () => {
    expect(() =>
      runExample(examples.quickstart.replace('ruleswright/compiler', 'ruleswright/missing')),
    ).toThrow(/Unsupported example import/);
  });
  it('detects changed executable output', () => {
    const bad = examples.quickstart.replace('console.log(brynn.derived())', "console.log('wrong output')");
    expect(() => checkQuickstartOutput(runExample(bad).logs)).toThrow();
  });
  it('detects a nonexistent exported symbol in consumer typechecking', () => {
    expect(
      typecheckQuickstart("import { missingSymbol } from 'ruleswright/runtime'; missingSymbol();").some(
        (error) => error.includes('missingSymbol'),
      ),
    ).toBe(true);
  }, 60000);
});

describe('portable adventure documentation and extractor controls', () => {
  it('executes actual compiler/schema imports and preserves the exact reopened definition', () => {
    const { bindings, logs } = runExample(examples.adventure, ['definition', 'reopenedDefinition']);
    expect(logs).toEqual([['dark-fantasy', 8, 'bc266e2f']]);
    expect(bindings['reopenedDefinition']).toEqual(bindings['definition']);
    const definition = bindings['definition'] as { nodes: { kind: string; encounter?: { seed: string } }[] };
    expect(
      definition.nodes.filter((n) => n.kind === 'encounter').every((n) => n.encounter!.seed === ''),
    ).toBe(true);
    expect(readme).toContain('dark-fantasy 8 bc266e2f');
    expect(readme).toContain('createAdventure(pack, definition, options)');
  });
  it('rejects a missing adventure block, duplicate label and unknown label', () => {
    expect(() =>
      extractExamples(readme.replace(/<!-- example: adventure\/generate -->\s*```ts\n[\s\S]*?```/, '')),
    ).toThrow(/Missing example/);
    expect(() =>
      extractExamples(readme + '\n<!-- example: adventure/generate -->\n```ts\nconst x = 1;\n```'),
    ).toThrow(/duplicate/);
    expect(() =>
      extractExamples(readme.replace('example: adventure/generate', 'example: adventure/unknown')),
    ).toThrow(/Unknown/);
  });
  it('does not accept a broken adventure import or changed generated output', () => {
    expect(() =>
      runExample(examples.adventure.replace('ruleswright/compiler', 'ruleswright/missing')),
    ).toThrow(/Unsupported/);
    const changed = runExample(examples.adventure.replace('definition.nodes.length,', '0,')).logs;
    expect(() => expect(changed).toEqual([['dark-fantasy', 8, 'bc266e2f']])).toThrow();
  });
});

describe('manual adventure example and runner negative controls', () => {
  it('executes the exact generated manual host loop, claims and JSON restarts through built exports', () => {
    const { bindings, logs } = runExample(examples.play, ['adventure', 'saved']);
    expect(logs).toEqual([['completed', 2, 2]]);
    const saved = JSON.parse(bindings['saved'] as string) as import('../../src/runtime').AdventureSnapshot;
    const adventure = bindings['adventure'] as import('../../src/runtime').Adventure;
    expect(adventure.serialize()).toEqual(saved);
    expect(saved.visitedNodeIds).toContain('passage');
    expect(saved.rewards.every((r) => r.status === 'claimed')).toBe(true);
    expect(saved.members.map((m) => m.character.state.classes[0]!.level)).toEqual([3, 3]);
    // 975 seeded + 1000 (watch-cache) + 1500 (delivery-cache) under the v1.8 rewards.
    expect(saved.members.map((m) => m.character.state.classes[0]!.xp)).toEqual([3475, 3475]);
    expect(saved.members.map((m) => m.character.state.hp)).toEqual([
      { current: 19, temp: 3 },
      { current: 18, temp: 4 },
    ]);
    expect(saved.members.map((m) => m.character.state.slots['1'])).toEqual([
      [null, 'ward-sigil', null, null],
      [null, 'ward-sigil', null, null],
    ]);
    expect(readme).toContain('completed 2 2');
    expect(readme).toContain('refills pools and clears');
    expect(readme).toContain('replay branches');
  }, 10000);
  it('rejects a missing play block and an invalid package import', () => {
    expect(() =>
      extractExamples(readme.replace(/<!-- example: adventure\/play -->\s*```ts\n[\s\S]*?```/, '')),
    ).toThrow(/Missing example/);
    expect(() => runExample(examples.play.replace('ruleswright/runtime', 'ruleswright/missing'))).toThrow(
      /Unsupported/,
    );
  });
  it('propagates real guard rejection and fails a zero-step script instead of accepting no work', () => {
    expect(() =>
      runExample(examples.play.replace('expectedRevision: view.revision', 'expectedRevision: -1')),
    ).toThrow();
    expect(() => runExample(examples.play.replace('steps < 1000', 'steps < 0'))).toThrow(/host step limit/);
    const changed = runExample(
      examples.play.replace('adventure.serialize().encounterReceipts.length,', '0,'),
    ).logs;
    expect(() => expect(changed).toEqual([['completed', 2, 2]])).toThrow();
  }, 10000);
});

describe('solo host example and behavioral controls', () => {
  it('executes real enemy control, explicit player choices/claims, literal narration and saved ack', () => {
    const { bindings, logs } = runExample(examples.solo, ['adventure', 'saved']);
    expect(logs[logs.length - 1]).toEqual(['completed', 2, 0]);
    const saved = JSON.parse(bindings['saved'] as string) as import('../../src/runtime').AdventureSnapshot;
    expect(saved.director.decisions).toBeGreaterThan(0);
    expect(saved.narrationAck).toBe(saved.sequence);
    expect(logs.length).toBe(saved.sequence + 1);
    expect(saved.rewards.every((r) => r.status === 'claimed')).toBe(true);
    expect((bindings['adventure'] as import('../../src/runtime').Adventure).serialize()).toEqual(saved);
    expect(readme).toContain('completed 2 0');
  }, 10000);
  it('rejects missing/duplicate solo examples, invalid imports and no-work scripts', () => {
    expect(() =>
      extractExamples(readme.replace(/<!-- example: adventure\/solo -->\s*```ts\n[\s\S]*?```/, '')),
    ).toThrow(/Missing example/);
    expect(() =>
      extractExamples(readme + '\n<!-- example: adventure/solo -->\n```ts\nconst x = 1;\n```'),
    ).toThrow(/duplicate/);
    expect(() => runExample(examples.solo.replace('ruleswright/runtime', 'ruleswright/missing'))).toThrow(
      /Unsupported/,
    );
    expect(() => runExample(examples.solo.replace('steps < 1000', 'steps < 0'))).toThrow(/host step limit/);
    expect(() => runExample(examples.solo.replace('maxSteps: 32', 'maxSteps: 0'))).toThrow(
      /positive safe integer/,
    );
    expect(() =>
      runExample(examples.solo.replace('expectedRevision: current.revision', 'expectedRevision: -1')),
    ).toThrow();
  }, 10000);
  it('the CI steps retain all host proofs, three engines and three-theme coverage', () => {
    const ci = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
    expect(ci).toMatch(/^\s*- run: pnpm exec vitest run tests\/compiler\/coverage-floor\.test\.ts$/m);
    expect(ci).toMatch(/node: \[18, 20, 22\]/);
    expect(ci).toMatch(/browser: \[chromium, firefox, webkit\]/);
    expect(ci).toMatch(/- run: pnpm build[\s\S]*?- run: pnpm typecheck[\s\S]*?- run: pnpm test/);
    expect(ci).toMatch(/^\s*- run: pnpm exec vitest run tests\/proofs\/$/m);
  });
});
