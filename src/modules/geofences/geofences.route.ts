import Elysia, { t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAdminOrCEO, checkAuth } from "../../middleware/auth";
import { resolveAuditActor } from "../../shared/audit/actor";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import {
  GeofenceInputCreateDTO,
  GeofenceInputUpdateDTO,
} from "./geofences.schema";
import { GeofencesService } from "./geofences.service";

/** Mengekspor geofenceRoutes untuk kebutuhan modul ini. */
export const geofenceRoutes = new Elysia({
  prefix: "/geofences",
  detail: { tags: ["Geofences"] },
})
  .use(authPlugin)
  .get(
    "/",
    async ({ set }) => {
      try {
        const data = await GeofencesService.getAll();
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil data geofence.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdminOrCEO],
      detail: { summary: "[Admin/CEO] Ambil semua data geofence" },
    },
  )
  .get(
    "/nearest",
    async ({ query, set }) => {
      try {
        const lat = parseFloat(query.latitude);
        const lon = parseFloat(query.longitude);

        if (isNaN(lat) || isNaN(lon)) {
          throw new Error("Bad Request: latitude dan longitude harus berupa angka valid.");
        }

        const nearest = await GeofencesService.findNearest(lat, lon);

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: nearest,
          message: nearest
            ? `Geofence terdekat: "${nearest.name}" (${nearest.distanceMeters} m dari posisi Anda).`
            : "Posisi Anda berada di luar semua area geofence yang terdaftar.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdminOrCEO],
      query: t.Object({
        latitude: t.String({ description: "Latitude GPS (contoh: -6.2088)" }),
        longitude: t.String({
          description: "Longitude GPS (contoh: 106.8456)",
        }),
      }),
      detail: {
        summary: "[Admin/CEO] Cari geofence kantor terdekat dari koordinat GPS",
      },
    },
  )
  .get(
    "/office-locations",
    async ({ set }) => {
      try {
        const data = await GeofencesService.getOfficeLocations();
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil lokasi kantor geofence.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      detail: {
        summary: "[Authenticated] Ambil daftar lokasi kantor untuk absensi karyawan",
      },
    },
  )
  .get(
    "/:id",
    async ({ params, set }) => {
      try {
        const data = await GeofencesService.getById(params.id);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil detail geofence.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdminOrCEO],
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "[Admin/CEO] Ambil detail geofence + statistik pemakaian absensi",
      },
    },
  )
  .post(
    "/",
    async ({ auth, body, set }) => {
      try {
        const data = await GeofencesService.create(body, resolveAuditActor(auth));
        set.status = HttpStatusEnum.HTTP_201_CREATED;
        return successResponse({
          data,
          message: "Berhasil membuat geofence baru.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdminOrCEO],
      body: GeofenceInputCreateDTO,
      detail: { summary: "[Admin/CEO] Daftarkan area geofence baru" },
    },
  )
  .put(
    "/:id",
    async ({ auth, body, params, set }) => {
      try {
        const data = await GeofencesService.update(
          params.id,
          body,
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil memperbarui geofence.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdminOrCEO],
      params: t.Object({ id: t.String() }),
      body: GeofenceInputUpdateDTO,
      detail: {
        summary: "[Admin/CEO] Perbarui data geofence (lat+lon harus sepasang)",
      },
    },
  )
  .delete(
    "/:id",
    async ({ auth, params, set }) => {
      try {
        const data = await GeofencesService.delete(
          params.id,
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil menghapus geofence.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdminOrCEO],
      params: t.Object({ id: t.String() }),
      detail: {
        summary:
          "[Admin/CEO] Hapus geofence (ditolak jika masih ada absensi yang memakai)",
      },
    },
  );