import prisma from "../../config/prisma";
import type { Prisma, PublicHolidays } from "../../generated/prisma/client";

type HolidayDbClient = any;

/** Menentukan client database aktif, default ke Prisma global. */
function getDb(db?: HolidayDbClient) {
  return db ?? prisma;
}

/** Menjalankan operasi database dalam transaksi Prisma. */
export async function withHolidayTransaction<T>(
  handler: (tx: any) => Promise<T>,
): Promise<T> {
  return prisma.$transaction((tx) => handler(tx));
}

/** Mengambil daftar hari libur mentah berdasarkan filter paginasi. */
export async function findPublicHolidays(
  params: {
    where: Prisma.PublicHolidaysWhereInput;
    skip: number;
    take: number;
  },
  db?: HolidayDbClient,
): Promise<PublicHolidays[]> {
  return getDb(db).publicHolidays.findMany({
    where: params.where,
    orderBy: { date: "asc" },
    skip: params.skip,
    take: params.take,
  });
}

/** Menghitung total hari libur mentah berdasarkan filter. */
export async function countPublicHolidays(
  where: Prisma.PublicHolidaysWhereInput,
  db?: HolidayDbClient,
): Promise<number> {
  return getDb(db).publicHolidays.count({ where });
}

/** Mencari hari libur mentah berdasarkan id. */
export async function findPublicHolidayById(
  id: string,
  db?: HolidayDbClient,
): Promise<PublicHolidays | null> {
  return getDb(db).publicHolidays.findUnique({ where: { id } });
}

/** Mencari hari libur mentah berdasarkan tanggal. */
export async function findPublicHolidayByDate(
  date: Date,
  db?: HolidayDbClient,
): Promise<PublicHolidays | null> {
  return getDb(db).publicHolidays.findUnique({ where: { date } });
}

/** Mencari konflik hari libur berdasarkan tanggal selain id tertentu. */
export async function findPublicHolidayByDateExcludingId(
  date: Date,
  holidayId: string,
  db?: HolidayDbClient,
): Promise<PublicHolidays | null> {
  return getDb(db).publicHolidays.findFirst({
    where: {
      date,
      NOT: { id: holidayId },
    },
  });
}

/** Membuat hari libur mentah baru di database. */
export async function createPublicHoliday(
  data: Prisma.PublicHolidaysUncheckedCreateInput,
  db?: HolidayDbClient,
): Promise<PublicHolidays> {
  return getDb(db).publicHolidays.create({ data });
}

/** Mengubah hari libur mentah di database. */
export async function updatePublicHoliday(
  id: string,
  data: Prisma.PublicHolidaysUncheckedUpdateInput,
  db?: HolidayDbClient,
): Promise<PublicHolidays> {
  return getDb(db).publicHolidays.update({ where: { id }, data });
}

/** Menghapus hari libur mentah dari database. */
export async function deletePublicHoliday(
  id: string,
  db?: HolidayDbClient,
): Promise<PublicHolidays> {
  return getDb(db).publicHolidays.delete({ where: { id } });
}

/** Menghapus seluruh hari libur mentah dari database. */
export async function deleteAllPublicHolidays(
  db?: HolidayDbClient,
): Promise<Prisma.BatchPayload> {
  return getDb(db).publicHolidays.deleteMany();
}

/** Menyimpan banyak hari libur mentah ke database. */
export async function createManyPublicHolidays(
  data: Array<{ date: Date; name: string }>,
  db?: HolidayDbClient,
): Promise<Prisma.BatchPayload> {
  return getDb(db).publicHolidays.createMany({
    data,
    skipDuplicates: true,
  });
}
