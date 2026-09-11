-- D-027 — Confirmer une offre sur un cours annulé doit dire « cours annulé ».
--
-- Quand la box annule un cours pendant qu'une offre de liste d'attente court,
-- `cancel_class_bookings` (20260911101100) passe l'entrée OFFERED à
-- CLASS_CANCELLED. Le membre qui tape ensuite « Confirmer » tombait dans la
-- branche générique de `confirm_promotion` et lisait OFFER_EXPIRED — « Cette
-- offre a expiré. La place est passée au suivant. » — **faux** : le cours
-- n'existe plus, la place n'est passée à personne, et le message génère un appel
-- au support. C'est une **course** : l'écran rendu avec une offre vivante est
-- confirmé avant de se rafraîchir ; la défense qui vaut quel que soit l'état de
-- l'écran est le bon code côté base.
--
-- 20260911101100, qui a posé `confirm_promotion`, est **déjà fusionnée** (P1-006,
-- PR #80) : déjà versionnée, donc immuable — le hook `guard-migrations.mjs` la
-- bloque, et règle 13 impose alors d'**ajouter** une migration qui la `create or
-- replace`, jamais d'éditer l'originale (même geste que
-- 20260911101200_waitlist_quiet_hours_exemption). Le remplacement réémet la
-- fonction **entière** — même signature, même `security definer set search_path =
-- ''` — et n'ajoute que la branche CLASS_CANCELLED. Les `grant`/`revoke` posés
-- avec l'originale persistent à travers `create or replace`. (`app_error` ne tient
-- pas de liste blanche de codes : lever CLASS_CANCELLED ne touche rien d'autre.)
create or replace function public.confirm_promotion(p_waitlist_entry_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_entry record;
  v_booking_id uuid;
begin
  select w.id, w.class_id, w.tenant_id, w.membership_id, w.status, w.booking_id, w.expires_at
  into v_entry
  from public.waitlist_entries w
  join public.memberships m on m.id = w.membership_id
  where w.id = p_waitlist_entry_id and m.user_id = v_user_id;

  if v_entry.id is null then
    perform public.app_error('FORBIDDEN_ROLE', 'Cette offre n''existe pas, ou n''est pas la vôtre.', '42501');
  end if;

  -- Déjà confirmée : rendre le booking, sans rien retoucher (idempotent).
  if v_entry.status = 'ACCEPTED' then
    return v_entry.booking_id;
  end if;

  -- Le verrou, puis re-lecture de l'état sous le verrou (le balayage a pu passer).
  perform 1 from public.classes c where c.id = v_entry.class_id for update;
  select w.status, w.expires_at, w.booking_id into v_entry.status, v_entry.expires_at, v_entry.booking_id
  from public.waitlist_entries w where w.id = p_waitlist_entry_id;

  if v_entry.status = 'ACCEPTED' then
    return v_entry.booking_id;
  end if;
  -- D-027 : cours annulé par la box pendant l'offre. Le dire distinctement, avant
  -- la garde générique — sinon CLASS_CANCELLED (≠ OFFERED) est lu « offre expirée ».
  if v_entry.status = 'CLASS_CANCELLED' then
    perform public.app_error('CLASS_CANCELLED', 'Ce cours a été annulé.', '23514');
  end if;
  if v_entry.status <> 'OFFERED' or v_entry.expires_at is null or v_entry.expires_at <= now() then
    perform public.app_error('OFFER_EXPIRED', 'Cette offre a expiré. La place est passée au suivant.', '23514');
  end if;

  -- Le siège est déjà tenu par booked_count : on transforme l'offre en
  -- réservation SANS toucher booked_count. C'est ici que P2-007 débitera le crédit.
  insert into public.bookings (tenant_id, class_id, membership_id, idempotency_key)
  values (v_entry.tenant_id, v_entry.class_id, v_entry.membership_id, 'wl-' || v_entry.id::text)
  returning id into v_booking_id;

  update public.waitlist_entries
  set status = 'ACCEPTED', promoted_at = now(), booking_id = v_booking_id
  where id = p_waitlist_entry_id;
  update public.classes set waitlist_count = waitlist_count - 1 where id = v_entry.class_id;

  return v_booking_id;
end;
$$;
