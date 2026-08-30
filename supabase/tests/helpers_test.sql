-- Fonctions socle : génération d'identifiants et horodatage.

begin;
select plan(7);

-- ---------------------------------------------------------------------------
-- uuid_generate_v7()
-- ---------------------------------------------------------------------------

select is(
  substring(public.uuid_generate_v7()::text, 15, 1),
  '7',
  'le nibble de version vaut 7'
);

select ok(
  substring(public.uuid_generate_v7()::text, 20, 1) in ('8', '9', 'a', 'b'),
  'les bits de variante sont conformes à la RFC 9562'
);

select is(
  length(public.uuid_generate_v7()::text),
  36,
  'la forme textuelle est bien un UUID'
);

select isnt(
  public.uuid_generate_v7(),
  public.uuid_generate_v7(),
  'deux appels ne collisionnent pas'
);

-- Le préfixe d'horodatage est croissant, pas l'UUID entier : dans une boucle
-- serrée, plusieurs identifiants tombent dans la même milliseconde et leur
-- ordre dépend alors des bits aléatoires. Tester l'UUID complet donnerait un
-- test intermittent — d'où l'espacement et la comparaison sur les 48 bits.
create temporary table v7_sample (ord int, prefix text);

do $$
declare i int;
begin
  for i in 1..5 loop
    insert into v7_sample (ord, prefix)
    select i, substring(u::text, 1, 8) || substring(u::text, 10, 4)
    from public.uuid_generate_v7() u;
    perform pg_sleep(0.005);
  end loop;
end;
$$;

select is(
  (select count(*) from v7_sample a join v7_sample b on b.ord = a.ord + 1
   where b.prefix < a.prefix)::int,
  0,
  'le préfixe d''horodatage 48 bits ne décroît jamais'
);

select is(
  (select count(distinct prefix) from v7_sample)::int,
  5,
  'cinq tirages espacés de 5 ms produisent cinq horodatages distincts'
);

-- ---------------------------------------------------------------------------
-- set_updated_at()
-- ---------------------------------------------------------------------------

create temporary table touch_me (
  id int primary key,
  updated_at timestamptz not null default '2000-01-01'
);
create trigger touch_me_updated before update on touch_me
  for each row execute function public.set_updated_at();
insert into touch_me (id) values (1);
update touch_me set id = 1 where id = 1;

select ok(
  (select updated_at from touch_me where id = 1) > '2020-01-01'::timestamptz,
  'le trigger repositionne updated_at à la mise à jour'
);

select * from finish();
rollback;
