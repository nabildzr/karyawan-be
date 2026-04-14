// * File ini menangani alur check-in dan check-out absensi.
// & Implements core attendance clock-in and clock-out business logic.
// % Mengimplementasikan logika inti check-in dan check-out absensi.

import prisma from "../../../config/prisma";
import {
  findScheduleDayForToday,
  getDayRangeByTimezone,
  getShiftWindow,
  hasActiveShiftOnDay,
  parseTime,
} from "../../../shared/attendances/schedules";
import { formatSubmissionTypeLabel } from "../../../shared/attendances/submissions";
import { formatClockByTimezone } from "../../../shared/attendances/timezone";
import { AuditActor } from "../../../shared/audit/actor";
import { writeAuditLog } from "../../../shared/audit/writeAudit";
import { GeofenceService } from "../../geofences/service";
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
    timezone = "Asia/Jakarta",
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

  const { shiftEnd } = getShiftWindow(now, {
    startTime: shift.startTime,
    endTime: shift.endTime,
    isCrossDay: shift.isCrossDay,
  });

  if (now >= shiftEnd) {
    throw new Error("Forbidden: Jam kerja telah selesai, Anda alpha.");
  }

  // & Block attendance if there is active submission in the target date range.
  // % Blok absensi jika ada pengajuan aktif pada rentang tanggal terkait.
  const activeSubmission = await findBlockingSubmission(userId, dayStart, dayEnd);

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

  const { hours: sh, minutes: sm } = parseTime(shift.startTime);
  const shiftStartToday = new Date(now);
  shiftStartToday.setHours(sh, sm, 0, 0);

  const status = now <= shiftStartToday ? "PRESENT" : "LATE";

  const { hours: eh, minutes: em } = parseTime(shift.endTime);
  const shiftEndDay = new Date(now);
  if (shift.isCrossDay) {
    shiftEndDay.setDate(shiftEndDay.getDate() + 1);
  }
  shiftEndDay.setHours(eh, em, 0, 0);

  const expectedCheckIn = shiftStartToday;
  const expectedCheckOut = shiftEndDay;

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

  const activeSubmission = await findBlockingSubmission(userId, dayStart, dayEnd);

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
  if (attendance.expectedCheckInSnapshot && attendance.expectedCheckOutSnapshot) {
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
