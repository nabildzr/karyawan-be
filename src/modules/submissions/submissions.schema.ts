import { t } from "elysia";

export const SubmissionTypeEnum = t.Union([
  t.Literal("IZIN_SAKIT"),
  t.Literal("IZIN_KHUSUS"),
  t.Literal("DINAS_LUAR"),
  t.Literal("LEMBUR"),
]);

export const SubmissionStatusEnum = t.Union([
  t.Literal("PENDING"),
  t.Literal("APPROVED"),
  t.Literal("REJECTED"),
]);

export const SubmissionCreateDTO = t.Object({
  type: SubmissionTypeEnum,
  startDate: t.String({ format: "date" }),
  endDate: t.String({ format: "date" }),
  reason: t.String({ minLength: 3 }),
  attachmentFile: t.Optional(
    t.File({
      type: ["application/pdf", "image/jpeg", "image/png"],
      maxSize: 10 * 1024 * 1024,
    }),
  ),
});

export const SubmissionStatusUpdateDTO = t.Object({
  status: t.Union([t.Literal("APPROVED"), t.Literal("REJECTED")]),
  rejectionReason: t.Optional(t.String()),
});

export const SubmissionListQueryDTO = t.Object({
  page: t.Optional(t.Number({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
  status: t.Optional(SubmissionStatusEnum),
  type: t.Optional(SubmissionTypeEnum),
  search: t.Optional(t.String()),
});

export const SubmissionMineQueryDTO = t.Object({
  page: t.Optional(t.Number({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
  status: t.Optional(SubmissionStatusEnum),
  type: t.Optional(SubmissionTypeEnum),
});

export const SubmissionIdParamsDTO = t.Object({ id: t.String() });

export type SubmissionsCreatePayload = typeof SubmissionCreateDTO.static;
export type SubmissionStatusUpdatePayload =
  typeof SubmissionStatusUpdateDTO.static;
