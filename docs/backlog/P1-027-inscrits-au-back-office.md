# `P1-027` — La liste des inscrits d'un cours, au back-office

**Phase** `P1` · **Estimation** `1,25` j·h · **Dépend de** `P1-008a` ✅ (la vue de feuille d'appel) · **Spec** §5.2, §7 · **Origine** usage réel du pilote, 14 septembre 2026 — **priorité 1**

## Objectif

Un coach ouvre le panneau d'un cours dans le planning web et **voit qui vient** ;
OWNER/MANAGER le voient sur tous les cours. Aujourd'hui seule l'app membre
montre des inscrits — le back-office n'a aucune feuille.

## Ce qui existe, et les deux écarts à trancher (règle 6 : signalés, pas absorbés)

**La vue existe** : `class_attendance_sheet`
(`20260910120000_attendance_and_no_show.sql:95`) rend les réservations
`CONFIRMED` d'un cours au **staff** de la box — c'est elle que le mode coach
mobile consomme. La consommer depuis le web est le gros du ticket… sauf deux
écarts entre son état et la demande :

1. **Identité.** La vue rend `first_name` + **initiale** — la 4ᵉ audience de
   `privacy.md`, décidée en P1-008a (« une seule règle d'identité »). La
   demande du 14 septembre : **nom + prénom complets pour le staff**, parce que
   le staff gère la box — et c'est vrai qu'une feuille d'appel de salle porte
   des noms complets, et que OWNER/MANAGER lisent déjà tout (e-mail compris)
   par `member_admin_directory`. **Décision commanditaire appliquée, avec sa
   trace** : la vue gagne `last_name`, et la ligne « Présence » de `privacy.md`
   est mise à jour **dans le même commit** — base légale inchangée (traitement
   légitime de la box, exécution du contrat), le point 3 de la règle commune
   (« le nom se réduit à prénom + initiale ») gagne son exception nommée pour
   l'audience staff. Ni e-mail, ni téléphone, ni naissance n'entrent.
2. **Portée du COACH.** La vue est bornée à la **box**
   (`current_staff_tenant_ids()`), pas aux cours du coach — spec §5.2 et la
   demande disent « COACH sur SES cours uniquement ». Le `WHERE` gagne donc :
   admin de la box **ou** `coach_membership_id` parmi mes appartenances. C'est
   une **décision d'autorisation, donc en base** (règle 2 : jamais côté
   client). **À vérifier avant : le mode coach mobile** (P1-008a) ne liste que
   les cours du coach — si un remplaçant coche la feuille d'un collègue
   aujourd'hui, ce resserrage le casserait et l'arbitrage doit être explicite.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| La vue et ses tests | `class_attendance_sheet`, `supabase/tests/` (P1-008a) | ✅ existent — à étendre, pas à créer |
| Le panneau de l'occurrence côté web | `planning/workout-form.tsx` | ✅ existe |
| `tenantScope().selectView()` + frontière Zod | motif de `planning/page.tsx:108` (Staff) | ✅ existe |
| Le rôle de l'appelant pour l'affichage | `can()` / `membership.role` — déjà dans la page | ✅ existe |

## Périmètre

- Migration (`create or replace view`) : + `last_name`, + portée coach ; le
  commentaire de la vue et `privacy.md` racontent la décision datée.
- pgTAP **dans les deux sens** : le coach voit ses cours (noms complets), ne
  voit **pas** ceux d'un collègue ; l'admin voit tout ; un MEMBER, rien.
- Panneau web : liste « Inscrits (n/capacité) » — nom complet, badge présence
  si déjà cochée. Lecture seule : **cocher reste au mobile** (P1-008a).
- i18n FR/EN des libellés.

## Hors périmètre

- Pointer la présence depuis le web (le mode coach mobile le fait, en salle).
- E-mail/téléphone des inscrits : `member_admin_directory` existe pour l'admin.
- La liste d'attente dans le panneau : le membre la voit ; le staff le jour où
  une box le demande.

## Critères d'acceptation

- [ ] OWNER/MANAGER voient la liste sur n'importe quel cours ; un COACH sur les
      siens, et **rien** sur ceux d'un collègue — prouvé en pgTAP, pas à l'écran
- [ ] Les noms sont complets, et `privacy.md` porte la décision datée
- [ ] Le mode coach mobile est re-vérifié au harnais après le resserrage
- [ ] `rls-auditor` SAFE sur la migration
