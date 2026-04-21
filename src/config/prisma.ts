// * File config database: src/config/prisma.ts
// & This file initializes Prisma client, shared search helper, and result extensions.
// % File ini menginisialisasi Prisma client, helper pencarian bersama, dan ekstensi result.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

// & Validate required database URL before initializing Prisma adapter.
// % Validasi database URL wajib sebelum inisialisasi adapter Prisma.
if (!connectionString) {
  throw new Error("DATABASE_URL isn't set");
}

// & Keep a single Prisma instance across hot-reload in development.
// % Pertahankan satu instance Prisma saat hot-reload di environment development.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// & Create Prisma client with PostgreSQL adapter and transaction time limits.
// % Buat Prisma client dengan adapter PostgreSQL dan batas waktu transaksi.
function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: 10_000,
      timeout: 20_000,
    },
  });
}

// & Reuse global client when available to avoid reconnect storms.
// % Gunakan ulang client global jika tersedia untuk menghindari reconnect berulang.
/** Mengekspor db untuk kebutuhan modul ini. */
export const db = globalForPrisma.prisma ?? createPrismaClient();

// & Cache Prisma instance globally in non-production runtime only.
// % Simpan instance Prisma di global hanya pada runtime non-production.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

// & Shared options for generic Prisma search helper.
// % Opsi bersama untuk helper pencarian generik Prisma.
/** Mendefinisikan kontrak data untuk interface SearchOptions. */
export interface SearchOptions {
  page?: number;
  limit?: number;
  sortBy?: { field: string; order?: "asc" | "desc" };
  search?: { field: string; value: string };
  include?: Record<string, boolean | { select?: Record<string, boolean> }>;
}

// & Execute paginated search against a Prisma model using dynamic filters.
// % Jalankan pencarian paginasi pada model Prisma dengan filter dinamis.
/** Mengekspor prismaSearch untuk kebutuhan modul ini. */
export const prismaSearch = async <T extends keyof PrismaClient>(
  model: T,
  options: SearchOptions
) => {
  const { sortBy, limit = 25, page = 1, search, include } = options;

  // & Convert page number into Prisma skip offset.
  // % Ubah nomor halaman menjadi offset skip untuk Prisma.
  const skip = limit * (page - 1);

  // & Build contains-based search filter only when field and value are provided.
  // % Bangun filter pencarian berbasis contains hanya saat field dan value tersedia.
  const where =
    search?.field && search?.value
      ? {
          [search.field]: {
            contains: search.value,
            mode: "insensitive",
          },
        }
      : {};

  // & Keep total count as full model rows (not filtered), matching legacy behavior.
  // % Pertahankan total sebagai jumlah seluruh row model (tidak difilter), sesuai perilaku lama.
  const total = await (db as any)[model].count({});

  // & Fetch current page data with include, sort, and where options.
  // % Ambil data halaman saat ini dengan opsi include, sort, dan where.
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

// & Extend Prisma result shape to normalize decimal salary into number.
// % Perluas bentuk result Prisma untuk menormalisasi gaji decimal menjadi number.
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
});
