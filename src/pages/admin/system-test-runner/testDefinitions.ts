/**
 * Barrel re-export for system test definition modules.
 *
 * All original exports remain accessible from this path
 * for backwards compatibility.
 */

export * from './types';
export * from './schemaTests';
export * from './apiTests';
export * from './edgeFunctionTests';

import type { TestDef } from './types';
import { buildSchemaTests } from './schemaTests';
import { buildApiTests } from './apiTests';
import { buildEdgeFunctionTests } from './edgeFunctionTests';

export function buildTests(): TestDef[] {
  return [
    ...buildSchemaTests(),
    ...buildApiTests(),
    ...buildEdgeFunctionTests(),
  ];
}
