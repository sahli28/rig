# `D-028` — L'accueil web s'hydrate dans la langue du serveur *(rétroactif)*

**Phase** `D` · **Estimation** `0,25` j·h · **✅ fait le 12 septembre 2026** (PR #86) · **Origine** défaut relevé à la mise en production de `P1-017`, corrigé hors ticket

## Pourquoi ce ticket existe après le travail

Même raison que `D-012` et `D-017` : le correctif était réel, fusionné, et ne
figurait dans **aucun** total — troisième fois que du travail se range hors des
chiffres, et la règle du recompte (« additionner les lignes ») ne voit que les
lignes qui existent. Celle-ci existe désormais.

## Ce qui a été corrigé

L'erreur **React #418** (décalage d'hydratation) relevée sur l'accueil web déployé
(`P1-017`, note de réalisation). Cause : `providers.tsx` lisait
`navigator.language` **au rendu** — absent côté serveur (repli `fr`), présent côté
client — donc tout visiteur non francophone recevait du HTML français puis
hydratait en anglais. Prouvé : même sous `Accept-Language: en-US`, le serveur rend
toujours du français (aucune négociation de langue) ; le navigateur du harnais
étant français, le défaut était invisible en local.

Correctif au bon niveau : le **premier rendu** est le repli des deux côtés, et la
langue du navigateur passe par une prop `deviceLocale` appliquée **après montage**
(`I18nProvider`, rang 3) — comme la préférence stockée l'est déjà. Mobile et
back-office ne la passent pas : comportement inchangé, sans clignotement.

## Critères

- [x] Aucune erreur d'hydratation console sur l'accueil (vérifié au harnais).
- [x] La bascule FR/EN fonctionne toujours (vérifiée).
- [x] Mobile inchangé (suite verte, la prop est optionnelle et non passée).
