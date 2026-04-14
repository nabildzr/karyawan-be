// * File ini menangani operasi baca/report untuk module holidays.

import { HolidayRepository } from "../repository";
import { buildHolidayWhere, ensureHolidayExists } from "./validation";

// & Get paginated holiday list by optional filters.
// % Ambil daftar hari libur paginasi berdasarkan filter opsional.
export async function getAll({
  page = 1,
  limit = 20,
  year,
  search,
}: {
  page?: number;
  limit?: number;
  year?: number;
  search?: string;
} = {}) {
  const skip = (page - 1) * limit;
  const where = buildHolidayWhere({ year, search });

  const [data, total] = await Promise.all([
    HolidayRepository.findHolidays({ where, skip, take: limit }),
    HolidayRepository.countHolidays(where),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// & Get holiday detail by id.
// % Ambil detail hari libur berdasarkan id.
export async function getById(id: string) {
  return ensureHolidayExists(id);
}
