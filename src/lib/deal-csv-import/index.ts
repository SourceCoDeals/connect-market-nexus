/**
 * Unified Deal CSV Import Engine
 * 
 * This module provides a single, well-tested import system used by:
 * - /admin/remarketing/deals (DealImportDialog)
 * - /admin/remarketing/universes/:id (DealCSVImport)
 */

export * from './types';
export * from './constants';
export * from './parsers';
export { processRow } from './row-processor';
export { mergeColumnMappings, type MergeStats } from './merge-mappings';
