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
import type {
  AssignEmployeesPayload,
  CreateSchedulePayload,
} from "./workingSchedules.schema";
import { WorkingSchedulesRepository } from "./workingSchedules.repository";
import { BUSINESS_UTC_OFFSET, sortDays, toDateStr } from "./utils/transform.util";
import prisma from "../../config/prisma";

export const WorkingScheduleService = {
  // Create schedule and schedule days.
  async create(payload: CreateSchedulePayload, actor: AuditActor) {
    const { name, employeeIds, days } = payload;
    const validEmployeeIds = (employeeIds ?? []).filter(
      (id) => id && id.trim() !== "",
    );

    return prisma.$transaction(async (tx) => {
      const schedule = await WorkingSchedulesRepository.createWorkingSchedule(
        {
          name,
          ...(validEmployeeIds.length > 0 && {
            employees: {
              connect: validEmployeeIds.map((id) => ({ id })),
            },
          }),
        },
        tx,
      );

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
          let shift = await WorkingSchedulesRepository.findShiftByTime(
            day.startTime,
            day.endTime,
            isCrossDay,
            tx,
          );

          if (!shift) {
            const label = isCrossDay ? " (Cross-Day)" : "";
            shift = await WorkingSchedulesRepository.createShift(
              {
                name: `Shift ${day.startTime}-${day.endTime}${label}`,
                startTime: day.startTime,
                endTime: day.endTime,
                isCrossDay,
              },
              tx,
            );
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

      await WorkingSchedulesRepository.createScheduleDays(scheduleDayData, tx);

      const result = await WorkingSchedulesRepository.findScheduleByIdOrThrow(
        schedule.id,
        tx,
      );
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
            days: result.days.map((day: any) => ({
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

  // Update schedule metadata and assigned relations.
  async update(
    scheduleId: string,
    payload: CreateSchedulePayload,
    actor: AuditActor,
  ) {
    const { name, employeeIds, days } = payload;
    const validEmployeeIds = (employeeIds ?? []).filter(
      (id) => id && id.trim() !== "",
    );

    return prisma.$transaction(async (tx) => {
      const existingSchedule =
        await WorkingSchedulesRepository.findScheduleByIdWithEmployees(
          scheduleId,
          tx,
        );

      if (!existingSchedule) {
        throw new Error("Not Found: Jadwal kerja tidak ditemukan.");
      }

      await WorkingSchedulesRepository.updateScheduleName(scheduleId, name, tx);
      await WorkingSchedulesRepository.deleteScheduleDaysByScheduleId(scheduleId, tx);

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
          let shift = await WorkingSchedulesRepository.findShiftByTime(
            day.startTime,
            day.endTime,
            isCrossDay,
            tx,
          );

          if (!shift) {
            const label = isCrossDay ? " (Cross-Day)" : "";
            shift = await WorkingSchedulesRepository.createShift(
              {
                name: `Shift ${day.startTime}-${day.endTime}${label}`,
                startTime: day.startTime,
                endTime: day.endTime,
                isCrossDay,
              },
              tx,
            );
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

      await WorkingSchedulesRepository.createScheduleDays(scheduleDayData, tx);

      if (employeeIds !== undefined) {
        await WorkingSchedulesRepository.setScheduleEmployees(
          scheduleId,
          validEmployeeIds,
          tx,
        );
      }

      const updatedSchedule = await WorkingSchedulesRepository.findScheduleByIdDetailed(
        scheduleId,
        tx,
      );

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
            days: sortDays(existingSchedule.days).map((day: any) => ({
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
            days: updatedSchedule.days.map((day: any) => ({
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

  // List schedules and stats.
  async findAll({
    withShifts = false,
    withDays = false,
  }: { withShifts?: boolean; withDays?: boolean } = {}) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [schedules, totalSchedules, activeAssignments, recentChanges] =
      await Promise.all([
        WorkingSchedulesRepository.findSchedulesForList(
          withDays,
          withShifts,
        ),
        WorkingSchedulesRepository.countWorkingSchedules(),
        WorkingSchedulesRepository.countAssignedEmployees(),
        WorkingSchedulesRepository.countSchedulesSince(sevenDaysAgo),
      ]);

    const data = schedules.map((schedule) => ({
      ...schedule,
      ...(withDays && { days: sortDays(schedule.days) }),
    }));

    return {
      data,
      stats: { totalSchedules, activeAssignments, recentChanges },
    };
  },

  // Get schedule detail by id.
  async findById(id: string) {
    const schedule = await WorkingSchedulesRepository.findScheduleByIdDetailed(id);

    if (!schedule) {
      throw new Error("Not Found: Jadwal kerja tidak ditemukan.");
    }

    schedule.days = sortDays(schedule.days);
    return schedule;
  },

  // Replace schedule employees with a new list.
  async assignEmployees(
    scheduleId: string,
    { employeeIds }: AssignEmployeesPayload,
    actor: AuditActor,
  ) {
    const exists = await WorkingSchedulesRepository.findScheduleByIdWithEmployees(
      scheduleId,
    );

    if (!exists) {
      throw new Error("Not Found: Jadwal kerja tidak ditemukan.");
    }

    await WorkingSchedulesRepository.setScheduleEmployees(scheduleId, employeeIds);

    const updated = await WorkingSchedulesRepository.findScheduleByIdDetailed(scheduleId);

    if (!updated) {
      throw new Error("Not Found: Jadwal kerja tidak ditemukan.");
    }

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

  // Build mobile summary calendar between dates.
  async getMobileSummary(
    userId: string,
    startDate: string,
    endDate: string,
    timezone: string,
  ) {
    const employee = await WorkingSchedulesRepository.findEmployeeWithWorkingSchedule(
      userId,
    );

    if (!employee) {
      throw new Error("Not Found: Data karyawan tidak ditemukan.");
    }

    const scheduleDays = employee.workingSchedules?.days ?? [];

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

    const endInclusive = new Date(end);
    endInclusive.setDate(endInclusive.getDate() + 1);

    const [attendances, holidays, submissions] = await Promise.all([
      WorkingSchedulesRepository.findAttendancesByRange(
        employee.id,
        attendanceRangeStart,
        attendanceRangeEnd,
      ),
      WorkingSchedulesRepository.findHolidaysByRange(start, end),
      WorkingSchedulesRepository.findSubmissionsByRange(
        userId,
        start,
        endInclusive,
      ),
    ]);

    const attendanceMap = new Map<string, string>();
    for (const attendance of attendances) {
      attendanceMap.set(toDateKey(attendance.createdAt, timezone), attendance.status);
    }

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
      const scheduleDay = findScheduleDayByDate(
        scheduleDays,
        cursor,
        timezone,
      ) as any;

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

      const attendanceStatus = attendanceMap.get(dateStr);
      const submissionNote = submission
        ? `Ada pengajuan ${formatSubmissionTypeLabel(submission.type)} (${submission.status}).`
        : null;
      const { status, note } = resolveMobileSummaryDayStatus({
        hasActiveScheduleDay: !!scheduleDay?.isActive,
        isHoliday,
        holidayName,
        submissionNote,
        attendanceStatus,
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
