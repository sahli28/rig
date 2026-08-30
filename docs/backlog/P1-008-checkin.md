# P1-008 — Check-in QR et mode kiosque

**Phase** P1 · **Estimation** 6 j·h · **Dépend de** P1-003 · **Spec** §4-P3, RM3.1–3.6

## Périmètre

- QR dynamique côté membre : jeton signé à durée de vie 30 s lié au `membership_id`.
- Mode kiosque (web PWA sur tablette) : caméra plein écran, retour visuel et sonore immédiat.
- Mode coach : scan depuis le téléphone, roster du cours, pointage manuel.
- Fenêtre de check-in : 30 min avant à 15 min après le début (configurable).
- Détection de no-show : réservation non annulée sans check-in après le cours.
- **Mode hors ligne** : cache local des membres attendus, validation locale pendant 4 h, synchronisation au retour du réseau.

## Critères d'acceptation

- [ ] Validation en moins de 1,5 seconde avec le prénom affiché
- [ ] Un QR de plus de 60 secondes est refusé (test avec capture d'écran)
- [ ] Wifi coupé : le check-in fonctionne et se synchronise ensuite sans doublon
- [ ] Un membre sans réservation se voit proposer un drop-in, jamais un refus sec
- [ ] Le pointage manuel par le coach est toujours possible en dernier recours
- [ ] Le taux de succès du check-in dépasse 99 % sur une semaine de pilote

## Notes

**Ne jamais bloquer l'entrée d'un membre pour un problème réseau.** En cas de doute, le check-in passe et se réconcilie après.
