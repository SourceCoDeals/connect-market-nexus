import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CompanyData {
  value: string;
  label: string;
  userCount: number;
  userEmails: string[];
  buyerTypes: string[];
  searchTerms: string;
  profileTemplate: {
    buyer_type: string | null;
    phone_number: string | null;
    website: string | null;
    linkedin_profile: string | null;
    business_categories: any;
    target_locations: any;
    sampleUserEmail: string;
    sampleUserId: string;
  };
}

// Helper function to generate comprehensive search terms with prefixes
const generateSearchTerms = (words: string[]): string => {
  const terms = new Set<string>();
  
  words.forEach(word => {
    const cleaned = word.toLowerCase().trim();
    if (!cleaned) return;
    
    // Add full word
    terms.add(cleaned);
    
    // Add progressive prefixes (for "Tucker's" -> "t", "tu", "tuc", "tuck", etc.)
    for (let i = 1; i <= cleaned.length; i++) {
      terms.add(cleaned.substring(0, i));
    }
  });
  
  return Array.from(terms).join(' ');
};

export function useMarketplaceCompanies() {
  return useQuery({
    queryKey: ['marketplace-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, company, buyer_type, phone_number, website, linkedin_profile, business_categories, target_locations, updated_at')
        .eq('approval_status', 'approved')
        .eq('email_verified', true)
        .not('company', 'is', null)
        .neq('company', '');

      if (error) throw error;

      // Group by company name and aggregate data
      const companyMap = new Map<string, {
        company: string;
        users: Array<any>;
      }>();

      data?.forEach((profile) => {
        const companyName = profile.company!.trim();
        if (!companyMap.has(companyName)) {
          companyMap.set(companyName, {
            company: companyName,
            users: [],
          });
        }
        companyMap.get(companyName)!.users.push(profile);
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

          // Select "best" user as template (most complete profile, most recent)
          const primaryUser = company.users.reduce((best, current) => {
            const bestScore = (best.phone_number ? 1 : 0) + 
                            (best.website ? 1 : 0) + 
                            (best.linkedin_profile ? 1 : 0) +
                            (best.business_categories ? 1 : 0) +
                            (best.target_locations ? 1 : 0);
            const currentScore = (current.phone_number ? 1 : 0) + 
                               (current.website ? 1 : 0) + 
                               (current.linkedin_profile ? 1 : 0) +
                               (current.business_categories ? 1 : 0) +
                               (current.target_locations ? 1 : 0);
            
            if (currentScore > bestScore) return current;
            if (currentScore === bestScore && new Date(current.updated_at) > new Date(best.updated_at)) {
              return current;
            }
            return best;
          });

          // Generate comprehensive search terms
          const searchParts = [
            company.company,
            // Split company name into words for better matching
            ...company.company.split(/\s+/),
            ...buyerTypes,
          ].filter(Boolean);

          return {
            value: company.company,
            label: `${company.company}${buyerTypesDisplay}${userCountDisplay}`,
            userCount: company.users.length,
            userEmails,
            buyerTypes,
            searchTerms: generateSearchTerms(searchParts),
            profileTemplate: {
              buyer_type: primaryUser.buyer_type,
              phone_number: primaryUser.phone_number,
              website: primaryUser.website,
              linkedin_profile: primaryUser.linkedin_profile,
              business_categories: primaryUser.business_categories,
              target_locations: primaryUser.target_locations,
              sampleUserEmail: primaryUser.email,
              sampleUserId: primaryUser.id,
            },
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
