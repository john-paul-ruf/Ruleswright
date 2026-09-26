/**
 * M01 schema surface — the pack format's public types, validator, version
 * contract, and override application. Imports nothing internal except the
 * declared CA-2 consumer edge (validate.ts's dslChecker seam, owned by S03).
 */
export * from './error-card';
export * from './artifacts';
export * from './pack';
export * from './validate';
export * from './version';
export * from './overrides';
