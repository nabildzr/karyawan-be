// * File ini menangani operasi baca/report untuk module geofences.

import { GeofenceService as LegacyGeofenceService } from "../legacy";

// & Get geofence detail by id.
// % Ambil detail geofence berdasarkan id.
export const getById = LegacyGeofenceService.getById;