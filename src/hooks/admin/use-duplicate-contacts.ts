import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DuplicateContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  title: string | null;
  contact_type: string;
  listing_id: string | null;
  remarketing_buyer_id: string | null;
  firm_id: string | null;
  is_primary_at_firm: boolean;
  is_primary_seller_contact: boolean;
  source: string | null;
  created_at: string;
}

export interface DuplicateGroup {
  key: string;
  displayName: string;
  matchType: 'exact_name' | 'email';
  contacts: DuplicateContact[];
}

export function useDuplicateContacts() {
  return useQuery({
    queryKey: ['admin', 'duplicate-contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select(
          'id, first_name, last_name, email, phone, linkedin_url, title, contact_type, listing_id, remarketing_buyer_id, firm_id, is_primary_at_firm, is_primary_seller_contact, source, created_at',
        )
        .eq('archived', false)
        .order('first_name')
        .order('last_name');

      if (error) throw error;

      const contacts = (data || []) as DuplicateContact[];

      // Group by normalized full name
      const nameGroups = new Map<string, DuplicateContact[]>();
      for (const contact of contacts) {
        const name = `${contact.first_name || ''} ${contact.last_name || ''}`
          .trim()
          .toLowerCase();
        if (!name) continue;
        const group = nameGroups.get(name) || [];
        group.push(contact);
        nameGroups.set(name, group);
      }

      // Group by email (case-insensitive)
      const emailGroups = new Map<string, DuplicateContact[]>();
      for (const contact of contacts) {
        if (!contact.email) continue;
        const email = contact.email.toLowerCase();
        const group = emailGroups.get(email) || [];
        group.push(contact);
        emailGroups.set(email, group);
      }

      const duplicates: DuplicateGroup[] = [];
      const seenIds = new Set<string>();

      // Name-based duplicates (2+ contacts with the same name)
      for (const [name, group] of nameGroups) {
        if (group.length < 2) continue;
        duplicates.push({
          key: `name:${name}`,
          displayName:
            `${group[0].first_name || ''} ${group[0].last_name || ''}`.trim() || 'Unknown',
          matchType: 'exact_name',
          contacts: group,
        });
        for (const c of group) seenIds.add(c.id);
      }

      // Email-based duplicates (only add if not already covered by name match)
      for (const [email, group] of emailGroups) {
        if (group.length < 2) continue;
        // Skip if all contacts in this email group are already in a name group
        const hasNew = group.some((c) => !seenIds.has(c.id));
        if (!hasNew) continue;
        duplicates.push({
          key: `email:${email}`,
          displayName: email,
          matchType: 'email',
          contacts: group,
        });
      }

      // Sort: largest groups first
      duplicates.sort((a, b) => b.contacts.length - a.contacts.length);

      return duplicates;
    },
    staleTime: 60_000,
  });
}
