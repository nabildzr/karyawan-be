// * File ini menangani operasi tulis untuk module holidays.

import { AuditActor } from "../../../shared/audit/actor";
import { writeAuditLog } from "../../../shared/audit/writeAudit";
import { HolidayRepository } from "../repository";
import {
    ensureCreateDateUnique,
    ensureHolidayExists,
    ensureUpdateDateUnique,
} from "./validation";

// & Create holiday row and write audit log.
// % Buat baris hari libur dan tulis audit log.
export async function create(
  payload: { name: string; date: Date },
  actor: AuditActor,
) {
  await ensureCreateDateUnique(payload.date);

  const created = await HolidayRepository.createHoliday(payload);

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

  return created;
}

// & Update holiday row and write audit log.
// % Update baris hari libur dan tulis audit log.
export async function update(
  id: string,
  payload: { name?: string; date?: Date },
  actor: AuditActor,
) {
  const existing = await ensureHolidayExists(id);

  if (payload.date) {
    await ensureUpdateDateUnique(payload.date, id);
  }

  const updated = await HolidayRepository.updateHoliday(id, payload);

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

  return updated;
}

// & Delete holiday row and write audit log.
// % Hapus baris hari libur dan tulis audit log.
export async function remove(id: string, actor: AuditActor) {
  const existing = await ensureHolidayExists(id);
  await HolidayRepository.deleteHoliday(id);

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

// & Sync holiday data from external source with wipe-and-replace strategy.
// % Sinkronkan data hari libur dari sumber eksternal dengan strategi wipe-and-replace.
export async function syncFromExternal(actor: AuditActor) {
  const response = await fetch(
    "https://raw.githubusercontent.com/guangrei/APIHariLibur_V2/main/calendar.json",
  );

  if (!response.ok) {
    throw new Error(
      `Bad Request: Gagal mengambil data dari sumber eksternal (${response.statusText}).`,
    );
  }

  const data: Record<string, any> = await response.json();
  const holidaysToInsert: { date: Date; name: string }[] = [];

  for (const [key, details] of Object.entries(data)) {
    if (key === "info") continue;
    if (details.holiday === false) continue;

    const holidayDate = new Date(key);
    holidayDate.setUTCHours(0, 0, 0, 0);

    holidaysToInsert.push({
      date: holidayDate,
      name: details.summary[0],
    });
  }

  const syncResult = await HolidayRepository.runTransaction(async (tx) => {
    const beforeCount = await HolidayRepository.countHolidaysTx(tx);

    await HolidayRepository.deleteAllHolidaysTx(tx);
    const result = await HolidayRepository.createManyHolidaysTx(
      tx,
      holidaysToInsert,
    );

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
          insertedRows: result.count,
          source:
            "https://raw.githubusercontent.com/guangrei/APIHariLibur_V2/main/calendar.json",
        },
      },
      db: tx as any,
    });

    return {
      inserted: result.count,
    };
  });

  return {
    inserted: syncResult.inserted,
    data: holidaysToInsert,
  };
}
