// * File ini menangani alur check-in dan check-out absensi.
// & Implements core attendance clock-in and clock-out business logic.
// % Mengimplementasikan logika inti check-in dan check-out absensi.

import prisma from "../../../config/prisma";
import { DEFAULT_TIMEZONE } from "../../../config/timezone";
import {
  calculateCheckInPunctuality,
  findScheduleDayForToday,
  getDayRangeByTimezone,
  getShiftWindow,
  hasActiveShiftOnDay,
} from "../../../shared/attendances/schedules";
import { formatSubmissionTypeLabel } from "../../../shared/attendances/submissions";
import { formatClockByTimezone } from "../../../shared/attendances/timezone";
import { AuditActor } from "../../../shared/audit/actor";
import { writeAuditLog } from "../../../shared/audit/writeAudit";
import { GeofenceService } from "../../geofences/legacy";
import { NotificationService } from "../../notifications/service";
import { PointsService } from "../../points/service";
import { CheckInPayload, CheckOutPayload } from "../model";
import { findBlockingSubmission } from "./blocking-submission.service";
import { verifyFace } from "./face.service";

// & Handle employee check-in with schedule, submission, geofence, and face validations.
// % Menangani check-in karyawan dengan validasi jadwal, pengajuan, geofence, dan wajah.
export const checkIn = async (
  userId: string,
  payload: CheckInPayload,
  actor: AuditActor,
) => {
  const {
    image,
    latitude,
    longitude,
    deviceInfo,
    timezone = DEFAULT_TIMEZONE,
  } = payload;

  // & Resolve employee and active working schedule context.
  // % Ambil konteks karyawan dan jadwal kerja aktifnya.
  const employee = await prisma.employees.findFirst({
    where: { userId },
    include: {
      workingSchedules: {
        include: { days: { include: { shift: true } } },
      },
    },
  });

  if (!employee) throw new Error("Not Found: Data karyawan tidak ditemukan.");

  const now = new Date();
  const { dayStart, dayEnd } = getDayRangeByTimezone(now, timezone);

  const scheduleDay = findScheduleDayForToday(
    employee.workingSchedules?.days ?? [],
    now,
    timezone,
  );

  if (!hasActiveShiftOnDay(scheduleDay)) {
    throw new Error(
      "Bad Request: Hari ini bukan hari kerja Anda atau shift belum diatur.",
    );
  }

  const shift = scheduleDay.shift;

  const { shiftStart, shiftEnd } = getShiftWindow(now, {
    startTime: shift.startTime,
    endTime: shift.endTime,
    isCrossDay: shift.isCrossDay,
  });

  const checkInUnlockAt = new Date(shiftStart.getTime() - 60 * 60 * 1000);

  if (now < checkInUnlockAt) {
    const unlockTimeLabel = formatClockByTimezone(checkInUnlockAt, timezone);
    const shiftStartLabel = formatClockByTimezone(shiftStart, timezone);
    throw new Error(
      `Forbidden: Check-in baru dapat dilakukan mulai ${unlockTimeLabel} (1 jam sebelum shift dimulai pukul ${shiftStartLabel}).`,
    );
  }

  if (now >= shiftEnd) {
    throw new Error("Forbidden: Jam kerja telah selesai, Anda alpha.");
  }

  // & Block attendance if there is active submission in the target date range.
  // % Blok absensi jika ada pengajuan aktif pada rentang tanggal terkait.
  const activeSubmission = await findBlockingSubmission(
    userId,
    dayStart,
    dayEnd,
  );

  if (activeSubmission) {
    throw new Error(
      `Forbidden: Anda memiliki pengajuan ${formatSubmissionTypeLabel(activeSubmission.type)} dengan status ${activeSubmission.status} pada tanggal ini sehingga absensi tidak dapat dilakukan.`,
    );
  }

  const existingAlpha = await prisma.attendances.findFirst({
    where: {
      employeeId: employee.id,
      status: "ABSENT",
      createdAt: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingAlpha) {
    throw new Error(
      "Forbidden: Status kehadiran hari ini sudah tercatat alpha, absensi tidak dapat dilakukan.",
    );
  }

  const existing = await prisma.attendances.findFirst({
    where: {
      employeeId: employee.id,
      checkIn: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { checkIn: "desc" },
  });

  if (existing) {
    throw new Error("Conflict: Anda sudah melakukan check-in hari ini.");
  }

  // & Validate geofence only when coordinates are provided.
  // % Validasi geofence hanya ketika koordinat dikirim.
  let geofenceId: string | null = null;
  let radiusCheckInSnapshot: number | null = null;

  if (latitude != null && longitude != null) {
    const nearest = await GeofenceService.findNearest(latitude, longitude);

    if (!nearest) {
      throw new Error(
        "Forbidden: Lokasi Anda di luar area geofence yang diizinkan.",
      );
    }

    geofenceId = nearest.id;
    radiusCheckInSnapshot = nearest.radius;
  }

  // & Verify face after business rules pass to avoid unnecessary AI calls.
  // % Verifikasi wajah setelah validasi bisnis lolos agar panggilan AI tidak sia-sia.
  const faceResult = await verifyFace(userId, image);

  const status = now <= shiftStart ? "PRESENT" : "LATE";

  const expectedCheckIn = shiftStart;
  const expectedCheckOut = shiftEnd;

  // & Persist attendance atomically with row lock to prevent duplicate check-in race.
  // % Simpan absensi secara atomik dengan row lock untuk mencegah race check-in ganda.
  const attendance = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT 1
      FROM "Employees"
      WHERE id = ${employee.id}
      FOR UPDATE
    `;

    const lockedExisting = await tx.attendances.findFirst({
      where: {
        employeeId: employee.id,
        checkIn: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { checkIn: "desc" },
    });

    if (lockedExisting) {
      throw new Error("Conflict: Anda sudah melakukan check-in hari ini.");
    }

    return tx.attendances.create({
      data: {
        employeeId: employee.id,

        shiftNameSnapshot: shift.name,
        expectedCheckInSnapshot: expectedCheckIn,

        checkIn: now,
        checkInPhoto: faceResult.photoBase64 ?? null,
        status,

        deviceInfo: deviceInfo ?? null,

        latitudeCheckInSnapshot: latitude ?? null,
        longitudeCheckInSnapshot: longitude ?? null,
        radiusCheckInSnapshot,
        geofencesId: geofenceId,
      },
      include: {
        employee: { select: { fullName: true } },
      },
    });
  });

  // & Write audit trail after successful check-in creation.
  // % Tulis jejak audit setelah check-in berhasil dibuat.
  await writeAuditLog({
    actor,
    action: "CHECK_IN_ATTENDANCE",
    entity: "Attendances",
    entityId: attendance.id,
    changes: {
      before: null,
      after: {
        employeeId: attendance.employeeId,
        status: attendance.status,
        checkIn: attendance.checkIn,
        expectedCheckIn: attendance.expectedCheckInSnapshot,
        shiftName: attendance.shiftNameSnapshot,
        geofencesId: attendance.geofencesId,
      },
    },
  });

  // & Evaluate points in-request to avoid lost jobs under short-lived workers.
  // % Evaluasi poin langsung dalam request untuk mencegah job hilang di worker yang singkat hidupnya.
  try {
    const userRole = actor.role || "USER";

    // % Hitung metrik ketepatan waktu check-in untuk konteks aturan poin.
    const punctuality = calculateCheckInPunctuality(
      attendance.checkIn,
      attendance.expectedCheckInSnapshot,
    );

    // & Terapkan aturan poin dengan konteks ketepatan waktu check-in.
    await PointsService.applyAttendanceRules({
      userId,
      role: userRole,
      attendanceId: attendance.id,
      source: "CHECK_IN",
      actor,
      context: {
        checkInTime: attendance.checkIn,
        attendanceStatus: attendance.status,
        lateMinutes: punctuality.lateMinutes,
        minutesEarly: punctuality.minutesEarly,
        isLate: punctuality.isLate,
        isAbsent: attendance.status === "ABSENT",
      },
    });
  } catch (error) {
    console.warn("[POINTS] Failed to record points for check-in:", error);
  }

  try {
    if (attendance.checkIn) {
      await NotificationService.createAndPush({
        userId,
        title: "Check-in Berhasil",
        body: `Kamu telah absen masuk pada pukul ${formatClockByTimezone(attendance.checkIn, timezone)} WIB. Semangat bekerja!`,
        category: "ATTENDANCE",
        referenceEntity: "Attendances",
        referenceId: attendance.id,
      });
    }
  } catch (error) {
    console.warn("[NOTIF] Failed to push notification for check-in:", error);
  }

  return {
    attendance: {
      id: attendance.id,
      status: attendance.status,
      checkIn: attendance.checkIn,
      shiftName: attendance.shiftNameSnapshot,
      expectedCheckIn: attendance.expectedCheckInSnapshot,
      employeeName: attendance.employee.fullName,
    },
    faceConfidence: faceResult.confidence,
  };
};

// & Handle employee check-out with unlock window, geofence, and face validations.
// % Menangani check-out karyawan dengan validasi waktu unlock, geofence, dan wajah.
export const checkOut = async (
  userId: string,
  payload: CheckOutPayload,
  actor: AuditActor,
) => {
  const {
    image,
    latitude,
    longitude,
    deviceInfo,
    timezone = "Asia/Jakarta",
  } = payload;

  // & Resolve employee profile from authenticated user.
  // % Ambil profil karyawan dari user terautentikasi.
  const employee = await prisma.employees.findFirst({
    where: { userId },
  });

  if (!employee) throw new Error("Not Found: Data karyawan tidak ditemukan.");

  const now = new Date();
  const { dayStart, dayEnd } = getDayRangeByTimezone(now, timezone);

  const activeSubmission = await findBlockingSubmission(
    userId,
    dayStart,
    dayEnd,
  );

  if (activeSubmission) {
    throw new Error(
      `Forbidden: Anda memiliki pengajuan ${formatSubmissionTypeLabel(activeSubmission.type)} dengan status ${activeSubmission.status} pada tanggal ini sehingga absensi tidak dapat dilakukan.`,
    );
  }

  const thirtyHoursAgo = new Date(now.getTime() - 30 * 60 * 60 * 1000);

  const attendance = await prisma.attendances.findFirst({
    where: {
      employeeId: employee.id,
      checkIn: { not: null },
      checkOut: null,
      createdAt: { gte: thirtyHoursAgo },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!attendance) {
    throw new Error(
      "Not Found: Tidak ditemukan data check-in hari ini, atau Anda sudah check-out.",
    );
  }

  // & Enforce check-out only in the last 5% of shift duration.
  // % Pastikan check-out hanya boleh di 5% akhir durasi shift.
  if (
    attendance.expectedCheckInSnapshot &&
    attendance.expectedCheckOutSnapshot
  ) {
    const shiftDurationMs =
      attendance.expectedCheckOutSnapshot.getTime() -
      attendance.expectedCheckInSnapshot.getTime();

    if (shiftDurationMs > 0) {
      const checkOutUnlockAt = new Date(
        attendance.expectedCheckInSnapshot.getTime() + shiftDurationMs * 0.95,
      );

      if (now < checkOutUnlockAt) {
        const unlockTimeLabel = formatClockByTimezone(
          checkOutUnlockAt,
          timezone,
        );
        throw new Error(
          `Forbidden: Check-out baru dapat dilakukan mulai ${unlockTimeLabel} WIB (5% akhir jam kerja).`,
        );
      }
    }
  }

  // & Validate check-out geofence when coordinates are provided.
  // % Validasi geofence check-out ketika koordinat tersedia.
  let geofenceCheckOutId: string | null = null;
  let radiusCheckOutSnapshot: number | null = null;

  if (latitude != null && longitude != null) {
    const nearest = await GeofenceService.findNearest(latitude, longitude);

    if (!nearest) {
      throw new Error(
        "Forbidden: Lokasi Anda di luar area geofence yang diizinkan.",
      );
    }

    geofenceCheckOutId = nearest.id;
    radiusCheckOutSnapshot = nearest.radius;
  }

  // & Verify face identity before updating attendance record.
  // % Verifikasi identitas wajah sebelum update data absensi.
  const faceResult = await verifyFace(userId, image);

  const expectedCheckOut = attendance.expectedCheckOutSnapshot;
  let statusCheckOut: "PRESENT" | "LATE" = "PRESENT";

  if (expectedCheckOut && now < expectedCheckOut) {
    statusCheckOut = "LATE";
  }

  // & Update attendance record with check-out snapshots.
  // % Perbarui data absensi dengan snapshot check-out.
  const updated = await prisma.attendances.update({
    where: { id: attendance.id },
    data: {
      checkOut: now,
      checkOutPhoto: faceResult.photoBase64 ?? null,
      statusCheckOut,

      latitudeCheckOutSnapshot: latitude ?? null,
      longitudeCheckOutSnapshot: longitude ?? null,
      radiusCheckOutSnapshot,
      geofencesCheckOutId: geofenceCheckOutId,

      deviceInfo: deviceInfo
        ? `${attendance.deviceInfo ?? ""} | CO: ${deviceInfo}`
        : attendance.deviceInfo,
    },
    include: {
      employee: { select: { fullName: true } },
    },
  });

  // & Write audit trail after successful check-out update.
  // % Tulis jejak audit setelah check-out berhasil diperbarui.
  await writeAuditLog({
    actor,
    action: "CHECK_OUT_ATTENDANCE",
    entity: "Attendances",
    entityId: attendance.id,
    changes: {
      before: {
        checkOut: attendance.checkOut,
        statusCheckOut: attendance.statusCheckOut,
        geofencesCheckOutId: attendance.geofencesCheckOutId,
      },
      after: {
        checkOut: updated.checkOut,
        statusCheckOut: updated.statusCheckOut,
        geofencesCheckOutId: updated.geofencesCheckOutId,
      },
    },
  });

  // & Evaluate points in-request to avoid lost jobs under short-lived workers.
  // % Evaluasi poin langsung dalam request untuk mencegah job hilang di worker yang singkat hidupnya.
  try {
    const userRole = actor.role || "USER";
    const punctuality = calculateCheckInPunctuality(
      updated.checkIn,
      updated.expectedCheckInSnapshot,
    );

    await PointsService.applyAttendanceRules({
      userId,
      role: userRole,
      attendanceId: updated.id,
      source: "CHECK_OUT",
      actor,
      context: {
        checkInTime: updated.checkIn,
        checkOutTime: updated.checkOut,
        attendanceStatus: updated.status,
        statusCheckOut: updated.statusCheckOut,
        lateMinutes: punctuality.lateMinutes,
        minutesEarly: punctuality.minutesEarly,
        isLate: punctuality.isLate,
        isAbsent: updated.status === "ABSENT",
      },
    });
  } catch (error) {
    console.warn("[POINTS] Failed to record points for check-out:", error);
  }

  try {
    if (updated.checkOut) {
      await NotificationService.createAndPush({
        userId,
        title: "Check-out Berhasil",
        body: `Kamu telah absen pulang pada pukul ${formatClockByTimezone(updated.checkOut, timezone)} WIB. Selamat beristirahat!`,
        category: "ATTENDANCE",
        referenceEntity: "Attendances",
        referenceId: updated.id,
      });
    }
  } catch (error) {
    console.warn("[NOTIF] Failed to push notification for check-out:", error);
  }

  return {
    attendance: {
      id: updated.id,
      status: updated.status,
      statusCheckOut: updated.statusCheckOut,
      checkIn: updated.checkIn,
      checkOut: updated.checkOut,
      shiftName: updated.shiftNameSnapshot,
      expectedCheckOut: updated.expectedCheckOutSnapshot,
      employeeName: updated.employee.fullName,
    },
    faceConfidence: faceResult.confidence,
  };
};
