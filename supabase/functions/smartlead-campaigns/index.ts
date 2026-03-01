/**
 * Smartlead Campaigns Edge Function
 *
 * Handles CRUD operations for Smartlead campaigns, proxying requests to the
 * Smartlead API and keeping local tracking tables in sync.
 *
 * Endpoints (via action in request body):
 *   POST { action: "list" }                       — List all Smartlead campaigns
 *   POST { action: "get", campaign_id }            — Get campaign details + stats
 *   POST { action: "create", name, deal_id?, ... } — Create a new campaign
 *   POST { action: "update_settings", campaign_id, settings } — Update settings
 *   POST { action: "update_schedule", campaign_id, schedule } — Update schedule
 *   POST { action: "save_sequence", campaign_id, sequences }  — Save sequences
 *   POST { action: "get_sequences", campaign_id }  — Get sequences
 *   POST { action: "sync" }                        — Sync all campaigns from Smartlead
 *   POST { action: "stats", campaign_id }           — Fetch + store campaign stats
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaignSettings,
  updateCampaignSchedule,
  saveCampaignSequence,
  getCampaignSequences,
  getCampaignLeadStatistics,
} from '../_shared/smartlead-client.ts';

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
        const result = await listCampaigns();
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: 502,
            headers: jsonHeaders,
          });
        }
        // Also fetch local tracking data
        const { data: localCampaigns } = await supabase.from('smartlead_campaigns').select('*');
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

      case 'create': {
        const { name, deal_id, universe_id, client_id } = body;
        if (!name) {
          return new Response(JSON.stringify({ error: 'name required' }), {
            status: 400,
            headers: jsonHeaders,
          });
        }

        const result = await createCampaign(name, client_id);
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: 502,
            headers: jsonHeaders,
          });
        }

        const campaignData = result.data as Record<string, unknown>;
        const smartleadId = campaignData?.id ?? campaignData?.campaign_id;

        // Track locally
        const { data: localCampaign, error: insertError } = await supabase
          .from('smartlead_campaigns')
          .insert({
            smartlead_campaign_id: smartleadId,
            name,
            status: 'DRAFTED',
            deal_id: deal_id || null,
            universe_id: universe_id || null,
            created_by: user.id,
            last_synced_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error('[smartlead-campaigns] Local insert error:', insertError);
        }

        return new Response(
          JSON.stringify({
            campaign: result.data,
            local_campaign: localCampaign,
          }),
          { status: 201, headers: jsonHeaders },
        );
      }

      case 'update_settings': {
        const { campaign_id, settings } = body;
        if (!campaign_id || !settings) {
          return new Response(JSON.stringify({ error: 'campaign_id and settings required' }), {
            status: 400,
            headers: jsonHeaders,
          });
        }
        const result = await updateCampaignSettings(campaign_id, settings);
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: 502,
            headers: jsonHeaders,
          });
        }

        // Update local tracking
        await supabase
          .from('smartlead_campaigns')
          .update({ settings, last_synced_at: new Date().toISOString() })
          .eq('smartlead_campaign_id', campaign_id);

        return new Response(JSON.stringify({ success: true, data: result.data }), {
          headers: jsonHeaders,
        });
      }

      case 'update_schedule': {
        const { campaign_id, schedule } = body;
        if (!campaign_id || !schedule) {
          return new Response(JSON.stringify({ error: 'campaign_id and schedule required' }), {
            status: 400,
            headers: jsonHeaders,
          });
        }
        const result = await updateCampaignSchedule(campaign_id, schedule);
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: 502,
            headers: jsonHeaders,
          });
        }
        return new Response(JSON.stringify({ success: true, data: result.data }), {
          headers: jsonHeaders,
        });
      }

      case 'save_sequence': {
        const { campaign_id, sequences } = body;
        if (!campaign_id || !sequences) {
          return new Response(JSON.stringify({ error: 'campaign_id and sequences required' }), {
            status: 400,
            headers: jsonHeaders,
          });
        }
        const result = await saveCampaignSequence(campaign_id, sequences);
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: 502,
            headers: jsonHeaders,
          });
        }
        return new Response(JSON.stringify({ success: true, data: result.data }), {
          headers: jsonHeaders,
        });
      }

      case 'get_sequences': {
        const { campaign_id } = body;
        if (!campaign_id) {
          return new Response(JSON.stringify({ error: 'campaign_id required' }), {
            status: 400,
            headers: jsonHeaders,
          });
        }
        const result = await getCampaignSequences(campaign_id);
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: 502,
            headers: jsonHeaders,
          });
        }
        return new Response(JSON.stringify({ sequences: result.data }), {
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
        const result = await getCampaignLeadStatistics(campaign_id);
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: 502,
            headers: jsonHeaders,
          });
        }

        // Store snapshot
        const stats = result.data as Record<string, number>;
        const { data: localCampaign } = await supabase
          .from('smartlead_campaigns')
          .select('id')
          .eq('smartlead_campaign_id', campaign_id)
          .single();

        if (localCampaign) {
          await supabase.from('smartlead_campaign_stats').insert({
            campaign_id: localCampaign.id,
            total_leads: stats?.total_leads ?? 0,
            sent: stats?.sent ?? 0,
            opened: stats?.opened ?? 0,
            clicked: stats?.clicked ?? 0,
            replied: stats?.replied ?? 0,
            bounced: stats?.bounced ?? 0,
            unsubscribed: stats?.unsubscribed ?? 0,
            interested: stats?.interested ?? 0,
            not_interested: stats?.not_interested ?? 0,
          });
        }

        return new Response(JSON.stringify({ statistics: result.data }), {
          headers: jsonHeaders,
        });
      }

      case 'sync': {
        const result = await listCampaigns();
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: 502,
            headers: jsonHeaders,
          });
        }

        const campaigns = (result.data || []) as Array<Record<string, unknown>>;
        let synced = 0;

        for (const campaign of campaigns) {
          const slId = campaign.id as number;
          const { error: upsertError } = await supabase.from('smartlead_campaigns').upsert(
            {
              smartlead_campaign_id: slId,
              name: campaign.name as string,
              status: (campaign.status as string) || 'DRAFTED',
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: 'smartlead_campaign_id' },
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

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: jsonHeaders,
        });
    }
  } catch (err) {
    console.error('[smartlead-campaigns] Unhandled error:', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Internal error',
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
