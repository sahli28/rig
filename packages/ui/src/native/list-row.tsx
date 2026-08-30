import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '../theme/index';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Zone de gauche : avatar, pastille horaire, icône. */
  leading?: ReactNode;
  /** Zone de droite : badge, chevron, compteur de places. */
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  disabled = false,
  style,
}: ListRowProps) {
  const theme = useTheme();

  const content = (
    <>
      {leading}
      <View style={{ flex: 1, gap: theme.space(1) }}>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: theme.typography.body,
            fontFamily: theme.fontFamily,
            fontWeight: '500',
          }}
        >
          {title}
        </Text>
        {subtitle === undefined ? null : (
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.typography.small,
              fontFamily: theme.fontFamily,
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
    </>
  );

  const base: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    minHeight: theme.minTouchTarget,
    paddingVertical: theme.space(3),
    paddingHorizontal: theme.space(4),
    opacity: disabled ? 0.5 : 1,
  };

  if (onPress === undefined) {
    return <View style={[base, style]}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={subtitle === undefined ? title : `${title}, ${subtitle}`}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        base,
        { backgroundColor: pressed ? theme.colors.surface2 : 'transparent' },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}
