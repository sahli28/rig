# P1-007 — Notifications push

**Phase** P1 · **Estimation** 4 j·h · **Dépend de** P0-005 · **Spec** §5.3, §12.3

## Périmètre

- Expo Push (APNs + FCM), table `devices`, enregistrement et révocation des tokens.
- Catégories : rappel de cours J-1 18 h, promotion de liste d'attente, annulation d'un cours, WOD publié (P2), paiement en échec (P2).
- Réglages granulaires par catégorie côté membre ; les notifications transactionnelles restent en e-mail même push désactivé.
- Quiet hours 21 h–7 h heure locale du membre, sauf annulation de cours imminent.
- Plafond de 2 notifications marketing par semaine et par membre.
- Contenus en FR et EN, dans le même commit.

## Critères d'acceptation

- [ ] Une notification arrive en moins de 30 secondes sur iOS et Android
- [ ] Un token invalide est supprimé automatiquement au premier échec d'envoi
- [ ] Les quiet hours sont respectées, sauf pour l'annulation d'un cours imminent
- [ ] Désactiver une catégorie n'affecte pas les autres
- [ ] Le contenu s'affiche dans la langue du membre
- [ ] Toucher la notification ouvre l'écran concerné (deep link), pas l'accueil

## Notes

Sans push, le taux d'usage de l'app s'effondre. Ce ticket précède P1-006, qui en dépend.
