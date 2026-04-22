import prisma from "../../../config/prisma";
import { DEFAULT_TIMEZONE, JAKARTA_UTC_OFFSET } from "../../../config/timezone";
import { AttendanceStatus, SubmissionStatus } from "../../../generated/prisma/enums";

type GetAdminDashboardParams = {
  recentLimit?: number;
};

type MonthlyAttendanceSeries = {
  year: number;
  present: number[];
  late: number[];
};

const DEFAULT_RECENT_LIMIT = 10;
const MIN_RECENT_LIMIT = 1;
const MAX_RECENT_LIMIT = 50;
const MONTH_COUNT = 12;

const toRecentLimit = (value?: number) => {
  if (!Number.isFinite(value)) return DEFAULT_RECENT_LIMIT;
  return Math.min(MAX_RECENT_LIMIT, Math.max(MIN_RECENT_LIMIT, Math.floor(Number(value))));
};

const toJakartaYear = (date = new Date()) =>
  Number(
    date.toLocaleDateString("en-US", {
      year: "numeric",
      timeZone: DEFAULT_TIMEZONE,
    }),
  );

const buildJakartaYearRange = (year: number) => ({
  start: new Date(`${year}-01-01T00:00:00.000${JAKARTA_UTC_OFFSET}`),
  end: new Date(`${year}-12-31T23:59:59.999${JAKARTA_UTC_OFFSET}`),
});

const buildMonthlyAttendanceSeries =
  async (): Promise<MonthlyAttendanceSeries> => {
    const year = toJakartaYear();
    const { start, end } = buildJakartaYearRange(year);

    const yearlyAttendances = await prisma.attendances.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        status: {
          in: [AttendanceStatus.PRESENT, AttendanceStatus.LATE],
        },
      },
      select: {
        createdAt: true,
        status: true,
      },
    });

    const present = Array(MONTH_COUNT).fill(0);
    const late = Array(MONTH_COUNT).fill(0);

    for (const attendance of yearlyAttendances) {
      const monthIndex =
        Number(
          attendance.createdAt.toLocaleDateString("en-US", {
            month: "numeric",
            timeZone: DEFAULT_TIMEZONE,
          }),
        ) - 1;

      if (monthIndex < 0 || monthIndex >= MONTH_COUNT) {
        continue;
      }

      if (attendance.status === AttendanceStatus.PRESENT) {
        present[monthIndex] += 1;
        continue;
      }

      late[monthIndex] += 1;
    }

    return { year, present, late };
  };

/**
 * Menjalankan tanggung jawab utama fungsi getAdminDashboard.
 * @param params Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export async function getAdminDashboard(
  params: GetAdminDashboardParams = {},
) {
  const recentLimit = toRecentLimit(params.recentLimit);

  const [
    totalEmployees,
    pendingSubmissions,
    present,
    late,
    absent,
    leave,
    totalAttendance,
    employeesForDivisions,
    recentAttendances,
    monthlyAttendance,
  ] = await Promise.all([
    prisma.employees.count(),
    prisma.submissions.count({ where: { status: SubmissionStatus.PENDING } }),
    prisma.attendances.count({ where: { status: AttendanceStatus.PRESENT } }),
    prisma.attendances.count({ where: { status: AttendanceStatus.LATE } }),
    prisma.attendances.count({ where: { status: AttendanceStatus.ABSENT } }),
    prisma.attendances.count({ where: { status: AttendanceStatus.LEAVE } }),
    prisma.attendances.count(),
    prisma.employees.findMany({
      select: {
        position: {
          select: {
            division: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.attendances.findMany({
      orderBy: { createdAt: "desc" },
      take: recentLimit,
      select: {
        id: true,
        employeeId: true,
        status: true,
        statusCheckOut: true,
        checkIn: true,
        checkOut: true,
        shiftNameSnapshot: true,
        isManualEntry: true,
        createdAt: true,
        updatedAt: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            user: {
              select: {
                nip: true,
              },
            },
            position: {
              select: {
                id: true,
                name: true,
                division: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    buildMonthlyAttendanceSeries(),
  ]);

  const divisionMap = new Map<
    string,
    {
      id: string | null;
      name: string;
      employeeCount: number;
    }
  >();

  for (const employee of employeesForDivisions) {
    const division = employee.position?.division;
    const key = division?.id ?? "UNASSIGNED";
    const current = divisionMap.get(key);
    if (current) {
      current.employeeCount += 1;
      continue;
    }

    divisionMap.set(key, {
      id: division?.id ?? null,
      name: division?.name ?? "Tanpa Divisi",
      employeeCount: 1,
    });
  }

  const divisionDistribution = Array.from(divisionMap.values()).sort(
    (a, b) => b.employeeCount - a.employeeCount,
  );

  return {
    summary: {
      totalEmployees,
      pendingSubmissions,
      attendance: {
        present,
        late,
        absent,
        leave,
        total: totalAttendance,
      },
    },
    divisionDistribution,
    monthlyAttendance,
    recentAttendances,
    generatedAt: new Date().toISOString(),
  };
}
