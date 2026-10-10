/**
 * browser-determinism CAP-B2 / CA-B1 consumer / CA-B2 — the browser leg.
 *
 * Runs the shared oracle (`tests/proofs/determinism-oracle.ts`) inside a real
 * browser engine (Chromium/V8, Firefox/SpiderMonkey, WebKit/JavaScriptCore via
 * `vitest.browser.config.ts`) and checks every subject against the digests
 * captured on Node. sha256 goes through WebCrypto over the UTF-8 bytes of the
 * same raw text Node hashes; `contentHash` is the pure-JS `packContentHash`.
 *
 * tsconfig keeps `lib: ["es2020"]` (no DOM), so browser globals are reached
 * through the local `BrowserGlobals` type below.
 */
import { describe, expect, it } from 'vitest';
import { packContentHash } from '../../src/schema/version';
import {
  CHARACTERIZATION_DIGESTS,
  LEG_RUNS,
  PACK_DIGESTS,
  PACK_THEMES,
  contentHashOfRaw,
  packRaw,
  recordingRaw,
  type LegId,
} from '../proofs/determinism-oracle';

interface BrowserGlobals {
  readonly crypto: {
    readonly subtle: { digest(algorithm: 'SHA-256', data: Uint8Array): Promise<ArrayBuffer> };
  };
  readonly TextEncoder: new () => { encode(text: string): Uint8Array };
  readonly navigator: { readonly userAgent: string };
  readonly process?: { readonly versions?: { readonly node?: string } };
}

const g = globalThis as unknown as BrowserGlobals;

async function sha256Hex(text: string): Promise<string> {
  const bytes = new Uint8Array(await g.crypto.subtle.digest('SHA-256', new g.TextEncoder().encode(text)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

describe('FR-1 / FR-17 / NFR-Determinism — the Node-pinned oracle reproduces in a browser engine', () => {
  it('runs in a browser engine, not Node (CA-B2)', () => {
    expect(g.process?.versions?.node).toBeUndefined();
    expect(g.navigator.userAgent).toMatch(/Mozilla/);
    console.log('[determinism] userAgent=' + g.navigator.userAgent);
  });

  it.each(Object.keys(LEG_RUNS) as LegId[])('%s reproduces its Node-pinned digests', async (id) => {
    const raw = recordingRaw(LEG_RUNS[id]());
    expect({ sha256: await sha256Hex(raw), contentHash: contentHashOfRaw(raw) }).toEqual(
      CHARACTERIZATION_DIGESTS[id],
    );
  });

  it.each(PACK_THEMES)('%s pack (seed 42) reproduces its Node-pinned digests', async (theme) => {
    const raw = packRaw(theme);
    expect({ sha256: await sha256Hex(raw), contentHash: packContentHash(JSON.parse(raw)) }).toEqual(
      PACK_DIGESTS[theme],
    );
  });
});
