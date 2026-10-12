import type { SpecDoc, ValidationIssue, ValidateOptions } from '../types.js';
import { validateFrontmatter } from './schema.js';
import { isChangeDoc } from './loader.js';

/**
 * Validation pass over a project's specs.
 *
 * Checks, in order:
 *  1. Every frontmatter block is structurally valid (types / enums / required).
 *  2. Spec ids are unique within the `specs/` source of truth.
 *  3. `dependsOn` references resolve to real specs.
 *  4. Tri-state gating: `⚠️ pending` items block progression by default.
 *
 * Warnings (non-blocking) flag specs with no acceptance criteria or no tagged
 * items, so authors get useful signal without being forced to fix it.
 */
export function validateAll(docs: SpecDoc[], options: ValidateOptions = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const specs = docs.filter((d) => !isChangeDoc(d, options.root ?? ''));
  const changes = docs.filter((d) => isChangeDoc(d, options.root ?? ''));

  const knownIds = new Map<string, string>();

  // --- structural validity + id uniqueness -----------------------------------
  for (const doc of [...specs, ...changes]) {
    const result = validateFrontmatter(doc.frontmatter);
    for (const message of result.errors) {
      issues.push({ severity: 'error', file: doc.path, message });
    }
    if (result.ok) {
      const existing = knownIds.get(doc.frontmatter.id);
      if (existing) {
        issues.push({
          severity: 'error',
          file: doc.path,
          message: `duplicate spec id "${doc.frontmatter.id}" (also used by ${existing})`,
        });
      } else {
        knownIds.set(doc.frontmatter.id, doc.path);
      }
    }
  }

  // --- dependency resolution ------------------------------------------------
  for (const doc of docs) {
    if (!knownIds.has(doc.frontmatter.id)) continue; // already broken structurally
    for (const dep of doc.frontmatter.dependsOn) {
      if (!knownIds.has(dep)) {
        issues.push({
          severity: 'error',
          file: doc.path,
          message: `dependsOn "${dep}" does not resolve to any known spec id`,
        });
      }
    }
  }

  // --- tri-state gating ------------------------------------------------------
  if (!options.allowPending) {
    for (const doc of [...specs, ...changes]) {
      for (const item of doc.items) {
        if (item.state === 'pending') {
          issues.push({
            severity: 'error',
            file: doc.path,
            message: `pending item blocks progression: "${item.text}" (confirm it or pass --allow-pending)`,
          });
        }
      }
    }
  }

  // --- helpful warnings ------------------------------------------------------
  for (const doc of [...specs, ...changes]) {
    if (doc.frontmatter.acceptanceCriteria.length === 0) {
      issues.push({
        severity: 'warning',
        file: doc.path,
        message: 'no acceptanceCriteria declared — `speculor-ai check` will have nothing to verify',
      });
    }
    if (doc.items.length === 0) {
      issues.push({
        severity: 'warning',
        file: doc.path,
        message:
          'no tri-state tagged items found in body — consider tagging feature points with ✅/🟡/⚠️',
      });
    }
  }

  return issues;
}

/** Convenience: true when there are no `error`-severity issues. */
export function hasBlockingErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
