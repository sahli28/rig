-- Deux défauts que `pnpm test:db` **contre le projet hébergé** a trouvés le
-- 11 septembre 2026 — **verts en local, rouges sur l'hébergé**, parce que le
-- modèle de droits y diffère. C'est ce que la mise en production anticipée
-- (P1-017 sorti de P1-016) a acheté : sans elle, le premier serait tombé le
-- jour 1 de la box pilote, sur les 80 membres à la fois.
--
-- Migration *ajoutée*, pas édition en place (règle 13 : la base de prod existe
-- depuis P1-017).

-- ---------------------------------------------------------------------------
-- 1. forbid_email_change lisait auth.users en SECURITY INVOKER
-- ---------------------------------------------------------------------------
-- Le trigger de gel de l'e-mail compare `new.email` à `auth.users.email`. En
-- invoker, il s'exécute sous `authenticated`, qui n'a **pas** SELECT sur
-- `auth.users` sur l'hébergé (le schéma `auth` y est verrouillé ; le local est
-- plus permissif). Toute édition de profil (`first_name`, …) échouait donc en
-- `42501: permission denied for table users` sur l'hébergé.
--
-- Fix : `SECURITY DEFINER` — le propriétaire lit `auth.users`. **Pas**
-- `grant select on auth.users to authenticated`, qui exposerait l'e-mail de tous
-- les membres de la plateforme. Le `search_path` est déjà à `''` (obligatoire
-- pour un definer ; le corps qualifie déjà `auth.users` et `public.app_error`).
-- Le gel lui-même est inchangé : le definer ne change que le rôle qui LIT
-- auth.users, pas ce que le trigger interdit.
create or replace function public.forbid_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email
     and new.email is distinct from (select u.email from auth.users u where u.id = new.id)
  then
    perform public.app_error('EMAIL_IMMUTABLE',
      'L''adresse e-mail se modifie via le fournisseur d''authentification, pas directement.',
      '42501');
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. pilot_weekly_rrule_until n'était pas accordée à authenticated
-- ---------------------------------------------------------------------------
-- `20260902120000` révoque quatre sœurs de `public`/`anon` (`_valid`, `_days`,
-- `_interval`, `_until`) et n'accorde que `_valid` à `authenticated`. Or
-- `_until` est appelée dans le CHECK `class_schedules_until_after_start`, donc
-- **évaluée sous l'identité de l'appelant** à chaque insert : un MANAGER créant
-- une série avec `UNTIL=` échouait en `42501` sur l'hébergé. Masqué en local par
-- `auto_expose_new_tables = true`, qui accordait le droit par défaut — ce réglage
-- passe à `false` dans `config.toml` (même modèle que l'hébergé) pour que ce
-- test morde désormais en local aussi.
--
-- **Les deux autres sœurs n'ont PAS besoin de ce droit — vérifié, pas supposé :**
-- `_days` et `_interval` ne sont appelées que par `maintain_class_occurrences`,
-- qui est `security definer` et tourne donc sous le propriétaire. Les accorder à
-- `authenticated` élargirait la surface sans raison. Cette note est ici pour
-- qu'un revoke×4 / grant×2 ne soit pas un jour « corrigé » en grant×4.
grant execute on function public.pilot_weekly_rrule_until(text) to authenticated;
