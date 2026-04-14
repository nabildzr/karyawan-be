// * File ini menyimpan implementasi legacy service module workingSchedules sebagai referensi transisi.

import prisma from "../../config/prisma";
import {
  findScheduleDayByDate,
  getDayNameID,
  hasActiveShiftOnDay,
  resolveMobileSummaryDayStatus,
} from "../../shared/attendances/schedules";
import { formatSubmissionTypeLabel } from "../../shared/attendances/submissions";
import { AuditActor } from "../../shared/audit/actor";
import { writeAuditLog } from "../../shared/audit/writeAudit";
import { toDateKey } from "../../utils/holidayshelper";
import type { AssignEmployeesPayload, CreateSchedulePayload } from "./model";

const BUSINESS_UTC_OFFSET = "+07:00";

// Helper: urutan hari untuk sorting (support EN & ID)
const DAY_ORDER: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Jumat: 5,
  Sabtu: 6,
  Minggu: 7,
};

/** Format Date → "YYYY-MM-DD" — UTC safe */
const toDateStr = (date: Date): string => date.toISOString().slice(0, 10);

/** Sort array ScheduleDays berdasarkan urutan hari */
const sortDays = <T extends { dayOfWeek: string }>(days: T[]): T[] =>
  [...days].sort(
    (a, b) => (DAY_ORDER[a.dayOfWeek] ?? 8) - (DAY_ORDER[b.dayOfWeek] ?? 8),
  );

export const WorkingScheduleService = {
  // ─────────────────────────────────────────────
  // & 1) CREATE — Web Admin
  // ─────────────────────────────────────────────
  async create(payload: CreateSchedulePayload, actor: AuditActor) {
    const { name, employeeIds, days } = payload;

    // Filter employeeIds: hapus string kosong dan undefined
    const validEmployeeIds = (employeeIds ?? []).filter(
      (id) => id && id.trim() !== "",
    );

    return prisma.$transaction(async (tx) => {
      // 1. Buat WorkingSchedule dulu untuk dapat ID-nya
      const schedule = await tx.workingSchedules.create({
        data: {
          name,
          ...(validEmployeeIds.length > 0 && {
            employees: {
              connect: validEmployeeIds.map((id) => ({ id })),
            },
          }),
        },
      });

      // 2. Resolve / create shift untuk setiap hari aktif
      const scheduleDayData: {
        dayOfWeek: string;
        isActive: boolean;
        shiftId: string | null;
        workingScheduleId: string;
      }[] = [];

      for (const day of days) {
        let shiftId: string | null = null;

        if (day.isActive && day.startTime && day.endTime) {
          const isCrossDay = day.isCrossDay ?? false;
          // Cari shift yg jam-nya sama + flag isCrossDay, reuse kalau sudah ada
          let shift = await tx.shifts.findFirst({
            where: {
              startTime: day.startTime,
              endTime: day.endTime,
              isCrossDay,
            },
          });

          if (!shift) {
            const label = isCrossDay ? " (Cross-Day)" : "";
            shift = await tx.shifts.create({
              data: {
                name: `Shift ${day.startTime}-${day.endTime}${label}`,
                startTime: day.startTime,
                endTime: day.endTime,
                isCrossDay,
              },
            });
          }

          shiftId = shift.id;
        }

        scheduleDayData.push({
          dayOfWeek: day.dayOfWeek,
          isActive: day.isActive,
          shiftId,
          workingScheduleId: schedule.id,
        });
      }

      // 3. Buat ScheduleDays
      await tx.scheduleDays.createMany({ data: scheduleDayData });

      // 4. Fetch ulang dengan include
      const result = await tx.workingSchedules.findUniqueOrThrow({
        where: { id: schedule.id },
        include: {
          days: { include: { shift: true } },
          _count: { select: { employees: true } },
        },
      });

      // Sort days sebelum return
      result.days = sortDays(result.days);

      await writeAuditLog({
        actor,
        action: "CREATE_WORKING_SCHEDULE",
        entity: "WorkingSchedules",
        entityId: schedule.id,
        changes: {
          before: null,
          after: {
            name: result.name,
            employeeIds: validEmployeeIds,
            days: result.days.map((day) => ({
              dayOfWeek: day.dayOfWeek,
              isActive: day.isActive,
              shiftId: day.shiftId,
              startTime: day.shift?.startTime ?? null,
              endTime: day.shift?.endTime ?? null,
              isCrossDay: day.shift?.isCrossDay ?? null,
            })),
          },
        },
        db: tx as any,
      });

      return result;
    });
  },

  // ─────────────────────────────────────────────
  // & 2) UPDATE — Web Admin
  // ─────────────────────────────────────────────
  async update(
    scheduleId: string,
    payload: CreateSchedulePayload,
    actor: AuditActor,
  ) {
    const { name, employeeIds, days } = payload;

    // Filter employeeIds: hapus string kosong dan undefined
    const validEmployeeIds = (employeeIds ?? []).filter(
      (id) => id && id.trim() !== "",
    );

    return prisma.$transaction(async (tx) => {
      const existingSchedule = await tx.workingSchedules.findUnique({
        where: { id: scheduleId },
        include: {
          days: { include: { shift: true } },
          employees: { select: { id: true } },
        },
      });

      if (!existingSchedule) {
        throw new Error("Not Found: Jadwal kerja tidak ditemukan.");
      }

      // Update nama jadwal
      await tx.workingSchedules.update({
        where: { id: scheduleId },
        data: { name },
      });

      // Update days: kita delete semua dulu, lalu recreate (lebih mudah daripada diffing)
      await tx.scheduleDays.deleteMany({
        where: { workingScheduleId: scheduleId },
      });
      const scheduleDayData: {
        dayOfWeek: string;
        isActive: boolean;
        shiftId: string | null;
        workingScheduleId: string;
      }[] = [];

      for (const day of days) {
        let shiftId: string | null = null;
        if (day.isActive && day.startTime && day.endTime) {
          const isCrossDay = day.isCrossDay ?? false;
          // Cari shift yg jam-nya sama + flag isCrossDay, reuse kalau sudah ada
          let shift = await tx.shifts.findFirst({
            where: {
              startTime: day.startTime,
              endTime: day.endTime,
              isCrossDay,
            },
          });
          if (!shift) {
            const label = isCrossDay ? " (Cross-Day)" : "";
            shift = await tx.shifts.create({
              data: {
                name: `Shift ${day.startTime}-${day.endTime}${label}`,
                startTime: day.startTime,
                endTime: day.endTime,
                isCrossDay,
              },
            });
          }
          shiftId = shift.id;
        }
        scheduleDayData.push({
          dayOfWeek: day.dayOfWeek,
          isActive: day.isActive,
          shiftId,
          workingScheduleId: scheduleId,
        });
      }
      await tx.scheduleDays.createMany({ data: scheduleDayData });

      // Update relasi employees (hanya jika ada validEmployeeIds, atau kosongkan jika array kosong dikirim)
      if (employeeIds !== undefined) {
        await tx.workingSchedules.update({
          where: { id: scheduleId },
          data: {
            employees: {
              set: validEmployeeIds.map((id) => ({ id })),
            },
          },
        });
      }

      // Return jadwal yang sudah diupdate
      const updatedSchedule = await tx.workingSchedules.findUnique({
        where: { id: scheduleId },
        include: {
          days: { include: { shift: true } },
          employees: { select: { id: true, fullName: true } },
          _count: { select: { employees: true } },
        },
      });
      if (!updatedSchedule) {
        throw new Error(
          "Not Found: Jadwal kerja tidak ditemukan setelah update.",
        );
      }
      updatedSchedule.days = sortDays(updatedSchedule.days);

      await writeAuditLog({
        actor,
        action: "UPDATE_WORKING_SCHEDULE",
        entity: "WorkingSchedules",
        entityId: scheduleId,
        changes: {
          before: {
            name: existingSchedule.name,
            employeeIds: existingSchedule.employees.map(
              (employee) => employee.id,
            ),
            days: sortDays(existingSchedule.days).map((day) => ({
              dayOfWeek: day.dayOfWeek,
              isActive: day.isActive,
              shiftId: day.shiftId,
              startTime: day.shift?.startTime ?? null,
              endTime: day.shift?.endTime ?? null,
              isCrossDay: day.shift?.isCrossDay ?? null,
            })),
          },
          after: {
            name: updatedSchedule.name,
            employeeIds: updatedSchedule.employees.map(
              (employee) => employee.id,
            ),
            days: updatedSchedule.days.map((day) => ({
              dayOfWeek: day.dayOfWeek,
              isActive: day.isActive,
              shiftId: day.shiftId,
              startTime: day.shift?.startTime ?? null,
              endTime: day.shift?.endTime ?? null,
              isCrossDay: day.shift?.isCrossDay ?? null,
            })),
          },
        },
        db: tx as any,
      });

      return updatedSchedule;
    });
  },

  // ─────────────────────────────────────────────
  // & 3) FIND ALL — Web Admin
  // ─────────────────────────────────────────────
  async findAll({
    withShifts = false,
    withDays = false,
  }: { withShifts?: boolean; withDays?: boolean } = {}) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [schedules, totalSchedules, activeAssignments, recentChanges] =
      await Promise.all([
        prisma.workingSchedules.findMany({
          include: {
            days: withDays
              ? { include: { shift: withShifts ? true : false } }
              : undefined,
            _count: { select: { employees: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        // Total jumlah jadwal kerja yang ada
        prisma.workingSchedules.count(),
        // Jumlah karyawan yang sudah ter-assign ke jadwal kerja mana pun
        prisma.employees.count({
          where: { workingSchedulesId: { not: null } },
        }),
        // Jumlah jadwal yang diubah dalam 7 hari terakhir
        prisma.workingSchedules.count({
          where: { createdAt: { gte: sevenDaysAgo } },
        }),
      ]);

    const data = schedules.map((s) => ({
      ...s,
      ...(withDays && { days: sortDays(s.days) }),
    }));

    return {
      data,
      stats: { totalSchedules, activeAssignments, recentChanges },
    };
  },

  // ─────────────────────────────────────────────
  // & 4) GET DETAIL  — Web Admin
  // ─────────────────────────────────────────────
  async findById(id: string) {
    const schedule = await prisma.workingSchedules.findUnique({
      where: { id },
      include: {
        days: { include: { shift: true } },
        employees: { select: { id: true, fullName: true } },
        _count: { select: { employees: true } },
      },
    });

    if (!schedule) {
      throw new Error("Not Found: Jadwal kerja tidak ditemukan.");
    }
    schedule.days = sortDays(schedule.days);
    return schedule;
  },

  // ─────────────────────────────────────────────
  // & 5) ASSIGN EMPLOYEES — Web Admin
  // ─────────────────────────────────────────────
  async assignEmployees(
    scheduleId: string,
    { employeeIds }: AssignEmployeesPayload,
    actor: AuditActor,
  ) {
    const exists = await prisma.workingSchedules.findUnique({
      where: { id: scheduleId },
      include: {
        employees: { select: { id: true } },
      },
    });

    if (!exists) {
      throw new Error("Not Found: Jadwal kerja tidak ditemukan.");
    }

    const updated = await prisma.workingSchedules.update({
      where: { id: scheduleId },
      data: {
        employees: { set: employeeIds.map((id) => ({ id })) },
      },
      include: {
        days: { include: { shift: true } },
        employees: { select: { id: true, fullName: true } },
        _count: { select: { employees: true } },
      },
    });

    await writeAuditLog({
      actor,
      action: "ASSIGN_WORKING_SCHEDULE_EMPLOYEES",
      entity: "WorkingSchedules",
      entityId: scheduleId,
      changes: {
        before: {
          employeeIds: exists.employees.map((employee) => employee.id),
        },
        after: {
          employeeIds: updated.employees.map((employee) => employee.id),
        },
      },
    });

    return updated;
  },

  // ─────────────────────────────────────────────
  // & 6) MOBILE SUMMARY — Kalender Absen
  // ─────────────────────────────────────────────
  async getMobileSummary(
    userId: string,
    startDate: string,
    endDate: string,
    timezone: string,
  ) {
    // 1. Cari employee + jadwal kerja + shift
    const employee = await prisma.employees.findFirst({
      where: { userId },
      include: {
        workingSchedules: {
          include: { days: { include: { shift: true } } },
        },
      },
    });

    console.log("Employee:", employee);

    if (!employee) {
      throw new Error("Not Found: Data karyawan tidak ditemukan.");
    }

    const scheduleDays = employee.workingSchedules?.days ?? [];

    console.log("Start: ", startDate, "End:", endDate, "Timezone:", timezone);

    // 2. Ambil attendance di range tanggal
    //    Append T00:00:00.000Z agar Date constructor selalu valid (UTC)
    const requestedStart = new Date(`${startDate}T00:00:00.000Z`);
    const requestedEnd = new Date(`${endDate}T00:00:00.000Z`);

    if (isNaN(requestedStart.getTime()) || isNaN(requestedEnd.getTime())) {
      throw new Error(
        "Bad Request: Format tanggal tidak valid. Gunakan YYYY-MM-DD.",
      );
    }

    const joinDate = toDateKey(employee.joinDate, timezone);
    const effectiveStartDate = startDate < joinDate ? joinDate : startDate;

    if (endDate < joinDate) {
      return {
        serverNow: new Date().toISOString(),
        serverDate: new Date().toLocaleDateString("sv-SE", {
          timeZone: timezone,
        }),
        joinDate,
        todayShift: null,
        weeklySummary: [],
      };
    }

    const start = new Date(`${effectiveStartDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);
    const attendanceRangeStart = new Date(
      `${effectiveStartDate}T00:00:00.000${BUSINESS_UTC_OFFSET}`,
    );
    const attendanceRangeEnd = new Date(
      `${endDate}T23:59:59.999${BUSINESS_UTC_OFFSET}`,
    );

    // endDate inclusive: geser ke akhir hari
    const endInclusive = new Date(end);
    endInclusive.setDate(endInclusive.getDate() + 1);

    const [attendances, holidays, submissions] = await Promise.all([
      prisma.attendances.findMany({
        where: {
          employeeId: employee.id,
          createdAt: { gte: attendanceRangeStart, lte: attendanceRangeEnd },
        },
      }),
      prisma.publicHolidays.findMany({
        where: {
          date: {
            gte: start,
            lte: end,
          },
        },
        select: {
          date: true,
          name: true,
        },
      }),
      prisma.submissions.findMany({
        where: {
          userId,
          status: {
            in: ["PENDING", "APPROVED"],
          },
          startDate: { lte: endInclusive },
          endDate: { gte: start },
        },
        select: {
          type: true,
          status: true,
          startDate: true,
          endDate: true,
        },
      }),
    ]);

    // Index attendance by date string → status untuk lookup O(1)
    const attendanceMap = new Map<string, string>();
    for (const att of attendances) {
      attendanceMap.set(toDateKey(att.createdAt, timezone), att.status);
    }

    // Index holidays by date key untuk lookup O(1)
    const holidayMap = new Map<string, string>();
    for (const holiday of holidays) {
      holidayMap.set(toDateKey(holiday.date, timezone), holiday.name);
    }

    const submissionMap = new Map<
      string,
      {
        type: string;
        status: string;
      }
    >();

    for (const submission of submissions) {
      const submissionStart = new Date(
        `${toDateKey(submission.startDate, timezone)}T00:00:00.000Z`,
      );
      const submissionEnd = new Date(
        `${toDateKey(submission.endDate, timezone)}T00:00:00.000Z`,
      );

      const cursor = new Date(submissionStart);
      while (cursor <= submissionEnd) {
        const dateKey = toDateStr(cursor);
        if (dateKey >= effectiveStartDate && dateKey <= endDate) {
          const existing = submissionMap.get(dateKey);
          if (
            !existing ||
            (existing.status === "PENDING" && submission.status === "APPROVED")
          ) {
            submissionMap.set(dateKey, {
              type: submission.type,
              status: submission.status,
            });
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    // 3. Loop dari startDate → endDate, build summary
    //    Hitung "hari ini" berdasarkan timezone pengguna (bukan UTC)
    const today = new Date().toLocaleDateString("sv-SE", {
      timeZone: timezone,
    });

    type DayStatus = "completed" | "absent" | "missed" | "off" | "upcoming";
    const weeklySummary: Array<{
      date: string;
      dayOfWeek: string;
      isWorkingDay: boolean;
      shift: { name: string; startTime: string; endTime: string } | null;
      status: DayStatus;
      note?: string | null;
    }> = [];

    let todayShift: (typeof weeklySummary)[number] | null = null;

    const cursor = new Date(start);
    while (cursor <= end) {
      const dateStr = toDateStr(cursor);
      const dayOfWeek = getDayNameID(cursor, timezone);
      const scheduleDay = findScheduleDayByDate(scheduleDays, cursor, timezone);

      const isHoliday = holidayMap.has(dateStr);
      const holidayName = holidayMap.get(dateStr);
      const submission = submissionMap.get(dateStr);

      const isWorkingDay =
        hasActiveShiftOnDay(scheduleDay) && !isHoliday && !submission;
      const shift = scheduleDay?.shift
        ? {
            name: scheduleDay.shift.name,
            startTime: scheduleDay.shift.startTime,
            endTime: scheduleDay.shift.endTime,
            isCrossDay: scheduleDay.shift.isCrossDay,
          }
        : null;

      const attStatus = attendanceMap.get(dateStr);
      const submissionNote = submission
        ? `Ada pengajuan ${formatSubmissionTypeLabel(submission.type)} (${submission.status}).`
        : null;
      const { status, note } = resolveMobileSummaryDayStatus({
        hasActiveScheduleDay: !!scheduleDay?.isActive,
        isHoliday,
        holidayName,
        submissionNote,
        attendanceStatus: attStatus,
        dateKey: dateStr,
        todayKey: today,
      });

      const entry = {
        date: dateStr,
        dayOfWeek,
        isWorkingDay,
        shift,
        status: status as DayStatus,
        note,
      };
      weeklySummary.push(entry);

      if (dateStr === today) todayShift = entry;

      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      serverNow: new Date().toISOString(),
      serverDate: today,
      joinDate,
      todayShift,
      weeklySummary,
    };
  },
};
