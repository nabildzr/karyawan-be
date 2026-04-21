// * File ini menangani operasi tulis untuk module working schedules.

import { WorkingScheduleService } from "../implementation";

// & Create working schedule.
// % Buat jadwal kerja.
/** Mengekspor create untuk kebutuhan modul ini. */
export const create = WorkingScheduleService.create;

// & Update working schedule.
// % Update jadwal kerja.
/** Mengekspor update untuk kebutuhan modul ini. */
export const update = WorkingScheduleService.update;

// & Assign employees into working schedule.
// % Tetapkan karyawan ke jadwal kerja.
/** Mengekspor assignEmployees untuk kebutuhan modul ini. */
export const assignEmployees = WorkingScheduleService.assignEmployees;
