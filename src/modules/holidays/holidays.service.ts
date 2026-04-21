import type { AuditActor } from "../../shared/audit/actor";
import { writeAuditLog } from "../../shared/audit/writeAudit";
import {
  countPublicHolidays,
  createManyPublicHolidays,
  createPublicHoliday,
  deleteAllPublicHolidays,
  deletePublicHoliday,
  findPublicHolidayByDate,
  findPublicHolidayByDateExcludingId,
  findPublicHolidayById,
  findPublicHolidays,
  updatePublicHoliday,
  withHolidayTransaction,
} from "./holidays.repository";
import type {
  HolidayCreateBodyPayload,
  HolidayListMetaPayload,
  HolidayListQueryPayload,
  HolidayPayload,
  HolidayUpdateBodyPayload,
} from "./holidays.schema";

type HolidayListResultPayload = {
  data: HolidayPayload[];
  meta: HolidayListMetaPayload;
};

type HolidaySyncResultPayload = {
  inserted: number;
  data: Array<{ date: string; name: string }>;
};

/** Memetakan data hari libur mentah ke payload response endpoint. */
function toHolidayPayload(record: {
  id: string;
  name: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}): HolidayPayload {
  return {
    id: record.id,
    name: record.name,
    date: record.date.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Memformat tanggal untuk pesan error berbasis timezone Jakarta. */
function formatJakartaDateKey(date: Date) {
  return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

/** Mengubah string tanggal input menjadi objek Date yang tervalidasi. */
function parseHolidayDate(dateString: string): Date {
  const parsed = new Date(dateString);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Bad Request: Format tanggal tidak valid.");
  }

  parsed.setUTCHours(0, 0, 0, 0);
  return parsed;
}

/** Membentuk where filter query hari libur dari parameter endpoint list. */
function buildHolidayWhere(params: { year?: number; search?: string }) {
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

/** Menormalisasi query list hari libur agar aman dipakai untuk paginasi. */
function normalizeHolidayListQuery(query: HolidayListQueryPayload) {
  const page = Math.max(1, Math.floor(Number(query.page ?? 1)));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit ?? 20))));
  const year = query.year ? Math.floor(Number(query.year)) : undefined;
  const search = query.search?.trim() || undefined;

  return { page, limit, year, search };
}

/** Memastikan data hari libur tersedia sebelum dipakai mutasi. */
async function ensureHolidayExists(id: string) {
  const holiday = await findPublicHolidayById(id);

  if (!holiday) {
    throw new Error("Not Found: Hari libur tidak ditemukan.");
  }

  return holiday;
}

/** Memastikan tanggal hari libur unik saat proses create. */
async function ensureCreateDateUnique(date: Date) {
  const existing = await findPublicHolidayByDate(date);

  if (existing) {
    throw new Error(
      `Conflict: Sudah ada hari libur pada tanggal ${formatJakartaDateKey(date)}.`,
    );
  }
}

/** Memastikan tanggal hari libur unik saat proses update. */
async function ensureUpdateDateUnique(date: Date, holidayId: string) {
  const conflict = await findPublicHolidayByDateExcludingId(date, holidayId);

  if (conflict) {
    throw new Error(
      `Conflict: Tanggal ${formatJakartaDateKey(date)} sudah dipakai hari libur lain.`,
    );
  }
}

/** Mengambil daftar hari libur terpaginasikan berdasarkan filter query. */
async function getAll(
  query: HolidayListQueryPayload,
): Promise<HolidayListResultPayload> {
  const { page, limit, year, search } = normalizeHolidayListQuery(query);
  const where = buildHolidayWhere({ year, search });
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    findPublicHolidays({ where, skip, take: limit }),
    countPublicHolidays(where),
  ]);

  return {
    data: data.map(toHolidayPayload),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/** Mengambil detail hari libur berdasarkan id. */
async function getById(id: string): Promise<HolidayPayload> {
  const holiday = await ensureHolidayExists(id);
  return toHolidayPayload(holiday);
}

/** Membuat hari libur baru lalu mencatat audit log. */
async function create(
  payload: HolidayCreateBodyPayload,
  actor: AuditActor,
): Promise<HolidayPayload> {
  const holidayDate = parseHolidayDate(payload.date);
  await ensureCreateDateUnique(holidayDate);

  const created = await createPublicHoliday({
    name: payload.name,
    date: holidayDate,
  });

  await writeAuditLog({
    actor,
    action: "CREATE_HOLIDAY",
    entity: "Holidays",
    entityId: created.id,
    changes: {
      before: null,
      after: {
        name: created.name,
        date: created.date,
      },
    },
  });

  return toHolidayPayload(created);
}

/** Memperbarui hari libur lalu mencatat audit log. */
async function update(
  id: string,
  payload: HolidayUpdateBodyPayload,
  actor: AuditActor,
): Promise<HolidayPayload> {
  const existing = await ensureHolidayExists(id);

  const data: {
    name?: string;
    date?: Date;
  } = {};

  if (payload.name !== undefined) {
    data.name = payload.name;
  }

  if (payload.date !== undefined) {
    const parsedDate = parseHolidayDate(payload.date);
    await ensureUpdateDateUnique(parsedDate, id);
    data.date = parsedDate;
  }

  const updated = await updatePublicHoliday(id, data);

  await writeAuditLog({
    actor,
    action: "UPDATE_HOLIDAY",
    entity: "Holidays",
    entityId: updated.id,
    changes: {
      before: {
        name: existing.name,
        date: existing.date,
      },
      after: {
        name: updated.name,
        date: updated.date,
      },
    },
  });

  return toHolidayPayload(updated);
}

/** Menghapus hari libur lalu mencatat audit log. */
async function remove(id: string, actor: AuditActor): Promise<void> {
  const existing = await ensureHolidayExists(id);
  await deletePublicHoliday(id);

  await writeAuditLog({
    actor,
    action: "DELETE_HOLIDAY",
    entity: "Holidays",
    entityId: id,
    changes: {
      before: {
        name: existing.name,
        date: existing.date,
      },
      after: null,
    },
  });
}

/** Sinkronisasi data hari libur eksternal dengan strategi wipe-and-replace. */
async function syncFromExternal(actor: AuditActor): Promise<HolidaySyncResultPayload> {
  const response = await fetch(
    "https://raw.githubusercontent.com/guangrei/APIHariLibur_V2/main/calendar.json",
  );

  if (!response.ok) {
    throw new Error(
      `Bad Request: Gagal mengambil data dari sumber eksternal (${response.statusText}).`,
    );
  }

  const payload: Record<string, any> = await response.json();
  const holidaysToInsert: Array<{ date: Date; name: string }> = [];

  for (const [key, details] of Object.entries(payload)) {
    if (key === "info") continue;
    if (details.holiday === false) continue;

    const holidayDate = new Date(key);
    holidayDate.setUTCHours(0, 0, 0, 0);

    holidaysToInsert.push({
      date: holidayDate,
      name: details.summary[0],
    });
  }

  const result = await withHolidayTransaction(async (tx) => {
    const beforeCount = await countPublicHolidays({}, tx);
    await deleteAllPublicHolidays(tx);
    const created = await createManyPublicHolidays(holidaysToInsert, tx);

    await writeAuditLog({
      actor,
      action: "SYNC_HOLIDAYS_EXTERNAL",
      entity: "Holidays",
      entityId: "BULK_SYNC",
      changes: {
        before: {
          totalRows: beforeCount,
        },
        after: {
          insertedRows: created.count,
          source:
            "https://raw.githubusercontent.com/guangrei/APIHariLibur_V2/main/calendar.json",
        },
      },
      db: tx as any,
    });

    return {
      inserted: created.count,
    };
  });

  return {
    inserted: result.inserted,
    data: holidaysToInsert.map((holiday) => ({
      date: holiday.date.toISOString(),
      name: holiday.name,
    })),
  };
}

/** Mengekspor HolidayService untuk kebutuhan modul ini. */
export const HolidayService = {
  getAll,
  getById,
  create,
  update,
  delete: remove,
  syncFromExternal,
};
