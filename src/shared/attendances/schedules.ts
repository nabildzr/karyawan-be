// * File shared attendances: schedules.ts
// & This module contains schedule/day utilities for attendance business logic.
// % Modul ini berisi utilitas jadwal/hari untuk logika bisnis absensi.
import { JAKARTA_UTC_OFFSET } from "../../config/timezone";

export type MobileSummaryDayStatus =
  | "completed"
  | "absent"
  | "missed"
  | "off"
  | "upcoming";

export type ScheduleRangeValidationIssueReason =
  | "NO_SCHEDULE_DAY"
  | "INACTIVE_SCHEDULE_DAY"
  | "MISSING_SHIFT";

export type ScheduleRangeValidationIssue = {
  dateKey: string;
  dayName: string;
  reason: ScheduleRangeValidationIssueReason;
};

// & Mapping from English weekday names to Indonesian labels.
// % Pemetaan nama hari berbahasa Inggris ke label Indonesia.
export const EN_TO_ID: Record<string, string> = {
  Monday: "Senin",
  Tuesday: "Selasa",
  Wednesday: "Rabu",
  Thursday: "Kamis",
  Friday: "Jumat",
  Saturday: "Sabtu",
  Sunday: "Minggu",
};

// & Resolve Indonesian weekday name from a date in provided timezone.
// % Ambil nama hari Indonesia dari tanggal pada timezone yang diberikan.
export const getDayNameID = (date: Date, timezone: string): string => {
  const en = date.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: timezone,
  });
  return EN_TO_ID[en] ?? en;
};

// & Resolve English weekday name from date and timezone.
// % Ambil nama hari Inggris dari tanggal dan timezone.
const getDayNameEN = (date: Date, timezone: string): string => {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: timezone,
  });
};

// & Normalize day name for case-insensitive matching.
// % Normalisasi nama hari agar pencocokan tidak peka huruf besar-kecil.
const normalizeDayName = (value: string) => value.trim().toLowerCase();

// & Convert date to YYYY-MM-DD key using requested timezone.
// % Ubah tanggal menjadi kunci YYYY-MM-DD sesuai timezone yang diminta.
const toDateKeyByTimezone = (date: Date, timezone: string) =>
  date.toLocaleDateString("sv-SE", { timeZone: timezone });

// & Find matching schedule day by date with EN/ID day-name tolerance.
// % Cari hari jadwal yang cocok berdasarkan tanggal dengan toleransi nama EN/ID.
export const findScheduleDayByDate = <T extends { dayOfWeek: string }>(
  days: T[] = [],
  date: Date,
  timezone: string,
): T | null => {
  const dayNameEN = getDayNameEN(date, timezone);
  const dayNameID = EN_TO_ID[dayNameEN] ?? dayNameEN;
  const acceptedDayNames = new Set([
    normalizeDayName(dayNameEN),
    normalizeDayName(dayNameID),
  ]);

  return (
    days.find((item) =>
      acceptedDayNames.has(normalizeDayName(item.dayOfWeek)),
    ) ?? null
  );
};

// & Alias helper for today's schedule day lookup.
// % Helper alias untuk mencari jadwal hari ini.
export const findScheduleDayForToday = <T extends { dayOfWeek: string }>(
  days: T[] = [],
  date: Date,
  timezone: string,
): T | null => findScheduleDayByDate(days, date, timezone);

// & Type guard that ensures schedule day is active and has shift data.
// % Type guard untuk memastikan hari jadwal aktif dan memiliki data shift.
export const hasActiveShiftOnDay = <
  T extends { isActive?: boolean | null; shift?: unknown | null },
>(
  scheduleDay: T | null,
): scheduleDay is T & { isActive: true; shift: NonNullable<T["shift"]> } =>
  Boolean(scheduleDay?.isActive && scheduleDay.shift);

// & Scan date range and return first invalid schedule configuration encountered.
// % Pindai rentang tanggal dan kembalikan konfigurasi jadwal pertama yang tidak valid.
export const findFirstInvalidScheduleDateInRange = <
  T extends {
    dayOfWeek: string;
    isActive?: boolean | null;
    shift?: unknown;
  },
>(
  days: T[] = [],
  startDate: Date,
  endDate: Date,
  timezone: string,
): ScheduleRangeValidationIssue | null => {
  // & Use noon anchor to avoid DST-related date shifting while iterating.
  // % Gunakan anchor jam 12 siang untuk menghindari pergeseran tanggal akibat DST.
  const cursor = new Date(startDate);
  cursor.setHours(12, 0, 0, 0);

  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(12, 0, 0, 0);

  while (cursor <= rangeEnd) {
    const scheduleDay = findScheduleDayByDate(days, cursor, timezone);
    const dateKey = toDateKeyByTimezone(cursor, timezone);
    const dayName = getDayNameID(cursor, timezone);

    if (!scheduleDay) {
      return { dateKey, dayName, reason: "NO_SCHEDULE_DAY" };
    }

    if (!scheduleDay.isActive) {
      return { dateKey, dayName, reason: "INACTIVE_SCHEDULE_DAY" };
    }

    if (!scheduleDay.shift) {
      return { dateKey, dayName, reason: "MISSING_SHIFT" };
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return null;
};

// & Resolve mobile calendar status and note from schedule/holiday/attendance inputs.
// % Tentukan status dan catatan kalender mobile dari input jadwal/libur/absensi.
export const resolveMobileSummaryDayStatus = (params: {
  hasActiveScheduleDay: boolean;
  isHoliday: boolean;
  holidayName?: string | null;
  submissionNote?: string | null;
  attendanceStatus?: string | null;
  dateKey: string;
  todayKey: string;
}): { status: MobileSummaryDayStatus; note: string | null } => {
  if (!params.hasActiveScheduleDay) {
    return {
      status: "off",
      note: "Tidak ada jadwal kerja pada hari ini.",
    };
  }

  if (params.isHoliday) {
    return {
      status: "off",
      note: `Libur nasional: ${params.holidayName ?? "Hari libur"}.`,
    };
  }

  if (params.submissionNote) {
    return {
      status: "off",
      note: params.submissionNote,
    };
  }

  if (
    params.attendanceStatus === "PRESENT" ||
    params.attendanceStatus === "LATE"
  ) {
    return { status: "completed", note: null };
  }

  if (
    params.attendanceStatus === "ABSENT" ||
    params.attendanceStatus === "LEAVE"
  ) {
    return { status: "absent", note: null };
  }

  if (params.dateKey >= params.todayKey) {
    return {
      status: "upcoming",
      note:
        params.dateKey === params.todayKey
          ? "Shift hari ini belum tercatat absensi."
          : "Shift masih akan datang.",
    };
  }

  return {
    status: "off",
    note: "Tidak ada data absensi pada tanggal ini.",
  };
};

// & Parse HH:mm string into hour and minute numbers.
// % Parse string HH:mm menjadi angka jam dan menit.
export const parseTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return { hours: h, minutes: m };
};

// & Build business day boundaries for a date based on timezone day key.
// % Bangun batas hari bisnis untuk tanggal berdasarkan day key timezone.
export const getDayRangeByTimezone = (date: Date, timezone: string) => {
  const dayKey = date.toLocaleDateString("sv-SE", { timeZone: timezone });
  const dayStart = new Date(`${dayKey}T00:00:00.000${JAKARTA_UTC_OFFSET}`);
  const dayEnd = new Date(`${dayKey}T23:59:59.999${JAKARTA_UTC_OFFSET}`);
  return { dayKey, dayStart, dayEnd };
};

// & Convert business date key into start-of-day Date using Jakarta offset.
// % Ubah date key bisnis menjadi Date awal hari dengan offset Jakarta.
export const toBusinessStartOfDay = (dateKey: string) => {
  return new Date(`${dateKey}T00:00:00.000${JAKARTA_UTC_OFFSET}`);
};

// & Convert business date key into end-of-day Date using Jakarta offset.
// % Ubah date key bisnis menjadi Date akhir hari dengan offset Jakarta.
export const toBusinessEndOfDay = (dateKey: string) => {
  return new Date(`${dateKey}T23:59:59.999${JAKARTA_UTC_OFFSET}`);
};

// & Compute shift start/end window and handle cross-day end correctly.
// % Hitung rentang mulai/akhir shift dan tangani akhir shift lintas hari.
export const getShiftWindow = (
  now: Date,
  shift: { startTime: string; endTime: string; isCrossDay: boolean },
) => {
  const { hours: startHour, minutes: startMinute } = parseTime(shift.startTime);
  const { hours: endHour, minutes: endMinute } = parseTime(shift.endTime);

  const shiftStart = new Date(now);
  shiftStart.setHours(startHour, startMinute, 0, 0);

  const shiftEnd = new Date(now);
  if (shift.isCrossDay) {
    shiftEnd.setDate(shiftEnd.getDate() + 1);
  }
  shiftEnd.setHours(endHour, endMinute, 0, 0);

  return { shiftStart, shiftEnd };
};