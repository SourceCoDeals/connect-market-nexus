import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CompanyData {
  value: string;
  label: string;
  userCount: number;
  userEmails: string[];
  buyerTypes: string[];
  searchTerms: string;
}

export function useMarketplaceCompanies() {
  return useQuery({
    queryKey: ['marketplace-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, company, buyer_type')
        .eq('approval_status', 'approved')
        .eq('email_verified', true)
        .not('company', 'is', null)
        .neq('company', '');

      if (error) throw error;

      // Group by company name and aggregate data
      const companyMap = new Map<string, {
        company: string;
        users: Array<{ id: string; email: string; buyer_type: string | null }>;
      }>();

      data?.forEach((profile) => {
        const companyName = profile.company!.trim();
        if (!companyMap.has(companyName)) {
          companyMap.set(companyName, {
            company: companyName,
            users: [],
          });
        }
        companyMap.get(companyName)!.users.push({
          id: profile.id,
          email: profile.email,
          buyer_type: profile.buyer_type,
        });
      });

      // Format for combobox
      const companies: CompanyData[] = Array.from(companyMap.values())
        .map((company) => {
          const buyerTypes = [...new Set(
            company.users
              .map(u => u.buyer_type)
              .filter((bt): bt is string => bt !== null)
          )];
          
          const userEmails = company.users.map(u => u.email);
          const buyerTypesDisplay = buyerTypes.length > 0 
            ? ` - ${buyerTypes.join(', ')}` 
            : '';
          const userCountDisplay = company.users.length > 1 
            ? ` (${company.users.length} users)` 
            : '';

          return {
            value: company.company,
            label: `${company.company}${buyerTypesDisplay}${userCountDisplay}`,
            userCount: company.users.length,
            userEmails,
            buyerTypes,
            searchTerms: `${company.company} ${buyerTypes.join(' ')} ${userEmails.join(' ')}`.toLowerCase(),
          };
        })
        .sort((a, b) => {
          // Sort by user count descending, then alphabetically
          if (a.userCount !== b.userCount) {
            return b.userCount - a.userCount;
          }
          return a.value.localeCompare(b.value);
        });

      console.log('[useMarketplaceCompanies] Found', companies.length, 'unique companies from', data?.length, 'profiles');
      
      return companies;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
