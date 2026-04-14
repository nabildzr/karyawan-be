// * File ini menangani validasi bisnis untuk module holidays.

import { HolidayRepository } from "../repository";

// & Build holiday filter by year and search term.
// % Bentuk filter hari libur berdasarkan tahun dan kata pencarian.
export function buildHolidayWhere(params: { year?: number; search?: string }) {
  return {
    ...(params.year && {
      date: {
        gte: new Date(`${params.year}-01-01`),
        lte: new Date(`${params.year}-12-31`),
      },
    }),
    ...(params.search && {
      name: { contains: params.search, mode: "insensitive" as const },
    }),
  };
}

// & Format date value using Jakarta timezone-safe key.
// % Format nilai tanggal menggunakan key timezone-safe Jakarta.
export function formatJakartaDateKey(date: Date) {
  return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

// & Ensure holiday exists by id.
// % Pastikan hari libur ada berdasarkan id.
export async function ensureHolidayExists(id: string) {
  const holiday = await HolidayRepository.findHolidayById(id);

  if (!holiday) {
    throw new Error("Not Found: Hari libur tidak ditemukan.");
  }

  return holiday;
}

// & Ensure holiday date is unique on create flow.
// % Pastikan tanggal hari libur unik saat create.
export async function ensureCreateDateUnique(date: Date) {
  const existing = await HolidayRepository.findHolidayByDate(date);

  if (existing) {
    throw new Error(
      `Conflict: Sudah ada hari libur pada tanggal ${formatJakartaDateKey(date)}.`,
    );
  }
}

// & Ensure holiday date is unique on update flow.
// % Pastikan tanggal hari libur unik saat update.
export async function ensureUpdateDateUnique(date: Date, holidayId: string) {
  const conflict = await HolidayRepository.findHolidayByDateExcludeId(
    date,
    holidayId,
  );

  if (conflict) {
    throw new Error(
      `Conflict: Tanggal ${formatJakartaDateKey(date)} sudah dipakai hari libur lain.`,
    );
  }
}
