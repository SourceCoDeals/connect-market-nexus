import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PhoneBurnerConnectedUser {
  token_id: string;
  user_id: string;
  display_name: string | null;
  phoneburner_user_email: string | null;
  expires_at: string;
  updated_at: string | null;
  profile_first_name: string | null;
  profile_last_name: string | null;
  profile_email: string | null;
  is_manual_token: boolean;
  /** Computed label for display */
  label: string;
  is_expired: boolean;
}

const QUERY_KEY = ["phoneburner-connected-users"];

export function usePhoneBurnerConnectedUsers() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      // Try the RPC function first; fall back to direct query
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "get_phoneburner_connected_users" as never,
      );

      let rows: Array<Record<string, unknown>>;
      if (rpcError || !rpcData) {
        // Fallback: query tokens + profiles directly
        const { data: tokens } = await supabase
          .from("phoneburner_oauth_tokens")
          .select("id, user_id, display_name, phoneburner_user_email, expires_at, updated_at, is_manual_token");
        if (!tokens?.length) return [];

        const userIds = tokens.map((t: Record<string, unknown>) => t.user_id as string);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", userIds);

        const profileMap = new Map(
          (profiles || []).map((p: Record<string, unknown>) => [
            p.id as string,
            p,
          ]),
        );

        rows = tokens.map((t: Record<string, unknown>) => {
          const p = profileMap.get(t.user_id) as Record<string, unknown> | undefined;
          return {
            token_id: t.id,
            user_id: t.user_id,
            display_name: (t as Record<string, unknown>).display_name ?? null,
            phoneburner_user_email: (t as Record<string, unknown>).phoneburner_user_email ?? null,
            expires_at: t.expires_at,
            updated_at: t.updated_at,
            is_manual_token: (t as Record<string, unknown>).is_manual_token ?? false,
            profile_first_name: p?.first_name ?? null,
            profile_last_name: p?.last_name ?? null,
            profile_email: p?.email ?? null,
          };
        });
      } else {
        rows = rpcData as Array<Record<string, unknown>>;
      }

      return rows.map((r): PhoneBurnerConnectedUser => {
        const isManual = Boolean(r.is_manual_token);
        const displayName =
          (r.display_name as string) ||
          [r.profile_first_name, r.profile_last_name].filter(Boolean).join(" ") ||
          (r.phoneburner_user_email as string) ||
          (r.profile_email as string) ||
          "Unknown user";
        // Manual tokens never show as expired (no expiry concept)
        const isExpired = isManual
          ? false
          : new Date(r.expires_at as string) < new Date();
        return {
          token_id: r.token_id as string,
          user_id: r.user_id as string,
          display_name: r.display_name as string | null,
          phoneburner_user_email: r.phoneburner_user_email as string | null,
          expires_at: r.expires_at as string,
          updated_at: r.updated_at as string | null,
          is_manual_token: isManual,
          profile_first_name: r.profile_first_name as string | null,
          profile_last_name: r.profile_last_name as string | null,
          profile_email: r.profile_email as string | null,
          label: displayName,
          is_expired: isExpired,
        };
      });
    },
    staleTime: 30_000,
  });
}

export function useDisconnectPhoneBurnerUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("phoneburner_oauth_tokens")
        .delete()
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["phoneburner-connection-status"] });
    },
  });
}

export function useInitiatePhoneBurnerOAuth() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "phoneburner-oauth-callback",
        { method: "POST", body: {} },
      );
      if (error) throw error;
      return data as { authorize_url: string };
    },
  });
}

export interface SaveAccessTokenParams {
  accessToken: string;
  displayName: string;
}

export function useSavePhoneBurnerAccessToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accessToken, displayName }: SaveAccessTokenParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("phoneburner_oauth_tokens")
        .upsert(
          {
            user_id: user.id,
            access_token: accessToken,
            refresh_token: null,
            display_name: displayName,
            is_manual_token: true,
            // Far-future expiry — manual tokens don't expire through this system
            expires_at: new Date("2099-01-01").toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["phoneburner-connection-status"] });
    },
  });
}
