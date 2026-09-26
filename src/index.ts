/**
 * M05 root entry (FR-22) — a dumb re-export surface, per the architecture
 * contract: subpath entries only, no logic, and no cross-surface barrel (the
 * runtime and compiler namespaces stay separate consumables — S08's bundle
 * check enforces the artifact side).
 */
export * from './schema';
export * from './runtime';
export * from './compiler';
