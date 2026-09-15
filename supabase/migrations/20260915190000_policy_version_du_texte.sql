-- La politique de confidentialité existe : la version cesse d'affirmer seule (D-023).
--
-- `current_policy_version()` disait `'2026-08-01'` — la date d'aucun texte.
-- Elle conditionne l'accès (`me()` ne tient un consentement pour satisfait que
-- si sa version est la sienne) : le produit faisait donc cocher, enregistrait
-- une preuve horodatée avec IP et user-agent, et ouvrait l'accès, sur un
-- document qui n'existait pas. Le texte est publié sur
-- `/politique-de-confidentialite` (apps/web), validé par la commanditaire le
-- 15 septembre 2026 ; la constante prend sa date, et
-- `packages/core/src/privacy-policy.test.ts` rougit si l'une bouge sans l'autre.
--
-- **Migration ajoutée, pas éditée en place**, et c'est le point de bascule de
-- la règle 13 : la base hébergée (P1-017/P1-023) porte déjà
-- `20260831133636_me_function.sql`, et `pnpm heberge:derive` ne compare que les
-- **noms** de migrations — une édition en place y serait invisible, et
-- l'hébergé garderait l'ancienne date en silence, exactement la divergence
-- local/hébergé que `CLAUDE.md` dit indécouvrable au bon moment. Un fichier
-- ajouté, lui, apparaît « EN RETARD » jusqu'au `db push` : l'écart se voit.
--
-- Conséquence assumée : les consentements déjà enregistrés sous `'2026-08-01'`
-- deviennent périmés — `me()` redemandera ACCEPT_CONSENTS. C'est voulu (ils
-- portaient sur un texte inexistant, donc n'éclairaient rien) et c'est
-- exactement pourquoi D-023 bloque `P1-016` : ce geste devait passer **avant**
-- le premier import réel. Seuls les comptes d'essai recocheront.

create or replace function public.current_policy_version()
returns text
language sql
immutable
set search_path = ''
as $$
  select '2026-09-15'::text;
$$;
