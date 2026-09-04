# D-008 — Lien d'invitation qui survit à l'installation

**Phase** dette · **Estimation** 1,5 j·h · **Origine** P0-005a · **Dépend de** P0-005a

## Pourquoi

P0-005a livre l'écran de bienvenue brandé : le `slug` et le `token` arrivent en
paramètres de route, et `tenant_public_profile()` habille l'écran avant même la
connexion. Ce chemin marche quand **l'app est déjà installée**.

Il ne marche pas dans le cas le plus fréquent en vrai : une personne reçoit le
lien de sa box, ne l'a pas installée, atterrit sur le store, installe, ouvre — et
l'app démarre nue. Le `slug` et le `token` ont été perdus entre le navigateur et
la première ouverture. Elle voit le thème RIG neutre et n'a aucun moyen de
rejoindre sa box, alors qu'elle vient de cliquer sur son invitation.

C'est le *deferred deep link*, explicitement reporté au commit de P0-005a.

**Ce que ce ticket ajoute est désormais net.** Le chemin « app déjà installée »
a été prouvé de bout en bout le 4 septembre 2026 sur iPhone : lien →
`/invitation/<jeton>` → écran brandé → code → appartenance. Il ne l'était pas
avant, et il était même cassé de trois façons (voir P0-005a). D-008 ne couvre
donc **que** le trou restant : le jeton qui doit survivre à un passage par le
store.

## Périmètre

- Universal Links (iOS) et App Links (Android) : `apple-app-site-association` et
  `assetlinks.json` servis par le web, sur le domaine des liens d'invitation.
- Page web d'atterrissage qui, sans app installée, mémorise le contexte
  (empreinte, presse-papiers ou paramètre de campagne du store) et redirige vers
  le store.
- Récupération du contexte à la première ouverture, puis effacement immédiat :
  un jeton d'invitation qui traîne est un jeton réutilisable.

## Critères d'acceptation

- [ ] Cliquer une invitation sans l'app installée mène au store puis, après
      installation, à l'écran de bienvenue **de la bonne box**
- [ ] Le jeton n'est lisible qu'une fois et disparaît après usage
- [ ] Le chemin « app déjà installée » de P0-005a continue de fonctionner

## Notes

À faire avec un vrai domaine et un compte développeur : les deux fichiers de
vérification doivent être servis en HTTPS sur le domaine final. Donc pas avant
P2-003 (programme développeur Apple) et le nom de domaine de production.

## Ce que P1-001c a changé : ce ticket n'est plus bloquant

**Une invitation s'accepte désormais sur le web**, à `/invitation/[token]` : la
page affiche la box à ses couleurs, envoie le lien de connexion, puis appelle
`accept_invitation()`. Elle ne dépend ni d'un domaine, ni d'Apple, ni d'un store.

Tant que ce parcours n'existait pas, D-008 était le **seul** chemin d'entrée
d'un nouveau membre, donc un prérequis du pilote bloqué sur deux démarches
administratives. Il redevient ce qu'il aurait toujours dû être : une
**optimisation** — ouvrir l'app plutôt que le navigateur quand elle est
installée, et ne pas perdre le contexte quand elle ne l'est pas.

Corollaire pour le QR mural : il encode maintenant l'URL de cette page, pas un
jeton. L'affiche fonctionne sans app installée.

Le repli qui existe aujourd'hui reste acceptable pour le pilote : la box envoie
le lien à une personne qui a déjà l'app, ou l'installe puis rouvre le lien.
