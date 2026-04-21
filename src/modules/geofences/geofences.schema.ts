import { t } from "elysia";
import {
  GeofencesInputCreate,
  GeofencesInputUpdate,
} from "../../generated/prismabox/Geofences";

/** Mengekspor geofencesQueryDTO untuk kebutuhan modul ini. */
export const geofencesQueryDTO = t.Object({});

/** Mengekspor GeofenceInputCreateDTO untuk kebutuhan modul ini. */
export const GeofenceInputCreateDTO = t.Omit(GeofencesInputCreate, [
  "id",
  "createdAt",
  "attendancesCheckIn",
  "attendancesCheckOut",
  "updatedAt",
]);

/** Mengekspor GeofenceInputUpdateDTO untuk kebutuhan modul ini. */
export const GeofenceInputUpdateDTO = t.Omit(GeofencesInputUpdate, [
  "id",
  "createdAt",
  "attendancesCheckIn",
  "attendancesCheckOut",
  "updatedAt",
]);

/** Mendefinisikan alias tipe untuk GeofenceInputCreateType. */
export type GeofenceInputCreateType = {
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
};

/** Mendefinisikan alias tipe untuk GeofenceInputUpdateType. */
export type GeofenceInputUpdateType = {
  name?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
};