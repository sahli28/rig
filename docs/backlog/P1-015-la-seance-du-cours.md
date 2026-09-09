# `P1-015` — La séance du cours, écrite par le coach

**Phase** `P1` · **Estimation** `5` j·h · **Dépend de** `P1-002` ✅, `P1-001b` ✅, `P1-003b` ✅ · **Spec** §2.3 (différenciateur n°1), §10 · **Origine** retour de la box pilote, 8 septembre 2026

## Objectif

Le coach écrit sa semaine dans Rack et ferme Hustle Up.

## Pourquoi ce ticket existe, et pourquoi maintenant

**C'est la première fois qu'un ticket vient d'un client réel.** Le coach de la
box pilote a adopté l'application et demande précisément le différenciateur
n°1 de la spec : la programmation. S'il ne l'a pas, il garde Hustle Up — et le
pilote mesure alors **une box qui ouvre deux applications**, ce qui ne prouve
rien.

Le risque `R4` dit que le propriétaire achète mais que les coachs n'adoptent pas.
Celui-là a adopté. Il demande ce que le risque prédisait qu'il ne demanderait
pas.

## Ce qu'il écrit, exactement — et ce qu'il n'écrit pas

Question posée, réponse rapportée le 8 septembre 2026 :

- **du texte, structuré par lui** : échauffement, force, metcon, avec les charges
  et les variantes Rx/Scaled écrites **dans son texte** ;
- il **tape**. Il ne choisit pas dans une bibliothèque de mouvements, ne remplit
  pas de formulaire, et ne demande pas que l'app calcule 80 % de son 1RM ;
- les membres ne notent pas leur score aujourd'hui. Ça l'intéresserait.

> ### ⛔ Le piège, et il est gros
>
> La tentation sera de **modéliser proprement** ces blocs — une table `blocks`,
> des formats, des mouvements, des variantes — parce que `P2-009` en aura besoin.
> Ce serait construire le Program Builder déguisé, **pour un coach qui tape du
> texte**.
>
> **Ici la structure est de l'affichage, pas de la donnée.** Le produit stocke et
> affiche ; il ne modélise ni blocs, ni formats, ni mouvements, ni variantes.
> `P2-010` prévoit déjà « l'import depuis un collage de texte » : c'est **lui**
> qui absorbera ces séances, pas l'inverse.

## L'unité : l'occurrence, et rien d'autre

Une journée porte plusieurs séances différentes, **une par cours**. Lundi : WOD
Gym à 9 h, Haltéro ensuite, WOD Gym encore après.

Ses habitudes, rapportées : s'il y a un Haltéro dans la journée il ne retape pas
le même WOD deux fois ; les occurrences d'un même cours le même jour portent la
même séance ; un WOD endurance du lundi n'est pas forcément celui du jeudi.

**Mais il garde la main** : il peut alléger le nombre de reps du cours du soir
après avoir changé d'avis.

> **Un rattachement au couple (date, type de cours) est donc à écarter**, et
> c'est le point à ne pas rater : il interdirait exactement ce geste — alléger le
> cours du soir modifierait aussi celui du matin.
>
> **La séance se rattache à chaque occurrence** (`classes.id`).

## Ce que ce ticket suppose et qui doit exister

*Chaque état est vérifié dans le dépôt.*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| `classes`, les occurrences matérialisées | `20260902120000_recurrent_class_schedules.sql:157` | ✅ l'unité de rattachement existe |
| Une grille web **par occurrence**, avec des actions par occurrence | `apps/web/app/box/[slug]/planning/week-grid.tsx:71`, `actions.ts:204` (`cancelClass`) | ✅ **aucun écran à créer** : une affordance de plus sur une cellule qui en porte déjà |
| La fiche de cours côté membre | `apps/mobile/app/(app)/class/[id].tsx`, alimentée par `fetchClassDetail` (`bookings.ts:309`) | ✅ **une fonction à étendre**, pas un écran à construire |
| Les types de cours, pour le titre par défaut | `class_types`, P1-001b | ✅ |
| Server Actions, Zod, la convention d'écriture du back-office | `.claude/rules/ui.md` | ✅ |
| **La table de la séance** | *rien* | ❌ **à créer ici** |
| **La protection de la séance contre le rafraîchissement de série** | *rien* | ❌ **à créer ici — voir ci-dessous, c'est la trouvaille de cette section** |

### ⚠️ La séance serait effacée en silence par une modification de série

`refresh_class_schedule()` **archive** les occurrences d'une série avant de les
rematérialiser (`20260902120000:343`) :

```sql
update public.classes c set deleted_at = now()
...
  and c.is_override = false
  and c.booked_count = 0
```

Deux protections existent : une occurrence **réservée** survit, une occurrence
**dérogatoire** aussi. **Une occurrence qui porte une séance n'est ni l'une ni
l'autre.** Le coach écrit son WOD du jeudi, le gérant corrige l'horaire de la
série, et le texte disparaît — sans erreur, sans trace, et il ne s'en apercevra
qu'en salle.

**Le correctif appartient à ce ticket** : une migration remplace
`refresh_class_schedule()` pour qu'elle n'archive pas une occurrence portant une
séance. **Troisième protection, même forme que les deux autres**, et c'est la
seule qui ne se voit pas quand on lit la fonction aujourd'hui.

*(Pas de `is_override = true` détourné pour ça : ce drapeau veut dire « cette
occurrence dévie de sa série », et une séance écrite ne fait pas dévier l'heure
ni la capacité. Confondre les deux ferait qu'un cours cesserait de suivre les
corrections d'horaire de sa série dès qu'on lui écrit un WOD.)*

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --- | --- | --- |
| La séance et son texte | la fiche de cours du membre | celui-ci |
| Le pré-remplissage | l'écran de saisie du back-office | celui-ci |
| Une séance à laquelle un score pourra s'attacher | la saisie de score | `P2-013` — **rien à faire ici, sauf ne pas l'interdire** |
| Le texte d'une séance, comme source d'import | `P2-010`, « import depuis un collage de texte » | `P2-010` |

## Périmètre

- **Une séance par occurrence** : un titre facultatif — le nom du type de cours
  sert de défaut — et un corps en **texte libre**, structuré par le coach.
- **Le pré-remplissage** : reprendre la séance d'un autre cours **de la même
  journée**, ou du **même type de cours la semaine précédente**, puis modifier.
- **La publication** : une séance non publiée reste invisible du membre.
- **L'affichage côté membre** sur la fiche de cours.
- La migration qui protège la séance du rafraîchissement de série.
- pgTAP, i18n FR + EN dans le même commit.

> ### Le pré-remplissage **copie**, il ne **lie** pas
>
> Deux occurrences pré-remplies depuis la même source restent **indépendantes**
> ensuite. C'est toute la différence entre le geste du soir — alléger un cours —
> et une contrainte qu'il subirait.
>
> Écrit ici parce que c'est la décision qu'on prendrait à l'envers en cherchant à
> « éviter la duplication » : la duplication **est** la fonctionnalité.

## Hors périmètre

- **Les scores.** `P2-013`. Le modèle ne doit pas les interdire — une séance
  identifiée à laquelle une ligne pourra se rattacher — mais rien ne se construit
  ici pour eux.
- **Toute modélisation de blocs, formats, mouvements, variantes.** `P2-009`.
- **Une vue semaine de saisie.** Voir le repère ci-dessous : elle deviendra un
  ticket **si la mesure le justifie**, pas avant.
- La publication planifiée (« publier à telle heure ») : `P2-010`.

## Le repère, et c'est le seul qui compte

**La saisie de sa semaine doit être plus rapide que dans Hustle Up.**

S'il perd, il garde Hustle Up et on aura livré la fonctionnalité **sans gagner
l'usage** — ce qui est le résultat le plus coûteux possible, parce qu'il coûte le
développement *et* laisse le risque `R4` intact.

Si la saisie d'une semaine complète se révèle pénible malgré le pré-remplissage,
une vue semaine deviendra un ticket — **avec la mesure qui le justifie**.

## Critères d'acceptation

- [x] Une séance écrite sur une occurrence n'apparaît **que** sur cette
      occurrence — pgTAP **avec témoin** : une voisine du même type et de la même
      série, sur laquelle rien n'apparaît. Sans elle, le fichier affirmait au
      lieu de prouver
- [x] Pré-remplir depuis un autre cours, puis modifier, **ne modifie pas la
      source** — le pré-remplissage pose du texte dans un état local, jamais une
      référence. Six tests unitaires sur la sélection des sources
- [x] Une séance non publiée est invisible du membre ; publiée, elle s'affiche
      sur la fiche de cours — pgTAP des deux côtés, et la policy retient le
      brouillon : l'écran n'a rien à filtrer, donc rien à oublier
- [x] **Modifier la série ne détruit pas les séances écrites** — pgTAP, et
      **prouvé dans les deux sens** : la protection retirée, le test rougit.
      Son premier décor était un faux vert, la cible étant protégée par sa date
      et non par la séance. **Et sa sœur est couverte** : supprimer la série
      emporte l'occurrence, sans quoi elle serait restée réservable sans série
- [x] Un membre d'une autre box ne lit aucune séance — **une séance de chaque
      côté**, donc le silence d'en face n'est pas de la cécité. Plus un cas dans
      `role_isolation_test.sql` : un `UPDATE` refusé par policy **ne lève pas**,
      seule la valeur inchangée le prouve
- [x] Le texte s'affiche tel qu'il a été tapé : sauts de ligne conservés, aucune
      interprétation. Aller-retour d'un `chr(10)` prouvé en base ; `<Text>` nu
      côté mobile, aucun Markdown dans le dépôt. **Le `trim()` ne touche que les
      bords** — les lignes vides internes portent la mise en forme du coach
- [x] Parité i18n (471 clés, aucune orpheline). Côté web, `Feedback` et
      `SubmitButton` sont désormais employés : sans eux, ni l'enregistrement ni
      l'échec n'étaient annoncés, et la double soumission était ouverte
- [x] **appareil** — la séance se lit sur la fiche de cours, en clair comme en
      sombre, à 200 % de taille de texte. **Passe du 9 septembre 2026**, § 5
      septies, gestes 1 à 6 : le pré-remplissage trouve sa source, la
      publication annonce qu'elle ne notifie personne, l'état passe bien à
      « Publiée — visible des membres », la séance se lit sur l'iPhone
- [ ] **les deux gestes qui protègent le travail du dimanche soir** — vider le
      champ, et n'y laisser qu'une espace : la confirmation apparaît, et rien
      n'est supprimé sans elle (gestes 7 et 8). **Résultat non consigné.** Ce
      critère a été coché « les huit gestes passent » le 9 septembre sur un
      compte rendu qui ne nommait que les gestes 1 à 6 — décoché le même jour,
      c'est un faux vert qui a duré un après-midi. Il se coche avec le résultat
      écrit, pas avec « l'essentiel passe »
- [x] **le droit du coach est exercé** — écrire une séance en `COACH`, et non en
      administration. **Impossible le matin du 9 septembre 2026** : la porte du
      back-office (`layout.tsx:56`) refusait tout ce qui n'était ni OWNER ni
      MANAGER, et ce ticket ne l'avait pas touchée — droit ouvert à trois
      niveaux sur quatre, tous les tests verts. **Fermé le soir même par
      `D-021`, passe web A14** : Sarah entre, écrit sa séance, et la restriction
      se voit à trois endroits sans la chercher. **Provenance à connaître** : la
      passe a été jouée sur l'arbre de travail de la branche de `D-021`, **avant
      que son code soit sur `main`** — PR #68 n'a fusionné que la documentation,
      le code est parti dans la PR suivante, à l'octet près ce qui a été joué

## Estimation

| Lot | j·h |
| --- | ---: |
| Table de la séance, RLS, policies, grants, index | 0,75 |
| `refresh_class_schedule()` remplacée : la troisième protection | 0,25 |
| pgTAP, dont le test de destruction par rafraîchissement de série | 0,75 |
| Lecture, écriture, sources de pré-remplissage dans `packages/core` | 0,75 |
| Back-office : affordance sur l'occurrence, formulaire, Server Action, pré-remplissage | 1,5 |
| Affichage sur la fiche de cours du membre | 0,5 |
| i18n, accessibilité, passe appareil | 0,5 |

**5 j·h.** Ce qui aurait pu coûter plus et ne coûtera pas : la grille web affiche
déjà les occurrences et porte des actions par occurrence, et la fiche de cours
existe — il n'y a **aucun écran à créer**, seulement une affordance et une
fonction à étendre.

## Ce que la passe du 9 septembre 2026 a laissé ouvert

**Fusionné (PR #63) n'est pas clos.** Deux constats sont sortis de la passe, tous
deux partis dans `D-021` — un lot court de 1,75 j·h qui touche le même écran et
le même utilisateur :

1. **la porte du back-office**, ci-dessus : le coach n'atteint pas l'écran que ce
   ticket lui a construit. C'est le critère resté `[ ]` ;
2. **la place du formulaire** : la séance est logée **sous** le panneau
   d'annulation du cours, donc le geste quotidien traverse un champ « Motif » et
   un bouton « Annuler ce cours » en variante primaire. Deux zones de texte se
   suivent sans séparation, et deux actions primaires cohabitent — contre le
   principe 2 du §12.1. **Trouvé en jouant, pas en lisant** : c'est le repère de
   ce ticket qui en pâtit, pas sa correction.

Aucun des deux n'était visible en test, et le second ne le sera jamais. Le
premier le deviendra : `D-021` porte **le contrôle qui manquait** — un test qui
exerce la porte du back-office par rôle.

## Notes

**Ce ticket est un test du risque `R4` autant qu'une fonctionnalité.** Un coach
qui écrit sa semaine dans Rack est un coach qui a remplacé son outil. C'est la
seule preuve d'adoption qui vaille, et elle ne s'obtient pas en demandant.
