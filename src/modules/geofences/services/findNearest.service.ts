// * File ini menangani operasi baca/report untuk module geofences.

import { GeofenceService as LegacyGeofenceService } from "../legacy";

// & Find nearest geofence by coordinates.
// % Cari geofence terdekat berdasarkan koordinat.
export const findNearest = LegacyGeofenceService.findNearest;