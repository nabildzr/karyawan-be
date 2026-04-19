// * File ini menangani operasi baca/report untuk module geofences.

import { GeofenceService as LegacyGeofenceService } from "../legacy";

// & Get all geofences.
// % Ambil semua geofence.
export const getAll = LegacyGeofenceService.getAll;