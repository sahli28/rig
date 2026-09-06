# P1-008 — Check-in QR et mode kiosque

**Phase** P1 · **Estimation** 6 j·h · **Dépend de** P1-003 ✅ · **Spec** §4-P3, RM3.1–3.6

> **⚠️ Ce ticket n'a pas encore sa section « ce que ce ticket suppose et qui doit
> exister » — règle 8. Il ne se lance pas avant qu'elle soit écrite**, et un
> prérequis est déjà connu, noté le 6 septembre 2026 pour ne pas se découvrir en
> cours de route :
>
> **le mode kiosque a besoin d'un contexte sécurisé.** `getUserMedia` n'est pas
> exposée hors HTTPS (ou `localhost`) : sur `http://<IP>:3000`, la caméra n'est
> pas « refusée », l'API est **absente de l'objet**. Sur une tablette qui atteint
> le serveur par son IP, le scan ne peut donc pas exister — ce n'est pas un
> problème de test, c'est un problème de faisabilité. Il faut trancher comment on
> sert le kiosque en HTTPS avant d'écrire une ligne de scan.

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
