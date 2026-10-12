/**
 * Core shared types for speculor-ai.
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

/* ---------------------------------------------------------------------------
 * Evidence chain (PROPOSAL §8.5.1)
 * Each coverage judgement for a spec target carries an auditable location in
 * the plan, so the alignment gate is verifiable instead of a black box.
 * ------------------------------------------------------------------------- */

/** Which detection channel contributed to a judgement. */
export type MatchKind = 'explicit-covers' | 'text-match';

/** Coverage judgement for a single spec target. */
export type EvidenceStatus = 'covered' | 'partial' | 'not-covered';

/** Where in the plan a piece of evidence lives. */
export interface EvidenceSource {
  /** Section heading (primary anchor — survives most edits). */
  section: string;
  /** Line range (best-effort reference only, may drift after edits). */
  startLine?: number;
  endLine?: number;
  /** A snippet of the matched text (first sentence, sentence-bounded). */
  snippet: string;
}

/** A "closest but not matched" hint, so false negatives stay traceable. */
export interface NearMiss {
  section: string;
  startLine?: number;
  endLine?: number;
  snippet: string;
}

/**
 * Auditable evidence for one spec target's coverage judgement.
 * `source` is null only when no channel hit at all (a real not-covered).
 */
export interface Evidence {
  /** Identity with a type prefix, e.g. `fp:3` / `ac:2` (uniquely resolvable). */
  targetId: string;
  /** The target's original text. */
  targetText: string;
  status: EvidenceStatus;
  /** True when a human should confirm before trusting this judgement. */
  needsReview: boolean;
  /** Corroboration strength in [0, 1] (see PROPOSAL §8.5.1/8.5.2). */
  confidence: number;
  /** Channels that contributed (array — can express corroboration). */
  matchKind: MatchKind[];
  /** Optional plan snapshot anchor (e.g. file mtime) for auditability. */
  planRef?: string;
  /** Present iff at least one channel hit. */
  source: EvidenceSource | null;
  /** Present iff not-covered and a close-but-not-matched segment exists. */
  nearMiss?: NearMiss;
}
