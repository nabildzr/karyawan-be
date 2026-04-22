// * File ini berisi implementasi service module submissions.

import { DEFAULT_TIMEZONE, JAKARTA_UTC_OFFSET } from "../../config/timezone";
import {
  findFirstInvalidScheduleDateInRange,
  findScheduleDayByDate,
  hasActiveShiftOnDay,
} from "../../shared/attendances/schedules";
import type { AuditActor } from "../../shared/audit/actor";
import { writeAuditLog } from "../../shared/audit/writeAudit";
import {
  deleteSubmissionAttachment,
  uploadSubmissionAttachment,
} from "./attachment.service";
import type {
  SubmissionsCreatePayload,
  SubmissionStatusUpdatePayload,
} from "./submissions.schema";
import { SubmissionsRepository } from "./submissions.repository";
import {
  buildSearchFilter,
  REJECTED_DELETE_WINDOW_MS,
  type SubmissionListParams,
  toEndOfDay,
  toScheduleConflictMessage,
  toStartOfDay,
} from "./utils";
import { AttendanceStatus } from "../../generated/prisma/enums";

const prisma = SubmissionsRepository.db;

type ApprovedAttendanceSyncEntry = {
  dateKey: string;
  attendanceId: string;
  action: "created" | "updated" | "skipped";
};

function toJakartaDateKey(date: Date) {
  return date.toLocaleDateString("sv-SE", { timeZone: DEFAULT_TIMEZONE });
}

function buildAttendanceWindow(
  dateKey: string,
  shift: {
    name: string;
    startTime: string;
    endTime: string;
    isCrossDay: boolean;
  },
) {
  const shiftNameSnapshot = shift.name;
  const expectedCheckInSnapshot = new Date(
    `${dateKey}T${shift.startTime}:00.000${JAKARTA_UTC_OFFSET}`,
  );
  const expectedCheckOutSnapshot = new Date(
    `${dateKey}T${shift.endTime}:00.000${JAKARTA_UTC_OFFSET}`,
  );

  if (shift.isCrossDay) {
    expectedCheckOutSnapshot.setDate(expectedCheckOutSnapshot.getDate() + 1);
  }

  return {
    shiftNameSnapshot,
    expectedCheckInSnapshot,
    expectedCheckOutSnapshot,
  };
}

/**
 * Sinkronasi data kehadiran manual, jadi data absensi nya ada di database, ga perlu daily cron job..
 * @param tx  instance transaksi Prisma yang sedang berjalan, digunakan untuk memastikan operasi database dilakukan dalam satu transaksi yang sama dengan pembaruan status pengajuan
 * @param employee  objek yang berisi informasi tentang employee yang pengajuannya disetujui, termasuk working schedule-nya yang diperlukan untuk menentukan hari kerja dalam rentang tanggal pengajuan
 * @param submission objek yang berisi informasi tentang pengajuan yang disetujui, termasuk tipe, rentang tanggal, dan alasan pengajuan yang diperlukan untuk menentukan hari kerja yang perlu disinkronisasi dan alasan manual yang sesuai pada data kehadiran
 * @param actor objek yang berisi informasi tentang pengguna yang melakukan pembaruan status pengajuan, digunakan untuk mencatat informasi pelaku pada data kehadiran manual yang disinkronisasi
 * @returns array yang berisi entri hasil sinkronisasi kehadiran manual untuk setiap hari kerja yang termasuk dalam rentang tanggal pengajuan, dengan informasi tanggal, ID data kehadiran yang dibuat atau diperbarui, dan aksi yang dilakukan (created, updated, atau skipped)
 */
async function syncApprovedSubmissionAttendances(
  tx: any,
  employee: {
    id: string;
    workingSchedules?: {
      days?: Array<{
        dayOfWeek: string;
        isActive?: boolean | null;
        shift?: {
          name: string;
          startTime: string;
          endTime: string;
          isCrossDay: boolean;
        } | null;
      }> | null;
    } | null;
  },
  submission: {
    type: string;
    startDate: Date;
    endDate: Date;
    reason: string;
  },
  actor: { id: string; role: string },
): Promise<ApprovedAttendanceSyncEntry[]> {
  // Inisialisasi array, penyimpanan dari hasil sinkronisasi data kehadiran 
  const attendanceSync: ApprovedAttendanceSyncEntry[] = [];
  const scheduleDays = employee.workingSchedules?.days ?? [];

  const cursor = toStartOfDay(submission.startDate);
  const rangeEnd = toEndOfDay(submission.endDate);

  // Gunakan anchor jam 12 supaya iterasi tanggal tidak ketarik shift timezone.
  cursor.setHours(12, 0, 0, 0);
  rangeEnd.setHours(12, 0, 0, 0);

  while (cursor <= rangeEnd) {
    // ambil hari (konversi english -> indo)
    const scheduleDay = findScheduleDayByDate(
      scheduleDays,
      cursor,
      DEFAULT_TIMEZONE,
    );

    // 
    if (!hasActiveShiftOnDay(scheduleDay) || !scheduleDay.shift) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    const dateKey = toJakartaDateKey(cursor);
    const dayStart = new Date(`${dateKey}T00:00:00.000${JAKARTA_UTC_OFFSET}`);
    const dayEnd = new Date(`${dateKey}T23:59:59.999${JAKARTA_UTC_OFFSET}`);
    const attendanceWindow = buildAttendanceWindow(dateKey, scheduleDay.shift);

    // cari data absensi yang udah ada
    const existingAttendance = await tx.attendances.findFirst({
      where: {
        employeeId: employee.id,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { createdAt: "desc" },
    });

    // kalau ada absensi 
    if (existingAttendance?.checkIn || existingAttendance?.checkOut) {
      attendanceSync.push({
        dateKey,
        attendanceId: existingAttendance.id,
        action: "skipped",
      });
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    // template untuk date di tanggal terkait
    const attendancePayload = {
      employeeId: employee.id,
      shiftNameSnapshot: attendanceWindow.shiftNameSnapshot,
      expectedCheckInSnapshot: attendanceWindow.expectedCheckInSnapshot,
      expectedCheckOutSnapshot: attendanceWindow.expectedCheckOutSnapshot,
      status: AttendanceStatus.LEAVE,
      statusCheckOut: null,
      isManualEntry: true,
      manualReason: `Pengajuan ${submission.type} disetujui`,
      manualNotes: submission.reason.trim(),
      manualEntryBy: actor.id,
      manualEntryAt: new Date(),
      manualEntryByRole: actor.role,
      deviceInfo: "SUBMISSION_APPROVAL",
      createdAt: dayStart,
    };

    // kalau ada data attendance update jadi leave
    if (existingAttendance) {
      const updatedAttendance = await tx.attendances.update({
        where: { id: existingAttendance.id },
        data: {
          ...attendancePayload,
        },
      });

      attendanceSync.push({
        dateKey,
        attendanceId: updatedAttendance.id,
        action: "updated",
      });
    } else {
      // kalau gak ada
      const createdAttendance = await tx.attendances.create({
        data: attendancePayload,
      });

      attendanceSync.push({
        dateKey,
        attendanceId: createdAttendance.id,
        action: "created",
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return attendanceSync;
}

/** Mengekspor SubmissionService untuk kebutuhan modul ini. */
export const SubmissionService = {
  /** Mendapatkan semua pengajuan dengan filter dan pagination. */
  async getAll(params: SubmissionListParams = {}) {
    const { page = 1, limit = 20, status, type, search } = params;

    const skip = (page - 1) * limit;

    const where: any = {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(buildSearchFilter(search) ?? {}),
    };

    const [data, total] = await Promise.all([
      prisma.submissions.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              nip: true,
              rbacRole: { select: { key: true } },
              employees: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      prisma.submissions.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  },

  /** Mendapatkan pengajuan milik pengguna tertentu (sendiri) dengan filter dan pagination. */
  async getMine(
    userId: string,
    params: Pick<
      SubmissionListParams,
      "page" | "limit" | "status" | "type"
    > = {},
  ) {
    const { page = 1, limit = 20, status, type } = params;
    const skip = (page - 1) * limit;

    const userExists = await prisma.users.findUnique({ where: { id: userId } });
    if (!userExists) {
      throw new Error(
        "Not Found: Pengguna dengan ID tersebut tidak ditemukan.",
      );
    }

    const where: any = {
      userId,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.submissions.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.submissions.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  },

  /**
   * Mendapatkan detail pengajuan berdasarkan ID-nya, jika user admin atau pemilik pengajuan.
   * @param submissionId id pengajuan yang ingin diambil detailnya
   * @param actor  objek yang berisi informasi tentang pengguna yang melakukan request, digunakan untuk validasi akses dan pencatatan audit log
   * @returns  detail pengajuan jika ditemukan dan pengguna memiliki akses, atau error jika tidak ditemukan atau tidak memiliki akses
   */
  async getDetailById(
    submissionId: string,
    actor: { userId: string; isAdmin: boolean },
  ) {
    const submission = await prisma.submissions.findFirst({
      where: {
        id: submissionId,
        ...(actor.isAdmin ? {} : { userId: actor.userId }),
      },
      include: {
        user: {
          select: {
            id: true,
            nip: true,
            rbacRole: { select: { key: true } },
            employees: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!submission) {
      throw new Error("Not Found: Data pengajuan tidak ditemukan.");
    }

    return submission;
  },

  /**
   * Membuat pengajuan
   * @param userId ID pengguna yang membuat pengajuan, harus valid dan terdaftar di database
   * @param payload objek yang berisi data pengajuan yang ingin dibuat, harus memenuhi validasi yang ditentukan di SubmissionsCreatePayload
   * @param actor objek yang berisi informasi tentang pengguna yang melakukan request, digunakan untuk pencatatan audit log
   * @returns data pengajuan yang baru dibuat jika berhasil, atau error jika terjadi kegagalan validasi, konflik data, atau kegagalan saat mengunggah lampiran ke Cloudinary
   */
  async create(
    userId: string,
    payload: SubmissionsCreatePayload,
    actor: AuditActor,
  ) {
    const employee = await prisma.employees.findFirst({
      where: { userId },
      include: {
        workingSchedules: {
          include: {
            days: {
              include: { shift: true },
            },
          },
        },
      },
    });

    if (!employee) {
      throw new Error(
        "Not Found: Pengguna dengan ID tersebut tidak ditemukan.",
      );
    }

    if (!payload.reason?.trim()) {
      throw new Error("Bad Request: Alasan pengajuan wajib diisi.");
    }

    const startDate = toStartOfDay(payload.startDate);
    const endDate = toEndOfDay(payload.endDate);

    if (startDate > endDate) {
      throw new Error(
        "Bad Request: Tanggal mulai tidak boleh melebihi tanggal selesai.",
      );
    }

    const scheduleValidationIssue = findFirstInvalidScheduleDateInRange(
      employee.workingSchedules?.days ?? [],
      startDate,
      endDate,
      DEFAULT_TIMEZONE,
    );

    if (scheduleValidationIssue) {
      throw new Error(toScheduleConflictMessage(scheduleValidationIssue));
    }

    const overlapping = await prisma.submissions.findFirst({
      where: {
        userId,
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: {
        id: true,
        type: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

    if (overlapping) {
      throw new Error(
        "Conflict: Anda sudah memiliki pengajuan aktif pada rentang tanggal tersebut.",
      );
    }

    // ? cek apakah sedang dalam hari libur
    const isHoliday = await prisma.publicHolidays.findFirst({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    if (isHoliday) {
      throw new Error(
        `Conflict: Tanggal ${isHoliday.date.toISOString().split("T")[0]} adalah hari libur (${isHoliday.name}). Pengajuan tidak dapat dibuat pada rentang tanggal yang mencakup hari libur.`,
      );
    }

    // ? cek apakah sudah check-in atau check-out pada hari yang diajukan (untuk jenis tertentu)
    const hasAttendance = await prisma.attendances.findFirst({
      where: {
        employeeId: employee.id,
        OR: [
          {
            checkIn: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            checkOut: {
              gte: startDate,
              lte: endDate,
            },
          },
        ],
      },
    });

    if (hasAttendance) {
      throw new Error(
        "Conflict: Anda sudah melakukan absensi pada hari yang termasuk dalam rentang tanggal pengajuan. Pengajuan tidak dapat dibuat.",
      );
    }

    // ? cek apakah jenis pengajuan memungkinkan untuk diajukan pada hari yang sudah lewat
    const now = new Date();
    if (["IZIN_SAKIT", "IZIN_KHUSUS"].includes(payload.type) && endDate < now) {
      throw new Error(
        "Conflict: Jenis pengajuan Izin Sakit dan Izin Khusus tidak dapat diajukan untuk tanggal yang sudah lewat.",
      );
    }

    // ? inisialisasi variable biar bisa diakses di blok catch untuk cleanup jika terjadi error
    let uploadedAttachment: {
      url: string;
      publicId: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
    } | null = null;
    let submissionWasCreated = false;

    try {
      if (payload.attachmentFile) {
        uploadedAttachment = await uploadSubmissionAttachment(
          payload.attachmentFile,
          userId,
        );
      }

      const newSubmission = await prisma.submissions.create({
        data: {
          userId,
          type: payload.type as any,
          startDate,
          endDate,
          reason: payload.reason.trim(),
          attachment: uploadedAttachment?.url ?? null,
          attachmentPublicId: uploadedAttachment?.publicId ?? null,
          attachmentOriginalName: uploadedAttachment?.originalName ?? null,
          attachmentMimeType: uploadedAttachment?.mimeType ?? null,
          attachmentSizeBytes: uploadedAttachment?.sizeBytes ?? null,
        },
      });
      submissionWasCreated = true;

      try {
        await writeAuditLog({
          actor,
          action: "CREATE_SUBMISSION",
          entity: "Submissions",
          entityId: newSubmission.id,
          changes: {
            before: null,
            after: {
              type: newSubmission.type,
              startDate: newSubmission.startDate,
              endDate: newSubmission.endDate,
              status: newSubmission.status,
              attachment: newSubmission.attachment,
              attachmentPublicId: newSubmission.attachmentPublicId,
            },
          },
          reason: "Pengajuan baru dibuat oleh karyawan.",
        });
      } catch (auditError) {
        console.error(
          "Failed to write CREATE_SUBMISSION audit log:",
          auditError,
        );
      }

      return newSubmission;
    } catch (error) {
      if (!submissionWasCreated && uploadedAttachment?.publicId) {
        try {
          await deleteSubmissionAttachment(uploadedAttachment.publicId);
        } catch (cleanupError) {
          console.error(
            "Failed to cleanup uploaded attachment after submission creation error:",
            cleanupError,
          );
        }
      }

      throw error;
    }
  },

  /**
   * Hapus berdasarkan ID-nya, hanya untuk pengajuan dengan status REJECTED dan dalam jangka waktu 48 jam setelah penolakan, serta bukan milik sendiri.
   * @param id ID pengguna pemilik pengajuan
   * @param actor objek yang berisi informasi tentang pengguna yang melakukan request, digunakan untuk pencatatan audit log
   * @returns data pengajuan yang sudah dihapus jika berhasil, atau error jika pengajuan tidak ditemukan, tidak memenuhi syarat untuk dihapus, atau terjadi kegagalan saat menghapus lampiran dari Cloudinary
   */
  async deleteById(id: string, actor: AuditActor) {
    const existing = await prisma.submissions.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Not Found: Data pengajuan tidak ditemukan.");
    }

    if (existing.userId === actor.id) {
      throw new Error(
        "Forbidden: Anda tidak dapat menghapus pengajuan milik sendiri.",
      );
    }

    if (existing.status !== "REJECTED") {
      throw new Error(
        "Forbidden: Hanya pengajuan dengan status REJECTED yang dapat dihapus.",
      );
    }

    const rejectedAtMs = new Date(existing.updatedAt).getTime();
    if (Number.isNaN(rejectedAtMs)) {
      throw new Error("Conflict: Waktu penolakan pengajuan tidak valid.");
    }

    const elapsedMs = Date.now() - rejectedAtMs;
    if (elapsedMs > REJECTED_DELETE_WINDOW_MS) {
      throw new Error(
        "Conflict: Pengajuan hanya dapat dihapus dalam 48 jam setelah ditolak.",
      );
    }

    if (existing.attachmentPublicId) {
      try {
        await deleteSubmissionAttachment(existing.attachmentPublicId);
      } catch (error) {
        console.error("Cloudinary cleanup failed on submission delete:", error);
        throw new Error(
          "Conflict: Gagal menghapus lampiran dari Cloudinary. Data pengajuan tidak dihapus.",
        );
      }
    }

    const deleted = await prisma.submissions.delete({ where: { id } });

    try {
      await writeAuditLog({
        actor,
        action: "DELETE_SUBMISSION",
        entity: "Submissions",
        entityId: id,
        changes: {
          before: {
            id: existing.id,
            userId: existing.userId,
            status: existing.status,
            type: existing.type,
            startDate: existing.startDate,
            endDate: existing.endDate,
            attachment: existing.attachment,
            attachmentPublicId: existing.attachmentPublicId,
          },
          after: null,
        },
      });
    } catch (auditError) {
      console.error("Failed to write DELETE_SUBMISSION audit log:", auditError);
    }

    return deleted;
  },

  /**
   * Memperbarui status pengajuan berdasarkan ID-nya, hanya untuk pengajuan dengan status PENDING.
   * @param payload objek yang berisi data pembaruan status pengajuan
   * @param id ID pengajuan yang ingin diperbarui
   * @param adminId ID admin yang melakukan pembaruan
   * @param adminRole peran admin yang melakukan pembaruan
   * @returns data pengajuan yang diperbarui jika berhasil, atau error jika pengajuan tidak ditemukan, tidak memenuhi syarat untuk diperbarui, atau terjadi kegagalan saat memperbarui status
   * @remarks jika status nya APPROVED, akan disinkronasi data kehadiran manual untuk setiap hari kerja yang termasuk dalam rentang tanggal pengajuan, dengan status LEAVE dan alasan manual yang sesuai. Jika status nya REJECTED, alasan penolakan wajib diisi dan akan disimpan di database.
   */
  async updateStatus(
    payload: SubmissionStatusUpdatePayload,
    id: string,
    adminId: string,
    adminRole: string,
  ) {
    const { status, rejectionReason } = payload;

    const { updatedSubmission, attendanceSync, existingSnapshot } =
      await prisma.$transaction(async (tx) => {
        const existing = await tx.submissions.findUnique({ where: { id } });
        if (!existing) {
          throw new Error("Not Found: Data pengajuan tidak ditemukan.");
        }

        if (existing.userId === adminId) {
          throw new Error(
            "Forbidden: Anda tidak dapat memproses pengajuan milik sendiri.",
          );
        }

        if (existing.status !== "PENDING") {
          throw new Error(
            "Conflict: Pengajuan ini sudah diproses dan tidak dapat diubah lagi.",
          );
        }

        // kalau di reject
        if (
          status === "REJECTED" &&
          (!rejectionReason || rejectionReason.trim() === "")
        ) {
          throw new Error("Bad Request: Alasan penolakan wajib diisi.");
        }

        const existingSnapshot = {
          status: existing.status,
          rejectionReason: existing.rejectionReason,
        };

        let approvalAttendanceSync: ApprovedAttendanceSyncEntry[] = [];

        if (status === "APPROVED") {
          const isLeaveSubmission = ["IZIN_SAKIT", "IZIN_KHUSUS"].includes(
            existing.type,
          );

          // Izin sakit dan izin khusus tetap sinkron ke absensi manual.
          if (isLeaveSubmission) {
            const employee = await tx.employees.findFirst({
              where: { userId: existing.userId },
              include: {
                workingSchedules: {
                  include: {
                    days: {
                      include: { shift: true },
                    },
                  },
                },
              },
            });

            // Kalau data employee ada, sinkronisasi kehadiran manual untuk rentang tanggal pengajuan.
            if (employee) {
              approvalAttendanceSync = await syncApprovedSubmissionAttendances(
                tx,
                employee,
                {
                  type: existing.type,
                  startDate: existing.startDate,
                  endDate: existing.endDate,
                  reason: existing.reason,
                },
                {
                  id: adminId,
                  role: adminRole,
                },
              );
            }
          }
        }

        const updatedSubmission = await tx.submissions.update({
          where: { id },
          data: {
            status,
            rejectionReason:
              status === "REJECTED" ? rejectionReason?.trim() : null,
          },
          include: {
            user: {
              select: {
                id: true,
                nip: true,
                rbacRole: { select: { key: true } },
                employees: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                  },
                },
              },
            },
          },
        });

        return {
          updatedSubmission,
          attendanceSync: approvalAttendanceSync,
          existingSnapshot,
        };
      });

    await writeAuditLog({
      actor: {
        id: adminId,
        role: adminRole,
      },
      action:
        status === "APPROVED" ? "APPROVE_SUBMISSION" : "REJECT_SUBMISSION",
      entity: "Submissions",
      entityId: id,
      changes: {
        before: {
          status: existingSnapshot.status,
          rejectionReason: existingSnapshot.rejectionReason,
        },
        after: {
          status,
          rejectionReason:
            status === "REJECTED" ? rejectionReason?.trim() : null,
          attendanceSync,
        },
      },
      reason: status === "REJECTED" ? rejectionReason?.trim() : undefined,
    });

    return updatedSubmission;
  },

  // & Tarik kembali pengajuan oleh karyawan yang mengajukan
  async retract(id: string, userId: string) {
    const existing = await prisma.submissions.findUnique({ where: { id } });

    // ^ validasi data pengajuan
    if (!existing) {
      throw new Error("Not Found: Data pengajuan tidak ditemukan.");
    }

    // ^ Hanya bisa menarik kembali pengajuan milik sendiri
    if (existing.userId !== userId) {
      throw new Error(
        "Forbidden: Anda hanya dapat menarik kembali pengajuan milik sendiri.",
      );
    }

    // ^ Hanya pengajuan dengan status PENDING yang bisa ditarik kembali
    if (existing.status !== "PENDING") {
      throw new Error(
        "Conflict: Hanya pengajuan dengan status PENDING yang dapat ditarik kembali.",
      );
    }

    // ^ hapus saja data pengajuan, karena belum diproses sama sekali
    const deleted = await prisma.submissions.delete({ where: { id } });

    // ? hapus attachment jika ada
    if (existing.attachmentPublicId) {
      try {
        await deleteSubmissionAttachment(existing.attachmentPublicId);
      } catch (error) {
        console.error(
          "Cloudinary cleanup failed on submission retract:",
          error,
        );
        // ? tidak menggagalkan proses tarik kembali meskipun terjadi error saat hapus lampiran, karena data pengajuan sudah dihapus dari database
      }
    }

    try {
      await writeAuditLog({
        actor: {
          id: userId,
          role: "EMPLOYEE",
        },
        action: "RETRACT_SUBMISSION",
        entity: "Submissions",
        entityId: id,
        changes: {
          before: {
            status: existing.status,
            type: existing.type,
            startDate: existing.startDate,
            endDate: existing.endDate,
          },
          after: null,
        },
        reason: "Pengajuan ditarik kembali oleh karyawan sebelum diproses.",
      });
    } catch (auditError) {
      console.error(
        "Failed to write RETRACT_SUBMISSION audit log:",
        auditError,
      );
    }

    return deleted;
  },
};
