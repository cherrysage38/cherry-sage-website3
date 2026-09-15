-- Cherry Sage: support free appointment REQUESTS (no payment required up front), matching
-- book-appointment.html's actual promise ("This is a request, not an instant booking... not
-- guaranteed until she confirms") and her real approve/decline/alternate dashboard workflow.
-- Confirmed 2026-09-16 with RJ: this is her real business model, not the pay-first flow that
-- the schema was originally built for (order_id was NOT NULL, admin RPCs inner-joined orders).
-- Run once, in the Supabase SQL Editor for project ctoeuikxoqlhnebgsygp.

-- 1) A request has no order yet -- only gets one if/when she offers a paid path later.
alter table cherry_sage.appointments alter column order_id drop not null;

-- 2) Capture what the customer told us structurally, not just in an email that might not send.
alter table cherry_sage.appointments add column if not exists reading_type text;
alter table cherry_sage.appointments add column if not exists notes text;

-- 3) admin_update_appointment: LEFT JOIN orders/reading_products so a free-request appointment
--    (order_id null) still returns correctly instead of vanishing from the result set.
--    DROP first: the original had parameter defaults that CREATE OR REPLACE can't silently change.
drop function if exists cherry_sage.admin_update_appointment(text, uuid, text, timestamptz, text);
create function cherry_sage.admin_update_appointment(
  p_admin_key text, p_id uuid, p_status text, p_alternate_start timestamptz, p_decision_note text
)
returns table(appointment_id uuid, customer_email text, customer_name text, product_name text, requested_start timestamptz, alternate_start timestamptz, clover_payment_id text, amount_cents integer)
language plpgsql
security definer
set search_path = cherry_sage, public
as $function$
begin
  if p_admin_key is distinct from 'CherrySage-hours-2026' then
    raise exception 'unauthorized';
  end if;

  update appointments a
  set status = p_status,
      alternate_start = coalesce(p_alternate_start, a.alternate_start),
      decision_note = coalesce(p_decision_note, a.decision_note),
      decided_at = now()
  where a.id = p_id;

  return query
  select a.id, c.email, c.full_name, coalesce(rp.name, a.reading_type), a.requested_start, a.alternate_start, o.clover_payment_id, o.amount_cents
  from appointments a
  join customers c on c.id = a.customer_id
  left join orders o on o.id = a.order_id
  left join reading_products rp on rp.id = o.reading_product_id
  where a.id = p_id;
end;
$function$;

-- 4) admin_list_appointments: same LEFT JOIN fix -- otherwise free requests never even reach
--    Bev's approval queue. DROP first: new return columns (phone, order_status) change the
--    row type, which CREATE OR REPLACE won't allow either.
drop function if exists cherry_sage.admin_list_appointments(text, text);
create function cherry_sage.admin_list_appointments(p_admin_key text, p_status text default null)
returns table(id uuid, requested_start timestamptz, duration_minutes integer, status text, alternate_start timestamptz, decision_note text, decided_at timestamptz, created_at timestamptz, full_name text, email text, phone text, product_name text, amount_cents integer, order_status text)
language plpgsql
security definer
set search_path = cherry_sage, public
as $function$
begin
  if p_admin_key is distinct from 'CherrySage-hours-2026' then
    raise exception 'unauthorized';
  end if;
  return query
  select
    a.id, a.requested_start, a.duration_minutes, a.status, a.alternate_start,
    a.decision_note, a.decided_at, a.created_at,
    c.full_name, c.email, c.phone,
    coalesce(rp.name, a.reading_type), o.amount_cents, o.status
  from appointments a
  join customers c on c.id = a.customer_id
  left join orders o on o.id = a.order_id
  left join reading_products rp on rp.id = o.reading_product_id
  where (p_status is null or a.status = p_status)
  order by a.requested_start asc;
end;
$function$;

-- 5) New customer-facing RPC: create a free request, tied to the logged-in customer, no
--    payment required. Mirrors link_customer_to_auth_user's auth.uid() pattern.
create or replace function cherry_sage.request_appointment(
  p_requested_start timestamptz,
  p_duration_minutes integer,
  p_reading_type text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = cherry_sage, public
as $function$
declare
  v_customer_id uuid;
  v_appt_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_requested_start is null or p_duration_minutes is null or p_reading_type is null then
    raise exception 'missing required field';
  end if;

  v_customer_id := link_customer_to_auth_user();

  insert into appointments (customer_id, requested_start, duration_minutes, status, reading_type, notes)
  values (v_customer_id, p_requested_start, p_duration_minutes, 'pending_approval', p_reading_type, p_notes)
  returning id into v_appt_id;

  return v_appt_id;
end;
$function$;

grant execute on function cherry_sage.request_appointment(timestamptz, integer, text, text) to authenticated;
