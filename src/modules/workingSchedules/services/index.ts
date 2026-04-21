// * File ini adalah facade orchestrator untuk module working schedules.

import { assignEmployees, create, update } from "./create";
import { findAll, findById, getMobileSummary } from "./report";

/** Mengekspor WorkingScheduleService untuk kebutuhan modul ini. */
export const WorkingScheduleService = {
  // & Create working schedule.
  // % Buat jadwal kerja.
  create,

  // & Update working schedule.
  // % Update jadwal kerja.
  update,

  // & List working schedules.
  // % Daftar jadwal kerja.
  findAll,

  // & Get working schedule by id.
  // % Ambil jadwal kerja berdasarkan id.
  findById,

  // & Assign employees to schedule.
  // % Tetapkan karyawan ke jadwal.
  assignEmployees,

  // & Get mobile schedule summary.
  // % Ambil ringkasan jadwal untuk mobile.
  getMobileSummary,
};
