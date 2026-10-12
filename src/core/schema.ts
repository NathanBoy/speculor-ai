import type { Priority, SpecFrontmatter, SpecStatus } from '../types.js';

export const SPEC_STATUSES: SpecStatus[] = [
  'proposed',
  'planned',
  'in-progress',
  'done',
  'archived',
];
export const PRIORITIES: Priority[] = ['P0', 'P1', 'P2'];

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Minimal structural validation for a parsed frontmatter object.
 *
 * specdev intentionally avoids pulling in a full JSON-Schema runtime (ajv) to
 * keep the published CLI dependency-free. This hand-rolled validator covers the
 * fields specdev itself consumes — types, enums, required-ness, and the id
 * format — which is exactly the contract we need to gate a workflow on.
 *
 * The shape mirrors a JSON Schema; if a full schema validator is ever needed,
 * the {@link FRONTMATTER_JSON_SCHEMA} declaration can be wired into ajv.
 */
export function validateFrontmatter(value: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, errors: ['frontmatter must be a mapping object'] };
  }
  const fm = value as Record<string, unknown>;

  checkString(fm, 'id', errors, true);
  if (typeof fm.id === 'string' && !ID_PATTERN.test(fm.id)) {
    errors.push(`id "${fm.id}" must match ${ID_PATTERN}`);
  }

  checkString(fm, 'capability', errors, true);

  if (fm.status !== undefined && !SPEC_STATUSES.includes(fm.status as SpecStatus)) {
    errors.push(`status must be one of: ${SPEC_STATUSES.join(', ')}`);
  }
  if (fm.priority !== undefined && !PRIORITIES.includes(fm.priority as Priority)) {
    errors.push(`priority must be one of: ${PRIORITIES.join(', ')}`);
  }

  checkStringArray(fm, 'dependsOn', errors);
  checkStringArray(fm, 'acceptanceCriteria', errors);

  return { ok: errors.length === 0, errors };
}

/**
 * A faithful JSON-Schema description of the frontmatter contract.
 *
 * Kept for documentation and for any future opt-in to a full schema engine.
 * The default validator used at runtime is {@link validateFrontmatter}.
 */
export const FRONTMATTER_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'specdev:frontmatter',
  title: 'specdev spec frontmatter',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'capability'],
  properties: {
    id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$' },
    capability: { type: 'string', minLength: 1 },
    status: { type: 'string', enum: SPEC_STATUSES, default: 'proposed' },
    priority: { type: 'string', enum: PRIORITIES, default: 'P1' },
    dependsOn: { type: 'array', items: { type: 'string' }, default: [] },
    acceptanceCriteria: { type: 'array', items: { type: 'string' }, default: [] },
  },
} as const;

function checkString(
  fm: Record<string, unknown>,
  key: string,
  errors: string[],
  required: boolean,
): void {
  const v = fm[key];
  if (v === undefined || v === null) {
    if (required) errors.push(`missing required field "${key}"`);
    return;
  }
  if (typeof v !== 'string' || v.length === 0) {
    errors.push(`"${key}" must be a non-empty string`);
  }
}

function checkStringArray(fm: Record<string, unknown>, key: string, errors: string[]): void {
  const v = fm[key];
  if (v === undefined || v === null) return;
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
    errors.push(`"${key}" must be an array of strings`);
  }
}

/** Normalise an arbitrary frontmatter into a typed SpecFrontmatter with defaults. */
export function normalizeFrontmatter(value: Record<string, unknown>): SpecFrontmatter {
  return {
    id: String(value.id ?? ''),
    capability: String(value.capability ?? ''),
    status: (value.status as SpecStatus) ?? 'proposed',
    priority: (value.priority as Priority) ?? 'P1',
    dependsOn: Array.isArray(value.dependsOn) ? value.dependsOn.map(String) : [],
    acceptanceCriteria: Array.isArray(value.acceptanceCriteria)
      ? value.acceptanceCriteria.map(String)
      : [],
  };
}
