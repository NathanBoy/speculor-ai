/**
 * Core shared types for specdev.
 *
 * A "spec" is a Markdown document with a YAML frontmatter block that carries
 * structured, machine-checkable metadata (id, status, priority, dependencies,
 * acceptance criteria). The body is free-form Markdown focused on *what* and
 * *why* — not *how*.
 */

/** A confirmation state for a single item (borrowed from mature gated workflows). */
export type TriState = 'confirmed' | 'default' | 'pending';

/** Lifecycle of a spec / change. */
export type SpecStatus = 'proposed' | 'planned' | 'in-progress' | 'done' | 'archived';

/** Rough priority used when generating checklists and gating. */
export type Priority = 'P0' | 'P1' | 'P2';

/** Structured metadata parsed from a spec's YAML frontmatter. */
export interface SpecFrontmatter {
  /** Stable identifier, e.g. `auth-login`. */
  id: string;
  /** Capability this spec belongs to, e.g. `auth`. */
  capability: string;
  status: SpecStatus;
  priority: Priority;
  /** Ids of specs this one depends on. */
  dependsOn: string[];
  /** Machine-and-human readable acceptance criteria. */
  acceptanceCriteria: string[];
}

/** A single parsed item (feature point) from the spec body, with its tri-state. */
export interface SpecItem {
  /** The visible text of the item (emoji / tag stripped). */
  text: string;
  state: TriState;
}

/** A fully parsed spec document. */
export interface SpecDoc {
  /** Absolute or resolved path of the spec file. */
  path: string;
  frontmatter: SpecFrontmatter;
  /** Raw body Markdown (frontmatter removed). */
  body: string;
  /** Feature points extracted from the body, each with a tri-state. */
  items: SpecItem[];
}

/** A single problem found during validation. */
export interface ValidationIssue {
  severity: 'error' | 'warning';
  /** File the issue belongs to (empty for project-level issues). */
  file: string;
  message: string;
}

/** One row in a generated acceptance checklist. */
export interface ChecklistEntry {
  priority: Priority;
  criterion: string;
  /** How to verify this criterion (test / manual step / assertion). */
  verify: string;
}

/** Options that tune validation behaviour. */
export interface ValidateOptions {
  /**
   * Project root used to decide whether a doc belongs to `specs/` or `changes/`.
   * When omitted, specs-vs-changes classification falls back to a best effort.
   */
  root?: string;
  /**
   * Allow `⚠️ pending` items to pass validation.
   * Default: `false` — pending items block progression (the gating protocol).
   */
  allowPending?: boolean;
}
