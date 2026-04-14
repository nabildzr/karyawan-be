// * File ini adalah facade orchestrator untuk module holidays.

import { create, remove, syncFromExternal, update } from "./create";
import { getAll, getById } from "./report";

export const HolidayService = {
  // & Get holiday list.
  // % Ambil daftar hari libur.
  getAll,

  // & Get holiday detail by id.
  // % Ambil detail hari libur berdasarkan id.
  getById,

  // & Create holiday.
  // % Buat hari libur.
  create,

  // & Update holiday.
  // % Update hari libur.
  update,

  // & Delete holiday.
  // % Hapus hari libur.
  delete: remove,

  // & Sync holidays from external API.
  // % Sinkronkan hari libur dari API eksternal.
  syncFromExternal,
};
