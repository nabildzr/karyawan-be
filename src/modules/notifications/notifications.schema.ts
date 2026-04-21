// * Backend module schema: src/modules/notifications/notifications.schema.ts
// & This file defines DTO schemas and TypeScript types for notifications module.
// % File ini mendefinisikan schema DTO dan tipe TypeScript untuk module notifications.

import { t } from "elysia";

/** Mengekspor NotificationCategoryEnum untuk kebutuhan modul ini. */
export const NotificationCategoryEnum = t.Union([
  t.Literal("ATTENDANCE"),
  t.Literal("POINTS"),
  t.Literal("SCHEDULE"),
  t.Literal("ASSESSMENT"),
  t.Literal("SUBMISSION"),
  t.Literal("GENERAL"),
]);

/** Mengekspor NotificationListQueryDTO untuk kebutuhan modul ini. */
export const NotificationListQueryDTO = t.Object({
  page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
  limit: t.Optional(t.Numeric({ default: 20, minimum: 1, maximum: 100 })),
  category: t.Optional(NotificationCategoryEnum),
  isRead: t.Optional(t.Union([t.Boolean(), t.String()])),
});

/** Mengekspor NotificationReadParamsDTO untuk kebutuhan modul ini. */
export const NotificationReadParamsDTO = t.Object({
  id: t.String(),
});

/** Mengekspor NotificationUnsubscribeDTO untuk kebutuhan modul ini. */
export const NotificationUnsubscribeDTO = t.Object({
  endpoint: t.String(),
});

/** Mengekspor PushSubscriptionDTO untuk kebutuhan modul ini. */
export const PushSubscriptionDTO = t.Object({
  endpoint: t.String(),
  keys: t.Object({
    p256dh: t.String(),
    auth: t.String(),
  }),
  userAgent: t.Optional(t.String()),
});

/** Mengekspor NotificationCreateDTO untuk kebutuhan modul ini. */
export const NotificationCreateDTO = t.Object({
  userId: t.String(),
  title: t.String({ minLength: 1 }),
  body: t.String({ minLength: 1 }),
  category: NotificationCategoryEnum,
  referenceEntity: t.Optional(t.String()),
  referenceId: t.Optional(t.String()),
});

/** Mengekspor NotificationResponseDTO untuk kebutuhan modul ini. */
export const NotificationResponseDTO = t.Object({
  id: t.String(),
  title: t.String(),
  body: t.String(),
  category: NotificationCategoryEnum,
  isRead: t.Boolean(),
  readAt: t.Union([t.String(), t.Null()]),
  referenceEntity: t.Union([t.String(), t.Null()]),
  referenceId: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
});

/** Mengekspor NotificationListMetaDTO untuk kebutuhan modul ini. */
export const NotificationListMetaDTO = t.Object({
  totalItems: t.Number(),
  itemsPerPage: t.Number(),
  currentPage: t.Number(),
  totalPages: t.Number(),
});

/** Mengekspor NotificationListResponseDTO untuk kebutuhan modul ini. */
export const NotificationListResponseDTO = t.Object({
  data: t.Array(NotificationResponseDTO),
  meta: NotificationListMetaDTO,
});

/** Mengekspor PublicVapidKeyDTO untuk kebutuhan modul ini. */
export const PublicVapidKeyDTO = t.Object({
  publicKey: t.String(),
});

/** Mengekspor UnreadCountDTO untuk kebutuhan modul ini. */
export const UnreadCountDTO = t.Object({
  count: t.Number(),
});

/** Mengekspor PushSubscriptionRecordDTO untuk kebutuhan modul ini. */
export const PushSubscriptionRecordDTO = t.Object({
  id: t.String(),
  userId: t.String(),
  endpoint: t.String(),
  p256dh: t.String(),
  auth: t.String(),
  userAgent: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
  updatedAt: t.String(),
});

/** Mendefinisikan alias tipe untuk NotificationCategoryPayload. */
export type NotificationCategoryPayload = typeof NotificationCategoryEnum.static;

/** Mendefinisikan alias tipe untuk NotificationListQueryPayload. */
export type NotificationListQueryPayload = typeof NotificationListQueryDTO.static;

/** Mendefinisikan alias tipe untuk NotificationReadParamsPayload. */
export type NotificationReadParamsPayload = typeof NotificationReadParamsDTO.static;

/** Mendefinisikan alias tipe untuk NotificationUnsubscribePayload. */
export type NotificationUnsubscribePayload = typeof NotificationUnsubscribeDTO.static;

/** Mendefinisikan alias tipe untuk PushSubscriptionPayload. */
export type PushSubscriptionPayload = typeof PushSubscriptionDTO.static;

/** Mendefinisikan alias tipe untuk NotificationCreatePayload. */
export type NotificationCreatePayload = typeof NotificationCreateDTO.static;

/** Mendefinisikan alias tipe untuk NotificationResponsePayload. */
export type NotificationResponsePayload = typeof NotificationResponseDTO.static;

/** Mendefinisikan alias tipe untuk NotificationListMetaPayload. */
export type NotificationListMetaPayload = typeof NotificationListMetaDTO.static;

/** Mendefinisikan alias tipe untuk NotificationListResponsePayload. */
export type NotificationListResponsePayload = typeof NotificationListResponseDTO.static;

/** Mendefinisikan alias tipe untuk PublicVapidKeyPayload. */
export type PublicVapidKeyPayload = typeof PublicVapidKeyDTO.static;

/** Mendefinisikan alias tipe untuk UnreadCountPayload. */
export type UnreadCountPayload = typeof UnreadCountDTO.static;

/** Mendefinisikan alias tipe untuk PushSubscriptionRecordPayload. */
export type PushSubscriptionRecordPayload = typeof PushSubscriptionRecordDTO.static;