# P1-001a — La porte d'entrée du back-office

**Phase** P1 · **Estimation** 2,5 j·h · **Dépend de** P0-005a · **Statut** ✅ fusionné (PR #11)

## Pourquoi il a existé

P1-001 supposait un back-office web. Il n'y en avait pas, et il n'y avait surtout
**aucune porte** : `apps/web` contenait une page de remplissage, la galerie du
système de design et la tuyauterie de session livrée par P0-005a — cookies,
middleware, `WebSessionProvider`. Aucun écran de connexion. Un OWNER ne pouvait
pas entrer.

Même motif que les quatre trous précédents : une moitié posée, sa jumelle
oubliée. P0-005a avait livré les écrans du mobile et la plomberie du web.

## Ce qu'il a livré

- Écran de connexion par lien magique (`/login`) et route de rappel
  (`/auth/callback`), seul endroit où Next autorise l'écriture des cookies de
  session.
- Correction de `additional_redirect_urls` dans `supabase/config.toml` : les
  liens étaient déclarés en `https://127.0.0.1:3000` alors que le serveur sert
  `http://localhost:3000`. Le lien magique aurait été rejeté ; personne ne
  l'avait vu parce que personne n'avait de quoi l'essayer.
- Redirection dans le middleware existant : `/box/*` sans session → `/login?next=…`.
- La coquille `/box/[slug]/…` — navigation, thème de la box en SSR, fuseau de la
  box, garde de rôle, déconnexion — et une page vide par écran à venir.
- `findMembershipBySlug()` dans `packages/core`, avec ses tests.
- **ADR 0005** : Radix Primitives + CSS Modules, pas de Tailwind ni de shadcn/ui.

## Les trois décisions à ne pas re-litiger

1. **La box active vit dans l'URL** (`/box/[slug]/…`), jamais dans un contexte ni
   un cookie. Elle survit au rafraîchissement et au lien partagé, le rendu
   serveur la lit dans `params`, une lecture croisée se voit dans la barre
   d'adresse, et le futur Box Switcher n'est qu'une navigation.
2. **Le slug se résout parmi ses propres appartenances**, jamais par
   `tenant_public_profile()` : « box inconnue » et « accès refusé » restent
   indiscernables par construction.
3. **La garde de rôle de la coquille est de l'ergonomie, pas de la sécurité.**
   Les policies et `current_admin_tenant_ids()` refusent déjà tout à un MEMBER ;
   la garde existe pour qu'il lise une phrase au lieu d'une page vide.

## Ce qu'il a aussi validé

Le second critère de P0-005a — « le lien du même e-mail connecte aussi » — resté
ouvert faute d'écran pour le recevoir. Exercé de bout en bout dans le navigateur,
pour la première fois depuis P0-003.
