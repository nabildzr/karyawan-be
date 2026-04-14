// * File ini menyimpan implementasi legacy service module geofences sebagai referensi transisi.

import prisma from "../../config/prisma";
import { calculateDistanceInMeters } from "../../utils/geo"; // Fungsi Haversine untuk menghitung jarak dua koordinat GPS (dalam meter)
import { AuditActor } from "../../shared/audit/actor";
import { writeAuditLog } from "../../shared/audit/geofence";
import type { GeofenceInputCreateType, GeofenceInputUpdateType } from "./model";

// Regex validasi pasangan koordinat "lat, lon":
// - Latitude : -90.0000000 s/d 90.0000000 (lintang bumi, sumbu Y)
// - Longitude: -180.0000000 s/d 180.0000000 (bujur bumi, sumbu X)
// - Presisi desimal hingga 10 digit untuk akurasi ~1 mm
const COORDINATE_REGEX =
  /^-?([0-8]?[0-9]|90)(\.[0-9]{1,10})?,\s*-?([0-9]{1,2}|1[0-7][0-9]|180)(\.[0-9]{1,10})?$/;

export const GeofenceService = {
  // & ============ GET ALL GEOFENCES ============
  /**
   * Mengambil semua geofence yang terdaftar, diurutkan dari terbaru.
   * Semua field (termasuk lat/lon/radius) dikembalikan agar frontend/map
   * bisa merender lingkaran geofence pada peta.
   */
  async getAll() {
    // findMany tanpa select → Prisma mengembalikan semua kolom secara default
    const geofences = await prisma.geofences.findMany({
      orderBy: { createdAt: "desc" }, // Terbaru di atas agar mudah ditemukan di UI
    });
    return geofences;
  },

  // & ============ GET GEOFENCE BY ID ============
  /**
   * Mengambil detail satu geofence beserta statistik pemakaian historis.
   * _count digunakan untuk menampilkan berapa kali geofence ini dipakai absensi,
   * berguna sebelum admin memutuskan untuk menghapus geofence.
   */
  async getById(id: string) {
    // findUnique: query by primary key, paling efisien (O(1) via index)
    const geofence = await prisma.geofences.findUnique({
      where: { id }, // Primary key lookup
      include: {
        _count: {
          select: {
            attendancesCheckIn: true, // Jumlah absensi check-in yang pernah terjadi di sini
            attendancesCheckOut: true, // Jumlah absensi check-out yang pernah terjadi di sini
          },
        },
      },
    });

    // Lempar error ber-prefix agar mapError bisa parse kode HTTP yang tepat
    if (!geofence) {
      throw new Error("Not Found: Geofence dengan ID tersebut tidak ditemukan");
    }

    return geofence;
  },

  // & ============ FIND NEAREST GEOFENCE (ALGORITMA MULTI-LOKASI) ============
  /**
   * Mencari geofence "kantor terdekat" dari posisi GPS user.
   *
   * Algoritma:
   *   1. Ambil semua geofence dari DB dalam satu query (menghindari N+1 problem)
   *   2. Hitung jarak Haversine antara posisi user dan pusat SETIAP geofence
   *   3. Urutkan hasil dari yang terdekat ke terjauh (sort ascending by distanceMeters)
   *   4. Kembalikan geofence pertama yang jarak-nya MASIH ≤ radius-nya (dalam batas)
   *   5. Jika tidak ada yang cocok → kembalikan null (user di luar semua area)
   *
   * Kenapa "terdekat" lebih baik dari "pertama yang cocok"?
   *   → Jika dua area geofence saling overlap (gedung berdekatan), user akan
   *     selalu tercatat di kantor yang paling dekat secara fisik, bukan random.
   *
   * @param userLat - Latitude GPS user (dari sensor perangkat)
   * @param userLon - Longitude GPS user (dari sensor perangkat)
   * @returns Geofence terdekat yang masih dalam radius, atau null jika di luar semua area
   */
  async findNearest(
    userLat: number,
    userLon: number,
  ): Promise<{
    id: string;
    name: string;
    radius: number;
    distanceMeters: number;
  } | null> {
    // Satu query mengambil semua geofence — lebih efisien dari N query terpisah
    const allGeofences = await prisma.geofences.findMany();

    // Guard: jika belum ada geofence terdaftar, langsung kembalikan null
    if (allGeofences.length === 0) return null;

    // Tahap 1: Hitung jarak dari user ke SETIAP pusat geofence menggunakan Haversine
    const withDistances = allGeofences.map((gf) => ({
      id: gf.id,
      name: gf.name,
      radius: gf.radius,
      // Prisma menyimpan Decimal — harus dikonversi ke number JS sebelum dihitung
      distanceMeters: calculateDistanceInMeters(
        userLat,
        userLon,
        Number(gf.latitude), // Decimal → number (hilangkan presisi Prisma Decimal)
        Number(gf.longitude), // Decimal → number
      ),
    }));

    // Tahap 2: Sort ascending → index 0 = geofence terdekat dari user
    withDistances.sort((a, b) => a.distanceMeters - b.distanceMeters);

    // Tahap 3: Ambil kandidat pertama yang masih dalam batas radius-nya
    // distanceMeters <= radius berarti user BERADA DI DALAM lingkaran geofence
    const matched = withDistances.find((gf) => gf.distanceMeters <= gf.radius);

    // null berarti semua kantor di luar jangkauan → absensi harus ditolak
    if (!matched) return null;

    return {
      id: matched.id,
      name: matched.name,
      radius: matched.radius,
      distanceMeters: Math.round(matched.distanceMeters), // Bulatkan ke meter penuh (tidak perlu presisi cm)
    };
  },

  // & ============ CREATE GEOFENCE ============
  /**
   * Membuat geofence baru dengan validasi lengkap sebelum insert ke DB.
   */
  async create(data: GeofenceInputCreateType, actor: AuditActor) {
    const { name, latitude, longitude, radius } = data;

    // Validasi 1: Nama tidak boleh berisi whitespace saja (trim() menghapus spasi)
    if (name.trim() === "") {
      throw new Error("Bad Request: Nama lokasi tidak dapat kosong");
    }

    // Validasi 2: Cek duplikasi nama geofence (case-sensitive)
    // findFirst cukup karena kita hanya perlu tahu apakah ada minimal 1 record
    const nameExists = await prisma.geofences.findFirst({ where: { name } });
    if (nameExists) {
      throw new Error("Conflict: Lokasi dengan nama ini telah terdaftar");
    }

    // Validasi 3: Radius harus positif — nilai 0 tidak memiliki area dan nilai negatif tidak valid
    if (radius <= 0) {
      throw new Error("Bad Request: Value radius harus lebih besar dari 0");
    }

    // Validasi 4: Format koordinat GPS sesuai standar WGS-84
    if (!COORDINATE_REGEX.test(`${latitude}, ${longitude}`)) {
      throw new Error("Bad Request: Format koordinat invalid");
    }

    // Insert ke DB — Prisma otomatis mengisi id (cuid), createdAt, updatedAt
    const geofence = await prisma.geofences.create({ data });

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

  // & ============ UPDATE GEOFENCE ============
  /**
   * Memperbarui geofence secara partial (hanya field yang dikirim yang diubah).
   * Koordinat latitude dan longitude harus diperbarui BERSAMAAN — tidak boleh
   * mengubah hanya salah satu, karena keduanya membentuk satu titik pada peta.
   */
  async update(id: string, data: GeofenceInputUpdateType, actor: AuditActor) {
    const { name, latitude, longitude, radius } = data;

    // Validasi 1: Jika nama dikirim, pastikan bukan string kosong
    if (typeof name === "string" && name.trim() === "") {
      throw new Error("Bad Request: Nama lokasi tidak dapat kosong");
    }

    // Cari data existing — diperlukan untuk:
    //   (a) cek eksistensi record sebelum update
    //   (b) membandingkan nama lama vs baru untuk validasi duplikasi
    const existingGeofence = await prisma.geofences.findUnique({
      where: { id },
    });
    if (!existingGeofence) {
      throw new Error("Not Found: Geofence dengan ID tersebut tidak ditemukan");
    }

    // Validasi 2: Duplikasi nama — hanya cek jika nama benar-benar berubah
    // (skip jika nama yang dikirim sama dengan yang sudah ada di DB)
    if (typeof name === "string" && name !== existingGeofence.name) {
      const nameExists = await prisma.geofences.findFirst({ where: { name } });
      if (nameExists) {
        throw new Error("Conflict: Lokasi dengan nama ini telah terdaftar");
      }
    }

    // Validasi 3: Radius hanya divalidasi jika dikirim dalam body request
    if (typeof radius === "number" && radius <= 0) {
      throw new Error("Bad Request: Value radius harus lebih besar dari 0");
    }

    // Validasi 4: Koordinat hanya divalidasi jika SALAH SATU atau KEDUANYA dikirim.
    // Aturan: lat dan lon adalah pasangan tak terpisahkan — harus keduanya atau tidak sama sekali.
    if (latitude !== undefined || longitude !== undefined) {
      // Satu ada tapi yang lain tidak → tolak (mencegah koordinat setengah-setengah)
      if (latitude === undefined || longitude === undefined) {
        throw new Error(
          "Bad Request: latitude dan longitude harus diperbarui bersamaan",
        );
      }
      // Test format WGS-84 setelah dipastikan keduanya ada
      if (!COORDINATE_REGEX.test(`${latitude}, ${longitude}`)) {
        throw new Error("Bad Request: Format koordinat invalid");
      }
    }

    // Eksekusi update — Prisma hanya mengubah field yang ada di object `data`
    const geofence = await prisma.geofences.update({
      where: { id }, // Target record berdasarkan primary key
      data, // Partial update: hanya field yang disertakan yang berubah
    });

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

  // & ============ DELETE GEOFENCE ============
  /**
   * Menghapus geofence dengan validasi integritas referensial terlebih dahulu.
   * Geofence yang masih direferensikan oleh data absensi TIDAK BOLEH dihapus
   * karena akan merusak data historis (record absensi kehilangan info lokasi).
   */
  async delete(id: string, actor: AuditActor) {
    const existingGeofence = await prisma.geofences.findUnique({
      where: { id },
    });
    if (!existingGeofence) {
      throw new Error("Not Found: Geofence dengan ID tersebut tidak ditemukan");
    }

    // Jalankan dua count query secara paralel (Promise.all) untuk efisiensi
    // — menghindari dua query serial yang tidak perlu
    const [checkInCount, checkOutCount] = await Promise.all([
      // Hitung berapa record absensi yang check-in menggunakan geofence ini
      prisma.attendances.count({ where: { geofencesId: id } }),
      // Hitung berapa record absensi yang check-out menggunakan geofence ini
      prisma.attendances.count({ where: { geofencesCheckOutId: id } }),
    ]);

    const totalUsage = checkInCount + checkOutCount; // Total referensi aktif

    // Tolak penghapusan jika masih ada absensi yang memakai geofence ini
    if (totalUsage > 0) {
      throw new Error(
        `Gagal menghapus: Geofence ini masih digunakan dalam ${totalUsage} data absensi ` +
          `(check-in: ${checkInCount}, check-out: ${checkOutCount}). ` +
          `Data absensi historis tidak boleh kehilangan referensi lokasi.`,
      );
    }

    // Aman untuk dihapus — tidak ada referensi aktif di tabel attendances
    const geofence = await prisma.geofences.delete({ where: { id } });

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

