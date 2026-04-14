// * File ini menangani operasi tulis untuk module geofences.

import { GeofenceService as LegacyGeofenceService } from "../legacy";

// & Create geofence.
// % Buat geofence.
export const create = LegacyGeofenceService.create;

// & Update geofence.
// % Update geofence.
export const update = LegacyGeofenceService.update;

// & Delete geofence.
// % Hapus geofence.
export const remove = LegacyGeofenceService.delete;
