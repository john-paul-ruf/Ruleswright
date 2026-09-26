/**
 * Ambient declaration for the cache-busted fresh-load import (CA-5's
 * cross-module-load determinism proof). The query-string specifier is a vite
 * runtime id, not a file; TS sees it through this ambient module. A default
 * export shape mirrors how the dynamic import resolves.
 */
declare module '*/pipeline?fresh-load' {
  import * as pipeline from '../../src/compiler/pipeline';
  export = pipeline;
}