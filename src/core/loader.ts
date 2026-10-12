import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, basename, dirname, sep } from 'node:path';
import type { SpecDoc, SpecItem } from '../types.js';
import { detectTriState } from './triState.js';
import { normalizeFrontmatter, validateFrontmatter } from './schema.js';

/**
 * Loading and parsing of `.specdev/` documents.
 *
 * Two kinds of documents exist:
 *  - `specs/<capability>/spec.md`  — the source of truth for current behaviour.
 *  - `changes/<name>/spec.md`      — a proposed change, not yet merged.
 *
 * This module is intentionally fs-only and has zero runtime dependencies.
 */

/** Directory that holds all specdev artifacts (relative to a project root). */
export const SPECDEV_DIR = '.specdev';
export const SPECS_DIR = 'specs';
export const CHANGES_DIR = 'changes';

/** The default frontmatter keys, in canonical order, used when (re)writing specs. */
export const FRONTMATTER_KEYS = [
  'id',
  'capability',
  'status',
  'priority',
  'dependsOn',
  'acceptanceCriteria',
] as const;

/**
 * Parse the YAML block between the `---` fences into a plain object.
 *
 * This is a deliberately small YAML subset covering what specdev specs need:
 * scalar keys, inline arrays (`[a, b]`), and multi-line arrays of quoted or
 * plain strings. Anything else is left as-is (best effort).
 */
export function parseFrontmatterYaml(block: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = block.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] as string;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      i += 1;
      continue;
    }

    const match = /^([A-Za-z][A-Za-z0-9-]*)\s*:\s*(.*)$/.exec(trimmed);
    if (!match) {
      i += 1;
      continue;
    }
    const key = match[1] ?? '';
    const inlineValue = match[2] ?? '';

    // Inline array: `key: [a, b]`
    if (inlineValue.trim().startsWith('[')) {
      result[key] = parseInlineArray(inlineValue);
      i += 1;
      continue;
    }
    // Scalar value present on the same line.
    if (inlineValue.trim().length > 0) {
      result[key] = parseScalar(inlineValue);
      i += 1;
      continue;
    }

    // Key with no value: collect a multi-line array of `- item` entries.
    const arrayItems: string[] = [];
    i += 1;
    while (i < lines.length) {
      const next = lines[i] as string;
      const nextTrimmed = next.trim();
      if (nextTrimmed.startsWith('- ')) {
        arrayItems.push(stripQuotes(nextTrimmed.slice(2).trim()));
        i += 1;
        continue;
      }
      break;
    }
    result[key] = arrayItems;
  }

  return result;
}

/** Parse a `[a, b]` inline array, stripping quotes from each element. */
function parseInlineArray(value: string): string[] {
  const inner = value.trim().slice(1, -1);
  if (!inner.trim()) return [];
  return inner
    .split(',')
    .map((part) => stripQuotes(part.trim()))
    .filter(Boolean);
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/** Parse a scalar value into a string / boolean / number as appropriate. */
function parseScalar(raw: string): unknown {
  const v = raw.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  return stripQuotes(v);
}

/** Split raw file content into `{ frontmatter, body }`. */
export function splitFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
  raw: string | null;
} {
  const lines = content.split(/\r?\n/);
  // The very first line must be the opening fence.
  if (!(lines[0] as string).trim().startsWith('---')) {
    return { frontmatter: {}, body: content, raw: null };
  }
  const fenceEnd = lines.findIndex((l, idx) => idx > 0 && l.trim() === '---');
  if (fenceEnd === -1) {
    return { frontmatter: {}, body: content, raw: null };
  }
  const raw = lines.slice(1, fenceEnd).join('\n');
  const body = lines.slice(fenceEnd + 1).join('\n');
  return { frontmatter: parseFrontmatterYaml(raw), body, raw };
}

/** Extract tri-state-tagged feature points from a spec body. */
export function parseItems(body: string): SpecItem[] {
  const items: SpecItem[] = [];
  for (const line of body.split(/\r?\n/)) {
    const detected = detectTriState(line);
    if (detected) items.push(detected);
  }
  return items;
}

/** Parse a spec file's raw content into a typed SpecDoc. */
export function parseSpecDoc(path: string, content: string): SpecDoc {
  const { frontmatter, body } = splitFrontmatter(content);
  // Always normalise so downstream consumers get a well-typed object even when
  // the file is structurally invalid (validation reports the problems).
  const normalized = normalizeFrontmatter(frontmatter);
  void validateFrontmatter(frontmatter); // surfaced separately during validate
  return {
    path,
    frontmatter: normalized,
    body,
    items: parseItems(body),
  };
}

/** Recursively list all `spec.md` files under a directory (top-down). */
async function findSpecFiles(root: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(root);
  } catch {
    return; // directory missing → nothing to find
  }
  for (const name of entries) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(root, name);
    const info = await stat(full);
    if (info.isDirectory()) {
      await findSpecFiles(full, out);
    } else if (info.isFile() && name === 'spec.md') {
      out.push(full);
    }
  }
}

/**
 * Load all spec documents under a project's `.specdev` directory.
 *
 * @param root   The project root (must contain `.specdev/`).
 * @param kind   Restrict to a single document kind.
 */
export async function loadAllSpecs(
  root: string,
  kind: 'all' | 'specs' | 'changes' = 'all',
): Promise<SpecDoc[]> {
  const base = join(root, SPECDEV_DIR);
  const targets: string[] = [];
  if (kind === 'all' || kind === 'specs') await findSpecFiles(join(base, SPECS_DIR), targets);
  if (kind === 'all' || kind === 'changes') await findSpecFiles(join(base, CHANGES_DIR), targets);

  const docs: SpecDoc[] = [];
  for (const file of targets) {
    const content = await readFile(file, 'utf8');
    docs.push(parseSpecDoc(file, content));
  }
  return docs.sort((a, b) => a.path.localeCompare(b.path));
}

/** Whether a spec file belongs to `specs/` (source of truth) or `changes/`. */
export function isChangeDoc(doc: SpecDoc, root: string): boolean {
  const rel = relative(join(root, SPECDEV_DIR), doc.path);
  return rel.startsWith(`${CHANGES_DIR}${sep}`);
}

/** Derive the change name from a change spec path (`changes/<name>/spec.md`). */
export function changeNameOf(doc: SpecDoc, root: string): string {
  const rel = relative(join(root, SPECDEV_DIR), doc.path);
  const parts = rel.split(sep);
  if (parts[0] === CHANGES_DIR && parts.length >= 3) return parts[1] as string;
  return basename(dirname(doc.path));
}
