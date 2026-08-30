# P1-005 — Places restantes en temps réel

**Phase** P1 · **Estimation** 3 j·h · **Dépend de** P1-003 · **Spec** §7.4, §10

## Périmètre

- Canal Supabase Realtime par cours : `spots_left`, `waitlist_length`, `status`.
- Abonnement côté mobile et web sur les cours visibles à l'écran, désabonnement au démontage.
- Repli automatique en polling toutes les 30 s si le canal temps réel est indisponible.
- Indicateur visuel discret de fraîcheur de la donnée.

## Critères d'acceptation

- [ ] Une réservation faite sur un appareil met à jour le compteur d'un autre appareil en moins de 3 secondes
- [ ] Couper le temps réel bascule en polling sans erreur visible
- [ ] Aucune fuite d'abonnement après navigation entre 20 écrans (vérifier le nombre de canaux ouverts)
- [ ] **Le compteur affiché ne fait jamais autorité** : la réservation reste refusée par la base si la place est prise

## Notes

Le temps réel est du confort d'affichage. La vérité est la transaction SQL, toujours.
