// * File ini menangani operasi baca/report untuk module geofences.

import { GeofenceService as LegacyGeofenceService } from "../legacy";

// & Get all geofences.
// % Ambil semua geofence.
export const getAll = LegacyGeofenceService.getAll;

// & Get office geofence locations for employee attendance map.
// % Ambil daftar geofence kantor untuk peta absensi karyawan.
export const getOfficeLocations = LegacyGeofenceService.getAll;

// & Get geofence detail by id.
// % Ambil detail geofence berdasarkan id.
export const getById = LegacyGeofenceService.getById;

// & Find nearest geofence by coordinates.
// % Cari geofence terdekat berdasarkan koordinat.
export const findNearest = LegacyGeofenceService.findNearest;
