-- P1-006 — Liste d'attente, Lot 4 : exempter WAITLIST_PROMOTION des quiet hours.
--
-- Une offre de promotion créée à 22 h porte un `expires_at = +60 min`. La taire
-- jusqu'à 7 h — le comportement par défaut de `notification_respects_quiet_hours`
-- — la ferait **brûler sans être vue** : le compte à rebours court pendant le
-- silence, l'offre expire, le siège passe au suivant, et le membre découvre au
-- matin une place qu'il n'a jamais eu la chance de prendre. C'est l'inverse
-- exact de ce que la liste d'attente promet.
--
-- 20260911100100, qui a posé cette fonction, est **déjà fusionnée** (P1-016) :
-- déjà versionnée, donc immuable — le hook `guard-migrations.mjs` la bloque, et
-- règle 13 impose alors d'**ajouter** une migration qui la `create or replace`,
-- jamais d'éditer l'originale. Le remplacement réémet la fonction **entière** —
-- même signature, même `immutable set search_path = ''` — et ne change que le
-- prédicat. (`UNE_BASE_DE_PRODUCTION_EXISTE` reste `false` : ce n'est pas la
-- prod qui l'immobilise, c'est le fait qu'elle soit déjà partie sur `main`.)
--
-- Effet de bord assumé (décision #1 du plan) : une offre créée à 3 h pour un
-- cours à 13 h notifie à 3 h. L'alternative P2 — un délai qui se met en pause
-- pendant les quiet hours — demande un ordonnanceur par-offre qu'on n'a pas, et
-- l'offre de 3 h reste préférable à l'offre brûlée.
--
-- `CLASS_CANCELLATION` reste exemptée pour la même raison d'urgence.
create or replace function public.notification_respects_quiet_hours(
  p_category public.notification_category
) returns boolean language sql immutable set search_path = '' as $$
  select p_category not in ('CLASS_CANCELLATION', 'WAITLIST_PROMOTION')
$$;
