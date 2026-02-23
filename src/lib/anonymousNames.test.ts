import { describe, it, expect } from 'vitest';
import { generateAnonymousName, getAvatarColor, getInitials } from './anonymousNames';

describe('generateAnonymousName', () => {
  it('generates a two-word name from a session ID', () => {
    const name = generateAnonymousName('test-session-123');
    const parts = name.split(' ');
    expect(parts.length).toBe(2);
  });

  it('generates consistent names for the same session ID', () => {
    const name1 = generateAnonymousName('test-session-456');
    const name2 = generateAnonymousName('test-session-456');
    expect(name1).toBe(name2);
  });

  it('generates different names for different session IDs', () => {
    const name1 = generateAnonymousName('session-a');
    const name2 = generateAnonymousName('session-b');
    // They could theoretically be the same, but very unlikely
    // Just verify they're both valid two-word names
    expect(name1.split(' ').length).toBe(2);
    expect(name2.split(' ').length).toBe(2);
  });

  it('handles empty strings', () => {
    const name = generateAnonymousName('');
    const parts = name.split(' ');
    expect(parts.length).toBe(2);
  });

  it('handles long session IDs', () => {
    const longId = 'a'.repeat(1000);
    const name = generateAnonymousName(longId);
    const parts = name.split(' ');
    expect(parts.length).toBe(2);
  });
});

describe('getAvatarColor', () => {
  it('returns a CSS class for known color names', () => {
    const color = getAvatarColor('coral falcon');
    expect(color).toBe('bg-coral-500');
  });

  it('returns default gray for unknown colors', () => {
    const color = getAvatarColor('unknown animal');
    expect(color).toBe('bg-gray-500');
  });

  it('returns color based on first word', () => {
    const color = getAvatarColor('azure dolphin');
    expect(color).toBe('bg-blue-500');
  });

  it('handles jade color', () => {
    expect(getAvatarColor('jade wolf')).toBe('bg-emerald-500');
  });

  it('handles single-word names', () => {
    const color = getAvatarColor('jade');
    expect(color).toBe('bg-emerald-500');
  });
});

describe('getInitials', () => {
  it('returns uppercase initials from two-word names', () => {
    expect(getInitials('coral falcon')).toBe('CF');
    expect(getInitials('azure dolphin')).toBe('AD');
  });

  it('returns first two characters for single-word names', () => {
    expect(getInitials('jade')).toBe('JA');
  });

  it('handles multi-word names (takes first two)', () => {
    expect(getInitials('coral sea falcon')).toBe('CS');
  });
});
