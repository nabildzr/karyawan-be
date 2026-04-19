// * Backend module: karyawan-be/src/utils/holidayshelper.ts
// & This file defines backend logic for holidayshelper.ts.
// % File ini mendefinisikan logika backend untuk holidayshelper.ts.

import prisma from "../config/prisma";

const DEFAULT_TIMEZONE = "Asia/Jakarta";

/**
 * Normalisasi Date menjadi key tanggal "YYYY-MM-DD" sesuai timezone bisnis.
 */
export function toDateKey(date: Date, timezone = DEFAULT_TIMEZONE): string {
  return date.toLocaleDateString("sv-SE", { timeZone: timezone });
}

/**
 * Konversi date key "YYYY-MM-DD" menjadi Date UTC midnight.
 * Penting untuk kolom Postgres DATE (@db.Date) agar perbandingan tanggal presisi.
 */
export function dateKeyToUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/**
 * Konversi Date ke representasi tanggal murni (UTC midnight) sesuai timezone bisnis.
 */
export function toDbDateOnly(date: Date, timezone = DEFAULT_TIMEZONE): Date {
  return dateKeyToUtcDate(toDateKey(date, timezone));
}

/**
 * Deteksi weekend berdasarkan timezone bisnis.
 */
export function isWeekendDate(
  date: Date,
  timezone = DEFAULT_TIMEZONE,
): boolean {
  const weekday = date.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: timezone,
  });
  return weekday === "Sat" || weekday === "Sun";
}

/**
 * HELPER 1: Cek Hari Libur Spesifik (buat Cronjob oke)
 * Output: Mengembalikan object libur { name, date } atau null kalau nggak libur.
 */
export async function checkIsHoliday(targetDate: Date) {
  const targetDbDate = toDbDateOnly(targetDate);

  const holiday = await prisma.publicHolidays.findUnique({
    where: {
      date: targetDbDate,
    },
  });

  return holiday; // Return null kalau bukan hari libur
}

/**
 * HELPER 2: Tarik Banyak Libur Sekaligus (Cocok buat Looping Kalender UI)
 * Output: Mengembalikan Map/Dictionary. Key-nya "YYYY-MM-DD", Value-nya "Nama Libur".
 */
export async function getHolidaysInRange(startDate: Date, endDate: Date) {
  const normalizedStart = toDbDateOnly(startDate);
  const normalizedEnd = toDbDateOnly(endDate);

  const holidays = await prisma.publicHolidays.findMany({
    where: {
      date: {
        gte: normalizedStart,
        lte: normalizedEnd,
      },
    },
  });

  // Ubah format jadi Map biar pas di-looping nanti nyarinya cepet (O(1))
  const holidayMap = new Map<string, string>();

  for (const h of holidays) {
    // Format key tanggal mengikuti timezone bisnis biar tidak geser hari.
    const dateString = toDateKey(h.date);
    holidayMap.set(dateString, h.name);
  }

  return holidayMap;
}
