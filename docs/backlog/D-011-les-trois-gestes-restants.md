# `D-011` — les trois gestes qu'une passe hors ligne n'a jamais exercés

**Phase** `dette` · **Estimation** `0,5` j·h · **Dépend de** `P1-002b` (fait) · **Spec** `§4-P2`, `§6.1` · **Règle** `.claude/rules/privacy.md`

## Objectif

Le cache du planning est **regardé** là où il vit — sur l'appareil — au lieu
d'être seulement décrit par sa forme : on sait ce qu'il contient, ce qu'il
affiche quand le téléphone n'est pas dans le fuseau de la box, et ce qu'il reste
du compte précédent quand la déconnexion n'a pas eu lieu.

**Pourquoi un ticket et pas trois cases laissées ouvertes dans P1-002b.** Les
deux correctifs qui bloquaient P1-002b sont exercés sur appareil depuis le
4 septembre 2026 ; le ticket est fermé. Ce qui reste n'a plus le même sujet — ce
n'est plus « le hors ligne est-il déterministe », c'est « que vaut cette copie
de données posée hors RLS ». Le laisser en cases non cochées sous un ✅ produit
exactement le faux vert que le dépôt passe son temps à traquer.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| Un iPhone avec Expo Go, la procédure de passe | `docs/passe-mobile-iphone.md` | ✅ existe — passes des 3 et 4 sept. 2026 |
| Le cache et sa clé `(utilisateur, box, jour)` | `apps/mobile/lib/schedule-cache.ts:33` | ✅ existe |
| Un second membre dans la même box | `supabase/seed.sql:28` — `sarah@example.com` | ✅ existe |
| Un membre appartenant à **deux** boxes | `supabase/seed.sql:140` — `julie@example.com` | ✅ existe en base |
| **De quoi changer de box depuis le mobile** | sélecteur de box | ❌ **P1-009** — donc la moitié « deux boxes » du geste ne se fait pas encore, voir Hors périmètre |
| Un moyen de lire `AsyncStorage` à la main | console du débogueur JS d'Expo Go, ou harnais web où `AsyncStorage` retombe sur `localStorage` (`pnpm --filter @rack/mobile web`) | ⚠️ existe, jamais utilisé pour ça — c'est la seule inconnue de méthode du ticket |

## Ce que ce ticket rend possible, et qui l'appellera

Rien de neuf n'est livré : ce ticket **regarde**. S'il trouve un défaut, le
correctif est du code de `apps/mobile`, et il est écrit ici — c'est la seule
extension de périmètre autorisée.

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| Trois lignes de plus au journal des passes | la prochaine passe | celui-ci |

## Périmètre

- **Le fuseau.** Régler le téléphone sur un autre fuseau (Tokyo fait un écart
  qui ne se confond avec rien), rouvrir le planning : les heures restent celles
  de la box. Le calcul a douze tests, son effet à l'écran n'en a aucun.
- **Le contenu du cache.** Après une session normale, lire les valeurs sous le
  préfixe `rack.schedule.` : aucune adresse e-mail, aucun nom d'inscrit, aucun
  jeton. La forme (`DaySchedule`) l'interdit déjà — c'est la relecture qui le
  prouve.
- **Ce qui reste du compte précédent.** Se connecter en `lea@example.com`,
  charger une journée, puis **arriver sur un autre compte sans passer par la
  déconnexion** — app tuée, session expirée, trousseau vidé. Vérifier que rien
  du compte précédent ne s'affiche.

## Hors périmètre

- **La moitié « deux boxes » du cloisonnement** : changer de box demande le
  sélecteur, qui est **P1-009**. Son ticket porte déjà l'appel à
  `clearScheduleCache()` au changement de box ; c'est là que le geste se fera.
- Tout correctif qui dépasserait `apps/mobile/lib/schedule-cache.ts` et l'écran
  de planning : nouveau ticket.

## Critères d'acceptation

- [ ] Le fuseau du téléphone est changé et les heures affichées ne bougent pas
- [ ] Les valeurs sous `rack.schedule.` sont relues à la main et ne contiennent
      ni adresse, ni nom d'inscrit, ni jeton
- [ ] Un second compte arrive **sans déconnexion préalable** et ne voit rien du
      premier
- [ ] Le journal des passes de `docs/passe-mobile-iphone.md` porte la date,
      l'appareil et le résultat — une passe non datée ne prouve rien
- [ ] Les trois cases correspondantes de `P1-002b` sont cochées, ou un défaut
      est trouvé et corrigé ici

## Notes

**Le geste qui prouve quelque chose n'est pas celui qui était écrit.**
`signOut()` appelle `clearScheduleCache()`, qui efface **tout** le préfixe et pas
les seules clés du compte qui part. Une passe « je me déconnecte, je me
reconnecte en Sarah » ne peut donc rien montrer : elle exerce l'effacement, pas
le cloisonnement. Ce qui protège quand l'effacement n'a **pas** eu lieu, c'est la
clé — et le seul moyen de le voir est d'atteindre le second compte par un chemin
qui ne passe pas par la déconnexion.

C'est la règle des sœurs de `.claude/rules/database.md`, prise côté appareil :
un chemin bien gardé (la déconnexion), et son jumeau (la session perdue) que
personne n'avait regardé.
