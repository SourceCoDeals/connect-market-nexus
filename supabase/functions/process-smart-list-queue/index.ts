/**
 * process-smart-list-queue
 *
 * Processes the smart list evaluation queue. Called by cron every 5 minutes.
 * For each queued listing, evaluates it against all active seller smart lists.
 * If it matches, upserts a member into the list (resetting removed_at). If it
 * no longer matches, marks any existing smart_rule member row as removed.
 *
 * Same pattern for buyer queue against buyer smart lists.
 *
 * NOTE: The rule evaluation logic here must stay in sync with
 * `src/lib/smart-list-rules.ts` so that the frontend preview count matches
 * the worker's decisions. When updating one, update the other.
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

// Seller list field definitions for contains_any search.
// Must mirror SELLER_FIELDS[key='industry'].searchFields in smart-list-rules.ts.
const SEARCH_FIELDS: Record<string, string[]> = {
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
      const fieldsToSearch = SEARCH_FIELDS[rule.field] ?? [rule.field];
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
      // Accept bounds in either order — match frontend behavior.
      const [a, b] = rule.value as [number, number];
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      const num = Number(fieldValue ?? 0);
      return num >= min && num <= max;
    }
    case 'is_true':
      return fieldValue === true || fieldValue === 'true';
    case 'is_false':
      return !fieldValue || fieldValue === false || fieldValue === 'false';
    case 'is_not_null':
      // Match frontend: 0 and false are valid non-null values.
      return fieldValue != null && fieldValue !== '';
    case 'is_null':
      return fieldValue == null || fieldValue === '';
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

  const results = {
    seller_processed: 0,
    seller_added: 0,
    seller_removed: 0,
    buyer_processed: 0,
    buyer_added: 0,
    buyer_removed: 0,
  };

  // ---- SELLER SMART LISTS ----
  try {
    const { data: queue } = await supabase
      .from('smart_list_evaluation_queue')
      .select('listing_id')
      .order('queued_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (queue && queue.length > 0) {
      const listingIds = queue.map((q) => q.listing_id);

      const { data: listings } = await supabase
        .from('listings')
        .select(
          'id, industry, category, categories, services, service_mix, executive_summary, address_state, linkedin_employee_count, google_review_count, google_rating, number_of_locations, deal_total_score, deal_source, enriched_at, main_contact_email, main_contact_phone, main_contact_name, is_priority_target, website, internal_company_name, title, created_at, not_a_fit, deleted_at',
        )
        .in('id', listingIds);

      const validListings = (listings ?? []).filter(
        (l) =>
          l.deleted_at == null &&
          (l.not_a_fit === false || l.not_a_fit == null) &&
          l.main_contact_email,
      );

      const { data: smartLists } = await supabase
        .from('contact_lists')
        .select('id, list_rules, match_mode, auto_add_enabled')
        .eq('is_smart_list', true)
        .eq('is_archived', false)
        .eq('auto_add_enabled', true)
        .eq('source_entity', 'listings');

      // Track which queue items successfully completed (H4: only delete on success).
      const successfulListingIds = new Set<string>();

      // Invalid listings (soft-deleted, not_a_fit, no email) need their
      // stale smart_rule rows retracted across ALL smart lists — otherwise
      // they hang around forever.
      const invalidListingIds = listingIds.filter(
        (id) => !validListings.some((l) => l.id === id),
      );
      for (const id of invalidListingIds) {
        const { data: removed, error } = await supabase
          .from('contact_list_members')
          .update({ removed_at: new Date().toISOString() })
          .eq('entity_type', 'listing')
          .eq('entity_id', id)
          .eq('added_by', 'smart_rule')
          .is('removed_at', null)
          .select('id');
        if (error) {
          console.error('Seller invalid retract failed:', { listing: id, error });
          // leave in queue so it gets retried
        } else {
          if (removed && removed.length > 0) results.seller_removed += removed.length;
          successfulListingIds.add(id);
        }
      }

      if (smartLists && smartLists.length > 0) {
        for (const listing of validListings) {
          results.seller_processed++;
          let listingOk = true;

          for (const smartList of smartLists) {
            const config = smartList.list_rules as SmartListConfig;
            if (!config?.rules?.length) continue;

            const matches = matchesRules(listing as Record<string, unknown>, config);

            if (matches) {
              const { error: upsertErr } = await supabase.from('contact_list_members').upsert(
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
              if (upsertErr) {
                listingOk = false;
                console.error('Seller upsert failed:', { list: smartList.id, listing: listing.id, error: upsertErr });
                continue;
              }
              results.seller_added++;

              // Retract any OTHER smart_rule rows for this listing in this
              // list that have a stale contact_email (covers the case where
              // main_contact_email changed — the new row was just upserted,
              // the old one is orphaned).
              const { data: orphans, error: orphanErr } = await supabase
                .from('contact_list_members')
                .update({ removed_at: new Date().toISOString() })
                .eq('list_id', smartList.id)
                .eq('entity_type', 'listing')
                .eq('entity_id', listing.id)
                .eq('added_by', 'smart_rule')
                .is('removed_at', null)
                .neq('contact_email', listing.main_contact_email!)
                .select('id');
              if (orphanErr) {
                listingOk = false;
                console.error('Seller orphan retract failed:', { list: smartList.id, listing: listing.id, error: orphanErr });
              } else if (orphans && orphans.length > 0) {
                results.seller_removed += orphans.length;
              }
            } else {
              // H2/A1: retract ALL smart_rule rows for this listing in this
              // list — keyed by entity_id so email changes don't orphan rows.
              const { data: removed, error: retractErr } = await supabase
                .from('contact_list_members')
                .update({ removed_at: new Date().toISOString() })
                .eq('list_id', smartList.id)
                .eq('entity_type', 'listing')
                .eq('entity_id', listing.id)
                .eq('added_by', 'smart_rule')
                .is('removed_at', null)
                .select('id');
              if (retractErr) {
                listingOk = false;
                console.error('Seller retract failed:', { list: smartList.id, listing: listing.id, error: retractErr });
              } else if (removed && removed.length > 0) {
                results.seller_removed += removed.length;
              }
            }
          }

          if (listingOk) successfulListingIds.add(listing.id);
        }

        // Update last_evaluated_at on all smart lists we processed.
        const smartListIds = smartLists.map((l) => l.id);
        await supabase
          .from('contact_lists')
          .update({ last_evaluated_at: new Date().toISOString() })
          .in('id', smartListIds);
      } else {
        // No active smart lists — nothing to evaluate against, safe to clear.
        for (const listing of validListings) successfulListingIds.add(listing.id);
      }

      // H4: only delete successfully processed items.
      if (successfulListingIds.size > 0) {
        await supabase
          .from('smart_list_evaluation_queue')
          .delete()
          .in('listing_id', [...successfulListingIds]);
      }
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
        .select('id, list_rules, match_mode, auto_add_enabled')
        .eq('is_smart_list', true)
        .eq('is_archived', false)
        .eq('auto_add_enabled', true)
        .eq('source_entity', 'remarketing_buyers');

      // M6: hoist contacts fetch out of the inner loop.
      const buyerContacts: Record<string, Array<{
        id: string;
        email: string | null;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
        title: string | null;
      }>> = {};
      if (validBuyers.length > 0) {
        const { data: contactsData } = await supabase
          .from('contacts')
          .select('id, email, first_name, last_name, phone, title, remarketing_buyer_id')
          .in(
            'remarketing_buyer_id',
            validBuyers.map((b) => b.id),
          )
          .eq('archived', false)
          .not('email', 'is', null);
        for (const c of contactsData ?? []) {
          const bid = (c as unknown as { remarketing_buyer_id: string | null }).remarketing_buyer_id;
          if (!bid) continue;
          if (!buyerContacts[bid]) buyerContacts[bid] = [];
          buyerContacts[bid].push(c);
        }
      }

      const successfulBuyerIds = new Set<string>();

      // Invalid buyers (archived, soft-deleted) need their smart_rule rows
      // retracted across ALL smart lists.
      const invalidBuyerIds = buyerIds.filter(
        (id) => !validBuyers.some((b) => b.id === id),
      );
      for (const id of invalidBuyerIds) {
        const { data: removed, error } = await supabase
          .from('contact_list_members')
          .update({ removed_at: new Date().toISOString() })
          .eq('entity_type', 'remarketing_buyer')
          .eq('entity_id', id)
          .eq('added_by', 'smart_rule')
          .is('removed_at', null)
          .select('id');
        if (error) {
          console.error('Buyer invalid retract failed:', { buyer: id, error });
        } else {
          if (removed && removed.length > 0) results.buyer_removed += removed.length;
          successfulBuyerIds.add(id);
        }
      }

      if (buyerSmartLists && buyerSmartLists.length > 0) {
        for (const buyer of validBuyers) {
          results.buyer_processed++;
          let buyerOk = true;
          const contacts = buyerContacts[buyer.id] ?? [];

          for (const smartList of buyerSmartLists) {
            const config = smartList.list_rules as SmartListConfig;
            if (!config?.rules?.length) continue;

            const matches = matchesRules(buyer as Record<string, unknown>, config);

            if (matches) {
              const activeEmails: string[] = [];
              for (const contact of contacts) {
                if (!contact.email) continue;
                activeEmails.push(contact.email);
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
                if (error) {
                  buyerOk = false;
                  console.error('Buyer upsert failed:', { list: smartList.id, buyer: buyer.id, error });
                } else {
                  results.buyer_added++;
                }
              }

              // Retract orphan smart_rule rows for this buyer whose contact
              // is no longer present (contact archived / deleted / email cleared).
              // Fetch existing rows then update by id to avoid escaping traps.
              const { data: existing, error: fetchErr } = await supabase
                .from('contact_list_members')
                .select('id, contact_email')
                .eq('list_id', smartList.id)
                .eq('entity_type', 'remarketing_buyer')
                .eq('entity_id', buyer.id)
                .eq('added_by', 'smart_rule')
                .is('removed_at', null);
              if (fetchErr) {
                buyerOk = false;
                console.error('Buyer orphan fetch failed:', { list: smartList.id, buyer: buyer.id, error: fetchErr });
              } else if (existing) {
                const activeSet = new Set(activeEmails);
                const orphanIds = existing
                  .filter((r) => !activeSet.has(r.contact_email))
                  .map((r) => r.id);
                if (orphanIds.length > 0) {
                  const { error: orphanErr } = await supabase
                    .from('contact_list_members')
                    .update({ removed_at: new Date().toISOString() })
                    .in('id', orphanIds);
                  if (orphanErr) {
                    buyerOk = false;
                    console.error('Buyer orphan retract failed:', { list: smartList.id, buyer: buyer.id, error: orphanErr });
                  } else {
                    results.buyer_removed += orphanIds.length;
                  }
                }
              }
            } else {
              // H2: retract rule-added rows for this buyer that no longer match.
              const { data: removed, error } = await supabase
                .from('contact_list_members')
                .update({ removed_at: new Date().toISOString() })
                .eq('list_id', smartList.id)
                .eq('entity_type', 'remarketing_buyer')
                .eq('entity_id', buyer.id)
                .eq('added_by', 'smart_rule')
                .is('removed_at', null)
                .select('id');
              if (error) {
                buyerOk = false;
                console.error('Buyer retract failed:', { list: smartList.id, buyer: buyer.id, error });
              } else if (removed && removed.length > 0) {
                results.buyer_removed += removed.length;
              }
            }
          }

          if (buyerOk) successfulBuyerIds.add(buyer.id);
        }

        const smartListIds = buyerSmartLists.map((l) => l.id);
        await supabase
          .from('contact_lists')
          .update({ last_evaluated_at: new Date().toISOString() })
          .in('id', smartListIds);
      } else {
        for (const buyer of validBuyers) successfulBuyerIds.add(buyer.id);
      }

      if (successfulBuyerIds.size > 0) {
        await supabase
          .from('smart_list_buyer_evaluation_queue')
          .delete()
          .in('buyer_id', [...successfulBuyerIds]);
      }
    }
  } catch (err) {
    console.error('Buyer queue processing error:', err);
  }

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
});
