import { createHash } from 'node:crypto';

function canonicalize(value: unknown, path: string): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Canonical evidence contains a nonfinite number at ${path}`);
    const serialized = JSON.stringify(Object.is(value, -0) ? 0 : value);
    if (/[eE]/.test(serialized)) throw new Error(`Canonical evidence contains an exponent-form number at ${path}`);
    return serialized;
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonicalize(item, `${path}[${index}]`)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).sort();
    return `{${keys.map((key) => {
      if (object[key] === undefined) throw new Error(`Canonical evidence contains undefined at ${path}.${key}`);
      return `${JSON.stringify(key)}:${canonicalize(object[key], `${path}.${key}`)}`;
    }).join(',')}}`;
  }
  throw new Error(`Canonical evidence contains unsupported ${typeof value} at ${path}`);
}

export function canonicalEvidenceJson(value: unknown): string {
  return canonicalize(value, '$');
}

/** SHA-256 of canonical JSON; output is always 64-character lowercase hexadecimal. */
export function canonicalEvidenceHash(value: unknown): string {
  return createHash('sha256').update(canonicalEvidenceJson(value), 'utf8').digest('hex');
}
