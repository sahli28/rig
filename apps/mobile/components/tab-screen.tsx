import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@rack/ui/theme';

export interface TabScreenProps {
  /** Titre d'écran. L'accueil n'en a pas : il porte son propre en-tête. */
  title?: string;
  /** À droite du titre : flèches du planning, par exemple. */
  headerRight?: ReactNode;
  children: ReactNode;
}

/**
 * Le gabarit d'un écran d'onglet : pas d'en-tête de pile (D-009), donc la zone
 * sûre et le titre se posent ici, une fois, au lieu de quatre.
 *
 * **Le titre tronque, il ne casse pas** (`D-038`) : `flex: 1` + une ligne. Les
 * libellés FR sont plus longs que les EN, et c'est ce qui avait découpé la date
 * du planning syllabe par syllabe.
 */
export function TabScreen({ title, headerRight, children }: TabScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.surface }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top + theme.space(3),
        paddingHorizontal: theme.space(4),
        paddingBottom: theme.space(6),
        gap: theme.space(4),
      }}
    >
      {title === undefined ? null : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space(2),
            minHeight: theme.minTouchTarget,
          }}
        >
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={{
              flex: 1,
              color: theme.colors.text,
              fontSize: theme.typography.title,
              fontFamily: theme.fontFamily,
              fontWeight: '800',
              letterSpacing: -0.4,
            }}
          >
            {title}
          </Text>
          {headerRight}
        </View>
      )}
      {children}
    </ScrollView>
  );
}
