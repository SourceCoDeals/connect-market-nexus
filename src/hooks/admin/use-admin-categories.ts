
import { 
  useCategoriesQuery, 
  useCreateCategory, 
  useUpdateCategory, 
  useDeleteCategory 
} from './use-categories';

/**
 * Hook for managing categories in admin dashboard
 */
export function useAdminCategories() {
  return {
    useCategories: useCategoriesQuery,
    useCreateCategory,
    useUpdateCategory,
    useDeleteCategory,
  };
}
