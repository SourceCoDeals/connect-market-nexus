import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportData {
  universes: any[];
  buyers: any[];
  contacts: any[];
  transcripts: any[];
  scores: any[];
  learningHistory: any[];
  companies: any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, data }: { action: string; data?: ImportData } = await req.json();

    if (action === 'clear') {
      // Clear existing data in reverse dependency order
      console.log('Clearing existing remarketing data...');
      await supabase.from('buyer_learning_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('remarketing_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('buyer_transcripts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('remarketing_buyer_contacts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('remarketing_buyers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('remarketing_buyer_universes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      return new Response(JSON.stringify({ success: true, message: 'Cleared all remarketing data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'import' && data) {
      const results = {
        universes: { imported: 0, errors: [] as string[] },
        buyers: { imported: 0, errors: [] as string[] },
        contacts: { imported: 0, errors: [] as string[] },
        transcripts: { imported: 0, errors: [] as string[] },
        scores: { imported: 0, errors: [] as string[] },
        learningHistory: { imported: 0, errors: [] as string[] },
        dealMappings: {} as Record<string, string>,
      };

      // ID Mappings
      const universeIdMap: Record<string, string> = {};
      const buyerIdMap: Record<string, string> = {};
      const dealIdMap: Record<string, string> = {};

      // Step 1: Import Universes (industry_trackers -> remarketing_buyer_universes)
      console.log(`Importing ${data.universes?.length || 0} universes...`);
      for (const row of (data.universes || [])) {
        try {
          const universeData = {
            name: row.industry_name || 'Unknown',
            description: null,
            fit_criteria: row.fit_criteria || null,
            size_criteria: parseJson(row.size_criteria) || {},
            geography_criteria: parseJson(row.geography_criteria) || {},
            service_criteria: parseJson(row.service_criteria) || {},
            buyer_types_criteria: parseJson(row.buyer_types_criteria) || {},
            geography_weight: parseInt(row.geography_weight) || 25,
            size_weight: parseInt(row.size_weight) || 25,
            service_weight: parseInt(row.service_mix_weight) || 25,
            owner_goals_weight: parseInt(row.owner_goals_weight) || 25,
            scoring_behavior: parseJson(row.scoring_behavior) || {},
            ma_guide_content: row.industry_template || row.ma_guide_content || null,
            documents: parseJson(row.documents) || [],
            archived: row.archived === 'true',
          };

          const { data: inserted, error } = await supabase
            .from('remarketing_buyer_universes')
            .insert(universeData)
            .select('id')
            .single();

          if (error) {
            results.universes.errors.push(`Universe ${row.industry_name}: ${error.message}`);
          } else {
            universeIdMap[row.id] = inserted.id;
            results.universes.imported++;
          }
        } catch (e) {
          results.universes.errors.push(`Universe ${row.industry_name}: ${e.message}`);
        }
      }
      console.log(`Imported ${results.universes.imported} universes`);

      // Step 2: Import Buyers
      console.log(`Importing ${data.buyers?.length || 0} buyers...`);
      for (const row of (data.buyers || [])) {
        try {
          const mappedUniverseId = universeIdMap[row.tracker_id] || null;
          
          const buyerData = {
            universe_id: mappedUniverseId,
            company_name: row.platform_company_name || 'Unknown',
            company_website: row.platform_website || null,
            buyer_type: row.pe_firm_name ? 'platform' : 'strategic',
            thesis_summary: row.thesis_summary || null,
            thesis_confidence: mapConfidence(row.thesis_confidence),
            target_revenue_min: parseFloat(row.min_revenue) || null,
            target_revenue_max: parseFloat(row.max_revenue) || null,
            target_ebitda_min: parseFloat(row.min_ebitda) || null,
            target_ebitda_max: parseFloat(row.max_ebitda) || null,
            target_geographies: parseArray(row.target_geographies) || [],
            target_services: parseArray(row.services_offered) || [],
            target_industries: parseArray(row.target_industries) || [],
            geographic_footprint: parseArray(row.geographic_footprint) || [],
            recent_acquisitions: parseJson(row.recent_acquisitions) || [],
            portfolio_companies: parseJson(row.portfolio_companies) || [],
            extraction_sources: parseJson(row.extraction_sources) || [],
            data_completeness: mapCompleteness(row),
            notes: null,
            archived: false,
            pe_firm_name: row.pe_firm_name || null,
            hq_city: row.hq_city || null,
            hq_state: row.hq_state || null,
            hq_country: row.hq_country || 'United States',
            hq_region: row.hq_region || null,
            pe_firm_website: row.pe_firm_website || null,
            buyer_linkedin: row.buyer_linkedin || null,
            pe_firm_linkedin: row.pe_firm_linkedin || null,
            business_summary: row.business_summary || null,
            industry_vertical: row.industry_vertical || null,
            specialized_focus: row.specialized_focus || null,
            acquisition_appetite: row.acquisition_appetite || null,
            strategic_priorities: parseArray(row.strategic_priorities) || [],
            total_acquisitions: parseInt(row.total_acquisitions) || null,
            acquisition_frequency: row.acquisition_frequency || null,
            fee_agreement_status: row.fee_agreement_status || null,
          };

          const { data: inserted, error } = await supabase
            .from('remarketing_buyers')
            .insert(buyerData)
            .select('id')
            .single();

          if (error) {
            results.buyers.errors.push(`Buyer ${row.platform_company_name}: ${error.message}`);
          } else {
            buyerIdMap[row.id] = inserted.id;
            results.buyers.imported++;
          }
        } catch (e) {
          results.buyers.errors.push(`Buyer ${row.platform_company_name}: ${e.message}`);
        }
      }
      console.log(`Imported ${results.buyers.imported} buyers`);

      // Step 3: Build deal mappings (companies -> listings)
      console.log('Building deal mappings...');
      const { data: listings } = await supabase
        .from('listings')
        .select('id, title, location, revenue');
      
      for (const company of (data.companies || [])) {
        // Try to find matching listing
        let matchedListingId = null;
        
        if (listings) {
          // Try domain match first
          if (company.domain && !company.domain.startsWith('manual-')) {
            const domainMatch = listings.find(l => 
              l.title?.toLowerCase().includes(company.domain.replace(/\.com|\.net|\.org/g, '').toLowerCase())
            );
            if (domainMatch) matchedListingId = domainMatch.id;
          }
          
          // Try name match
          if (!matchedListingId && company.company_name) {
            const nameWords = company.company_name.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
            const nameMatch = listings.find(l => {
              const titleLower = l.title?.toLowerCase() || '';
              return nameWords.some((word: string) => titleLower.includes(word));
            });
            if (nameMatch) matchedListingId = nameMatch.id;
          }
        }
        
        if (matchedListingId) {
          dealIdMap[company.id] = matchedListingId;
        }
      }
      results.dealMappings = dealIdMap;
      console.log(`Mapped ${Object.keys(dealIdMap).length} deals to listings`);

      // Step 4: Import Contacts
      console.log(`Importing ${data.contacts?.length || 0} contacts...`);
      for (const row of (data.contacts || [])) {
        try {
          const mappedBuyerId = buyerIdMap[row.buyer_id];
          if (!mappedBuyerId) {
            results.contacts.errors.push(`Contact ${row.name}: No buyer mapping`);
            continue;
          }

          const contactData = {
            buyer_id: mappedBuyerId,
            name: row.name || 'Unknown',
            email: row.email || null,
            phone: row.phone || null,
            role: row.title || null,
            linkedin_url: row.linkedin_url || null,
            is_primary: row.is_primary_contact === 'true',
            notes: null,
            company_type: row.company_type || null,
            priority_level: parseInt(row.priority_level) || 3,
            email_confidence: row.email_confidence || null,
            is_deal_team: row.is_deal_team === 'true',
            role_category: row.role_category || null,
            source: row.source || null,
            source_url: row.source_url || null,
          };

          const { error } = await supabase
            .from('remarketing_buyer_contacts')
            .insert(contactData);

          if (error) {
            results.contacts.errors.push(`Contact ${row.name}: ${error.message}`);
          } else {
            results.contacts.imported++;
          }
        } catch (e) {
          results.contacts.errors.push(`Contact ${row.name}: ${e.message}`);
        }
      }
      console.log(`Imported ${results.contacts.imported} contacts`);

      // Step 5: Import Transcripts
      console.log(`Importing ${data.transcripts?.length || 0} transcripts...`);
      for (const row of (data.transcripts || [])) {
        try {
          const mappedBuyerId = buyerIdMap[row.buyer_id];
          if (!mappedBuyerId) {
            results.transcripts.errors.push(`Transcript ${row.title}: No buyer mapping`);
            continue;
          }

          const transcriptData = {
            buyer_id: mappedBuyerId,
            transcript_text: row.notes || row.title || '',
            source: row.url || null,
            extracted_data: parseJson(row.extracted_data),
            processed_at: row.processed_at || null,
          };

          const { error } = await supabase
            .from('buyer_transcripts')
            .insert(transcriptData);

          if (error) {
            results.transcripts.errors.push(`Transcript ${row.title}: ${error.message}`);
          } else {
            results.transcripts.imported++;
          }
        } catch (e) {
          results.transcripts.errors.push(`Transcript ${row.title}: ${e.message}`);
        }
      }
      console.log(`Imported ${results.transcripts.imported} transcripts`);

      // Step 6: Import Scores
      console.log(`Importing ${data.scores?.length || 0} scores...`);
      for (const row of (data.scores || [])) {
        try {
          const mappedBuyerId = buyerIdMap[row.buyer_id];
          const mappedListingId = dealIdMap[row.deal_id];
          
          if (!mappedBuyerId) {
            results.scores.errors.push(`Score: No buyer mapping for ${row.buyer_id}`);
            continue;
          }
          if (!mappedListingId) {
            results.scores.errors.push(`Score: No listing mapping for deal ${row.deal_id}`);
            continue;
          }

          const scoreData = {
            buyer_id: mappedBuyerId,
            listing_id: mappedListingId,
            universe_id: null,
            composite_score: parseFloat(row.composite_score) || 0,
            geography_score: parseFloat(row.geography_score) || 0,
            size_score: 0,
            service_score: parseFloat(row.service_score) || 0,
            owner_goals_score: 0,
            tier: calculateTier(parseFloat(row.composite_score) || 0),
            fit_reasoning: row.fit_reasoning || null,
            data_completeness: row.data_completeness?.toLowerCase() || 'medium',
            status: row.selected_for_outreach === 'true' ? 'approved' : 'pending',
            human_override_score: parseFloat(row.human_override_score) || null,
            scored_at: row.scored_at || new Date().toISOString(),
            pass_reason: row.pass_reason || null,
            pass_category: row.pass_category || null,
          };

          const { error } = await supabase
            .from('remarketing_scores')
            .insert(scoreData);

          if (error) {
            results.scores.errors.push(`Score: ${error.message}`);
          } else {
            results.scores.imported++;
          }
        } catch (e) {
          results.scores.errors.push(`Score: ${e.message}`);
        }
      }
      console.log(`Imported ${results.scores.imported} scores`);

      // Step 7: Import Learning History
      console.log(`Importing ${data.learningHistory?.length || 0} learning history records...`);
      for (const row of (data.learningHistory || [])) {
        try {
          const mappedBuyerId = buyerIdMap[row.buyer_id];
          const mappedListingId = dealIdMap[row.deal_id];
          
          if (!mappedBuyerId) {
            results.learningHistory.errors.push(`Learning: No buyer mapping`);
            continue;
          }
          if (!mappedListingId) {
            results.learningHistory.errors.push(`Learning: No listing mapping`);
            continue;
          }

          const historyData = {
            buyer_id: mappedBuyerId,
            listing_id: mappedListingId,
            action: row.action_type || 'not_a_fit',
            pass_category: row.rejection_categories || null,
            pass_reason: row.rejection_reason || null,
            action_by: row.created_by || null,
          };

          const { error } = await supabase
            .from('buyer_learning_history')
            .insert(historyData);

          if (error) {
            results.learningHistory.errors.push(`Learning: ${error.message}`);
          } else {
            results.learningHistory.imported++;
          }
        } catch (e) {
          results.learningHistory.errors.push(`Learning: ${e.message}`);
        }
      }
      console.log(`Imported ${results.learningHistory.imported} learning history records`);

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Import error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper functions
function parseJson(value: any): any {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    if (typeof value === 'string') {
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  }
}

function mapConfidence(value: string | null): string | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes('high')) return 'high';
  if (lower.includes('med')) return 'medium';
  if (lower.includes('low')) return 'low';
  return 'medium';
}

function mapCompleteness(row: any): string {
  if (row.data_completeness) return row.data_completeness.toLowerCase();
  const fields = ['thesis_summary', 'target_geographies', 'min_revenue'];
  const filled = fields.filter(f => row[f]).length;
  if (filled >= 2) return 'high';
  if (filled >= 1) return 'medium';
  return 'low';
}

function calculateTier(score: number): string {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}
