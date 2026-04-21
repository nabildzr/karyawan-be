// * File shared selects: employeeDataSelect.ts
// & This file centralizes reusable Prisma select objects for employee queries.
// % File ini memusatkan objek select Prisma yang reusable untuk query karyawan.
// & Base select for employee listing/detail without full schedule graph.
// % Select dasar untuk list/detail karyawan tanpa graph jadwal penuh.
/** Mengekspor employeeBaseSelect untuk kebutuhan modul ini. */
export const employeeBaseSelect = {
  id: true,
  fullName: true,
  address: true,
  email: true,
  phoneNumber: true,
  joinDate: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      nip: true,
      rbacRoleId: true,
      rbacRole: {
        select: {
          id: true,
          key: true,
          name: true,
          isSystem: true,
          isActive: true,
        },
      },
    },
  },
  position: {
    select: {
      id: true,
      name: true,
      gajiPokok: true,
      isManagerial: true,
      division: {
        select: { id: true, name: true, description: true },
      },
    },
  },
  employeeDetails: {
    select: {
      dateOfBirth: true,
      placeOfBirth: true,
      gender: true,
      maritalStatus: true,
      religion: true,
      profilePictureUrl: true,
      bankName: true,
      bankAccountNumber: true,
      hireDate: true,
      employmentType: true,
    },
  },
} as const;

// & Deep select for working schedule including days and shift metadata.
// % Select mendalam untuk jadwal kerja termasuk hari dan metadata shift.
/** Mengekspor workingScheduleDeepSelect untuk kebutuhan modul ini. */
export const workingScheduleDeepSelect = {
  select: {
    id: true,
    name: true,
    days: {
      select: {
        dayOfWeek: true,
        isActive: true,
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
            isCrossDay: true,
          },
        },
      },
      orderBy: { dayOfWeek: "asc" as const },
    },
  },
} as const;