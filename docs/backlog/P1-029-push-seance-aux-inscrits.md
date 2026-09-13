# `P1-029` — La séance publiée prévient ceux qui ont réservé

**Phase** `P1` · **Estimation** `1,5` j·h · **Dépend de** `P1-007` ✅ (chaîne push), `P1-015` ✅ · **Spec** §9 (notifications) · **Origine** usage réel du pilote, 14 septembre 2026 — priorité 2

## Objectif

Quand le coach publie ou modifie la séance d'un cours, les membres qui ont
**réservé cette occurrence** reçoivent un push. Le panneau affiche aujourd'hui
« Publier n'envoie aucune notification : le canal n'existe pas encore » — ce
ticket câble le canal, il n'en refait pas un.

## Ce que ce ticket suppose et qui doit exister

*Vérifié le 14 septembre 2026 — toute la chaîne aval existe (`P1-007`) :*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| La porte d'enfilage unique | `enqueue_push()` (`20260911100600:95`) — éligibilité, **quiet hours** et préférences intégrées, `security definer`, interne | ✅ existe — les producteurs l'appellent, jamais l'app |
| L'émetteur + le réveil | `push_outbox`, `rack-push-emitter`, `kick_push_emitter()` | ✅ déployés et servis (`P1-017`) |
| La catégorie de cette notification | enum `notification_category` (`20260911100100:15`) | ❌ **`WORKOUT_UPDATED` à ajouter** — `alter type … add value`, transactionnelle (hors plafond marketing), **respecte** les quiet hours (seule `CLASS_CANCELLATION` les perce) |
| Le producteur | *rien* | ❌ **à créer ici** : `notify_workout_published(p_class_id)`, `security definer`, gardée staff-du-tenant, qui boucle sur les réservations `CONFIRMED` de l'occurrence et appelle `enqueue_push()` |
| Le point d'accroche | `saveWorkout` (`planning/actions.ts:317`) | ✅ existe — appel du producteur après l'écriture |
| Le texte du push FR/EN | motif des pushes existants (promotion, annulation) | ✅ motif à suivre tel quel (contexte JSON, rendu à l'émission) |

## Décisions à tenir

- **Publier ET modifier notifient ; pas deux fois pour rien.** Une re-sauvegarde
  sans changement de texte ne doit pas re-pousser : le producteur ne s'appelle
  que si le corps ou le titre a changé (comparaison dans l'action, où l'ancien
  texte est déjà relu pour l'écran).
- **Le push est un effet de bord, jamais une condition** — même règle que
  l'e-mail d'invitation : un échec d'enfilage ne fait pas échouer la
  publication.
- **Quiet hours respectées** : une séance publiée à 22 h part au matin. C'est le
  comportement d'`enqueue_push()` sans rien faire ; l'écrire ici pour que
  personne ne « corrige » en perçant.
- **Enum sans code derrière = rien** (CLAUDE.md) : la valeur `WORKOUT_UPDATED`
  entre dans la même migration que le producteur qui l'emploie.

## Périmètre

- Migration : valeur d'enum + `notify_workout_published()` + pgTAP (inscrit
  notifié une fois, non-inscrit jamais, quiet hours différées, MEMBER ne peut
  pas appeler le producteur).
- `saveWorkout` : appel après écriture, si le texte a changé ; suppression du
  bandeau « le canal n'existe pas encore » et de sa clé i18n.
- Deep link du contexte : l'écran du cours (`rack://class/[id]`, comme les
  pushes existants).

## Hors périmètre

- Notifier un changement d'horaire/salle/coach de l'occurrence : autre
  producteur, autre texte — à ouvrir si l'usage le demande.
- Le récapitulatif hebdomadaire (« ta semaine ») : `P2`.

## Critères d'acceptation

- [ ] pgTAP : réservé → une ligne `push_outbox` ; non réservé → aucune ;
      re-sauvegarde sans changement → aucune nouvelle ; quiet hours → différé
- [ ] Le bandeau « canal n'existe pas » a disparu, remplacé par rien (publier
      redevient silencieux à l'écran)
- [ ] `rls-auditor` SAFE ; la fonction refuse un appelant non-staff — pgTAP
- [~] **appareil** : le push reçu sur l'iPhone à la publication réelle — même
      chemin de preuve que les `[ ]` de `P1-007`, joué à la même passe
