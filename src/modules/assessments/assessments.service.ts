// * File ini berisi implementasi service module assessments.

import PDFDocument from "pdfkit";
import { PermissionAction } from "../../generated/prisma/enums";
import { writeAuditLog } from "../../shared/audit/writeAudit";
import { AssessmentsRepository } from "./assessments.repository";

const prisma = AssessmentsRepository.db;

// Nama bulan dalam Bahasa Indonesia
const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** Mengekspor AssessmentsService untuk kebutuhan modul ini. */
export const AssessmentsService = {
  // & ============ HELPERS ============

  /** Return periode saat ini dalam format "Maret 2026" */
  _getCurrentPeriod(): string {
    const now = new Date();
    return `${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}`;
  },

  /** Sisa hari menuju akhir bulan */
  _getDaysUntilEndOfMonth(): number {
    const now = new Date();
    // Hari ke-0 bulan berikutnya = hari terakhir bulan ini (trik JS Date)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return Math.max(
      0, // Pastikan tidak pernah negatif (jika sudah melewati akhir bulan)
      // Selisih milidetik dibagi 86.400.000 ms/hari → sisa hari (dibulatkan ke atas)
      Math.ceil((lastDay.getTime() - now.getTime()) / 86_400_000),
    );
  },

  /**
   * Tentukan scope evaluasi berdasarkan permission RBAC:
   * - Scope global (assessment_categories / assessment_reports) -> semua karyawan
   * - Scope divisi -> wajib punya relasi posisi ke divisi
   */
  async _getScope(
    userId: string,
  ): Promise<{ isAdmin: boolean; divisionId?: string }> {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        rbacRole: {
          select: {
            id: true,
            isActive: true,
          },
        },
        employees: {
          select: {
            position: {
              select: {
                divisionId: true,
              },
            },
          },
        },
      },
    });
    if (!user) throw new Error("Not Found: User tidak ditemukan");

    if (!user.rbacRole?.id || user.rbacRole.isActive !== true) {
      throw new Error(
        "Forbidden: Role RBAC user belum ditetapkan atau sedang nonaktif",
      );
    }

    const hasAssessmentReadAccess =
      await prisma.rolePermissionActions.findFirst({
        where: {
          roleId: user.rbacRole.id,
          action: PermissionAction.READ,
          isAllowed: true,
          resource: {
            key: "assessments",
            isActive: true,
          },
        },
        select: { id: true },
      });

    if (!hasAssessmentReadAccess) {
      throw new Error(
        "Forbidden: Role Anda tidak memiliki akses ke fitur penilaian",
      );
    }

    const hasGlobalScope = await prisma.rolePermissionActions.findFirst({
      where: {
        roleId: user.rbacRole.id,
        action: PermissionAction.READ,
        isAllowed: true,
        resource: {
          key: {
            in: ["assessment_categories", "assessment_reports"],
          },
          isActive: true,
        },
      },
      select: { id: true },
    });

    if (hasGlobalScope) {
      return { isAdmin: true };
    }

    const divisionId = user.employees?.position?.divisionId;
    if (!divisionId)
      throw new Error(
        "Forbidden: Evaluator berbasis divisi harus memiliki posisi yang berelasi dengan divisi",
      );

    return { isAdmin: false, divisionId };
  },

  /** Hitung rata-rata skor dari array detail 
   * - Jika tidak ada detail, kembalikan 0 (hindari NaN).
   * return angka dengan maksimal 2 desimal (misal 3.75) untuk konsistensi format skor.
  */
  _calcAvgScore(details: { score: any }[]): number {
    if (!details.length) return 0; // Guard: hindari pembagian dengan nol
    // Number() konversi Prisma Decimal → angka JS sebelum dijumlahkan
    const total = details.reduce((s, d) => s + Number(d.score), 0);
    // Kalikan 100 → bulatkan ke integer → bagi 100 kembali = 2 desimal presisi
    return Math.round((total / details.length) * 100) / 100;
  },

  /** Tentukan predikat berdasarkan rata-rata (skala 1-5) */
  _getPredikat(avg: number): string {
    if (avg >= 4.5) return "Sangat Memuaskan (A)"; // ≥90% dari skor maksimum 5
    if (avg >= 3.5) return "Memuaskan (B)"; // ≥70% — di atas rata-rata
    if (avg >= 2.5) return "Cukup (C)"; // ≥50% — pas di tengah skala
    return "Kurang (D)"; // <50% — di bawah ekspektasi minimum
  },

  // & ============ GET SUBORDINATES (SCOPE-AWARE) ============

  async getSubordinates(
    userId: string,
    period: string,
    overrideDivisionId?: string,
  ) {
    const scope = await AssessmentsService._getScope(userId);

    // Jika caller adalah Admin/HR dan mengirim divisionId eksplisit, pakai itu.
    // Jika caller adalah Manager, pakai divisionId dari scope-nya sendiri.
    const effectiveDivisionId =
      scope.divisionId ?? (scope.isAdmin ? overrideDivisionId : undefined);

    const employees = await prisma.employees.findMany({
      where: effectiveDivisionId
        ? { position: { divisionId: effectiveDivisionId } }
        : {},
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
            name: true,
            division: { select: { name: true } },
          },
        },
        evaluationsReceived: {
          where: { period },
          select: { id: true, assessmentDate: true },
        },
      },
      orderBy: { joinDate: "asc" },
    });

    return employees.map((emp) => ({
      employeeId: emp.id,
      nip: emp.user?.nip ?? "-",
      fullName: emp.fullName,
      position: emp.position?.name || "Tanpa Jabatan",
      division: emp.position?.division?.name || "-",
      isReviewed: emp.evaluationsReceived.length > 0,
      assessmentId: emp.evaluationsReceived[0]?.id || null,
      assessedAt: emp.evaluationsReceived[0]?.assessmentDate || null,
    }));
  },

  // & ============ CREATE ASSESSMENT ============

  async create(evaluatorUserId: string, payload: any) {
    // Cegah self-assessment: cari employee record milik penilai berdasarkan userId,
    // lalu bandingkan employee.id-nya dengan evaluateeId yang dikirim dari body.
    // (evaluatorId = Users.id, evaluateeId = Employees.id → harus di-resolve dulu)
    const evaluatorEmployee = await prisma.employees.findFirst({
      where: { userId: evaluatorUserId },
      select: { id: true },
    });

    // Jika penilai memiliki record employee DAN id-nya sama dengan target → tolak
    if (evaluatorEmployee && evaluatorEmployee.id === payload.evaluateeId) {
      throw new Error("Bad Request: Penilai tidak dapat menilai diri sendiri");
    }

    return prisma.$transaction(async (tx) => {
      const evaluatorUser = await tx.users.findUnique({
        where: { id: evaluatorUserId },
        select: { rbacRole: { select: { key: true } } },
      });

      const newAssessment = await tx.assessments.create({
        data: {
          evaluatorId: evaluatorUserId,
          evaluateeId: payload.evaluateeId,
          period: payload.period,
          assessmentDate: new Date(),
          generalNotes: payload.generalNotes,
          details: {
            create: payload.details.map((d: any) => ({
              categoryId: d.categoryId,
              categoryName: d.categoryName,
              score: d.score,
            })),
          },
        },
        include: { details: true },
      });

      await writeAuditLog({
        actor: {
          id: evaluatorUserId,
          role: evaluatorUser?.rbacRole?.key ?? "SYSTEM",
        },
        action: "CREATE_ASSESSMENT",
        entity: "Assessments",
        entityId: newAssessment.id,
        changes: {
          before: null,
          after: {
            evaluateeId: newAssessment.evaluateeId,
            period: newAssessment.period,
            generalNotes: newAssessment.generalNotes,
            details: newAssessment.details.map((d) => ({
              categoryId: d.categoryId,
              categoryName: d.categoryName,
              score: Number(d.score),
            })),
          },
        },
        db: tx as any,
      });

      return newAssessment;
    });
  },

  // & ============ UPDATE ASSESSMENT ============

  async update(assessmentId: string, payload: any, updaterUserId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.assessments.findUnique({
        where: { id: assessmentId },
        include: { details: true },
      });

      if (!existing) {
        throw new Error("Not Found: Penilaian tidak ditemukan");
      }

      const updaterUser = await tx.users.findUnique({
        where: { id: updaterUserId },
        select: { rbacRole: { select: { key: true } } },
      });

      const updated = await tx.assessments.update({
        where: { id: assessmentId },
        data: { generalNotes: payload.generalNotes },
      });

      if (payload.details && payload.details.length > 0) {
        await tx.assessmentDetails.deleteMany({ where: { assessmentId } });
        await tx.assessmentDetails.createMany({
          data: payload.details.map((d: any) => ({
            assessmentId,
            categoryId: d.categoryId,
            categoryName: d.categoryName,
            score: d.score,
          })),
        });
      }

      const updatedWithDetails = await tx.assessments.findUnique({
        where: { id: assessmentId },
        include: { details: true },
      });

      await writeAuditLog({
        actor: {
          id: updaterUserId,
          role: updaterUser?.rbacRole?.key ?? "SYSTEM",
        },
        action: "UPDATE_ASSESSMENT",
        entity: "Assessments",
        entityId: assessmentId,
        changes: {
          before: {
            generalNotes: existing.generalNotes,
            details: existing.details.map((d) => ({
              categoryId: d.categoryId,
              categoryName: d.categoryName,
              score: Number(d.score),
            })),
          },
          after: {
            generalNotes:
              updatedWithDetails?.generalNotes ?? updated.generalNotes,
            details:
              updatedWithDetails?.details.map((d) => ({
                categoryId: d.categoryId,
                categoryName: d.categoryName,
                score: Number(d.score),
              })) ?? [],
          },
        },
        db: tx as any,
      });

      return updated;
    });
  },

  // & ============ STATS DASHBOARD PENILAIAN ============
  /**
   * Statistik kartu dashboard untuk halaman penilaian:
   * - selesai: jumlah karyawan yang sudah dinilai bulan ini
   * - pending: belum dinilai
   * - rataRataSkor: rata-rata skor pada periode saat ini
   * - deadline: sisa hari menuju reset (akhir bulan)
   */
  async getStatsForDashboard(
    userId: string,
    overridePeriod?: string,
    overrideDivisionId?: string,
  ) {
    const scope = await AssessmentsService._getScope(userId);
    const currentPeriod =
      overridePeriod ?? AssessmentsService._getCurrentPeriod();
    const daysLeft = AssessmentsService._getDaysUntilEndOfMonth();

    // Jika caller adalah Admin/HR dan mengirim divisionId eksplisit, pakai itu.
    // Jika caller adalah Manager, pakai divisionId dari scope-nya sendiri.
    const effectiveDivisionId =
      scope.divisionId ?? (scope.isAdmin ? overrideDivisionId : undefined);

    const employeeWhere = effectiveDivisionId
      ? { position: { divisionId: effectiveDivisionId } }
      : {};

    const [totalEmployees, completedAssessments] = await Promise.all([
      prisma.employees.count({ where: employeeWhere }),
      prisma.assessments.findMany({
        where: {
          period: currentPeriod,
          ...(effectiveDivisionId
            ? { evaluatee: { position: { divisionId: effectiveDivisionId } } }
            : {}),
        },
        include: { details: { select: { score: true } } },
      }),
    ]);

    const selesai = completedAssessments.length; // Jumlah record assessment = jumlah yang sudah dinilai
    // Belum dinilai = total karyawan dikurangi yang sudah selesai; max(0) cegah negatif
    const pending = Math.max(0, totalEmployees - selesai);

    // flatMap: ratakan array-of-arrays [assessment[details]] → array skor tunggal
    const allScores = completedAssessments.flatMap(
      (a) => a.details.map((d) => Number(d.score)), // Prisma Decimal → number JS
    );
    const rataRataSkor =
      allScores.length > 0
        ? Math.round(
            // Jumlahkan semua skor lalu bagi jumlah entri, × 100 / 100 = 2 desimal
            (allScores.reduce((s, n) => s + n, 0) / allScores.length) * 100,
          ) / 100
        : 0; // Jika belum ada penilaian, kembalikan 0 (hindari NaN)

    return {
      currentPeriod,
      selesai,
      pending,
      totalKaryawan: totalEmployees,
      rataRataSkor,
      deadline: `${daysLeft} hari lagi`,
      daysUntilReset: daysLeft,
    };
  },

  // & ============ LAPORAN PENILAIAN (LIST + STATS CARDS) ============
  /**
   * List penilaian dengan pagination + stats cards (untuk halaman laporan penilaian).
   * Manager hanya melihat divisinya, Admin/HR melihat semua.
   */
  async getReport(
    userId: string,
    query: {
      period: string;
      page?: number;
      limit?: number;
      divisionId?: string;
      search?: string;
    },
  ) {
    const scope = await AssessmentsService._getScope(userId);
    const page = query.page ?? 1; // Default halaman pertama jika tidak dikirim
    const limit = query.limit ?? 20; // Default 20 baris per halaman
    const skip = (page - 1) * limit; // Offset Prisma: halaman 3 limit 20 → skip 40

    // Build employee filter
    const employeeFilter: any = {};
    if (scope.divisionId) {
      employeeFilter.position = { divisionId: scope.divisionId };
    } else if (query.divisionId) {
      employeeFilter.position = { divisionId: query.divisionId };
    }
    if (query.search) {
      employeeFilter.fullName = { contains: query.search, mode: "insensitive" };
    }

    const assessmentWhere: any = { period: query.period };
    if (Object.keys(employeeFilter).length) {
      assessmentWhere.evaluatee = employeeFilter;
    }

    const [allAssessments, pagedAssessments, total] = await Promise.all([
      // Semua untuk hitung stats cards
      prisma.assessments.findMany({
        where: assessmentWhere,
        include: { details: { select: { score: true } } },
      }),
      // Halaman untuk tabel
      prisma.assessments.findMany({
        where: assessmentWhere,
        skip,
        take: limit,
        orderBy: { assessmentDate: "desc" },
        include: {
          evaluatee: {
            select: {
              id: true,
              fullName: true,
              user: { select: { nip: true } },
              position: {
                select: {
                  name: true,
                  division: { select: { name: true } },
                },
              },
            },
          },
          evaluator: {
            select: { employees: { select: { fullName: true } } },
          },
          details: { select: { score: true } },
        },
      }),
      prisma.assessments.count({ where: assessmentWhere }),
    ]);

    // Stats cards — dihitung dari allAssessments (bukan pagedAssessments agar akurat)
    const avgScores = allAssessments.map(
      (a) => AssessmentsService._calcAvgScore(a.details), // Rata-rata per assessment
    );
    const stats = {
      totalPenilaian: total, // Dari prisma.count — jumlah penilaian sesuai filter
      rataRataKeseluruhan:
        avgScores.length > 0
          ? Math.round(
              // Rata-rata dari semua rata-rata per assessment (mean of means)
              (avgScores.reduce((s, n) => s + n, 0) / avgScores.length) * 100,
            ) / 100
          : 0,
      nilaiTertinggi:
        avgScores.length > 0
          ? Math.round(Math.max(...avgScores) * 100) / 100 // Spread array ke Math.max, bulatkan 2 desimal
          : 0,
      nilaiTerendah:
        avgScores.length > 0
          ? Math.round(Math.min(...avgScores) * 100) / 100 // Spread array ke Math.min, bulatkan 2 desimal
          : 0,
    };

    const data = pagedAssessments.map((a) => {
      const avg = AssessmentsService._calcAvgScore(a.details);
      return {
        id: a.id,
        employeeId: a.evaluateeId,
        employeeName: a.evaluatee.fullName,
        nip: a.evaluatee.user?.nip ?? "-",
        position: a.evaluatee.position?.name ?? "-",
        division: a.evaluatee.position?.division?.name ?? "-",
        evaluatorName: a.evaluator?.employees?.fullName ?? "Admin HR",
        assessmentDate: a.assessmentDate,
        period: a.period,
        averageScore: avg,
        maxScore: 5,
        status: "Selesai",
      };
    });

    return {
      stats,
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }, // ceil: 21 data / 20 = 1.05 → 2 halaman
    };
  },

  // & ============ LAPORAN INDIVIDU (DETAIL BY ASSESSMENT ID) ============

  async getIndividualReport(assessmentId: string) {
    const assessment = await prisma.assessments.findUnique({
      where: { id: assessmentId },
      include: {
        evaluatee: {
          include: {
            user: {
              select: {
                nip: true,
                rbacRole: { select: { key: true } },
              },
            },
            position: { include: { division: true } },
            employeeDetails: true,
          },
        },
        evaluator: {
          select: {
            employees: {
              select: {
                fullName: true,
                position: { select: { name: true } },
                employeeDetails: { select: { profilePictureUrl: true } },
              },
            },
          },
        },
        details: {
          include: {
            category: { select: { name: true, description: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!assessment) throw new Error("Not Found: Penilaian tidak ditemukan");

    const avg = AssessmentsService._calcAvgScore(assessment.details);
    const detail = assessment.evaluatee.employeeDetails?.[0];

    return {
      id: assessment.id,
      period: assessment.period,
      assessmentDate: assessment.assessmentDate,
      completedAt: assessment.updatedAt,
      status: "Selesai",
      generalNotes: assessment.generalNotes,
      averageScore: avg,
      maxScore: 5,
      predikat: AssessmentsService._getPredikat(avg),
      evaluatee: {
        id: assessment.evaluatee.id,
        fullName: assessment.evaluatee.fullName,
        nip: assessment.evaluatee.user.nip,
        role: assessment.evaluatee.user.rbacRole?.key ?? null,
        email: assessment.evaluatee.email,
        phoneNumber: assessment.evaluatee.phoneNumber,
        position: assessment.evaluatee.position?.name ?? "-",
        division: assessment.evaluatee.position?.division?.name ?? "-",
        divisionId: assessment.evaluatee.position?.divisionId ?? null,
        employmentType: detail?.employmentType ?? "-",
        profilePictureUrl: detail?.profilePictureUrl ?? null,
        gender: detail?.gender ?? null,
        joinDate: assessment.evaluatee.joinDate,
      },
      evaluator: {
        fullName: assessment.evaluator?.employees?.fullName ?? "Admin HR",
        position:
          assessment.evaluator?.employees?.position?.name ?? "Manajemen",
        profilePictureUrl:
          assessment.evaluator?.employees?.employeeDetails?.[0]
            ?.profilePictureUrl ?? null,
      },
      categories: assessment.details.map((d) => ({
        id: d.id,
        categoryId: d.categoryId,
        categoryName: d.categoryName,
        score: Number(d.score),
        maxScore: 5,
      })),
    };
  },

  // & ============ LAPORAN INDIVIDU BY EMPLOYEE + PERIOD ============

  async getIndividualReportByEmployee(employeeId: string, period: string) {
    const assessment = await prisma.assessments.findFirst({
      where: { evaluateeId: employeeId, period },
      include: {
        evaluatee: {
          include: {
            user: {
              select: {
                nip: true,
                rbacRole: { select: { key: true } },
              },
            },
            position: { include: { division: true } },
            employeeDetails: true,
          },
        },
        evaluator: {
          select: {
            employees: {
              select: {
                fullName: true,
                position: { select: { name: true } },
                employeeDetails: { select: { profilePictureUrl: true } },
              },
            },
          },
        },
        details: {
          include: {
            category: { select: { name: true, description: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!assessment) {
      throw new Error(
        `Not Found: Belum ada penilaian untuk karyawan ini pada periode ${period}`,
      );
    }

    const avg = AssessmentsService._calcAvgScore(assessment.details);
    const detail = assessment.evaluatee.employeeDetails?.[0];

    return {
      id: assessment.id,
      period: assessment.period,
      assessmentDate: assessment.assessmentDate,
      completedAt: assessment.updatedAt,
      status: "Selesai",
      generalNotes: assessment.generalNotes,
      averageScore: avg,
      maxScore: 5,
      predikat: AssessmentsService._getPredikat(avg),
      evaluatee: {
        id: assessment.evaluatee.id,
        fullName: assessment.evaluatee.fullName,
        nip: assessment.evaluatee.user.nip,
        role: assessment.evaluatee.user.rbacRole?.key ?? null,
        email: assessment.evaluatee.email,
        phoneNumber: assessment.evaluatee.phoneNumber,
        position: assessment.evaluatee.position?.name ?? "-",
        division: assessment.evaluatee.position?.division?.name ?? "-",
        employmentType: detail?.employmentType ?? "-",
        profilePictureUrl: detail?.profilePictureUrl ?? null,
      },
      evaluator: {
        fullName: assessment.evaluator?.employees?.fullName ?? "Admin HR",
        position:
          assessment.evaluator?.employees?.position?.name ?? "Manajemen",
        profilePictureUrl:
          assessment.evaluator?.employees?.employeeDetails?.[0]
            ?.profilePictureUrl ?? null,
      },
      categories: assessment.details.map((d) => ({
        id: d.id,
        categoryId: d.categoryId,
        categoryName: d.categoryName,
        score: Number(d.score),
        maxScore: 5,
      })),
    };
  },

  // & ============ EXPORT LAPORAN INDIVIDU (PDF) ============

  async exportIndividualPDF(assessmentId: string): Promise<Buffer> {
    const report = await AssessmentsService.getIndividualReport(assessmentId);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const buffers: Buffer[] = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const primaryColor = "#2563EB";
      const grayColor = "#6B7280";
      const lightGray = "#F3F4F6";
      const pageWidth = doc.page.width - 100; // A4 lebar 595pt − (margin 50 kiri + 50 kanan) = 495pt area konten

      // ── Header ──────────────────────────────────────────────
      doc.rect(50, 50, pageWidth, 80).fill(primaryColor);
      doc
        .fillColor("white")
        .fontSize(18)
        .font("Helvetica-Bold")
        .text("LAPORAN PENILAIAN INDIVIDU", 65, 65);
      doc
        .fontSize(11)
        .font("Helvetica")
        .text(`Periode: ${report.period}`, 65, 90)
        .text(
          `Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`,
          65,
          106,
        );

      doc.fillColor("#000000");
      let y = 155;

      // ── Info Karyawan ────────────────────────────────────────
      doc.rect(50, y, pageWidth, 110).fill(lightGray);
      doc
        .fillColor(primaryColor)
        .fontSize(13)
        .font("Helvetica-Bold")
        .text("INFORMASI KARYAWAN", 65, y + 12);

      doc.fillColor("#111827").fontSize(10).font("Helvetica-Bold");
      const leftCol = 65;
      const rightCol = 320;
      const lineH = 18;
      let infoY = y + 32;

      const fields = [
        ["Nama", report.evaluatee.fullName],
        ["NIP", report.evaluatee.nip],
        ["Jabatan", report.evaluatee.position],
        ["Divisi", report.evaluatee.division],
        ["Tipe Karyawan", report.evaluatee.employmentType],
        ["Email", report.evaluatee.email ?? "-"],
      ];
      fields.forEach(([label, value], i) => {
        const colX = i % 2 === 0 ? leftCol : rightCol;
        const colY = infoY + Math.floor(i / 2) * lineH;
        doc
          .font("Helvetica-Bold")
          .fillColor(grayColor)
          .text(`${label}:`, colX, colY, { continued: true });
        doc
          .font("Helvetica")
          .fillColor("#111827")
          .text(` ${value ?? "-"}`);
      });

      y += 130;

      // ── Informasi Evaluasi ──────────────────────────────────
      doc.rect(50, y, pageWidth, 80).fill("#EFF6FF");
      doc
        .fillColor(primaryColor)
        .fontSize(13)
        .font("Helvetica-Bold")
        .text("INFORMASI EVALUASI", 65, y + 12);

      const evalInfoY = y + 32;
      doc.fontSize(10);
      [
        ["Penilai", report.evaluator.fullName],
        ["Jabatan Penilai", report.evaluator.position],
        ["Status", report.status],
        [
          "Tanggal Selesai",
          new Date(report.completedAt).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          }) +
            ", " +
            new Date(report.completedAt).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            }) +
            " WIB",
        ],
      ].forEach(([label, value], i) => {
        const colX = i % 2 === 0 ? leftCol : rightCol;
        const colY = evalInfoY + Math.floor(i / 2) * lineH;
        doc
          .font("Helvetica-Bold")
          .fillColor(grayColor)
          .text(`${label}:`, colX, colY, { continued: true });
        doc.font("Helvetica").fillColor("#111827").text(` ${value}`);
      });

      y += 100;

      // ── Skor Rata-rata ──────────────────────────────────────
      doc.rect(50, y, pageWidth, 60).fill(primaryColor);
      doc
        .fillColor("white")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("SKOR RATA-RATA", 65, y + 10);
      doc
        .fontSize(28)
        .font("Helvetica-Bold")
        .text(`${report.averageScore} / ${report.maxScore}`, 65, y + 24, {
          continued: true,
        });
      doc
        .fontSize(12)
        .font("Helvetica")
        .text(`   ${report.predikat}`, { baseline: "bottom" });

      y += 80;

      // ── Tabel Kategori ──────────────────────────────────────
      doc
        .fillColor(primaryColor)
        .fontSize(13)
        .font("Helvetica-Bold")
        .text("DETAIL PENILAIAN PER KATEGORI", 50, y);
      y += 20;

      // Header tabel
      const colWidths = [30, pageWidth - 110, 80]; // Kolom: No=30, Kategori=sisa ruang, Skor=80
      const colStarts = [50, 80, 80 + colWidths[1]]; // X awal tiap kolom: 50 → 80 → 80+lebar_kategori
      doc.rect(50, y, pageWidth, 22).fill(primaryColor);
      doc.fillColor("white").fontSize(10).font("Helvetica-Bold");
      ["#", "Kategori", "Skor / 5"].forEach((h, i) => {
        doc.text(h, colStarts[i] + 4, y + 6, { width: colWidths[i] - 8 });
      });
      y += 22;

      report.categories.forEach((cat, idx) => {
        const rowBg = idx % 2 === 0 ? "#FFFFFF" : lightGray;
        doc.rect(50, y, pageWidth, 22).fill(rowBg);
        doc.fillColor("#111827").fontSize(10).font("Helvetica");
        doc.text(String(idx + 1), colStarts[0] + 4, y + 6, {
          width: colWidths[0] - 8,
        });
        doc.text(cat.categoryName, colStarts[1] + 4, y + 6, {
          width: colWidths[1] - 8,
        });
        doc
          .font("Helvetica-Bold")
          .text(String(cat.score), colStarts[2] + 4, y + 6, {
            width: colWidths[2] - 8,
          });
        y += 22;
      });

      y += 20;

      // ── Umpan Balik ─────────────────────────────────────────
      if (report.generalNotes) {
        if (y > doc.page.height - 150) {
          doc.addPage();
          y = 50;
        }
        doc
          .fillColor(primaryColor)
          .fontSize(13)
          .font("Helvetica-Bold")
          .text("UMPAN BALIK", 50, y);
        y += 18;
        doc.rect(50, y, pageWidth, 1).fill("#D1D5DB");
        y += 10;
        doc
          .fillColor("#374151")
          .fontSize(10)
          .font("Helvetica")
          .text(report.generalNotes, 50, y, {
            width: pageWidth,
            align: "justify",
          });
      }

      // ── Footer ──────────────────────────────────────────────
      doc
        .fontSize(8)
        .fillColor(grayColor)
        .font("Helvetica")
        .text(
          `Dicetak otomatis oleh sistem CorpPerform • ${new Date().toLocaleString("id-ID")}`,
          50,
          doc.page.height - 50,
          { width: pageWidth, align: "center" },
        );

      doc.end();
    });
  },

  // & ============ EXPORT LAPORAN PENILAIAN (EXCEL / PDF) ============

  async exportReport(
    userId: string,
    query: {
      period: string;
      divisionId?: string;
      search?: string;
      format?: "xlsx" | "pdf";
    },
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const scope = await AssessmentsService._getScope(userId);
    const format = query.format ?? "xlsx";

    const employeeFilter: any = {};
    if (scope.divisionId) {
      employeeFilter.position = { divisionId: scope.divisionId };
    } else if (query.divisionId) {
      employeeFilter.position = { divisionId: query.divisionId };
    }
    if (query.search) {
      employeeFilter.fullName = { contains: query.search, mode: "insensitive" };
    }

    const where: any = { period: query.period };
    if (Object.keys(employeeFilter).length) where.evaluatee = employeeFilter;

    const assessments = await prisma.assessments.findMany({
      where,
      orderBy: [{ assessmentDate: "asc" }],
      include: {
        evaluatee: {
          include: {
            user: { select: { nip: true } },
            position: {
              select: { name: true, division: { select: { name: true } } },
            },
          },
        },
        evaluator: { select: { employees: { select: { fullName: true } } } },
        details: {
          select: { score: true, categoryName: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const periodSafe = query.period.replace(/\s/g, "_");
    const filename = `laporan_penilaian_${periodSafe}.${format}`;

    if (format === "xlsx") {
      const XLSX = await import("xlsx");
      const rows = assessments.map((a, i) => {
        const avg = AssessmentsService._calcAvgScore(a.details);
        const categoryScores: Record<string, number> = {};
        a.details.forEach((d) => {
          categoryScores[d.categoryName] = Number(d.score);
        });
        return {
          No: i + 1,
          "Nama Karyawan": a.evaluatee.fullName,
          NIP: a.evaluatee.user?.nip ?? "-",
          Divisi: a.evaluatee.position?.division?.name ?? "-",
          Jabatan: a.evaluatee.position?.name ?? "-",
          Penilai: a.evaluator?.employees?.fullName ?? "Admin HR",
          Periode: a.period,
          "Tanggal Penilaian": new Date(a.assessmentDate).toLocaleDateString(
            "id-ID",
          ),
          ...categoryScores,
          "Rata-rata Skor": avg,
          Status: "Selesai",
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      // Lebar kolom = max(panjang nama header vs 15 karakter minimum) → XLSX column width unit
      const colWidths = Object.keys(rows[0] ?? {}).map((k) => ({
        wch: Math.max(k.length, 15),
      }));
      ws["!cols"] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Laporan Penilaian");
      const buffer = Buffer.from(
        XLSX.write(wb, { type: "buffer", bookType: "xlsx" }),
      );
      return {
        buffer,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename,
      };
    }

    // PDF
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 50,
        size: "A4",
        layout: "landscape",
      });
      const buffers: Buffer[] = [];
      doc.on("data", (c) => buffers.push(c));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const primaryColor = "#2563EB";
      const lightGray = "#F3F4F6";
      const pageWidth = doc.page.width - 100;

      doc.rect(50, 50, pageWidth, 60).fill(primaryColor);
      doc
        .fillColor("white")
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("LAPORAN PENILAIAN KARYAWAN", 65, 62);
      doc
        .fontSize(11)
        .font("Helvetica")
        .text(
          `Periode: ${query.period}  |  Dicetak: ${new Date().toLocaleDateString("id-ID")}`,
          65,
          84,
        );

      let y = 130;
      const headers = [
        "#",
        "Nama Karyawan",
        "NIP",
        "Jabatan",
        "Divisi",
        "Penilai",
        "Tgl Penilaian",
        "Rata-rata",
        "Status",
      ];
      const colW = [25, 120, 65, 105, 85, 100, 80, 60, 50];
      const colX: number[] = [];
      let cx = 50; // Mulai dari margin kiri 50pt
      colW.forEach((w) => {
        colX.push(cx); // Simpan posisi X awal kolom saat ini
        cx += w; // Geser kursor ke kanan sebesar lebar kolom untuk kolom berikutnya
      });

      // Header tabel
      doc.rect(50, y, pageWidth, 20).fill(primaryColor);
      doc.fillColor("white").fontSize(8).font("Helvetica-Bold");
      headers.forEach((h, i) =>
        doc.text(h, colX[i] + 2, y + 6, { width: colW[i] - 4 }),
      );
      y += 20;

      assessments.forEach((a, idx) => {
        if (y > doc.page.height - 80) {
          doc.addPage({ layout: "landscape" });
          y = 50;
        }
        const avg = AssessmentsService._calcAvgScore(a.details);
        const rowBg = idx % 2 === 0 ? "#FFFFFF" : lightGray;
        doc.rect(50, y, pageWidth, 18).fill(rowBg);
        doc.fillColor("#111827").fontSize(7.5).font("Helvetica");
        const row = [
          String(idx + 1),
          a.evaluatee.fullName,
          a.evaluatee.user?.nip ?? "-",
          a.evaluatee.position?.name ?? "-",
          a.evaluatee.position?.division?.name ?? "-",
          a.evaluator?.employees?.fullName ?? "Admin",
          new Date(a.assessmentDate).toLocaleDateString("id-ID"),
          `${avg} / 5`,
          "Selesai",
        ];
        row.forEach((val, i) =>
          doc.text(val, colX[i] + 2, y + 5, {
            width: colW[i] - 4,
            ellipsis: true,
          }),
        );
        y += 18;
      });

      doc
        .fontSize(7)
        .fillColor("#9CA3AF")
        .text(
          `Dicetak otomatis oleh CorpPerform  •  ${new Date().toLocaleString("id-ID")}`,
          50,
          doc.page.height - 40,
          { width: pageWidth, align: "center" },
        );

      doc.end();
    });

    return { buffer, contentType: "application/pdf", filename };
  },

  // & ============ GET MY RESULTS (MOBILE KARYAWAN) ============

  async getMyResults(employeeUserId: string, period: string) {
    const employee = await prisma.employees.findUnique({
      where: { userId: employeeUserId },
    });
    if (!employee) throw new Error("Not Found: Data karyawan tidak ditemukan.");

    const currentAssessment = await prisma.assessments.findFirst({
      where: { evaluateeId: employee.id, period },
      include: {
        evaluator: {
          select: {
            employees: {
              select: {
                fullName: true,
                position: { select: { name: true } },
                employeeDetails: { select: { profilePictureUrl: true } },
              },
            },
          },
        },
        details: {
          where: { category: { isVisibleToEmployee: true } },
          include: { category: { select: { name: true, description: true } } },
        },
      },
    });

    if (!currentAssessment) {
      throw new Error(`Not Found: Belum ada penilaian untuk periode ${period}`);
    }

    /**
     * Rata-rata skor dihitung dari semua detail penilaian yang visibleToEmployee = true.
     * contoh return = 4.25 (jika ada 4 kategori dengan skor 4, 5, 4, 4)
     */
    const avg = AssessmentsService._calcAvgScore(currentAssessment.details);

    const historyAssessments = await prisma.assessments.findMany({
      where: { evaluateeId: employee.id, id: { not: currentAssessment.id } },
      orderBy: { assessmentDate: "desc" },
      take: 3,
      include: { details: { select: { score: true } } },
    });

    const formattedHistory = historyAssessments.map((hist) => ({
      period: hist.period,
      date: hist.assessmentDate,
      score: AssessmentsService._calcAvgScore(hist.details),
    }));

    return {
      currentReview: {
        ...currentAssessment,
        averageScore: avg,
        maxScore: 5,
        predikat: AssessmentsService._getPredikat(avg),
        managerInfo: {
          name: currentAssessment.evaluator?.employees?.fullName || "Admin HR",
          position:
            currentAssessment.evaluator?.employees?.position?.name ||
            "Manajemen",
          photo:
            currentAssessment.evaluator?.employees?.employeeDetails?.[0]
              ?.profilePictureUrl || null,
        },
      },
      history: formattedHistory,
    };
  },
};
