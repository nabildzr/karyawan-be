import type { AuditActor } from "../../shared/audit/actor";
import { writeAuditLog } from "../../shared/audit/geofence";
import { calculateDistanceInMeters } from "../../utils/geo";
import {
  countAttendancesByCheckInGeofenceId,
  countAttendancesByCheckOutGeofenceId,
  createGeofence,
  deleteGeofenceById,
  findAllGeofences,
  findAllGeofencesForDistance,
  findGeofenceById,
  findGeofenceByName,
  findGeofenceWithUsageById,
  updateGeofenceById,
} from "./geofences.repository";
import type {
  GeofenceInputCreateType,
  GeofenceInputUpdateType,
} from "./geofences.schema";
import { COORDINATE_REGEX } from "./utils/constants";

type NearestGeofencePayload = {
  id: string;
  name: string;
  radius: number;
  distanceMeters: number;
};

/** Memvalidasi format koordinat latitude dan longitude. */
function validateCoordinateFormat(latitude: number, longitude: number) {
  if (!COORDINATE_REGEX.test(`${latitude}, ${longitude}`)) {
    throw new Error("Bad Request: Format koordinat invalid");
  }
}

/** Memastikan radius geofence bernilai lebih dari nol. */
function validateRadius(radius: number) {
  if (radius <= 0) {
    throw new Error("Bad Request: Value radius harus lebih besar dari 0");
  }
}

/** Memastikan nama geofence tidak kosong. */
function validateName(name: string) {
  if (name.trim() === "") {
    throw new Error("Bad Request: Nama lokasi tidak dapat kosong");
  }
}

/** Mengekspor GeofencesService untuk kebutuhan modul ini. */
export const GeofencesService = {
  /** Mengambil semua geofence yang terdaftar. */
  async getAll() {
    return findAllGeofences();
  },

  /** Mengambil daftar lokasi kantor untuk kebutuhan peta absensi. */
  async getOfficeLocations() {
    return findAllGeofences();
  },

  /** Mengambil detail geofence beserta statistik pemakaian historis. */
  async getById(id: string) {
    const geofence = await findGeofenceWithUsageById(id);

    if (!geofence) {
      throw new Error("Not Found: Geofence dengan ID tersebut tidak ditemukan");
    }

    return geofence;
  },

  /** Mencari geofence terdekat yang masih berada dalam radius. */
  async findNearest(
    userLat: number,
    userLon: number,
  ): Promise<NearestGeofencePayload | null> {
    const allGeofences = await findAllGeofencesForDistance();

    if (allGeofences.length === 0) {
      return null;
    }

    const withDistances = allGeofences.map((geofence) => ({
      id: geofence.id,
      name: geofence.name,
      radius: Number(geofence.radius),
      distanceMeters: calculateDistanceInMeters(
        userLat,
        userLon,
        Number(geofence.latitude),
        Number(geofence.longitude),
      ),
    }));

    withDistances.sort((a, b) => a.distanceMeters - b.distanceMeters);
    const nearest = withDistances.find(
      (geofence) => geofence.distanceMeters <= geofence.radius,
    );

    if (!nearest) {
      return null;
    }

    return {
      id: nearest.id,
      name: nearest.name,
      radius: nearest.radius,
      distanceMeters: Math.round(nearest.distanceMeters),
    };
  },

  /** Membuat geofence baru dengan validasi dasar sebelum penyimpanan. */
  async create(data: GeofenceInputCreateType, actor: AuditActor) {
    validateName(data.name);

    const nameExists = await findGeofenceByName(data.name);
    if (nameExists) {
      throw new Error("Conflict: Lokasi dengan nama ini telah terdaftar");
    }

    validateRadius(data.radius);
    validateCoordinateFormat(data.latitude, data.longitude);

    const geofence = await createGeofence(data);

    await writeAuditLog({
      actor,
      action: "CREATE_GEOFENCE",
      entityId: geofence.id,
      changes: {
        before: null,
        after: {
          name: geofence.name,
          latitude: geofence.latitude,
          longitude: geofence.longitude,
          radius: geofence.radius,
        },
      },
    });

    return geofence;
  },

  /** Memperbarui geofence secara parsial dengan validasi perubahan penting. */
  async update(id: string, data: GeofenceInputUpdateType, actor: AuditActor) {
    if (typeof data.name === "string") {
      validateName(data.name);
    }

    const existingGeofence = await findGeofenceById(id);
    if (!existingGeofence) {
      throw new Error("Not Found: Geofence dengan ID tersebut tidak ditemukan");
    }

    if (typeof data.name === "string" && data.name !== existingGeofence.name) {
      const nameExists = await findGeofenceByName(data.name);
      if (nameExists) {
        throw new Error("Conflict: Lokasi dengan nama ini telah terdaftar");
      }
    }

    if (typeof data.radius === "number") {
      validateRadius(data.radius);
    }

    if (data.latitude !== undefined || data.longitude !== undefined) {
      if (data.latitude === undefined || data.longitude === undefined) {
        throw new Error(
          "Bad Request: latitude dan longitude harus diperbarui bersamaan",
        );
      }

      validateCoordinateFormat(data.latitude, data.longitude);
    }

    const geofence = await updateGeofenceById(id, data);

    await writeAuditLog({
      actor,
      action: "UPDATE_GEOFENCE",
      entityId: geofence.id,
      changes: {
        before: {
          name: existingGeofence.name,
          latitude: existingGeofence.latitude,
          longitude: existingGeofence.longitude,
          radius: existingGeofence.radius,
        },
        after: {
          name: geofence.name,
          latitude: geofence.latitude,
          longitude: geofence.longitude,
          radius: geofence.radius,
        },
      },
    });

    return geofence;
  },

  /** Menghapus geofence jika tidak dipakai oleh data absensi historis. */
  async delete(id: string, actor: AuditActor) {
    const existingGeofence = await findGeofenceById(id);
    if (!existingGeofence) {
      throw new Error("Not Found: Geofence dengan ID tersebut tidak ditemukan");
    }

    const [checkInCount, checkOutCount] = await Promise.all([
      countAttendancesByCheckInGeofenceId(id),
      countAttendancesByCheckOutGeofenceId(id),
    ]);

    const totalUsage = checkInCount + checkOutCount;

    if (totalUsage > 0) {
      throw new Error(
        `Gagal menghapus: Geofence ini masih digunakan dalam ${totalUsage} data absensi ` +
          `(check-in: ${checkInCount}, check-out: ${checkOutCount}). ` +
          `Data absensi historis tidak boleh kehilangan referensi lokasi.`,
      );
    }

    const geofence = await deleteGeofenceById(id);

    await writeAuditLog({
      actor,
      action: "DELETE_GEOFENCE",
      entityId: geofence.id,
      changes: {
        before: {
          name: existingGeofence.name,
          latitude: existingGeofence.latitude,
          longitude: existingGeofence.longitude,
          radius: existingGeofence.radius,
        },
        after: null,
      },
    });

    return geofence;
  },
};

/** Mengekspor GeofenceService untuk kompatibilitas lintas module. */
export const GeofenceService = GeofencesService;