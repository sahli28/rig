-- P1-006 — Liste d'attente, Lot 6 : le rang dérivé de l'appelant.
--
-- L'écran veut dire « tu es 2ᵉ sur 5 ». Le total (5) vit sur
-- `classes.waitlist_count`, lisible par tout membre. Le rang (2), lui, se
-- **dérive** — « combien d'entrées actives me précèdent, +1 » (plan §1, rang
-- dérivé plutôt que renuméroté) — et il faut pour ça compter les lignes des
-- autres. Or `waitlist_own_select` ne montre au membre que **sa** ligne : le
-- rang n'est donc pas calculable côté client. D'où cette lecture,
-- `security definer`, qui franchit la policy le temps d'un `count`.
--
-- **Bornée à l'appelant, et elle ne rend qu'un nombre.** Elle résout la
-- membership par `auth.uid()` (aucun `membership_id` reçu, donc rien à forger),
-- ne travaille que sur le cours passé, et ne renvoie que le rang de l'appelant —
-- jamais l'identité d'un autre inscrit. `null` s'il n'a pas d'entrée active sur
-- ce cours : le `from self` ne rend aucune ligne, et la fonction rend donc null,
-- ce qui distingue « pas sur la liste » de « premier de la liste » (rang 1).
-- `position` est la clé d'insertion immuable ; compter les actives dont la
-- `position` précède ou égale la mienne donne le rang 1-based, insensible à la
-- renumérotation puisqu'on ne compte que les vivantes.
create or replace function public.my_waitlist_rank(p_class_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with self as (
    select w.position
    from public.waitlist_entries w
    join public.memberships m on m.id = w.membership_id
    where w.class_id = p_class_id
      and m.user_id = (select auth.uid())
      and w.status in ('WAITING', 'OFFERED')
    limit 1
  )
  select (
    select count(*)::integer
    from public.waitlist_entries w
    where w.class_id = p_class_id
      and w.status in ('WAITING', 'OFFERED')
      and w.position <= self.position
  )
  from self;
$$;

revoke all on function public.my_waitlist_rank(uuid) from public, anon;
grant execute on function public.my_waitlist_rank(uuid) to authenticated;

comment on function public.my_waitlist_rank(uuid) is
  'Le rang dérivé (1-based) de l''appelant sur la liste d''attente du cours, ou null s''il n''y figure pas. Security definer : franchit waitlist_own_select pour compter les entrées actives qui précèdent, mais bornée à l''appelant (résout la membership par auth.uid()) et ne rend qu''un nombre.';
