import prisma from "../../config/prisma";

const getDb = (db?: any) => db ?? prisma;

// Create working schedule row.
const createWorkingSchedule = (data: any, db?: any) => {
  return getDb(db).workingSchedules.create({ data });
};

// Find shift by matching time and cross-day flag.
const findShiftByTime = (
  startTime: string,
  endTime: string,
  isCrossDay: boolean,
  db?: any,
) => {
  return getDb(db).shifts.findFirst({
    where: {
      startTime,
      endTime,
      isCrossDay,
    },
  });
};

// Create shift row.
const createShift = (data: any, db?: any) => {
  return getDb(db).shifts.create({ data });
};

// Create many schedule-day rows.
const createScheduleDays = (data: any[], db?: any) => {
  return getDb(db).scheduleDays.createMany({ data });
};

// Find schedule with days and count, throw when missing.
const findScheduleByIdOrThrow = (id: string, db?: any) => {
  return getDb(db).workingSchedules.findUniqueOrThrow({
    where: { id },
    include: {
      days: { include: { shift: true } },
      _count: { select: { employees: true } },
    },
  });
};

// Find schedule with days and employees.
const findScheduleByIdWithEmployees = (id: string, db?: any) => {
  return getDb(db).workingSchedules.findUnique({
    where: { id },
    include: {
      days: { include: { shift: true } },
      employees: { select: { id: true } },
    },
  });
};

// Update schedule name.
const updateScheduleName = (id: string, name: string, db?: any) => {
  return getDb(db).workingSchedules.update({
    where: { id },
    data: { name },
  });
};

// Delete all schedule day rows by schedule id.
const deleteScheduleDaysByScheduleId = (workingScheduleId: string, db?: any) => {
  return getDb(db).scheduleDays.deleteMany({
    where: { workingScheduleId },
  });
};

// Set all linked employees in schedule.
const setScheduleEmployees = (id: string, employeeIds: string[], db?: any) => {
  return getDb(db).workingSchedules.update({
    where: { id },
    data: {
      employees: {
        set: employeeIds.map((employeeId) => ({ id: employeeId })),
      },
    },
  });
};

// Find schedule by id with details after update.
const findScheduleByIdDetailed = (id: string, db?: any) => {
  return getDb(db).workingSchedules.findUnique({
    where: { id },
    include: {
      days: { include: { shift: true } },
      employees: {
        select: {
          id: true,
          fullName: true,
          email: true,
          user: {
            select: {
              nip: true,
            },
          },
          position: {
            select: {
              name: true,
              division: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      _count: { select: { employees: true } },
    },
  });
};

// Find schedules list for admin.
const findSchedulesForList = (withDays: boolean, withShifts: boolean, db?: any) => {
  return getDb(db).workingSchedules.findMany({
    include: {
      days: withDays
        ? { include: { shift: withShifts ? true : false } }
        : undefined,
      _count: { select: { employees: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

// Count working schedules.
const countWorkingSchedules = (db?: any) => {
  return getDb(db).workingSchedules.count();
};

// Count employees assigned to any schedule.
const countAssignedEmployees = (db?: any) => {
  return getDb(db).employees.count({
    where: { workingSchedulesId: { not: null } },
  });
};

// Count schedules created since date.
const countSchedulesSince = (createdAtGte: Date, db?: any) => {
  return getDb(db).workingSchedules.count({
    where: { createdAt: { gte: createdAtGte } },
  });
};

// Find employee with working schedule by user id.
const findEmployeeWithWorkingSchedule = (userId: string, db?: any) => {
  return getDb(db).employees.findFirst({
    where: { userId },
    include: {
      workingSchedules: {
        include: { days: { include: { shift: true } } },
      },
    },
  });
};

// Find attendances by range.
const findAttendancesByRange = (
  employeeId: string,
  createdAtGte: Date,
  createdAtLte: Date,
  db?: any,
) => {
  return getDb(db).attendances.findMany({
    where: {
      employeeId,
      createdAt: { gte: createdAtGte, lte: createdAtLte },
    },
  });
};

// Find holidays by date range.
const findHolidaysByRange = (start: Date, end: Date, db?: any) => {
  return getDb(db).publicHolidays.findMany({
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
  });
};

// Find submissions by user and date overlap.
const findSubmissionsByRange = (
  userId: string,
  start: Date,
  endInclusive: Date,
  db?: any,
) => {
  return getDb(db).submissions.findMany({
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
  });
};

export const WorkingSchedulesRepository = {
  createWorkingSchedule,
  findShiftByTime,
  createShift,
  createScheduleDays,
  findScheduleByIdOrThrow,
  findScheduleByIdWithEmployees,
  updateScheduleName,
  deleteScheduleDaysByScheduleId,
  setScheduleEmployees,
  findScheduleByIdDetailed,
  findSchedulesForList,
  countWorkingSchedules,
  countAssignedEmployees,
  countSchedulesSince,
  findEmployeeWithWorkingSchedule,
  findAttendancesByRange,
  findHolidaysByRange,
  findSubmissionsByRange,
};
