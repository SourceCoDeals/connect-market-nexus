import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/error-response.ts";

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  try {
    const body: any = await req.json();

    // Navigate to salesforce_data inside the n8n wrapper
    const salesforceData = body?.[0]?.body?.salesforce_data;
    if (!salesforceData) {
      return errorResponse("Missing salesforce_data in payload", 400, corsHeaders);
    }

    const account: any = salesforceData["Account Data"];
    if (!account?.Id || !account?.Name) {
      return errorResponse("Missing required Account.Id or Account.Name", 400, corsHeaders);
    }

    // Normalize contacts: single object → array, null → empty array
    const rawContacts: any = salesforceData["Contacts Data"];
    let contacts: any[] = [];
    if (Array.isArray(rawContacts)) {
      contacts = rawContacts;
    } else if (rawContacts && typeof rawContacts === "object" && rawContacts.Id) {
      contacts = [rawContacts];
    }

    // Find primary contact (first with valid email)
    const primaryContact = contacts.find((c: any) => c.Email && c.Email.trim());
    const accountPhone = account.Phone || null;

    // Phone fallback for a contact
    const resolvePhone = (contact: any): string | null =>
      contact?.Phone || contact?.MobilePhone || accountPhone;

    // Normalize website
    let website = account.Website || null;
    if (website && !/^https?:\/\//i.test(website)) {
      website = `https://${website}`;
    }

    // Build listing payload
    const listingPayload: Record<string, any> = {
      salesforce_account_id: account.Id,
      title: account.Name,
      internal_company_name: account.Name,
      revenue: account.AnnualRevenue ?? null,
      ebitda: account.EBITDA__c ?? null,
      website,
      address_city: account.BillingCity || null,
      address_state: account.BillingState || null,
      address_country: account.BillingCountry || null,
      deal_source: "salesforce_remarketing",
      is_internal_deal: true,
      status: "active",
      remarketing_status: "active",
      // SF-specific columns
      sf_record_type_id: account.RecordTypeId || null,
      sf_remarketing: account.Remarketing__c ?? false,
      sf_remarketing_cb_create_date: account.Remarketing_CB_Create_Date__c || null,
      sf_remarketing_reason: account.Remarketing_Reason__c || null,
      sf_remarketing_target_stages: account.Remarketing_Target_Stages__c || null,
      sf_target_stage: account.Target_Stage__c || null,
      sf_target_sub_stage: account.Target_Sub_Stage__c || null,
      sf_marketplace_sub_stage: account.Marketplace_Sub_Stage__c || null,
      sf_interest_in_selling: account.Interest_in_Selling__c || null,
      sf_tier: account.Tier__c || null,
      sf_owner_id: account.OwnerId || null,
      sf_previous_search_opportunity_id: account.Previous_Search__c || null,
      sf_primary_opportunity_id: account.Primary_Opportunity__c || null,
      sf_primary_client_account_id: account.Primary_Client_Account__c || null,
      sf_note_summary: account.Note_Summary__c || null,
      sf_historic_note_summary: account.Historic_Note_Summary__c || null,
      sf_remarks_internal: account.remarketing_note__c || null,
      sf_last_modified_date: account.LastModifiedDate || null,
      sf_created_date: account.CreatedDate || null,
    };

    // Set primary contact fields on listing from first contact with email
    if (primaryContact) {
      const firstName = primaryContact.FirstName || "";
      const lastName = primaryContact.LastName || "";
      listingPayload.main_contact_name = `${firstName} ${lastName}`.trim() || null;
      listingPayload.main_contact_email = primaryContact.Email;
      listingPayload.main_contact_phone = resolvePhone(primaryContact);
      listingPayload.main_contact_title = primaryContact.Title || null;
    } else {
      // Fallback phone from account
      listingPayload.main_contact_phone = accountPhone;
    }

    // Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey) as any;

    // Check if listing exists by salesforce_account_id
    const { data: existingListing } = await supabase
      .from("listings")
      .select("id")
      .eq("salesforce_account_id", account.Id)
      .maybeSingle();

    let listingId: string;

    if (existingListing) {
      // Update existing listing
      const { error: updateError } = await supabase
        .from("listings")
        .update(listingPayload)
        .eq("id", existingListing.id);
      if (updateError) {
        console.error("Listing update error:", updateError);
        return errorResponse(`Listing update failed: ${updateError.message}`, 500, corsHeaders);
      }
      listingId = existingListing.id;
    } else {
      // Insert new listing
      const { data: newListing, error: insertError } = await supabase
        .from("listings")
        .insert(listingPayload)
        .select("id")
        .single();
      if (insertError) {
        console.error("Listing insert error:", insertError);
        return errorResponse(`Listing insert failed: ${insertError.message}`, 500, corsHeaders);
      }
      listingId = newListing.id;
    }

    // Upsert contacts (unique index is on lower(email), listing_id WHERE contact_type='seller' AND archived=false)
    let contactsUpserted = 0;
    for (let i = 0; i < contacts.length; i++) {
      const contact: any = contacts[i];
      const email = contact.Email?.trim()?.toLowerCase();
      if (!email) continue;

      const isPrimary = i === contacts.indexOf(primaryContact);
      const firstName = contact.FirstName || "";
      const lastName = contact.LastName || "";
      const phone = resolvePhone(contact);
      const title = contact.Title || null;

      // Check if contact already exists
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("listing_id", listingId)
        .eq("contact_type", "seller")
        .eq("archived", false)
        .ilike("email", email)
        .maybeSingle();

      if (existing) {
        const { error: updateErr } = await supabase
          .from("contacts")
          .update({
            first_name: firstName || null,
            last_name: lastName || null,
            phone,
            title,
            is_primary_seller_contact: isPrimary,
            source: "salesforce",
          })
          .eq("id", existing.id);
        if (updateErr) {
          console.error(`Contact update error for ${email}:`, updateErr);
        } else {
          contactsUpserted++;
        }
      } else {
        const { error: insertErr } = await supabase
          .from("contacts")
          .insert({
            listing_id: listingId,
            email,
            first_name: firstName || null,
            last_name: lastName || null,
            phone,
            title,
            contact_type: "seller",
            is_primary_seller_contact: isPrimary,
            source: "salesforce",
            archived: false,
          });
        if (insertErr) {
          console.error(`Contact insert error for ${email}:`, insertErr);
        } else {
          contactsUpserted++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        salesforce_account_id: account.Id,
        listing_id: listingId,
        contacts_upserted: contactsUpserted,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("salesforce-remarketing-webhook error:", err);
    return errorResponse(err.message || "Internal server error", 500, corsHeaders);
  }
});
