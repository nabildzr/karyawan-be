// * File ini adalah facade orchestrator untuk module positions.

import { create, remove, update } from "./create";
import { getAll, getById } from "./report";

export const PositionService = {
  // & Get position list.
  // % Ambil daftar posisi.
  getAll,

  // & Get position detail by id.
  // % Ambil detail posisi berdasarkan id.
  getById,

  // & Create position.
  // % Buat posisi.
  create,

  // & Update position.
  // % Update posisi.
  update,

  // & Delete position.
  // % Hapus posisi.
  delete: remove,
};
