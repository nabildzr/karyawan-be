// * File ini berisi schema validasi DTO untuk modul helpdesk (ticketing).

import { t } from "elysia";

// ──────────────────────────────────────────
// & Enums
// ──────────────────────────────────────────

export const TicketPriorityEnum = t.Union([
  t.Literal("LOW"),
  t.Literal("MEDIUM"),
  t.Literal("HIGH"),
]);

export const TicketStatusEnum = t.Union([
  t.Literal("OPEN"),
  t.Literal("IN_PROGRESS"),
  t.Literal("CLOSED"),
]);

// ──────────────────────────────────────────
// & Request DTOs
// ──────────────────────────────────────────

export const TicketCreateDTO = t.Object({
  subject: t.String({ minLength: 5, maxLength: 255 }),
  description: t.String({ minLength: 10 }),
  priority: t.Optional(TicketPriorityEnum),
});

export const TicketListQueryDTO = t.Object({
  status: t.Optional(TicketStatusEnum),
  priority: t.Optional(TicketPriorityEnum),
  page: t.Optional(t.Number({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 1000, default: 20 })),
});

export const TicketSimilarityQueryDTO = t.Object({
  subject: t.Optional(t.String({ maxLength: 255 })),
  description: t.Optional(t.String()),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 20, default: 5 })),
});

export const TicketIdParamsDTO = t.Object({
  id: t.String(),
});

export const TicketRespondDTO = t.Object({
  message: t.String({ minLength: 1 }),
  isAutoReply: t.Optional(t.Boolean()),
});

export const TicketStatusUpdateDTO = t.Object({
  status: t.Union([t.Literal("IN_PROGRESS"), t.Literal("CLOSED")]),
  operatorId: t.Optional(t.String()),
});

export const TicketAutoReplyUpdateDTO = t.Object({
  autoReplyText: t.String({ minLength: 1, maxLength: 5000 }),
});

export const TicketRatingDTO = t.Object({
  score: t.Number({ minimum: 1, maximum: 5 }),
  feedback: t.Optional(t.String()),
});

// ──────────────────────────────────────────
// & TypeScript inferred types
// ──────────────────────────────────────────

export type TicketCreatePayload = typeof TicketCreateDTO.static;
export type TicketRespondPayload = typeof TicketRespondDTO.static;
export type TicketStatusUpdatePayload = typeof TicketStatusUpdateDTO.static;
export type TicketAutoReplyUpdatePayload = typeof TicketAutoReplyUpdateDTO.static;
export type TicketRatingPayload = typeof TicketRatingDTO.static;
export type TicketListQuery = typeof TicketListQueryDTO.static;
export type TicketSimilarityQuery = typeof TicketSimilarityQueryDTO.static;
