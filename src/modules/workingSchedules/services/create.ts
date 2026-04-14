// * File ini menangani operasi tulis untuk module working schedules.

import { WorkingScheduleService as LegacyWorkingScheduleService } from "../legacy";

// & Create working schedule.
// % Buat jadwal kerja.
export const create = LegacyWorkingScheduleService.create;

// & Update working schedule.
// % Update jadwal kerja.
export const update = LegacyWorkingScheduleService.update;

// & Assign employees into working schedule.
// % Tetapkan karyawan ke jadwal kerja.
export const assignEmployees = LegacyWorkingScheduleService.assignEmployees;
