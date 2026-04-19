// * File ini menangani utilitas internal module geofences.

import { GeofenceRepository } from "../repository";

// & Placeholder validation to mark repository abstraction usage.
// % Placeholder validasi untuk menandai penggunaan abstraction repository.
export function validateGeofenceRequest() {
  return Boolean(GeofenceRepository.getClient());
}