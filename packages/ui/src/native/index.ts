/**
 * Point d'entrée `@rack/ui/native` — kit de composants React Native.
 *
 * Réservé à `apps/mobile`. Le web consomme les mêmes tokens via
 * `@rack/ui/theme` et ses variables CSS, sans embarquer React Native
 * (cf. spec §12.2 : sur le web, on s'appuie sur une base accessible existante).
 */

export { Avatar, type AvatarProps, type AvatarSize } from './avatar';
export { initialsOf } from './initials';
export { Badge, type BadgeProps, type BadgeTone } from './badge';
export { Banner, type BannerProps, type BannerTone } from './banner';
export { Button, type ButtonProps, type ButtonVariant } from './button';
export { Card, type CardProps } from './card';
export { EmptyState, type EmptyStateProps } from './empty-state';
export { IconButton, type IconButtonProps } from './icon-button';
export { Input, type InputProps } from './input';
export { ListRow, type ListRowProps } from './list-row';
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedOption,
} from './segmented-control';
export { Select, type SelectProps, type SelectOption } from './select';
export { Sheet, type SheetProps } from './sheet';
export { Skeleton, type SkeletonProps } from './skeleton';
export { Switch, type SwitchProps } from './switch';
export { Tabs, type TabsProps, type TabItem } from './tabs';
export { Toast, type ToastProps, type ToastTone } from './toast';
export { useReducedMotion } from './use-reduced-motion';
