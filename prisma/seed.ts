// * File seed database: prisma/seed.ts
// & This script seeds RBAC matrix, master data, and demo employees for local/dev.
// % Script ini melakukan seed matrix RBAC, data master, dan karyawan demo untuk local/dev.
import * as argon2 from "argon2";
import prisma from "../src/config/prisma";
import { PermissionAction } from "../src/generated/prisma/enums";

type RbacRoleKey = "SUPER_ADMIN" | "CEO" | "MANAGER" | "HR" | "ADMIN" | "USER";

// & Reusable action bundle for resources that support basic CRUD only.
// % Paket aksi reusable untuk resource yang hanya mendukung CRUD dasar.
const CRUD_ACTIONS: PermissionAction[] = [
  PermissionAction.CREATE,
  PermissionAction.READ,
  PermissionAction.UPDATE,
  PermissionAction.DELETE,
];

// & Reusable action bundle for resources that also support APPROVE.
// % Paket aksi reusable untuk resource yang juga mendukung APPROVE.
const CRUD_APPROVE_ACTIONS: PermissionAction[] = [
  PermissionAction.CREATE,
  PermissionAction.READ,
  PermissionAction.UPDATE,
  PermissionAction.DELETE,
  PermissionAction.APPROVE,
];

// & Canonical role list used by role seed loop and admin-access calculation.
// % Daftar role kanonis yang dipakai loop seed role dan kalkulasi akses admin.
const SYSTEM_ROLE_KEYS: RbacRoleKey[] = [
  "SUPER_ADMIN",
  "CEO",
  "MANAGER",
  "HR",
  "ADMIN",
  "USER",
];

// & Role keys that should be marked as admin-portal capable.
// % Role yang harus ditandai memiliki akses portal admin.
const ADMIN_PORTAL_ROLE_KEYS = new Set<RbacRoleKey>([
  "SUPER_ADMIN",
  "CEO",
  "MANAGER",
  "HR",
  "ADMIN",
]);

// & Weekday constants for generating schedule-day rows consistently.
// % Konstanta nama hari untuk menghasilkan baris schedule-day secara konsisten.
const WEEK_DAYS_EN = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const NON_WORKING_DAYS = new Set<string>(["Saturday", "Sunday"]);

// & Default and helper for configurable employee seed volume.
// % Default dan helper untuk jumlah data karyawan seed yang bisa dikonfigurasi.
const DEFAULT_TOTAL_EMPLOYEE_SEED = 20;
const FIXED_MANAGER_SEED_COUNT = 3;

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
};

const TOTAL_EMPLOYEE_SEED_COUNT = parsePositiveInteger(
  process.env.SEED_TOTAL_EMPLOYEES,
  DEFAULT_TOTAL_EMPLOYEE_SEED,
);

const STAFF_SEED_COUNT = Math.max(
  TOTAL_EMPLOYEE_SEED_COUNT - FIXED_MANAGER_SEED_COUNT,
  0,
);

// & RBAC resources mirrored with current frontend route/resource definitions.
// % Resource RBAC yang diselaraskan dengan definisi route/resource frontend terkini.
const RBAC_RESOURCE_SEEDS = [
  {
    key: "dashboard",
    name: "Dashboard",
    routePath: "/admin",
    groupName: "Main",
    supportsApprove: false,
  },
  {
    key: "divisions",
    name: "Divisi",
    routePath: "/admin/divisi",
    groupName: "Master Data",
    supportsApprove: false,
  },
  {
    key: "positions",
    name: "Jabatan",
    routePath: "/admin/jabatan",
    groupName: "Master Data",
    supportsApprove: false,
  },
  {
    key: "employees",
    name: "Karyawan",
    routePath: "/admin/karyawan",
    groupName: "Master Data",
    supportsApprove: false,
  },
  {
    key: "faces",
    name: "Manajemen Wajah",
    routePath: "/admin/manajemen-wajah",
    groupName: "Master Data",
    supportsApprove: false,
  },
  {
    key: "working_schedules",
    name: "Jadwal Kerja",
    routePath: "/admin/jadwal-kerja",
    groupName: "Jadwal",
    supportsApprove: false,
  },
  {
    key: "holidays",
    name: "Manajemen Libur",
    routePath: "/admin/manajemen-libur",
    groupName: "Jadwal",
    supportsApprove: false,
  },
  {
    key: "attendances",
    name: "Daftar Absensi",
    routePath: "/admin/daftar-absensi",
    groupName: "Absensi",
    supportsApprove: false,
  },
  {
    key: "attendance_corrections",
    name: "Koreksi Absensi",
    routePath: "/admin/koreksi-absensi",
    groupName: "Absensi",
    supportsApprove: true,
  },
  {
    key: "manual_attendance",
    name: "Absensi Manual",
    routePath: "/admin/absensi-manual",
    groupName: "Absensi",
    supportsApprove: false,
  },
  {
    key: "geofences",
    name: "Geofences",
    routePath: "/admin/geofences",
    groupName: "Absensi",
    supportsApprove: false,
  },
  {
    key: "submissions",
    name: "Daftar Pengajuan",
    routePath: "/admin/daftar-pengajuan",
    groupName: "Pengajuan",
    supportsApprove: true,
  },
  {
    key: "assessments",
    name: "Input Penilaian",
    routePath: "/admin/input-penilaian",
    groupName: "Penilaian",
    supportsApprove: false,
  },
  {
    key: "assessments_division",
    name: "Penilaian Per Divisi",
    routePath: "/admin/penilaian-per-divisi",
    groupName: "Penilaian",
    supportsApprove: false,
  },
  {
    key: "assessment_categories",
    name: "Kategori Penilaian",
    routePath: "/admin/manajemen-kategori",
    groupName: "Penilaian",
    supportsApprove: false,
  },
  {
    key: "assessment_reports",
    name: "Laporan Penilaian",
    routePath: "/admin/laporan-penilaian",
    groupName: "Penilaian",
    supportsApprove: false,
  },
  {
    key: "audit_logs",
    name: "Audit Logs",
    routePath: "/admin/audit-logs",
    groupName: "Logs",
    supportsApprove: false,
  },
  {
    key: "rbac",
    name: "RBAC",
    routePath: "/admin/rbac",
    groupName: "Keamanan",
    supportsApprove: false,
  },
  {
    key: "points",
    name: "Dompet Integritas",
    routePath: "/admin/dompet-integritas",
    groupName: "Integritas",
    supportsApprove: false,
  },
  {
    key: "points_dashboard",
    name: "Dashboard Dompet Integritas",
    routePath: "/admin/dompet-integritas",
    groupName: "Integritas",
    supportsApprove: false,
  },
  {
    key: "points_rules",
    name: "Aturan Poin",
    routePath: "/admin/aturan-poin",
    groupName: "Integritas",
    supportsApprove: false,
  },
  {
    key: "points_marketplace",
    name: "Item Marketplace",
    routePath: "/admin/item-marketplace",
    groupName: "Integritas",
    supportsApprove: false,
  },
  {
    key: "points_logs",
    name: "Integrity Logs",
    routePath: "/admin/integrity-logs",
    groupName: "Integritas",
    supportsApprove: false,
  },
  {
    key: "points_leaderboard",
    name: "Leaderboard Integritas",
    routePath: "/admin/leaderboard-integritas",
    groupName: "Integritas",
    supportsApprove: false,
  },
  {
    key: "employee_home",
    name: "Portal Karyawan - Beranda",
    routePath: "/karyawan",
    groupName: "Portal Karyawan",
    supportsApprove: false,
  },
  {
    key: "employee_attendance",
    name: "Portal Karyawan - Absensi",
    routePath: "/karyawan/absensi",
    groupName: "Portal Karyawan",
    supportsApprove: false,
  },
  {
    key: "employee_submissions",
    name: "Portal Karyawan - Pengajuan",
    routePath: "/karyawan/pengajuan",
    groupName: "Portal Karyawan",
    supportsApprove: true,
  },
  {
    key: "employee_schedule",
    name: "Portal Karyawan - Jadwal",
    routePath: "/karyawan/jadwal",
    groupName: "Portal Karyawan",
    supportsApprove: false,
  },
  {
    key: "employee_account",
    name: "Portal Karyawan - Akun",
    routePath: "/karyawan/akun",
    groupName: "Portal Karyawan",
    supportsApprove: false,
  },
  {
    key: "employee_wallet",
    name: "Portal Karyawan - Dompet Integritas",
    routePath: "/karyawan/dompet",
    groupName: "Portal Karyawan",
    supportsApprove: false,
  },
] as const;

// & Default role-to-resource grants for non-super-admin roles.
// % Grant default role-ke-resource untuk role selain super-admin.
const ROLE_PERMISSION_SEEDS: Record<
  Exclude<RbacRoleKey, "SUPER_ADMIN">,
  Partial<
    Record<(typeof RBAC_RESOURCE_SEEDS)[number]["key"], PermissionAction[]>
  >
> = {
  ADMIN: {
    points: [...CRUD_ACTIONS],
    points_dashboard: [PermissionAction.READ],
    points_rules: [...CRUD_ACTIONS],
    points_marketplace: [...CRUD_ACTIONS],
    points_logs: [PermissionAction.READ],
    points_leaderboard: [PermissionAction.READ],
  },
  CEO: {
    dashboard: [PermissionAction.READ],
    divisions: [PermissionAction.READ],
    positions: [PermissionAction.READ],
    employees: [PermissionAction.READ],
    working_schedules: [...CRUD_ACTIONS],
    attendances: [PermissionAction.READ],
    geofences: [...CRUD_ACTIONS],
    submissions: [PermissionAction.READ],
    assessments: [...CRUD_ACTIONS],
    assessments_division: [PermissionAction.READ],
    assessment_categories: [PermissionAction.READ],
    assessment_reports: [PermissionAction.READ],
    points: [PermissionAction.READ],
    points_dashboard: [PermissionAction.READ],
    points_rules: [PermissionAction.READ],
    points_marketplace: [PermissionAction.READ],
    points_logs: [PermissionAction.READ],
    points_leaderboard: [PermissionAction.READ],
    employee_home: [PermissionAction.READ],
    employee_attendance: [PermissionAction.READ],
    employee_submissions: [PermissionAction.READ],
    employee_schedule: [PermissionAction.READ],
    employee_account: [PermissionAction.READ],
    employee_wallet: [PermissionAction.READ],
  },
  HR: {
    dashboard: [PermissionAction.READ],
    employees: [...CRUD_ACTIONS],
    faces: [...CRUD_ACTIONS],
    working_schedules: [...CRUD_ACTIONS],
    holidays: [PermissionAction.READ],
    attendances: [PermissionAction.READ, PermissionAction.UPDATE],
    attendance_corrections: [
      PermissionAction.CREATE,
      PermissionAction.READ,
      PermissionAction.UPDATE,
      PermissionAction.APPROVE,
    ],
    manual_attendance: [...CRUD_ACTIONS],
    submissions: [PermissionAction.READ],
    assessments: [
      PermissionAction.CREATE,
      PermissionAction.READ,
      PermissionAction.UPDATE,
    ],
    assessment_categories: [
      PermissionAction.CREATE,
      PermissionAction.READ,
      PermissionAction.UPDATE,
    ],
    assessment_reports: [PermissionAction.READ],
    points: [...CRUD_ACTIONS],
    points_dashboard: [PermissionAction.READ],
    points_rules: [...CRUD_ACTIONS],
    points_marketplace: [...CRUD_ACTIONS],
    points_logs: [PermissionAction.READ],
    points_leaderboard: [PermissionAction.READ],
    employee_home: [PermissionAction.READ],
    employee_attendance: [PermissionAction.READ],
    employee_submissions: [PermissionAction.READ],
    employee_schedule: [PermissionAction.READ],
    employee_account: [PermissionAction.READ],
    employee_wallet: [PermissionAction.READ],
    rbac: [PermissionAction.READ],
  },
  MANAGER: {
    dashboard: [PermissionAction.READ],
    employees: [PermissionAction.READ],
    submissions: [PermissionAction.READ],
    assessments: [
      PermissionAction.CREATE,
      PermissionAction.READ,
      PermissionAction.UPDATE,
    ],
    assessments_division: [PermissionAction.READ],
    points: [PermissionAction.READ],
    points_dashboard: [PermissionAction.READ],
    points_logs: [PermissionAction.READ],
    points_leaderboard: [PermissionAction.READ],
    employee_home: [PermissionAction.READ],
    employee_attendance: [PermissionAction.READ],
    employee_submissions: [PermissionAction.READ],
    employee_schedule: [PermissionAction.READ],
    employee_account: [PermissionAction.READ],
    employee_wallet: [PermissionAction.READ],
  },
  USER: {
    employee_home: [PermissionAction.READ],
    employee_attendance: [
      PermissionAction.CREATE,
      PermissionAction.READ,
      PermissionAction.UPDATE,
    ],
    employee_submissions: [
      PermissionAction.CREATE,
      PermissionAction.READ,
      PermissionAction.UPDATE,
    ],
    employee_schedule: [PermissionAction.READ],
    employee_account: [PermissionAction.READ, PermissionAction.UPDATE],
    employee_wallet: [PermissionAction.READ, PermissionAction.CREATE],
  },
};

// & Upsert permission resources and role permission matrix in idempotent manner.
// % Upsert resource permission dan matrix permission per role secara idempoten.
async function seedRbacResourcesAndPermissions() {
  console.log("🔐 Menyiapkan Resource RBAC...");

  const resourceMap = new Map<
    string,
    { id: string; supportsApprove: boolean }
  >();

  for (const resource of RBAC_RESOURCE_SEEDS) {
    const upserted = await prisma.permissionResources.upsert({
      where: { key: resource.key },
      update: {
        name: resource.name,
        routePath: resource.routePath,
        groupName: resource.groupName,
        supportsApprove: resource.supportsApprove,
        isActive: true,
      },
      create: {
        key: resource.key,
        name: resource.name,
        routePath: resource.routePath,
        groupName: resource.groupName,
        supportsApprove: resource.supportsApprove,
        isActive: true,
      },
      select: {
        id: true,
        key: true,
        supportsApprove: true,
      },
    });

    resourceMap.set(upserted.key, {
      id: upserted.id,
      supportsApprove: upserted.supportsApprove,
    });
  }

  console.log("🧩 Menyiapkan Permission Matrix per Role...");
  const roles = await prisma.rbacRoles.findMany({
    select: { id: true, key: true },
  });

  for (const role of roles) {
    const roleKey = role.key as RbacRoleKey;

    if (roleKey === "SUPER_ADMIN") {
      for (const [resourceKey, resource] of resourceMap.entries()) {
        const actions = resource.supportsApprove
          ? CRUD_APPROVE_ACTIONS
          : CRUD_ACTIONS;

        for (const action of actions) {
          await prisma.rolePermissionActions.upsert({
            where: {
              roleId_resourceId_action: {
                roleId: role.id,
                resourceId: resource.id,
                action,
              },
            },
            update: {
              isAllowed: true,
            },
            create: {
              roleId: role.id,
              resourceId: resource.id,
              action,
              isAllowed: true,
            },
          });
        }
      }

      continue;
    }

    const grants =
      ROLE_PERMISSION_SEEDS[roleKey as Exclude<RbacRoleKey, "SUPER_ADMIN">] ??
      {};

    for (const [resourceKey, actions] of Object.entries(grants)) {
      const resource = resourceMap.get(resourceKey);
      if (!resource) continue;

      for (const action of actions) {
        if (action === PermissionAction.APPROVE && !resource.supportsApprove) {
          continue;
        }

        await prisma.rolePermissionActions.upsert({
          where: {
            roleId_resourceId_action: {
              roleId: role.id,
              resourceId: resource.id,
              action,
            },
          },
          update: {
            isAllowed: true,
          },
          create: {
            roleId: role.id,
            resourceId: resource.id,
            action,
            isAllowed: true,
          },
        });
      }
    }
  }
}

// & Clean all seeded tables in FK-safe order before inserting fresh data.
// % Bersihkan semua tabel seed dalam urutan aman FK sebelum insert data baru.
async function resetDatabaseForSeed() {
  await prisma.attendances.deleteMany();
  await prisma.auditLogs.deleteMany();

  await prisma.assessmentDetails.deleteMany();
  await prisma.assessments.deleteMany();
  await prisma.assessmentCategories.deleteMany();

  await prisma.submissions.deleteMany();
  await prisma.publicHolidays.deleteMany();

  await prisma.userFaces.deleteMany();
  // Model ini opsional tergantung versi schema prisma yang ter-generate.
  // await (prisma as any).userBadges?.deleteMany?.(); deleted
  // await (prisma as any).points?.deleteMany?.(); deleted

  await prisma.employeeDetails.deleteMany();
  await prisma.employees.deleteMany();

  await prisma.scheduleDays.deleteMany();
  await prisma.shifts.deleteMany();
  await prisma.workingSchedules.deleteMany();

  await prisma.geofences.deleteMany();
  await prisma.positions.deleteMany();
  await prisma.divisions.deleteMany();

  await prisma.users.deleteMany();
  await prisma.rolePermissionActions.deleteMany();
  await prisma.permissionResources.deleteMany();
  await prisma.rbacRoles.deleteMany();
}

// & Main seed entrypoint for development bootstrap.
// % Titik masuk utama seed untuk bootstrap environment development.
async function main() {
  console.log(
    `🌱 Memulai Massive Database Seeding (target total karyawan: ${TOTAL_EMPLOYEE_SEED_COUNT})...`,
  );
  console.log(
    "ℹ️ Ubah jumlah data dengan env variable SEED_TOTAL_EMPLOYEES, contoh: SEED_TOTAL_EMPLOYEES=1000",
  );

  if (TOTAL_EMPLOYEE_SEED_COUNT < FIXED_MANAGER_SEED_COUNT) {
    console.warn(
      `⚠️ SEED_TOTAL_EMPLOYEES (${TOTAL_EMPLOYEE_SEED_COUNT}) lebih kecil dari jumlah manager default (${FIXED_MANAGER_SEED_COUNT}). Tetap akan dibuat ${FIXED_MANAGER_SEED_COUNT} manager dan 0 staff.`,
    );
  }

  // ==========================================
  // 0️⃣ PERSIAPAN DATA STATIS (Aman karena menggunakan Upsert)
  // ==========================================

  console.log("🛡️ Membuat Default RBAC Roles...");
  for (const roleKey of SYSTEM_ROLE_KEYS) {
    await prisma.rbacRoles.upsert({
      where: { key: roleKey },
      update: {
        canAccessAdmin: ADMIN_PORTAL_ROLE_KEYS.has(roleKey),
      },
      create: {
        key: roleKey,
        name: roleKey,
        isSystem: true,
        isActive: true,
        canAccessAdmin: ADMIN_PORTAL_ROLE_KEYS.has(roleKey),
      },
    });
  }

  await seedRbacResourcesAndPermissions();

  // Validasi: Cek apakah data user sudah ada (berarti DB tidak kosong)
  const existingSeedData = await prisma.users.findUnique({
    where: { nip: "MGR-001" },
  });

  if (existingSeedData) {
    console.log("⚠️ Peringatan: Data Manager (MGR-001) sudah eksis.");
    console.log(
      "✅ Validasi lolos: Melewati proses seed karyawan agar tidak terjadi constraint error (bebas duplikat) dan data lama tidak hilang.",
    );
    return;
  }

  console.log("✨ Data kosong. Memulai seed karyawan dan struktur...");
  // Opsional: Aktifkan baris ini jika memang butuh wipe bersih lewat kode alih-alih `prisma migrate reset`
  // await resetDatabaseForSeed();

  const defaultPassword = "Password123!";
  const hashedPassword = await argon2.hash(defaultPassword);
  console.log(`🔑 Default Password untuk semua user: ${defaultPassword}`);

  // Nama-nama dummy buat 20 orang
  const firstNames = [
    "Budi",
    "Siti",
    "Agus",
    "Ayu",
    "Nabil",
    "Rina",
    "Joko",
    "Dewi",
    "Hendro",
    "Sari",
    "Rizky",
    "Putri",
    "Fajar",
    "Ratna",
    "Eko",
    "Dian",
    "Aditya",
    "Maya",
    "Tomi",
    "Lestari",
  ];
  const lastNames = [
    "Santoso",
    "Wijaya",
    "Pratama",
    "Sari",
    "Ramadhan",
    "Indah",
    "Setiawan",
    "Lestari",
    "Wibowo",
    "Kusuma",
  ];

  function getRandomName(index: number) {
    const first = firstNames[index % firstNames.length];
    const last = lastNames[(index * 3) % lastNames.length]; // Biar kombinasinya random
    return `${first} ${last}`;
  }

  // ==========================================
  // 1️⃣ KASTA 1: MASTER JADWAL & KATEGORI PENILAIAN
  // ==========================================
  console.log("📅 Membuat Master Jadwal & Kategori...");

  // & Create reusable office shift used by active weekday schedule rows.
  // % Buat shift kantor reusable yang dipakai baris jadwal hari kerja aktif.
  const officeShift = await prisma.shifts.create({
    data: {
      name: "Shift Normal (08:00-17:00)",
      startTime: "08:00",
      endTime: "17:00",
      isCrossDay: false,
    },
  });

  const schedule = await prisma.workingSchedules.create({
    data: { name: "Jadwal Normal Kantor (08:00 - 17:00)" },
  });

  // & Sync schedule structure with new WorkingSchedules/ScheduleDays design.
  // % Sinkronkan struktur jadwal dengan desain baru WorkingSchedules/ScheduleDays.
  await prisma.scheduleDays.createMany({
    data: WEEK_DAYS_EN.map((dayOfWeek) => {
      const isWorkingDay = !NON_WORKING_DAYS.has(dayOfWeek);
      return {
        workingScheduleId: schedule.id,
        dayOfWeek,
        isActive: isWorkingDay,
        shiftId: isWorkingDay ? officeShift.id : null,
      };
    }),
  });

  // & Seed default office geofence for attendance check-in/check-out validation.
  // % Seed geofence kantor default untuk validasi check-in/check-out absensi.
  await prisma.geofences.create({
    data: {
      name: "Kantor Pusat",
      latitude: "-6.2000000",
      longitude: "106.8166667",
      radius: 150,
    },
  });

  const categories = ["Disiplin", "Kerja Sama Tim", "Inisiatif", "Komunikasi"];
  for (const cat of categories) {
    await prisma.assessmentCategories.create({
      data: { name: cat, description: `Penilaian untuk aspek ${cat}` },
    });
  }

  // ==========================================
  // 2️⃣ KASTA 2: MEMBUAT MANAGER (ATASAN) DULU
  // ==========================================
  console.log("👔 Membuat Profil Manager...");

  // & Helper to create user+employee+detail in one transaction.
  // % Helper untuk membuat user+employee+detail dalam satu transaksi.
  async function seedEmployee(
    nip: string,
    rbacRoleKey: string,
    name: string,
    positionId?: string,
  ) {
    const email = `${name.split(" ")[0].toLowerCase()}.${nip.toLowerCase()}@perusahaan.com`;
    const phone = `0812${Math.floor(10000000 + Math.random() * 90000000)}`;

    return await prisma.$transaction(async (tx) => {
      // & Step A: Create login identity in Users table.
      // % Step A: Buat identitas login pada tabel Users.
      const user = await tx.users.create({
        data: {
          nip,
          password: hashedPassword,
          rbacRole: { connect: { key: rbacRoleKey } },
        },
      });

      // & Step B: Create employee profile linked to created user.
      // % Step B: Buat profil employee yang terhubung ke user tersebut.
      const employee = await tx.employees.create({
        data: {
          fullName: name,
          email,
          phoneNumber: phone,
          userId: user.id,
          positionId: positionId || null,
          workingSchedulesId: schedule.id,
        },
      });

      // & Step C: Create optional employee detail attributes.
      // % Step C: Buat atribut detail tambahan employee.
      await tx.employeeDetails.create({
        data: {
          employeeId: employee.id,
          gender: Math.random() > 0.5 ? "Laki-laki" : "Perempuan",
          employmentType: "Full-Time",
          placeOfBirth: "Jakarta",
          dateOfBirth: new Date(`199${Math.floor(Math.random() * 9)}-01-01`),
        },
      });

      return { user, employee };
    });
  }

  // Buat 3 Manager
  const mgr1 = await seedEmployee("MGR-001", "MANAGER", "Toni Stark");
  const mgr2 = await seedEmployee("MGR-002", "MANAGER", "Steve Rogers");
  const mgr3 = await seedEmployee("MGR-003", "MANAGER", "Bruce Wayne");

  // ==========================================
  // 3️⃣ KASTA 3: DIVISI & JABATAN (DIHUBUNGKAN KE MANAGER)
  // ==========================================
  console.log("🏢 Membuat Divisi & Jabatan...");

  const divIT = await prisma.divisions.create({
    data: { name: "IT & Engineering", managerId: mgr1.user.id },
  });
  const divHR = await prisma.divisions.create({
    data: { name: "Human Resources", managerId: mgr2.user.id },
  });
  const divOps = await prisma.divisions.create({
    data: { name: "Operations", managerId: mgr3.user.id },
  });

  const posDev = await prisma.positions.create({
    data: {
      name: "Software Engineer",
      gajiPokok: 10000000,
      divisionId: divIT.id,
    },
  });
  const posHR = await prisma.positions.create({
    data: { name: "HR Specialist", gajiPokok: 8000000, divisionId: divHR.id },
  });
  const posOps = await prisma.positions.create({
    data: { name: "Field Operator", gajiPokok: 7000000, divisionId: divOps.id },
  });

  // (Opsional: Update positionId si manager biar mereka juga punya jabatan struktural)
  const posITManager = await prisma.positions.create({
    data: {
      name: "IT Manager",
      gajiPokok: 20000000,
      isManagerial: true,
      divisionId: divIT.id,
    },
  });
  await prisma.employees.update({
    where: { id: mgr1.employee.id },
    data: { positionId: posITManager.id },
  });

  // ==========================================
  // 4️⃣ KASTA 4: BULK INSERT BAWAHAN (DINAMIS BERDASARKAN VARIABLE)
  // ==========================================
  console.log(`👥 Membangkitkan ${STAFF_SEED_COUNT} Staff Bawahan...`);

  const positionsList = [posDev.id, posHR.id, posOps.id];

  for (let i = 0; i < STAFF_SEED_COUNT; i++) {
    const nip = `10${i < 10 ? `0${i}` : i}`;
    const name = getRandomName(i);
    // & Rotate assignments to distribute staff across three divisions evenly.
    // % Rotasi assignment untuk membagi staff merata ke tiga divisi.
    const assignedPosition = positionsList[i % positionsList.length];

    await seedEmployee(nip, "USER", name, assignedPosition);
    process.stdout.write(`.`); // Bikin efek loading di terminal
  }

  // ==========================================
  // 5️⃣ KASTA 5: MASTER DATA DOMPET INTEGRITAS
  // ==========================================
  console.log("\n📊 Membuat Master Data Dompet Integritas...");

  // & Seed point rules yang akan dipakai untuk kalkulasi poin otomatis.
  // % Seed aturan poin yang digunakan untuk kalkulasi poin otomatis.
  const pointRules = [
    {
      ruleName: "Durasi Keterlambatan > 15 Menit",
      targetRole: "*",
      conditionField: "attendance.lateMinutes",
      conditionOp: ">",
      conditionValue: "15",
      pointModifier: -8,
      description: "Penalty jika terlambat lebih dari 15 menit",
      isActive: true,
    },
    {
      ruleName: "Absensi Bulanan >= 20 Hari",
      targetRole: "*",
      conditionField: "attendance.monthlyCount",
      conditionOp: ">=",
      conditionValue: "20",
      pointModifier: 25,
      description: "Bonus jika jumlah hadir bulanan minimal 20 hari",
      isActive: true,
    },
    {
      ruleName: "Datang Lebih Awal Antara 10-30 Menit",
      targetRole: "*",
      conditionField: "attendance.minutesEarly",
      conditionOp: "between",
      conditionValue: "10,30",
      pointModifier: 7,
      description:
        "Bonus untuk kedatangan lebih awal dalam rentang 10-30 menit",
      isActive: true,
    },
    {
      ruleName: "Absensi Bulanan < 10 Hari",
      targetRole: "*",
      conditionField: "attendance.monthlyCount",
      conditionOp: "<",
      conditionValue: "10",
      pointModifier: -20,
      description: "Penalty jika jumlah hadir bulanan kurang dari 10 hari",
      isActive: true,
    },
    {
      ruleName: "Durasi Keterlambatan <= 5 Menit",
      targetRole: "*",
      conditionField: "attendance.lateMinutes",
      conditionOp: "<=",
      conditionValue: "5",
      pointModifier: 3,
      description: "Bonus kecil jika keterlambatan masih maksimal 5 menit",
      isActive: true,
    },
    {
      ruleName: "Datang Tepat Waktu (Early == 0)",
      targetRole: "*",
      conditionField: "attendance.minutesEarly",
      conditionOp: "==",
      conditionValue: "0",
      pointModifier: 2,
      description:
        "Bonus dasar jika datang tepat di jam mulai (tidak lebih awal)",
      isActive: true,
    },
    {
      ruleName: "Status Alpa = True",
      targetRole: "*",
      conditionField: "attendance.isAbsent",
      conditionOp: "==",
      conditionValue: "true",
      pointModifier: -25,
      description: "Penalty besar jika status absensi alpa",
      isActive: true,
    },
    {
      ruleName: "Status Terlambat = True",
      targetRole: "*",
      conditionField: "attendance.isLate",
      conditionOp: "==",
      conditionValue: "true",
      pointModifier: -5,
      description: "Penalty saat status absensi terlambat",
      isActive: true,
    },
  ];

  await prisma.pointRules.createMany({
    data: pointRules,
  });

  // & Seed flexibility items yang bisa dibeli karyawan dengan poin mereka.
  // % Seed item fleksibilitas yang bisa dibeli dengan poin.
  const flexibilityItems = [
    {
      itemName: "Work from Home 1 Hari",
      pointCost: 100,
      itemType: "late_allowance_15m",
      durationDays: 1,
      maxPerMonth: 2,
      description: "Token untuk bekerja dari rumah sehari",
      iconUrl: "https://cdn-icons-png.flaticon.com/512/2169/2169268.png",
    },
    {
      itemName: "Jam Masuk Fleksibel 1 Minggu",
      pointCost: 150,
      itemType: "late_allowance_30m",
      durationDays: 7,
      maxPerMonth: 1,
      description: "Token untuk jam masuk fleksibel selama 1 minggu",
      iconUrl: "https://cdn-icons-png.flaticon.com/512/3050/3050159.png",
    },
    {
      itemName: "Libur Tambahan 1 Hari",
      pointCost: 200,
      itemType: "late_allowance_60m",
      durationDays: 1,
      maxPerMonth: 1,
      description: "Token untuk tambahan 1 hari libur",
      iconUrl: "https://cdn-icons-png.flaticon.com/512/2913/2913152.png",
    },
    //     { value: "absence_excuse", label: "Konversi ABSENT jadi LEAVE" },
    // { value: "wfh_allowance", label: "Kelonggaran WFH" }
    {
      itemName: "Konsultasi Karir 1 Jam",
      pointCost: 75,
      itemType: "special_service",
      durationDays: 30,
      maxPerMonth: 3,
      description: "Token untuk konsultasi karir dengan HR",
      iconUrl: "https://cdn-icons-png.flaticon.com/512/1995/1995534.png",
    },
    {
      itemName: "Voucher Makan Siang (IDR 50K)",
      pointCost: 50,
      itemType: "voucher",
      durationDays: 90,
      maxPerMonth: 5,
      description: "Voucher untuk makan siang senilai 50 ribu",
      iconUrl: "https://cdn-icons-png.flaticon.com/512/921/921489.png",
    },
  ];

  await prisma.flexibilityItems.createMany({
    data: flexibilityItems,
  });

  console.log("✅ Master Data Dompet Integritas berhasil dibuat!");

  console.log(
    `\n✅ ${FIXED_MANAGER_SEED_COUNT + STAFF_SEED_COUNT} Karyawan berhasil dilahirkan ke dunia (Database)!`,
  );
  console.log(
    "Cobain login pakai NIP: MGR-001 atau STF-1005 dengan password: Password123!",
  );
}

main()
  .catch((e) => {
    console.error("\n❌ SEEDING GAGAL:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
