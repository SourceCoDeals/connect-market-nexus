-- Fix notify_deal_reassignment to use correct URL and remove problematic net.http_post
-- The pg_net extension may not be available or the settings don't exist
-- Instead, we'll just create in-app notifications and handle emails separately

create or replace function public.notify_deal_reassignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous_owner_email text;
  v_previous_owner_name text;
  v_new_owner_email text;
  v_new_owner_name text;
  v_deal_title text;
  v_listing_title text;
  v_company_name text;
  v_modifying_admin_name text;
  v_modifying_admin_email text;
  v_buyer_name text;
  v_buyer_email text;
  v_buyer_company text;
begin
  -- Only proceed if assigned_to changed
  if new.assigned_to is distinct from old.assigned_to then
    -- Get deal details
    v_deal_title := new.title;
    select l.title, l.internal_company_name
      into v_listing_title, v_company_name
    from public.listings l
    where l.id = new.listing_id;

    -- Get buyer details from connection request
    select 
      p.first_name || ' ' || p.last_name,
      p.email,
      p.company
      into v_buyer_name, v_buyer_email, v_buyer_company
    from public.connection_requests cr
    join public.profiles p on p.id = cr.user_id
    where cr.id = new.connection_request_id;

    -- Get current user (the admin making the change)
    select first_name || ' ' || last_name, email
      into v_modifying_admin_name, v_modifying_admin_email
    from public.profiles
    where id = auth.uid();

    -- Notify previous owner if there was one
    if old.assigned_to is not null then
      select email, first_name || ' ' || last_name
        into v_previous_owner_email, v_previous_owner_name
      from public.profiles
      where id = old.assigned_to;

      -- Create in-app notification for previous owner
      insert into public.admin_notifications (
        admin_id,
        deal_id,
        title,
        message,
        action_url,
        notification_type,
        metadata
      ) values (
        old.assigned_to,
        new.id,
        'Deal Reassigned',
        case 
          when new.assigned_to is null then 'Your deal "' || v_deal_title || '" has been unassigned'
          else 'Your deal "' || v_deal_title || '" has been reassigned'
        end,
        '/admin/pipeline?deal=' || new.id,
        'deal_reassignment',
        jsonb_build_object(
          'previous_owner_id', old.assigned_to,
          'previous_owner_name', v_previous_owner_name,
          'previous_owner_email', v_previous_owner_email,
          'new_owner_id', new.assigned_to,
          'deal_id', new.id,
          'deal_title', v_deal_title,
          'listing_id', new.listing_id,
          'listing_title', v_listing_title,
          'company_name', v_company_name
        )
      );
    end if;

    -- Notify new owner if assigned
    if new.assigned_to is not null then
      select email, first_name || ' ' || last_name
        into v_new_owner_email, v_new_owner_name
      from public.profiles
      where id = new.assigned_to;

      -- Create in-app notification for new owner
      insert into public.admin_notifications (
        admin_id,
        deal_id,
        title,
        message,
        action_url,
        notification_type,
        metadata
      ) values (
        new.assigned_to,
        new.id,
        'New Deal Assigned',
        'You have been assigned to deal "' || v_deal_title || '"',
        '/admin/pipeline?deal=' || new.id,
        'deal_assignment',
        jsonb_build_object(
          'new_owner_id', new.assigned_to,
          'new_owner_name', v_new_owner_name,
          'new_owner_email', v_new_owner_email,
          'deal_id', new.id,
          'deal_title', v_deal_title,
          'listing_id', new.listing_id,
          'listing_title', v_listing_title,
          'company_name', v_company_name,
          'buyer_name', v_buyer_name,
          'buyer_email', v_buyer_email,
          'buyer_company', v_buyer_company,
          'assigned_by_name', v_modifying_admin_name
        )
      );
    end if;
  end if;
  return new;
end;
$$;