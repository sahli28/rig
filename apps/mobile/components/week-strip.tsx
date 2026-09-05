import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useTheme } from '@rack/ui/theme';
import { useI18n } from '@rack/ui/i18n';
import { mondayOf, shiftWeeks, weekDates } from '@rack/core/supabase';

/**
 * Le bandeau de semaine du planning (P1-011).
 *
 * **Sept jours, un tap.** Atteindre samedi depuis mercredi coûtait jusqu'à trois
 * taps sur une flèche, chacun déclenchant un chargement. C'est le geste le plus
 * fréquent du produit, et c'était le plus lent.
 *
 * **Ici et pas dans `packages/ui`** : un seul écran l'utilise
 * (`CLAUDE.md`, conventions). Il déménagera le jour où un second en veut un —
 * pas avant, sinon on conçoit une abstraction pour un cas.
 *
 * **Rien n'est préchargé.** Rendre sept jours atteignables ne veut pas dire les
 * charger : chaque jour visité écrit une entrée de cache
 * `(utilisateur, box, jour)`, et précharger une semaine en écrirait sept, dont
 * six que personne n'a regardées — pour économiser une demi-seconde, et en
 * rendant `D-011` sept fois plus long.
 *
 * **Le balayage n'est pas le seul chemin.** Les flèches de jour restent dans
 * l'écran : un balayage n'a d'équivalent ni au clavier ni au contrôle vocal, et
 * ce composant serait sinon inaccessible à qui ne fait pas glisser son doigt.
 */

export interface WeekStripProps {
  /** Jour affiché, en date locale de la box (`AAAA-MM-JJ`). */
  value: string;
  onChange: (date: string) => void;
  /** Aujourd'hui, en date locale de la box. Marqué différemment du sélectionné. */
  today: string;
}

/** Semaine précédente, courante, suivante : les trois pages du carrousel. */
const PAGES = [-1, 0, 1] as const;
const PAGE_COURANTE = 1;

export function WeekStrip({ value, onChange, today }: WeekStripProps) {
  const theme = useTheme();
  const { t, formatDate, formatWeekday, formatDayOfMonth } = useI18n();

  const [lundi, setLundi] = useState(() => mondayOf(value));
  const [largeur, setLargeur] = useState(0);
  const defilement = useRef<ScrollView | null>(null);

  /**
   * Le jour peut changer sans passer par ce composant — les flèches de l'écran,
   * « Revenir à aujourd'hui ». La semaine suit alors, sans animation : ce n'est
   * pas un geste de l'utilisateur sur le bandeau, c'est une conséquence.
   */
  useEffect(() => {
    const semaine = mondayOf(value);
    if (semaine !== lundi) setLundi(semaine);
  }, [value, lundi]);

  /**
   * Recentrer sur la page du milieu, sans animation.
   *
   * C'est ce qui donne un carrousel sans fin avec trois pages : on glisse vers
   * une page voisine, on change de semaine, et on se repose au centre — le
   * déplacement est invisible parce qu'il a lieu au même instant que le nouveau
   * rendu.
   */
  const recentrer = useCallback(() => {
    if (largeur === 0) return;
    defilement.current?.scrollTo({ x: largeur * PAGE_COURANTE, animated: false });
  }, [largeur]);

  useEffect(recentrer, [recentrer, lundi]);

  const finDeBalayage = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (largeur === 0) return;
      const page = Math.round(event.nativeEvent.contentOffset.x / largeur);
      if (page === PAGE_COURANTE) return;
      // On change de **semaine**, pas de jour : le jour affiché ne bouge que
      // sur un tap. Glisser pour regarder n'est pas choisir.
      setLundi(shiftWeeks(lundi, page - PAGE_COURANTE));
    },
    [largeur, lundi],
  );

  return (
    <ScrollView
      ref={defilement}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={t('planning.week_label')}
      onLayout={(event) => setLargeur(event.nativeEvent.layout.width)}
      onMomentumScrollEnd={finDeBalayage}
      contentOffset={{ x: largeur * PAGE_COURANTE, y: 0 }}
      style={{ flexGrow: 0 }}
    >
      {PAGES.map((decalage) => (
        <View key={decalage} style={{ width: largeur, flexDirection: 'row', gap: theme.space(1) }}>
          {weekDates(shiftWeeks(lundi, decalage)).map((jour) => {
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
  );
}
