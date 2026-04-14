// * Repository ini menjadi lapisan akses database untuk module holidays.

import prisma from "../../config/prisma";

export const HolidayRepository = {
  // & Find holiday list by filter with pagination.
  // % Ambil daftar hari libur berdasarkan filter dengan paginasi.
  async findHolidays(params: { where: any; skip: number; take: number }) {
    return prisma.publicHolidays.findMany({
      where: params.where,
      orderBy: { date: "asc" },
      skip: params.skip,
      take: params.take,
    });
  },

  // & Count holiday rows by filter.
  // % Hitung jumlah hari libur berdasarkan filter.
  async countHolidays(where: any) {
    return prisma.publicHolidays.count({ where });
  },

  // & Find holiday by id.
  // % Cari hari libur berdasarkan id.
  async findHolidayById(id: string) {
    return prisma.publicHolidays.findUnique({ where: { id } });
  },

  // & Find holiday by exact date.
  // % Cari hari libur berdasarkan tanggal persis.
  async findHolidayByDate(date: Date) {
    return prisma.publicHolidays.findUnique({ where: { date } });
  },

  // & Find holiday by date excluding current holiday id.
  // % Cari hari libur berdasarkan tanggal dengan mengecualikan id saat ini.
  async findHolidayByDateExcludeId(date: Date, excludedId: string) {
    return prisma.publicHolidays.findFirst({
      where: {
        date,
        NOT: { id: excludedId },
      },
    });
  },

  // & Create holiday row.
  // % Buat baris hari libur.
  async createHoliday(payload: { name: string; date: Date }) {
    return prisma.publicHolidays.create({ data: payload });
  },

  // & Update holiday row by id.
  // % Update baris hari libur berdasarkan id.
  async updateHoliday(id: string, payload: { name?: string; date?: Date }) {
    return prisma.publicHolidays.update({
      where: { id },
      data: payload,
    });
  },

  // & Delete holiday by id.
  // % Hapus hari libur berdasarkan id.
  async deleteHoliday(id: string) {
    return prisma.publicHolidays.delete({ where: { id } });
  },

  // & Execute holiday write operations inside transaction.
  // % Jalankan operasi tulis hari libur di dalam transaction.
  async runTransaction<T>(runner: (tx: any) => Promise<T>) {
    return prisma.$transaction(async (tx) => runner(tx));
  },

  // & Count holidays inside transaction.
  // % Hitung hari libur di dalam transaction.
  async countHolidaysTx(tx: any) {
    return tx.publicHolidays.count();
  },

  // & Delete all holidays inside transaction.
  // % Hapus semua hari libur di dalam transaction.
  async deleteAllHolidaysTx(tx: any) {
    return tx.publicHolidays.deleteMany();
  },

  // & Bulk insert holidays inside transaction.
  // % Simpan banyak hari libur sekaligus di dalam transaction.
  async createManyHolidaysTx(
    tx: any,
    payload: Array<{ date: Date; name: string }>,
  ) {
    return tx.publicHolidays.createMany({
      data: payload,
      skipDuplicates: true,
    });
  },
};
