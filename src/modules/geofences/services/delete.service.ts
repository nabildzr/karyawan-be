// * File ini menangani operasi tulis untuk module geofences.

import { GeofenceService as LegacyGeofenceService } from "../legacy";

// & Delete geofence.
// % Hapus geofence.
export const remove = LegacyGeofenceService.delete;
