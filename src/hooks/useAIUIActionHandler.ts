/**
 * useAIUIActionHandler
 * Pages use this hook to register their ability to handle AI-driven UI actions
 * (select rows, apply filters, sort columns, clear selection).
 * 
 * The AI Command Center dispatches actions through the provider,
 * and this hook bridges them to page-level state.
 */

import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAICommandCenterContext } from '@/components/ai-command-center/AICommandCenterProvider';
import type { UIActionPayload } from '@/hooks/useAICommandCenter';
import { toast } from 'sonner';

export interface AIUIActionHandlers {
  /** Which table this page manages (matches backend tool's `table` enum) */
  table: 'deals' | 'buyers' | 'leads' | 'scores' | 'transcripts';
  /** Called when the AI wants to select specific row IDs */
  onSelectRows?: (rowIds: string[], mode: 'replace' | 'add' | 'toggle') => void;
  /** Called when the AI wants to clear selection */
  onClearSelection?: () => void;
  /** Called when the AI wants to apply filters */
  onApplyFilter?: (filters: Array<{ field: string; operator: string; value: unknown }>, clearExisting: boolean) => void;
  /** Called when the AI wants to sort a column */
  onSortColumn?: (field: string, direction: 'asc' | 'desc') => void;
  /** Called when the AI wants to highlight rows (visual only, no selection) */
  onHighlightRows?: (rowIds: string[]) => void;
}

/**
 * Register a page as a handler for AI UI actions.
 * When the AI Command Center emits actions targeting this page's table,
 * the registered callbacks will be invoked.
 */
export function useAIUIActionHandler(handlers: AIUIActionHandlers) {
  const { registerUIActionHandler, unregisterUIActionHandler } = useAICommandCenterContext();
  const navigate = useNavigate();

  const handleAction = useCallback((action: UIActionPayload) => {
    const { type, target, payload } = action;

    // Handle navigation globally
    if (type === 'navigate') {
      const route = payload.route as string;
      if (route) {
        navigate(route);
        toast.info(`Navigating to ${route}`);
      }
      return;
    }

    // Only handle actions targeting this page's table
    const expectedTarget = `${handlers.table}_table`;
    if (target !== expectedTarget) {
      console.log(`[ai-ui-action] Ignoring action for ${target} (this page handles ${expectedTarget})`);
      return;
    }

    switch (type) {
      case 'select_rows': {
        const rowIds = payload.row_ids as string[];
        const mode = (payload.select_mode as 'replace' | 'add' | 'toggle') || 'replace';
        if (handlers.onSelectRows && rowIds?.length > 0) {
          handlers.onSelectRows(rowIds, mode);
          toast.success(`AI selected ${rowIds.length} row${rowIds.length !== 1 ? 's' : ''}`);
        }
        break;
      }

      case 'clear_selection': {
        handlers.onClearSelection?.();
        break;
      }

      case 'apply_filter': {
        const filters = payload.filters as Array<{ field: string; operator: string; value: unknown }>;
        const clearExisting = payload.clear_existing !== false;
        if (handlers.onApplyFilter && filters?.length > 0) {
          handlers.onApplyFilter(filters, clearExisting);
          toast.success(`AI applied ${filters.length} filter${filters.length !== 1 ? 's' : ''}`);
        }
        break;
      }

      case 'sort_column': {
        const field = payload.field as string;
        const direction = (payload.direction as 'asc' | 'desc') || 'desc';
        if (handlers.onSortColumn && field) {
          handlers.onSortColumn(field, direction);
          toast.success(`AI sorted by ${field} (${direction})`);
        }
        break;
      }

      case 'highlight_rows': {
        const rowIds = payload.row_ids as string[];
        if (handlers.onHighlightRows && rowIds?.length > 0) {
          handlers.onHighlightRows(rowIds);
        }
        break;
      }

      default:
        console.warn(`[ai-ui-action] Unknown action type: ${type}`);
    }
  }, [handlers, navigate]);

  // Register on mount, unregister on unmount
  useEffect(() => {
    registerUIActionHandler(handleAction);
    return () => {
      unregisterUIActionHandler();
    };
  }, [handleAction, registerUIActionHandler, unregisterUIActionHandler]);
}
