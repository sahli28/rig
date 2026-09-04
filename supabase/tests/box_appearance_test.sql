-- L'apparence d'une box : qui l'écrit, et sur quoi une box neuve démarre.
--
-- Rien de neuf en base ici — `themes`, sa policy OWNER et ses droits datent de
-- P0-004. Ce fichier existe pour deux raisons :
--
--   1. la **frontière** n'avait jamais été testée dans ce sens : `themes` est la
--      seule table du produit où un MANAGER ne peut pas écrire alors qu'il écrit
--      partout ailleurs (spec §5.2, le white-label est au propriétaire) ;
--   2. le défaut d'une box neuve est une **promesse produit**, pas un détail de
--      colonne : c'est ce qu'un propriétaire voit à la première ouverture.

begin;
select plan(7);

-- ---------------------------------------------------------------------------
-- Une box neuve démarre sur un neutre, pas sur la couleur d'exemple
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select lives_ok(
  $$select public.create_tenant('CrossFit Neuve', 'crossfit-neuve')$$,
  'une box se crée'
);

-- `#E4572E` est la couleur de **Rack**, pas celle d'une box qui vient de naître.
-- Les deux ont partagé le même littéral jusqu'ici, ce qui rendait impossible de
-- distinguer « la plateforme faute de box » de « cette box, au défaut ».
select isnt(
  (select th.primary_color from public.themes th
   join public.tenants t on t.id = th.tenant_id
   where t.slug = 'crossfit-neuve'),
  '#E4572E',
  'une box neuve ne démarre pas sur la couleur d''exemple de la spec'
);

select is(
  (select th.app_name from public.themes th
   join public.tenants t on t.id = th.tenant_id
   where t.slug = 'crossfit-neuve'),
  'CrossFit Neuve',
  '…et porte son propre nom dès la création'
);

-- ---------------------------------------------------------------------------
-- Le white-label est au propriétaire, et à lui seul
-- ---------------------------------------------------------------------------

update public.themes set primary_color = '#123456'
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select primary_color from public.themes
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  '#123456',
  'un OWNER change la couleur de sa box'
);

-- Hugo administre pourtant Rueil : il écrit `tenant_settings`, `opening_hours`,
-- `class_types`, `rooms`. `themes` est la seule table qui lui échappe.
set local request.jwt.claims = '{"sub":"77777777-0000-4000-8000-000000000001","role":"authenticated","email":"hugo@rueil.example"}';

update public.themes set primary_color = '#654321'
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select primary_color from public.themes
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  '#123456',
  'un MANAGER ne touche pas au white-label (spec §5.2), même là où il administre'
);

-- ---------------------------------------------------------------------------
-- Ce que la base refuse, quelle que soit l'interface
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select throws_ok(
  $$update public.themes set primary_color = 'bleu'
    where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'une couleur qui n''est pas un hexadécimal est refusée'
);

-- Le rayon borne l'échelle entière : `buildTheme` en dérive `sm`, `md`, `lg`.
select throws_ok(
  $$update public.themes set radius = 200
    where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'un rayon hors bornes aussi'
);

select * from finish();
rollback;
