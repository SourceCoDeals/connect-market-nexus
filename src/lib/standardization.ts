import { STANDARDIZED_CATEGORIES, STANDARDIZED_LOCATIONS } from '@/lib/financial-parser';

// Create canonical keys for robust matching (case, punctuation, & vs and)
const canonicalize = (s: string = ''): string => {
  return s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

const buildMap = (values: string[]) => {
  const map = new Map<string, string>();
  values.forEach((v) => {
    map.set(canonicalize(v), v);
  });
  return map;
};

const CATEGORY_MAP = buildMap([...STANDARDIZED_CATEGORIES]);
const LOCATION_MAP = buildMap([...STANDARDIZED_LOCATIONS]);

export const toStandardCategory = (value?: string) => {
  if (!value) return '';
  const v = value.trim();
  return CATEGORY_MAP.get(canonicalize(v)) ?? v;
};

export const toStandardLocation = (value?: string) => {
  if (!value) return '';
  const v = value.trim();
  return LOCATION_MAP.get(canonicalize(v)) ?? v;
};

export const standardizeCategories = (values: string[] = []) => values.map(toStandardCategory);
export const standardizeLocations = (values: string[] = []) => values.map(toStandardLocation);

export const toCanonical = canonicalize;
