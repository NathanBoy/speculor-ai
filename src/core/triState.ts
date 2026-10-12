import type { TriState } from '../types.js';

/**
 * Tri-state markers used inline in spec bodies.
 *
 * Each feature point / acceptance item is tagged with one of three states so
 * that "confirmed facts" are clearly distinguished from "default assumptions"
 * and "open questions" — the spec stays honest about what is real vs. assumed.
 */
export const TRI_STATE_MARK: Record<TriState, string> = {
  confirmed: '✅',
  default: '🟡',
  pending: '⚠️',
};

export const TRI_STATE_LABEL: Record<TriState, string> = {
  confirmed: '已确认',
  default: '默认方案',
  pending: '待确认',
};

const EMOJI_TO_STATE: Record<string, TriState> = {
  [TRI_STATE_MARK.confirmed]: 'confirmed',
  [TRI_STATE_MARK.default]: 'default',
  [TRI_STATE_MARK.pending]: 'pending',
};

// Accept textual fallbacks in case emoji get mangled in some editors.
const TAG_TO_STATE: Record<string, TriState> = {
  '[已确认]': 'confirmed',
  '[默认]': 'default',
  '[待确认]': 'pending',
};

/**
 * Detect the tri-state marker at the start of a list item's text.
 *
 * Supports both emoji (`- ✅ foo`) and textual (`- [已确认] foo`) forms.
 * Returns the state plus the cleaned text (marker stripped), or `null` when the
 * line carries no tri-state marker.
 */
export function detectTriState(raw: string): { state: TriState; text: string } | null {
  // Normalise: strip a leading list bullet (`- ` / `* `) before matching.
  let line = raw.trim();
  const bullet = /^[-*+]\s+/.exec(line);
  if (bullet) line = line.slice(bullet[0].length);

  for (const [emoji, state] of Object.entries(EMOJI_TO_STATE)) {
    if (line.startsWith(emoji)) {
      return { state, text: line.slice(emoji.length).trim() };
    }
  }
  for (const [tag, state] of Object.entries(TAG_TO_STATE)) {
    if (line.startsWith(tag)) {
      return { state, text: line.slice(tag.length).trim() };
    }
  }
  return null;
}

/**
 * Render a tri-state marker for a given state (emoji form).
 */
export function markFor(state: TriState): string {
  return TRI_STATE_MARK[state];
}
