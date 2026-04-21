import prisma from "../../config/prisma";
import type {
  GeofenceInputCreateType,
  GeofenceInputUpdateType,
} from "./geofences.schema";

/** Mengambil semua geofence mentah dari database. */
export async function findAllGeofences() {
  return prisma.geofences.findMany({
    orderBy: { createdAt: "desc" },
  });
}

/** Mengambil data geofence mentah untuk kebutuhan perhitungan jarak. */
export async function findAllGeofencesForDistance() {
  return prisma.geofences.findMany({
    select: {
      id: true,
      name: true,
      radius: true,
      latitude: true,
      longitude: true,
    },
  });
}

/** Mengambil detail geofence mentah beserta statistik pemakaiannya. */
export async function findGeofenceWithUsageById(id: string) {
  return prisma.geofences.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          attendancesCheckIn: true,
          attendancesCheckOut: true,
        },
      },
    },
  });
}

/** Mengambil satu geofence mentah berdasarkan id. */
export async function findGeofenceById(id: string) {
  return prisma.geofences.findUnique({
    where: { id },
  });
}

/** Mengambil geofence mentah berdasarkan nama. */
export async function findGeofenceByName(name: string) {
  return prisma.geofences.findFirst({
    where: { name },
  });
}

/** Menyimpan geofence mentah baru ke database. */
export async function createGeofence(data: GeofenceInputCreateType) {
  return prisma.geofences.create({
    data,
  });
}

/** Memperbarui geofence mentah berdasarkan id. */
export async function updateGeofenceById(
  id: string,
  data: GeofenceInputUpdateType,
) {
  return prisma.geofences.update({
    where: { id },
    data,
  });
}

/** Menghapus geofence mentah berdasarkan id. */
export async function deleteGeofenceById(id: string) {
  return prisma.geofences.delete({
    where: { id },
  });
}

/** Menghitung jumlah absensi check-in yang memakai geofence tertentu. */
export async function countAttendancesByCheckInGeofenceId(id: string) {
  return prisma.attendances.count({
    where: { geofencesId: id },
  });
}

/** Menghitung jumlah absensi check-out yang memakai geofence tertentu. */
export async function countAttendancesByCheckOutGeofenceId(id: string) {
  return prisma.attendances.count({
    where: { geofencesCheckOutId: id },
  });
}