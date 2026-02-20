import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';

interface ConvertRequest {
  listing_id: string;
  buyer_id: string;
  score_id?: string;
  stage_name?: string; // default: 'Qualified'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  const headers = getCorsHeaders(req);

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body: ConvertRequest = await req.json();
    const { listing_id, buyer_id, score_id, stage_name } = body;

    if (!listing_id || !buyer_id) {
      return new Response(
        JSON.stringify({ error: 'listing_id and buyer_id are required' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } },
      );
    }

    // 1. Check for existing pipeline deal (dedup)
    const { data: existingDeal } = await supabase
      .from('deals')
      .select('id, title')
      .eq('remarketing_buyer_id', buyer_id)
      .eq('listing_id', listing_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingDeal) {
      return new Response(
        JSON.stringify({
          error: 'Deal already exists in pipeline',
          deal_id: existingDeal.id,
          deal_title: existingDeal.title,
          already_exists: true,
        }),
        { status: 409, headers: { ...headers, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Fetch remarketing buyer
    const { data: buyer, error: buyerError } = await supabase
      .from('remarketing_buyers')
      .select('id, company_name, company_website, buyer_type, email_domain, has_fee_agreement, marketplace_firm_id')
      .eq('id', buyer_id)
      .single();

    if (buyerError || !buyer) {
      return new Response(
        JSON.stringify({ error: 'Buyer not found', details: buyerError?.message }),
        { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Fetch primary contact for the buyer
    const { data: contact } = await supabase
      .from('remarketing_buyer_contacts')
      .select('name, email, phone, role')
      .eq('buyer_id', buyer_id)
      .eq('is_primary_contact', true)
      .maybeSingle();

    // Fallback: any contact if no primary
    let contactInfo = contact;
    if (!contactInfo) {
      const { data: anyContact } = await supabase
        .from('remarketing_buyer_contacts')
        .select('name, email, phone, role')
        .eq('buyer_id', buyer_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      contactInfo = anyContact;
    }

    // 4. Fetch listing title
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, title, internal_company_name')
      .eq('id', listing_id)
      .single();

    if (listingError || !listing) {
      return new Response(
        JSON.stringify({ error: 'Listing not found', details: listingError?.message }),
        { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } },
      );
    }

    // 5. Look up target pipeline stage
    const targetStageName = stage_name || 'Qualified';
    const { data: stage } = await supabase
      .from('deal_stages')
      .select('id, default_probability')
      .eq('name', targetStageName)
      .eq('is_active', true)
      .maybeSingle();

    // Fallback to default stage
    let stageId = stage?.id;
    let probability = stage?.default_probability ?? 50;
    if (!stageId) {
      const { data: defaultStage } = await supabase
        .from('deal_stages')
        .select('id, default_probability')
        .eq('is_default', true)
        .maybeSingle();
      stageId = defaultStage?.id;
      probability = defaultStage?.default_probability ?? 50;
    }

    if (!stageId) {
      // Last resort: first active stage
      const { data: firstStage } = await supabase
        .from('deal_stages')
        .select('id, default_probability')
        .eq('is_active', true)
        .order('position', { ascending: true })
        .limit(1)
        .single();
      stageId = firstStage?.id;
      probability = firstStage?.default_probability ?? 50;
    }

    if (!stageId) {
      return new Response(
        JSON.stringify({ error: 'No active pipeline stages found' }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } },
      );
    }

    // 6. Handle firm identity bridge
    let firmId = buyer.marketplace_firm_id;

    if (!firmId) {
      // Auto-create firm_agreements from remarketing buyer data
      const { data: newFirm, error: firmError } = await supabase
        .from('firm_agreements')
        .insert({
          primary_company_name: buyer.company_name,
          normalized_company_name: buyer.company_name?.toLowerCase().trim() || '',
          website_domain: buyer.company_website
            ? buyer.company_website.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '').toLowerCase()
            : null,
          email_domain: buyer.email_domain || null,
          fee_agreement_signed: buyer.has_fee_agreement || false,
          fee_agreement_signed_at: buyer.has_fee_agreement ? new Date().toISOString() : null,
          nda_signed: false,
          member_count: contactInfo ? 1 : 0,
          metadata: { source: 'remarketing_conversion', buyer_type: buyer.buyer_type },
        })
        .select('id')
        .single();

      if (!firmError && newFirm) {
        firmId = newFirm.id;

        // Link buyer to firm
        await supabase
          .from('remarketing_buyers')
          .update({ marketplace_firm_id: firmId })
          .eq('id', buyer_id);

        // Create firm member from primary contact
        if (contactInfo?.email) {
          await supabase
            .from('firm_members')
            .insert({
              firm_id: firmId,
              member_type: 'lead',
              lead_email: contactInfo.email,
              lead_name: contactInfo.name || buyer.company_name,
              lead_company: buyer.company_name,
              is_primary_contact: true,
            });
        }
      }
    }

    // 7. Create the pipeline deal
    const listingTitle = listing.internal_company_name || listing.title || 'Untitled';
    const dealTitle = `${buyer.company_name} → ${listingTitle}`;

    const { data: newDeal, error: dealError } = await supabase
      .from('deals')
      .insert({
        listing_id,
        title: dealTitle,
        stage_id: stageId,
        source: 'remarketing',
        remarketing_buyer_id: buyer_id,
        remarketing_score_id: score_id || null,
        contact_name: contactInfo?.name || null,
        contact_email: contactInfo?.email || null,
        contact_company: buyer.company_name,
        contact_phone: contactInfo?.phone || null,
        contact_role: contactInfo?.role || null,
        nda_status: 'not_sent',
        fee_agreement_status: buyer.has_fee_agreement ? 'signed' : 'not_sent',
        priority: 'medium',
        probability,
        buyer_priority_score: 0,
      })
      .select('id, title, stage_id')
      .single();

    if (dealError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create pipeline deal', details: dealError.message }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } },
      );
    }

    // 8. Optionally update the remarketing score to indicate pipeline conversion
    if (score_id) {
      await supabase
        .from('remarketing_scores')
        .update({
          status: 'approved',
          interested: true,
          interested_at: new Date().toISOString(),
        })
        .eq('id', score_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        deal_id: newDeal.id,
        deal_title: newDeal.title,
        stage_id: newDeal.stage_id,
        firm_id: firmId,
        message: `Deal "${dealTitle}" created in pipeline`,
      }),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    console.error('convert-to-pipeline-deal error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } },
    );
  }
});
