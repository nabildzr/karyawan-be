// * Backend module model: src/modules/notifications/model.ts
// & This file defines DTO schemas and TypeScript types for notifications module.
// % File ini mendefinisikan schema DTO dan tipe TypeScript untuk module notifications.

import { t } from "elysia";

export const NotificationCategoryEnum = t.Union([
  t.Literal("ATTENDANCE"),
  t.Literal("POINTS"),
  t.Literal("SCHEDULE"),
  t.Literal("ASSESSMENT"),
  t.Literal("SUBMISSION"),
  t.Literal("GENERAL"),
]);

export const NotificationResponseDTO = t.Object({
  id: t.String(),
  title: t.String(),
  body: t.String(),
  category: t.String(),
  isRead: t.Boolean(),
  readAt: t.Union([t.String(), t.Null()]),
  referenceEntity: t.Union([t.String(), t.Null()]),
  referenceId: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
});

export const PushSubscriptionDTO = t.Object({
  endpoint: t.String(),
  keys: t.Object({
    p256dh: t.String(),
    auth: t.String(),
  }),
});
