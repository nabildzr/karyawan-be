import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL isn't set");
}

// Singleton pattern untuk mencegah multiple instances saat hot-reload
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
 const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

// Search options interface
export interface SearchOptions {
  page?: number;
  limit?: number;
  sortBy?: { field: string; order?: "asc" | "desc" };
  search?: { field: string; value: string };
  include?: Record<string, boolean | { select?: Record<string, boolean> }>;
}

// Generic prisma search dengan pagination
/**
 * Melakukan pencarian dengan pagination pada model Prisma yang ditentukan.
 * 
 * @template T - Kunci dari PrismaClient yang merepresentasikan nama model
 * 
 * @param model - Nama model Prisma yang akan dicari (contoh: 'user', 'post', dll)
 * @param options - Opsi pencarian yang berisi konfigurasi query
 * @param options.sortBy - Opsi pengurutan data
 * @param options.sortBy.field - Nama field yang digunakan untuk pengurutan
 * @param options.sortBy.order - Urutan pengurutan ('asc' atau 'desc'), default 'asc'
 * @param options.limit - Jumlah maksimum data per halaman, default 25
 * @param options.page - Nomor halaman yang diminta, default 1
 * @param options.search - Opsi pencarian
 * @param options.search.field - Nama field yang akan dicari
 * @param options.search.value - Nilai yang akan dicari (case-insensitive)
 * @param options.include - Relasi yang akan di-include dalam hasil query
 * 
 * @returns Promise yang mengembalikan objek dengan:
 *   - total: Jumlah total data dalam model
 *   - count: Jumlah data yang dikembalikan dalam halaman ini
 *   - page: Nomor halaman saat ini
 *   - data: Array hasil pencarian
 * 
 * @example
 * ```typescript
 * const result = await prismaSearch('user', {
 *   limit: 10,
 *   page: 1,
 *   search: { field: 'name', value: 'John' },
 *   sortBy: { field: 'createdAt', order: 'desc' },
 *   include: { posts: true }
 * });
 * ```
 */
export const prismaSearch = async <T extends keyof PrismaClient>(
  model: T,
  options: SearchOptions
) => {
  const { sortBy, limit = 25, page = 1, search, include } = options;

  const skip = limit * (page - 1);

  const where =
    search?.field && search?.value
      ? {
          [search.field]: {
            contains: search.value,
            mode: "insensitive",
          },
        }
      : {};

  const total = await (db as any)[model].count({});

  const data = await (db as any)[model].findMany({
    skip,
    take: limit,
    include,
    orderBy: sortBy ? { [sortBy.field]: sortBy.order ?? "asc" } : undefined,
    where,
  });

  return {
    total,
    count: data.length,
    page,
    data,
  };
};

export default db.$extends({
  result: {
    positions: {
      gajiPokok: {
        compute(position) {
          return Number(position.gajiPokok);
        },
      },
    },
  },
});;
