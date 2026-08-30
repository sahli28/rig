import { Image, Text, View } from 'react-native';
import { useTheme } from '../theme/index';
import { initialsOf } from './initials';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  /** Sert à calculer les initiales et le libellé accessible. */
  name: string;
  uri?: string | null;
  size?: AvatarSize;
}

const DIAMETER: Record<AvatarSize, number> = { sm: 32, md: 44, lg: 64 };

export function Avatar({ name, uri, size = 'md' }: AvatarProps) {
  const theme = useTheme();
  const diameter = DIAMETER[size];

  const shape = {
    width: diameter,
    height: diameter,
    borderRadius: theme.radius.full,
  } as const;

  if (uri !== undefined && uri !== null && uri !== '') {
    return (
      <Image
        source={{ uri }}
        style={[shape, { backgroundColor: theme.colors.surface2 }]}
        accessibilityRole="image"
        accessibilityLabel={name}
      />
    );
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        shape,
        {
          backgroundColor: theme.colors.surface2,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: diameter / 2.6,
          fontFamily: theme.fontFamily,
          fontWeight: '600',
        }}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}
