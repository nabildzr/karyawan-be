import { t } from "elysia";
/** Mengekspor SubmissionTypeEnum untuk kebutuhan modul ini. */
export const SubmissionTypeEnum = t.Union([
  t.Literal("IZIN_SAKIT"),
  t.Literal("IZIN_KHUSUS"),
  t.Literal("DINAS_LUAR"),
  t.Literal("LEMBUR"),
]);

/** Mengekspor SubmissionStatusEnum untuk kebutuhan modul ini. */
export const SubmissionStatusEnum = t.Union([
  t.Literal("PENDING"),
  t.Literal("APPROVED"),
  t.Literal("REJECTED"),
]);

/** Mengekspor SubmissionCreateDTO untuk kebutuhan modul ini. */
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

/** Mengekspor SubmissionStatusUpdateDTO untuk kebutuhan modul ini. */
export const SubmissionStatusUpdateDTO = t.Object({
  status: t.Union([t.Literal("APPROVED"), t.Literal("REJECTED")]),
  rejectionReason: t.Optional(t.String()),
});

/** Mendefinisikan alias tipe untuk SubmissionsCreatePayload. */
export type SubmissionsCreatePayload = typeof SubmissionCreateDTO.static;
/** Mendefinisikan alias tipe untuk SubmissionStatusUpdatePayload. */
export type SubmissionStatusUpdatePayload =
  typeof SubmissionStatusUpdateDTO.static;
