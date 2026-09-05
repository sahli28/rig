import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useTheme } from '@rack/ui/theme';
import { useI18n } from '@rack/ui/i18n';
import { shiftWeeks, weekDates } from '@rack/core/supabase';
import { apresBalayage, apresJourChoisi, etatInitial } from './week-strip-state';

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

  /**
   * **L'état vit dans un module à part, et c'est le correctif autant que le
   * test.** Tant que la logique était ici, elle n'était atteignable que par un
   * geste, donc par un appareil. `week-strip-state.ts` n'importe rien de React
   * Native : ses deux transitions se testent sous Vitest, et ce sont elles qui
   * portaient le défaut.
   */
  const [etat, setEtat] = useState(() => etatInitial(value));
  const { lundi } = etat;
  const [largeur, setLargeur] = useState(0);
  const defilement = useRef<ScrollView | null>(null);

  /**
   * **La semaine regardée et la semaine du jour choisi sont deux choses**, et
   * tout ce composant tient dans cette distinction.
   *
   * Le jour peut changer sans passer par ici — les flèches de l'écran,
   * « Revenir à aujourd'hui » — et la semaine doit alors suivre. Mais un
   * balayage pose **délibérément** une semaine différente de celle du jour
   * choisi : glisser pour regarder n'est pas choisir.
   *
   * La première version réconciliait sur le **désaccord** (`si semaine !==
   * lundi`), ce qui tenait toute divergence pour une erreur — donc annulait le
   * balayage au rendu suivant. Le geste s'effaçait lui-même : la semaine
   * changeait pour une image, puis revenait. Trouvé sur iPhone le 5 septembre
   * 2026.
   *
   * On réagit donc au **changement de `value`**, jamais à l'écart entre les
   * deux. Le `ref` est ce qui distingue « la valeur a changé » de « les deux ne
   * coïncident pas » — un état dérivé ne saurait pas faire la différence.
   */
  useEffect(() => {
    setEtat((actuel) => apresJourChoisi(actuel, value));
  }, [value]);

  /**
   * Recentrer sur la page du milieu, sans animation.
   *
   * C'est ce qui donne un carrousel sans fin avec trois pages : on glisse vers
   * une page voisine, on change de semaine, et on se repose au centre — le
   * déplacement est invisible parce qu'il a lieu au même instant que le nouveau
   * rendu.
   *
   * **Et c'est le seul mécanisme.** La première version passait aussi un
   * `contentOffset`, qui a l'air de faire le travail et ne le fait pas : il est
   * calculé avec `largeur`, qui vaut **0 au premier rendu**, et sur iOS ce n'est
   * qu'une valeur *initiale* — jamais réappliquée quand la largeur arrive. Il
   * posait donc l'offset à zéro, c'est-à-dire sur la **semaine précédente**, et
   * seul cet effet rattrapait. Une prop qui ne fait rien mais qui a l'air de
   * faire quelque chose est pire qu'une prop absente : elle détourne la
   * relecture. Retirée.
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
      setEtat((actuel) => apresBalayage(actuel, page - PAGE_COURANTE));
    },
    [largeur],
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
