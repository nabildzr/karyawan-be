import Elysia, { t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAdminOrCEO, checkAuth } from "../../middleware/auth"; // Guard admin/ceo + endpoint authenticated untuk portal karyawan
import { resolveAuditActor } from "../../shared/audit/actor";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import { GeofenceInputCreateDTO, GeofenceInputUpdateDTO } from "./model";
import { GeofenceService } from "./service";

export const geofenceRoutes = new Elysia({
  prefix: "/geofences",
  detail: { tags: ["Geofences"] }, // Kelompok endpoint di Swagger/OpenAPI
})
  .use(authPlugin) // Inject `auth` context (hasil verifikasi JWT) ke setiap request

  // & ====== GET ALL GEOFENCES ======
  // Mengembalikan semua geofence beserta lat/lon/radius untuk rendering peta
  .get(
    "/",
    async ({ set }) => {
      try {
        const data = await GeofenceService.getAll();
        set.status = HttpStatusEnum.HTTP_200_OK; // 200: berhasil mengambil data
        return successResponse({
          data,
          message: "Berhasil mengambil data geofence.",
        });
      } catch (error: any) {
        // mapError membaca prefix error message ("Not Found:", "Bad Request:", dll)
        // dan mengeset HTTP status yang sesuai secara otomatis
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdminOrCEO], // Hanya ADMIN / CEO yang boleh melihat daftar geofence
      detail: { summary: "[Admin/CEO] Ambil semua data geofence" },
    },
  )

  // & ====== GET NEAREST GEOFENCE ======
  // Mencari geofence "kantor terdekat" dari koordinat GPS yang dikirim.
  // Digunakan untuk debugging / validasi lokasi tanpa melakukan absensi.
  .get(
    "/nearest",
    async ({ query, set }) => {
      try {
        // Konversi query string ke number — query params selalu bertipe string di HTTP
        const lat = parseFloat(query.latitude);
        const lon = parseFloat(query.longitude);

        // Guard: pastikan nilai valid setelah parse (NaN = string bukan angka)
        if (isNaN(lat) || isNaN(lon)) {
          set.status = HttpStatusEnum.HTTP_400_BAD_REQUEST;
          return {
            success: false,
            message: "latitude dan longitude harus berupa angka valid.",
          };
        }

        // Jalankan algoritma nearest-office: sort semua geofence by distance, ambil yang dalam radius
        const nearest = await GeofenceService.findNearest(lat, lon);

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: nearest, // null jika di luar semua geofence
          message: nearest
            ? `Geofence terdekat: "${nearest.name}" (${nearest.distanceMeters} m dari posisi Anda).`
            : "Posisi Anda berada di luar semua area geofence yang terdaftar.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdminOrCEO], // Hanya Admin/CEO untuk endpoint debugging ini
      query: t.Object({
        latitude: t.String({ description: "Latitude GPS (contoh: -6.2088)" }), // Query param selalu string
        longitude: t.String({
          description: "Longitude GPS (contoh: 106.8456)",
        }), // Query param selalu string
      }),
      detail: {
        summary: "[Admin/CEO] Cari geofence kantor terdekat dari koordinat GPS",
      },
    },
  )

  // & ====== GET OFFICE LOCATIONS (EMPLOYEE) ======
  // % Endpoint read-only untuk kebutuhan peta absensi portal karyawan.
  .get(
    "/office-locations",
    async ({ set }) => {
      try {
        const data = await GeofenceService.getOfficeLocations();
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
        summary:
          "[Authenticated] Ambil daftar lokasi kantor untuk absensi karyawan",
      },
    },
  )

  // & ====== GET GEOFENCE BY ID ======
  // % Mengambil detail satu geofence termasuk statistik pemakaian absensi
  .get(
    "/:id",
    async ({ params, set }) => {
      try {
        const data = await GeofenceService.getById(params.id);
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
      beforeHandle: [checkAdminOrCEO], // Hanya Admin/CEO
      params: t.Object({ id: t.String() }), // Validasi: id harus berupa string (UUID)
      detail: {
        summary:
          "[Admin/CEO] Ambil detail geofence + statistik pemakaian absensi",
      },
    },
  )

  // & ====== POST CREATE GEOFENCE ======
  // % Mendaftarkan area geofence baru; akan divalidasi koordinat dan duplikasi nama
  .post(
    "/",
    async ({ auth, body, set }) => {
      try {
        const data = await GeofenceService.create(
          body,
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_201_CREATED; // 201: resource baru berhasil dibuat
        return successResponse({
          data,
          message: "Berhasil membuat geofence baru.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdminOrCEO], // Hanya Admin/CEO yang boleh menambah area lokasi
      body: GeofenceInputCreateDTO, // TypeBox schema dari model.ts (otomatis validasi & docs)
      detail: { summary: "[Admin/CEO] Daftarkan area geofence baru" },
    },
  )

  // & ====== PUT UPDATE GEOFENCE ======
  // Memperbarui data geofence; koordinat harus dikirim berpasangan (lat+lon atau tidak sama sekali)
  .put(
    "/:id",
    async ({ auth, body, params, set }) => {
      try {
        const data = await GeofenceService.update(
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
      beforeHandle: [checkAdminOrCEO], // Hanya Admin/CEO
      params: t.Object({ id: t.String() }),
      body: GeofenceInputUpdateDTO, // TypeBox schema untuk partial update
      detail: {
        summary: "[Admin/CEO] Perbarui data geofence (lat+lon harus sepasang)",
      },
    },
  )

  // & ====== DELETE GEOFENCE ======
  // Menghapus geofence; DITOLAK jika masih digunakan dalam data absensi historis
  .delete(
    "/:id",
    async ({ auth, params, set }) => {
      try {
        const data = await GeofenceService.delete(
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
      beforeHandle: [checkAdminOrCEO], // Hanya Admin/CEO
      params: t.Object({ id: t.String() }),
      detail: {
        summary:
          "[Admin/CEO] Hapus geofence (ditolak jika masih ada absensi yang memakai)",
      },
    },
  );

