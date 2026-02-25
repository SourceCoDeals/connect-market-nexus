import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ContactList, CreateContactListInput, ContactListMember, CreateContactListMemberInput } from '@/types/contact-list';
import { useToast } from '@/hooks/use-toast';

const QUERY_KEY = ['admin', 'contact-lists'];

export function useContactLists() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_lists')
        .select('*, profiles:created_by(first_name, last_name)')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        ...row,
        tags: row.tags ?? [],
        created_by_name: row.profiles
          ? `${row.profiles.first_name ?? ''} ${row.profiles.last_name ?? ''}`.trim()
          : null,
      })) as ContactList[];
    },
    staleTime: 30000,
  });
}

export function useContactList(listId: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEY, listId],
    enabled: !!listId,
    queryFn: async () => {
      const { data: list, error: listError } = await supabase
        .from('contact_lists')
        .select('*, profiles:created_by(first_name, last_name)')
        .eq('id', listId!)
        .single();

      if (listError) throw listError;

      const { data: members, error: membersError } = await supabase
        .from('contact_list_members')
        .select('*')
        .eq('list_id', listId!)
        .is('removed_at', null)
        .order('added_at', { ascending: false });

      if (membersError) throw membersError;

      // Fetch call tracking data for these contacts
      const emails = (members ?? []).map((m: any) => m.contact_email).filter(Boolean);
      let callData: Record<string, { last_call: string | null; total_calls: number; last_disposition: string | null }> = {};

      if (emails.length > 0) {
        const { data: activities } = await supabase
          .from('contact_activities')
          .select('contact_email, call_started_at, disposition_label')
          .in('contact_email', emails)
          .order('call_started_at', { ascending: false });

        if (activities) {
          for (const a of activities as any[]) {
            const email = a.contact_email;
            if (!email) continue;
            if (!callData[email]) {
              callData[email] = { last_call: a.call_started_at, total_calls: 0, last_disposition: a.disposition_label };
            }
            callData[email].total_calls++;
          }
        }
      }

      const enrichedMembers: ContactListMember[] = (members ?? []).map((m: any) => ({
        ...m,
        last_call_date: callData[m.contact_email]?.last_call ?? null,
        total_calls: callData[m.contact_email]?.total_calls ?? 0,
        last_disposition: callData[m.contact_email]?.last_disposition ?? null,
      }));

      return {
        ...list,
        tags: list.tags ?? [],
        created_by_name: list.profiles
          ? `${(list.profiles as any).first_name ?? ''} ${(list.profiles as any).last_name ?? ''}`.trim()
          : null,
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      // Create the list
      const insertData: Record<string, unknown> = {
          name: input.name,
          description: input.description || null,
          list_type: input.list_type,
          tags: input.tags || [],
          filter_snapshot: input.filter_snapshot || null,
          created_by: user.id,
          contact_count: input.members.length,
        };
      const { data: list, error: listError } = await supabase
        .from('contact_lists')
        .insert(insertData as any)
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
    onError: (error: any) => {
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
    mutationFn: async ({ listId, members }: { listId: string; members: CreateContactListMemberInput[] }) => {
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
    onError: (error: any) => {
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
    onError: (error: any) => {
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
