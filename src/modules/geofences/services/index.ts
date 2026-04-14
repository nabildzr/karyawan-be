// * File ini adalah facade orchestrator untuk module geofences.

import { create, remove, update } from "./create";
import { findNearest, getAll, getById, getOfficeLocations } from "./report";

export const GeofenceService = {
  // & Get geofence list.
  // % Ambil daftar geofence.
  getAll,

  // & Get office locations for employee attendance map.
  // % Ambil lokasi kantor untuk peta absensi karyawan.
  getOfficeLocations,

  // & Get geofence detail.
  // % Ambil detail geofence.
  getById,

  // & Find nearest geofence.
  // % Cari geofence terdekat.
  findNearest,

  // & Create geofence.
  // % Buat geofence.
  create,

  // & Update geofence.
  // % Update geofence.
  update,

  // & Delete geofence.
  // % Hapus geofence.
  delete: remove,
};
