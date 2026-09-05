import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@rack/ui/theme';
import { useI18n } from '@rack/ui/i18n';
import {
  estDansLe,
  moisDe,
  moisPrecedent,
  moisSuivant,
  peutReculer,
  premierJourDu,
  semainesDu,
} from './month-grid-state';

/**
 * Le calendrier du mois du planning (P1-014).
 *
 * **Il remplace le bandeau de semaine**, et pas pour une raison esthétique : le
 * bandeau répondait à « quel jour est-ce que j'ouvre ? », la grille répond en
 * plus à « **qu'est-ce que j'ai réservé ce mois-ci ?** ». La seconde question
 * porte sur le passé, que le bandeau refusait par conception.
 *
 * **Ici et pas dans `packages/ui`** : un seul écran l'utilise (`CLAUDE.md`,
 * conventions). Il déménagera le jour où un second en veut un.
 *
 * **Rien n'est préchargé.** Rendre trente jours atteignables ne veut pas dire
 * les charger : ce composant n'importe aucun lecteur de planning, il ne *peut*
 * pas. Seuls les **jours réservés** du mois arrivent d'en haut, en une requête.
 *
 * ---
 *
 * **Aucun état à tenir d'accord avec un défilement, et c'est délibéré.**
 *
 * Le bandeau qu'il remplace a coûté trois essais, tous sur ce point : une
 * « semaine regardée » qu'il fallait garder d'accord avec une position de
 * défilement, à travers des événements de geste que le harnais n'émet pas. La
 * grille est **statique** — le mois affiché est une chaîne, les flèches en
 * changent, rien ne défile. Ce qui a coûté trois essais là-bas est gratuit ici.
 *
 * Si un balayage de mois arrive un jour, il reprend la règle de P1-011 : la
 * position **est** la vérité, et rien ne défile par programme.
 */

export interface MonthCalendarProps {
  /** Jour affiché, en date locale de la box (`AAAA-MM-JJ`). */
  value: string;
  onChange: (date: string) => void;
  /** Le mois affiché. Il suit le jour choisi, et les flèches le déplacent seul. */
  mois: string;
  onMoisChange: (mois: string) => void;
  /** Aujourd'hui, en date locale de la box. Marqué **autrement** que le sélectionné. */
  today: string;
  /** Jour → nombre de réservations confirmées. Le compte sert à l’étiquette. */
  joursReserves: Readonly<Record<string, number>>;
  /** Mois d'adhésion (`AAAA-MM`), borne basse de la navigation. `null` si inconnu. */
  moisDAdhesion: string | null;
}

export function MonthCalendar({
  value,
  onChange,
  mois,
  onMoisChange,
  today,
  joursReserves,
  moisDAdhesion,
}: MonthCalendarProps) {
  const theme = useTheme();
  const { t, formatDate, formatMonth, formatWeekday, formatDayOfMonth } = useI18n();

  const semaines = semainesDu(mois);
  const reculPossible = peutReculer(mois, moisDAdhesion);

  // Les en-têtes viennent de la **première semaine affichée**, pas d'une liste
  // écrite à la main : sept libellés recopiés, c'est sept libellés à traduire
  // deux fois et à garder dans le bon ordre. Ils sortent d'`Intl`, comme les
  // jours eux-mêmes.
  const enTetes = semaines[0] ?? [];

  return (
    <View style={{ gap: theme.space(2) }}>
      {/* Le titre du mois et ses flèches. Comme pour les jours, « ‹ » et « › »
          ne sont pas des mots à l'oreille (§12.4) : les boutons portent un
          libellé, pas un chevron. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space(2) }}>
        <Pressable
          onPress={() => onMoisChange(moisPrecedent(mois))}
          disabled={!reculPossible}
          accessibilityRole="button"
          accessibilityState={{ disabled: !reculPossible }}
          // **Une flèche désactivée dit pourquoi.** Sans cette phrase, la
          // navigation s'arrête sans raison visible — et « rien ne se passe »
          // est le pire des retours (`.claude/rules/ui.md`).
          accessibilityLabel={
            reculPossible
              ? t('planning.previous_month')
              : t('planning.month_start_limit', {
                  date: formatMonth(`${premierJourDu(moisDAdhesion ?? mois)}T12:00:00Z`),
                })
          }
          accessibilityHint={
            reculPossible
              ? undefined
              : t('planning.month_start_limit', {
                  date: formatMonth(`${premierJourDu(moisDAdhesion ?? mois)}T12:00:00Z`),
                })
          }
          style={{
            minHeight: theme.minTouchTarget,
            minWidth: theme.minTouchTarget,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: reculPossible ? 1 : 0.35,
          }}
        >
          <Text
            style={{
              color: theme.colors.primary,
              fontSize: theme.typography.body,
              fontFamily: theme.fontFamily,
            }}
          >
            {'‹'}
          </Text>
        </Pressable>

        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            textAlign: 'center',
            color: theme.colors.text,
            fontSize: theme.typography.body,
            fontFamily: theme.fontFamily,
            fontWeight: '600',
          }}
        >
          {formatMonth(`${premierJourDu(mois)}T12:00:00Z`)}
        </Text>

        <Pressable
          onPress={() => onMoisChange(moisSuivant(mois))}
          accessibilityRole="button"
          accessibilityLabel={t('planning.next_month')}
          style={{
            minHeight: theme.minTouchTarget,
            minWidth: theme.minTouchTarget,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: theme.colors.primary,
              fontSize: theme.typography.body,
              fontFamily: theme.fontFamily,
            }}
          >
            {'›'}
          </Text>
        </Pressable>
      </View>

      {/* Les en-têtes de colonnes. `accessibilityElementsHidden` : un lecteur
          d'écran qui parcourt la grille annonce déjà la date entière sur chaque
          case — relire « L. M. M. J. V. S. D. » avant n'apporte rien et fait
          sept arrêts de plus. */}
      <View
        style={{ flexDirection: 'row' }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {enTetes.map((jour) => (
          <Text
            key={jour}
            style={{
              flex: 1,
              textAlign: 'center',
              color: theme.colors.textMuted,
              fontSize: theme.typography.small,
              fontFamily: theme.fontFamily,
            }}
          >
            {formatWeekday(`${jour}T12:00:00Z`)}
          </Text>
        ))}
      </View>

      <View accessibilityLabel={t('planning.month_label')} style={{ gap: theme.space(1) }}>
        {semaines.map((semaine) => (
          <View key={semaine[0]} style={{ flexDirection: 'row' }}>
            {semaine.map((jour) => {
              const selectionne = jour === value;
              const cestAujourdhui = jour === today;
              const dansLeMois = estDansLe(mois, jour);
              const reservations = joursReserves[jour] ?? 0;

              return (
                <Pressable
                  key={jour}
                  // Toucher un jour d'un mois voisin y emmène : la case est
                  // affichée, donc elle est atteignable. Une case visible et
                  // inerte est une porte peinte sur un mur.
                  onPress={() => onChange(jour)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectionne }}
                  // **La date entière, l'état, et la pastille en toutes
                  // lettres.** Un point est un marqueur visuel : sans cette
                  // phrase, l'information n'existe que pour qui voit l'écran
                  // (`.claude/rules/ui.md`, §12.4).
                  accessibilityLabel={[
                    formatDate(`${jour}T12:00:00Z`, { style: 'long' }),
                    cestAujourdhui ? t('planning.day_today') : '',
                    selectionne ? t('planning.day_selected') : '',
                    reservations > 0 ? t('planning.day_bookings', { count: reservations }) : '',
                  ]
                    .filter((part) => part !== '')
                    .join(', ')}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: theme.space(1),
                    minHeight: theme.minTouchTarget,
                    justifyContent: 'center',
                  }}
                >
                  {/* Le disque du jour choisi. **Deux marqueurs de formes
                      différentes** : le sélectionné a un fond plein, le jour
                      courant un contour. La capture qui a servi de référence les
                      confond ; nous non — ils se superposent le plus souvent et
                      se séparent dès qu'on navigue, et c'est justement là qu'il
                      faut pouvoir les distinguer. */}
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selectionne ? theme.colors.primary : 'transparent',
                      borderWidth: cestAujourdhui && !selectionne ? 2 : 0,
                      borderColor: cestAujourdhui ? theme.colors.primary : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        color: selectionne
                          ? theme.colors.onPrimary
                          : dansLeMois
                            ? theme.colors.text
                            : theme.colors.textMuted,
                        fontSize: theme.typography.body,
                        fontFamily: theme.fontFamily,
                        fontWeight: cestAujourdhui ? '700' : '400',
                        // Les jours des mois voisins sont là pour que la semaine
                        // reste une semaine, pas pour être lus.
                        opacity: dansLeMois ? 1 : 0.4,
                      }}
                    >
                      {formatDayOfMonth(`${jour}T12:00:00Z`)}
                    </Text>
                  </View>

                  {/* La pastille — **sous** le disque, jamais dedans : posée à
                      l'intérieur, elle disparaîtrait sous le fond plein du jour
                      sélectionné, c'est-à-dire exactement le jour qu'on regarde.
                      Une hauteur réservée en permanence, sinon les lignes
                      sautent selon le nombre de réservations. */}
                  <View style={{ height: 6, justifyContent: 'center' }}>
                    {reservations > 0 ? (
                      <View
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: theme.colors.primary,
                        }}
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Le mois d'un jour — réexporté pour que l'écran n'importe qu'un module. */
export { moisDe };
