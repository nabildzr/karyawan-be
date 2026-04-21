// * File ini menangani operasi report/admin untuk module attendances.
// & Contains admin-focused attendance reporting and correction flows.
// % Berisi alur laporan dan koreksi absensi untuk kebutuhan admin.

import prisma from "../../../config/prisma";
import { DEFAULT_TIMEZONE } from "../../../config/timezone";
import {
  calculateCheckInPunctuality,
  toBusinessEndOfDay,
  toBusinessStartOfDay,
} from "../../../shared/attendances/schedules";
import { resolveSubmissionBlockingReason } from "../../../shared/attendances/submissions";
import { writeAuditLog } from "../../../shared/audit/writeAudit";
import { toDateKey } from "../../../utils/holidayshelper";
import { PointsService } from "../../points/service";
import { CorrectAttendancePayload, ManualAttendancePayload } from "../model";
import { findBlockingSubmission } from "./blocking-submission.service";

// & Parse date string and throw standardized validation error when invalid.
// % Parse string tanggal dan lempar error validasi standar jika tidak valid.
const parseDateOrThrow = (value: string, fieldName: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Bad Request: Format tanggal ${fieldName} tidak valid.`);
  }

  return date;
};

// & Create manual attendance entry by admin with optional submission bypass.
// % Buat entri absensi manual oleh admin dengan opsi bypass pengajuan.
/** Mengekspor manualAttendance untuk kebutuhan modul ini. */
export const manualAttendance = async (
  adminUserId: string,
  payload: ManualAttendancePayload,
) => {
  const {
    employeeId,
    status,
    statusCheckOut,
    checkIn,
    checkOut,
    shiftName,
    expectedCheckIn,
    expectedCheckOut,
    note,
    reason,
    forceBypassSubmission = false,
  } = payload;

  // & Validate actor and target employee existence.
  // % Validasi keberadaan aktor admin dan target karyawan.
  const admin = await prisma.users.findUnique({
    where: { id: adminUserId },
    include: { rbacRole: true },
  });
  if (!admin) throw new Error("Not Found: Data admin tidak ditemukan.");

  const employee = await prisma.employees.findUnique({
    where: { id: employeeId },
    include: {
      user: {
        include: {
          rbacRole: {
            select: { key: true },
          },
        },
      },
    },
  });
  if (!employee) throw new Error("Not Found: Data karyawan tidak ditemukan.");

  const expectedCheckInDate = parseDateOrThrow(
    expectedCheckIn,
    "expectedCheckIn",
  );
  const expectedCheckOutDate = expectedCheckOut
    ? parseDateOrThrow(expectedCheckOut, "expectedCheckOut")
    : expectedCheckInDate;

  const rangeStart =
    expectedCheckInDate <= expectedCheckOutDate
      ? expectedCheckInDate
      : expectedCheckOutDate;
  const rangeEnd =
    expectedCheckInDate <= expectedCheckOutDate
      ? expectedCheckOutDate
      : expectedCheckInDate;

  // & Prevent collision with active submissions unless bypass is explicitly enabled.
  // % Cegah benturan dengan pengajuan aktif kecuali bypass diaktifkan secara eksplisit.
  const blockingSubmission = await findBlockingSubmission(
    employee.userId,
    rangeStart,
    rangeEnd,
  );

  if (blockingSubmission && !forceBypassSubmission) {
    throw new Error(
      `Conflict: ${resolveSubmissionBlockingReason(blockingSubmission)} Gunakan override jika ingin tetap memproses absensi manual.`,
    );
  }

  // & Persist manual entry and write audit log in one transaction.
  // % Simpan entri manual dan tulis audit log dalam satu transaksi.
  const attendance = await prisma.$transaction(async (tx) => {
    const attendance = await tx.attendances.create({
      data: {
        employeeId,
        shiftNameSnapshot: shiftName,
        expectedCheckInSnapshot: new Date(expectedCheckIn),
        expectedCheckOutSnapshot: expectedCheckOut
          ? new Date(expectedCheckOut)
          : null,
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        status: status as any,
        statusCheckOut: (statusCheckOut as any) ?? null,
        isManualEntry: true,
        manualEntryBy: adminUserId,
        manualEntryAt: new Date(),
        manualEntryByRole: admin.rbacRole?.key || "SYSTEM",
        manualNotes: note,
        manualReason: reason,
        deviceInfo: `MANUAL_ENTRY_BY_${admin.rbacRole?.key || "SYSTEM"}`,
      },
      include: { employee: { select: { fullName: true } } },
    });

    await writeAuditLog({
      actor: {
        id: adminUserId,
        role: admin.rbacRole?.key || "SYSTEM",
      },
      action: "CREATE_ATTENDANCE_MANUAL",
      entity: "Attendances",
      entityId: attendance.id,
      reason: reason,
      changes: {
        before: null,
        after: {
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
          status: attendance.status,
          submissionBypass: forceBypassSubmission && !!blockingSubmission,
          blockingSubmissionId: blockingSubmission?.id ?? null,
          blockingSubmissionType: blockingSubmission?.type ?? null,
          blockingSubmissionStatus: blockingSubmission?.status ?? null,
        },
      },
      db: tx as any,
    });

    return attendance;
  });

  // & Evaluate points in-request to avoid lost jobs under short-lived workers.
  // % Evaluasi poin langsung dalam request untuk mencegah job hilang di worker yang singkat hidupnya.
  try {
    const userRole = employee.user?.rbacRole?.key || "USER";
    const punctuality = calculateCheckInPunctuality(
      attendance.checkIn,
      attendance.expectedCheckInSnapshot,
    );

    await PointsService.applyAttendanceRules({
      userId: employee.userId,
      role: userRole,
      attendanceId: attendance.id,
      source: "MANUAL_ATTENDANCE",
      actor: {
        id: adminUserId,
        role: admin.rbacRole?.key || "SYSTEM",
      },
      context: {
        checkInTime: attendance.checkIn,
        checkOutTime: attendance.checkOut,
        attendanceStatus: attendance.status,
        statusCheckOut: attendance.statusCheckOut,
        lateMinutes: punctuality.lateMinutes,
        minutesEarly: punctuality.minutesEarly,
        isLate: punctuality.isLate,
        isAbsent: attendance.status === "ABSENT",
      },
    });
  } catch (error) {
    console.warn(
      "[POINTS] Failed to record points for manual attendance:",
      error,
    );
  }

  return attendance;
};

// & Correct existing attendance by admin with audit and submission safeguards.
// % Koreksi data absensi oleh admin dengan audit dan pengaman pengajuan.
/** Mengekspor correctAttendance untuk kebutuhan modul ini. */
export const correctAttendance = async (
  adminUserId: string,
  attendanceId: string,
  payload: CorrectAttendancePayload,
) => {
  const {
    checkIn,
    checkOut,
    status,
    statusCheckOut,
    note,
    reason,
    forceBypassSubmission = false,
  } = payload;

  // & Validate actor and existing attendance snapshot.
  // % Validasi aktor admin dan snapshot absensi yang akan dikoreksi.
  const admin = await prisma.users.findUnique({
    where: { id: adminUserId },
    include: { rbacRole: true },
  });
  if (!admin) throw new Error("Not Found: Data admin tidak ditemukan.");

  const existing = await prisma.attendances.findUnique({
    where: { id: attendanceId },
    include: {
      employee: {
        select: {
          userId: true,
        },
      },
    },
  });
  if (!existing) throw new Error("Not Found: Data absensi tidak ditemukan.");

  const nextCheckIn =
    checkIn !== undefined
      ? checkIn
        ? parseDateOrThrow(checkIn, "checkIn")
        : null
      : existing.checkIn;
  const nextCheckOut =
    checkOut !== undefined
      ? checkOut
        ? parseDateOrThrow(checkOut, "checkOut")
        : null
      : existing.checkOut;

  const rangeStartCandidate =
    nextCheckIn ?? existing.expectedCheckInSnapshot ?? existing.createdAt;
  const rangeEndCandidate =
    nextCheckOut ??
    existing.expectedCheckOutSnapshot ??
    rangeStartCandidate;

  const rangeStart =
    rangeStartCandidate <= rangeEndCandidate
      ? rangeStartCandidate
      : rangeEndCandidate;
  const rangeEnd =
    rangeStartCandidate <= rangeEndCandidate
      ? rangeEndCandidate
      : rangeStartCandidate;

  // & Ensure correction does not violate submission blocking rules.
  // % Pastikan koreksi tidak melanggar aturan pemblokiran pengajuan.
  const blockingSubmission = await findBlockingSubmission(
    existing.employee.userId,
    rangeStart,
    rangeEnd,
  );

  if (blockingSubmission && !forceBypassSubmission) {
    throw new Error(
      `Conflict: ${resolveSubmissionBlockingReason(blockingSubmission)} Gunakan override jika ingin tetap memproses koreksi absensi.`,
    );
  }

  // & Apply correction and write audit trail atomically.
  // % Terapkan koreksi dan tulis jejak audit secara atomik.
  return await prisma.$transaction(async (tx) => {
    const updateData: any = {
      isManualEntry: true,
      manualEntryBy: adminUserId,
      manualEntryAt: new Date(),
      manualEntryByRole: admin.rbacRole?.key || "SYSTEM",
      manualNotes: note,
    };

    if (reason !== undefined) updateData.manualReason = reason;
    if (checkIn !== undefined) {
      updateData.checkIn = nextCheckIn;
    }
    if (checkOut !== undefined) {
      updateData.checkOut = nextCheckOut;
    }
    if (status !== undefined) updateData.status = status;
    if (statusCheckOut !== undefined)
      updateData.statusCheckOut = statusCheckOut;

    const updated = await tx.attendances.update({
      where: { id: attendanceId },
      data: updateData,
      include: { employee: { select: { fullName: true, email: true } } },
    });

    await writeAuditLog({
      actor: {
        id: adminUserId,
        role: admin.rbacRole?.key || "SYSTEM",
      },
      action: "CORRECT_ATTENDANCE",
      entity: "Attendances",
      entityId: attendanceId,
      reason: reason || note,
      changes: {
        before: {
          checkIn: existing.checkIn,
          checkOut: existing.checkOut,
          status: existing.status,
          statusCheckOut: existing.statusCheckOut,
        },
        after: {
          checkIn: updated.checkIn,
          checkOut: updated.checkOut,
          status: updated.status,
          statusCheckOut: updated.statusCheckOut,
          submissionBypass: forceBypassSubmission && !!blockingSubmission,
          blockingSubmissionId: blockingSubmission?.id ?? null,
          blockingSubmissionType: blockingSubmission?.type ?? null,
          blockingSubmissionStatus: blockingSubmission?.status ?? null,
        },
      },
      db: tx as any,
    });

    return updated;
  });
};

// & Get paginated attendance list for admin table/report screens.
// % Ambil daftar absensi terpaginasikan untuk tabel/laporan admin.
/** Mengekspor getAll untuk kebutuhan modul ini. */
export const getAll = async (options: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  employeeId?: string;
  divisionId?: string;
  search?: string;
  withEmployee?: boolean;
  isManualEntry?: boolean;
}) => {
  const {
    page = 1,
    limit = 20,
    startDate,
    endDate,
    status,
    employeeId,
    divisionId,
    search,
    withEmployee = false,
    isManualEntry,
  } = options;

  // & Build dynamic filter object based on incoming query options.
  // % Susun filter dinamis berdasarkan opsi query yang masuk.
  const skip = (page - 1) * limit;
  const where: any = {};

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = toBusinessStartOfDay(startDate);
    if (endDate) where.createdAt.lte = toBusinessEndOfDay(endDate);
  }

  if (status && status !== "all") where.status = status.toUpperCase();
  if (employeeId) where.employeeId = employeeId;
  if (isManualEntry !== undefined) where.isManualEntry = isManualEntry;

  const employeeFilter: any = {};
  if (search)
    employeeFilter.fullName = {
      contains: search,
      mode: "insensitive" as const,
    };
  if (divisionId) employeeFilter.position = { division: { id: divisionId } };
  if (Object.keys(employeeFilter).length) where.employee = employeeFilter;

  const include: any = {
    employee: {
      select: {
        id: true,
        fullName: true,
        email: true,
        user: { select: { nip: true, rbacRole: { select: { key: true } } } },
        position: {
          select: {
            name: true,
            division: { select: { id: true, name: true } },
          },
        },
        ...(withEmployee
          ? {
              employeeDetails: {
                select: {
                  gender: true,
                  employmentType: true,
                  profilePictureUrl: true,
                },
              },
            }
          : {}),
      },
    },
    geofences: { select: { name: true, latitude: true, longitude: true } },
    geofencesCheckOut: {
      select: { name: true, latitude: true, longitude: true },
    },
  };

  const [data, total] = await Promise.all([
    prisma.attendances.findMany({
      where,
      skip,
      take: limit,
      include,
      orderBy: { createdAt: "desc" },
    }),
    prisma.attendances.count({ where }),
  ]);

  const normalizedData = (data as any[]).map((item: any) => {
    const user = item?.employee?.user ?? null;

    return {
      ...item,
      employee: item?.employee
        ? {
            ...item.employee,
            user: user
              ? {
                  ...user,
                  role: user.rbacRole?.key ?? "USER",
                }
              : user,
          }
        : item?.employee,
    };
  });

  return {
    data: normalizedData,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

// & Get full attendance detail payload by id for admin detail page.
// % Ambil payload detail absensi lengkap berdasarkan id untuk halaman detail admin.
/** Mengekspor getById untuk kebutuhan modul ini. */
export const getById = async (id: string) => {
  const attendance = await prisma.attendances.findUnique({
    where: { id },
    include: {
      employee: {
        include: {
          user: {
            select: {
              id: true,
              nip: true,
              rbacRole: { select: { key: true } },
            },
          },
          position: {
            include: {
              division: {
                select: { id: true, name: true, description: true },
              },
            },
          },
          employeeDetails: true,
          workingSchedules: {
            include: {
              days: { include: { shift: true } },
            },
          },
        },
      },
      geofences: true,
      geofencesCheckOut: true,
      manualEntryUser: {
        select: {
          id: true,
          nip: true,
          rbacRole: { select: { key: true } },
          employees: { select: { fullName: true, email: true } },
        },
      },
    },
  });

  if (!attendance)
    throw new Error("Not Found: Data absensi tidak ditemukan.");

  return {
    ...attendance,
    employee: {
      ...attendance.employee,
      user: {
        ...attendance.employee.user,
        role: attendance.employee.user.rbacRole?.key ?? "USER",
      },
    },
    manualEntryUser: attendance.manualEntryUser
      ? {
          ...attendance.manualEntryUser,
          role: attendance.manualEntryUser.rbacRole?.key ?? "SYSTEM",
        }
      : null,
  };
};

// & Aggregate attendance counters for dashboard summary cards.
// % Agregasikan counter absensi untuk kartu ringkasan dashboard.
/** Mengekspor getSummaryStats untuk kebutuhan modul ini. */
export const getSummaryStats = async (options: {
  startDate?: string;
  endDate?: string;
  divisionId?: string;
  employeeId?: string;
}) => {
  const { startDate, endDate, divisionId, employeeId } = options;

  const baseWhere: any = {};
  if (startDate || endDate) {
    baseWhere.createdAt = {};
    if (startDate) baseWhere.createdAt.gte = toBusinessStartOfDay(startDate);
    if (endDate) baseWhere.createdAt.lte = toBusinessEndOfDay(endDate);
  }
  if (employeeId) baseWhere.employeeId = employeeId;
  if (divisionId)
    baseWhere.employee = { position: { division: { id: divisionId } } };

  const [present, late, absent, leave, total] = await Promise.all([
    prisma.attendances.count({ where: { ...baseWhere, status: "PRESENT" } }),
    prisma.attendances.count({ where: { ...baseWhere, status: "LATE" } }),
    prisma.attendances.count({ where: { ...baseWhere, status: "ABSENT" } }),
    prisma.attendances.count({ where: { ...baseWhere, status: "LEAVE" } }),
    prisma.attendances.count({ where: baseWhere }),
  ]);

  return { present, late, absent, leave, total };
};

// & Export attendance data into CSV/XLSX with selected filters.
// % Ekspor data absensi ke CSV/XLSX sesuai filter yang dipilih.
/** Mengekspor exportAttendances untuk kebutuhan modul ini. */
export const exportAttendances = async (options: {
  startDate: string;
  endDate: string;
  format?: "xlsx" | "csv";
  divisionId?: string;
  status?: string;
  employeeId?: string;
}) => {
  const {
    startDate,
    endDate,
    format = "xlsx",
    divisionId,
    status,
    employeeId,
  } = options;

  // & Prevent exporting future dates beyond today.
  // % Cegah ekspor tanggal masa depan melebihi hari ini.
  const todayKey = toDateKey(new Date(), DEFAULT_TIMEZONE);
  const todayEnd = toBusinessEndOfDay(todayKey);
  const end = toBusinessEndOfDay(endDate);
  if (end > todayEnd) {
    throw new Error(
      "Bad Request: Tanggal akhir tidak boleh melebihi hari ini.",
    );
  }

  const where: any = {
    createdAt: { gte: toBusinessStartOfDay(startDate), lte: end },
  };
  if (status && status !== "all") where.status = status.toUpperCase();
  if (employeeId) where.employeeId = employeeId;
  if (divisionId)
    where.employee = { position: { division: { id: divisionId } } };

  // & Load records and normalize them into export-friendly row objects.
  // % Ambil record lalu normalisasi ke bentuk baris yang siap diekspor.
  const records = await prisma.attendances.findMany({
    where,
    include: {
      employee: {
        include: {
          user: { select: { nip: true } },
          position: {
            include: { division: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: [{ employee: { fullName: "asc" } }, { createdAt: "asc" }],
  });

  const fmt = (
    d: Date | null | undefined,
    type: "date" | "time" | "datetime" = "datetime",
  ) => {
    if (!d) return "-";
    if (type === "date") return d.toLocaleDateString("id-ID");
    if (type === "time")
      return d.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
    return `${d.toLocaleDateString("id-ID")} ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const rows = records.map((r, i) => ({
    No: i + 1,
    "Nama Karyawan": r.employee.fullName,
    NIP: r.employee.user.nip,
    Divisi: r.employee.position?.division?.name ?? "-",
    Jabatan: r.employee.position?.name ?? "-",
    Tanggal: fmt(r.createdAt, "date"),
    Shift: r.shiftNameSnapshot,
    "Check-In Terjadwal": fmt(r.expectedCheckInSnapshot, "time"),
    "Check-In Aktual": fmt(r.checkIn, "time"),
    "Check-Out Terjadwal": fmt(r.expectedCheckOutSnapshot, "time"),
    "Check-Out Aktual": fmt(r.checkOut, "time"),
    "Status Masuk": r.status,
    "Status Keluar": r.statusCheckOut ?? "-",
    "Entry Manual": r.isManualEntry ? "Ya" : "Tidak",
    "Alasan Manual": r.manualReason ?? "-",
    Catatan: r.manualNotes ?? "-",
  }));

  const filename = `absensi_${startDate}_sd_${endDate}`;

  // & Build CSV payload when requested format is csv.
  // % Susun payload CSV ketika format yang diminta adalah csv.
  if (format === "csv") {
    if (rows.length === 0) {
      return {
        buffer: Buffer.from(""),
        contentType: "text/csv",
        filename: `${filename}.csv`,
      };
    }
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => `"${(r as any)[h]}"`).join(",")),
    ];
    return {
      buffer: Buffer.from(csvLines.join("\n"), "utf-8"),
      contentType: "text/csv",
      filename: `${filename}.csv`,
    };
  }

  // & Build XLSX payload as default export format.
  // % Susun payload XLSX sebagai format ekspor default.
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const colWidths = Object.keys(rows[0] ?? {}).map((k) => ({
    wch: Math.max(k.length, 12),
  }));
  ws["!cols"] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Absensi");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return {
    buffer: buf as Buffer,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `${filename}.xlsx`,
  };
};
