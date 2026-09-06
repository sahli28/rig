# P2-013b — Mes records : les ajouter soi-même, les revoir, et calculer une charge en salle

**Phase** P2 · **Estimation** 3 j·h · **Dépend de** **P2-009 (dur)** · **Spec** §2.2 (M14, socle de M13), §4-P5 (RM5.5), §9.1 (points 4 et 5) · **Demandé le** 6 septembre 2026, d'après HustleUp

## Objectif

Une personne enregistre elle-même un record — « deadlift, 120 kg, aujourd'hui » —
**sans qu'un WOD ait eu lieu**, revoit l'historique du mouvement, et lit en salle
la charge que représente un pourcentage de ce record.

## Le trou que ce ticket bouche, et pourquoi personne ne l'avait vu

P2-013 crée les records **à partir d'un score** : `personal_records.source_score_id`
pointe la séance où le record est tombé. Un record ne peut donc naître que dans
une séance programmée, saisie dans la fenêtre de 48 h. Trois conséquences :

- une personne qui arrive avec deux ans d'historique n'a **aucun moyen** de le
  donner ;
- un 1RM testé en open gym, hors cours, n'existe pas ;
- **P2-011 ne peut pas résoudre « 75 % du 1RM » le premier jour.** La table est
  vide, et son critère « si aucun 1RM n'est enregistré, l'app propose de le
  renseigner » n'a **pas d'écran où envoyer la personne**.

C'est la règle 8 du workflow, huitième occurrence : un ticket qui appelle une
donnée que personne n'a livré le moyen de produire. Elle a été attrapée ici par
une demande d'usage, pas par une relecture — ce qui vaut d'être noté.

**Conséquence d'ordonnancement, et c'est la vraie nouvelle du ticket : P2-011
dépend de celui-ci, pas de P2-013.** Résoudre un pourcentage n'a jamais eu besoin
des *scores*, seulement des *records*. Les charges en % se décrochent donc de
toute la chaîne saisie → détection → leaderboard, et peuvent sortir bien plus tôt.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `personal_records`, `movements`, `movements.measured_by` | P2-009 | ❌ **à créer par P2-009** |
| **`personal_records.source_score_id` nullable** | P2-009 | ❌ **à créer par P2-009**, et à demander explicitement : un record saisi à la main n'a pas de score d'origine. Sans cette nullabilité, ce ticket n'existe pas |
| **`personal_records.source`** (`SCORE` \| `MANUAL`) | P2-009 | ❌ **à créer par P2-009** — voir « Périmètre », c'est ce qui protège P2-014 |
| Le pas d'arrondi de plaque (2,5 kg par défaut, §9.1 point 4) | nulle part | ❌ **livré ici**, appelé par P2-011 |
| Un sélecteur de mouvement (recherche dans le référentiel FR/EN) | nulle part | ❌ **livré ici**, réutilisé par P2-010 |
| Une entrée de navigation dans l'app mobile | `apps/mobile/app/(app)/` | ⚠️ **la navigation existe** (D-009), l'entrée non |
| i18n, tokens de thème | `packages/core/src/i18n`, `packages/ui` | ✅ existent |
| L'écran WOD du jour, d'où ouvrir le calculateur | P2-012 | ❌ **à créer par P2-012** — non bloquant : le calculateur s'ouvre aussi depuis la fiche du mouvement |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `upsert_personal_record()` — saisie directe, transactionnelle | l'écran « Mes records » | celui-ci |
| `personal_records` **non vides dès le premier jour** | la résolution des charges en % de 1RM | **P2-011** |
| `round_to_plate(kg, step)` | l'affichage des charges d'un bloc | **P2-011**, **P2-012** |
| Le sélecteur de mouvement | l'éditeur de bloc du Program Builder | **P2-010** |

## Périmètre

- **Écran « Mes records »** : une ligne par mouvement travaillé, la meilleure
  valeur et sa date, triée par récence.
- **Ajouter un record** : mouvement, valeur, unité **imposée par
  `measured_by`**, date (aujourd'hui par défaut, antériorité autorisée), note
  courte. Jamais de champ libre — un record en texte ne se compare pas.
- **Historique par mouvement** : la suite des valeurs datées et l'écart au
  précédent. Une courbe si elle est gratuite ; **la liste est le livrable**.
- **Le calculateur** : depuis un record, la table de 50 à 100 % par pas de 5,
  arrondie au pas de plaque, plus un pourcentage saisi librement. Il s'ouvre
  **une barre à la main** : gros chiffres (§12.1 principe 5), aucune ligne à
  aller chercher en défilant, deux taps depuis le WOD du jour comme depuis la
  fiche du mouvement.
- **`source` (`SCORE` \| `MANUAL`)** : d'où vient ce record. Un record déclaré ne
  doit pas pouvoir se faire passer pour un record établi en séance — c'est ce
  qui protège le leaderboard de P2-014, et ça ne coûte rien tant que la colonne
  existe dès P2-009.
- **Correction et suppression d'un record saisi à la main.** Un record issu d'un
  score ne s'édite pas ici : il se corrige dans le score (P2-013).

## Hors périmètre

- La saisie du score d'une séance, et la détection automatique du record à
  l'enregistrement → **P2-013**.
- **L'estimation d'un 1RM à partir d'un 5RM** (Epley, Brzycki). Très demandé,
  jamais neutre — une estimation affichée comme un record fausse ensuite toutes
  les charges. À arbitrer avec la box pilote ; **nouveau ticket le jour où elle
  le demande**, pas une case en plus dans ce formulaire.
- Les records par **station Hyrox** → S1, v1 (§9.2 point 7).
- Le partage d'un record : aucune fonction sociale avant P2-014.

## Critères d'acceptation

- [ ] J'ajoute « Deadlift 120 kg », daté d'aujourd'hui, et il apparaît dans la
      liste sans recharger l'app
- [ ] J'ajoute ensuite 115 kg sur le même mouvement : l'historique le garde, et
      la ligne du mouvement continue d'afficher **120 kg**
- [ ] Sur un mouvement mesuré en temps, le **plus petit** gagne (RM5.5) —
      **test écrit avant le code** : la comparaison unique et fausse est le bug
      classique de cette fonctionnalité
- [ ] Le calculateur affiche **90 kg** pour 75 % de 120 kg, et l'arrondi au pas
      de 2,5 kg est appliqué au plus proche, documenté dans le test
- [ ] Sans aucun record, l'écran ne montre pas une liste vide muette mais
      l'action d'en créer un (§12.1 principe 7)
- [ ] Un record saisi à la main porte `source = MANUAL` en base ; un record issu
      d'un score porte `SCORE` et n'est pas éditable depuis cet écran
- [ ] La RLS interdit de lire les records d'une autre personne, y compris à un
      coach de la box (le prédicat staff de P2-013 ne couvre que les records
      **issus d'une séance de sa box**)
- [ ] Zéro chaîne en dur, zéro couleur en dur (règles 7 et 8 de `CLAUDE.md`)
- [ ] **Passe manuelle sur iPhone** : ajouter un record, ouvrir le calculateur,
      lire la ligne cherchée à bout de bras sans zoomer
- [~] Le calculateur atteignable « en deux taps depuis le WOD du jour » — attend
      **P2-012**, cet écran n'existe pas encore. Exerçable en attendant depuis la
      fiche du mouvement, ce qui couvre le reste du critère

## Notes

- **Pourquoi ce ticket peut passer très tôt.** Il ne dépend que de P2-009 : ni
  du Program Builder, ni du WOD du jour, ni des scores. C'est le premier usage
  que le modèle d'entraînement rend possible, et le moins cher.
- **D'où vient la demande.** C'est le module que le coach de la box pilote
  utilise le plus dans HustleUp : un record ajouté à chaque test, et un
  calculateur de pourcentage consulté pendant la séance. Une demande d'usage,
  pas une fonctionnalité recopiée.
- Le pas de plaque est un réglage de **box** (tous les gymnases n'ont pas des
  disques de 1,25 kg), pas une constante. La colonne va dans `tenant_settings`,
  au même endroit que la fenêtre de saisie de P2-013.
