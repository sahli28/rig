import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useTheme } from '@rack/ui/theme';
import { useI18n } from '@rack/ui/i18n';
import { weekDates } from '@rack/core/supabase';
import {
  apresJourChoisi,
  fenetreInitiale,
  pageVisible,
  semainesDeLaFenetre,
} from './week-strip-state';

/**
 * Le bandeau de semaine du planning (P1-011).
 *
 * **Sept jours, un tap.** Atteindre samedi depuis mercredi coûtait jusqu'à trois
 * taps sur une flèche, chacun déclenchant un chargement. C'est le geste le plus
 * fréquent du produit, et c'était le plus lent.
 *
 * **Ici et pas dans `packages/ui`** : un seul écran l'utilise
 * (`CLAUDE.md`, conventions). Il déménagera le jour où un second en veut un.
 *
 * **Rien n'est préchargé.** Rendre les jours atteignables ne veut pas dire les
 * charger : ce composant n'importe aucun lecteur, il ne *peut* pas. Chaque jour
 * visité écrit une entrée de cache `(utilisateur, box, jour)`, et en précharger
 * une semaine rendrait `D-011` sept fois plus long.
 *
 * ---
 *
 * **La position de défilement est la vérité, et c'est le troisième essai.**
 *
 * Les deux premiers tenaient « la semaine regardée » dans un état qu'il fallait
 * garder d'accord avec le défilement — un carrousel de trois pages qu'on
 * recentrait après chaque geste. Les deux ont échoué sur appareil, de deux
 * façons différentes, et aucun filet ne pouvait les voir : le SDK web n'émet
 * jamais `onMomentumScrollEnd`, donc le geste n'existe pas au harnais.
 *
 * Ici, il n'y a **rien à synchroniser** : les pages sont la semaine du jour
 * choisi et les trois suivantes, le défilement va où le doigt le porte, et
 * **aucun `scrollTo` ne le ramène**. Le seul défilement par programme est un
 * retour à `x = 0` quand le jour change depuis l'extérieur — le seul décalage
 * qui ne peut pas être faux, puisqu'il ne dépend d'aucune mesure.
 *
 * `onScroll` plutôt que `onMomentumScrollEnd` : le premier est émis partout, y
 * compris sur le web, et il ne sert qu'à **afficher** l'état — plus à décider.
 * Si l'événement manquait, le bandeau défilerait quand même.
 *
 * **Ce qui est perdu** : on ne balaie plus vers le passé. La fenêtre de
 * réservation par défaut est de sept jours, un cours passé ne se réserve pas, et
 * les flèches de jour restent là pour reculer.
 */

export interface WeekStripProps {
  /** Jour affiché, en date locale de la box (`AAAA-MM-JJ`). */
  value: string;
  onChange: (date: string) => void;
  /** Aujourd'hui, en date locale de la box. Marqué différemment du sélectionné. */
  today: string;
}

export function WeekStrip({ value, onChange, today }: WeekStripProps) {
  const theme = useTheme();
  const { t, formatDate, formatWeekday, formatDayOfMonth } = useI18n();

  const [fenetre, setFenetre] = useState(() => fenetreInitiale(value));
  const [largeur, setLargeur] = useState(0);
  const [page, setPage] = useState(0);
  const defilement = useRef<ScrollView | null>(null);

  /**
   * Le jour a changé depuis l'extérieur : la fenêtre se rebase sur sa semaine,
   * et on revient à la première page. **`x = 0` et rien d'autre** — c'est ce qui
   * distingue ce défilement par programme de celui qui a échoué deux fois : il
   * ne dépend ni d'une largeur mesurée, ni d'une taille de contenu connue.
   */
  useEffect(() => {
    setFenetre((actuelle) => {
      const suivante = apresJourChoisi(actuelle, value);
      if (suivante !== actuelle) {
        setPage(0);
        defilement.current?.scrollTo({ x: 0, animated: false });
      }
      return suivante;
    });
  }, [value]);

  const auDefilement = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setPage(pageVisible(event.nativeEvent.contentOffset.x, largeur));
    },
    [largeur],
  );

  const semaines = semainesDeLaFenetre(fenetre);

  return (
    <View
      style={{ gap: theme.space(1) }}
      // **La mesure se prend ici, sur une View ordinaire, et pas sur le
      //     ScrollView.** Le `onLayout` d'un ScrollView n'a pas rendu de
      //     largeur sous React Native Web : les pages restaient à zéro, donc le
      //     contenu ne dépassait jamais la fenêtre, donc **il n'y avait rien à
      //     balayer**. C'était la vraie cause de « le bandeau ne défile pas »,
      //     sous les deux bugs d'état corrigés avant elle.
      onLayout={(event) => setLargeur(event.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={defilement}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={t('planning.week_label')}
        onScroll={auDefilement}
        scrollEventThrottle={32}
        style={{ flexGrow: 0 }}
      >
        {semaines.map((lundi) => (
          <View key={lundi} style={{ width: largeur, flexDirection: 'row', gap: theme.space(1) }}>
            {weekDates(lundi).map((jour) => {
              const selectionne = jour === value;
              const cestAujourdhui = jour === today;

              return (
                <Pressable
                  key={jour}
                  onPress={() => onChange(jour)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectionne }}
                  // **La date entière, et l'état avec.** « lun. 7 » ne dit ni le
                  // mois ni où l'on se trouve : un élément ne se lit pas avec ce
                  // qui l'entoure (`.claude/rules/ui.md`).
                  accessibilityLabel={[
                    formatDate(`${jour}T12:00:00Z`, { style: 'long' }),
                    cestAujourdhui ? t('planning.day_today') : '',
                    selectionne ? t('planning.day_selected') : '',
                  ]
                    .filter((part) => part !== '')
                    .join(', ')}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: theme.space(2),
                    borderRadius: theme.radius.md,
                    minHeight: theme.minTouchTarget,
                    // **Jamais la couleur seule.** Le sélectionné a un fond, le
                    // jour courant un contour : deux marqueurs de formes
                    // différentes, qui se superposent le plus souvent et se
                    // séparent dès qu'on navigue.
                    backgroundColor: selectionne ? theme.colors.primary : 'transparent',
                    borderWidth: cestAujourdhui ? 2 : 0,
                    borderColor: cestAujourdhui ? theme.colors.primary : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color: selectionne ? theme.colors.onPrimary : theme.colors.textMuted,
                      fontSize: theme.typography.small,
                      fontFamily: theme.fontFamily,
                    }}
                  >
                    {formatWeekday(`${jour}T12:00:00Z`)}
                  </Text>
                  <Text
                    style={{
                      color: selectionne ? theme.colors.onPrimary : theme.colors.text,
                      fontSize: theme.typography.body,
                      fontFamily: theme.fontFamily,
                      fontWeight: cestAujourdhui ? '700' : '500',
                    }}
                  >
                    {formatDayOfMonth(`${jour}T12:00:00Z`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* **Où l'on est, en toutes lettres.** Sans ce repère, balayer trois
          semaines en avant donne sept nombres sans mois : on sait qu'on a
          bougé, pas où l'on est arrivé. Il n'a pas de rôle interactif — c'est
          le défilement qui décide, ce texte le raconte. */}
      <Text
        accessibilityRole="header"
        style={{
          textAlign: 'center',
          color: theme.colors.textMuted,
          fontSize: theme.typography.small,
          fontFamily: theme.fontFamily,
        }}
      >
        {t('planning.week_of', {
          date: formatDate(`${semaines[page] ?? fenetre.base}T12:00:00Z`, { style: 'long' }),
        })}
      </Text>
    </View>
  );
}
