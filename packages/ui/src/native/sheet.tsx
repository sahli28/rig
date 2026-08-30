import { Modal, Pressable, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '../theme/index';
import { useI18n } from '../i18n/index';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Feuille modale ancrée en bas. Support des gestes natifs : la fermeture par
 * bouton retour Android passe par `onRequestClose`.
 */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' }}
      >
        {/* Le contenu absorbe le tap : seul le voile ferme la feuille. */}
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
            paddingHorizontal: theme.space(4),
            paddingTop: theme.space(3),
            paddingBottom: theme.space(8),
            gap: theme.space(4),
          }}
        >
          <View
            accessible={false}
            style={{
              alignSelf: 'center',
              width: theme.space(10),
              height: 4,
              borderRadius: theme.radius.full,
              backgroundColor: theme.colors.border,
            }}
          />
          <Text
            accessibilityRole="header"
            style={{
              color: theme.colors.text,
              fontSize: theme.typography.title,
              fontFamily: theme.fontFamily,
              fontWeight: '700',
            }}
          >
            {title}
          </Text>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
