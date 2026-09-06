/**
 * Le canal des places restantes, côté écran (P1-005a).
 *
 * Ce qui vit ici est du **cycle de vie** : s'abonner, se désabonner, replier en
 * lecture périodique, et rendre la main proprement quand l'app passe en
 * arrière-plan. Tout ce qui peut se tromper au calcul est dans
 * `@rack/core/supabase` (`appliqueChangementDeCours`, `litLigneCours`,
 * `etatAffiche`), testé là-bas.
 *
 * **Les rappels passent par un `ref`, et c'est la leçon de `D-018` prise à
 * l'endroit où elle se reproduirait.** Un effet qui dépend d'une callback
 * recréée à chaque rendu se rejoue à chaque rendu — ici cela voudrait dire se
 * désabonner et se réabonner à chaque changement de jour, donc un canal neuf
 * toutes les deux secondes de feuilletage. L'effet ne dépend que de ce qu'il
 * écoute vraiment : la box, et le fait d'être en ligne.
 */

import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  abonneAuxCoursDuTenant,
  etatAffiche,
  type EtatAffiche,
  type EtatCanal,
  type LigneCoursChangee,
} from '@rack/core/supabase';
import { supabase } from './supabase';

/**
 * Le repli, à 30 s — la valeur de la spec §10 (« fallback polling 30 s »).
 *
 * Elle n'est pas négociable à la baisse sans mesurer : c'est une requête par
 * écran ouvert et par période, sur des téléphones dont on ne connaît ni le
 * réseau ni la batterie.
 */
const REPLI_MS = 30_000;

export function useCoursEnDirect({
  tenantId,
  enLigne,
  surChangement,
  relire,
}: {
  tenantId: string | null;
  enLigne: boolean;
  /** Un cours a bougé. À appliquer avec `appliqueChangementDeCours`. */
  surChangement: (ligne: LigneCoursChangee) => void;
  /** Le repli : une relecture **silencieuse**, jamais un squelette. */
  relire: () => void;
}): EtatAffiche {
  const [canal, setCanal] = useState<EtatCanal>('perdu');

  // Voir l'en-tête du fichier : l'identité de ces deux fonctions ne doit pas
  // entrer dans les dépendances de l'effet.
  const rappels = useRef({ surChangement, relire });
  rappels.current = { surChangement, relire };

  useEffect(() => {
    if (tenantId === null || !enLigne) {
      setCanal('perdu');
      return;
    }

    let abonnement: { arrete: () => void } | null = null;

    const brancher = () => {
      abonnement?.arrete();
      abonnement = abonneAuxCoursDuTenant(supabase, {
        tenantId,
        surChangement: (ligne) => rappels.current.surChangement(ligne),
        surEtat: setCanal,
      });
    };

    const debrancher = () => {
      abonnement?.arrete();
      abonnement = null;
      setCanal('perdu');
    };

    brancher();

    // **Un canal ne survit pas à l'arrière-plan, et il ne doit pas essayer.**
    // iOS gèle le WebSocket ; le garder ouvert donne un canal qui se croit
    // connecté et ne livre rien — pire qu'un canal fermé, parce que la pastille
    // dirait « en direct » sur des chiffres figés. Au retour, on rebranche et
    // on relit : les événements manqués ne se rattrapent pas.
    const ecoute = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') {
        brancher();
        rappels.current.relire();
      } else {
        debrancher();
      }
    });

    return () => {
      ecoute.remove();
      debrancher();
    };
  }, [tenantId, enLigne]);

  // Le repli, et **seulement** quand il sert : canal perdu, réseau présent,
  // écran monté. Hors ligne, relire ne ferait qu'échouer toutes les 30 s.
  useEffect(() => {
    if (canal === 'connecte' || !enLigne || tenantId === null) return;

    const minuteur = setInterval(() => rappels.current.relire(), REPLI_MS);
    return () => clearInterval(minuteur);
  }, [canal, enLigne, tenantId]);

  return etatAffiche(canal, enLigne);
}
