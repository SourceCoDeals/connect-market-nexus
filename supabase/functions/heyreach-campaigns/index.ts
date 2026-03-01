/**
 * HeyReach Campaigns Edge Function
 *
 * Handles CRUD operations for HeyReach LinkedIn outreach campaigns, proxying
 * requests to the HeyReach API and keeping local tracking tables in sync.
 *
 * Endpoints (via action in request body):
 *   POST { action: "list" }                       — List all HeyReach campaigns
 *   POST { action: "get", campaign_id }            — Get campaign details
 *   POST { action: "toggle", campaign_id }         — Pause/resume a campaign
 *   POST { action: "stats", campaign_id }          — Fetch + store campaign stats
 *   POST { action: "sync" }                        — Sync all campaigns from HeyReach
 *   POST { action: "lists" }                       — List all HeyReach lead lists
 *   POST { action: "create_list", name }           — Create an empty lead list
 *   POST { action: "linkedin_accounts" }           — List all LinkedIn sender accounts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';
import {
  listCampaigns,
  getCampaign,
  pauseCampaign,
  resumeCampaign,
  getOverallStats,
  getAllLists,
  createEmptyList,
  getLinkedInAccounts,
} from '../_shared/heyreach-client.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  // ─── Auth ─────────────────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const auth = await requireAdmin(req, supabase);
  if (!auth.authenticated || !auth.isAdmin) {
    return new Response(JSON.stringify({ error: auth.error || 'Admin access required' }), {
      status: auth.authenticated ? 403 : 401,
      headers: jsonHeaders,
    });
  }

  // ─── Route by action ──────────────────────────────────────────────────
  const body = await req.json();
  const { action } = body;

  try {
    switch (action) {
      case 'list': {
        const result = await listCampaigns(body.offset || 0, body.limit || 50);
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error || `HeyReach API error (HTTP ${result.status})` }), {
            status: 502,
            headers: jsonHeaders,
          });
        }
        // Also fetch local tracking data
        const { data: localCampaigns } = await supabase.from('heyreach_campaigns').select('*');
        return new Response(
          JSON.stringify({
            campaigns: result.data,
            local_campaigns: localCampaigns || [],
          }),
          { headers: jsonHeaders },
        );
      }

      case 'get': {
        const { campaign_id } = body;
        if (!campaign_id) {
          return new Response(JSON.stringify({ error: 'campaign_id required' }), {
            status: 400,
            headers: jsonHeaders,
          });
        }
        const result = await getCampaign(campaign_id);
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: 502,
            headers: jsonHeaders,
          });
        }
        return new Response(JSON.stringify({ campaign: result.data }), {
          headers: jsonHeaders,
        });
      }

      case 'toggle': {
        const { campaign_id, current_status } = body;
        if (!campaign_id) {
          return new Response(JSON.stringify({ error: 'campaign_id required' }), {
            status: 400,
            headers: jsonHeaders,
          });
        }
        // Use pause/resume based on current status
        const isPaused = current_status === 'PAUSED' || current_status === 'DRAFT';
        const result = isPaused
          ? await resumeCampaign(campaign_id)
          : await pauseCampaign(campaign_id);
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error || `HeyReach API error (HTTP ${result.status})` }), {
            status: 502,
            headers: jsonHeaders,
          });
        }

        // Update local tracking
        await supabase
          .from('heyreach_campaigns')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('heyreach_campaign_id', campaign_id);

        return new Response(JSON.stringify({ success: true, data: result.data }), {
          headers: jsonHeaders,
        });
      }

      case 'stats': {
        const { campaign_id } = body;
        if (!campaign_id) {
          return new Response(JSON.stringify({ error: 'campaign_id required' }), {
            status: 400,
            headers: jsonHeaders,
          });
        }
        const result = await getOverallStats([campaign_id]);
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error || `HeyReach API error (HTTP ${result.status})` }), {
            status: 502,
            headers: jsonHeaders,
          });
        }

        // Store snapshot
        const stats = result.data as Record<string, number>;
        const { data: localCampaign } = await supabase
          .from('heyreach_campaigns')
          .select('id')
          .eq('heyreach_campaign_id', campaign_id)
          .single();

        if (localCampaign) {
          await supabase.from('heyreach_campaign_stats').insert({
            campaign_id: localCampaign.id,
            total_leads: stats?.totalLeads ?? 0,
            contacted: stats?.contacted ?? 0,
            connected: stats?.connected ?? 0,
            replied: stats?.replied ?? 0,
            interested: stats?.interested ?? 0,
            not_interested: stats?.notInterested ?? 0,
            response_rate: stats?.responseRate ?? 0,
            connection_rate: stats?.connectionRate ?? 0,
          });
        }

        return new Response(JSON.stringify({ statistics: result.data }), {
          headers: jsonHeaders,
        });
      }

      case 'sync': {
        const result = await listCampaigns(0, 100);
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: 502,
            headers: jsonHeaders,
          });
        }

        const campaigns = (result.data || []) as Array<Record<string, unknown>>;
        let synced = 0;

        for (const campaign of campaigns) {
          const hrId = campaign.id as number;
          const { error: upsertError } = await supabase.from('heyreach_campaigns').upsert(
            {
              heyreach_campaign_id: hrId,
              name: campaign.name as string,
              status: (campaign.status as string) || 'DRAFT',
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: 'heyreach_campaign_id' },
          );

          if (!upsertError) synced++;
        }

        return new Response(
          JSON.stringify({
            success: true,
            total_remote: campaigns.length,
            synced,
          }),
          { headers: jsonHeaders },
        );
      }

      case 'lists': {
        const result = await getAllLists(body.offset || 0, body.limit || 50);
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: 502,
            headers: jsonHeaders,
          });
        }
        return new Response(JSON.stringify({ lists: result.data }), {
          headers: jsonHeaders,
        });
      }

      case 'create_list': {
        const { name, list_type } = body;
        if (!name) {
          return new Response(JSON.stringify({ error: 'name required' }), {
            status: 400,
            headers: jsonHeaders,
          });
        }
        const result = await createEmptyList(name, list_type || 'LEAD');
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: 502,
            headers: jsonHeaders,
          });
        }
        return new Response(JSON.stringify({ list: result.data }), {
          status: 201,
          headers: jsonHeaders,
        });
      }

      case 'linkedin_accounts': {
        const result = await getLinkedInAccounts();
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: 502,
            headers: jsonHeaders,
          });
        }
        return new Response(JSON.stringify({ accounts: result.data }), {
          headers: jsonHeaders,
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: jsonHeaders,
        });
    }
  } catch (err) {
    console.error('[heyreach-campaigns] Unhandled error:', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Internal error',
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
