import { t } from "elysia";
import {
  GeofencesInputCreate,
  GeofencesInputUpdate,
} from "../../generated/prismabox/Geofences";

export const geofencesQueryDTO = t.Object({});

// & ============ Omit Field-field otomatis dari db ============
export const GeofenceInputCreateDTO = t.Omit(GeofencesInputCreate, [
  "id",
  "createdAt",
  "attendancesCheckIn",
  "attendancesCheckOut",
  "updatedAt",
]);

export const GeofenceInputUpdateDTO = t.Omit(GeofencesInputUpdate, [
  "id",
  "createdAt",
  "attendancesCheckIn",
  "attendancesCheckOut",
  "updatedAt",
]);

export type GeofenceInputCreateType = {
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
};

export type GeofenceInputUpdateType = {
  name?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
};
