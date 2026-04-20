import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import { invokeWithTimeout } from '@/lib/invoke-with-timeout';
import type {
  ContactList,
  CreateContactListInput,
  ContactListMember,
  CreateContactListMemberInput,
} from '@/types/contact-list';
import { useToast } from '@/hooks/use-toast';

const QUERY_KEY = ['admin', 'contact-lists'];

export function useContactLists() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_lists')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch creator names separately (FK points to auth.users, not profiles)
      const creatorIds = [
        ...new Set((data ?? []).map((r) => r.created_by).filter(Boolean)),
      ] as string[];
      const profileMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', creatorIds);
        for (const p of profiles ?? []) {
          profileMap[p.id] = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
        }
      }

      return (data ?? []).map((row) => ({
        ...row,
        tags: row.tags ?? [],
        created_by_name: profileMap[row.created_by ?? ''] || null,
      })) as ContactList[];
    },
    staleTime: 30000,
  });
}

export function useContactList(listId: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEY, listId],
    enabled: !!listId,
    retry: 1,
    queryFn: async () => {
      // --- Core data: list + members (must succeed) ---
      const { data: list, error: listError } = await supabase
        .from('contact_lists')
        .select('*')
        .eq('id', listId!)
        .single();

      if (listError) throw listError;

      let creatorName: string | null = null;
      try {
        if (list.created_by) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', list.created_by)
            .single();
          if (profile) {
            creatorName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim();
          }
        }
      } catch {
        // creator name is non-critical
      }

      const { data: members, error: membersError } = await (
        supabase.from('contact_list_members') as any
      )
        .select(
          '*, contact:contacts(first_name, last_name, email, phone, title, company_name, linkedin_url)',
        )
        .eq('list_id', listId!)
        .is('removed_at', null)
        .order('added_at', { ascending: false });

      if (membersError) throw membersError;

      const memberRows = (members ?? []) as any[];

      // --- Enrichment: call tracking (non-critical) ---
      const emails = memberRows.map((m: any) => m.contact_email).filter(Boolean) as string[];
      const callData: Record<
        string,
        { last_call: string | null; total_calls: number; last_disposition: string | null }
      > = {};

      try {
        if (emails.length > 0) {
          const { data: activities } = await supabase
            .from('contact_activities')
            .select('contact_email, call_started_at, disposition_label')
            .in('contact_email', emails)
            .order('call_started_at', { ascending: false });

          if (activities) {
            for (const a of activities) {
              const email = a.contact_email;
              if (!email) continue;
              if (!callData[email]) {
                callData[email] = {
                  last_call: a.call_started_at,
                  total_calls: 0,
                  last_disposition: a.disposition_label,
                };
              }
              callData[email].total_calls++;
            }
          }
        }
      } catch (e) {
        console.warn('[useContactList] Call tracking enrichment failed, degrading gracefully:', e);
      }

      // --- Enrichment: deal owners (non-critical) ---
      const DEAL_ENTITY_TYPES = [
        'deal',
        'listing',
        'sourceco_deal',
        'gp_partner_deal',
        'referral_deal',
      ];
      const dealMembers = memberRows.filter((m: any) => DEAL_ENTITY_TYPES.includes(m.entity_type));
      const dealOwnerMap: Record<string, { name: string; id: string }> = {};

      try {
        if (dealMembers.length > 0) {
          const allEntityIds = dealMembers.map((m: any) => m.entity_id).filter(Boolean);
          const uniqueEntityIds = [...new Set(allEntityIds)];

          const allOwnerIds = new Set<string>();

          if (uniqueEntityIds.length > 0) {
            const { data: listingRows } = await supabase
              .from('listings')
              .select('id, deal_owner_id, primary_owner_id')
              .in('id', uniqueEntityIds);

            const resolvedIds = new Set<string>();
            const unownedListingIds: string[] = [];

            for (const l of listingRows ?? []) {
              resolvedIds.add(l.id);
              const ownerId = l.deal_owner_id || l.primary_owner_id;
              if (ownerId) {
                allOwnerIds.add(ownerId);
                dealOwnerMap[l.id] = { name: '', id: ownerId };
              } else {
                unownedListingIds.push(l.id);
              }
            }

            const unresolvedIds = uniqueEntityIds.filter(
              (entityId: string) => !resolvedIds.has(entityId),
            );
            if (unresolvedIds.length > 0) {
              const { data: dealRows } = await supabase
                .from('deal_pipeline')
                .select('id, assigned_to')
                .in('id', unresolvedIds);
              for (const d of dealRows ?? []) {
                if (d.assigned_to) {
                  allOwnerIds.add(d.assigned_to);
                  dealOwnerMap[d.id] = { name: '', id: d.assigned_to };
                }
              }
            }

            if (unownedListingIds.length > 0) {
              const { data: pipelineForListings } = await supabase
                .from('deal_pipeline')
                .select('listing_id, assigned_to')
                .in('listing_id', unownedListingIds)
                .not('assigned_to', 'is', null)
                .is('deleted_at', null)
                .order('updated_at', { ascending: false });

              for (const dp of pipelineForListings ?? []) {
                if (dp.listing_id && dp.assigned_to && !dealOwnerMap[dp.listing_id]) {
                  allOwnerIds.add(dp.assigned_to);
                  dealOwnerMap[dp.listing_id] = { name: '', id: dp.assigned_to };
                }
              }
            }
          }

          const ownerIdArray = [...allOwnerIds];
          if (ownerIdArray.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, first_name, last_name')
              .in('id', ownerIdArray);
            const ownerNames: Record<string, string> = {};
            for (const p of profiles ?? []) {
              ownerNames[p.id] = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
            }
            for (const key of Object.keys(dealOwnerMap)) {
              const entry = dealOwnerMap[key];
              entry.name = ownerNames[entry.id] || '';
            }
          }
        }
      } catch (e) {
        console.warn('[useContactList] Deal owner enrichment failed, degrading gracefully:', e);
      }

      // --- Enrichment: contact fallback lookup (non-critical) ---
      const contactByEmail: Record<string, any> = {};

      try {
        const membersWithoutContact = memberRows.filter(
          (m: any) => !m.contact_id && m.contact_email,
        );
        const missingEmails = membersWithoutContact.map((m: any) => m.contact_email) as string[];

        if (missingEmails.length > 0) {
          const { data: lookedUp } = await (supabase.from('contacts') as any)
            .select('first_name, last_name, email, phone, title, company_name, linkedin_url')
            .in('email', missingEmails);
          for (const c of (lookedUp ?? []) as any[]) {
            if (c.email) contactByEmail[c.email] = c;
          }
        }
      } catch (e) {
        console.warn('[useContactList] Contact fallback lookup failed, degrading gracefully:', e);
      }

      const enrichedMembers = memberRows.map((m: any) => ({
        ...m,
        contact: m.contact ?? contactByEmail[m.contact_email] ?? null,
        last_call_date: callData[m.contact_email]?.last_call ?? null,
        total_calls: callData[m.contact_email]?.total_calls ?? 0,
        last_disposition: callData[m.contact_email]?.last_disposition ?? null,
        deal_owner_name: dealOwnerMap[m.entity_id]?.name ?? null,
        deal_owner_id: dealOwnerMap[m.entity_id]?.id ?? null,
      })) as ContactListMember[];

      return {
        ...list,
        tags: list.tags ?? [],
        created_by_name: creatorName,
        members: enrichedMembers,
      } as ContactList;
    },
    staleTime: 30000,
  });
}

export function useCreateContactList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateContactListInput) => {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      // Create the list. list_rules is JSONB in Postgres — structurally
      // compatible with SmartListConfig but TS widens Json, so we accept
      // the implicit conversion here.
      const insertData: Database['public']['Tables']['contact_lists']['Insert'] = {
        name: input.name,
        description: input.description || null,
        list_type: input.list_type,
        tags: input.tags || [],
        filter_snapshot: (input.filter_snapshot ?? null) as Json | null,
        created_by: user.id,
        contact_count: input.members.length,
        ...(input.is_smart_list && {
          is_smart_list: true,
          list_rules: (input.list_rules ?? null) as Json | null,
          match_mode: input.match_mode ?? 'all',
          source_entity: input.source_entity,
          auto_add_enabled: input.auto_add_enabled ?? true,
        }),
      };
      const { data: list, error: listError } = await supabase
        .from('contact_lists')
        .insert(insertData)
        .select()
        .single();

      if (listError) throw listError;

      // Insert members
      if (input.members.length > 0) {
        const memberRows = input.members.map((m) => ({
          list_id: list.id,
          contact_email: m.contact_email,
          contact_name: m.contact_name,
          contact_phone: m.contact_phone,
          contact_company: m.contact_company,
          contact_role: m.contact_role,
          entity_type: m.entity_type,
          entity_id: m.entity_id,
        }));

        const { error: membersError } = await supabase
          .from('contact_list_members')
          .insert(memberRows);

        if (membersError) throw membersError;
      }

      return list as ContactList;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({
        title: 'List created',
        description: `"${data.name}" saved with ${data.contact_count} contacts. You can now push them to PhoneBurner.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create list',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useAddMembersToList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      listId,
      members,
    }: {
      listId: string;
      members: CreateContactListMemberInput[];
    }) => {
      if (members.length === 0) throw new Error('No contacts to add');

      // Upsert members to handle duplicates gracefully (unique on list_id + contact_email)
      const memberRows = members.map((m) => ({
        list_id: listId,
        contact_email: m.contact_email,
        contact_name: m.contact_name,
        contact_phone: m.contact_phone,
        contact_company: m.contact_company,
        contact_role: m.contact_role,
        entity_type: m.entity_type,
        entity_id: m.entity_id,
        removed_at: null,
      }));

      const { error: membersError } = await supabase
        .from('contact_list_members')
        .upsert(memberRows, { onConflict: 'list_id,contact_email', ignoreDuplicates: false });

      if (membersError) throw membersError;

      // contact_count is auto-updated by DB trigger

      return { listId, addedCount: members.length };
    },
    onSuccess: ({ listId, addedCount }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, listId] });
      toast({
        title: 'Contacts added',
        description: `${addedCount} contact${addedCount !== 1 ? 's' : ''} added to list.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to add contacts',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteContactList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase
        .from('contact_lists')
        .update({ is_archived: true })
        .eq('id', listId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: 'List archived' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to archive list',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRemoveListMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, listId }: { memberId: string; listId: string }) => {
      const { error } = await supabase
        .from('contact_list_members')
        .update({ removed_at: new Date().toISOString() })
        .eq('id', memberId);

      if (error) throw error;
      return listId;
    },
    onSuccess: (listId) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, listId] });
    },
  });
}

export interface EnrichResult {
  contact_id: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  confidence: string | null;
  error: string | null;
}

export interface RawContactForEnrich {
  key: string;
  first_name: string;
  last_name: string;
  company: string;
}

interface EnrichInput {
  contact_ids?: string[];
  raw_contacts?: RawContactForEnrich[];
}

/**
 * Enrich contacts missing email/phone via Prospeo before adding to a list.
 * Supports two modes:
 *   - contact_ids: enriches existing contacts from the contacts table.
 *   - raw_contacts: enriches by name + company (for deals without a DB contact).
 */
export function useEnrichListContacts() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: EnrichInput) => {
      const hasIds = (input.contact_ids?.length ?? 0) > 0;
      const hasRaw = (input.raw_contacts?.length ?? 0) > 0;
      if (!hasIds && !hasRaw) return [] as EnrichResult[];

      const { data, error } = await invokeWithTimeout<{ results: EnrichResult[] }>(
        'enrich-list-contacts',
        {
          body: {
            ...(hasIds ? { contact_ids: input.contact_ids } : {}),
            ...(hasRaw ? { raw_contacts: input.raw_contacts } : {}),
          },
          timeoutMs: 120_000,
        },
      );

      if (error) throw error;
      return (data?.results ?? []) as EnrichResult[];
    },
    onSuccess: (results) => {
      const found = results.filter(
        (r) => r.source && r.source !== 'existing' && (r.email || r.phone),
      );
      if (found.length > 0) {
        toast({
          title: 'Contacts enriched',
          description: `Found contact info for ${found.length} contact${found.length !== 1 ? 's' : ''} via Prospeo.`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Enrichment failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
