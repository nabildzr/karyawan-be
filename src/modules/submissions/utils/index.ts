import type { ScheduleRangeValidationIssue } from "../../../shared/attendances/schedules";

export type SubmissionListParams = {
  page?: number;
  limit?: number;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  type?: "IZIN_SAKIT" | "IZIN_KHUSUS" | "DINAS_LUAR" | "LEMBUR";
  search?: string;
};

export const REJECTED_DELETE_WINDOW_MS = 48 * 60 * 60 * 1000;

export function toStartOfDay(input: string | Date) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Bad Request: Format tanggal tidak valid.");
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

export function toEndOfDay(input: string | Date) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Bad Request: Format tanggal tidak valid.");
  }

  date.setHours(23, 59, 59, 999);
  return date;
}

export function buildSearchFilter(search?: string) {
  if (!search?.trim()) {
    return undefined;
  }

  return {
    OR: [
      {
        reason: {
          contains: search.trim(),
          mode: "insensitive" as const,
        },
      },
      {
        user: {
          nip: {
            contains: search.trim(),
            mode: "insensitive" as const,
          },
        },
      },
      {
        user: {
          employees: {
            fullName: {
              contains: search.trim(),
              mode: "insensitive" as const,
            },
          },
        },
      },
    ],
  };
}

export function toScheduleConflictMessage(issue: ScheduleRangeValidationIssue) {
  if (issue.reason === "MISSING_SHIFT") {
    return `Conflict: Tanggal ${issue.dateKey} (${issue.dayName}) memiliki jadwal aktif tetapi shift belum diatur.`;
  }

  return `Conflict: Tanggal ${issue.dateKey} (${issue.dayName}) bukan jadwal kerja aktif Anda.`;
}