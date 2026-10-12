import { describe, expect, it } from 'vitest';
import { detectTriState, markFor, TRI_STATE_MARK } from '../src/core/triState.js';

describe('detectTriState', () => {
  it('detects emoji markers on list items', () => {
    expect(detectTriState('- ✅ 已确认功能')).toEqual({ state: 'confirmed', text: '已确认功能' });
    expect(detectTriState('- 🟡 默认方案功能')).toEqual({ state: 'default', text: '默认方案功能' });
    expect(detectTriState('- ⚠️ 待确认功能')).toEqual({ state: 'pending', text: '待确认功能' });
  });

  it('strips a leading bullet regardless of marker position', () => {
    expect(detectTriState('* ✅ starred item')).toEqual({
      state: 'confirmed',
      text: 'starred item',
    });
    expect(detectTriState('+ ✅ plus item')).toEqual({ state: 'confirmed', text: 'plus item' });
  });

  it('supports textual tags as a fallback', () => {
    expect(detectTriState('- [已确认] text form')).toEqual({
      state: 'confirmed',
      text: 'text form',
    });
    expect(detectTriState('- [待确认] pending form')).toEqual({
      state: 'pending',
      text: 'pending form',
    });
  });

  it('returns null when no marker is present', () => {
    expect(detectTriState('- plain item')).toBeNull();
    expect(detectTriState('## 标题')).toBeNull();
    expect(detectTriState('')).toBeNull();
  });
});

describe('markFor', () => {
  it('returns the emoji for a state', () => {
    expect(markFor('confirmed')).toBe(TRI_STATE_MARK.confirmed);
    expect(markFor('pending')).toBe('⚠️');
  });
});
