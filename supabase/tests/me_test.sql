-- `me()` — l'appel que fait l'app à chaque démarrage.
--
-- Deux choses à prouver : la forme du payload, et que `security invoker` suffit
-- réellement à empêcher toute divulgation, sans contrôle réécrit dans la fonction.

begin;
select plan(17);

-- ---------------------------------------------------------------------------
-- Léa — membre d'une seule box, profil complet, consentements du seed
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select is(
  (select public.me() -> 'user' ->> 'email'),
  'lea@example.com',
  'me() retourne le profil de l''appelant'
);

select is(
  (select jsonb_array_length(public.me() -> 'memberships'))::int,
  1,
  'Léa n''a qu''une appartenance'
);

-- Sans paramètre, **pas de box active**. Le tenant actif est une décision de
-- l'appelant (ADR 0002) : que `me()` choisisse « la plus ancienne » inscrirait
-- l'hypothèse mono-box dans la fonction la plus appelée du produit, et rendrait
-- le contexte affiché dépendant d'un tri plutôt que d'un choix.
select is(
  (select public.me() -> 'current_tenant'),
  'null'::jsonb,
  'sans p_tenant_id, aucune box active n''est devinée'
);

select is(
  (select public.me('aaaaaaaa-0000-4000-8000-000000000001') -> 'current_tenant' ->> 'slug'),
  'crossfit-rueil',
  'la box active est la sienne'
);

select is(
  (select public.me('aaaaaaaa-0000-4000-8000-000000000001') -> 'current_tenant' ->> 'role'),
  'MEMBER',
  'son rôle dans cette box est exposé'
);

-- Le thème et les règles arrivent avec, pour que l'app n'ait pas à les
-- redemander : c'est tout l'intérêt de l'aller-retour unique.
select is(
  (select public.me('aaaaaaaa-0000-4000-8000-000000000001') -> 'current_tenant' -> 'theme' ->> 'primary'),
  '#E4572E',
  'le thème de la box voyage avec la session'
);

select is(
  (select (public.me('aaaaaaaa-0000-4000-8000-000000000001') -> 'current_tenant' -> 'booking_rules' ->> 'cancel_window_minutes')::int),
  240,
  'les règles de réservation aussi'
);

-- La langue par défaut de la box voyage avec le fuseau et la devise : elles
-- répondent à la même question — dans quelle langue, à quelle heure et dans
-- quelle monnaie s'adresse-t-on à quelqu'un dont on ne sait rien encore.
select is(
  (select public.me('aaaaaaaa-0000-4000-8000-000000000001') -> 'current_tenant' ->> 'default_locale'),
  'fr',
  'la langue par défaut de la box est exposée, pas seulement stockée'
);

-- ---------------------------------------------------------------------------
-- `required_actions`
-- ---------------------------------------------------------------------------

-- Léa a un prénom mais pas de consentement PRIVACY dans le seed.
select ok(
  (select public.me() -> 'required_actions' ? 'ACCEPT_CONSENTS'),
  'un consentement manquant est signalé'
);

select ok(
  not (select public.me() -> 'required_actions' ? 'COMPLETE_PROFILE'),
  'un profil renseigné ne déclenche pas COMPLETE_PROFILE'
);

-- On complète les deux consentements requis : l'action doit disparaître.
insert into public.consents (user_id, tenant_id, purpose, granted, policy_version) values
  ('33333333-0000-4000-8000-000000000001', null, 'PRIVACY', true, public.current_policy_version());

select ok(
  not (select public.me() -> 'required_actions' ? 'ACCEPT_CONSENTS'),
  'les deux consentements acquis, l''action disparaît'
);

-- Une rétractation est une **nouvelle ligne**, pas une modification. La plus
-- récente doit l'emporter.
insert into public.consents (user_id, tenant_id, purpose, granted, policy_version) values
  ('33333333-0000-4000-8000-000000000001', null, 'PRIVACY', false, public.current_policy_version());

select ok(
  (select public.me() -> 'required_actions' ? 'ACCEPT_CONSENTS'),
  'une rétractation postérieure fait réapparaître l''action'
);

reset role;

-- ---------------------------------------------------------------------------
-- Julie — membre des deux boxes
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-0000-4000-8000-000000000001","role":"authenticated","email":"julie@example.com"}';

select is(
  (select jsonb_array_length(public.me() -> 'memberships'))::int,
  2,
  'un membre de deux boxes voit ses deux appartenances'
);

-- La box active se choisit par paramètre — c'est ce sur quoi s'appuiera le
-- Box Switcher quand il arrivera avec le réseau inter-box.
select is(
  (select public.me('bbbbbbbb-0000-4000-8000-000000000001') -> 'current_tenant' ->> 'slug'),
  'crossfit-nanterre',
  'le paramètre choisit la box active'
);

-- Demander une box où l'on n'appartient pas donne `current_tenant` **nul** —
-- surtout pas un repli silencieux sur une autre box. Basculer en douce ferait
-- afficher les données de la box A dans une interface que la personne croit
-- être celle de la box B. Le nul est le comportement sûr : il oblige le client
-- à le traiter.
select is(
  (select public.me('00000000-0000-4000-8000-0000000000ff') -> 'current_tenant'),
  'null'::jsonb,
  'un tenant_id étranger ne bascule pas silencieusement sur une autre box'
);

-- Les appartenances, elles, restent visibles : la session n'est pas cassée,
-- seul le contexte actif manque.
select is(
  (select jsonb_array_length(public.me('00000000-0000-4000-8000-0000000000ff') -> 'memberships'))::int,
  2,
  'la session reste valide, seul le contexte actif est absent'
);

reset role;

-- ---------------------------------------------------------------------------
-- Sans session
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';

select throws_ok(
  'select public.me()',
  '42501',
  null,
  'sans identité dans le jeton, me() refuse'
);

reset role;

select * from finish();
rollback;
