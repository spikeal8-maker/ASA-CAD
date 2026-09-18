export function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} must be an object`);
  return value as Record<string, unknown>;
}

export function expectId(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !value) throw new Error(`${path} must be a non-empty string`);
}

export function expectFinite(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${path} must be finite`);
}

export function expectPositiveFinite(value: unknown, path: string): asserts value is number {
  expectFinite(value, path);
  if (value <= 0) throw new Error(`${path} must be positive`);
}
