import { User } from '@/types';
import { getRelevantFieldsForBuyerType, FIELD_LABELS } from '@/lib/buyer-type-fields';

export const useEnhancedUserExport = () => {
  const exportUsersToCSV = (users: User[]) => {
    if (users.length === 0) {
      console.warn('No users to export');
      return;
    }

    // Create headers with buyer-type aware fields
    const headers = ['ID', 'Email', 'Name', 'Company', 'Buyer Type', 'Approval Status', 'Admin', 'Created At'];
    
    // Add dynamic headers based on all buyer types present
    const allBuyerTypes = [...new Set(users.map(user => user.buyer_type || 'corporate'))];
    const allRelevantFields = new Set<string>();
    
    allBuyerTypes.forEach(buyerType => {
      // Use a type assertion since we know admin is a valid value
      const fields = getRelevantFieldsForBuyerType(buyerType as any);
      fields.forEach(field => {
        if (!['first_name', 'last_name', 'email', 'company'].includes(field)) {
          allRelevantFields.add(field);
        }
      });
    });

    // Add field headers
    Array.from(allRelevantFields).forEach(field => {
      headers.push(FIELD_LABELS[field as keyof typeof FIELD_LABELS] || field);
    });

    // Create CSV rows
    const csvData = users.map(user => {
      const userBuyerType = user.buyer_type || 'corporate';
      const relevantFields = user.is_admin 
        ? ['first_name', 'last_name', 'email', 'company', 'phone_number']
        : getRelevantFieldsForBuyerType(userBuyerType as any);

      const row = [
        user.id,
        user.email,
        `${user.first_name} ${user.last_name}`,
        user.company || '—',
        user.buyer_type || '—',
        user.approval_status,
        user.is_admin ? 'Yes' : 'No',
        new Date(user.created_at).toLocaleDateString()
      ];

      // Add field values, only showing relevant ones for this user's buyer type
      Array.from(allRelevantFields).forEach(field => {
        const isRelevant = relevantFields.includes(field);
        const value = user[field as keyof User];
        
        if (!isRelevant) {
          row.push('—'); // Not applicable for this buyer type
        } else if (field === 'business_categories' || field === 'investment_size') {
          row.push(Array.isArray(value) ? value.join(', ') : String(value || '—'));
        } else {
          row.push(String(value || '—'));
        }
      });

      return row;
    });

    // Convert to CSV
    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return { exportUsersToCSV };
};