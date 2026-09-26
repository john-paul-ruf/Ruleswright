/**
 * Pack identity + version contract (FR-17/FR-23).
 * - packContentHash: canonical JSON (sorted keys, stable stringify) over a pure
 *   integer FNV-1a digest — zero deps, no WebCrypto, no ambient values. Byte-stable
 *   across key order so same-content packs hash identically (FR-17/FR-19).
 * - checkSchemaVersion: the engine's supported-range check at load (FR-23); the
 *   validator itself enforces the contract's `const 1` structurally.
 */
import { makeErrorCard, type ErrorCard } from './error-card';

/** Engine load range for schemaVersion 1 (FR-23; one discipline across packs/snapshots/overrides). */
export interface SchemaVersionRange {
  min: number;
  max: number;
}

export function checkSchemaVersion(pack: unknown, engineRange: SchemaVersionRange): ErrorCard[] {
  const manifest = isPlainObject(pack) && isPlainObject(pack['manifest']) ? pack['manifest'] : undefined;
  const artifactId = typeof manifest?.['id'] === 'string' ? manifest['id'] : '(pack)';
  const version = manifest?.['schemaVersion'];
  if (!isInteger(version)) {
    return [
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        'manifest.schemaVersion',
        'manifest.schemaVersion must be an integer.',
      ),
    ];
  }
  if (version < engineRange.min || version > engineRange.max) {
    return [
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        'manifest.schemaVersion',
        `schemaVersion ${version} is outside the engine's supported range [${engineRange.min}..${engineRange.max}]. Major bumps are breaking by definition; no silent acceptance of foreign versions (FR-23).`,
      ),
    ];
  }
  return [];
}

/** Canonical-JSON content digest: 8 hex chars (satisfies the snapshot contract's contentHash minLength 8). */
export function packContentHash(json: unknown): string {
  return fnv1a32Hex(JSON.stringify(canonicalize(json)));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = canonicalize(value[key]);
    }
    return out;
  }
  return value;
}

/** FNV-1a over UTF-16 code units — pure integer arithmetic, identical on every platform (FR-1 discipline). */
function fnv1a32Hex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}
