import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@rack/ui/theme';
import { useI18n } from '@rack/ui/i18n';
import { Icon, type IconName } from '@rack/ui/native';
import { useSession } from '../../../lib/session';

/**
 * Les quatre portes d'un membre (P2-021).
 *
 * Elles remplacent les trois boutons empilés de l'accueil : une porte qu'on
 * emprunte dix fois par semaine ne se range pas sous un écran, elle reste sous
 * le pouce (§12.1, principe 4).
 *
 * **Zéro tap mort.** La bascule d'onglet est immédiate — l'onglet actif change
 * de couleur au tap, avant toute lecture — et chaque écran monte sur son propre
 * squelette. Ce que le réseau met à répondre ne se voit plus comme un tap perdu.
 *
 * Le groupe `(tabs)` est transparent dans l'URL : `/planning`, `/bookings` et
 * `/preferences` restent les adresses que les liens profonds et les
 * notifications connaissent déjà. La fiche de cours et le pointage restent dans
 * la pile au-dessus, donc ils couvrent la barre — on n'y change pas d'onglet au
 * milieu d'une réservation.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { activeTenantId } = useSession();

  /**
   * **Sans box résolue, pas de barre.** Planning et réservations lisent la box
   * active ; sans elle ils resteraient sur leur squelette — une promesse
   * d'arrivée que rien ne tiendrait. L'accueil cachait déjà ses trois boutons
   * dans ce cas (« une porte qui se ferme est pire que pas de porte ») : la
   * barre hérite de la même règle, sinon elle rouvrait ce que l'accueil fermait.
   */
  const sansBox = activeTenantId === null;

  // Les couleurs viennent du thème, pas du paramètre `color` du navigateur :
  // celui-ci est un `ColorValue` opaque, et le kit ne prend que des tokens.
  const icone = (name: IconName) =>
    function IconeDOnglet({ focused }: { focused: boolean }) {
      return (
        <Icon
          name={name}
          size={22}
          color={focused ? theme.colors.primary : theme.colors.textMuted}
        />
      );
    };

  /**
   * Le libellé accessible est **explicite** : lu dans l'arbre d'accessibilité du
   * harnais, un onglet sans lui s'annonçait « tab », sans nom — le titre visible
   * ne suffisait pas.
   */
  const onglet = (
    cle: 'tabs.home' | 'tabs.planning' | 'tabs.bookings' | 'tabs.profile',
    name: IconName,
  ) => ({ title: t(cle), tabBarAccessibilityLabel: t(cle), tabBarIcon: icone(name) });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          display: sansBox ? 'none' : 'flex',
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          // La cible reste ≥ 48 quelle que soit la hauteur de la zone sûre.
          height: theme.minTouchTarget + theme.space(3) + insets.bottom,
          paddingTop: theme.space(1),
        },
        tabBarLabelStyle: {
          fontFamily: theme.fontFamily,
          fontSize: theme.typography.caption,
          fontWeight: '600',
        },
        sceneStyle: { backgroundColor: theme.colors.surface },
      }}
    >
      <Tabs.Screen name="index" options={onglet('tabs.home', 'home')} />
      <Tabs.Screen name="planning" options={onglet('tabs.planning', 'calendar')} />
      <Tabs.Screen name="bookings" options={onglet('tabs.bookings', 'bookmark')} />
      <Tabs.Screen name="preferences" options={onglet('tabs.profile', 'user')} />
    </Tabs>
  );
}
