-- Portée de `ledger_entries`, inscrite dans le catalogue.
--
-- Une migration versionnée est immuable : cette note ne pouvait pas rejoindre
-- celle qui a posé la policy. Elle est mieux ici de toute façon — `\d+
-- public.ledger_entries` et Studio l'affichent, donc la personne qui ouvrira la
-- policy pour l'élargir la lira, ce qui n'est pas garanti d'un commentaire perdu
-- dans un fichier SQL de quatre mois.
--
-- CE QUE LA NOTE PRÉVIENT
--
-- La policy vient d'être restreinte à OWNER et MANAGER
-- (`current_admin_tenant_ids()`), parce que la table n'a **aujourd'hui** aucune
-- colonne de personne : c'est de la comptabilité de box, et sa somme est le
-- chiffre d'affaires.
--
-- Cet argument cesse d'être vrai en P2. `ref_type` / `ref_id` pointeront vers
-- `payments`, et la spec §4-P4 promet au membre l'accès à ses propres factures
-- (`My Membership` → `Invoices`). La tentation évidente sera alors d'élargir
-- cette policy pour qu'un membre voie « ses » lignes — et de rouvrir exactement
-- le trou qu'on vient de fermer, puisque les écritures de box et les écritures
-- de membre vivraient dans la même table sous la même policy. Un `or` de plus
-- dans un `using`, et le chiffre d'affaires redevient lisible par tout le monde.
--
-- Les factures d'un membre passent donc par un **autre chemin** : une vue dédiée
-- filtrée sur `auth.uid()`, ou Stripe directement. `ledger_entries` reste la
-- comptabilité de box.
comment on table public.ledger_entries is
  'Comptabilité de la box. Réservée à OWNER et MANAGER (spec §5.2) : la somme des lignes est le chiffre d''affaires. Les factures d''un membre passeront par une vue dédiée filtrée sur auth.uid(), jamais par un élargissement de cette policy.';

comment on policy ledger_entries_admin_select on public.ledger_entries is
  'OWNER et MANAGER uniquement. NE PAS élargir en P2 pour les factures membres : écritures de box et écritures de membre dans la même policy rouvriraient l''accès au CA. Passer par une vue filtrée sur auth.uid().';

comment on policy audit_logs_owner_select on public.audit_logs is
  'OWNER uniquement (spec §5.2). Les diff jsonb portent les changements de rôle et les exclusions : un MANAGER n''y a pas accès non plus.';
