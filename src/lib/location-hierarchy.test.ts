import { describe, it, expect } from 'vitest';
import {
  expandLocation,
  expandLocations,
  getParentLocation,
  isLocationWithin
} from './location-hierarchy';

describe('expandLocation', () => {
  it('expands North America to include US regions', () => {
    const expanded = expandLocation('North America');
    expect(expanded).toContain('North America');
    expect(expanded).toContain('United States');
    expect(expanded).toContain('Canada');
    expect(expanded).toContain('Northeast US');
    expect(expanded).toContain('Southeast US');
    expect(expanded).toContain('Midwest US');
  });

  it('expands United States to include regions', () => {
    const expanded = expandLocation('United States');
    expect(expanded).toContain('United States');
    expect(expanded).toContain('Northeast US');
    expect(expanded).toContain('Southeast US');
    expect(expanded).toContain('Western US');
  });

  it('returns single-element array for leaf locations', () => {
    const expanded = expandLocation('Canada');
    expect(expanded).toContain('Canada');
  });

  it('removes duplicates', () => {
    const expanded = expandLocation('North America');
    const unique = [...new Set(expanded)];
    expect(expanded.length).toBe(unique.length);
  });

  it('handles unknown locations', () => {
    const expanded = expandLocation('Unknown Place');
    expect(expanded).toEqual(['Unknown Place']);
  });
});

describe('expandLocations', () => {
  it('expands multiple locations', () => {
    const expanded = expandLocations(['North America', 'Europe']);
    expect(expanded).toContain('North America');
    expect(expanded).toContain('United States');
    expect(expanded).toContain('Europe');
    expect(expanded).toContain('United Kingdom');
  });

  it('removes duplicates across expansions', () => {
    const expanded = expandLocations(['North America', 'United States']);
    const unique = [...new Set(expanded)];
    expect(expanded.length).toBe(unique.length);
  });

  it('handles empty array', () => {
    expect(expandLocations([])).toEqual([]);
  });
});

describe('getParentLocation', () => {
  it('returns parent for US regions', () => {
    expect(getParentLocation('Northeast US')).toBe('United States');
    expect(getParentLocation('Southeast US')).toBe('United States');
  });

  it('returns parent for United States', () => {
    expect(getParentLocation('United States')).toBe('North America');
  });

  it('returns null for top-level locations', () => {
    expect(getParentLocation('North America')).toBeNull();
  });

  it('returns null for unknown locations', () => {
    expect(getParentLocation('Unknown')).toBeNull();
  });
});

describe('isLocationWithin', () => {
  it('returns true for locations within hierarchy', () => {
    expect(isLocationWithin('Northeast US', 'North America')).toBe(true);
    expect(isLocationWithin('United States', 'North America')).toBe(true);
    expect(isLocationWithin('Northeast US', 'United States')).toBe(true);
  });

  it('returns true for same location', () => {
    expect(isLocationWithin('United States', 'United States')).toBe(true);
  });

  it('returns false for locations outside hierarchy', () => {
    expect(isLocationWithin('United Kingdom', 'North America')).toBe(false);
  });

  it('returns false when target is the container (not recursive up)', () => {
    expect(isLocationWithin('North America', 'Northeast US')).toBe(false);
  });
});
