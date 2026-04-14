// * File ini adalah facade orchestrator untuk module divisions.

import { create, remove, update } from "./create";
import { getAll, getById } from "./report";

export const DivisionService = {
  // & Get division list.
  // % Ambil daftar divisi.
  getAll,

  // & Get division detail by id.
  // % Ambil detail divisi berdasarkan id.
  getById,

  // & Create division.
  // % Buat divisi.
  create,

  // & Update division.
  // % Update divisi.
  update,

  // & Delete division.
  // % Hapus divisi.
  delete: remove,
};
