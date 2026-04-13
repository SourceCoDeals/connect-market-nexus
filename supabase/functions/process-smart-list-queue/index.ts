/**
 * process-smart-list-queue
 *
 * Processes the smart list evaluation queue. Called by cron every 5 minutes.
 * For each queued listing, evaluates it against all active seller smart lists.
 * If it matches, upserts a member into the list.
 *
 * Same pattern for buyer queue against buyer smart lists.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const BATCH_SIZE = 200;

interface SmartListRule {
  field: string;
  operator: string;
  value: string | number | boolean | string[] | [number, number];
}

interface SmartListConfig {
  rules: SmartListRule[];
  match_mode: 'all' | 'any';
}

// Seller list field definitions for contains_any search
const SELLER_SEARCH_FIELDS: Record<string, string[]> = {
  industry: ['industry', 'category', 'categories', 'services', 'service_mix', 'executive_summary'],
};

function evaluateRule(record: Record<string, unknown>, rule: SmartListRule): boolean {
  const fieldValue = record[rule.field];

  switch (rule.operator) {
    case 'equals':
      return String(fieldValue ?? '').toLowerCase() === String(rule.value).toLowerCase();
    case 'not_equals':
      return String(fieldValue ?? '').toLowerCase() !== String(rule.value).toLowerCase();
    case 'in':
      return (rule.value as string[]).some(
        (v) => String(fieldValue ?? '').toLowerCase() === v.toLowerCase(),
      );
    case 'not_in':
      return !(rule.value as string[]).some(
        (v) => String(fieldValue ?? '').toLowerCase() === v.toLowerCase(),
      );
    case 'contains': {
      const searchIn = Array.isArray(fieldValue)
        ? fieldValue.join(' ').toLowerCase()
        : String(fieldValue ?? '').toLowerCase();
      return searchIn.includes(String(rule.value).toLowerCase());
    }
    case 'contains_any': {
      const fieldsToSearch = SELLER_SEARCH_FIELDS[rule.field] ?? [rule.field];
      const parts: string[] = [];
      for (const f of fieldsToSearch) {
        const val = record[f];
        if (val == null) continue;
        if (Array.isArray(val)) parts.push(val.join(' '));
        else parts.push(String(val));
      }
      const combinedText = parts.join(' ').toLowerCase();
      return (rule.value as string[]).some((term) => combinedText.includes(term.toLowerCase()));
    }
    case 'overlaps': {
      const fieldArr = Array.isArray(fieldValue) ? fieldValue : [];
      const valueArr = Array.isArray(rule.value) ? rule.value : [];
      return fieldArr.some((f: unknown) =>
        valueArr.some((v) => String(f).toLowerCase() === String(v).toLowerCase()),
      );
    }
    case 'gte':
      return Number(fieldValue ?? 0) >= Number(rule.value);
    case 'lte':
      return Number(fieldValue ?? 0) <= Number(rule.value);
    case 'between': {
      const [min, max] = rule.value as [number, number];
      const num = Number(fieldValue ?? 0);
      return num >= min && num <= max;
    }
    case 'is_true':
      return fieldValue === true || fieldValue === 'true';
    case 'is_false':
      return !fieldValue || fieldValue === false || fieldValue === 'false';
    case 'is_not_null':
      return fieldValue != null && fieldValue !== '' && fieldValue !== 0;
    case 'is_null':
      return fieldValue == null || fieldValue === '' || fieldValue === 0;
    default:
      return false;
  }
}

function matchesRules(record: Record<string, unknown>, config: SmartListConfig): boolean {
  if (config.rules.length === 0) return false;
  const results = config.rules.map((rule) => evaluateRule(record, rule));
  return config.match_mode === 'all' ? results.every((r) => r) : results.some((r) => r);
}

serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const results = { seller_processed: 0, seller_added: 0, buyer_processed: 0, buyer_added: 0 };

  // ---- SELLER SMART LISTS ----
  try {
    // 1. Pull queued listing IDs
    const { data: queue } = await supabase
      .from('smart_list_evaluation_queue')
      .select('listing_id')
      .order('queued_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (queue && queue.length > 0) {
      const listingIds = queue.map((q) => q.listing_id);

      // 2. Fetch listings
      const { data: listings } = await supabase
        .from('listings')
        .select(
          'id, industry, category, categories, services, service_mix, executive_summary, address_state, linkedin_employee_count, google_review_count, google_rating, number_of_locations, deal_total_score, deal_source, enriched_at, main_contact_email, main_contact_phone, main_contact_name, is_priority_target, website, internal_company_name, title, created_at, not_a_fit, deleted_at',
        )
        .in('id', listingIds);

      // Filter out deleted/not_a_fit
      const validListings = (listings ?? []).filter(
        (l) =>
          l.deleted_at == null &&
          (l.not_a_fit === false || l.not_a_fit == null) &&
          l.main_contact_email,
      );

      // 3. Fetch active seller smart lists
      const { data: smartLists } = await supabase
        .from('contact_lists')
        .select('id, list_rules, match_mode')
        .eq('is_smart_list', true)
        .eq('is_archived', false)
        .eq('auto_add_enabled', true)
        .eq('source_entity', 'listings');

      // 4. Evaluate each listing against each smart list
      if (smartLists && smartLists.length > 0) {
        for (const listing of validListings) {
          results.seller_processed++;
          for (const smartList of smartLists) {
            const config = smartList.list_rules as SmartListConfig;
            if (!config?.rules?.length) continue;

            if (matchesRules(listing as Record<string, unknown>, config)) {
              const { error } = await supabase.from('contact_list_members').upsert(
                {
                  list_id: smartList.id,
                  contact_email: listing.main_contact_email!,
                  contact_name: listing.main_contact_name,
                  contact_phone: listing.main_contact_phone,
                  contact_company: listing.internal_company_name || listing.title,
                  contact_role: null,
                  entity_type: 'listing',
                  entity_id: listing.id,
                  added_by: 'smart_rule',
                  removed_at: null,
                },
                { onConflict: 'list_id,contact_email', ignoreDuplicates: false },
              );
              if (!error) results.seller_added++;
            }
          }
        }

        // Update last_evaluated_at on all processed smart lists
        const smartListIds = smartLists.map((l) => l.id);
        await supabase
          .from('contact_lists')
          .update({ last_evaluated_at: new Date().toISOString() })
          .in('id', smartListIds);
      }

      // 5. Clear processed queue items
      await supabase.from('smart_list_evaluation_queue').delete().in('listing_id', listingIds);
    }
  } catch (err) {
    console.error('Seller queue processing error:', err);
  }

  // ---- BUYER SMART LISTS ----
  try {
    const { data: buyerQueue } = await supabase
      .from('smart_list_buyer_evaluation_queue')
      .select('buyer_id')
      .order('queued_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (buyerQueue && buyerQueue.length > 0) {
      const buyerIds = buyerQueue.map((q) => q.buyer_id);

      const { data: buyers } = await supabase
        .from('buyers')
        .select(
          'id, company_name, target_services, target_geographies, buyer_type, is_pe_backed, hq_state, archived, deleted_at',
        )
        .in('id', buyerIds);

      const validBuyers = (buyers ?? []).filter(
        (b) => b.archived === false && b.deleted_at == null,
      );

      const { data: buyerSmartLists } = await supabase
        .from('contact_lists')
        .select('id, list_rules, match_mode')
        .eq('is_smart_list', true)
        .eq('is_archived', false)
        .eq('auto_add_enabled', true)
        .eq('source_entity', 'remarketing_buyers');

      if (buyerSmartLists && buyerSmartLists.length > 0) {
        for (const buyer of validBuyers) {
          results.buyer_processed++;

          for (const smartList of buyerSmartLists) {
            const config = smartList.list_rules as SmartListConfig;
            if (!config?.rules?.length) continue;

            if (matchesRules(buyer as Record<string, unknown>, config)) {
              // Fetch contacts for this buyer
              const { data: contacts } = await supabase
                .from('contacts')
                .select('id, email, first_name, last_name, phone, title, company_name')
                .eq('remarketing_buyer_id', buyer.id)
                .eq('archived', false)
                .not('email', 'is', null);

              for (const contact of contacts ?? []) {
                if (!contact.email) continue;
                const { error } = await supabase.from('contact_list_members').upsert(
                  {
                    list_id: smartList.id,
                    contact_email: contact.email,
                    contact_name:
                      [contact.first_name, contact.last_name].filter(Boolean).join(' ') || null,
                    contact_phone: contact.phone,
                    contact_company: buyer.company_name,
                    contact_role: contact.title,
                    entity_type: 'remarketing_buyer',
                    entity_id: buyer.id,
                    added_by: 'smart_rule',
                    removed_at: null,
                  },
                  { onConflict: 'list_id,contact_email', ignoreDuplicates: false },
                );
                if (!error) results.buyer_added++;
              }
            }
          }
        }

        const smartListIds = buyerSmartLists.map((l) => l.id);
        await supabase
          .from('contact_lists')
          .update({ last_evaluated_at: new Date().toISOString() })
          .in('id', smartListIds);
      }

      await supabase.from('smart_list_buyer_evaluation_queue').delete().in('buyer_id', buyerIds);
    }
  } catch (err) {
    console.error('Buyer queue processing error:', err);
  }

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
});
