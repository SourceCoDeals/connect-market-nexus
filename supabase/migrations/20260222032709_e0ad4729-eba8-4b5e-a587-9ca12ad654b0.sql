BEGIN;

-- SECTION A: RLS for saved_listings and connection_requests
ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own saved listings" ON public.saved_listings;
CREATE POLICY "Users can manage own saved listings" ON public.saved_listings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can manage all saved listings" ON public.saved_listings;
CREATE POLICY "Admins can manage all saved listings" ON public.saved_listings FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Service role full access to saved listings" ON public.saved_listings;
CREATE POLICY "Service role full access to saved listings" ON public.saved_listings FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own connection requests" ON public.connection_requests;
CREATE POLICY "Users can view own connection requests" ON public.connection_requests FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert own connection requests" ON public.connection_requests;
CREATE POLICY "Users can insert own connection requests" ON public.connection_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own connection requests" ON public.connection_requests;
CREATE POLICY "Users can update own connection requests" ON public.connection_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete connection requests" ON public.connection_requests;
CREATE POLICY "Admins can delete connection requests" ON public.connection_requests FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Service role full access to connection requests" ON public.connection_requests;
CREATE POLICY "Service role full access to connection requests" ON public.connection_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- SECTION B: Fix overly permissive policies
DROP POLICY IF EXISTS "Users can manage buyers" ON public.buyers;
DROP POLICY IF EXISTS "Users can manage buyer_deal_scores" ON public.buyer_deal_scores;
DROP POLICY IF EXISTS "Users can manage buyer_contacts" ON public.buyer_contacts;

DROP POLICY IF EXISTS "Authenticated system can insert notifications" ON public.admin_notifications;
DROP POLICY IF EXISTS "Service role can insert admin notifications" ON public.admin_notifications;
CREATE POLICY "Service role can insert admin notifications" ON public.admin_notifications FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can insert admin notifications" ON public.admin_notifications;
CREATE POLICY "Admins can insert admin notifications" ON public.admin_notifications FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can insert user notifications" ON public.user_notifications;
DROP POLICY IF EXISTS "Service role can insert user notifications" ON public.user_notifications;
CREATE POLICY "Service role can insert user notifications" ON public.user_notifications FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can insert user notifications" ON public.user_notifications;
CREATE POLICY "Admins can insert user notifications" ON public.user_notifications FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role can manage journeys" ON public.user_journeys;
CREATE POLICY "Service role can manage journeys" ON public.user_journeys FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role can manage captarget sync exclusions" ON public.captarget_sync_exclusions;
CREATE POLICY "Service role can manage captarget sync exclusions" ON public.captarget_sync_exclusions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- SECTION C: Standardize admin checks (skip call_transcripts - table dropped)
DROP POLICY IF EXISTS "Admin users can view captarget sync exclusions" ON public.captarget_sync_exclusions;
CREATE POLICY "Admin users can view captarget sync exclusions" ON public.captarget_sync_exclusions FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin users can view captarget sync logs" ON public.captarget_sync_log;
CREATE POLICY "Admin users can view captarget sync logs" ON public.captarget_sync_log FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can manage scoring queue" ON public.remarketing_scoring_queue;
CREATE POLICY "Admins can manage scoring queue" ON public.remarketing_scoring_queue FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- scores_select_policy: skip deleted_at reference since column doesn't exist
DROP POLICY IF EXISTS "scores_select_policy" ON public.remarketing_scores;
CREATE POLICY "scores_select_policy" ON public.remarketing_scores FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- SECTION D: RPCs with auth guards
CREATE OR REPLACE FUNCTION public.reset_all_admin_notifications() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Access denied'; END IF; UPDATE admin_notifications SET is_read = false, read_at = NULL; END; $$;

CREATE OR REPLACE FUNCTION public.restore_soft_deleted(p_table_name TEXT, p_record_id UUID) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Access denied'; END IF; EXECUTE format('UPDATE %I SET deleted_at = NULL WHERE id = $1', p_table_name) USING p_record_id; RETURN FOUND; END; $$;

DROP FUNCTION IF EXISTS public.get_deal_access_matrix(uuid);
CREATE FUNCTION public.get_deal_access_matrix(p_deal_id UUID) RETURNS TABLE (access_id UUID, remarketing_buyer_id UUID, marketplace_user_id UUID, contact_id UUID, buyer_name TEXT, buyer_company TEXT, contact_title TEXT, can_view_teaser BOOLEAN, can_view_full_memo BOOLEAN, can_view_data_room BOOLEAN, fee_agreement_signed BOOLEAN, fee_agreement_override BOOLEAN, fee_agreement_override_reason TEXT, granted_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, last_access_at TIMESTAMPTZ, access_token UUID) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$ BEGIN IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Access denied'; END IF; RETURN QUERY SELECT a.id, a.remarketing_buyer_id, a.marketplace_user_id, a.contact_id, COALESCE(NULLIF(TRIM(c.first_name||' '||c.last_name),''), rb.company_name, NULLIF(TRIM(p.first_name||' '||p.last_name),''), p.email), COALESCE(fa.primary_company_name, rb.pe_firm_name, rb.company_name), c.title, a.can_view_teaser, a.can_view_full_memo, a.can_view_data_room, COALESCE((SELECT fac.fee_agreement_status='signed' FROM firm_agreements fac WHERE fac.id=c.firm_id LIMIT 1),(SELECT fal.fee_agreement_status='signed' FROM firm_agreements fal WHERE fal.email_domain=rb.email_domain AND rb.email_domain IS NOT NULL LIMIT 1),false), a.fee_agreement_override, a.fee_agreement_override_reason, a.granted_at, a.revoked_at, a.expires_at, COALESCE(a.last_access_at,(SELECT MAX(al.created_at) FROM data_room_audit_log al WHERE al.deal_id=a.deal_id AND al.user_id=COALESCE(a.marketplace_user_id,a.remarketing_buyer_id::uuid) AND al.action IN ('view_document','download_document','view_data_room'))), a.access_token FROM data_room_access a LEFT JOIN contacts c ON c.id=a.contact_id LEFT JOIN firm_agreements fa ON fa.id=c.firm_id LEFT JOIN remarketing_buyers rb ON rb.id=a.remarketing_buyer_id LEFT JOIN profiles p ON p.id=a.marketplace_user_id WHERE a.deal_id=p_deal_id ORDER BY a.granted_at DESC; END; $$;

DROP FUNCTION IF EXISTS public.get_deal_distribution_log(uuid);
CREATE FUNCTION public.get_deal_distribution_log(p_deal_id UUID) RETURNS TABLE (log_id UUID, buyer_name TEXT, buyer_company TEXT, memo_type TEXT, channel TEXT, sent_by_name TEXT, sent_at TIMESTAMPTZ, email_address TEXT, notes TEXT) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$ BEGIN IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Access denied'; END IF; RETURN QUERY SELECT dl.id, COALESCE(rb.company_name, NULLIF(TRIM(p.first_name||' '||p.last_name),''), p.email), COALESCE(rb.pe_firm_name, rb.company_name), dl.memo_type, dl.channel, NULLIF(TRIM(sp.first_name||' '||sp.last_name),''), dl.sent_at, dl.email_address, dl.notes FROM memo_distribution_log dl LEFT JOIN remarketing_buyers rb ON rb.id=dl.remarketing_buyer_id LEFT JOIN profiles p ON p.id=dl.marketplace_user_id LEFT JOIN profiles sp ON sp.id=dl.sent_by WHERE dl.deal_id=p_deal_id ORDER BY dl.sent_at DESC; END; $$;

DROP FUNCTION IF EXISTS public.get_buyer_deal_history(uuid);
CREATE FUNCTION public.get_buyer_deal_history(p_buyer_id UUID) RETURNS TABLE (deal_id UUID, deal_title TEXT, deal_category TEXT, has_teaser_access BOOLEAN, has_full_memo_access BOOLEAN, has_data_room_access BOOLEAN, memos_sent BIGINT, last_memo_sent_at TIMESTAMPTZ, pipeline_stage TEXT, pipeline_stage_id UUID) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$ BEGIN IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Access denied'; END IF; RETURN QUERY SELECT l.id, COALESCE(l.internal_company_name, l.title), l.category, COALESCE(a.can_view_teaser, false), COALESCE(a.can_view_full_memo, false), COALESCE(a.can_view_data_room, false), COALESCE((SELECT COUNT(*) FROM memo_distribution_log dl WHERE dl.deal_id=l.id AND dl.remarketing_buyer_id=p_buyer_id),0), (SELECT MAX(dl.sent_at) FROM memo_distribution_log dl WHERE dl.deal_id=l.id AND dl.remarketing_buyer_id=p_buyer_id), ds.name, d.stage_id FROM listings l LEFT JOIN data_room_access a ON a.deal_id=l.id AND a.remarketing_buyer_id=p_buyer_id LEFT JOIN deals d ON d.listing_id=l.id AND d.remarketing_buyer_id=p_buyer_id LEFT JOIN deal_stages ds ON ds.id=d.stage_id WHERE a.id IS NOT NULL OR d.id IS NOT NULL OR EXISTS (SELECT 1 FROM memo_distribution_log dl WHERE dl.deal_id=l.id AND dl.remarketing_buyer_id=p_buyer_id) ORDER BY GREATEST(a.granted_at, d.created_at, (SELECT MAX(dl.sent_at) FROM memo_distribution_log dl WHERE dl.deal_id=l.id AND dl.remarketing_buyer_id=p_buyer_id)) DESC NULLS LAST; END; $$;

DROP FUNCTION IF EXISTS public.get_deals_with_details();
CREATE FUNCTION public.get_deals_with_details() RETURNS TABLE (deal_id uuid, deal_title text, deal_description text, deal_value numeric, deal_probability integer, deal_expected_close_date date, deal_created_at timestamptz, deal_updated_at timestamptz, deal_stage_entered_at timestamptz, deal_followed_up boolean, deal_followed_up_at timestamptz, deal_followed_up_by uuid, deal_negative_followed_up boolean, deal_negative_followed_up_at timestamptz, deal_negative_followed_up_by uuid, deal_buyer_priority_score integer, deal_priority text, deal_source text, stage_id uuid, stage_name text, stage_color text, stage_position integer, listing_id uuid, listing_title text, listing_category text, listing_real_company_name text, listing_revenue numeric, listing_ebitda numeric, listing_location text, connection_request_id uuid, buyer_id uuid, buyer_name text, buyer_email text, buyer_company text, buyer_phone text, buyer_type text, assigned_to uuid, contact_name text, contact_email text, contact_company text, contact_phone text, contact_role text, nda_status text, fee_agreement_status text, last_contact_at timestamptz, total_activities integer, pending_tasks integer, total_tasks integer, completed_tasks integer, last_activity_at timestamptz, company_deal_count bigint, listing_deal_count bigint, buyer_connection_count bigint) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Access denied'; END IF; RETURN QUERY SELECT d.id, d.title, d.description, d.value, d.probability, d.expected_close_date, d.created_at, d.updated_at, d.stage_entered_at, d.followed_up, d.followed_up_at, d.followed_up_by, d.negative_followed_up, d.negative_followed_up_at, d.negative_followed_up_by, d.buyer_priority_score, d.priority, d.source, ds.id, ds.name, ds.color, ds.position, d.listing_id, l.title, l.category, l.internal_company_name, l.revenue, l.ebitda, l.location, d.connection_request_id, p.id, COALESCE(p.first_name||' '||p.last_name, p.email), p.email, p.company, p.phone_number, p.buyer_type, d.assigned_to, CASE WHEN d.contact_name IS NOT NULL AND d.contact_name!='' AND d.contact_name!='Unknown' AND d.contact_name!='Unknown Contact' THEN d.contact_name WHEN p.first_name IS NOT NULL OR p.last_name IS NOT NULL THEN COALESCE(p.first_name||' '||p.last_name, p.email) WHEN cr.lead_name IS NOT NULL AND cr.lead_name!='' THEN cr.lead_name ELSE 'Unknown Contact' END, COALESCE(NULLIF(d.contact_email,''), p.email, cr.lead_email), COALESCE(NULLIF(d.contact_company,''), p.company, cr.lead_company), COALESCE(NULLIF(d.contact_phone,''), p.phone_number, cr.lead_phone), d.contact_role, d.nda_status, d.fee_agreement_status, (SELECT MAX(dc.created_at) FROM deal_contacts dc WHERE dc.deal_id=d.id), (SELECT COUNT(*)::integer FROM deal_activities da WHERE da.deal_id=d.id), (SELECT COUNT(*)::integer FROM deal_tasks dt WHERE dt.deal_id=d.id AND dt.status='pending'), (SELECT COUNT(*)::integer FROM deal_tasks dt WHERE dt.deal_id=d.id), (SELECT COUNT(*)::integer FROM deal_tasks dt WHERE dt.deal_id=d.id AND dt.status='completed'), GREATEST(d.updated_at, (SELECT MAX(da.created_at) FROM deal_activities da WHERE da.deal_id=d.id), (SELECT MAX(dt.updated_at) FROM deal_tasks dt WHERE dt.deal_id=d.id)), COUNT(*) OVER (PARTITION BY COALESCE(l.internal_company_name, d.contact_company, p.company)), COUNT(*) OVER (PARTITION BY d.listing_id), (SELECT COUNT(*)::bigint FROM connection_requests cr_count WHERE (cr_count.user_id=cr.user_id AND cr.user_id IS NOT NULL) OR (cr_count.lead_email=COALESCE(NULLIF(d.contact_email,''), p.email, cr.lead_email) AND cr_count.lead_email IS NOT NULL)) FROM deals d LEFT JOIN deal_stages ds ON d.stage_id=ds.id LEFT JOIN listings l ON d.listing_id=l.id LEFT JOIN connection_requests cr ON d.connection_request_id=cr.id LEFT JOIN profiles p ON cr.user_id=p.id WHERE d.deleted_at IS NULL ORDER BY d.created_at DESC; END; $$;

COMMIT;