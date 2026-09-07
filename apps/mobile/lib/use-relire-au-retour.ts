/**
 * Relire au retour sur un écran (`D-016`), **une seule fois écrit**.
 *
 * `expo-router` empile : revenir d'un écran poussé rend la main à l'**instance
 * déjà montée**, dont l'effet de montage ne rejoue rien. Le membre coupait donc
 * « Apparaître dans la liste des inscrits », revenait, et se voyait encore dans
 * la feuille — l'opposition était appliquée en base, l'écran affirmait le
 * contraire. Trouvé à la passe du 5 septembre 2026, sur un contrôle de vie
 * privée : le pire endroit pour un affichage périmé.
 *
 * **La forme est celle de `D-018`, et c'est tout l'intérêt de ce fichier.**
 * `useFocusEffect` ne rejoue pas seulement l'effet au retour du focus : il le
 * rejoue **chaque fois que sa callback change d'identité**. Un `useCallback([…,
 * charger])` recréé à chaque changement de jour déclenchait donc une seconde
 * lecture aussitôt après la première — deux `setEtat` coup sur coup, une liste
 * remplacée deux fois, visible même sans squelette.
 *
 * La correction tenait en un `ref` et des dépendances vides. Elle vivait dans
 * `planning.tsx` seulement, et **trois écrans allaient la recopier ou l'oublier**
 * — exactement la forme que la règle des sœurs décrit. Elle est ici pour qu'il
 * n'y ait plus rien à recopier.
 *
 * ## Ce que ce hook ne couvre pas, et pourquoi
 *
 * **Le premier passage est sauté.** Il suppose donc que l'écran a par ailleurs
 * un effet qui charge au montage et sur changement de dépendance
 * (`useEffect(…, [charger])`). Sans lui, l'écran ne chargerait jamais.
 *
 * C'est pour cette raison que `class/[id].tsx` **n'emploie pas ce hook** : il n'a
 * pas d'effet de montage, son `useFocusEffect` dépend de `charger` et fait les
 * deux travaux à la fois. Sa dépendance n'est pas l'oubli que `D-018` a corrigé,
 * elle est porteuse — la retirer l'empêcherait de relire quand la langue change.
 * Deux formes, deux besoins, et la différence est écrite plutôt que subie.
 */

import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Appelle `relire` à **chaque retour** sur l'écran, jamais au premier passage.
 *
 * La relecture doit être **silencieuse** : au retour, on rafraîchit sans vider
 * l'écran. Faire clignoter un squelette à chaque retour serait un remède pire
 * que le mal qu'on soigne — et un rafraîchissement qui échoue laisse à l'écran
 * ce qui y est, au lieu de remplacer une information correcte par une erreur.
 */
export function useRelireAuRetour(relire: () => void): void {
  const premierPassage = useRef(true);

  // L'identité de `relire` change à chaque rendu ; elle ne doit pas entrer dans
  // les dépendances de l'effet de focus. Voir l'en-tête du fichier.
  const dernier = useRef(relire);
  dernier.current = relire;

  useFocusEffect(
    useCallback(() => {
      if (premierPassage.current) {
        premierPassage.current = false;
        return;
      }
      dernier.current();
      // **Dépendances vides, et c'est le fond du sujet.** Voir `D-018`.
    }, []),
  );
}
