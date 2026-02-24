import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ContactSource = 'remarketing' | 'marketplace' | 'lead';

export interface UnifiedContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  linkedinUrl: string | null;
  companyType: string | null;
  isPrimary: boolean;
  source: ContactSource;
  profileId: string | null; // for marketplace contacts - links to profile page
  connectionRequestCount?: number;
}

export function useBuyerAllContacts(buyerId: string | undefined, emailDomain: string | null | undefined) {
  return useQuery({
    queryKey: ['buyer-all-contacts', buyerId, emailDomain],
    queryFn: async () => {
      if (!buyerId) return [];

      const contacts: UnifiedContact[] = [];
      const seenEmails = new Set<string>();

      // Primary source: unified contacts table (replaces remarketing_buyer_contacts)
      const { data: unifiedContacts } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone, linkedin_url, title, is_primary_at_firm, profile_id, source')
        .eq('remarketing_buyer_id', buyerId)
        .eq('contact_type', 'buyer')
        .eq('archived', false)
        .order('is_primary_at_firm', { ascending: false });

      for (const c of unifiedContacts || []) {
        const email = c.email?.toLowerCase() || null;
        if (email) seenEmails.add(email);
        const isMarketplace = c.source === 'marketplace_signup' || !!c.profile_id;
        contacts.push({
          id: c.id,
          name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
          email: c.email,
          phone: c.phone,
          role: c.title,
          linkedinUrl: c.linkedin_url,
          companyType: null,
          isPrimary: c.is_primary_at_firm || false,
          source: isMarketplace ? 'marketplace' : 'remarketing',
          profileId: c.profile_id,
        });
      }

      // Supplementary: Marketplace profiles matched via email domain
      // (catches profiles not yet linked to the contacts table)
      if (emailDomain) {
        const { data: marketplaceProfiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, phone_number, company, buyer_type, linkedin_profile, job_title')
          .ilike('email', `%@${emailDomain}`)
          .is('deleted_at', null);

        for (const p of marketplaceProfiles || []) {
          const email = p.email?.toLowerCase() || null;
          if (email && seenEmails.has(email)) continue;
          if (email) seenEmails.add(email);
          contacts.push({
            id: `mp-${p.id}`,
            name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || 'Unknown',
            email: p.email,
            phone: p.phone_number,
            role: p.job_title || p.buyer_type,
            linkedinUrl: p.linkedin_profile,
            companyType: p.company,
            isPrimary: false,
            source: 'marketplace',
            profileId: p.id,
          });
        }

        // Supplementary: Connection request lead contacts via domain match
        const { data: leadContacts } = await supabase
          .from('connection_requests')
          .select('id, lead_name, lead_email, lead_phone, lead_company, created_at')
          .ilike('lead_email', `%@${emailDomain}`)
          .order('created_at', { ascending: false });

        for (const cr of leadContacts || []) {
          const email = cr.lead_email?.toLowerCase() || null;
          if (email && seenEmails.has(email)) continue;
          if (email) seenEmails.add(email);
          contacts.push({
            id: `lead-${cr.id}`,
            name: cr.lead_name || cr.lead_email || 'Unknown',
            email: cr.lead_email,
            phone: cr.lead_phone,
            role: null,
            linkedinUrl: null,
            companyType: cr.lead_company,
            isPrimary: false,
            source: 'lead',
            profileId: null,
          });
        }
      }

      return contacts;
    },
    enabled: !!buyerId,
    staleTime: 30_000,
  });
}
