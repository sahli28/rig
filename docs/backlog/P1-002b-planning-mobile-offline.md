# P1-002b — Planning mobile et cache hors ligne

**Phase** P1 · **Estimation** 3,5 j·h · **Dépend de** P1-002 ✅, D-004 ✅, **D-009** · **Spec** §4-P2, §6.1

## Objectif

Un membre ouvre l'app et voit **le planning de sa box**, filtré par type ou par
coach. Sans réseau, il retrouve la dernière version connue, datée et annoncée
comme telle.

## Ce que ce ticket suppose et qui doit exister

Vérifié dans le dépôt le 4 septembre 2026.

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `classes` matérialisées, lisibles par un simple membre | P1-002 — policy `classes_select` sur `current_tenant_ids()` | ✅ existe. `pg_cron` entretient l'horizon (`rig-maintain-class-occurrences`, 00 h 05) : le planning ne s'arrête pas parce que personne n'a touché le back-office |
| Types de cours, salles, coachs | P1-001b, P1-001c | ✅ existent, avec `name_i18n` et une couleur par type |
| L'app mobile ayant tourné sur un appareil | passes des 3 et 4 septembre 2026 | ✅ — et **ça se périme**. `docs/passe-mobile-iphone.md` |
| La langue de l'app | D-004 | ✅ livrée, vérifiée sur appareil le 4 septembre |
| `me()` — identité, appartenances, fuseau et thème de la box | P0-005a | ✅ existe. Nécessaire pour partitionner le cache **et** pour afficher les heures en heure locale de la box (règle 9) |
| Helpers de semaine et de date : `weekDates`, `mondayOf`, `shiftWeeks`, `isCalendarDate` | `@rig/core/supabase/class-schedules.ts` | ✅ existent, testés (61 tests) |
| `groupByDay()`, `localDayIn()` — ranger des occurrences dans les jours **du fuseau de la box** | `apps/web/app/box/[slug]/planning/view-model.ts` | ⚠️ **existent, au mauvais endroit.** Fonctions pures, enfermées dans un dossier d'app web. Voir la contrainte 3 |
| Composants natifs : liste, filtres, état vide, squelette | `@rig/ui/native` — `ListRow`, `SegmentedControl`, `EmptyState`, `Skeleton`, `Badge`, `Banner` | ✅ existent |
| **Stockage persistant React Native** | `apps/mobile` | ❌ à ajouter : `@react-native-async-storage/async-storage`, dépendance à justifier au commit. **Vérifié le 3 septembre 2026 : incluse dans Expo Go (SDK 57)** — aucun development build, donc aucun compte Apple payant. Installer avec `npx expo install`, qui pose la version du binaire (`2.2.0`) |
| **Une pile de navigation dont les retours ne mènent nulle part d'interdit** | **D-009** | ✅ fait et fusionné (PR #23). L'écran déclare son en-tête et son titre traduit, comme la convention l'exige |
| **Une source du nom du coach, lisible par un membre** | **P1-010** | ✅ livrée depuis — `tenant_coaches`. Elle **n'existait pas** quand ce ticket a été écrit, et il l'avait supposée. `users` est en `id = auth.uid()`, `memberships` ne porte aucun nom, et `member_admin_directory` est réservée à OWNER/MANAGER — elle porte les e-mails. Le planning est donc livré **sans la dimension coach** ; P1-010 la rend possible |
| **Des séries et des cours dans le seed** | `supabase/seed.sql` | ❌ **il n'y en avait aucun.** Ajoutés par ce ticket : sans données, un planning en lecture seule ne peut afficher que son état vide, et aucune passe ne prouve rien |
| Le sélecteur de box | P1-009 | ❌ à créer par P1-009 — qui devra **vider ce cache** en changeant de box. La contrainte est inscrite des deux côtés |
| Réserver depuis le planning | P1-003b | ❌ hors périmètre, et **volontairement absent de l'écran hors ligne** — voir la contrainte 2 |
| Places restantes en temps réel | P1-005 | ❌ à créer par P1-005 |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| Écran Planning mobile | le membre | celui-ci |
| Le cache partitionné, et son effacement | l'écran Planning ; **P1-009** l'effacera aussi au changement de box | celui-ci, P1-009 |
| Le modèle de vue du planning, descendu dans `@rig/core` | la grille web **et** la liste mobile | celui-ci |
| L'entrée vers le détail d'un cours | l'écran de réservation | **P1-003b** |

## Contrainte 1 — ce que le cache a le droit de contenir

**Le cache est une copie de données de box posée hors RLS.** Une fois écrite sur
l'appareil, plus aucune policy ne la protège : elle survit à la déconnexion si
personne ne l'efface, elle part dans une sauvegarde, elle appartient au téléphone
et non plus à la base. La minimisation de `.claude/rules/privacy.md` — qui vaut
**aussi à l'intérieur d'une box** — s'applique donc plus strictement ici qu'à une
requête.

**Mis en cache**, parce que l'écran les affiche et qu'ils ne désignent personne :

| Donnée | Pourquoi c'est acceptable |
| --- | --- |
| `classes` : identifiant, début, fin, capacité, `booked_count`, statut | Ce sont les créneaux de la box, affichés à tous ses membres |
| Nom du type de cours et sa couleur | Référentiel de la box |
| Nom de la salle | Idem |
| **Prénom** du coach, et son identifiant d'appartenance | Il figure sur le planning mural. Seule donnée nominative du lot, et déjà publique dans la salle |

**Jamais mis en cache**, et cette liste compte autant que la précédente :

- **aucune adresse e-mail**, ni celle du coach ni celle de personne ;
- **aucune feuille d'inscrits**, donc aucun nom de participant. La vue des pairs
  n'est pas tranchée (P1-003c) : la mettre en cache la trancherait par défaut,
  et dans le sens le plus large ;
- **aucune note de coach, aucune donnée de santé** (règle 11) ;
- **aucun jeton** — ni d'invitation, ni de session. La session a son stockage,
  le trousseau, et elle y reste ;
- **aucune réservation personnelle.** « Qui s'entraîne quand » est exactement ce
  que la spec protège. Le planning est le même pour tous les membres de la box ;
  le cache doit l'être aussi.

Cette dernière ligne a une conséquence à accepter : **le cache ne sait pas si
vous êtes inscrit.** Hors ligne, l'écran montre le planning de la box, pas le
vôtre. C'est moins riche, et c'est le bon compromis.

**Clé de cache** : `(user_id, tenant_id)`. Une clé par tenant seul ferait voir à
deux membres d'un téléphone partagé les données l'un de l'autre. Effacée à la
déconnexion **et** au changement de box (P1-009).

## Contrainte 2 — le cache ne fait jamais autorité sur une place

Hors ligne, l'écran montre le planning **et dit qu'il est hors ligne, avec la
date de la dernière mise à jour**. L'action de réservation est **indisponible** —
pas seulement optimiste, pas seulement grisée en silence.

Afficher « 3 places » depuis un cache de la veille et laisser toucher
« Réserver » produirait exactement le mensonge que P1-003 a passé un lot entier
à rendre impossible côté base : verrou de ligne, `check (booked_count between 0
and capacity)`, index unique partiel, et une preuve de contention sous
59 sessions simultanées. Tout ça pour qu'un compteur périmé sur un téléphone le
contredise à l'écran.

Le compteur en cache n'est pas faux, il est **daté** — et un nombre de places
daté n'est pas un nombre de places. La différence se voit à l'écran, ou elle
n'existe pas.

C'est un **critère d'acceptation**, pas une intention.

## Contrainte 3 — ne pas dupliquer le modèle de vue

`groupByDay()` et `localDayIn()` sont des fonctions pures, aujourd'hui dans
`apps/web/app/box/[slug]/planning/view-model.ts`. Elles portent la seule règle
non triviale de l'écran : dans quel jour tombe une occurrence, **selon le fuseau
de la box**. Un cours à 00 h 30 heure de Paris, lu depuis Londres, tombe la
veille.

Les recopier dans `apps/mobile` donnerait deux calculs de semaine libres de
diverger, et la divergence serait silencieuse : les deux écrans afficheraient
quelque chose de plausible. C'est `isCalendarDate` en plus gros — une règle de
date dupliquée qui ne se corrige que d'un côté.

**Ce qui descend dans `@rig/core`** : `groupByDay`, `localDayIn`, `localDay`,
`instantLocal`, et les types `Occurrence` / `Serie`. Aucune de ces fonctions ne
touche React ni une plateforme, et elles ont déjà leurs tests.

**Ce qui reste dans chaque app** : la présentation seule. Le web garde sa grille
de sept colonnes — souris, écran large, édition d'une série ; le mobile aura une
liste par jour — pouce, écran étroit, lecture seule. Ce ne sont pas les mêmes
écrans, et il ne faut pas essayer d'en faire un.

Le déplacement se fait **dans ce ticket**, avec le web réaligné dessus. Sinon il
ne se fera jamais.

## Périmètre

- Écran Planning : le jour, navigation d'un jour à l'autre, filtre **type**,
  heures en heure locale de la box. **Le filtre coach part avec P1-010**, faute
  de source lisible par un membre — voir la section ci-dessous.
- Cache de la dernière réponse réussie, avec sa date de mise à jour visible.
- Réseau prioritaire ; repli sur le cache **seulement** en cas d'échec réseau,
  jamais pour économiser une requête.
- Effacement du cache à la déconnexion.
- Le modèle de vue descendu dans `@rig/core`, web réaligné.

## Hors périmètre

- **Écriture hors ligne, réservation différée** : P1-003 l'interdit par
  construction — une réservation est une transaction PostgreSQL ou n'est pas.
- **Check-in hors ligne** : P1-008.
- **La grille de semaine** : le mobile affiche un jour. La semaine est un écran
  de conception, elle appartient au back-office.
- **Le sélecteur de box** : P1-009.
- **La correction de la navigation** : D-009, faite avant.
- **Le nom et le filtre du coach** : P1-010, écrit pendant ce ticket.

## Ce que P1-009 trouvera en arrivant

**La place lui est laissée, pas construite.** L'écran déclare son en-tête et son
titre traduit (convention D-009) ; `headerRight` est **libre**, et c'est là que
le sélecteur de box se posera. Rien n'y est réservé — un emplacement vide serait
du code mort — mais rien ne l'occupe, et le commentaire de l'écran le dit.

Ce que P1-009 devra faire en plus, et qui est inscrit des deux côtés :
**`clearScheduleCache()` au changement de box**. Le cache est partitionné par
`(utilisateur, box, jour)`, donc changer de box ne montrerait jamais les données
de l'autre — mais laisser traîner une copie hors RLS d'une box qu'on vient de
quitter n'a aucune raison d'être. La fonction existe et est déjà appelée à la
déconnexion.

## Critères d'acceptation

- [x] Un membre voit la journée et filtre par type **et par coach** — le filtre
      coach est arrivé avec P1-010, comme prévu
- [ ] Les heures s'affichent dans le fuseau de la **box**, pas du téléphone —
      **à vérifier sur appareil** en changeant le fuseau du téléphone. Le calcul
      est testé (12 tests sur `localDay` / `instantLocal`), son effet à l'écran
      ne l'est pas
- [x] Sans réseau, le dernier planning chargé est consultable, **avec sa date de
      mise à jour affichée** — « Hors ligne. Planning enregistré aujourd'hui à
      11:04. Les places affichées peuvent avoir changé… », relevé sur le harnais
      en coupant `fetch`
- [x] Sans version enregistrée non plus, l'écran **dit qu'il n'a rien pu
      charger** au lieu d'affirmer qu'il n'y a pas cours. Critère ajouté en
      cours de route : le premier jet titrait « Aucun cours ce jour-là » sur un
      chargement échoué, et seul le corps du message disait la vérité
- [ ] Sans réseau, **aucune action de réservation n'est proposée** — structurel
      aujourd'hui, puisque la réservation n'existe pas encore. **C'est P1-003b
      qui devra l'honorer**, et son ticket le porte
- [ ] Le contenu du cache est relu à la main après une session : aucune adresse
      e-mail, aucun nom de participant, aucun jeton. La **forme** l'interdit
      déjà (`DayClass` dans `@rig/core`), la relecture le confirme sur appareil
- [ ] Deux membres et deux boxes sur le même téléphone ne partagent jamais leur
      cache — la clé est `(utilisateur, box, jour)` ; **à exercer avec deux
      comptes sur un appareil**
- [x] **Le mode hors ligne dit ce qu'il montre** — le bandeau parle du **jour
      affiché**, jamais de la dernière écriture du cache. La passe iPhone du **4 septembre 2026** l'a trouvé
      faux : « Planning enregistré aujourd'hui à 15:44 » s'affichait au-dessus de
      trois squelettes vides, sur un jour jamais chargé. Le bandeau raisonnait
      sur l'app, la liste sur le jour
- [x] **Hors ligne sur un jour sans cache, le message final apparaît en moins de
      six secondes, et c'est le même à chaque fois** — le critère qui interdit le
      non-déterminisme.

      **Pourquoi six.** La lecture est bornée à **cinq secondes**
      (`DAY_SCHEDULE_TIMEOUT_MS`), plus une seconde de marge de rendu. Cinq
      parce que le p95 visé pour une écriture de réservation est de 800 ms
      (P1-003) et qu'une lecture de journée est plus légère : cinq secondes
      valent plus de six fois la pire latence acceptable, donc ce délai **ne peut
      pas couper une requête qui allait aboutir**. Et il reste sous les dix
      secondes à partir desquelles on tue une app plutôt que de l'attendre.

      Six secondes est le **pire cas** : réseau qui se déclare connecté et ne
      répond jamais — le sous-sol de box, pas le mode avion. Quand l'app **sait**
      qu'elle est hors ligne (`expo-network`), elle ne part pas en requête du
      tout et le message tombe en moins d'une seconde, le temps d'une lecture
      d'`AsyncStorage`.

      Vérifié par `day-schedule-timeout.test.ts`, qui borne des **deux** côtés :
      pas avant le délai — sinon le test passerait aussi sur un échec instantané
      — et pas longtemps après. Trois exécutions du même geste, écart mesuré
- [x] **Pas de squelette quand l'app sait qu'elle n'a pas de réseau** — un
      squelette est une promesse d'arrivée, et là rien n'arrivera du réseau
- [x] Une déconnexion supprime les caches du compte local — `clearScheduleCache()`
      appelée dans `signOut()`, à côté de l'effacement de la langue
- [x] `groupByDay` et ses voisines n'existent qu'à **un** endroit —
      `view-model.ts` a disparu, le web importe `@rig/core/supabase`, et
      `next build` est vert
- [x] Un appareil réel exerce le parcours — passe iPhone du **4 septembre 2026**. Le planning se rend, les
      deux filtres fonctionnent, VoiceOver annonce les lignes correctement, et le
      balayage de retour est correct y compris après connexion
- [ ] **Le hors ligne repasse sur appareil** — les deux correctifs ci-dessus
      n'ont été exercés qu'au harnais et en test. Le mode avion sur un jour
      jamais visité est le geste à refaire

## Ce que la passe du 4 septembre a corrigé

Deux défauts, une seule cause de fond : **l'écran tenait trois états qu'aucune
règle ne synchronisait** — `schedule`, `origin` et `loading` pouvaient décrire
trois jours différents.

1. **Le chemin vers l'état final était indéterminé.** Aucun délai d'expiration,
   aucune connaissance du réseau : l'app attendait que le système abandonne, et
   ce délai n'est pas le même deux fois. L'état final était correct ; c'est
   l'attente qui variait. Corrigé par `expo-network` — l'app **sait** qu'elle
   est hors ligne au lieu de le déduire d'un échec — et par un délai explicite de
   cinq secondes sur la requête, parce que « pas de réseau » et « réseau qui ne
   répond pas » sont deux choses différentes ;
2. **le bandeau et la liste parlaient de deux jours différents.** `VueJour` porte
   désormais son `jour`, et tout état qui ne décrit pas le jour demandé est
   ignoré par construction. C'est le même défaut que le titre « Aucun cours ce
   jour-là » déjà corrigé dans ce lot, pris par l'autre bout.

**`expo-network` est incluse dans Expo Go** (SDK 57, vérifié sur la doc avant de
s'appuyer dessus, comme `expo-crypto` et `expo-localization`) : aucun
development build, donc aucun compte Apple payant.

## Notes

**Le cache est un confort, la base est la source de vérité.** Chaque fois que
les deux se contredisent, c'est la base qui a raison et l'écran qui doit le dire.

Le mode avion était noté en bonus de la passe du 3 septembre, pour observer la
dégradation avant de la corriger : c'est ce ticket qui la corrige.

**Ce que ce ticket ne saura pas faire, et qu'il faut dire à la box pilote** :
hors ligne, le planning affiché est celui de la dernière connexion. Un cours
annulé le matin restera visible sur un téléphone resté en mode avion. La date de
mise à jour est là pour ça — c'est le prix d'un cache honnête.
