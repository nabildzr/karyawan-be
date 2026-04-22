// * File shared attendances: schedules.ts
// & This module contains schedule/day utilities for attendance business logic.
// % Modul ini berisi utilitas jadwal/hari untuk logika bisnis absensi.
import { JAKARTA_UTC_OFFSET } from "../../config/timezone";

/** Mendefinisikan alias tipe untuk MobileSummaryDayStatus. */
export type MobileSummaryDayStatus =
  | "completed"
  | "absent"
  | "missed"
  | "off"
  | "upcoming";

/** Mendefinisikan alias tipe untuk ScheduleRangeValidationIssueReason. */
export type ScheduleRangeValidationIssueReason =
  | "NO_SCHEDULE_DAY"
  | "INACTIVE_SCHEDULE_DAY"
  | "MISSING_SHIFT";

/** Mendefinisikan alias tipe untuk ScheduleRangeValidationIssue. */
export type ScheduleRangeValidationIssue = {
  dateKey: string;
  dayName: string;
  reason: ScheduleRangeValidationIssueReason;
};

// & Mapping from English weekday names to Indonesian labels.
// % Pemetaan nama hari berbahasa Inggris ke label Indonesia.
/** Mengekspor EN_TO_ID untuk kebutuhan modul ini. */
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
/** Mengekspor getDayNameID untuk kebutuhan modul ini. */
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
/** Mengekspor findScheduleDayByDate untuk kebutuhan modul ini. */
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
/** Mengekspor findScheduleDayForToday untuk kebutuhan modul ini. */
export const findScheduleDayForToday = <T extends { dayOfWeek: string }>(
  days: T[] = [],
  date: Date,
  timezone: string,
): T | null => findScheduleDayByDate(days, date, timezone);

// & Type guard that ensures schedule day is active and has shift data.
// % Type guard untuk memastikan hari jadwal aktif dan memiliki data shift.
/** Mengekspor hasActiveShiftOnDay untuk kebutuhan modul ini. */
export const hasActiveShiftOnDay = <
  T extends { isActive?: boolean | null; shift?: unknown | null },
>(
  scheduleDay: T | null,
): scheduleDay is T & { isActive: true; shift: NonNullable<T["shift"]> } =>
  Boolean(scheduleDay?.isActive && scheduleDay.shift);

// & Scan date range and return first invalid schedule configuration encountered.
// % Pindai rentang tanggal dan kembalikan konfigurasi jadwal pertama yang tidak valid.
/** Mengekspor findFirstInvalidScheduleDateInRange untuk kebutuhan modul ini. */
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

  // ? awal
  const cursor = new Date(startDate);
  cursor.setHours(12, 0, 0, 0);

  // ? akhir 
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(12, 0, 0, 0);

  // ? jika awal dan akhir sama-sama 2024-12-01, maka cursor akan tetap di 2024-12-01 selama iterasi
  // ? sehingga tidak akan terpengaruh jika misalnya ada perubahan jam akibat DST di tengah bulan tersebut. 
  // ? coba dulu cari masalah pada setiap tanggal, jika ketemu langsung return issue-nya, kalau sampai habis berarti aman
  /* ? proses `while` loop ini memeriksa rentang tanggal dari `cursor` hingga `rangeEnd` dan memeriksa setiap
  tanggal untuk mendeteksi masalah validasi hari jadwal. Berikut ini rincian dari apa yang dilakukannya: */
  while (cursor <= rangeEnd) {
    const scheduleDay = findScheduleDayByDate(days, cursor, timezone);
    const dateKey = toDateKeyByTimezone(cursor, timezone);
    const dayName = getDayNameID(cursor, timezone);

    // ? Jika tidak ada hari jadwal yang cocok untuk tanggal ini, buat issue dengan alasan "NO_SCHEDULE_DAY".
    if (!scheduleDay) {
      return { dateKey, dayName, reason: "NO_SCHEDULE_DAY" };
    }

    // ? Jika hari jadwal ditemukan tetapi tidak aktif, buat issue dengan alasan "INACTIVE_SCHEDULE_DAY".
    if (!scheduleDay.isActive) {
      return { dateKey, dayName, reason: "INACTIVE_SCHEDULE_DAY" };
    }

    // ? Jika hari jadwal aktif tetapi tidak memiliki data shift, buat issue dengan alasan "MISSING_SHIFT".
    if (!scheduleDay.shift) {
      return { dateKey, dayName, reason: "MISSING_SHIFT" };
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return null;
};

// & Resolve mobile calendar status and note from schedule/holiday/attendance inputs.
// % Tentukan status dan catatan kalender mobile dari input jadwal/libur/absensi.
/** Mengekspor resolveMobileSummaryDayStatus untuk kebutuhan modul ini. */
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
/** Mengekspor parseTime untuk kebutuhan modul ini. */
export const parseTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return { hours: h, minutes: m };
};

interface CheckInPunctualityMetrics {
  diffMinutes: number; // & Positive if late, negative if early, zero if on time.
  lateMinutes: number; // & Minutes late (0 if on time or early).
  minutesEarly: number; // & Minutes early (0 if on time or late).
  isLate: boolean; // & True if actual check-in is after expected time.
}

// & Calculate punctuality metrics for check-in based on expected schedule time.
// % Hitung metrik ketepatan waktu check-in berdasarkan jam jadwal.
/** Mengekspor calculateCheckInPunctuality untuk kebutuhan modul ini. */
export const calculateCheckInPunctuality = (
  actualCheckIn: Date | null | undefined,
  expectedCheckIn: Date | null | undefined,
): CheckInPunctualityMetrics => {
  if (!actualCheckIn || !expectedCheckIn) {
    return {
      diffMinutes: 0,
      lateMinutes: 0,
      minutesEarly: 0,
      isLate: false,
    };
  }

  const diffMinutes = Math.floor(
    (actualCheckIn.getTime() - expectedCheckIn.getTime()) / 60000,
  );

  return {
    diffMinutes,
    lateMinutes: Math.max(diffMinutes, 0),
    minutesEarly: Math.max(-diffMinutes, 0),
    isLate: diffMinutes > 0,
  };
};

// & Build business day boundaries for a date based on timezone day key.
// % Bangun batas hari bisnis untuk tanggal berdasarkan day key timezone.
/** Mengekspor getDayRangeByTimezone untuk kebutuhan modul ini. */
export const getDayRangeByTimezone = (date: Date, timezone: string) => {
  const dayKey = date.toLocaleDateString("sv-SE", { timeZone: timezone });
  const dayStart = new Date(`${dayKey}T00:00:00.000${JAKARTA_UTC_OFFSET}`);
  const dayEnd = new Date(`${dayKey}T23:59:59.999${JAKARTA_UTC_OFFSET}`);
  return { dayKey, dayStart, dayEnd };
};

// & Convert business date key into start-of-day Date using Jakarta offset.
// % Ubah date key bisnis menjadi Date awal hari dengan offset Jakarta.
/** Mengekspor toBusinessStartOfDay untuk kebutuhan modul ini. */
export const toBusinessStartOfDay = (dateKey: string) => {
  return new Date(`${dateKey}T00:00:00.000${JAKARTA_UTC_OFFSET}`);
};

// & Convert business date key into end-of-day Date using Jakarta offset.
// % Ubah date key bisnis menjadi Date akhir hari dengan offset Jakarta.
/** Mengekspor toBusinessEndOfDay untuk kebutuhan modul ini. */
export const toBusinessEndOfDay = (dateKey: string) => {
  return new Date(`${dateKey}T23:59:59.999${JAKARTA_UTC_OFFSET}`);
};

// & Compute shift start/end window and handle cross-day end correctly.
// % Hitung rentang mulai/akhir shift dan tangani akhir shift lintas hari.
/** Mengekspor getShiftWindow untuk kebutuhan modul ini. */
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