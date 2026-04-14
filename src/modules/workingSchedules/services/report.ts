// * File ini menangani operasi baca/report untuk module working schedules.

import { WorkingScheduleService as LegacyWorkingScheduleService } from "../legacy";

// & Get all working schedules.
// % Ambil semua jadwal kerja.
export const findAll = LegacyWorkingScheduleService.findAll;

// & Get working schedule detail by id.
// % Ambil detail jadwal kerja berdasarkan id.
export const findById = LegacyWorkingScheduleService.findById;

// & Get mobile summary for employee schedule context.
// % Ambil ringkasan mobile untuk konteks jadwal karyawan.
export const getMobileSummary = LegacyWorkingScheduleService.getMobileSummary;
