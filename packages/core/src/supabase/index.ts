export type { Database, Json } from './types.gen';
export { createRigClient, readSupabaseConfig, type RigClient, type SupabaseConfig } from './client';
export {
  chunkedStore,
  splitIntoChunks,
  type ChunkedStoreOptions,
  type KeyValueStore,
} from './chunked-storage';
export {
  chooseActiveTenant,
  findMembershipBySlug,
  fetchMe,
  hasRequiredAction,
  BookingRulesSchema,
  CurrentTenantSchema,
  MembershipSchema,
  MeSchema,
  MeUserSchema,
  TenantThemeSchema,
  MEMBERSHIP_ROLES,
  MEMBERSHIP_STATUSES,
  REQUIRED_ACTIONS,
  type BookingRules,
  type CurrentTenant,
  type Me,
  type Membership,
  type RequiredAction,
  type TenantTheme,
} from './me';
export {
  DirectoryRowSchema,
  INVITATION_STATES,
  createInvitation,
  displayName,
  filterDirectory,
  grantableRoles,
  invitationState,
  removeMember,
  setMemberRole,
  type DirectoryFilter,
  type DirectoryRow,
  type InvitationState,
} from './staff';

export {
  acceptInvitation,
  fetchTenantPublicProfile,
  InvitationPreviewSchema,
  TenantPublicProfileSchema,
  fetchInvitationPreview,
  invitationAcceptsEmail,
  type InvitationPreview,
  type TenantPublicProfile,
} from './tenant';
export {
  fetchPolicyVersion,
  isPlatformConsent,
  recordConsents,
  updateProfile,
  CONSENT_PURPOSES,
  PLATFORM_CONSENT_PURPOSES,
  ProfilePatchSchema,
  type ConsentChoice,
  type ConsentPurpose,
  type ProfilePatch,
  type RecordConsentsInput,
} from './profile';
export {
  BoxAppearanceSchema,
  FONT_OPTIONS,
  UNCONFIGURED_BOX_PRIMARY,
  fontOptions,
  type BoxAppearance,
} from './appearance';

export {
  BookingRulesPatchSchema,
  BoxIdentitySchema,
  ClassTypePatchSchema,
  DEFAULT_CLASS_TYPE_COLOR,
  LocalizedTextSchema,
  LocationPatchSchema,
  OpeningHourSchema,
  RoomPatchSchema,
  TIME_ZONE_OPTIONS,
  WEEKDAYS,
  isSupportedTimeZone,
  localizedText,
  normalizeTime,
  overlappingSlots,
  timeZoneOptions,
  type BookingRulesPatch,
  type BoxIdentity,
  type ClassTypePatch,
  type LocalizedText,
  type LocationPatch,
  type OpeningHour,
  type RoomPatch,
  type Weekday,
} from './box-settings';

export {
  tenantScope,
  type TenantInsert,
  type TenantScope,
  type TenantScopedRelation,
  type TenantScopedTable,
  type TenantScopedView,
} from './active-tenant';
