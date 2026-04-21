// * File ini menangani operasi baca/report untuk module working schedules.

import { WorkingScheduleService } from "../implementation";

// & Get all working schedules.
// % Ambil semua jadwal kerja.
/** Mengekspor findAll untuk kebutuhan modul ini. */
export const findAll = WorkingScheduleService.findAll;

// & Get working schedule detail by id.
// % Ambil detail jadwal kerja berdasarkan id.
/** Mengekspor findById untuk kebutuhan modul ini. */
export const findById = WorkingScheduleService.findById;

// & Get mobile summary for employee schedule context.
// % Ambil ringkasan mobile untuk konteks jadwal karyawan.
/** Mengekspor getMobileSummary untuk kebutuhan modul ini. */
export const getMobileSummary = WorkingScheduleService.getMobileSummary;
