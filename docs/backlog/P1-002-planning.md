# P1-002 — Planning récurrent (RRULE)

**Phase** P1 · **Estimation** 9 j·h · **Dépend de** P1-001b · **Spec** §4-P2, §6.2

## Règle 7 — ouverte, et c'est la première chose à fermer

`refresh_class_schedule()` est livrée par la migration et **n'a aujourd'hui
aucun appelant hors des tests**. Son appelant est la grille de semaine du
back-office, dans ce même ticket. Tant qu'elle n'existe pas, cette migration
livre une fonction que personne n'appelle — septième occurrence du motif, et la
première qu'on inscrit **avant** de la constater après coup.

Même statut, moins urgent, pour `maintain_class_occurrences()` : son appelant
est le job `pg_cron`, déclaré dans la migration. Celui-là est fermé.

| Livré | Appelant | État |
| ----- | -------- | ---- |
| `refresh_class_schedule()` | la grille de semaine | ❌ **ouvert** — lot d'interface de ce ticket |
| `materialize_class_occurrences()` | `refresh_class_schedule()` et le job | ✅ fermé |
| `maintain_class_occurrences()` | `cron.schedule('rack-maintain-class-occurrences')` | ✅ fermé |
| `classes` | la réservation | ⏳ P1-003 |

## Ce que ce ticket suppose et qui doit exister

Section ajoutée après coup (règle 8 de `CLAUDE.md`), parce que ce ticket est le
prochain à partir et que c'est exactement le genre qui explose : il touche la
base, un job de fond et deux écrans.

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `class_types` | `..._class_types_and_opening_hours.sql` (P1-001b) | ✅ **existe** — c'est précisément ce que P1-001 supposait à tort, et ce que P1-001b a livré |
| `opening_hours`, en `time` nus, heure locale de la box | idem | ✅ existe. `overlappingSlots()` garde le chevauchement côté TypeScript, **pas** la base : la migration le dit |
| `locations`, `rooms`, capacités | P0-004, P1-001b | ✅ existent |
| `tenants.timezone` et les règles en heure locale | P0-004, règle 9 de `CLAUDE.md` | ✅ existe |
| Coquille du back-office, garde de rôle, Server Actions | P1-001a, P1-001b | ✅ existent — modèle à recopier |
| **`pg_cron`, activé et configuré** | `supabase/config.toml` | ❌ **à vérifier avant de chiffrer.** La matérialisation glissante en dépend, et aucun job de fond n'existe encore dans le produit. Si l'extension n'est pas activée en local, c'est le premier travail du ticket |
| **Une grille de semaine (composant web)** | `packages/ui` / `apps/web` | ❌ **à créer.** Aucun écran n'affiche encore une grille temporelle. C'est le second composant lourd du produit après le Program Builder, et c'est ce qui peut faire dériver l'estimation |
| Une bibliothèque RRULE | — | ❌ dépendance à ajouter (`rrule`), à justifier dans le commit. **Ou** l'expansion en SQL — à trancher au plan : la matérialisation étant faite par un job Postgres, une RRULE analysée en TypeScript devrait alors traverser la frontière |
| Cache mobile pour l'affichage hors ligne | P1-002b | ❌ **sorti de ce ticket.** Le jalon pilote privilégie le planning fiable ; le check-in offline reste couvert par P1-008 |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `classes` (occurrences datées) | la réservation | **P1-003** |
| `class_schedules` + son écran | le staff | celui-ci |
| Le job de matérialisation | `pg_cron` | celui-ci |
| `classes`, pour rattacher une séance | le Program Builder | P2-010, P2-012 |

## Périmètre

- `class_schedules` avec règle de récurrence RRULE (jour, heure, coach, salle, capacité).
- Matérialisation des occurrences dans `classes` par un job `pg_cron`, sur un horizon glissant de 8 semaines.
- Exceptions : cours annulé, coach remplacé, capacité modifiée sur une occurrence sans toucher la récurrence.
- Back-office : grille semaine, création récurrente, annulation d'un cours avec notification.
- RRULE pilote **strictement bornée** à `FREQ=WEEKLY`, `INTERVAL`, `BYDAY` et `UNTIL`. Toute autre clé ou fréquence est refusée, côté schéma partagé **et** par la base : aucune règle ne sera jamais interprétée approximativement.

## Ce qui a été retiré de ce ticket, et où c'est parti

**« Dupliquer une semaine en moins de 5 secondes » n'appartenait pas ici.** Le
critère vient de RM5.8, où il porte sur un **cycle d'entraînement** : un coach
compose huit semaines de programmation et veut recopier la semaine 3 en
semaine 7 sans tout ressaisir. C'est du travail, et c'est réel.

Appliqué à un planning **récurrent**, il a perdu son objet : une série se répète
déjà par définition, c'est ce qu'est une RRULE. Dupliquer une semaine y
reviendrait à créer une seconde série identique à la première, ce que personne
ne veut.

Ce qui resterait utile — dupliquer les **exceptions** d'une semaine, un coach
remplacé le 12, une salle changée le 14 — est une autre fonctionnalité, et
personne ne l'a demandée. On l'écrira le jour où une box la réclamera, pas parce
qu'un critère mal placé nous y pousse.

Le critère est donc **transféré à P2-010** (Program Builder), où il garde tout
son sens, et inscrit dans la table de réconciliation du README pour qu'on ne le
redécouvre pas dans six mois comme un trou.

## Hors périmètre

- Planning mobile, filtres et cache offline : **P1-002b** (~3–4 j·h), après ce
  socle. Le check-in offline reste P1-008.
- RRULE RFC complète (mensuelle, `COUNT`, `BYSETPOS`, etc.) : hors pilote. Une
  règle refusée reçoit une alternative explicite dans l'UI (« utilise une
  récurrence hebdomadaire ou crée une seconde série »), jamais une approximation.

## Dette identifiée, à traiter dans un lot suivant : le fuseau fige des occurrences

**Trouvée à la relecture, non codée.** C'est la règle des sœurs, une fois de
plus, mais dans le temps plutôt que dans l'espace : la garde protège l'écriture
et laisse le passé se faire réinterpréter.

`classes.starts_at` est un `timestamptz` **calculé à la matérialisation**, par
`(jour + starts_at_local) at time zone t.timezone`. C'est exactement ce qu'il
faut pour que 18h30 reste 18h30 au passage à l'heure d'hiver. Mais la conversion
est faite **une fois**, et le résultat est figé.

Or `tenants.timezone` est modifiable par le propriétaire depuis P1-001b —
vérifié, `has_column_privilege('authenticated', 'tenants', 'timezone', 'UPDATE')`
rend `true` — et le libellé de l'écran dit lui-même qu'il « gouverne les
horaires affichés et la fenêtre d'annulation ». Changer le fuseau après coup :

- les occurrences déjà écrites gardent leur **heure absolue** et se décalent à
  l'affichage ;
- rien ne les rafraîchit — ni le job nocturne, qui n'insère que ce qui manque
  (`on conflict do nothing`), ni `refresh_class_schedule()`, que personne
  n'appelle sur ce chemin ;
- les cours déjà réservés ne bougeraient de toute façon pas, puisqu'ils sont
  protégés de l'archivage — et c'est heureux, mais ça veut dire qu'une box se
  retrouverait avec deux moitiés de planning dans deux fuseaux.

**Même chose pour `class_types.duration_minutes`**, qui fige `ends_at` à la
matérialisation et qui est éditable pareillement (`true` aussi). Allonger un
WOD de 60 à 75 minutes ne rallonge aucune occurrence déjà écrite.

### Le précédent existe déjà dans le dépôt

`tenants_currency_locked` (`..._forbid_currency_change_with_ledger.sql`) fige la
devise **dès la première écriture au ledger**, par un trigger `before update of
currency`, `security definer` — pour que la garde ne dépende pas de la policy de
l'appelant. Son commentaire dit le principe : changer la devise après coup « ne
convertit rien, ça **réinterprète le passé** ».

Un fuseau changé après matérialisation fait exactement cela.

### Recommandation : geler, pas rematérialiser

**Un trigger `before update of timezone on public.tenants`** qui refuse dès
qu'une occurrence existe pour ce tenant, sur le modèle exact de la devise, avec
son code d'erreur (`TIMEZONE_LOCKED`) et son test pgTAP.

Trois raisons de préférer le gel :

1. **C'est honnête.** Une box ne change pas de fuseau, elle déménage — et un
   déménagement mérite qu'on regarde son planning, pas qu'un job le décale la
   nuit sans rien dire.
2. **Rematérialiser ne peut pas être correct.** Les occurrences réservées sont
   intouchables par construction (c'est tout l'objet de
   `refresh_class_schedule()`), donc un fuseau changé laisserait forcément un
   planning à deux fuseaux. Un gel dit non ; une rematérialisation dit « en
   partie ».
3. **Comme pour la devise, ça n'interdit pas de se corriger** : tant qu'aucune
   occurrence n'existe, le fuseau se change librement. Une box qui se trompe à
   l'inscription reste libre.

Pour `duration_minutes`, le gel serait excessif — allonger un type de cours est
une opération banale. La bonne réponse y est plutôt de **rematérialiser les
occurrences futures non réservées** du type concerné, ce que
`refresh_class_schedule()` sait déjà faire par série. À trancher dans le lot,
pas ici.

**Ne pas coder maintenant** : ces deux gardes appartiennent au lot d'interface,
là où les écrans qui déclenchent les changements existeront.

## Critères d'acceptation

- [x] Créer « WOD, lundi au vendredi 18h30, salle principale, 16 places » génère 8 semaines d'occurrences
- [x] Modifier la récurrence ne détruit pas les occurrences passées ni les réservations existantes
- [x] Annuler une occurrence unique ne casse pas la série
- [x] Le passage à l'heure d'hiver ne décale aucun cours (test explicite sur le dimanche de bascule)
- [x] Toute RRULE hors sous-ensemble pilote est refusée avec une alternative claire ; elle n'est jamais acceptée puis interprétée partiellement

## Ce qui reste, et pourquoi

**Deux choses, dont une seule dépend de nous.**

1. **Exceptions autres que l'annulation** — coach remplacé, capacité modifiée sur
   une occurrence. La base est prête (`is_override`, et les `grant update` par
   colonne le permettent) ; l'écran ne l'expose pas. C'est du travail d'interface
   pur, sans inconnue.

2. **La notification d'annulation — bloquée, pas oubliée.** Le périmètre dit
   « annulation d'un cours **avec notification** ». Annuler est fait ; notifier
   n'a aucun canal : le push est **P1-007**, l'e-mail **P2-015**, et aucun des
   deux n'existe. L'écran le dit à qui annule (« les membres inscrits ne sont pas
   prévenus automatiquement ») plutôt que de laisser croire le contraire — mais
   ce critère reste ouvert et doit être recoché à P1-007.

Le planning mobile et son cache hors ligne sont sortis dans **P1-002b**.

## Dette ajoutée par ce ticket

- **`refresh_class_schedule()` ne notifie personne.** Archiver une occurrence
  future non réservée est sans conséquence ; le jour où P1-003 aura posé des
  réservations, la protection `booked_count = 0` suffira. Mais un cours
  **annulé** dont on retire la série reste visible et personne n'est prévenu.
  À revoir avec P1-007.
- **La suite pgTAP suppose une base fraîchement semée.** Découvert en laissant
  des données de test manuelles derrière soi : six tests ont rougi, dont quatre
  dans `account_deletion_test.sql`, sans qu'aucun code soit en cause. Ce n'est
  pas nouveau et ce n'est pas grave — `pnpm db:reset` avant `pnpm test:db` — mais
  ça vaut d'être écrit quelque part, parce que le message d'échec ne le dit pas.

## Notes

Ne pas stocker les occurrences à l'infini : horizon glissant, et purge des occurrences non réservées au-delà.
