// * File ini menangani operasi baca/report untuk module geofences.

import { GeofenceService as LegacyGeofenceService } from "../legacy";

// & Get office geofence locations for employee attendance map.
// % Ambil daftar geofence kantor untuk peta absensi karyawan.
export const getOfficeLocations = LegacyGeofenceService.getAll;