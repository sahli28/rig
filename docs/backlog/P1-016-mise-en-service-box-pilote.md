# `P1-016` — La mise en service chez la box pilote

**Phase** `P1` · **Estimation** `1,75` j·h de technique, **dans ①** *(3 → 1,75 : deux lots partis dans `P1-017`)* + `4` jours d'accompagnement, **qui ne sont pas des j·h** · **Dépend de** tout le reste de ①, et `P1-017` **joué tôt** · **Spec** §15.1, §18.3, §18.4 · **Origine** l'écart de date, 9 septembre 2026

## Objectif

Un lundi matin, dans une vraie box, un vrai membre ouvre l'app et réserve un
vrai cours — et personne de l'équipe produit n'est en train de taper une
commande.

## Pourquoi ce ticket existe : il était déjà dans la date, pas dans le backlog

Le 9 septembre 2026, quelqu'un a fait le calcul : **19,5 j·h restants ÷ 2,3 j·h
par semaine ≈ 8,5 semaines**, donc début novembre 2026 — contre « janvier 2027 »
annoncé en tête du backlog. Deux mois d'écart.

**Ce n'est pas le calcul qui est faux, et ce n'est pas la date.** Le jalon ne dit
pas « le code est fini », il dit **« mise en production chez la box pilote »**.
L'écart entre les deux, c'est ce ticket — et il n'existait nulle part.

C'est la forme la plus coûteuse d'un travail manquant : **pas un ticket
sous-estimé, un ticket absent**, qui ne se découvre qu'au moment où on croyait
avoir fini. La règle 8 le dit pour un ticket ; ici elle s'applique au jalon.

## Ce que ce ticket suppose et qui doit exister

*Chaque état est vérifié dans le dépôt, le 9 septembre 2026.*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| **Un projet Supabase hébergé**, major 17 vérifié | *rien* — tout tourne en local (`supabase/config.toml`) | ❌ **→ `P1-017`**, joué pendant `P1-008a` et non la semaine de la box. C'est là que vit désormais la case à cocher du major |
| **Un hébergement pour `apps/web`** | *rien* — aucun `vercel.json`, aucun workflow de déploiement (`.github/workflows/` n'a que `ci.yml`) | ❌ **→ `P1-017`** |
| **Un envoi d'e-mails qui tient 80 invitations** | *rien* — en local, Mailpit reçoit tout | ❌ **→ `P1-017`, qui l'a trouvé** : le SMTP intégré d'un projet hébergé est limité à quelques envois par heure. Il faut un SMTP tiers, donc **le domaine** — la démarche du chemin critique qui attendait P2-015 attend désormais aussi ce ticket |
| **L'app sur les téléphones des membres** | Expo Go aujourd'hui, sur le réseau local | ❌ **à créer** : un *development build* iOS puis TestFlight. **Le compte Apple est actif depuis le 8 sept. 2026** ✅, donc rien ne bloque administrativement. Et ce build **ferme des critères de quatre tickets** — `P1-003b`, `D-013`, `P1-007` (le push iOS), `D-008` — voir le README |
| **Le canal push Android** (projet Firebase + `google-services.json` + un appareil de test) | *rien* — le code de `P1-007` est plateforme-agnostique (Expo Push route vers FCM), mais rien ne l'exerce côté Android | ❌ **prérequis re-daté ici depuis `P1-007`** : la preuve « push Android < 30 s » supposait un appareil Android qui n'existe pas (règle 10). Le projet Firebase **et** l'appareil de test arrivent avec la box, pas avant |
| Un import CSV de membres | `P1-001d` ✅ fusionné (PR #15) | ✅ **l'outil existe** ; ce qui manque est le fichier réel de la box |
| Un parcours d'invitation | `P0-005a`, `D-005` ✅ | ✅ — mais **jamais exercé à 80 personnes d'un coup**, et la relance des non-inscrits n'a aucun outil |
| Un planning récurrent réel | `P1-002` ✅ | ✅ — le seed en a un ; la box a le sien, et il faut le saisir |
| **Une sauvegarde restaurée au moins une fois** | *rien* | ❌ **à créer**, et ce n'est pas négociable : à partir de ce ticket, la base contient les données personnelles de ~80 personnes réelles (§18.4, item 10) |
| **Les trois pièces RGPD** — DPA, registre, politique de confidentialité | *rien* — voir la section ci-dessous | ❌ **prérequis daté : avant le premier import de membres.** Pas un item de §18.4 reporté au MVP — une obligation qui commence **le jour de la mise en service** |
| **Une entité juridique** | *rien* | ⚠️ **non bloquant, mais exposant.** Une personne physique peut être sous-traitante au sens de l'art. 28 ; c'est elle, personnellement, qui signe le DPA et porte le registre. Jusqu'ici la question n'avait qu'une conséquence, Stripe, et pas d'échéance avant mi-2027 ; **elle en a deux, et la seconde est datée par ce ticket** |

### Le RGPD n'est pas un item de §18.4 : c'est l'échéance de ce ticket

**Au moment où `P1-016` s'exécute, l'éditeur du service devient sous-traitant
de la box** au sens de l'article 28 — la spec le pose sans détour en §15.1 : pour les
données des membres, **la box est responsable de traitement et Rack est
sous-traitant**, et « sans ce document, vous êtes en infraction dès le premier
client ». Le premier client, c'est la box pilote, et le premier jour, c'est
celui de l'import.

**Et il n'y a pas d'entité juridique.** Une personne physique peut être
sous-traitante, donc ce n'est pas bloquant. Mais ça expose personnellement —
jusqu'à la société, c'est un nom d'état civil qui engage — et ça ne s'improvise
pas le lundi matin. *(Ce ticket prépare un DPA : ses formulations finiront
copiées dans un contrat. D'où un rôle — « l'éditeur du service » — et jamais un
nom.)* D'où **trois pièces, datées « avant le
premier import »** :

| Pièce | Ce qu'elle est | Ce que le dépôt en sait aujourd'hui |
| --- | --- | --- |
| **Le DPA** (art. 28) | le contrat de sous-traitance signé avec la box — la spec le veut « intégré au parcours d'inscription, acceptation horodatée » ; **au pilote, une signature suffit** | *rien* |
| **Le registre des traitements** (art. 30) | « un tableur suffit, mais il doit exister » (§15.1). Avec la liste des sous-traitants ultérieurs et leur localisation : Supabase, Vercel, Expo, le SMTP tiers | *rien* |
| **La politique de confidentialité** — l'information des membres | le document que le parcours de consentement **pointe déjà**, et qui doit **exister et être vrai** | ❌ **c'est le point le plus grave des trois, et il a l'air conforme.** `consents.tsx:113` fait cocher « J'ai lu la politique de confidentialité » **sans pointer vers rien** — aucun lien, aucune adresse. Le consentement est enregistré sous la version **`2026-08-01`** de `current_policy_version()` (`20260831133636:16`), **avec IP et user-agent** (`consents.ip`, `consents.user_agent`). Et cette constante **n'est pas décorative** : `me_function.sql:135` s'en sert pour décider si les consentements sont satisfaits — **elle conditionne l'accès**. Voir ci-dessous |

**Ce n'est pas un document manquant, c'est un consentement nul.** Le produit
fait cocher, enregistre un consentement horodaté avec IP et user-agent, et
**ouvre l'accès** — sur un document qui n'existe pas. Il n'est donc pas éclairé.
Et il a l'air conforme, ce qui est le pire cas : une table `consents`, des
versions, des horodatages, une preuve conservée même après suppression du
compte — **le défaut est invisible depuis les données.**

**Et il y a une conséquence de séquence.** Le jour où la politique sera écrite,
la constante passera à sa vraie date, et `me()` tiendra **tous les consentements
antérieurs pour périmés** : `ACCEPT_CONSENTS` revient pour tout le monde. Avant
les 80 membres, c'est invisible. Deux semaines après la mise en service, c'est
**redemander leur consentement à 80 personnes dans une box qui vient de changer
d'outil.** D'où la forme exacte du prérequis :

> **La politique existe, la constante porte sa date, et l'écran y mène — les
> trois AVANT le premier import.** Pas « la politique avant l'import et la
> constante quand on y pensera » : le document peut exister sans que l'écran y
> mène, et la constante peut rester à `2026-08-01` avec un texte daté d'ailleurs.
> Chacune des trois, seule, laisse le défaut en place.

*(La constante vit dans une migration, et le seed porte la même version dans ses
lignes de `consents` : les deux bougent ensemble. Règle 13 : tant qu'aucune base
de production n'existe, ça s'édite en place — et `P1-017` en crée une. Donc
avant `P1-017`, ou en migration ajoutée après ; ce qui n'est pas une option,
c'est de laisser la question à `P1-016`.)*

**Ce que ça exige de ce ticket, et pas du lancement commercial** : les trois
pièces existent, **l'écran de consentement mène à la politique** (un lien, pas
une phrase), et **`current_policy_version()` retourne la date du texte publié
avant que le premier membre réel ne coche**. Le reste de §18.4 — CGU, CGV,
juriste, AIPD — reste au MVP.

### Les formules gratuites ne tiennent pas le pilote

**`P1-017` crée le projet hébergé et le déploiement web sur les formules
gratuites — c'est le bon choix pour *prouver* la chaîne des semaines à l'avance.
Ce n'est pas le bon choix pour *servir* 80 personnes réelles**, et la bascule a
une échéance : **avant la mise en service**, pas le lundi matin.

Deux raisons, chacune dirimante :

- **Un projet Supabase _Free_ est mis en pause après une semaine d'inactivité.**
  Une base en pause, c'est une box à l'arrêt : personne ne réserve, personne ne
  se connecte, jusqu'à ce que quelqu'un rouvre le projet à la main. Les formules
  payantes ne sont jamais mises en pause.
  ([Supabase — Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing))
- **Le plan _Hobby_ de Vercel est réservé à l'usage non commercial.** Un SaaS de
  réservation qu'une box paie — même hors app au pilote — est un usage
  commercial au sens des conditions de Vercel. Rester en Hobby serait une
  violation des CGU, pas une économie.
  ([Vercel — plan Hobby](https://vercel.com/docs/plans/hobby))

**Le coût, pour qu'il ne soit pas une surprise le jour J :** Supabase Pro
(~25 $/mois) + Vercel Pro (~20 $/mois) ≈ **45 $/mois**, hors dépassements
d'usage. C'est une charge récurrente, pas un jour-homme : elle **n'entre pas dans
le total ①**, et c'est justement pour ça qu'elle est écrite ici — un coût qui ne
figure dans aucun chiffre finit par se découvrir au pire moment. `P1-017` peut
rester en gratuit tant qu'il ne fait que prouver la chaîne ; la bascule Pro est
un prérequis **de ce ticket-ci**.

## Ce que ce ticket demande de vous

| Lot | Nature | Coût |
| --- | --- | ---: |
| ~~Projet Supabase hébergé, migrations, major 17, secrets~~ | technique | **→ `P1-017`** (0,75) |
| ~~Déploiement du back-office web~~ | technique | **→ `P1-017`** (0,5) |
| *Development build* iOS, TestFlight, et les 80 invitations qui vont avec | technique | 1,25 j·h |
| Sauvegarde quotidienne + **une restauration réellement testée** | technique | 0,5 j·h |
| Configuration en visio avec la box : types de cours, salles, règles, horaires récurrents réels (§18.3 : 1 h annoncée) | accompagnement | 0,5 j |
| Import du fichier de membres, invitations, relance des non-inscrits | accompagnement | 0,5 j |
| **Présence en salle la première semaine**, deux créneaux | accompagnement | 1 j |
| Suivi J+7, appel J+30 (§18.3), et les correctifs de première semaine | accompagnement | 1 j |
| Réserve — la première semaine d'une vraie box n'est jamais celle qu'on a prévue | accompagnement | 1 j |

**1,75 j·h de technique, dans ①** — et 1,25 de plus dans `P1-017`, total ①
inchangé à 109. **4 jours d'accompagnement**, qui ne sont pas des jours-homme de
développement et n'y entrent pas : les mélanger rendrait les deux chiffres
inutilisables.

> ### Où vit le volet domaine/SMTP (câblage) — règle 8
>
> Le câblage e-mail — parité `supabase/config.toml`, runbook
> `docs/procedures/email-et-domaine.md`, registre `docs/rgpd/sous-traitants.md` — est
> **dedans, pas en plus** : il occupe **~0,25 j·h du lot « build iOS, TestFlight, et les
> 80 invitations » (1,25)**, sa moitié « invitations », et il est **avancé** maintenant
> parce que le domaine est sur le chemin critique. `P1-017` l'avait déjà prévu (« le temps
> non consommé du SMTP tiers reste dans `P1-016` »). **Total ① inchangé.**
>
> **Le reste de cette moitié « invitations » est l'émetteur maison**, **carve-out en
> `P1-018`, bâti et fusionné le 12 sept. 2026** (+ une reprise du motif claim/mark le même
> jour). Il poste par l'**API Brevo** un e-mail **« connectez-vous avec cette adresse »** —
> **pas** de lien `D-005` : l'effectif importé rejoint par **appariement d'e-mail**
> (`accept_pending_invitation`), correction règle 8 trouvée en écrivant le ticket. Il faut
> une **clé API** en plus de la clé SMTP. Ré-estimé **1 → 1,5** (build 1,25 ratifié +
> reprise 0,25), **① à 115,5** — écrit, pas absorbé.

### Le point d'entrée des 80, et ce qui le bloque encore

**Pilote iOS-seul (tranché le 12 sept. 2026).** L'invitation porte `RACK_INVITE_URL` = **le
lien TestFlight public**. Le membre installe l'app, l'ouvre, demande son magic link avec son
adresse, `accept_pending_invitation()` l'apparie. Pas de page d'atterrissage à écrire.

**Mais ce lien TestFlight n'existe pas encore.** Aucun build n'est soumis : le lot
**« development build iOS + TestFlight » (1,25 j·h, ci-dessus)** n'est pas joué. **Donc
l'envoi des 80 invitations est bloqué par le build TestFlight**, alors que le code de
`P1-018` est fermé. Ce n'est pas un défaut, c'est une **dépendance qui vient de se
révéler** : « l'émetteur est fait » **ne veut pas dire** « les invitations peuvent partir ».
Le membre qui atterrirait sur `rack-web-rack8.vercel.app/login` tomberait sur l'**espace
box** (back-office admin), qui n'est pas fait pour lui.

**Ce qui reste exerçable sans TestFlight :** la **preuve à 3 adresses** de `P1-018` marche
avec **n'importe quelle URL** (même le back-office) — elle prouve l'**envoi et
l'idempotence**, pas le parcours du membre.

**Et le déploiement web n'est pas automatique** (`deploiement-heberge.md`,
`email-et-domaine.md`) : une fusion sur `main` **ne redéploie rien**. Le critère « le
back-office est atteignable depuis l'ordinateur de la box » peut être **vert sur un build
périmé**, et `RACK_INVITE_URL` / `BREVO_API_KEY` ne sont embarquées qu'au **redéploiement
explicite** (`npx vercel deploy --prod --scope rack8 --yes`, variables posées **avant**).
C'est une **étape** de ce ticket, pas un automatisme — à retirer si Vercel est rebranché sur
GitHub avant la mise en service.

### Trois prérequis de parcours, trouvés en répétant la mise en service (12 sept. 2026)

Essayer d'envoyer les invitations de bout en bout sur l'hébergé a demandé **trois
contournements SQL** — autant de lots à jouer **avant** le lundi matin, chacun chiffré et
entré dans ① :

- **`P1-020` — créer la box pilote.** `create_tenant` n'a **aucun appelant** (règle 7,
  depuis P0) : la box ne naît qu'en SQL de prod. **Bloquant.**
- **`P1-021` — la première connexion web aboutit.** Gabarit « Confirm sign up » sans lien
  **et** `/login` sans champ code = cul-de-sac ; il a fallu confirmer l'e-mail à la main.
  **Bloquant** (l'OWNER n'entre pas dans le back-office).
- **`P1-022` — l'accueil web mène à sa box** (aujourd'hui un placeholder, et c'est la page
  de la Site URL). Semi-bloquant.

**Ces trois conditionnent la preuve d'envoi de `P1-018`** : elle se refera par le vrai
parcours, pas par du SQL. Et **`P1-023`** (signal quand l'hébergé décroche) + la **checklist
de mise en service** (`deploiement-heberge.md`) rendent visibles les écarts qui, ce jour-là,
se sont découverts en butant dessus.

> ### La partie technique est du développement, et c'est tranché : elle vit ici
>
> Les quatre lots techniques ci-dessus — les deux qui restent ici et les deux
> partis dans `P1-017` — sont du travail d'ingénierie, pas de l'accompagnement. Les laisser hors du total ① aurait reproduit **exactement**
> l'erreur que le recompte du 9 septembre venait de corriger — un travail réel
> qui ne figure dans aucun chiffre finit par ne figurer nulle part.
>
> **Tranché le 9 septembre 2026, après la fusion de PR #64** : les 3 j·h entrent
> dans ①. La colonne « à arbitrer » n'aura duré que le temps d'une fusion.
>
> **Puis découpé le même jour, après PR #65 — pas pour changer le total, pour
> changer le moment.** Deux de ces lots ne dépendent de rien et portent toute la
> nouveauté : première infrastructure de production, première migration contre
> une base hébergée, premiers secrets. Les jouer la semaine de la box concentre
> l'inconnu là où il y a le moins de marge. Ils partent dans **`P1-017`**, joué
> pendant `P1-008a`. Ce qui reste ici est ce qui dépend vraiment du reste.

## Ce que ce ticket demande de la box

**Écrit ici parce que rien de tout cela ne dépend de vous, et que tout peut
bloquer une date :**

- **son fichier de membres**, exporté de son outil actuel, avec les adresses
  e-mail — c'est la donnée d'entrée de tout le reste ;
- **son planning réel** : les cours qu'elle donne vraiment, aux heures où elle
  les donne, avec les capacités réelles ;
- **une décision sur le double-run** : combien de temps elle garde son outil
  actuel en parallèle (§19.1, R3 : « période de double-run d'un mois ») ;
- **une personne responsable côté box**, jointe et disponible la première
  semaine — sans elle, chaque question fait perdre un jour ;
- **son accord pour que ses membres reçoivent une invitation par e-mail**, et
  l'annonce qu'elle en fera. Une invitation qui arrive sans que la box en ait
  parlé se lit comme du spam.

## Périmètre

- Ce qui reste de la mise en production technique : le build TestFlight et la
  sauvegarde restaurée. Le projet hébergé et le déploiement sont `P1-017`.
- **Les trois pièces RGPD**, avant le premier import — et pour la politique,
  **les trois conditions** : le texte existe, `current_policy_version()` porte
  sa date, `consents.tsx` y mène par un lien. Aucune des trois n'est ici sans les
  deux autres.
- La configuration de la box avec elle, en visio.
- L'import, les invitations, la relance.
- La présence en salle et le suivi.
- **Le journal de ce qui casse**, tenu pendant la première semaine : c'est la
  meilleure source d'apprentissage produit du projet (§18.3), et elle ne se
  reproduit pas.

## Hors périmètre

- **Le lancement commercial.** §18.4 et ses 14 items sont pour le MVP vendable,
  pas pour une box pilote qui ne paie pas dans l'app. **Les exceptions sont
  nommées et datées** : la restauration testée, et les trois pièces RGPD de la
  section ci-dessus — parce que la sous-traitance commence le jour de la mise
  en service, pas le jour du lancement.
- **Le paiement.** Il se fait hors app au pilote, assumé et expliqué à la box.
- **Une deuxième box.** Ce ticket est écrit pour une seule, et le refaire pour la
  suivante sera un autre travail — plus court, et c'est ce qu'il faudra mesurer.

## Critères d'acceptation

- [ ] Un membre de la box, sur **son** téléphone, réserve un cours réel — sans
      Expo Go, sans réseau local, sans nous
- [ ] Le coach écrit sa séance de la semaine dans Rack, et **n'ouvre pas Hustle
      Up** — c'est le repère de `P1-015`, et il ne se mesure qu'ici
- [ ] Le back-office est atteignable depuis l'ordinateur de la box, sur une
      adresse qu'elle peut mettre en favori
- [ ] `P1-017` est fait **avant**, pas la même semaine que la box : projet
      hébergé, back-office déployé, e-mails qui partent pour de vrai
- [ ] **Avant la mise en service** : le projet Supabase est passé en **Pro** et
      Vercel en **Pro** — une base _Free_ se met en pause au bout d'une semaine
      (box à l'arrêt) et _Hobby_ interdit l'usage commercial. ~45 $/mois, une
      charge récurrente qui n'entre pas dans ①
- [ ] Les trois pièces RGPD existent **avant le premier import**
- [ ] **Avant le premier import aussi** : `current_policy_version()` retourne la
      date du texte publié, et `consents.tsx` mène à ce texte par un lien. **Le
      contrôle négatif** : aucun membre réel n'a de ligne dans `consents` sous
      une version antérieure à celle du texte — sinon `me()` les fera tous
      recocher deux semaines après la mise en service
- [ ] Une sauvegarde a été **restaurée**, une fois, pour de vrai
- [ ] Le journal de première semaine existe, daté, et chaque défaut qu'il contient
      a un ticket ou une raison écrite de ne pas en avoir
- [ ] **appareil** — tout ce ticket est un critère d'appareil. Il ne se coche
      dans aucune CI

## Notes

**Ce ticket est le seul du backlog dont l'unité n'est pas le jour-homme.** Une
box ne se met pas en service en travaillant plus vite, et les quatre jours
d'accompagnement ne se compressent pas : ils sont faits d'un créneau chez
quelqu'un d'autre, d'un fichier qu'on attend, et d'une semaine où il faut être
joignable.

**R1 dit « ne jamais construire plus de 6 semaines sans mise en service ».** Au 9
septembre 2026, la dernière mise en service est… aucune. Ce ticket est la
première, et c'est aussi ce qui rend son absence du backlog remarquable : le
risque le plus documenté du projet n'avait pas de ligne.
