// * File ini menangani validasi bisnis untuk module working schedules.

import { WorkingScheduleRepository } from "../repository";

// & Placeholder validation to mark repository abstraction usage.
// % Placeholder validasi untuk menandai penggunaan abstraction repository.
export function validateWorkingScheduleRequest() {
  return Boolean(WorkingScheduleRepository.getClient());
}
