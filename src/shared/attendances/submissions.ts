// * File shared attendances: submissions.ts
// & This module resolves submission records that block attendance operations.
// % Modul ini menangani record pengajuan yang memblokir operasi absensi.
import prisma from "../../config/prisma";

// & Default statuses/types considered as blockers in attendance flow.
// % Status/tipe default yang dianggap memblokir dalam flow absensi.
/** Mengekspor BLOCKING_SUBMISSION_STATUSES untuk kebutuhan modul ini. */
export const BLOCKING_SUBMISSION_STATUSES = ["PENDING"] as const;
/** Mengekspor BLOCKING_SUBMISSION_TYPES untuk kebutuhan modul ini. */
export const BLOCKING_SUBMISSION_TYPES = [
  "IZIN_SAKIT",
  "IZIN_KHUSUS",
  "DINAS_LUAR",
  "LEMBUR",
] as const;

/** Mendefinisikan alias tipe untuk BlockingSubmissionStatus. */
export type BlockingSubmissionStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

/** Mendefinisikan alias tipe untuk BlockingSubmissionType. */
export type BlockingSubmissionType =
  | "IZIN_SAKIT"
  | "IZIN_KHUSUS"
  | "DINAS_LUAR"
  | "LEMBUR"

/** Mendefinisikan alias tipe untuk BlockingSubmissionOptions. */
export type BlockingSubmissionOptions = {
  statuses?: BlockingSubmissionStatus[];
  types?: BlockingSubmissionType[];
};

// & Convert submission type enum into readable Indonesian label.
// % Konversi enum tipe pengajuan menjadi label Indonesia yang mudah dibaca.
/** Mengekspor formatSubmissionTypeLabel untuk kebutuhan modul ini. */
export const formatSubmissionTypeLabel = (type: string) => {
  if (type === "IZIN_SAKIT") return "izin sakit";
  if (type === "IZIN_KHUSUS") return "izin khusus";
  if (type === "DINAS_LUAR") return "dinas luar";
  if (type === "LEMBUR") return "lembur";
  return type.toLowerCase();
};

// & Compose localized reason text for submission-based attendance blocking.
// % Susun teks alasan terlokalisasi untuk blokir absensi berbasis pengajuan.
/** Mengekspor resolveSubmissionBlockingReason untuk kebutuhan modul ini. */
export const resolveSubmissionBlockingReason = (submission: {
  type: string;
  status: string;
}) => {
  return `Terdapat pengajuan ${formatSubmissionTypeLabel(submission.type)} dengan status ${submission.status} pada tanggal ini.`;
};

// & Find most recent blocking submission for a single user in date range.
// % Cari pengajuan pemblokir terbaru untuk satu user pada rentang tanggal.
/** Mengekspor findBlockingSubmissionByRange untuk kebutuhan modul ini. */
export const findBlockingSubmissionByRange = async (
  userId: string,
  rangeStart: Date,
  rangeEnd: Date,
  options: BlockingSubmissionOptions = {},
) => {
  const statuses = options.statuses ?? [...BLOCKING_SUBMISSION_STATUSES];
  const types = options.types ?? [...BLOCKING_SUBMISSION_TYPES];

  return prisma.submissions.findFirst({
    where: {
      userId,
      status: { in: statuses },
      type: { in: types },
      startDate: { lte: rangeEnd },
      endDate: { gte: rangeStart },
    },
    orderBy: { createdAt: "desc" },
  });
};

// & Build userId -> blocking submission map for bulk attendance checks.
// % Bangun map userId -> pengajuan pemblokir untuk pengecekan absensi massal.
/** Mengekspor findBlockingSubmissionMapByUserIds untuk kebutuhan modul ini. */
export const findBlockingSubmissionMapByUserIds = async (
  userIds: string[],
  rangeStart: Date,
  rangeEnd: Date,
  options: BlockingSubmissionOptions = {},
) => {
  const statuses = options.statuses ?? [...BLOCKING_SUBMISSION_STATUSES];
  const types = options.types ?? [...BLOCKING_SUBMISSION_TYPES];

  // & Deduplicate and sanitize user IDs before querying database.
  // % Hilangkan duplikasi dan bersihkan user ID sebelum query database.
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const result = new Map<string, any>();

  if (uniqueUserIds.length === 0) {
    return result;
  }

  const submissions = await prisma.submissions.findMany({
    where: {
      userId: { in: uniqueUserIds },
      status: { in: statuses },
      type: { in: types },
      startDate: { lte: rangeEnd },
      endDate: { gte: rangeStart },
    },
    orderBy: [{ userId: "asc" }, { createdAt: "desc" }],
  });

  // & Keep first row per user because list is already sorted by latest createdAt.
  // % Simpan baris pertama per user karena list sudah diurut latest createdAt.
  for (const submission of submissions) {
    if (!result.has(submission.userId)) {
      result.set(submission.userId, submission);
    }
  }

  return result;
};

