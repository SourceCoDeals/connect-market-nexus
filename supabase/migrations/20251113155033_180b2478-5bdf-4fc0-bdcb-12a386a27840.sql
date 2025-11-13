-- Fix trigger function referencing non-existent column real_company_name
-- Replace with internal_company_name when building reassignment notifications

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
begin
  -- Only proceed if assigned_to changed and there was a previous owner
  if old.assigned_to is not null and new.assigned_to is distinct from old.assigned_to then
    -- Get previous owner details
    select email, first_name || ' ' || last_name
      into v_previous_owner_email, v_previous_owner_name
    from public.profiles
    where id = old.assigned_to;

    -- Get new owner details (if assigned)
    if new.assigned_to is not null then
      select email, first_name || ' ' || last_name
        into v_new_owner_email, v_new_owner_name
      from public.profiles
      where id = new.assigned_to;
    end if;

    -- Get deal and listing details
    v_deal_title := new.title;
    select l.title, l.internal_company_name
      into v_listing_title, v_company_name
    from public.listings l
    where l.id = new.listing_id;

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
        else 'Your deal "' || v_deal_title || '" has been reassigned to ' || coalesce(v_new_owner_name, 'another owner')
      end,
      '/admin/pipeline?deal=' || new.id,
      'deal_reassignment',
      jsonb_build_object(
        'previous_owner_id', old.assigned_to,
        'previous_owner_name', v_previous_owner_name,
        'previous_owner_email', v_previous_owner_email,
        'new_owner_id', new.assigned_to,
        'new_owner_name', v_new_owner_name,
        'new_owner_email', v_new_owner_email,
        'deal_id', new.id,
        'deal_title', v_deal_title,
        'listing_id', new.listing_id,
        'listing_title', v_listing_title,
        'company_name', v_company_name
      )
    );
  end if;
  return new;
end;
$$;

-- Ensure trigger exists (idempotent recreation)
-- Note: Using create trigger if not exists is not supported; drop and recreate safely
-- but to avoid dropping in production, we just keep the existing trigger since name is unchanged.
-- The function replacement above is sufficient.
