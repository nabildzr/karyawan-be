// * File ini menangani operasi riwayat dan metrik absensi.
// & Provides attendance history queries and streak/day calculations.
// % Menyediakan query riwayat absensi dan kalkulasi metrik kehadiran.

import prisma from "../../../config/prisma";
import {
    getHolidaysInRange,
    isWeekendDate,
    toDateKey,
} from "../../../utils/holidayshelper";

// & Calculate effective working days excluding weekends and public holidays.
// % Hitung hari kerja efektif dengan mengecualikan akhir pekan dan hari libur nasional.
export const calculateWorkingDays = (
  startDate: Date,
  endDate: Date,
  holidayMap: Map<string, string>,
): number => {
  let count = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const dateKey = toDateKey(current);
    const iW = isWeekendDate(current);
    const iPH = holidayMap.has(dateKey);

    if (!iW && !iPH) {
      count++;
    }

    current.setDate(current.getDate() + 1);
  }

  return count;
};

// & Calculate current attendance streak from ordered attendance statuses.
// % Hitung streak kehadiran saat ini dari urutan status absensi.
export const calculateStreak = (
  attendances: { createdAt: Date; status: string }[],
): number => {
  if (attendances.length === 0) return 0;

  let streak = 0;
  const validStatuses = ["PRESENT", "LATE"];

  for (const att of attendances) {
    if (validStatuses.includes(att.status)) {
      streak++;
    } else if (att.status === "OFF" || att.status === "LEAVE") {
      continue;
    } else {
      break;
    }
  }

  return streak;
};

// & Get paginated attendance history and summary metrics for one employee.
// % Ambil riwayat absensi terpaginasikan beserta metrik ringkasan untuk satu karyawan.
export const getHistory = async (
  userId: string,
  options: {
    page?: number;
    limit?: number;
    period?: "week" | "month" | "year";
    filter?: "late" | "present" | "absent" | "all";
  },
) => {
  const { page = 1, limit = 10, period = "month", filter } = options;

  // & Resolve employee profile from authenticated user.
  // % Cari profil karyawan berdasarkan user yang sedang login.
  const employee = await prisma.employees.findFirst({
    where: { userId },
  });

  if (!employee) throw new Error("Not Found: Data karyawan tidak ditemukan.");

  const now = new Date();
  let startDate: Date;

  switch (period) {
    case "week":
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case "month":
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  const totalRecords = await prisma.attendances.count({
    where: {
      employeeId: employee.id,
      createdAt: { gte: startDate },
      status:
        filter === "late"
          ? "LATE"
          : filter === "present"
            ? "PRESENT"
            : filter === "absent"
              ? "ABSENT"
              : undefined,
    },
  });

  const totalPages = Math.ceil(totalRecords / limit);
  const skip = (page - 1) * limit;

  // & Read paginated attendance rows based on selected filters.
  // % Ambil baris absensi terpaginasi sesuai filter yang dipilih.
  const attendances = await prisma.attendances.findMany({
    where: {
      employeeId: employee.id,
      createdAt: { gte: startDate },
      status:
        filter === "late"
          ? "LATE"
          : filter === "present"
            ? "PRESENT"
            : filter === "absent"
              ? "ABSENT"
              : filter === "all"
                ? undefined
                : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
  });

  // & Normalize decimal snapshots to plain numbers for API output.
  // % Normalisasi snapshot decimal menjadi number biasa untuk output API.
  const records = attendances.map((att) => ({
    id: att.id,
    employeeId: att.employeeId,
    shiftNameSnapshot: att.shiftNameSnapshot,
    expectedCheckInSnapshot: att.expectedCheckInSnapshot,
    expectedCheckOutSnapshot: att.expectedCheckOutSnapshot,
    checkIn: att.checkIn,
    checkOut: att.checkOut,
    deviceInfo: att.deviceInfo,
    checkInPhoto: att.checkInPhoto,
    checkOutPhoto: att.checkOutPhoto,
    xpEarned: (att as any).xpEarned ?? 0,
    status: att.status,
    latitudeCheckInSnapshot: att.latitudeCheckInSnapshot
      ? Number(att.latitudeCheckInSnapshot)
      : null,
    longitudeCheckInSnapshot: att.longitudeCheckInSnapshot
      ? Number(att.longitudeCheckInSnapshot)
      : null,
    latitudeCheckOutSnapshot: att.latitudeCheckOutSnapshot
      ? Number(att.latitudeCheckOutSnapshot)
      : null,
    longitudeCheckOutSnapshot: att.longitudeCheckOutSnapshot
      ? Number(att.longitudeCheckOutSnapshot)
      : null,
    radiusCheckInSnapshot: att.radiusCheckInSnapshot,
    radiusCheckOutSnapshot: att.radiusCheckOutSnapshot,
    createdAt: att.createdAt,
    updatedAt: att.updatedAt,
    geofencesId: att.geofencesId,
  }));

  // & Build summary metrics using the full filtered dataset.
  // % Bangun metrik ringkasan memakai seluruh data yang sudah difilter.
  const holidayMap = await getHolidaysInRange(startDate, now);

  const allAttendances = await prisma.attendances.findMany({
    where: {
      employeeId: employee.id,
      createdAt: { gte: startDate },
      status:
        filter === "late"
          ? "LATE"
          : filter === "present"
            ? "PRESENT"
            : filter === "absent"
              ? "ABSENT"
              : undefined,
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, status: true },
  });

  const totalDays = calculateWorkingDays(startDate, now, holidayMap);
  const streakDays = calculateStreak(allAttendances);

  return {
    records,
    summary: {
      total_days: totalDays,
      streak_days: streakDays,
    },
    current_page: page,
    total_pages: totalPages,
    has_more: page < totalPages,
  };
};

// & Get one attendance detail that belongs to the authenticated employee.
// % Ambil detail satu absensi yang memang milik karyawan terautentikasi.
export const getHistoryById = async (userId: string, attendanceId: string) => {
  const employee = await prisma.employees.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (!employee) throw new Error("Not Found: Data karyawan tidak ditemukan.");

  const attendance = await prisma.attendances.findFirst({
    where: {
      id: attendanceId,
      employeeId: employee.id,
    },
    include: {
      geofences: {
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
          radius: true,
        },
      },
      geofencesCheckOut: {
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
          radius: true,
        },
      },
    },
  });

  if (!attendance)
    throw new Error("Not Found: Detail absensi tidak ditemukan.");

  return {
    ...attendance,
    latitudeCheckInSnapshot: attendance.latitudeCheckInSnapshot
      ? Number(attendance.latitudeCheckInSnapshot)
      : null,
    longitudeCheckInSnapshot: attendance.longitudeCheckInSnapshot
      ? Number(attendance.longitudeCheckInSnapshot)
      : null,
    latitudeCheckOutSnapshot: attendance.latitudeCheckOutSnapshot
      ? Number(attendance.latitudeCheckOutSnapshot)
      : null,
    longitudeCheckOutSnapshot: attendance.longitudeCheckOutSnapshot
      ? Number(attendance.longitudeCheckOutSnapshot)
      : null,
    geofences: attendance.geofences
      ? {
          ...attendance.geofences,
          latitude: String(attendance.geofences.latitude),
          longitude: String(attendance.geofences.longitude),
        }
      : null,
    geofencesCheckOut: attendance.geofencesCheckOut
      ? {
          ...attendance.geofencesCheckOut,
          latitude: String(attendance.geofencesCheckOut.latitude),
          longitude: String(attendance.geofencesCheckOut.longitude),
        }
      : null,
  };
};
