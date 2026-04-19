// * Backend module service: src/modules/geofences/service.ts
import { create } from "./services/create.service";
import { remove } from "./services/delete.service";
import { findNearest } from "./services/findNearest.service";
import { getAll } from "./services/getAll.service";
import { getById } from "./services/getById.service";
import { getOfficeLocations } from "./services/getOfficeLocations.service";
import { update } from "./services/update.service";

export const GeofencesService = {
  create,
  update,
  getAll,
  getOfficeLocations,
  getById,
  findNearest,
  // & Delete geofence.
  // % Hapus geofence.
  delete: remove,
};
