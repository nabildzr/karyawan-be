// import prisma from "../../config/prisma";
// import { haversineDistance } from "../../utils";

// const FLASK_MATCH_URL = "http://127.0.0.1:5000/v1/faces/match";

// /** Mapping English → Indonesian day names */
// const EN_TO_ID: Record<string, string> = {
//   Monday: "Senin", Tuesday: "Selasa", Wednesday: "Rabu", Thursday: "Kamis",
//   Friday: "Jumat", Saturday: "Sabtu", Sunday: "Minggu",
// };

// /** Sama kayak di workingSchedules — dapat nama hari Indonesia dari Date */
// const getDayNameID = (date: Date, timezone: string): string => {
//   const en = date.toLocaleDateString("en-US", { weekday: "long", timeZone: timezone });
//   return EN_TO_ID[en] ?? en;
// };

// /** Parse "HH:mm" → { hours, minutes } */
// const parseTime = (t: string) => {
//   const [h, m] = t.split(":").map(Number);
//   return { hours: h, minutes: m };
// };

// export interface CheckInPayload {
//   image: File;
//   latitude?: number;
//   longitude?: number;
//   deviceInfo?: string;
//   timezone?: string;
// }

// export const AttendanceService = {
//   async checkIn(userId: string, payload: CheckInPayload) {
//     const { image, latitude, longitude, deviceInfo, timezone = "Asia/Jakarta" } = payload;

//     // ── 1. Cari employee + jadwal hari ini ──
//     const employee = await prisma.employees.findFirst({
//       where: { userId },
//       include: {
//         workingSchedules: {
//           include: { days: { include: { shift: true } } },
//         },
//       },
//     });

//     if (!employee) throw new Error("Not Found: Data karyawan tidak ditemukan.");

//     const now = new Date();
//     const todayName = getDayNameID(now, timezone);

//     const scheduleDay = employee.workingSchedules?.days.find(
//       (d) => d.dayOfWeek === todayName,
//     );

//     if (!scheduleDay || !scheduleDay.isActive || !scheduleDay.shift) {
//       throw new Error("Bad Request: Hari ini bukan hari kerja Anda atau shift belum diatur.");
//     }

//     const shift = scheduleDay.shift;

//     // ── 2. Cek duplikat check-in hari ini ──
//     const todayStr = now.toLocaleDateString("sv-SE", { timeZone: timezone }); // "YYYY-MM-DD"
//     const dayStart = new Date(`${todayStr}T00:00:00.000Z`);
//     const dayEnd = new Date(`${todayStr}T23:59:59.999Z`);

//     const existing = await prisma.attendances.findFirst({
//       where: {
//         employeeId: employee.id,
//         checkIn: { not: null },
//         createdAt: { gte: dayStart, lte: dayEnd },
//       },
//     });

//     if (existing) {
//       throw new Error("Conflict: Anda sudah melakukan check-in hari ini.");
//     }

//     // ── 3. Geofence check (jika lokasi dikirim) ──
//     let geofenceId: string | null = null;
//     let radiusSnapshot: number | null = null;

//     if (latitude != null && longitude != null) {
//       const geofences = await prisma.geofences.findMany();

//       const matched = geofences.find((gf) => {
//         const dist = haversineDistance(
//           latitude, longitude,
//           Number(gf.latitude), Number(gf.longitude),
//         );
//         return dist <= gf.radius;
//       });

//       if (!matched) {
//         throw new Error("Forbidden: Lokasi Anda di luar area geofence yang diizinkan.");
//       }

//       geofenceId = matched.id;
//       radiusSnapshot = matched.radius;
//     }

//     // ── 4. Verifikasi wajah via Flask ──
//     const faceResult = await this.verifyFace(userId, image);

//     // ── 5. Hitung status: PRESENT / LATE ──
//     const { hours: sh, minutes: sm } = parseTime(shift.startTime);
//     const shiftStartToday = new Date(now);
//     shiftStartToday.setHours(sh, sm, 0, 0);

//     const status = now <= shiftStartToday ? "PRESENT" : "LATE";

//     // ── 6. Build snapshot timestamps ──
//     const { hours: eh, minutes: em } = parseTime(shift.endTime);
//     const shiftEndToday = new Date(now);
//     shiftEndToday.setHours(eh, em, 0, 0);

//     // expectedCheckIn/Out dalam DateTime penuh (tanggal + jam shift)
//     const expectedCheckIn = shiftStartToday;
//     const expectedCheckOut = shiftEndToday;

//     // shiftStartTimeSnapshot & shiftEndTimeSnapshot = Time only (Prisma @db.Time)
//     // Postgres Time = Date diabaikan, jadi kita set ke epoch date
//     const timeOnly = (h: number, m: number) => new Date(1970, 0, 1, h, m, 0, 0);

//     // ── 7. Insert attendance record ──
//     const attendance = await prisma.attendances.create({
//       data: {
//         employeeId: employee.id,
//         usersId: userId,

//         shiftNameSnapshot: shift.name,
//         expectedCheckInSnapshot: expectedCheckIn,
//         expectedCheckOutSnapshot: expectedCheckOut,
//         shiftStartTimeSnapshot: timeOnly(sh, sm),
//         shiftEndTimeSnapshot: timeOnly(eh, em),

//         checkIn: now,
//         checkInPhoto: faceResult.photoBase64 ?? null,
//         status,

//         deviceInfo: deviceInfo ?? null,

//         latitudeCheckInSnapshot: latitude ?? null,
//         longitudeCheckInSnapshot: longitude ?? null,
//         radiusSnapshot,
//         geofencesId: geofenceId,
//       },
//       include: {
//         employee: { select: { fullName: true } },
//       },
//     });

//     return {
//       attendance: {
//         id: attendance.id,
//         status: attendance.status,
//         checkIn: attendance.checkIn,
//         shiftName: attendance.shiftNameSnapshot,
//         expectedCheckIn: attendance.expectedCheckInSnapshot,
//         employeeName: attendance.employee.fullName,
//       },
//       faceConfidence: faceResult.confidence,
//     };
//   },

//   // ── Verifikasi wajah via Flask Microservice ──
//   async verifyFace(userId: string, liveImageFile: File) {
//     const userFace = await prisma.userFaces.findUnique({ where: { userId } });

//     if (!userFace) {
//       throw new Error("Forbidden: Anda belum melakukan registrasi wajah (Face Enrollment).");
//     }

//     const registeredBase64 = Buffer.from(userFace.faceData).toString("base64");

//     const formData = new FormData();
//     formData.append("image", liveImageFile);
//     formData.append("registered_face", registeredBase64);

//     const flaskResponse = await fetch(FLASK_MATCH_URL, {
//       method: "POST",
//       body: formData,
//     });

//     const flaskData = await flaskResponse.json();

//     if (!flaskResponse.ok) {
//       throw new Error(`Flask AI Error: ${flaskData.error || "Gagal menganalisis wajah"}`);
//     }

//     const { is_match, confidence_percentage } = flaskData.data;

//     if (!is_match) {
//       throw new Error(`Unauthorized: Wajah tidak cocok! (Kemiripan hanya ${confidence_percentage}%)`);
//     }

//     return {
//       confidence: confidence_percentage,
//       photoBase64: null as string | null, // bisa di-extend kalau mau simpan foto
//     };
//   },
// };
