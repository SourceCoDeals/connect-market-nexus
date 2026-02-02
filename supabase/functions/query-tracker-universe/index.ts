import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// State adjacency map for proximity calculations
const STATE_ADJACENCY: Record<string, string[]> = {
  AL: ["FL", "GA", "MS", "TN"],
  AK: [],
  AZ: ["CA", "CO", "NM", "NV", "UT"],
  AR: ["LA", "MO", "MS", "OK", "TN", "TX"],
  CA: ["AZ", "NV", "OR"],
  CO: ["AZ", "KS", "NE", "NM", "OK", "UT", "WY"],
  CT: ["MA", "NY", "RI"],
  DE: ["MD", "NJ", "PA"],
  FL: ["AL", "GA"],
  GA: ["AL", "FL", "NC", "SC", "TN"],
  HI: [],
  ID: ["MT", "NV", "OR", "UT", "WA", "WY"],
  IL: ["IN", "IA", "KY", "MO", "WI"],
  IN: ["IL", "KY", "MI", "OH"],
  IA: ["IL", "MN", "MO", "NE", "SD", "WI"],
  KS: ["CO", "MO", "NE", "OK"],
  KY: ["IL", "IN", "MO", "OH", "TN", "VA", "WV"],
  LA: ["AR", "MS", "TX"],
  ME: ["NH"],
  MD: ["DE", "PA", "VA", "WV", "DC"],
  MA: ["CT", "NH", "NY", "RI", "VT"],
  MI: ["IN", "OH", "WI"],
  MN: ["IA", "ND", "SD", "WI"],
  MS: ["AL", "AR", "LA", "TN"],
  MO: ["AR", "IL", "IA", "KS", "KY", "NE", "OK", "TN"],
  MT: ["ID", "ND", "SD", "WY"],
  NE: ["CO", "IA", "KS", "MO", "SD", "WY"],
  NV: ["AZ", "CA", "ID", "OR", "UT"],
  NH: ["MA", "ME", "VT"],
  NJ: ["DE", "NY", "PA"],
  NM: ["AZ", "CO", "OK", "TX", "UT"],
  NY: ["CT", "MA", "NJ", "PA", "VT"],
  NC: ["GA", "SC", "TN", "VA"],
  ND: ["MN", "MT", "SD"],
  OH: ["IN", "KY", "MI", "PA", "WV"],
  OK: ["AR", "CO", "KS", "MO", "NM", "TX"],
  OR: ["CA", "ID", "NV", "WA"],
  PA: ["DE", "MD", "NJ", "NY", "OH", "WV"],
  RI: ["CT", "MA"],
  SC: ["GA", "NC"],
  SD: ["IA", "MN", "MT", "ND", "NE", "WY"],
  TN: ["AL", "AR", "GA", "KY", "MO", "MS", "NC", "VA"],
  TX: ["AR", "LA", "NM", "OK"],
  UT: ["AZ", "CO", "ID", "NV", "NM", "WY"],
  VT: ["MA", "NH", "NY"],
  VA: ["KY", "MD", "NC", "TN", "WV", "DC"],
  WA: ["ID", "OR"],
  WV: ["KY", "MD", "OH", "PA", "VA"],
  WI: ["IA", "IL", "MI", "MN"],
  WY: ["CO", "ID", "MT", "NE", "SD", "UT"],
  DC: ["MD", "VA"],
};

// Regional groupings
const REGIONS: Record<string, string[]> = {
  Northeast: ["CT", "ME", "MA", "NH", "NJ", "NY", "PA", "RI", "VT"],
  Southeast: ["AL", "FL", "GA", "KY", "MS", "NC", "SC", "TN", "VA", "WV"],
  Midwest: ["IL", "IN", "IA", "KS", "MI", "MN", "MO", "NE", "ND", "OH", "SD", "WI"],
  Southwest: ["AZ", "NM", "OK", "TX"],
  West: ["CA", "CO", "ID", "MT", "NV", "OR", "UT", "WA", "WY"],
  "Mid-Atlantic": ["DE", "MD", "NJ", "NY", "PA", "DC"],
  "New England": ["CT", "ME", "MA", "NH", "RI", "VT"],
};

function getRegionForState(state: string): string | null {
  for (const [region, states] of Object.entries(REGIONS)) {
    if (states.includes(state)) return region;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { trackerId, query, messages, selectedBuyerIds } = await req.json();
    
    if (!trackerId || !query) {
      return new Response(
        JSON.stringify({ error: "Missing trackerId or query" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const hasSelectedBuyers = Array.isArray(selectedBuyerIds) && selectedBuyerIds.length > 0;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    
    // Create user client to verify ownership via RLS
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user has access to this tracker via RLS
    const { data: userTracker, error: accessError } = await userClient
      .from("industry_trackers")
      .select("id")
      .eq("id", trackerId)
      .single();

    if (accessError || !userTracker) {
      console.error("Access denied for tracker:", trackerId, accessError?.message);
      return new Response(
        JSON.stringify({ error: "Tracker not found or access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Now safe to use SERVICE_ROLE_KEY for efficient querying
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch tracker data with criteria and M&A guide
    const { data: tracker, error: trackerError } = await supabase
      .from("industry_trackers")
      .select("*")
      .eq("id", trackerId)
      .single();

    if (trackerError || !tracker) {
      throw new Error(`Tracker not found: ${trackerError?.message}`);
    }

    // Fetch all buyers for this tracker (optionally filtered by selection)
    let buyersQuery = supabase
      .from("buyers")
      .select("*")
      .eq("tracker_id", trackerId);
    
    if (hasSelectedBuyers) {
      buyersQuery = buyersQuery.in("id", selectedBuyerIds);
    }
    
    const { data: buyers, error: buyersError } = await buyersQuery;

    if (buyersError) {
      throw new Error(`Failed to fetch buyers: ${buyersError.message}`);
    }
    
    // Log filtering info
    console.log(`[query-tracker-universe] Fetched ${buyers?.length || 0} buyers${hasSelectedBuyers ? ` (filtered from selection of ${selectedBuyerIds.length})` : ''}`);

    // Fetch all deals for this tracker
    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select("*")
      .eq("tracker_id", trackerId);

    if (dealsError) {
      throw new Error(`Failed to fetch deals: ${dealsError.message}`);
    }

    // Fetch all buyer transcripts for buyers in this tracker
    const buyerIds = (buyers || []).map((b: any) => b.id);
    let buyerTranscripts: any[] = [];
    if (buyerIds.length > 0) {
      const { data: transcripts, error: transcriptsError } = await supabase
        .from("buyer_transcripts")
        .select("buyer_id, title, call_date, notes, extracted_data")
        .in("buyer_id", buyerIds);
      
      if (!transcriptsError && transcripts) {
        buyerTranscripts = transcripts;
      }
    }

    // Fetch primary contacts for each buyer
    let buyerContacts: any[] = [];
    if (buyerIds.length > 0) {
      const { data: contacts, error: contactsError } = await supabase
        .from("buyer_contacts")
        .select("buyer_id, name, title, email, is_primary_contact, role_category")
        .in("buyer_id", buyerIds);
      
      if (!contactsError && contacts) {
        buyerContacts = contacts;
      }
    }

    // Group transcripts and contacts by buyer_id
    const transcriptsByBuyer: Record<string, any[]> = {};
    for (const t of buyerTranscripts) {
      if (!transcriptsByBuyer[t.buyer_id]) transcriptsByBuyer[t.buyer_id] = [];
      transcriptsByBuyer[t.buyer_id].push(t);
    }

    const contactsByBuyer: Record<string, any[]> = {};
    for (const c of buyerContacts) {
      if (!contactsByBuyer[c.buyer_id]) contactsByBuyer[c.buyer_id] = [];
      contactsByBuyer[c.buyer_id].push(c);
    }

    // Build buyer summaries with enhanced data
    const buyerSummaries = (buyers || []).map((b: any) => {
      const footprint = b.geographic_footprint || [];
      const targetGeos = b.target_geographies || [];
      const regions = [...new Set([...footprint, ...targetGeos].map(s => getRegionForState(s)).filter(Boolean))];
      
      // Get transcripts for this buyer
      const transcripts = transcriptsByBuyer[b.id] || [];
      const transcriptSummaries = transcripts.slice(0, 3).map((t: any) => ({
        title: t.title,
        date: t.call_date,
        keyPoints: t.notes ? t.notes.substring(0, 200) : null,
        extractedInsights: t.extracted_data ? Object.keys(t.extracted_data).slice(0, 5) : [],
      }));

      // Get contacts for this buyer
      const contacts = contactsByBuyer[b.id] || [];
      const primaryContact = contacts.find((c: any) => c.is_primary_contact);
      const dealTeamContacts = contacts.filter((c: any) => c.role_category === "deal_team").slice(0, 2);

      return {
        id: b.id,
        name: b.platform_company_name || b.pe_firm_name,
        peFirm: b.pe_firm_name,
        hq: b.hq_city && b.hq_state ? `${b.hq_city}, ${b.hq_state}` : (b.hq_state || null),
        geographicFootprint: footprint,
        targetGeographies: targetGeos,
        regions,
        serviceRegions: b.service_regions || [],
        minRevenue: b.min_revenue,
        maxRevenue: b.max_revenue,
        minEbitda: b.min_ebitda,
        maxEbitda: b.max_ebitda,
        ebitdaSweetSpot: b.ebitda_sweet_spot,
        revenueSweetSpot: b.revenue_sweet_spot,
        targetServices: b.target_services || [],
        targetIndustries: b.target_industries || [],
        acquisitionAppetite: b.acquisition_appetite,
        acquisitionFrequency: b.acquisition_frequency,
        totalAcquisitions: b.total_acquisitions,
        lastAcquisitionDate: b.last_acquisition_date,
        thesisSummary: b.thesis_summary,
        strategicPriorities: b.strategic_priorities,
        businessSummary: b.business_summary,
        servicesOffered: b.services_offered,
        dealBreakers: b.deal_breakers || [],
        keyQuotes: b.key_quotes || [],
        industryExclusions: b.industry_exclusions || [],
        geographicExclusions: b.geographic_exclusions || [],
        addonOnly: b.addon_only,
        platformOnly: b.platform_only,
        hasFeeAgreement: b.has_fee_agreement,
        thesisConfidence: b.thesis_confidence,
        // Enhanced data
        recentCalls: transcriptSummaries,
        primaryContact: primaryContact ? { name: primaryContact.name, title: primaryContact.title } : null,
        dealTeam: dealTeamContacts.map((c: any) => ({ name: c.name, title: c.title })),
      };
    });

    // Build deal summaries
    const dealSummaries = (deals || []).map((d: any) => ({
      id: d.id,
      name: d.deal_name,
      geography: d.geography || [],
      headquarters: d.headquarters,
      revenue: d.revenue,
      ebitdaAmount: d.ebitda_amount,
      ebitdaPercentage: d.ebitda_percentage,
      serviceMix: d.service_mix,
      businessModel: d.business_model,
      industryType: d.industry_type,
      status: d.status,
      dealScore: d.deal_score,
    }));

    // Build criteria summary
    const sizeCriteria = tracker.size_criteria as any || {};
    const serviceCriteria = tracker.service_criteria as any || {};
    const geographyCriteria = tracker.geography_criteria as any || {};
    const buyerTypesCriteria = tracker.buyer_types_criteria as any || {};

    const criteriaContext = {
      size: {
        minRevenue: sizeCriteria.min_revenue,
        maxRevenue: sizeCriteria.max_revenue,
        minEbitda: sizeCriteria.min_ebitda,
        maxEbitda: sizeCriteria.max_ebitda,
      },
      service: {
        requiredServices: serviceCriteria.required_services || [],
        preferredServices: serviceCriteria.preferred_services || [],
        excludedServices: serviceCriteria.excluded_services || [],
        primaryFocus: serviceCriteria.primary_focus || [],
      },
      geography: {
        requiredRegions: geographyCriteria.required_regions || [],
        preferredRegions: geographyCriteria.preferred_regions || [],
        excludedRegions: geographyCriteria.excluded_regions || [],
      },
      buyerTypes: buyerTypesCriteria.buyer_types || [],
    };

    // Smart M&A guide context - extract key sections instead of truncating
    let maGuideContext = "";
    if (tracker.ma_guide_content) {
      const fullGuide = tracker.ma_guide_content;
      const guideLength = fullGuide.length;
      
      // Extract key sections by looking for section headers
      const sections: string[] = [];
      
      // Try to find and extract key sections
      const sectionPatterns = [
        /## .*?Deal[- ]?Killers.*?(?=\n## |\n# |$)/is,
        /## .*?Valuation.*?(?=\n## |\n# |$)/is,
        /## .*?Buyer Types.*?(?=\n## |\n# |$)/is,
        /## .*?Geographic.*?(?=\n## |\n# |$)/is,
        /## .*?Service.*?(?=\n## |\n# |$)/is,
        /## .*?Size.*?Criteria.*?(?=\n## |\n# |$)/is,
        /## .*?Key Terminology.*?(?=\n## |\n# |$)/is,
      ];

      for (const pattern of sectionPatterns) {
        const match = fullGuide.match(pattern);
        if (match && match[0].length < 2000) {
          sections.push(match[0].trim());
        }
      }

      if (sections.length > 0) {
        maGuideContext = "KEY M&A GUIDE SECTIONS:\n\n" + sections.join("\n\n---\n\n");
      }

      // If no sections found or still have room, include overview
      if (maGuideContext.length < 8000) {
        // Get first 4000 chars as overview if guide exists
        const overview = fullGuide.substring(0, 4000);
        if (sections.length === 0) {
          maGuideContext = "M&A GUIDE OVERVIEW:\n" + overview + (guideLength > 4000 ? "..." : "");
        } else {
          maGuideContext = maGuideContext + "\n\nGUIDE OVERVIEW:\n" + overview.substring(0, 2000) + "...";
        }
      }

      // Log guide usage
      console.log(`[query-tracker-universe] M&A guide: ${guideLength} chars total, using ${maGuideContext.length} chars`);
    }

    // Extract uploaded documents info if available
    let documentsContext = "";
    if (tracker.documents && Array.isArray(tracker.documents) && tracker.documents.length > 0) {
      const docs = tracker.documents as any[];
      documentsContext = "\nUPLOADED DOCUMENTS:\n" + docs.map((d: any) => 
        `- ${d.name || d.filename}: ${d.summary || 'No summary available'}`
      ).join("\n");
    }

    const systemPrompt = `You are an expert M&A analyst helping evaluate the buyer universe for the "${tracker.industry_name}" industry tracker.

TRACKER OVERVIEW:
- Industry: ${tracker.industry_name}
- ${hasSelectedBuyers ? `Analyzing SELECTED SUBSET: ${buyerSummaries.length} buyers (user selected these from the full universe)` : `Total Buyers: ${buyerSummaries.length}`}
- Total Deals: ${dealSummaries.length}
- Buyer Transcripts Available: ${buyerTranscripts.length}
${hasSelectedBuyers ? '\nNOTE: The user has specifically selected these buyers for analysis. Focus your responses on this subset.' : ''}

BUYER FIT CRITERIA:
${JSON.stringify(criteriaContext, null, 2)}

${maGuideContext ? `\n${maGuideContext}\n` : ""}
${documentsContext}

BUYER UNIVERSE (${buyerSummaries.length} buyers):
${JSON.stringify(buyerSummaries, null, 2)}

DEALS (${dealSummaries.length} deals):
${JSON.stringify(dealSummaries, null, 2)}

REGIONAL REFERENCE:
- Southeast: AL, FL, GA, KY, MS, NC, SC, TN, VA, WV
- Northeast: CT, ME, MA, NH, NJ, NY, PA, RI, VT
- Midwest: IL, IN, IA, KS, MI, MN, MO, NE, ND, OH, SD, WI
- Southwest: AZ, NM, OK, TX
- West: CA, CO, ID, MT, NV, OR, UT, WA, WY

When answering questions:
1. Be specific - name actual buyers that match criteria
2. Explain WHY each buyer matches (cite their data)
3. For geographic questions, use the regions array and state lists
4. For deal matching, consider both buyer criteria and deal characteristics
5. If no buyers match, say so clearly
6. Keep responses concise but informative
7. Format lists clearly with bullet points
8. When comparing buyers, provide clear pros/cons for each
9. Consider the fit criteria when making recommendations
10. Reference deal breakers and exclusions when relevant
11. Use key quotes from buyers when available to support your analysis
12. Reference call notes/transcripts when they provide useful context
13. Mention thesis confidence levels when recommending buyers

CRITICAL - BUYER HIGHLIGHTING:
When you identify specific buyers in your response (whether filtering, recommending, or analyzing them), you MUST include their IDs at the VERY END of your response in this exact format:
<!-- BUYER_HIGHLIGHT: ["buyer-id-1", "buyer-id-2", "buyer-id-3"] -->

CRITICAL - HANDLING UNCLEAR REQUESTS:
If the user's question is ambiguous, too broad, or lacks necessary context to give a precise answer, DO NOT GUESS. Instead:
1. Acknowledge what you understand about their request
2. Ask 1-3 specific clarifying questions to narrow down what they need
3. Only provide a preliminary answer if you're reasonably confident

Examples of when to ask for clarification:
- "Which buyers match?" → Ask: match what criteria? Size? Geography? Services?
- "Show me the best ones" → Ask: best by what measure? Most active? Best geographic fit?
- "Find similar buyers" → Ask: similar to which buyer? Similar in what way?

This hidden marker allows the UI to highlight these buyers in the table. Always include this when you mention specific buyers by name. Use the exact "id" field from the buyer data provided above.`;

    console.log(`[query-tracker-universe] Processing query for tracker ${trackerId}: "${query}"`);
    console.log(`[query-tracker-universe] System prompt size: ${systemPrompt.length} chars`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...(messages || []).map((m: any) => ({ role: m.role, content: m.content })),
          { role: "user", content: query },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("query-tracker-universe error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
