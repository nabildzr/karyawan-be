// * File ini menangani penyusunan konteks absensi hari ini.
// Menyusun payload konteks absensi hari ini untuk alur sisi karyawan.

import prisma from "../../../config/prisma";
import { DEFAULT_TIMEZONE } from "../../../config/timezone";
import {
  findScheduleDayForToday,
  getDayNameID,
  getDayRangeByTimezone,
  getShiftWindow,
  hasActiveShiftOnDay,
} from "../../../shared/attendances/schedules";
import { formatSubmissionTypeLabel } from "../../../shared/attendances/submissions";
import { formatClockByTimezone } from "../../../shared/attendances/timezone";
import { dateKeyToUtcDate } from "../../../utils/holidayshelper";
import { findBlockingSubmission } from "./blocking-submission.service";

// Susun konteks absensi hari ini termasuk status shift dan alasan penguncian aksi.
export const getTodayContext = async (
  userId: string,
  timezone = DEFAULT_TIMEZONE,
) => {
  // & Resolve date boundaries for requested timezone.
  // % Tentukan batas hari berdasarkan timezone yang dipakai.
  const now = new Date();
  const { dayKey, dayStart, dayEnd } = getDayRangeByTimezone(now, timezone);

  // & Load employee and linked schedule graph.
  // % Ambil data karyawan dan relasi jadwal kerjanya.
  const employee = await prisma.employees.findFirst({
    where: { userId },
    include: {
      workingSchedules: {
        include: { days: { include: { shift: true } } },
      },
    },
  });

  if (!employee) {
    throw new Error("Not Found: Data karyawan tidak ditemukan.");
  }

  const todayName = getDayNameID(now, timezone);
  const scheduleDay = findScheduleDayForToday(
    employee.workingSchedules?.days ?? [],
    now,
    timezone,
  );
  const shift = hasActiveShiftOnDay(scheduleDay) ? scheduleDay.shift : null;

  // & Fetch attendance, blocking submission, and holiday in parallel.
  // % Ambil absensi, pengajuan pemblokir, dan hari libur secara paralel.
  const [todayAttendance, activeSubmission, holiday] = await Promise.all([
    prisma.attendances.findFirst({
      where: {
        employeeId: employee.id,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { createdAt: "desc" },
    }),
    findBlockingSubmission(userId, dayStart, dayEnd, {
      statuses: ["PENDING", "APPROVED"],
    }),
    prisma.publicHolidays.findUnique({
      where: {
        date: dateKeyToUtcDate(dayKey),
      },
    }),
  ]);

  let shiftStart: Date | null = null;
  let shiftEnd: Date | null = null;
  if (shift) {
  // & Compute shift progress and check-out unlock threshold.
  // % Hitung progres shift dan ambang pembukaan check-out.
    const shiftWindow = getShiftWindow(now, {
      startTime: shift.startTime,
      endTime: shift.endTime,
      isCrossDay: shift.isCrossDay,
    });
    shiftStart = shiftWindow.shiftStart;
    shiftEnd = shiftWindow.shiftEnd;
  }

  const hasCheckIn = !!todayAttendance?.checkIn;
  const hasCheckOut = !!todayAttendance?.checkOut;
  const isAlphaRecord = todayAttendance?.status === "ABSENT";
  const isShiftEnded = !!(shiftEnd && now >= shiftEnd);
  const shiftDurationMs =
    shiftStart && shiftEnd
      ? Math.max(shiftEnd.getTime() - shiftStart.getTime(), 0)
      : 0;
  const checkOutUnlockAt =
    shiftStart && shiftDurationMs > 0
      ? new Date(shiftStart.getTime() + shiftDurationMs * 0.95)
      : null;
  const isCheckOutWindowOpen = !!(
    checkOutUnlockAt && now >= checkOutUnlockAt
  );

  let shiftProgressPercent = 0;
  if (shiftStart && shiftEnd && now > shiftStart) {
    const duration = shiftEnd.getTime() - shiftStart.getTime();
    if (duration > 0) {
      const elapsed = Math.min(
        now.getTime() - shiftStart.getTime(),
        duration,
      );
      shiftProgressPercent = Math.max(
        0,
        Math.min(100, Math.round((elapsed / duration) * 100)),
      );
    }
  }

  if (hasCheckOut || isShiftEnded || isAlphaRecord) {
    shiftProgressPercent = 100;
  }

  let shiftState:
    | "HOLIDAY"
    | "SUBMISSION"
    | "OFF"
    | "NOT_STARTED"
    | "ONGOING"
    | "COMPLETED" = "OFF";

  if (holiday) {
    shiftState = "HOLIDAY";
  } else if (activeSubmission) {
    shiftState = "SUBMISSION";
  } else if (!shift) {
    shiftState = "OFF";
  } else if (hasCheckOut || isShiftEnded || isAlphaRecord) {
    shiftState = "COMPLETED";
  } else if (shiftStart && now < shiftStart) {
    shiftState = "NOT_STARTED";
  } else {
    shiftState = "ONGOING";
  }

  let canCheckIn = false;
  let canCheckOut = false;
  let checkInLockReason: string | null = null;
  let checkOutLockReason: string | null = null;

  if (holiday) {
    checkInLockReason = `Hari ini libur nasional (${holiday.name}).`;
    checkOutLockReason = checkInLockReason;
  } else if (activeSubmission) {
    checkInLockReason = `Terdapat pengajuan ${formatSubmissionTypeLabel(activeSubmission.type)} dengan status ${activeSubmission.status} pada tanggal ini.`;
    checkOutLockReason = checkInLockReason;
  } else if (!shift) {
    checkInLockReason = "Hari ini bukan jadwal kerja aktif Anda.";
    checkOutLockReason = checkInLockReason;
  } else if (hasCheckOut) {
    checkInLockReason = "Anda sudah melakukan check-in dan check-out hari ini.";
    checkOutLockReason = checkInLockReason;
  } else if (isAlphaRecord || (isShiftEnded && !hasCheckIn)) {
    checkInLockReason = "Jam kerja telah selesai, Anda alpha.";
    checkOutLockReason = checkInLockReason;
  } else {
    canCheckIn = !hasCheckIn;

    if (hasCheckIn) {
      checkInLockReason = "Anda sudah melakukan check-in hari ini.";

      if (isCheckOutWindowOpen || isShiftEnded) {
        canCheckOut = true;
      } else if (checkOutUnlockAt) {
        const unlockTimeLabel = formatClockByTimezone(checkOutUnlockAt, timezone);
        checkOutLockReason = `Check-out dapat dilakukan mulai ${unlockTimeLabel} WIB (5% akhir jam kerja).`;
      } else {
        checkOutLockReason =
          "Check-out belum tersedia karena data jadwal belum lengkap.";
      }
    } else {
      checkOutLockReason = "Anda belum check-in, sehingga belum bisa check-out.";
    }
  }

  let action: "CHECK_IN" | "CHECK_OUT" | "LOCKED" = "CHECK_IN";
  let actionLabel = "Absen Masuk";
  let lockReason: string | null = null;

  if (canCheckOut) {
    action = "CHECK_OUT";
    actionLabel = "Absen Keluar";
  } else if (!canCheckIn) {
    action = "LOCKED";
    actionLabel = "Absensi Terkunci";
    lockReason = hasCheckIn ? checkOutLockReason : checkInLockReason;
  }

  // & Return normalized context payload for employee attendance UI.
  // % Kembalikan payload konteks yang ternormalisasi untuk UI absensi karyawan.
  return {
    dateKey: dayKey,
    timezone,
    isHoliday: !!holiday,
    holidayName: holiday?.name ?? null,
    hasShift: !!shift,
    shift: shift
      ? {
          dayOfWeek: scheduleDay?.dayOfWeek ?? todayName,
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
          isCrossDay: shift.isCrossDay,
          shiftStart,
          shiftEnd,
        }
      : null,
    attendance: todayAttendance
      ? {
          id: todayAttendance.id,
          status: todayAttendance.status,
          statusCheckOut: todayAttendance.statusCheckOut,
          checkIn: todayAttendance.checkIn,
          checkOut: todayAttendance.checkOut,
          expectedCheckInSnapshot: todayAttendance.expectedCheckInSnapshot,
          expectedCheckOutSnapshot: todayAttendance.expectedCheckOutSnapshot,
        }
      : null,
    activeSubmission: activeSubmission
      ? {
          id: activeSubmission.id,
          type: activeSubmission.type,
          status: activeSubmission.status,
          startDate: activeSubmission.startDate,
          endDate: activeSubmission.endDate,
          reason: activeSubmission.reason,
        }
      : null,
    action,
    actionLabel,
    lockReason,
    canCheckIn,
    canCheckOut,
    checkInLockReason,
    checkOutLockReason,
    checkOutUnlockAt,
    checkOutUnlockThresholdPercent: 5,
    shiftState,
    shiftProgressPercent,
    now,
  };
};
