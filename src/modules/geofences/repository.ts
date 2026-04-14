// * Repository ini menjadi lapisan akses data untuk module geofences.

import prisma from "../../config/prisma";

export const GeofenceRepository = {
  // & Expose prisma client for geofence repository migration.
  // % Ekspos prisma client untuk migrasi repository geofence.
  getClient() {
    return prisma;
  },
};
