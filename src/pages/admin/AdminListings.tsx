import { useEffect } from 'react';
import ListingsManagementTabs from "@/components/admin/ListingsManagementTabs";
import { useAICommandCenterContext } from '@/components/ai-command-center/AICommandCenterProvider';

const AdminListings = () => {
  // Register AI Command Center context
  const { setPageContext } = useAICommandCenterContext();
  useEffect(() => {
    setPageContext({ page: 'listings', entity_type: 'listings' });
  }, [setPageContext]);

  return <ListingsManagementTabs />;
};

export default AdminListings;
