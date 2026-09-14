# `P1-027` — La liste des inscrits d'un cours, au back-office

**Phase** `P1` · **Estimation** `1` j·h · **Dépend de** `P1-008a` ✅ (la vue de feuille d'appel) · **Spec** §5.2, §7 · **Origine** usage réel du pilote, 14 septembre 2026 — **priorité 1** · **Décisions ratifiées le 14 septembre 2026** (1,25 → 1 : le resserrage de portée sort du périmètre)

## Objectif

Un coach ouvre le panneau d'un cours dans le planning web et **voit qui vient** ;
OWNER/MANAGER le voient sur tous les cours. Aujourd'hui seule l'app membre
montre des inscrits — le back-office n'a aucune feuille.

## Ce qui existe, et les deux décisions ratifiées (règle 6 : signalées, puis tranchées)

**La vue existe** : `class_attendance_sheet`
(`20260910120000_attendance_and_no_show.sql:95`) rend les réservations
`CONFIRMED` d'un cours au **staff** de la box — c'est elle que le mode coach
mobile consomme. La consommer depuis le web est le gros du ticket. Les deux
écarts signalés à l'ouverture ont été **tranchés par la commanditaire le
14 septembre 2026** :

1. **Identité : noms complets confirmés, pour TOUT le staff** (OWNER/MANAGER
   **et** COACH). La vue gagne `last_name`, et la ligne « Présence » de
   `privacy.md` est mise à jour **dans le même commit** — base légale inchangée
   (traitement légitime de la box, exécution du contrat), le point 3 de la
   règle commune (« le nom se réduit à prénom + initiale ») gagne son exception
   nommée et datée pour l'audience staff. Ni e-mail, ni téléphone, ni
   naissance n'entrent. **Le pendant est posé le même jour dans `P1-008b`** :
   le kiosque, surface semi-publique, ne consomme jamais cette vue enrichie —
   projection minimisée obligatoire, écrit là-bas avant que le kiosque soit
   codé.
2. **Portée du COACH : la portée BOX est conservée pour le pilote.** Le COACH
   voit la feuille de tous les cours de sa box — l'état actuel de la vue
   (`current_staff_tenant_ids()`), qui couvre le coach remplaçant sans rien
   casser. **Aucun resserrage du `WHERE`, aucun cas pgTAP « coach ne voit pas
   les cours d'un collègue ».** Le strict « ses cours » de la spec §5.2 est
   **reporté, décision datée du 14 septembre 2026, pas un oubli** — à rouvrir
   quand une box plus grande le demandera (plusieurs coachs qui ne se
   connaissent pas), et ce jour-là en base, jamais côté client (règle 2).

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| La vue et ses tests | `class_attendance_sheet`, `supabase/tests/` (P1-008a) | ✅ existent — à étendre, pas à créer |
| Le panneau de l'occurrence côté web | `planning/workout-form.tsx` | ✅ existe |
| `tenantScope().selectView()` + frontière Zod | motif de `planning/page.tsx:108` (Staff) | ✅ existe |
| Le rôle de l'appelant pour l'affichage | `can()` / `membership.role` — déjà dans la page | ✅ existe |

## Périmètre

- Migration (`create or replace view`) : + `last_name` — la portée ne bouge
  pas ; le commentaire de la vue et `privacy.md` racontent la décision datée.
- pgTAP : le staff (COACH compris) lit les noms complets des inscrits d'un
  cours de sa box ; un MEMBER, rien ; l'autre box, rien (les cas d'isolation
  existants restent verts).
- Panneau web : liste « Inscrits (n/capacité) » — nom complet, badge présence
  si déjà cochée. Lecture seule : **cocher reste au mobile** (P1-008a).
- i18n FR/EN des libellés.

## Hors périmètre

- Pointer la présence depuis le web (le mode coach mobile le fait, en salle).
- E-mail/téléphone des inscrits : `member_admin_directory` existe pour l'admin.
- La liste d'attente dans le panneau : le membre la voit ; le staff le jour où
  une box le demande.

## Critères d'acceptation

- [x] Tout le staff de la box (COACH compris, portée box — décision du
      14 sept.) voit la liste des inscrits ; un MEMBER, rien ; l'autre box,
      rien — pgTAP (`attendance_test.sql`, 29 assertions : les deux nouvelles
      tournent **sous la session de Sarah, COACH** — l'audience exacte de la
      décision ; MEMBER = 0 ligne et l'isolation inter-box étaient déjà
      prouvés par la suite)
- [x] Les noms sont complets — **harnais, 14 sept.** : panneau du cours de
      18:30, « Inscrits — 2 sur 16 », **Julie Kaczmarek** et **Léa Martin**,
      entre la séance et les places, lecture seule. Une **seule** requête pour
      toute la semaine (`fetchAttendanceByClass`, motif D-032). `privacy.md`
      porte l'exception datée (point 3 + ligne « Présence »), et
      `last_initial` reste servi — la projection minimisée du kiosque
- [x] `rls-auditor` **SAFE** — les quatre questions des sœurs répondues :
      aucune autre vue ne reçoit `last_name`, `create or replace` conserve
      grants et `security_invoker`, la vue reste hors publication realtime,
      aucun chemin MEMBER/inter-box ouvert
