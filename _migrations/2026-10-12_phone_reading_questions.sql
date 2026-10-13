-- Cherry Sage: a phone reading (minutes) may also have questions, e.g. the phone numerology reading asks
-- for the birth name, date of birth and current name before the call (Bev, 2026-10-12).
-- Changes only admin_create_product: for a minutes product it keeps and checks the questions instead of
-- dropping them. No Email question is required for a phone reading, checkout already asks for it.
-- Saving questions on an existing product (admin_update_product_details) already worked, unchanged.
-- Run by Bev in the Supabase SQL Editor on 2026-10-12 ("Success. No rows returned").
-- To undo: run 2026-10-12_phone_reading_questions_UNDO.sql the same way.

CREATE OR REPLACE FUNCTION cherry_sage.admin_create_product(p_pin text, p_name text, p_price_cents integer, p_kind text, p_duration_minutes integer, p_description text, p_report_fields jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'cherry_sage', 'public'
AS $function$
declare f jsonb; new_id uuid; next_sort integer; has_email boolean := false; keys text[] := '{}';
begin
  if not cherry_sage.is_owner() then raise exception 'unauthorized'; end if;
  if p_name is null or length(trim(p_name)) = 0 or length(p_name) > 120 then raise exception 'the product needs a name (up to 120 characters)'; end if;
  if p_price_cents is null or p_price_cents < 0 or p_price_cents > 1000000 then raise exception 'the price is not valid'; end if;
  if p_description is not null and length(p_description) > 4000 then raise exception 'the description is too long (4000 characters at most)'; end if;
  if p_kind not in ('report', 'minutes') then raise exception 'pick a product type: a written report or a phone reading'; end if;

  if p_kind = 'minutes' then
    if p_duration_minutes is null or p_duration_minutes < 1 or p_duration_minutes > 240 then raise exception 'the length in minutes is not valid (1 to 240)'; end if;
    -- 2026-10-12: a phone reading may also have questions (e.g. birth details for a phone numerology reading).
    -- Optional, checked like report questions, but no Email question needed: checkout already asks for the email.
    if p_report_fields is not null then
      if jsonb_typeof(p_report_fields) <> 'array' then raise exception 'the report questions are not valid (up to 20)'; end if;
      if jsonb_array_length(p_report_fields) = 0 then
        p_report_fields := null;
      else
        if jsonb_array_length(p_report_fields) > 20 then raise exception 'the report questions are not valid (up to 20)'; end if;
        for f in select * from jsonb_array_elements(p_report_fields) loop
          if coalesce(f->>'key','') !~ '^[a-z][a-z0-9_]{0,30}$' or coalesce(f->>'label','') = '' or length(f->>'label') > 200
             or coalesce(f->>'type','') not in ('text','date','email','textarea') or (f->>'key') = any(keys) then
            raise exception 'one of the report questions is not valid (each needs a label and a type)';
          end if;
          keys := keys || (f->>'key');
        end loop;
      end if;
    end if;
  else
    p_duration_minutes := null;
    if p_report_fields is null or jsonb_typeof(p_report_fields) <> 'array' or jsonb_array_length(p_report_fields) = 0 or jsonb_array_length(p_report_fields) > 20 then
      raise exception 'the report questions are not valid (add at least one, up to 20)';
    end if;
    for f in select * from jsonb_array_elements(p_report_fields) loop
      if coalesce(f->>'key','') !~ '^[a-z][a-z0-9_]{0,30}$' or coalesce(f->>'label','') = '' or length(f->>'label') > 200
         or coalesce(f->>'type','') not in ('text','date','email','textarea') or (f->>'key') = any(keys) then
        raise exception 'one of the report questions is not valid (each needs a label and a type)';
      end if;
      keys := keys || (f->>'key');
      if f->>'type' = 'email' then has_email := true; end if;
    end loop;
    if not has_email then raise exception 'the report questions are not valid (keep one Email address question, the report is sent there)'; end if;
  end if;

  select coalesce(max(sort_order), 0) + 1 into next_sort
    from cherry_sage.reading_products where show_in_shop and not requires_scheduling and sort_order < 100;

  insert into cherry_sage.reading_products
    (name, duration_minutes, price_cents, is_first_time_only, requires_scheduling, active, description, show_in_shop, sort_order, report_fields)
  values
    (trim(p_name), p_duration_minutes, p_price_cents, false, false, true, nullif(trim(coalesce(p_description,'')), ''), true, next_sort, p_report_fields)
  returning id into new_id;
  return new_id;
end;
$function$;
