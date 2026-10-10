/**
 * browser-determinism CAP-B3 / CA-B2 — a leg proves where it ran.
 *
 * Logs the runtime the whole suite ran on. `pnpm test:electron` sets
 * RULESWRIGHT_EXPECT_RUNTIME=electron; then this must be Electron's own
 * Node/V8 (`process.versions.electron` present), so a mis-resolved binary or
 * a plain-Node run cannot pass as the Electron leg.
 */
import { describe, expect, it } from 'vitest';

describe('runtime identity (CA-B2)', () => {
  it('records the engine this suite ran on; under RULESWRIGHT_EXPECT_RUNTIME=electron it must be Electron', () => {
    const versions = process.versions as NodeJS.ProcessVersions & { electron?: string };
    console.log(
      '[determinism] runtime=' +
        JSON.stringify({ node: versions.node, v8: versions.v8, electron: versions.electron }),
    );
    if (process.env['RULESWRIGHT_EXPECT_RUNTIME'] === 'electron')
      expect(typeof versions.electron).toBe('string');
  });
});
