-- P2-019 — Lien externe de paiement.
--
-- Pas d'entité juridique, pas de Stripe Connect : le règlement se fait **hors
-- app**, sur le lien de paiement du compte Stripe de la box (décision
-- commanditaire, 14–16 sept. 2026). L'app ne fait que transporter l'URL — le
-- montant, la formule et la TVA vivent chez la box (§15.6, elle est le
-- vendeur), et l'app ne reçoit aucun retour : l'accès reste attribué à la main
-- (P2-018). Le lien est **opaque** : ni parsé, ni pré-rempli.
--
-- **Décision d'exposition, assumée** (`.claude/rules/database.md`, « ajouter
-- une colonne à une table déjà exposée ») : `tenant_settings` est lisible par
-- tous les membres de la box depuis P0-004 — « ce sont ces règles que l'app
-- affiche » — et la colonne neuve suit ce régime. C'est le but même : le
-- membre doit trouver le lien, et une URL de paiement publique n'a rien de
-- sensible. L'écriture reste bornée à OWNER/MANAGER par les policies
-- existantes ; les grants sont de table entière, rien à ajouter.

alter table public.tenant_settings add column payment_link_url text;

-- L'invariant vit sur la table (règle des sœurs : il couvre aussi les chemins
-- d'écriture futurs) ; Zod, côté formulaire, ne porte que le message poli.
-- Premier terme booléen franc (piège 12) : `null` = pas de lien = pas de
-- bouton, et c'est un état voulu, pas une contrainte qui s'évalue à NULL.
alter table public.tenant_settings add constraint tenant_settings_payment_link_https
  check (
    payment_link_url is null
    or (payment_link_url ~* '^https://' and char_length(payment_link_url) <= 2000)
  );

comment on column public.tenant_settings.payment_link_url is
  'Lien de paiement externe de la box (P2-019) — https obligatoire, opaque pour l''app. null = pas de lien, le bouton « Régler mon abonnement » n''apparaît pas. Le règlement se fait hors app ; l''accès reste attribué à la main (P2-018).';
