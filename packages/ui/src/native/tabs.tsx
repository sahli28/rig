import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from '../theme/index';

export interface TabItem {
  key: string;
  label: string;
}

export interface TabsProps {
  items: readonly TabItem[];
  selectedKey: string;
  onSelect: (key: string) => void;
  /** Libellé du groupe pour les lecteurs d'écran. */
  accessibilityLabel?: string;
}

export function Tabs({ items, selectedKey, onSelect, accessibilityLabel }: TabsProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      {...(accessibilityLabel === undefined ? {} : { accessibilityLabel })}
      contentContainerStyle={{ gap: theme.space(1) }}
    >
      {items.map((item) => {
        const selected = item.key === selectedKey;
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={{
              minHeight: theme.minTouchTarget,
              paddingHorizontal: theme.space(4),
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: selected ? theme.colors.primary : theme.colors.textMuted,
                fontSize: theme.typography.body,
                fontFamily: theme.fontFamily,
                fontWeight: selected ? '700' : '500',
              }}
            >
              {item.label}
            </Text>
            {/* Le soulignement double la couleur : l'onglet actif reste
                identifiable sans percevoir la teinte. */}
            <View
              style={{
                height: 2,
                marginTop: theme.space(1),
                borderRadius: theme.radius.full,
                backgroundColor: selected ? theme.colors.primary : 'transparent',
              }}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
