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

## Deux corrections en cours de route, tracées (règle 6)

1. **« Quiet hours → différé » était faux, et le ticket le croyait.** Mesuré
   avant d'écrire : `notification_eligibility` rend `QUIET_HOURS` et
   `enqueue_push()` **n'enfile rien** — il n'existe aucun mécanisme de report
   (pas de `send_after` dans l'outbox). Une séance publiée à 22 h ne notifie
   donc **personne** (le membre la voit dans l'app), comme toute catégorie non
   exemptée. Le report est un lot possible (colonne + claim + émetteur) si
   l'usage le réclame — écrit dans la migration, pas absorbé.
   **Ratifié par la commanditaire le 14 septembre 2026 : on RESTE sur le
   comportement mesuré pour le pilote.** Pas de report au matin ; la parade
   est une consigne d'exploitation — **publier avant 21 h** — portée aux
   consignes d'accompagnement de `P1-016` pour être dite à la box. Le lot
   « report au matin » reste nommé, déclencheur : l'usage le réclame.
2. **`rls-auditor` a rendu LEAK sur le premier jet, à raison** : `p_now` —
   l'instant de référence des quiet hours — était un paramètre de la fonction
   grantée à `authenticated`. Un staff appelant le RPC à 23 h avec un `p_now`
   de midi aurait poussé en pleine nuit — la sœur du piège 7 de `database.md`,
   appliquée à l'horloge. Correctif appliqué selon son patch : enfileur
   interne `notify_workout_published_at(id, p_now)` révoqué des rôles
   applicatifs, porte publique `notify_workout_published(id)` qui fixe
   `now()` elle-même. La migration n'était pas versionnée : corrigée en place
   (règle 13).

## Critères d'acceptation

- [x] pgTAP (10 assertions, `workout_push_test.sql`) : réservée + consentante
      → une ligne `WORKOUT_UPDATED` au contexte complet ; non-réservé →
      aucune ; **quiet hours → écarté** (le fait mesuré, pas le différé
      supposé) ; l'enfileur interne inatteignable même pour le staff (42501) ;
      MEMBER refusé ; cross-box = même refus qu'un id inconnu
- [x] Re-sauvegarde sans changement → aucun push : le « pas deux fois pour
      rien » vit dans `saveWorkout` (comparaison titre+corps relus), documenté
      dans le test SQL (« l'enfileur ré-enfile — le dédoublonnage est à
      l'action »)
- [x] Le bandeau « canal n'existe pas » a disparu avec sa clé i18n — publier
      redevient silencieux à l'écran, le push est un effet de bord jamais
      bloquant (échec journalisé, publication réussie quand même)
- [x] L'émetteur rend le gabarit `WORKOUT_UPDATED` FR/EN, date et heure
      résolues, lien profond `rack:///class/[id]` — **13/13 sous Deno, le
      vrai moteur**
- [x] `rls-auditor` : LEAK trouvé puis **SAFE après correctif** (contre-vérifié
      sur la version corrigée)
- [~] **appareil** : le push reçu sur l'iPhone à la publication réelle — même
      chemin de preuve que les `[ ]` de `P1-007`, joué à la même passe
      TestFlight
