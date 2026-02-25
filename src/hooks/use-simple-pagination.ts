import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface PaginationState {
  page: number;
  perPage: number;
  search: string;
  category: string;
  location: string;
  revenueMin?: number;
  revenueMax?: number;
  ebitdaMin?: number;
  ebitdaMax?: number;
}

const DEFAULTS: PaginationState = {
  page: 1,
  perPage: 20,
  search: '',
  category: 'all',
  location: 'all',
};

/** Read pagination/filter state from URL search params. */
function readState(params: URLSearchParams): PaginationState {
  const page = Number(params.get('page')) || DEFAULTS.page;
  const perPage = Number(params.get('perPage')) || DEFAULTS.perPage;
  const search = params.get('q') ?? DEFAULTS.search;
  const category = params.get('category') ?? DEFAULTS.category;
  const location = params.get('location') ?? DEFAULTS.location;
  const revenueMin = params.has('revMin') ? Number(params.get('revMin')) : undefined;
  const revenueMax = params.has('revMax') ? Number(params.get('revMax')) : undefined;
  const ebitdaMin = params.has('ebMin') ? Number(params.get('ebMin')) : undefined;
  const ebitdaMax = params.has('ebMax') ? Number(params.get('ebMax')) : undefined;

  return {
    page,
    perPage,
    search,
    category,
    location,
    revenueMin,
    revenueMax,
    ebitdaMin,
    ebitdaMax,
  };
}

/** Write pagination/filter state to URL search params (only non-default values). */
function writeState(prev: URLSearchParams, next: PaginationState): URLSearchParams {
  const params = new URLSearchParams(prev);

  const set = (key: string, val: string | undefined, def: string) => {
    if (val && val !== def) params.set(key, val);
    else params.delete(key);
  };
  const setNum = (key: string, val: number | undefined, def?: number) => {
    if (val !== undefined && val !== def) params.set(key, String(val));
    else params.delete(key);
  };

  setNum('page', next.page, DEFAULTS.page);
  setNum('perPage', next.perPage, DEFAULTS.perPage);
  set('q', next.search, DEFAULTS.search);
  set('category', next.category, DEFAULTS.category);
  set('location', next.location, DEFAULTS.location);
  setNum('revMin', next.revenueMin);
  setNum('revMax', next.revenueMax);
  setNum('ebMin', next.ebitdaMin);
  setNum('ebMax', next.ebitdaMax);

  return params;
}

export function useSimplePagination() {
  const [searchParams, setSearchParams] = useSearchParams();

  const state = useMemo(() => readState(searchParams), [searchParams]);

  const setPage = useCallback(
    (page: number) => {
      setSearchParams((prev) => writeState(prev, { ...readState(prev), page }), { replace: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [setSearchParams],
  );

  const setPerPage = useCallback(
    (perPage: number) => {
      setSearchParams((prev) => writeState(prev, { ...readState(prev), page: 1, perPage }), {
        replace: true,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [setSearchParams],
  );

  const setFilters = useCallback(
    (filters: Partial<PaginationState>) => {
      setSearchParams(
        (prev) => {
          const current = readState(prev);
          const hasActualFilters = Object.keys(filters).some(
            (key) =>
              key !== 'page' &&
              key !== 'perPage' &&
              filters[key as keyof PaginationState] !== undefined,
          );
          const merged: PaginationState = {
            ...current,
            page: hasActualFilters ? 1 : current.page,
            ...filters,
          };
          return writeState(prev, merged);
        },
        { replace: true },
      );

      const hasActualFilters = Object.keys(filters).some(
        (key) =>
          key !== 'page' &&
          key !== 'perPage' &&
          filters[key as keyof PaginationState] !== undefined,
      );
      if (hasActualFilters) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchParams(
      (prev) =>
        writeState(prev, {
          ...readState(prev),
          page: 1,
          search: '',
          category: 'all',
          location: 'all',
          revenueMin: undefined,
          revenueMax: undefined,
          ebitdaMin: undefined,
          ebitdaMax: undefined,
        }),
      { replace: true },
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setSearchParams]);

  return {
    state,
    setPage,
    setPerPage,
    setFilters,
    resetFilters,
  };
}
